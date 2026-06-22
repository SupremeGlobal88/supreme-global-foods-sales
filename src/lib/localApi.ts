import { STATIC_CUSTOMERS, STATIC_PRODUCTS } from "@/data/staticData";

const STORAGE_KEYS = {
  customers: "sgf_customers",
  products: "sgf_products",
  orders: "sgf_orders",
  invoices: "sgf_invoices",
  appointments: "sgf_appointments",
  checkins: "sgf_checkins",
  initialized: "sgf_initialized",
};

function getStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      // Return static data as fallback for customers and products
      if (key === STORAGE_KEYS.customers) return STATIC_CUSTOMERS as unknown as T;
      if (key === STORAGE_KEYS.products) return STATIC_PRODUCTS as unknown as T;
      return fallback;
    }
    return JSON.parse(raw) as T;
  } catch {
    if (key === STORAGE_KEYS.customers) return STATIC_CUSTOMERS as unknown as T;
    if (key === STORAGE_KEYS.products) return STATIC_PRODUCTS as unknown as T;
    return fallback;
  }
}

function setStorage<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}

function initData() {
  if (localStorage.getItem(STORAGE_KEYS.initialized)) return;

  const customers = STATIC_CUSTOMERS.map((c: any) => ({
    ...c,
    id: c.id,
    createdAt: c.createdAt ? new Date(c.createdAt) : new Date(),
    updatedAt: c.updatedAt ? new Date(c.updatedAt) : new Date(),
  }));

  const products = STATIC_PRODUCTS.map((p: any) => ({
    ...p,
    id: p.id,
    corporatePrice: p.corporatePrice,
    bulkPrice: p.bulkPrice,
    wholesalePrice: p.wholesalePrice,
    retailPrice: p.retailPrice,
    createdAt: p.createdAt ? new Date(p.createdAt) : new Date(),
    updatedAt: p.updatedAt ? new Date(p.updatedAt) : new Date(),
  }));

  setStorage(STORAGE_KEYS.customers, customers);
  setStorage(STORAGE_KEYS.products, products);
  setStorage(STORAGE_KEYS.orders, []);
  setStorage(STORAGE_KEYS.invoices, []);
  setStorage(STORAGE_KEYS.appointments, []);
  setStorage(STORAGE_KEYS.checkins, []);
  localStorage.setItem(STORAGE_KEYS.initialized, "true");
}

