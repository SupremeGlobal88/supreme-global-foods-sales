import { STATIC_CUSTOMERS, STATIC_PRODUCTS } from "@/data/staticData";

const SALES_REPS = ["Adeli", "Inhouse", "Michael", "Nkosana", "Shanelle", "Tebogo Bila"];

// In-memory storage
let customers = [...STATIC_CUSTOMERS.map((c: any) => ({
  ...c,
  salesRepName: c.salesRepName || "",
}))] as any[];
let products = [...STATIC_PRODUCTS.map((p: any) => ({ ...p }))] as any[];
let orders = [] as any[];
let invoices = [] as any[];
let appointments = [] as any[];
let checkins = [] as any[];
let specialPrices = [] as any[];
let auditLog = [] as any[];
let followUps = [] as any[];

function load() {
  try {
    const c = localStorage.getItem("sgf_customers");
    if (c) customers = JSON.parse(c);
    const p = localStorage.getItem("sgf_products");
    if (p) products = JSON.parse(p);
    const o = localStorage.getItem("sgf_orders");
    if (o) orders = JSON.parse(o);
    const i = localStorage.getItem("sgf_invoices");
    if (i) invoices = JSON.parse(i);
    const a = localStorage.getItem("sgf_appointments");
    if (a) appointments = JSON.parse(a);
    const s = localStorage.getItem("sgf_specialPrices");
    if (s) specialPrices = JSON.parse(s);
    const log = localStorage.getItem("sgf_auditLog");
    if (log) auditLog = JSON.parse(log);
    else auditLog = [];
    const fu = localStorage.getItem("sgf_followUps");
    if (fu) followUps = JSON.parse(fu);
    else followUps = [];
  } catch { /* ignore */ }
}

function saveItem(key: string, value: any) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
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
  const product = products.find((p) => p.id === productId);
  return product ? Math.max(0, product.quantity || 0) : 0;
}

// getCommittedStock: kept for reference, counts items from active non-sample orders
function getCommittedStock(productId: number): number {
  return orders
    .filter((o) => o.status !== "delivered" && o.status !== "cancelled" && o.status !== "sample_delivered")
    .flatMap((o) => o.items || [])
    .filter((item: any) => item.stockItemId === productId)
    .reduce((sum: number, item: any) => sum + (item.quantity || 0), 0);
}

// Check if customer already has a sample of this product
function hasExistingSample(customerId: number, stockItemId: number): boolean {
  return orders.some((o) =>
    o.customerId === customerId &&
    o.orderType === "sample" &&
    o.items?.some((item: any) => item.stockItemId === stockItemId)
  );
}

function generateNextCustomerCode(): string {
  const codes = customers
    .map((c) => c.customerCode)
    .filter((code) => code && /^CUST\d+$/.test(code))
    .map((code) => parseInt(code.replace("CUST", "")));
  const max = codes.length > 0 ? Math.max(...codes) : 0;
  return `CUST${String(max + 1).padStart(4, "0")}`;
}

