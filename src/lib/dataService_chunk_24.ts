      if (invIdx < 0) return { success: false, error: "Invoice not found" };
      const inv = invoices[invIdx];

      const currentBalance = typeof inv.balanceDue === "number" ? inv.balanceDue : (inv.total || 0) - (inv.amountPaid || 0);
      const creditApplied = Math.min(amount, currentBalance);
      const newBalance = Math.max(0, currentBalance - creditApplied);

      inv.balanceDue = newBalance;
      inv.amountPaid = (inv.amountPaid || 0) + creditApplied;
      inv.status = newBalance <= 0.01 ? "paid" : "sent";
      inv.updatedAt = new Date().toISOString();

      cn.remainingAmount = remaining - creditApplied;
      cn.status = cn.remainingAmount <= 0.01 ? "fully_applied" : "partially_applied";
      cn.updatedAt = new Date().toISOString();

      saveItem("sgf_creditNotes", creditNotes);
      saveItem("sgf_invoices", invoices);
      logAudit("APPLY", "creditNote", creditNoteId, `Credit note applied: R${creditApplied.toFixed(2)} to invoice ${inv.invoiceNumber}`);
      return { success: true, invoice: inv, creditNote: cn };
    },
    createCreditNoteFromInvoice: ({ invoiceId, reason }: { invoiceId: number; reason: string }) => {
      const inv = invoices.find((i) => i.id == invoiceId);
      if (!inv) return { success: false, error: "Invoice not found" };
      const total = inv.total || inv.totalAmount || 0;
      const paid = inv.amountPaid || 0;
      const creditTotal = Math.max(0, total - paid);
      if (creditTotal <= 0) return { success: false, error: "Invoice has no remaining balance to credit" };

      const creditNote = {
        id: Date.now(),
        creditNoteNumber: `CN-${String(creditNotes.length + 1).padStart(3, "0")}`,
        customerId: inv.customerId,
        customerName: inv.customerName,
        invoiceId,
        invoiceNumber: inv.invoiceNumber,
        amount: creditTotal,
        remainingAmount: creditTotal,
        reason: reason || "",
        status: "open",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      creditNotes.push(creditNote);
      saveItem("sgf_creditNotes", creditNotes);
      logAudit("CREATE", "creditNote", creditNote.id, `Credit note ${creditNote.creditNoteNumber} created from invoice ${inv.invoiceNumber}`);
      return { success: true, creditNote };
    },
    voidCreditNote: (id: number) => {
      const idx = creditNotes.findIndex((cn) => cn.id == id);
      if (idx >= 0) {
        creditNotes[idx].status = "voided";
        creditNotes[idx].updatedAt = new Date().toISOString();
        saveItem("sgf_creditNotes", creditNotes);
      }
      return { success: idx >= 0 };
    },
    getCreditNoteStats: () => ({
      total: creditNotes.length,
      open: creditNotes.filter((cn) => cn.status === "open").length,
      applied: creditNotes.filter((cn) => cn.status === "fully_applied" || cn.status === "partially_applied").length,
      voided: creditNotes.filter((cn) => cn.status === "voided").length,
      totalValue: Math.round(creditNotes.reduce((sum, cn) => sum + (cn.amount || 0), 0) * 100) / 100,
    }),
  },

  // =============================================================================
  // SAGE IMPORT SERVICE
  // =============================================================================

  sageImport: {
    importCustomers: (data: any[]) => {
      let created = 0;
      let updated = 0;
      for (const item of data) {
        const existingIdx = sageCustomers.findIndex((c) => c.accountNumber === item.accountNumber);
        if (existingIdx >= 0) {
          sageCustomers[existingIdx] = { ...sageCustomers[existingIdx], ...item, updatedAt: new Date().toISOString() };
          updated++;
        } else {
          sageCustomers.push({ ...item, id: Date.now() + created, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
          created++;
        }
      }
      saveItem("sgf_sageCustomers", sageCustomers);
      return { created, updated };
    },
    importInvoices: (data: any[]) => {
      let created = 0;
      let updated = 0;
      for (const item of data) {
        const existingIdx = sageInvoices.findIndex((i) => i.invoiceNumber === item.invoiceNumber);
        if (existingIdx >= 0) {
          sageInvoices[existingIdx] = { ...sageInvoices[existingIdx], ...item, updatedAt: new Date().toISOString() };
          updated++;
        } else {
          sageInvoices.push({ ...item, id: Date.now() + created, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
          created++;
        }
      }
      saveItem("sgf_sageInvoices", sageInvoices);
      return { created, updated };
    },
    importPayments: (data: any[]) => {
      let created = 0;
      let updated = 0;
      for (const item of data) {
        const existingIdx = sagePayments.findIndex((p) => p.reference === item.reference);
        if (existingIdx >= 0) {
          sagePayments[existingIdx] = { ...sagePayments[existingIdx], ...item, updatedAt: new Date().toISOString() };
          updated++;
        } else {
          sagePayments.push({ ...item, id: Date.now() + created, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
          created++;
        }
      }
      saveItem("sgf_sagePayments", sagePayments);
      return { created, updated };
    },
    reconcile: () => {
      // Match Sage invoices to app invoices
      const results: any[] = [];
      for (const sageInv of sageInvoices) {
        const appInv = invoices.find((i) => i.invoiceNumber === sageInv.invoiceNumber);
        if (appInv) {
          const sageTotal = Number(sageInv.total) || 0;
          const appTotal = Number(appInv.total) || 0;
          const diff = Math.abs(sageTotal - appTotal);
          results.push({
            invoiceNumber: sageInv.invoiceNumber,
            sageTotal,
            appTotal,
            difference: diff,
            matched: diff < 0.01,
          });
        }
      }
      return results;
    },
    getSummary: () => ({
      customers: sageCustomers.length,
      invoices: sageInvoices.length,
      payments: sagePayments.length,
    }),
  },

  // =============================================================================
  // REPORT SERVICE
  // =============================================================================

  report: {
    salesSummary: ({ from, to }: { from: string; to: string }) => {
      const fromTs = new Date(from + "T00:00:00").getTime();
      const toTs = new Date(to + "T23:59:59").getTime();
      const periodOrders = orders.filter((o) => {
        const ts = new Date(o.createdAt).getTime();
        return ts >= fromTs && ts <= toTs && o.status !== "cancelled" && o.orderType !== "quote";
      });
      const totalSales = periodOrders.reduce((sum, o) => sum + (o.total || 0), 0);
      const totalOrders = periodOrders.length;
      const avgOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;
      return { totalSales, totalOrders, avgOrderValue, periodOrders };
    },
    customerSales: ({ from, to }: { from: string; to: string }) => {
      const fromTs = new Date(from + "T00:00:00").getTime();
      const toTs = new Date(to + "T23:59:59").getTime();
      const customerSales: Record<number, { customerId: number; customerName: string; total: number; orders: number }> = {};
      for (const order of orders) {
        const ts = new Date(order.createdAt).getTime();
        if (ts < fromTs || ts > toTs || order.status === "cancelled" || order.orderType === "quote") continue;
        const cid = order.customerId;
        if (!customerSales[cid]) {
          const customer = customers.find((c) => c.id == cid);
          customerSales[cid] = { customerId: cid, customerName: customer?.name || "Unknown", total: 0, orders: 0 };
        }
        customerSales[cid].total += order.total || 0;
        customerSales[cid].orders++;
      }
      return Object.values(customerSales).sort((a, b) => b.total - a.total);
    },
    productSales: ({ from, to }: { from: string; to: string }) => {
      const fromTs = new Date(from + "T00:00:00").getTime();
      const toTs = new Date(to + "T23:59:59").getTime();
      const productSales: Record<number, { productId: number; productName: string; totalQty: number; totalRevenue: number }> = {};
      for (const order of orders) {
        const ts = new Date(order.createdAt).getTime();
        if (ts < fromTs || ts > toTs || order.status === "cancelled" || order.orderType === "quote") continue;
        for (const item of (order.items || [])) {
          const pid = item.stockItemId;
          if (!productSales[pid]) {
            const product = products.find((p) => p.id == pid);
            productSales[pid] = { productId: pid, productName: product?.name || item.productName || "Unknown", totalQty: 0, totalRevenue: 0 };
          }
          productSales[pid].totalQty += item.quantity || 0;
          productSales[pid].totalRevenue += item.lineTotal || 0;
        }
      }
      return Object.values(productSales).sort((a, b) => b.totalRevenue - a.totalRevenue);
    },
    repPerformance: ({ from, to }: { from: string; to: string }) => {
      const fromTs = new Date(from + "T00:00:00").getTime();
      const toTs = new Date(to + "T23:59:59").getTime();
      const repPerformance: Record<string, { repName: string; totalSales: number; orders: number; customers: number }> = {};
      for (const order of orders) {
        const ts = new Date(order.createdAt).getTime();
        if (ts < fromTs || ts > toTs || order.status === "cancelled" || order.orderType === "quote") continue;
        const customer = customers.find((c) => c.id == order.customerId);
        const repName = customer?.salesRepName || "Unassigned";
        if (!repPerformance[repName]) {
          repPerformance[repName] = { repName, totalSales: 0, orders: 0, customers: 0 };
        }
        repPerformance[repName].totalSales += order.total || 0;
        repPerformance[repName].orders++;
      }
      return Object.values(repPerformance).sort((a, b) => b.totalSales - a.totalSales);
    },
    agingReport: () => {
      const now = new Date();
      const buckets = {
        current: [] as any[],
        days1to30: [] as any[],
        days31to60: [] as any[],
        days61to90: [] as any[],
        over90: [] as any[],
      };
      for (const inv of invoices) {
        if (inv.status === "cancelled" || (inv.balanceDue || 0) <= 0.01) continue;
        const dueDate = new Date(inv.dueDate || inv.createdAt);
        const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / 86400000);
        const item = { ...inv, daysOverdue };
        if (daysOverdue <= 0) buckets.current.push(item);
        else if (daysOverdue <= 30) buckets.days1to30.push(item);
        else if (daysOverdue <= 60) buckets.days31to60.push(item);
        else if (daysOverdue <= 90) buckets.days61to90.push(item);
        else buckets.over90.push(item);
      }
      return buckets;
    },
  },
