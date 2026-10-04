import { dataService } from "./dataService";
import { getStorageItem, setStorageItem } from "./compressedStorage";

// ═══════════════════════════════════════════════════════════════
//  DATA SERVICE EXTRAS — adds missing properties & aliases
//  required by localLink.ts case handlers.
//  SAFETY: This file ONLY adds properties; never overwrites existing ones.
//  EXCEPTION: order.getStats MUST be overridden because the base
//  version in dataService.ts only returns total/totalValue/today.
// ═══════════════════════════════════════════════════════════════

// ─── 1. SIMPLE ALIASES ───
if (!(dataService as any).stock) {
  (dataService as any).stock = dataService.product;
}

if (!(dataService as any).audit) {
  (dataService as any).audit = dataService.auditLog;
}

if (!(dataService as any).coc) {
  (dataService as any).coc = dataService.certificateOfCompliance;
}

if (!(dataService as any).checkin) {
  (dataService as any).checkin = dataService.checkIn;
}

// ─── 2. AUTH ───
if (!(dataService as any).auth) {
  (dataService as any).auth = {
    me: () => {
      try {
        const raw = localStorage.getItem("demo_user");
        return raw ? JSON.parse(raw) : null;
      } catch { return null; }
    },
  };
}

// ─── 3. SALES REP ───
// Sales reps are stored in Firebase under "salesReps" path → localStorage "sgf_salesReps".
// CRITICAL: They are NOT app users. Users (sgf_users) are for login/auth only.
// If sgf_salesReps is empty/missing reps, we derive from customer/order data using
// multiple field fallbacks, and from users array (role === "sales_rep").

// The 5 base hardcoded reps — ALWAYS present as foundation
const BASE_REPS = [
  { id: 1, name: "Adeli", isActive: true, role: "sales_rep", email: "", phone: "", region: "", vehicleReg: "" },
  { id: 2, name: "Inhouse", isActive: true, role: "sales_rep", email: "", phone: "", region: "", vehicleReg: "" },
  { id: 3, name: "Michael", isActive: true, role: "sales_rep", email: "", phone: "", region: "", vehicleReg: "" },
  { id: 4, name: "Nkosana", isActive: true, role: "sales_rep", email: "", phone: "", region: "", vehicleReg: "" },
  { id: 5, name: "Tebogo Bila", isActive: true, role: "sales_rep", email: "", phone: "", region: "", vehicleReg: "" },
];

// Helper: extract rep name from customer using multiple field fallbacks
function getRepNameFromCustomer(c: any): string {
  if (!c || typeof c !== "object") return "";
  return String(
    c.salesRepName || c.salesRep || c.rep || c.repName || c.assignedTo || c.assignedRep || ""
  ).trim();
}

// Helper: extract rep name from order/purchaseOrder/invoice using multiple field fallbacks
function getRepNameFromOrder(o: any): string {
  if (!o || typeof o !== "object") return "";
  return String(
    o.salesRepName || o.salesRep || o.rep || o.repName || o.createdBy || o.userName || o.assignedTo || o.placedBy || o.salesPerson || ""
  ).trim();
}

