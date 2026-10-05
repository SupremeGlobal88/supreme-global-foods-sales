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
  return [...SALES_REPS];
}

try {
  const loaded = loadSalesRepsFromStorage();
  if (loaded.length > 0) SALES_REPS = loaded;
} catch { /* keep defaults */ }

function saveSalesReps() {
  try { setStorageItem("sgf_salesReps", JSON.stringify(SALES_REPS)); } catch { /* ignore */ }
}

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
  return SALES_REPS.map((r) => ({ ...r }));
}

function getStaticCustomers() {
  return [...STATIC_CUSTOMERS.map((c: any) => ({ ...c, salesRepName: c.salesRepName || "" }))];
}

function getStaticProducts() {
  return [...STATIC_PRODUCTS.map((p: any) => ({ ...p }))];
}

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
let corporateCustomers = [] as any[];
let purchaseOrders = [] as any[];
let barrels = [] as any[];
let certificatesOfCompliance = [] as any[];
let packingListLines = [] as any[];

let invoiceGenerationLock = false;

function isValidArray(data: any, minLength: number, requiredKey?: string): boolean {
  if (!Array.isArray(data)) return false;
  if (data.length < minLength) return false;
  if (requiredKey && !data[0][requiredKey]) return false;
  return true;
}

function repairProductPrices(productList: any[]): { count: number; repaired: any[] } {
  let pricesRestored = 0;
  const repairedProducts: any[] = [];
  for (const prod of productList) {
    const hasAnyPrice = Number(prod.wholesalePrice) > 0 || Number(prod.corporatePrice) > 0 || Number(prod.bulkPrice) > 0 || Number(prod.retailPrice) > 0;
    if (hasAnyPrice) continue;
    let match: any = null;
    if (prod.productCode) match = STATIC_PRODUCTS.find((s: any) => s.productCode === prod.productCode);
    if (!match && prod.productCode) {
      const codeNorm = String(prod.productCode).toLowerCase().trim().replace(/\s+/g, " ");
      const colorNorm = String(prod.color || "").toLowerCase().trim();
      match = STATIC_PRODUCTS.find((s: any) =>
        String(s.productName || "").toLowerCase().trim().replace(/\s+/g, " ") === codeNorm &&
        (!colorNorm || String(s.color || "").toLowerCase().trim() === colorNorm)
      );
    }
    if (!match && prod.id != null) match = STATIC_PRODUCTS.find((s: any) => s.id == prod.id);
    if (!match && prod.productName) {
      const normalizedName = String(prod.productName).toLowerCase().trim().replace(/\s+/g, " ");
      match = STATIC_PRODUCTS.find((s: any) => String(s.productName || "").toLowerCase().trim().replace(/\s+/g, " ") === normalizedName);
    }
    if (match) {
      prod.wholesalePrice = match.wholesalePrice;
      prod.corporatePrice = match.corporatePrice;
      prod.bulkPrice = match.bulkPrice;
      prod.retailPrice = match.retailPrice;
      prod.costPrice = match.costPrice;
      prod.updatedAt = new Date().toISOString();
      pricesRestored++;
      repairedProducts.push(prod);
    }
  }
  return { count: pricesRestored, repaired: repairedProducts };
}

function repairBrokenQuotes(): number {
  let repaired = 0;
  for (const order of orders) {
    const orderNum = String(order.orderNumber || "");
    const isQuotePrefix = orderNum.toUpperCase().startsWith("QTE-");
    const isQuoteType = order.orderType === "quote";
    const isConverted = order.status === "converted";
    if (isQuotePrefix && !isQuoteType && !isConverted) {
      order.orderType = "quote";
      order.status = "draft";
      if (order.items && Array.isArray(order.items)) {
        for (const item of order.items) {
          if (item.stockItemId != null && item.quantity != null) {
            const product = products.find((p) => p.id == item.stockItemId);
            if (product) product.quantity = (product.quantity || 0) + item.quantity;
          }
        }
      }
      repaired++;
    }
  }
  if (repaired > 0) saveItem("sgf_products", products);
  return repaired;
}

