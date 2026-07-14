import { STATIC_CUSTOMERS, STATIC_PRODUCTS } from "@/data/staticData";

const SALES_REPS = ["Adeli", "Inhouse", "Michael", "Nkosana", "Shanelle", "Tebogo Bila"];

/** Get fresh static customer data */
function getStaticCustomers() {
  return [...STATIC_CUSTOMERS.map((c: any) => ({
    ...c,
    salesRepName: c.salesRepName || "",
  }))];
}

/** Get fresh static product data */
function getStaticProducts() {
  return [...STATIC_PRODUCTS.map((p: any) => ({ ...p }))];
}

// In-memory storage
let customers = getStaticCustomers();
let products = getStaticProducts();
let orders = [] as any[];
let invoices = [] as any[];
let appointments = [] as any[];
let checkins = [] as any[];
let specialPrices = [] as any[];
let auditLog = [] as any[];
let followUps = [] as any[];
let followUpActions = [] as any[];
let collectionNotes = [] as any[];
let collectionPromises = [] as any[];
let accountHolds = [] as any[];
let receipts = [] as any[];
let creditNotes = [] as any[];
let users = [] as any[];

/** Global lock to prevent concurrent invoice generation.
 *  When two "Generate Invoice" buttons are clicked rapidly,
 *  both reads happen before either push — causing duplicate numbers.
 *  This lock ensures only one invoice is generated at a time. */
let invoiceGenerationLock = false;

/** Validate array: must be non-empty array with items that have expected shape */
function isValidArray(data: any, minLength: number, requiredKey?: string): boolean {
  if (!Array.isArray(data)) return false;
  if (data.length < minLength) return false;
  if (requiredKey && !data[0][requiredKey]) return false;
  return true;
}

function load() {
  try {
    // CUSTOMERS: load from localStorage if valid, else reset to static defaults
    const c = localStorage.getItem("sgf_customers");
    if (c) {
      const parsed = JSON.parse(c);
      if (isValidArray(parsed, 100, "name")) customers = parsed;
      else customers = getStaticCustomers();
    } else {
      customers = getStaticCustomers();
    }
    // PRODUCTS: load from localStorage if valid, else reset to static defaults
    const p = localStorage.getItem("sgf_products");
    if (p) {
      const parsed = JSON.parse(p);
      if (isValidArray(parsed, 50, "productName")) products = parsed;
      else products = getStaticProducts();
    } else {
      products = getStaticProducts();
    }
    // TRANSACTION DATA: always load if present (these are user-generated)
    const o = localStorage.getItem("sgf_orders");
    if (o) { const d = JSON.parse(o); if (Array.isArray(d)) orders = d; }
    const i = localStorage.getItem("sgf_invoices");
    if (i) { const d = JSON.parse(i); if (Array.isArray(d)) invoices = d; }
    const a = localStorage.getItem("sgf_appointments");
    if (a) { const d = JSON.parse(a); if (Array.isArray(d)) appointments = d; }
    const ci = localStorage.getItem("sgf_checkins");
    if (ci) { const d = JSON.parse(ci); if (Array.isArray(d)) checkins = d; }
    const s = localStorage.getItem("sgf_specialPrices");
    if (s) { const d = JSON.parse(s); if (Array.isArray(d)) specialPrices = d; }
    const log = localStorage.getItem("sgf_auditLog");
    if (log) { const d = JSON.parse(log); if (Array.isArray(d)) auditLog = d; }
    else auditLog = [];
    const fu = localStorage.getItem("sgf_followUps");
    if (fu) { const d = JSON.parse(fu); if (Array.isArray(d)) followUps = d; }
    else followUps = [];
    const fa = localStorage.getItem("sgf_followUpActions");
    if (fa) { const d = JSON.parse(fa); if (Array.isArray(d)) followUpActions = d; }
    else followUpActions = [];
    const cn = localStorage.getItem("sgf_collectionNotes");
    if (cn) { const d = JSON.parse(cn); if (Array.isArray(d)) collectionNotes = d; }
    else collectionNotes = [];
    const cp = localStorage.getItem("sgf_collectionPromises");
    if (cp) { const d = JSON.parse(cp); if (Array.isArray(d)) collectionPromises = d; }
    else collectionPromises = [];
    const ah = localStorage.getItem("sgf_accountHolds");
    if (ah) { const d = JSON.parse(ah); if (Array.isArray(d)) accountHolds = d; }
    else accountHolds = [];
    const rc = localStorage.getItem("sgf_receipts");
    if (rc) { const d = JSON.parse(rc); if (Array.isArray(d)) receipts = d; }
    else receipts = [];
    const crn = localStorage.getItem("sgf_creditNotes");
    if (crn) { const d = JSON.parse(crn); if (Array.isArray(d)) creditNotes = d; }
    else creditNotes = [];
    // USERS: always load and merge with defaults
    const u = localStorage.getItem("sgf_users");
    if (u) { try { const d = JSON.parse(u); if (Array.isArray(d)) users = d; } catch { users = []; } }
    const DEFAULT_USERS = [
      { id: 1, name: "Collin", email: "collin@supremeglobalfoods.co.za", role: "super_admin", pin: "2580", isActive: true, createdAt: new Date().toISOString() },
      { id: 2, name: "Adeli", email: "adeli@supremeglobalfoods.co.za", role: "sales_rep", pin: "1111", isActive: true, createdAt: new Date().toISOString() },
      { id: 3, name: "Inhouse", email: "inhouse@supremeglobalfoods.co.za", role: "sales_rep", pin: "2222", isActive: true, createdAt: new Date().toISOString() },
      { id: 4, name: "Michael", email: "michael@supremeglobalfoods.co.za", role: "sales_rep", pin: "3333", isActive: true, createdAt: new Date().toISOString() },
      { id: 5, name: "Nkosana", email: "nkosana@supremeglobalfoods.co.za", role: "sales_rep", pin: "4444", isActive: true, createdAt: new Date().toISOString() },
      { id: 6, name: "Shanelle", email: "shanelle@supremeglobalfoods.co.za", role: "sales_rep", pin: "5555", isActive: true, createdAt: new Date().toISOString() },
      { id: 7, name: "Tebogo Bila", email: "tebogo@supremeglobalfoods.co.za", role: "sales_rep", pin: "6666", isActive: true, createdAt: new Date().toISOString() },
      { id: 8, name: "Ryleigh", email: "ryleigh@supremeglobalfoods.co.za", role: "admin", pin: "9999", isActive: true, createdAt: new Date().toISOString() },
      { id: 9, name: "Aggie", email: "aggie@supremeglobalfoods.co.za", role: "admin", pin: "1018", isActive: true, createdAt: new Date().toISOString() },
      { id: 10, name: "Ronald", email: "ronald@supremeglobalfoods.co.za", role: "super_admin", pin: "2581", isActive: true, createdAt: new Date().toISOString() },
      { id: 11, name: "Jolene", email: "jolene@supremeglobalfoods.co.za", role: "admin", pin: "7777", isActive: true, createdAt: new Date().toISOString() },
      { id: 12, name: "David", email: "david@supremeglobalfoods.co.za", role: "super_admin", pin: "8888", isActive: true, createdAt: new Date().toISOString() },
    ];
    if (!users || users.length === 0) {
      users = [...DEFAULT_USERS];
      saveItem("sgf_users", users);
    } else {
      let added = false;
      for (const du of DEFAULT_USERS) {
        if (!users.find((existing: any) => existing.name?.toLowerCase() === du.name.toLowerCase())) {
          users.push(du);
          added = true;
        }
      }
      if (added) saveItem("sgf_users", users);
    }
  } catch { /* ignore */ }

  // DEDUPLICATE: Remove duplicate orders and invoices caused by sync bugs
  deduplicateAll();

  // AUTO-LINK: Match Sage invoices to customers by customerCode.
  // This runs on every startup so ALL devices get linked Sage invoices
  // without needing to click "Re-link" button in Settings.
  try { autoLinkSageInvoices(); } catch { /* ignore */ }

  // FIX: Assign proper numeric codes to customers with "AUTO", blank, or missing codes
  try { fixMissingCustomerCodes(); } catch { /* ignore */ }
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
      console.log(`[CustomerCode] Assigned ${c.customerCode} to ${c.name}`);
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
      console.log(`[CustomerCode] Converted ${code} → ${c.customerCode} for ${c.name}`);
      continue;
    }
    // 3. Custom alphanumeric codes (RHB001, etc.) — leave as-is, they're intentional
  }
  if (changed) {
    saveItem("sgf_customers", customers);
    console.log(`[CustomerCode] Fixed customers with missing/legacy codes`);
  }
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

    // Fallback: match by customer name in notes or items
    const customerName = (inv as any).customerName || (inv.notes || "").replace(/Historical import from Sage/g, "").trim();
    if (customerName) {
      const fuzzyMatch = customers.find((c) =>
        c.name && c.name.toLowerCase().includes(customerName.toLowerCase().slice(0, 8))
      );
      if (fuzzyMatch) {
        inv.customerId = fuzzyMatch.id;
        inv.customer = fuzzyMatch;
        inv.customerCode = fuzzyMatch.customerCode;
        changed = true;
      }
    }
  }
  if (changed) saveItem("sgf_invoices", invoices);
}

/** Deduplicate orders by orderNumber and invoices by invoiceNumber.
 *  Keeps the most recent record (by updatedAt > createdAt > id).
 *  This fixes duplicates created when Firebase sync treated number/string IDs as different keys. */
function deduplicateAll(): { ordersRemoved: number; invoicesRemoved: number; customersRemoved: number } {
  const beforeOrders = orders.length;
  const beforeInvoices = invoices.length;
  const beforeCustomers = customers.length;

  // Deduplicate orders: group by orderNumber, keep most recent
  const orderMap = new Map<string, any>();
  for (const o of orders) {
    const key = o.orderNumber || o.id;
    const existing = orderMap.get(key);
    if (!existing || isMoreRecent(o, existing)) {
      orderMap.set(key, o);
    }
  }
  orders = Array.from(orderMap.values());

  // Deduplicate invoices: group by invoiceNumber (for SGF), keep most recent
  const invMap = new Map<string, any>();
  for (const inv of invoices) {
    const key = inv.invoiceNumber || inv.id;
    const existing = invMap.get(key);
    if (!existing || isMoreRecent(inv, existing)) {
      invMap.set(key, inv);
    }
  }
  invoices = Array.from(invMap.values());

  // Deduplicate customers: group by normalized name, keep most recent
  const custMap = new Map<string, any>();
  for (const c of customers) {
    const key = (c.name || "").toString().trim().replace(/\s+/g, " ").toLowerCase();
    if (!key) continue; // skip customers with no name
    const existing = custMap.get(key);
    if (!existing || isMoreRecent(c, existing)) {
      custMap.set(key, c);
    }
  }
  customers = Array.from(custMap.values());

  const result = {
    ordersRemoved: beforeOrders - orders.length,
    invoicesRemoved: beforeInvoices - invoices.length,
    customersRemoved: beforeCustomers - customers.length,
  };

  if (result.ordersRemoved > 0 || result.invoicesRemoved > 0 || result.customersRemoved > 0) {
    console.log(`[DEDUPLICATE] Removed ${result.ordersRemoved} duplicate orders, ${result.invoicesRemoved} duplicate invoices, ${result.customersRemoved} duplicate customers`);
    saveItem("sgf_orders", orders);
    saveItem("sgf_invoices", invoices);
    saveItem("sgf_customers", customers);
  }

  return result;
}

/** Check if item a is more recent than item b */
function isMoreRecent(a: any, b: any): boolean {
  const aTime = a.updatedAt || a.createdAt || a.id || 0;
  const bTime = b.updatedAt || b.createdAt || b.id || 0;
  return String(aTime) > String(bTime);
}

function saveItem(key: string, value: any) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e: any) {
    // Quota exceeded - clear non-essential data and retry
    if (e.name === 'QuotaExceededError' || e.code === 22) {
      const itemsToClear = ["sgf_audit_log", "sgf_activity_log", "sgf_receipts", "sgf_creditNotes", "fix-invoice-backup", "sgf_invoice_backups"];
      for (const itemKey of itemsToClear) {
        try { localStorage.removeItem(itemKey); } catch { /* ignore */ }
      }
      try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
    }
  }
}

function logAudit(action: string, entityType: string, entityId: number | string, details: string, userName?: string) {
  const entry = {
    id: Date.now() + Math.random(),
    action,
    entityType,
    entityId: String(entityId),
    details,
    userName: userName || "Unknown",
    createdAt: new Date().toISOString(),
  };
  auditLog.unshift(entry);
  saveItem("sgf_auditLog", auditLog);
}

// getAvailableStock: returns the live product.quantity which is already
// deducted when orders are created and restored when delivered/cancelled
function getAvailableStock(productId: number): number {
  const product = products.find((p) => p.id === productId);
  return product ? Math.max(0, product.quantity || 0) : 0;
}

// getCommittedStock: kept for reference, counts items from active non-sample orders
function getCommittedStock(productId: number): number {
  return orders
    .filter((o) => o.status !== "delivered" && o.status !== "cancelled" && o.status !== "sample_delivered")
    .flatMap((o) => o.items || [])
    .filter((item: any) => item.stockItemId === productId)
    .reduce((sum: number, item: any) => sum + (item.quantity || 0), 0);
}

