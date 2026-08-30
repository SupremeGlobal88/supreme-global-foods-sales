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
 *  Returns count of products repaired. */
function repairProductPrices(productList: any[]): number {
  let pricesRestored = 0;
  for (const prod of productList) {
    const hasAnyPrice = Number(prod.wholesalePrice) > 0 || Number(prod.corporatePrice) > 0 || Number(prod.bulkPrice) > 0 || Number(prod.retailPrice) > 0;
    if (hasAnyPrice) continue;

    let match: any = null;
    // 1. Match by productCode (most reliable)
    if (prod.productCode) {
      match = STATIC_PRODUCTS.find((s: any) => s.productCode === prod.productCode);
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
      pricesRestored++;
    }
  }
  return pricesRestored;
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
      const pricesRestored = repairProductPrices(products);
      if (pricesRestored > 0) {
        saveItem("sgf_products", products);
        console.log(`[PriceRepair] Restored prices for ${pricesRestored} products from seed data`);
      }
    } else products = getStaticProducts();

    // TRANSACTION DATA: always load if present (user-generated, never replace with static)
    const o = safeLoadArray("sgf_orders");
    if (o) orders = o;
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

  // AUTO-LINK: Match Sage invoices to customers by customerCode.
  // This runs on every startup so ALL devices get linked Sage invoices
  // without needing to click "Re-link" button in Settings.
  try { autoLinkSageInvoices(); } catch { /* ignore */ }

  // FIX: Activate invoices stuck in draft for delivered/ready orders.
  // This fixes the bug where === vs == caused activateInvoiceFromOrder to fail.
  try { fixDraftInvoicesForDeliveredOrders(); } catch { /* ignore */ }

  // FIX: Assign proper numeric codes to customers with "AUTO", blank, or missing codes
  try { fixMissingCustomerCodes(); } catch { /* ignore */ }

  // FIX: Repair Sage invoice dates that were corrupted by the old date parser.
  // The old code did `20${parts[2]}` on 4-digit years, producing dates like "202026-07-06".
  try { fixSageInvoiceDates(); } catch { /* ignore */ }

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
      console.log(`[SageDate] Fixed ${inv.invoiceNumber}: ${date} → ${inv.invoiceDate}`);
    }
  }
  if (changed > 0) {
    saveItem("sgf_invoices", invoices);
    console.log(`[SageDate] Repaired ${changed} corrupted Sage invoice date(s)`);
  }
  return { changed, invoices: changedInvs };
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

  console.log("[parseBankStatement] Columns found:", {
    invoiceDate: colInvoiceDate, customer: colCustomer, invoiceNo: colInvoiceNo,
    amountDue: colAmountDue, amountPaid: colAmountPaid, paidDate: colPaidDate,
    headers: headers.map((h: any) => String(h).trim()),
  });

  const parsed: BankStatementRow[] = [];
  for (let i = 1; i < rawRows.length; i++) {
    const r = rawRows[i];
    if (!r || r.length === 0) continue;
    const invoiceNumber = colInvoiceNo >= 0 ? String(r[colInvoiceNo] || "").trim() : "";
    // Only process SGF invoices
    if (!invoiceNumber || !/^SGF\d+$/i.test(invoiceNumber)) continue;
    const amountPaidRaw = colAmountPaid >= 0 ? r[colAmountPaid] : 0;
    const amountPaid = typeof amountPaidRaw === "number" ? amountPaidRaw : parseFloat(String(amountPaidRaw || "0").replace(/,/g, "")) || 0;
    // Skip rows with zero amount paid (nothing to allocate)
    if (amountPaid <= 0) continue;
    parsed.push({
      rowIndex: i,
      invoiceDate: colInvoiceDate >= 0 ? String(r[colInvoiceDate] || "").trim() : "",
      customerName: colCustomer >= 0 ? String(r[colCustomer] || "").trim() : "",
      invoiceNumber,
      amountDue: colAmountDue >= 0
        ? (typeof r[colAmountDue] === "number" ? r[colAmountDue] : parseFloat(String(r[colAmountDue] || "0").replace(/,/g, "")) || 0)
        : 0,
      amountPaid,
      paidDate: colPaidDate >= 0 && r[colPaidDate] ? String(r[colPaidDate]).trim() : null,
    });
  }
  console.log("[parseBankStatement] Parsed", parsed.length, "rows from", rawRows.length - 1, "data rows");
  return parsed;
}

/** Simple string similarity (0-100). 100 = exact match. */
function stringSimilarity(a: string, b: string): number {
  const s1 = a.toLowerCase().trim();
  const s2 = b.toLowerCase().trim();
  if (s1 === s2) return 100;
  // Levenshtein distance
  const len = Math.max(s1.length, s2.length);
  if (len === 0) return 100;
  const matrix: number[][] = [];
  for (let i = 0; i <= s1.length; i++) matrix[i] = [i];
  for (let j = 0; j <= s2.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= s1.length; i++) {
    for (let j = 1; j <= s2.length; j++) {
      matrix[i][j] = s1[i - 1] === s2[j - 1]
        ? matrix[i - 1][j - 1]
        : Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
    }
  }
  const dist = matrix[s1.length][s2.length];
  return Math.round(((len - dist) / len) * 100);
}

/** ═══════════════════════════════════════════════════════════════
 *  SALES REP REPORTING HELPERS
 *  ═══════════════════════════════════════════════════════════════ */

/** SGF Office coordinates — 28 Nagington Rd, Wadeville, Germiston
 *  All daily routes start and end here. */
const OFFICE_LAT = -26.2596294;
const OFFICE_LNG = 28.1858534;
const OFFICE_NAME = "SGF Office — 28 Nagington Rd, Wadeville";

/** South African AA travel rate per km (configurable, default R5.50/km) */
let AA_RATE_PER_KM = 5.50;
try {
  const stored = getStorageItem("sgf_aaRatePerKm");
  if (stored) { const v = parseFloat(stored); if (!isNaN(v) && v > 0) AA_RATE_PER_KM = v; }
} catch { /* keep default */ }

export function getAARate(): number { return AA_RATE_PER_KM; }
export function setAARate(rate: number): void {
  AA_RATE_PER_KM = rate;
  try { setStorageItem("sgf_aaRatePerKm", String(rate)); } catch { /* ignore */ }
}

/** ISO week number */
function getWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((+date - +yearStart) / 86400000) + 1) / 7);
}

