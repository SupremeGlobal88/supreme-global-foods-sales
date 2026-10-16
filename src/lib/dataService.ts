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

    // AUTO-REPAIR: Fix stale/duplicate credit allocations on invoices
    const creditRepair = repairCreditAllocations();
    if (creditRepair > 0) {
      console.log(`[CreditRepair] Startup repaired ${creditRepair} invoice(s) with stale credit allocations`);
    }

    // USERS: always load and merge with defaults
    const u = safeLoadArray("sgf_users");
    if (u) users = u;
    const DEFAULT_USERS = [
      { id: 1, name: "Collin", email: "collin@supremeglobalfoods.co.za", role: "super_admin", pin: "2580", isActive: true, createdAt: new Date().toISOString() },
      { id: 2, name: "Adeli", email: "adeli@supremeglobalfoods.co.za", role: "sales_rep", pin: "1111", isActive: true, createdAt: new Date().toISOString() },
      { id: 3, name: "Inhouse", email: "inhouse@supremeglobalfoods.co.za", role: "sales_rep", pin: "2222", isActive: true, createdAt: new Date().toISOString() },
      { id: 4, name: "Michael", email: "michael@supremeglobalfoods.co.za", role: "sales_rep", pin: "3333", isActive: true, createdAt: new Date().toISOString() },
      { id: 5, name: "Nkosana", email: "nkosana@supremeglobalfoods.co.za", role: "sales_rep", pin: "4444", isActive: true, createdAt: new Date().toISOString() },
      { id: 6, name: "Tebogo Bila", email: "tebogo@supremeglobalfoods.co.za", role: "sales_rep", pin: "6666", isActive: true, createdAt: new Date().toISOString() },
      { id: 7, name: "Aggie", email: "aggie@supremeglobalfoods.co.za", role: "admin", pin: "1018", isActive: true, createdAt: new Date().toISOString() },
      { id: 8, name: "Ronald", email: "ronald@supremeglobalfoods.co.za", role: "super_admin", pin: "2581", isActive: true, createdAt: new Date().toISOString() },
      { id: 9, name: "Jolene", email: "jolene@supremeglobalfoods.co.za", role: "admin", pin: "7777", isActive: true, createdAt: new Date().toISOString() },
      { id: 10, name: "David", email: "david@supremeglobalfoods.co.za", role: "super_admin", pin: "8888", isActive: true, createdAt: new Date().toISOString() },
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
  } catch { /* ignore */ }
}

function saveItem(key: string, data: any) {
  try {
    setStorageItem(key, JSON.stringify(data));
  } catch (e) {
    console.error("[saveItem] FAILED:", key, e);
  }
}

// ─── HELPERS ─────────────────────────────────────────────────

function generateId(arr: any[]): number {
  if (!arr || arr.length === 0) return 1;
  return Math.max(...arr.map((x) => Number(x.id) || 0)) + 1;
}

function getNextOrderNumber(): string {
  const prefix = "SGF";
  const nums = orders
    .map((o) => {
      const m = String(o.orderNumber || "").match(/SGF(\d+)/);
      return m ? parseInt(m[1]) : 0;
    })
    .filter((n) => n > 0);
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 2501;
  return `${prefix}${next}`;
}

function getNextQuoteNumber(): string {
  const prefix = "QTE-";
  const nums = orders
    .map((o) => {
      const m = String(o.orderNumber || "").match(/QTE-(\d+)/);
      return m ? parseInt(m[1]) : 0;
    })
    .filter((n) => n > 0);
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1001;
  return `${prefix}${next}`;
}

function getNextInvoiceNumber(): string {
  const nums = invoices
    .map((i) => {
      const m = String(i.invoiceNumber || "").match(/SGF(\d+)/);
      return m ? parseInt(m[1]) : 0;
    })
    .filter((n) => n > 0);
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 2501;
  return `SGF${next}`;
}

function getNextReceiptNumber(): string {
  const nums = receipts
    .map((r) => {
      const m = String(r.receiptNumber || "").match(/RC(\d+)/);
      return m ? parseInt(m[1]) : 0;
    })
    .filter((n) => n > 0);
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1001;
  return `RC${String(next).padStart(4, "0")}`;
}

function getNextCreditNoteNumber(): string {
  const nums = creditNotes
    .map((cn) => {
      const m = String(cn.creditNoteNumber || "").match(/CN(\d+)/);
      return m ? parseInt(m[1]) : 0;
    })
    .filter((n) => n > 0);
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1001;
  return `CN${String(next).padStart(4, "0")}`;
}

function getNextInvoiceNumberForCompany(company: string): string {
  const prefix = company === "rc" ? "RC" : "SGF";
  const nums = invoices
    .filter((i) => (i.company || "sgf") === company)
    .map((i) => {
      const m = String(i.invoiceNumber || "").match(new RegExp(`${prefix}(\\d+)`));
      return m ? parseInt(m[1]) : 0;
    })
    .filter((n) => n > 0);
  const next = nums.length > 0 ? Math.max(...nums) + 1 : company === "rc" ? 1001 : 2501;
  return `${prefix}${next}`;
}

function getNextDeliveryNoteNumber(): string {
  const nums = orders
    .map((o) => {
      const m = String(o.deliveryNoteNumber || "").match(/DN-(\d+)/);
      return m ? parseInt(m[1]) : 0;
    })
    .filter((n) => n > 0);
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1001;
  return `DN-${next}`;
}

function getNextPONumber(): string {
  const nums = purchaseOrders
    .map((po) => {
      const m = String(po.poNumber || "").match(/PO-(\d+)/);
      return m ? parseInt(m[1]) : 0;
    })
    .filter((n) => n > 0);
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1001;
  return `PO-${next}`;
}

