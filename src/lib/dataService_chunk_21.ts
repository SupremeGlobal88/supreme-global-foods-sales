// =============================================================================
// ANALYTICS / CHART DATA SERVICE
// =============================================================================

export const analyticsService = {
  getSalesTrend: (period: "daily" | "weekly" | "monthly" = "monthly", count: number = 12) => {
    const now = new Date();
    const data: Array<{ label: string; value: number }> = [];
    for (let i = count - 1; i >= 0; i--) {
      const d = new Date(now);
      if (period === "daily") d.setDate(d.getDate() - i);
      else if (period === "weekly") d.setDate(d.getDate() - i * 7);
      else d.setMonth(d.getMonth() - i);
      const label = period === "daily"
        ? d.toISOString().slice(0, 10)
        : period === "weekly"
        ? `W${getWeekNumber(d)}`
        : d.toISOString().slice(0, 7);
      const value = orders
        .filter((o) => {
          const od = o.orderDate?.slice(0, period === "daily" ? 10 : period === "weekly" ? 4 : 7);
          return od === label;
        })
        .reduce((sum, o) => sum + (o.total || 0), 0);
      data.push({ label, value });
    }
    return data;
  },
  getTopCustomers: (limit: number = 10) => {
    const customerSales = new Map<number, number>();
    for (const order of orders) {
      const current = customerSales.get(order.customerId) || 0;
      customerSales.set(order.customerId, current + (order.total || 0));
    }
    return Array.from(customerSales.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([id, sales]) => ({ customer: customers.find((c) => c.id === id), sales }));
  },
  getTopProducts: (limit: number = 10) => {
    const productSales = new Map<number, number>();
    for (const order of orders) {
      if (order.items) {
        for (const item of order.items) {
          const current = productSales.get(item.stockItemId) || 0;
          productSales.set(item.stockItemId, current + item.quantity);
        }
      }
    }
    return Array.from(productSales.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([id, qty]) => ({ product: products.find((p) => p.id === id), quantity: qty }));
  },
  getSalesRepPerformance: () => {
    return SALES_REPS.map((rep) => {
      const repOrders = orders.filter((o) => o.salesRepName === rep.name);
      const repInvoices = invoices.filter((i) => i.salesRepName === rep.name);
      return {
        rep,
        orderCount: repOrders.length,
        orderValue: repOrders.reduce((sum, o) => sum + (o.total || 0), 0),
        invoiceCount: repInvoices.length,
        invoiceValue: repInvoices.reduce((sum, i) => sum + (i.total || 0), 0),
        averageOrderValue: repOrders.length > 0 ? Math.round((repOrders.reduce((sum, o) => sum + (o.total || 0), 0) / repOrders.length) * 100) / 100 : 0,
      };
    });
  },
  getCustomerAcquisition: (period: "daily" | "weekly" | "monthly" = "monthly", count: number = 12) => {
    const now = new Date();
    const data: Array<{ label: string; value: number }> = [];
    for (let i = count - 1; i >= 0; i--) {
      const d = new Date(now);
      if (period === "daily") d.setDate(d.getDate() - i);
      else if (period === "weekly") d.setDate(d.getDate() - i * 7);
      else d.setMonth(d.getMonth() - i);
      const label = period === "daily"
        ? d.toISOString().slice(0, 10)
        : period === "weekly"
        ? `W${getWeekNumber(d)}`
        : d.toISOString().slice(0, 7);
      const value = customers.filter((c) => c.createdAt?.startsWith(label)).length;
      data.push({ label, value });
    }
    return data;
  },
  getStockTurnover: () => {
    const productSales = new Map<number, number>();
    for (const order of orders) {
      if (order.items) {
        for (const item of order.items) {
          const current = productSales.get(item.stockItemId) || 0;
          productSales.set(item.stockItemId, current + item.quantity);
        }
      }
    }
    return products.map((p) => {
      const sold = productSales.get(p.id) || 0;
      const stock = p.quantity || 0;
      return {
        product: p,
        sold,
        stock,
        turnover: stock > 0 ? Math.round((sold / stock) * 100) / 100 : 0,
      };
    });
  },
};

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

// =============================================================================
// MOBILE / OFFLINE SERVICE
// =============================================================================

