        referenceNumber: referenceNumber ?? inv.payments[payIdx].referenceNumber,
        notes: notes ?? inv.payments[payIdx].notes,
      };
      // Recalculate totals
      const totalPaid = inv.payments.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
      const total = Number(inv.total || inv.totalAmount || 0);
      inv.amountPaid = totalPaid;
      const allocCredits2 = (inv.creditAllocations || []).reduce((sum: number, a: any) => sum + (a.amount || 0), 0);
      const lineCredits2 = (inv.creditedLines || []).reduce((sum: number, cl: any) => sum + (cl.creditAmount || 0), 0);
      const creditsApplied3 = allocCredits2 + lineCredits2;
      inv.balanceDue = total - totalPaid - creditsApplied3; // Allow negative = customer credit
      if (inv.balanceDue <= 0.01) {
        inv.status = "paid";
      } else if (totalPaid > 0) {
        inv.status = "partially_paid";
      } else {
        inv.status = inv.status === "draft" ? "draft" : "sent";
      }
      inv.updatedAt = new Date().toISOString();
      saveItem("sgf_invoices", invoices);
      logAudit("PAYMENT", "invoice", invoiceId, `Payment edited on invoice ${inv.invoiceNumber}. New balance: R${inv.balanceDue.toFixed(2)}`);
      return inv;
    },
    deletePayment: ({ invoiceId, paymentId }: { invoiceId: number; paymentId: number }) => {
      const invIdx = invoices.findIndex((i) => i.id == invoiceId);
      if (invIdx < 0) return null;
      const inv = invoices[invIdx];
      if (!inv.payments) return null;
      inv.payments = inv.payments.filter((p: any) => p.id !== paymentId);
      // Recalculate totals
      const totalPaid = inv.payments.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
      const total = Number(inv.total || inv.totalAmount || 0);
      inv.amountPaid = totalPaid;
      const allocCredits3 = (inv.creditAllocations || []).reduce((sum: number, a: any) => sum + (a.amount || 0), 0);
      const lineCredits3 = (inv.creditedLines || []).reduce((sum: number, cl: any) => sum + (cl.creditAmount || 0), 0);
      const creditsApplied4 = allocCredits3 + lineCredits3;
      inv.balanceDue = total - totalPaid - creditsApplied4; // Allow negative = customer credit
      if (inv.balanceDue <= 0.01) {
        inv.status = "paid";
      } else if (totalPaid > 0) {
        inv.status = "partially_paid";
      } else {
        inv.status = inv.status === "draft" ? "draft" : "sent";
      }
      inv.updatedAt = new Date().toISOString();
      saveItem("sgf_invoices", invoices);
      logAudit("PAYMENT", "invoice", invoiceId, `Payment deleted from invoice ${inv.invoiceNumber}. Balance now R${inv.balanceDue.toFixed(2)}`);
      return inv;
    },
    getReceipts: () => receipts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    getReceiptsByInvoice: (invoiceId: number) => receipts.filter((r) => r.invoiceId == invoiceId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    getReceiptsByCustomer: (customerId: number) => receipts.filter((r) => r.customerId == customerId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    getReceiptById: (id: number) => receipts.find((r) => r.id == id) || null,

    // Credit note methods
    getCreditNotes: () => creditNotes.filter((cn) => !cn.voided).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    // Use loose equality (==) — Firebase may convert number IDs to strings
    getCreditNotesByInvoice: (invoiceId: number) => creditNotes.filter((cn) => cn.invoiceId == invoiceId && !cn.voided).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    getCreditNotesByCustomer: (customerId: number) => creditNotes.filter((cn) => cn.customerId == customerId && !cn.voided).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    getCustomerCreditBalance: (customerId: number) => {
      return creditNotes
        .filter((cn) => cn.customerId == customerId && !cn.voided)
        .reduce((sum: number, cn: any) => {
          const remaining = cn.remainingAmount !== undefined ? cn.remainingAmount : 0;
          return sum + remaining;
        }, 0);
    },
    createCreditNote: (data: any) => {
      // Calculate total credit from line items if provided
      let lineItems = data.lineItems || [];
      let creditTotal = data.amount || 0;

      // Calculate subtotal (excl VAT) and vatAmount from line items or amount
      let subtotal = 0;
      let vatAmount = 0;
      if (lineItems.length > 0) {
        subtotal = lineItems.reduce((sum: number, li: any) => sum + (li.creditAmount || 0), 0);
        vatAmount = Number((subtotal * 0.15).toFixed(2));
        // If UI didn't send amount, use subtotal + vat
        if (data.amount === undefined || data.amount === 0) {
          creditTotal = Number((subtotal + vatAmount).toFixed(2));
        } else {
          creditTotal = data.amount; // UI already calculated incl VAT
        }
      } else {
        // No line items — derive subtotal from total amount
        subtotal = Number((creditTotal / 1.15).toFixed(2));
        vatAmount = Number((creditTotal - subtotal).toFixed(2));
      }

      // Use max existing number + 1 (NOT count-based) — voided notes must NOT reuse numbers
      const existingNumbers = creditNotes
        .map((cn) => { const m = (cn.creditNoteNumber || "").match(/CN-(\d+)/); return m ? parseInt(m[1], 10) : 0; })
        .filter((n) => !isNaN(n) && n > 0);
      const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;

      const creditNote = {
        id: Date.now() + Math.random(),
        creditNoteNumber: `CN-${String(nextNumber).padStart(3, "0")}`,
        customerId: data.customerId || 0,
        invoiceId: data.invoiceId || null,
        invoiceNumber: data.invoiceNumber || null,
        amount: creditTotal,
        subtotal,
        vatAmount,
        remainingAmount: creditTotal,
        allocations: [],
        lineItems,
        reason: data.reason || "",
        company: data.company || "",
        createdAt: new Date().toISOString(),
      };
      // Prevent duplicate: check if an unvoided credit note already exists for this invoice with same amount
      const existingCN = creditNotes.find((cn) =>
        cn.invoiceId == data.invoiceId &&
        !cn.voided &&
        Math.abs((cn.amount || 0) - creditTotal) < 0.01
      );
      if (existingCN) {
        // Return existing credit note instead of creating a duplicate
        return { creditNote: existingCN, updatedInvoice: null, error: `Credit note ${existingCN.creditNoteNumber} already exists for this invoice` };
      }

      creditNotes.push(creditNote);
      saveItem("sgf_creditNotes", creditNotes);
      let updatedInvoice = null;

      // Helper: find and update invoice — credit note is created but NOT auto-applied
      // The credit sits as "available" for the customer to allocate later
      const findAndUpdateInvoice = (): any | null => {
        if (!data.invoiceId) return null;

        // Search 1: Current in-memory array (loose equality)
        let idx = invoices.findIndex((i) => i.id == data.invoiceId);

        // Search 2: By invoiceNumber
        if (idx < 0 && data.invoiceNumber) {
