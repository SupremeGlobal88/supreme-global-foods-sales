import { STATIC_CUSTOMERS, STATIC_PRODUCTS } from "@/data/staticData";
import { getStorageItem, setStorageItem, removeStorageItem } from "./compressedStorage";

// ═══════════════════════════════════════════════════════════════
//  SALES REP DATA MODEL — Object-based with full metadata
// ═══════════════════════════════════════════════════════════════

type SalesRep = {
  name: string;
  email?: string;
  phone?: string;
  region?: string;
  vehicleReg?: string;
  isActive?: boolean;
};

// Default sales reps as objects (not strings) — backward-compatible migration
let SALES_REPS: SalesRep[] = [
  { name: "Adeli", isActive: true },
  { name: "Inhouse", isActive: true },
  { name: "Michael", isActive: true },
  { name: "Nkosana", isActive: true },
  { name: "Tebogo Bila", isActive: true },
];

// Load from localStorage with backward compat for old string arrays
function loadSalesRepsFromStorage(): SalesRep[] {
  try {
    const stored = getStorageItem("sgf_salesReps");
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((r: any): SalesRep => {
          // Legacy: stored as plain string
          if (typeof r === "string") return { name: r, isActive: true };
          // Current: stored as object
          return {
            name: r?.name || String(r || ""),
            email: r?.email || "",
            phone: r?.phone || "",
            region: r?.region || "",
            vehicleReg: r?.vehicleReg || "",
            isActive: r?.isActive !== false,
          };
        }).filter((r: SalesRep) => r.name);
      }
    }
  } catch { /* ignore */ }
  return [...SALES_REPS];
}

// Initialize from storage on module load
try {
  const loaded = loadSalesRepsFromStorage();
  if (loaded.length > 0) {
    SALES_REPS = loaded;
  }
} catch { /* keep defaults */ }

function saveSalesReps() {
  try { setStorageItem("sgf_salesReps", JSON.stringify(SALES_REPS)); } catch { /* ignore */ }
}

/** Read current sales reps from localStorage (includes Firebase-synced reps).
 *  Returns full SalesRep objects. Backward-compatible with legacy string arrays. */
function getCurrentSalesReps(): SalesRep[] {
  try {
    const raw = getStorageItem("sgf_salesReps");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((r: any): SalesRep => {
          if (typeof r === "string") return { name: r, isActive: true };
          return {
            name: r?.name || String(r || ""),
            email: r?.email || "",
            phone: r?.phone || "",
            region: r?.region || "",
            vehicleReg: r?.vehicleReg || "",
            isActive: r?.isActive !== false,
          };
        }).filter((r: SalesRep) => r.name);
      }
    }
  } catch { /* ignore */ }
  // Fallback: return in-memory copy
  return SALES_REPS.map((r) => ({ ...r }));
}

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
// ─── CORPORATE MODULE DATA ───
let corporateCustomers = [] as any[];
let purchaseOrders = [] as any[];
let barrels = [] as any[];
let certificatesOfCompliance = [] as any[];
let packingListLines = [] as any[];

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

/** Repair product prices by matching against STATIC_PRODUCTS seed data.
 *  Matches by productCode (exact), then id (exact), then productName (normalized).
 *  Returns { count: number of products repaired, repaired: array of repaired products }. */
function repairProductPrices(productList: any[]): { count: number; repaired: any[] } {
  let pricesRestored = 0;
  const repairedProducts: any[] = [];
  for (const prod of productList) {
    const hasAnyPrice = Number(prod.wholesalePrice) > 0 || Number(prod.corporatePrice) > 0 || Number(prod.bulkPrice) > 0 || Number(prod.retailPrice) > 0;
    if (hasAnyPrice) continue;

    let match: any = null;
    // 1. Match by productCode (most reliable)
    if (prod.productCode) {
      match = STATIC_PRODUCTS.find((s: any) => s.productCode === prod.productCode);
    }
    // 1b. Renamed-format match: bulk uploads may store the size+name in productCode
    // (e.g. productCode "20 MEGA LONG VALUE") and append color to productName
    // (e.g. "MEGA LONG VALUE Brown"). In that case productCode equals the static
    // productName and color identifies the variant.
    if (!match && prod.productCode) {
      const codeNorm = String(prod.productCode).toLowerCase().trim().replace(/\s+/g, " ");
      const colorNorm = String(prod.color || "").toLowerCase().trim();
      match = STATIC_PRODUCTS.find((s: any) =>
        String(s.productName || "").toLowerCase().trim().replace(/\s+/g, " ") === codeNorm &&
        (!colorNorm || String(s.color || "").toLowerCase().trim() === colorNorm)
      );
    }
    // 2. Match by id
    if (!match && prod.id != null) {
      match = STATIC_PRODUCTS.find((s: any) => s.id == prod.id);
    }
    // 3. Match by normalized productName
    if (!match && prod.productName) {
      const normalizedName = String(prod.productName).toLowerCase().trim().replace(/\s+/g, " ");
      match = STATIC_PRODUCTS.find((s: any) => {
        const seedName = String(s.productName || "").toLowerCase().trim().replace(/\s+/g, " ");
        return seedName === normalizedName;
      });
    }

    if (match) {
      prod.wholesalePrice = match.wholesalePrice;
      prod.corporatePrice = match.corporatePrice;
      prod.bulkPrice = match.bulkPrice;
      prod.retailPrice = match.retailPrice;
      prod.costPrice = match.costPrice;
      // CRITICAL: Update timestamp so mergeWithCloudData() treats repaired
      // product as NEWER than Firebase's stale 0-price version. Without this,
      // Firebase overwrites the repaired prices back to 0.
      prod.updatedAt = new Date().toISOString();
      pricesRestored++;
      repairedProducts.push(prod);
    }
  }
  return { count: pricesRestored, repaired: repairedProducts };
}

/** Auto-repair quotes that were incorrectly changed to orders via Edit.
 *  A broken quote has: QTE- prefix, orderType !== "quote", status !== "converted".
 *  Resets them back to proper quotes so the Convert to Order flow works.
 *  Returns count of repaired quotes. */
function repairBrokenQuotes(): number {
  let repaired = 0;
  for (const order of orders) {
    const orderNum = String(order.orderNumber || "");
    const isQuotePrefix = orderNum.toUpperCase().startsWith("QTE-");
    const isQuoteType = order.orderType === "quote";
    const isConverted = order.status === "converted";

    // Broken: QTE- prefix but NOT a quote type AND not already converted
    if (isQuotePrefix && !isQuoteType && !isConverted) {
      order.orderType = "quote";
      order.status = "draft";
      // Restore stock that was incorrectly deducted when changed to "regular"
      // (quotes never deduct stock, so if it was treated as an order, stock was deducted)
      if (order.items && Array.isArray(order.items)) {
        for (const item of order.items) {
          if (item.stockItemId != null && item.quantity != null) {
            const product = products.find((p) => p.id == item.stockItemId);
            if (product) {
              product.quantity = (product.quantity || 0) + item.quantity;
            }
          }
        }
      }
      repaired++;
      console.log(`[QuoteRepair] Reset ${orderNum} back to quote (was orderType="${order.orderType}")`);
    }
  }
  if (repaired > 0) {
    saveItem("sgf_products", products);
  }
  return repaired;
}

