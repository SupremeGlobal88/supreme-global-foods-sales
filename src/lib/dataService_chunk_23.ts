        invoiceId: data.invoiceId || null,
        invoiceNumber: data.invoiceNumber || null,
        amount: creditTotal,
        subtotal,
        vatAmount,
        remainingAmount: creditTotal,
        reason: data.reason || "",
        status: "open",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      creditNotes.push(creditNote);
      saveItem("sgf_creditNotes", creditNotes);
      logAudit("CREATE", "creditNote", creditNote.id, `Credit note ${creditNote.creditNoteNumber} created`);
      return creditNote;
    },
    getCreditNoteById: (id: number) => creditNotes.find((cn) => cn.id == id) || null,
    getCreditNotesByInvoice: (invoiceId: number) => creditNotes.filter((cn) => cn.invoiceId == invoiceId),
    getCreditNotesByCustomer: (customerId: number) => creditNotes.filter((cn) => cn.customerId == customerId),
    updateCreditNote: ({ id, data }: { id: number; data: any }) => {
      const idx = creditNotes.findIndex((cn) => cn.id == id);
      if (idx >= 0) {
        creditNotes[idx] = { ...creditNotes[idx], ...data, updatedAt: new Date().toISOString() };
        saveItem("sgf_creditNotes", creditNotes);
      }
      return creditNotes[idx];
    },
    deleteCreditNote: (id: number) => {
      const idx = creditNotes.findIndex((cn) => cn.id == id);
      if (idx >= 0) {
        creditNotes.splice(idx, 1);
        saveItem("sgf_creditNotes", creditNotes);
      }
      return { success: idx >= 0 };
    },
    applyCreditNoteToInvoice: ({ creditNoteId, invoiceId, amount }: { creditNoteId: number; invoiceId: number; amount: number }) => {
      const cnIdx = creditNotes.findIndex((cn) => cn.id == creditNoteId);
      if (cnIdx < 0) return { success: false, error: "Credit note not found" };
      const cn = creditNotes[cnIdx];
      const remaining = typeof cn.remainingAmount === "number" ? cn.remainingAmount : 0;
      if (amount > remaining + 0.01) return { success: false, error: "Amount exceeds remaining credit" };

      const invIdx = invoices.findIndex((i) => i.id == invoiceId);
