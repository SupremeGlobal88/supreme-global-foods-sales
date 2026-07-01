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
let followUpActions = [] as any[];
let collectionNotes = [] as any[];
let collectionPromises = [] as any[];
let accountHolds = [] as any[];

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
    const fa = localStorage.getItem("sgf_followUpActions");
    if (fa) followUpActions = JSON.parse(fa);
    else followUpActions = [];
    const cn = localStorage.getItem("sgf_collectionNotes");
    if (cn) collectionNotes = JSON.parse(cn);
    else collectionNotes = [];
    const cp = localStorage.getItem("sgf_collectionPromises");
    if (cp) collectionPromises = JSON.parse(cp);
    else collectionPromises = [];
    const ah = localStorage.getItem("sgf_accountHolds");
    if (ah) accountHolds = JSON.parse(ah);
    else accountHolds = [];
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

/** Re-read all data from localStorage — call after cloud sync writes new data */
export function reloadFromStorage(): void {
  load();
}

// Helper: create an invoice from an order
/** Get next SGF invoice number. Starts at SGF1801 (last was SGF1800). */
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
  return `SGF${String(maxNum + 1)}`;
}

/** Get next sample invoice number */
function getNextSampleInvoiceNumber(): string {
  const smpCount = invoices.filter((i) => (i.invoiceNumber || "").startsWith("SGF-SMP")).length;
  return `SGF-SMP-${String(smpCount + 1).padStart(3, "0")}`;
}

function createInvoiceFromOrder(order: any, subtotal: number, vatAmount: number, total: number, isSample: boolean) {
  const now = new Date();
  const customer = customers.find((c) => c.id === order.customerId);

  // Calculate due date from payment terms
  const paymentTerms = order.paymentTerms || "cod";
  const days = paymentTerms === "30_days" ? 30 : paymentTerms === "14_days" ? 14 : paymentTerms === "7_days" ? 7 : 0;
  const dueDate = new Date(now);
  dueDate.setDate(dueDate.getDate() + days);

  // Invoice numbering: SGF1801, SGF1802, etc.
  const invoiceNumber = isSample ? getNextSampleInvoiceNumber() : getNextInvoiceNumber();
  const deliveryNoteNumber = `DN-${order.orderNumber}`;

  // Status: draft until order is ready for delivery, then sent
  const status = isSample ? "paid" : (order.status === "ready" || order.status === "delivered" ? "sent" : "draft");

  invoices.push({
    id: Date.now() + Math.random(),
    orderId: order.id,
    orderNumber: order.orderNumber,
    invoiceNumber,
    deliveryNoteNumber,
    customerId: order.customerId,
    customer: customer || null,
    subtotal: isSample ? 0 : subtotal,
    vatAmount: isSample ? 0 : vatAmount,
    total: isSample ? 0 : total,
    totalAmount: isSample ? 0 : total,
    balanceDue: isSample ? 0 : total,
    amountPaid: 0,
    status,
    paymentTerms: order.paymentTerms || "cod",
    invoiceDate: now.toISOString(),
    dueDate: dueDate.toISOString(),
    notes: isSample ? `Sample order - ${order.orderNumber}` : `Invoice for ${order.orderNumber}`,
    items: isSample ? [] : (order.items || []).map((item: any) => ({
      description: `${item.productCode} - ${item.productName}`,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
    })),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  });
  saveItem("sgf_invoices", invoices);
  return invoiceNumber;
}

