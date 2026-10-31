// =============================================================================
// USER SERVICE
// =============================================================================

export const userService = {
  list: () => users,
  getById: (id: number) => users.find((u) => u.id === id),
  getByName: (name: string) => users.find((u) => u.name.toLowerCase() === name.toLowerCase()),
  getByEmail: (email: string) => users.find((u) => u.email?.toLowerCase() === email.toLowerCase()),
  create: (data: any) => {
    const newUser = {
      id: Date.now() + Math.random(),
      ...data,
      isActive: data.isActive !== false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    users.push(newUser);
    saveItem("sgf_users", users);
    logAudit("create", "user", newUser.id, data);
    return newUser;
  },
  update: (id: number, data: any) => {
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
    users.splice(index, 1);
    saveItem("sgf_users", users);
    logAudit("delete", "user", id, {});
    return { success: true };
  },
  getByRole: (role: string) => users.filter((u) => u.role === role),
  getActive: () => users.filter((u) => u.isActive !== false),
  getInactive: () => users.filter((u) => u.isActive === false),
};

// =============================================================================
// SALES REP SERVICE
// =============================================================================

export const salesRepService = {
  list: () => SALES_REPS,
  getByName: (name: string) => SALES_REPS.find((r) => r.name.toLowerCase() === name.toLowerCase()),
  create: (data: any) => {
    const existing = SALES_REPS.find((r) => r.name.toLowerCase() === (data.name || "").toLowerCase());
    if (existing) return existing;
    const newRep = {
      id: Date.now() + Math.random(),
      ...data,
      isActive: data.isActive !== false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    SALES_REPS.push(newRep);
    saveSalesReps();
    logAudit("create", "salesRep", newRep.id, data);
    return newRep;
  },
  update: (id: number, data: any) => {
    const index = SALES_REPS.findIndex((r) => r.id === id);
    if (index === -1) return null;
    SALES_REPS[index] = { ...SALES_REPS[index], ...data, updatedAt: new Date().toISOString() };
    saveSalesReps();
    logAudit("update", "salesRep", id, data);
    return SALES_REPS[index];
  },
  delete: (id: number) => {
    const index = SALES_REPS.findIndex((r) => r.id === id);
    if (index === -1) return { success: false, error: "Sales rep not found" };
    SALES_REPS.splice(index, 1);
    saveSalesReps();
    logAudit("delete", "salesRep", id, {});
    return { success: true };
  },
  getActive: () => SALES_REPS.filter((r) => r.isActive !== false),
  getInactive: () => SALES_REPS.filter((r) => r.isActive === false),
};

// =============================================================================
// STOCK / INVENTORY SERVICE
// =============================================================================

export const stockService = {
  list: () => products,
  getById: (id: number) => products.find((p) => p.id === id),
  getByCode: (code: string) => products.find((p) => p.productCode === code),
  getByName: (name: string) => products.find((p) => p.productName.toLowerCase() === name.toLowerCase()),
  adjustStock: (productId: number, quantity: number, reason: string) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return { success: false, error: "Product not found" };
    product.quantity = (product.quantity || 0) + quantity;
    product.updatedAt = new Date().toISOString();
    saveItem("sgf_products", products);
    logAudit("adjustStock", "product", productId, { quantity, reason, newQuantity: product.quantity });
    return { success: true, product };
  },
  setStock: (productId: number, quantity: number) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return { success: false, error: "Product not found" };
    product.quantity = quantity;
    product.updatedAt = new Date().toISOString();
    saveItem("sgf_products", products);
    logAudit("setStock", "product", productId, { quantity });
    return { success: true, product };
  },
  getStockValue: () => {
    return products.reduce((total, p) => total + (p.quantity || 0) * (p.costPrice || 0), 0);
  },
  getLowStock: () => products.filter((p) => (p.quantity || 0) <= (p.reorderLevel || 10)),
  getOutOfStock: () => products.filter((p) => (p.quantity || 0) <= 0),
  getTopSelling: (limit: number = 10) => {
    const productSales = new Map<number, number>();
    for (const order of orders) {
      if (order.items && Array.isArray(order.items)) {
        for (const item of order.items) {
          const current = productSales.get(item.stockItemId) || 0;
          productSales.set(item.stockItemId, current + item.quantity);
        }
      }
    }
    const sorted = Array.from(productSales.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);
    return sorted.map(([id, qty]) => {
      const product = products.find((p) => p.id === id);
      return { product, quantitySold: qty };
    });
  },
};

// =============================================================================
// REPORTING SERVICE
// =============================================================================