function getSalesRepsFromStorage(): any[] {
  const mergedMap = new Map<string, any>();

  // 1. ALWAYS start with base hardcoded reps
  for (const rep of BASE_REPS) {
    mergedMap.set(rep.name, { ...rep });
  }

  // 2. Read from sgf_salesReps (Firebase salesReps path) — with null safety
  try {
    const raw = getStorageItem("sgf_salesReps");
    if (raw) {
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (Array.isArray(parsed)) {
        for (const rep of parsed) {
          if (!rep || typeof rep !== "object") continue;
          const name = String(rep.name || "").trim();
          if (!name) continue;
          mergedMap.set(name, { ...rep, name });
        }
      }
    }
  } catch (e) {
    console.warn("[getSalesRepsFromStorage] Error reading sgf_salesReps:", e);
  }

  // 3. Derive from users array (role === "sales_rep") — these ARE sales reps even if stored in users table
  try {
    const users = dataService.user.list();
    if (Array.isArray(users)) {
      for (const user of users) {
        if (!user || user.role !== "sales_rep") continue;
        const name = String(user.name || "").trim();
        if (!name) continue;
        if (!mergedMap.has(name)) {
          mergedMap.set(name, {
            id: user.id || name,
            name,
            email: user.email || "",
            phone: user.phone || "",
            region: user.region || "",
            vehicleReg: user.vehicleReg || "",
            isActive: user.isActive !== false,
            role: "sales_rep",
            createdAt: user.createdAt || new Date().toISOString(),
          });
        }
      }
    }
  } catch (e) {
    console.warn("[getSalesRepsFromStorage] Error reading users:", e);
  }

  // 4. Derive from regular customers using multiple field names
  try {
    const customers = dataService.customer.list();
    if (Array.isArray(customers)) {
      for (const c of customers) {
        const name = getRepNameFromCustomer(c);
        if (!name) continue;
        if (!mergedMap.has(name)) {
          mergedMap.set(name, {
            id: name,
            name,
            email: "",
            phone: "",
            region: "",
            vehicleReg: "",
            isActive: true,
            role: "sales_rep",
            createdAt: new Date().toISOString(),
          });
        }
      }
    }
  } catch (e) {
    console.warn("[getSalesRepsFromStorage] Error reading customers:", e);
  }

  // 4b. Derive from corporate customers too
  try {
    const corpCustomers = dataService.corporateCustomer.list();
    if (Array.isArray(corpCustomers)) {
      for (const c of corpCustomers) {
        const name = getRepNameFromCustomer(c);
        if (!name) continue;
        if (!mergedMap.has(name)) {
          mergedMap.set(name, {
            id: name,
            name,
            email: "",
            phone: "",
            region: "",
            vehicleReg: "",
            isActive: true,
            role: "sales_rep",
            createdAt: new Date().toISOString(),
          });
        }
      }
    }
  } catch (e) {
    console.warn("[getSalesRepsFromStorage] Error reading corporate customers:", e);
  }

  // 5. Derive from regular orders using multiple field names
  try {
    const orders = dataService.order.list();
    if (Array.isArray(orders)) {
      for (const o of orders) {
        const name = getRepNameFromOrder(o);
        if (!name) continue;
        if (!mergedMap.has(name)) {
          mergedMap.set(name, {
            id: name,
            name,
            email: "",
            phone: "",
            region: "",
            vehicleReg: "",
            isActive: true,
            role: "sales_rep",
            createdAt: new Date().toISOString(),
          });
        }
      }
    }
  } catch (e) {
    console.warn("[getSalesRepsFromStorage] Error reading orders:", e);
  }

  // 5b. Derive from purchase orders (corporate orders) too
  try {
    const purchaseOrders = dataService.purchaseOrder.list();
    if (Array.isArray(purchaseOrders)) {
      for (const o of purchaseOrders) {
        const name = getRepNameFromOrder(o);
        if (!name) continue;
        if (!mergedMap.has(name)) {
          mergedMap.set(name, {
            id: name,
            name,
            email: "",
            phone: "",
            region: "",
            vehicleReg: "",
            isActive: true,
            role: "sales_rep",
            createdAt: new Date().toISOString(),
          });
        }
      }
    }
  } catch (e) {
    console.warn("[getSalesRepsFromStorage] Error reading purchase orders:", e);
  }

  // 6. Derive from invoices using multiple field names
  try {
    const invoices = dataService.invoice.list();
    if (Array.isArray(invoices)) {
      for (const inv of invoices) {
        const name = getRepNameFromOrder(inv);
        if (!name) continue;
        if (!mergedMap.has(name)) {
          mergedMap.set(name, {
            id: name,
            name,
            email: "",
            phone: "",
            region: "",
            vehicleReg: "",
            isActive: true,
            role: "sales_rep",
            createdAt: new Date().toISOString(),
          });
        }
      }
    }
  } catch (e) {
    console.warn("[getSalesRepsFromStorage] Error reading invoices:", e);
  }

  const result = Array.from(mergedMap.values());
  console.log("[getSalesRepsFromStorage] Found", result.length, "sales reps");
  return result;
}

function saveSalesReps(reps: any[]) {
  try {
    setStorageItem("sgf_salesReps", JSON.stringify(reps));
  } catch { /* ignore */ }
}

function getWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((+date - +yearStart) / 86400000) + 1) / 7);
}

function getWeekRange(year: number, week: number): string {
  const d = new Date(year, 0, 1);
  const dayOffset = (d.getDay() || 7) - 1;
  const firstMonday = new Date(year, 0, 1 + (dayOffset > 0 ? 7 - dayOffset : 0));
  const start = new Date(firstMonday);
  start.setDate(start.getDate() + (week - 1) * 7);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;
}

