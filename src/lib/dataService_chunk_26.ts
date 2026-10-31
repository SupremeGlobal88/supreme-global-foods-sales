// =============================================================================
// RECONCILIATION / BANK RECON SERVICE
// =============================================================================

export const reconciliationService = {
  list: () => {
    try {
      const raw = getStorageItem("sgf_reconciliations");
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return [];
  },
  getById: (id: number) => {
    const reconciliations = reconciliationService.list();
    return reconciliations.find((r: any) => r.id === id);
  },
  getByBank: (bankId: number) => {
    const reconciliations = reconciliationService.list();
    return reconciliations.filter((r: any) => r.bankId === bankId);
  },
  create: (data: any) => {
    const reconciliations = reconciliationService.list();
    const newReconciliation = {
      id: Date.now() + Math.random(),
      ...data,
      status: data.status || "draft",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    reconciliations.push(newReconciliation);
    setStorageItem("sgf_reconciliations", JSON.stringify(reconciliations));
    logAudit("create", "reconciliation", newReconciliation.id, data);
    return newReconciliation;
  },
  update: (id: number, data: any) => {
    const reconciliations = reconciliationService.list();
    const index = reconciliations.findIndex((r: any) => r.id === id);
    if (index === -1) return null;
    reconciliations[index] = { ...reconciliations[index], ...data, updatedAt: new Date().toISOString() };
    setStorageItem("sgf_reconciliations", JSON.stringify(reconciliations));
    logAudit("update", "reconciliation", id, data);
    return reconciliations[index];
  },
  delete: (id: number) => {
    const reconciliations = reconciliationService.list();
    const index = reconciliations.findIndex((r: any) => r.id === id);
    if (index === -1) return { success: false, error: "Reconciliation not found" };
    reconciliations.splice(index, 1);
    setStorageItem("sgf_reconciliations", JSON.stringify(reconciliations));
    logAudit("delete", "reconciliation", id, {});
    return { success: true };
  },
};

// =============================================================================
// JOURNAL / LEDGER SERVICE
// =============================================================================

export const journalService = {
  list: () => {
    try {
      const raw = getStorageItem("sgf_journal");
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return [];
  },
  getById: (id: number) => {
    const entries = journalService.list();
    return entries.find((e: any) => e.id === id);
  },
  getByAccount: (accountCode: string) => {
    const entries = journalService.list();
    return entries.filter((e: any) => e.accountCode === accountCode);
  },
  getByDate: (date: string) => {
    const entries = journalService.list();
    return entries.filter((e: any) => e.date === date);
  },
  create: (data: any) => {
    const entries = journalService.list();
    const newEntry = {
      id: Date.now() + Math.random(),
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    entries.push(newEntry);
    setStorageItem("sgf_journal", JSON.stringify(entries));
    logAudit("create", "journal", newEntry.id, data);
    return newEntry;
  },
  update: (id: number, data: any) => {
    const entries = journalService.list();
    const index = entries.findIndex((e: any) => e.id === id);
    if (index === -1) return null;
    entries[index] = { ...entries[index], ...data, updatedAt: new Date().toISOString() };
    setStorageItem("sgf_journal", JSON.stringify(entries));
    logAudit("update", "journal", id, data);
    return entries[index];
  },
  delete: (id: number) => {
    const entries = journalService.list();
    const index = entries.findIndex((e: any) => e.id === id);
    if (index === -1) return { success: false, error: "Journal entry not found" };
    entries.splice(index, 1);
    setStorageItem("sgf_journal", JSON.stringify(entries));
    logAudit("delete", "journal", id, {});
    return { success: true };
  },
};

// =============================================================================
// CHART OF ACCOUNTS SERVICE
// =============================================================================

export const chartOfAccountsService = {
  list: () => {
    try {
      const raw = getStorageItem("sgf_chartOfAccounts");
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return [];
  },
  getById: (id: number) => {
    const accounts = chartOfAccountsService.list();
    return accounts.find((a: any) => a.id === id);
  },
  getByCode: (code: string) => {
    const accounts = chartOfAccountsService.list();
    return accounts.find((a: any) => a.code === code);
  },
  create: (data: any) => {
    const accounts = chartOfAccountsService.list();
    const newAccount = {
      id: Date.now() + Math.random(),
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    accounts.push(newAccount);
    setStorageItem("sgf_chartOfAccounts", JSON.stringify(accounts));
    logAudit("create", "account", newAccount.id, data);
    return newAccount;
  },
  update: (id: number, data: any) => {
    const accounts = chartOfAccountsService.list();
    const index = accounts.findIndex((a: any) => a.id === id);
    if (index === -1) return null;
    accounts[index] = { ...accounts[index], ...data, updatedAt: new Date().toISOString() };
    setStorageItem("sgf_chartOfAccounts", JSON.stringify(accounts));
    logAudit("update", "account", id, data);
    return accounts[index];
  },
  delete: (id: number) => {
    const accounts = chartOfAccountsService.list();
    const index = accounts.findIndex((a: any) => a.id === id);
    if (index === -1) return { success: false, error: "Account not found" };
    accounts.splice(index, 1);
    setStorageItem("sgf_chartOfAccounts", JSON.stringify(accounts));
    logAudit("delete", "account", id, {});
    return { success: true };
  },
};

// =============================================================================
// TRIAL BALANCE SERVICE
// =============================================================================

export const trialBalanceService = {
  getReport: () => {
    const accounts = chartOfAccountsService.list();
    const journal = journalService.list();
    return accounts.map((account: any) => {
      const accountEntries = journal.filter((e: any) => e.accountCode === account.code);
      const debit = accountEntries.reduce((sum: number, e: any) => sum + (e.debit || 0), 0);
      const credit = accountEntries.reduce((sum: number, e: any) => sum + (e.credit || 0), 0);
      return {
        account,
        debit,
        credit,
        balance: debit - credit,
      };
    });
  },
};

// =============================================================================
// GENERAL LEDGER SERVICE
// =============================================================================

export const generalLedgerService = {
  getEntries: (accountCode: string, startDate?: string, endDate?: string) => {
    let entries = journalService.list().filter((e: any) => e.accountCode === accountCode);
    if (startDate) entries = entries.filter((e: any) => e.date >= startDate);
    if (endDate) entries = entries.filter((e: any) => e.date <= endDate);
    return entries.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
  },
  getBalance: (accountCode: string, asOfDate?: string) => {
    let entries = journalService.list().filter((e: any) => e.accountCode === accountCode);
    if (asOfDate) entries = entries.filter((e: any) => e.date <= asOfDate);
    const debit = entries.reduce((sum: number, e: any) => sum + (e.debit || 0), 0);
    const credit = entries.reduce((sum: number, e: any) => sum + (e.credit || 0), 0);
    return debit - credit;
  },
};

// =============================================================================
// FINANCIAL YEAR / PERIOD SERVICE
// =============================================================================

export const financialPeriodService = {
  getPeriods: () => {
    try {
      const raw = getStorageItem("sgf_financialPeriods");
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return [];
  },
  createPeriod: (data: any) => {
    const periods = financialPeriodService.getPeriods();
    const newPeriod = {
      id: Date.now() + Math.random(),
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    periods.push(newPeriod);
    setStorageItem("sgf_financialPeriods", JSON.stringify(periods));
    logAudit("create", "financialPeriod", newPeriod.id, data);
    return newPeriod;
  },
  closePeriod: (id: number) => {
    const periods = financialPeriodService.getPeriods();
    const index = periods.findIndex((p: any) => p.id === id);
    if (index === -1) return { success: false, error: "Period not found" };
    periods[index].status = "closed";
    periods[index].closedAt = new Date().toISOString();
    setStorageItem("sgf_financialPeriods", JSON.stringify(periods));
    logAudit("update", "financialPeriod", id, { action: "closed" });
    return { success: true };
  },
};