/** Update an existing invoice when its order is edited */
function updateInvoiceFromOrder(order: any) {
  const idx = invoices.findIndex((i) => i.orderId === order.id);
  if (idx < 0) return; // No invoice exists for this order

  const inv = invoices[idx];
  const customer = customers.find((c) => c.id === order.customerId);

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
  const idx = invoices.findIndex((i) => i.orderId === orderId);
  if (idx >= 0 && invoices[idx].status === "draft") {
    invoices[idx].status = "sent";
    invoices[idx].updatedAt = new Date().toISOString();
    saveItem("sgf_invoices", invoices);
  }
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
    bulkCreate: (items: any[]) => {
      const created = [];
      const updated = [];
      for (let i = 0; i < items.length; i++) {
        const incoming = items[i];
        // Check if product already exists by productName (case-insensitive)
        // productCode can differ between uploads, but productName is the reliable identifier
        const existingIdx = products.findIndex(
          (p) => (p.productName || "").toLowerCase().trim() === (incoming.productName || "").toLowerCase().trim()
        );
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
            .filter((o) => o.customerId === c.id)
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
    list: () => orders.map((o) => {
      const customer = customers.find((c) => c.id === o.customerId);
      return { ...o, customer: customer || null };
    }),
    getById: (id: number) => {
      const order = orders.find((o) => o.id === id);
      if (!order) return null;
      const customer = customers.find((c) => c.id === order.customerId);
      return { ...order, customer: customer || null };
    },
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

        createInvoiceFromOrder(newOrder, subtotal, vatAmount, total, true);
      } else {
        // Regular order: create invoice as draft (activates to "sent" when order is marked "ready")
        createInvoiceFromOrder(newOrder, subtotal, vatAmount, total, false);
      }

      return newOrder;
    },
    update: ({ id, data }: { id: number; data: any }) => {
      const idx = orders.findIndex((o) => o.id === id);
      if (idx >= 0) {
        const oldOrder = orders[idx];
        // RESTORE old stock first
        for (const item of (oldOrder.items || [])) {
          const prodIdx = products.findIndex((p) => p.id === item.stockItemId);
          if (prodIdx >= 0) {
            const newQty = (products[prodIdx].quantity || 0) + item.quantity;
            products[prodIdx].quantity = newQty;
            products[prodIdx].status = newQty === 0 ? "out_of_stock" : newQty < 20 ? "low_stock" : "in_stock";
          }
        }
        // Apply new items with fresh calculations
        const isSample = data.orderType === "sample";
        const items = (data.items || []).map((item: any) => {
          const product = products.find((p) => p.id === item.stockItemId);
          const unitPrice = isSample ? 0 : (item.unitPrice || getEffectivePrice(item.stockItemId, data.priceTier, data.customerId));
          return { ...item, productCode: product?.productCode || "", productName: product?.productName || "Unknown", lineTotal: unitPrice * item.quantity, unitPrice };
        });
        const subtotal = isSample ? 0 : items.reduce((sum: number, item: any) => sum + item.lineTotal, 0);
        const vatAmount = isSample ? 0 : subtotal * 0.15;
        const total = isSample ? 0 : subtotal + vatAmount;
        // DEDUCT new stock
        for (const item of items) {
          const prodIdx = products.findIndex((p) => p.id === item.stockItemId);
          if (prodIdx >= 0) {
            const newQty = Math.max(0, (products[prodIdx].quantity || 0) - item.quantity);
            products[prodIdx].quantity = newQty;
            products[prodIdx].status = newQty === 0 ? "out_of_stock" : newQty < 20 ? "low_stock" : "in_stock";
          }
        }
        orders[idx] = { ...oldOrder, ...data, items, subtotal, vatAmount, total, totalAmount: total, updatedAt: new Date().toISOString() };
        saveItem("sgf_products", products);
        saveItem("sgf_orders", orders);
        // Auto-update linked invoice with new order details
        updateInvoiceFromOrder(orders[idx]);
        return orders[idx];
      }
      return null;
    },
    updateStatus: ({ id, status }: { id: number; status: string }) => {
      const idx = orders.findIndex((o) => o.id === id);
      if (idx >= 0) {
        const oldStatus = orders[idx].status;
        const order = orders[idx];
        order.status = status;
        // RESTORE STOCK when order is delivered or cancelled
        if ((status === "delivered" || status === "cancelled") && oldStatus !== "delivered" && oldStatus !== "cancelled") {
          for (const item of (order.items || [])) {
            const prodIdx = products.findIndex((p) => p.id === item.stockItemId);
            if (prodIdx >= 0) {
              const newQty = (products[prodIdx].quantity || 0) + item.quantity;
              products[prodIdx].quantity = newQty;
              products[prodIdx].status = newQty === 0 ? "out_of_stock" : newQty < 20 ? "low_stock" : "in_stock";
            }
          }
          saveItem("sgf_products", products);
        }
        // ACTIVATE INVOICE from draft to sent when order becomes ready or delivered
        if ((status === "ready" || status === "delivered") && order.orderType !== "sample") {
          activateInvoiceFromOrder(order.id);
          // If no invoice exists yet, create one
          const existingInvoice = invoices.find((i) => i.orderId === order.id);
          if (!existingInvoice) {
            const subtotal = order.subtotal || 0;
            const vatAmount = order.vatAmount || 0;
            const total = order.total || 0;
            createInvoiceFromOrder(order, subtotal, vatAmount, total, false);
          }
        }
        saveItem("sgf_orders", orders);
        return order;
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
    list: () => invoices.map((inv) => {
      const customer = customers.find((c) => c.id === inv.customerId);
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
    }),
    getById: (id: number) => {
      const inv = invoices.find((i) => i.id === id);
      if (!inv) return null;
      const customer = customers.find((c) => c.id === inv.customerId);
      return { ...inv, customer: customer || null };
    },
    create: (data: any) => {
      const invoiceNumber = `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${String(invoices.length + 1).padStart(4, "0")}`;
      const customer = customers.find((c) => c.id === data.customerId);
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
      const idx = invoices.findIndex((i) => i.id === id);
      if (idx >= 0) { invoices[idx].status = status; invoices[idx].amountPaid = amountPaid || 0; saveItem("sgf_invoices", invoices); return invoices[idx]; }
      return null;
    },
    recordPayment: ({ invoiceId, amount, paymentMethod, paymentDate, referenceNumber, notes }: any) => {
      const idx = invoices.findIndex((i) => i.id === invoiceId);
      if (idx < 0) return null;
      const inv = invoices[idx];
      const currentPaid = Number(inv.amountPaid || 0);
      const newPaid = currentPaid + amount;
      const total = Number(inv.total || inv.totalAmount || 0);
      inv.amountPaid = newPaid;
      inv.balanceDue = Math.max(0, total - newPaid);
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
      saveItem("sgf_collectionNotes", collectionNotes);
      saveItem("sgf_invoices", invoices);
      return inv;
    },
    editPayment: ({ invoiceId, paymentId, amount, paymentMethod, paymentDate, referenceNumber, notes }: any) => {
      const invIdx = invoices.findIndex((i) => i.id === invoiceId);
      if (invIdx < 0) return null;
      const inv = invoices[invIdx];
      if (!inv.payments) return null;
      const payIdx = inv.payments.findIndex((p: any) => p.id === paymentId);
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
      inv.balanceDue = Math.max(0, total - totalPaid);
      if (totalPaid >= total) {
        inv.status = "paid";
      } else if (totalPaid > 0) {
        inv.status = "partially_paid";
      } else {
        inv.status = inv.status === "draft" ? "draft" : "sent";
      }
      saveItem("sgf_invoices", invoices);
      return inv;
    },
    deletePayment: ({ invoiceId, paymentId }: { invoiceId: number; paymentId: number }) => {
      const invIdx = invoices.findIndex((i) => i.id === invoiceId);
      if (invIdx < 0) return null;
      const inv = invoices[invIdx];
      if (!inv.payments) return null;
      inv.payments = inv.payments.filter((p: any) => p.id !== paymentId);
      // Recalculate totals
      const totalPaid = inv.payments.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
      const total = Number(inv.total || inv.totalAmount || 0);
      inv.amountPaid = totalPaid;
      inv.balanceDue = Math.max(0, total - totalPaid);
      if (totalPaid >= total) {
        inv.status = "paid";
      } else if (totalPaid > 0) {
        inv.status = "partially_paid";
      } else {
        inv.status = inv.status === "draft" ? "draft" : "sent";
      }
      saveItem("sgf_invoices", invoices);
      return inv;
    },
    getCustomerStatement: ({ customerId, fromDate, toDate }: any) => {
      const customer = customers.find((c) => c.id === customerId);
      const custInvoices = invoices
        .filter((i) => i.customerId === customerId)
        .filter((i) => !fromDate || new Date(i.createdAt) >= new Date(fromDate))
        .filter((i) => !toDate || new Date(i.createdAt) <= new Date(toDate));
      const lines = custInvoices.map((inv) => ({
        date: inv.createdAt,
        description: `${inv.invoiceNumber} - ${inv.notes || "Invoice"}`,
        debit: Number(inv.total || inv.totalAmount || 0),
        credit: Number(inv.amountPaid || 0),
        balance: Number(inv.total || inv.totalAmount || 0) - Number(inv.amountPaid || 0),
      }));
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
        .filter((i) => i.status !== "draft" && i.status !== "paid")
        .reduce((sum, i) => sum + (Number(i.balanceDue) || Number(i.total || i.totalAmount || 0) - Number(i.amountPaid || 0)), 0);
      return {
        total: invoices.length,
        draft: invoices.filter((i) => i.status === "draft").length,
        sent: invoices.filter((i) => i.status === "sent").length,
        partiallyPaid: invoices.filter((i) => i.status === "partially_paid").length,
        paid: invoices.filter((i) => i.status === "paid").length,
        overdue: invoices.filter((i) => i.status === "overdue").length,
        totalValue,
        totalPaid,
        outstanding,
      };
    },
  },

  appointment: {
    list: () => appointments.map((a) => ({
      ...a,
      customer: customers.find((c) => c.id === a.customerId) || null,
    })),
    create: (data: any) => {
      const newItem = { ...data, id: Date.now(), status: "scheduled", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      // Auto-populate salesRepName from customer if not provided
      if (!newItem.salesRepName && newItem.customerId) {
        const cust = customers.find((c) => c.id === newItem.customerId);
        if (cust?.salesRepName) newItem.salesRepName = cust.salesRepName;
      }
      appointments.push(newItem);
      saveItem("sgf_appointments", appointments);
      return newItem;
    },
    updateStatus: ({ id, status }: { id: number; status: string }) => {
      const idx = appointments.findIndex((a) => a.id === id);
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
      customer: customers.find((c) => c.id === ci.customerId) || null,
    })),
    create: (data: any) => {
      const newItem = { ...data, id: Date.now(), status: "checked_in", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      // Auto-populate salesRepName from customer if not provided
      if (!newItem.salesRepName && newItem.customerId) {
        const cust = customers.find((c) => c.id === newItem.customerId);
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
      const idx = checkins.findIndex((ci) => ci.id === id);
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
  },

  followUpAction: {
    list: () => followUpActions.map((fa) => ({
      ...fa,
      customer: customers.find((c) => c.id === fa.customerId) || null,
    })).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    listByCustomer: ({ customerId }: { customerId: number }) =>
      followUpActions
        .filter((fa) => fa.customerId === customerId)
        .map((fa) => ({
          ...fa,
          customer: customers.find((c) => c.id === fa.customerId) || null,
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
        .map((fu) => {
          const order = orders.find((o) => o.id === fu.orderId);
          const customer = customers.find((c) => c.id === fu.customerId);
          return {
            ...fu,
            customer: customer || null,
            order: order ? { ...order, customer: customer || null } : null,
          };
        });
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

  collections: {
    getOverdueInvoices: () => {
      const now = new Date();
      return invoices
        .filter((inv) => inv.status !== "paid")
        .map((inv) => {
          const customer = customers.find((c) => c.id === inv.customerId);
          const createdAt = new Date(inv.createdAt);
          const daysOverdue = Math.max(0, Math.floor((now.getTime() - createdAt.getTime()) / 86400000) - 30);
          let bucket = "pre_due";
          if (daysOverdue >= 21) bucket = "days_21_plus";
          else if (daysOverdue >= 11) bucket = "days_11_20";
          else if (daysOverdue >= 6) bucket = "days_6_10";
          else if (daysOverdue >= 3) bucket = "days_3_5";
          else if (daysOverdue >= 1) bucket = "days_1_2";
          else if (daysOverdue === 0) bucket = "due_today";
          const notes = collectionNotes.filter((n) => n.invoiceId === inv.id);
          const latestPromise = collectionPromises
            .filter((p) => p.invoiceId === inv.id)
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] || null;
          const accountHold = accountHolds.find((h) => h.customerId === inv.customerId && h.status === "active") || null;
          return {
            ...inv,
            customer: customer || null,
            daysOverdue,
            bucket,
            balanceDue: Number(inv.totalAmount || 0) - Number(inv.amountPaid || 0),
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
        .filter((inv) => inv.customerId === customerId)
        .map((inv) => ({
          ...inv,
          notes: collectionNotes.filter((n) => n.invoiceId === inv.id),
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
      accountHolds = accountHolds.map((h) => h.customerId === customerId && h.status === "active" ? { ...h, status: "released", releasedAt: new Date().toISOString() } : h);
      const hold = { id: Date.now() + Math.random(), customerId, reason: reason || "Non-payment", notes: notes || "", status: "active", createdAt: new Date().toISOString() };
      accountHolds.push(hold);
      // Also add a collection note
      collectionNotes.push({ id: Date.now() + Math.random(), invoiceId: null, customerId, type: "hold", notes: `Account hold placed: ${reason || "Non-payment"}`, contactMethod: "manual", contactPerson: "", followUpDate: null, createdAt: new Date().toISOString() });
      saveItem("sgf_accountHolds", accountHolds);
      saveItem("sgf_collectionNotes", collectionNotes);
      return hold;
    },
    releaseHold: ({ holdId }: { holdId: number }) => {
      const idx = accountHolds.findIndex((h) => h.id === holdId);
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