if (!(dataService as any).salesRep) {
  (dataService as any).salesRep = {
    list: () => getSalesRepsFromStorage(),

    search: ({ query }: { query: string }) => {
      const q = (query || "").toLowerCase().trim();
      if (!q) return getSalesRepsFromStorage();
      return getSalesRepsFromStorage().filter((r: any) =>
        (r.name || "").toLowerCase().includes(q)
      );
    },

    getById: (id: string | number) => {
      return getSalesRepsFromStorage().find((r: any) => r.id == id) || null;
    },

    // Dashboard Sales Rep Overview table expects:
    // { repStats: [{ name, customerCount, orderCount, totalSales }] }
    getStats: () => {
      const reps = getSalesRepsFromStorage();
      const customers = dataService.customer.list();
      const corpCustomers = dataService.corporateCustomer.list();
      const allCustomers = [...customers, ...corpCustomers];
      const orders = dataService.order.list();
      const purchaseOrders = dataService.purchaseOrder.list();
      const allOrders = [...orders, ...purchaseOrders];

      const repStats = reps.map((rep: any) => {
        const repName = rep.name;
        const customerCount = allCustomers.filter((c: any) => getRepNameFromCustomer(c) === repName).length;
        const repOrders = allOrders.filter((o: any) => getRepNameFromOrder(o) === repName);
        const orderCount = repOrders.length;
        const totalSales = repOrders.reduce((sum: number, o: any) => sum + (o.total || 0), 0);
        return { name: repName, customerCount, orderCount, totalSales };
      });

      return { repStats };
    },

    // Dashboard Sales by Rep section expects:
    // { today, weekRange, month, repSales: [{ name, todaySales, weekSales, monthSales }], totals: { today, week, month } }
    getSalesBreakdown: () => {
      const now = new Date();
      const todayStr = now.toDateString();
      const currentWeek = getWeekNumber(now);
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth();
      const weekRange = getWeekRange(currentYear, currentWeek);
      const monthName = now.toLocaleDateString("en-US", { month: "long", year: "numeric" });

      const orders = dataService.order.list();
      const purchaseOrders = dataService.purchaseOrder.list();
      const allOrders = [...orders, ...purchaseOrders];
      const reps = getSalesRepsFromStorage();

      let totalToday = 0;
      let totalWeek = 0;
      let totalMonth = 0;

      const repSales = reps.map((rep: any) => {
        const repName = rep.name;
        const repOrders = allOrders.filter((o: any) => getRepNameFromOrder(o) === repName);

        const todaySales = repOrders
          .filter((o: any) => new Date(o.createdAt).toDateString() === todayStr)
          .reduce((sum: number, o: any) => sum + (o.total || 0), 0);

        const weekSales = repOrders
          .filter((o: any) => {
            const d = new Date(o.createdAt);
            return d.getFullYear() === currentYear && getWeekNumber(d) === currentWeek;
          })
          .reduce((sum: number, o: any) => sum + (o.total || 0), 0);

        const monthSales = repOrders
          .filter((o: any) => {
            const d = new Date(o.createdAt);
            return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
          })
          .reduce((sum: number, o: any) => sum + (o.total || 0), 0);

        totalToday += todaySales;
        totalWeek += weekSales;
        totalMonth += monthSales;

        return { name: repName, todaySales, weekSales, monthSales };
      });

      return {
        today: todayStr,
        weekRange,
        month: monthName,
        repSales,
        totals: { today: totalToday, week: totalWeek, month: totalMonth },
      };
    },

    create: (data: any) => {
      const reps = getSalesRepsFromStorage();
      const newRep = { ...data, id: data.name || Date.now(), isActive: true, createdAt: new Date().toISOString() };
      reps.push(newRep);
      saveSalesReps(reps);
      return newRep;
    },

    update: ({ id, data }: { id: string | number; data: any }) => {
      const reps = getSalesRepsFromStorage();
      const idx = reps.findIndex((r: any) => r.id == id);
      if (idx >= 0) {
        const oldName = reps[idx].name;
        reps[idx] = { ...reps[idx], ...data, updatedAt: new Date().toISOString() };
        saveSalesReps(reps);
        return { ...reps[idx], oldName };
      }
      return null;
    },

    toggleActive: (id: string | number) => {
      const reps = getSalesRepsFromStorage();
      const idx = reps.findIndex((r: any) => r.id == id);
      if (idx >= 0) {
        reps[idx].isActive = reps[idx].isActive === false ? true : false;
        saveSalesReps(reps);
        return reps[idx];
      }
      return null;
    },

    delete: (id: string | number) => {
      const reps = getSalesRepsFromStorage();
      const toDelete = reps.find((r: any) => r.id == id);
      if (toDelete) {
        const filtered = reps.filter((r: any) => r.id != id);
        saveSalesReps(filtered);
        return { success: true, deletedName: toDelete.name };
      }
      return { success: false };
    },
  };
}

// ─── 4. DASHBOARD ───
if (!(dataService as any).dashboard) {
  (dataService as any).dashboard = {
    stats: () => {
      const orders = dataService.order.list();
      const purchaseOrders = dataService.purchaseOrder.list();
      const allOrders = [...orders, ...purchaseOrders];
      const invoices = dataService.invoice.list();
      const customers = dataService.customer.list();
      const corpCustomers = dataService.corporateCustomer.list();
      const allCustomers = [...customers, ...corpCustomers];
      const products = dataService.product.list();
      const today = new Date().toDateString();

      const totalRevenue = invoices.reduce((sum: number, i: any) => sum + (i.total || 0), 0);
      const todayRevenue = invoices
        .filter((i: any) => new Date(i.createdAt).toDateString() === today)
        .reduce((sum: number, i: any) => sum + (i.total || 0), 0);
      const outstanding = invoices
        .filter((i: any) => (i.balanceDue || 0) > 0)
        .reduce((sum: number, i: any) => sum + (i.balanceDue || 0), 0);

      return {
        totalOrders: allOrders.length,
        totalInvoices: invoices.length,
        totalCustomers: allCustomers.length,
        totalProducts: products.length,
        totalRevenue,
        todayRevenue,
        outstanding,
        lowStock: products.filter((p: any) => (p.quantity || 0) <= (p.minStock || 10)).length,
      };
    },
  };
}

// ─── 5. COLLECTIONS ───
if (!(dataService as any).collections) {
  (dataService as any).collections = {
    getOverdueInvoices: () => {
      const now = new Date().toISOString();
      return dataService.invoice.list().filter((i: any) =>
        (i.balanceDue || 0) > 0 && i.dueDate && i.dueDate < now
      );
    },
    getDailyReport: () => {
      const today = new Date().toDateString();
      const payments = dataService.invoice.list().filter((i: any) =>
        i.payments?.some((p: any) => new Date(p.date).toDateString() === today)
      );
      return { date: today, payments };
    },
    getStats: () => {
      const invoices = dataService.invoice.list();
      const totalOutstanding = invoices
        .filter((i: any) => (i.balanceDue || 0) > 0)
        .reduce((sum: number, i: any) => sum + (i.balanceDue || 0), 0);
      return { totalOutstanding, overdueCount: invoices.filter((i: any) => i.dueDate < new Date().toISOString()).length };
    },
    getCustomerPaymentHistory: (customerId: number) => {
      return dataService.invoice.list().filter((i: any) => i.customerId == customerId);
    },
    addNote: (data: any) => {
      const notes = JSON.parse(localStorage.getItem("sgf_collectionNotes") || "[]");
      const newNote = { ...data, id: Date.now(), createdAt: new Date().toISOString() };
      notes.push(newNote);
      localStorage.setItem("sgf_collectionNotes", JSON.stringify(notes));
      return newNote;
    },
    recordPromise: (data: any) => {
      const promises = JSON.parse(localStorage.getItem("sgf_collectionPromises") || "[]");
      const newPromise = { ...data, id: Date.now(), createdAt: new Date().toISOString() };
      promises.push(newPromise);
      localStorage.setItem("sgf_collectionPromises", JSON.stringify(promises));
      return newPromise;
    },
    placeHold: (data: any) => {
      const holds = JSON.parse(localStorage.getItem("sgf_accountHolds") || "[]");
      const newHold = { ...data, id: Date.now(), createdAt: new Date().toISOString() };
      holds.push(newHold);
      localStorage.setItem("sgf_accountHolds", JSON.stringify(holds));
      return newHold;
    },
    releaseHold: (id: number) => {
      const holds = JSON.parse(localStorage.getItem("sgf_accountHolds") || "[]");
      const filtered = holds.filter((h: any) => h.id != id);
      localStorage.setItem("sgf_accountHolds", JSON.stringify(filtered));
      return { success: true };
    },
  };
}

