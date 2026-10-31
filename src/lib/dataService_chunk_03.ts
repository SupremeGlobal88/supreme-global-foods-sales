// =============================================================================
// CUSTOMER SERVICE
// =============================================================================

export const customerService = {
  list: () => customers,
  getById: (id: number) => customers.find((c) => c.id === id),
  getByName: (name: string) => customers.find((c) => c.name.toLowerCase() === name.toLowerCase()),
  create: (data: any) => {
    const newCustomer = {
      id: Date.now() + Math.random(),
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isActive: data.isActive !== false,
    };
    customers.push(newCustomer);
    saveItem("sgf_customers", customers);
    logAudit("create", "customer", newCustomer.id, data);
    return newCustomer;
  },
  update: (id: number, data: any) => {
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
    customers.splice(index, 1);
    saveItem("sgf_customers", customers);
    logAudit("delete", "customer", id, {});
    return { success: true };
  },
  getBySalesRep: (repName: string) => customers.filter((c) => c.salesRepName === repName),
  getByRegion: (region: string) => customers.filter((c) => c.region === region),
  getActive: () => customers.filter((c) => c.isActive !== false),
  getInactive: () => customers.filter((c) => c.isActive === false),
  search: (query: string) => {
    const q = query.toLowerCase();
    return customers.filter((c) =>
      c.name?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.phone?.toLowerCase().includes(q) ||
      c.customerCode?.toLowerCase().includes(q)
    );
  },
};

// =============================================================================
// PRODUCT SERVICE
// =============================================================================

