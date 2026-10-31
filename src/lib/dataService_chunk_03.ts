// =============================================================================
// SAVE / PERSIST
// =============================================================================

export function save(): void {
  try {
    saveItem("sgf_orders", orders);
    saveItem("sgf_customers", customers);
    saveItem("sgf_products", products);
    saveItem("sgf_invoices", invoices);
    saveItem("sgf_receipts", receipts);
    saveItem("sgf_users", users);
    saveItem("sgf_activityLogs", activityLogs);
    saveItem("sgf_auditLog", auditLog);
    saveItem("sgf_companySettings", companySettings);
    saveItem("sgf_purchaseOrders", purchaseOrders);
    saveItem("sgf_quotes", quotes);
    saveItem("sgf_suppliers", suppliers);
    saveItem("sgf_deliveryNotes", deliveryNotes);
    saveItem("sgf_stockAdjustments", stockAdjustments);
    saveItem("sgf_warehouses", warehouses);
    saveItem("sgf_stockMovements", stockMovements);
    saveItem("sgf_paymentTerms", paymentTerms);
    saveItem("sgf_taxRates", taxRates);
    saveItem("sgf_priceLists", priceLists);
    saveItem("sgf_notifications", notifications);
    saveItem("sgf_reports", reports);
    saveItem("sgf_syncRecords", syncRecords);
    logSystemEvent("info", "Data saved successfully");
  } catch (error) {
    logSystemEvent("error", "Failed to save data", { error: String(error) });
  }
}

// =============================================================================
// RESET DATA
// =============================================================================

export function resetData(): void {
  orders = [];
  customers = [];
  products = [];
  invoices = [];
  receipts = [];
  users = [...DEFAULT_USERS];
  activityLogs = [];
  auditLog = [];
  companySettings = [{ ...DEFAULT_COMPANY_SETTINGS }];
  purchaseOrders = [];
  quotes = [];
  suppliers = [];
  deliveryNotes = [];
  stockAdjustments = [];
  warehouses = [];
  stockMovements = [];
  paymentTerms = [...DEFAULT_PAYMENT_TERMS];
  taxRates = [...DEFAULT_TAX_RATES];
  priceLists = [];
  notifications = [];
  reports = [];
  syncRecords = [];
  save();
  logSystemEvent("info", "Data reset to defaults");
}

// =============================================================================
// EXPORT / IMPORT
// =============================================================================

export function exportAllData(): string {
  const data = {
    orders,
    customers,
    products,
    invoices,
    receipts,
    users,
    activityLogs,
    auditLog,
    companySettings,
    purchaseOrders,
    quotes,
    suppliers,
    deliveryNotes,
    stockAdjustments,
    warehouses,
    stockMovements,
    paymentTerms,
    taxRates,
    priceLists,
    notifications,
    reports,
    syncRecords,
    exportDate: new Date().toISOString(),
    version: "2.0",
  };
  return JSON.stringify(data, null, 2);
}

export function importAllData(jsonString: string): { success: boolean; error?: string; imported?: any } {
  try {
    const data = JSON.parse(jsonString);
    if (data.orders) orders = data.orders;
    if (data.customers) customers = data.customers;
    if (data.products) products = data.products;
    if (data.invoices) invoices = data.invoices;
    if (data.receipts) receipts = data.receipts;
    if (data.users) users = data.users;
    if (data.activityLogs) activityLogs = data.activityLogs;
    if (data.auditLog) auditLog = data.auditLog;
    if (data.companySettings) companySettings = data.companySettings;
    if (data.purchaseOrders) purchaseOrders = data.purchaseOrders;
    if (data.quotes) quotes = data.quotes;
    if (data.suppliers) suppliers = data.suppliers;
    if (data.deliveryNotes) deliveryNotes = data.deliveryNotes;
    if (data.stockAdjustments) stockAdjustments = data.stockAdjustments;
    if (data.warehouses) warehouses = data.warehouses;
    if (data.stockMovements) stockMovements = data.stockMovements;
    if (data.paymentTerms) paymentTerms = data.paymentTerms;
    if (data.taxRates) taxRates = data.taxRates;
    if (data.priceLists) priceLists = data.priceLists;
    if (data.notifications) notifications = data.notifications;
    if (data.reports) reports = data.reports;
    if (data.syncRecords) syncRecords = data.syncRecords;
    save();
    logSystemEvent("info", "Data imported successfully");
    return { success: true, imported: { orders: orders.length, customers: customers.length, products: products.length, invoices: invoices.length } };
  } catch (error) {
    logSystemEvent("error", "Failed to import data", { error: String(error) });
    return { success: false, error: String(error) };
  }
}

// =============================================================================
// ORDER SERVICE
// =============================================================================