// ─── 6. SAMPLE REPORT ───
// CRITICAL FIX: SampleReportsPage.tsx expects structured data, not raw orders.
function buildSampleItem(order: any, item: any): any {
  const product = dataService.product.getById(item.stockItemId);
  const unitCost = item.unitPrice || item.price || 0;
  const quantity = item.quantity || 0;
  const subtotal = unitCost * quantity;
  const vatAmount = subtotal * 0.15;
  const totalCost = subtotal + vatAmount;
  return {
    productCode: product?.productCode || item.productCode || item.code || "N/A",
    productName: product?.name || item.productName || item.name || "Unknown",
    unitCost,
    quantity,
    subtotal,
    vatAmount,
    totalCost,
    date: order.createdAt || new Date().toISOString(),
    customerName: order.customer?.name || order.customerName || "Walk-in",
    sampleNumber: order.sampleNumber || order.orderNumber || `SMP-${order.id || Date.now()}`,
    repName: getRepNameFromOrder(order),
    status: order.status || "pending",
  };
}

function isSampleOrder(o: any): boolean {
  if (!o || typeof o !== "object") return false;
  if (o.orderType === "sample" || o.type === "sample" || o.isSample === true) return true;
  const orderNum = String(o.orderNumber || o.sampleNumber || "").toUpperCase();
  if (orderNum.startsWith("SMP-") || orderNum.startsWith("SAMPLE-")) return true;
  // Check notes/description for "Sample" keyword (used by invoices and some orders)
  const notes = String(o.notes || o.description || o.memo || "").toLowerCase();
  if (notes.includes("sample")) return true;
  return false;
}

if (!dataService.order.getSampleReport) {
  dataService.order.getSampleReport = () => {
    const orders = (dataService.order as any).list();
    const sampleOrders = orders.filter((o: any) => isSampleOrder(o));
    const items: any[] = [];
    for (const order of sampleOrders) {
      const lineItems = order.items || order.lineItems || order.products || [];
      for (const item of lineItems) {
        items.push(buildSampleItem(order, item));
      }
    }
    const totalCost = items.reduce((sum: number, i: any) => sum + (i.totalCost || 0), 0);
    const totalVAT = items.reduce((sum: number, i: any) => sum + (i.vatAmount || 0), 0);
    return { items, totalCost, totalVAT };
  };
}