function load() {
  // Helper: safely load a data array from storage
  function safeLoadArray(key: string): any[] | null {
    try {
      const raw = getStorageItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : null;
    } catch (e) {
      console.error(`[load] FAILED to parse ${key}:`, e);
      return null;
    }
  }

  try {
    // CUSTOMERS: load from localStorage if it's a valid array.
    // NEVER discard synced data due to length checks or missing keys.
    // Only fall back to static if localStorage is empty or corrupted.
    const c = safeLoadArray("sgf_customers");
    if (c && c.length > 0) customers = c;
    else customers = getStaticCustomers();

    // PRODUCTS: same approach — trust localStorage if it's a valid array
    const p = safeLoadArray("sgf_products");
    if (p && p.length > 0) {
      products = p;
      // PRICE REPAIR: If loaded products have 0 prices, restore from STATIC_PRODUCTS seed
      const priceRepair = repairProductPrices(products);
      if (priceRepair.count > 0) {
        saveItem("sgf_products", products);
        console.log(`[PriceRepair] Restored prices for ${priceRepair.count} products from seed data`);
        // Notify Firebase sync to push repaired products to cloud
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("sgf:productsRepaired", { detail: { products: priceRepair.repaired, count: priceRepair.count } }));
        }
      }
    } else products = getStaticProducts();

    // TRANSACTION DATA: always load if present (user-generated, never replace with static)
    const o = safeLoadArray("sgf_orders");
    if (o) orders = o;

    // AUTO-REPAIR: Fix quotes that were incorrectly changed to orders via Edit.
    // When someone edits a quote and changes orderType from "quote" to "regular",
    // the record keeps the QTE- prefix and "Draft" status but behaves like an order.
    // This repair resets them back to proper quotes so they can be converted correctly.
    const repairedQuotes = repairBrokenQuotes();
    if (repairedQuotes > 0) {
      console.log(`[QuoteRepair] Auto-repaired ${repairedQuotes} broken quote(s)`);
      saveItem("sgf_orders", orders);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("sgf:quotesRepaired", { detail: { count: repairedQuotes } }));
      }
    }

    const i = safeLoadArray("sgf_invoices");
    if (i) invoices = i;
    const a = safeLoadArray("sgf_appointments");
    if (a) appointments = a;
    const ci = safeLoadArray("sgf_checkins");
    if (ci) checkins = ci;
    const s = safeLoadArray("sgf_specialPrices");
    if (s) specialPrices = s;
    const log = safeLoadArray("sgf_auditLog");
    auditLog = log || [];
    const fu = safeLoadArray("sgf_followUps");
    followUps = fu || [];
    const fa = safeLoadArray("sgf_followUpActions");
    followUpActions = fa || [];
    const cn = safeLoadArray("sgf_collectionNotes");
    collectionNotes = cn || [];
    const cp = safeLoadArray("sgf_collectionPromises");
    collectionPromises = cp || [];
    const ah = safeLoadArray("sgf_accountHolds");
    accountHolds = ah || [];
    const rc = safeLoadArray("sgf_receipts");
    receipts = rc || [];
    const crn = safeLoadArray("sgf_creditNotes");
    creditNotes = crn || [];

    // USERS: always load and merge with defaults
    const u = safeLoadArray("sgf_users");
    if (u) users = u;
    const DEFAULT_USERS = [
      { id: 1, name: "Collin", email: "", role: "super_admin", pin: "2580", isActive: true, createdAt: new Date().toISOString() },
      { id: 2, name: "Adeli", email: "", role: "sales_rep", pin: "1111", isActive: true, createdAt: new Date().toISOString() },
      { id: 3, name: "Inhouse", email: "", role: "sales_rep", pin: "2222", isActive: true, createdAt: new Date().toISOString() },
      { id: 4, name: "Michael", email: "", role: "sales_rep", pin: "3333", isActive: true, createdAt: new Date().toISOString() },
      { id: 5, name: "Nkosana", email: "", role: "sales_rep", pin: "4444", isActive: true, createdAt: new Date().toISOString() },
      { id: 6, name: "Tebogo Bila", email: "", role: "sales_rep", pin: "6666", isActive: true, createdAt: new Date().toISOString() },
      { id: 7, name: "Aggie", email: "", role: "admin", pin: "1018", isActive: true, createdAt: new Date().toISOString() },
      { id: 8, name: "Ronald", email: "", role: "super_admin", pin: "2581", isActive: true, createdAt: new Date().toISOString() },
      { id: 9, name: "Jolene", email: "", role: "admin", pin: "7777", isActive: true, createdAt: new Date().toISOString() },
      { id: 10, name: "David", email: "", role: "super_admin", pin: "8888", isActive: true, createdAt: new Date().toISOString() },
    ];
    if (!users || users.length === 0) {
      users = [...DEFAULT_USERS];
      saveItem("sgf_users", users);
    }
    // NOTE: Do NOT re-add default users here. If an admin deleted a user,
    // they must stay deleted. Re-adding causes "jumping back" bug.
    // Defaults are only injected on first load when users array is empty.
  } catch { /* ignore */ }

  // DEDUPLICATE: Remove duplicate orders and invoices caused by sync bugs
  try { deduplicateAll(); } catch (e) { console.error("[load] deduplicateAll failed:", e); }

  // AUTO-CLEANUP: Remove invoices linked to quotes (quotes should never have invoices).
  // This fixes the bug where editing a quote and changing orderType to "normal"
  // generated an invoice that persisted even after the quote was repaired.
  try {
    const beforeCleanup = invoices.length;
    const toRemove: number[] = [];
    for (let idx = 0; idx < invoices.length; idx++) {
      const inv = invoices[idx];
      const linkedOrderNum = String(inv.orderNumber || "");
      if (linkedOrderNum.toUpperCase().startsWith("QTE-")) {
        toRemove.push(idx);
        console.log(`[InvoiceCleanup] Removing invoice ${inv.invoiceNumber} linked to quote ${linkedOrderNum}`);
      }
    }
    // Remove in reverse order to keep indices valid
    for (let i = toRemove.length - 1; i >= 0; i--) {
      invoices.splice(toRemove[i], 1);
    }
    if (toRemove.length > 0) {
      saveItem("sgf_invoices", invoices);
      console.log(`[InvoiceCleanup] Removed ${toRemove.length} invoice(s) linked to quotes`);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("sgf:invoicesCleaned", { detail: { removed: toRemove.length } }));
      }
    }
  } catch (e) { console.error("[load] invoice cleanup failed:", e); }

  // AUTO-LINK: Match Sage invoices to customers by customerCode.
  // This runs on every startup so ALL devices get linked Sage invoices
  // without needing to click "Re-link" button in Settings.
  try { autoLinkSageInvoices(); } catch { /* ignore */ }

  // FIX: Activate invoices stuck in draft for delivered/ready orders.
  // This fixes the bug where === vs == caused activateInvoiceFromOrder to fail.
  try { fixDraftInvoicesForDeliveredOrders(); } catch { /* ignore */ }

  // FIX: Repair cancelled invoices that still have a non-zero balanceDue.
  // When an invoice is cancelled, balanceDue must be 0 so it doesn't appear
  // in collections / outstanding reports.
  try {
    let cancelledFixed = 0;
    for (const inv of invoices) {
      if (inv.status === "cancelled" && Number(inv.balanceDue) !== 0) {
        inv.balanceDue = 0;
        cancelledFixed++;
      }
    }
    if (cancelledFixed > 0) {
      saveItem("sgf_invoices", invoices);
      console.log(`[load] Fixed ${cancelledFixed} cancelled invoice(s) with non-zero balanceDue`);
    }
  } catch { /* ignore */ }
}

// ═══════════════════════════════════════════════════════════════
//  DEDUPLICATION — Remove exact duplicates caused by sync bugs
// ═══════════════════════════════════════════════════════════════

function deduplicateOrders(): number {
  const seen = new Map<string, number>();
  const dups: number[] = [];
  for (let i = 0; i < orders.length; i++) {
    const o = orders[i];
    const key = `${o.id || ""}|${o.orderNumber || ""}|${o.customerId || ""}|${o.totalAmount || ""}|${o.createdAt || ""}`;
    if (seen.has(key)) {
      dups.push(i);
    } else {
      seen.set(key, i);
    }
  }
  for (let i = dups.length - 1; i >= 0; i--) {
    orders.splice(dups[i], 1);
  }
  return dups.length;
}

function deduplicateInvoices(): number {
  const seen = new Map<string, number>();
  const dups: number[] = [];
  for (let i = 0; i < invoices.length; i++) {
    const inv = invoices[i];
    const key = `${inv.id || ""}|${inv.invoiceNumber || ""}|${inv.orderNumber || ""}|${inv.totalAmount || ""}|${inv.createdAt || ""}`;
    if (seen.has(key)) {
      dups.push(i);
    } else {
      seen.set(key, i);
    }
  }
  for (let i = dups.length - 1; i >= 0; i--) {
    invoices.splice(dups[i], 1);
  }
  return dups.length;
}

function deduplicateAll(): void {
  const o = deduplicateOrders();
  const i = deduplicateInvoices();
  if (o > 0) {
    saveItem("sgf_orders", orders);
    console.log(`[deduplicate] Removed ${o} duplicate order(s)`);
  }
  if (i > 0) {
    saveItem("sgf_invoices", invoices);
    console.log(`[deduplicate] Removed ${i} duplicate invoice(s)`);
  }
}

// ═══════════════════════════════════════════════════════════════
//  AUTO-LINK SAGE INVOICES TO CUSTOMERS
// ═══════════════════════════════════════════════════════════════

function autoLinkSageInvoices(): void {
  let linked = 0;
  for (const inv of invoices) {
    const customerCode = String(inv.customerCode || "").trim().toLowerCase();
    if (!customerCode) continue;

    // Already linked with a name
    const hasName = inv.customerName && String(inv.customerName).trim().length > 0;
    if (hasName) continue;

    const match = customers.find(
      (c) => String(c.customerCode || "").trim().toLowerCase() === customerCode
    );
    if (match) {
      inv.customerName = match.name;
      inv.customerId = match.id;
      linked++;
    }
  }
  if (linked > 0) {
    saveItem("sgf_invoices", invoices);
    console.log(`[autoLink] Linked ${linked} Sage invoice(s) to customers`);
  }
}

// ═══════════════════════════════════════════════════════════════
//  FIX DRAFT INVOICES FOR DELIVERED/READY ORDERS
// ═══════════════════════════════════════════════════════════════

function fixDraftInvoicesForDeliveredOrders(): void {
  let fixed = 0;
  for (const order of orders) {
    if (order.orderType === "quote") continue;
    const status = String(order.status || "").toLowerCase();
    if (status !== "delivered" && status !== "ready") continue;

    const inv = invoices.find((i) => String(i.orderNumber) === String(order.orderNumber));
    if (!inv) continue;
    if (inv.status === "draft") {
      inv.status = "sent";
      fixed++;
    }
  }
  if (fixed > 0) {
    saveItem("sgf_invoices", invoices);
    console.log(`[fixDraftInvoices] Activated ${fixed} draft invoice(s) for delivered/ready orders`);
  }
}

