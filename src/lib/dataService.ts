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
  } catch (e) { console.error("[load] invoice cleanup failed:", e); }

  // AUTO-LINK: Match Sage invoices to customers by customerCode.
  // This runs on every startup so ALL devices get linked Sage invoices
  // without needing to click "Re-link Sage Invoices".
  try {
    const sageInvoices = invoices.filter((inv) => inv.source === "sage" || inv.isSageInvoice);
    let linkedCount = 0;
    for (const inv of sageInvoices) {
      if (!inv.customerId && inv.customerCode) {
        const matched = customers.find((c) => c.customerCode === inv.customerCode);
        if (matched) {
          inv.customerId = matched.id;
          inv.customer = { name: matched.name };
          linkedCount++;
        }
      }
    }
    if (linkedCount > 0) {
      saveItem("sgf_invoices", invoices);
      console.log(`[AutoLink] Linked ${linkedCount} Sage invoice(s) to customers`);
    }
  } catch (e) { console.error("[load] auto-link failed:", e); }

  // CORPORATE DATA
  try {
    const cc = safeLoadArray("sgf_corporateCustomers");
    if (cc) corporateCustomers = cc;
  } catch { /* ignore */ }
  try {
    const po = safeLoadArray("sgf_purchaseOrders");
    if (po) purchaseOrders = po;
  } catch { /* ignore */ }
  try {
    const b = safeLoadArray("sgf_barrels");
    if (b) barrels = b;
  } catch { /* ignore */ }
  try {
    const coc = safeLoadArray("sgf_certificatesOfCompliance");
    if (coc) certificatesOfCompliance = coc;
  } catch { /* ignore */ }
  try {
    const pl = safeLoadArray("sgf_packingListLines");
    if (pl) packingListLines = pl;
  } catch { /* ignore */ }
}

function deduplicateAll() {
  // Deduplicate orders by id, keeping the newest updatedAt
  const seenOrders = new Map<number, any>();
  for (const o of orders) {
    const id = Number(o.id);
    if (!seenOrders.has(id)) {
      seenOrders.set(id, o);
    } else {
      const existing = seenOrders.get(id);
      const existingTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
      const newTime = new Date(o.updatedAt || o.createdAt || 0).getTime();
      if (newTime > existingTime) {
        seenOrders.set(id, o);
      }
    }
  }
  if (seenOrders.size < orders.length) {
    orders = Array.from(seenOrders.values());
    saveItem("sgf_orders", orders);
  }

  // Deduplicate invoices by id, keeping newest
  const seenInvoices = new Map<number, any>();
  for (const i of invoices) {
    const id = Number(i.id);
    if (!seenInvoices.has(id)) {
      seenInvoices.set(id, i);
    } else {
      const existing = seenInvoices.get(id);
      const existingTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
      const newTime = new Date(i.updatedAt || i.createdAt || 0).getTime();
      if (newTime > existingTime) {
        seenInvoices.set(id, i);
      }
    }
  }
  if (seenInvoices.size < invoices.length) {
    invoices = Array.from(seenInvoices.values());
    saveItem("sgf_invoices", invoices);
  }

  // Deduplicate appointments by id
  const seenAppointments = new Map<number, any>();
  for (const a of appointments) {
    const id = Number(a.id);
    if (!seenAppointments.has(id)) {
      seenAppointments.set(id, a);
    } else {
      const existing = seenAppointments.get(id);
      const existingTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
      const newTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
      if (newTime > existingTime) {
        seenAppointments.set(id, a);
      }
    }
  }
  if (seenAppointments.size < appointments.length) {
    appointments = Array.from(seenAppointments.values());
    saveItem("sgf_appointments", appointments);
  }

  // Deduplicate checkins by id
  const seenCheckins = new Map<number, any>();
  for (const c of checkins) {
    const id = Number(c.id);
    if (!seenCheckins.has(id)) {
      seenCheckins.set(id, c);
    } else {
      const existing = seenCheckins.get(id);
      const existingTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
      const newTime = new Date(c.updatedAt || c.createdAt || 0).getTime();
      if (newTime > existingTime) {
        seenCheckins.set(id, c);
      }
    }
  }
  if (seenCheckins.size < checkins.length) {
    checkins = Array.from(seenCheckins.values());
    saveItem("sgf_checkins", checkins);
  }
}

/** Save an item to localStorage with cloud sync trigger */
function saveItem(key: string, value: any) {
  try {
    setStorageItem(key, JSON.stringify(value));
    // Trigger cloud sync event
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("sgf:dataChanged", { detail: { key } }));
    }
  } catch (e) {
    console.error(`[saveItem] FAILED to save ${key}:`, e);
  }
}

/** Reload all data from localStorage into memory */
export function reloadFromStorage() {
  load();
}

// Initial load
load();

// ═══════════════════════════════════════════════════════════════
//  DATA SERVICE — tRPC router-compatible API
// ═══════════════════════════════════════════════════════════════