// ─── 6b. SAMPLE REPORT MODULE (used by SampleReportsPage.tsx) ───
// SampleReportsPage.tsx calls trpc.sampleReport.getAll and trpc.sampleReport.getByCustomer
if (!dataService.sampleReport) {
  dataService.sampleReport = {
    getAll: () => {
      const allOrders = dataService.order.list();
      const allInvoices = dataService.invoice.list();
      const sampleOrders = allOrders.filter(isSampleOrder);

      const customerMap = new Map<number, any>();

      for (const order of sampleOrders) {
        const customerId = order.customerId || 0;
        const customer = dataService.customer.getById(customerId);
        const customerName = customer?.name || order.customerName || order.customer?.name || "Walk-in";
        const customerCode = customer?.customerCode || order.customerCode || "";
        const salesRepName = getRepNameFromOrder(order);

        const linkedInvoice = allInvoices.find((inv: any) => inv.orderId == order.id);
        const invoiceNumber = linkedInvoice?.invoiceNumber || linkedInvoice?.invoiceNo || "";

        const lineItems = order.items || order.lineItems || order.products || [];

        if (!customerMap.has(customerId)) {
          customerMap.set(customerId, {
            customerId,
            customerName,
            customerCode,
            salesRepName,
            sampleCount: 0,
            items: [],
            totalSubtotal: 0,
            totalVat: 0,
            totalCost: 0,
          });
        }

        const custEntry = customerMap.get(customerId);
        custEntry.sampleCount += 1;

        for (const item of lineItems) {
          const product = dataService.product.getById(item.stockItemId);
          const unitCost = item.unitPrice || item.price || 0;
          const quantity = item.quantity || 0;
          const subtotal = unitCost * quantity;
          const vatAmount = subtotal * 0.15;
          const totalCost = subtotal + vatAmount;

          custEntry.items.push({
            productCode: product?.productCode || item.productCode || item.code || "N/A",
            productName: product?.name || item.productName || item.name || "Unknown",
            dateTaken: order.createdAt || new Date().toISOString(),
            orderNumber: order.orderNumber || order.sampleNumber || `SMP-${order.id || Date.now()}`,
            invoiceNumber,
            quantity,
            unitCost,
            subtotal,
            vatAmount,
            totalCost,
          });

          custEntry.totalSubtotal += subtotal;
          custEntry.totalVat += vatAmount;
          custEntry.totalCost += totalCost;
        }
      }

      const customers = Array.from(customerMap.values()).sort((a: any, b: any) =>
        (a.customerName || "").localeCompare(b.customerName || "")
      );

      const grandSubtotal = customers.reduce((sum: number, c: any) => sum + c.totalSubtotal, 0);
      const grandVat = customers.reduce((sum: number, c: any) => sum + c.totalVat, 0);
      const grandTotal = customers.reduce((sum: number, c: any) => sum + c.totalCost, 0);

      return { customers, grandSubtotal, grandVat, grandTotal };
    },

    getByCustomer: ({ customerId }: { customerId: number }) => {
      const allOrders = dataService.order.list();
      const allInvoices = dataService.invoice.list();
      const sampleOrders = allOrders.filter((o: any) => isSampleOrder(o) && o.customerId == customerId);

      const items: any[] = [];

      for (const order of sampleOrders) {
        const linkedInvoice = allInvoices.find((inv: any) => inv.orderId == order.id);
        const invoiceNumber = linkedInvoice?.invoiceNumber || linkedInvoice?.invoiceNo || "";
        const lineItems = order.items || order.lineItems || order.products || [];

        for (const item of lineItems) {
          const product = dataService.product.getById(item.stockItemId);
          const unitCost = item.unitPrice || item.price || 0;
          const quantity = item.quantity || 0;
          const subtotal = unitCost * quantity;
          const vatAmount = subtotal * 0.15;
          const totalCost = subtotal + vatAmount;

          items.push({
            productCode: product?.productCode || item.productCode || item.code || "N/A",
            productName: product?.name || item.productName || item.name || "Unknown",
            dateTaken: order.createdAt || new Date().toISOString(),
            orderNumber: order.orderNumber || order.sampleNumber || `SMP-${order.id || Date.now()}`,
            invoiceNumber,
            quantity,
            unitCost,
            subtotal,
            vatAmount,
            totalCost,
          });
        }
      }

      const grandSubtotal = items.reduce((sum: number, i: any) => sum + i.subtotal, 0);
      const grandVat = items.reduce((sum: number, i: any) => sum + i.vatAmount, 0);
      const grandTotal = items.reduce((sum: number, i: any) => sum + i.totalCost, 0);

      return { items, grandSubtotal, grandVat, grandTotal };
    },
  };
}

// ─── 7. INVENTORY ───
if (!dataService.product.getLowStock) {
  dataService.product.getLowStock = () => {
    return dataService.product.list().filter((p: any) => (p.quantity || 0) <= (p.minStock || 10));
  };
}

if (!dataService.product.updateQuantity) {
  dataService.product.updateQuantity = (input: any) => {
    const { id, quantity } = input;
    const products = dataService.product.list();
    const idx = products.findIndex((p: any) => p.id == id);
    if (idx >= 0) {
      products[idx].quantity = quantity;
      products[idx].updatedAt = new Date().toISOString();
      localStorage.setItem("sgf_products", JSON.stringify(products));
      return products[idx];
    }
    return null;
  };
}

if (!dataService.product.searchProducts) {
  dataService.product.searchProducts = (query: string) => {
    const q = (query || "").toLowerCase().trim();
    if (!q) return dataService.product.list();
    return dataService.product.list().filter((p: any) =>
      (p.name || "").toLowerCase().includes(q) ||
      (p.productCode || "").toLowerCase().includes(q) ||
      (p.sku || "").toLowerCase().includes(q)
    );
  };
}

if (!dataService.product.getProductCodes) {
  dataService.product.getProductCodes = () => {
    return dataService.product.list().map((p: any) => p.productCode || "").filter(Boolean);
  };
}

if (!dataService.product.getBarrelStock) {
  dataService.product.getBarrelStock = () => {
    return dataService.product.list().filter((p: any) => (p.name || "").toLowerCase().includes("barrel"));
  };
}

// ─── 8. ORDER missing methods ───
if (!dataService.order.create) {
  dataService.order.create = (data: any) => {
    const orders = (dataService.order as any).list();
    const newOrder = {
      ...data,
      id: data.id || Date.now(),
      createdAt: data.createdAt || new Date().toISOString(),
      status: data.status || "pending",
      salesRepName: data.salesRepName || dataService.auth?.me?.()?.name || "",
    };
    orders.push(newOrder);
    localStorage.setItem("sgf_orders", JSON.stringify(orders));
    return newOrder;
  };
}

if (!dataService.order.getSalesReport) {
  dataService.order.getSalesReport = () => {
    const orders = (dataService.order as any).list();
    return {
      totalOrders: orders.length,
      totalValue: orders.reduce((sum: number, o: any) => sum + (o.total || 0), 0),
    };
  };
}

if (!dataService.order.getRouteVisits) {
  dataService.order.getRouteVisits = () => {
    return dataService.appointment.list().filter((a: any) => a.type === "route_visit");
  };
}

if (!dataService.order.getOpenOrders) {
  dataService.order.getOpenOrders = () => {
    return (dataService.order as any).list().filter((o: any) =>
      o.status !== "delivered" && o.status !== "cancelled"
    );
  };
}