export const localApi = {
  init: initData,

  // Stock / Products
  stock: {
    list: () => {
      initData();
      return getStorage(STORAGE_KEYS.products, []);
    },
    getById: (id: number) => {
      const items = getStorage<any[]>(STORAGE_KEYS.products, []);
      return items.find((i) => i.id === id) || null;
    },
    update: (id: number, data: any) => {
      const items = getStorage<any[]>(STORAGE_KEYS.products, []);
      const idx = items.findIndex((i) => i.id === id);
      if (idx >= 0) {
        items[idx] = { ...items[idx], ...data, updatedAt: new Date() };
        setStorage(STORAGE_KEYS.products, items);
        return items[idx];
      }
      return null;
    },
  },

  // Customers
  customers: {
    list: () => {
      initData();
      return getStorage(STORAGE_KEYS.customers, []);
    },
    getById: (id: number) => {
      const items = getStorage<any[]>(STORAGE_KEYS.customers, []);
      return items.find((i) => i.id === id) || null;
    },
    create: (data: any) => {
      const items = getStorage<any[]>(STORAGE_KEYS.customers, []);
      const newItem = { ...data, id: Date.now(), createdAt: new Date(), updatedAt: new Date() };
      items.push(newItem);
      setStorage(STORAGE_KEYS.customers, items);
      return newItem;
    },
    update: (id: number, data: any) => {
      const items = getStorage<any[]>(STORAGE_KEYS.customers, []);
      const idx = items.findIndex((i) => i.id === id);
      if (idx >= 0) {
        items[idx] = { ...items[idx], ...data, updatedAt: new Date() };
        setStorage(STORAGE_KEYS.customers, items);
        return items[idx];
      }
      return null;
    },
    delete: (id: number) => {
      const items = getStorage<any[]>(STORAGE_KEYS.customers, []);
      const filtered = items.filter((i) => i.id !== id);
      setStorage(STORAGE_KEYS.customers, filtered);
      return { success: true };
    },
    search: (query: string) => {
      const items = getStorage<any[]>(STORAGE_KEYS.customers, []);
      const q = query.toLowerCase();
      return items.filter(
        (i) =>
          i.name?.toLowerCase().includes(q) ||
          i.customerCode?.toLowerCase().includes(q) ||
          i.city?.toLowerCase().includes(q) ||
          i.phone?.toLowerCase().includes(q)
      );
    },
    stats: () => {
      const items = getStorage<any[]>(STORAGE_KEYS.customers, []);
      return { total: items.length, active: items.length, inactive: 0, thisMonth: items.length };
    },
  },

  // Orders
  orders: {
    list: () => getStorage(STORAGE_KEYS.orders, []),
    getById: (id: number) => {
      const items = getStorage<any[]>(STORAGE_KEYS.orders, []);
      return items.find((i) => i.id === id) || null;
    },
    create: (data: any) => {
      const items = getStorage<any[]>(STORAGE_KEYS.orders, []);
      const orderNumber = `ORD-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${String(items.length + 1).padStart(4, "0")}`;
      const newOrder = {
        ...data,
        id: Date.now(),
        orderNumber,
        status: "pending",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      items.push(newOrder);
      setStorage(STORAGE_KEYS.orders, items);
      return newOrder;
    },
    updateStatus: (id: number, status: string) => {
      const items = getStorage<any[]>(STORAGE_KEYS.orders, []);
      const idx = items.findIndex((i) => i.id === id);
      if (idx >= 0) {
        items[idx] = { ...items[idx], status, updatedAt: new Date() };
        setStorage(STORAGE_KEYS.orders, items);
        return items[idx];
      }
      return null;
    },
    stats: () => {
      const items = getStorage<any[]>(STORAGE_KEYS.orders, []);
      return {
        total: items.length,
        pending: items.filter((i) => i.status === "pending").length,
        ready: items.filter((i) => i.status === "ready").length,
        delivered: items.filter((i) => i.status === "delivered").length,
      };
    },
  },

  // Invoices
  invoices: {
    list: () => getStorage(STORAGE_KEYS.invoices, []),
    create: (data: any) => {
      const items = getStorage<any[]>(STORAGE_KEYS.invoices, []);
      const invoiceNumber = `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${String(items.length + 1).padStart(4, "0")}`;
      const newInvoice = {
        ...data,
        id: Date.now(),
        invoiceNumber,
        status: "unpaid",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      items.push(newInvoice);
      setStorage(STORAGE_KEYS.invoices, items);
      return newInvoice;
    },
    updateStatus: (id: number, status: string, amountPaid?: number) => {
      const items = getStorage<any[]>(STORAGE_KEYS.invoices, []);
      const idx = items.findIndex((i) => i.id === id);
      if (idx >= 0) {
        items[idx] = { ...items[idx], status, amountPaid: amountPaid || 0, updatedAt: new Date() };
        setStorage(STORAGE_KEYS.invoices, items);
        return items[idx];
      }
      return null;
    },
    stats: () => {
      const items = getStorage<any[]>(STORAGE_KEYS.invoices, []);
      const total = items.reduce((s, i: any) => s + (Number(i.totalAmount) || 0), 0);
      const paid = items.filter((i: any) => i.status === "paid").length;
      return { total, paid, outstanding: total, overdue: 0 };
    },
  },

  // Appointments
  appointments: {
    list: () => getStorage(STORAGE_KEYS.appointments, []),
    create: (data: any) => {
      const items = getStorage<any[]>(STORAGE_KEYS.appointments, []);
      const newItem = { ...data, id: Date.now(), status: "scheduled", createdAt: new Date() };
      items.push(newItem);
      setStorage(STORAGE_KEYS.appointments, items);
      return newItem;
    },
    updateStatus: (id: number, status: string) => {
      const items = getStorage<any[]>(STORAGE_KEYS.appointments, []);
      const idx = items.findIndex((i) => i.id === id);
      if (idx >= 0) {
        items[idx] = { ...items[idx], status };
        setStorage(STORAGE_KEYS.appointments, items);
        return items[idx];
      }
      return null;
    },
  },

  // Checkins
  checkins: {
    list: () => getStorage(STORAGE_KEYS.checkins, []),
    create: (data: any) => {
      const items = getStorage<any[]>(STORAGE_KEYS.checkins, []);
      const newItem = { ...data, id: Date.now(), createdAt: new Date() };
      items.push(newItem);
      setStorage(STORAGE_KEYS.checkins, items);
      return newItem;
    },
  },

  // Dashboard
  dashboard: {
    stats: () => {
      const orders = getStorage<any[]>(STORAGE_KEYS.orders, []);
      const customers = getStorage<any[]>(STORAGE_KEYS.customers, []);
      const products = getStorage<any[]>(STORAGE_KEYS.products, []);
      const totalRevenue = orders.reduce((s, o) => s + (Number(o.totalAmount) || 0), 0);
      return {
        totalRevenue,
        totalOrders: orders.length,
        totalCustomers: customers.length,
        lowStockItems: products.filter((p) => p.status === "low_stock" || p.status === "out_of_stock").length,
        pendingOrders: orders.filter((o) => o.status === "pending").length,
        readyForDelivery: orders.filter((o) => o.status === "ready").length,
        overdueInvoices: 0,
        recentOrders: orders.slice(-5).reverse(),
      };
    },
  },

  // Reset
  reset: () => {
    Object.values(STORAGE_KEYS).forEach((k) => localStorage.removeItem(k));
    initData();
  },
};
