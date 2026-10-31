// =============================================================================
// BUDGET SERVICE
// =============================================================================

export const budgetService = {
  list: () => {
    const comp = getCurrentCompany();
    return budgets.filter((b) => b.company === comp);
  },
  getById: (id: number) => {
    return budgets.find((b) => b.id === id);
  },
  getByPeriod: (period: string) => {
    const comp = getCurrentCompany();
    return budgets.filter((b) => b.company === comp && b.period === period);
  },
  create: (data: any) => {
    const comp = getCurrentCompany();
    const newItem = {
      ...data,
      company: data.company || comp,
      id: Date.now(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    budgets.push(newItem);
    saveItem("sgf_budgets", budgets);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = budgets.findIndex((b) => b.id === id);
    if (idx >= 0) {
      budgets[idx] = { ...budgets[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_budgets", budgets);
    }
    return budgets[idx];
  },
  delete: (id: number) => {
    const idx = budgets.findIndex((b) => b.id === id);
    if (idx >= 0) {
      budgets.splice(idx, 1);
      saveItem("sgf_budgets", budgets);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// FORECAST SERVICE
// =============================================================================

export const forecastService = {
  list: () => {
    const comp = getCurrentCompany();
    return forecasts.filter((f) => f.company === comp);
  },
  getById: (id: number) => {
    return forecasts.find((f) => f.id === id);
  },
  getByPeriod: (period: string) => {
    const comp = getCurrentCompany();
    return forecasts.filter((f) => f.company === comp && f.period === period);
  },
  create: (data: any) => {
    const comp = getCurrentCompany();
    const newItem = {
      ...data,
      company: data.company || comp,
      id: Date.now(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    forecasts.push(newItem);
    saveItem("sgf_forecasts", forecasts);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = forecasts.findIndex((f) => f.id === id);
    if (idx >= 0) {
      forecasts[idx] = { ...forecasts[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_forecasts", forecasts);
    }
    return forecasts[idx];
  },
  delete: (id: number) => {
    const idx = forecasts.findIndex((f) => f.id === id);
    if (idx >= 0) {
      forecasts.splice(idx, 1);
      saveItem("sgf_forecasts", forecasts);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// CASH FLOW SERVICE
// =============================================================================

export const cashFlowService = {
  list: () => {
    const comp = getCurrentCompany();
    return cashFlows.filter((c) => c.company === comp);
  },
  getById: (id: number) => {
    return cashFlows.find((c) => c.id === id);
  },
  getByPeriod: (period: string) => {
    const comp = getCurrentCompany();
    return cashFlows.filter((c) => c.company === comp && c.period === period);
  },
  create: (data: any) => {
    const comp = getCurrentCompany();
    const newItem = {
      ...data,
      company: data.company || comp,
      id: Date.now(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    cashFlows.push(newItem);
    saveItem("sgf_cashFlows", cashFlows);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = cashFlows.findIndex((c) => c.id === id);
    if (idx >= 0) {
      cashFlows[idx] = { ...cashFlows[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_cashFlows", cashFlows);
    }
    return cashFlows[idx];
  },
  delete: (id: number) => {
    const idx = cashFlows.findIndex((c) => c.id === id);
    if (idx >= 0) {
      cashFlows.splice(idx, 1);
      saveItem("sgf_cashFlows", cashFlows);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// BANK ACCOUNT SERVICE
// =============================================================================

export const bankAccountService = {
  list: () => {
    const comp = getCurrentCompany();
    return bankAccounts.filter((b) => b.company === comp);
  },
  getById: (id: number) => {
    return bankAccounts.find((b) => b.id === id);
  },
  getByBank: (bankName: string) => {
    const comp = getCurrentCompany();
    return bankAccounts.filter((b) => b.company === comp && b.bankName === bankName);
  },
  create: (data: any) => {
    const comp = getCurrentCompany();
    const newItem = {
      ...data,
      company: data.company || comp,
      id: Date.now(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    bankAccounts.push(newItem);
    saveItem("sgf_bankAccounts", bankAccounts);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = bankAccounts.findIndex((b) => b.id === id);
    if (idx >= 0) {
      bankAccounts[idx] = { ...bankAccounts[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_bankAccounts", bankAccounts);
    }
    return bankAccounts[idx];
  },
  delete: (id: number) => {
    const idx = bankAccounts.findIndex((b) => b.id === id);
    if (idx >= 0) {
      bankAccounts.splice(idx, 1);
      saveItem("sgf_bankAccounts", bankAccounts);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// BANK TRANSACTION SERVICE
// =============================================================================

export const bankTransactionService = {
  list: () => {
    const comp = getCurrentCompany();
    return bankTransactions.filter((b) => b.company === comp);
  },
  getById: (id: number) => {
    return bankTransactions.find((b) => b.id === id);
  },
  getByAccount: (accountId: number) => {
    return bankTransactions.filter((b) => b.accountId === accountId);
  },
  create: (data: any) => {
    const comp = getCurrentCompany();
    const newItem = {
      ...data,
      company: data.company || comp,
      id: Date.now(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    bankTransactions.push(newItem);
    saveItem("sgf_bankTransactions", bankTransactions);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = bankTransactions.findIndex((b) => b.id === id);
    if (idx >= 0) {
      bankTransactions[idx] = { ...bankTransactions[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_bankTransactions", bankTransactions);
    }
    return bankTransactions[idx];
  },
  delete: (id: number) => {
    const idx = bankTransactions.findIndex((b) => b.id === id);
    if (idx >= 0) {
      bankTransactions.splice(idx, 1);
      saveItem("sgf_bankTransactions", bankTransactions);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// RECONCILIATION SERVICE
// =============================================================================

export const reconciliationService = {
  list: () => {
    const comp = getCurrentCompany();
    return reconciliations.filter((r) => r.company === comp);
  },
  getById: (id: number) => {
    return reconciliations.find((r) => r.id === id);
  },
  getByAccount: (accountId: number) => {
    return reconciliations.filter((r) => r.accountId === accountId);
  },
  create: (data: any) => {
    const comp = getCurrentCompany();
    const newItem = {
      ...data,
      company: data.company || comp,
      id: Date.now(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    reconciliations.push(newItem);
    saveItem("sgf_reconciliations", reconciliations);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = reconciliations.findIndex((r) => r.id === id);
    if (idx >= 0) {
      reconciliations[idx] = { ...reconciliations[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_reconciliations", reconciliations);
    }
    return reconciliations[idx];
  },
  delete: (id: number) => {
    const idx = reconciliations.findIndex((r) => r.id === id);
    if (idx >= 0) {
      reconciliations.splice(idx, 1);
      saveItem("sgf_reconciliations", reconciliations);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// TAX RETURN SERVICE
// =============================================================================

export const taxReturnService = {
  list: () => {
    const comp = getCurrentCompany();
    return taxReturns.filter((t) => t.company === comp);
  },
  getById: (id: number) => {
    return taxReturns.find((t) => t.id === id);
  },
  getByPeriod: (period: string) => {
    const comp = getCurrentCompany();
    return taxReturns.filter((t) => t.company === comp && t.period === period);
  },
  create: (data: any) => {
    const comp = getCurrentCompany();
    const newItem = {
      ...data,
      company: data.company || comp,
      id: Date.now(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    taxReturns.push(newItem);
    saveItem("sgf_taxReturns", taxReturns);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = taxReturns.findIndex((t) => t.id === id);
    if (idx >= 0) {
      taxReturns[idx] = { ...taxReturns[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_taxReturns", taxReturns);
    }
    return taxReturns[idx];
  },
  delete: (id: number) => {
    const idx = taxReturns.findIndex((t) => t.id === id);
    if (idx >= 0) {
      taxReturns.splice(idx, 1);
      saveItem("sgf_taxReturns", taxReturns);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// VAT RETURN SERVICE
// =============================================================================

export const vatReturnService = {
  list: () => {
    const comp = getCurrentCompany();
    return vatReturns.filter((v) => v.company === comp);
  },
  getById: (id: number) => {
    return vatReturns.find((v) => v.id === id);
  },
  getByPeriod: (period: string) => {
    const comp = getCurrentCompany();
    return vatReturns.filter((v) => v.company === comp && v.period === period);
  },
  create: (data: any) => {
    const comp = getCurrentCompany();
    const newItem = {
      ...data,
      company: data.company || comp,
      id: Date.now(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    vatReturns.push(newItem);
    saveItem("sgf_vatReturns", vatReturns);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = vatReturns.findIndex((v) => v.id === id);
    if (idx >= 0) {
      vatReturns[idx] = { ...vatReturns[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_vatReturns", vatReturns);
    }
    return vatReturns[idx];
  },
  delete: (id: number) => {
    const idx = vatReturns.findIndex((v) => v.id === id);
    if (idx >= 0) {
      vatReturns.splice(idx, 1);
      saveItem("sgf_vatReturns", vatReturns);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// PAYROLL SERVICE
// =============================================================================

export const payrollService = {
  list: () => {
    const comp = getCurrentCompany();
    return payrollRecords.filter((p) => p.company === comp);
  },
  getById: (id: number) => {
    return payrollRecords.find((p) => p.id === id);
  },
  getByEmployee: (employeeId: number) => {
    return payrollRecords.filter((p) => p.employeeId === employeeId);
  },
  getByPeriod: (period: string) => {
    const comp = getCurrentCompany();
    return payrollRecords.filter((p) => p.company === comp && p.period === period);
  },
  create: (data: any) => {
    const comp = getCurrentCompany();
    const newItem = {
      ...data,
      company: data.company || comp,
      id: Date.now(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    payrollRecords.push(newItem);
    saveItem("sgf_payrollRecords", payrollRecords);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = payrollRecords.findIndex((p) => p.id === id);
    if (idx >= 0) {
      payrollRecords[idx] = { ...payrollRecords[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_payrollRecords", payrollRecords);
    }
    return payrollRecords[idx];
  },
  delete: (id: number) => {
    const idx = payrollRecords.findIndex((p) => p.id === id);
    if (idx >= 0) {
      payrollRecords.splice(idx, 1);
      saveItem("sgf_payrollRecords", payrollRecords);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// EMPLOYEE SERVICE
// =============================================================================

export const employeeService = {
  list: () => {
    const comp = getCurrentCompany();
    return employees.filter((e) => e.company === comp);
  },
  getById: (id: number) => {
    return employees.find((e) => e.id === id);
  },
  getByEmployeeNumber: (employeeNumber: string) => {
    return employees.find((e) => e.employeeNumber === employeeNumber);
  },
  getByDepartment: (department: string) => {
    const comp = getCurrentCompany();
    return employees.filter((e) => e.company === comp && e.department === department);
  },
  create: (data: any) => {
    const comp = getCurrentCompany();
    const newItem = {
      ...data,
      company: data.company || comp,
      id: Date.now(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    employees.push(newItem);
    saveItem("sgf_employees", employees);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = employees.findIndex((e) => e.id === id);
    if (idx >= 0) {
      employees[idx] = { ...employees[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_employees", employees);
    }
    return employees[idx];
  },
  delete: (id: number) => {
    const idx = employees.findIndex((e) => e.id === id);
    if (idx >= 0) {
      employees.splice(idx, 1);
      saveItem("sgf_employees", employees);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// LEAVE REQUEST SERVICE
// =============================================================================

export const leaveRequestService = {
  list: () => {
    const comp = getCurrentCompany();
    return leaveRequests.filter((l) => l.company === comp);
  },
  getById: (id: number) => {
    return leaveRequests.find((l) => l.id === id);
  },
  getByEmployee: (employeeId: number) => {
    return leaveRequests.filter((l) => l.employeeId === employeeId);
  },
  getByStatus: (status: string) => {
    const comp = getCurrentCompany();
    return leaveRequests.filter((l) => l.company === comp && l.status === status);
  },
  create: (data: any) => {
    const comp = getCurrentCompany();
    const newItem = {
      ...data,
      company: data.company || comp,
      id: Date.now(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    leaveRequests.push(newItem);
    saveItem("sgf_leaveRequests", leaveRequests);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = leaveRequests.findIndex((l) => l.id === id);
    if (idx >= 0) {
      leaveRequests[idx] = { ...leaveRequests[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_leaveRequests", leaveRequests);
    }
    return leaveRequests[idx];
  },
  delete: (id: number) => {
    const idx = leaveRequests.findIndex((l) => l.id === id);
    if (idx >= 0) {
      leaveRequests.splice(idx, 1);
      saveItem("sgf_leaveRequests", leaveRequests);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// TIMESHEET SERVICE
// =============================================================================

export const timesheetService = {
  list: () => {
    const comp = getCurrentCompany();
    return timesheets.filter((t) => t.company === comp);
  },
  getById: (id: number) => {
    return timesheets.find((t) => t.id === id);
  },
  getByEmployee: (employeeId: number) => {
    return timesheets.filter((t) => t.employeeId === employeeId);
  },
  getByDate: (date: string) => {
    const comp = getCurrentCompany();
    return timesheets.filter((t) => t.company === comp && t.date === date);
  },
  create: (data: any) => {
    const comp = getCurrentCompany();
    const newItem = {
      ...data,
      company: data.company || comp,
      id: Date.now(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    timesheets.push(newItem);
    saveItem("sgf_timesheets", timesheets);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = timesheets.findIndex((t) => t.id === id);
    if (idx >= 0) {
      timesheets[idx] = { ...timesheets[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_timesheets", timesheets);
    }
    return timesheets[idx];
  },
  delete: (id: number) => {
    const idx = timesheets.findIndex((t) => t.id === id);
    if (idx >= 0) {
      timesheets.splice(idx, 1);
      saveItem("sgf_timesheets", timesheets);
    }
    return { success: idx >= 0 };
  },
};