export const dataService = {
  customer: {
    list: () => customers,
    search: ({ query }: { query: string }) => {
      const q = (query || "").toLowerCase().trim();
      if (!q || q === " ") return customers;
      return customers.filter((c: any) =>
        (c.name || "").toLowerCase().includes(q) ||
        (c.contactPerson || "").toLowerCase().includes(q) ||
        (c.phone || "").toLowerCase().includes(q) ||
        (c.email || "").toLowerCase().includes(q) ||
        (c.customerCode || "").toLowerCase().includes(q) ||
        (c.physicalAddress || "").toLowerCase().includes(q) ||
        (c.city || "").toLowerCase().includes(q) ||
        (c.businessName || "").toLowerCase().includes(q)
      );
    },
    getById: (id: number) => customers.find((c) => c.id == id) || null,
    create: (data: any) => {
      const newId = customers.length > 0 ? Math.max(...customers.map((c) => c.id || 0)) + 1 : 1;
      const newCustomer = {
        ...data,
        id: newId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      customers.push(newCustomer);
      saveItem("sgf_customers", customers);
      return newCustomer;
    },
    update: ({ id, data }: { id: number; data: any }) => {
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
    getSalesReps: () => {
      const reps = new Set<string>();
      customers.forEach((c: any) => { if (c.salesRepName) reps.add(c.salesRepName); });
      // Also include in-memory sales reps
      SALES_REPS.forEach((r) => { if (r.name) reps.add(r.name); });
      return Array.from(reps).sort();
    },
    getStats: () => {
      const total = customers.length;
      const active = customers.filter((c: any) => c.status === "active").length;
      const inactive = customers.filter((c: any) => c.status === "inactive").length;
      return { total, active, inactive };
    },
    getCustomersNeedingFollowUp: ({ days }: { days: number }) => {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      return customers
        .filter((c: any) => {
          if (c.status !== "active") return false;
          const lastOrderDate = c.lastOrderDate ? new Date(c.lastOrderDate) : null;
          return !lastOrderDate || lastOrderDate < cutoff;
        })
        .map((c: any) => ({
          ...c,
          daysSinceLastOrder: c.lastOrderDate
            ? Math.floor((new Date().getTime() - new Date(c.lastOrderDate).getTime()) / (1000 * 60 * 60 * 24))
            : 999,
        }))
        .sort((a: any, b: any) => b.daysSinceLastOrder - a.daysSinceLastOrder);
    },
  },

  product: {
    list: () => products,
    getById: (id: number) => products.find((p) => p.id == id) || null,
    create: (data: any) => {
      const newId = products.length > 0 ? Math.max(...products.map((p) => p.id || 0)) + 1 : 1;
      const newProduct = { ...data, id: newId, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      products.push(newProduct);
      saveItem("sgf_products", products);
      return newProduct;
    },
    update: ({ id, data }: { id: number; data: any }) => {
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
    search: ({ query }: { query: string }) => {
      const q = (query || "").toLowerCase().trim();
      if (!q) return products;
      return products.filter((p: any) =>
        (p.productName || "").toLowerCase().includes(q) ||
        (p.productCode || "").toLowerCase().includes(q) ||
        (p.category || "").toLowerCase().includes(q) ||
        (p.description || "").toLowerCase().includes(q)
      );
    },
    getByCategory: ({ category }: { category: string }) => {
      return products.filter((p: any) => (p.category || "").toLowerCase() === category.toLowerCase());
    },
    getCategories: () => {
      const cats = new Set<string>();
      products.forEach((p: any) => { if (p.category) cats.add(p.category); });
      return Array.from(cats).sort();
    },
    getLowStock: () => {
      return products.filter((p: any) => p.quantity != null && p.quantity <= (p.minStock || 10));
    },
    getStats: () => {
      const total = products.length;
      const lowStock = products.filter((p: any) => p.quantity != null && p.quantity <= (p.minStock || 10)).length;
      const outOfStock = products.filter((p: any) => p.quantity === 0).length;
      return { total, lowStock, outOfStock };
    },
  },

  order: {
    list: () => orders,
    getById: (id: number) => orders.find((o) => o.id == id) || null,
    create: (data: any) => {
      const newId = orders.length > 0 ? Math.max(...orders.map((o) => o.id || 0)) + 1 : 1;
      const newOrder = { ...data, id: newId, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      orders.push(newOrder);
      saveItem("sgf_orders", orders);
      return newOrder;
    },
    update: ({ id, data }: { id: number; data: any }) => {
      const idx = orders.findIndex((o) => o.id == id);
      if (idx >= 0) {
        orders[idx] = { ...orders[idx], ...data, updatedAt: new Date().toISOString() };
        saveItem("sgf_orders", orders);
        return orders[idx];
      }
      return null;
    },
    delete: (id: number) => {
      const idx = orders.findIndex((o) => o.id === id);
      if (idx === -1) return { success: false, error: "Order not found" };
      const order = orders[idx];
      // Restore stock for each item in the deleted order
      for (const item of order.items || []) {
        if (item.stockItemId && item.quantity > 0) {
          const stock = products.find((p) => p.id === item.stockItemId);
          if (stock) {
            const conversion = item.conversion || 1;
            const qtyInKg = item.quantity * conversion;
            stock.quantity = (stock.quantity || 0) + qtyInKg;
            try {
              const { pushStockItem } = require("@/lib/firebaseSync");
              if (pushStockItem) pushStockItem(item.stockItemId, stock.quantity);
            } catch (e) { /* ignore */ }
          }
        }
      }
      // Also delete any invoices linked to this order
      const linkedInvoices = invoices.filter((inv) => inv.orderId === id);
      for (const inv of linkedInvoices) {
        const invIdx = invoices.findIndex((i) => i.id === inv.id);
        if (invIdx !== -1) invoices.splice(invIdx, 1);
      }
      if (linkedInvoices.length > 0) {
        saveItem("sgf_invoices", invoices);
      }
      orders.splice(idx, 1);
      saveItem("sgf_orders", orders);
      return { success: true, deletedOrder: order, deletedInvoices: linkedInvoices.length };
    },
    getByCustomer: (customerId: number) => orders.filter((o) => o.customerId == customerId),
    getBySalesRep: (salesRepName: string) => orders.filter((o) => o.salesRepName === salesRepName),
    getStats: () => {
      const total = orders.length;
      const totalValue = orders.reduce((sum, o) => sum + (o.total || 0), 0);
      const today = new Date().toDateString();
      const todayOrders = orders.filter((o) => new Date(o.createdAt).toDateString() === today);
      return { total, totalValue, today: todayOrders.length, todayValue: todayOrders.reduce((sum, o) => sum + (o.total || 0), 0) };
    },
  },

  invoice: {
    list: () => invoices,
    getById: (id: number) => invoices.find((i) => i.id == id) || null,
    create: (data: any) => {
      const newId = invoices.length > 0 ? Math.max(...invoices.map((i) => i.id || 0)) + 1 : 1;
      const newInvoice = { ...data, id: newId, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      invoices.push(newInvoice);
      saveItem("sgf_invoices", invoices);
      return newInvoice;
    },
    update: ({ id, data }: { id: number; data: any }) => {
      const idx = invoices.findIndex((i) => i.id == id);
      if (idx >= 0) {
        invoices[idx] = { ...invoices[idx], ...data, updatedAt: new Date().toISOString() };
        saveItem("sgf_invoices", invoices);
        return invoices[idx];
      }
      return null;
    },
    delete: (id: number) => {
      invoices = invoices.filter((i) => i.id !== id);
      saveItem("sgf_invoices", invoices);
      return { success: true };
    },
    getByCustomer: (customerId: number) => invoices.filter((i) => i.customerId == customerId),
    getStats: () => {
      const total = invoices.length;
      const totalValue = invoices.reduce((sum, i) => sum + (i.total || 0), 0);
      const unpaid = invoices.filter((i) => (i.balanceDue || 0) > 0).length;
      const unpaidValue = invoices.filter((i) => (i.balanceDue || 0) > 0).reduce((sum, i) => sum + (i.balanceDue || 0), 0);
      return { total, totalValue, unpaid, unpaidValue };
    },
  },

  appointment: {
    list: () => appointments,
    getById: (id: number) => appointments.find((a) => a.id == id) || null,
    create: (data: any) => {
      const newId = appointments.length > 0 ? Math.max(...appointments.map((a) => a.id || 0)) + 1 : 1;
      const newAppointment = {
        ...data,
        id: newId,
        status: "scheduled",
        reminderSent: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      appointments.push(newAppointment);
      saveItem("sgf_appointments", appointments);
      return newAppointment;
    },
    update: ({ id, data }: { id: number; data: any }) => {
      const idx = appointments.findIndex((a) => a.id == id);
      if (idx >= 0) {
        appointments[idx] = { ...appointments[idx], ...data, updatedAt: new Date().toISOString() };
        saveItem("sgf_appointments", appointments);
        return appointments[idx];
      }
      return null;
    },
    updateStatus: ({ id, status }: { id: number; status: string }) => {
      const idx = appointments.findIndex((a) => a.id == id);
      if (idx >= 0) {
        appointments[idx].status = status;
        appointments[idx].updatedAt = new Date().toISOString();
        // reset reminder on reschedule so it triggers again
        if (status === "rescheduled") {
          appointments[idx].reminderSent = false;
        }
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
    getByCustomer: (customerId: number) => appointments.filter((a) => a.customerId == customerId),
    getBySalesRep: (salesRepName: string) => appointments.filter((a) => a.salesRepName === salesRepName),
    getStats: () => {
      const total = appointments.length;
      const today = new Date().toDateString();
      const todayAppointments = appointments.filter((a) => new Date(a.appointmentDate).toDateString() === today);
      return { total, today: todayAppointments.length };
    },
  },

  checkIn: {
    list: () => checkins,
    getById: (id: number) => checkins.find((c) => c.id == id) || null,
    create: (data: any) => {
      const newId = checkins.length > 0 ? Math.max(...checkins.map((c) => c.id || 0)) + 1 : 1;
      const newItem = {
        ...data,
        id: newId,
        status: "checked_in",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      checkins.push(newItem);
      saveItem("sgf_checkins", checkins);

      // If linked to an appointment, update appointment status to in_progress
      if (newItem.appointmentId) {
        const apptIdx = appointments.findIndex((a) => a.id == newItem.appointmentId);
        if (apptIdx >= 0) {
          appointments[apptIdx].status = "in_progress";
          appointments[apptIdx].checkedInAt = newItem.createdAt;
          appointments[apptIdx].updatedAt = new Date().toISOString();
          saveItem("sgf_appointments", appointments);
        }
      }

      return newItem;
    },
    update: ({ id, data }: { id: number; data: any }) => {
      const idx = checkins.findIndex((c) => c.id == id);
      if (idx >= 0) {
        checkins[idx] = { ...checkins[idx], ...data, updatedAt: new Date().toISOString() };
        saveItem("sgf_checkins", checkins);
        return checkins[idx];
      }
      return null;
    },
    checkout: ({ id, notes, outcome, outcomeNotes }: { id: number; notes?: string; outcome?: string; outcomeNotes?: string }) => {
      const idx = checkins.findIndex((c) => c.id == id);
      if (idx >= 0) {
        const now = new Date().toISOString();
        const createdAt = new Date(checkins[idx].createdAt || now);
        const checkedOutAt = new Date(now);
        const durationMinutes = Math.round((checkedOutAt.getTime() - createdAt.getTime()) / (1000 * 60));

        checkins[idx].status = "checked_out";
        checkins[idx].checkedOutAt = now;
        checkins[idx].durationMinutes = durationMinutes;
        if (notes) checkins[idx].checkoutNotes = notes;
        if (outcome) checkins[idx].outcome = outcome;
        if (outcomeNotes) checkins[idx].outcomeNotes = outcomeNotes;
        checkins[idx].updatedAt = now;
        saveItem("sgf_checkins", checkins);

        // If linked to an appointment, update appointment status to completed
        if (checkins[idx].appointmentId) {
          const apptIdx = appointments.findIndex((a) => a.id == checkins[idx].appointmentId);
          if (apptIdx >= 0) {
            appointments[apptIdx].status = "completed";
            appointments[apptIdx].checkedOutAt = checkins[idx].checkedOutAt;
            appointments[apptIdx].durationMinutes = checkins[idx].durationMinutes;
            if (outcome) appointments[apptIdx].outcome = outcome;
            if (outcomeNotes) appointments[apptIdx].outcomeNotes = outcomeNotes;
            appointments[apptIdx].updatedAt = now;
            saveItem("sgf_appointments", appointments);
          }
        }

        return checkins[idx];
      }
      return null;
    },
    delete: (id: number) => {
      checkins = checkins.filter((c) => c.id !== id);
      saveItem("sgf_checkins", checkins);
      return { success: true };
    },
    getByCustomer: (customerId: number) => checkins.filter((c) => c.customerId == customerId),
    getBySalesRep: (salesRepName: string) => checkins.filter((c) => c.salesRepName === salesRepName),
    getStats: () => {
      const total = checkins.length;
      const checkedIn = checkins.filter((c) => c.status === "checked_in").length;
      const checkedOut = checkins.filter((c) => c.status === "checked_out").length;
      return { total, checkedIn, checkedOut };
    },
  },

  specialPrice: {
    list: () => specialPrices,
    getById: (id: number) => specialPrices.find((s) => s.id == id) || null,
    create: (data: any) => {
      const newId = specialPrices.length > 0 ? Math.max(...specialPrices.map((s) => s.id || 0)) + 1 : 1;
      const newItem = { ...data, id: newId, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      specialPrices.push(newItem);
      saveItem("sgf_specialPrices", specialPrices);
      return newItem;
    },
    update: ({ id, data }: { id: number; data: any }) => {
      const idx = specialPrices.findIndex((s) => s.id == id);
      if (idx >= 0) {
        specialPrices[idx] = { ...specialPrices[idx], ...data, updatedAt: new Date().toISOString() };
        saveItem("sgf_specialPrices", specialPrices);
        return specialPrices[idx];
      }
      return null;
    },
    delete: (id: number) => {
      specialPrices = specialPrices.filter((s) => s.id !== id);
      saveItem("sgf_specialPrices", specialPrices);
      return { success: true };
    },
    getByCustomer: (customerId: number) => specialPrices.filter((s) => s.customerId == customerId),
  },

  auditLog: {
    list: () => auditLog,
    create: (data: any) => {
      const newId = auditLog.length > 0 ? Math.max(...auditLog.map((a) => a.id || 0)) + 1 : 1;
      const newItem = { ...data, id: newId, createdAt: new Date().toISOString() };
      auditLog.push(newItem);
      saveItem("sgf_auditLog", auditLog);
      return newItem;
    },
    getByEntity: ({ entityType, entityId }: { entityType: string; entityId: number }) => {
      return auditLog.filter((a) => a.entityType === entityType && a.entityId == entityId);
    },
  },

  followUp: {
    list: () => followUps,
    create: (data: any) => {
      const newId = followUps.length > 0 ? Math.max(...followUps.map((f) => f.id || 0)) + 1 : 1;
      const newItem = { ...data, id: newId, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      followUps.push(newItem);
      saveItem("sgf_followUps", followUps);
      return newItem;
    },
    update: ({ id, data }: { id: number; data: any }) => {
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

  followUpAction: {
    list: () => followUpActions,
    create: (data: any) => {
      const newId = followUpActions.length > 0 ? Math.max(...followUpActions.map((f) => f.id || 0)) + 1 : 1;
      const newItem = { ...data, id: newId, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      followUpActions.push(newItem);
      saveItem("sgf_followUpActions", followUpActions);
      return newItem;
    },
    getByCustomer: (customerId: number) => followUpActions.filter((f) => f.customerId == customerId),
    delete: (id: number) => {
      followUpActions = followUpActions.filter((f) => f.id !== id);
      saveItem("sgf_followUpActions", followUpActions);
      return { success: true };
    },
  },

  collectionNote: {
    list: () => collectionNotes,
    create: (data: any) => {
      const newId = collectionNotes.length > 0 ? Math.max(...collectionNotes.map((c) => c.id || 0)) + 1 : 1;
      const newItem = { ...data, id: newId, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      collectionNotes.push(newItem);
      saveItem("sgf_collectionNotes", collectionNotes);
      return newItem;
    },
    update: ({ id, data }: { id: number; data: any }) => {
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
    getByCustomer: (customerId: number) => collectionNotes.filter((c) => c.customerId == customerId),
  },

  collectionPromise: {
    list: () => collectionPromises,
    create: (data: any) => {
      const newId = collectionPromises.length > 0 ? Math.max(...collectionPromises.map((c) => c.id || 0)) + 1 : 1;
      const newItem = { ...data, id: newId, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      collectionPromises.push(newItem);
      saveItem("sgf_collectionPromises", collectionPromises);
      return newItem;
    },
    update: ({ id, data }: { id: number; data: any }) => {
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
    getByCustomer: (customerId: number) => collectionPromises.filter((c) => c.customerId == customerId),
  },

  accountHold: {
    list: () => accountHolds,
    create: (data: any) => {
      const newId = accountHolds.length > 0 ? Math.max(...accountHolds.map((a) => a.id || 0)) + 1 : 1;
      const newItem = { ...data, id: newId, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      accountHolds.push(newItem);
      saveItem("sgf_accountHolds", accountHolds);
      return newItem;
    },
    update: ({ id, data }: { id: number; data: any }) => {
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
    getByCustomer: (customerId: number) => accountHolds.filter((a) => a.customerId == customerId),
  },

  receipt: {
    list: () => receipts,
    create: (data: any) => {
      const newId = receipts.length > 0 ? Math.max(...receipts.map((r) => r.id || 0)) + 1 : 1;
      const newItem = { ...data, id: newId, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      receipts.push(newItem);
      saveItem("sgf_receipts", receipts);
      return newItem;
    },
    getById: (id: number) => receipts.find((r) => r.id == id) || null,
    getByInvoice: (invoiceId: number) => receipts.filter((r) => r.invoiceId == invoiceId),
    getByCustomer: (customerId: number) => receipts.filter((r) => r.customerId == customerId),
    getStats: () => {
      const total = receipts.length;
      const totalValue = receipts.reduce((sum, r) => sum + (r.amount || 0), 0);
      return { total, totalValue };
    },
  },

  creditNote: {
    list: () => creditNotes,
    create: (data: any) => {
      const newId = creditNotes.length > 0 ? Math.max(...creditNotes.map((c) => c.id || 0)) + 1 : 1;
      const newItem = { ...data, id: newId, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      creditNotes.push(newItem);
      saveItem("sgf_creditNotes", creditNotes);
      return newItem;
    },
    getById: (id: number) => creditNotes.find((c) => c.id == id) || null,
    getByInvoice: (invoiceId: number) => creditNotes.filter((c) => c.invoiceId == invoiceId),
    getByCustomer: (customerId: number) => creditNotes.filter((c) => c.customerId == customerId),
  },

  user: {
    list: () => users,
    getById: (id: number) => users.find((u) => u.id == id) || null,
    getByEmail: (email: string) => users.find((u) => u.email?.toLowerCase() === email.toLowerCase()) || null,
    create: (data: any) => {
      const newId = users.length > 0 ? Math.max(...users.map((u) => u.id || 0)) + 1 : 1;
      const newUser = { ...data, id: newId, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      users.push(newUser);
      saveItem("sgf_users", users);
      return newUser;
    },
    update: ({ id, data }: { id: number; data: any }) => {
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
    authenticate: ({ name, pin }: { name: string; pin: string }) => {
      const user = users.find((u) => u.name?.toLowerCase() === name.toLowerCase() && String(u.pin) === String(pin) && u.isActive !== false);
      return user || null;
    },
  },

  // ─── CORPORATE MODULE ───
  corporateCustomer: {
    list: () => corporateCustomers,
    getById: (id: number) => corporateCustomers.find((c) => c.id == id) || null,
    create: (data: any) => {
      const newId = corporateCustomers.length > 0 ? Math.max(...corporateCustomers.map((c) => c.id || 0)) + 1 : 1;
      const newItem = { ...data, id: newId, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      corporateCustomers.push(newItem);
      saveItem("sgf_corporateCustomers", corporateCustomers);
      return newItem;
    },
    update: ({ id, data }: { id: number; data: any }) => {
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

  purchaseOrder: {
    list: () => purchaseOrders,
    getById: (id: number) => purchaseOrders.find((po) => po.id == id) || null,
    create: (data: any) => {
      const newId = purchaseOrders.length > 0 ? Math.max(...purchaseOrders.map((po) => po.id || 0)) + 1 : 1;
      const newItem = { ...data, id: newId, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      purchaseOrders.push(newItem);
      saveItem("sgf_purchaseOrders", purchaseOrders);
      return newItem;
    },
    update: ({ id, data }: { id: number; data: any }) => {
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
    getByCorporateCustomer: (corporateCustomerId: number) => purchaseOrders.filter((po) => po.corporateCustomerId == corporateCustomerId),
  },

  barrel: {
    list: () => barrels,
    getById: (id: number) => barrels.find((b) => b.id == id) || null,
    create: (data: any) => {
      const newId = barrels.length > 0 ? Math.max(...barrels.map((b) => b.id || 0)) + 1 : 1;
      const newItem = { ...data, id: newId, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      barrels.push(newItem);
      saveItem("sgf_barrels", barrels);
      return newItem;
    },
    update: ({ id, data }: { id: number; data: any }) => {
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

  certificateOfCompliance: {
    list: () => certificatesOfCompliance,
    getById: (id: number) => certificatesOfCompliance.find((c) => c.id == id) || null,
    create: (data: any) => {
      const newId = certificatesOfCompliance.length > 0 ? Math.max(...certificatesOfCompliance.map((c) => c.id || 0)) + 1 : 1;
      const newItem = { ...data, id: newId, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      certificatesOfCompliance.push(newItem);
      saveItem("sgf_certificatesOfCompliance", certificatesOfCompliance);
      return newItem;
    },
    update: ({ id, data }: { id: number; data: any }) => {
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

  // ═══════════════════════════════════════════════════════════════
  //  PACKING LIST LINES (factory-filled barrel packing lines)
  // ═══════════════════════════════════════════════════════════════
  packingList: {
    list: () => packingListLines,
    listByPurchaseOrder: (poId: number) => packingListLines.filter((pl) => pl.purchaseOrderId === poId),
    getById: (id: number) => packingListLines.find((pl) => pl.id == id) || null,
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
          customer: mainCustomer || { name: po.corporateCustomerName || "Corporate Customer" },
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
        orderNumber: po.poNumber,
        invoiceNumber,
        company: invCompany,
        customerId: mainCustomerId,
        customer: mainCustomer || { name: po.corporateCustomerName || "Corporate Customer" },
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

  /** Generate an invoice from a regular order.
   *  Exposed on dataService so localLink can call it via dataService.generateInvoiceForOrder */
  generateInvoiceForOrder: (orderId: number): string | null => {
    if (invoiceGenerationLock) {
      console.warn("[generateInvoiceForOrder] LOCKED — another invoice is being generated.");
      return null;
    }
    invoiceGenerationLock = true;
    try {
      load();
      const order = orders.find((o) => o.id == orderId);
      if (!order) return null;

      // Check if invoice already exists for this order
      const existing = invoices.find((i) => i.orderId == orderId);
      if (existing) return existing.invoiceNumber;

      const items = order.items || [];
      const subtotal = items.reduce((sum: number, item: any) => sum + (item.quantity * item.unitPrice || 0), 0);
      const vatRate = 0.15;
      const vatAmount = subtotal * vatRate;
      const total = subtotal + vatAmount;

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

      const customer = customers.find((c) => c.id == order.customerId);
      const nextInvId = invoices.length > 0 ? Math.max(...invoices.map((i) => Number(i.id) || 0)) + 1 : 1;

      invoices.push({
        id: nextInvId,
        orderId: order.id,
        orderNumber: order.orderNumber,
        invoiceNumber,
        company: invCompany,
        customerId: order.customerId,
        customer: customer ? { name: customer.name } : order.customer,
        subtotal,
        vatAmount,
        vatRate,
        total,
        totalAmount: total,
        balanceDue: total,
        amountPaid: 0,
        status: "draft",
        paymentTerms: order.paymentTerms || "30_days",
        invoiceDate: now.toISOString(),
        dueDate: dueDate.toISOString(),
        notes: `Invoice for order ${order.orderNumber}`,
        items: items.map((item: any) => ({
          description: item.description || products.find((p) => p.id == item.stockItemId)?.productName || "",
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

function getNextInvoiceNumberForCompany(company: string): string {
  const prefix = company.toLowerCase() === "rc" ? "RC" : "SGF";
  const existingNumbers = invoices
    .filter((i) => (i.company || "sgf").toLowerCase() === company.toLowerCase())
    .map((i) => {
      const match = i.invoiceNumber?.match(/(\d+)/);
      return match ? parseInt(match[1]) : 0;
    })
    .filter((n) => n > 0);

  const nextNum = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;

  if (company.toLowerCase() === "rc") {
    return `RC${String(nextNum).padStart(4, "0")}`;
  }
  return `SGF${nextNum}`;
}

// ═══════════════════════════════════════════════════════════════
//  MISSING EXPORTS — required by localLink.ts
// ═══════════════════════════════════════════════════════════════

let AA_RATE_PER_KM = 5.50;

try {
  const stored = getStorageItem("sgf_aaRate");
  if (stored) AA_RATE_PER_KM = parseFloat(stored);
} catch { /* ignore */ }

export function getAARate(): number { return AA_RATE_PER_KM; }

export function setAARate(rate: number): void {
  AA_RATE_PER_KM = rate;
  setStorageItem("sgf_aaRate", String(rate));
}

export interface BankStatementRow {
  date: string;
  description: string;
  amount: number;
  type: "credit" | "debit";
  reference?: string;
}

export function parseBankStatement(rawRows: any[][]): BankStatementRow[] {
  const rows: BankStatementRow[] = [];
  for (const r of rawRows) {
    if (!r || r.length < 3) continue;
    const amount = parseFloat(String(r[2] || "0").replace(/,/g, ""));
    if (isNaN(amount) || amount === 0) continue;
    rows.push({
      date: String(r[0] || ""),
      description: String(r[1] || ""),
      amount: Math.abs(amount),
      type: amount > 0 ? "credit" : "debit",
      reference: r[3] ? String(r[3]) : undefined,
    });
  }
  return rows;
}

export interface PaymentMatchResult {
  row: BankStatementRow;
  matchedInvoiceId?: number;
  matchedInvoiceNumber?: string;
  matchedCustomerId?: number;
  matchedCustomerName?: string;
  confidence: number;
  matchType: "exact" | "partial" | "none";
}

export function matchBankPayments(rows: BankStatementRow[]): PaymentMatchResult[] {
  const results: PaymentMatchResult[] = [];
  const invs = dataService.invoice.list();
  const custs = dataService.customer.list();

  for (const row of rows) {
    let best: PaymentMatchResult = { row, confidence: 0, matchType: "none" };

    const invNumMatch = row.description.match(/(SGF\d+|RC\d{4}|INV[-]?\d+)/i);
    if (invNumMatch) {
      const num = invNumMatch[1].toUpperCase();
      const inv = invs.find((i: any) => i.invoiceNumber?.toUpperCase() === num);
      if (inv) {
        best = {
          row,
          matchedInvoiceId: inv.id,
          matchedInvoiceNumber: inv.invoiceNumber,
          matchedCustomerId: inv.customerId,
          matchedCustomerName: inv.customer?.name,
          confidence: 1.0,
          matchType: "exact",
        };
      }
    }

    if (best.matchType === "none") {
      for (const c of custs) {
        const nameParts = (c.name || "").toLowerCase().split(/\s+/);
        const descLower = row.description.toLowerCase();
        if (nameParts.length > 0 && nameParts.every((p: string) => descLower.includes(p))) {
          best = {
            row,
            matchedCustomerId: c.id,
            matchedCustomerName: c.name,
            confidence: 0.7,
            matchType: "partial",
          };
          break;
        }
      }
    }

    results.push(best);
  }
  return results;
}

export function allocateBankPayments(allocations: any[]): { processed: number; errors: string[] } {
  const errors: string[] = [];
  let processed = 0;
  for (const alloc of allocations) {
    try {
      if (!alloc.invoiceId || !alloc.amount) {
        errors.push("Missing invoiceId or amount");
        continue;
      }
      const inv = dataService.invoice.list().find((i: any) => i.id == alloc.invoiceId);
      if (!inv) {
        errors.push(`Invoice ${alloc.invoiceId} not found`);
        continue;
      }
      const currentPaid = Number(inv.amountPaid || 0);
      const newPaid = currentPaid + Number(alloc.amount);
      const total = Number(inv.totalAmount || inv.total || 0);
      const balanceDue = Math.max(0, total - newPaid);
      const status = balanceDue <= 0 ? "paid" : (newPaid > 0 ? "partial" : inv.status);

      const idx = invoices.findIndex((i: any) => i.id == alloc.invoiceId);
      if (idx >= 0) {
        invoices[idx] = { ...invoices[idx], amountPaid: newPaid, balanceDue, status, updatedAt: new Date().toISOString() };
        saveItem("sgf_invoices", invoices);
        processed++;
      }
    } catch (e: any) {
      errors.push(String(e?.message || e));
    }
  }
  return { processed, errors };
}

export function fixDraftInvoicesForDeliveredOrders(): { changed: number; invoices: any[] } {
  const changedInvoices: any[] = [];
  const ords = dataService.order.list();
  const invs = dataService.invoice.list();

  for (const inv of invs) {
    if (inv.status !== "draft") continue;
    const linkedOrder = ords.find((o: any) => o.id == inv.orderId);
    if (linkedOrder && linkedOrder.status === "delivered") {
      const idx = invoices.findIndex((i: any) => i.id == inv.id);
      if (idx >= 0) {
        invoices[idx] = { ...invoices[idx], status: "unpaid", updatedAt: new Date().toISOString() };
        changedInvoices.push(invoices[idx]);
      }
    }
  }
  if (changedInvoices.length > 0) {
    saveItem("sgf_invoices", invoices);
  }
  return { changed: changedInvoices.length, invoices: changedInvoices };
}

export function fixSageInvoiceDates(): { changed: number; invoices: any[] } {
  const changedInvoices: any[] = [];
  const invs = dataService.invoice.list();

  for (const inv of invs) {
    if (!inv.isSageInvoice && inv.source !== "sage") continue;
    let changed = false;
    const updates: any = {};

    if (!inv.invoiceDate && inv.createdAt) {
      updates.invoiceDate = inv.createdAt;
      changed = true;
    }
    if (!inv.dueDate && inv.invoiceDate) {
      const d = new Date(inv.invoiceDate);
      d.setDate(d.getDate() + 30);
      updates.dueDate = d.toISOString();
      changed = true;
    }

    if (changed) {
      const idx = invoices.findIndex((i: any) => i.id == inv.id);
      if (idx >= 0) {
        invoices[idx] = { ...invoices[idx], ...updates, updatedAt: new Date().toISOString() };
        changedInvoices.push(invoices[idx]);
      }
    }
  }
  if (changedInvoices.length > 0) {
    saveItem("sgf_invoices", invoices);
  }
  return { changed: changedInvoices.length, invoices: changedInvoices };
}

// ═══════════════════════════════════════════════════════════════
//  ADDITIONAL EXPORTS — required by pages and localLink.ts
// ═══════════════════════════════════════════════════════════════

/** Generate an invoice from a regular order. Standalone export for direct page usage. */
export function generateInvoiceForOrder(orderId: number): string | null {
  return dataService.generateInvoiceForOrder(orderId);
}

/** Return banking details for payment reminders and statements. */
export function getBankingDetails(): { bankName: string; accountNumber: string; branchCode: string } {
  try {
    const stored = getStorageItem("sgf_bankingDetails");
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && parsed.bankName) {
        return {
          bankName: parsed.bankName || "FNB",
          accountNumber: parsed.accountNumber || "1234567890",
          branchCode: parsed.branchCode || "250655",
        };
      }
    }
  } catch { /* ignore */ }
  return { bankName: "FNB", accountNumber: "1234567890", branchCode: "250655" };
}

/** Find and fix duplicate invoice numbers in the system. */
export function fixDuplicateInvoiceNumbers(): { changes: any[] } {
  const changes: any[] = [];
  const seenNumbers = new Map<string, number[]>();

  for (let i = 0; i < invoices.length; i++) {
    const num = invoices[i].invoiceNumber;
    if (!num) continue;
    if (!seenNumbers.has(num)) {
      seenNumbers.set(num, [i]);
    } else {
      seenNumbers.get(num)!.push(i);
    }
  }

  for (const [num, indices] of seenNumbers.entries()) {
    if (indices.length > 1) {
      for (let i = 1; i < indices.length; i++) {
        const idx = indices[i];
        const company = (invoices[idx].company || "sgf").toLowerCase() === "rc" ? "rc" : "sgf";
        let newNumber = getNextInvoiceNumberForCompany(company);
        const existingNumbers = new Set(invoices.map((inv) => inv.invoiceNumber));
        let safety = 0;
        while (existingNumbers.has(newNumber) && safety < 100) {
          const match = newNumber.match(/(SGF|RC)(\d+)/);
          if (match) {
            const prefix = match[1];
            const n = parseInt(match[2]) + 1;
            newNumber = prefix === "RC" ? `RC${String(n).padStart(4, "0")}` : `SGF${n}`;
          }
          safety++;
        }
        invoices[idx].invoiceNumber = newNumber;
        invoices[idx].updatedAt = new Date().toISOString();
        changes.push({ oldNumber: num, newNumber, invoiceId: invoices[idx].id });
      }
    }
  }

  if (changes.length > 0) {
    saveItem("sgf_invoices", invoices);
  }
  return { changes };
}

/** Repair missing company fields on invoices so they match invoice number prefix. */
export function repairInvoiceCompanies(): void {
  let changed = false;
  for (const inv of invoices) {
    const num = String(inv.invoiceNumber || "");
    if (num.startsWith("RC")) {
      if (inv.company !== "rc") {
        inv.company = "rc";
        inv.updatedAt = new Date().toISOString();
        changed = true;
      }
    } else if (num.startsWith("SGF")) {
      if (inv.company !== "sgf") {
        inv.company = "sgf";
        inv.updatedAt = new Date().toISOString();
        changed = true;
      }
    }
  }
  if (changed) {
    saveItem("sgf_invoices", invoices);
  }
}

// ─── Special exports for router / page direct access ───
export { customers, products, orders, invoices, appointments, checkins, users, specialPrices, getEffectivePrice, getNextInvoiceNumberForCompany };
