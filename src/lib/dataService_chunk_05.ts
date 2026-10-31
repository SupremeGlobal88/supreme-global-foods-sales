// =============================================================================
// COLLECTION PROMISE SERVICE
// =============================================================================

export const collectionPromiseService = {
  list: () => collectionPromises,
  getById: (id: number) => collectionPromises.find((c) => c.id === id),
  getByCustomer: (customerId: number) => collectionPromises.filter((c) => c.customerId === customerId),
  getByInvoice: (invoiceId: number) => collectionPromises.filter((c) => c.invoiceId === invoiceId),
  getBySalesRep: (repName: string) => collectionPromises.filter((c) => c.salesRepName === repName),
  getOverdue: () => collectionPromises.filter((c) => new Date(c.promiseDate) < new Date() && c.status !== "fulfilled" && c.status !== "broken"),
  getUpcoming: () => collectionPromises.filter((c) => new Date(c.promiseDate) >= new Date()),
  create: (data: any) => {
    const newPromise = {
      id: Date.now() + Math.random(),
      ...data,
      status: data.status || "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    collectionPromises.push(newPromise);
    saveItem("sgf_collectionPromises", collectionPromises);
    logAudit("create", "collectionPromise", newPromise.id, data);
    return newPromise;
  },
  update: (id: number, data: any) => {
    const index = collectionPromises.findIndex((c) => c.id === id);
    if (index === -1) return null;
    collectionPromises[index] = { ...collectionPromises[index], ...data, updatedAt: new Date().toISOString() };
    saveItem("sgf_collectionPromises", collectionPromises);
    logAudit("update", "collectionPromise", id, data);
    return collectionPromises[index];
  },
  delete: (id: number) => {
    const index = collectionPromises.findIndex((c) => c.id === id);
    if (index === -1) return { success: false, error: "Collection promise not found" };
    collectionPromises.splice(index, 1);
    saveItem("sgf_collectionPromises", collectionPromises);
    logAudit("delete", "collectionPromise", id, {});
    return { success: true };
  },
};

// =============================================================================
// ACCOUNT HOLD SERVICE
// =============================================================================

export const accountHoldService = {
  list: () => accountHolds,
  getById: (id: number) => accountHolds.find((a) => a.id === id),
  getByCustomer: (customerId: number) => accountHolds.filter((a) => a.customerId === customerId),
  getActive: () => accountHolds.filter((a) => a.status === "active"),
  create: (data: any) => {
    const newHold = {
      id: Date.now() + Math.random(),
      ...data,
      status: data.status || "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    accountHolds.push(newHold);
    saveItem("sgf_accountHolds", accountHolds);
    logAudit("create", "accountHold", newHold.id, data);
    return newHold;
  },
  update: (id: number, data: any) => {
    const index = accountHolds.findIndex((a) => a.id === id);
    if (index === -1) return null;
    accountHolds[index] = { ...accountHolds[index], ...data, updatedAt: new Date().toISOString() };
    saveItem("sgf_accountHolds", accountHolds);
    logAudit("update", "accountHold", id, data);
    return accountHolds[index];
  },
  delete: (id: number) => {
    const index = accountHolds.findIndex((a) => a.id === id);
    if (index === -1) return { success: false, error: "Account hold not found" };
    accountHolds.splice(index, 1);
    saveItem("sgf_accountHolds", accountHolds);
    logAudit("delete", "accountHold", id, {});
    return { success: true };
  },
};

// =============================================================================
// RECEIPT SERVICE
// =============================================================================

export const receiptService = {
  list: () => receipts,
  getById: (id: number) => receipts.find((r) => r.id === id),
  getByCustomer: (customerId: number) => receipts.filter((r) => r.customerId === customerId),
  getByInvoice: (invoiceId: number) => receipts.filter((r) => r.invoiceId === invoiceId),
  getByDate: (date: string) => receipts.filter((r) => r.receiptDate === date),
  create: (data: any) => {
    const newReceipt = {
      id: Date.now() + Math.random(),
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    receipts.push(newReceipt);
    saveItem("sgf_receipts", receipts);
    logAudit("create", "receipt", newReceipt.id, data);
    return newReceipt;
  },
  update: (id: number, data: any) => {
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
    receipts.splice(index, 1);
    saveItem("sgf_receipts", receipts);
    logAudit("delete", "receipt", id, {});
    return { success: true };
  },
};

// =============================================================================
// CREDIT NOTE SERVICE
// =============================================================================

export const creditNoteService = {
  list: () => creditNotes,
  getById: (id: number) => creditNotes.find((c) => c.id === id),
  getByCustomer: (customerId: number) => creditNotes.filter((c) => c.customerId === customerId),
  getByInvoice: (invoiceId: number) => creditNotes.filter((c) => c.invoiceId === invoiceId),
  getByDate: (date: string) => creditNotes.filter((c) => c.creditNoteDate === date),
  create: (data: any) => {
    const newCreditNote = {
      id: Date.now() + Math.random(),
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    creditNotes.push(newCreditNote);
    saveItem("sgf_creditNotes", creditNotes);
    logAudit("create", "creditNote", newCreditNote.id, data);
    return newCreditNote;
  },
  update: (id: number, data: any) => {
    const index = creditNotes.findIndex((c) => c.id === id);
    if (index === -1) return null;
    creditNotes[index] = { ...creditNotes[index], ...data, updatedAt: new Date().toISOString() };
    saveItem("sgf_creditNotes", creditNotes);
    logAudit("update", "creditNote", id, data);
    return creditNotes[index];
  },
  delete: (id: number) => {
    const index = creditNotes.findIndex((c) => c.id === id);
    if (index === -1) return { success: false, error: "Credit note not found" };
    creditNotes.splice(index, 1);
    saveItem("sgf_creditNotes", creditNotes);
    logAudit("delete", "creditNote", id, {});
    return { success: true };
  },
};

// =============================================================================
// SPECIAL PRICE SERVICE
// =============================================================================

export const specialPriceService = {
  list: () => specialPrices,
  getById: (id: number) => specialPrices.find((s) => s.id === id),
  getByCustomer: (customerId: number) => specialPrices.filter((s) => s.customerId === customerId),
  getByProduct: (productId: number) => specialPrices.filter((s) => s.productId === productId),
  getByCustomerAndProduct: (customerId: number, productId: number) =>
    specialPrices.find((s) => s.customerId === customerId && s.productId === productId),
  create: (data: any) => {
    const existing = specialPrices.find(
      (s) => s.customerId === data.customerId && s.productId === data.productId
    );
    if (existing) {
      existing.specialPrice = data.specialPrice;
      existing.updatedAt = new Date().toISOString();
      saveItem("sgf_specialPrices", specialPrices);
      return existing;
    }
    const newSpecialPrice = {
      id: Date.now() + Math.random(),
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    specialPrices.push(newSpecialPrice);
    saveItem("sgf_specialPrices", specialPrices);
    logAudit("create", "specialPrice", newSpecialPrice.id, data);
    return newSpecialPrice;
  },
  update: (id: number, data: any) => {
    const index = specialPrices.findIndex((s) => s.id === id);
    if (index === -1) return null;
    specialPrices[index] = { ...specialPrices[index], ...data, updatedAt: new Date().toISOString() };
    saveItem("sgf_specialPrices", specialPrices);
    logAudit("update", "specialPrice", id, data);
    return specialPrices[index];
  },
  delete: (id: number) => {
    const index = specialPrices.findIndex((s) => s.id === id);
    if (index === -1) return { success: false, error: "Special price not found" };
    specialPrices.splice(index, 1);
    saveItem("sgf_specialPrices", specialPrices);
    logAudit("delete", "specialPrice", id, {});
    return { success: true };
  },
};
