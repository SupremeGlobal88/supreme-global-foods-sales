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
