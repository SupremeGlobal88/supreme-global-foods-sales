// =============================================================================
// PRODUCT SERVICE
// =============================================================================

export const productService = {
  list: (company?: string) => {
    const comp = company || getCurrentCompany();
    return products.filter((p) => p.company === comp);
  },
  getById: (id: number) => {
    return products.find((p) => p.id === id);
  },
  getByCode: (code: string) => {
    return products.find((p) => p.code === code);
  },
  getByName: (name: string) => {
    return products.find((p) => p.name.toLowerCase() === name.toLowerCase());
  },
  getByCategory: (category: string) => {
    const comp = getCurrentCompany();
    return products.filter((p) => p.company === comp && p.category === category);
  },
  create: (data: Partial<Product>) => {
    const comp = getCurrentCompany();
    const newProduct: Product = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      name: data.name || "",
      code: data.code || `PRD-${Date.now()}`,
      company: comp,
      unitPrice: data.unitPrice || 0,
      status: data.status || "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...data,
    };
    products.push(newProduct);
    saveItem("sgf_products", products);
    logAudit("create", "product", newProduct.id, data);
    return newProduct;
  },
  update: (id: number, data: Partial<Product>) => {
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
    const product = products[index];
    products.splice(index, 1);
    saveItem("sgf_products", products);
    logAudit("delete", "product", id, { name: product.name });
    return { success: true };
  },
  adjustStock: (id: number, quantity: number, reason?: string) => {
    const product = products.find((p) => p.id === id);
    if (!product) return { success: false, error: "Product not found" };
    const oldStock = product.stockQuantity || 0;
    product.stockQuantity = oldStock + quantity;
    product.updatedAt = new Date().toISOString();
    saveItem("sgf_products", products);
    const adjustment: StockAdjustment = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      productId: id,
      productName: product.name,
      company: product.company,
      adjustmentType: quantity >= 0 ? "in" : "out",
      quantity: Math.abs(quantity),
      reason: reason || "Manual adjustment",
      createdAt: new Date().toISOString(),
    };
    stockAdjustments.push(adjustment);
    saveItem("sgf_stockAdjustments", stockAdjustments);
    logAudit("adjust_stock", "product", id, { oldStock, adjustment: quantity, newStock: product.stockQuantity, reason });
    return { success: true, product };
  },
  getLowStock: () => {
    const comp = getCurrentCompany();
    return products.filter((p) => p.company === comp && p.status === "active" && (p.stockQuantity || 0) <= (p.reorderLevel || 0));
  },
  getStats: () => {
    const comp = getCurrentCompany();
    const companyProducts = products.filter((p) => p.company === comp);
    return {
      total: companyProducts.length,
      active: companyProducts.filter((p) => p.status === "active").length,
      inactive: companyProducts.filter((p) => p.status === "inactive").length,
      discontinued: companyProducts.filter((p) => p.status === "discontinued").length,
      lowStock: companyProducts.filter((p) => (p.stockQuantity || 0) <= (p.reorderLevel || 0)).length,
      totalValue: companyProducts.reduce((sum, p) => sum + (p.stockQuantity || 0) * (p.costPrice || p.unitPrice), 0),
      categories: [...new Set(companyProducts.map((p) => p.category).filter(Boolean))],
    };
  },
  search: (query: string) => {
    const comp = getCurrentCompany();
    const q = query.toLowerCase();
    return products.filter(
      (p) =>
        p.company === comp &&
        (p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q) || p.barcode?.includes(q) || p.sku?.toLowerCase().includes(q) || p.category?.toLowerCase().includes(q))
    );
  },
  getCategories: () => {
    const comp = getCurrentCompany();
    return [...new Set(products.filter((p) => p.company === comp).map((p) => p.category).filter(Boolean))];
  },
  getTopProducts: (limit = 10) => {
    const comp = getCurrentCompany();
    const productSales = new Map<number, { quantity: number; revenue: number }>();
    orders.filter((o) => o.company === comp).forEach((o) => {
      o.items.forEach((item) => {
        const existing = productSales.get(item.productId) || { quantity: 0, revenue: 0 };
        existing.quantity += item.quantity;
        existing.revenue += item.total;
        productSales.set(item.productId, existing);
      });
    });
    return products
      .filter((p) => p.company === comp)
      .map((p) => ({ ...p, sales: productSales.get(p.id) || { quantity: 0, revenue: 0 } }))
      .sort((a, b) => b.sales.revenue - a.sales.revenue)
      .slice(0, limit);
  },
};

// =============================================================================
// INVOICE SERVICE
// =============================================================================