// ─── ORDER GET STATS — ALWAYS OVERRIDE because base version is incomplete ───
dataService.order.getStats = () => {
  const orders = (dataService.order as any).list();
  const purchaseOrders = dataService.purchaseOrder.list();
  const allOrders = [...orders, ...purchaseOrders];
  return {
    total: allOrders.length,
    totalValue: allOrders.reduce((sum: number, o: any) => sum + (o.total || 0), 0),
    pending: allOrders.filter((o: any) => o.status === "pending").length,
    picking: allOrders.filter((o: any) => o.status === "picking").length,
    ready: allOrders.filter((o: any) => o.status === "ready").length,
    delivered: allOrders.filter((o: any) => o.status === "delivered").length,
    cancelled: allOrders.filter((o: any) => o.status === "cancelled").length,
    quotes: allOrders.filter((o: any) => o.orderType === "quote").length,
    samples: allOrders.filter((o: any) => isSampleOrder(o)).length,
  };
};

// ─── 9. INVOICE missing methods ───
if (!dataService.invoice.updateInvoice) {
  dataService.invoice.updateInvoice = dataService.invoice.update;
}

if (!dataService.invoice.updateStatus) {
  dataService.invoice.updateStatus = (input: any) => {
    const { id, status } = input;
    const invoices = (dataService.invoice as any).list();
    const idx = invoices.findIndex((i: any) => i.id == id);
    if (idx >= 0) {
      invoices[idx].status = status;
      invoices[idx].updatedAt = new Date().toISOString();
      localStorage.setItem("sgf_invoices", JSON.stringify(invoices));
      return invoices[idx];
    }
    return null;
  };
}

if (!dataService.invoice.recordPayment) {
  dataService.invoice.recordPayment = (input: any) => {
    const { invoiceId, amount, date, method, reference } = input;
    const invoices = (dataService.invoice as any).list();
    const idx = invoices.findIndex((i: any) => i.id == invoiceId);
    if (idx >= 0) {
      const inv = invoices[idx];
      inv.amountPaid = (inv.amountPaid || 0) + amount;
      inv.balanceDue = Math.max(0, (inv.total || 0) - inv.amountPaid);
      inv.status = inv.balanceDue <= 0 ? "paid" : (inv.amountPaid > 0 ? "partial" : inv.status);
      if (!inv.payments) inv.payments = [];
      inv.payments.push({ amount, date, method, reference, createdAt: new Date().toISOString() });
      inv.updatedAt = new Date().toISOString();
      localStorage.setItem("sgf_invoices", JSON.stringify(invoices));
      return inv;
    }
    return null;
  };
}

if (!dataService.invoice.editPayment) {
  dataService.invoice.editPayment = (input: any) => {
    const { invoiceId, paymentIndex, amount, date, method, reference } = input;
    const invoices = (dataService.invoice as any).list();
    const idx = invoices.findIndex((i: any) => i.id == invoiceId);
    if (idx >= 0 && invoices[idx].payments?.[paymentIndex]) {
      const inv = invoices[idx];
      const oldAmount = inv.payments[paymentIndex].amount;
      inv.payments[paymentIndex] = { ...inv.payments[paymentIndex], amount, date, method, reference };
      inv.amountPaid = (inv.amountPaid || 0) - oldAmount + amount;
      inv.balanceDue = Math.max(0, (inv.total || 0) - inv.amountPaid);
      inv.status = inv.balanceDue <= 0 ? "paid" : (inv.amountPaid > 0 ? "partial" : "unpaid");
      inv.updatedAt = new Date().toISOString();
      localStorage.setItem("sgf_invoices", JSON.stringify(invoices));
      return inv;
    }
    return null;
  };
}

if (!dataService.invoice.deletePayment) {
  dataService.invoice.deletePayment = (input: any) => {
    const { invoiceId, paymentIndex } = input;
    const invoices = (dataService.invoice as any).list();
    const idx = invoices.findIndex((i: any) => i.id == invoiceId);
    if (idx >= 0 && invoices[idx].payments?.[paymentIndex]) {
      const inv = invoices[idx];
      const oldAmount = inv.payments[paymentIndex].amount;
      inv.payments.splice(paymentIndex, 1);
      inv.amountPaid = Math.max(0, (inv.amountPaid || 0) - oldAmount);
      inv.balanceDue = Math.max(0, (inv.total || 0) - inv.amountPaid);
      inv.status = inv.balanceDue <= 0 ? "paid" : (inv.amountPaid > 0 ? "partial" : "unpaid");
      inv.updatedAt = new Date().toISOString();
      localStorage.setItem("sgf_invoices", JSON.stringify(invoices));
      return inv;
    }
    return null;
  };
}

if (!dataService.invoice.getCustomerStatement) {
  dataService.invoice.getCustomerStatement = (customerId: number) => {
    return (dataService.invoice as any).list().filter((i: any) => i.customerId == customerId);
  };
}

if (!dataService.invoice.getReceipts) {
  dataService.invoice.getReceipts = () => {
    return JSON.parse(localStorage.getItem("sgf_receipts") || "[]");
  };
}

if (!dataService.invoice.getReceiptsByInvoice) {
  dataService.invoice.getReceiptsByInvoice = (invoiceId: number) => {
    const receipts = JSON.parse(localStorage.getItem("sgf_receipts") || "[]");
    return receipts.filter((r: any) => r.invoiceId == invoiceId);
  };
}

