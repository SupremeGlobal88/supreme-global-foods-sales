  if (pll) { const d = JSON.parse(pll); if (Array.isArray(d)) packingListLines = d; }
  else packingListLines = [];
}

/** Fix customers with missing/invalid codes. Also converts remaining CUST codes to numeric.
 *  Preserves intentionally assigned custom alphanumeric codes (RHB001, etc.)
 *  Runs on every app startup to clean up legacy data. */
function fixMissingCustomerCodes(): void {
  let changed = false;
  // Get current max numeric code (from both plain numbers and CUST codes)
  const numericCodes = customers
    .map((c) => c.customerCode)
    .filter((code): code is string => !!code && code !== "AUTO")
    .map((code) => {
      if (/^\d+$/.test(code)) return parseInt(code);
      const match = code.match(/^CUST(\d+)$/i);
      if (match) return parseInt(match[1]);
      return 0;
    })
    .filter((n) => n > 0);
  let nextCode = (numericCodes.length > 0 ? Math.max(...numericCodes) : 10000) + 1;

  for (const c of customers) {
    const code = (c.customerCode || "").toString().trim();
    // 1. Fix blank, AUTO, null, undefined
    if (!code || code === "AUTO" || code === "undefined" || code === "null") {
      c.customerCode = String(nextCode);
      nextCode++;
      changed = true;

      continue;
    }
    // 2. Convert remaining CUST codes (CUST0384 → 10384)
    const custMatch = code.match(/^CUST(\d+)$/i);
    if (custMatch) {
      const oldNum = parseInt(custMatch[1]);
      // Only convert if the number doesn't conflict with an existing numeric code
      const wouldConflict = customers.some((other) =>
        other !== c && String(other.customerCode) === String(oldNum)
      );
      if (wouldConflict) {
        // Use next available to avoid conflict
        c.customerCode = String(nextCode);
        nextCode++;
      } else {
        c.customerCode = String(oldNum);
      }
      changed = true;

      continue;
    }
    // 3. Custom alphanumeric codes (RHB001, etc.) — leave as-is, they're intentional
  }
  if (changed) {
    saveItem("sgf_customers", customers);

  }
}

/** Fix Sage invoice dates corrupted by the old date parser.
 *  The old code did `20${parts[2]}` on 4-digit years, producing "202026-07-06".
 *  This fixes existing invoices on every startup AND returns changed invoices
 *  so callers can push to Firebase (cloud-first). */
export function fixSageInvoiceDates(): { changed: number; invoices: any[] } {
  let changed = 0;
  const changedInvs: any[] = [];
  for (const inv of invoices) {
    if (inv.source !== "sage") continue;
    const date = inv.invoiceDate;
    if (!date || typeof date !== "string") continue;
    // Match corrupted dates like "202026-07-06" or "202026/07/06" (year has 6 digits)
    // Handles both dash and slash separators from different Sage export formats
    const match = date.match(/^(\d{6,})[-/](\d{2})[-/](\d{2})/);
    if (match) {
      const badYear = match[1];
      const month = match[2];
      const day = match[3];
      // Extract the correct 4-digit year from the corrupted year
      // "202026" → "2026" (take last 4 digits if length > 4)
      const correctYear = badYear.length > 4 ? badYear.slice(-4) : badYear;
      inv.invoiceDate = `${correctYear}-${month}-${day}`;
      inv.updatedAt = new Date().toISOString();
      changed++;
      changedInvs.push(inv);

    }
  }
  if (changed > 0) {
    saveItem("sgf_invoices", invoices);

  }
  return { changed, invoices: changedInvs };
}

/**
 * Fix orders that have a matching invoice but lost their invoiceNumber.
 * This happens when:
 * 1. Invoice was generated and pushed to Firebase
 * 2. Order was NOT pushed (old bug in OrdersPage.tsx)
 * 3. Another device loads → gets invoice but order has no invoiceNumber
 * Result: order shows "No Invoice Generated" even though invoice exists.
 */
