      for (const inv of sageInvoices) {
        const key = (inv.invoiceNumber || '').toString().trim().toLowerCase();
        if (!key) continue;
        const existing = uniqueSage.get(key);
        if (!existing || new Date(inv.createdAt).getTime() > new Date(existing.createdAt).getTime()) {
          uniqueSage.set(key, inv);
        }
      }
      const dedupedSage = Array.from(uniqueSage.values());
      return dedupedSage.filter((sageInv) => {
        const key = (sageInv.invoiceNumber || '').toString().trim().toLowerCase();
        return !nonSageInvoices.some((nonSage) => {
          const nonSageKey = (nonSage.invoiceNumber || '').toString().trim().toLowerCase();
          return nonSageKey === key;
        });
      });
    },
    getSageCustomers: () => sageCustomers,
    getSageInvoices: () => sageInvoices,
    getSagePayments: () => sagePayments,
    getSageInvoiceByNumber: (number: string) => sageInvoices.find((i) => i.invoiceNumber === number),
    getSageCustomerByAccount: (accountNumber: string) => sageCustomers.find((c) => c.accountNumber === accountNumber),
    getSagePaymentByReference: (reference: string) => sagePayments.find((p) => p.reference === reference),
    getSageSummary: () => ({
      customers: sageCustomers.length,
      invoices: sageInvoices.length,
      payments: sagePayments.length,
    }),
    // Match Sage invoices to app invoices by invoice number
    matchSageToApp: () => {
      const matches: any[] = [];
      for (const sageInv of sageInvoices) {
        const appInv = invoices.find((i) => i.invoiceNumber === sageInv.invoiceNumber);
        matches.push({
          sageInvoice: sageInv,
          appInvoice: appInv || null,
          matched: !!appInv,
        });
      }
      return matches;
    },
    // Match Sage customers to app customers by account number
    matchSageCustomersToApp: () => {
      const matches: any[] = [];
      for (const sageCust of sageCustomers) {
        const appCust = customers.find((c) => c.customerCode === sageCust.accountNumber);
        matches.push({
          sageCustomer: sageCust,
          appCustomer: appCust || null,
          matched: !!appCust,
        });
      }
      return matches;
    },
    // Match Sage payments to app receipts by reference
    matchSagePaymentsToApp: () => {
      const matches: any[] = [];
      for (const sagePay of sagePayments) {
        const appReceipt = receipts.find((r) => r.referenceNumber === sagePay.reference);
        matches.push({
          sagePayment: sagePay,
          appReceipt: appReceipt || null,
          matched: !!appReceipt,
        });
      }
      return matches;
    },
    // Get unmatched Sage invoices (no corresponding app invoice)
    getUnmatchedSageInvoices: () => {
      return sageInvoices.filter((sageInv) => !invoices.some((i) => i.invoiceNumber === sageInv.invoiceNumber));
    },
    // Get unmatched Sage customers (no corresponding app customer)
    getUnmatchedSageCustomers: () => {
      return sageCustomers.filter((sageCust) => !customers.some((c) => c.customerCode === sageCust.accountNumber));
    },
    // Get unmatched Sage payments (no corresponding app receipt)
    getUnmatchedSagePayments: () => {
      return sagePayments.filter((sagePay) => !receipts.some((r) => r.referenceNumber === sagePay.reference));
    },
    // Link Sage customer to app customer
    linkSageCustomer: ({ sageCustomerId, appCustomerId }: { sageCustomerId: number; appCustomerId: number }) => {
      const sageCust = sageCustomers.find((c) => c.id == sageCustomerId);
      const appCust = customers.find((c) => c.id == appCustomerId);
      if (!sageCust || !appCust) return { success: false, error: "Customer not found" };
      appCust.sageCustomerId = sageCustomerId;
      appCust.sageAccountNumber = sageCust.accountNumber;
      saveItem("sgf_customers", customers);
      return { success: true, customer: appCust };
    },
    // Link Sage invoice to app invoice
    linkSageInvoice: ({ sageInvoiceId, appInvoiceId }: { sageInvoiceId: number; appInvoiceId: number }) => {
      const sageInv = sageInvoices.find((i) => i.id == sageInvoiceId);
      const appInv = invoices.find((i) => i.id == appInvoiceId);
      if (!sageInv || !appInv) return { success: false, error: "Invoice not found" };
      appInv.sageInvoiceId = sageInvoiceId;
      appInv.sageInvoiceNumber = sageInv.invoiceNumber;
      saveItem("sgf_invoices", invoices);
      return { success: true, invoice: appInv };
    },
    // Auto-link all Sage customers to app customers by matching account number to customer code
    autoLinkSageCustomers: () => {
      let linked = 0;
      for (const sageCust of sageCustomers) {
        const appCust = customers.find((c) => c.customerCode === sageCust.accountNumber);
        if (appCust) {
          appCust.sageCustomerId = sageCust.id;
          appCust.sageAccountNumber = sageCust.accountNumber;
          linked++;
        }
      }
      if (linked > 0) saveItem("sgf_customers", customers);
      return { linked };
    },
    // Auto-link all Sage invoices to app invoices by matching invoice number
    autoLinkSageInvoices: () => {
      let linked = 0;
      for (const sageInv of sageInvoices) {
        const appInv = invoices.find((i) => i.invoiceNumber === sageInv.invoiceNumber);
        if (appInv) {
          appInv.sageInvoiceId = sageInv.id;
          appInv.sageInvoiceNumber = sageInv.invoiceNumber;
          linked++;
        }
      }
      if (linked > 0) saveItem("sgf_invoices", invoices);
      return { linked };
    },
    // Reconcile all Sage payments against app receipts
    reconcileSagePayments: () => {
      let matched = 0;
      let unmatched = 0;
      for (const sagePay of sagePayments) {
        const appReceipt = receipts.find((r) => r.referenceNumber === sagePay.reference);
        if (appReceipt) {
          matched++;
        } else {
          unmatched++;
        }
      }
      return { matched, unmatched };
    },
    // Get full reconciliation report
    getReconciliationReport: () => {
      const customerMatches = sageImportService.matchSageCustomersToApp();
      const invoiceMatches = sageImportService.matchSageToApp();
      const paymentMatches = sageImportService.matchSagePaymentsToApp();
      return {
        customers: { total: sageCustomers.length, matched: customerMatches.filter((m) => m.matched).length, unmatched: customerMatches.filter((m) => !m.matched).length },
        invoices: { total: sageInvoices.length, matched: invoiceMatches.filter((m) => m.matched).length, unmatched: invoiceMatches.filter((m) => !m.matched).length },
        payments: { total: sagePayments.length, matched: paymentMatches.filter((m) => m.matched).length, unmatched: paymentMatches.filter((m) => !m.matched).length },
      };
    },
    // Import Sage data and auto-link
    importAndLink: (data: { customers?: any[]; invoices?: any[]; payments?: any[] }) => {
      const results: any = {};
      if (data.customers) {
        results.customers = sageImportService.importCustomers(data.customers);
      }
      if (data.invoices) {
        results.invoices = sageImportService.importInvoices(data.invoices);
      }
      if (data.payments) {
        results.payments = sageImportService.importPayments(data.payments);
      }
      results.linkedCustomers = sageImportService.autoLinkSageCustomers();
      results.linkedInvoices = sageImportService.autoLinkSageInvoices();
      return results;
    },
  };

  // Build the service object with all methods
  const statementService = {
    generate: statementFunctions.generate,
    generateForCorporate: statementFunctions.generateForCorporate,
    getAllStatements: statementFunctions.getAllStatements,
    repairSageInvoices: statementFunctions.repairSageInvoices,
    getSageCustomers: statementFunctions.getSageCustomers,
    getSageInvoices: statementFunctions.getSageInvoices,
    getSagePayments: statementFunctions.getSagePayments,
    getSageInvoiceByNumber: statementFunctions.getSageInvoiceByNumber,
    getSageCustomerByAccount: statementFunctions.getSageCustomerByAccount,
    getSagePaymentByReference: statementFunctions.getSagePaymentByReference,
    getSageSummary: statementFunctions.getSageSummary,
    matchSageToApp: statementFunctions.matchSageToApp,
    matchSageCustomersToApp: statementFunctions.matchSageCustomersToApp,
    matchSagePaymentsToApp: statementFunctions.matchSagePaymentsToApp,
    getUnmatchedSageInvoices: statementFunctions.getUnmatchedSageInvoices,
    getUnmatchedSageCustomers: statementFunctions.getUnmatchedSageCustomers,
    getUnmatchedSagePayments: statementFunctions.getUnmatchedSagePayments,
    linkSageCustomer: statementFunctions.linkSageCustomer,
    linkSageInvoice: statementFunctions.linkSageInvoice,
    autoLinkSageCustomers: statementFunctions.autoLinkSageCustomers,
    autoLinkSageInvoices: statementFunctions.autoLinkSageInvoices,
    reconcileSagePayments: statementFunctions.reconcileSagePayments,
    getReconciliationReport: statementFunctions.getReconciliationReport,
    importAndLink: statementFunctions.importAndLink,
  };

  return statementService;
}

