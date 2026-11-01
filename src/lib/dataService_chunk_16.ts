        .sort((a: string, b: string) => a.localeCompare(b));
      return allReps;
    },
    bulkUpload: (items: any[]) => {
      // Normalize name: trim, collapse multiple spaces, lowercase
      const normalize = (s: string) => (s || "").toString().trim().replace(/\s+/g, " ").toLowerCase();
      let created = 0;
      let updated = 0;
      for (const item of items) {
        const code = (item.customerCode || "").toString().trim();
        const name = (item.name || "").toString().trim();
        if (!name) continue;
        const normName = normalize(name);
        const incomingCode = code.toLowerCase();
        // Match ONLY if BOTH name AND customerCode match (prevents overwriting different customers with same name)
        const existingIdx = customers.findIndex((c) => {
          const nameMatch = normalize(c.name) === normName;
          const existingCode = (c.customerCode || "").toString().trim().toLowerCase();
          const codeMatch = incomingCode && existingCode ? incomingCode === existingCode : true;
          return nameMatch && codeMatch;
        });
        if (existingIdx >= 0) {
          // Update existing — same id, orders/invoices unaffected
          const existing = customers[existingIdx];
          customers[existingIdx] = {
            ...existing,
            name: name || existing.name,
            customerCode: code || existing.customerCode,
            businessName: item.businessName !== undefined ? item.businessName : existing.businessName,
            contactPerson: item.contactPerson !== undefined ? item.contactPerson : existing.contactPerson,
            phone: item.phone !== undefined ? item.phone : existing.phone,
            email: item.email !== undefined ? item.email : existing.email,
            physicalAddress: item.physicalAddress !== undefined ? item.physicalAddress : existing.physicalAddress,
            city: item.city !== undefined ? item.city : existing.city,
            province: item.province !== undefined ? item.province : existing.province,
            postalCode: item.postalCode !== undefined ? item.postalCode : existing.postalCode,
            paymentTerms: item.paymentTerms || existing.paymentTerms || "cod",
            priceTier: item.priceTier || existing.priceTier || "wholesale",
            salesRepName: item.salesRepName !== undefined ? item.salesRepName : existing.salesRepName,
            vatNumber: item.vatNumber !== undefined ? item.vatNumber : existing.vatNumber,
            notes: item.notes !== undefined ? item.notes : existing.notes,
            isActive: "active",
            updatedAt: new Date().toISOString(),
          };
          updated++;
        } else {
          // New customer
          customers.push({
            ...item,
            id: Date.now() + Math.random(),
            customerCode: code || generateNextCustomerCode(),
            isActive: "active",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          created++;
        }
      }
      saveItem("sgf_customers", customers);
      return { created, updated, total: customers.length };
    },
    // Find customers who haven't placed an order in the last X days (default 10)
    getCustomersNeedingFollowUp: (days: number = 10) => {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      const cutoffMs = cutoff.getTime();
      return customers
        .filter((c) => c.isActive !== false)
        .map((c) => {
          // Find most recent order for this customer
          const custOrders = orders
            .filter((o) => o.customerId == c.id)
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          const lastOrder = custOrders[0] || null;
          const lastOrderDate = lastOrder ? new Date(lastOrder.createdAt).getTime() : 0;
          const daysSinceLastOrder = lastOrderDate
            ? Math.floor((Date.now() - lastOrderDate) / 86400000)
            : 999;
          // Also count total orders
          const totalOrders = custOrders.length;
          return {
            ...c,
            lastOrder,
            lastOrderDate: lastOrder?.createdAt || null,
            daysSinceLastOrder,
            totalOrders,
            needsFollowUp: !lastOrder || lastOrderDate < cutoffMs,
          };
        })
        .filter((c) => c.needsFollowUp)
        .sort((a, b) => b.daysSinceLastOrder - a.daysSinceLastOrder);
    },
  },

  order: {
    list: () => orders
      .map((o) => {
        const customer = customers.find((c) => c.id == o.customerId);
        return { ...o, customer: customer || null };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    getById: (id: number) => {
      const order = orders.find((o) => o.id == id);
      if (!order) return null;
      const customer = customers.find((c) => c.id == order.customerId);
      return { ...order, customer: customer || null };
    },
    create: (data: any) => {
      const isSample = data.orderType === "sample";
      const isQuote = data.orderType === "quote";
      
      // STOCK VALIDATION: Check availability before creating order (skip for quotes)
      const requestedItems = data.items || [];
      if (!isQuote) {
        for (const item of requestedItems) {
          const product = products.find((p) => p.id == item.stockItemId);
          if (!product) continue;
          // product.quantity already has all non-cancelled orders deducted at creation time.
          // It IS the live available stock — do NOT subtract committed again.
          const available = Math.max(0, product.quantity || 0);
          const conversion = item.conversion || 1;
          const requestedQty = (isSample ? 1 : (item.quantity || 0)) * conversion;
          if (requestedQty > available) {
            throw new Error(`Insufficient stock for ${product.productName}. Available: ${available}, Requested: ${requestedQty}`);
          }
        }
      }

      // CUSTOMER CHECK: validate active status, credit limit, and COD overdue rules
      if (!isQuote) {
        const check = checkCustomerCanOrder(
          data.customerId,
          data.paymentTerms || "cod",
          data.superAdminOverride === true
        );
        if (check.blocked) {
          throw new Error(check.reason);
        }
      }
      
      // Generate unique order number: date + HHMM + ms-based 4-digit suffix
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const now = new Date();
      const hhmm = String(now.getHours()).padStart(2, "0") + String(now.getMinutes()).padStart(2, "0");
      const msCounter = String(Date.now() % 10000).padStart(4, "0");
      const prefix = isSample ? "SMP" : isQuote ? "QTE" : "ORD";
      const orderNumber = `${prefix}-${dateStr}-${hhmm}${msCounter}`;
      
      const items = (data.items || []).map((item: any) => {
        const product = products.find((p) => p.id == item.stockItemId);
        const conversion = item.conversion || 1;
        const basePrice = getEffectivePrice(item.stockItemId, isSample ? "corporate" : data.priceTier, data.customerId, isSample);
        const unitPrice = isSample ? basePrice : (item.unitPrice && item.unitPrice > 0 ? item.unitPrice : basePrice * conversion);
        return {
          ...item,