export function fixOrphanedInvoiceLinks(): { changed: number } {
  let changed = 0;
  const invoiceMap = new Map<string | number, string>();
  // Build map: orderId → invoiceNumber
  for (const inv of invoices) {
    if (inv.orderId && inv.invoiceNumber) {
      invoiceMap.set(inv.orderId, inv.invoiceNumber);
    }
  }
  // Scan orders and fix missing invoiceNumber
  for (const ord of orders) {
    if (ord.source === "sage") continue; // Sage orders don't link to generated invoices
    if (!ord.invoiceNumber && invoiceMap.has(ord.id)) {
      ord.invoiceNumber = invoiceMap.get(ord.id)!;
      ord.updatedAt = new Date().toISOString();
      changed++;

    }
  }
  if (changed > 0) {
    saveItem("sgf_orders", orders);

  }
  return { changed };
}

/** Read banking details from settings. Used by invoice print, statements, emails. */
export function getBankingDetails(): { bankName: string; accountName: string; accountNumber: string; branchCode: string; swiftCode: string } {
  const defaults = { bankName: "First National Bank (FNB)", accountName: "Supreme Global Foods", accountNumber: "63176141182", branchCode: "250655", swiftCode: "FIRNZAJJ" };
  try {
    const raw = getStorageItem("sgf_settings_banking");
    if (raw) {
      const saved = JSON.parse(raw);
      // Auto-fix old incorrect account number that was deployed in earlier versions
      if (saved.accountNumber === "62001234567") {
        saved.accountNumber = "63176141182";
        setStorageItem("sgf_settings_banking", JSON.stringify(saved));
      }
      return { ...defaults, ...saved };
    }
  } catch { /* ignore */ }
  return defaults;
}

/* ─── BANK STATEMENT IMPORT & PAYMENT ALLOCATION ─── */

export interface BankStatementRow {
  rowIndex: number;
  invoiceDate: string;
  customerName: string;
  invoiceNumber: string;
  amountDue: number;
  amountPaid: number;
  paidDate: string | null;
}

export interface PaymentMatchResult {
  row: BankStatementRow;
  matchStatus: "ready_full" | "partial" | "overpayment" | "name_mismatch" | "invoice_not_found" | "fuzzy_name";
  invoice: any | null;
  appCustomer: any | null;
  nameSimilarity: number;
  message: string;
}

/** Parse raw Excel rows (header + data) into structured bank statement rows.
 *  Only extracts rows with SGF invoice numbers. */
export function parseBankStatement(rawRows: any[][]): BankStatementRow[] {
  if (!rawRows || rawRows.length < 2) return [];
  const headers = rawRows[0];
  // Find column indices by header name (case-insensitive)
  const findIdx = (names: string[]) => {
    for (const n of names) {
      const idx = headers.findIndex((h: any) => String(h).toLowerCase().trim() === n.toLowerCase());
      if (idx >= 0) return idx;
    }
    return -1;
  };
  const colInvoiceDate = findIdx(["invoice date"]);
  // CR Invoice No header can be "cr invoice no" or variants
  const colInvoiceNo = findIdx(["invoice no", "invoice no.", "invoice number", "cr invoice no"]);
  // Customer column: some files have no header (blank column between Invoice Date and CR Invoice No)
  let colCustomer = findIdx(["customer"]);
  if (colCustomer < 0) {
    // Fallback: column 1 is typically the customer when header is blank
    colCustomer = 1;
  }
  // Amount due: can be "amount due", "cs", "op" (outstanding payment), or "amount"
  const colAmountDue = findIdx(["amount due", "cs", "op", "amount"]);
  // Amount paid: can be "amount paid", "over payment", "ap"
  const colAmountPaid = findIdx(["amount paid", "over payment", "ap"]);
  // Paid date: can be "paid date" or "pd"
  const colPaidDate = findIdx(["paid date", "pd"]);

