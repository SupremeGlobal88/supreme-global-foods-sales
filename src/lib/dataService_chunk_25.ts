        // Parse historical date
        let invoiceDate = hist.invoiceDate;
        if (!invoiceDate && hist.date) {
          // Try DD/MM/YYYY or DD/MM/YY format
          const parts = hist.date.split("/");
          if (parts.length === 3) {
            // Handle both 2-digit year (26 → 2026) and 4-digit year (2026 → 2026)
            const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
            invoiceDate = `${year}-${parts[1]}-${parts[0]}`;
          }
        }

        const subtotal = hist.subtotal || hist.total || 0;
        const vatAmount = hist.vatAmount || subtotal * 0.15;
        const total = hist.total || subtotal + vatAmount;

        const newInvoice = {
          id: Date.now() + Math.random(),
          invoiceNumber: hist.invoiceNumber,
          orderNumber: hist.orderNumber || hist.invoiceNumber,
          orderId: null,
          customerId: customerId || 0,
          customerName: customerId ? (customers.find((c) => c.id == customerId)?.name || "") : "",
          customer: customerId ? customers.find((c) => c.id == customerId) : null,
          customerCode: hist.customerCode || null, // PRESERVE Sage customerCode for statement matching
          items: hist.items || [],
          subtotal,
          vatAmount,
          total,
          amountPaid: hist.amountPaid || 0,
          balanceDue: total - (hist.amountPaid || 0),
          status: hist.status || "sent",
          paymentTerms: hist.paymentTerms || "cod",
          invoiceDate: invoiceDate || new Date().toISOString(),
          notes: hist.notes || "Historical import from Sage",
          payments: hist.payments || [],
          deliveryNoteNumber: hist.deliveryNoteNumber || null,
          source: "sage",
          createdAt: invoiceDate || new Date().toISOString(),
        };
        invoices.push(newInvoice);
        created++;
      }
      saveItem("sgf_invoices", invoices);
      // Deduplicate unmatched list
      const uniqueUnmatched = [...new Set(unmatched)];
      return { created, updated, skipped, total: invoices.length, unmatched: uniqueUnmatched, unmatchedCount: uniqueUnmatched.length };
    },

    /** Re-link existing Sage invoices to customers by customerCode.
     *  Call this after updating Sage data to match app customerCodes.
     *  Returns count of re-linked invoices. */
    relinkSageInvoices: () => {
      load();
      let relinked = 0;
      const details: string[] = [];
      const changedInvoices: any[] = [];

      for (const inv of invoices) {
        // Only process Sage invoices with no customerId (or customerId === 0)
        if (inv.source !== "sage" || (inv.customerId && inv.customerId !== 0)) continue;

        // Try to find customer by customerCode on the Sage invoice data
        const sageCode = (inv as any).customerCode || (inv as any).sageCustomerCode;
        if (sageCode) {
          const matched = customers.find((c) => c.customerCode && c.customerCode.toLowerCase() === String(sageCode).toLowerCase());
          if (matched) {
            inv.customerId = matched.id;
            inv.customer = matched;
            inv.customerCode = matched.customerCode; // Store code on invoice for statement matching
            relinked++;
            changedInvoices.push(inv);
            details.push(`${inv.invoiceNumber} → ${matched.name} (${matched.customerCode})`);
            continue;
          }
        }

        // Fallback: try matching by customer name in the notes or invoice data
        const customerName = (inv as any).customerName || (inv.customer && (inv.customer as any).name);
        if (customerName) {
          const fuzzyMatch = dataService.invoice.findCustomerByFuzzyName(customerName);
          if (fuzzyMatch) {
            inv.customerId = fuzzyMatch.id;
            inv.customer = fuzzyMatch;
            relinked++;
            changedInvoices.push(inv);
            details.push(`${inv.invoiceNumber} → ${fuzzyMatch.name} (fuzzy match)`);
          }
        }
      }

      if (relinked > 0) {
        saveItem("sgf_invoices", invoices);
      }

      return { relinked, details, changedInvoices };
    },

    getCustomerStatement: ({ customerId, fromDate, toDate }: any) => {
      const customer = customers.find((c) => c.id == customerId);
      const custCode = customer?.customerCode;
      // Match by customerId (app + linked Sage) OR by customerCode (unlinked Sage)
      // Uses trimmed lowercase comparison for robust matching
      const custCodeLower = custCode ? String(custCode).trim().toLowerCase() : null;
      const custInvoices = invoices
        .filter((i) => {
          if (i.customerId == customerId) return true;
          const invCode = (i as any).customerCode;
          if (i.source === "sage" && custCodeLower && invCode && String(invCode).trim().toLowerCase() === custCodeLower) return true;
          const nestedCode = i.customer && (i.customer as any).customerCode;
          if (i.source === "sage" && custCodeLower && nestedCode && String(nestedCode).trim().toLowerCase() === custCodeLower) return true;
          return false;
        })
        .filter((i) => i.status !== "cancelled")
        .filter((i) => !fromDate || new Date(i.invoiceDate || i.createdAt) >= new Date(fromDate))
        .filter((i) => !toDate || new Date(i.invoiceDate || i.createdAt) <= new Date(toDate + "T23:59:59"));
      let runningBal = 0;
      const lines = custInvoices.map((inv) => {
        const debit = Number(inv.total || inv.totalAmount || 0);
        const paid = Number(inv.amountPaid || 0);
        const allocC = (inv.creditAllocations || []).reduce((sum: number, a: any) => sum + (a.amount || 0), 0);
        const lineC = (inv.creditedLines || []).reduce((sum: number, cl: any) => sum + (cl.creditAmount || 0), 0);
        const credit = paid + allocC + lineC;
        runningBal += debit - credit;
        return {
          date: inv.invoiceDate || inv.createdAt,
          invoiceNumber: inv.invoiceNumber,
          orderNumber: inv.orderNumber || "",
          description: inv.notes || "Invoice",
          paymentTerms: inv.paymentTerms || "cod",
          debit,
          credit,
          balance: runningBal,
        };
      });
      const totalInvoiced = custInvoices.reduce((s, i) => s + Number(i.total || i.totalAmount || 0), 0);
      const totalPaid = custInvoices.reduce((s, i) => {
        const paid = Number(i.amountPaid || 0);
        const allocC = (i.creditAllocations || []).reduce((sum: number, a: any) => sum + (a.amount || 0), 0);
        const lineC = (i.creditedLines || []).reduce((sum: number, cl: any) => sum + (cl.creditAmount || 0), 0);
        return s + paid + allocC + lineC;
      }, 0);
      return {
        customer: customer || null,
        fromDate: fromDate || new Date(0).toISOString(),
        toDate: toDate || new Date().toISOString(),
        openingBalance: 0,
        closingBalance: totalInvoiced - totalPaid,
        totalInvoiced,
        totalPaid,
        lines,
      };
    },
    /** Transfer overpayment credit from one invoice (negative balance) to another invoice */
    applyOverpaymentCredit: ({ fromInvoiceId, toInvoiceId, amount }: { fromInvoiceId: number; toInvoiceId: number; amount: number }) => {
      const fromIdx = invoices.findIndex((i) => i.id == fromInvoiceId);
      const toIdx = invoices.findIndex((i) => i.id == toInvoiceId);
