      const custCode = customer?.customerCode;
      // Match by customerId (app + linked Sage) OR by customerCode (unlinked Sage)
      // Uses trimmed lowercase comparison for robust matching
      const sageCustInvoices = sageInvoices.filter((si) => {
        const sageCode = (si.accountNumber || "").toString().trim().toLowerCase();
        const matchedByCode = custCode && sageCode && custCode.toLowerCase() === sageCode;
        const matchedById = si.customerId != null && si.customerId == customerId;
        return matchedByCode || matchedById;
      });

      // Build combined list: app invoices + Sage invoices not in app
      const appInvoiceNumbers = new Set(invoices.map((i) => (i.invoiceNumber || "").toString().trim().toLowerCase()));
      const combinedInvoices = [
        ...invoices.filter((i) => i.customerId == customerId),
        ...sageCustInvoices.filter((si) => !appInvoiceNumbers.has((si.invoiceNumber || "").toString().trim().toLowerCase())),
      ].sort((a, b) => new Date(a.createdAt || a.invoiceDate).getTime() - new Date(b.createdAt || b.invoiceDate).getTime());

      const totalValue = combinedInvoices.reduce((sum, i) => sum + (i.total || 0), 0);
      const totalPaid = combinedInvoices.reduce((sum, i) => sum + (i.amountPaid || 0), 0);
      const outstanding = combinedInvoices
        .filter((i) => i.status !== "cancelled")
        .reduce((sum, i) => sum + ((i.balanceDue != null ? i.balanceDue : (i.total || 0) - (i.amountPaid || 0))), 0);
      const sageCount = sageCustInvoices.length;
      const sageOutstanding = sageCustInvoices
        .filter((i) => i.status !== "cancelled")
        .reduce((sum, i) => sum + ((i.balanceDue != null ? i.balanceDue : (i.total || 0) - (i.amountPaid || 0))), 0);

      return {
        customer,
        invoices: combinedInvoices,
        totalInvoices: combinedInvoices.length,
        paid: combinedInvoices.filter((i) => i.status === "paid").length,
        sent: combinedInvoices.filter((i) => i.status === "sent").length,
        draft: combinedInvoices.filter((i) => i.status === "draft").length,
        overdue: combinedInvoices.filter((i) => i.status === "overdue").length,
        cancelled: combinedInvoices.filter((i) => i.status === "cancelled").length,
        totalValue,
        totalPaid,
        outstanding,
        sageCount,
