// =============================================================================
// PAYMENT REMINDER SERVICE
// =============================================================================

export const paymentReminderService = {
  getOverdueInvoices: () => {
    const now = new Date();
    return invoices.filter((i) => {
      if (i.status !== "sent" && i.status !== "partial") return false;
      const due = new Date(i.dueDate || i.invoiceDate);
      return due < now;
    });
  },
  getUpcomingDue: (daysAhead: number = 7) => {
    const now = new Date();
    const future = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
    return invoices.filter((i) => {
      if (i.status !== "sent" && i.status !== "partial") return false;
      const due = new Date(i.dueDate || i.invoiceDate);
      return due >= now && due <= future;
    });
  },
  getCustomerBalance: (customerId: number) => {
    return invoices
      .filter((i) => i.customerId === customerId && (i.status === "sent" || i.status === "partial"))
      .reduce((sum, i) => sum + (i.balanceDue || 0), 0);
  },
  getCustomerTotalPaid: (customerId: number) => {
    return invoices
      .filter((i) => i.customerId === customerId)
      .reduce((sum, i) => sum + (i.amountPaid || 0), 0);
  },
  getCustomerTotalInvoiced: (customerId: number) => {
    return invoices
      .filter((i) => i.customerId === customerId)
      .reduce((sum, i) => sum + (i.total || 0), 0);
  },
};

// =============================================================================
// DASHBOARD SERVICE
// =============================================================================

export const dashboardService = {
  getStats: () => {
    const today = new Date().toISOString().slice(0, 10);
    const todayOrders = orders.filter((o) => o.orderDate === today);
    const todayInvoices = invoices.filter((i) => i.invoiceDate === today);
    const todayReceipts = receipts.filter((r) => r.receiptDate === today);

    return {
      today: {
        orders: todayOrders.length,
        orderValue: todayOrders.reduce((sum, o) => sum + (o.total || 0), 0),
        invoices: todayInvoices.length,
        invoiceValue: todayInvoices.reduce((sum, i) => sum + (i.total || 0), 0),
        receipts: todayReceipts.length,
        receiptValue: todayReceipts.reduce((sum, r) => sum + (r.amount || 0), 0),
      },
      total: {
        customers: customers.length,
        products: products.length,
        orders: orders.length,
        invoices: invoices.length,
        receipts: receipts.length,
        pendingOrders: orders.filter((o) => o.status === "pending" || o.status === "confirmed").length,
        overdueInvoices: invoices.filter((i) => i.status === "sent" && i.dueDate && new Date(i.dueDate) < new Date()).length,
        lowStockProducts: products.filter((p) => (p.quantity || 0) <= (p.reorderLevel || 10)).length,
        totalReceivables: invoices.reduce((sum, i) => sum + (i.balanceDue || 0), 0),
        totalRevenue: invoices.reduce((sum, i) => sum + (i.amountPaid || 0), 0),
      },
      salesReps: SALES_REPS.map((rep) => {
        const repOrders = orders.filter((o) => o.salesRepName === rep.name);
        const repInvoices = invoices.filter((i) => i.salesRepName === rep.name);
        return {
          name: rep.name,
          orders: repOrders.length,
          orderValue: repOrders.reduce((sum, o) => sum + (o.total || 0), 0),
          invoices: repInvoices.length,
          invoiceValue: repInvoices.reduce((sum, i) => sum + (i.total || 0), 0),
        };
      }),
    };
  },
  getActivityFeed: (limit: number = 20) => {
    const activities = [
      ...orders.map((o) => ({ type: "order" as const, date: o.createdAt, data: o })),
      ...invoices.map((i) => ({ type: "invoice" as const, date: i.createdAt, data: i })),
      ...receipts.map((r) => ({ type: "receipt" as const, date: r.createdAt, data: r })),
      ...appointments.map((a) => ({ type: "appointment" as const, date: a.createdAt, data: a })),
    ];
    return activities
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, limit);
  },
};

// =============================================================================
// NOTIFICATION SERVICE
// =============================================================================

