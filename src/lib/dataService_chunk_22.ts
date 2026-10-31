        createdAt: new Date().toISOString(),
      };
      receipts.push(receipt);
      inv.updatedAt = new Date().toISOString();
      saveItem("sgf_receipts", receipts);
      saveItem("sgf_invoices", invoices);
      logAudit("PAYMENT", "receipt", receipt.id, `Payment of R${paymentAmount.toFixed(2)} recorded for invoice ${inv.invoiceNumber}`);
      return { success: true, invoice: inv, receipt };
    },
  },

  creditNote: {
    list: () => creditNotes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    getById: (id: number) => creditNotes.find((cn) => cn.id == id) || null,
    getByInvoiceId: (invoiceId: number) => creditNotes.filter((cn) => cn.invoiceId == invoiceId),
    getByCustomerId: (customerId: number) => creditNotes.filter((cn) => cn.customerId == customerId),
    create: (data: any) => {
      // Generate next credit note number: CN-001, CN-002, ...
      const existingNumbers = creditNotes
        .map((cn) => {
          const match = cn.creditNoteNumber?.match(/CN-(\d+)/);
          return match ? parseInt(match[1]) : 0;
        })
        .filter((n) => n > 0);
      const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;

      const creditNote = {
        id: Date.now() + Math.random(),
        creditNoteNumber: `CN-${String(nextNumber).padStart(3, "0")}`,
        customerId: data.customerId || 0,
        customerName: data.customerName || "",
        invoiceId: data.invoiceId || null,
        invoiceNumber: data.invoiceNumber || "",
        amount: data.amount || 0,
        reason: data.reason || "",
        status: data.status || "open",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      creditNotes.push(creditNote);
      saveItem("sgf_creditNotes", creditNotes);
      logAudit("CREATE", "creditNote", creditNote.id, `Credit note ${creditNote.creditNoteNumber} created for invoice ${creditNote.invoiceNumber}`);
      return creditNote;
    },
    update: ({ id, data }: { id: number; data: any }) => {
      const idx = creditNotes.findIndex((cn) => cn.id == id);
      if (idx >= 0) {
        creditNotes[idx] = { ...creditNotes[idx], ...data, updatedAt: new Date().toISOString() };
        saveItem("sgf_creditNotes", creditNotes);
        logAudit("UPDATE", "creditNote", id, `Credit note updated: ${creditNotes[idx].creditNoteNumber}`);
      }
      return creditNotes[idx];
    },
    delete: (id: number) => {
      const idx = creditNotes.findIndex((cn) => cn.id == id);
      if (idx >= 0) {
        creditNotes.splice(idx, 1);
        saveItem("sgf_creditNotes", creditNotes);
        logAudit("DELETE", "creditNote", id, "Credit note deleted");
      }
      return { success: idx >= 0 };
    },
    /** Apply credit note to an invoice. Updates invoice balanceDue and creditsApplied. */
    applyToInvoice: ({ creditNoteId, invoiceId }: { creditNoteId: number; invoiceId: number }) => {
      const cnIdx = creditNotes.findIndex((cn) => cn.id == creditNoteId);
      if (cnIdx < 0) return { success: false, error: "Credit note not found" };
      const cn = creditNotes[cnIdx];

      const invIdx = invoices.findIndex((i) => i.id == invoiceId);
      if (invIdx < 0) return { success: false, error: "Invoice not found" };
      const inv = invoices[invIdx];

      const creditTotal = cn.amount || 0;
      const invTotal = inv.total || inv.totalAmount || 0;
      const currentPaid = inv.amountPaid || 0;
      const currentCredits = inv.creditsApplied || 0;
      const newCredits = currentCredits + creditTotal;
      const newBalance = Math.max(0, invTotal - currentPaid - newCredits);

      inv.creditsApplied = newCredits;
      inv.balanceDue = newBalance;
      inv.status = newBalance <= 0.01 ? "paid" : "sent";
      inv.updatedAt = new Date().toISOString();

      cn.status = "applied";
      cn.invoiceId = invoiceId;
      cn.updatedAt = new Date().toISOString();

      saveItem("sgf_creditNotes", creditNotes);
      saveItem("sgf_invoices", invoices);
      logAudit("APPLY", "creditNote", creditNoteId, `Credit note ${cn.creditNoteNumber} applied to invoice ${inv.invoiceNumber}`);
      return { success: true, invoice: inv, creditNote: cn };
    },
  },

  purchaseOrder: {
    list: () => purchaseOrders
      .map((po) => repairPurchaseOrderCompany(po))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    getById: (id: number) => {
      const po = purchaseOrders.find((p) => p.id == id);
      return po ? repairPurchaseOrderCompany(po) : null;
    },
    getByCorporateCustomer: (corporateCustomerId: number) => purchaseOrders
      .filter((po) => po.corporateCustomerId == corporateCustomerId)
      .map((po) => repairPurchaseOrderCompany(po))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    getByStatus: (status: string) => purchaseOrders
      .filter((po) => po.status === status)
      .map((po) => repairPurchaseOrderCompany(po)),
    create: (data: any) => {
      const newItem = {
        ...data,
        id: Date.now(),
        company: data.company || getCurrentCompany(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      purchaseOrders.push(newItem);
      saveItem("sgf_purchaseOrders", purchaseOrders);
      logAudit("CREATE", "purchaseOrder", newItem.id, `Purchase order created: ${newItem.poNumber || ""}`);
      return newItem;
    },
    update: ({ id, data }: { id: number; data: any }) => {
      const idx = purchaseOrders.findIndex((po) => po.id == id);
      if (idx >= 0) {
        purchaseOrders[idx] = { ...purchaseOrders[idx], ...data, updatedAt: new Date().toISOString() };
        saveItem("sgf_purchaseOrders", purchaseOrders);
        logAudit("UPDATE", "purchaseOrder", id, `Purchase order updated: ${purchaseOrders[idx].poNumber || ""}`);
      }
      return purchaseOrders[idx];
    },
    updateStatus: ({ id, status }: { id: number; status: string }) => {
      const idx = purchaseOrders.findIndex((po) => po.id == id);
      if (idx >= 0) {
        const oldStatus = purchaseOrders[idx].status;
        purchaseOrders[idx].status = status;
        purchaseOrders[idx].updatedAt = new Date().toISOString();
        saveItem("sgf_purchaseOrders", purchaseOrders);
        logAudit("UPDATE", "purchaseOrder", id, `Purchase order ${purchaseOrders[idx].poNumber} status changed from ${oldStatus} to ${status}`);
        // When PO is fulfilled, activate its linked invoice
        if (status === "fulfilled") {
          activateInvoiceFromPO(id);
        }
      }
      return purchaseOrders[idx];
    },
    delete: (id: number) => {
      const idx = purchaseOrders.findIndex((po) => po.id == id);
      if (idx >= 0) {
        purchaseOrders.splice(idx, 1);
        saveItem("sgf_purchaseOrders", purchaseOrders);
        logAudit("DELETE", "purchaseOrder", id, "Purchase order deleted");
      }
      return { success: idx >= 0 };
    },
    getStats: () => ({
      total: purchaseOrders.length,
      pending: purchaseOrders.filter((po) => po.status === "pending").length,
      fulfilled: purchaseOrders.filter((po) => po.status === "fulfilled").length,
      totalValue: Math.round(purchaseOrders.reduce((sum, po) => sum + Number(po.total || 0), 0) * 100) / 100,
    }),
  },
