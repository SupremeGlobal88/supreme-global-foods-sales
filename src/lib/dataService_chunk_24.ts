        inv.customer = customers.find((c) => c.id == data.customerId)
          || corporateCustomers.find((c) => c.id == data.customerId)
          || null;
      }
      if (data.invoiceDate !== undefined) inv.invoiceDate = data.invoiceDate;
      if (data.total !== undefined) {
        const oldTotal = inv.total || 0;
        inv.total = data.total;
        // Recalculate balance if total changed and not a payment edit
        if (data.amountPaid === undefined) {
          const allocC = (inv.creditAllocations || []).reduce((sum: number, a: any) => sum + (a.amount || 0), 0);
          const lineC = (inv.creditedLines || []).reduce((sum: number, cl: any) => sum + (cl.creditAmount || 0), 0);
          inv.balanceDue = data.total - (inv.amountPaid || 0) - allocC - lineC;
          if (inv.balanceDue <= 0) inv.status = "paid";
          else if ((inv.amountPaid || 0) > 0) inv.status = "partially_paid";
          else inv.status = "sent";
        }
      }
      if (data.amountPaid !== undefined) inv.amountPaid = data.amountPaid;
      if (data.balanceDue !== undefined) inv.balanceDue = data.balanceDue;
      if (data.status !== undefined) inv.status = data.status;
      if (data.notes !== undefined) inv.notes = data.notes;
      if (data.items !== undefined) inv.items = data.items;
      if (data.subtotal !== undefined) inv.subtotal = data.subtotal;
      if (data.vatRate !== undefined) {
        inv.vatRate = data.vatRate;
        // Recalculate vatAmount based on current subtotal when VAT rate changes
        const subtotal = inv.subtotal || (inv.items || []).reduce((sum: number, item: any) => sum + (item.lineTotal || 0), 0);
        inv.vatAmount = subtotal * data.vatRate;
        // If total was not explicitly provided, recalculate it from subtotal + new vatAmount
        if (data.total === undefined) {
          inv.total = subtotal + inv.vatAmount;
          const allocC2 = (inv.creditAllocations || []).reduce((sum: number, a: any) => sum + (a.amount || 0), 0);
          const lineC2 = (inv.creditedLines || []).reduce((sum: number, cl: any) => sum + (cl.creditAmount || 0), 0);
          inv.balanceDue = inv.total - (inv.amountPaid || 0) - allocC2 - lineC2;
          if (inv.balanceDue <= 0) inv.status = "paid";
          else if ((inv.amountPaid || 0) > 0) inv.status = "partially_paid";
        }
      }
      if (data.vatAmount !== undefined) inv.vatAmount = data.vatAmount;
      if (data.paymentTerms !== undefined) inv.paymentTerms = data.paymentTerms;
      inv.updatedAt = new Date().toISOString();
      saveItem("sgf_invoices", invoices);
      logAudit("UPDATE", "invoice", id, `Invoice ${inv.invoiceNumber} updated. Total: R${inv.total.toFixed(2)}, Status: ${inv.status}`);
      return inv;
    },

    /** Find customer by fuzzy name matching */
    findCustomerByFuzzyName: (searchName: string) => {
      if (!searchName) return null;
      const search = searchName.toLowerCase().trim();
      // Exact match first
      let match = customers.find((c) => c.name?.toLowerCase().trim() === search);
      if (match) return match;
      // Contains match (name is substring of customer name or vice versa)
      match = customers.find((c) => {
        const cn = c.name?.toLowerCase() || "";
        return cn.includes(search) || search.includes(cn);
      });
      if (match) return match;
      // Token match (match individual words)
      const tokens = search.split(/\s+/).filter((t) => t.length > 2);
      if (tokens.length > 0) {
        let bestMatch = null;
        let bestScore = 0;
        for (const c of customers) {
          const cn = c.name?.toLowerCase() || "";
          let score = 0;
          for (const token of tokens) {
            if (cn.includes(token)) score++;
          }
          if (score > bestScore) {
            bestScore = score;
            bestMatch = c;
          }
        }
        // Require at least one significant word to match
        if (bestMatch && bestScore > 0) return bestMatch;
      }
      return null;
    },

    /** Bulk import historical invoices from Sage — preserves original invoice numbers and dates.
     *  UPDATES existing invoices with line items if they already exist (no more skipping). */
    bulkHistoricalImport: (historicalInvoices: any[]) => {
      let created = 0;
      let updated = 0;
      let skipped = 0;
      const unmatched: string[] = [];
      // Pre-clean: remove any existing duplicate Sage invoices (keep best one)
      const sageInvoices = invoices.filter(i => i.source === 'sage' || !i.orderId);
      const nonSageInvoices = invoices.filter(i => i.source !== 'sage' && i.orderId);
      const uniqueSage = new Map<string, any>();
      for (const inv of sageInvoices) {
        const key = (inv.invoiceNumber || '').toString().trim().toLowerCase();
        if (!key) continue;
        const existing = uniqueSage.get(key);
        if (!existing || (inv.items?.length || 0) > (existing.items?.length || 0)) {
          uniqueSage.set(key, inv);
        }
      }
      invoices = [...nonSageInvoices, ...uniqueSage.values()];
      saveItem("sgf_invoices", invoices);

      for (const hist of historicalInvoices) {
        // Check if invoice number already exists (case-insensitive, trimmed)
        const histNum = (hist.invoiceNumber || '').toString().trim().toLowerCase();
        const existing = invoices.find((i) => (i.invoiceNumber || '').toString().trim().toLowerCase() === histNum);

        if (existing) {
          // UPDATE existing invoice with line items from order report
          const hasRealItems = hist.items && hist.items.length > 0 &&
            !(hist.items.length === 1 && (hist.items[0].description || "").toLowerCase().includes("historical"));

          if (hasRealItems) {
            // Replace the generic fallback items with real line items
            existing.items = hist.items;
            // Also ensure source is marked as sage
            existing.source = "sage";
            // Ensure other fields are populated
            if (!existing.salesRep && hist.salesRep) existing.salesRep = hist.salesRep;
            if (!existing.subtotal && hist.subtotal) existing.subtotal = hist.subtotal;
            if (!existing.vatAmount && hist.vatAmount) existing.vatAmount = hist.vatAmount;
            updated++;
          } else {
            skipped++;
          }
          continue;
        }

        // Find customer: first by customerCode (Sage data already has app customerCode),
        // then fall back to fuzzy name matching
        let customerId = hist.customerId;
        let matchedCustomer = null;

        if (!customerId && hist.customerCode) {
          // Try exact match by customerCode — Sage export was already updated to match app codes
          matchedCustomer = customers.find((c) => c.customerCode && c.customerCode.toLowerCase() === String(hist.customerCode).toLowerCase());
          if (matchedCustomer) {
            customerId = matchedCustomer.id;
          }
        }

        if (!customerId && hist.customerName) {
          // Fall back to fuzzy name matching if customerCode lookup failed
          matchedCustomer = dataService.invoice.findCustomerByFuzzyName(hist.customerName);
          if (matchedCustomer) {
            customerId = matchedCustomer.id;
          } else {
            unmatched.push(hist.customerName);
          }
        }