function load() {
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
    const c = safeLoadArray("sgf_customers");
    if (c && c.length > 0) customers = c; else customers = getStaticCustomers();

    const p = safeLoadArray("sgf_products");
    if (p && p.length > 0) {
      products = p;
      const priceRepair = repairProductPrices(products);
      if (priceRepair.count > 0) {
        saveItem("sgf_products", products);
        console.log(`[PriceRepair] Restored prices for ${priceRepair.count} products from seed data`);
      }
    } else products = getStaticProducts();

    const o = safeLoadArray("sgf_orders");
    if (o) orders = o;

    const repairedQuotes = repairBrokenQuotes();
    if (repairedQuotes > 0) {
      console.log(`[QuoteRepair] Auto-repaired ${repairedQuotes} broken quote(s)`);
      saveItem("sgf_orders", orders);
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

  try { deduplicateAll(); } catch (e) { console.error("[load] deduplicateAll failed:", e); }

  try {
    const beforeCleanup = invoices.length;
    const toRemove: number[] = [];
    for (let idx = 0; idx < invoices.length; idx++) {
      const inv = invoices[idx];
      const linkedOrderNum = String(inv.orderNumber || "");
      if (linkedOrderNum.toUpperCase().startsWith("QTE-")) toRemove.push(idx);
    }
    for (let i = toRemove.length - 1; i >= 0; i--) invoices.splice(toRemove[i], 1);
    if (toRemove.length > 0) saveItem("sgf_invoices", invoices);
  } catch (e) { console.error("[load] invoice cleanup failed:", e); }

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
    if (linkedCount > 0) saveItem("sgf_invoices", invoices);
  } catch (e) { console.error("[load] auto-link failed:", e); }

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
  const seenOrders = new Map<number, any>();
  for (const o of orders) {
    const id = Number(o.id);
    if (!seenOrders.has(id)) seenOrders.set(id, o);
    else {
      const existing = seenOrders.get(id);
      const existingTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
      const newTime = new Date(o.updatedAt || o.createdAt || 0).getTime();
      if (newTime > existingTime) seenOrders.set(id, o);
    }
  }
  if (seenOrders.size < orders.length) {
    orders = Array.from(seenOrders.values());
    saveItem("sgf_orders", orders);
  }

  const seenInvoices = new Map<number, any>();
  for (const i of invoices) {
    const id = Number(i.id);
    if (!seenInvoices.has(id)) seenInvoices.set(id, i);
    else {
      const existing = seenInvoices.get(id);
      const existingTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
      const newTime = new Date(i.updatedAt || i.createdAt || 0).getTime();
      if (newTime > existingTime) seenInvoices.set(id, i);
    }
  }
  if (seenInvoices.size < invoices.length) {
    invoices = Array.from(seenInvoices.values());
    saveItem("sgf_invoices", invoices);
  }

  const seenAppointments = new Map<number, any>();
  for (const a of appointments) {
    const id = Number(a.id);
    if (!seenAppointments.has(id)) seenAppointments.set(id, a);
    else {
      const existing = seenAppointments.get(id);
      const existingTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
      const newTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
      if (newTime > existingTime) seenAppointments.set(id, a);
    }
  }
  if (seenAppointments.size < appointments.length) {
    appointments = Array.from(seenAppointments.values());
    saveItem("sgf_appointments", appointments);
  }

  const seenCheckins = new Map<number, any>();
  for (const c of checkins) {
    const id = Number(c.id);
    if (!seenCheckins.has(id)) seenCheckins.set(id, c);
    else {
      const existing = seenCheckins.get(id);
      const existingTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
      const newTime = new Date(c.updatedAt || c.createdAt || 0).getTime();
      if (newTime > existingTime) seenCheckins.set(id, c);
    }
  }
  if (seenCheckins.size < checkins.length) {
    checkins = Array.from(seenCheckins.values());
    saveItem("sgf_checkins", checkins);
  }
}

function saveItem(key: string, value: any) {
  try {
    setStorageItem(key, JSON.stringify(value));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("sgf:dataChanged", { detail: { key } }));
    }
  } catch (e) {
    console.error(`[saveItem] FAILED to save ${key}:`, e);
  }
}

export function reloadFromStorage() {
  load();
}

