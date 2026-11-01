    grandTotalKm += totalKm;
    grandTotalCost += totalCost;
    grandTotalVisits += totalVisits;
    grandTotalCustomers += uniqueCustomers.size;
  }

  // Sort by most visits first
  repReports.sort((a, b) => b.totalVisits - a.totalVisits);

  // Build period label
  let periodLabel = "";
  if (periodType === "daily") {
    periodLabel = referenceDate.toLocaleDateString("en-ZA", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  } else if (periodType === "weekly") {
    periodLabel = `Week ${weekOrMonth}, ${year}`;
  } else {
    periodLabel = referenceDate.toLocaleDateString("en-ZA", { year: "numeric", month: "long" });
  }

  return {
    periodType,
    periodLabel,
    generatedAt: new Date().toISOString(),
    aaRatePerKm: AA_RATE_PER_KM,
    summary: {
      totalReps: repReports.length,
      totalVisits: grandTotalVisits,
      totalCustomersVisited: grandTotalCustomers,
      totalKm: Math.round(grandTotalKm * 100) / 100,
      totalCost: Math.round(grandTotalCost * 100) / 100,
    },
    repReports,
  };
}

/** Match bank payment rows to app invoices. Returns categorized results. */
export function matchBankPayments(rows: BankStatementRow[]): PaymentMatchResult[] {
  const results: PaymentMatchResult[] = [];
  for (const row of rows) {
    // Find invoice by number
    const inv = invoices.find((i) => i.invoiceNumber?.toLowerCase() === row.invoiceNumber.toLowerCase());
    if (!inv) {
      results.push({
        row,
        matchStatus: "invoice_not_found",
        invoice: null,
        appCustomer: null,
        nameSimilarity: 0,
        message: `Invoice ${row.invoiceNumber} not found in app`,
      });
      continue;
    }
    // Get customer from invoice
    const cust = inv.customer;
    const appCustName = cust?.name || "";
    const similarity = stringSimilarity(row.customerName, appCustName);
    // Determine name match level
    if (similarity >= 90) {
      // Name matches well — check amount
      const invTotal = Number(inv.total || inv.totalAmount || 0);
      const alreadyPaid = Number(inv.amountPaid || 0);
      const remaining = Math.max(0, invTotal - alreadyPaid);
      if (row.amountPaid >= remaining * 0.995 && row.amountPaid <= remaining * 1.005) {
        results.push({ row, matchStatus: "ready_full", invoice: inv, appCustomer: cust, nameSimilarity: similarity, message: `Full payment match: R ${row.amountPaid.toFixed(2)} = balance R ${remaining.toFixed(2)}` });
      } else if (row.amountPaid < remaining) {
        results.push({ row, matchStatus: "partial", invoice: inv, appCustomer: cust, nameSimilarity: similarity, message: `Partial payment: R ${row.amountPaid.toFixed(2)} of R ${remaining.toFixed(2)} balance` });
      } else {
        const over = row.amountPaid - remaining;
        results.push({ row, matchStatus: "overpayment", invoice: inv, appCustomer: cust, nameSimilarity: similarity, message: `Overpayment by R ${over.toFixed(2)}. Can allocate as credit.` });
      }
    } else if (similarity >= 60) {
      results.push({ row, matchStatus: "fuzzy_name", invoice: inv, appCustomer: cust, nameSimilarity: similarity, message: `Fuzzy name match (${similarity}%): "${row.customerName}" vs "${appCustName}". Please verify.` });
    } else {
      results.push({ row, matchStatus: "name_mismatch", invoice: inv, appCustomer: cust, nameSimilarity: similarity, message: `Name mismatch: "${row.customerName}" does not match app customer "${appCustName}"` });
    }
  }
  return results;
}

/** Process approved payment allocations using existing recordPayment logic.
 *  Each allocation pushes to Firebase via the standard mutation path. */
export function allocateBankPayments(allocations: any[]): { processed: number; errors: string[] } {
  const errors: string[] = [];
  let processed = 0;
  for (const alloc of allocations) {
    try {
      const { invoiceId, amount, paidDate, customerName, invoiceNumber } = alloc;
      const idx = invoices.findIndex((i) => i.id == invoiceId);
      if (idx < 0) { errors.push(`Invoice ${invoiceNumber} not found`); continue; }
      const inv = invoices[idx];
      // Auto-activate draft invoices
      if (inv.status === "draft") { inv.status = "sent"; inv.updatedAt = new Date().toISOString(); }
      const currentPaid = Number(inv.amountPaid || 0);
      const newPaid = currentPaid + amount;
      const total = Number(inv.total || inv.totalAmount || 0);
      inv.amountPaid = newPaid;
      const allocCredits0 = (inv.creditAllocations || []).reduce((sum: number, a: any) => sum + (a.amount || 0), 0);
      const lineCredits0 = (inv.creditedLines || []).reduce((sum: number, cl: any) => sum + (cl.creditAmount || 0), 0);
      const creditsApplied1 = allocCredits0 + lineCredits0;
      inv.balanceDue = total - newPaid - creditsApplied1; // Allow negative = customer credit
      if (inv.balanceDue <= 0.01) inv.status = "paid";
      else if (newPaid > 0) inv.status = "partially_paid";
      if (!inv.payments) inv.payments = [];
      inv.payments.push({
        id: Date.now() + Math.random(),
        amount,
        paymentMethod: "bank_transfer",
        paymentDate: paidDate || new Date().toISOString().slice(0, 10),
        referenceNumber: `BANK-IMPORT-${invoiceNumber}`,
        notes: `Bank statement import — ${customerName}`,
        createdAt: new Date().toISOString(),
      });
      processed++;
    } catch (e: any) {
      errors.push(`Failed to process ${alloc.invoiceNumber}: ${e.message}`);
    }
  }
  if (processed > 0) saveItem("sgf_invoices", invoices);
  return { processed, errors };
}

/** Auto-link Sage invoices to customers on every app startup.
 *  Silent version — no Firebase push, just local fix.
 *  This ensures ALL devices have matched Sage invoices.
 *  Handles both old CUST0001 format and new 10001 format. */
function autoLinkSageInvoices(): void {
  let changed = false;
  for (const inv of invoices) {
    // Only process Sage invoices with no customerId
    if (inv.source !== "sage" || (inv.customerId && inv.customerId !== 0)) continue;

    // Try exact match by customerCode
    const sageCode = (inv as any).customerCode || (inv as any).sageCustomerCode;
    if (sageCode) {
      const matched = customers.find((c) =>
        c.customerCode && String(c.customerCode).trim().toLowerCase() === String(sageCode).trim().toLowerCase()
      );
      if (matched) {
        inv.customerId = matched.id;
        inv.customer = matched;
        inv.customerCode = matched.customerCode;
        changed = true;
        continue;
      }
      // BACKWARD COMPAT: Sage invoices may have old CUST0001 format while
      // customers now have 10001 format. Try matching by converting.
      const sageCodeStr = String(sageCode).trim().toLowerCase();
      const legacyMatch = customers.find((c) => {
        if (!c.customerCode) return false;
        const custCode = String(c.customerCode).trim();
        // Match "10001" to "CUST0001" (strip CUST, compare number)
        const sageNum = sageCodeStr.replace(/^cust0*/, "");
        const custNum = custCode.replace(/^cust0*/, "");
        return sageNum === custNum && sageNum.length > 0;
      });
      if (legacyMatch) {
        inv.customerId = legacyMatch.id;
        inv.customer = legacyMatch;
        inv.customerCode = legacyMatch.customerCode;
        changed = true;
        continue;
      }
    }