export const notificationService = {
  getNotifications: () => {
    try {
      const raw = getStorageItem("sgf_notifications");
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return [];
  },
  addNotification: (title: string, message: string, type: string = "info") => {
    const notifications = notificationService.getNotifications();
    notifications.push({
      id: Date.now() + Math.random(),
      title,
      message,
      type,
      read: false,
      createdAt: new Date().toISOString(),
    });
    setStorageItem("sgf_notifications", JSON.stringify(notifications.slice(-100)));
    return notifications;
  },
  markAsRead: (id: number) => {
    const notifications = notificationService.getNotifications();
    const notification = notifications.find((n: any) => n.id === id);
    if (notification) notification.read = true;
    setStorageItem("sgf_notifications", JSON.stringify(notifications));
    return notifications;
  },
  markAllAsRead: () => {
    const notifications = notificationService.getNotifications();
    notifications.forEach((n: any) => (n.read = true));
    setStorageItem("sgf_notifications", JSON.stringify(notifications));
    return notifications;
  },
  clearAll: () => {
    setStorageItem("sgf_notifications", JSON.stringify([]));
    return [];
  },
};

// =============================================================================
// SETTING / CONFIG SERVICE
// =============================================================================

export const settingService = {
  get: (key: string, defaultValue?: any) => {
    try {
      const raw = getStorageItem(`sgf_setting_${key}`);
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return defaultValue;
  },
  set: (key: string, value: any) => {
    setStorageItem(`sgf_setting_${key}`, JSON.stringify(value));
    return value;
  },
  getAll: () => {
    const settings: Record<string, any> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("sgf_setting_")) {
        try {
          settings[key.replace("sgf_setting_", "")] = JSON.parse(localStorage.getItem(key) || "");
        } catch { /* ignore */ }
      }
    }
    return settings;
  },
};

// =============================================================================
// PRINT / PDF HELPERS
// =============================================================================

export function printInvoice(invoiceId: number): void {
  const invoice = invoices.find((i) => i.id === invoiceId);
  if (!invoice) return;
  const customer = customers.find((c) => c.id === invoice.customerId);
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;

  const itemsHtml = (invoice.items || [])
    .map(
      (item: any) => `
      <tr>
        <td>${getProductName(item.stockItemId)}</td>
        <td>${item.quantity}</td>
        <td>${formatCurrency(item.price || 0)}</td>
        <td>${formatCurrency((item.price || 0) * item.quantity)}</td>
      </tr>
    `
    )
    .join("");

  printWindow.document.write(`
    <html>
      <head><title>Invoice ${invoice.invoiceNumber}</title></head>
      <body>
        <h1>Supreme Global Foods</h1>
        <h2>Invoice ${invoice.invoiceNumber}</h2>
        <p><strong>Customer:</strong> ${customer?.name || "Unknown"}</p>
        <p><strong>Date:</strong> ${formatDate(invoice.invoiceDate)}</p>
        <p><strong>Due Date:</strong> ${formatDate(invoice.dueDate)}</p>
        <table border="1" cellpadding="5">
          <thead>
            <tr><th>Product</th><th>Qty</th><th>Price</th><th>Total</th></tr>
          </thead>
          <tbody>${itemsHtml}</tbody>
        </table>
        <h3>Total: ${formatCurrency(invoice.total || 0)}</h3>
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.print();
}

export function printOrder(orderId: number): void {
  const order = orders.find((o) => o.id === orderId);
  if (!order) return;
  const customer = customers.find((c) => c.id === order.customerId);
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;

  const itemsHtml = (order.items || [])
    .map(
      (item: any) => `
      <tr>
        <td>${getProductName(item.stockItemId)}</td>
        <td>${item.quantity}</td>
        <td>${formatCurrency(item.price || 0)}</td>
        <td>${formatCurrency((item.price || 0) * item.quantity)}</td>
      </tr>
    `
    )
    .join("");

  printWindow.document.write(`
    <html>
      <head><title>Order ${order.orderNumber}</title></head>
      <body>
        <h1>Supreme Global Foods</h1>
        <h2>Order ${order.orderNumber}</h2>
        <p><strong>Customer:</strong> ${customer?.name || "Unknown"}</p>
        <p><strong>Date:</strong> ${formatDate(order.orderDate)}</p>
        <p><strong>Status:</strong> ${getOrderStatusDisplay(order.status)}</p>
        <table border="1" cellpadding="5">
          <thead>
            <tr><th>Product</th><th>Qty</th><th>Price</th><th>Total</th></tr>
          </thead>
          <tbody>${itemsHtml}</tbody>
        </table>
        <h3>Total: ${formatCurrency(order.total || 0)}</h3>
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.print();
}
