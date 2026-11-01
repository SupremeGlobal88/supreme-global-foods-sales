          idx = invoices.findIndex((i) => i.invoiceNumber === data.invoiceNumber);
        }

        // Search 3: By customerId + total
        if (idx < 0 && data.customerId) {
          idx = invoices.findIndex((i) =>
            i.customerId == data.customerId &&
            Math.abs((i.total || 0) - (data.invoiceTotal || i.total || 0)) < 0.01
          );
        }

        // Search 4: localStorage direct (in case array was replaced)
        if (idx < 0) {
          try {
            const raw = getStorageItem("sgf_invoices");
            if (raw) {
              const stored = JSON.parse(raw);
              if (Array.isArray(stored)) {
                const storedIdx = stored.findIndex((i: any) =>
                  i.id == data.invoiceId ||
                  (data.invoiceNumber && i.invoiceNumber === data.invoiceNumber)
                );
                if (storedIdx >= 0) {
                  invoices = stored;
                  idx = invoices.findIndex((i) => i.id == data.invoiceId);
                  if (idx < 0 && data.invoiceNumber) {
                    idx = invoices.findIndex((i) => i.invoiceNumber === data.invoiceNumber);
                  }
                }
              }
            }
          } catch { /* ignore */ }
        }

        if (idx < 0) return null;

        const inv = invoices[idx];
        // Credit note is linked to original invoice for REFERENCE only
        // Balance is NOT reduced here — user allocates credit manually
        if (!inv.creditNotes) inv.creditNotes = [];
        inv.creditNotes.push(creditNote.id);

        // Store credited line items on the invoice for display
        if (!inv.creditedLines) inv.creditedLines = [];
        for (const li of lineItems) {
          const alreadyExists = inv.creditedLines.some((cl: any) =>
            cl.creditNoteId == creditNote.id &&
            cl.productDescription === li.productDescription
          );
          if (!alreadyExists) {
            inv.creditedLines.push({
              creditNoteId: creditNote.id,
              creditNoteNumber: creditNote.creditNoteNumber,
              productDescription: li.productDescription,
              originalQty: li.originalQty,
              returnedQty: li.returnedQty,
              unitPrice: li.unitPrice,
              creditAmount: li.creditAmount,
              reason: data.reason,
              createdAt: creditNote.createdAt,
            });
          }
        }

        inv.updatedAt = new Date().toISOString();
        saveItem("sgf_invoices", invoices);
        return inv;
      };

      updatedInvoice = findAndUpdateInvoice();

      // REDUCE ORIGINAL INVOICE BALANCE: when a credit note is created from an
      // invoice, reduce that invoice's balance by the credit amount so the
      // customer owes less. The credit note keeps its FULL remainingAmount so
      // it can be allocated to OTHER invoices later.
      if (updatedInvoice && creditTotal > 0.01 && data.invoiceId) {
        const invIdx = invoices.findIndex((i) => i.id == data.invoiceId);
        if (invIdx >= 0) {
          const inv = invoices[invIdx];
          const currentBalance = typeof inv.balanceDue === "number" ? inv.balanceDue : (inv.total || 0);
          // Reduce invoice balance by full credit amount (allow negative = overpayment)
          const newBalance = currentBalance - creditTotal;
          invoices[invIdx] = {
            ...inv,
            balanceDue: newBalance,
            status: newBalance <= 0.01 ? "paid" : (inv.amountPaid > 0.01 ? "partially_paid" : "sent"),
            updatedAt: new Date().toISOString(),
          };
          updatedInvoice = invoices[invIdx];
          saveItem("sgf_invoices", invoices);
        }
      }

      // Return stock to inventory for each credited line item
      if (lineItems.length > 0) {
        for (const li of lineItems) {
          if (li.stockItemId && li.returnedQty > 0) {
            const prodIdx = products.findIndex((p) => p.id == li.stockItemId);
            if (prodIdx >= 0) {
              const newQty = (products[prodIdx].quantity || 0) + li.returnedQty;
              products[prodIdx].quantity = newQty;
              products[prodIdx].status = newQty === 0 ? "out_of_stock" : newQty < 20 ? "low_stock" : "in_stock";
            }
          }
        }
        saveItem("sgf_products", products);
      }

      logAudit("CREATE", "creditNote", creditNote.id, `Credit note ${creditNote.creditNoteNumber} for R${creditTotal} invoice=${data.invoiceId} lines=${lineItems.length} found=${!!updatedInvoice}`);
      // Return the updated credit note from the array (with allocations), not the original local variable
      const finalCreditNote = creditNotes.find((cn) => cn.id == creditNote.id) || creditNote;
      return { creditNote: finalCreditNote, updatedInvoice };
    },
    allocateCredit: ({ creditNoteId, invoiceId, amount }: { creditNoteId: number; invoiceId: number; amount: number }) => {
      const cnIdx = creditNotes.findIndex((cn) => cn.id == creditNoteId);
      if (cnIdx < 0) return { success: false, error: "Credit note not found" };
      const cn = creditNotes[cnIdx];
      if (cn.voided) return { success: false, error: "Credit note is voided" };

      const remaining = cn.remainingAmount !== undefined ? cn.remainingAmount : 0;
      if (amount > remaining + 0.01) return { success: false, error: "Amount exceeds remaining credit" };

      const invIdx = invoices.findIndex((i) => i.id == invoiceId);
      if (invIdx < 0) return { success: false, error: "Invoice not found" };
      const inv = invoices[invIdx];

      const currentBalance = typeof inv.balanceDue === "number" ? inv.balanceDue : (inv.total || 0);
      // ALLOW overpayment: credit notes can be allocated to paid invoices,
      // creating negative balance (customer credit) that can be used on future invoices.

      // Deduct from credit note
      creditNotes[cnIdx] = {
        ...cn,
        remainingAmount: Math.max(0, remaining - amount),
        allocations: [...(cn.allocations || []), { invoiceId, amount, allocatedAt: new Date().toISOString() }],
        updatedAt: new Date().toISOString(),
      };

      // Add to invoice (allow negative balance = overpayment credit)
      const newBalance = currentBalance - amount;
      invoices[invIdx] = {
        ...inv,
        balanceDue: newBalance,
        creditAllocations: [...(inv.creditAllocations || []), { creditNoteId, amount, allocatedAt: new Date().toISOString() }],
        status: newBalance <= 0.01 ? "paid" : (inv.amountPaid > 0.01 ? "partially_paid" : "sent"),
        updatedAt: new Date().toISOString(),
      };

      saveItem("sgf_creditNotes", creditNotes);
      saveItem("sgf_invoices", invoices);
      logAudit("UPDATE", "creditNote", creditNoteId, `Allocated R${amount.toFixed(2)} to invoice ${invoiceId}. Remaining: R${(remaining - amount).toFixed(2)}`);
      return { success: true, creditNote: creditNotes[cnIdx], invoice: invoices[invIdx] };
    },
    voidCreditNoteAllocation: ({ creditNoteId, invoiceId }: { creditNoteId: number; invoiceId: number }) => {
      const cnIdx = creditNotes.findIndex((cn) => cn.id == creditNoteId);
      if (cnIdx < 0) return { success: false, error: "Credit note not found" };
      const cn = creditNotes[cnIdx];

      const alloc = (cn.allocations || []).find((a: any) => a.invoiceId == invoiceId);
