// =============================================================================
// STATEMENT SERVICE — Customer Account Statements
// =============================================================================

export const statementService = {
  getCustomerStatement: (customerId: number, startDate?: string, endDate?: string) => {
    const customer = customers.find((c) => c.id === customerId);
    if (!customer) return null;

    let customerInvoices = invoices.filter((i) => i.customerId === customerId);
    let customerReceipts = receipts.filter((r) => r.customerId === customerId);
    let customerCreditNotes = creditNotes.filter((c) => c.customerId === customerId);

    if (startDate) {
      customerInvoices = customerInvoices.filter((i) => i.invoiceDate >= startDate);
      customerReceipts = customerReceipts.filter((r) => r.receiptDate >= startDate);
      customerCreditNotes = customerCreditNotes.filter((c) => c.creditNoteDate >= startDate);
    }
    if (endDate) {
      customerInvoices = customerInvoices.filter((i) => i.invoiceDate <= endDate);
      customerReceipts = customerReceipts.filter((r) => r.receiptDate <= endDate);
      customerCreditNotes = customerCreditNotes.filter((c) => c.creditNoteDate <= endDate);
    }

    const transactions = [
      ...customerInvoices.map((i) => ({
        date: i.invoiceDate,
        type: "invoice" as const,
        reference: i.invoiceNumber,
        description: `Invoice ${i.invoiceNumber}`,
        debit: i.total || 0,
        credit: 0,
        balance: 0,
      })),
      ...customerReceipts.map((r) => ({
        date: r.receiptDate,
        type: "receipt" as const,
        reference: r.receiptNumber || `RCP-${r.id}`,
        description: `Receipt ${r.receiptNumber || r.id}`,
        debit: 0,
        credit: r.amount || 0,
        balance: 0,
      })),
      ...customerCreditNotes.map((c) => ({
        date: c.creditNoteDate,
        type: "credit_note" as const,
        reference: c.creditNoteNumber || `CN-${c.id}`,
        description: `Credit Note ${c.creditNoteNumber || c.id}`,
        debit: 0,
        credit: c.amount || 0,
        balance: 0,
      })),
    ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let runningBalance = 0;
    for (const tx of transactions) {
      runningBalance += tx.debit - tx.credit;
      tx.balance = runningBalance;
    }

    const totalInvoiced = customerInvoices.reduce((sum, i) => sum + (i.total || 0), 0);
    const totalPaid = customerReceipts.reduce((sum, r) => sum + (r.amount || 0), 0);
    const totalCredits = customerCreditNotes.reduce((sum, c) => sum + (c.amount || 0), 0);

    return {
      customer,
      transactions,
      summary: {
        totalInvoiced,
        totalPaid,
        totalCredits,
        balanceDue: totalInvoiced - totalPaid - totalCredits,
        invoiceCount: customerInvoices.length,
        receiptCount: customerReceipts.length,
        creditNoteCount: customerCreditNotes.length,
      },
    };
  },

  getAllStatements: (startDate?: string, endDate?: string) => {
    return customers
      .map((c) => statementService.getCustomerStatement(c.id, startDate, endDate))
      .filter(Boolean);
  },
};

// =============================================================================
// CUSTOMER CREDIT LIMIT SERVICE
// =============================================================================

export const creditLimitService = {
  getCreditLimit: (customerId: number) => {
    const customer = customers.find((c) => c.id === customerId);
    return customer?.creditLimit || 0;
  },
  setCreditLimit: (customerId: number, limit: number) => {
    const customer = customers.find((c) => c.id === customerId);
    if (!customer) return { success: false, error: "Customer not found" };
    customer.creditLimit = limit;
    customer.updatedAt = new Date().toISOString();
    saveItem("sgf_customers", customers);
    logAudit("update", "customerCreditLimit", customerId, { limit });
    return { success: true, customer };
  },
  getAvailableCredit: (customerId: number) => {
    const limit = creditLimitService.getCreditLimit(customerId);
    const balance = paymentReminderService.getCustomerBalance(customerId);
    return Math.max(0, limit - balance);
  },
  checkCreditLimit: (customerId: number, additionalAmount: number = 0) => {
    const limit = creditLimitService.getCreditLimit(customerId);
    if (limit <= 0) return { exceeded: false, available: Infinity };
    const balance = paymentReminderService.getCustomerBalance(customerId);
    const available = limit - balance;
    return { exceeded: additionalAmount > available, available };
  },
};

// =============================================================================
// CUSTOMER PRICE TIER SERVICE
// =============================================================================

export const priceTierService = {
  getPriceTier: (customerId: number) => {
    const customer = customers.find((c) => c.id === customerId);
    return customer?.priceTier || "wholesale";
  },
  setPriceTier: (customerId: number, tier: string) => {
    const customer = customers.find((c) => c.id === customerId);
    if (!customer) return { success: false, error: "Customer not found" };
    customer.priceTier = tier;
    customer.updatedAt = new Date().toISOString();
    saveItem("sgf_customers", customers);
    logAudit("update", "customerPriceTier", customerId, { tier });
    return { success: true, customer };
  },
  getTierPrice: (customerId: number, productId: number) => {
    const tier = priceTierService.getPriceTier(customerId);
    return getEffectivePrice(productId, tier, customerId);
  },
};

// =============================================================================
// CUSTOMER CLASSIFICATION SERVICE
// =============================================================================

export const customerClassificationService = {
  getClassification: (customerId: number) => {
    const customer = customers.find((c) => c.id === customerId);
    return customer?.classification || "standard";
  },
  setClassification: (customerId: number, classification: string) => {
    const customer = customers.find((c) => c.id === customerId);
    if (!customer) return { success: false, error: "Customer not found" };
    customer.classification = classification;
    customer.updatedAt = new Date().toISOString();
    saveItem("sgf_customers", customers);
    logAudit("update", "customerClassification", customerId, { classification });
    return { success: true, customer };
  },
  getClassifiedCustomers: (classification: string) => {
    return customers.filter((c) => c.classification === classification);
  },
};

// =============================================================================
// CUSTOMER STOP LIST / HOLD SERVICE
// =============================================================================

export const stopListService = {
  getStopList: () => {
    return customers.filter((c) => c.onStopList === true);
  },
  addToStopList: (customerId: number, reason: string) => {
    const customer = customers.find((c) => c.id === customerId);
    if (!customer) return { success: false, error: "Customer not found" };
    customer.onStopList = true;
    customer.stopListReason = reason;
    customer.stopListDate = new Date().toISOString();
    customer.updatedAt = new Date().toISOString();
    saveItem("sgf_customers", customers);
    logAudit("update", "customerStopList", customerId, { reason, action: "added" });
    return { success: true, customer };
  },
  removeFromStopList: (customerId: number) => {
    const customer = customers.find((c) => c.id === customerId);
    if (!customer) return { success: false, error: "Customer not found" };
    customer.onStopList = false;
    customer.stopListReason = undefined;
    customer.stopListDate = undefined;
    customer.updatedAt = new Date().toISOString();
    saveItem("sgf_customers", customers);
    logAudit("update", "customerStopList", customerId, { action: "removed" });
    return { success: true, customer };
  },
  isOnStopList: (customerId: number) => {
    const customer = customers.find((c) => c.id === customerId);
    return customer?.onStopList === true;
  },
};