export const invoiceService = {
  list: (company?: string) => {
    const comp = company || getCurrentCompany();
    return invoices.filter((i) => i.company === comp);
  },
  getById: (id: number) => {
    return invoices.find((i) => i.id === id);
  },
  getByInvoiceNumber: (invoiceNumber: string) => {
    return invoices.find((i) => i.invoiceNumber === invoiceNumber);
  },
  getByOrder: (orderId: number) => {
    return invoices.filter((i) => i.orderId === orderId);
  },
  getByCustomer: (customerId: number) => {
    return invoices.filter((i) => i.customerId === customerId);
  },
  getByStatus: (status: string) => {
    const comp = getCurrentCompany();
    return invoices.filter((i) => i.company === comp && i.status === status);
  },
  create: (data: Partial<Invoice>) => {
    const comp = getCurrentCompany();
    const newInvoice: Invoice = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      invoiceNumber: data.invoiceNumber || generateInvoiceNumber(),
      customerId: data.customerId || 0,
      customerName: data.customerName || "",
      company: comp,
      invoiceDate: data.invoiceDate || new Date().toISOString(),
      status: data.status || "draft",
      items: data.items || [],
      subtotal: data.subtotal || 0,
      discount: data.discount || 0,
      tax: data.tax || 0,
      total: data.total || 0,
      amountPaid: data.amountPaid || 0,
      balanceDue: data.balanceDue !== undefined ? data.balanceDue : data.total || 0,
      currency: data.currency || "ZAR",
      notes: data.notes,
      paymentTerms: data.paymentTerms,
      poNumber: data.poNumber,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isProforma: data.isProforma,
      isCreditNote: data.isCreditNote,
      parentInvoiceId: data.parentInvoiceId,
    };
    invoices.push(newInvoice);
    saveItem("sgf_invoices", invoices);
    logAudit("create", "invoice", newInvoice.id, data);
    return newInvoice;
  },
  update: (id: number, data: Partial<Invoice>) => {
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
    const invoice = invoices[index];
    invoices.splice(index, 1);
    saveItem("sgf_invoices", invoices);
    logAudit("delete", "invoice", id, { invoiceNumber: invoice.invoiceNumber });
    return { success: true };
  },
  markAsSent: (id: number) => {
    return invoiceService.update(id, { status: "sent" });
  },
  markAsPaid: (id: number) => {
    const invoice = invoices.find((i) => i.id === id);
    if (!invoice) return null;
    return invoiceService.update(id, { status: "paid", amountPaid: invoice.total, balanceDue: 0 });
  },
  recordPayment: (id: number, amount: number, method: string, reference?: string) => {
    const invoice = invoices.find((i) => i.id === id);
    if (!invoice) return { success: false, error: "Invoice not found" };
    const newAmountPaid = invoice.amountPaid + amount;
    const newBalanceDue = invoice.total - newAmountPaid;
    const newStatus = newBalanceDue <= 0 ? "paid" : newAmountPaid > 0 ? "partial" : invoice.status;
    invoiceService.update(id, { amountPaid: newAmountPaid, balanceDue: Math.max(0, newBalanceDue), status: newStatus });
    const receipt: Receipt = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      receiptNumber: generateReceiptNumber(),
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      customerId: invoice.customerId,
      customerName: invoice.customerName,
      company: invoice.company,
      amount,
      currency: invoice.currency,
      paymentDate: new Date().toISOString(),
      paymentMethod: method,
      reference,
      status: "completed",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    receipts.push(receipt);
    saveItem("sgf_receipts", receipts);
    logAudit("payment", "invoice", id, { amount, method, reference });
    return { success: true, receipt };
  },
  getOverdue: () => {
    const comp = getCurrentCompany();
    const now = new Date().toISOString();
    return invoices.filter((i) => i.company === comp && i.status !== "paid" && i.status !== "cancelled" && i.dueDate && i.dueDate < now);
  },
  getStats: () => {
    const comp = getCurrentCompany();
    const companyInvoices = invoices.filter((i) => i.company === comp);
    return {
      total: companyInvoices.length,
      draft: companyInvoices.filter((i) => i.status === "draft").length,
      sent: companyInvoices.filter((i) => i.status === "sent").length,
      paid: companyInvoices.filter((i) => i.status === "paid").length,
      overdue: companyInvoices.filter((i) => i.status === "overdue").length,
      partial: companyInvoices.filter((i) => i.status === "partial").length,
      cancelled: companyInvoices.filter((i) => i.status === "cancelled").length,
      totalValue: companyInvoices.reduce((sum, i) => sum + i.total, 0),
      totalPaid: companyInvoices.reduce((sum, i) => sum + i.amountPaid, 0),
      totalOutstanding: companyInvoices.reduce((sum, i) => sum + i.balanceDue, 0),
    };
  },
  search: (query: string) => {
    const comp = getCurrentCompany();
    const q = query.toLowerCase();
    return invoices.filter(
      (i) =>
        i.company === comp &&
        (i.invoiceNumber.toLowerCase().includes(q) ||
          i.customerName.toLowerCase().includes(q) ||
          i.orderNumber?.toLowerCase().includes(q) ||
          i.poNumber?.toLowerCase().includes(q))
    );
  },
  getAgingReport: () => {
    const comp = getCurrentCompany();
    const now = new Date();
    const buckets = { current: 0, days1to30: 0, days31to60: 0, days61to90: 0, over90: 0 };
    invoices
      .filter((i) => i.company === comp && i.status !== "paid" && i.status !== "cancelled")
      .forEach((i) => {
        const dueDate = i.dueDate ? new Date(i.dueDate) : now;
        const daysDiff = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        if (daysDiff <= 0) buckets.current += i.balanceDue;
        else if (daysDiff <= 30) buckets.days1to30 += i.balanceDue;
        else if (daysDiff <= 60) buckets.days31to60 += i.balanceDue;
        else if (daysDiff <= 90) buckets.days61to90 += i.balanceDue;
        else buckets.over90 += i.balanceDue;
      });
    return buckets;
  },
};

