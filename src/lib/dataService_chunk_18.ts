// =============================================================================
// BALANCE SHEET SERVICE
// =============================================================================

export const balanceSheetService = {
  getReport: () => {
    const assets = {
      cash: receipts.reduce((sum, r) => sum + (r.amount || 0), 0),
      accountsReceivable: invoices.reduce((sum, i) => sum + (i.balanceDue || 0), 0),
      inventory: products.reduce((sum, p) => sum + (p.quantity || 0) * (p.costPrice || 0), 0),
      total: 0,
    };
    assets.total = assets.cash + assets.accountsReceivable + assets.inventory;

    const liabilities = {
      accountsPayable: supplierPOService.list().reduce((sum: number, po: any) => sum + (po.total || 0), 0),
      total: 0,
    };
    liabilities.total = liabilities.accountsPayable;

    const equity = {
      retainedEarnings: profitLossService.getReport().profit.net,
      total: 0,
    };
    equity.total = equity.retainedEarnings;

    return {
      assets,
      liabilities,
      equity,
      totalLiabilitiesAndEquity: liabilities.total + equity.total,
      balanced: Math.abs(assets.total - (liabilities.total + equity.total)) < 0.01,
    };
  },
};

// =============================================================================
// CASH FLOW SERVICE
// =============================================================================

export const cashFlowService = {
  getReport: (startDate?: string, endDate?: string) => {
    const receiptTotal = receipts
      .filter((r) => (!startDate || r.receiptDate >= startDate) && (!endDate || r.receiptDate <= endDate))
      .reduce((sum, r) => sum + (r.amount || 0), 0);
    const expenseTotal = expenseService.list()
      .filter((e: any) => (!startDate || e.date >= startDate) && (!endDate || e.date <= endDate))
      .reduce((sum: number, e: any) => sum + (e.amount || 0), 0);
    const incomeTotal = incomeService.list()
      .filter((i: any) => (!startDate || i.date >= startDate) && (!endDate || i.date <= endDate))
      .reduce((sum: number, i: any) => sum + (i.amount || 0), 0);

    const operating = receiptTotal + incomeTotal - expenseTotal;
    const investing = 0;
    const financing = 0;
    const netChange = operating + investing + financing;

    return {
      operating,
      investing,
      financing,
      netChange,
      openingBalance: 0,
      closingBalance: netChange,
    };
  },
};

// =============================================================================
// BUDGET / FORECAST SERVICE
// =============================================================================

export const budgetService = {
  getBudgets: () => {
    try {
      const raw = getStorageItem("sgf_budgets");
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return [];
  },
  setBudget: (category: string, month: string, amount: number) => {
    const budgets = budgetService.getBudgets();
    const existing = budgets.find((b: any) => b.category === category && b.month === month);
    if (existing) {
      existing.amount = amount;
      existing.updatedAt = new Date().toISOString();
    } else {
      budgets.push({
        id: Date.now() + Math.random(),
        category,
        month,
        amount,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    setStorageItem("sgf_budgets", JSON.stringify(budgets));
    return budgets;
  },
  getVariance: (category: string, month: string) => {
    const budgets = budgetService.getBudgets();
    const budget = budgets.find((b: any) => b.category === category && b.month === month);
    if (!budget) return { budgeted: 0, actual: 0, variance: 0, percentage: 0 };
    const expenses = expenseService.list().filter((e: any) => e.category === category && e.date?.startsWith(month));
    const actual = expenses.reduce((sum: number, e: any) => sum + (e.amount || 0), 0);
    return {
      budgeted: budget.amount,
      actual,
      variance: budget.amount - actual,
      percentage: budget.amount > 0 ? Math.round((actual / budget.amount) * 100) : 0,
    };
  },
};

// =============================================================================
// KPI / METRIC SERVICE
// =============================================================================

export const kpiService = {
  getAll: () => {
    const sales = reportingService.getSalesSummary();
    const invoiceStats = invoiceService.getStats();
    const orderStats = orderService.getStats();
    const stockValue = stockService.getStockValue();
    const lowStock = stockService.getLowStock().length;
    const outOfStock = stockService.getOutOfStock().length;
    const aging = getAgingReport();
    const totalOverdue = aging.reduce((sum, a) => sum + a.days30 + a.days60 + a.days90 + a.days120, 0);

    return {
      sales: {
        totalRevenue: sales.totalSales,
        totalOrders: orderStats.total,
        averageOrderValue: orderStats.total > 0 ? Math.round((sales.totalSales / orderStats.total) * 100) / 100 : 0,
      },
      invoices: {
        totalInvoiced: invoiceStats.totalValue,
        totalPaid: invoiceStats.totalPaid,
        totalDue: invoiceStats.totalDue,
        collectionRate: invoiceStats.totalValue > 0 ? Math.round((invoiceStats.totalPaid / invoiceStats.totalValue) * 100) : 0,
        overdueAmount: totalOverdue,
      },
      stock: {
        totalValue: stockValue,
        lowStockCount: lowStock,
        outOfStockCount: outOfStock,
        productCount: products.length,
      },
      customers: {
        total: customers.length,
        active: customers.filter((c) => c.isActive !== false).length,
        onStopList: customers.filter((c) => c.onStopList).length,
      },
    };
  },
};

// =============================================================================
// ACTIVITY / AUDIT LOG SERVICE
// =============================================================================

export const auditLogService = {
  list: () => auditLog,
  getById: (id: number) => auditLog.find((a) => a.id === id),
  getByEntity: (entityType: string, entityId: number | string) =>
    auditLog.filter((a) => a.entityType === entityType && a.entityId == entityId),
  getByUser: (userId: number) => auditLog.filter((a) => a.userId === userId),
  getByAction: (action: string) => auditLog.filter((a) => a.action === action),
  getByDate: (date: string) => auditLog.filter((a) => a.timestamp?.startsWith(date)),
  getRecent: (limit: number = 50) =>
    [...auditLog].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, limit),
  clear: () => {
    auditLog = [];
    saveItem("sgf_auditLog", auditLog);
    return { success: true };
  },
};

// =============================================================================
// SYSTEM LOG SERVICE
// =============================================================================

export const systemLogService = {
  list: () => systemLogs,
  getById: (id: number) => systemLogs.find((s) => s.id === id),
  getByLevel: (level: string) => systemLogs.filter((s) => s.level === level),
  getBySource: (source: string) => systemLogs.filter((s) => s.source === source),
  getByDate: (date: string) => systemLogs.filter((s) => s.timestamp?.startsWith(date)),
  getRecent: (limit: number = 50) =>
    [...systemLogs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, limit),
  clear: () => {
    systemLogs = [];
    saveItem("sgf_systemLogs", systemLogs);
    return { success: true };
  },
};