// ═══════════════════════════════════════════════════════════════
//  STORAGE HELPERS
// ═══════════════════════════════════════════════════════════════

function saveItem(key: string, value: any) {
  try {
    setStorageItem(key, JSON.stringify(value));
  } catch (e) {
    console.error("[dataService] saveItem failed:", e);
  }
}

function getNextOrderNumber(): string {
  const prefix = "ORD";
  const nums = orders
    .map((o) => {
      const m = String(o.orderNumber || "").match(/\d+/);
      return m ? parseInt(m[0]) : 0;
    })
    .filter((n) => n > 0);
  const max = nums.length > 0 ? Math.max(...nums) : 0;
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}

/** Generate the next invoice number for a given company prefix.
 *  Supports SGF (Supreme Global Foods) and RC (Recircle) prefixes.
 *  Invoice numbers auto-increment based on the highest existing number. */
function getNextInvoiceNumberForCompany(company: string): string {
  const prefix = company?.toLowerCase() === "rc" ? "RC" : "SGF";
  const nums = invoices
    .map((i) => {
      const m = String(i.invoiceNumber || "").match(/(\d+)/);
      return m ? parseInt(m[0]) : 0;
    })
    .filter((n) => n > 0);
  const max = nums.length > 0 ? Math.max(...nums) : 0;
  return `${prefix}${max + 1}`;
}

function getNextQuoteNumber(): string {
  const prefix = "QTE";
  const nums = orders
    .filter((o) => o.orderType === "quote")
    .map((o) => {
      const m = String(o.orderNumber || "").match(/\d+/);
      return m ? parseInt(m[0]) : 0;
    })
    .filter((n) => n > 0);
  const max = nums.length > 0 ? Math.max(...nums) : 0;
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}

function getNextSampleOrderNumber(): string {
  const nums = orders
    .filter((o) => o.orderType === "sample")
    .map((o) => {
      const m = String(o.orderNumber || "").match(/\d+/);
      return m ? parseInt(m[0]) : 0;
    })
    .filter((n) => n > 0);
  const max = nums.length > 0 ? Math.max(...nums) : 0;
  return `SMP${String(max + 1).padStart(4, "0")}`;
}

function getNextPurchaseOrderNumber(): string {
  const prefix = "PO";
  const nums = purchaseOrders
    .map((o) => {
      const m = String(o.poNumber || "").match(/\d+/);
      return m ? parseInt(m[0]) : 0;
    })
    .filter((n) => n > 0);
  const max = nums.length > 0 ? Math.max(...nums) : 0;
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}

function getNextDeliveryNoteNumber(): string {
  const prefix = "DN";
  const nums = invoices
    .map((i) => {
      const m = String(i.deliveryNoteNumber || "").match(/\d+/);
      return m ? parseInt(m[0]) : 0;
    })
    .filter((n) => n > 0);
  const max = nums.length > 0 ? Math.max(...nums) : 0;
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}

function getNextReceiptNumber(): string {
  const prefix = "RCP";
  const nums = receipts
    .map((r) => {
      const m = String(r.receiptNumber || "").match(/\d+/);
      return m ? parseInt(m[0]) : 0;
    })
    .filter((n) => n > 0);
  const max = nums.length > 0 ? Math.max(...nums) : 0;
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}

function getNextCreditNoteNumber(): string {
  const prefix = "CN";
  const nums = creditNotes
    .map((cn) => {
      const m = String(cn.creditNoteNumber || "").match(/\d+/);
      return m ? parseInt(m[0]) : 0;
    })
    .filter((n) => n > 0);
  const max = nums.length > 0 ? Math.max(...nums) : 0;
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}

function getNextCollectionPromiseNumber(): string {
  const prefix = "CPM";
  const nums = collectionPromises
    .map((cp) => {
      const m = String(cp.promiseNumber || "").match(/\d+/);
      return m ? parseInt(m[0]) : 0;
    })
    .filter((n) => n > 0);
  const max = nums.length > 0 ? Math.max(...nums) : 0;
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}

/** Get the next ID for a given entity type by scanning existing IDs. */
function getNextId(entityArray: any[]): number {
  if (entityArray.length === 0) return 1;
  const maxId = Math.max(...entityArray.map((e) => Number(e.id) || 0));
  return maxId + 1;
}

// ═══════════════════════════════════════════════════════════════
//  NOTIFICATION HELPERS
// ═══════════════════════════════════════════════════════════════

function emitDataChanged(entity: string) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("sgf:dataChanged", { detail: { entity } }));
  }
}

// ═══════════════════════════════════════════════════════════════
//  AUDIT LOG
// ═══════════════════════════════════════════════════════════════

function addAuditLog(action: string, entity: string, entityId: number | string, details?: string) {
  const entry = {
    id: Date.now() + Math.floor(Math.random() * 1000),
    action,
    entity,
    entityId: String(entityId),
    details: details || "",
    timestamp: new Date().toISOString(),
  };
  auditLog.push(entry);
  saveItem("sgf_auditLog", auditLog);
}

// ═══════════════════════════════════════════════════════════════
//  FOLLOW-UP HELPERS
// ═══════════════════════════════════════════════════════════════