// =============================================================================
// RECEIPT SERVICE
// =============================================================================

export const receiptService = {
  list: (company?: string) => {
    const comp = company || getCurrentCompany();
    return receipts.filter((r) => r.company === comp);
  },
  getById: (id: number) => {
    return receipts.find((r) => r.id === id);
  },
  getByReceiptNumber: (receiptNumber: string) => {
    return receipts.find((r) => r.receiptNumber === receiptNumber);
  },
  getByInvoice: (invoiceId: number) => {
    return receipts.filter((r) => r.invoiceId === invoiceId);
  },
  getByCustomer: (customerId: number) => {
    return receipts.filter((r) => r.customerId === customerId);
  },
  create: (data: Partial<Receipt>) => {
    const comp = getCurrentCompany();
    const newReceipt: Receipt = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      receiptNumber: data.receiptNumber || generateReceiptNumber(),
      customerId: data.customerId || 0,
      customerName: data.customerName || "",
      company: comp,
      amount: data.amount || 0,
      currency: data.currency || "ZAR",
      paymentDate: data.paymentDate || new Date().toISOString(),
      paymentMethod: data.paymentMethod || "cash",
      reference: data.reference,
      notes: data.notes,
      status: data.status || "completed",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    receipts.push(newReceipt);
    saveItem("sgf_receipts", receipts);
    logAudit("create", "receipt", newReceipt.id, data);
    return newReceipt;
  },
  update: (id: number, data: Partial<Receipt>) => {
    const index = receipts.findIndex((r) => r.id === id);
    if (index === -1) return null;
    receipts[index] = { ...receipts[index], ...data, updatedAt: new Date().toISOString() };
    saveItem("sgf_receipts", receipts);
    logAudit("update", "receipt", id, data);
    return receipts[index];
  },
  delete: (id: number) => {
    const index = receipts.findIndex((r) => r.id === id);
    if (index === -1) return { success: false, error: "Receipt not found" };
    const receipt = receipts[index];
    receipts.splice(index, 1);
    saveItem("sgf_receipts", receipts);
    logAudit("delete", "receipt", id, { receiptNumber: receipt.receiptNumber });
    return { success: true };
  },
  getStats: () => {
    const comp = getCurrentCompany();
    const companyReceipts = receipts.filter((r) => r.company === comp);
    return {
      total: companyReceipts.length,
      totalAmount: companyReceipts.reduce((sum, r) => sum + r.amount, 0),
      byMethod: companyReceipts.reduce((acc, r) => {
        acc[r.paymentMethod] = (acc[r.paymentMethod] || 0) + r.amount;
        return acc;
      }, {} as Record<string, number>),
      today: companyReceipts.filter((r) => r.paymentDate.startsWith(new Date().toISOString().split("T")[0])).reduce((sum, r) => sum + r.amount, 0),
      thisWeek: companyReceipts.filter((r) => {
        const paymentDate = new Date(r.paymentDate);
        const now = new Date();
        const weekStart = new Date(now.setDate(now.getDate() - now.getDay()));
        return paymentDate >= weekStart;
      }).reduce((sum, r) => sum + r.amount, 0),
      thisMonth: companyReceipts.filter((r) => r.paymentDate.startsWith(new Date().toISOString().slice(0, 7))).reduce((sum, r) => sum + r.amount, 0),
    };
  },
};

// =============================================================================
// USER SERVICE
// =============================================================================

