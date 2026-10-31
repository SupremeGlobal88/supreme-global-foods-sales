// =============================================================================
// SUPPLIER / VENDOR SERVICE
// =============================================================================

export const supplierService = {
  list: () => {
    try {
      const raw = getStorageItem("sgf_suppliers");
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return [];
  },
  getById: (id: number) => {
    const suppliers = supplierService.list();
    return suppliers.find((s: any) => s.id === id);
  },
  getByName: (name: string) => {
    const suppliers = supplierService.list();
    return suppliers.find((s: any) => s.name?.toLowerCase() === name.toLowerCase());
  },
  create: (data: any) => {
    const suppliers = supplierService.list();
    const newSupplier = {
      id: Date.now() + Math.random(),
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isActive: data.isActive !== false,
    };
    suppliers.push(newSupplier);
    setStorageItem("sgf_suppliers", JSON.stringify(suppliers));
    logAudit("create", "supplier", newSupplier.id, data);
    return newSupplier;
  },
  update: (id: number, data: any) => {
    const suppliers = supplierService.list();
    const index = suppliers.findIndex((s: any) => s.id === id);
    if (index === -1) return null;
    suppliers[index] = { ...suppliers[index], ...data, updatedAt: new Date().toISOString() };
    setStorageItem("sgf_suppliers", JSON.stringify(suppliers));
    logAudit("update", "supplier", id, data);
    return suppliers[index];
  },
  delete: (id: number) => {
    const suppliers = supplierService.list();
    const index = suppliers.findIndex((s: any) => s.id === id);
    if (index === -1) return { success: false, error: "Supplier not found" };
    suppliers.splice(index, 1);
    setStorageItem("sgf_suppliers", JSON.stringify(suppliers));
    logAudit("delete", "supplier", id, {});
    return { success: true };
  },
};

// =============================================================================
// PURCHASE ORDER (SUPPLIER) SERVICE
// =============================================================================

export const supplierPOService = {
  list: () => {
    try {
      const raw = getStorageItem("sgf_supplierPOs");
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return [];
  },
  getById: (id: number) => {
    const pos = supplierPOService.list();
    return pos.find((p: any) => p.id === id);
  },
  getBySupplier: (supplierId: number) => {
    const pos = supplierPOService.list();
    return pos.filter((p: any) => p.supplierId === supplierId);
  },
  getByStatus: (status: string) => {
    const pos = supplierPOService.list();
    return pos.filter((p: any) => p.status === status);
  },
  create: (data: any) => {
    const pos = supplierPOService.list();
    const newPO = {
      id: Date.now() + Math.random(),
      ...data,
      status: data.status || "draft",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    pos.push(newPO);
    setStorageItem("sgf_supplierPOs", JSON.stringify(pos));
    logAudit("create", "supplierPO", newPO.id, data);
    return newPO;
  },
  update: (id: number, data: any) => {
    const pos = supplierPOService.list();
    const index = pos.findIndex((p: any) => p.id === id);
    if (index === -1) return null;
    pos[index] = { ...pos[index], ...data, updatedAt: new Date().toISOString() };
    setStorageItem("sgf_supplierPOs", JSON.stringify(pos));
    logAudit("update", "supplierPO", id, data);
    return pos[index];
  },
  delete: (id: number) => {
    const pos = supplierPOService.list();
    const index = pos.findIndex((p: any) => p.id === id);
    if (index === -1) return { success: false, error: "Supplier PO not found" };
    pos.splice(index, 1);
    setStorageItem("sgf_supplierPOs", JSON.stringify(pos));
    logAudit("delete", "supplierPO", id, {});
    return { success: true };
  },
};

// =============================================================================
// EXPENSE / COST SERVICE
// =============================================================================

export const expenseService = {
  list: () => {
    try {
      const raw = getStorageItem("sgf_expenses");
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return [];
  },
  getById: (id: number) => {
    const expenses = expenseService.list();
    return expenses.find((e: any) => e.id === id);
  },
  getByCategory: (category: string) => {
    const expenses = expenseService.list();
    return expenses.filter((e: any) => e.category === category);
  },
  getByDate: (date: string) => {
    const expenses = expenseService.list();
    return expenses.filter((e: any) => e.date === date);
  },
  create: (data: any) => {
    const expenses = expenseService.list();
    const newExpense = {
      id: Date.now() + Math.random(),
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    expenses.push(newExpense);
    setStorageItem("sgf_expenses", JSON.stringify(expenses));
    logAudit("create", "expense", newExpense.id, data);
    return newExpense;
  },
  update: (id: number, data: any) => {
    const expenses = expenseService.list();
    const index = expenses.findIndex((e: any) => e.id === id);
    if (index === -1) return null;
    expenses[index] = { ...expenses[index], ...data, updatedAt: new Date().toISOString() };
    setStorageItem("sgf_expenses", JSON.stringify(expenses));
    logAudit("update", "expense", id, data);
    return expenses[index];
  },
  delete: (id: number) => {
    const expenses = expenseService.list();
    const index = expenses.findIndex((e: any) => e.id === id);
    if (index === -1) return { success: false, error: "Expense not found" };
    expenses.splice(index, 1);
    setStorageItem("sgf_expenses", JSON.stringify(expenses));
    logAudit("delete", "expense", id, {});
    return { success: true };
  },
  getSummary: (startDate?: string, endDate?: string) => {
    let expenses = expenseService.list();
    if (startDate) expenses = expenses.filter((e: any) => e.date >= startDate);
    if (endDate) expenses = expenses.filter((e: any) => e.date <= endDate);
    const byCategory = new Map<string, number>();
    for (const e of expenses) {
      byCategory.set(e.category, (byCategory.get(e.category) || 0) + (e.amount || 0));
    }
    return {
      total: expenses.reduce((sum: number, e: any) => sum + (e.amount || 0), 0),
      count: expenses.length,
      byCategory: Array.from(byCategory.entries()).map(([category, amount]) => ({ category, amount })),
    };
  },
};

// =============================================================================
// INCOME / REVENUE SERVICE
// =============================================================================

export const incomeService = {
  list: () => {
    try {
      const raw = getStorageItem("sgf_income");
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return [];
  },
  getById: (id: number) => {
    const income = incomeService.list();
    return income.find((i: any) => i.id === id);
  },
  getByCategory: (category: string) => {
    const income = incomeService.list();
    return income.filter((i: any) => i.category === category);
  },
  getByDate: (date: string) => {
    const income = incomeService.list();
    return income.filter((i: any) => i.date === date);
  },
  create: (data: any) => {
    const income = incomeService.list();
    const newIncome = {
      id: Date.now() + Math.random(),
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    income.push(newIncome);
    setStorageItem("sgf_income", JSON.stringify(income));
    logAudit("create", "income", newIncome.id, data);
    return newIncome;
  },
  update: (id: number, data: any) => {
    const income = incomeService.list();
    const index = income.findIndex((i: any) => i.id === id);
    if (index === -1) return null;
    income[index] = { ...income[index], ...data, updatedAt: new Date().toISOString() };
    setStorageItem("sgf_income", JSON.stringify(income));
    logAudit("update", "income", id, data);
    return income[index];
  },
  delete: (id: number) => {
    const income = incomeService.list();
    const index = income.findIndex((i: any) => i.id === id);
    if (index === -1) return { success: false, error: "Income not found" };
    income.splice(index, 1);
    setStorageItem("sgf_income", JSON.stringify(income));
    logAudit("delete", "income", id, {});
    return { success: true };
  },
  getSummary: (startDate?: string, endDate?: string) => {
    let income = incomeService.list();
    if (startDate) income = income.filter((i: any) => i.date >= startDate);
    if (endDate) income = income.filter((i: any) => i.date <= endDate);
    const byCategory = new Map<string, number>();
    for (const i of income) {
      byCategory.set(i.category, (byCategory.get(i.category) || 0) + (i.amount || 0));
    }
    return {
      total: income.reduce((sum: number, i: any) => sum + (i.amount || 0), 0),
      count: income.length,
      byCategory: Array.from(byCategory.entries()).map(([category, amount]) => ({ category, amount })),
    };
  },
};

// =============================================================================
// PROFIT & LOSS SERVICE
// =============================================================================

export const profitLossService = {
  getReport: (startDate?: string, endDate?: string) => {
    const income = incomeService.getSummary(startDate, endDate);
    const expenses = expenseService.getSummary(startDate, endDate);
    const sales = reportingService.getSalesSummary(startDate, endDate);
    const costOfGoods = sales.orders.reduce((sum: number, o: any) => {
      if (!o.items) return sum;
      return sum + o.items.reduce((itemSum: number, item: any) => {
        const product = products.find((p) => p.id === item.stockItemId);
        return itemSum + (product?.costPrice || 0) * item.quantity;
      }, 0);
    }, 0);

    const totalRevenue = income.total + sales.totalSales;
    const totalExpenses = expenses.total + costOfGoods;
    const grossProfit = sales.totalSales - costOfGoods;
    const netProfit = totalRevenue - totalExpenses;

    return {
      revenue: { sales: sales.totalSales, otherIncome: income.total, total: totalRevenue },
      expenses: { costOfGoods, operatingExpenses: expenses.total, total: totalExpenses },
      profit: { gross: grossProfit, net: netProfit, margin: totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 100) : 0 },
    };
  },
};