export const productService = {
  list: () => products,
  getById: (id: number) => products.find((p) => p.id === id),
  getByCode: (code: string) => products.find((p) => p.productCode === code),
  create: (data: any) => {
    const newProduct = {
      id: Date.now() + Math.random(),
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    products.push(newProduct);
    saveItem("sgf_products", products);
    logAudit("create", "product", newProduct.id, data);
    return newProduct;
  },
  update: (id: number, data: any) => {
    const index = products.findIndex((p) => p.id === id);
    if (index === -1) return null;
    products[index] = { ...products[index], ...data, updatedAt: new Date().toISOString() };
    saveItem("sgf_products", products);
    logAudit("update", "product", id, data);
    return products[index];
  },
  delete: (id: number) => {
    const index = products.findIndex((p) => p.id === id);
    if (index === -1) return { success: false, error: "Product not found" };
    products.splice(index, 1);
    saveItem("sgf_products", products);
    logAudit("delete", "product", id, {});
    return { success: true };
  },
  getByCategory: (category: string) => products.filter((p) => p.category === category),
  getLowStock: () => products.filter((p) => p.quantity <= (p.reorderLevel || 10)),
  search: (query: string) => {
    const q = query.toLowerCase();
    return products.filter((p) =>
      p.productName?.toLowerCase().includes(q) ||
      p.productCode?.toLowerCase().includes(q) ||
      p.description?.toLowerCase().includes(q)
    );
  },
};

// =============================================================================
// ORDER SERVICE
// =============================================================================

export const orderService = {
  list: () => orders,
  getById: (id: number) => orders.find((o) => o.id === id),
  getByCustomer: (customerId: number) => orders.filter((o) => o.customerId === customerId),
  getByStatus: (status: string) => orders.filter((o) => o.status === status),
  getByDate: (date: string) => orders.filter((o) => o.orderDate === date),
  getBySalesRep: (repName: string) => orders.filter((o) => o.salesRepName === repName),
  getPending: () => orders.filter((o) => o.status === "pending" || o.status === "confirmed" || o.status === "in_production" || o.status === "ready"),
  getOverdue: () => orders.filter((o) => o.deliveryDate && new Date(o.deliveryDate) < new Date() && o.status !== "delivered" && o.status !== "completed" && o.status !== "cancelled"),
  create: (data: any) => {
    const newOrder = {
      id: Date.now() + Math.random(),
      orderNumber: generateOrderNumber(data.orderType),
      ...data,
      status: data.status || "draft",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    orders.push(newOrder);
    saveItem("sgf_orders", orders);
    logAudit("create", "order", newOrder.id, data);
    return newOrder;
  },
  update: (id: number, data: any) => {
    const index = orders.findIndex((o) => o.id === id);
    if (index === -1) return null;
    orders[index] = { ...orders[index], ...data, updatedAt: new Date().toISOString() };
    saveItem("sgf_orders", orders);
    logAudit("update", "order", id, data);
    return orders[index];
  },
  delete: (id: number) => {
    const index = orders.findIndex((o) => o.id === id);
    if (index === -1) return { success: false, error: "Order not found" };
    orders.splice(index, 1);
    saveItem("sgf_orders", orders);
    logAudit("delete", "order", id, {});
    return { success: true };
  },
  getStats: () => {
    const total = orders.length;
    const draft = orders.filter((o) => o.status === "draft").length;
    const pending = orders.filter((o) => o.status === "pending").length;
    const confirmed = orders.filter((o) => o.status === "confirmed").length;
    const delivered = orders.filter((o) => o.status === "delivered").length;
    const cancelled = orders.filter((o) => o.status === "cancelled").length;
    const totalValue = orders.reduce((sum, o) => sum + (o.total || 0), 0);
    return { total, draft, pending, confirmed, delivered, cancelled, totalValue };
  },
};

// =============================================================================
// INVOICE SERVICE
// =============================================================================

export const invoiceService = {
  list: () => invoices,
  getById: (id: number) => invoices.find((i) => i.id === id),
  getByCustomer: (customerId: number) => invoices.filter((i) => i.customerId === customerId),
  getByOrder: (orderId: number) => invoices.filter((i) => i.orderId === orderId),
  getByStatus: (status: string) => invoices.filter((i) => i.status === status),
  getOverdue: () => invoices.filter((i) => i.status === "sent" && i.dueDate && new Date(i.dueDate) < new Date()),
  getPending: () => invoices.filter((i) => i.status === "draft" || i.status === "sent"),
  getPaid: () => invoices.filter((i) => i.status === "paid"),
  getByDate: (date: string) => invoices.filter((i) => i.invoiceDate === date),
  getBySalesRep: (repName: string) => invoices.filter((i) => i.salesRepName === repName),
  getStats: () => {
    const total = invoices.length;
    const draft = invoices.filter((i) => i.status === "draft").length;
    const sent = invoices.filter((i) => i.status === "sent").length;
    const paid = invoices.filter((i) => i.status === "paid").length;
    const overdue = invoices.filter((i) => i.status === "sent" && i.dueDate && new Date(i.dueDate) < new Date()).length;
    const cancelled = invoices.filter((i) => i.status === "cancelled").length;
    const totalValue = invoices.reduce((sum, i) => sum + (i.total || 0), 0);
    const totalPaid = invoices.reduce((sum, i) => sum + (i.amountPaid || 0), 0);
    const totalDue = invoices.reduce((sum, i) => sum + (i.balanceDue || 0), 0);
    return { total, draft, sent, paid, overdue, cancelled, totalValue, totalPaid, totalDue };
  },
  create: (data: any) => {
    const newInvoice = {
      id: Date.now() + Math.random(),
      invoiceNumber: getNextInvoiceNumber(),
      ...data,
      status: data.status || "draft",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    invoices.push(newInvoice);
    saveItem("sgf_invoices", invoices);
    logAudit("create", "invoice", newInvoice.id, data);
    return newInvoice;
  },
  update: (id: number, data: any) => {
    const index = invoices.findIndex((i) => i.id === id);
    if (index === -1) return null;
    invoices[index] = { ...invoices[index], ...data, updatedAt: new Date().toISOString() };
    saveItem("sgf_invoices", invoices);
    logAudit("update", "invoice", id, data);
    return invoices[index];
  },
  delete: (id: number) => {
    const index = invoices.findIndex((i) => i.id === id);
    if (index === -1) return { success: false, error: "Invoice not found" };
    invoices.splice(index, 1);
    saveItem("sgf_invoices", invoices);
    logAudit("delete", "invoice", id, {});
    return { success: true };
  },
};