if (!dataService.invoice.getReceiptsByCustomer) {
  dataService.invoice.getReceiptsByCustomer = (customerId: number) => {
    const receipts = JSON.parse(localStorage.getItem("sgf_receipts") || "[]");
    return receipts.filter((r: any) => r.customerId == customerId);
  };
}

if (!dataService.invoice.getReceiptById) {
  dataService.invoice.getReceiptById = (id: number) => {
    const receipts = JSON.parse(localStorage.getItem("sgf_receipts") || "[]");
    return receipts.find((r: any) => r.id == id) || null;
  };
}

if (!dataService.invoice.bulkHistoricalImport) {
  dataService.invoice.bulkHistoricalImport = (data: any[]) => {
    const invoices = (dataService.invoice as any).list();
    let count = 0;
    for (const item of data) {
      invoices.push({ ...item, id: Date.now() + count, createdAt: new Date().toISOString() });
      count++;
    }
    localStorage.setItem("sgf_invoices", JSON.stringify(invoices));
    return { count };
  };
}

if (!dataService.invoice.relinkSageInvoices) {
  dataService.invoice.relinkSageInvoices = () => {
    const invoices = (dataService.invoice as any).list();
    const customers = dataService.customer.list();
    let count = 0;
    for (const inv of invoices) {
      if (inv.source === "sage" && !inv.customerId && inv.customerCode) {
        const matched = customers.find((c: any) => c.customerCode === inv.customerCode);
        if (matched) {
          inv.customerId = matched.id;
          inv.customer = { name: matched.name };
          count++;
        }
      }
    }
    if (count > 0) localStorage.setItem("sgf_invoices", JSON.stringify(invoices));
    return { count };
  };
}

if (!dataService.invoice.getCreditNotes) {
  dataService.invoice.getCreditNotes = () => {
    return JSON.parse(localStorage.getItem("sgf_creditNotes") || "[]");
  };
}

if (!dataService.invoice.getCreditNotesByInvoice) {
  dataService.invoice.getCreditNotesByInvoice = (invoiceId: number) => {
    const notes = JSON.parse(localStorage.getItem("sgf_creditNotes") || "[]");
    return notes.filter((n: any) => n.invoiceId == invoiceId);
  };
}

if (!dataService.invoice.getCreditNotesByCustomer) {
  dataService.invoice.getCreditNotesByCustomer = (customerId: number) => {
    const notes = JSON.parse(localStorage.getItem("sgf_creditNotes") || "[]");
    return notes.filter((n: any) => n.customerId == customerId);
  };
}

if (!dataService.invoice.getCustomerCreditBalance) {
  dataService.invoice.getCustomerCreditBalance = (customerId: number) => {
    const notes = JSON.parse(localStorage.getItem("sgf_creditNotes") || "[]");
    return notes
      .filter((n: any) => n.customerId == customerId && n.status !== "voided")
      .reduce((sum: number, n: any) => sum + (n.amount || 0), 0);
  };
}

if (!dataService.invoice.createCreditNote) {
  dataService.invoice.createCreditNote = (data: any) => {
    const notes = JSON.parse(localStorage.getItem("sgf_creditNotes") || "[]");
    const newNote = { ...data, id: Date.now(), createdAt: new Date().toISOString() };
    notes.push(newNote);
    localStorage.setItem("sgf_creditNotes", JSON.stringify(notes));
    return newNote;
  };
}

if (!dataService.invoice.allocateCredit) {
  dataService.invoice.allocateCredit = (data: any) => {
    const { creditNoteId, invoiceId, amount } = data;
    const notes = JSON.parse(localStorage.getItem("sgf_creditNotes") || "[]");
    const idx = notes.findIndex((n: any) => n.id == creditNoteId);
    if (idx >= 0) {
      notes[idx].allocatedAmount = (notes[idx].allocatedAmount || 0) + amount;
      notes[idx].allocatedToInvoiceId = invoiceId;
      notes[idx].updatedAt = new Date().toISOString();
      localStorage.setItem("sgf_creditNotes", JSON.stringify(notes));
      return notes[idx];
    }
    return null;
  };
}

if (!dataService.invoice.voidCreditNoteAllocation) {
  dataService.invoice.voidCreditNoteAllocation = (creditNoteId: number) => {
    const notes = JSON.parse(localStorage.getItem("sgf_creditNotes") || "[]");
    const idx = notes.findIndex((n: any) => n.id == creditNoteId);
    if (idx >= 0) {
      notes[idx].allocatedAmount = 0;
      notes[idx].allocatedToInvoiceId = null;
      notes[idx].updatedAt = new Date().toISOString();
      localStorage.setItem("sgf_creditNotes", JSON.stringify(notes));
      return notes[idx];
    }
    return null;
  };
}

if (!dataService.invoice.voidCreditNote) {
  dataService.invoice.voidCreditNote = (id: number) => {
    const notes = JSON.parse(localStorage.getItem("sgf_creditNotes") || "[]");
    const idx = notes.findIndex((n: any) => n.id == id);
    if (idx >= 0) {
      notes[idx].status = "voided";
      notes[idx].updatedAt = new Date().toISOString();
      localStorage.setItem("sgf_creditNotes", JSON.stringify(notes));
      return notes[idx];
    }
    return null;
  };
}

// ─── 10. USER missing methods ───
if (!dataService.user.toggleActive) {
  dataService.user.toggleActive = (id: number) => {
    const users = dataService.user.list();
    const idx = users.findIndex((u: any) => u.id == id);
    if (idx >= 0) {
      users[idx].isActive = users[idx].isActive === false ? true : false;
      localStorage.setItem("sgf_users", JSON.stringify(users));
      return users[idx];
    }
    return null;
  };
}