// Check if customer already has a sample of this product
function hasExistingSample(customerId: number, stockItemId: number): boolean {
  return orders.some((o) =>
    o.customerId === customerId &&
    o.orderType === "sample" &&
    o.items?.some((item: any) => item.stockItemId === stockItemId)
  );
}

function generateNextCustomerCode(): string {
  // Collect all numeric customer codes (both new format "10001" and old "CUST0001")
  const numericCodes = customers
    .map((c) => c.customerCode)
    .filter((code): code is string => !!code && code !== "AUTO")
    .map((code) => {
      // Try new format: plain number like "10001"
      if (/^\d+$/.test(code)) return parseInt(code);
      // Try old format: "CUST0001"
      const match = code.match(/^CUST(\d+)$/);
      if (match) return parseInt(match[1]);
      return 0;
    })
    .filter((n) => n > 0);
  const max = numericCodes.length > 0 ? Math.max(...numericCodes) : 10000;
  return String(max + 1);
}

load();

/** Re-read all data from localStorage — call after cloud sync writes new data */
export function reloadFromStorage(): void {
  load();
}

/** Fix duplicate SGF invoice numbers. Renames duplicates to next available number.
 *  Returns list of changes made for audit trail.
 */
export function fixDuplicateInvoiceNumbers(): { changes: Array<{ old: string; new: string; id: number; customer: string }> } {
  load(); // Ensure fresh data
  const changes: Array<{ old: string; new: string; id: number; customer: string }> = [];
  const seenNumbers = new Map<string, number>(); // invoiceNumber -> first invoice index

  // Sort by createdAt ascending so the oldest keeps the original number
  const sorted = [...invoices].sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());

  for (const inv of sorted) {
    const num = inv.invoiceNumber;
    if (!num || !num.startsWith("SGF")) continue;
    if (seenNumbers.has(num)) {
      // Duplicate found — assign next available SGF number
      const nextNum = getNextInvoiceNumber();
      const oldNum = inv.invoiceNumber;
      inv.invoiceNumber = nextNum;
      inv.updatedAt = new Date().toISOString();
      changes.push({ old: oldNum, new: nextNum, id: inv.id, customer: inv.customer?.name || "Unknown" });
      logAudit("UPDATE", "invoice", inv.id, `Auto-renumbered duplicate invoice: ${oldNum} → ${nextNum} (${inv.customer?.name || "Unknown"})`);
    } else {
      seenNumbers.set(num, inv.id);
    }
  }

  if (changes.length > 0) {
    saveItem("sgf_invoices", invoices);
  }
  return { changes };
}

/** Migrate old sample orders to use normal status flow and SGF invoice numbers.
 *  Run this once after the sample order fix is deployed. */
export function migrateSampleOrders(): { migrated: number; invoicesCreated: number; followUpsCreated: number; details: string[] } {
  load();
  const details: string[] = [];
  let migrated = 0;
  let invoicesCreated = 0;
  let followUpsCreated = 0;

  for (const order of orders) {
    if (order.orderType !== "sample") continue;

    // Fix 1: Change sample_delivered status to delivered
    if (order.status === "sample_delivered") {
      order.status = "delivered";
      migrated++;
      details.push(`Order ${order.orderNumber}: status changed from sample_delivered → delivered`);
    }

    // Fix 2: Ensure a proper SGF invoice exists
    const existingInvoice = invoices.find((i) => i.orderId == order.id);
    if (!existingInvoice) {
      // Create a new SGF invoice for this sample order
      const invoiceNumber = getNextInvoiceNumber();
      const nextInvId = invoices.length > 0 ? Math.max(...invoices.map((i) => Number(i.id) || 0)) + 1 : 1;
      const now = new Date();

      invoices.push({
        id: nextInvId,
        orderId: order.id,
        orderNumber: order.orderNumber,
        invoiceNumber,
        deliveryNoteNumber: `DN-${order.orderNumber}`,
        customerId: order.customerId,
        customer: customers.find((c) => c.id === order.customerId) || null,
        subtotal: 0,
        vatAmount: 0,
        total: 0,
        totalAmount: 0,
        balanceDue: 0,
        amountPaid: 0,
        status: "paid",
        paymentTerms: order.paymentTerms || "cod",
        invoiceDate: order.createdAt || now.toISOString(),
        dueDate: now.toISOString(),
        notes: `Sample order - ${order.orderNumber} (No Charge)`,
        items: (order.items || []).map((item: any) => ({
          description: `${item.productCode || ""} - ${item.productName || ""}`.trim(),
          quantity: item.quantity,
          unitPrice: 0,
          lineTotal: 0,
        })),
        createdAt: order.createdAt || now.toISOString(),
        updatedAt: now.toISOString(),
      });
      invoicesCreated++;
      details.push(`Order ${order.orderNumber}: created invoice ${invoiceNumber}`);
    } else if (existingInvoice && !existingInvoice.invoiceNumber?.startsWith("SGF")) {
      // Fix existing non-SGF invoice number
      const oldNum = existingInvoice.invoiceNumber;
      existingInvoice.invoiceNumber = getNextInvoiceNumber();
      existingInvoice.subtotal = 0;
      existingInvoice.vatAmount = 0;
      existingInvoice.total = 0;
      existingInvoice.totalAmount = 0;
      existingInvoice.balanceDue = 0;
      existingInvoice.status = "paid";
      existingInvoice.notes = `Sample order - ${order.orderNumber} (No Charge)`;
      existingInvoice.items = (order.items || []).map((item: any) => ({
        description: `${item.productCode || ""} - ${item.productName || ""}`.trim(),
        quantity: item.quantity,
        unitPrice: 0,
        lineTotal: 0,
      }));
      details.push(`Order ${order.orderNumber}: invoice renumbered ${oldNum} → ${existingInvoice.invoiceNumber}`);
    }

    // Fix 3: Ensure a follow-up exists for this sample order
    const existingFollowUp = followUps.find((fu) => fu.orderId == order.id);
    if (!existingFollowUp) {
      const followUpDate = new Date(order.createdAt || Date.now());
      followUpDate.setDate(followUpDate.getDate() + 4);
      const followUp = {
        id: Date.now() + Math.random(),
        orderId: order.id,
        customerId: order.customerId,
        orderNumber: order.orderNumber,
        followUpDate: followUpDate.toISOString(),
        status: "pending",
        reason: null,
        expectedOrderDate: null,
        createdAt: new Date().toISOString(),
      };
      followUps.push(followUp);
      followUpsCreated++;
      details.push(`Order ${order.orderNumber}: created follow-up for ${followUpDate.toLocaleDateString("en-ZA")}`);
    }
  }

  if (migrated > 0 || invoicesCreated > 0 || followUpsCreated > 0) {
    saveItem("sgf_orders", orders);
    saveItem("sgf_invoices", invoices);
    saveItem("sgf_followUps", followUps);
  }

  return { migrated, invoicesCreated, followUpsCreated, details };
}

// Helper: create an invoice from an order
/** Get next SGF invoice number. Starts at SGF1801 (last was SGF1800).
 *  Loops to ensure the number is truly unique — prevents duplicates
 *  when rapid clicks or save failures occur. */
function getNextInvoiceNumber(): string {
  // Find the highest existing SGF number
  let maxNum = 1800; // Last known invoice
  for (const inv of invoices) {
    const match = (inv.invoiceNumber || "").match(/SGF(\d+)/);
    if (match) {
      const n = parseInt(match[1]);
      if (n > maxNum) maxNum = n;
    }
  }
  // Safety loop: ensure the number doesn't already exist
  let candidate = maxNum + 1;
  const existingNumbers = new Set(invoices.map((i) => i.invoiceNumber));
  while (existingNumbers.has(`SGF${candidate}`)) {
    candidate++;
  }
  return `SGF${String(candidate)}`;
}

/** Get next sample invoice number */
function getNextSampleInvoiceNumber(): string {
  const smpCount = invoices.filter((i) => (i.invoiceNumber || "").startsWith("SGF-SMP")).length;
  return `SGF-SMP-${String(smpCount + 1).padStart(3, "0")}`;
}

/** Get next receipt number: REC-001, REC-002 etc */
function getNextReceiptNumber(): string {
  const nums = receipts
    .map((r) => (r.receiptNumber || "").match(/REC-(\d+)/))
    .filter(Boolean)
    .map((m) => parseInt(m[1]));
  const max = nums.length > 0 ? Math.max(...nums) : 0;
  return `REC-${String(max + 1).padStart(3, "0")}`;
}

function createInvoiceFromOrder(order: any, subtotal: number, vatAmount: number, total: number, isSample: boolean): string | null {
  // ACQUIRE LOCK: prevent concurrent generation that causes duplicate numbers
  if (invoiceGenerationLock) {
    console.warn("[createInvoiceFromOrder] LOCKED — another invoice is being generated. Please wait.");
    return null;
  }
  invoiceGenerationLock = true;

  try {
    const now = new Date();
    const customer = customers.find((c) => c.id === order.customerId);

    // Calculate due date from payment terms
    const paymentTerms = order.paymentTerms || "cod";
    const days = paymentTerms === "30_days" ? 30 : paymentTerms === "14_days" ? 14 : paymentTerms === "7_days" ? 7 : 0;
    const dueDate = new Date(now);
    dueDate.setDate(dueDate.getDate() + days);

    // Invoice numbering: SGF1801, SGF1802, etc. — ALL orders use SGF numbers
    let invoiceNumber = getNextInvoiceNumber();
    const deliveryNoteNumber = `DN-${order.orderNumber}`;

    // FINAL SAFETY CHECK: re-read the array right before pushing.
    // If another invoice was created between getNextInvoiceNumber() and now,
    // this loop finds a truly unique number.
    const existingNumbers = new Set(invoices.map((i) => i.invoiceNumber));
    let safetyCounter = 0;
    while (existingNumbers.has(invoiceNumber) && safetyCounter < 100) {
      const match = invoiceNumber.match(/SGF(\d+)/);
      const n = match ? parseInt(match[1]) + 1 : 1853;
      invoiceNumber = `SGF${n}`;
      safetyCounter++;
    }

    // Status: draft until order is ready for delivery, then sent
    const status = (order.status === "ready" || order.status === "delivered") ? "sent" : "draft";

    // Use sequential integer ID to avoid decimal/float issues
    const nextInvId = invoices.length > 0 ? Math.max(...invoices.map((i) => Number(i.id) || 0)) + 1 : 1;

    invoices.push({
      id: nextInvId,
      orderId: order.id,
      orderNumber: order.orderNumber,
      invoiceNumber,
      deliveryNoteNumber,
      customerId: order.customerId,
      customer: customer || null,
      subtotal: isSample ? 0 : subtotal,
      vatAmount: isSample ? 0 : vatAmount,
      total: isSample ? 0 : total,
      totalAmount: isSample ? 0 : total,
      balanceDue: isSample ? 0 : total,
      amountPaid: isSample ? 0 : 0,
      status: isSample ? "paid" : status,
      paymentTerms: order.paymentTerms || "cod",
      invoiceDate: now.toISOString(),
      dueDate: dueDate.toISOString(),
      notes: isSample ? `Sample order - ${order.orderNumber} (No Charge)` : `Invoice for ${order.orderNumber}`,
      items: (order.items || []).map((item: any) => ({
        description: `${item.productCode} - ${item.productName}`,
        quantity: item.quantity,
        unitPrice: isSample ? 0 : item.unitPrice,
        lineTotal: isSample ? 0 : item.lineTotal,
      })),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });
    saveItem("sgf_invoices", invoices);
    return invoiceNumber;
  } finally {
    // RELEASE LOCK: always release even if an error occurred
    invoiceGenerationLock = false;
  }
}

/** Generate an invoice for an existing order that doesn't have one.
 *  Caller MUST call reloadFromStorage() before this to ensure fresh data. */
export function generateInvoiceForOrder(orderId: number): string | null {
  // Use loose equality (==) because Firebase may convert number IDs to strings
  const order = orders.find((o) => o.id == orderId);
  if (!order) return null;
  // Check if invoice already exists
  const existing = invoices.find((i) => i.orderId == orderId);
  if (existing) return existing.invoiceNumber;
  // Detect sample orders
  const isSample = order.orderType === "sample" || (order.orderNumber || "").startsWith("SMP-");
  // Calculate totals: samples are always zero-value
  const items = order.items || [];
  const subtotal = isSample ? 0 : items.reduce((sum: number, item: any) => sum + (item.lineTotal || 0), 0);
  const vatAmount = isSample ? 0 : subtotal * 0.15;
  const total = isSample ? 0 : subtotal + vatAmount;
  return createInvoiceFromOrder(order, subtotal, vatAmount, total, isSample);
}