export const reportingService = {
  getSalesSummary: (startDate?: string, endDate?: string) => {
    let filtered = orders;
    if (startDate) filtered = filtered.filter((o) => o.orderDate >= startDate);
    if (endDate) filtered = filtered.filter((o) => o.orderDate <= endDate);
    const totalSales = filtered.reduce((sum, o) => sum + (o.total || 0), 0);
    const totalOrders = filtered.length;
    const totalItems = filtered.reduce((sum, o) => sum + (o.items?.length || 0), 0);
    return { totalSales, totalOrders, totalItems, orders: filtered };
  },
  getInvoiceSummary: (startDate?: string, endDate?: string) => {
    let filtered = invoices;
    if (startDate) filtered = filtered.filter((i) => i.invoiceDate >= startDate);
    if (endDate) filtered = filtered.filter((i) => i.invoiceDate <= endDate);
    const totalInvoiced = filtered.reduce((sum, i) => sum + (i.total || 0), 0);
    const totalPaid = filtered.reduce((sum, i) => sum + (i.amountPaid || 0), 0);
    const totalDue = filtered.reduce((sum, i) => sum + (i.balanceDue || 0), 0);
    return { totalInvoiced, totalPaid, totalDue, invoices: filtered };
  },
  getCustomerSummary: () => {
    return customers.map((c) => {
      const customerOrders = orders.filter((o) => o.customerId === c.id);
      const customerInvoices = invoices.filter((i) => i.customerId === c.id);
      const totalSpent = customerOrders.reduce((sum, o) => sum + (o.total || 0), 0);
      const totalInvoiced = customerInvoices.reduce((sum, i) => sum + (i.total || 0), 0);
      const totalPaid = customerInvoices.reduce((sum, i) => sum + (i.amountPaid || 0), 0);
      const balanceDue = totalInvoiced - totalPaid;
      return { customer: c, totalSpent, totalInvoiced, totalPaid, balanceDue, orderCount: customerOrders.length };
    });
  },
  getSalesRepSummary: () => {
    return SALES_REPS.map((r) => {
      const repOrders = orders.filter((o) => o.salesRepName === r.name);
      const repInvoices = invoices.filter((i) => i.salesRepName === r.name);
      const totalSales = repOrders.reduce((sum, o) => sum + (o.total || 0), 0);
      const totalInvoiced = repInvoices.reduce((sum, i) => sum + (i.total || 0), 0);
      return { rep: r, totalSales, totalInvoiced, orderCount: repOrders.length, invoiceCount: repInvoices.length };
    });
  },
  getProductSummary: () => {
    const productSales = new Map<number, { quantity: number; revenue: number }>();
    for (const order of orders) {
      if (order.items && Array.isArray(order.items)) {
        for (const item of order.items) {
          const current = productSales.get(item.stockItemId) || { quantity: 0, revenue: 0 };
          current.quantity += item.quantity;
          current.revenue += (item.price || 0) * item.quantity;
          productSales.set(item.stockItemId, current);
        }
      }
    }
    return products.map((p) => {
      const sales = productSales.get(p.id) || { quantity: 0, revenue: 0 };
      return { product: p, ...sales };
    });
  },
  getMonthlySales: () => {
    const monthly = new Map<string, number>();
    for (const order of orders) {
      const month = order.orderDate?.slice(0, 7) || "unknown";
      monthly.set(month, (monthly.get(month) || 0) + (order.total || 0));
    }
    return Array.from(monthly.entries()).sort().map(([month, total]) => ({ month, total }));
  },
  getDailySales: (date: string) => {
    const dailyOrders = orders.filter((o) => o.orderDate === date);
    const total = dailyOrders.reduce((sum, o) => sum + (o.total || 0), 0);
    return { date, total, orders: dailyOrders };
  },
};

// =============================================================================
// UTILITY / EXPORT HELPERS
// =============================================================================

export function exportToCSV(data: any[], filename: string): void {
  if (!data || data.length === 0) return;
  const headers = Object.keys(data[0]);
  const rows = data.map((row) =>
    headers.map((h) => {
      const val = row[h];
      if (val == null) return "";
      const str = String(val);
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }).join(",")
  );
  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format(amount);
}

export function formatDate(date: string | Date): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-ZA");
}

export function formatDateTime(date: string | Date): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("en-ZA");
}

export function generateId(): number {
  return Date.now() + Math.random();
}

export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

export function sanitizeString(str: string): string {
  return str.replace(/[<>'"]/g, "");
}

export function truncate(str: string, length: number): string {
  if (!str || str.length <= length) return str;
  return str.slice(0, length) + "...";
}

export function groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
  return array.reduce((groups, item) => {
    const groupKey = String(item[key]);
    if (!groups[groupKey]) groups[groupKey] = [];
    groups[groupKey].push(item);
    return groups;
  }, {} as Record<string, T[]>);
}

export function sortBy<T>(array: T[], key: keyof T, direction: "asc" | "desc" = "asc"): T[] {
  return [...array].sort((a, b) => {
    const aVal = a[key];
    const bVal = b[key];
    if (aVal < bVal) return direction === "asc" ? -1 : 1;
    if (aVal > bVal) return direction === "asc" ? 1 : -1;
    return 0;
  });
}

export function filterByDateRange<T extends { date?: string }>(array: T[], startDate?: string, endDate?: string): T[] {
  return array.filter((item) => {
    if (startDate && item.date && item.date < startDate) return false;
    if (endDate && item.date && item.date > endDate) return false;
    return true;
  });
}

export function calculatePercentage(part: number, whole: number): number {
  if (whole === 0) return 0;
  return Math.round((part / whole) * 100);
}

export function calculateAverage(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  return numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
}

export function calculateMedian(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export function calculateStandardDeviation(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  const avg = calculateAverage(numbers);
  const variance = numbers.reduce((sum, n) => sum + Math.pow(n - avg, 2), 0) / numbers.length;
  return Math.sqrt(variance);
}