export const orderService = {
  list: (company?: string) => {
    const comp = company || getCurrentCompany();
    return orders.filter((o) => o.company === comp);
  },
  getById: (id: number) => {
    return orders.find((o) => o.id === id);
  },
  getByOrderNumber: (orderNumber: string) => {
    return orders.find((o) => o.orderNumber === orderNumber);
  },
  getByCustomer: (customerId: number) => {
    return orders.filter((o) => o.customerId === customerId);
  },
  getByStatus: (status: string) => {
    const comp = getCurrentCompany();
    return orders.filter((o) => o.company === comp && o.status === status);
  },
  getByDateRange: (startDate: string, endDate: string) => {
    const comp = getCurrentCompany();
    return orders.filter((o) => o.company === comp && o.orderDate >= startDate && o.orderDate <= endDate);
  },
  create: (data: Partial<Order>) => {
    const comp = getCurrentCompany();
    const newOrder: Order = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      orderNumber: data.sampleOrder ? generateSampleOrderNumber() : generateOrderNumber(),
      customerId: data.customerId || 0,
      customerName: data.customerName || "",
      company: comp,
      orderDate: data.orderDate || new Date().toISOString(),
      status: data.status || "pending",
      priority: data.priority || "normal",
      items: data.items || [],
      subtotal: data.subtotal || 0,
      discount: data.discount || 0,
      tax: data.tax || 0,
      total: data.total || 0,
      currency: data.currency || "ZAR",
      notes: data.notes,
      internalNotes: data.internalNotes,
      shippingAddress: data.shippingAddress,
      billingAddress: data.billingAddress,
      contactName: data.contactName,
      contactPhone: data.contactPhone,
      contactEmail: data.contactEmail,
      paymentTerms: data.paymentTerms,
      paymentStatus: data.paymentStatus || "unpaid",
      assignedTo: data.assignedTo,
      source: data.source,
      createdBy: data.createdBy,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sampleOrder: data.sampleOrder,
      isRecurring: data.isRecurring,
      recurringFrequency: data.recurringFrequency,
      parentOrderId: data.parentOrderId,
      deliveryInstructions: data.deliveryInstructions,
      poNumber: data.poNumber,
    };
    orders.push(newOrder);
    saveItem("sgf_orders", orders);
    logAudit("create", "order", newOrder.id, data);
    logActivity("create", "order", newOrder.id, { orderNumber: newOrder.orderNumber });
    return newOrder;
  },
  update: (id: number, data: Partial<Order>) => {
    const index = orders.findIndex((o) => o.id === id);
    if (index === -1) return null;
    const oldOrder = { ...orders[index] };
    orders[index] = { ...orders[index], ...data, updatedAt: new Date().toISOString() };
    saveItem("sgf_orders", orders);
    logAudit("update", "order", id, { old: oldOrder, new: data });
    logActivity("update", "order", id, { orderNumber: orders[index].orderNumber });
    return orders[index];
  },
  delete: (id: number) => {
    const index = orders.findIndex((o) => o.id === id);
    if (index === -1) return { success: false, error: "Order not found" };
    const order = orders[index];
    orders.splice(index, 1);
    saveItem("sgf_orders", orders);
    logAudit("delete", "order", id, { orderNumber: order.orderNumber });
    logActivity("delete", "order", id, { orderNumber: order.orderNumber });
    return { success: true };
  },
  duplicate: (id: number) => {
    const order = orders.find((o) => o.id === id);
    if (!order) return null;
    const newOrder: Order = {
      ...order,
      id: Date.now() + Math.floor(Math.random() * 1000),
      orderNumber: generateOrderNumber(),
      status: "pending",
      paymentStatus: "unpaid",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      items: order.items.map((item) => ({ ...item, id: Date.now() + Math.floor(Math.random() * 1000) + item.id })),
    };
    orders.push(newOrder);
    saveItem("sgf_orders", orders);
    logAudit("duplicate", "order", newOrder.id, { sourceOrderId: id });
    return newOrder;
  },
  convertToInvoice: (id: number) => {
    const order = orders.find((o) => o.id === id);
    if (!order) return { success: false, error: "Order not found" };
    const invoiceItems: InvoiceItem[] = order.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discount: item.discount,
      tax: item.tax,
      total: item.total,
    }));
    const invoice: Invoice = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      invoiceNumber: generateInvoiceNumber(),
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerId: order.customerId,
      customerName: order.customerName,
      customerCode: order.customerCode,
      company: order.company,
      invoiceDate: new Date().toISOString(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      status: "draft",
      items: invoiceItems,
      subtotal: order.subtotal,
      discount: order.discount,
      tax: order.tax,
      total: order.total,
      amountPaid: 0,
      balanceDue: order.total,
      currency: order.currency,
      notes: order.notes,
      paymentTerms: order.paymentTerms,
      poNumber: order.poNumber,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    invoices.push(invoice);
    saveItem("sgf_invoices", invoices);
    orderService.update(id, { status: "confirmed" });
    logAudit("convert", "order_to_invoice", invoice.id, { orderId: id });
    return { success: true, invoice };
  },
  convertToDeliveryNote: (id: number) => {
    const order = orders.find((o) => o.id === id);
    if (!order) return { success: false, error: "Order not found" };
    const deliveryItems: DeliveryItem[] = order.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
    }));
    const deliveryNote: DeliveryNote = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      dnNumber: generateDeliveryNoteNumber(),
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerId: order.customerId,
      customerName: order.customerName,
      company: order.company,
      deliveryDate: new Date().toISOString(),
      status: "pending",
      items: deliveryItems,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    deliveryNotes.push(deliveryNote);
    saveItem("sgf_deliveryNotes", deliveryNotes);
    orderService.update(id, { status: "shipped" });
    logAudit("convert", "order_to_delivery", deliveryNote.id, { orderId: id });
    return { success: true, deliveryNote };
  },
  getStats: () => {
    const comp = getCurrentCompany();
    const companyOrders = orders.filter((o) => o.company === comp);
    return {
      total: companyOrders.length,
      pending: companyOrders.filter((o) => o.status === "pending").length,
      confirmed: companyOrders.filter((o) => o.status === "confirmed").length,
      processing: companyOrders.filter((o) => o.status === "processing").length,
      shipped: companyOrders.filter((o) => o.status === "shipped").length,
      delivered: companyOrders.filter((o) => o.status === "delivered").length,
      cancelled: companyOrders.filter((o) => o.status === "cancelled").length,
      totalValue: companyOrders.reduce((sum, o) => sum + o.total, 0),
      today: companyOrders.filter((o) => o.orderDate.startsWith(new Date().toISOString().split("T")[0])).length,
      thisWeek: companyOrders.filter((o) => {
        const orderDate = new Date(o.orderDate);
        const now = new Date();
        const weekStart = new Date(now.setDate(now.getDate() - now.getDay()));
        return orderDate >= weekStart;
      }).length,
      thisMonth: companyOrders.filter((o) => o.orderDate.startsWith(new Date().toISOString().slice(0, 7))).length,
    };
  },
  search: (query: string) => {
    const comp = getCurrentCompany();
    const q = query.toLowerCase();
    return orders.filter(
      (o) =>
        o.company === comp &&
        (o.orderNumber.toLowerCase().includes(q) ||
          o.customerName.toLowerCase().includes(q) ||
          o.notes?.toLowerCase().includes(q) ||
          o.items.some((i) => i.productName.toLowerCase().includes(q)))
    );
  },
};