/** Generate invoices for all orders that don't have one. Returns count created. */
export function generateMissingInvoices(): { created: number; details: string[] } {
  load();
  let created = 0;
  const details: string[] = [];

  for (const order of orders) {
    // Use loose equality (==) because Firebase may convert number IDs to strings
    const existing = invoices.find((i) => i.orderId == order.id && i.invoiceNumber && i.invoiceNumber.startsWith("SGF"));
    if (!existing) {
      const items = order.items || [];
      const subtotal = items.reduce((sum: number, item: any) => sum + (item.lineTotal || 0), 0);
      const vatAmount = subtotal * 0.15;
      const total = subtotal + vatAmount;
      const isSample = order.orderType === "sample" || (order.orderNumber || "").startsWith("SMP-");
      const invNum = createInvoiceFromOrder(order, subtotal, vatAmount, total, isSample);
      if (invNum) {
        created++;
        details.push(`${order.orderNumber} -> ${invNum}`);
      }
    }
  }

  if (created > 0) {
    saveItem("sgf_invoices", invoices);
  }

  return { created, details };
}

/** Remove duplicate orders, invoices, and customers. Call after Firebase sync or on demand. */
export function deduplicateData(): { ordersRemoved: number; invoicesRemoved: number; customersRemoved: number } {
  load();
  const result = deduplicateAll();
  return result;
}

/** Update an existing invoice when its order is edited */
function updateInvoiceFromOrder(order: any) {
  const idx = invoices.findIndex((i) => i.orderId === order.id);
  if (idx < 0) return; // No invoice exists for this order

  const inv = invoices[idx];
  const customer = customers.find((c) => c.id === order.customerId);

  // Recalculate totals
  const subtotal = Number(order.subtotal || 0);
  const vatAmount = Number(order.vatAmount || 0);
  const total = Number(order.total || 0);

  invoices[idx] = {
    ...inv,
    customerId: order.customerId,
    customer: customer || inv.customer,
    subtotal,
    vatAmount,
    total,
    totalAmount: total,
    balanceDue: total - (inv.amountPaid || 0),
    paymentTerms: order.paymentTerms || inv.paymentTerms,
    items: (order.items || []).map((item: any) => ({
      description: `${item.productCode} - ${item.productName}`,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
    })),
    updatedAt: new Date().toISOString(),
  };
  saveItem("sgf_invoices", invoices);
}

/** When order status changes to ready/delivered, upgrade invoice from draft to sent */
function activateInvoiceFromOrder(orderId: number) {
  const idx = invoices.findIndex((i) => i.orderId === orderId);
  if (idx >= 0 && invoices[idx].status === "draft") {
    invoices[idx].status = "sent";
    invoices[idx].updatedAt = new Date().toISOString();
    saveItem("sgf_invoices", invoices);
  }
}

function searchItems(items: any[], query: string) {
  if (!query || query.trim() === "") return items;
  const q = query.toLowerCase().trim();
  return items.filter((item) =>
    item.name?.toLowerCase().includes(q) ||
    item.productCode?.toLowerCase().includes(q) ||
    item.category?.toLowerCase().includes(q) ||
    item.customerCode?.toLowerCase().includes(q) ||
    item.city?.toLowerCase().includes(q)
  );
}

export { SALES_REPS, getCommittedStock, getAvailableStock };