function addFollowUp(orderId: number, type: string, reason?: string, scheduledDate?: string, notes?: string) {
  const followUp = {
    id: Date.now() + Math.floor(Math.random() * 1000),
    orderId,
    type,
    reason: reason || "",
    scheduledDate: scheduledDate || new Date().toISOString(),
    notes: notes || "",
    status: "pending",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  followUps.push(followUp);
  saveItem("sgf_followUps", followUps);
  emitDataChanged("followUps");
  return followUp;
}

function addFollowUpAction(followUpId: number, action: string, notes?: string) {
  const followUpAction = {
    id: Date.now() + Math.floor(Math.random() * 1000),
    followUpId,
    action,
    notes: notes || "",
    timestamp: new Date().toISOString(),
  };
  followUpActions.push(followUpAction);
  saveItem("sgf_followUpActions", followUpActions);
  return followUpAction;
}

// ═══════════════════════════════════════════════════════════════
//  PRICE LOOKUP
// ═══════════════════════════════════════════════════════════════

function getEffectivePrice(stockItemId: number, priceTier: string, customerId: number, _isSample: boolean = false): number {
  // CRITICAL: Sample orders must ALWAYS use corporate price.
  // Do NOT apply special/customer prices to sample orders, even if a
  // special price exists for this customer+product combination.
  if (!_isSample) {
    const sp = specialPrices.find((p) => p.customerId == customerId && p.stockItemId == stockItemId);
    if (sp) return Number(sp.specialPrice);
  }
  const stock = products.find((p) => p.id == stockItemId);
  if (!stock) return 0;
  let rawPrice: number;
  switch (priceTier) {
    case "corporate": rawPrice = Number(stock.corporatePrice); break;
    case "bulk": rawPrice = Number(stock.bulkPrice); break;
    case "retail": rawPrice = Number(stock.retailPrice); break;
    default: rawPrice = Number(stock.wholesalePrice); break;
  }
  // Fallback to STATIC_PRODUCTS if loaded price is 0
  if (rawPrice <= 0) {
    const staticProd = STATIC_PRODUCTS.find((p: any) =>
      p.id == stockItemId ||
      (stock.productCode && p.productCode === stock.productCode) ||
      (stock.productName && p.productName && String(p.productName).toLowerCase().trim() === String(stock.productName).toLowerCase().trim())
    );
    if (staticProd) {
      switch (priceTier) {
        case "corporate": rawPrice = Number(staticProd.corporatePrice); break;
        case "bulk": rawPrice = Number(staticProd.bulkPrice); break;
        case "retail": rawPrice = Number(staticProd.retailPrice); break;
        default: rawPrice = Number(staticProd.wholesalePrice); break;
      }
    }
  }
  return rawPrice;
}

// ═══════════════════════════════════════════════════════════════
//  DATA SERVICE
// ═══════════════════════════════════════════════════════════════

export const dataService = {
  customer: {
    getAll: () => {
      load();
      return [...customers];
    },
    getById: (id: number) => {
      load();
      return customers.find((c) => c.id == id) || null;
    },
    create: (data: any) => {
      load();
      const newId = customers.length > 0 ? Math.max(...customers.map((c) => Number(c.id) || 0)) + 1 : 1;
      const newCustomer = { ...data, id: newId, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      customers.push(newCustomer);
      saveItem("sgf_customers", customers);
      addAuditLog("create", "customer", newId, `Created customer ${newCustomer.name}`);
      emitDataChanged("customers");
      return newCustomer;
    },
    update: ({ id, data }: { id: number; data: any }) => {
      load();
      const idx = customers.findIndex((c) => c.id == id);
      if (idx >= 0) {
        customers[idx] = { ...customers[idx], ...data, updatedAt: new Date().toISOString() };
        saveItem("sgf_customers", customers);
        addAuditLog("update", "customer", id, `Updated customer ${customers[idx].name}`);
        emitDataChanged("customers");
        return customers[idx];
      }
      return null;
    },
    delete: (id: number) => {
      load();
      customers = customers.filter((c) => c.id !== id);
      saveItem("sgf_customers", customers);
      addAuditLog("delete", "customer", id, "Deleted customer");
      emitDataChanged("customers");
      return { success: true };
    },
  },

  product: {
    getAll: () => {
      load();
      return [...products];
    },
    getById: (id: number) => {
      load();
      return products.find((p) => p.id == id) || null;
    },
    create: (data: any) => {
      load();
      const newId = products.length > 0 ? Math.max(...products.map((p) => Number(p.id) || 0)) + 1 : 1;
      const newProduct = { ...data, id: newId, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      products.push(newProduct);
      saveItem("sgf_products", products);
      addAuditLog("create", "product", newId, `Created product ${newProduct.productName}`);
      emitDataChanged("products");
      return newProduct;
    },
    update: ({ id, data }: { id: number; data: any }) => {
      load();
      const idx = products.findIndex((p) => p.id == id);
      if (idx >= 0) {
        products[idx] = { ...products[idx], ...data, updatedAt: new Date().toISOString() };
        saveItem("sgf_products", products);
        addAuditLog("update", "product", id, `Updated product ${products[idx].productName}`);
        emitDataChanged("products");
        return products[idx];
      }
      return null;
    },
    delete: (id: number) => {
      load();
      products = products.filter((p) => p.id !== id);
      saveItem("sgf_products", products);
      addAuditLog("delete", "product", id, "Deleted product");
      emitDataChanged("products");
      return { success: true };
    },
  },

  order: {
    getAll: () => {
      load();
      return [...orders];
    },
    getById: (id: number) => {
      load();
      return orders.find((o) => o.id == id) || null;
    },
    create: (data: any) => {
      load();
      const newId = orders.length > 0 ? Math.max(...orders.map((o) => Number(o.id) || 0)) + 1 : 1;
      const newOrder = {
        ...data,
        id: newId,
        orderNumber: data.orderNumber || getNextOrderNumber(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      orders.push(newOrder);
      saveItem("sgf_orders", orders);
      addAuditLog("create", "order", newId, `Created order ${newOrder.orderNumber}`);
      emitDataChanged("orders");
      return newOrder;
    },
    update: ({ id, data }: { id: number; data: any }) => {
      load();
      const idx = orders.findIndex((o) => o.id == id);
      if (idx >= 0) {
        orders[idx] = { ...orders[idx], ...data, updatedAt: new Date().toISOString() };
        saveItem("sgf_orders", orders);
        addAuditLog("update", "order", id, `Updated order ${orders[idx].orderNumber}`);
        emitDataChanged("orders");
        return orders[idx];
      }
      return null;
    },
    delete: (id: number) => {
      load();
      orders = orders.filter((o) => o.id !== id);
      saveItem("sgf_orders", orders);
      addAuditLog("delete", "order", id, "Deleted order");
      emitDataChanged("orders");
      return { success: true };
    },
    getByCustomer: (customerId: number) => {
      load();
      return orders.filter((o) => o.customerId == customerId);
    },
    repairOrders: () => {
      load();
      let repaired = 0;
      for (const order of orders) {
        // Fix missing totalAmount
        if (!order.totalAmount && order.items && Array.isArray(order.items)) {
          const total = order.items.reduce((sum: number, item: any) => sum + (item.lineTotal || 0), 0);
          order.totalAmount = total;
          repaired++;
        }
        // Fix missing customerId but with customer object
        if (!order.customerId && order.customer?.id) {
          order.customerId = order.customer.id;
          repaired++;
        }
        // Fix missing customer name
        if (!order.customerName && order.customer?.name) {
          order.customerName = order.customer.name;
          repaired++;
        }
        // Fix missing orderNumber
        if (!order.orderNumber) {
          order.orderNumber = getNextOrderNumber();
          repaired++;
        }
        // Fix negative or zero id
        if (!order.id || order.id <= 0) {
          order.id = getNextId(orders);
          repaired++;
        }
      }
      if (repaired > 0) {
        saveItem("sgf_orders", orders);
        console.log(`[repairOrders] Repaired ${repaired} order(s)`);
      }
      return repaired;
    },
  },

  invoice: {
    getAll: () => {
      load();
      return [...invoices];
    },
    getById: (id: number) => {
      load();
      return invoices.find((i) => i.id == id) || null;
    },
    create: (data: any) => {
      load();
      const newId = invoices.length > 0 ? Math.max(...invoices.map((i) => Number(i.id) || 0)) + 1 : 1;
      const newInvoice = {
        ...data,
        id: newId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      invoices.push(newInvoice);
      saveItem("sgf_invoices", invoices);
      addAuditLog("create", "invoice", newId, `Created invoice ${newInvoice.invoiceNumber}`);
      emitDataChanged("invoices");
      return newInvoice;
    },
    update: ({ id, data }: { id: number; data: any }) => {
      load();
      const idx = invoices.findIndex((i) => i.id == id);
      if (idx >= 0) {
        invoices[idx] = { ...invoices[idx], ...data, updatedAt: new Date().toISOString() };
        saveItem("sgf_invoices", invoices);
        addAuditLog("update", "invoice", id, `Updated invoice ${invoices[idx].invoiceNumber}`);
        emitDataChanged("invoices");
        return invoices[idx];
      }
      return null;
    },
    delete: (id: number) => {
      load();
      invoices = invoices.filter((i) => i.id !== id);
      saveItem("sgf_invoices", invoices);
      addAuditLog("delete", "invoice", id, "Deleted invoice");
      emitDataChanged("invoices");
      return { success: true };
    },
    getByOrder: (orderId: number) => {
      load();
      return invoices.filter((i) => i.orderId == orderId);
    },
    getByCustomer: (customerId: number) => {
      load();
      return invoices.filter((i) => i.customerId == customerId);
    },
    generateForOrder: (orderId: number) => {
      load();
      const order = orders.find((o) => o.id == orderId);
      if (!order) return null;

      // Check if invoice already exists
      const existingIdx = invoices.findIndex((i) => i.orderId == orderId);
      const subtotal = order.items.reduce((sum: number, item: any) => sum + (item.lineTotal || 0), 0);
      const vatRate = 0.15;
      const vatAmount = subtotal * vatRate;
      const total = subtotal + vatAmount;

      if (existingIdx >= 0) {
        const existing = invoices[existingIdx];
        const amountPaid = Number(existing.amountPaid || 0);
        const newBalanceDue = total - amountPaid;
        invoices[existingIdx] = {
          ...existing,
          subtotal,
          vatAmount,
          vatRate,
          total,
          totalAmount: total,
          balanceDue: newBalanceDue,
          items: order.items.map((item: any) => ({
            description: item.description || item.productName || "",
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            lineTotal: item.lineTotal,
          })),
          updatedAt: new Date().toISOString(),
        };
        saveItem("sgf_invoices", invoices);
        return existing.invoiceNumber;
      }

      const now = new Date();
      const dueDate = new Date(now);
      dueDate.setDate(dueDate.getDate() + 30);

      const invCompany = order.company || "sgf";
      let invoiceNumber = getNextInvoiceNumberForCompany(invCompany);
      const existingNumbers = new Set(invoices.map((i) => i.invoiceNumber));
      let safetyCounter = 0;
      while (existingNumbers.has(invoiceNumber) && safetyCounter < 100) {
        const match = invoiceNumber.match(/(SGF|RC)(\d+)/);
        if (match) {
          const prefix = match[1];
          const n = parseInt(match[2]) + 1;
          invoiceNumber = prefix === "RC" ? `RC${String(n).padStart(4, "0")}` : `SGF${n}`;
        }
        safetyCounter++;
      }

      const newInvoice = {
        id: invoices.length > 0 ? Math.max(...invoices.map((i) => Number(i.id) || 0)) + 1 : 1,
        orderId: order.id,
        orderNumber: order.orderNumber,
        invoiceNumber,
        deliveryNoteNumber: getNextDeliveryNoteNumber(),
        company: invCompany,
        customerId: order.customerId,
        customerName: order.customerName || order.customer?.name || "",
        customer: order.customer,
        subtotal,
        vatAmount,
        vatRate,
        total,
        totalAmount: total,
        balanceDue: total,
        amountPaid: 0,
        status: "draft",
        invoiceDate: now.toISOString(),
        dueDate: dueDate.toISOString(),
        notes: `Invoice for order ${order.orderNumber}`,
        items: order.items.map((item: any) => ({
          description: item.description || item.productName || "",
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          lineTotal: item.lineTotal,
        })),
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };

      invoices.push(newInvoice);
      saveItem("sgf_invoices", invoices);
      addAuditLog("create", "invoice", newInvoice.id, `Generated invoice ${invoiceNumber} for order ${order.orderNumber}`);
      emitDataChanged("invoices");
      return invoiceNumber;
    },
    activateFromPO: (poId: number) => {
      load();
      const inv = invoices.find((i) => i.purchaseOrderId == poId);
      if (!inv) return null;
      inv.status = "sent";
      inv.updatedAt = new Date().toISOString();
      saveItem("sgf_invoices", invoices);
      addAuditLog("update", "invoice", inv.id, `Activated invoice ${inv.invoiceNumber} from PO ${poId}`);
      emitDataChanged("invoices");
      return inv;
    },
  },

  appointment: {
    getAll: () => {
      load();
      return [...appointments];
    },
    getById: (id: number) => {
      load();
      return appointments.find((a) => a.id == id) || null;
    },
    create: (data: any) => {
      load();
      const newId = appointments.length > 0 ? Math.max(...appointments.map((a) => Number(a.id) || 0)) + 1 : 1;
      const newAppointment = {
        ...data,
        id: newId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      appointments.push(newAppointment);
      saveItem("sgf_appointments", appointments);
      addAuditLog("create", "appointment", newId, `Created appointment for ${newAppointment.customerName || ""}`);
      emitDataChanged("appointments");
      return newAppointment;
    },
    update: ({ id, data }: { id: number; data: any }) => {
      load();
      const idx = appointments.findIndex((a) => a.id == id);
      if (idx >= 0) {
        appointments[idx] = { ...appointments[idx], ...data, updatedAt: new Date().toISOString() };
        saveItem("sgf_appointments", appointments);
        addAuditLog("update", "appointment", id, `Updated appointment`);
        emitDataChanged("appointments");
        return appointments[idx];
      }
      return null;
    },
    delete: (id: number) => {
      load();
      appointments = appointments.filter((a) => a.id !== id);
      saveItem("sgf_appointments", appointments);
      addAuditLog("delete", "appointment", id, "Deleted appointment");
      emitDataChanged("appointments");
      return { success: true };
    },
    getByCustomer: (customerId: number) => {
      load();
      return appointments.filter((a) => a.customerId == customerId);
    },
  },

  checkin: {
    getAll: () => {
      load();
      return [...checkins];
    },
    getById: (id: number) => {
      load();
      return checkins.find((c) => c.id == id) || null;
    },
    create: (data: any) => {
      load();
      const newId = checkins.length > 0 ? Math.max(...checkins.map((c) => Number(c.id) || 0)) + 1 : 1;
      const newCheckin = {
        ...data,
        id: newId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      checkins.push(newCheckin);
      saveItem("sgf_checkins", checkins);
      addAuditLog("create", "checkin", newId, `Created check-in for ${newCheckin.customerName || ""}`);
      emitDataChanged("checkins");
      return newCheckin;
    },
    update: ({ id, data }: { id: number; data: any }) => {
      load();
      const idx = checkins.findIndex((c) => c.id == id);
      if (idx >= 0) {
        checkins[idx] = { ...checkins[idx], ...data, updatedAt: new Date().toISOString() };
        saveItem("sgf_checkins", checkins);
        addAuditLog("update", "checkin", id, `Updated check-in`);
        emitDataChanged("checkins");
        return checkins[idx];
      }
      return null;
    },
    delete: (id: number) => {
      load();
      checkins = checkins.filter((c) => c.id !== id);
      saveItem("sgf_checkins", checkins);
      addAuditLog("delete", "checkin", id, "Deleted check-in");
      emitDataChanged("checkins");
      return { success: true };
    },
    getByCustomer: (customerId: number) => {
      load();
      return checkins.filter((c) => c.customerId == customerId);
    },
  },

  specialPrice: {
    getAll: () => {
      load();
      return [...specialPrices];
    },
    getById: (id: number) => {
      load();
      return specialPrices.find((sp) => sp.id == id) || null;
    },
    create: (data: any) => {
      load();
      const newId = specialPrices.length > 0 ? Math.max(...specialPrices.map((sp) => Number(sp.id) || 0)) + 1 : 1;
      const newSpecialPrice = {
        ...data,
        id: newId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      specialPrices.push(newSpecialPrice);
      saveItem("sgf_specialPrices", specialPrices);
      addAuditLog("create", "specialPrice", newId, `Created special price for customer ${newSpecialPrice.customerId}`);
      emitDataChanged("specialPrices");
      return newSpecialPrice;
    },
    update: ({ id, data }: { id: number; data: any }) => {
      load();
      const idx = specialPrices.findIndex((sp) => sp.id == id);
      if (idx >= 0) {
        specialPrices[idx] = { ...specialPrices[idx], ...data, updatedAt: new Date().toISOString() };
        saveItem("sgf_specialPrices", specialPrices);
        addAuditLog("update", "specialPrice", id, `Updated special price`);
        emitDataChanged("specialPrices");
        return specialPrices[idx];
      }
      return null;
    },
    delete: (id: number) => {
      load();
      specialPrices = specialPrices.filter((sp) => sp.id !== id);
      saveItem("sgf_specialPrices", specialPrices);
      addAuditLog("delete", "specialPrice", id, "Deleted special price");
      emitDataChanged("specialPrices");
      return { success: true };
    },
    getByCustomer: (customerId: number) => {
      load();
      return specialPrices.filter((sp) => sp.customerId == customerId);
    },
  },

  user: {
    getAll: () => {
      load();
      return [...users];
    },
    getById: (id: number) => {
      load();
      return users.find((u) => u.id == id) || null;
    },
    create: (data: any) => {
      load();
      const newId = users.length > 0 ? Math.max(...users.map((u) => Number(u.id) || 0)) + 1 : 1;
      const newUser = {
        ...data,
        id: newId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      users.push(newUser);
      saveItem("sgf_users", users);
      addAuditLog("create", "user", newId, `Created user ${newUser.name}`);
      emitDataChanged("users");
      return newUser;
    },
    update: ({ id, data }: { id: number; data: any }) => {
      load();
      const idx = users.findIndex((u) => u.id == id);
      if (idx >= 0) {
        users[idx] = { ...users[idx], ...data, updatedAt: new Date().toISOString() };
        saveItem("sgf_users", users);
        addAuditLog("update", "user", id, `Updated user ${users[idx].name}`);
        emitDataChanged("users");
        return users[idx];
      }
      return null;
    },
    delete: (id: number) => {
      load();
      users = users.filter((u) => u.id !== id);
      saveItem("sgf_users", users);
      addAuditLog("delete", "user", id, "Deleted user");
      emitDataChanged("users");
      return { success: true };
    },
  },

  receipt: {
    getAll: () => {
      load();
      return [...receipts];
    },
    getById: (id: number) => {
      load();
      return receipts.find((r) => r.id == id) || null;
    },
    create: (data: any) => {
      load();
      const newId = receipts.length > 0 ? Math.max(...receipts.map((r) => Number(r.id) || 0)) + 1 : 1;
      const newReceipt = {
        ...data,
        id: newId,
        receiptNumber: data.receiptNumber || getNextReceiptNumber(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      receipts.push(newReceipt);
      saveItem("sgf_receipts", receipts);
      addAuditLog("create", "receipt", newId, `Created receipt ${newReceipt.receiptNumber}`);
      emitDataChanged("receipts");
      return newReceipt;
    },
    update: ({ id, data }: { id: number; data: any }) => {
      load();
      const idx = receipts.findIndex((r) => r.id == id);
      if (idx >= 0) {
        receipts[idx] = { ...receipts[idx], ...data, updatedAt: new Date().toISOString() };
        saveItem("sgf_receipts", receipts);
        addAuditLog("update", "receipt", id, `Updated receipt ${receipts[idx].receiptNumber}`);
        emitDataChanged("receipts");
        return receipts[idx];
      }
      return null;
    },
    delete: (id: number) => {
      load();
      receipts = receipts.filter((r) => r.id !== id);
      saveItem("sgf_receipts", receipts);
      addAuditLog("delete", "receipt", id, "Deleted receipt");
      emitDataChanged("receipts");
      return { success: true };
    },
    getByInvoice: (invoiceId: number) => {
      load();
      return receipts.filter((r) => r.invoiceId == invoiceId);
    },
  },

  creditNote: {
    getAll: () => {
      load();
      return [...creditNotes];
    },
    getById: (id: number) => {
      load();
      return creditNotes.find((cn) => cn.id == id) || null;
    },
    create: (data: any) => {
      load();
      const newId = creditNotes.length > 0 ? Math.max(...creditNotes.map((cn) => Number(cn.id) || 0)) + 1 : 1;
      const newCreditNote = {
        ...data,
        id: newId,
        creditNoteNumber: data.creditNoteNumber || getNextCreditNoteNumber(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      creditNotes.push(newCreditNote);
      saveItem("sgf_creditNotes", creditNotes);
      addAuditLog("create", "creditNote", newId, `Created credit note ${newCreditNote.creditNoteNumber}`);
      emitDataChanged("creditNotes");
      return newCreditNote;
    },
    update: ({ id, data }: { id: number; data: any }) => {
      load();
      const idx = creditNotes.findIndex((cn) => cn.id == id);
      if (idx >= 0) {
        creditNotes[idx] = { ...creditNotes[idx], ...data, updatedAt: new Date().toISOString() };
        saveItem("sgf_creditNotes", creditNotes);
        addAuditLog("update", "creditNote", id, `Updated credit note ${creditNotes[idx].creditNoteNumber}`);
        emitDataChanged("creditNotes");
        return creditNotes[idx];
      }
      return null;
    },
    delete: (id: number) => {
      load();
      creditNotes = creditNotes.filter((cn) => cn.id !== id);
      saveItem("sgf_creditNotes", creditNotes);
      addAuditLog("delete", "creditNote", id, "Deleted credit note");
      emitDataChanged("creditNotes");
      return { success: true };
    },
    getByInvoice: (invoiceId: number) => {
      load();
      return creditNotes.filter((cn) => cn.invoiceId == invoiceId);
    },
  },

  collectionNote: {
    getAll: () => {
      load();
      return [...collectionNotes];
    },
    getById: (id: number) => {
      load();
      return collectionNotes.find((cn) => cn.id == id) || null;
    },
    create: (data: any) => {
      load();
      const newId = collectionNotes.length > 0 ? Math.max(...collectionNotes.map((cn) => Number(cn.id) || 0)) + 1 : 1;
      const newCollectionNote = {
        ...data,
        id: newId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      collectionNotes.push(newCollectionNote);
      saveItem("sgf_collectionNotes", collectionNotes);
      addAuditLog("create", "collectionNote", newId, `Created collection note`);
      emitDataChanged("collectionNotes");
      return newCollectionNote;
    },
    update: ({ id, data }: { id: number; data: any }) => {
      load();
      const idx = collectionNotes.findIndex((cn) => cn.id == id);
      if (idx >= 0) {
        collectionNotes[idx] = { ...collectionNotes[idx], ...data, updatedAt: new Date().toISOString() };
        saveItem("sgf_collectionNotes", collectionNotes);
        addAuditLog("update", "collectionNote", id, `Updated collection note`);
        emitDataChanged("collectionNotes");
        return collectionNotes[idx];
      }
      return null;
    },
    delete: (id: number) => {
      load();
      collectionNotes = collectionNotes.filter((cn) => cn.id !== id);
      saveItem("sgf_collectionNotes", collectionNotes);
      addAuditLog("delete", "collectionNote", id, "Deleted collection note");
      emitDataChanged("collectionNotes");
      return { success: true };
    },
  },

  collectionPromise: {
    getAll: () => {
      load();
      return [...collectionPromises];
    },
    getById: (id: number) => {
      load();
      return collectionPromises.find((cp) => cp.id == id) || null;
    },
    create: (data: any) => {
      load();
      const newId = collectionPromises.length > 0 ? Math.max(...collectionPromises.map((cp) => Number(cp.id) || 0)) + 1 : 1;
      const newPromise = {
        ...data,
        id: newId,
        promiseNumber: data.promiseNumber || getNextCollectionPromiseNumber(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      collectionPromises.push(newPromise);
      saveItem("sgf_collectionPromises", collectionPromises);
      addAuditLog("create", "collectionPromise", newId, `Created collection promise ${newPromise.promiseNumber}`);
      emitDataChanged("collectionPromises");
      return newPromise;
    },
    update: ({ id, data }: { id: number; data: any }) => {
      load();
      const idx = collectionPromises.findIndex((cp) => cp.id == id);
      if (idx >= 0) {
        collectionPromises[idx] = { ...collectionPromises[idx], ...data, updatedAt: new Date().toISOString() };
        saveItem("sgf_collectionPromises", collectionPromises);
        addAuditLog("update", "collectionPromise", id, `Updated collection promise ${collectionPromises[idx].promiseNumber}`);
        emitDataChanged("collectionPromises");
        return collectionPromises[idx];
      }
      return null;
    },
    delete: (id: number) => {
      load();
      collectionPromises = collectionPromises.filter((cp) => cp.id !== id);
      saveItem("sgf_collectionPromises", collectionPromises);
      addAuditLog("delete", "collectionPromise", id, "Deleted collection promise");
      emitDataChanged("collectionPromises");
      return { success: true };
    },
  },

  accountHold: {
    getAll: () => {
      load();
      return [...accountHolds];
    },
    getById: (id: number) => {
      load();
      return accountHolds.find((ah) => ah.id == id) || null;
    },
    create: (data: any) => {
      load();
      const newId = accountHolds.length > 0 ? Math.max(...accountHolds.map((ah) => Number(ah.id) || 0)) + 1 : 1;
      const newHold = {
        ...data,
        id: newId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      accountHolds.push(newHold);
      saveItem("sgf_accountHolds", accountHolds);
      addAuditLog("create", "accountHold", newId, `Created account hold for customer ${newHold.customerId}`);
      emitDataChanged("accountHolds");
      return newHold;
    },
    update: ({ id, data }: { id: number; data: any }) => {
      load();
      const idx = accountHolds.findIndex((ah) => ah.id == id);
      if (idx >= 0) {
        accountHolds[idx] = { ...accountHolds[idx], ...data, updatedAt: new Date().toISOString() };
        saveItem("sgf_accountHolds", accountHolds);
        addAuditLog("update", "accountHold", id, `Updated account hold`);
        emitDataChanged("accountHolds");
        return accountHolds[idx];
      }
      return null;
    },
    delete: (id: number) => {
      load();
      accountHolds = accountHolds.filter((ah) => ah.id !== id);
      saveItem("sgf_accountHolds", accountHolds);
      addAuditLog("delete", "accountHold", id, "Deleted account hold");
      emitDataChanged("accountHolds");
      return { success: true };
    },
  },

  auditLog: {
    getAll: () => {
      load();
      return [...auditLog];
    },
    getByEntity: (entity: string) => {
      load();
      return auditLog.filter((entry) => entry.entity === entity);
    },
  },

  followUp: {
    getAll: () => {
      load();
      return [...followUps];
    },
    getById: (id: number) => {
      load();
      return followUps.find((f) => f.id == id) || null;
    },
    create: (data: any) => {
      load();
      const newId = followUps.length > 0 ? Math.max(...followUps.map((f) => Number(f.id) || 0)) + 1 : 1;
      const newFollowUp = {
        ...data,
        id: newId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      followUps.push(newFollowUp);
      saveItem("sgf_followUps", followUps);
      addAuditLog("create", "followUp", newId, `Created follow-up for order ${newFollowUp.orderId}`);
      emitDataChanged("followUps");
      return newFollowUp;
    },
    update: ({ id, data }: { id: number; data: any }) => {
      load();
      const idx = followUps.findIndex((f) => f.id == id);
      if (idx >= 0) {
        followUps[idx] = { ...followUps[idx], ...data, updatedAt: new Date().toISOString() };
        saveItem("sgf_followUps", followUps);
        addAuditLog("update", "followUp", id, `Updated follow-up`);
        emitDataChanged("followUps");
        return followUps[idx];
      }
      return null;
    },
    delete: (id: number) => {
      load();
      followUps = followUps.filter((f) => f.id !== id);
      saveItem("sgf_followUps", followUps);
      addAuditLog("delete", "followUp", id, "Deleted follow-up");
      emitDataChanged("followUps");
      return { success: true };
    },
    getByOrder: (orderId: number) => {
      load();
      return followUps.filter((f) => f.orderId == orderId);
    },
  },

  followUpAction: {
    getAll: () => {
      load();
      return [...followUpActions];
    },
    getById: (id: number) => {
      load();
      return followUpActions.find((fa) => fa.id == id) || null;
    },
    create: (data: any) => {
      load();
      const newId = followUpActions.length > 0 ? Math.max(...followUpActions.map((fa) => Number(fa.id) || 0)) + 1 : 1;
      const newAction = {
        ...data,
        id: newId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      followUpActions.push(newAction);
      saveItem("sgf_followUpActions", followUpActions);
      addAuditLog("create", "followUpAction", newId, `Created follow-up action`);
      emitDataChanged("followUpActions");
      return newAction;
    },
    update: ({ id, data }: { id: number; data: any }) => {
      load();
      const idx = followUpActions.findIndex((fa) => fa.id == id);
      if (idx >= 0) {
        followUpActions[idx] = { ...followUpActions[idx], ...data, updatedAt: new Date().toISOString() };
        saveItem("sgf_followUpActions", followUpActions);
        addAuditLog("update", "followUpAction", id, `Updated follow-up action`);
        emitDataChanged("followUpActions");
        return followUpActions[idx];
      }
      return null;
    },
    delete: (id: number) => {
      load();
      followUpActions = followUpActions.filter((fa) => fa.id !== id);
      saveItem("sgf_followUpActions", followUpActions);
      addAuditLog("delete", "followUpAction", id, "Deleted follow-up action");
      emitDataChanged("followUpActions");
      return { success: true };
    },
    getByFollowUp: (followUpId: number) => {
      load();
      return followUpActions.filter((fa) => fa.followUpId == followUpId);
    },
  },

  // ─── CORPORATE MODULE ───
  corporateCustomer: {
    getAll: () => {
      load();
      return [...corporateCustomers];
    },
    getById: (id: number) => {
      load();
      return corporateCustomers.find((c) => c.id == id) || null;
    },
    create: (data: any) => {
      load();
      const newId = corporateCustomers.length > 0 ? Math.max(...corporateCustomers.map((c) => Number(c.id) || 0)) + 1 : 1;
      const newCustomer = {
        ...data,
        id: newId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      corporateCustomers.push(newCustomer);
      saveItem("sgf_corporateCustomers", corporateCustomers);
      addAuditLog("create", "corporateCustomer", newId, `Created corporate customer ${newCustomer.name}`);
      emitDataChanged("corporateCustomers");
      return newCustomer;
    },
    update: ({ id, data }: { id: number; data: any }) => {
      load();
      const idx = corporateCustomers.findIndex((c) => c.id == id);
      if (idx >= 0) {
        corporateCustomers[idx] = { ...corporateCustomers[idx], ...data, updatedAt: new Date().toISOString() };
        saveItem("sgf_corporateCustomers", corporateCustomers);
        addAuditLog("update", "corporateCustomer", id, `Updated corporate customer ${corporateCustomers[idx].name}`);
        emitDataChanged("corporateCustomers");
        return corporateCustomers[idx];
      }
      return null;
    },
    delete: (id: number) => {
      load();
      corporateCustomers = corporateCustomers.filter((c) => c.id !== id);
      saveItem("sgf_corporateCustomers", corporateCustomers);
      addAuditLog("delete", "corporateCustomer", id, "Deleted corporate customer");
      emitDataChanged("corporateCustomers");
      return { success: true };
    },
  },

  purchaseOrder: {
    getAll: () => {
      load();
      return [...purchaseOrders];
    },
    getById: (id: number) => {
      load();
      return purchaseOrders.find((po) => po.id == id) || null;
    },
    getByCorporateCustomer: (corporateCustomerId: number) => {
      load();
      return purchaseOrders.filter((po) => po.corporateCustomerId == corporateCustomerId);
    },
    create: (data: any) => {
      load();
      const newId = purchaseOrders.length > 0 ? Math.max(...purchaseOrders.map((po) => Number(po.id) || 0)) + 1 : 1;
      const newPO = {
        ...data,
        id: newId,
        poNumber: data.poNumber || getNextPurchaseOrderNumber(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      purchaseOrders.push(newPO);
      saveItem("sgf_purchaseOrders", purchaseOrders);
      addAuditLog("create", "purchaseOrder", newId, `Created purchase order ${newPO.poNumber}`);
      emitDataChanged("purchaseOrders");
      return newPO;
    },
    update: ({ id, data }: { id: number; data: any }) => {
      load();
      const idx = purchaseOrders.findIndex((po) => po.id == id);
      if (idx >= 0) {
        purchaseOrders[idx] = { ...purchaseOrders[idx], ...data, updatedAt: new Date().toISOString() };
        saveItem("sgf_purchaseOrders", purchaseOrders);
        addAuditLog("update", "purchaseOrder", id, `Updated purchase order ${purchaseOrders[idx].poNumber}`);
        emitDataChanged("purchaseOrders");
        return purchaseOrders[idx];
      }
      return null;
    },
    delete: (id: number) => {
      load();
      purchaseOrders = purchaseOrders.filter((po) => po.id !== id);
      saveItem("sgf_purchaseOrders", purchaseOrders);
      addAuditLog("delete", "purchaseOrder", id, "Deleted purchase order");
      emitDataChanged("purchaseOrders");
      return { success: true };
    },
  },

  barrel: {
    getAll: () => {
      load();
      return [...barrels];
    },
    getById: (id: number) => {
      load();
      return barrels.find((b) => b.id == id) || null;
    },
    create: (data: any) => {
      load();
      const newId = barrels.length > 0 ? Math.max(...barrels.map((b) => Number(b.id) || 0)) + 1 : 1;
      const newBarrel = {
        ...data,
        id: newId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      barrels.push(newBarrel);
      saveItem("sgf_barrels", barrels);
      addAuditLog("create", "barrel", newId, `Created barrel ${newBarrel.barrelNumber}`);
      emitDataChanged("barrels");
      return newBarrel;
    },
    update: ({ id, data }: { id: number; data: any }) => {
      load();
      const idx = barrels.findIndex((b) => b.id == id);
      if (idx >= 0) {
        barrels[idx] = { ...barrels[idx], ...data, updatedAt: new Date().toISOString() };
        saveItem("sgf_barrels", barrels);
        addAuditLog("update", "barrel", id, `Updated barrel ${barrels[idx].barrelNumber}`);
        emitDataChanged("barrels");
        return barrels[idx];
      }
      return null;
    },
    delete: (id: number) => {
      load();
      barrels = barrels.filter((b) => b.id !== id);
      saveItem("sgf_barrels", barrels);
      addAuditLog("delete", "barrel", id, "Deleted barrel");
      emitDataChanged("barrels");
      return { success: true };
    },
  },

  certificateOfCompliance: {
    getAll: () => {
      load();
      return [...certificatesOfCompliance];
    },
    getById: (id: number) => {
      load();
      return certificatesOfCompliance.find((c) => c.id == id) || null;
    },
    create: (data: any) => {
      load();
      const newId = certificatesOfCompliance.length > 0 ? Math.max(...certificatesOfCompliance.map((c) => Number(c.id) || 0)) + 1 : 1;
      const newCert = {
        ...data,
        id: newId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      certificatesOfCompliance.push(newCert);
      saveItem("sgf_certificatesOfCompliance", certificatesOfCompliance);
      addAuditLog("create", "certificateOfCompliance", newId, `Created certificate of compliance`);
      emitDataChanged("certificatesOfCompliance");
      return newCert;
    },
    update: ({ id, data }: { id: number; data: any }) => {
      load();
      const idx = certificatesOfCompliance.findIndex((c) => c.id == id);
      if (idx >= 0) {
        certificatesOfCompliance[idx] = { ...certificatesOfCompliance[idx], ...data, updatedAt: new Date().toISOString() };
        saveItem("sgf_certificatesOfCompliance", certificatesOfCompliance);
        addAuditLog("update", "certificateOfCompliance", id, `Updated certificate of compliance`);
        emitDataChanged("certificatesOfCompliance");
        return certificatesOfCompliance[idx];
      }
      return null;
    },
    delete: (id: number) => {
      load();
      certificatesOfCompliance = certificatesOfCompliance.filter((c) => c.id !== id);
      saveItem("sgf_certificatesOfCompliance", certificatesOfCompliance);
      addAuditLog("delete", "certificateOfCompliance", id, "Deleted certificate of compliance");
      emitDataChanged("certificatesOfCompliance");
      return { success: true };
    },
  },

  packingListLine: {
    getAll: () => {
      load();
      return [...packingListLines];
    },
    getByPurchaseOrder: (poId: number) => {
      load();
      return packingListLines.filter((pl) => pl.purchaseOrderId === poId);
    },
    getById: (id: number) => {
      load();
      return packingListLines.find((pl) => pl.id == id) || null;
    },
    create: (data: any) => {
      const newItem = {
        ...data,
        id: Date.now(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      packingListLines.push(newItem);
      saveItem("sgf_packingListLines", packingListLines);
      return newItem;
    },
    update: ({ id, data }: { id: number; data: any }) => {
      const idx = packingListLines.findIndex((pl) => pl.id == id);
      if (idx >= 0) {
        packingListLines[idx] = { ...packingListLines[idx], ...data, updatedAt: new Date().toISOString() };
        saveItem("sgf_packingListLines", packingListLines);
        return packingListLines[idx];
      }
      return null;
    },
    delete: (id: number) => {
      packingListLines = packingListLines.filter((pl) => pl.id !== id);
      saveItem("sgf_packingListLines", packingListLines);
      return { success: true };
    },
  },

  /** Generate an invoice from a Purchase Order (corporate customer).
   *  Exposed on dataService so localLink can call it via dataService.generateInvoiceForPO */
  generateInvoiceForPO: (poId: number) => {
    // ACQUIRE LOCK: prevent concurrent generation
    if (invoiceGenerationLock) {
      console.warn("[generateInvoiceForPO] LOCKED — another invoice is being generated.");
      return null;
    }
    invoiceGenerationLock = true;

    try {
      load(); // ensure fresh data
      const po = purchaseOrders.find((p) => p.id == poId);
      if (!po) return null;

      // Calculate totals from PO line items
      const items = po.lineItems || [];
      const subtotal = items.reduce((sum: number, item: any) => sum + (item.quantity * item.unitPrice || 0), 0);
      // Check if corporate customer is VAT exempt
      const corpCustomer = corporateCustomers.find((c) => c.id == po.corporateCustomerId);
      const vatRate = corpCustomer?.vatExempt ? 0 : 0.15;
      const vatAmount = subtotal * vatRate;
      const total = subtotal + vatAmount;

      // Resolve the main customer ID from the linked corporate customer
      const mainCustomerId = corpCustomer?.linkedCustomerId || po.corporateCustomerId;
      const mainCustomer = customers.find((c) => c.id == mainCustomerId);

      // Build a rich customer object — prefer linked main customer, fallback to corp customer fields
      const richCustomer = mainCustomer || {
        name: po.corporateCustomerName || corpCustomer?.name || "Corporate Customer",
        contactPerson: corpCustomer?.contactPerson || "",
        phone: corpCustomer?.phone || "",
        email: corpCustomer?.email || "",
        physicalAddress: corpCustomer?.deliveryAddress || corpCustomer?.physicalAddress || "",
        city: corpCustomer?.city || "",
        province: corpCustomer?.province || "",
        postalCode: corpCustomer?.postalCode || "",
        vatNumber: corpCustomer?.vatNumber || "",
        salesRepName: corpCustomer?.salesRepName || "",
      };

      // Check if invoice already exists for this PO
      const existingIdx = invoices.findIndex((i) => i.purchaseOrderId == poId);

      // Get corporate customer for payment terms
      const paymentTerms = corpCustomer?.paymentTerms || po.paymentTerms || "30_days";
      const days = paymentTerms === "30_days" ? 30 : paymentTerms === "14_days" ? 14 : paymentTerms === "7_days" ? 7 : 0;

      // FIX TDZ: poRef must be declared BEFORE it's used in the existingIdx branch
      const poRef = po.poNumber || `PO-${po.id}`;

      if (existingIdx >= 0) {
        const existing = invoices[existingIdx];
        const amountPaid = Number(existing.amountPaid || 0);
        const newBalanceDue = total - amountPaid;
        invoices[existingIdx] = {
          ...existing,
          subtotal,
          vatAmount,
          vatRate,
          total,
          totalAmount: total,
          balanceDue: newBalanceDue,
          paymentTerms,
          customerId: mainCustomerId,
          customer: richCustomer,
          deliveryNoteNumber: existing.deliveryNoteNumber || `DN-${poRef}`,
          items: items.map((item: any) => ({
            description: `${item.customerStockCode || ""} - ${item.customerDescription || ""}`,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            lineTotal: item.quantity * item.unitPrice,
          })),
          updatedAt: new Date().toISOString(),
          notes: `Invoice for PO ${po.poNumber} | Customer: ${po.corporateCustomerName || ""}`,
        };
        saveItem("sgf_invoices", invoices);
        return existing.invoiceNumber;
      }

      // Create new invoice
      const now = new Date();
      const dueDate = new Date(now);
      dueDate.setDate(dueDate.getDate() + days);

      const invCompany = po.company || "sgf";
      let invoiceNumber = getNextInvoiceNumberForCompany(invCompany);
      const existingNumbers = new Set(invoices.map((i) => i.invoiceNumber));
      let safetyCounter = 0;
      while (existingNumbers.has(invoiceNumber) && safetyCounter < 100) {
        const match = invoiceNumber.match(/(SGF|RC)(\d+)/);
        if (match) {
          const prefix = match[1];
          const n = parseInt(match[2]) + 1;
          invoiceNumber = prefix === "RC" ? `RC${String(n).padStart(4, "0")}` : `SGF${n}`;
        }
        safetyCounter++;
      }

      const nextInvId = invoices.length > 0 ? Math.max(...invoices.map((i) => Number(i.id) || 0)) + 1 : 1;

      invoices.push({
        id: nextInvId,
        purchaseOrderId: po.id,
        poNumber: po.poNumber,
        orderNumber: poRef,
        invoiceNumber,
        deliveryNoteNumber: `DN-${poRef}`,
        company: invCompany,
        customerId: mainCustomerId,
        customerName: richCustomer?.name || po.corporateCustomerName || "",
        customer: richCustomer,
        subtotal,
        vatAmount,
        vatRate,
        total,
        totalAmount: total,
        balanceDue: total,
        amountPaid: 0,
        status: "draft",
        paymentTerms,
        invoiceDate: now.toISOString(),
        dueDate: dueDate.toISOString(),
        notes: `Invoice for PO ${po.poNumber} | Customer: ${po.corporateCustomerName || ""}`,
        items: items.map((item: any) => ({
          description: `${item.customerStockCode || ""} - ${item.customerDescription || ""}`,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          lineTotal: item.quantity * item.unitPrice,
        })),
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      });
      saveItem("sgf_invoices", invoices);
      return invoiceNumber;
    } finally {
      invoiceGenerationLock = false;
    }
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
  removeStorageItem("sgf_appointments");
  removeStorageItem("sgf_checkins");
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
export function directAuthenticate(name: string, pin: string): { id: number; name: string; email: string; role: string; pin?: string } | null {
  const DEFAULT_USERS = [
    { id: 1, name: "Collin", email: "", role: "super_admin", pin: "2580" },
    { id: 2, name: "Adeli", email: "", role: "sales_rep", pin: "1111" },
    { id: 3, name: "Inhouse", email: "", role: "sales_rep", pin: "2222" },
    { id: 4, name: "Michael", email: "", role: "sales_rep", pin: "3333" },
    { id: 5, name: "Nkosana", email: "", role: "sales_rep", pin: "4444" },
    { id: 6, name: "Tebogo Bila", email: "", role: "sales_rep", pin: "6666" },
    { id: 7, name: "Aggie", email: "", role: "admin", pin: "1018" },
    { id: 8, name: "Ronald", email: "", role: "super_admin", pin: "2581" },
    { id: 9, name: "Jolene", email: "", role: "admin", pin: "7777" },
    { id: 10, name: "David", email: "", role: "super_admin", pin: "8888" },
  ];

  const ADMIN_ALIASES = ["admin", "administrator", "superadmin"];
  const typedName = name.toLowerCase().trim();
  const typedPin = String(pin); // Normalize: Firebase may store PIN as number

  // 1. Check stored users FIRST (so User Management additions work without code changes)
  try {
    const raw = getStorageItem("sgf_users");
    if (raw) {
      const stored = JSON.parse(raw);
      // Exact name match
      const found = stored.find(
        (x: any) => x.name?.toLowerCase() === typedName && String(x.pin) === typedPin && x.isActive !== false
      );
      if (found) {
        const hardcoded = DEFAULT_USERS.find((u) => u.id == found.id || u.name.toLowerCase() === found.name?.toLowerCase());
        const resolvedPin = found.pin != null ? found.pin : hardcoded?.pin;
        return { id: found.id, name: found.name, email: found.email, role: found.role, pin: resolvedPin };
      }
      // Admin alias match — check if any stored user has this PIN and is admin
      if (ADMIN_ALIASES.includes(typedName)) {
        const adminFound = stored.find(
          (x: any) => (x.role === "admin" || x.role === "super_admin") && String(x.pin) === typedPin && x.isActive !== false
        );
        if (adminFound) {
          const hardcoded = DEFAULT_USERS.find((u) => u.id == adminFound.id || u.name.toLowerCase() === adminFound.name?.toLowerCase());
          const resolvedPin = adminFound.pin != null ? adminFound.pin : hardcoded?.pin;
          return { id: adminFound.id, name: adminFound.name, email: adminFound.email, role: adminFound.role, pin: resolvedPin };
        }
      }
    }
  } catch { /* ignore */ }

  // 2. Allow "admin" as a generic alias — match against ANY hardcoded admin/super_admin PIN
  if (ADMIN_ALIASES.includes(typedName)) {
    // First check stored users for admin alias (new PIN may have been changed)
    let storedAdminFound: any = null;
    try {
      const raw = getStorageItem("sgf_users");
      if (raw) {
        const stored = JSON.parse(raw);
        storedAdminFound = stored.find(
          (x: any) => (x.role === "admin" || x.role === "super_admin") && String(x.pin) === typedPin && x.isActive !== false
        );
      }
    } catch { /* ignore */ }
    if (storedAdminFound) {
      return { id: storedAdminFound.id, name: storedAdminFound.name, email: storedAdminFound.email, role: storedAdminFound.role, pin: storedAdminFound.pin };
    }

    // Only fall back to hardcoded if no stored admin with different PIN exists
    let storedAdminWithDifferentPin = false;
    try {
      const raw = getStorageItem("sgf_users");
      if (raw) {
        const stored = JSON.parse(raw);
        storedAdminWithDifferentPin = stored.some(
          (x: any) => (x.role === "admin" || x.role === "super_admin") && String(x.pin) !== typedPin && x.isActive !== false
        );
      }
    } catch { /* ignore */ }

    if (!storedAdminWithDifferentPin) {
      const adminMatch = DEFAULT_USERS.find(
        (u) => (u.role === "admin" || u.role === "super_admin") && String(u.pin) === typedPin
      );
      if (adminMatch) {
        return { id: adminMatch.id, name: adminMatch.name, email: adminMatch.email, role: adminMatch.role, pin: adminMatch.pin };
      }
    }
  }

  // 3. Check hardcoded defaults (fallback — survives data clears)
  // BUT only if the user does NOT exist in stored data with a different PIN.
  // This prevents old hardcoded PINs from working after a PIN change.
  let storedUserWithDifferentPin: any = null;
  try {
    const raw = getStorageItem("sgf_users");
    if (raw) {
      const stored = JSON.parse(raw);
      storedUserWithDifferentPin = stored.find(
        (x: any) => x.name?.toLowerCase() === typedName && String(x.pin) !== typedPin && x.isActive !== false
      );
    }
  } catch { /* ignore */ }

  if (!storedUserWithDifferentPin) {
    const fromDefaults = DEFAULT_USERS.find(
      (u) => u.name.toLowerCase() === typedName && String(u.pin) === typedPin
    );
    if (fromDefaults) {
      // Do NOT re-add missing default users here — if an admin deleted a user,
      // they must stay deleted. Re-adding causes "jumping back" bug.
      // Defaults are only injected on first app load when users array is empty.
      return { id: fromDefaults.id, name: fromDefaults.name, email: fromDefaults.email, role: fromDefaults.role, pin: fromDefaults.pin };
    }
  }

  return null;
}

// NOTE: load() is already called at line 143 after all module-level variables are declared.
// Do NOT call load() again here — it would overwrite in-memory data with stale localStorage.

// Repair corrupted orders on module load (fixes orders created during the reloadFromStorage bug)
try {
  dataService.order.repairOrders();
} catch (e) {
  console.error("[dataService] Order repair failed:", e);
}