if (!dataService.user.resetPin) {
  dataService.user.resetPin = (input: any) => {
    const { id, newPin } = input;
    const users = dataService.user.list();
    const idx = users.findIndex((u: any) => u.id == id);
    if (idx >= 0) {
      users[idx].pin = newPin;
      users[idx].updatedAt = new Date().toISOString();
      localStorage.setItem("sgf_users", JSON.stringify(users));
      return users[idx];
    }
    return null;
  };
}

// ─── 11. CHECK-IN missing methods ───
if (!dataService.checkIn.getDailyReport) {
  dataService.checkIn.getDailyReport = () => {
    const today = new Date().toDateString();
    return dataService.checkIn.list().filter((c: any) =>
      new Date(c.createdAt).toDateString() === today
    );
  };
}

if (!dataService.checkIn.getWeeklyReport) {
  dataService.checkIn.getWeeklyReport = (year?: number, week?: number) => {
    const now = new Date();
    const targetYear = year || now.getFullYear();
    const targetWeek = week || getWeekNumber(now);
    return dataService.checkIn.list().filter((c: any) => {
      const d = new Date(c.createdAt);
      return d.getFullYear() === targetYear && getWeekNumber(d) === targetWeek;
    });
  };
}

if (!dataService.checkIn.getMonthlyReport) {
  dataService.checkIn.getMonthlyReport = (year?: number, month?: number) => {
    const now = new Date();
    const targetYear = year || now.getFullYear();
    const targetMonth = month != null ? month : now.getMonth();
    return dataService.checkIn.list().filter((c: any) => {
      const d = new Date(c.createdAt);
      return d.getFullYear() === targetYear && d.getMonth() === targetMonth;
    });
  };
}

// ─── 12. FOLLOW-UP ACTION missing methods ───
if (!dataService.followUpAction.listByCustomer) {
  dataService.followUpAction.listByCustomer = (customerId: number) => {
    return dataService.followUpAction.list().filter((f: any) => f.customerId == customerId);
  };
}

if (!dataService.followUpAction.getStats) {
  dataService.followUpAction.getStats = () => {
    const actions = dataService.followUpAction.list();
    return { total: actions.length };
  };
}

// ─── 13. SPECIAL PRICE missing methods ───
if (!dataService.specialPrice.listByCustomer) {
  dataService.specialPrice.listByCustomer = (customerId: number) => {
    return dataService.specialPrice.list().filter((s: any) => s.customerId == customerId);
  };
}

if (!dataService.specialPrice.set) {
  dataService.specialPrice.set = (data: any) => {
    const prices = dataService.specialPrice.list();
    const idx = prices.findIndex((p: any) => p.customerId == data.customerId && p.stockItemId == data.stockItemId);
    if (idx >= 0) {
      prices[idx] = { ...prices[idx], ...data, updatedAt: new Date().toISOString() };
    } else {
      prices.push({ ...data, id: Date.now(), createdAt: new Date().toISOString() });
    }
    localStorage.setItem("sgf_specialPrices", JSON.stringify(prices));
    return prices.find((p: any) => p.customerId == data.customerId && p.stockItemId == data.stockItemId);
  };
}

if (!dataService.specialPrice.delete) {
  dataService.specialPrice.delete = (input: any) => {
    const { customerId, stockItemId } = input;
    const prices = dataService.specialPrice.list();
    const filtered = prices.filter((p: any) => !(p.customerId == customerId && p.stockItemId == stockItemId));
    localStorage.setItem("sgf_specialPrices", JSON.stringify(filtered));
    return { success: true };
  };
}

// ─── 14. CORPORATE CUSTOMER missing methods ───
if (!dataService.corporateCustomer.listByCompany) {
  dataService.corporateCustomer.listByCompany = (companyName: string) => {
    return dataService.corporateCustomer.list().filter((c: any) =>
      (c.company || "").toLowerCase() === (companyName || "").toLowerCase()
    );
  };
}

// ─── 15. PURCHASE ORDER missing methods ───
if (!dataService.purchaseOrder.updateStatus) {
  dataService.purchaseOrder.updateStatus = (input: any) => {
    const { id, status } = input;
    const pos = dataService.purchaseOrder.list();
    const idx = pos.findIndex((p: any) => p.id == id);
    if (idx >= 0) {
      pos[idx].status = status;
      pos[idx].updatedAt = new Date().toISOString();
      localStorage.setItem("sgf_purchaseOrders", JSON.stringify(pos));
      return pos[idx];
    }
    return null;
  };
}

// ─── 16. BARREL missing methods ───
if (!dataService.barrel.listByPurchaseOrder) {
  dataService.barrel.listByPurchaseOrder = (poId: number) => {
    return dataService.barrel.list().filter((b: any) => b.purchaseOrderId == poId);
  };
}

// ─── 17. FOLLOW-UP missing methods ───
if (!dataService.followUp.getStats) {
  dataService.followUp.getStats = () => {
    const followUps = dataService.followUp.list();
    return { total: followUps.length };
  };
}

console.log("[dataServiceExtras] All missing properties added successfully.");

// ─── EXPORT: Prevents tree-shaking in production builds ───
// Vite/Rollup will tree-shake files with no exports. This dummy export
// ensures dataServiceExtras.ts is ALWAYS included in the bundle.
export const DATA_SERVICE_EXTRAS_LOADED = true;