export const dataService = {
  auth: {
    me: () => {
      const demoStr = localStorage.getItem("demo_user");
      return demoStr ? JSON.parse(demoStr) : null;
    },
  },

  stock: {
    list: () => products,
    search: ({ query }: { query: string }) => searchItems(products, query),
    getById: (id: number) => products.find((p) => p.id === id) || null,
    getCategories: () => [...new Set(products.map((p) => p.category))],
    getStats: () => ({
      totalProducts: products.length,
      totalRetailValue: products.reduce((sum, p) => sum + Number(p.retailPrice || 0) * (p.quantity || 0), 0),
      lowStock: products.filter((p) => p.status === "low_stock").length,
      outOfStock: products.filter((p) => p.status === "out_of_stock").length,
    }),
    create: (data: any) => {
      const newItem = { ...data, id: Date.now(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      products.push(newItem);
      saveItem("sgf_products", products);
      return newItem;
    },
    update: ({ id, data }: { id: number; data: any }) => {
      const idx = products.findIndex((p) => p.id === id);
      if (idx >= 0) { products[idx] = { ...products[idx], ...data, updatedAt: new Date().toISOString() }; saveItem("sgf_products", products); return products[idx]; }
      return null;
    },
    delete: (id: number) => {
      products = products.filter((p) => p.id !== id);
      saveItem("sgf_products", products);
      return { success: true };
    },
    bulkCreate: (items: any[]) => {
      const created = [];
      const updated = [];
      for (let i = 0; i < items.length; i++) {
        const incoming = items[i];
        // Check if product already exists by productName (case-insensitive)
        // productCode can differ between uploads, but productName is the reliable identifier
        const existingIdx = products.findIndex(
          (p) => (p.productName || "").toLowerCase().trim() === (incoming.productName || "").toLowerCase().trim()
        );
        if (existingIdx >= 0) {
          // Update existing product: new SOH, update prices if provided, keep id
          const existing = products[existingIdx];
          products[existingIdx] = {
            ...existing,
            quantity: incoming.quantity !== undefined ? incoming.quantity : existing.quantity,
            corporatePrice: incoming.corporatePrice !== undefined ? incoming.corporatePrice : existing.corporatePrice,
            bulkPrice: incoming.bulkPrice !== undefined ? incoming.bulkPrice : existing.bulkPrice,
            wholesalePrice: incoming.wholesalePrice !== undefined ? incoming.wholesalePrice : existing.wholesalePrice,
            retailPrice: incoming.retailPrice !== undefined ? incoming.retailPrice : existing.retailPrice,
            // Update optional fields if provided
            ...(incoming.strands !== undefined && { strands: incoming.strands }),
            ...(incoming.size !== undefined && { size: incoming.size }),
            ...(incoming.grade !== undefined && { grade: incoming.grade }),
            ...(incoming.color !== undefined && { color: incoming.color }),
            ...(incoming.species !== undefined && { species: incoming.species }),
            ...(incoming.category !== undefined && { category: incoming.category }),
            ...(incoming.productName !== undefined && { productName: incoming.productName }),
            updatedAt: new Date().toISOString(),
            // Recalculate status based on new quantity
            status: (incoming.quantity || existing.quantity) === 0
              ? "out_of_stock"
              : (incoming.quantity || existing.quantity) < 20
                ? "low_stock"
                : "in_stock",
          };
          updated.push(products[existingIdx]);
        } else {
          // New product - create with new id
          const newItem = {
            ...incoming,
            id: Date.now() + i,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            status: (incoming.quantity || 0) === 0
              ? "out_of_stock"
              : (incoming.quantity || 0) < 20
                ? "low_stock"
                : "in_stock",
          };
          products.push(newItem);
          created.push(newItem);
        }
      }
      saveItem("sgf_products", products);
      return { created: created.length, updated: updated.length };
    },

    /** Daily Invoiced Stock Report — shows what stock was invoiced on a given date */
    getDailyInvoicedStock: ({ from, to }: { from?: string; to?: string }) => {
      const fromDate = from || new Date().toISOString().slice(0, 10);
      const toDate = to || fromDate;
      const fromTs = new Date(fromDate + "T00:00:00").getTime();
      const toTs = new Date(toDate + "T23:59:59").getTime();

      const results: any[] = [];

      for (const inv of invoices) {
        const invTs = new Date(inv.createdAt || inv.invoiceDate).getTime();
        if (invTs < fromTs || invTs > toTs) continue;

        const order = orders.find((o) => o.id === inv.orderId);
        if (!order) continue;

        const customer = customers.find((c) => c.id === inv.customerId || c.id === order.customerId);
        if (!customer) continue;

        const repName = customer.salesRepName || customer.salesRep || "";
        const priceTier = customer.priceTier || "retail";

        for (const item of inv.items || order.items || []) {
          const product = products.find((p) => p.id === item.stockItemId);
          const specialPrice = specialPrices.find(
            (sp: any) => sp.customerId === customer.id && sp.stockItemId === item.stockItemId
          );

          const unitPrice = Number(item.unitPrice || 0);
          const quantity = Number(item.quantity || 0);
          const lineTotal = Number(item.lineTotal || unitPrice * quantity);

          // Determine if special price was used
          let isSpecialPrice = false;
          let tierPrice = 0;
          if (product) {
            tierPrice = Number((product as any)[`${priceTier}Price`] || 0);
            if (specialPrice && Math.abs(specialPrice.specialPrice - unitPrice) < 0.01) {
              isSpecialPrice = true;
            }
          }

          results.push({
            invoiceNumber: inv.invoiceNumber,
            orderNumber: inv.orderNumber || order.orderNumber,
            invoiceDate: inv.invoiceDate || inv.createdAt,
            productName: item.description || item.productName || product?.name || "Unknown",
            productCode: product?.productCode || "",
            quantity,
            unitPrice,
            lineTotal,
            priceTier,
            isSpecialPrice,
            specialPriceAmount: specialPrice?.specialPrice || null,
            tierPrice: tierPrice || null,
            salesRep: repName,
            customerName: customer.name || "",
          });
        }
      }

      return {
        from: fromDate,
        to: toDate,
        generatedAt: new Date().toISOString(),
        totalLines: results.length,
        totalValue: results.reduce((s, r) => s + r.lineTotal, 0),
        items: results.sort((a, b) => new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime()),
      };
    },
  },

  customer: {
    list: () => customers,
    search: ({ query }: { query: string }) => searchItems(customers, query),
    getById: (id: number) => customers.find((c) => c.id === id) || null,
    create: (data: any) => {
      const normName = (data.name || "").toString().trim().replace(/\s+/g, " ").toLowerCase();
      // Prevent duplicate: check if customer with same normalized name already exists
      const existingIdx = customers.findIndex((c) =>
        (c.name || "").toString().trim().replace(/\s+/g, " ").toLowerCase() === normName
      );
      if (existingIdx >= 0) {
        // Update existing customer instead of creating duplicate
        const existing = customers[existingIdx];
        customers[existingIdx] = {
          ...existing,
          ...data,
          id: existing.id, // keep original id
          customerCode: data.customerCode || existing.customerCode,
          updatedAt: new Date().toISOString(),
        };
        saveItem("sgf_customers", customers);
        logAudit("UPDATE", "customer", existing.id, `Updated existing customer (duplicate prevented): ${existing.name}`, data.salesRepName);
        return customers[existingIdx];
      }
      const newItem = {
        ...data,
        id: Date.now(),
        customerCode: (data.customerCode && data.customerCode !== "AUTO") ? data.customerCode : generateNextCustomerCode(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      customers.push(newItem);
      saveItem("sgf_customers", customers);
      logAudit("CREATE", "customer", newItem.id, `Created customer: ${newItem.name} (${newItem.customerCode})`, data.salesRepName);
      return newItem;
    },
    update: ({ id, data }: { id: number; data: any }) => {
      const idx = customers.findIndex((c) => c.id === id);
      if (idx >= 0) {
        const oldCust = { ...customers[idx] };
        customers[idx] = { ...customers[idx], ...data, updatedAt: new Date().toISOString() };
        saveItem("sgf_customers", customers);
        if (data.physicalAddress && data.physicalAddress !== oldCust.physicalAddress) {
          logAudit("UPDATE_ADDRESS", "customer", id, `Address changed from "${oldCust.physicalAddress}" to "${data.physicalAddress}"`, data.salesRepName || oldCust.salesRepName);
        }
        return customers[idx];
      }
      return null;
    },
    delete: ({ id }: { id: number }) => {
      const cust = customers.find((c) => c.id === id);
      if (cust) {
        logAudit("DELETE", "customer", id, `Deleted customer: ${cust.name} (${cust.customerCode}) \u2014 Sales Rep: ${cust.salesRepName || "Unassigned"}`);
      }
      customers = customers.filter((c) => c.id !== id);
      saveItem("sgf_customers", customers);
      return { success: true };
    },
    getStats: () => ({
      total: customers.length,
      active: customers.filter((c) => c.isActive === "active").length,
      inactive: customers.filter((c) => c.isActive !== "active").length,
      thisMonth: customers.length,
    }),
    getSalesReps: () => SALES_REPS,
    bulkUpload: (items: any[]) => {
      // Normalize name: trim, collapse multiple spaces, lowercase
      const normalize = (s: string) => (s || "").toString().trim().replace(/\s+/g, " ").toLowerCase();
      let created = 0;
      let updated = 0;
      for (const item of items) {
        const code = (item.customerCode || "").toString().trim();
        const name = (item.name || "").toString().trim();
        if (!name) continue;
        const normName = normalize(name);
        // Match by normalized customer name, or by customerCode if provided
        const existingIdx = customers.findIndex((c) => {
          const nameMatch = normalize(c.name) === normName;
          const codeMatch = code && c.customerCode && c.customerCode.toLowerCase() === code.toLowerCase();
          return nameMatch || codeMatch;
        });
        if (existingIdx >= 0) {
          // Update existing — same id, orders/invoices unaffected
          const existing = customers[existingIdx];
          customers[existingIdx] = {
            ...existing,
            name: name || existing.name,
            customerCode: code || existing.customerCode,
            businessName: item.businessName !== undefined ? item.businessName : existing.businessName,
            contactPerson: item.contactPerson !== undefined ? item.contactPerson : existing.contactPerson,
            phone: item.phone !== undefined ? item.phone : existing.phone,
            email: item.email !== undefined ? item.email : existing.email,
            physicalAddress: item.physicalAddress !== undefined ? item.physicalAddress : existing.physicalAddress,
            city: item.city !== undefined ? item.city : existing.city,
            province: item.province !== undefined ? item.province : existing.province,
            postalCode: item.postalCode !== undefined ? item.postalCode : existing.postalCode,
            paymentTerms: item.paymentTerms || existing.paymentTerms || "cod",
            priceTier: item.priceTier || existing.priceTier || "wholesale",
            salesRepName: item.salesRepName !== undefined ? item.salesRepName : existing.salesRepName,
            vatNumber: item.vatNumber !== undefined ? item.vatNumber : existing.vatNumber,
            notes: item.notes !== undefined ? item.notes : existing.notes,
            isActive: "active",
            updatedAt: new Date().toISOString(),
          };
          updated++;
        } else {
          // New customer
          customers.push({
            ...item,
            id: Date.now() + Math.random(),
            customerCode: code || generateNextCustomerCode(),
            isActive: "active",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          created++;
        }
      }
      saveItem("sgf_customers", customers);
      return { created, updated, total: customers.length };
    },
    // Find customers who haven't placed an order in the last X days (default 10)
    getCustomersNeedingFollowUp: (days: number = 10) => {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      const cutoffMs = cutoff.getTime();
      return customers
        .filter((c) => c.isActive === "active")
        .map((c) => {
          // Find most recent order for this customer
          const custOrders = orders
            .filter((o) => o.customerId === c.id)
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          const lastOrder = custOrders[0] || null;
          const lastOrderDate = lastOrder ? new Date(lastOrder.createdAt).getTime() : 0;
          const daysSinceLastOrder = lastOrderDate
            ? Math.floor((Date.now() - lastOrderDate) / 86400000)
            : 999;
          // Also count total orders
          const totalOrders = custOrders.length;
          return {
            ...c,
            lastOrder,
            lastOrderDate: lastOrder?.createdAt || null,
            daysSinceLastOrder,
            totalOrders,
            needsFollowUp: !lastOrder || lastOrderDate < cutoffMs,
          };
        })
        .filter((c) => c.needsFollowUp)
        .sort((a, b) => b.daysSinceLastOrder - a.daysSinceLastOrder);
    },
  },

  order: {
    list: () => orders
      .map((o) => {
        const customer = customers.find((c) => c.id === o.customerId);
        return { ...o, customer: customer || null };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    getById: (id: number) => {
      const order = orders.find((o) => o.id === id);
      if (!order) return null;
      const customer = customers.find((c) => c.id === order.customerId);
      return { ...order, customer: customer || null };
    },
    create: (data: any) => {
      const isSample = data.orderType === "sample";
      const orderNumber = `${isSample ? "SMP" : "ORD"}-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${String(orders.filter((o) => (isSample ? o.orderType === "sample" : o.orderType !== "sample")).length + 1).padStart(4, "0")}`;
      
      const items = (data.items || []).map((item: any) => {
        const product = products.find((p) => p.id === item.stockItemId);
        const unitPrice = isSample ? getEffectivePrice(item.stockItemId, "corporate", data.customerId) : (item.unitPrice || getEffectivePrice(item.stockItemId, data.priceTier, data.customerId));
        return {
          ...item,
          productCode: product?.productCode || "",
          productName: product?.productName || "Unknown",
          lineTotal: unitPrice * item.quantity,
          unitPrice,
        };
      });
      
      const subtotal = isSample ? 0 : items.reduce((sum: number, item: any) => sum + item.lineTotal, 0);
      const vatAmount = isSample ? 0 : subtotal * 0.15;
      const total = isSample ? 0 : subtotal + vatAmount;
      
      const newOrder = {
        ...data,
        id: Date.now(),
        orderNumber,
        status: "pending", // All orders start as pending — samples follow same flow
        items,
        subtotal,
        vatAmount,
        total,
        totalAmount: total,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      orders.push(newOrder);

      // DEDUCT STOCK for each item (both regular and sample orders)
      for (const item of items) {
        const prodIdx = products.findIndex((p) => p.id === item.stockItemId);
        if (prodIdx >= 0) {
          const newQty = Math.max(0, (products[prodIdx].quantity || 0) - item.quantity);
          products[prodIdx].quantity = newQty;
          products[prodIdx].status = newQty === 0 ? "out_of_stock" : newQty < 20 ? "low_stock" : "in_stock";
        }
      }
      saveItem("sgf_products", products);
      saveItem("sgf_orders", orders);

      if (isSample) {
        // Sample: create follow-up and zero-value invoice
        const followUpDate = new Date();
        followUpDate.setDate(followUpDate.getDate() + 4);
        const followUp = {
          id: Date.now() + Math.random(),
          orderId: newOrder.id,
          customerId: data.customerId,
          orderNumber,
          followUpDate: followUpDate.toISOString(),
          status: "pending",
          reason: null,
          expectedOrderDate: null,
          createdAt: new Date().toISOString(),
        };
        followUps.push(followUp);
        saveItem("sgf_followUps", followUps);
      }

      // NOTE: Invoices are NO LONGER auto-generated on order creation.
      // Admin/Super Admin must manually click "Generate Invoice" button.
      // This eliminates the race condition where invoices failed to push to cloud.

      return newOrder;
    },
    update: ({ id, data }: { id: number; data: any }) => {
      const idx = orders.findIndex((o) => o.id === id);
      if (idx >= 0) {
        const oldOrder = orders[idx];
        // RESTORE old stock first
        for (const item of (oldOrder.items || [])) {
          const prodIdx = products.findIndex((p) => p.id === item.stockItemId);
          if (prodIdx >= 0) {
            const newQty = (products[prodIdx].quantity || 0) + item.quantity;
            products[prodIdx].quantity = newQty;
            products[prodIdx].status = newQty === 0 ? "out_of_stock" : newQty < 20 ? "low_stock" : "in_stock";
          }
        }
        // Apply new items with fresh calculations
        const isSample = data.orderType === "sample";
        const items = (data.items || []).map((item: any) => {
          const product = products.find((p) => p.id === item.stockItemId);
          const unitPrice = isSample ? getEffectivePrice(item.stockItemId, "corporate", data.customerId) : (item.unitPrice || getEffectivePrice(item.stockItemId, data.priceTier, data.customerId));
          return { ...item, productCode: product?.productCode || "", productName: product?.productName || "Unknown", lineTotal: unitPrice * item.quantity, unitPrice };
        });
        const subtotal = isSample ? 0 : items.reduce((sum: number, item: any) => sum + item.lineTotal, 0);
        const vatAmount = isSample ? 0 : subtotal * 0.15;
        const total = isSample ? 0 : subtotal + vatAmount;
        // DEDUCT new stock
        for (const item of items) {
          const prodIdx = products.findIndex((p) => p.id === item.stockItemId);
          if (prodIdx >= 0) {
            const newQty = Math.max(0, (products[prodIdx].quantity || 0) - item.quantity);
            products[prodIdx].quantity = newQty;
            products[prodIdx].status = newQty === 0 ? "out_of_stock" : newQty < 20 ? "low_stock" : "in_stock";
          }
        }
        orders[idx] = { ...oldOrder, ...data, items, subtotal, vatAmount, total, totalAmount: total, updatedAt: new Date().toISOString() };
        saveItem("sgf_products", products);
        saveItem("sgf_orders", orders);
        // Auto-update linked invoice with new order details
        updateInvoiceFromOrder(orders[idx]);
        return orders[idx];
      }
      return null;
    },
    updateStatus: ({ id, status }: { id: number; status: string }) => {
      const idx = orders.findIndex((o) => o.id === id);
      if (idx >= 0) {
        const oldStatus = orders[idx].status;
        const order = orders[idx];
        order.status = status;
        // RESTORE STOCK when order is delivered or cancelled
        if ((status === "delivered" || status === "cancelled") && oldStatus !== "delivered" && oldStatus !== "cancelled") {
          for (const item of (order.items || [])) {
            const prodIdx = products.findIndex((p) => p.id === item.stockItemId);
            if (prodIdx >= 0) {
              const newQty = (products[prodIdx].quantity || 0) + item.quantity;
              products[prodIdx].quantity = newQty;
              products[prodIdx].status = newQty === 0 ? "out_of_stock" : newQty < 20 ? "low_stock" : "in_stock";
            }
          }
          saveItem("sgf_products", products);
        }
        // ACTIVATE INVOICE from draft to sent when order becomes ready or delivered
        // (only if invoice already exists — admin must generate it manually)
        if (status === "ready" || status === "delivered") {
          activateInvoiceFromOrder(order.id);
        }
        saveItem("sgf_orders", orders);
        return order;
      }
      return null;
    },
    getStats: () => ({
      total: orders.length,
      pending: orders.filter((o) => o.status === "pending").length,
      picking: orders.filter((o) => o.status === "picking").length,
      ready: orders.filter((o) => o.status === "ready").length,
      delivered: orders.filter((o) => o.status === "delivered").length,
      samples: orders.filter((o) => o.orderType === "sample").length,
      totalValue: orders.filter((o) => o.orderType !== "sample").reduce((sum, o) => sum + Number(o.total || 0), 0),
    }),
    checkExistingSample: ({ customerId, stockItemId }: { customerId: number; stockItemId: number }) => {
      return { exists: hasExistingSample(customerId, stockItemId) };
    },
  },

  invoice: {
    list: () => invoices
      .map((inv) => {
        const customer = customers.find((c) => c.id === inv.customerId);
        return {
          ...inv,
          customer: customer || null,
          subtotal: inv.subtotal ?? inv.totalAmount ?? 0,
          vatAmount: inv.vatAmount ?? (inv.totalAmount ?? 0) * 0.15 / 1.15,
          total: inv.total ?? inv.totalAmount ?? 0,
          balanceDue: inv.balanceDue ?? (inv.total ?? inv.totalAmount ?? 0) - (inv.amountPaid ?? 0),
          invoiceDate: inv.invoiceDate || inv.createdAt,
          dueDate: inv.dueDate || inv.createdAt,
          paymentTerms: inv.paymentTerms || "cod",
          deliveryNoteNumber: inv.deliveryNoteNumber || `DN-${inv.orderId}`,
        };
      })
      .sort((a, b) => new Date(b.invoiceDate || b.createdAt).getTime() - new Date(a.invoiceDate || a.createdAt).getTime()),
    getById: (id: number) => {
      const inv = invoices.find((i) => i.id === id);
      if (!inv) return null;
      const customer = customers.find((c) => c.id === inv.customerId);
      return { ...inv, customer: customer || null };
    },
    create: (data: any) => {
      const invoiceNumber = `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${String(invoices.length + 1).padStart(4, "0")}`;
      const customer = customers.find((c) => c.id === data.customerId);
      const now = new Date().toISOString();
      const newInvoice = {
        ...data,
        id: Date.now(),
        invoiceNumber,
        status: "sent",
        invoiceDate: now,
        dueDate: now,
        customer: customer || null,
        subtotal: data.subtotal || 0,
        vatAmount: data.vatAmount || 0,
        total: data.total || data.subtotal || 0,
        totalAmount: data.total || data.subtotal || 0,
        balanceDue: data.total || data.subtotal || 0,
        amountPaid: 0,
        deliveryNoteNumber: `DN-MANUAL-${String(invoices.length + 1).padStart(4, "0")}`,
        createdAt: now,
        updatedAt: now,
      };
      invoices.push(newInvoice);
      saveItem("sgf_invoices", invoices);
      return newInvoice;
    },
    updateStatus: ({ id, status, amountPaid }: { id: number; status: string; amountPaid?: number }) => {
      const idx = invoices.findIndex((i) => i.id === id);
      if (idx >= 0) { invoices[idx].status = status; invoices[idx].amountPaid = amountPaid || 0; saveItem("sgf_invoices", invoices); return invoices[idx]; }
      return null;
    },
    recordPayment: ({ invoiceId, amount, paymentMethod, paymentDate, referenceNumber, notes }: any) => {
      const idx = invoices.findIndex((i) => i.id === invoiceId);
      if (idx < 0) return null;
      const inv = invoices[idx];
      const currentPaid = Number(inv.amountPaid || 0);
      const newPaid = currentPaid + amount;
      const total = Number(inv.total || inv.totalAmount || 0);
      inv.amountPaid = newPaid;
      inv.balanceDue = Math.max(0, total - newPaid);
      if (newPaid >= total) {
        inv.status = "paid";
      } else if (newPaid > 0) {
        inv.status = "partially_paid";
      }
      // Store payment record
      if (!inv.payments) inv.payments = [];
      inv.payments.push({
        id: Date.now() + Math.random(),
        amount,
        paymentMethod: paymentMethod || "cash",
        paymentDate: paymentDate || new Date().toISOString(),
        referenceNumber: referenceNumber || "",
        notes: notes || "",
        createdAt: new Date().toISOString(),
      });
      // Add payment as a collection note
      collectionNotes.push({
        id: Date.now() + Math.random(),
        invoiceId,
        customerId: inv.customerId,
        type: "payment_received",
        notes: `Payment of R ${amount.toFixed(2)} via ${paymentMethod || "cash"}. Ref: ${referenceNumber || "N/A"}. ${notes || ""}`,
        contactMethod: paymentMethod || "cash",
        contactPerson: "",
        followUpDate: null,
        createdAt: paymentDate || new Date().toISOString(),
      });
      // Generate receipt for this payment
      const receiptNumber = getNextReceiptNumber();
      const receipt = {
        id: Date.now() + Math.random(),
        receiptNumber,
        invoiceId,
        invoiceNumber: inv.invoiceNumber,
        orderNumber: inv.orderNumber,
        customerId: inv.customerId,
        customerName: (customers.find((c) => c.id === inv.customerId) || {}).name || "",
        amount,
        paymentMethod: paymentMethod || "cash",
        paymentDate: paymentDate || new Date().toISOString(),
        referenceNumber: referenceNumber || "",
        notes: notes || "",
        totalInvoiceAmount: total,
        amountPaidBefore: currentPaid,
        balanceAfter: Math.max(0, total - newPaid),
        createdAt: new Date().toISOString(),
      };
      receipts.push(receipt);
      saveItem("sgf_receipts", receipts);
      saveItem("sgf_collectionNotes", collectionNotes);
      saveItem("sgf_invoices", invoices);
      return { invoice: inv, receipt };
    },
    editPayment: ({ invoiceId, paymentId, amount, paymentMethod, paymentDate, referenceNumber, notes }: any) => {
      const invIdx = invoices.findIndex((i) => i.id === invoiceId);
      if (invIdx < 0) return null;
      const inv = invoices[invIdx];
      if (!inv.payments) return null;
      const payIdx = inv.payments.findIndex((p: any) => p.id === paymentId);
      if (payIdx < 0) return null;
      // Update the payment
      inv.payments[payIdx] = {
        ...inv.payments[payIdx],
        amount,
        paymentMethod: paymentMethod || inv.payments[payIdx].paymentMethod,
        paymentDate: paymentDate || inv.payments[payIdx].paymentDate,
        referenceNumber: referenceNumber ?? inv.payments[payIdx].referenceNumber,
        notes: notes ?? inv.payments[payIdx].notes,
      };
      // Recalculate totals
      const totalPaid = inv.payments.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
      const total = Number(inv.total || inv.totalAmount || 0);
      inv.amountPaid = totalPaid;
      inv.balanceDue = Math.max(0, total - totalPaid);
      if (totalPaid >= total) {
        inv.status = "paid";
      } else if (totalPaid > 0) {
        inv.status = "partially_paid";
      } else {
        inv.status = inv.status === "draft" ? "draft" : "sent";
      }
      saveItem("sgf_invoices", invoices);
      return inv;
    },
    deletePayment: ({ invoiceId, paymentId }: { invoiceId: number; paymentId: number }) => {
      const invIdx = invoices.findIndex((i) => i.id === invoiceId);
      if (invIdx < 0) return null;
      const inv = invoices[invIdx];
      if (!inv.payments) return null;
      inv.payments = inv.payments.filter((p: any) => p.id !== paymentId);
      // Recalculate totals
      const totalPaid = inv.payments.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
      const total = Number(inv.total || inv.totalAmount || 0);
      inv.amountPaid = totalPaid;
      inv.balanceDue = Math.max(0, total - totalPaid);
      if (totalPaid >= total) {
        inv.status = "paid";
      } else if (totalPaid > 0) {
        inv.status = "partially_paid";
      } else {
        inv.status = inv.status === "draft" ? "draft" : "sent";
      }
      saveItem("sgf_invoices", invoices);
      return inv;
    },
    getReceipts: () => receipts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    getReceiptsByInvoice: (invoiceId: number) => receipts.filter((r) => r.invoiceId === invoiceId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    getReceiptsByCustomer: (customerId: number) => receipts.filter((r) => r.customerId === customerId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    getReceiptById: (id: number) => receipts.find((r) => r.id === r.id) || null,

    // Credit note methods
    getCreditNotes: () => creditNotes.filter((cn) => !cn.voided).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    getCreditNotesByInvoice: (invoiceId: number) => creditNotes.filter((cn) => cn.invoiceId === invoiceId && !cn.voided).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    getCreditNotesByCustomer: (customerId: number) => creditNotes.filter((cn) => cn.customerId === customerId && !cn.voided).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    createCreditNote: (data: any) => {
      const creditNote = {
        id: Date.now() + Math.random(),
        creditNoteNumber: `CN-${String(creditNotes.filter((cn) => !cn.voided).length + 1).padStart(3, "0")}`,
        ...data,
        createdAt: new Date().toISOString(),
      };
      creditNotes.push(creditNote);
      saveItem("sgf_creditNotes", creditNotes);
      if (data.invoiceId) {
        const inv = invoices.find((i) => i.id === data.invoiceId);
        if (inv) {
          inv.balanceDue = Math.max(0, (inv.balanceDue || inv.total || 0) - (data.amount || 0));
          inv.amountPaid = (inv.amountPaid || 0) + (data.amount || 0);
          if (inv.balanceDue <= 0.01) inv.status = "paid";
          else if ((inv.amountPaid || 0) > 0) inv.status = "partially_paid";
          saveItem("sgf_invoices", invoices);
        }
      }
      logAudit("CREATE", "creditNote", creditNote.id, `Credit note ${creditNote.creditNoteNumber} for R${data.amount}`);
      return creditNote;
    },
    voidCreditNote: (id: number) => {
      const idx = creditNotes.findIndex((cn) => cn.id === id);
      if (idx >= 0) {
        const cn = creditNotes[idx];
        cn.voided = true;
        cn.voidedAt = new Date().toISOString();
        if (cn.invoiceId) {
          const inv = invoices.find((i) => i.id === cn.invoiceId);
          if (inv) {
            inv.balanceDue = (inv.balanceDue || 0) + (cn.amount || 0);
            inv.amountPaid = Math.max(0, (inv.amountPaid || 0) - (cn.amount || 0));
            if ((inv.amountPaid || 0) <= 0) inv.status = inv.status === "draft" ? "draft" : "sent";
            else if ((inv.balanceDue || 0) > 0) inv.status = "partially_paid";
            saveItem("sgf_invoices", invoices);
          }
        }
        saveItem("sgf_creditNotes", creditNotes);
        return cn;
      }
      return null;
    },

    /** Update invoice fields (admin only) — for correcting historical data */
    updateInvoice: ({ id, data }: { id: number; data: any }) => {
      const idx = invoices.findIndex((i) => i.id === id);
      if (idx < 0) return null;
      const inv = invoices[idx];
      // Audit log: invoice number change
      if (data.invoiceNumber !== undefined && data.invoiceNumber !== inv.invoiceNumber) {
        logAudit("UPDATE", "invoice", id, `Invoice number changed from ${inv.invoiceNumber} to ${data.invoiceNumber}`);
        inv.invoiceNumber = data.invoiceNumber;
      }
      // Update allowed fields
      if (data.customerId !== undefined) {
        inv.customerId = data.customerId;
        inv.customer = customers.find((c) => c.id === data.customerId) || null;
      }
      if (data.invoiceDate !== undefined) inv.invoiceDate = data.invoiceDate;
      if (data.total !== undefined) {
        const oldTotal = inv.total || 0;
        inv.total = data.total;
        // Recalculate balance if total changed and not a payment edit
        if (data.amountPaid === undefined) {
          inv.balanceDue = data.total - (inv.amountPaid || 0);
          if (inv.balanceDue <= 0) inv.status = "paid";
          else if ((inv.amountPaid || 0) > 0) inv.status = "partially_paid";
          else inv.status = "sent";
        }
      }
      if (data.amountPaid !== undefined) inv.amountPaid = data.amountPaid;
      if (data.balanceDue !== undefined) inv.balanceDue = data.balanceDue;
      if (data.status !== undefined) inv.status = data.status;
      if (data.notes !== undefined) inv.notes = data.notes;
      if (data.items !== undefined) inv.items = data.items;
      if (data.subtotal !== undefined) inv.subtotal = data.subtotal;
      if (data.vatAmount !== undefined) inv.vatAmount = data.vatAmount;
      if (data.paymentTerms !== undefined) inv.paymentTerms = data.paymentTerms;
      inv.updatedAt = new Date().toISOString();
      saveItem("sgf_invoices", invoices);
      return inv;
    },

    /** Find customer by fuzzy name matching */
    findCustomerByFuzzyName: (searchName: string) => {
      if (!searchName) return null;
      const search = searchName.toLowerCase().trim();
      // Exact match first
      let match = customers.find((c) => c.name?.toLowerCase().trim() === search);
      if (match) return match;
      // Contains match (name is substring of customer name or vice versa)
      match = customers.find((c) => {
        const cn = c.name?.toLowerCase() || "";
        return cn.includes(search) || search.includes(cn);
      });
      if (match) return match;
      // Token match (match individual words)
      const tokens = search.split(/\s+/).filter((t) => t.length > 2);
      if (tokens.length > 0) {
        let bestMatch = null;
        let bestScore = 0;
        for (const c of customers) {
          const cn = c.name?.toLowerCase() || "";
          let score = 0;
          for (const token of tokens) {
            if (cn.includes(token)) score++;
          }
          if (score > bestScore) {
            bestScore = score;
            bestMatch = c;
          }
        }
        // Require at least one significant word to match
        if (bestMatch && bestScore > 0) return bestMatch;
      }
      return null;
    },

    /** Bulk import historical invoices from Sage — preserves original invoice numbers and dates.
     *  UPDATES existing invoices with line items if they already exist (no more skipping). */
    bulkHistoricalImport: (historicalInvoices: any[]) => {
      let created = 0;
      let updated = 0;
      let skipped = 0;
      const unmatched: string[] = [];
      // Pre-clean: remove any existing duplicate Sage invoices (keep best one)
      const sageInvoices = invoices.filter(i => i.source === 'sage' || !i.orderId);
      const nonSageInvoices = invoices.filter(i => i.source !== 'sage' && i.orderId);
      const uniqueSage = new Map<string, any>();
      for (const inv of sageInvoices) {
        const key = (inv.invoiceNumber || '').toString().trim().toLowerCase();
        if (!key) continue;
        const existing = uniqueSage.get(key);
        if (!existing || (inv.items?.length || 0) > (existing.items?.length || 0)) {
          uniqueSage.set(key, inv);
        }
      }
      invoices = [...nonSageInvoices, ...uniqueSage.values()];
      saveItem("sgf_invoices", invoices);

      for (const hist of historicalInvoices) {
        // Check if invoice number already exists (case-insensitive, trimmed)
        const histNum = (hist.invoiceNumber || '').toString().trim().toLowerCase();
        const existing = invoices.find((i) => (i.invoiceNumber || '').toString().trim().toLowerCase() === histNum);

        if (existing) {
          // UPDATE existing invoice with line items from order report
          const hasRealItems = hist.items && hist.items.length > 0 &&
            !(hist.items.length === 1 && (hist.items[0].description || "").toLowerCase().includes("historical"));

          if (hasRealItems) {
            // Replace the generic fallback items with real line items
            existing.items = hist.items;
            // Also ensure source is marked as sage
            existing.source = "sage";
            // Ensure other fields are populated
            if (!existing.salesRep && hist.salesRep) existing.salesRep = hist.salesRep;
            if (!existing.subtotal && hist.subtotal) existing.subtotal = hist.subtotal;
            if (!existing.vatAmount && hist.vatAmount) existing.vatAmount = hist.vatAmount;
            updated++;
          } else {
            skipped++;
          }
          continue;
        }

        // Find customer: first by customerCode (Sage data already has app customerCode),
        // then fall back to fuzzy name matching
        let customerId = hist.customerId;
        let matchedCustomer = null;

        if (!customerId && hist.customerCode) {
          // Try exact match by customerCode — Sage export was already updated to match app codes
          matchedCustomer = customers.find((c) => c.customerCode && c.customerCode.toLowerCase() === String(hist.customerCode).toLowerCase());
          if (matchedCustomer) {
            customerId = matchedCustomer.id;
          }
        }

        if (!customerId && hist.customerName) {
          // Fall back to fuzzy name matching if customerCode lookup failed
          matchedCustomer = dataService.invoice.findCustomerByFuzzyName(hist.customerName);
          if (matchedCustomer) {
            customerId = matchedCustomer.id;
          } else {
            unmatched.push(hist.customerName);
          }
        }

        // Parse historical date
        let invoiceDate = hist.invoiceDate;
        if (!invoiceDate && hist.date) {
          // Try DD/MM/YYYY format
          const parts = hist.date.split("/");
          if (parts.length === 3) {
            invoiceDate = `20${parts[2]}-${parts[1]}-${parts[0]}`;
          }
        }

        const subtotal = hist.subtotal || hist.total || 0;
        const vatAmount = hist.vatAmount || subtotal * 0.15;
        const total = hist.total || subtotal + vatAmount;

        const newInvoice = {
          id: Date.now() + Math.random(),
          invoiceNumber: hist.invoiceNumber,
          orderNumber: hist.orderNumber || hist.invoiceNumber,
          orderId: null,
          customerId: customerId || 0,
          customer: customerId ? customers.find((c) => c.id === customerId) : null,
          customerCode: hist.customerCode || null, // PRESERVE Sage customerCode for statement matching
          items: hist.items || [],
          subtotal,
          vatAmount,
          total,
          amountPaid: hist.amountPaid || 0,
          balanceDue: total - (hist.amountPaid || 0),
          status: hist.status || "sent",
          paymentTerms: hist.paymentTerms || "cod",
          invoiceDate: invoiceDate || new Date().toISOString(),
          notes: hist.notes || "Historical import from Sage",
          payments: hist.payments || [],
          deliveryNoteNumber: hist.deliveryNoteNumber || null,
          source: "sage",
          createdAt: invoiceDate || new Date().toISOString(),
        };
        invoices.push(newInvoice);
        created++;
      }
      saveItem("sgf_invoices", invoices);
      // Deduplicate unmatched list
      const uniqueUnmatched = [...new Set(unmatched)];
      return { created, updated, skipped, total: invoices.length, unmatched: uniqueUnmatched, unmatchedCount: uniqueUnmatched.length };
    },

    /** Re-link existing Sage invoices to customers by customerCode.
     *  Call this after updating Sage data to match app customerCodes.
     *  Returns count of re-linked invoices. */
    relinkSageInvoices: () => {
      load();
      let relinked = 0;
      const details: string[] = [];
      const changedInvoices: any[] = [];

      for (const inv of invoices) {
        // Only process Sage invoices with no customerId (or customerId === 0)
        if (inv.source !== "sage" || (inv.customerId && inv.customerId !== 0)) continue;

        // Try to find customer by customerCode on the Sage invoice data
        const sageCode = (inv as any).customerCode || (inv as any).sageCustomerCode;
        if (sageCode) {
          const matched = customers.find((c) => c.customerCode && c.customerCode.toLowerCase() === String(sageCode).toLowerCase());
          if (matched) {
            inv.customerId = matched.id;
            inv.customer = matched;
            inv.customerCode = matched.customerCode; // Store code on invoice for statement matching
            relinked++;
            changedInvoices.push(inv);
            details.push(`${inv.invoiceNumber} → ${matched.name} (${matched.customerCode})`);
            continue;
          }
        }

        // Fallback: try matching by customer name in the notes or invoice data
        const customerName = (inv as any).customerName || (inv.customer && (inv.customer as any).name);
        if (customerName) {
          const fuzzyMatch = dataService.invoice.findCustomerByFuzzyName(customerName);
          if (fuzzyMatch) {
            inv.customerId = fuzzyMatch.id;
            inv.customer = fuzzyMatch;
            relinked++;
            changedInvoices.push(inv);
            details.push(`${inv.invoiceNumber} → ${fuzzyMatch.name} (fuzzy match)`);
          }
        }
      }

      if (relinked > 0) {
        saveItem("sgf_invoices", invoices);
      }

      return { relinked, details, changedInvoices };
    },

    getCustomerStatement: ({ customerId, fromDate, toDate }: any) => {
      const customer = customers.find((c) => c.id == customerId);
      const custCode = customer?.customerCode;
      // Match by customerId (app + linked Sage) OR by customerCode (unlinked Sage)
      // Uses trimmed lowercase comparison for robust matching
      const custCodeLower = custCode ? String(custCode).trim().toLowerCase() : null;
      const custInvoices = invoices
        .filter((i) => {
          if (i.customerId == customerId) return true;
          const invCode = (i as any).customerCode;
          if (i.source === "sage" && custCodeLower && invCode && String(invCode).trim().toLowerCase() === custCodeLower) return true;
          const nestedCode = i.customer && (i.customer as any).customerCode;
          if (i.source === "sage" && custCodeLower && nestedCode && String(nestedCode).trim().toLowerCase() === custCodeLower) return true;
          return false;
        })
        .filter((i) => !fromDate || new Date(i.invoiceDate || i.createdAt) >= new Date(fromDate))
        .filter((i) => !toDate || new Date(i.invoiceDate || i.createdAt) <= new Date(toDate + "T23:59:59"));
      let runningBal = 0;
      const lines = custInvoices.map((inv) => {
        const debit = Number(inv.total || inv.totalAmount || 0);
        const credit = Number(inv.amountPaid || 0);
        runningBal += debit - credit;
        return {
          date: inv.invoiceDate || inv.createdAt,
          invoiceNumber: inv.invoiceNumber,
          orderNumber: inv.orderNumber || "",
          description: inv.notes || "Invoice",
          paymentTerms: inv.paymentTerms || "cod",
          debit,
          credit,
          balance: runningBal,
        };
      });
      const totalInvoiced = custInvoices.reduce((s, i) => s + Number(i.total || i.totalAmount || 0), 0);
      const totalPaid = custInvoices.reduce((s, i) => s + Number(i.amountPaid || 0), 0);
      return {
        customer: customer || null,
        fromDate: fromDate || new Date(0).toISOString(),
        toDate: toDate || new Date().toISOString(),
        openingBalance: 0,
        closingBalance: totalInvoiced - totalPaid,
        totalInvoiced,
        totalPaid,
        lines,
      };
    },
    getStats: () => {
      const totalValue = invoices.reduce((sum, i) => sum + Number(i.total || i.totalAmount || 0), 0);
      const totalPaid = invoices.reduce((sum, i) => sum + Number(i.amountPaid || 0), 0);
      const outstanding = invoices
        .filter((i) => i.status !== "draft" && i.status !== "paid")
        .reduce((sum, i) => sum + (Number(i.balanceDue) || Number(i.total || i.totalAmount || 0) - Number(i.amountPaid || 0)), 0);
      const sageCount = invoices.filter((i) => i.source === "sage").length;
      const sageOutstanding = invoices
        .filter((i) => i.source === "sage" && i.status !== "draft" && i.status !== "paid")
        .reduce((sum, i) => sum + (Number(i.balanceDue) || Number(i.total || i.totalAmount || 0) - Number(i.amountPaid || 0)), 0);
      return {
        total: invoices.length,
        draft: invoices.filter((i) => i.status === "draft").length,
        sent: invoices.filter((i) => i.status === "sent").length,
        partiallyPaid: invoices.filter((i) => i.status === "partially_paid").length,
        paid: invoices.filter((i) => i.status === "paid").length,
        overdue: invoices.filter((i) => i.status === "overdue").length,
        totalValue,
        totalPaid,
        outstanding,
        sageCount,
        sageOutstanding,
      };
    },
  },

  appointment: {
    list: () => appointments.map((a) => ({
      ...a,
      customer: customers.find((c) => c.id === a.customerId) || null,
    })),
    create: (data: any) => {
      const newItem = { ...data, id: Date.now(), status: "scheduled", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      // Auto-populate salesRepName from customer if not provided
      if (!newItem.salesRepName && newItem.customerId) {
        const cust = customers.find((c) => c.id === newItem.customerId);
        if (cust?.salesRepName) newItem.salesRepName = cust.salesRepName;
      }
      appointments.push(newItem);
      saveItem("sgf_appointments", appointments);
      return newItem;
    },
    update: ({ id, data }: { id: number; data: any }) => {
      const idx = appointments.findIndex((a) => a.id === id);
      if (idx >= 0) { appointments[idx] = { ...appointments[idx], ...data, updatedAt: new Date().toISOString() }; saveItem("sgf_appointments", appointments); return appointments[idx]; }
      return null;
    },
    delete: (id: number) => {
      const idx = appointments.findIndex((a) => a.id === id);
      if (idx >= 0) { const deleted = appointments[idx]; appointments.splice(idx, 1); saveItem("sgf_appointments", appointments); return deleted; }
      return null;
    },
    updateStatus: ({ id, status }: { id: number; status: string }) => {
      const idx = appointments.findIndex((a) => a.id === id);
      if (idx >= 0) { appointments[idx].status = status; saveItem("sgf_appointments", appointments); return appointments[idx]; }
      return null;
    },
    getStats: () => ({
      total: appointments.length,
      today: appointments.filter((a) => new Date(a.appointmentDate).toDateString() === new Date().toDateString()).length,
      completed: appointments.filter((a) => a.status === "completed").length,
      inProgress: appointments.filter((a) => a.status === "in_progress").length,
    }),
  },

  checkin: {
    list: () => checkins.map((ci) => ({
      ...ci,
      customer: customers.find((c) => c.id === ci.customerId) || null,
    })),
    update: ({ id, data }: { id: number; data: any }) => {
      const idx = checkins.findIndex((c) => c.id === id);
      if (idx >= 0) { checkins[idx] = { ...checkins[idx], ...data, updatedAt: new Date().toISOString() }; saveItem("sgf_checkins", checkins); return checkins[idx]; }
      return null;
    },
    delete: (id: number) => {
      const idx = checkins.findIndex((c) => c.id === id);
      if (idx >= 0) { const deleted = checkins[idx]; checkins.splice(idx, 1); saveItem("sgf_checkins", checkins); return deleted; }
      return null;
    },
    create: (data: any) => {
      const newItem = { ...data, id: Date.now(), status: "checked_in", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      // Auto-populate salesRepName from customer if not provided
      if (!newItem.salesRepName && newItem.customerId) {
        const cust = customers.find((c) => c.id === newItem.customerId);
        if (cust?.salesRepName) newItem.salesRepName = cust.salesRepName;
      }
      // If notes contains location info, also store it as location
      if (newItem.notes && !newItem.location) {
        newItem.location = newItem.notes;
      }
      checkins.push(newItem);
      saveItem("sgf_checkins", checkins);
      return newItem;
    },
    checkout: ({ id, notes }: { id: number; notes?: string }) => {
      const idx = checkins.findIndex((ci) => ci.id === id);
      if (idx >= 0) {
        checkins[idx].status = "checked_out";
        checkins[idx].checkedOutAt = new Date().toISOString();
        if (notes) checkins[idx].checkoutNotes = notes;
        checkins[idx].updatedAt = new Date().toISOString();
        // Calculate duration in minutes
        const checkInTime = new Date(checkins[idx].createdAt).getTime();
        const checkOutTime = new Date(checkins[idx].checkedOutAt).getTime();
        checkins[idx].durationMinutes = Math.round((checkOutTime - checkInTime) / 60000);
        saveItem("sgf_checkins", checkins);
        return checkins[idx];
      }
      return null;
    },
    getStats: () => ({
      total: checkins.length,
      today: checkins.filter((ci) => new Date(ci.createdAt).toDateString() === new Date().toDateString()).length,
      checkedIn: checkins.filter((ci) => ci.status === "checked_in").length,
      checkedOut: checkins.filter((ci) => ci.status === "checked_out").length,
    }),
  },

  followUpAction: {
    list: () => followUpActions.map((fa) => ({
      ...fa,
      customer: customers.find((c) => c.id === fa.customerId) || null,
    })).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    listByCustomer: ({ customerId }: { customerId: number }) =>
      followUpActions
        .filter((fa) => fa.customerId === customerId)
        .map((fa) => ({
          ...fa,
          customer: customers.find((c) => c.id === fa.customerId) || null,
        }))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    create: (data: any) => {
      const newItem = {
        ...data,
        id: Date.now() + Math.random(),
        createdAt: new Date().toISOString(),
      };
      followUpActions.push(newItem);
      saveItem("sgf_followUpActions", followUpActions);
      return newItem;
    },
    getStats: () => ({
      total: followUpActions.length,
      today: followUpActions.filter((fa) => new Date(fa.createdAt).toDateString() === new Date().toDateString()).length,
      byType: followUpActions.reduce((acc: Record<string, number>, fa) => {
        const type = fa.actionType || "other";
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {}),
    }),
  },

  specialPrice: {
    listByCustomer: ({ customerId }: { customerId: number }) =>
      specialPrices
        .filter((sp) => sp.customerId === customerId)
        .map((sp) => ({
          ...sp,
          stockItem: products.find((p) => p.id === sp.stockItemId) || null,
        })),
    set: ({ customerId, stockItemId, specialPrice: price }: { customerId: number; stockItemId: number; specialPrice: number }) => {
      const existing = specialPrices.find((sp) => sp.customerId === customerId && sp.stockItemId === stockItemId);
      if (existing) {
        existing.specialPrice = String(price);
        existing.updatedAt = new Date().toISOString();
      } else {
        specialPrices.push({ id: Date.now(), customerId, stockItemId, specialPrice: String(price), createdAt: new Date().toISOString() });
      }
      saveItem("sgf_specialPrices", specialPrices);
      return { id: Date.now(), updated: !!existing };
    },
    delete: ({ id }: { id: number }) => {
      specialPrices = specialPrices.filter((sp) => sp.id !== id);
      saveItem("sgf_specialPrices", specialPrices);
      return { success: true };
    },
  },

  salesRep: {
    list: () => SALES_REPS.map((name, i) => ({ id: i + 1, name, isActive: true })),
    getStats: () => {
      const repStats = SALES_REPS.map((name) => {
        const repCustomers = customers.filter((c) => c.salesRepName === name);
        const repOrders = orders.filter((o) => {
          const cust = customers.find((c) => c.id === o.customerId);
          return cust?.salesRepName === name && o.orderType !== "sample";
        });
        const repSamples = orders.filter((o) => {
          const cust = customers.find((c) => c.id === o.customerId);
          return cust?.salesRepName === name && o.orderType === "sample";
        });
        const totalSales = repOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
        const sampleCost = repSamples.reduce((sum, o) => {
          const cost = o.items?.reduce((s: number, item: any) => {
            const prod = products.find((p) => p.id === item.stockItemId);
            return s + (Number(prod?.wholesalePrice || 0) * item.quantity);
          }, 0) || 0;
          return sum + cost;
        }, 0);
        return { name, customerCount: repCustomers.length, orderCount: repOrders.length, sampleCount: repSamples.length, totalSales, sampleCost };
      });
      return { total: SALES_REPS.length, active: SALES_REPS.length, inactive: 0, repStats };
    },

    /** Sales breakdown per rep: today, this week, this month */
    getSalesBreakdown: () => {
      const now = new Date();
      const todayStr = now.toISOString().slice(0, 10);

      // Week: Monday to Sunday
      const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ... 6=Sat
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const weekStart = new Date(now); weekStart.setDate(now.getDate() + mondayOffset);
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      // Month
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

      const repSales = SALES_REPS.map((name) => {
        const repOrders = orders.filter((o) => {
          const cust = customers.find((c) => c.id === o.customerId);
          return cust?.salesRepName === name && o.orderType !== "sample";
        });

        const todaySales = repOrders
          .filter((o) => (o.createdAt || "").startsWith(todayStr))
          .reduce((sum, o) => sum + Number(o.total || 0), 0);

        const weekSales = repOrders
          .filter((o) => {
            const ts = new Date(o.createdAt).getTime();
            return ts >= weekStart.getTime() && ts <= weekEnd.getTime();
          })
          .reduce((sum, o) => sum + Number(o.total || 0), 0);

        const monthSales = repOrders
          .filter((o) => {
            const ts = new Date(o.createdAt).getTime();
            return ts >= monthStart.getTime() && ts <= monthEnd.getTime();
          })
          .reduce((sum, o) => sum + Number(o.total || 0), 0);

        return { name, todaySales, weekSales, monthSales };
      });

      return {
        today: todayStr,
        weekRange: `${weekStart.toISOString().slice(0, 10)} to ${weekEnd.toISOString().slice(0, 10)}`,
        month: now.toLocaleString("en-ZA", { month: "long", year: "numeric" }),
        repSales,
        totals: {
          today: repSales.reduce((s, r) => s + r.todaySales, 0),
          week: repSales.reduce((s, r) => s + r.weekSales, 0),
          month: repSales.reduce((s, r) => s + r.monthSales, 0),
        },
      };
    },
  },

  followUp: {
    list: () => {
      // Show ALL pending follow-ups (sales rep needs to action them)
      return followUps
        .filter((fu) => fu.status === "pending")
        .map((fu) => {
          const order = orders.find((o) => o.id === fu.orderId);
          const customer = customers.find((c) => c.id === fu.customerId);
          return {
            ...fu,
            customer: customer || null,
            order: order ? { ...order, customer: customer || null } : null,
          };
        });
    },
    update: ({ id, status, reason, expectedOrderDate }: { id: number; status: string; reason?: string; expectedOrderDate?: string }) => {
      const idx = followUps.findIndex((fu) => fu.id === id);
      if (idx >= 0) {
        followUps[idx] = { ...followUps[idx], status, reason, expectedOrderDate, updatedAt: new Date().toISOString() };
        saveItem("sgf_followUps", followUps);
        return followUps[idx];
      }
      return null;
    },
    getStats: () => ({
      pending: followUps.filter((fu) => fu.status === "pending").length,
      completed: followUps.filter((fu) => fu.status === "completed").length,
      overdue: followUps.filter((fu) => fu.followUpDate < new Date().toISOString() && fu.status === "pending").length,
    }),
  },

  collections: {
    getOverdueInvoices: () => {
      const now = new Date();
      return invoices
        .filter((inv) => inv.status !== "paid")
        .map((inv) => {
          const customer = customers.find((c) => c.id === inv.customerId);
          // Use invoiceDate (actual invoice date) not createdAt (import date)
          const invoiceDate = new Date(inv.invoiceDate || inv.createdAt);
          // Calculate due date from payment terms
          const terms = inv.paymentTerms || "30_days";
          const termDays = terms === "30_days" ? 30 : terms === "14_days" ? 14 : terms === "7_days" ? 7 : terms === "cod" ? 0 : 30;
          const dueDate = new Date(invoiceDate);
          dueDate.setDate(dueDate.getDate() + termDays);
          const daysOverdue = Math.max(0, Math.floor((now.getTime() - dueDate.getTime()) / 86400000));
          let bucket = "pre_due";
          if (daysOverdue >= 21) bucket = "days_21_plus";
          else if (daysOverdue >= 11) bucket = "days_11_20";
          else if (daysOverdue >= 6) bucket = "days_6_10";
          else if (daysOverdue >= 3) bucket = "days_3_5";
          else if (daysOverdue >= 1) bucket = "days_1_2";
          else if (daysOverdue === 0) bucket = "due_today";
          const notes = collectionNotes.filter((n) => n.invoiceId === inv.id);
          const latestPromise = collectionPromises
            .filter((p) => p.invoiceId === inv.id)
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] || null;
          const accountHold = accountHolds.find((h) => h.customerId === inv.customerId && h.status === "active") || null;
          return {
            ...inv,
            customer: customer || null,
            daysOverdue,
            bucket,
            balanceDue: Number(inv.total || inv.totalAmount || 0) - Number(inv.amountPaid || 0),
            collectionNotes: notes,
            latestPromise,
            accountHold,
            salesRepName: customer?.salesRepName || "",
          };
        })
        .filter((inv) => inv.balanceDue > 0)
        .sort((a, b) => b.daysOverdue - a.daysOverdue);
    },
    getDailyReport: () => {
      const today = new Date().toISOString().slice(0, 10);
      const todayActivities = collectionNotes
        .filter((n) => n.createdAt?.startsWith(today))
        .map((n) => ({ ...n, type: n.type || "note" }));
      const byBucket: Record<string, any[]> = {};
      const overdueInvoices = dataService.collections.getOverdueInvoices();
      for (const inv of overdueInvoices) {
        if (!byBucket[inv.bucket]) byBucket[inv.bucket] = [];
        byBucket[inv.bucket].push(inv);
      }
      return { today, generatedAt: new Date().toISOString(), byBucket, todayActivities, summary: { totalOverdue: overdueInvoices.length, totalOutstanding: overdueInvoices.reduce((s, i) => s + i.balanceDue, 0), todayActivities: todayActivities.length } };
    },
    getStats: () => {
      const overdueInvoices = dataService.collections.getOverdueInvoices();
      const totalOutstanding = overdueInvoices.reduce((s, i) => s + i.balanceDue, 0);
      return { totalOutstanding, totalOverdueInvoices: overdueInvoices.length, onHold: accountHolds.filter((h) => h.status === "active").length, pendingPromises: collectionPromises.filter((p) => p.status === "pending").length, totalCollectedToday: 0 };
    },
    getCustomerPaymentHistory: (customerId: number) => {
      return invoices
        .filter((inv) => inv.customerId === customerId)
        .map((inv) => ({
          ...inv,
          notes: collectionNotes.filter((n) => n.invoiceId === inv.id),
        }))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    },
    addNote: ({ invoiceId, customerId, type, notes, contactMethod, contactPerson, followUpDate }: any) => {
      const note = { id: Date.now() + Math.random(), invoiceId, customerId, type: type || "note", notes, contactMethod: contactMethod || "manual", contactPerson: contactPerson || "", followUpDate: followUpDate || null, createdAt: new Date().toISOString() };
      collectionNotes.push(note);
      saveItem("sgf_collectionNotes", collectionNotes);
      return note;
    },
    recordPromise: ({ invoiceId, customerId, promiseDate, promisedAmount, notes }: any) => {
      const promise = { id: Date.now() + Math.random(), invoiceId, customerId, promiseDate, promisedAmount: promisedAmount || 0, notes: notes || "", status: "pending", createdAt: new Date().toISOString() };
      collectionPromises.push(promise);
      saveItem("sgf_collectionPromises", collectionPromises);
      return promise;
    },
    placeHold: ({ customerId, reason, notes }: any) => {
      // Remove any existing active hold first
      accountHolds = accountHolds.map((h) => h.customerId === customerId && h.status === "active" ? { ...h, status: "released", releasedAt: new Date().toISOString() } : h);
      const hold = { id: Date.now() + Math.random(), customerId, reason: reason || "Non-payment", notes: notes || "", status: "active", createdAt: new Date().toISOString() };
      accountHolds.push(hold);
      // Also add a collection note
      collectionNotes.push({ id: Date.now() + Math.random(), invoiceId: null, customerId, type: "hold", notes: `Account hold placed: ${reason || "Non-payment"}`, contactMethod: "manual", contactPerson: "", followUpDate: null, createdAt: new Date().toISOString() });
      saveItem("sgf_accountHolds", accountHolds);
      saveItem("sgf_collectionNotes", collectionNotes);
      return hold;
    },
    releaseHold: ({ holdId }: { holdId: number }) => {
      const idx = accountHolds.findIndex((h) => h.id === holdId);
      if (idx >= 0) {
        accountHolds[idx] = { ...accountHolds[idx], status: "released", releasedAt: new Date().toISOString() };
        collectionNotes.push({ id: Date.now() + Math.random(), invoiceId: null, customerId: accountHolds[idx].customerId, type: "hold", notes: "Account hold released", contactMethod: "manual", contactPerson: "", followUpDate: null, createdAt: new Date().toISOString() });
        saveItem("sgf_accountHolds", accountHolds);
        saveItem("sgf_collectionNotes", collectionNotes);
      }
      return { success: true };
    },
  },

  sampleReport: {
    getByCustomer: ({ customerId }: { customerId: number }) => {
      const customerOrders = orders.filter((o) => o.customerId === customerId && o.orderType === "sample");
      const report = customerOrders.flatMap((o) =>
        (o.items || []).map((item: any) => {
          const product = products.find((p) => p.id === item.stockItemId);
          const invoice = invoices.find((i) => i.orderId === o.id);
          const unitCost = Number(item.unitPrice || product?.corporatePrice || 0);
          const cost = unitCost * item.quantity;
          return {
            productCode: product?.productCode || "",
            productName: product?.productName || "Unknown",
            dateTaken: o.createdAt,
            orderNumber: o.orderNumber,
            invoiceNumber: invoice?.invoiceNumber || "N/A",
            quantity: item.quantity,
            unitCost,
            totalCost: cost,
          };
        })
      );
      const grandTotal = report.reduce((sum, r) => sum + r.totalCost, 0);
      return { items: report, grandTotal };
    },
    getAll: () => {
      const sampleOrders = orders.filter((o) => o.orderType === "sample");
      const report = [] as any[];
      for (const customer of customers) {
        const custSamples = sampleOrders.filter((o) => o.customerId === customer.id);
        if (custSamples.length === 0) continue;
        const items = custSamples.flatMap((o) =>
          (o.items || []).map((item: any) => {
            const product = products.find((p) => p.id === item.stockItemId);
            const invoice = invoices.find((i) => i.orderId === o.id);
            const unitCost = Number(item.unitPrice || product?.corporatePrice || 0);
            return {
              productCode: product?.productCode || "",
              productName: product?.productName || "Unknown",
              dateTaken: o.createdAt,
              orderNumber: o.orderNumber,
              invoiceNumber: invoice?.invoiceNumber || "N/A",
              quantity: item.quantity,
              unitCost,
              totalCost: unitCost * item.quantity,
            };
          })
        );
        const totalCost = items.reduce((sum, item) => sum + item.totalCost, 0);
        report.push({
          customerId: customer.id,
          customerName: customer.name,
          customerCode: customer.customerCode,
          salesRepName: customer.salesRepName || "Unassigned",
          items,
          totalCost,
          sampleCount: custSamples.length,
        });
      }
      const grandTotal = report.reduce((sum, r) => sum + r.totalCost, 0);
      return { customers: report, grandTotal };
    },
  },

  dashboard: {
    stats: () => ({
      totalRevenue: invoices.filter((i) => !i.notes?.includes("Sample")).reduce((s, i) => s + Number(i.total || i.totalAmount || 0), 0),
      totalOrders: orders.filter((o) => o.orderType !== "sample").length,
      totalCustomers: customers.length,
      lowStockItems: products.filter((p) => p.status === "low_stock" || p.status === "out_of_stock").length,
      pendingOrders: orders.filter((o) => o.status === "pending").length,
      readyForDelivery: orders.filter((o) => o.status === "ready").length,
      overdueInvoices: invoices.filter((i) => i.status === "overdue").length,
      recentOrders: orders.filter((o) => o.orderType !== "sample").slice(-5).reverse(),
    }),
  },

  audit: {
    list: () => auditLog,
    getCustomerDeletions: () => auditLog.filter((entry) => entry.entityType === "customer" && entry.action === "DELETE"),
    getAddressChanges: () => auditLog.filter((entry) => entry.action === "UPDATE_ADDRESS"),
  },

  /* ─── User Management with Roles ─── */
  user: {
    list: () => users.filter((u) => u.isActive !== false),
    getById: (id: number) => users.find((u) => u.id === id) || null,
    getByName: (name: string) => users.find((u) => u.name?.toLowerCase() === name.toLowerCase() && u.isActive !== false) || null,
    authenticate: ({ name, pin }: { name: string; pin: string }) => {
      const DEFAULT_USERS = [
        { id: 1, name: "Collin", email: "collin@supremeglobalfoods.co.za", role: "super_admin", pin: "2580", isActive: true },
        { id: 2, name: "Adeli", email: "adeli@supremeglobalfoods.co.za", role: "sales_rep", pin: "1111", isActive: true },
        { id: 3, name: "Inhouse", email: "inhouse@supremeglobalfoods.co.za", role: "sales_rep", pin: "2222", isActive: true },
        { id: 4, name: "Michael", email: "michael@supremeglobalfoods.co.za", role: "sales_rep", pin: "3333", isActive: true },
        { id: 5, name: "Nkosana", email: "nkosana@supremeglobalfoods.co.za", role: "sales_rep", pin: "4444", isActive: true },
        { id: 6, name: "Shanelle", email: "shanelle@supremeglobalfoods.co.za", role: "sales_rep", pin: "5555", isActive: true },
        { id: 7, name: "Tebogo Bila", email: "tebogo@supremeglobalfoods.co.za", role: "sales_rep", pin: "6666", isActive: true },
        { id: 8, name: "Ryleigh", email: "ryleigh@supremeglobalfoods.co.za", role: "admin", pin: "9999", isActive: true },
        { id: 9, name: "Aggie", email: "aggie@supremeglobalfoods.co.za", role: "admin", pin: "1018", isActive: true },
        { id: 10, name: "Ronald", email: "ronald@supremeglobalfoods.co.za", role: "super_admin", pin: "2581", isActive: true },
        { id: 11, name: "Jolene", email: "jolene@supremeglobalfoods.co.za", role: "admin", pin: "7777", isActive: true },
        { id: 12, name: "David", email: "david@supremeglobalfoods.co.za", role: "super_admin", pin: "8888", isActive: true },
      ];

      // Try 1: in-memory users array
      let found = users.find((x: any) => x.name?.toLowerCase() === name.toLowerCase() && x.pin === pin && x.isActive !== false);

      // Try 2: localStorage direct read
      if (!found) {
        try {
          const raw = localStorage.getItem("sgf_users");
          if (raw) {
            const stored = JSON.parse(raw);
            found = stored.find((x: any) => x.name?.toLowerCase() === name.toLowerCase() && x.pin === pin && x.isActive !== false);
          }
        } catch { /* ignore */ }
      }

      // Try 3: hardcoded defaults (always works, also repairs the DB)
      if (!found) {
        found = DEFAULT_USERS.find((x: any) => x.name?.toLowerCase() === name.toLowerCase() && x.pin === pin && x.isActive !== false);
        if (found) {
          // Repair: merge defaults into stored users so next time it works from DB
          const existingNames = new Set((users || []).map((u: any) => u.name?.toLowerCase()));
          for (const du of DEFAULT_USERS) {
            if (!existingNames.has(du.name.toLowerCase())) {
              users.push({ ...du, createdAt: new Date().toISOString() });
            }
          }
          saveItem("sgf_users", users);
        }
      }

      if (!found) return null;
      return { id: found.id, name: found.name, email: found.email, role: found.role };
    },
    create: (data: any) => {
      const newUser = { ...data, id: Date.now(), isActive: true, createdAt: new Date().toISOString() };
      users.push(newUser);
      saveItem("sgf_users", users);
      logAudit("CREATE", "user", newUser.id, `Created user: ${newUser.name} (${newUser.role})`);
      return newUser;
    },
    update: ({ id, data }: { id: number; data: any }) => {
      const idx = users.findIndex((u) => u.id === id);
      if (idx >= 0) {
        // Never allow changing a super_admin's role away from super_admin via update
        if (users[idx].role === "super_admin" && data.role && data.role !== "super_admin") {
          // Silently prevent demoting the last super admin
          const superAdminCount = users.filter((u) => u.role === "super_admin").length;
          if (superAdminCount <= 1) {
            delete data.role; // Remove role change
          }
        }
        users[idx] = { ...users[idx], ...data, updatedAt: new Date().toISOString() };
        saveItem("sgf_users", users);
        return users[idx];
      }
      return null;
    },
    delete: ({ id }: { id: number }) => {
      // Prevent deleting the last super admin
      const target = users.find((u) => u.id === id);
      if (target?.role === "super_admin") {
        const superAdminCount = users.filter((u) => u.role === "super_admin").length;
        if (superAdminCount <= 1) return { success: false, error: "Cannot delete the last super admin" };
      }
      users = users.filter((u) => u.id !== id);
      saveItem("sgf_users", users);
      return { success: true };
    },
    toggleActive: ({ id }: { id: number }) => {
      const idx = users.findIndex((u) => u.id === id);
      if (idx >= 0) {
        // Prevent deactivating the last super admin
        if (users[idx].role === "super_admin" && users[idx].isActive !== false) {
          const activeSuperAdminCount = users.filter((u) => u.role === "super_admin" && u.isActive !== false).length;
          if (activeSuperAdminCount <= 1) return { success: false, error: "Cannot deactivate the last active super admin" };
        }
        users[idx].isActive = users[idx].isActive === false ? true : false;
        saveItem("sgf_users", users);
        return { success: true, isActive: users[idx].isActive };
      }
      return { success: false };
    },
    resetPin: ({ id, pin }: { id: number; pin: string }) => {
      const idx = users.findIndex((u) => u.id === id);
      if (idx >= 0) {
        users[idx].pin = pin;
        users[idx].updatedAt = new Date().toISOString();
        saveItem("sgf_users", users);
        return { success: true };
      }
      return { success: false };
    },
  },
};

/** Reset all transaction data (orders, invoices, receipts, etc.) but keep users, customers, products, settings */
export function resetTransactionData(): void {
  orders = [];
  invoices = [];
  receipts = [];
  creditNotes = [];
  appointments = [];
  checkins = [];
  followUps = [];
  followUpActions = [];
  specialPrices = [];
  collectionNotes = [];
  collectionPromises = [];
  accountHolds = [];
  auditLog = [];

  const keysToRemove = [
    "sgf_orders", "sgf_invoices", "sgf_receipts", "sgf_creditNotes", "sgf_appointments",
    "sgf_checkins", "sgf_specialPrices", "sgf_auditLog", "sgf_followUps",
    "sgf_followUpActions", "sgf_collectionNotes", "sgf_collectionPromises",
    "sgf_accountHolds",
  ];
  keysToRemove.forEach(k => localStorage.removeItem(k));
}

/** Clear only appointments and check-ins */
export function clearAppointmentsAndCheckins(): void {
  appointments = [];
  checkins = [];
  localStorage.removeItem("sgf_appointments");
  localStorage.removeItem("sgf_checkins");
}

/** Full factory reset — clears EVERYTHING and reloads defaults */
export function factoryReset(): void {
  // Step 1: Disconnect Firebase to prevent re-download
  try {
    const { disconnectFirebase } = require("./firebaseSync");
    if (disconnectFirebase) disconnectFirebase();
  } catch { /* ignore if firebaseSync not loaded */ }
  localStorage.setItem("sgf_firebase_disconnected", "true");
  // Step 2: Clear all localStorage
  const allKeys = Object.keys(localStorage).filter(k => k.startsWith("sgf_"));
  allKeys.forEach(k => localStorage.removeItem(k));
  // Step 3: Keep disconnect flag set (re-add after clearing)
  localStorage.setItem("sgf_firebase_disconnected", "true");
  // Step 4: Reset ALL in-memory arrays including users
  orders = []; invoices = []; receipts = []; creditNotes = []; appointments = []; checkins = [];
  followUps = []; followUpActions = []; specialPrices = [];
  collectionNotes = []; collectionPromises = []; accountHolds = []; auditLog = []; users = [];
  // Step 5: Reset customers and products back to original static defaults
  customers = getStaticCustomers();
  products = getStaticProducts();
  // Step 6: Re-create default users
  load();
}

/**
 * DIRECT LOGIN — bypasses tRPC/localLink entirely.
 * Called directly from Login.tsx. Checks hardcoded defaults first.
 */
export function directAuthenticate(name: string, pin: string): { id: number; name: string; email: string; role: string } | null {
  const DEFAULT_USERS = [
    { id: 1, name: "Collin", email: "collin@supremeglobalfoods.co.za", role: "super_admin", pin: "2580" },
    { id: 2, name: "Adeli", email: "adeli@supremeglobalfoods.co.za", role: "sales_rep", pin: "1111" },
    { id: 3, name: "Inhouse", email: "inhouse@supremeglobalfoods.co.za", role: "sales_rep", pin: "2222" },
    { id: 4, name: "Michael", email: "michael@supremeglobalfoods.co.za", role: "sales_rep", pin: "3333" },
    { id: 5, name: "Nkosana", email: "nkosana@supremeglobalfoods.co.za", role: "sales_rep", pin: "4444" },
    { id: 6, name: "Shanelle", email: "shanelle@supremeglobalfoods.co.za", role: "sales_rep", pin: "5555" },
    { id: 7, name: "Tebogo Bila", email: "tebogo@supremeglobalfoods.co.za", role: "sales_rep", pin: "6666" },
    { id: 8, name: "Ryleigh", email: "ryleigh@supremeglobalfoods.co.za", role: "admin", pin: "9999" },
    { id: 9, name: "Aggie", email: "aggie@supremeglobalfoods.co.za", role: "admin", pin: "1018" },
    { id: 10, name: "Ronald", email: "ronald@supremeglobalfoods.co.za", role: "super_admin", pin: "2581" },
    { id: 11, name: "Jolene", email: "jolene@supremeglobalfoods.co.za", role: "admin", pin: "7777" },
    { id: 12, name: "David", email: "david@supremeglobalfoods.co.za", role: "super_admin", pin: "8888" },
  ];

  const ADMIN_ALIASES = ["admin", "administrator", "superadmin"];
  const typedName = name.toLowerCase().trim();

  // 1. Check stored users FIRST (so User Management additions work without code changes)
  try {
    const raw = localStorage.getItem("sgf_users");
    if (raw) {
      const stored = JSON.parse(raw);
      // Exact name match
      const found = stored.find(
        (x: any) => x.name?.toLowerCase() === typedName && x.pin === pin && x.isActive !== false
      );
      if (found) {
        return { id: found.id, name: found.name, email: found.email, role: found.role };
      }
      // Admin alias match — check if any stored user has this PIN and is admin
      if (ADMIN_ALIASES.includes(typedName)) {
        const adminFound = stored.find(
          (x: any) => (x.role === "admin" || x.role === "super_admin") && x.pin === pin && x.isActive !== false
        );
        if (adminFound) {
          return { id: adminFound.id, name: adminFound.name, email: adminFound.email, role: adminFound.role };
        }
      }
    }
  } catch { /* ignore */ }

  // 2. Allow "admin" as a generic alias — match against ANY hardcoded admin/super_admin PIN
  if (ADMIN_ALIASES.includes(typedName)) {
    const adminMatch = DEFAULT_USERS.find(
      (u) => (u.role === "admin" || u.role === "super_admin") && u.pin === pin
    );
    if (adminMatch) {
      return { id: adminMatch.id, name: adminMatch.name, email: adminMatch.email, role: adminMatch.role };
    }
  }

  // 3. Check hardcoded defaults (fallback — survives data clears)
  const fromDefaults = DEFAULT_USERS.find(
    (u) => u.name.toLowerCase() === typedName && u.pin === pin
  );
  if (fromDefaults) {
    // Repair stored users if needed
    try {
      const raw = localStorage.getItem("sgf_users");
      const stored = raw ? JSON.parse(raw) : [];
      const exists = stored.find((x: any) => x.name?.toLowerCase() === name.toLowerCase());
      if (!exists) {
        stored.push({ ...fromDefaults, isActive: true, createdAt: new Date().toISOString() });
        localStorage.setItem("sgf_users", JSON.stringify(stored));
        users = stored;
      }
    } catch { /* ignore */ }
    return { id: fromDefaults.id, name: fromDefaults.name, email: fromDefaults.email, role: fromDefaults.role };
  }

  return null;
}

// NOTE: load() is already called at line 143 after all module-level variables are declared.
// Do NOT call load() again here — it would overwrite in-memory data with stale localStorage.

function getEffectivePrice(stockItemId: number, priceTier: string, customerId: number): number {
  const sp = specialPrices.find((p) => p.customerId === customerId && p.stockItemId === stockItemId);
  if (sp) return Number(sp.specialPrice);
  const stock = products.find((p) => p.id === stockItemId);
  if (!stock) return 0;
  switch (priceTier) {
    case "corporate": return Number(stock.corporatePrice);
    case "bulk": return Number(stock.bulkPrice);
    case "retail": return Number(stock.retailPrice);
    default: return Number(stock.wholesalePrice);
  }
}
