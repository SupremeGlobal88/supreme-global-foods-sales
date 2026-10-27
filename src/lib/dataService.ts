import { v4 as uuidv4 } from "uuid";

// ============================================================
// localStorage KEYS
// ============================================================
const LS_PREFIX = "sgf_";
const keys = {
  customers: LS_PREFIX + "customers",
  orders: LS_PREFIX + "orders",
  invoices: LS_PREFIX + "invoices",
  stockItems: LS_PREFIX + "stockItems",
  specialPrices: LS_PREFIX + "specialPrices",
  bankDetails: LS_PREFIX + "bankDetails",
  companyConfig: LS_PREFIX + "companyConfig",
  users: LS_PREFIX + "users",
};

// ============================================================
// In-memory caches + dirty-flag
// ============================================================
let cache: Record<string, any[]> = {
  customers: [],
  orders: [],
  invoices: [],
  stockItems: [],
  specialPrices: [],
  bankDetails: [],
  companyConfig: [],
  users: [],
};
let dirty = false;

function readLS(key: string): any[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLS(key: string, data: any[]) {
  localStorage.setItem(key, JSON.stringify(data));
}

function writeAll() {
  if (!dirty) return;
  Object.entries(keys).forEach(([k, lsKey]) => writeLS(lsKey, cache[k]));
  dirty = false;
}

// ============================================================
// Seed helpers
// ============================================================
function seedIfEmpty(key: string, factory: () => any[]) {
  const existing = readLS(keys[key]);
  if (existing.length === 0) {
    const data = factory();
    cache[key] = data;
    writeLS(keys[key], data);
  } else {
    cache[key] = existing;
  }
}

function seedBankDetails() {
  seedIfEmpty("bankDetails", () => [
    {
      id: 1,
      bankName: "FNB",
      accountName: "Supreme Global Foods",
      accountNumber: "62830058046",
      branchCode: "250655",
      swiftCode: "FIRNZAJJ",
    },
  ]);
}

function seedCompanyConfig() {
  seedIfEmpty("companyConfig", () => [
    {
      id: 1,
      name: "Supreme Global Foods",
      legalName: "Supreme Global Foods Pty Ltd",
      registrationNumber: "2020/123456/07",
      vatNumber: "1234567890",
      address: {
        street: "123 Main Street",
        city: "Johannesburg",
        province: "Gauteng",
        postalCode: "2000",
      },
      contact: {
        phone: "+27 11 123 4567",
        email: "info@supremeglobalfoods.com",
        website: "www.supremeglobalfoods.com",
      },
      logoUrl: "/logo.png",
      primaryColor: "#D4A843",
      secondaryColor: "#0A0A0B",
      documentColor: "#D4A843",
    },
  ]);
}

function seedUsers() {
  seedIfEmpty("users", () => [
    { id: 1, name: "Collin", email: "collin@supremeglobalfoods.com", role: "super_admin", pin: "2580" },
    { id: 2, name: "Adeli", email: "adeli@supremeglobalfoods.com", role: "admin", pin: "1111" },
    { id: 3, name: "Inhouse", email: "inhouse@supremeglobalfoods.com", role: "sales_rep", pin: "2222" },
    { id: 4, name: "Michael", email: "michael@supremeglobalfoods.com", role: "sales_rep", pin: "3333" },
    { id: 5, name: "Nkosana", email: "nkosana@supremeglobalfoods.com", role: "sales_rep", pin: "4444" },
    { id: 6, name: "Tebogo Bila", email: "tebogo@supremeglobalfoods.com", role: "sales_rep", pin: "6666" },
    { id: 7, name: "Aggie", email: "aggie@supremeglobalfoods.com", role: "sales_rep", pin: "1018" },
    { id: 8, name: "Ronald", email: "ronald@supremeglobalfoods.com", role: "admin", pin: "2581" },
    { id: 9, name: "Jolene", email: "jolene@supremeglobalfoods.com", role: "sales_rep", pin: "7777" },
    { id: 10, name: "David", email: "david@supremeglobalfoods.com", role: "sales_rep", pin: "8888" },
  ]);
}

// ============================================================
// Deduplication
// ============================================================
function isMoreRecent(a: any, b: any): boolean {
  const aDate = new Date(a.updatedAt || a.createdAt || 0).getTime();
  const bDate = new Date(b.updatedAt || b.createdAt || 0).getTime();
  return aDate > bDate;
}

function deduplicateAll() {
  let customers = cache.customers || [];
  let orders = cache.orders || [];
  let invoices = cache.invoices || [];
  let stockItems = cache.stockItems || [];
  let specialPrices = cache.specialPrices || [];

  // Deduplicate customers: group by normalized name + phone, keep most recent
  const custMap = new Map<string, any>();
  for (const c of customers) {
    const key = ((c.name || "") + "|" + (c.phone || "")).toString().trim().replace(/\s+/g, " ").toLowerCase();
    if (!key) continue; // skip customers with no name
    const existing = custMap.get(key);
    if (!existing || isMoreRecent(c, existing)) {
      custMap.set(key, c);
    }
  }
  customers = Array.from(custMap.values());

  // Deduplicate orders by ID
  const orderMap = new Map<number, any>();
  for (const o of orders) {
    const id = Number(o.id);
    if (!id) continue;
    const existing = orderMap.get(id);
    if (!existing || isMoreRecent(o, existing)) {
      orderMap.set(id, o);
    }
  }
  orders = Array.from(orderMap.values());

  // Deduplicate invoices by ID
  const invMap = new Map<number, any>();
  for (const i of invoices) {
    const id = Number(i.id);
    if (!id) continue;
    const existing = invMap.get(id);
    if (!existing || isMoreRecent(i, existing)) {
      invMap.set(id, i);
    }
  }
  invoices = Array.from(invMap.values());

  // Deduplicate stock items by ID
  const stockMap = new Map<number, any>();
  for (const s of stockItems) {
    const id = Number(s.id);
    if (!id) continue;
    const existing = stockMap.get(id);
    if (!existing || isMoreRecent(s, existing)) {
      stockMap.set(id, s);
    }
  }
  stockItems = Array.from(stockMap.values());

  // Deduplicate special prices by ID
  const spMap = new Map<number, any>();
  for (const sp of specialPrices) {
    const id = Number(sp.id);
    if (!id) continue;
    const existing = spMap.get(id);
    if (!existing || isMoreRecent(sp, existing)) {
      spMap.set(id, sp);
    }
  }
  specialPrices = Array.from(spMap.values());

  cache.customers = customers;
  cache.orders = orders;
  cache.invoices = invoices;
  cache.stockItems = stockItems;
  cache.specialPrices = specialPrices;
  dirty = true;
  writeAll();
}

// ============================================================
// init() — called once on app boot
// ============================================================
let initialised = false;
export function init() {
  if (initialised) return;
  initialised = true;

  // Seed default data
  seedBankDetails();
  seedCompanyConfig();
  seedUsers();

  // Load everything from localStorage into memory
  cache.customers = readLS(keys.customers);
  cache.orders = readLS(keys.orders);
  cache.invoices = readLS(keys.invoices);
  cache.stockItems = readLS(keys.stockItems);
  cache.specialPrices = readLS(keys.specialPrices);
  cache.bankDetails = readLS(keys.bankDetails);
  cache.companyConfig = readLS(keys.companyConfig);
  cache.users = readLS(keys.users);

  // Deduplicate on load
  deduplicateAll();
}

// ============================================================
// reloadFromStorage — re-read from localStorage (use after
// external writes, e.g. Firebase sync)
// ============================================================
export function reloadFromStorage() {
  cache.customers = readLS(keys.customers);
  cache.orders = readLS(keys.orders);
  cache.invoices = readLS(keys.invoices);
  cache.stockItems = readLS(keys.stockItems);
  cache.specialPrices = readLS(keys.specialPrices);
  cache.bankDetails = readLS(keys.bankDetails);
  cache.companyConfig = readLS(keys.companyConfig);
  cache.users = readLS(keys.users);
  deduplicateAll();
}

// ============================================================
// Force write (for tests / manual sync)
// ============================================================
export function flush() {
  writeAll();
}

// ============================================================
// Generic CRUD factory
// ============================================================
function createCrud<T extends { id?: number | string }>(key: string) {
  return {
    list: (): T[] => {
      init();
      return cache[key] || [];
    },
    get: (id: number | string): T | undefined => {
      init();
      return (cache[key] || []).find((item: T) => String(item.id) === String(id));
    },
    create: (data: Omit<T, "id">): T => {
      init();
      const newItem = { ...data, id: uuidv4(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as T;
      cache[key] = [...(cache[key] || []), newItem];
      dirty = true;
      writeAll();
      return newItem;
    },
    update: (id: number | string, data: Partial<T>): T | undefined => {
      init();
      const idx = (cache[key] || []).findIndex((item: T) => String(item.id) === String(id));
      if (idx === -1) return undefined;
      const updated = { ...(cache[key] || [])[idx], ...data, updatedAt: new Date().toISOString() };
      cache[key] = [...(cache[key] || []).slice(0, idx), updated, ...(cache[key] || []).slice(idx + 1)];
      dirty = true;
      writeAll();
      return updated;
    },
    delete: (id: number | string): boolean => {
      init();
      const originalLength = (cache[key] || []).length;
      cache[key] = (cache[key] || []).filter((item: T) => String(item.id) !== String(id));
      const removed = (cache[key] || []).length < originalLength;
      if (removed) {
        dirty = true;
        writeAll();
      }
      return removed;
    },
  };
}

// ============================================================
// dataService export
// ============================================================
export const dataService = {
  customer: {
    ...createCrud("customers"),
    search: (query: string) => {
      init();
      const list = cache.customers || [];
      if (!query || query.trim() === "") return list;
      const q = query.toLowerCase();
      return list.filter((c: any) =>
        (c.name || "").toLowerCase().includes(q) ||
        (c.customerCode || "").toLowerCase().includes(q) ||
        (c.city || "").toLowerCase().includes(q) ||
        (c.phone || "").toLowerCase().includes(q)
      );
    },
    create: (data: any) => {
      init();
      const normName = (data.name || "").toString().trim().replace(/\s+/g, " ").toLowerCase();
      // Prevent duplicate: check if customer with same normalized name already exists
      const existingIdx = cache.customers.findIndex((c) =>
        (c.name || "").toString().trim().replace(/\s+/g, " ").toLowerCase() === normName
      );
      if (existingIdx !== -1) {
        // Update existing instead of creating duplicate
        const existing = cache.customers[existingIdx];
        const updated = { ...existing, ...data, updatedAt: new Date().toISOString() };
        cache.customers = [
          ...cache.customers.slice(0, existingIdx),
          updated,
          ...cache.customers.slice(existingIdx + 1),
        ];
        dirty = true;
        writeAll();
        return updated;
      }
      const newCustomer = { ...data, id: uuidv4(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      cache.customers = [...cache.customers, newCustomer];
      dirty = true;
      writeAll();
      return newCustomer;
    },
    bulkUpload: (rows: any[]) => {
      init();
      const results = { created: 0, updated: 0, errors: [] as string[] };
      for (const row of rows) {
        try {
          const name = row.name || row.Name || row.customerName || "";
          const phone = row.phone || row.Phone || row.phoneNumber || "";
          const code = row.customerCode || row.Code || row.code || "";
          const normName = (name || "").toString().trim().replace(/\s+/g, " ").toLowerCase();
          // Match by normalized customer name, or by customerCode if provided
          const existingIdx = cache.customers.findIndex((c) => {
            const nameMatch = (c.name || "").toString().trim().replace(/\s+/g, " ").toLowerCase() === normName;
            const codeMatch = code && c.customerCode && c.customerCode.toLowerCase() === code.toLowerCase();
            return nameMatch || codeMatch;
          });
          if (existingIdx !== -1) {
            const existing = cache.customers[existingIdx];
            const updated = { ...existing, ...row, updatedAt: new Date().toISOString() };
            cache.customers = [
              ...cache.customers.slice(0, existingIdx),
              updated,
              ...cache.customers.slice(existingIdx + 1),
            ];
            results.updated++;
          } else {
            const newCustomer = { ...row, id: uuidv4(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
            cache.customers = [...cache.customers, newCustomer];
            results.created++;
          }
        } catch (err: any) {
          results.errors.push(err.message || "Unknown error");
        }
      }
      dirty = true;
      writeAll();
      return results;
    },
  },
  order: {
    ...createCrud("orders"),
    getByCustomer: (customerId: number | string) => {
      init();
      return (cache.orders || []).filter((o: any) => String(o.customerId) === String(customerId));
    },
    getByStatus: (status: string) => {
      init();
      return (cache.orders || []).filter((o: any) => o.status === status);
    },
  },
  invoice: {
    ...createCrud("invoices"),
    getByCustomer: (customerId: number | string) => {
      init();
      return (cache.invoices || []).filter((i: any) => String(i.customerId) === String(customerId));
    },
    getByOrder: (orderId: number | string) => {
      init();
      return (cache.invoices || []).find((i: any) => String(i.orderId) === String(orderId));
    },
  },
  stockItem: {
    ...createCrud("stockItems"),
    search: (query: string) => {
      init();
      const list = cache.stockItems || [];
      if (!query || query.trim() === "") return list;
      const q = query.toLowerCase();
      return list.filter((s: any) =>
        (s.productName || "").toLowerCase().includes(q) ||
        (s.productCode || "").toLowerCase().includes(q) ||
        (s.category || "").toLowerCase().includes(q)
      );
    },
  },
  specialPrice: createCrud("specialPrices"),
  bankDetail: createCrud("bankDetails"),
  companyConfig: createCrud("companyConfig"),
  user: {
    ...createCrud("users"),
    findByEmail: (email: string) => {
      init();
      return (cache.users || []).find((u: any) => u.email?.toLowerCase() === email?.toLowerCase());
    },
    findByName: (name: string) => {
      init();
      return (cache.users || []).find((u: any) => u.name?.toLowerCase() === name?.toLowerCase());
    },
  },
};

// ============================================================
// Banking details helper
// ============================================================
export function getBankingDetails() {
  init();
  return (cache.bankDetails || [])[0];
}

// ============================================================
// Invoice number generator
// ============================================================
export function generateInvoiceForOrder(orderId: number | string): string | null {
  init();
  const order = cache.orders.find((o: any) => String(o.id) === String(orderId));
  if (!order) return null;

  // Check if invoice already exists
  const existing = cache.invoices.find((i: any) => String(i.orderId) === String(orderId));
  if (existing) return existing.invoiceNumber;

  // Generate invoice number
  const prefix = "SGF";
  const count = cache.invoices.length + 1;
  const invoiceNumber = `${prefix}-${String(count).padStart(5, "0")}`;

  const invoice = {
    id: uuidv4(),
    orderId: order.id,
    customerId: order.customerId,
    invoiceNumber,
    invoiceDate: new Date().toISOString(),
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    subtotal: order.subtotal || 0,
    vatAmount: order.vatAmount || 0,
    total: order.total || 0,
    balanceDue: order.total || 0,
    status: "pending",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  cache.invoices = [...cache.invoices, invoice];
  dirty = true;
  writeAll();
  return invoiceNumber;
}

// ============================================================
// Stats helpers
// ============================================================
export function getOrderStats() {
  init();
  const orders = cache.orders || [];
  return {
    total: orders.length,
    pending: orders.filter((o: any) => o.status === "pending").length,
    picking: orders.filter((o: any) => o.status === "picking").length,
    ready: orders.filter((o: any) => o.status === "ready").length,
    delivered: orders.filter((o: any) => o.status === "delivered").length,
    cancelled: orders.filter((o: any) => o.status === "cancelled").length,
    totalValue: orders.reduce((sum: number, o: any) => sum + (o.total || 0), 0),
  };
}

export function getSalesRepStats(salesRepName: string) {
  init();
  const orders = cache.orders || [];
  const repOrders = orders.filter((o: any) => o.salesRepName === salesRepName);
  return {
    totalOrders: repOrders.length,
    totalValue: repOrders.reduce((sum: number, o: any) => sum + (o.total || 0), 0),
    averageOrderValue: repOrders.length > 0 ? repOrders.reduce((sum: number, o: any) => sum + (o.total || 0), 0) / repOrders.length : 0,
  };
}

// ============================================================
// Export init for explicit calls
// ============================================================
export { init as initDataService };