load();

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
      const newCustomer = { ...data, id: newId, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
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
    getByCategory: ({ category }: { category: string }) => products.filter((p: any) => (p.category || "").toLowerCase() === category.toLowerCase()),
    getCategories: () => {
      const cats = new Set<string>();
      products.forEach((p: any) => { if (p.category) cats.add(p.category); });
      return Array.from(cats).sort();
    },
    getLowStock: () => products.filter((p: any) => p.quantity != null && p.quantity <= (p.minStock || 10)),
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

      // CRITICAL FIX: Calculate unit prices, line totals, and order totals.
      // The frontend payload often does NOT include unitPrice or productName,
      // so we must compute them here from the stock items and pricing tiers.
      const isSample = data.orderType === "sample";
      const isQuote = data.orderType === "quote";
      const priceTier = isSample ? "corporate" : (data.priceTier || "wholesale");

      const items = (data.items || []).map((item: any) => {
        const stock = products.find((p) => p.id == item.stockItemId);
        const conversion = item.conversion || 1;

        // Calculate unitPrice from stock tier pricing if not provided by frontend
        let unitPrice = item.unitPrice;
        if (!unitPrice || Number(unitPrice) <= 0) {
          const basePrice = getEffectivePrice(Number(item.stockItemId), priceTier, Number(data.customerId), isSample);
          unitPrice = basePrice * conversion;
        }

        return {
          ...item,
          productName: stock?.productName || item.productName || "Unknown",
          productCode: stock?.productCode || item.productCode || "",
          unitPrice,
          lineTotal: unitPrice * (item.quantity || 0),
        };
      });

      const subtotal = isSample || isQuote ? 0 : items.reduce((sum: number, item: any) => sum + (item.lineTotal || 0), 0);
      const customer = customers.find((c) => c.id == data.customerId);
      const vatRate = customer?.vatExempt ? 0 : 0.15;
      const vatAmount = isSample || isQuote ? 0 : subtotal * vatRate;
      const total = isSample || isQuote ? 0 : subtotal + vatAmount;

      const newOrder = {
        ...data,
        id: newId,
        orderNumber: data.orderNumber || `ORD${String(newId).padStart(4, "0")}`,
        items,
        subtotal,
        vatAmount,
        total,
        totalAmount: total,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      orders.push(newOrder);
      saveItem("sgf_orders", orders);

      // Deduct stock for non-sample, non-quote orders (account for conversion)
      if (!isSample && !isQuote) {
        for (const item of items) {
          const product = products.find((p) => p.id == item.stockItemId);
          if (product) {
            const conversion = item.conversion || 1;
            product.quantity = (product.quantity || 0) - ((item.quantity || 0) * conversion);
          }
        }
        saveItem("sgf_products", products);
      }

      return newOrder;
    },
    update: ({ id, data }: { id: number; data: any }) => {
      const idx = orders.findIndex((o) => o.id == id);
      if (idx >= 0) {
        let updates = { ...data };
        // CRITICAL FIX: Recalculate unit prices, line totals, and totals if items are provided.
        if (data.items && Array.isArray(data.items)) {
          const isSample = data.orderType === "sample" || orders[idx].orderType === "sample";
          const isQuote = data.orderType === "quote" || orders[idx].orderType === "quote";
          const priceTier = isSample ? "corporate" : (data.priceTier || orders[idx].priceTier || "wholesale");
          const customerId = data.customerId || orders[idx].customerId;

          const items = data.items.map((item: any) => {
            const stock = products.find((p) => p.id == item.stockItemId);
            const conversion = item.conversion || 1;

            let unitPrice = item.unitPrice;
            if (!unitPrice || Number(unitPrice) <= 0) {
              const basePrice = getEffectivePrice(Number(item.stockItemId), priceTier, Number(customerId), isSample);
              unitPrice = basePrice * conversion;
            }

            return {
              ...item,
              productName: stock?.productName || item.productName || "Unknown",
              productCode: stock?.productCode || item.productCode || "",
              unitPrice,
              lineTotal: unitPrice * (item.quantity || 0),
            };
          });

          const subtotal = isSample || isQuote ? 0 : items.reduce((sum: number, item: any) => sum + (item.lineTotal || 0), 0);
          const customer = customers.find((c) => c.id == customerId);
          const vatRate = customer?.vatExempt ? 0 : 0.15;
          const vatAmount = isSample || isQuote ? 0 : subtotal * vatRate;
          const total = isSample || isQuote ? 0 : subtotal + vatAmount;
          updates = { ...updates, items, subtotal, vatAmount, total, totalAmount: total };
        }
        orders[idx] = { ...orders[idx], ...updates, updatedAt: new Date().toISOString() };
        saveItem("sgf_orders", orders);
        return orders[idx];
      }
      return null;
    },
    delete: (id: number) => {
      const order = orders.find((o) => o.id === id);
      let deletedInvoiceIds: number[] = [];
      if (order) {
        if (order.items && Array.isArray(order.items)) {
          for (const item of order.items) {
            if (item.stockItemId != null && item.quantity != null) {
              const product = products.find((p) => p.id == item.stockItemId);
              if (product) {
                const conversion = item.conversion || 1;
                product.quantity = (product.quantity || 0) + ((item.quantity || 0) * conversion);
              }
            }
          }
          saveItem("sgf_products", products);
        }
        const linkedInvoices = invoices.filter((i) => i.orderId == id);
        if (linkedInvoices.length > 0) {
          deletedInvoiceIds = linkedInvoices.map((i) => i.id);
          const linkedIds = new Set(deletedInvoiceIds);
          invoices = invoices.filter((i) => !linkedIds.has(i.id));
          saveItem("sgf_invoices", invoices);
        }
        orders = orders.filter((o) => o.id !== id);
        saveItem("sgf_orders", orders);
      }
      return { success: true, deletedInvoiceIds, deletedOrder: order };
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
        if (status === "rescheduled") appointments[idx].reminderSent = false;
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
    delete