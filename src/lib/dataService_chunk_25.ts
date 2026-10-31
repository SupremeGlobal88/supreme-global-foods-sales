      const idx = creditNotes.findIndex((cn) => cn.id == creditNoteId);
      if (idx < 0) return { success: false, error: "Credit note not found" };
      const cn = creditNotes[idx];
      if (cn.voidedAt) return { success: false, error: "Credit note already voided" };
      cn.voidedAt = new Date().toISOString();
      cn.status = "voided";
      cn.updatedAt = new Date().toISOString();
      saveItem("sgf_creditNotes", creditNotes);
      logAudit("VOID", "creditNote", creditNoteId, `Credit note ${cn.creditNoteNumber} voided`);
      return { success: true, creditNote: cn };
    },
    getOpenCredits: () => creditNotes.filter((cn) => cn.status === "open" || cn.status === "partially_applied"),
    getCustomerBalance: (customerId: number) => {
      const customerInvoices = invoices.filter((i) => i.customerId == customerId && i.status !== "cancelled");
      const totalInvoiced = customerInvoices.reduce((sum, i) => sum + (i.total || 0), 0);
      const totalPaid = customerInvoices.reduce((sum, i) => sum + (i.amountPaid || 0), 0);
      const totalCredits = customerInvoices.reduce((sum, i) => sum + (i.creditsApplied || 0), 0);
      return { totalInvoiced, totalPaid, totalCredits, balanceDue: totalInvoiced - totalPaid - totalCredits };
    },
  },

  // =============================================================================
  // STATEMENT SERVICE
  // =============================================================================

  statement: {
    generate: ({ customerId, fromDate, toDate, invoiceIds }: any) => {
      const customer = customers.find((c) => c.id == customerId);
      if (!customer) return null;

      const fromTs = fromDate ? new Date(fromDate + "T00:00:00").getTime() : 0;
      const toTs = toDate ? new Date(toDate + "T23:59:59").getTime() : Date.now();

      // Filter invoices by date range and customer
      let customerInvoices = invoices
        .filter((i) => i.customerId == customerId && i.status !== "cancelled")
        .filter((i) => {
          const ts = new Date(i.createdAt || i.invoiceDate).getTime();
          return ts >= fromTs && ts <= toTs;
        })
        .sort((a, b) => new Date(a.createdAt || a.invoiceDate).getTime() - new Date(b.createdAt || b.invoiceDate).getTime());

      // If specific invoiceIds provided, filter to those
      if (invoiceIds && invoiceIds.length > 0) {
        customerInvoices = customerInvoices.filter((i) => invoiceIds.includes(i.id));
      }

      const totalInvoiced = customerInvoices.reduce((sum, i) => sum + (i.total || 0), 0);
      const totalPaid = customerInvoices.reduce((sum, i) => sum + (i.amountPaid || 0), 0);
      const totalCredits = customerInvoices.reduce((sum, i) => sum + (i.creditsApplied || 0), 0);
      const balanceDue = totalInvoiced - totalPaid - totalCredits;

      return {
        customer,
        fromDate,
        toDate,
        generatedAt: new Date().toISOString(),
        invoices: customerInvoices,
        totalInvoiced,
        totalPaid,
        totalCredits,
        balanceDue,
        totalOutstanding: balanceDue,
      };
    },
    generateForCorporate: ({ corporateCustomerId, fromDate, toDate }: any) => {
      const corporateCustomer = corporateCustomers.find((c) => c.id == corporateCustomerId);
      if (!corporateCustomer) return null;

      const fromTs = fromDate ? new Date(fromDate + "T00:00:00").getTime() : 0;
      const toTs = toDate ? new Date(toDate + "T23:59:59").getTime() : Date.now();

      // Get all purchase orders for this corporate customer
      const poIds = purchaseOrders
        .filter((po) => po.corporateCustomerId == corporateCustomerId)
        .map((po) => po.id);

      // Get invoices linked to those purchase orders
      let customerInvoices = invoices
        .filter((i) => i.purchaseOrderId != null && poIds.includes(i.purchaseOrderId) && i.status !== "cancelled")
        .filter((i) => {
          const ts = new Date(i.createdAt || i.invoiceDate).getTime();
          return ts >= fromTs && ts <= toTs;
        })
        .sort((a, b) => new Date(a.createdAt || a.invoiceDate).getTime() - new Date(b.createdAt || b.invoiceDate).getTime());

      const totalInvoiced = customerInvoices.reduce((sum, i) => sum + (i.total || 0), 0);
      const totalPaid = customerInvoices.reduce((sum, i) => sum + (i.amountPaid || 0), 0);
      const totalCredits = customerInvoices.reduce((sum, i) => sum + (i.creditsApplied || 0), 0);
      const balanceDue = totalInvoiced - totalPaid - totalCredits;

      return {
        customer: corporateCustomer,
        fromDate,
        toDate,
        generatedAt: new Date().toISOString(),
        invoices: customerInvoices,
        totalInvoiced,
        totalPaid,
        totalCredits,
        balanceDue,
        totalOutstanding: balanceDue,
      };
    },
    getAllStatements: () => {
      const statements: any[] = [];
      for (const customer of customers) {
        const customerInvoices = invoices.filter((i) => i.customerId == customer.id && i.status !== "cancelled");
        if (customerInvoices.length === 0) continue;
        const totalInvoiced = customerInvoices.reduce((sum, i) => sum + (i.total || 0), 0);
        const totalPaid = customerInvoices.reduce((sum, i) => sum + (i.amountPaid || 0), 0);
        const totalCredits = customerInvoices.reduce((sum, i) => sum + (i.creditsApplied || 0), 0);
        const balanceDue = totalInvoiced - totalPaid - totalCredits;
        statements.push({
          customer,
          totalInvoiced,
          totalPaid,
          totalCredits,
          balanceDue,
          invoiceCount: customerInvoices.length,
        });
      }
      return statements.sort((a, b) => b.balanceDue - a.balanceDue);
    },
    // Repair Sage invoices that have no linked order by creating orders from them
    repairSageInvoices: () => {
      const sageInvoicesWithoutOrder = invoices.filter(i => i.source === 'sage' || !i.orderId);
      const nonSageInvoices = invoices.filter(i => i.source !== 'sage' && i.orderId);
      const uniqueSage = new Map<string, any>();