/** Haversine distance between two lat/lng points in kilometers */
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/** Build a report grouped by sales rep from an array of check-ins */
function buildRepReport(
  checkinList: any[],
  periodType: "daily" | "weekly" | "monthly",
  referenceDate: Date,
  year?: number,
  weekOrMonth?: number
): any {
  // Group check-ins by sales rep
  const byRep = new Map<string, any[]>();
  for (const ci of checkinList) {
    const repName = ci.salesRepName || "Unknown";
    if (!byRep.has(repName)) byRep.set(repName, []);
    byRep.get(repName)!.push(ci);
  }

  const repReports: any[] = [];
  let grandTotalKm = 0;
  let grandTotalCost = 0;
  let grandTotalVisits = 0;
  let grandTotalCustomers = 0;

  for (const [repName, repCheckins] of byRep) {
    // Sort by time for distance calculation
    repCheckins.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    // Calculate distance: Office → Customer 1 → Customer 2 → ... → Last Customer → Office
    let totalKm = 0;
    const routeSegments: any[] = [];

    // Helper to add a segment
    const addSegment = (from: any, to: any) => {
      if (from.lat && from.lng && to.lat && to.lng) {
        const km = haversineKm(from.lat, from.lng, to.lat, to.lng);
        totalKm += km;
        routeSegments.push({
          from: { location: from.location, lat: from.lat, lng: from.lng, time: from.time },
          to: { location: to.location, lat: to.lat, lng: to.lng, time: to.time },
          km: Math.round(km * 100) / 100,
        });
      }
    };

    // 1. Office → First check-in (start of day)
    const first = repCheckins[0];
    if (first) {
      addSegment(
        { location: OFFICE_NAME, lat: OFFICE_LAT, lng: OFFICE_LNG, time: null },
        { location: first.location || "First Visit", lat: first.latitude, lng: first.longitude, time: first.createdAt }
      );
    }

    // 2. Between consecutive check-ins
    for (let i = 1; i < repCheckins.length; i++) {
      const prev = repCheckins[i - 1];
      const curr = repCheckins[i];
      addSegment(
        { location: prev.location || "Unknown", lat: prev.latitude, lng: prev.longitude, time: prev.createdAt },
        { location: curr.location || "Unknown", lat: curr.latitude, lng: curr.longitude, time: curr.createdAt }
      );
    }

    // 3. Last check-in → Office (end of day)
    const last = repCheckins[repCheckins.length - 1];
    if (last) {
      addSegment(
        { location: last.location || "Last Visit", lat: last.latitude, lng: last.longitude, time: last.createdAt },
        { location: OFFICE_NAME, lat: OFFICE_LAT, lng: OFFICE_LNG, time: null }
      );
    }

    // Count unique customers visited
    const uniqueCustomers = new Set(repCheckins.map((ci) => ci.customerId).filter(Boolean));
    const totalVisits = repCheckins.length;
    const totalCost = totalKm * AA_RATE_PER_KM;

    // Build per-visit details
    const visits = repCheckins.map((ci) => ({
      time: ci.createdAt,
      customerName: ci.customer?.name || ci.location || "Unknown",
      customerId: ci.customerId,
      location: ci.location || "",
      latitude: ci.latitude,
      longitude: ci.longitude,
      outcome: ci.outcome || "visit",
      notes: ci.notes || "",
      durationMinutes: ci.durationMinutes || 0,
      status: ci.status,
    }));

    repReports.push({
      salesRep: repName,
      totalVisits,
      uniqueCustomersVisited: uniqueCustomers.size,
      totalKm: Math.round(totalKm * 100) / 100,
      totalCost: Math.round(totalCost * 100) / 100,
      aaRatePerKm: AA_RATE_PER_KM,
      routeSegments,
      visits,
    });

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
      inv.balanceDue = total - newPaid; // Allow negative = customer credit
      if (newPaid >= total) inv.status = "paid";
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
    if (!o) continue; // null-guard
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
    if (!inv) continue; // null-guard
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
    setStorageItem(key, JSON.stringify(value));
  } catch (e: any) {
    // Quota exceeded - clear non-essential data and retry
    if (e.name === 'QuotaExceededError' || e.code === 22) {
      const itemsToClear = ["sgf_audit_log", "sgf_activity_log", "sgf_receipts", "sgf_creditNotes", "fix-invoice-backup", "sgf_invoice_backups"];
      for (const itemKey of itemsToClear) {
        try { removeStorageItem(itemKey); } catch { /* ignore */ }
      }
      try { setStorageItem(key, JSON.stringify(value)); } catch { /* ignore */ }
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
  const product = products.find((p) => p.id == productId);
  return product ? Math.max(0, product.quantity || 0) : 0;
}

// getCommittedStock: kept for reference, counts items from active non-sample orders
function getCommittedStock(productId: number): number {
  return orders
    .filter((o) => o.status !== "delivered" && o.status !== "cancelled" && o.status !== "sample_delivered")
    .flatMap((o) => o.items || [])
    .filter((item: any) => item.stockItemId == productId)
    .reduce((sum: number, item: any) => sum + (item.quantity || 0), 0);
}

// Check if customer already has a sample of this product
function hasExistingSample(customerId: number, stockItemId: number): boolean {
  return orders.some((o) =>
    o.customerId == customerId &&
    o.orderType === "sample" &&
    o.items?.some((item: any) => item.stockItemId == stockItemId)
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
/** Reload ALL data from localStorage into memory — NO validation.
 *  Called after Firebase sync to ensure synced data is loaded.
 *  The isValidArray checks in load() can discard legitimately deduplicated data,
 *  so this function bypasses them and loads directly. */
// Debounce reloadFromStorage to prevent UI freeze when multiple Firebase
// subscriptions fire simultaneously at startup. Each subscription's onValue
// callback calls reloadFromStorage(), which reads ALL data keys from
// localStorage and JSON.parses them. With 15+ subscriptions and 4276 invoices,
// calling this 15+ times in a row blocks the main thread for seconds.
let reloadDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let pendingReload = false;

/** Reload specific in-memory arrays from localStorage.
 *  If `keys` is provided, ONLY those keys are reloaded (much faster when
 *  a single subscription updates one data type). If omitted, ALL keys are
 *  reloaded (legacy behavior, used on initial load). */
export function reloadFromStorage(keys?: string[]): void {
  // If a reload is already scheduled, just mark it as pending
  if (reloadDebounceTimer) {
    pendingReload = true;
    return;
  }

  // Run immediately the first time, then debounce subsequent calls
  _doReloadFromStorage(keys);

  // Set a cooldown period: any calls within 150ms are coalesced into one
  reloadDebounceTimer = setTimeout(() => {
    reloadDebounceTimer = null;
    if (pendingReload) {
      pendingReload = false;
      _doReloadFromStorage(keys);
    }
  }, 150);
}

/** The actual reload logic — separated so debounce wrapper can call it. */
function _doReloadFromStorage(keys?: string[]): void {
  const reloadAll = !keys || keys.length === 0;

  if (reloadAll || keys?.includes("sgf_customers")) {
    try {
      const c = getStorageItem("sgf_customers");
      if (c) { const d = JSON.parse(c); if (Array.isArray(d) && d.length > 0) customers = d; }
    } catch { /* keep current */ }
  }
  if (reloadAll || keys?.includes("sgf_products")) {
    try {
      const p = getStorageItem("sgf_products");
      if (p) { const d = JSON.parse(p); if (Array.isArray(d) && d.length > 0) products = d; }
      // PRICE REPAIR after every cloud sync: Firebase may have 0-price products
      const pricesRestored = repairProductPrices(products);
      if (pricesRestored > 0) {
        saveItem("sgf_products", products);
        console.log(`[PriceRepair] Reload repaired ${pricesRestored} products after cloud sync`);
        // Notify app that products were repaired so Firebase can be updated
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("sgf:productsRepaired", { detail: { products, count: pricesRestored } }));
        }
      }
    } catch { /* keep current */ }
  }
  if (reloadAll || keys?.includes("sgf_orders")) {
    try {
      const o = getStorageItem("sgf_orders");
      if (o) { const d = JSON.parse(o); if (Array.isArray(d)) orders = d; }
    } catch { /* keep current */ }
  }
  if (reloadAll || keys?.includes("sgf_invoices")) {
    try {
      const i = getStorageItem("sgf_invoices");
      if (i) {
        const d = JSON.parse(i);
        if (Array.isArray(d)) {
          // Ensure all invoices have updatedAt for timestamp-based merge
          const now = new Date().toISOString();
          for (const inv of d) {
            if (!inv.updatedAt) inv.updatedAt = inv.createdAt || inv.invoiceDate || now;
          }
          invoices = d;
        }
      }
    } catch { /* keep current */ }
  }
  if (reloadAll || keys?.includes("sgf_appointments")) {
    try {
      const a = getStorageItem("sgf_appointments");
      if (a) { const d = JSON.parse(a); if (Array.isArray(d)) appointments = d; }
    } catch { /* keep current */ }
  }
  if (reloadAll || keys?.includes("sgf_checkins")) {
    try {
      const ci = getStorageItem("sgf_checkins");
      if (ci) { const d = JSON.parse(ci); if (Array.isArray(d)) checkins = d; }
    } catch { /* keep current */ }
  }
  if (reloadAll || keys?.includes("sgf_specialPrices")) {
    try {
      const s = getStorageItem("sgf_specialPrices");
      if (s) { const d = JSON.parse(s); if (Array.isArray(d)) specialPrices = d; }
    } catch { /* keep current */ }
  }
  if (reloadAll || keys?.includes("sgf_auditLog")) {
    try {
      const log = getStorageItem("sgf_auditLog");
      if (log) { const d = JSON.parse(log); if (Array.isArray(d)) auditLog = d; }
    } catch { /* keep current */ }
  }
  if (reloadAll || keys?.includes("sgf_followUps")) {
    try {
      const fu = getStorageItem("sgf_followUps");
      if (fu) { const d = JSON.parse(fu); if (Array.isArray(d)) followUps = d; }
    } catch { /* keep current */ }
  }
  if (reloadAll || keys?.includes("sgf_followUpActions")) {
    try {
      const fa = getStorageItem("sgf_followUpActions");
      if (fa) { const d = JSON.parse(fa); if (Array.isArray(d)) followUpActions = d; }
    } catch { /* keep current */ }
  }
  if (reloadAll || keys?.includes("sgf_collectionNotes")) {
    try {
      const cn = getStorageItem("sgf_collectionNotes");
      if (cn) { const d = JSON.parse(cn); if (Array.isArray(d)) collectionNotes = d; }
    } catch { /* keep current */ }
  }
  if (reloadAll || keys?.includes("sgf_collectionPromises")) {
    try {
      const cp = getStorageItem("sgf_collectionPromises");
      if (cp) { const d = JSON.parse(cp); if (Array.isArray(d)) collectionPromises = d; }
    } catch { /* keep current */ }
  }
  if (reloadAll || keys?.includes("sgf_accountHolds")) {
    try {
      const ah = getStorageItem("sgf_accountHolds");
      if (ah) { const d = JSON.parse(ah); if (Array.isArray(d)) accountHolds = d; }
    } catch { /* keep current */ }
  }
  if (reloadAll || keys?.includes("sgf_receipts")) {
    try {
      const rc = getStorageItem("sgf_receipts");
      if (rc) { const d = JSON.parse(rc); if (Array.isArray(d)) receipts = d; }
    } catch { /* keep current */ }
  }
  if (reloadAll || keys?.includes("sgf_creditNotes")) {
    try {
      const crn = getStorageItem("sgf_creditNotes");
      if (crn) { const d = JSON.parse(crn); if (Array.isArray(d)) creditNotes = d; }
    } catch { /* keep current */ }
  }
  if (reloadAll || keys?.includes("sgf_users")) {
    try {
      const u = getStorageItem("sgf_users");
      if (u) { const d = JSON.parse(u); if (Array.isArray(d) && d.length > 0) users = d; }
    } catch { /* keep current */ }
  }
  if (reloadAll || keys?.includes("sgf_salesReps")) {
    try {
      const sr = getStorageItem("sgf_salesReps");
      if (sr) {
        const d = JSON.parse(sr);
        if (Array.isArray(d) && d.length > 0) {
          // Backward compat: migrate legacy string arrays to objects
          SALES_REPS.length = 0;
          SALES_REPS.push(...d.map((r: any): SalesRep => {
            if (typeof r === "string") return { name: r, isActive: true };
            return {
              name: r?.name || String(r || ""),
              email: r?.email || "",
              phone: r?.phone || "",
              region: r?.region || "",
              vehicleReg: r?.vehicleReg || "",
              isActive: r?.isActive !== false,
            };
          }).filter((r: SalesRep) => r.name));
        }
      }
    } catch { /* keep current */ }
  }
  if (reloadAll || keys?.includes("sgf_corporateCustomers")) {
    try {
      const cc = getStorageItem("sgf_corporateCustomers");
      if (cc) { const d = JSON.parse(cc); if (Array.isArray(d)) corporateCustomers = d; }
    } catch { /* keep current */ }
  }
  if (reloadAll || keys?.includes("sgf_purchaseOrders")) {
    try {
      const po = getStorageItem("sgf_purchaseOrders");
      if (po) { const d = JSON.parse(po); if (Array.isArray(d)) purchaseOrders = d; }
    } catch { /* keep current */ }
  }
  if (reloadAll || keys?.includes("sgf_barrels")) {
    try {
      const br = getStorageItem("sgf_barrels");
      if (br) { const d = JSON.parse(br); if (Array.isArray(d)) barrels = d; }
    } catch { /* keep current */ }
  }
  if (reloadAll || keys?.includes("sgf_certificatesOfCompliance") || keys?.includes("sgf_cocs")) {
    try {
      // Support both keys: sgf_cocs (used by subscriptions) and sgf_certificatesOfCompliance
      const coc = getStorageItem("sgf_cocs") || getStorageItem("sgf_certificatesOfCompliance");
      if (coc) { const d = JSON.parse(coc); if (Array.isArray(d)) certificatesOfCompliance = d; }
    } catch { /* keep current */ }
  }
  if (reloadAll || keys?.includes("sgf_packingListLines")) {
    try {
      const pll = getStorageItem("sgf_packingListLines");
      if (pll) { const d = JSON.parse(pll); if (Array.isArray(d)) packingListLines = d; }
    } catch { /* keep current */ }
  }
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
 *  PRESERVES real invoice totals — sample invoices show actual values with balanceDue=0.
 *  The invoice document shows what was sampled; the balanceDue=0 means no charge. */
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

    // Calculate REAL totals from order items (never zero these out)
    const items = order.items || [];
    const subtotal = items.reduce((sum: number, item: any) => sum + (item.lineTotal || 0), 0);
    // Check if customer is VAT exempt
    const customer = customers.find((c) => c.id == order.customerId);
    const vatRate = customer?.vatExempt ? 0 : 0.15;
    const vatAmount = subtotal * vatRate;
    const total = subtotal + vatAmount;

    // Fix 2: Ensure a proper SGF invoice exists
    const existingInvoice = invoices.find((i) => i.orderId == order.id);
    if (!existingInvoice) {
      // Create a new SGF invoice for this sample order WITH REAL TOTALS
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
        customer: customers.find((c) => c.id == order.customerId) || null,
        subtotal,
        vatAmount,
        total,
        totalAmount: total,
        balanceDue: 0, // Sample = no charge, but totals show real values
        amountPaid: 0,
        status: "paid",
        paymentTerms: order.paymentTerms || "cod",
        invoiceDate: order.createdAt || now.toISOString(),
        dueDate: now.toISOString(),
        notes: `Sample order - ${order.orderNumber} (No Charge) | Subtotal: R ${subtotal.toFixed(2)} + VAT: R ${vatAmount.toFixed(2)} = Total: R ${total.toFixed(2)}`,
        items: (order.items || []).map((item: any) => ({
          description: `${item.productCode || ""} - ${item.productName || ""}`.trim(),
          quantity: item.quantity,
          unitPrice: item.unitPrice || 0,
          lineTotal: item.lineTotal || 0,
          stockItemId: item.stockItemId || null,
          productCode: item.productCode || "",
          productName: item.productName || "",
        })),
        createdAt: order.createdAt || now.toISOString(),
        updatedAt: now.toISOString(),
      });
      invoicesCreated++;
      details.push(`Order ${order.orderNumber}: created invoice ${invoiceNumber} with REAL totals R ${total.toFixed(2)}`);
    } else if (existingInvoice && !existingInvoice.invoiceNumber?.startsWith("SGF")) {
      // Fix existing non-SGF invoice number — PRESERVE real totals
      const oldNum = existingInvoice.invoiceNumber;
      existingInvoice.invoiceNumber = getNextInvoiceNumber();
      existingInvoice.subtotal = subtotal;
      existingInvoice.vatAmount = vatAmount;
      existingInvoice.total = total;
      existingInvoice.totalAmount = total;
      existingInvoice.balanceDue = 0;
      existingInvoice.status = "paid";
      existingInvoice.notes = `Sample order - ${order.orderNumber} (No Charge) | Subtotal: R ${subtotal.toFixed(2)} + VAT: R ${vatAmount.toFixed(2)} = Total: R ${total.toFixed(2)}`;
      existingInvoice.items = (order.items || []).map((item: any) => ({
        description: `${item.productCode || ""} - ${item.productName || ""}`.trim(),
        quantity: item.quantity,
        unitPrice: item.unitPrice || 0,
        lineTotal: item.lineTotal || 0,
        stockItemId: item.stockItemId || null,
        productCode: item.productCode || "",
        productName: item.productName || "",
      }));
      details.push(`Order ${order.orderNumber}: invoice renumbered ${oldNum} → ${existingInvoice.invoiceNumber} with REAL totals R ${total.toFixed(2)}`);
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

/** Get next Recircle SA invoice number. Starts at RC0412.
 *  Separate series from SGF invoices — RC prefix for Recircle SA. */
function getNextRecircleInvoiceNumber(): string {
  let maxNum = 411; // Last known Recircle invoice (RC0411)
  for (const inv of invoices) {
    const match = (inv.invoiceNumber || "").match(/RC(\d+)/);
    if (match) {
      const n = parseInt(match[1]);
      if (n > maxNum) maxNum = n;
    }
  }
  let candidate = maxNum + 1;
  const existingNumbers = new Set(invoices.map((i) => i.invoiceNumber));
  while (existingNumbers.has(`RC${String(candidate).padStart(4, "0")}`)) {
    candidate++;
  }
  return `RC${String(candidate).padStart(4, "0")}`;
}

/** Get the correct next invoice number based on company */
function getNextInvoiceNumberForCompany(company?: string): string {
  if (company === "recircle") return getNextRecircleInvoiceNumber();
  return getNextInvoiceNumber();
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

function createInvoiceFromOrder(order: any, subtotal: number, vatAmount: number, total: number, isSample: boolean, company?: string, vatRate?: number): string | null {
  // ACQUIRE LOCK: prevent concurrent generation that causes duplicate numbers
  if (invoiceGenerationLock) {
    console.warn("[createInvoiceFromOrder] LOCKED — another invoice is being generated. Please wait.");
    return null;
  }
  invoiceGenerationLock = true;

  try {
    const now = new Date();
    const customer = customers.find((c) => c.id == order.customerId);

    // Calculate due date from payment terms
    const paymentTerms = order.paymentTerms || "cod";
    const days = paymentTerms === "30_days" ? 30 : paymentTerms === "14_days" ? 14 : paymentTerms === "7_days" ? 7 : 0;
    const dueDate = new Date(now);
    dueDate.setDate(dueDate.getDate() + days);

    // Invoice numbering: SGF or RC prefix based on company
    const invCompany = company || order.company || "sgf";
    let invoiceNumber = getNextInvoiceNumberForCompany(invCompany);
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
      company: invCompany,
      customerId: order.customerId,
      customer: customer || null,
      subtotal: isSample ? subtotal : subtotal,
      vatAmount: isSample ? vatAmount : vatAmount,
      vatRate: vatRate !== undefined ? vatRate : 0.15,
      total: isSample ? total : total,
      totalAmount: isSample ? total : total,
      balanceDue: isSample ? 0 : total,
      amountPaid: isSample ? 0 : 0,
      status: isSample ? "paid" : status,
      paymentTerms: order.paymentTerms || "cod",
      invoiceDate: now.toISOString(),
      dueDate: dueDate.toISOString(),
      notes: isSample ? `Sample order - ${order.orderNumber} (No Charge) | Subtotal: R ${subtotal.toFixed(2)} + VAT: R ${vatAmount.toFixed(2)} = Total: R ${total.toFixed(2)}` : `Invoice for ${order.orderNumber}`,
      items: (order.items || []).map((item: any) => ({
        description: `${item.productCode} - ${item.productName}`,
        quantity: item.quantity,
        unitPrice: item.unitPrice || 0,
        lineTotal: item.lineTotal || 0,
        stockItemId: item.stockItemId || null,
        productCode: item.productCode || "",
        productName: item.productName || "",
      })),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });
    saveItem("sgf_invoices", invoices);

    // CRITICAL: Link the order to the newly created invoice so the Orders page shows "Invoice Generated"
    order.invoiceNumber = invoiceNumber;
    const orderIdx = orders.findIndex((o) => o.id == order.id);
    if (orderIdx >= 0) {
      orders[orderIdx].invoiceNumber = invoiceNumber;
      orders[orderIdx].updatedAt = now.toISOString();
      saveItem("sgf_orders", orders);
    }

    return invoiceNumber;
  } finally {
    // RELEASE LOCK: always release even if an error occurred
    invoiceGenerationLock = false;
  }
}

/** Force-correct invoice company based on invoice number prefix.
 *  SGF* -> "sgf", RC-* -> "recircle". Prevents badge/number mismatches. */
function repairInvoiceCompany(inv: any): any {
  if (!inv || !inv.invoiceNumber) return inv;
  const num = inv.invoiceNumber;
  if (num.startsWith("SGF")) return { ...inv, company: "sgf" };
  if (num.startsWith("RC-")) return { ...inv, company: "recircle" };
  return inv;
}

/** Repair ALL invoices on startup — fixes historical data mismatches
 *  where company field doesn't match invoice number prefix. */
export function repairInvoiceCompanies(): { repaired: number } {
  let repaired = 0;
  for (let i = 0; i < invoices.length; i++) {
    const fixed = repairInvoiceCompany(invoices[i]);
    if (fixed.company !== invoices[i].company) {
      invoices[i] = fixed;
      repaired++;
    }
  }
  if (repaired > 0) {
    saveItem("sgf_invoices", invoices);
    console.log(`[repairInvoiceCompanies] Fixed ${repaired} invoices with mismatched company field`);
  }
  return { repaired };
}

/** Generate an invoice for an existing order that doesn't have one.
 *  Caller MUST call reloadFromStorage() before this to ensure fresh data. */
export function generateInvoiceForOrder(orderId: number): string | null {
  // Use loose equality (==) because Firebase may convert number IDs to strings
  const order = orders.find((o) => o.id == orderId);
  if (!order) return null;
  // Detect sample orders
  const isSample = order.orderType === "sample" || (order.orderNumber || "").startsWith("SMP-");
  // Check if customer is VAT exempt
  const customer = customers.find((c) => c.id == order.customerId);
  const vatRate = customer?.vatExempt ? 0 : 0.15;
  // Calculate totals
  const items = order.items || [];
  const subtotal = items.reduce((sum: number, item: any) => sum + (item.lineTotal || 0), 0);
  const vatAmount = subtotal * vatRate;
  const total = subtotal + vatAmount;
  // Check if invoice already exists — UPDATE it with new order data
  const existingIdx = invoices.findIndex((i) => i.orderId == orderId);
  if (existingIdx >= 0) {
    const existing = invoices[existingIdx];
    // PRESERVE payments and credit notes when updating invoice from order.
    // Only recalculate balance if total changed — subtract existing payments.
    const oldTotal = Number(existing.total || existing.totalAmount || 0);
    const newTotal = total;
    const amountPaid = Number(existing.amountPaid || 0);
    let newBalanceDue = Math.abs(newTotal - oldTotal) > 0.01
      ? newTotal - amountPaid
      : (existing.balanceDue !== undefined ? existing.balanceDue : newTotal - amountPaid);
    // Sample orders always have R 0 balance due (no charge)
    if (isSample) newBalanceDue = 0;
    invoices[existingIdx] = {
      ...existing,
      items: items.map((item: any) => ({
        stockItemId: item.stockItemId,
        productName: item.productName,
        description: `${item.productCode || ""} - ${item.productName || ""}`.trim(),
        quantity: item.quantity,
        unitPrice: item.unitPrice || 0,
        lineTotal: item.lineTotal || 0,
      })),
      subtotal,
      vatAmount,
      vatRate,
      total: newTotal,
      totalAmount: newTotal,
      balanceDue: newBalanceDue,
      paymentTerms: order.paymentTerms || "cod",
      updatedAt: new Date().toISOString(),
      notes: isSample ? `Sample order ${order.orderNumber || ""}` : `Invoice for ${order.orderNumber || ""}`,
    };
    saveItem("sgf_invoices", invoices);
    logAudit("UPDATE", "invoice", existing.id, `Updated invoice ${existing.invoiceNumber} for order ${order.orderNumber || orderId} balance=${newBalanceDue.toFixed(2)}`, order.salesRepName);
    return existing.invoiceNumber;
  }
  // SAMPLE ORDERS ARE ALWAYS SGF — force company to "sgf" regardless of order.company
  const invoiceCompany = isSample ? "sgf" : (order.company || "sgf");
  return createInvoiceFromOrder(order, subtotal, vatAmount, total, isSample, invoiceCompany, vatRate);
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
      const customer = customers.find((c) => c.id == order.customerId);
      const vatRate = customer?.vatExempt ? 0 : 0.15;
      const items = order.items || [];
      const subtotal = items.reduce((sum: number, item: any) => sum + (item.lineTotal || 0), 0);
      const vatAmount = subtotal * vatRate;
      const total = subtotal + vatAmount;
      const isSample = order.orderType === "sample" || (order.orderNumber || "").startsWith("SMP-");
      // Sample orders are always SGF
      const invoiceCompany = isSample ? "sgf" : (order.company || "sgf");
      const invNum = createInvoiceFromOrder(order, subtotal, vatAmount, total, isSample, invoiceCompany, vatRate);
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

/** Generate an invoice from a Purchase Order (corporate customer).
 *  Creates an invoice with PO items as line items.
 *  Uses SGFXXXX for SGF or RC0412+ for Recircle SA based on PO company.
 *  Returns the invoice number or null. */
/** Remove duplicate orders, invoices, and customers. Call after Firebase sync or on demand. */
export function deduplicateData(): { ordersRemoved: number; invoicesRemoved: number; customersRemoved: number } {
  // Do NOT call load() here — it has isValidArray() checks that can discard
  // legitimately deduplicated data and load static defaults instead.
  // The arrays are already in memory from reloadFromStorage().
  const result = deduplicateAll();
  return result;
}

/** Update an existing invoice when its order is edited */
function updateInvoiceFromOrder(order: any) {
  const idx = invoices.findIndex((i) => i.orderId == order.id);
  if (idx < 0) return; // No invoice exists for this order

  const inv = invoices[idx];
  const customer = customers.find((c) => c.id == order.customerId);

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
  // Use loose equality (==) because Firebase may convert number IDs to strings
  const idx = invoices.findIndex((i) => i.orderId == orderId);
  if (idx >= 0 && invoices[idx].status === "draft") {
    invoices[idx].status = "sent";
    invoices[idx].updatedAt = new Date().toISOString();
    saveItem("sgf_invoices", invoices);
    console.log(`[Invoice] Activated invoice ${invoices[idx].invoiceNumber} for delivered order ${orderId}`);
  }
}

/** When order is cancelled, also cancel its linked invoice (if any).
 *  Returns the cancelled invoice so caller can push to Firebase (cloud-first). */
function cancelInvoiceFromOrder(orderId: number): any | null {
  // Use loose equality (==) because Firebase may convert number IDs to strings
  const idx = invoices.findIndex((i) => i.orderId == orderId);
  if (idx >= 0 && invoices[idx].status !== "cancelled") {
    const oldInvStatus = invoices[idx].status;
    invoices[idx].status = "cancelled";
    invoices[idx].updatedAt = new Date().toISOString();
    invoices[idx].cancelledAt = new Date().toISOString();
    invoices[idx].cancellationReason = "Order cancelled";
    saveItem("sgf_invoices", invoices);
    console.log(`[Invoice] Cancelled invoice ${invoices[idx].invoiceNumber} (was ${oldInvStatus}) because order ${orderId} was cancelled`);
    return invoices[idx];
  }
  return null;
}

/** Fix invoices stuck in "draft" whose orders are already delivered/ready.
 *  This repairs data corrupted by the old === bug in activateInvoiceFromOrder.
 *  Returns changed invoices so caller can push to Firebase (cloud-first). */
export function fixDraftInvoicesForDeliveredOrders(): { changed: number; invoices: any[] } {
  let changed = 0;
  const changedInvs: any[] = [];
  for (const inv of invoices) {
    if (inv.status !== "draft") continue;
    // Use loose equality (==) because Firebase may convert number IDs to strings
    const order = orders.find((o) => o.id == inv.orderId);
    if (order && (order.status === "delivered" || order.status === "ready")) {
      inv.status = "sent";
      inv.updatedAt = new Date().toISOString();
      changed++;
      changedInvs.push(inv);
    }
  }
  if (changed > 0) {
    saveItem("sgf_invoices", invoices);
    console.log(`[Invoice] Fixed ${changed} invoice(s) stuck in draft for delivered/ready orders`);
  }
  return { changed, invoices: changedInvs };
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
    getById: (id: number) => products.find((p) => p.id == id) || null,
    getCategories: () => [...new Set(products.map((p) => p.category).filter(Boolean))].sort(),
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
      const idx = products.findIndex((p) => p.id == id);
      if (idx >= 0) { products[idx] = { ...products[idx], ...data, updatedAt: new Date().toISOString() }; saveItem("sgf_products", products); return products[idx]; }
      return null;
    },
    delete: (id: number) => {
      products = products.filter((p) => p.id != id);
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
        let existingIdx = products.findIndex(
          (p) => (p.productName || "").toLowerCase().trim() === (incoming.productName || "").toLowerCase().trim()
        );
        // Fallback: if no name match, try matching by ALL non-empty shared attributes
        if (existingIdx < 0) {
          const inStrands = String(incoming.strands || "").trim().toLowerCase();
          const inSize    = String(incoming.size    || "").trim().toLowerCase();
          const inGrade   = String(incoming.grade   || "").trim().toLowerCase();
          const inColor   = String(incoming.color   || "").trim().toLowerCase();
          const inSpecies = String(incoming.species || "").trim().toLowerCase();
          existingIdx = products.findIndex((p) => {
            const pStrands = String(p.strands || "").trim().toLowerCase();
            const pSize    = String(p.size    || "").trim().toLowerCase();
            const pGrade   = String(p.grade   || "").trim().toLowerCase();
            const pColor   = String(p.color   || "").trim().toLowerCase();
            const pSpecies = String(p.species || "").trim().toLowerCase();
            let possible = 0, matched = 0;
            if (pStrands && inStrands) { possible++; if (pStrands === inStrands) matched++; }
            if (pSize    && inSize)    { possible++; if (pSize    === inSize)    matched++; }
            if (pGrade   && inGrade)   { possible++; if (pGrade   === inGrade)   matched++; }
            if (pColor   && inColor)   { possible++; if (pColor   === inColor)   matched++; }
            if (pSpecies && inSpecies) { possible++; if (pSpecies === inSpecies) matched++; }
            return possible >= 2 && matched === possible;
          });
        }
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

        const order = orders.find((o) => o.id == inv.orderId);
        if (!order) continue;

        const customer = customers.find((c) => c.id == inv.customerId || c.id == order.customerId);
        if (!customer) continue;

        const repName = customer.salesRepName || customer.salesRep || "";
        const priceTier = customer.priceTier || "retail";

        for (const item of inv.items || order.items || []) {
          const product = products.find((p) => p.id == item.stockItemId);
          const specialPrice = specialPrices.find(
            (sp: any) => sp.customerId == customer.id && sp.stockItemId == item.stockItemId
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

    /** Stock Reconciliation — shows current SOH vs total ordered vs starting SOH.
     *  Helps verify that uploaded stock minus orders equals current stock. */
    reconcileStock: ({ from, to }: { from?: string; to?: string } = {}) => {
      const fromDate = from || new Date().toISOString().slice(0, 10);
      const toDate = to || fromDate;
      const fromTs = new Date(fromDate + "T00:00:00").getTime();
      const toTs = new Date(toDate + "T23:59:59").getTime();

      const results: any[] = [];

      for (const product of products) {
        // Count total quantity ordered for this product in the date range
        let totalOrdered = 0;
        const orderDetails: any[] = [];

        for (const order of orders) {
          const orderTs = new Date(order.createdAt || order.orderDate).getTime();
          if (orderTs < fromTs || orderTs > toTs) continue;
          if (order.status === "cancelled") continue;

          for (const item of (order.items || [])) {
            if (item.stockItemId == product.id) {
              totalOrdered += Number(item.quantity || 0);
              orderDetails.push({
                orderNumber: order.orderNumber,
                customer: order.customerName || (order.customer?.name) || "Unknown",
                quantity: item.quantity,
                orderDate: order.createdAt,
              });
            }
          }
        }

        // Only include products that had orders OR have current stock
        if (totalOrdered > 0 || (product.quantity || 0) > 0) {
          results.push({
            productId: product.id,
            productCode: product.productCode || "",
            productName: product.productName || "",
            category: product.category || "",
            currentStock: product.quantity || 0,
            totalOrdered,
            startingStock: (product.quantity || 0) + totalOrdered,
            unit: product.unit || "",
            status: product.status || "unknown",
            orderDetails: orderDetails.sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime()),
          });
        }
      }

      return {
        from: fromDate,
        to: toDate,
        generatedAt: new Date().toISOString(),
        totalProducts: results.length,
        totalCurrentStock: results.reduce((s, r) => s + r.currentStock, 0),
        totalOrdered: results.reduce((s, r) => s + r.totalOrdered, 0),
        items: results.sort((a, b) => b.totalOrdered - a.totalOrdered),
      };
    },
  },

  customer: {
    list: () => customers,
    search: ({ query }: { query: string }) => searchItems(customers, query),
    getById: (id: number) => customers.find((c) => c.id == id) || null,
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
      const idx = customers.findIndex((c) => c.id == id);
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
      const cust = customers.find((c) => c.id == id);
      if (cust) {
        logAudit("DELETE", "customer", id, `Deleted customer: ${cust.name} (${cust.customerCode}) \u2014 Sales Rep: ${cust.salesRepName || "Unassigned"}`);
      }
      customers = customers.filter((c) => c.id != id);
      saveItem("sgf_customers", customers);
      return { success: true };
    },
    getStats: () => ({
      total: customers.length,
      active: customers.filter((c) => c.isActive === "active").length,
      inactive: customers.filter((c) => c.isActive !== "active").length,
      thisMonth: customers.length,
    }),
    getSalesReps: () => {
      // Merge sales reps from two sources:
      // 1. Active users with sales_rep role (from Firebase-synced users)
      // 2. Legacy SALES_REPS array (for backward compatibility)
      // This ensures all reps appear regardless of how they were added.
      const fromUsers = users
        .filter((u: any) => u.role === "sales_rep" && u.isActive !== false)
        .map((u: any) => u.name);
      // Extract names from SalesRep objects for dropdown compatibility
      const fromLegacy = getCurrentSalesReps().map((r) => r.name);
      // Deduplicate and sort
      const allReps = Array.from(new Set([...fromUsers, ...fromLegacy]))
        .sort((a: string, b: string) => a.localeCompare(b));
      return allReps;
    },
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
            .filter((o) => o.customerId == c.id)
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
        const customer = customers.find((c) => c.id == o.customerId);
        return { ...o, customer: customer || null };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    getById: (id: number) => {
      const order = orders.find((o) => o.id == id);
      if (!order) return null;
      const customer = customers.find((c) => c.id == order.customerId);
      return { ...order, customer: customer || null };
    },
    create: (data: any) => {
      const isSample = data.orderType === "sample";
      const isQuote = data.orderType === "quote";
      
      // STOCK VALIDATION: Check availability before creating order (skip for quotes)
      const requestedItems = data.items || [];
      if (!isQuote) {
        for (const item of requestedItems) {
          const product = products.find((p) => p.id == item.stockItemId);
          if (!product) continue;
          // Calculate committed stock (non-delivered/cancelled orders)
          const committed = orders
            .filter((o) => o.status !== "delivered" && o.status !== "cancelled" && o.status !== "sample_delivered")
            .flatMap((o) => o.items || [])
            .filter((it: any) => it.stockItemId == item.stockItemId)
            .reduce((sum: number, it: any) => sum + (it.quantity || 0), 0);
          const available = Math.max(0, (product.quantity || 0) - committed);
          const requestedQty = isSample ? 1 : (item.quantity || 0);
          if (requestedQty > available) {
            throw new Error(`Insufficient stock for ${product.productName}. Available: ${available}, Requested: ${requestedQty}`);
          }
        }
      }
      
      // Generate unique order number: date + HHMM + ms-based 4-digit suffix
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const now = new Date();
      const hhmm = String(now.getHours()).padStart(2, "0") + String(now.getMinutes()).padStart(2, "0");
      const msCounter = String(Date.now() % 10000).padStart(4, "0");
      const prefix = isSample ? "SMP" : isQuote ? "QTE" : "ORD";
      const orderNumber = `${prefix}-${dateStr}-${hhmm}${msCounter}`;
      
      const items = (data.items || []).map((item: any) => {
        const product = products.find((p) => p.id == item.stockItemId);
        const conversion = item.conversion || 1;
        const basePrice = getEffectivePrice(item.stockItemId, isSample ? "corporate" : data.priceTier, data.customerId);
        const unitPrice = isSample ? basePrice : (item.unitPrice && item.unitPrice > 0 ? item.unitPrice : basePrice * conversion);
        return {
          ...item,
          productCode: product?.productCode || "",
          productName: product?.productName || "Unknown",
          lineTotal: unitPrice * item.quantity,
          unitPrice,
          unit: item.unit || "each",
          conversion,
          unitLabel: item.unitLabel || (conversion === 1 ? "Each" : `${conversion} units`),
        };
      });
      
      const subtotal = isSample ? 0 : items.reduce((sum: number, item: any) => sum + item.lineTotal, 0);
      const vatAmount = isSample ? 0 : subtotal * 0.15;
      const total = isSample ? 0 : subtotal + vatAmount;
      
      // ZERO AMOUNT VALIDATION: Reject orders with R0 total (skip for samples/quotes)
      if (!isSample && !isQuote && total <= 0) {
        throw new Error("Order total is R0.00. Please enter a valid unit price for each item before placing the order.");
      }

      // BELOW-CORPORATE PRICE VALIDATION: Reject if any custom unit price is below corporate floor
      // Skip for samples and quotes. Admin can override with data.adminApproved === true.
      if (!isSample && !isQuote) {
        const belowCorporateItems: string[] = [];
        for (const item of items) {
          const product = products.find((p) => p.id == item.stockItemId);
          if (!product) continue;
          // Only check items where a custom price was explicitly entered
          const customPrice = (data.items || []).find((it: any) => it.stockItemId == item.stockItemId)?.unitPrice;
          if (customPrice && customPrice > 0) {
            const conversion = item.conversion || 1;
            const corporateFloor = Number(product.corporatePrice || 0) * conversion;
            // Allow 1% tolerance for rounding
            if (customPrice < corporateFloor * 0.99) {
              belowCorporateItems.push(`${product.productName} (R${customPrice.toFixed(2)} < floor R${corporateFloor.toFixed(2)})`);
            }
          }
        }
        if (belowCorporateItems.length > 0 && data.adminApproved !== true) {
          throw new Error(
            `BELOW CORPORATE PRICE: The following items are priced below the corporate floor:\n${belowCorporateItems.join("\n")}\n\nSuper admin approval required to place this order.`
          );
        }
      }
      
      const newOrder = {
        ...data,
        id: Date.now(),
        orderNumber,
        status: isQuote ? "draft" : "pending",
        items,
        subtotal,
        vatAmount,
        total,
        totalAmount: total,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      orders.push(newOrder);

      // DEDUCT STOCK for each item (skip for quotes — stock is only committed when converted to order)
      if (!isQuote) {
        for (const item of items) {
          const prodIdx = products.findIndex((p) => p.id == item.stockItemId);
          if (prodIdx >= 0) {
            const conversion = item.conversion || 1;
            const deductQty = item.quantity * conversion;
            const newQty = Math.max(0, (products[prodIdx].quantity || 0) - deductQty);
            products[prodIdx].quantity = newQty;
            products[prodIdx].status = newQty === 0 ? "out_of_stock" : newQty < 20 ? "low_stock" : "in_stock";
          }
        }
        saveItem("sgf_products", products);
      }
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

      return newOrder;
    },
    update: ({ id, data }: { id: number; data: any }) => {
      const idx = orders.findIndex((o) => o.id == id);
      if (idx >= 0) {
        const oldOrder = orders[idx];
        const isQuote = oldOrder.orderType === "quote";
        const isSample = data.orderType === "sample" || oldOrder.orderType === "sample";
        
        // RESTORE old stock first (skip for quotes — they never deducted stock)
        if (!isQuote) {
          for (const item of (oldOrder.items || [])) {
            const prodIdx = products.findIndex((p) => p.id == item.stockItemId);
            if (prodIdx >= 0) {
              const conversion = item.conversion || 1;
              const restoreQty = item.quantity * conversion;
              const newQty = (products[prodIdx].quantity || 0) + restoreQty;
              products[prodIdx].quantity = newQty;
              products[prodIdx].status = newQty === 0 ? "out_of_stock" : newQty < 20 ? "low_stock" : "in_stock";
            }
          }
        }
        
        // Apply new items with fresh calculations
        const items = (data.items || []).map((item: any) => {
          const product = products.find((p) => p.id == item.stockItemId);
          const conversion = item.conversion || 1;
          const basePrice = getEffectivePrice(item.stockItemId, isSample ? "corporate" : data.priceTier, data.customerId);
          const unitPrice = isSample ? basePrice : (item.unitPrice && item.unitPrice > 0 ? item.unitPrice : basePrice * conversion);
          return { ...item, productCode: product?.productCode || "", productName: product?.productName || "Unknown", lineTotal: unitPrice * item.quantity, unitPrice, unit: item.unit || "each", conversion, unitLabel: item.unitLabel || "Each" };
        });
        const subtotal = isSample ? 0 : items.reduce((sum: number, item: any) => sum + item.lineTotal, 0);
        const vatAmount = isSample ? 0 : subtotal * 0.15;
        const total = isSample ? 0 : subtotal + vatAmount;
        
        // DEDUCT new stock (skip for quotes)
        if (!isQuote) {
          for (const item of items) {
            const prodIdx = products.findIndex((p) => p.id == item.stockItemId);
            if (prodIdx >= 0) {
              const conversion = item.conversion || 1;
              const deductQty = item.quantity * conversion;
              const newQty = Math.max(0, (products[prodIdx].quantity || 0) - deductQty);
              products[prodIdx].quantity = newQty;
              products[prodIdx].status = newQty === 0 ? "out_of_stock" : newQty < 20 ? "low_stock" : "in_stock";
            }
          }
          saveItem("sgf_products", products);
        }
        
        orders[idx] = { ...oldOrder, ...data, items, subtotal, vatAmount, total, totalAmount: total, updatedAt: new Date().toISOString() };
        saveItem("sgf_orders", orders);
        
        // Auto-update linked invoice with new order details (skip for quotes — they have no invoices)
        if (!isQuote) {
          updateInvoiceFromOrder(orders[idx]);
        }
        return orders[idx];
      }
      return null;
    },
    updateStatus: ({ id, status }: { id: number; status: string }) => {
      const idx = orders.findIndex((o) => o.id == id);
      if (idx >= 0) {
        const oldStatus = orders[idx].status;
        const order = orders[idx];
        const isQuote = order.orderType === "quote";
        
        // Quote status flow: draft → sent → accepted/rejected → converted
        order.status = status;
        let cancelledInvoice: any | null = null;
        
        // RESTORE STOCK only when order is CANCELLED (not delivered).
        // Stock is deducted at order creation and stays deducted through the
        // entire lifecycle (pending → ready → delivered). Only cancelled orders
        // return stock to inventory. Skip for quotes — they never deducted stock.
        if (status === "cancelled" && oldStatus !== "cancelled" && oldStatus !== "delivered" && !isQuote) {
          for (const item of (order.items || [])) {
            const prodIdx = products.findIndex((p) => p.id == item.stockItemId);
            if (prodIdx >= 0) {
              const conversion = item.conversion || 1;
              const restoreQty = item.quantity * conversion;
              const newQty = (products[prodIdx].quantity || 0) + restoreQty;
              products[prodIdx].quantity = newQty;
              products[prodIdx].status = newQty === 0 ? "out_of_stock" : newQty < 20 ? "low_stock" : "in_stock";
            }
          }
          saveItem("sgf_products", products);
          // Also cancel the linked invoice if one exists
          cancelledInvoice = cancelInvoiceFromOrder(order.id);
        }
        // ACTIVATE INVOICE from draft to sent when order becomes ready or delivered
        // (only if invoice already exists — admin must generate it manually)
        if ((status === "ready" || status === "delivered") && !isQuote) {
          activateInvoiceFromOrder(order.id);
        }
        saveItem("sgf_orders", orders);
        return { order, cancelledInvoice };
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
      quotes: orders.filter((o) => o.orderType === "quote" && o.status !== "converted").length,
      totalValue: orders.filter((o) => o.orderType !== "sample" && o.orderType !== "quote").reduce((sum, o) => sum + Number(o.total || 0), 0),
    }),
    checkExistingSample: ({ customerId, stockItemId }: { customerId: number; stockItemId: number }) => {
      return { exists: hasExistingSample(customerId, stockItemId) };
    },
    /** Convert a quote to a real order. Deducts stock, creates follow-ups if needed,
     *  and marks the original quote as "converted". Returns the new order. */
    convertQuoteToOrder: (quoteId: number) => {
      const quote = orders.find((o) => o.id == quoteId && o.orderType === "quote");
      if (!quote) return { error: "Quote not found", order: null };
      if (quote.status === "converted") return { error: "Quote already converted", order: null };

      // Generate new order number with ORD- prefix
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const now = new Date();
      const hhmm = String(now.getHours()).padStart(2, "0") + String(now.getMinutes()).padStart(2, "0");
      const msCounter = String(Date.now() % 10000).padStart(4, "0");
      const orderNumber = `ORD-${dateStr}-${hhmm}${msCounter}`;

      const newOrder = {
        ...quote,
        id: Date.now(),
        orderNumber,
        orderType: "normal",
        status: "pending",
        quoteId: quote.id,
        quoteNumber: quote.orderNumber,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      orders.push(newOrder);

      // DEDUCT STOCK for each item
      for (const item of (newOrder.items || [])) {
        const prodIdx = products.findIndex((p) => p.id == item.stockItemId);
        if (prodIdx >= 0) {
          const conversion = item.conversion || 1;
          const deductQty = item.quantity * conversion;
          const newQty = Math.max(0, (products[prodIdx].quantity || 0) - deductQty);
          products[prodIdx].quantity = newQty;
          products[prodIdx].status = newQty === 0 ? "out_of_stock" : newQty < 20 ? "low_stock" : "in_stock";
        }
      }
      saveItem("sgf_products", products);

      // Mark original quote as converted
      quote.status = "converted";
      quote.convertedOrderId = newOrder.id;
      quote.convertedOrderNumber = newOrder.orderNumber;
      quote.updatedAt = new Date().toISOString();
      saveItem("sgf_orders", orders);

      logAudit("CONVERT", "quote", quote.id, `Quote ${quote.orderNumber} converted to order ${orderNumber}`);

      return { error: null, order: newOrder };
    },
    /** Create a new order from an existing invoice that has no linked order.
     *  This fixes the case where an invoice exists but its order was lost. */
    createFromInvoice: (invoiceId: number) => {
      const inv = invoices.find((i) => i.id == invoiceId);
      if (!inv) return null;
      // Check if order already exists
      const existingOrder = orders.find((o) => o.id == inv.orderId);
      if (existingOrder) return { error: "Order already exists", order: existingOrder };

      // If invoice has a PO number, try to use it as the order number (with uniqueness check)
      let orderNumber: string;
      const poNumber = (inv as any).poNumber;
      if (poNumber) {
        const duplicate = orders.find((o) => o.orderNumber === poNumber);
        if (!duplicate) {
          orderNumber = poNumber;
        } else {
          // PO number already used as an order number — fall back to ORD-xxx
          const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
          const now = new Date();
          const hhmm = String(now.getHours()).padStart(2, "0") + String(now.getMinutes()).padStart(2, "0");
          const msCounter = String(Date.now() % 10000).padStart(4, "0");
          orderNumber = `ORD-${dateStr}-${hhmm}${msCounter}`;
        }
      } else {
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
        const now = new Date();
        const hhmm = String(now.getHours()).padStart(2, "0") + String(now.getMinutes()).padStart(2, "0");
        const msCounter = String(Date.now() % 10000).padStart(4, "0");
        orderNumber = `ORD-${dateStr}-${hhmm}${msCounter}`;
      }

      const newOrder = {
        id: Date.now(),
        orderNumber,
        customerId: inv.customerId,
        customerName: inv.customer?.name || "",
        customer: inv.customer || null,
        items: (inv.items || []).map((it: any) => ({
          stockItemId: it.stockItemId || 0,
          productCode: it.productCode || "",
          productName: it.productName || it.description || "",
          quantity: it.quantity || 1,
          unitPrice: it.unitPrice || 0,
          lineTotal: it.lineTotal || (it.unitPrice || 0) * (it.quantity || 1),
        })),
        subtotal: inv.subtotal || 0,
        vatAmount: inv.vatAmount || 0,
        total: inv.total || inv.totalAmount || 0,
        status: "delivered",
        orderType: "normal",
        paymentTerms: inv.paymentTerms || "cod",
        priceTier: "corporate",
        deliveryDate: inv.invoiceDate || new Date().toISOString(),
        deliveryAddress: inv.customer?.physicalAddress || "",
        notes: poNumber
          ? `Recreated from invoice ${inv.invoiceNumber} (linked to PO ${poNumber})`
          : `Recreated from invoice ${inv.invoiceNumber}`,
        salesRepName: inv.customer?.salesRepName || "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      orders.push(newOrder);
      saveItem("sgf_orders", orders);

      // Link the invoice to the new order
      inv.orderId = newOrder.id;
      inv.orderNumber = newOrder.orderNumber;
      inv.updatedAt = new Date().toISOString();
      saveItem("sgf_invoices", invoices);

      logAudit("CREATE", "order", newOrder.id, `Order ${orderNumber} recreated from invoice ${inv.invoiceNumber}`);
      return newOrder;
    },
  },

  invoice: {
    list: () => invoices
      .map((inv) => {
        const customer = customers.find((c) => c.id == inv.customerId);
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
      const inv = invoices.find((i) => i.id == id);
      if (!inv) return null;
      const customer = customers.find((c) => c.id == inv.customerId);
      return { ...inv, customer: customer || null };
    },
    create: (data: any) => {
      const invoiceNumber = `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${String(invoices.length + 1).padStart(4, "0")}`;
      const customer = customers.find((c) => c.id == data.customerId);
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
      const idx = invoices.findIndex((i) => i.id == id);
      if (idx >= 0) { invoices[idx].status = status; invoices[idx].amountPaid = amountPaid || 0; saveItem("sgf_invoices", invoices); return invoices[idx]; }
      return null;
    },
    recordPayment: ({ invoiceId, amount, paymentMethod, paymentDate, referenceNumber, notes }: any) => {
      const idx = invoices.findIndex((i) => i.id == invoiceId);
      if (idx < 0) return null;
      const inv = invoices[idx];
      // Auto-activate draft invoices when payment is recorded
      if (inv.status === "draft") {
        inv.status = "sent";
      }
      const currentPaid = Number(inv.amountPaid || 0);
      const newPaid = currentPaid + amount;
      const total = Number(inv.total || inv.totalAmount || 0);
      inv.amountPaid = newPaid;
      inv.balanceDue = total - newPaid; // Allow negative = customer credit
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
        customerName: (customers.find((c) => c.id == inv.customerId) || {}).name || "",
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
      inv.updatedAt = new Date().toISOString();
      saveItem("sgf_receipts", receipts);
      saveItem("sgf_collectionNotes", collectionNotes);
      saveItem("sgf_invoices", invoices);
      return { invoice: inv, receipt };
    },
    editPayment: ({ invoiceId, paymentId, amount, paymentMethod, paymentDate, referenceNumber, notes }: any) => {
      const invIdx = invoices.findIndex((i) => i.id == invoiceId);
      if (invIdx < 0) return null;
      const inv = invoices[invIdx];
      if (!inv.payments) return null;
      const payIdx = inv.payments.findIndex((p: any) => p.id == paymentId);
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
      inv.balanceDue = total - totalPaid; // Allow negative = customer credit
      if (totalPaid >= total) {
        inv.status = "paid";
      } else if (totalPaid > 0) {
        inv.status = "partially_paid";
      } else {
        inv.status = inv.status === "draft" ? "draft" : "sent";
      }
      inv.updatedAt = new Date().toISOString();
      saveItem("sgf_invoices", invoices);
      return inv;
    },
    deletePayment: ({ invoiceId, paymentId }: { invoiceId: number; paymentId: number }) => {
      const invIdx = invoices.findIndex((i) => i.id == invoiceId);
      if (invIdx < 0) return null;
      const inv = invoices[invIdx];
      if (!inv.payments) return null;
      inv.payments = inv.payments.filter((p: any) => p.id !== paymentId);
      // Recalculate totals
      const totalPaid = inv.payments.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
      const total = Number(inv.total || inv.totalAmount || 0);
      inv.amountPaid = totalPaid;
      inv.balanceDue = total - totalPaid; // Allow negative = customer credit
      if (totalPaid >= total) {
        inv.status = "paid";
      } else if (totalPaid > 0) {
        inv.status = "partially_paid";
      } else {
        inv.status = inv.status === "draft" ? "draft" : "sent";
      }
      inv.updatedAt = new Date().toISOString();
      saveItem("sgf_invoices", invoices);
      return inv;
    },
    getReceipts: () => receipts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    getReceiptsByInvoice: (invoiceId: number) => receipts.filter((r) => r.invoiceId == invoiceId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    getReceiptsByCustomer: (customerId: number) => receipts.filter((r) => r.customerId == customerId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    getReceiptById: (id: number) => receipts.find((r) => r.id == id) || null,

    // Credit note methods
    getCreditNotes: () => creditNotes.filter((cn) => !cn.voided).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    // Use loose equality (==) — Firebase may convert number IDs to strings
    getCreditNotesByInvoice: (invoiceId: number) => creditNotes.filter((cn) => cn.invoiceId == invoiceId && !cn.voided).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    getCreditNotesByCustomer: (customerId: number) => creditNotes.filter((cn) => cn.customerId == customerId && !cn.voided).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    getCustomerCreditBalance: (customerId: number) => {
      return creditNotes
        .filter((cn) => cn.customerId == customerId && !cn.voided)
        .reduce((sum: number, cn: any) => {
          const remaining = cn.remainingAmount !== undefined ? cn.remainingAmount : 0;
          return sum + remaining;
        }, 0);
    },
    createCreditNote: (data: any) => {
      // Calculate total credit from line items if provided
      let lineItems = data.lineItems || [];
      let creditTotal = data.amount || 0;

      // Calculate subtotal (excl VAT) and vatAmount from line items or amount
      let subtotal = 0;
      let vatAmount = 0;
      if (lineItems.length > 0) {
        subtotal = lineItems.reduce((sum: number, li: any) => sum + (li.creditAmount || 0), 0);
        vatAmount = Number((subtotal * 0.15).toFixed(2));
        // If UI didn't send amount, use subtotal + vat
        if (data.amount === undefined || data.amount === 0) {
          creditTotal = Number((subtotal + vatAmount).toFixed(2));
        } else {
          creditTotal = data.amount; // UI already calculated incl VAT
        }
      } else {
        // No line items — derive subtotal from total amount
        subtotal = Number((creditTotal / 1.15).toFixed(2));
        vatAmount = Number((creditTotal - subtotal).toFixed(2));
      }

      // Use max existing number + 1 (NOT count-based) — voided notes must NOT reuse numbers
      const existingNumbers = creditNotes
        .map((cn) => { const m = (cn.creditNoteNumber || "").match(/CN-(\d+)/); return m ? parseInt(m[1], 10) : 0; })
        .filter((n) => !isNaN(n) && n > 0);
      const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;

      const creditNote = {
        id: Date.now() + Math.random(),
        creditNoteNumber: `CN-${String(nextNumber).padStart(3, "0")}`,
        customerId: data.customerId || 0,
        invoiceId: data.invoiceId || null,
        invoiceNumber: data.invoiceNumber || null,
        amount: creditTotal,
        subtotal,
        vatAmount,
        remainingAmount: creditTotal,
        allocations: [],
        lineItems,
        reason: data.reason || "",
        company: data.company || "",
        createdAt: new Date().toISOString(),
      };
      creditNotes.push(creditNote);
      saveItem("sgf_creditNotes", creditNotes);
      let updatedInvoice = null;

      // Helper: find and update invoice — credit note is created but NOT auto-applied
      // The credit sits as "available" for the customer to allocate later
      const findAndUpdateInvoice = (): any | null => {
        if (!data.invoiceId) return null;

        // Search 1: Current in-memory array (loose equality)
        let idx = invoices.findIndex((i) => i.id == data.invoiceId);

        // Search 2: By invoiceNumber
        if (idx < 0 && data.invoiceNumber) {
          idx = invoices.findIndex((i) => i.invoiceNumber === data.invoiceNumber);
        }

        // Search 3: By customerId + total
        if (idx < 0 && data.customerId) {
          idx = invoices.findIndex((i) =>
            i.customerId == data.customerId &&
            Math.abs((i.total || 0) - (data.invoiceTotal || i.total || 0)) < 0.01
          );
        }

        // Search 4: localStorage direct (in case array was replaced)
        if (idx < 0) {
          try {
            const raw = getStorageItem("sgf_invoices");
            if (raw) {
              const stored = JSON.parse(raw);
              if (Array.isArray(stored)) {
                const storedIdx = stored.findIndex((i: any) =>
                  i.id == data.invoiceId ||
                  (data.invoiceNumber && i.invoiceNumber === data.invoiceNumber)
                );
                if (storedIdx >= 0) {
                  invoices = stored;
                  idx = invoices.findIndex((i) => i.id == data.invoiceId);
                  if (idx < 0 && data.invoiceNumber) {
                    idx = invoices.findIndex((i) => i.invoiceNumber === data.invoiceNumber);
                  }
                }
              }
            }
          } catch { /* ignore */ }
        }

        if (idx < 0) return null;

        const inv = invoices[idx];
        // Credit note is linked to original invoice for REFERENCE only
        // Balance is NOT reduced here — user allocates credit manually
        if (!inv.creditNotes) inv.creditNotes = [];
        inv.creditNotes.push(creditNote.id);

        // Store credited line items on the invoice for display
        if (!inv.creditedLines) inv.creditedLines = [];
        for (const li of lineItems) {
          const alreadyExists = inv.creditedLines.some((cl: any) =>
            cl.creditNoteId == creditNote.id &&
            cl.productDescription === li.productDescription
          );
          if (!alreadyExists) {
            inv.creditedLines.push({
              creditNoteId: creditNote.id,
              creditNoteNumber: creditNote.creditNoteNumber,
              productDescription: li.productDescription,
              originalQty: li.originalQty,
              returnedQty: li.returnedQty,
              unitPrice: li.unitPrice,
              creditAmount: li.creditAmount,
              reason: data.reason,
              createdAt: creditNote.createdAt,
            });
          }
        }

        inv.updatedAt = new Date().toISOString();
        saveItem("sgf_invoices", invoices);
        return inv;
      };

      updatedInvoice = findAndUpdateInvoice();

      // Return stock to inventory for each credited line item
      if (lineItems.length > 0) {
        for (const li of lineItems) {
          if (li.stockItemId && li.returnedQty > 0) {
            const prodIdx = products.findIndex((p) => p.id == li.stockItemId);
            if (prodIdx >= 0) {
              const newQty = (products[prodIdx].quantity || 0) + li.returnedQty;
              products[prodIdx].quantity = newQty;
              products[prodIdx].status = newQty === 0 ? "out_of_stock" : newQty < 20 ? "low_stock" : "in_stock";
            }
          }
        }
        saveItem("sgf_products", products);
      }

      logAudit("CREATE", "creditNote", creditNote.id, `Credit note ${creditNote.creditNoteNumber} for R${creditTotal} invoice=${data.invoiceId} lines=${lineItems.length} found=${!!updatedInvoice}`);
      return { creditNote, updatedInvoice };
    },
    allocateCredit: ({ creditNoteId, invoiceId, amount }: { creditNoteId: number; invoiceId: number; amount: number }) => {
      const cnIdx = creditNotes.findIndex((cn) => cn.id == creditNoteId);
      if (cnIdx < 0) return { success: false, error: "Credit note not found" };
      const cn = creditNotes[cnIdx];
      if (cn.voided) return { success: false, error: "Credit note is voided" };

      const remaining = cn.remainingAmount !== undefined ? cn.remainingAmount : 0;
      if (amount > remaining + 0.01) return { success: false, error: "Amount exceeds remaining credit" };

      const invIdx = invoices.findIndex((i) => i.id == invoiceId);
      if (invIdx < 0) return { success: false, error: "Invoice not found" };
      const inv = invoices[invIdx];

      const currentBalance = typeof inv.balanceDue === "number" ? inv.balanceDue : (inv.total || 0);
      if (amount > currentBalance + 0.01) return { success: false, error: "Amount exceeds invoice balance" };

      // Deduct from credit note
      creditNotes[cnIdx] = {
        ...cn,
        remainingAmount: Math.max(0, remaining - amount),
        allocations: [...(cn.allocations || []), { invoiceId, amount, allocatedAt: new Date().toISOString() }],
        updatedAt: new Date().toISOString(),
      };

      // Add to invoice
      const newBalance = Math.max(0, currentBalance - amount);
      invoices[invIdx] = {
        ...inv,
        balanceDue: newBalance,
        creditAllocations: [...(inv.creditAllocations || []), { creditNoteId, amount, allocatedAt: new Date().toISOString() }],
        status: newBalance <= 0.01 ? "paid" : (inv.amountPaid > 0.01 ? "partially_paid" : "sent"),
        updatedAt: new Date().toISOString(),
      };

      saveItem("sgf_creditNotes", creditNotes);
      saveItem("sgf_invoices", invoices);

      logAudit("UPDATE", "creditNote", creditNoteId, `Allocated R${amount.toFixed(2)} to invoice ${invoiceId}. Remaining: R${(remaining - amount).toFixed(2)}`);
      return { success: true, creditNote: creditNotes[cnIdx], invoice: invoices[invIdx] };
    },
    voidCreditNoteAllocation: ({ creditNoteId, invoiceId }: { creditNoteId: number; invoiceId: number }) => {
      const cnIdx = creditNotes.findIndex((cn) => cn.id == creditNoteId);
      if (cnIdx < 0) return { success: false, error: "Credit note not found" };
      const cn = creditNotes[cnIdx];

      const alloc = (cn.allocations || []).find((a: any) => a.invoiceId == invoiceId);
      if (!alloc) return { success: false, error: "Allocation not found" };
      const amount = alloc.amount;

      // Restore credit note
      const currentRemaining = cn.remainingAmount !== undefined ? cn.remainingAmount : 0;
      creditNotes[cnIdx] = {
        ...cn,
        remainingAmount: currentRemaining + amount,
        allocations: (cn.allocations || []).filter((a: any) => a.invoiceId != invoiceId),
        updatedAt: new Date().toISOString(),
      };

      // Restore invoice
      const invIdx = invoices.findIndex((i) => i.id == invoiceId);
      if (invIdx >= 0) {
        const inv = invoices[invIdx];
        const newBal = (typeof inv.balanceDue === "number" ? inv.balanceDue : (inv.total || 0)) + amount;
        invoices[invIdx] = {
          ...inv,
          balanceDue: newBal,
          creditAllocations: (inv.creditAllocations || []).filter((a: any) => a.creditNoteId != creditNoteId),
          status: newBal <= 0.01 ? "paid" : (inv.amountPaid > 0.01 ? "partially_paid" : "sent"),
          updatedAt: new Date().toISOString(),
        };
        saveItem("sgf_invoices", invoices);
      }

      saveItem("sgf_creditNotes", creditNotes);
      logAudit("UPDATE", "creditNote", creditNoteId, `Voided allocation of R${amount.toFixed(2)} from invoice ${invoiceId}`);
      return { success: true, creditNote: creditNotes[cnIdx] };
    },
    voidCreditNote: (id: number) => {
      // Use loose equality (==) because Firebase may convert number IDs to strings
      const idx = creditNotes.findIndex((cn) => cn.id == id);
      if (idx >= 0) {
        const cn = creditNotes[idx];

        // NEW: if credit note has allocations, void them first
        const hasAllocations = cn.allocations && cn.allocations.length > 0;
        if (hasAllocations) {
          for (const alloc of cn.allocations) {
            const invIdx = invoices.findIndex((i) => i.id == alloc.invoiceId);
            if (invIdx >= 0) {
              const inv = invoices[invIdx];
              const currentBal = typeof inv.balanceDue === "number" ? inv.balanceDue : (inv.total || 0);
              const newBal = currentBal + alloc.amount;
              invoices[invIdx] = {
                ...inv,
                balanceDue: newBal,
                creditAllocations: (inv.creditAllocations || []).filter((a: any) => a.creditNoteId != cn.id),
                status: newBal <= 0.01 ? "paid" : (inv.amountPaid > 0.01 ? "partially_paid" : "sent"),
                updatedAt: new Date().toISOString(),
              };
            }
          }
          saveItem("sgf_invoices", invoices);
        }

        cn.voided = true;
        cn.voidedAt = new Date().toISOString();

        if (cn.invoiceId) {
          // Use loose equality (==) because Firebase may convert number IDs to strings
          const inv = invoices.find((i) => i.id == cn.invoiceId);
          if (inv) {
            // OLD credit notes (no allocations): restore balance to original invoice
            if (!hasAllocations) {
              const isSampleInvoice = inv.orderType === "sample" || (inv.notes || "").includes("Sample");
              if (!isSampleInvoice) {
                const currentBal = typeof inv.balanceDue === "number" ? inv.balanceDue : 0;
                inv.balanceDue = currentBal + (cn.amount || 0);
                const total = Number(inv.total || inv.totalAmount || 0);
                const paid = Number(inv.amountPaid || 0);
                if (inv.balanceDue >= total - 0.01) {
                  inv.status = "sent";
                } else if (inv.balanceDue > 0.01) {
                  inv.status = "partially_paid";
                } else {
                  inv.status = "paid";
                }
              }
            }
            // Remove credit note ID from invoice tracking
            if (inv.creditNotes) {
              inv.creditNotes = inv.creditNotes.filter((cnId: any) => cnId != cn.id);
            }
            // Remove credited lines for this credit note
            if (inv.creditedLines) {
              inv.creditedLines = inv.creditedLines.filter((cl: any) => cl.creditNoteId != cn.id);
            }
            saveItem("sgf_invoices", invoices);
          }
        }
        // Reverse stock return: deduct the returned quantities back from inventory
        if (cn.lineItems && cn.lineItems.length > 0) {
          for (const li of cn.lineItems) {
            if (li.stockItemId && li.returnedQty > 0) {
              const prodIdx = products.findIndex((p) => p.id == li.stockItemId);
              if (prodIdx >= 0) {
                const newQty = Math.max(0, (products[prodIdx].quantity || 0) - li.returnedQty);
                products[prodIdx].quantity = newQty;
                products[prodIdx].status = newQty === 0 ? "out_of_stock" : newQty < 20 ? "low_stock" : "in_stock";
              }
            }
          }
          saveItem("sgf_products", products);
        }
        saveItem("sgf_creditNotes", creditNotes);
        return cn;
      }
      return null;
    },

    /** Update invoice fields (admin only) — for correcting historical data */
    updateInvoice: ({ id, data }: { id: number; data: any }) => {
      const idx = invoices.findIndex((i) => i.id == id);
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
        inv.customer = customers.find((c) => c.id == data.customerId) || null;
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
      if (data.vatRate !== undefined) inv.vatRate = data.vatRate;
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
          // Try DD/MM/YYYY or DD/MM/YY format
          const parts = hist.date.split("/");
          if (parts.length === 3) {
            // Handle both 2-digit year (26 → 2026) and 4-digit year (2026 → 2026)
            const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
            invoiceDate = `${year}-${parts[1]}-${parts[0]}`;
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
          customer: customerId ? customers.find((c) => c.id == customerId) : null,
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
        .filter((i) => i.status !== "cancelled")
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
        .filter((i) => i.status !== "draft" && i.status !== "paid" && i.status !== "cancelled")
        .reduce((sum, i) => sum + (Number(i.balanceDue) || Number(i.total || i.totalAmount || 0) - Number(i.amountPaid || 0)), 0);
      const sageCount = invoices.filter((i) => i.source === "sage").length;
      const sageOutstanding = invoices
        .filter((i) => i.source === "sage" && i.status !== "draft" && i.status !== "paid" && i.status !== "cancelled")
        .reduce((sum, i) => sum + (Number(i.balanceDue) || Number(i.total || i.totalAmount || 0) - Number(i.amountPaid || 0)), 0);
      return {
        total: invoices.length,
        draft: invoices.filter((i) => i.status === "draft").length,
        sent: invoices.filter((i) => i.status === "sent").length,
        partiallyPaid: invoices.filter((i) => i.status === "partially_paid").length,
        paid: invoices.filter((i) => i.status === "paid").length,
        overdue: invoices.filter((i) => i.status === "overdue").length,
        cancelled: invoices.filter((i) => i.status === "cancelled").length,
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
      customer: customers.find((c) => c.id == a.customerId) || null,
    })),
    create: (data: any) => {
      const newItem = { ...data, id: Date.now(), status: "scheduled", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      // Auto-populate salesRepName from customer if not provided
      if (!newItem.salesRepName && newItem.customerId) {
        const cust = customers.find((c) => c.id == newItem.customerId);
        if (cust?.salesRepName) newItem.salesRepName = cust.salesRepName;
      }
      appointments.push(newItem);
      saveItem("sgf_appointments", appointments);
      return newItem;
    },
    update: ({ id, data }: { id: number; data: any }) => {
      const idx = appointments.findIndex((a) => a.id == id);
      if (idx >= 0) { appointments[idx] = { ...appointments[idx], ...data, updatedAt: new Date().toISOString() }; saveItem("sgf_appointments", appointments); return appointments[idx]; }
      return null;
    },
    delete: (id: number) => {
      const idx = appointments.findIndex((a) => a.id == id);
      if (idx >= 0) { const deleted = appointments[idx]; appointments.splice(idx, 1); saveItem("sgf_appointments", appointments); return deleted; }
      return null;
    },
    updateStatus: ({ id, status }: { id: number; status: string }) => {
      const idx = appointments.findIndex((a) => a.id == id);
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
      customer: customers.find((c) => c.id == ci.customerId) || null,
    })),
    update: ({ id, data }: { id: number; data: any }) => {
      const idx = checkins.findIndex((c) => c.id == id);
      if (idx >= 0) { checkins[idx] = { ...checkins[idx], ...data, updatedAt: new Date().toISOString() }; saveItem("sgf_checkins", checkins); return checkins[idx]; }
      return null;
    },
    delete: (id: number) => {
      const idx = checkins.findIndex((c) => c.id == id);
      if (idx >= 0) { const deleted = checkins[idx]; checkins.splice(idx, 1); saveItem("sgf_checkins", checkins); return deleted; }
      return null;
    },
    create: (data: any) => {
      const newItem = { ...data, id: Date.now(), status: "checked_in", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      // Auto-populate salesRepName from customer if not provided
      if (!newItem.salesRepName && newItem.customerId) {
        const cust = customers.find((c) => c.id == newItem.customerId);
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
      const idx = checkins.findIndex((ci) => ci.id == id);
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

    /** ═══════════════════════════════════════════════════════════════
     *  SALES REP VISIT REPORTS — Daily, Weekly, Monthly
     *  Uses GPS coordinates from check-ins to calculate distance
     *  and applies South African AA rates for cost estimation.
     *  ═══════════════════════════════════════════════════════════════ */
    getDailyReport: (dateStr?: string) => {
      const targetDate = dateStr ? new Date(dateStr) : new Date();
      const dateKey = targetDate.toDateString();
      // Include ALL check-ins for the day — even those without GPS coordinates.
      // buildRepReport handles missing coords gracefully (counts visit, skips distance).
      const dayCheckins = checkins.filter((ci) =>
        new Date(ci.createdAt).toDateString() === dateKey
      );
      return buildRepReport(dayCheckins, "daily", targetDate);
    },

    getWeeklyReport: (year?: number, week?: number) => {
      const now = new Date();
      const targetYear = year || now.getFullYear();
      const targetWeek = week || getWeekNumber(now);
      const weekCheckins = checkins.filter((ci) => {
        const d = new Date(ci.createdAt);
        return d.getFullYear() === targetYear && getWeekNumber(d) === targetWeek;
      });
      return buildRepReport(weekCheckins, "weekly", now, targetYear, targetWeek);
    },

    getMonthlyReport: (year?: number, month?: number) => {
      const now = new Date();
      const targetYear = year || now.getFullYear();
      const targetMonth = month !== undefined ? month : now.getMonth();
      const monthCheckins = checkins.filter((ci) => {
        const d = new Date(ci.createdAt);
        return d.getFullYear() === targetYear && d.getMonth() === targetMonth;
      });
      return buildRepReport(monthCheckins, "monthly", now, targetYear, targetMonth);
    },
  },

  followUpAction: {
    list: () => followUpActions.map((fa) => ({
      ...fa,
      customer: customers.find((c) => c.id == fa.customerId) || null,
    })).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    listByCustomer: ({ customerId }: { customerId: number }) =>
      followUpActions
        .filter((fa) => fa.customerId == customerId)
        .map((fa) => ({
          ...fa,
          customer: customers.find((c) => c.id == fa.customerId) || null,
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
        .filter((sp) => sp.customerId == customerId)
        .map((sp) => ({
          ...sp,
          stockItem: products.find((p) => p.id == sp.stockItemId) || null,
        })),
    set: ({ customerId, stockItemId, specialPrice: price }: { customerId: number; stockItemId: number; specialPrice: number }) => {
      const existing = specialPrices.find((sp) => sp.customerId == customerId && sp.stockItemId == stockItemId);
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
    list: () => {
      // Always read fresh from localStorage so Firebase-synced reps appear
      const reps = getCurrentSalesReps();
      return reps.map((rep, i) => ({
        id: i + 1,
        name: rep.name,
        email: rep.email || "",
        phone: rep.phone || "",
        region: rep.region || "",
        vehicleReg: rep.vehicleReg || "",
        role: "USER",
        isActive: rep.isActive !== false,
      }));
    },
    getStats: () => {
      const reps = getCurrentSalesReps();
      const repStats = reps.map((rep) => {
        const name = rep.name;
        const repCustomers = customers.filter((c) => c.salesRepName === name);
        const repOrders = orders.filter((o) => {
          const cust = customers.find((c) => c.id == o.customerId);
          return cust?.salesRepName === name && o.orderType !== "sample";
        });
        const repSamples = orders.filter((o) => {
          const cust = customers.find((c) => c.id == o.customerId);
          return cust?.salesRepName === name && o.orderType === "sample";
        });
        const totalSales = repOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
        const sampleCost = repSamples.reduce((sum, o) => {
          const cost = o.items?.reduce((s: number, item: any) => {
            const prod = products.find((p) => p.id == item.stockItemId);
            return s + (Number(prod?.wholesalePrice || 0) * item.quantity);
          }, 0) || 0;
          return sum + cost;
        }, 0);
        return { name, customerCount: repCustomers.length, orderCount: repOrders.length, sampleCount: repSamples.length, totalSales, sampleCost };
      });
      const activeCount = reps.filter((r) => r.isActive !== false).length;
      return { total: reps.length, active: activeCount, inactive: reps.length - activeCount, repStats };
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

      const repSales = getCurrentSalesReps().map((rep) => {
        const name = rep.name;
        const repOrders = orders.filter((o) => {
          const cust = customers.find((c) => c.id == o.customerId);
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

    // CRUD for sales reps
    create: (data: any) => {
      const reps = [...getCurrentSalesReps()]; // COPY
      const name = (data.name || "").trim();
      if (!name) return null;
      // Prevent duplicate names (case-insensitive)
      if (reps.some((r) => r.name.toLowerCase() === name.toLowerCase())) return null;
      const newRep: SalesRep = {
        name,
        email: data.email || "",
        phone: data.phone || "",
        region: data.region || "",
        vehicleReg: data.vehicleReg || "",
        isActive: true,
      };
      reps.push(newRep);
      // Update both localStorage and in-memory
      SALES_REPS.length = 0;
      SALES_REPS.push(...reps);
      saveSalesReps();
      return { id: reps.length, ...newRep };
    },
    update: ({ id, data }: { id: number; data: any }) => {
      const reps = [...getCurrentSalesReps()]; // COPY
      const idx = id - 1;
      if (idx < 0 || idx >= reps.length) return null;
      const oldName = reps[idx].name;
      const newName = (data.name || reps[idx].name).trim();
      if (!newName) return null;
      // If renaming, ensure no duplicate
      if (newName.toLowerCase() !== oldName.toLowerCase()) {
        if (reps.some((r, i) => i !== idx && r.name.toLowerCase() === newName.toLowerCase())) {
          return null; // would create duplicate
        }
      }
      reps[idx] = {
        ...reps[idx],
        name: newName,
        email: data.email !== undefined ? data.email : reps[idx].email,
        phone: data.phone !== undefined ? data.phone : reps[idx].phone,
        region: data.region !== undefined ? data.region : reps[idx].region,
        vehicleReg: data.vehicleReg !== undefined ? data.vehicleReg : reps[idx].vehicleReg,
      };
      // Update customers who had the old rep name
      if (oldName !== newName) {
        customers.filter((c) => c.salesRepName === oldName).forEach((c) => (c.salesRepName = newName));
        saveItem("sgf_customers", customers);
      }
      SALES_REPS.length = 0;
      SALES_REPS.push(...reps);
      saveSalesReps();
      return { id, ...reps[idx], oldName };
    },
    toggleActive: ({ id }: { id: number }) => {
      const reps = [...getCurrentSalesReps()]; // COPY
      const idx = id - 1;
      if (idx < 0 || idx >= reps.length) return null;
      reps[idx].isActive = !reps[idx].isActive;
      SALES_REPS.length = 0;
      SALES_REPS.push(...reps);
      saveSalesReps();
      return { id, ...reps[idx] };
    },
    delete: ({ id }: { id: number }) => {
      const reps = [...getCurrentSalesReps()]; // COPY
      const idx = id - 1;
      if (idx < 0 || idx >= reps.length) return null;
      const deletedName = reps[idx].name;
      reps.splice(idx, 1);
      SALES_REPS.length = 0;
      SALES_REPS.push(...reps);
      saveSalesReps();
      return { success: true, deletedName };
    },
  },

  followUp: {
    list: () => {
      // Show ALL pending follow-ups (sales rep needs to action them)
      return followUps
        .filter((fu) => fu.status === "pending")
        .map((fu) => {
          const order = orders.find((o) => o.id == fu.orderId);
          const customer = customers.find((c) => c.id == fu.customerId);
          return {
            ...fu,
            customer: customer || null,
            order: order ? { ...order, customer: customer || null } : null,
          };
        });
    },
    update: ({ id, status, reason, expectedOrderDate }: { id: number; status: string; reason?: string; expectedOrderDate?: string }) => {
      const idx = followUps.findIndex((fu) => fu.id == id);
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
        .filter((inv) => inv.status !== "paid" && inv.status !== "cancelled")
        .map((inv) => {
          const customer = customers.find((c) => c.id == inv.customerId);
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
          const notes = collectionNotes.filter((n) => n.invoiceId == inv.id);
          const latestPromise = collectionPromises
            .filter((p) => p.invoiceId == inv.id)
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] || null;
          const accountHold = accountHolds.find((h) => h.customerId == inv.customerId && h.status === "active") || null;
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
        .filter((inv) => inv.customerId == customerId)
        .map((inv) => ({
          ...inv,
          notes: collectionNotes.filter((n) => n.invoiceId == inv.id),
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
      accountHolds = accountHolds.map((h) => h.customerId == customerId && h.status === "active" ? { ...h, status: "released", releasedAt: new Date().toISOString() } : h);
      const hold = { id: Date.now() + Math.random(), customerId, reason: reason || "Non-payment", notes: notes || "", status: "active", createdAt: new Date().toISOString() };
      accountHolds.push(hold);
      // Also add a collection note
      collectionNotes.push({ id: Date.now() + Math.random(), invoiceId: null, customerId, type: "hold", notes: `Account hold placed: ${reason || "Non-payment"}`, contactMethod: "manual", contactPerson: "", followUpDate: null, createdAt: new Date().toISOString() });
      saveItem("sgf_accountHolds", accountHolds);
      saveItem("sgf_collectionNotes", collectionNotes);
      return hold;
    },
    releaseHold: ({ holdId }: { holdId: number }) => {
      const idx = accountHolds.findIndex((h) => h.id == holdId);
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
      const customerOrders = orders.filter((o) => o.customerId == customerId && o.orderType === "sample");
      const report = customerOrders.flatMap((o) =>
        (o.items || []).map((item: any) => {
          const product = products.find((p) => p.id == item.stockItemId);
          const invoice = invoices.find((i) => i.orderId == o.id);
          const unitCost = Number(item.unitPrice || product?.corporatePrice || 0);
          const lineSubtotal = unitCost * item.quantity;
          const lineVat = lineSubtotal * 0.15;
          const lineTotal = lineSubtotal + lineVat;
          return {
            productCode: product?.productCode || "",
            productName: product?.productName || "Unknown",
            dateTaken: o.createdAt,
            orderNumber: o.orderNumber,
            invoiceNumber: invoice?.invoiceNumber || "N/A",
            quantity: item.quantity,
            unitCost,
            subtotal: lineSubtotal,
            vatAmount: lineVat,
            totalCost: lineTotal,
          };
        })
      );
      const grandSubtotal = report.reduce((sum, r) => sum + r.subtotal, 0);
      const grandVat = report.reduce((sum, r) => sum + r.vatAmount, 0);
      const grandTotal = report.reduce((sum, r) => sum + r.totalCost, 0);
      return { items: report, grandSubtotal, grandVat, grandTotal };
    },
    getAll: () => {
      const sampleOrders = orders.filter((o) => o.orderType === "sample");
      const report = [] as any[];
      for (const customer of [...customers].sort((a, b) => (a.name || "").localeCompare(b.name || ""))) {
        const custSamples = sampleOrders.filter((o) => o.customerId == customer.id);
        if (custSamples.length === 0) continue;
        const items = custSamples.flatMap((o) =>
          (o.items || []).map((item: any) => {
            const product = products.find((p) => p.id == item.stockItemId);
            const invoice = invoices.find((i) => i.orderId == o.id);
            const unitCost = Number(item.unitPrice || product?.corporatePrice || 0);
            const lineSubtotal = unitCost * item.quantity;
            const lineVat = lineSubtotal * 0.15;
            const lineTotal = lineSubtotal + lineVat;
            return {
              productCode: product?.productCode || "",
              productName: product?.productName || "Unknown",
              dateTaken: o.createdAt,
              orderNumber: o.orderNumber,
              invoiceNumber: invoice?.invoiceNumber || "N/A",
              quantity: item.quantity,
              unitCost,
              subtotal: lineSubtotal,
              vatAmount: lineVat,
              totalCost: lineTotal,
            };
          })
        );
        const totalSubtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
        const totalVat = items.reduce((sum, item) => sum + item.vatAmount, 0);
        const totalCost = items.reduce((sum, item) => sum + item.totalCost, 0);
        report.push({
          customerId: customer.id,
          customerName: customer.name,
          customerCode: customer.customerCode,
          salesRepName: customer.salesRepName || "Unassigned",
          items,
          totalSubtotal,
          totalVat,
          totalCost,
          sampleCount: custSamples.length,
        });
      }
      const grandSubtotal = report.reduce((sum, r) => sum + r.totalSubtotal, 0);
      const grandVat = report.reduce((sum, r) => sum + r.totalVat, 0);
      const grandTotal = report.reduce((sum, r) => sum + r.totalCost, 0);
      return { customers: report, grandSubtotal, grandVat, grandTotal };
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
    getById: (id: number) => users.find((u) => u.id == id) || null,
    getByName: (name: string) => users.find((u) => u.name?.toLowerCase() === name.toLowerCase() && u.isActive !== false) || null,
    authenticate: ({ name, pin }: { name: string; pin: string }) => {
      const DEFAULT_USERS = [
        { id: 1, name: "Collin", email: "collin@supremeglobalfoods.co.za", role: "super_admin", pin: "2580", isActive: true },
        { id: 2, name: "Adeli", email: "adeli@supremeglobalfoods.co.za", role: "sales_rep", pin: "1111", isActive: true },
        { id: 3, name: "Inhouse", email: "inhouse@supremeglobalfoods.co.za", role: "sales_rep", pin: "2222", isActive: true },
        { id: 4, name: "Michael", email: "michael@supremeglobalfoods.co.za", role: "sales_rep", pin: "3333", isActive: true },
        { id: 5, name: "Nkosana", email: "nkosana@supremeglobalfoods.co.za", role: "sales_rep", pin: "4444", isActive: true },
        { id: 6, name: "Tebogo Bila", email: "tebogo@supremeglobalfoods.co.za", role: "sales_rep", pin: "6666", isActive: true },
        { id: 7, name: "Aggie", email: "aggie@supremeglobalfoods.co.za", role: "admin", pin: "1018", isActive: true },
        { id: 8, name: "Ronald", email: "ronald@supremeglobalfoods.co.za", role: "super_admin", pin: "2581", isActive: true },
        { id: 9, name: "Jolene", email: "jolene@supremeglobalfoods.co.za", role: "admin", pin: "7777", isActive: true },
        { id: 10, name: "David", email: "david@supremeglobalfoods.co.za", role: "super_admin", pin: "8888", isActive: true },
      ];

      // Firebase RTDB auto-converts numeric strings to numbers (e.g. "2580" → 2580).
      // After sync/merge the PIN may be a number, but the login form sends a string.
      // Use String() on both sides so 2580 (number) matches "2580" (string).
      const typedPin = String(pin);

      // Try 1: in-memory users array
      let found = users.find((x: any) => x.name?.toLowerCase() === name.toLowerCase() && String(x.pin) === typedPin && x.isActive !== false);

      // Try 2: localStorage direct read (this now includes users synced from Firebase via syncFromCloud)
      if (!found) {
        try {
          const raw = getStorageItem("sgf_users");
          if (raw) {
            const stored = JSON.parse(raw);
            found = stored.find((x: any) => x.name?.toLowerCase() === name.toLowerCase() && String(x.pin) === typedPin && x.isActive !== false);
          }
        } catch { /* ignore */ }
      }

      // Try 3: hardcoded defaults (always works, also repairs the DB)
      if (!found) {
        found = DEFAULT_USERS.find((x: any) => x.name?.toLowerCase() === name.toLowerCase() && String(x.pin) === typedPin && x.isActive !== false);
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
      return { id: found.id, name: found.name, email: found.email, role: found.role, pin: found.pin };
    },
    create: (data: any) => {
      const newUser = { ...data, id: Date.now(), isActive: true, createdAt: new Date().toISOString() };
      users.push(newUser);
      saveItem("sgf_users", users);
      logAudit("CREATE", "user", newUser.id, `Created user: ${newUser.name} (${newUser.role})`);
      return newUser;
    },
    update: ({ id, data }: { id: number; data: any }) => {
      const idx = users.findIndex((u) => u.id == id);
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
      const target = users.find((u) => u.id == id);
      if (target?.role === "super_admin") {
        const superAdminCount = users.filter((u) => u.role === "super_admin").length;
        if (superAdminCount <= 1) return { success: false, error: "Cannot delete the last super admin" };
      }
      users = users.filter((u) => u.id !== id);
      saveItem("sgf_users", users);
      return { success: true };
    },
    toggleActive: ({ id }: { id: number }) => {
      const idx = users.findIndex((u) => u.id == id);
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
      const idx = users.findIndex((u) => u.id == id);
      if (idx >= 0) {
        users[idx].pin = pin;
        users[idx].updatedAt = new Date().toISOString();
        saveItem("sgf_users", users);
        return { success: true };
      }
      return { success: false };
    },
  },

  // ═══════════════════════════════════════════════════════════════
  //  CORPORATE MODULE
  // ═══════════════════════════════════════════════════════════════
  corporateCustomer: {
    list: () => corporateCustomers,
    listByCompany: (company: string) => corporateCustomers.filter((c) => c.company === company || (!c.company && company === "sgf")),
    getById: (id: number) => corporateCustomers.find((c) => c.id == id) || null,
    create: (data: any) => {
      const newItem = {
        ...data,
        company: data.company || "sgf",
        id: Date.now(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      corporateCustomers.push(newItem);
      saveItem("sgf_corporateCustomers", corporateCustomers);
      // Also add to main customers list so invoices and statements resolve correctly
      const mainCust = {
        id: newItem.id,
        name: newItem.name,
        customerCode: newItem.code || `CORP-${newItem.id.toString().slice(-4)}`,
        contactPerson: newItem.contactPerson || "",
        email: newItem.email || "",
        phone: newItem.phone || "",
        physicalAddress: newItem.deliveryAddress || "",
        city: newItem.city || "",
        province: newItem.province || "",
        postalCode: newItem.postalCode || "",
        vatNumber: newItem.vatNumber || "",
        paymentTerms: newItem.paymentTerms || "30_days",
        priceTier: "corporate",
        isCorporate: true,
        company: newItem.company || "sgf",
        notes: newItem.notes || "",
        createdAt: newItem.createdAt,
        updatedAt: newItem.updatedAt,
      };
      customers.push(mainCust);
      saveItem("sgf_customers", customers);
      return newItem;
    },
    update: ({ id, data }: { id: number; data: any }) => {
      const idx = corporateCustomers.findIndex((c) => c.id == id);
      if (idx >= 0) {
        corporateCustomers[idx] = { ...corporateCustomers[idx], ...data, updatedAt: new Date().toISOString() };
        saveItem("sgf_corporateCustomers", corporateCustomers);
        // Sync updates to main customers list
        const cIdx = customers.findIndex((c) => c.id == id && c.isCorporate);
        if (cIdx >= 0) {
          customers[cIdx] = {
            ...customers[cIdx],
            name: data.name ?? customers[cIdx].name,
            customerCode: data.code ?? customers[cIdx].customerCode,
            contactPerson: data.contactPerson ?? customers[cIdx].contactPerson,
            email: data.email ?? customers[cIdx].email,
            phone: data.phone ?? customers[cIdx].phone,
            physicalAddress: data.deliveryAddress ?? customers[cIdx].physicalAddress,
            city: data.city ?? customers[cIdx].city,
            province: data.province ?? customers[cIdx].province,
            postalCode: data.postalCode ?? customers[cIdx].postalCode,
            vatNumber: data.vatNumber ?? customers[cIdx].vatNumber,
            paymentTerms: data.paymentTerms ?? customers[cIdx].paymentTerms,
            company: data.company ?? customers[cIdx].company,
            notes: data.notes ?? customers[cIdx].notes,
            updatedAt: new Date().toISOString(),
          };
          saveItem("sgf_customers", customers);
        }
        return corporateCustomers[idx];
      }
      return null;
    },
    delete: (id: number) => {
      corporateCustomers = corporateCustomers.filter((c) => c.id !== id);
      saveItem("sgf_corporateCustomers", corporateCustomers);
      // Also remove from main customers list
      customers = customers.filter((c) => !(c.id == id && c.isCorporate));
      saveItem("sgf_customers", customers);
      return { success: true };
    },
  },

  purchaseOrder: {
    list: () => purchaseOrders,
    listByCompany: (company: string) => purchaseOrders.filter((po) => po.company === company || (!po.company && company === "sgf")),
    getById: (id: number) => purchaseOrders.find((po) => po.id == id) || null,
    create: (data: any) => {
      // Auto-inherit company from linked corporate customer if not explicitly set
      let company = data.company;
      if (!company && data.corporateCustomerId) {
        const cust = corporateCustomers.find((c) => c.id == data.corporateCustomerId);
        if (cust?.company) company = cust.company;
      }
      const newItem = {
        ...data,
        company: company || "sgf",
        id: Date.now(),
        status: data.status || "received",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
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
    updateStatus: ({ id, status }: { id: number; status: string }) => {
      const idx = purchaseOrders.findIndex((po) => po.id == id);
      if (idx >= 0) {
        purchaseOrders[idx].status = status;
        purchaseOrders[idx].updatedAt = new Date().toISOString();
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

  barrel: {
    list: () => barrels,
    listByPurchaseOrder: (poId: number) => barrels.filter((b) => b.purchaseOrderId === poId),
    getById: (id: number) => barrels.find((b) => b.id == id) || null,
    create: (data: any) => {
      // Auto-inherit company from linked PO if not explicitly set
      let company = data.company;
      if (!company && data.purchaseOrderId) {
        const po = purchaseOrders.find((p) => p.id == data.purchaseOrderId);
        if (po?.company) company = po.company;
      }
      const newItem = {
        ...data,
        company: company || "sgf",
        id: Date.now(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
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

  coc: {
    list: () => certificatesOfCompliance,
    listByBarrel: (barrelId: number) => certificatesOfCompliance.filter((c) => c.barrelId === barrelId),
    listByPurchaseOrder: (poId: number) => certificatesOfCompliance.filter((c) => c.purchaseOrderId === poId),
    getById: (id: number) => certificatesOfCompliance.find((c) => c.id == id) || null,
    create: (data: any) => {
      let company = data.company;
      if (!company && data.barrelId) {
        const b = barrels.find((br) => br.id == data.barrelId);
        if (b?.company) company = b.company;
      }
      if (!company && data.purchaseOrderId) {
        const po = purchaseOrders.find((p) => p.id == data.purchaseOrderId);
        if (po?.company) company = po.company;
      }
      const newItem = {
        ...data,
        company: company || "sgf",
        id: Date.now(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
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
    /** Atomically delete all existing COCs for a PO and create new ones.
     *  Prevents race conditions from rapid-fire individual creates/deletes.
     *  Preserves batch numbers and product codes for existing COCs.
     *  All COCs created in a single batch with unique sequential IDs. */
    bulkGenerateForPO: (poId: number, cocDataList: any[], deleteOrphanIds: number[] = []) => {
      // 1. Remove orphaned COCs (packing list lines that no longer exist)
      if (deleteOrphanIds.length > 0) {
        certificatesOfCompliance = certificatesOfCompliance.filter((c) => !deleteOrphanIds.includes(c.id));
      }

      // 2. Remove all existing COCs for this PO — the new list is complete
      certificatesOfCompliance = certificatesOfCompliance.filter((c) => c.purchaseOrderId !== poId);

      // 3. Create all new COCs with guaranteed unique sequential IDs
      const created: any[] = [];
      const baseTime = Date.now();
      for (let i = 0; i < cocDataList.length; i++) {
        const data = cocDataList[i];
        const company = data.company || (() => {
          const po = purchaseOrders.find((p) => p.id == poId);
          return po?.company || "sgf";
        })();
        const newCOC = {
          ...data,
          company,
          id: baseTime + i, // sequential IDs, guaranteed unique
          createdAt: data.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        certificatesOfCompliance.push(newCOC);
        created.push(newCOC);
      }

      // 4. Save ONCE to localStorage — atomic write
      saveItem("sgf_certificatesOfCompliance", certificatesOfCompliance);
      return created;
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
        invoiceNumber,
        company: invCompany,
        customerId: po.corporateCustomerId,
        customer: { name: po.corporateCustomerName || "Corporate Customer" },
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
        return { id: found.id, name: found.name, email: found.email, role: found.role, pin: found.pin };
      }
      // Admin alias match — check if any stored user has this PIN and is admin
      if (ADMIN_ALIASES.includes(typedName)) {
        const adminFound = stored.find(
          (x: any) => (x.role === "admin" || x.role === "super_admin") && String(x.pin) === typedPin && x.isActive !== false
        );
        if (adminFound) {
          return { id: adminFound.id, name: adminFound.name, email: adminFound.email, role: adminFound.role, pin: adminFound.pin };
        }
      }
    }
  } catch { /* ignore */ }

  // 2. Allow "admin" as a generic alias — match against ANY hardcoded admin/super_admin PIN
  if (ADMIN_ALIASES.includes(typedName)) {
    const adminMatch = DEFAULT_USERS.find(
      (u) => (u.role === "admin" || u.role === "super_admin") && String(u.pin) === typedPin
    );
    if (adminMatch) {
      return { id: adminMatch.id, name: adminMatch.name, email: adminMatch.email, role: adminMatch.role, pin: adminMatch.pin };
    }
  }

  // 3. Check hardcoded defaults (fallback — survives data clears)
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

  return null;
}

// NOTE: load() is already called at line 143 after all module-level variables are declared.
// Do NOT call load() again here — it would overwrite in-memory data with stale localStorage.

function getEffectivePrice(stockItemId: number, priceTier: string, customerId: number): number {
  const sp = specialPrices.find((p) => p.customerId == customerId && p.stockItemId == stockItemId);
  if (sp) return Number(sp.specialPrice);
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
