import { STATIC_CUSTOMERS, STATIC_PRODUCTS } from "@/data/staticData";
import { getStorageItem, setStorageItem, removeStorageItem } from "./compressedStorage";
import { pushAudit, pushSystemLog } from "./firebaseSync";

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
let systemLogs = [] as any[];
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
      logSystemEvent("ERROR", "load", `Failed to parse ${key}`, { error: String(e) });
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
    const sysLog = safeLoadArray("sgf_systemLogs");
    systemLogs = sysLog || [];
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
    // Defaults are only injected on first app load when users array is empty.
  } catch { /* ignore */ }

  // ─── CORPORATE MODULE DATA LOADING ───
  const cc = getStorageItem("sgf_corporateCustomers");
  if (cc) { const d = JSON.parse(cc); if (Array.isArray(d)) corporateCustomers = d; }
  else corporateCustomers = [];
  const po = getStorageItem("sgf_purchaseOrders");
  if (po) { const d = JSON.parse(po); if (Array.isArray(d)) purchaseOrders = d; }
  else purchaseOrders = [];
  const br = getStorageItem("sgf_barrels");
  if (br) { const d = JSON.parse(br); if (Array.isArray(d)) barrels = d; }
  else barrels = [];
  const coc = getStorageItem("sgf_certificatesOfCompliance");
  if (coc) { const d = JSON.parse(coc); if (Array.isArray(d)) certificatesOfCompliance = d; }
  else certificatesOfCompliance = [];
  const pll = getStorageItem("sgf_packingListLines");
  if (pll) { const d = JSON.parse(pll); if (Array.isArray(d)) packingListLines = d; }
  else packingListLines = [];
}

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
  systemLogs = [];

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
  collectionNotes = []; collectionPromises = []; accountHolds = []; auditLog = []; systemLogs = []; users = [];
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

export { dataService };