const sageImportService = buildSageImportService();

// =============================================================================
// SALES REP SERVICE
// =============================================================================

export const salesRepService = {
  list: () => SALES_REPS,
  getById: (id: number) => SALES_REPS.find((r) => r.id === id) || null,
  getByName: (name: string) => SALES_REPS.find((r) => r.name === name) || null,
};

// =============================================================================
// USER SERVICE
// =============================================================================

export const userService = {
  list: () => users,
  getById: (id: number) => users.find((u) => u.id == id) || null,
  getByEmail: (email: string) => users.find((u) => u.email === email) || null,
  create: (data: any) => {
    const newItem = {
      ...data,
      id: Date.now(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    users.push(newItem);
    saveItem("sgf_users", users);
    logAudit("CREATE", "user", newItem.id, `User created: ${newItem.name || ""}`);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = users.findIndex((u) => u.id == id);
    if (idx >= 0) {
      users[idx] = { ...users[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_users", users);
      logAudit("UPDATE", "user", id, `User updated: ${users[idx].name || ""}`);
    }
    return users[idx];
  },
  delete: (id: number) => {
    const idx = users.findIndex((u) => u.id == id);
    if (idx >= 0) {
      users.splice(idx, 1);
      saveItem("sgf_users", users);
      logAudit("DELETE", "user", id, "User deleted");
    }
    return { success: idx >= 0 };
  },
  toggleActive: (id: number) => {
    const idx = users.findIndex((u) => u.id == id);
    if (idx >= 0) {
      const wasActive = users[idx].isActive !== false;
      users[idx].isActive = users[idx].isActive === false ? true : false;
      saveItem("sgf_users", users);
      logAudit("TOGGLE_ACTIVE", "user", id, `User ${users[idx].name || ""} ${wasActive ? "deactivated" : "activated"}`);
    }
    return users[idx];
  },
};

// =============================================================================
// ROLE SERVICE
// =============================================================================

export const roleService = {
  list: () => roles,
  getById: (id: number) => roles.find((r) => r.id == id) || null,
  create: (data: any) => {
    const newItem = {
      ...data,
      id: Date.now(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    roles.push(newItem);
    saveItem("sgf_roles", roles);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = roles.findIndex((r) => r.id == id);
    if (idx >= 0) {
      roles[idx] = { ...roles[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_roles", roles);
    }
    return roles[idx];
  },
  delete: (id: number) => {
    const idx = roles.findIndex((r) => r.id == id);
    if (idx >= 0) {
      roles.splice(idx, 1);
      saveItem("sgf_roles", roles);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// PERMISSION SERVICE
// =============================================================================

export const permissionService = {
  list: () => permissions,
  getById: (id: number) => permissions.find((p) => p.id == id) || null,
  getByRole: (roleId: number) => permissions.filter((p) => p.roleId == roleId),
  create: (data: any) => {
    const newItem = {
      ...data,
      id: Date.now(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    permissions.push(newItem);
    saveItem("sgf_permissions", permissions);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = permissions.findIndex((p) => p.id == id);
    if (idx >= 0) {
      permissions[idx] = { ...permissions[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_permissions", permissions);
    }
    return permissions[idx];
  },
  delete: (id: number) => {
    const idx = permissions.findIndex((p) => p.id == id);
    if (idx >= 0) {
      permissions.splice(idx, 1);
      saveItem("sgf_permissions", permissions);
    }
    return { success: idx >= 0 };
  },
};