export const userService = {
  list: () => {
    return users;
  },
  getById: (id: number) => {
    return users.find((u) => u.id === id);
  },
  getByEmail: (email: string) => {
    return users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  },
  getByName: (name: string) => {
    return users.find((u) => u.name.toLowerCase() === name.toLowerCase());
  },
  create: (data: Partial<User>) => {
    const newUser: User = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      name: data.name || "",
      email: data.email || "",
      role: data.role || "user",
      company: data.company || getCurrentCompany(),
      status: data.status || "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...data,
    };
    users.push(newUser);
    saveItem("sgf_users", users);
    logAudit("create", "user", newUser.id, data);
    return newUser;
  },
  update: (id: number, data: Partial<User>) => {
    const index = users.findIndex((u) => u.id === id);
    if (index === -1) return null;
    users[index] = { ...users[index], ...data, updatedAt: new Date().toISOString() };
    saveItem("sgf_users", users);
    logAudit("update", "user", id, data);
    return users[index];
  },
  delete: (id: number) => {
    const index = users.findIndex((u) => u.id === id);
    if (index === -1) return { success: false, error: "User not found" };
    const user = users[index];
    users.splice(index, 1);
    saveItem("sgf_users", users);
    logAudit("delete", "user", id, { name: user.name });
    return { success: true };
  },
  authenticate: (email: string, pin: string) => {
    const user = users.find((u) => u.email.toLowerCase() === email.toLowerCase() && u.pin === pin);
    if (user) {
      user.lastLogin = new Date().toISOString();
      userService.update(user.id, { lastLogin: user.lastLogin });
      logActivity("login", "user", user.id, { email });
      securityService.logLogin(user.id);
    }
    return user || null;
  },
  authenticateByPin: (pin: string) => {
    const user = users.find((u) => u.pin === pin);
    if (user) {
      user.lastLogin = new Date().toISOString();
      userService.update(user.id, { lastLogin: user.lastLogin });
      logActivity("login", "user", user.id, { method: "pin" });
      securityService.logLogin(user.id);
    }
    return user || null;
  },
  changePin: (id: number, oldPin: string, newPin: string) => {
    const user = users.find((u) => u.id === id);
    if (!user) return { success: false, error: "User not found" };
    if (user.pin !== oldPin) return { success: false, error: "Incorrect current PIN" };
    user.pin = newPin;
    user.updatedAt = new Date().toISOString();
    saveItem("sgf_users", users);
    logAudit("change_pin", "user", id, {});
    return { success: true };
  },
  resetPin: (id: number, newPin: string) => {
    const user = users.find((u) => u.id === id);
    if (!user) return { success: false, error: "User not found" };
    user.pin = newPin;
    user.updatedAt = new Date().toISOString();
    saveItem("sgf_users", users);
    logAudit("reset_pin", "user", id, {});
    return { success: true };
  },
  getStats: () => {
    return {
      total: users.length,
      active: users.filter((u) => u.status === "active").length,
      inactive: users.filter((u) => u.status === "inactive").length,
      suspended: users.filter((u) => u.status === "suspended").length,
      byRole: users.reduce((acc, u) => {
        acc[u.role] = (acc[u.role] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };
  },
};

// =============================================================================
// COMPANY SETTINGS SERVICE
// =============================================================================

export const companySettingsService = {
  list: () => {
    return companySettings;
  },
  getById: (id: number) => {
    return companySettings.find((s) => s.id === id);
  },
  getByCode: (code: string) => {
    return companySettings.find((s) => s.code === code);
  },
  getCurrent: () => {
    const comp = getCurrentCompany();
    return companySettings.find((s) => s.code === comp) || companySettings[0];
  },
  create: (data: Partial<CompanySettings>) => {
    const newSettings: CompanySettings = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      name: data.name || "",
      code: data.code || "",
      currency: data.currency || "ZAR",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...data,
    };
    companySettings.push(newSettings);
    saveItem("sgf_companySettings", companySettings);
    logAudit("create", "companySettings", newSettings.id, data);
    return newSettings;
  },
  update: (id: number, data: Partial<CompanySettings>) => {
    const index = companySettings.findIndex((s) => s.id === id);
    if (index === -1) return null;
    companySettings[index] = { ...companySettings[index], ...data, updatedAt: new Date().toISOString() };
    saveItem("sgf_companySettings", companySettings);
    logAudit("update", "companySettings", id, data);
    return companySettings[index];
  },
  delete: (id: number) => {
    const index = companySettings.findIndex((s) => s.id === id);
    if (index === -1) return { success: false, error: "Settings not found" };
    companySettings.splice(index, 1);
    saveItem("sgf_companySettings", companySettings);
    logAudit("delete", "companySettings", id, {});
    return { success: true };
  },
};
