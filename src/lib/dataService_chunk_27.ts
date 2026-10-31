// =============================================================================
// MULTI-CURRENCY / FOREX SERVICE
// =============================================================================

export const forexService = {
  getRates: () => {
    try {
      const raw = getStorageItem("sgf_forexRates");
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return { USD: 18.5, EUR: 20.2, GBP: 23.8 };
  },
  setRate: (currency: string, rate: number) => {
    const rates = forexService.getRates();
    rates[currency] = rate;
    setStorageItem("sgf_forexRates", JSON.stringify(rates));
    logAudit("update", "forexRate", 0, { currency, rate });
    return rates;
  },
  convert: (amount: number, from: string, to: string) => {
    const rates = forexService.getRates();
    const fromRate = from === "ZAR" ? 1 : rates[from];
    const toRate = to === "ZAR" ? 1 : rates[to];
    if (!fromRate || !toRate) return amount;
    return Math.round((amount / fromRate) * toRate * 100) / 100;
  },
};

// =============================================================================
// BANK STATEMENT / IMPORT SERVICE
// =============================================================================

export const bankStatementService = {
  list: () => {
    try {
      const raw = getStorageItem("sgf_bankStatements");
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return [];
  },
  getById: (id: number) => {
    const statements = bankStatementService.list();
    return statements.find((s: any) => s.id === id);
  },
  getByBank: (bankId: number) => {
    const statements = bankStatementService.list();
    return statements.filter((s: any) => s.bankId === bankId);
  },
  import: (data: any) => {
    const statements = bankStatementService.list();
    const newStatement = {
      id: Date.now() + Math.random(),
      ...data,
      importedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    statements.push(newStatement);
    setStorageItem("sgf_bankStatements", JSON.stringify(statements));
    logAudit("create", "bankStatement", newStatement.id, data);
    return newStatement;
  },
  delete: (id: number) => {
    const statements = bankStatementService.list();
    const index = statements.findIndex((s: any) => s.id === id);
    if (index === -1) return { success: false, error: "Statement not found" };
    statements.splice(index, 1);
    setStorageItem("sgf_bankStatements", JSON.stringify(statements));
    logAudit("delete", "bankStatement", id, {});
    return { success: true };
  },
};

// =============================================================================
// PETTY CASH SERVICE
// =============================================================================

export const pettyCashService = {
  getBalance: () => {
    try {
      const raw = getStorageItem("sgf_pettyCashBalance");
      if (raw) return parseFloat(raw);
    } catch { /* ignore */ }
    return 0;
  },
  setBalance: (amount: number) => {
    setStorageItem("sgf_pettyCashBalance", String(amount));
    return amount;
  },
  list: () => {
    try {
      const raw = getStorageItem("sgf_pettyCash");
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return [];
  },
  addTransaction: (data: any) => {
    const transactions = pettyCashService.list();
    const newTransaction = {
      id: Date.now() + Math.random(),
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    transactions.push(newTransaction);
    const balance = pettyCashService.getBalance() + (data.amount || 0);
    pettyCashService.setBalance(balance);
    setStorageItem("sgf_pettyCash", JSON.stringify(transactions));
    logAudit("create", "pettyCash", newTransaction.id, data);
    return newTransaction;
  },
};

// =============================================================================
// CHEQUE / CHECK SERVICE
// =============================================================================

export const chequeService = {
  list: () => {
    try {
      const raw = getStorageItem("sgf_cheques");
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return [];
  },
  getById: (id: number) => {
    const cheques = chequeService.list();
    return cheques.find((c: any) => c.id === id);
  },
  getByStatus: (status: string) => {
    const cheques = chequeService.list();
    return cheques.filter((c: any) => c.status === status);
  },
  create: (data: any) => {
    const cheques = chequeService.list();
    const newCheque = {
      id: Date.now() + Math.random(),
      ...data,
      status: data.status || "draft",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    cheques.push(newCheque);
    setStorageItem("sgf_cheques", JSON.stringify(cheques));
    logAudit("create", "cheque", newCheque.id, data);
    return newCheque;
  },
  update: (id: number, data: any) => {
    const cheques = chequeService.list();
    const index = cheques.findIndex((c: any) => c.id === id);
    if (index === -1) return null;
    cheques[index] = { ...cheques[index], ...data, updatedAt: new Date().toISOString() };
    setStorageItem("sgf_cheques", JSON.stringify(cheques));
    logAudit("update", "cheque", id, data);
    return cheques[index];
  },
  delete: (id: number) => {
    const cheques = chequeService.list();
    const index = cheques.findIndex((c: any) => c.id === id);
    if (index === -1) return { success: false, error: "Cheque not found" };
    cheques.splice(index, 1);
    setStorageItem("sgf_cheques", JSON.stringify(cheques));
    logAudit("delete", "cheque", id, {});
    return { success: true };
  },
};

// =============================================================================
// EFT / ELECTRONIC PAYMENT SERVICE
// =============================================================================

export const eftService = {
  list: () => {
    try {
      const raw = getStorageItem("sgf_efts");
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return [];
  },
  getById: (id: number) => {
    const efts = eftService.list();
    return efts.find((e: any) => e.id === id);
  },
  getByStatus: (status: string) => {
    const efts = eftService.list();
    return efts.filter((e: any) => e.status === status);
  },
  create: (data: any) => {
    const efts = eftService.list();
    const newEft = {
      id: Date.now() + Math.random(),
      ...data,
      status: data.status || "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    efts.push(newEft);
    setStorageItem("sgf_efts", JSON.stringify(efts));
    logAudit("create", "eft", newEft.id, data);
    return newEft;
  },
  update: (id: number, data: any) => {
    const efts = eftService.list();
    const index = efts.findIndex((e: any) => e.id === id);
    if (index === -1) return null;
    efts[index] = { ...efts[index], ...data, updatedAt: new Date().toISOString() };
    setStorageItem("sgf_efts", JSON.stringify(efts));
    logAudit("update", "eft", id, data);
    return efts[index];
  },
  delete: (id: number) => {
    const efts = eftService.list();
    const index = efts.findIndex((e: any) => e.id === id);
    if (index === -1) return { success: false, error: "EFT not found" };
    efts.splice(index, 1);
    setStorageItem("sgf_efts", JSON.stringify(efts));
    logAudit("delete", "eft", id, {});
    return { success: true };
  },
};
