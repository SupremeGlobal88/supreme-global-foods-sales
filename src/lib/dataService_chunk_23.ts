      if (!alloc) return { success: false, error: "Allocation not found" };
      const amount = alloc.amount;

      // Restore credit note
      const currentRemaining = cn.remainingAmount !== undefined ? cn.remainingAmount : 0;
      creditNotes[cnIdx] = {
        ...cn,
        remainingAmount: currentRemaining + amount,
        allocations: (cn.allocations || []).filter((a: any) => a.invoiceId != invoiceId),
        updatedAt: new Date().toISOString(),
      };

      // Restore invoice
      const invIdx = invoices.findIndex((i) => i.id == invoiceId);
      if (invIdx >= 0) {
        const inv = invoices[invIdx];
        const newBal = (typeof inv.balanceDue === "number" ? inv.balanceDue : (inv.total || 0)) + amount;
        invoices[invIdx] = {
          ...inv,
          balanceDue: newBal,
          creditAllocations: (inv.creditAllocations || []).filter((a: any) => a.creditNoteId != creditNoteId),
          status: newBal <= 0.01 ? "paid" : (inv.amountPaid > 0.01 ? "partially_paid" : "sent"),
          updatedAt: new Date().toISOString(),
        };
        saveItem("sgf_invoices", invoices);
      }

      saveItem("sgf_creditNotes", creditNotes);
      logAudit("UPDATE", "creditNote", creditNoteId, `Voided allocation of R${amount.toFixed(2)} from invoice ${invoiceId}`);
      return { success: true, creditNote: creditNotes[cnIdx] };
    },
    voidCreditNote: (id: number) => {
      // Use loose equality (==) because Firebase may convert number IDs to strings
      const idx = creditNotes.findIndex((cn) => cn.id == id);
      if (idx >= 0) {
        const cn = creditNotes[idx];

        // NEW: if credit note has allocations, void them first
        const hasAllocations = cn.allocations && cn.allocations.length > 0;
        if (hasAllocations) {
          for (const alloc of cn.allocations) {
            const invIdx = invoices.findIndex((i) => i.id == alloc.invoiceId);
            if (invIdx >= 0) {
              const inv = invoices[invIdx];
              const currentBal = typeof inv.balanceDue === "number" ? inv.balanceDue : (inv.total || 0);
              const newBal = currentBal + alloc.amount;
              invoices[invIdx] = {
                ...inv,
                balanceDue: newBal,
                creditAllocations: (inv.creditAllocations || []).filter((a: any) => a.creditNoteId != cn.id),
                status: newBal <= 0.01 ? "paid" : (inv.amountPaid > 0.01 ? "partially_paid" : "sent"),
                updatedAt: new Date().toISOString(),
              };
            }
          }
          saveItem("sgf_invoices", invoices);
        }

        cn.voided = true;
        cn.voidedAt = new Date().toISOString();

        if (cn.invoiceId) {
          // Use loose equality (==) because Firebase may convert number IDs to strings
          const invIdx = invoices.findIndex((i) => i.id == cn.invoiceId);
          if (invIdx >= 0) {
            const inv = invoices[invIdx];
            // ALWAYS restore balance to original invoice when credit note is voided
            const isSampleInvoice = inv.orderType === "sample" || (inv.notes || "").includes("Sample");
            if (!isSampleInvoice) {
              const currentBal = typeof inv.balanceDue === "number" ? inv.balanceDue : 0;
              const newBal = currentBal + (cn.amount || 0);
              invoices[invIdx] = {
                ...inv,
                balanceDue: newBal,
                status: newBal <= 0.01 ? "paid" : (inv.amountPaid > 0.01 ? "partially_paid" : "sent"),
                updatedAt: new Date().toISOString(),
              };
            }
            // Remove credit note ID from invoice tracking
            if (invoices[invIdx].creditNotes) {
              invoices[invIdx].creditNotes = invoices[invIdx].creditNotes.filter((cnId: any) => cnId != cn.id);
            }
            // Remove credited lines for this credit note
            if (inv.creditedLines) {
              inv.creditedLines = inv.creditedLines.filter((cl: any) => cl.creditNoteId != cn.id);
            }
            saveItem("sgf_invoices", invoices);
          }
        }
        // Reverse stock return: deduct the returned quantities back from inventory
        if (cn.lineItems && cn.lineItems.length > 0) {
          for (const li of cn.lineItems) {
            if (li.stockItemId && li.returnedQty > 0) {
              const prodIdx = products.findIndex((p) => p.id == li.stockItemId);
              if (prodIdx >= 0) {
                const newQty = Math.max(0, (products[prodIdx].quantity || 0) - li.returnedQty);
                products[prodIdx].quantity = newQty;
                products[prodIdx].status = newQty === 0 ? "out_of_stock" : newQty < 20 ? "low_stock" : "in_stock";
              }
            }
          }
          saveItem("sgf_products", products);
        }
        saveItem("sgf_creditNotes", creditNotes);
        return cn;
      }
      return null;
    },

    refundCreditNote: ({ creditNoteId, amount, method }: { creditNoteId: number; amount: number; method: string }) => {
      const idx = creditNotes.findIndex((cn) => cn.id == creditNoteId);
      if (idx < 0) return { success: false, error: "Credit note not found" };
      const cn = creditNotes[idx];
      if (cn.voided) return { success: false, error: "Credit note is voided" };
      if (cn.refunded && cn.remainingAmount <= 0.01) return { success: false, error: "Credit note is already fully refunded" };

      const remaining = cn.remainingAmount !== undefined ? cn.remainingAmount : 0;
      if (amount > remaining + 0.01) return { success: false, error: "Refund amount exceeds remaining credit" };
      if (amount <= 0) return { success: false, error: "Refund amount must be greater than zero" };

      const newRemaining = Math.max(0, remaining - amount);
      const refundEntry = {
        amount,
        method: method || "eft",
        refundedAt: new Date().toISOString(),
      };

      creditNotes[idx] = {
        ...cn,
        remainingAmount: newRemaining,
        refunded: true,
        refundedAt: new Date().toISOString(),
        refundAmount: (cn.refundAmount || 0) + amount,
        refundMethod: method || "eft",
        refundHistory: [...(cn.refundHistory || []), refundEntry],
        updatedAt: new Date().toISOString(),
      };

      saveItem("sgf_creditNotes", creditNotes);
      logAudit("UPDATE", "creditNote", creditNoteId, `Refunded R${amount.toFixed(2)} (${method || "eft"}) on ${cn.creditNoteNumber}. Remaining: R${newRemaining.toFixed(2)}`);
      return { success: true, creditNote: creditNotes[idx] };
    },

    /** Update invoice fields (admin only) — for correcting historical data */
    updateInvoice: ({ id, data }: { id: number; data: any }) => {
      const idx = invoices.findIndex((i) => i.id == id);
      if (idx < 0) return null;
      const inv = invoices[idx];
      // Audit log: invoice number change
      if (data.invoiceNumber !== undefined && data.invoiceNumber !== inv.invoiceNumber) {
        logAudit("UPDATE", "invoice", id, `Invoice number changed from ${inv.invoiceNumber} to ${data.invoiceNumber}`);
        inv.invoiceNumber = data.invoiceNumber;
      }
      // Update allowed fields
      if (data.customerId !== undefined) {
        inv.customerId = data.customerId;
        // Corporate customers live in a separate array — check both