export const mobileService = {
  isOnline: () => typeof navigator !== "undefined" && navigator.onLine,
  getConnectionType: () => {
    if (typeof navigator === "undefined") return "unknown";
    const conn = (navigator as any).connection;
    if (conn) return conn.effectiveType || "unknown";
    return "unknown";
  },
  saveForOffline: (key: string, data: any) => {
    setStorageItem(`sgf_offline_${key}`, JSON.stringify(data));
    return { success: true };
  },
  getOfflineData: (key: string) => {
    try {
      const raw = getStorageItem(`sgf_offline_${key}`);
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return null;
  },
  clearOfflineData: (key: string) => {
    removeStorageItem(`sgf_offline_${key}`);
    return { success: true };
  },
  queueForSync: (action: string, data: any) => {
    try {
      const queue = JSON.parse(getStorageItem("sgf_syncQueue") || "[]");
      queue.push({ action, data, timestamp: new Date().toISOString() });
      setStorageItem("sgf_syncQueue", JSON.stringify(queue));
      return { success: true };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  },
  getSyncQueue: () => {
    try {
      return JSON.parse(getStorageItem("sgf_syncQueue") || "[]");
    } catch { /* ignore */ }
    return [];
  },
  clearSyncQueue: () => {
    removeStorageItem("sgf_syncQueue");
    return { success: true };
  },
};

// =============================================================================
// GEOLOCATION / MAP SERVICE
// =============================================================================

export const geoService = {
  getCustomerLocation: (customerId: number) => {
    const customer = customers.find((c) => c.id === customerId);
    return customer?.location || null;
  },
  setCustomerLocation: (customerId: number, lat: number, lng: number) => {
    const customer = customers.find((c) => c.id === customerId);
    if (!customer) return { success: false, error: "Customer not found" };
    customer.location = { lat, lng };
    customer.updatedAt = new Date().toISOString();
    saveItem("sgf_customers", customers);
    return { success: true };
  },
  getCurrentPosition: (): Promise<{ lat: number; lng: number } | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null)
      );
    });
  },
};

// =============================================================================
// NOTIFICATION / ALERT SERVICE
// =============================================================================

export const alertService = {
  getAlerts: () => {
    const alerts: Array<{ type: string; message: string; severity: string }> = [];
    // Low stock alerts
    const lowStock = products.filter((p) => (p.quantity || 0) <= (p.reorderLevel || 10));
    for (const product of lowStock) {
      alerts.push({
        type: "low_stock",
        message: `${product.productName} is low on stock (${product.quantity} remaining)`,
        severity: product.quantity === 0 ? "critical" : "warning",
      });
    }
    // Overdue invoice alerts
    const now = new Date();
    const overdue = invoices.filter((i) => i.status === "sent" && i.dueDate && new Date(i.dueDate) < now);
    for (const invoice of overdue) {
      alerts.push({
        type: "overdue_invoice",
        message: `Invoice ${invoice.invoiceNumber} is overdue`,
        severity: "warning",
      });
    }
    // Overdue follow-up alerts
    const overdueFollowUps = followUps.filter((f) => new Date(f.dueDate) < now && f.status !== "completed" && f.status !== "cancelled");
    for (const followUp of overdueFollowUps) {
      alerts.push({
        type: "overdue_followup",
        message: `Follow-up for ${getCustomerName(followUp.customerId)} is overdue`,
        severity: "warning",
      });
    }
    // Overdue appointment alerts
    const overdueAppointments = appointments.filter((a) => new Date(a.date) < now && a.status !== "completed" && a.status !== "cancelled");
    for (const appt of overdueAppointments) {
      alerts.push({
        type: "overdue_appointment",
        message: `Appointment with ${getCustomerName(appt.customerId)} is overdue`,
        severity: "info",
      });
    }
    return alerts;
  },
};

// =============================================================================
// SCHEDULED TASK / CRON SERVICE
// =============================================================================

export const scheduledTaskService = {
  getTasks: () => {
    try {
      const raw = getStorageItem("sgf_scheduledTasks");
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return [];
  },
  createTask: (data: any) => {
    const tasks = scheduledTaskService.getTasks();
    const newTask = {
      id: Date.now() + Math.random(),
      ...data,
      lastRun: null,
      nextRun: data.nextRun || new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    tasks.push(newTask);
    setStorageItem("sgf_scheduledTasks", JSON.stringify(tasks));
    return newTask;
  },
  updateTask: (id: number, data: any) => {
    const tasks = scheduledTaskService.getTasks();
    const index = tasks.findIndex((t: any) => t.id === id);
    if (index === -1) return null;
    tasks[index] = { ...tasks[index], ...data, updatedAt: new Date().toISOString() };
    setStorageItem("sgf_scheduledTasks", JSON.stringify(tasks));
    return tasks[index];
  },
  deleteTask: (id: number) => {
    const tasks = scheduledTaskService.getTasks();
    const index = tasks.findIndex((t: any) => t.id === id);
    if (index === -1) return { success: false, error: "Task not found" };
    tasks.splice(index, 1);
    setStorageItem("sgf_scheduledTasks", JSON.stringify(tasks));
    return { success: true };
  },
  runTask: (id: number) => {
    const tasks = scheduledTaskService.getTasks();
    const task = tasks.find((t: any) => t.id === id);
    if (!task) return { success: false, error: "Task not found" };
    task.lastRun = new Date().toISOString();
    task.nextRun = new Date(Date.now() + (task.interval || 86400000)).toISOString();
    setStorageItem("sgf_scheduledTasks", JSON.stringify(tasks));
    return { success: true, task };
  },
};