// =============================================================================
// CUSTOMER SERVICE
// =============================================================================

export const customerService = {
  list: (company?: string) => {
    const comp = company || getCurrentCompany();
    return customers.filter((c) => c.company === comp);
  },
  getById: (id: number) => {
    return customers.find((c) => c.id === id);
  },
  getByName: (name: string) => {
    return customers.find((c) => c.name.toLowerCase() === name.toLowerCase());
  },
  getByCode: (code: string) => {
    return customers.find((c) => c.code === code);
  },
  create: (data: Partial<Customer>) => {
    const comp = getCurrentCompany();
    const newCustomer: Customer = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      name: data.name || "",
      company: comp,
      status: data.status || "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...data,
    };
    customers.push(newCustomer);
    saveItem("sgf_customers", customers);
    logAudit("create", "customer", newCustomer.id, data);
    return newCustomer;
  },
  update: (id: number, data: Partial<Customer>) => {
    const index = customers.findIndex((c) => c.id === id);
    if (index === -1) return null;
    customers[index] = { ...customers[index], ...data, updatedAt: new Date().toISOString() };
    saveItem("sgf_customers", customers);
    logAudit("update", "customer", id, data);
    return customers[index];
  },
  delete: (id: number) => {
    const index = customers.findIndex((c) => c.id === id);
    if (index === -1) return { success: false, error: "Customer not found" };
    const customer = customers[index];
    customers.splice(index, 1);
    saveItem("sgf_customers", customers);
    logAudit("delete", "customer", id, { name: customer.name });
    return { success: true };
  },
  getStats: () => {
    const comp = getCurrentCompany();
    const companyCustomers = customers.filter((c) => c.company === comp);
    return {
      total: companyCustomers.length,
      active: companyCustomers.filter((c) => c.status === "active").length,
      inactive: companyCustomers.filter((c) => c.status === "inactive").length,
      suspended: companyCustomers.filter((c) => c.status === "suspended").length,
      withBalance: companyCustomers.filter((c) => (c.balance || 0) > 0).length,
      totalBalance: companyCustomers.reduce((sum, c) => sum + (c.balance || 0), 0),
    };
  },
  search: (query: string) => {
    const comp = getCurrentCompany();
    const q = query.toLowerCase();
    return customers.filter(
      (c) =>
        c.company === comp &&
        (c.name.toLowerCase().includes(q) ||
          c.code?.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q) ||
          c.phone?.includes(q) ||
          c.city?.toLowerCase().includes(q))
    );
  },
  getTopCustomers: (limit = 10) => {
    const comp = getCurrentCompany();
    const customerTotals = new Map<number, number>();
    orders.filter((o) => o.company === comp).forEach((o) => {
      customerTotals.set(o.customerId, (customerTotals.get(o.customerId) || 0) + o.total);
    });
    return customers
      .filter((c) => c.company === comp)
      .map((c) => ({ ...c, totalSpent: customerTotals.get(c.id) || 0 }))
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, limit);
  },
};
