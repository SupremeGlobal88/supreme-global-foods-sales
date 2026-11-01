      if (fromIdx < 0) return { success: false, error: "Source invoice not found" };
      if (toIdx < 0) return { success: false, error: "Target invoice not found" };

      const fromInv = invoices[fromIdx];
      const toInv = invoices[toIdx];

      // Source invoice must have negative balance (overpayment)
      const fromBalance = typeof fromInv.balanceDue === "number" ? fromInv.balanceDue : (fromInv.total || 0) - (fromInv.amountPaid || 0);
      const overpaymentAmount = Math.abs(Math.min(0, fromBalance));
      if (overpaymentAmount < 0.01) return { success: false, error: "Source invoice has no overpayment credit" };

      // Target invoice must have positive balance
      const toBalance = typeof toInv.balanceDue === "number" ? toInv.balanceDue : (toInv.total || 0) - (toInv.amountPaid || 0);
      if (toBalance < 0.01) return { success: false, error: "Target invoice has no balance due" };

      // Cap amount at available overpayment and target balance
      const allocAmount = Math.min(amount, overpaymentAmount, toBalance);
      if (allocAmount < 0.01) return { success: false, error: "Nothing to allocate" };

      // Reduce overpayment on source invoice (increase its balance toward zero)
      const newFromBalance = fromBalance + allocAmount;
      invoices[fromIdx] = {
        ...fromInv,
        balanceDue: newFromBalance,
        status: newFromBalance <= 0.01 ? "paid" : (newFromBalance > 0.01 ? (fromInv.amountPaid > 0.01 ? "partially_paid" : "sent") : fromInv.status),
        updatedAt: new Date().toISOString(),
      };

      // Reduce balance on target invoice
      const newToBalance = Math.max(0, toBalance - allocAmount);
      invoices[toIdx] = {
        ...toInv,
        balanceDue: newToBalance,
        status: newToBalance <= 0.01 ? "paid" : (toInv.amountPaid > 0.01 ? "partially_paid" : "sent"),
        overpaymentAllocations: [...(toInv.overpaymentAllocations || []), { fromInvoiceId, amount: allocAmount, allocatedAt: new Date().toISOString() }],
        updatedAt: new Date().toISOString(),
      };

      saveItem("sgf_invoices", invoices);
      logAudit("UPDATE", "invoice", toInvoiceId, `Applied R${allocAmount.toFixed(2)} overpayment credit from invoice ${fromInv.invoiceNumber} to invoice ${toInv.invoiceNumber}`);
      return { success: true, fromInvoice: invoices[fromIdx], toInvoice: invoices[toIdx], amount: allocAmount };
    },
    getStats: () => {
      const totalValue = Math.round(invoices.reduce((sum, i) => sum + Number(i.total || i.totalAmount || 0), 0) * 100) / 100;
      const totalPaid = Math.round(invoices.reduce((sum, i) => sum + Number(i.amountPaid || 0), 0) * 100) / 100;
      const outstanding = Math.round(invoices
        .filter((i) => i.status !== "draft" && i.status !== "paid" && i.status !== "cancelled")
        .reduce((sum, i) => sum + (Number(i.balanceDue) || Number(i.total || i.totalAmount || 0) - Number(i.amountPaid || 0)), 0) * 100) / 100;
      const sageCount = invoices.filter((i) => i.source === "sage").length;
      const sageOutstanding = Math.round(invoices
        .filter((i) => i.source === "sage" && i.status !== "draft" && i.status !== "paid" && i.status !== "cancelled")
        .reduce((sum, i) => sum + (Number(i.balanceDue) || Number(i.total || i.totalAmount || 0) - Number(i.amountPaid || 0)), 0) * 100) / 100;
      return {
        total: invoices.length,
        draft: invoices.filter((i) => i.status === "draft").length,
        sent: invoices.filter((i) => i.status === "sent").length,
        partiallyPaid: invoices.filter((i) => i.status === "partially_paid").length,
        paid: invoices.filter((i) => i.status === "paid").length,
        overdue: invoices.filter((i) => i.status === "overdue").length,
        cancelled: invoices.filter((i) => i.status === "cancelled").length,
        totalValue,
        totalPaid,
        outstanding,
        sageCount,
        sageOutstanding,
      };
    },
  
    generateInvoiceForOrder,
    matchBankPayments,
    parseBankStatement,
    allocateBankPayments,
    fixDraftInvoices: fixDraftInvoicesForDeliveredOrders,
    fixSageDates: fixSageInvoiceDates,
    generateForPO: activateInvoiceFromPO,
  },

  appointment: {
    list: () => appointments.map((a) => ({
      ...a,
      customer: customers.find((c) => c.id == a.customerId) || null,
    })),
    create: (data: any) => {
      const newItem = {
        ...data,
        id: Date.now(),
        status: "scheduled",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        reminderSent: false,
      };
      // Auto-populate salesRepName from customer if not provided
      if (!newItem.salesRepName && newItem.customerId) {
        const cust = customers.find((c) => c.id == newItem.customerId);
        if (cust?.salesRepName) newItem.salesRepName = cust.salesRepName;
      }
      appointments.push(newItem);
      saveItem("sgf_appointments", appointments);
      return newItem;
    },
    update: ({ id, data }: { id: number; data: any }) => {
      const idx = appointments.findIndex((a) => a.id == id);
      if (idx >= 0) { appointments[idx] = { ...appointments[idx], ...data, updatedAt: new Date().toISOString() }; saveItem("sgf_appointments", appointments); return appointments[idx]; }
      return null;
    },
    delete: (id: number) => {
      const idx = appointments.findIndex((a) => a.id == id);
      if (idx >= 0) { const deleted = appointments[idx]; appointments.splice(idx, 1); saveItem("sgf_appointments", appointments); return deleted; }
      return null;
    },
    updateStatus: ({ id, status }: { id: number; status: string }) => {
      const idx = appointments.findIndex((a) => a.id == id);
      if (idx >= 0) {
        appointments[idx].status = status;
        if (status === "rescheduled") {
          appointments[idx].reminderSent = false; // reset reminder on reschedule
        }
        saveItem("sgf_appointments", appointments);
        return appointments[idx];
      }
      return null;
    },
    getStats: () => ({
      total: appointments.length,
      today: appointments.filter((a) => new Date(a.appointmentDate).toDateString() === new Date().toDateString()).length,
      completed: appointments.filter((a) => a.status === "completed").length,
      inProgress: appointments.filter((a) => a.status === "in_progress").length,
    }),
  },

  checkin: {
    list: () => checkins.map((ci) => ({
      ...ci,
      customer: customers.find((c) => c.id == ci.customerId) || null,
    })),
    update: ({ id, data }: { id: number; data: any }) => {
      const idx = checkins.findIndex((c) => c.id == id);
      if (idx >= 0) { checkins[idx] = { ...checkins[idx], ...data, updatedAt: new Date().toISOString() }; saveItem("sgf_checkins", checkins); return checkins[idx]; }
      return null;
    },
    delete: (id: number) => {
      const idx = checkins.findIndex((c) => c.id == id);
      if (idx >= 0) { const deleted = checkins[idx]; checkins.splice(idx, 1); saveItem("sgf_checkins", checkins); return deleted; }
      return null;
    },
    create: (data: any) => {
      const newItem = { ...data, id: Date.now(), status: "checked_in", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      // Auto-populate salesRepName from customer if not provided
      if (!newItem.salesRepName && newItem.customerId) {