load();

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
    getById: (id: number) => products.find((p) => p.id === id) || null,
    getCategories: () => [...new Set(products.map((p) => p.category))],
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
      const idx = products.findIndex((p) => p.id === id);
      if (idx >= 0) { products[idx] = { ...products[idx], ...data, updatedAt: new Date().toISOString() }; saveItem("sgf_products", products); return products[idx]; }
      return null;
    },
    delete: (id: number) => {
      products = products.filter((p) => p.id !== id);
      saveItem("sgf_products", products);
      return { success: true };
    },
  },

  customer: {
    list: () => customers,
    search: ({ query }: { query: string }) => searchItems(customers, query),
    getById: (id: number) => customers.find((c) => c.id === id) || null,
    create: (data: any) => {
      const newItem = {
        ...data,
        id: Date.now(),
        customerCode: data.customerCode || generateNextCustomerCode(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      customers.push(newItem);
      saveItem("sgf_customers", customers);
      logAudit("CREATE", "customer", newItem.id, `Created customer: ${newItem.name} (${newItem.customerCode})`, data.salesRepName);
      return newItem;
    },
    update: ({ id, data }: { id: number; data: any }) => {
      const idx = customers.findIndex((c) => c.id === id);
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
      const cust = customers.find((c) => c.id === id);
      if (cust) {
        logAudit("DELETE", "customer", id, `Deleted customer: ${cust.name} (${cust.customerCode}) \u2014 Sales Rep: ${cust.salesRepName || "Unassigned"}`);
      }
      customers = customers.filter((c) => c.id !== id);
      saveItem("sgf_customers", customers);
      return { success: true };
    },
    getStats: () => ({
      total: customers.length,
      active: customers.filter((c) => c.isActive === "active").length,
      inactive: customers.filter((c) => c.isActive !== "active").length,
      thisMonth: customers.length,
    }),
    getSalesReps: () => SALES_REPS,
  },

  order: {
    list: () => orders,
    getById: (id: number) => orders.find((o) => o.id === id) || null,
    create: (data: any) => {
      const isSample = data.orderType === "sample";
      const orderNumber = `${isSample ? "SMP" : "ORD"}-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${String(orders.filter((o) => (isSample ? o.orderType === "sample" : o.orderType !== "sample")).length + 1).padStart(4, "0")}`;
      
      const items = (data.items || []).map((item: any) => {
        const product = products.find((p) => p.id === item.stockItemId);
        const unitPrice = isSample ? 0 : (item.unitPrice || getEffectivePrice(item.stockItemId, data.priceTier, data.customerId));
        return {
          ...item,
          productCode: product?.productCode || "",
          productName: product?.productName || "Unknown",
          lineTotal: unitPrice * item.quantity,
          unitPrice,
        };
      });
      
      const subtotal = isSample ? 0 : items.reduce((sum: number, item: any) => sum + item.lineTotal, 0);
      const vatAmount = isSample ? 0 : subtotal * 0.15;
      const total = isSample ? 0 : subtotal + vatAmount;
      
      const newOrder = {
        ...data,
        id: Date.now(),
        orderNumber,
        status: isSample ? "sample_delivered" : "pending",
        items,
        subtotal,
        vatAmount,
        total,
        totalAmount: total,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      orders.push(newOrder);

      // DEDUCT STOCK for each item (both regular and sample orders)
      for (const item of items) {
        const prodIdx = products.findIndex((p) => p.id === item.stockItemId);
        if (prodIdx >= 0) {
          const newQty = Math.max(0, (products[prodIdx].quantity || 0) - item.quantity);
          products[prodIdx].quantity = newQty;
          products[prodIdx].status = newQty === 0 ? "out_of_stock" : newQty < 20 ? "low_stock" : "in_stock";
        }
      }
      saveItem("sgf_products", products);
      saveItem("sgf_orders", orders);

      // Create follow-up for sample orders
      if (isSample) {
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

        // Create a zero-value invoice for the sample
        const invoiceNumber = `INV-SMP-${String(invoices.length + 1).padStart(4, "0")}`;
        invoices.push({
          id: Date.now() + 1,
          orderId: newOrder.id,
          invoiceNumber,
          customerId: data.customerId,
          totalAmount: 0,
          subtotal: 0,
          vatAmount: 0,
          amountPaid: 0,
          status: "paid",
          notes: `Sample order - ${orderNumber}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        saveItem("sgf_invoices", invoices);
      }

      return newOrder;
    },
    updateStatus: ({ id, status }: { id: number; status: string }) => {
      const idx = orders.findIndex((o) => o.id === id);
      if (idx >= 0) {
        const oldStatus = orders[idx].status;
        orders[idx].status = status;

        // RESTORE STOCK when order is delivered or cancelled
        if ((status === "delivered" || status === "cancelled") && oldStatus !== "delivered" && oldStatus !== "cancelled") {
          for (const item of (orders[idx].items || [])) {
            const prodIdx = products.findIndex((p) => p.id === item.stockItemId);
            if (prodIdx >= 0) {
              const newQty = (products[prodIdx].quantity || 0) + item.quantity;
              products[prodIdx].quantity = newQty;
              products[prodIdx].status = newQty === 0 ? "out_of_stock" : newQty < 20 ? "low_stock" : "in_stock";
            }
          }
          saveItem("sgf_products", products);
        }

        saveItem("sgf_orders", orders);
        return orders[idx];
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
      totalValue: orders.filter((o) => o.orderType !== "sample").reduce((sum, o) => sum + Number(o.total || 0), 0),
    }),
    checkExistingSample: ({ customerId, stockItemId }: { customerId: number; stockItemId: number }) => {
      return { exists: hasExistingSample(customerId, stockItemId) };
    },
  },

  invoice: {
    list: () => invoices,
    getById: (id: number) => invoices.find((i) => i.id === id) || null,
    create: (data: any) => {
      const invoiceNumber = `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${String(invoices.length + 1).padStart(4, "0")}`;
      const newInvoice = { ...data, id: Date.now(), invoiceNumber, status: "unpaid", createdAt: new Date().toISOString() };
      invoices.push(newInvoice);
      saveItem("sgf_invoices", invoices);
      return newInvoice;
    },
    updateStatus: ({ id, status, amountPaid }: { id: number; status: string; amountPaid?: number }) => {
      const idx = invoices.findIndex((i) => i.id === id);
      if (idx >= 0) { invoices[idx].status = status; invoices[idx].amountPaid = amountPaid || 0; saveItem("sgf_invoices", invoices); return invoices[idx]; }
      return null;
    },
    getStats: () => ({
      total: invoices.length,
      paid: invoices.filter((i) => i.status === "paid").length,
      overdue: invoices.filter((i) => i.status === "overdue").length,
      totalValue: invoices.reduce((sum, i) => sum + Number(i.totalAmount || 0), 0),
    }),
  },

  appointment: {
    list: () => appointments,
    create: (data: any) => {
      const newItem = { ...data, id: Date.now(), status: "scheduled", createdAt: new Date().toISOString() };
      appointments.push(newItem);
      saveItem("sgf_appointments", appointments);
      return newItem;
    },
    updateStatus: ({ id, status }: { id: number; status: string }) => {
      const idx = appointments.findIndex((a) => a.id === id);
      if (idx >= 0) { appointments[idx].status = status; saveItem("sgf_appointments", appointments); return appointments[idx]; }
      return null;
    },
  },

  checkin: {
    list: () => checkins,
    create: (data: any) => {
      const newItem = { ...data, id: Date.now(), createdAt: new Date().toISOString() };
      checkins.push(newItem);
      saveItem("sgf_checkins", checkins);
      return newItem;
    },
  },

  specialPrice: {
    listByCustomer: ({ customerId }: { customerId: number }) =>
      specialPrices
        .filter((sp) => sp.customerId === customerId)
        .map((sp) => ({
          ...sp,
          stockItem: products.find((p) => p.id === sp.stockItemId) || null,
        })),
    set: ({ customerId, stockItemId, specialPrice: price }: { customerId: number; stockItemId: number; specialPrice: number }) => {
      const existing = specialPrices.find((sp) => sp.customerId === customerId && sp.stockItemId === stockItemId);
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
    list: () => SALES_REPS.map((name, i) => ({ id: i + 1, name, isActive: true })),
    getStats: () => {
      const repStats = SALES_REPS.map((name) => {
        const repCustomers = customers.filter((c) => c.salesRepName === name);
        const repOrders = orders.filter((o) => {
          const cust = customers.find((c) => c.id === o.customerId);
          return cust?.salesRepName === name && o.orderType !== "sample";
        });
        const repSamples = orders.filter((o) => {
          const cust = customers.find((c) => c.id === o.customerId);
          return cust?.salesRepName === name && o.orderType === "sample";
        });
        const totalSales = repOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
        const sampleCost = repSamples.reduce((sum, o) => {
          const cost = o.items?.reduce((s: number, item: any) => {
            const prod = products.find((p) => p.id === item.stockItemId);
            return s + (Number(prod?.wholesalePrice || 0) * item.quantity);
          }, 0) || 0;
          return sum + cost;
        }, 0);
        return { name, customerCount: repCustomers.length, orderCount: repOrders.length, sampleCount: repSamples.length, totalSales, sampleCost };
      });
      return { total: SALES_REPS.length, active: SALES_REPS.length, inactive: 0, repStats };
    },
  },

  followUp: {
    list: () => {
      // Show ALL pending follow-ups (sales rep needs to action them)
      return followUps
        .filter((fu) => fu.status === "pending")
        .map((fu) => ({
          ...fu,
          customer: customers.find((c) => c.id === fu.customerId) || null,
          order: orders.find((o) => o.id === fu.orderId) || null,
        }));
    },
    update: ({ id, status, reason, expectedOrderDate }: { id: number; status: string; reason?: string; expectedOrderDate?: string }) => {
      const idx = followUps.findIndex((fu) => fu.id === id);
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

  sampleReport: {
    getByCustomer: ({ customerId }: { customerId: number }) => {
      const customerOrders = orders.filter((o) => o.customerId === customerId && o.orderType === "sample");
      const report = customerOrders.flatMap((o) =>
        (o.items || []).map((item: any) => {
          const product = products.find((p) => p.id === item.stockItemId);
          const invoice = invoices.find((i) => i.orderId === o.id);
          const cost = Number(product?.wholesalePrice || 0) * item.quantity;
          return {
            productCode: product?.productCode || "",
            productName: product?.productName || "Unknown",
            dateTaken: o.createdAt,
            orderNumber: o.orderNumber,
            invoiceNumber: invoice?.invoiceNumber || "N/A",
            quantity: item.quantity,
            unitCost: Number(product?.wholesalePrice || 0),
            totalCost: cost,
          };
        })
      );
      const grandTotal = report.reduce((sum, r) => sum + r.totalCost, 0);
      return { items: report, grandTotal };
    },
    getAll: () => {
      const sampleOrders = orders.filter((o) => o.orderType === "sample");
      const report = [] as any[];
      for (const customer of customers) {
        const custSamples = sampleOrders.filter((o) => o.customerId === customer.id);
        if (custSamples.length === 0) continue;
        const items = custSamples.flatMap((o) =>
          (o.items || []).map((item: any) => {
            const product = products.find((p) => p.id === item.stockItemId);
            const invoice = invoices.find((i) => i.orderId === o.id);
            return {
              productCode: product?.productCode || "",
              productName: product?.productName || "Unknown",
              dateTaken: o.createdAt,
              orderNumber: o.orderNumber,
              invoiceNumber: invoice?.invoiceNumber || "N/A",
              quantity: item.quantity,
              unitCost: Number(product?.wholesalePrice || 0),
              totalCost: Number(product?.wholesalePrice || 0) * item.quantity,
            };
          })
        );
        const totalCost = items.reduce((sum, item) => sum + item.totalCost, 0);
        report.push({
          customerId: customer.id,
          customerName: customer.name,
          customerCode: customer.customerCode,
          salesRepName: customer.salesRepName || "Unassigned",
          items,
          totalCost,
          sampleCount: custSamples.length,
        });
      }
      const grandTotal = report.reduce((sum, r) => sum + r.totalCost, 0);
      return { customers: report, grandTotal };
    },
  },

  dashboard: {
    stats: () => ({
      totalRevenue: invoices.filter((i) => !i.notes?.includes("Sample")).reduce((s, i) => s + Number(i.totalAmount || 0), 0),
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
};

function getEffectivePrice(stockItemId: number, priceTier: string, customerId: number): number {
  const sp = specialPrices.find((p) => p.customerId === customerId && p.stockItemId === stockItemId);
  if (sp) return Number(sp.specialPrice);
  const stock = products.find((p) => p.id === stockItemId);
  if (!stock) return 0;
  switch (priceTier) {
    case "corporate": return Number(stock.corporatePrice);
    case "bulk": return Number(stock.bulkPrice);
    case "retail": return Number(stock.retailPrice);
    default: return Number(stock.wholesalePrice);
  }
}
