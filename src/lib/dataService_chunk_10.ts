// =============================================================================
// YIELD RECORD SERVICE
// =============================================================================

export const yieldService = {
  list: () => {
    const comp = getCurrentCompany();
    return yieldRecords.filter((y) => y.company === comp);
  },
  getById: (id: number) => {
    return yieldRecords.find((y) => y.id === id);
  },
  getByBatch: (batchId: number) => {
    return yieldRecords.filter((y) => y.batchId === batchId);
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
    yieldRecords.push(newItem);
    saveItem("sgf_yieldRecords", yieldRecords);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = yieldRecords.findIndex((y) => y.id === id);
    if (idx >= 0) {
      yieldRecords[idx] = { ...yieldRecords[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_yieldRecords", yieldRecords);
    }
    return yieldRecords[idx];
  },
  delete: (id: number) => {
    const idx = yieldRecords.findIndex((y) => y.id === id);
    if (idx >= 0) {
      yieldRecords.splice(idx, 1);
      saveItem("sgf_yieldRecords", yieldRecords);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// SCRAP RECORD SERVICE
// =============================================================================

export const scrapService = {
  list: () => {
    const comp = getCurrentCompany();
    return scrapRecords.filter((s) => s.company === comp);
  },
  getById: (id: number) => {
    return scrapRecords.find((s) => s.id === id);
  },
  getByBatch: (batchId: number) => {
    return scrapRecords.filter((s) => s.batchId === batchId);
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
    scrapRecords.push(newItem);
    saveItem("sgf_scrapRecords", scrapRecords);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = scrapRecords.findIndex((s) => s.id === id);
    if (idx >= 0) {
      scrapRecords[idx] = { ...scrapRecords[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_scrapRecords", scrapRecords);
    }
    return scrapRecords[idx];
  },
  delete: (id: number) => {
    const idx = scrapRecords.findIndex((s) => s.id === id);
    if (idx >= 0) {
      scrapRecords.splice(idx, 1);
      saveItem("sgf_scrapRecords", scrapRecords);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// REWORK RECORD SERVICE
// =============================================================================

export const reworkService = {
  list: () => {
    const comp = getCurrentCompany();
    return reworkRecords.filter((r) => r.company === comp);
  },
  getById: (id: number) => {
    return reworkRecords.find((r) => r.id === id);
  },
  getByBatch: (batchId: number) => {
    return reworkRecords.filter((r) => r.batchId === batchId);
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
    reworkRecords.push(newItem);
    saveItem("sgf_reworkRecords", reworkRecords);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = reworkRecords.findIndex((r) => r.id === id);
    if (idx >= 0) {
      reworkRecords[idx] = { ...reworkRecords[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_reworkRecords", reworkRecords);
    }
    return reworkRecords[idx];
  },
  delete: (id: number) => {
    const idx = reworkRecords.findIndex((r) => r.id === id);
    if (idx >= 0) {
      reworkRecords.splice(idx, 1);
      saveItem("sgf_reworkRecords", reworkRecords);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// PACKING LIST SERVICE
// =============================================================================

export const packingListService = {
  list: () => {
    const comp = getCurrentCompany();
    return packingLists.filter((p) => p.company === comp);
  },
  getById: (id: number) => {
    return packingLists.find((p) => p.id === id);
  },
  getByOrder: (orderId: number) => {
    return packingLists.filter((p) => p.orderId === orderId);
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
    packingLists.push(newItem);
    saveItem("sgf_packingLists", packingLists);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = packingLists.findIndex((p) => p.id === id);
    if (idx >= 0) {
      packingLists[idx] = { ...packingLists[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_packingLists", packingLists);
    }
    return packingLists[idx];
  },
  delete: (id: number) => {
    const idx = packingLists.findIndex((p) => p.id === id);
    if (idx >= 0) {
      packingLists.splice(idx, 1);
      saveItem("sgf_packingLists", packingLists);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// SHIPPING SERVICE
// =============================================================================

export const shippingService = {
  list: () => {
    const comp = getCurrentCompany();
    return shippingRecords.filter((s) => s.company === comp);
  },
  getById: (id: number) => {
    return shippingRecords.find((s) => s.id === id);
  },
  getByOrder: (orderId: number) => {
    return shippingRecords.filter((s) => s.orderId === orderId);
  },
  getByStatus: (status: string) => {
    const comp = getCurrentCompany();
    return shippingRecords.filter((s) => s.company === comp && s.status === status);
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
    shippingRecords.push(newItem);
    saveItem("sgf_shippingRecords", shippingRecords);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = shippingRecords.findIndex((s) => s.id === id);
    if (idx >= 0) {
      shippingRecords[idx] = { ...shippingRecords[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_shippingRecords", shippingRecords);
    }
    return shippingRecords[idx];
  },
  delete: (id: number) => {
    const idx = shippingRecords.findIndex((s) => s.id === id);
    if (idx >= 0) {
      shippingRecords.splice(idx, 1);
      saveItem("sgf_shippingRecords", shippingRecords);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// RETURN SERVICE
// =============================================================================

export const returnService = {
  list: () => {
    const comp = getCurrentCompany();
    return returnRecords.filter((r) => r.company === comp);
  },
  getById: (id: number) => {
    return returnRecords.find((r) => r.id === id);
  },
  getByOrder: (orderId: number) => {
    return returnRecords.filter((r) => r.orderId === orderId);
  },
  getByStatus: (status: string) => {
    const comp = getCurrentCompany();
    return returnRecords.filter((r) => r.company === comp && r.status === status);
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
    returnRecords.push(newItem);
    saveItem("sgf_returnRecords", returnRecords);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = returnRecords.findIndex((r) => r.id === id);
    if (idx >= 0) {
      returnRecords[idx] = { ...returnRecords[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_returnRecords", returnRecords);
    }
    return returnRecords[idx];
  },
  delete: (id: number) => {
    const idx = returnRecords.findIndex((r) => r.id === id);
    if (idx >= 0) {
      returnRecords.splice(idx, 1);
      saveItem("sgf_returnRecords", returnRecords);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// CREDIT NOTE SERVICE
// =============================================================================

export const creditNoteService = {
  list: () => {
    const comp = getCurrentCompany();
    return creditNotes.filter((c) => c.company === comp);
  },
  getById: (id: number) => {
    return creditNotes.find((c) => c.id === id);
  },
  getByInvoice: (invoiceId: number) => {
    return creditNotes.filter((c) => c.invoiceId === invoiceId);
  },
  getByCustomer: (customerId: number) => {
    return creditNotes.filter((c) => c.customerId === customerId);
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
    creditNotes.push(newItem);
    saveItem("sgf_creditNotes", creditNotes);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = creditNotes.findIndex((c) => c.id === id);
    if (idx >= 0) {
      creditNotes[idx] = { ...creditNotes[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_creditNotes", creditNotes);
    }
    return creditNotes[idx];
  },
  delete: (id: number) => {
    const idx = creditNotes.findIndex((c) => c.id === id);
    if (idx >= 0) {
      creditNotes.splice(idx, 1);
      saveItem("sgf_creditNotes", creditNotes);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// DEBIT NOTE SERVICE
// =============================================================================

export const debitNoteService = {
  list: () => {
    const comp = getCurrentCompany();
    return debitNotes.filter((d) => d.company === comp);
  },
  getById: (id: number) => {
    return debitNotes.find((d) => d.id === id);
  },
  getBySupplier: (supplierId: number) => {
    return debitNotes.filter((d) => d.supplierId === supplierId);
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
    debitNotes.push(newItem);
    saveItem("sgf_debitNotes", debitNotes);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = debitNotes.findIndex((d) => d.id === id);
    if (idx >= 0) {
      debitNotes[idx] = { ...debitNotes[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_debitNotes", debitNotes);
    }
    return debitNotes[idx];
  },
  delete: (id: number) => {
    const idx = debitNotes.findIndex((d) => d.id === id);
    if (idx >= 0) {
      debitNotes.splice(idx, 1);
      saveItem("sgf_debitNotes", debitNotes);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// JOURNAL ENTRY SERVICE
// =============================================================================

export const journalEntryService = {
  list: () => {
    const comp = getCurrentCompany();
    return journalEntries.filter((j) => j.company === comp);
  },
  getById: (id: number) => {
    return journalEntries.find((j) => j.id === id);
  },
  getByDate: (date: string) => {
    const comp = getCurrentCompany();
    return journalEntries.filter((j) => j.company === comp && j.date === date);
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
    journalEntries.push(newItem);
    saveItem("sgf_journalEntries", journalEntries);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = journalEntries.findIndex((j) => j.id === id);
    if (idx >= 0) {
      journalEntries[idx] = { ...journalEntries[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_journalEntries", journalEntries);
    }
    return journalEntries[idx];
  },
  delete: (id: number) => {
    const idx = journalEntries.findIndex((j) => j.id === id);
    if (idx >= 0) {
      journalEntries.splice(idx, 1);
      saveItem("sgf_journalEntries", journalEntries);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// GENERAL LEDGER SERVICE
// =============================================================================

export const generalLedgerService = {
  list: () => {
    const comp = getCurrentCompany();
    return generalLedger.filter((g) => g.company === comp);
  },
  getById: (id: number) => {
    return generalLedger.find((g) => g.id === id);
  },
  getByAccount: (accountCode: string) => {
    const comp = getCurrentCompany();
    return generalLedger.filter((g) => g.company === comp && g.accountCode === accountCode);
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
    generalLedger.push(newItem);
    saveItem("sgf_generalLedger", generalLedger);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = generalLedger.findIndex((g) => g.id === id);
    if (idx >= 0) {
      generalLedger[idx] = { ...generalLedger[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_generalLedger", generalLedger);
    }
    return generalLedger[idx];
  },
  delete: (id: number) => {
    const idx = generalLedger.findIndex((g) => g.id === id);
    if (idx >= 0) {
      generalLedger.splice(idx, 1);
      saveItem("sgf_generalLedger", generalLedger);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// ACCOUNT SERVICE
// =============================================================================

export const accountService = {
  list: () => {
    const comp = getCurrentCompany();
    return accounts.filter((a) => a.company === comp);
  },
  getById: (id: number) => {
    return accounts.find((a) => a.id === id);
  },
  getByCode: (code: string) => {
    const comp = getCurrentCompany();
    return accounts.find((a) => a.company === comp && a.code === code);
  },
  getByType: (type: string) => {
    const comp = getCurrentCompany();
    return accounts.filter((a) => a.company === comp && a.type === type);
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
    accounts.push(newItem);
    saveItem("sgf_accounts", accounts);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = accounts.findIndex((a) => a.id === id);
    if (idx >= 0) {
      accounts[idx] = { ...accounts[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_accounts", accounts);
    }
    return accounts[idx];
  },
  delete: (id: number) => {
    const idx = accounts.findIndex((a) => a.id === id);
    if (idx >= 0) {
      accounts.splice(idx, 1);
      saveItem("sgf_accounts", accounts);
    }
    return { success: idx >= 0 };
  },
};