function deduplicateData<T extends { id?: number | string }>(arr: T[]): T[] {
  const seen = new Set<string | number>();
  return arr.filter((item) => {
    if (item.id == null) return true; // keep items without id
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function deduplicateAll() {
  orders = deduplicateData(orders);
  invoices = deduplicateData(invoices);
  receipts = deduplicateData(receipts);
  creditNotes = deduplicateData(creditNotes);
  appointments = deduplicateData(appointments);
  checkins = deduplicateData(checkins);
  followUps = deduplicateData(followUps);
  followUpActions = deduplicateData(followUpActions);
  specialPrices = deduplicateData(specialPrices);
  collectionNotes = deduplicateData(collectionNotes);
  collectionPromises = deduplicateData(collectionPromises);
  accountHolds = deduplicateData(accountHolds);
  auditLog = deduplicateData(auditLog);
}

/** Remove duplicate receipts for the same invoice — keep the most recent. */
function deduplicateReceiptsForInvoice(invoiceId: number): void {
  const invoiceReceipts = receipts.filter((r) => r.invoiceId == invoiceId);
  if (invoiceReceipts.length <= 1) return;

  // Sort by date descending (most recent first)
  invoiceReceipts.sort((a, b) =>
    new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  );

  const keep = invoiceReceipts[0];
  const toRemove = invoiceReceipts.slice(1);

  for (const dup of toRemove) {
    const idx = receipts.findIndex((r) => r.id === dup.id);
    if (idx >= 0) receipts.splice(idx, 1);
  }

  console.log(`[DedupReceipts] Invoice ${invoiceId}: kept ${keep.receiptNumber}, removed ${toRemove.length} duplicate(s)`);
  saveItem("sgf_receipts", receipts);
}

/** Repair stale/duplicate credit allocations on invoices.
 *  Reconstructs missing creditAllocations from credit note data and fixes balanceDue.
 *  Called at startup and on data reload. */
function repairCreditAllocations(): number {
  let fixed = 0;
  if (!invoices || invoices.length === 0) return 0;

  for (let i = 0; i < invoices.length; i++) {
    const inv = invoices[i];
    const existingCredits = inv.creditAllocations || [];

    // Reconstruct expected creditAllocations from credit note data
    const expectedCredits: any[] = [];
    for (const cn of creditNotes) {
      for (const alloc of (cn.allocations || [])) {
        if (alloc.invoiceId == inv.id) {
          expectedCredits.push({
            creditNoteId: cn.id,
            amount: alloc.amount,
            allocatedAt: alloc.allocatedAt,
          });
        }
      }
    }

    // Clean up existing: remove voided credits and deduplicate
    const validExisting = existingCredits.filter((ca: any) => {
      const cn = creditNotes.find((c) => c.id == ca.creditNoteId);
      return cn && !cn.voided;
    });
    const seen = new Set();
    const dedupedExisting = validExisting.filter((ca: any) => {
      if (seen.has(ca.creditNoteId)) return false;
      seen.add(ca.creditNoteId);
      return true;
    });

    // Check if invoice needs fixing
    const needsFix =
      dedupedExisting.length !== expectedCredits.length ||
      !expectedCredits.every((ec: any) =>
        dedupedExisting.some(
          (ic: any) =>
            ic.creditNoteId == ec.creditNoteId &&
            Math.abs((ic.amount || 0) - (ec.amount || 0)) < 0.01
        )
      );

    if (needsFix) {
      const totalAlloc = expectedCredits.reduce((sum: number, ca: any) => sum + (ca.amount || 0), 0);
      const invTotal = typeof inv.total === "number" ? inv.total : (inv.totalAmount || 0);
      const amountPaid = typeof inv.amountPaid === "number" ? inv.amountPaid : 0;
      let newBalance = invTotal - amountPaid - totalAlloc;
      newBalance = Math.round(newBalance * 100) / 100;

      invoices[i] = {
        ...inv,
        balanceDue: newBalance,
        creditAllocations: expectedCredits,
        status: newBalance <= 0.01
          ? "paid"
          : amountPaid > 0.01
            ? "partially_paid"
            : inv.status === "paid"
              ? "sent"
              : inv.status,
        updatedAt: new Date().toISOString(),
      };
      fixed++;
    }
  }

  if (fixed > 0) saveItem("sgf_invoices", invoices);
  return fixed;
}

/** Reload data arrays from localStorage.
 *  Call this after any external write to localStorage (e.g. Firebase sync)
 *  so the in-memory arrays stay in sync with storage. */
export function reloadFromStorage(keys?: string[]) {
  try {
    function safeLoad(key: string): any[] | null {
      try {
        const raw = getStorageItem(key);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : null;
      } catch { return null; }
    }

    const keysToReload = keys || [
      "sgf_customers", "sgf_products", "sgf_orders", "sgf_invoices",
      "sgf_appointments", "sgf_checkins", "sgf_specialPrices", "sgf_auditLog",
      "sgf_followUps", "sgf_followUpActions", "sgf_collectionNotes",
      "sgf_collectionPromises", "sgf_accountHolds", "sgf_receipts",
      "sgf_creditNotes", "sgf_users", "sgf_salesReps",
      "sgf_corporateCustomers", "sgf_purchaseOrders", "sgf_barrels",
      "sgf_certificatesOfCompliance", "sgf_packingListLines",
    ];

    for (const key of keysToReload) {
      const data = safeLoad(key);
      if (data == null) continue;
      switch (key) {
        case "sgf_customers": customers = data; break;
        case "sgf_products": {
          products = data;
          // PRICE REPAIR: If reloaded products have 0 prices, restore from STATIC_PRODUCTS seed
          const priceRepair = repairProductPrices(products);
          if (priceRepair.count > 0) {
            saveItem("sgf_products", products);
            console.log(`[PriceRepair] Reload restored prices for ${priceRepair.count} products from seed data`);
            if (typeof window !== "undefined") {
              window.dispatchEvent(new CustomEvent("sgf:productsRepaired", { detail: { products: priceRepair.repaired, count: priceRepair.count } }));
            }
          }
          break;
        }
        case "sgf_orders": orders = data; break;
        case "sgf_invoices": invoices = data; break;
        case "sgf_appointments": appointments = data; break;
        case "sgf_checkins": checkins = data; break;
        case "sgf_specialPrices": specialPrices = data; break;
        case "sgf_auditLog": auditLog = data; break;
        case "sgf_followUps": followUps = data; break;
        case "sgf_followUpActions": followUpActions = data; break;
        case "sgf_collectionNotes": collectionNotes = data; break;
        case "sgf_collectionPromises": collectionPromises = data; break;
        case "sgf_accountHolds": accountHolds = data; break;
        case "sgf_receipts": receipts = data; break;
        case "sgf_creditNotes": creditNotes = data; break;
        case "sgf_users": users = data; break;
        case "sgf_salesReps": {
          SALES_REPS = data.map((r: any): SalesRep => {
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
          break;
        }
        case "sgf_corporateCustomers": corporateCustomers = data; break;
        case "sgf_purchaseOrders": purchaseOrders = data; break;
        case "sgf_barrels": barrels = data; break;
        case "sgf_certificatesOfCompliance": certificatesOfCompliance = data; break;
        case "sgf_packingListLines": packingListLines = data; break;
      }
    }

    // AUTO-REPAIR: Fix stale/duplicate credit allocations after reload
    const creditRepair = repairCreditAllocations();
    if (creditRepair > 0) {
      console.log(`[CreditRepair] Reload repaired ${creditRepair} invoice(s) with stale credit allocations`);
    }

    deduplicateAll();
  } catch (e) {
    console.error("[reloadFromStorage] FAILED:", e);
  }
}

// ═══════════════════════════════════════════════════════════════
//  DATA SERVICE — exported API
// ═══════════════════════════════════════════════════════════════

export const dataService = {
  // ─── SETTINGS ──────────────────────────────────────────────
  settings: {
    get: () => {
      try {
        const raw = getStorageItem("sgf_settings");
        return raw ? JSON.parse(raw) : {};
      } catch { return {}; }
    },
    save: (data: any) => saveItem("sgf_settings", data),
  },

  // ─── USERS ─────────────────────────────────────────────────
  user: {
    getAll: () => [...users],
    getById: (id: number) => users.find((u) => u.id == id) || null,
    create: (data: any) => {
      const newUser = { id: generateId(users), ...data, createdAt: new Date().toISOString() };
      users.push(newUser);
      saveItem("sgf_users", users);
      return newUser;
    },
    update: (id: number, data: any) => {
      const idx = users.findIndex((u) => u.id == id);
      if (idx >= 0) {
        users[idx] = { ...users[idx], ...data, updatedAt: new Date().toISOString() };
        saveItem("sgf_users", users);
        return users[idx];
      }
      return null;
    },
    delete: (id: number) => {
      users = users.filter((u) => u.id !== id);
      saveItem("sgf_users", users);
      return { success: true };
    },
  },

  // ─── CUSTOMERS ─────────────────────────────────────────────
  customer: {
    getAll: () => [...customers],
    getById: (id: number) => customers.find((c) => c.id == id) || null,
    create: (data: any) => {
      const newCustomer = {
        id: generateId(customers),
        ...data,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      customers.push(newCustomer);
      saveItem("sgf_customers", customers);
      return newCustomer;
    },
    update: (id: number, data: any) => {
      const idx = customers.findIndex((c) => c.id == id);
      if (idx >= 0) {
        customers[idx] = { ...customers[idx], ...data, updatedAt: new Date().toISOString() };
        saveItem("sgf_customers", customers);
        return customers[idx];
      }
      return null;
    },
    delete: (id: number) => {
      customers = customers.filter((c) => c.id !== id);
      saveItem("sgf_customers", customers);
      return { success: true };
    },
  },

  // ─── PRODUCTS / STOCK ──────────────────────────────────────
  product: {
    getAll: () => [...products],
    getById: (id: number) => products.find((p) => p.id == id) || null,
    create: (data: any) => {
      const newProduct = { id: generateId(products), ...data, createdAt: new Date().toISOString() };
      products.push(newProduct);
      saveItem("sgf_products", products);
      return newProduct;
    },
    update: (id: number, data: any) => {
      const idx = products.findIndex((p) => p.id == id);
      if (idx >= 0) {
        products[idx] = { ...products[idx], ...data, updatedAt: new Date().toISOString() };
        saveItem("sgf_products", products);
        return products[idx];
      }
      return null;
    },
    delete: (id: number) => {
      products = products.filter((p) => p.id !== id);
      saveItem("sgf_products", products);
      return { success: true };
    },
  },

  // ─── ORDERS ────────────────────────────────────────────────
  order: {
    getAll: () => [...orders],
    getById: (id: number) => orders.find((o) => o.id == id) || null,
    create: (data: any) => {
      load();
      const newOrder = {
        id: generateId(orders),
        orderNumber: getNextOrderNumber(),
        ...data,
        status: data.status || "draft",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      orders.push(newOrder);
      saveItem("sgf_orders", orders);
      return newOrder;
    },
    update: (id: number, data: any) => {
      load();
      const idx = orders.findIndex((o) => o.id == id);
      if (idx >= 0) {
        orders[idx] = { ...orders[idx], ...data, updatedAt: new Date().toISOString() };
        saveItem("sgf_orders", orders);
        return orders[idx];
      }
      return null;
    },
    delete: (id: number) => {
      load();
      orders = orders.filter((o) => o.id !== id);
      saveItem("sgf_orders", orders);
      return { success: true };
    },
    updateStatus: (id: number, status: string) => {
      load();
      const idx = orders.findIndex((o) => o.id == id);
      if (idx >= 0) {
        orders[idx] = { ...orders[idx], status, updatedAt: new Date().toISOString() };
        saveItem("sgf_orders", orders);
        return orders[idx];
      }
      return null;
    },
    getNextOrderNumber,
    getNextQuoteNumber,
    getNextDeliveryNoteNumber,

    // ─── BULK OPERATIONS ─────────────────────────────────────
    importOrders: (items: any[]) => {
      load();
      let added = 0;
      for (const item of items) {
        if (!item.orderNumber) continue;
        const exists = orders.find((o) => o.orderNumber === item.orderNumber);
        if (!exists) {
          orders.push({
            id: generateId(orders),
            ...item,
            createdAt: item.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          added++;
        }
      }
      if (added > 0) saveItem("sgf_orders", orders);
      return { added, total: orders.length };
    },

    // ─── REPAIR: Fix corrupted orders ────────────────────────
    repairOrders: () => {
      load();
      let repaired = 0;
      for (const order of orders) {
        // Fix 1: Ensure items array exists
        if (!order.items) {
          order.items = [];
          repaired++;
        }
        // Fix 2: Ensure totals are numbers
        if (typeof order.subtotal !== "number") {
          order.subtotal = (order.items || []).reduce((sum: number, item: any) => sum + (item.lineTotal || 0), 0);
          repaired++;
        }
        if (typeof order.total !== "number") {
          order.total = order.subtotal + (order.vatAmount || 0);
          repaired++;
        }
        // Fix 3: Ensure status is valid
        const validStatuses = ["draft", "confirmed", "ready", "delivered", "cancelled", "converted"];
        if (!validStatuses.includes(order.status)) {
          order.status = "draft";
          repaired++;
        }
      }
      if (repaired > 0) saveItem("sgf_orders", orders);
      return { repaired, total: orders.length };
    },
  },

  // ─── INVOICES ──────────────────────────────────────────────
  invoice: {
    getAll: () => [...invoices],
    getById: (id: number) => invoices.find((i) => i.id == id) || null,
    getByNumber: (num: string) => invoices.find((i) => i.invoiceNumber === num) || null,
    create: (data: any) => {
      load();
      const newInvoice = {
        id: generateId(invoices),
        invoiceNumber: getNextInvoiceNumber(),
        ...data,
        status: data.status || "draft",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      invoices.push(newInvoice);
      saveItem("sgf_invoices", invoices);
      return newInvoice;
    },
    update: (id: number, data: any) => {
      load();
      const idx = invoices.findIndex((i) => i.id == id);
      if (idx >= 0) {
        invoices[idx] = { ...invoices[idx], ...data, updatedAt: new Date().toISOString() };
        saveItem("sgf_invoices", invoices);
        return invoices[idx];
      }
      return null;
    },
    delete: (id: number) => {
      load();
      invoices = invoices.filter((i) => i.id !== id);
      saveItem("sgf_invoices", invoices);
      return { success: true };
    },
    getNextInvoiceNumber,
    getNextInvoiceNumberForCompany,

    // ─── IMPORT INVOICES (bulk) ──────────────────────────────
    importInvoices: (items: any[]) => {
      load();
      let added = 0;
      for (const item of items) {
        if (!item.invoiceNumber) continue;
        const exists = invoices.find((i) => i.invoiceNumber === item.invoiceNumber);
        if (!exists) {
          invoices.push({
            id: generateId(invoices),
            ...item,
            createdAt: item.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          added++;
        }
      }
      if (added > 0) saveItem("sgf_invoices", invoices);
      return { added, total: invoices.length };
    },

    // ─── RECORD PAYMENT ──────────────────────────────────────
    recordPayment: (invoiceId: number, amount: number, method: string, notes?: string, reference?: string) => {
      load();
      const inv = invoices.find((i) => i.id == invoiceId);
      if (!inv) return { success: false, error: "Invoice not found" };

      const receipt = {
        id: generateId(receipts),
        invoiceId,
        receiptNumber: getNextReceiptNumber(),
        amount,
        method,
        notes: notes || "",
        reference: reference || "",
        createdAt: new Date().toISOString(),
      };
      receipts.push(receipt);
      saveItem("sgf_receipts", receipts);

      const total = typeof inv.total === "number" ? inv.total : (inv.totalAmount || 0);
      const totalPaid = (inv.amountPaid || 0) + amount;
      const newPaid = Math.min(totalPaid, total);

      inv.amountPaid = newPaid;
      const creditsApplied = (inv.creditAllocations || []).reduce((sum: number, a: any) => sum + (a.amount || 0), 0);
      inv.balanceDue = total - newPaid - creditsApplied;
      if (inv.balanceDue <= 0.01) inv.status = "paid";
      else if (inv.amountPaid > 0.01) inv.status = "partially_paid";
      inv.updatedAt = new Date().toISOString();
      saveItem("sgf_invoices", invoices);

      return { success: true, receipt };
    },

    // ─── EDIT PAYMENT ────────────────────────────────────────
    editPayment: (receiptId: number, newAmount: number, newMethod: string, newNotes?: string, newReference?: string) => {
      load();
      const receipt = receipts.find((r) => r.id == receiptId);
      if (!receipt) return { success: false, error: "Receipt not found" };

      const oldAmount = receipt.amount;
      const invoiceId = receipt.invoiceId;
      const inv = invoices.find((i) => i.id == invoiceId);
      if (!inv) return { success: false, error: "Invoice not found" };

      receipt.amount = newAmount;
      receipt.method = newMethod;
      receipt.notes = newNotes || "";
      receipt.reference = newReference || "";
      receipt.updatedAt = new Date().toISOString();
      saveItem("sgf_receipts", receipts);

      const total = typeof inv.total === "number" ? inv.total : (inv.totalAmount || 0);
      const totalPaid = (inv.amountPaid || 0) - oldAmount + newAmount;
      inv.amountPaid = Math.max(0, totalPaid);
      const creditsApplied = (inv.creditAllocations || []).reduce((sum: number, a: any) => sum + (a.amount || 0), 0);
      inv.balanceDue = total - inv.amountPaid - creditsApplied;
      if (inv.balanceDue <= 0.01) inv.status = "paid";
      else if (inv.amountPaid > 0.01) inv.status = "partially_paid";
      inv.updatedAt = new Date().toISOString();
      saveItem("sgf_invoices", invoices);

      return { success: true, receipt };
    },

    // ─── DELETE PAYMENT ──────────────────────────────────────
    deletePayment: (receiptId: number) => {
      load();
      const receipt = receipts.find((r) => r.id == receiptId);
      if (!receipt) return { success: false, error: "Receipt not found" };

      const invoiceId = receipt.invoiceId;
      const inv = invoices.find((i) => i.id == invoiceId);
      if (!inv) return { success: false, error: "Invoice not found" };

      const amount = receipt.amount;
      receipts = receipts.filter((r) => r.id !== receiptId);
      saveItem("sgf_receipts", receipts);

      const total = typeof inv.total === "number" ? inv.total : (inv.totalAmount || 0);
      const totalPaid = (inv.amountPaid || 0) - amount;
      inv.amountPaid = Math.max(0, totalPaid);
      const creditsApplied = (inv.creditAllocations || []).reduce((sum: number, a: any) => sum + (a.amount || 0), 0);
      inv.balanceDue = total - inv.amountPaid - creditsApplied;
      if (inv.balanceDue <= 0.01) inv.status = "paid";
      else if (inv.amountPaid > 0.01) inv.status = "partially_paid";
      else inv.status = "sent";
      inv.updatedAt = new Date().toISOString();
      saveItem("sgf_invoices", invoices);

      return { success: true };
    },

    // ─── BANK IMPORT ALLOCATION ──────────────────────────────
    allocateBankImport: (invoiceId: number, amount: number, bankReference: string) => {
      load();
      const inv = invoices.find((i) => i.id == invoiceId);
      if (!inv) return { success: false, error: "Invoice not found" };

      const receipt = {
        id: generateId(receipts),
        invoiceId,
        receiptNumber: getNextReceiptNumber(),
        amount,
        method: "bank_transfer",
        notes: `Bank import: ${bankReference}`,
        reference: bankReference,
        createdAt: new Date().toISOString(),
      };
      receipts.push(receipt);
      saveItem("sgf_receipts", receipts);

      const total = typeof inv.total === "number" ? inv.total : (inv.totalAmount || 0);
      const totalPaid = (inv.amountPaid || 0) + amount;
      const newPaid = Math.min(totalPaid, total);

      inv.amountPaid = newPaid;
      const creditsApplied = (inv.creditAllocations || []).reduce((sum: number, a: any) => sum + (a.amount || 0), 0);
      inv.balanceDue = total - newPaid - creditsApplied;
      if (inv.balanceDue <= 0.01) inv.status = "paid";
      else if (inv.amountPaid > 0.01) inv.status = "partially_paid";
      inv.updatedAt = new Date().toISOString();
      saveItem("sgf_invoices", invoices);

      return { success: true, receipt };
    },

    // ─── CREDIT NOTES ────────────────────────────────────────
    createCreditNote: (data: any) => {
      load();
      const newCN = {
        id: generateId(creditNotes),
        creditNoteNumber: getNextCreditNoteNumber(),
        ...data,
        remainingAmount: data.amount,
        allocations: [],
        refundHistory: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      creditNotes.push(newCN);
      saveItem("sgf_creditNotes", creditNotes);
      return newCN;
    },
    getCreditNotes: () => [...creditNotes],
    getCreditNoteById: (id: number) => creditNotes.find((cn) => cn.id == id) || null,
    updateCreditNote: (id: number, data: any) => {
      load();
      const idx = creditNotes.findIndex((cn) => cn.id == id);
      if (idx >= 0) {
        creditNotes[idx] = { ...creditNotes[idx], ...data, updatedAt: new Date().toISOString() };
        saveItem("sgf_creditNotes", creditNotes);
        return creditNotes[idx];
      }
      return null;
    },
    voidCreditNote: (id: number, reason: string) => {
      load();
      const idx = creditNotes.findIndex((cn) => cn.id == id);
      if (idx >= 0) {
        const cn = creditNotes[idx];
        // Reverse any allocations
        if (cn.allocations && cn.allocations.length > 0) {
          for (const alloc of cn.allocations) {
            const inv = invoices.find((i) => i.id == alloc.invoiceId);
            if (inv) {
              inv.creditAllocations = (inv.creditAllocations || []).filter((a: any) => a.creditNoteId != id);
              const total = typeof inv.total === "number" ? inv.total : (inv.totalAmount || 0);
              const amountPaid = typeof inv.amountPaid === "number" ? inv.amountPaid : 0;
              const creditsApplied = (inv.creditAllocations || []).reduce((sum: number, a: any) => sum + (a.amount || 0), 0);
              inv.balanceDue = total - amountPaid - creditsApplied;
              if (inv.balanceDue <= 0.01) inv.status = "paid";
              else if (inv.amountPaid > 0.01) inv.status = "partially_paid";
              else inv.status = "sent";
              inv.updatedAt = new Date().toISOString();
            }
          }
          saveItem("sgf_invoices", invoices);
        }
        creditNotes[idx] = {
          ...cn,
          voided: true,
          voidReason: reason,
          voidedAt: new Date().toISOString(),
          remainingAmount: 0,
          updatedAt: new Date().toISOString(),
        };
        saveItem("sgf_creditNotes", creditNotes);
        return creditNotes[idx];
      }
      return null;
    },
    allocateCredit: (invoiceId: number, creditNoteId: number, amount: number) => {
      load();
      const inv = invoices.find((i) => i.id == invoiceId);
      const cn = creditNotes.find((c) => c.id == creditNoteId);
      if (!inv) return { success: false, error: "Invoice not found" };
      if (!cn) return { success: false, error: "Credit note not found" };
      if (cn.voided) return { success: false, error: "Credit note is voided" };
      if (cn.remainingAmount < amount) return { success: false, error: "Insufficient credit remaining" };

      const alloc = {
        invoiceId,
        amount,
        allocatedAt: new Date().toISOString(),
      };
      cn.allocations = [...(cn.allocations || []), alloc];
      cn.remainingAmount = Math.round((cn.remainingAmount - amount) * 100) / 100;
      cn.updatedAt = new Date().toISOString();
      saveItem("sgf_creditNotes", creditNotes);

      inv.creditAllocations = [...(inv.creditAllocations || []), { creditNoteId, amount, allocatedAt: new Date().toISOString() }];
      const total = typeof inv.total === "number" ? inv.total : (inv.totalAmount || 0);
      const amountPaid = typeof inv.amountPaid === "number" ? inv.amountPaid : 0;
      const creditsApplied = (inv.creditAllocations || []).reduce((sum: number, a: any) => sum + (a.amount || 0), 0);
      inv.balanceDue = total - amountPaid - creditsApplied;
      if (inv.balanceDue <= 0.01) inv.status = "paid";
      else if (inv.amountPaid > 0.01) inv.status = "partially_paid";
      inv.updatedAt = new Date().toISOString();
      saveItem("sgf_invoices", invoices);

      return { success: true, creditNote: cn, invoice: inv };
    },
    removeCreditAllocation: (invoiceId: number, creditNoteId: number) => {
      load();
      const inv = invoices.find((i) => i.id == invoiceId);
      const cn = creditNotes.find((c) => c.id == creditNoteId);
      if (!inv || !cn) return { success: false, error: "Not found" };

      const alloc = cn.allocations?.find((a: any) => a.invoiceId == invoiceId);
      if (!alloc) return { success: false, error: "Allocation not found" };

      cn.allocations = cn.allocations.filter((a: any) => a.invoiceId != invoiceId);
      cn.remainingAmount = Math.round((cn.remainingAmount + alloc.amount) * 100) / 100;
      cn.updatedAt = new Date().toISOString();
      saveItem("sgf_creditNotes", creditNotes);

      inv.creditAllocations = (inv.creditAllocations || []).filter((a: any) => a.creditNoteId != creditNoteId);
      const total = typeof inv.total === "number" ? inv.total : (inv.totalAmount || 0);
      const amountPaid = typeof inv.amountPaid === "number" ? inv.amountPaid : 0;
      const creditsApplied = (inv.creditAllocations || []).reduce((sum: number, a: any) => sum + (a.amount || 0), 0);
      inv.balanceDue = total - amountPaid - creditsApplied;
      if (inv.balanceDue <= 0.01) inv.status = "paid";
      else if (inv.amountPaid > 0.01) inv.status = "partially_paid";
      else inv.status = "sent";
      inv.updatedAt = new Date().toISOString();
      saveItem("sgf_invoices", invoices);

      return { success: true };
    },
    refundCreditNote: (creditNoteId: number, amount: number, method: string, notes?: string) => {
      load();
      const cn = creditNotes.find((c) => c.id == creditNoteId);
      if (!cn) return { success: false, error: "Credit note not found" };
      if (cn.voided) return { success: false, error: "Credit note is voided" };
      if (cn.refunded) return { success: false, error: "Credit note already fully refunded" };

      const alreadyRefunded = (cn.refundHistory || []).reduce((sum: number, r: any) => sum + (r.amount || 0), 0);
      const remainingForRefund = cn.remainingAmount - alreadyRefunded;
      if (amount > remainingForRefund) return { success: false, error: `Refund amount exceeds remaining credit (${remainingForRefund})` };

      const refundEntry = {
        amount,
        method,
        notes: notes || "",
        refundedAt: new Date().toISOString(),
      };
      cn.refundHistory = [...(cn.refundHistory || []), refundEntry];
      const totalRefunded = alreadyRefunded + amount;
      if (totalRefunded >= cn.amount - 0.01) {
        cn.refunded = true;
      }
      cn.remainingAmount = Math.round((cn.amount - totalRefunded) * 100) / 100;
      cn.updatedAt = new Date().toISOString();
      saveItem("sgf_creditNotes", creditNotes);

      return { success: true, creditNote: cn };
    },
  },

  // ─── RECEIPTS ──────────────────────────────────────────────
  receipt: {
    getAll: () => [...receipts],
    getById: (id: number) => receipts.find((r) => r.id == id) || null,
    getByInvoiceId: (invoiceId: number) => receipts.filter((r) => r.invoiceId == invoiceId),
    create: (data: any) => {
      const newReceipt = { id: generateId(receipts), ...data, createdAt: new Date().toISOString() };
      receipts.push(newReceipt);
      saveItem("sgf_receipts", receipts);
      return newReceipt;
    },
    update: (id: number, data: any) => {
      const idx = receipts.findIndex((r) => r.id == id);
      if (idx >= 0) {
        receipts[idx] = { ...receipts[idx], ...data, updatedAt: new Date().toISOString() };
        saveItem("sgf_receipts", receipts);
        return receipts[idx];
      }
      return null;
    },
    delete: (id: number) => {
      receipts = receipts.filter((r) => r.id !== id);
      saveItem("sgf_receipts", receipts);
      return { success: true };
    },
  },

  // ─── SPECIAL PRICES ────────────────────────────────────────
  specialPrice: {
    getAll: () => [...specialPrices],
    getById: (id: number) => specialPrices.find((sp) => sp.id == id) || null,
    create: (data: any) => {
      const newSP = { id: generateId(specialPrices), ...data, createdAt: new Date().toISOString() };
      specialPrices.push(newSP);
      saveItem("sgf_specialPrices", specialPrices);
      return newSP;
    },
    update: (id: number, data: any) => {
      const idx = specialPrices.findIndex((sp) => sp.id == id);
      if (idx >= 0) {
        specialPrices[idx] = { ...specialPrices[idx], ...data, updatedAt: new Date().toISOString() };
        saveItem("sgf_specialPrices", specialPrices);
        return specialPrices[idx];
      }
      return null;
    },
    delete: (id: number) => {
      specialPrices = specialPrices.filter((sp) => sp.id !== id);
      saveItem("sgf_specialPrices", specialPrices);
      return { success: true };
    },
  },

  // ─── APPOINTMENTS ──────────────────────────────────────────
  appointment: {
    getAll: () => [...appointments],
    getById: (id: number) => appointments.find((a) => a.id == id) || null,
    create: (data: any) => {
      const newAppt = { id: generateId(appointments), ...data, createdAt: new Date().toISOString() };
      appointments.push(newAppt);
      saveItem("sgf_appointments", appointments);
      return newAppt;
    },
    update: (id: number, data: any) => {
      const idx = appointments.findIndex((a) => a.id == id);
      if (idx >= 0) {
        appointments[idx] = { ...appointments[idx], ...data, updatedAt: new Date().toISOString() };
        saveItem("sgf_appointments", appointments);
        return appointments[idx];
      }
      return null;
    },
    delete: (id: number) => {
      appointments = appointments.filter((a) => a.id !== id);
      saveItem("sgf_appointments", appointments);
      return { success: true };
    },
  },

  // ─── CHECK-INS ─────────────────────────────────────────────
  checkin: {
    getAll: () => [...checkins],
    getById: (id: number) => checkins.find((c) => c.id == id) || null,
    create: (data: any) => {
      const newCheckin = { id: generateId(checkins), ...data, createdAt: new Date().toISOString() };
      checkins.push(newCheckin);
      saveItem("sgf_checkins", checkins);
      return newCheckin;
    },
    update: (id: number, data: any) => {
      const idx = checkins.findIndex((c) => c.id == id);
      if (idx >= 0) {
        checkins[idx] = { ...checkins[idx], ...data, updatedAt: new Date().toISOString() };
        saveItem("sgf_checkins", checkins);
        return checkins[idx];
      }
      return null;
    },
    delete: (id: number) => {
      checkins = checkins.filter((c) => c.id !== id);
      saveItem("sgf_checkins", checkins);
      return { success: true };
    },
  },

  // ─── AUDIT LOG ─────────────────────────────────────────────
  auditLog: {
    getAll: () => [...auditLog],
    create: (data: any) => {
      const entry = { id: generateId(auditLog), ...data, createdAt: new Date().toISOString() };
      auditLog.push(entry);
      saveItem("sgf_auditLog", auditLog);
      return entry;
    },
  },

  // ─── FOLLOW-UPS ────────────────────────────────────────────
  followUp: {
    getAll: () => [...followUps],
    getById: (id: number) => followUps.find((f) => f.id == id) || null,
    create: (data: any) => {
      const newFU = { id: generateId(followUps), ...data, createdAt: new Date().toISOString() };
      followUps.push(newFU);
      saveItem("sgf_followUps", followUps);
      return newFU;
    },
    update: (id: number, data: any) => {
      const idx = followUps.findIndex((f) => f.id == id);
      if (idx >= 0) {
        followUps[idx] = { ...followUps[idx], ...data, updatedAt: new Date().toISOString() };
        saveItem("sgf_followUps", followUps);
        return followUps[idx];
      }
      return null;
    },
    delete: (id: number) => {
      followUps = followUps.filter((f) => f.id !== id);
      saveItem("sgf_followUps", followUps);
      return { success: true };
    },
  },

  // ─── FOLLOW-UP ACTIONS ─────────────────────────────────────
  followUpAction: {
    getAll: () => [...followUpActions],
    getById: (id: number) => followUpActions.find((f) => f.id == id) || null,
    create: (data: any) => {
      const newFA = { id: generateId(followUpActions), ...data, createdAt: new Date().toISOString() };
      followUpActions.push(newFA);
      saveItem("sgf_followUpActions", followUpActions);
      return newFA;
    },
    update: (id: number, data: any) => {
      const idx = followUpActions.findIndex((f) => f.id == id);
      if (idx >= 0) {
        followUpActions[idx] = { ...followUpActions[idx], ...data, updatedAt: new Date().toISOString() };
        saveItem("sgf_followUpActions", followUpActions);
        return followUpActions[idx];
      }
      return null;
    },
    delete: (id: number) => {
      followUpActions = followUpActions.filter((f) => f.id !== id);
      saveItem("sgf_followUpActions", followUpActions);
      return { success: true };
    },
  },

  // ─── COLLECTION NOTES ──────────────────────────────────────
  collectionNote: {
    getAll: () => [...collectionNotes],
    getById: (id: number) => collectionNotes.find((c) => c.id == id) || null,
    create: (data: any) => {
      const newCN = { id: generateId(collectionNotes), ...data, createdAt: new Date().toISOString() };
      collectionNotes.push(newCN);
      saveItem("sgf_collectionNotes", collectionNotes);
      return newCN;
    },
    update: (id: number, data: any) => {
      const idx = collectionNotes.findIndex((c) => c.id == id);
      if (idx >= 0) {
        collectionNotes[idx] = { ...collectionNotes[idx], ...data, updatedAt: new Date().toISOString() };
        saveItem("sgf_collectionNotes", collectionNotes);
        return collectionNotes[idx];
      }
      return null;
    },
    delete: (id: number) => {
      collectionNotes = collectionNotes.filter((c) => c.id !== id);
      saveItem("sgf_collectionNotes", collectionNotes);
      return { success: true };
    },
  },

  // ─── COLLECTION PROMISES ───────────────────────────────────
  collectionPromise: {
    getAll: () => [...collectionPromises],
    getById: (id: number) => collectionPromises.find((c) => c.id == id) || null,
    create: (data: any) => {
      const newCP = { id: generateId(collectionPromises), ...data, createdAt: new Date().toISOString() };
      collectionPromises.push(newCP);
      saveItem("sgf_collectionPromises", collectionPromises);
      return newCP;
    },
    update: (id: number, data: any) => {
      const idx = collectionPromises.findIndex((c) => c.id == id);
      if (idx >= 0) {
        collectionPromises[idx] = { ...collectionPromises[idx], ...data, updatedAt: new Date().toISOString() };
        saveItem("sgf_collectionPromises", collectionPromises);
        return collectionPromises[idx];
      }
      return null;
    },
    delete: (id: number) => {
      collectionPromises = collectionPromises.filter((c) => c.id !== id);
      saveItem("sgf_collectionPromises", collectionPromises);
      return { success: true };
    },
  },

  // ─── ACCOUNT HOLDS ─────────────────────────────────────────
  accountHold: {
    getAll: () => [...accountHolds],
    getById: (id: number) => accountHolds.find((a) => a.id == id) || null,
    create: (data: any) => {
      const newAH = { id: generateId(accountHolds), ...data, createdAt: new Date().toISOString() };
      accountHolds.push(newAH);
      saveItem("sgf_accountHolds", accountHolds);
      return newAH;
    },
    update: (id: number, data: any) => {
      const idx = accountHolds.findIndex((a) => a.id == id);
      if (idx >= 0) {
        accountHolds[idx] = { ...accountHolds[idx], ...data, updatedAt: new Date().toISOString() };
        saveItem("sgf_accountHolds", accountHolds);
        return accountHolds[idx];
      }
      return null;
    },
    delete: (id: number) => {
      accountHolds = accountHolds.filter((a) => a.id !== id);
      saveItem("sgf_accountHolds", accountHolds);
      return { success: true };
    },
  },

  // ─── SALES REPS ────────────────────────────────────────────
  salesRep: {
    getAll: () => getCurrentSalesReps(),
    create: (data: any) => {
      const newRep = { ...data, isActive: data.isActive !== false };
      SALES_REPS.push(newRep);
      saveSalesReps();
      return newRep;
    },
    update: (name: string, data: any) => {
      const idx = SALES_REPS.findIndex((r) => r.name === name);
      if (idx >= 0) {
        SALES_REPS[idx] = { ...SALES_REPS[idx], ...data, isActive: data.isActive !== false };
        saveSalesReps();
        return SALES_REPS[idx];
      }
      return null;
    },
    delete: (name: string) => {
      SALES_REPS = SALES_REPS.filter((r) => r.name !== name);
      saveSalesReps();
      return { success: true };
    },
  },

  // ─── CORPORATE CUSTOMERS ───────────────────────────────────
  corporateCustomer: {
    getAll: () => [...corporateCustomers],
    getById: (id: number) => corporateCustomers.find((c) => c.id == id) || null,
    create: (data: any) => {
      const newCC = { id: generateId(corporateCustomers), ...data, createdAt: new Date().toISOString() };
      corporateCustomers.push(newCC);
      saveItem("sgf_corporateCustomers", corporateCustomers);
      return newCC;
    },
    update: (id: number, data: any) => {
      const idx = corporateCustomers.findIndex((c) => c.id == id);
      if (idx >= 0) {
        corporateCustomers[idx] = { ...corporateCustomers[idx], ...data, updatedAt: new Date().toISOString() };
        saveItem("sgf_corporateCustomers", corporateCustomers);
        return corporateCustomers[idx];
      }
      return null;
    },
    delete: (id: number) => {
      corporateCustomers = corporateCustomers.filter((c) => c.id !== id);
      saveItem("sgf_corporateCustomers", corporateCustomers);
      return { success: true };
    },
  },

  // ─── PURCHASE ORDERS ───────────────────────────────────────
  purchaseOrder: {
    getAll: () => [...purchaseOrders],
    getById: (id: number) => purchaseOrders.find((po) => po.id == id) || null,
    create: (data: any) => {
      const newPO = {
        id: generateId(purchaseOrders),
        poNumber: getNextPONumber(),
        ...data,
        status: data.status || "draft",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      purchaseOrders.push(newPO);
      saveItem("sgf_purchaseOrders", purchaseOrders);
      return newPO;
    },
    update: (id: number, data: any) => {
      const idx = purchaseOrders.findIndex((po) => po.id == id);
      if (idx >= 0) {
        purchaseOrders[idx] = { ...purchaseOrders[idx], ...data, updatedAt: new Date().toISOString() };
        saveItem("sgf_purchaseOrders", purchaseOrders);
        return purchaseOrders[idx];
      }
      return null;
    },
    delete: (id: number) => {
      purchaseOrders = purchaseOrders.filter((po) => po.id !== id);
      saveItem("sgf_purchaseOrders", purchaseOrders);
      return { success: true };
    },
  },

  // ─── BARRELS ───────────────────────────────────────────────
  barrel: {
    getAll: () => [...barrels],
    getById: (id: number) => barrels.find((b) => b.id == id) || null,
    create: (data: any) => {
      const newBarrel = { id: generateId(barrels), ...data, createdAt: new Date().toISOString() };
      barrels.push(newBarrel);
      saveItem("sgf_barrels", barrels);
      return newBarrel;
    },
    update: (id: number, data: any) => {
      const idx = barrels.findIndex((b) => b.id == id);
      if (idx >= 0) {
        barrels[idx] = { ...barrels[idx], ...data, updatedAt: new Date().toISOString() };
        saveItem("sgf_barrels", barrels);
        return barrels[idx];
      }
      return null;
    },
    delete: (id: number) => {
      barrels = barrels.filter((b) => b.id !== id);
      saveItem("sgf_barrels", barrels);
      return { success: true };
    },
  },

  // ─── CERTIFICATES OF COMPLIANCE ────────────────────────────
  certificateOfCompliance: {
    getAll: () => [...certificatesOfCompliance],
    getById: (id: number) => certificatesOfCompliance.find((c) => c.id == id) || null,
    create: (data: any) => {
      const newCOC = { id: generateId(certificatesOfCompliance), ...data, createdAt: new Date().toISOString() };
      certificatesOfCompliance.push(newCOC);
      saveItem("sgf_certificatesOfCompliance", certificatesOfCompliance);
      return newCOC;
    },
    update: (id: number, data: any) => {
      const idx = certificatesOfCompliance.findIndex((c) => c.id == id);
      if (idx >= 0) {
        certificatesOfCompliance[idx] = { ...certificatesOfCompliance[idx], ...data, updatedAt: new Date().toISOString() };
        saveItem("sgf_certificatesOfCompliance", certificatesOfCompliance);
        return certificatesOfCompliance[idx];
      }
      return null;
    },
    delete: (id: number) => {
      certificatesOfCompliance = certificatesOfCompliance.filter((c) => c.id !== id);
      saveItem("sgf_certificatesOfCompliance", certificatesOfCompliance);
      return { success: true };
    },
  },

  // ─── PACKING LIST LINES ────────────────────────────────────
  packingListLine: {
    getAll: () => [...packingListLines],
    getById: (id: number) => packingListLines.find((pl) => pl.id == id) || null,
    create: (data: any) => {
      const newPL = { id: generateId(packingListLines), ...data, createdAt: new Date().toISOString() };
      packingListLines.push(newPL);
      saveItem("sgf_packingListLines", packingListLines);
      return newPL;
    },
    update: (id: number, data: any) => {
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
      const poRef = po.poNumber || `PO-${po.id}`;

      invoices.push({
        id: nextInvId,
        purchaseOrderId: po.id,
        poNumber: po.poNumber,
        orderNumber: poRef,
        invoiceNumber,
        deliveryNoteNumber: `DN-${poRef}`,
        company: invCompany,
        customerId: mainCustomerId,
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
    { id: 1, name: "Collin", email: "collin@supremeglobalfoods.co.za", role: "super_admin", pin: "2580" },
    { id: 2, name: "Adeli", email: "adeli@supremeglobalfoods.co.za", role: "sales_rep", pin: "1111" },
    { id: 3, name: "Inhouse", email: "inhouse@supremeglobalfoods.co.za", role: "sales_rep", pin: "2222" },
    { id: 4, name: "Michael", email: "michael@supremeglobalfoods.co.za", role: "sales_rep", pin: "3333" },
    { id: 5, name: "Nkosana", email: "nkosana@supremeglobalfoods.co.za", role: "sales_rep", pin: "4444" },
    { id: 6, name: "Tebogo Bila", email: "tebogo@supremeglobalfoods.co.za", role: "sales_rep", pin: "6666" },
    { id: 7, name: "Aggie", email: "aggie@supremeglobalfoods.co.za", role: "admin", pin: "1018" },
    { id: 8, name: "Ronald", email: "ronald@supremeglobalfoods.co.za", role: "super_admin", pin: "2581" },
    { id: 9, name: "Jolene", email: "jolene@supremeglobalfoods.co.za", role: "admin", pin: "7777" },
    { id: 10, name: "David", email: "david@supremeglobalfoods.co.za", role: "super_admin", pin: "8888" },
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
        const hardcoded = DEFAULT_USERS.find((u) => u.id === found.id || u.name.toLowerCase() === found.name?.toLowerCase());
        const resolvedPin = found.pin != null ? found.pin : hardcoded?.pin;
        return { id: found.id, name: found.name, email: found.email, role: found.role, pin: resolvedPin };
      }
      // Admin alias match — check if any stored user has this PIN and is admin
      if (ADMIN_ALIASES.includes(typedName)) {
        const adminFound = stored.find(
          (x: any) => (x.role === "admin" || x.role === "super_admin") && String(x.pin) === typedPin && x.isActive !== false
        );
        if (adminFound) {
          const hardcoded = DEFAULT_USERS.find((u) => u.id === adminFound.id || u.name.toLowerCase() === adminFound.name?.toLowerCase());
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
      // Repair stored users if needed
      try {
        const raw = getStorageItem("sgf_users");
        const stored = raw ? JSON.parse(raw) : [];
        const exists = stored.find((x: any) => x.name?.toLowerCase() === name.toLowerCase());
        if (!exists) {
          stored.push({ ...fromDefaults, isActive: true, createdAt: new Date().toISOString() });
          setStorageItem("sgf_users", JSON.stringify(stored));
          users = stored;
        }
      } catch { /* ignore */ }
      return { id: fromDefaults.id, name: fromDefaults.name, email: fromDefaults.email, role: fromDefaults.role, pin: fromDefaults.pin };
    }
  }

  return null;
}

// NOTE: load() is already called at line 143 after all module-level variables are declared.
// Do NOT call load() again here — it would overwrite in-memory data with stale localStorage.

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

// Repair corrupted orders on module load (fixes orders created during the reloadFromStorage bug)
try {
  dataService.order.repairOrders();
} catch (e) {
  console.error("[dataService] Order repair failed:", e);
}
