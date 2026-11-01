            customerName: customer.name || "",
          });
        }
      }

      return {
        from: fromDate,
        to: toDate,
        generatedAt: new Date().toISOString(),
        totalLines: results.length,
        totalValue: Math.round(results.reduce((s, r) => s + r.lineTotal, 0) * 100) / 100,
        items: results.sort((a, b) => new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime()),
      };
    },

    /** Stock Reconciliation — shows current SOH vs total ordered vs starting SOH.
     *  Helps verify that uploaded stock minus orders equals current stock. */
    reconcileStock: ({ from, to }: { from?: string; to?: string } = {}) => {
      const fromDate = from || new Date().toISOString().slice(0, 10);
      const toDate = to || fromDate;
      const fromTs = new Date(fromDate + "T00:00:00").getTime();
      const toTs = new Date(toDate + "T23:59:59").getTime();

      const results: any[] = [];

      for (const product of products) {
        // Count total quantity ordered for this product in the date range
        let totalOrdered = 0;
        const orderDetails: any[] = [];

        for (const order of orders) {
          const orderTs = new Date(order.createdAt || order.orderDate).getTime();
          if (orderTs < fromTs || orderTs > toTs) continue;
          if (order.status === "cancelled") continue;

          for (const item of (order.items || [])) {
            if (item.stockItemId == product.id) {
              totalOrdered += Number(item.quantity || 0);
              orderDetails.push({
                orderNumber: order.orderNumber,
                customer: order.customerName || (order.customer?.name) || "Unknown",
                quantity: item.quantity,
                orderDate: order.createdAt,
              });
            }
          }
        }

        // Only include products that had orders OR have current stock
        if (totalOrdered > 0 || (product.quantity || 0) > 0) {
          results.push({
            productId: product.id,
            productCode: product.productCode || "",
            productName: product.productName || "",
            category: product.category || "",
            currentStock: product.quantity || 0,
            totalOrdered,
            startingStock: (product.quantity || 0) + totalOrdered,
            unit: product.unit || "",
            status: product.status || "unknown",
            orderDetails: orderDetails.sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime()),
          });
        }
      }

      return {
        from: fromDate,
        to: toDate,
        generatedAt: new Date().toISOString(),
        totalProducts: results.length,
        totalCurrentStock: results.reduce((s, r) => s + r.currentStock, 0),
        totalOrdered: results.reduce((s, r) => s + r.totalOrdered, 0),
        items: results.sort((a, b) => b.totalOrdered - a.totalOrdered),
      };
    },
  },

  customer: {
    list: () => customers,
    search: ({ query }: { query: string }) => searchItems(customers, query),
    getById: (id: number) => customers.find((c) => c.id == id) || null,
    create: (data: any) => {
      const normName = (data.name || "").toString().trim().replace(/\s+/g, " ").toLowerCase();
      const incomingCode = (data.customerCode || "").toString().trim().toLowerCase();
      // Prevent duplicate: only update if BOTH name AND customerCode match (or both codes empty)
      const existingIdx = customers.findIndex((c) => {
        const nameMatch = (c.name || "").toString().trim().replace(/\s+/g, " ").toLowerCase() === normName;
        const existingCode = (c.customerCode || "").toString().trim().toLowerCase();
        const codeMatch = incomingCode && existingCode ? incomingCode === existingCode : true;
        return nameMatch && codeMatch;
      });
      if (existingIdx >= 0) {
        // Update existing customer instead of creating duplicate
        const existing = customers[existingIdx];
        customers[existingIdx] = {
          ...existing,
          ...data,
          id: existing.id, // keep original id
          customerCode: data.customerCode || existing.customerCode,
          updatedAt: new Date().toISOString(),
        };
        saveItem("sgf_customers", customers);
        logAudit("UPDATE", "customer", existing.id, `Updated existing customer (duplicate prevented): ${existing.name}`, data.salesRepName);
        return customers[existingIdx];
      }
      const newItem = {
        ...data,
        id: Date.now(),
        customerCode: (data.customerCode && data.customerCode !== "AUTO") ? data.customerCode : generateNextCustomerCode(),
        isActive: data.isActive !== undefined ? data.isActive : true,
        creditLimit: data.creditLimit !== undefined ? Number(data.creditLimit) : 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      customers.push(newItem);
      saveItem("sgf_customers", customers);
      logAudit("CREATE", "customer", newItem.id, `Created customer: ${newItem.name} (${newItem.customerCode})`, data.salesRepName);
      return newItem;
    },
    update: ({ id, data }: { id: number; data: any }) => {
      const idx = customers.findIndex((c) => c.id == id);
      if (idx >= 0) {
        const oldCust = { ...customers[idx] };
        customers[idx] = { ...customers[idx], ...data, updatedAt: new Date().toISOString() };
        saveItem("sgf_customers", customers);
        if (data.physicalAddress && data.physicalAddress !== oldCust.physicalAddress) {
          logAudit("UPDATE_ADDRESS", "customer", id, `Address changed from "${oldCust.physicalAddress}" to "${data.physicalAddress}"`, data.salesRepName || oldCust.salesRepName);
        }
        return customers[idx];
      }
      return null;
    },
    delete: ({ id }: { id: number }) => {
      const cust = customers.find((c) => c.id == id);
      if (cust) {
        logAudit("DELETE", "customer", id, `Deleted customer: ${cust.name} (${cust.customerCode}) \u2014 Sales Rep: ${cust.salesRepName || "Unassigned"}`);
      }
      customers = customers.filter((c) => c.id != id);
      saveItem("sgf_customers", customers);
      return { success: true };
    },
    getStats: () => {
      const now = new Date();
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      return {
        total: customers.length,
        active: customers.filter((c) => c.isActive !== false).length,
        inactive: customers.filter((c) => c.isActive === false).length,
        thisMonth: customers.filter((c) => new Date(c.createdAt || 0).getTime() >= thisMonthStart).length,
      };
    },
    getSalesReps: () => {
      // Merge sales reps from two sources:
      // 1. Active users with sales_rep role (from Firebase-synced users)
      // 2. Legacy SALES_REPS array (for backward compatibility)
      // This ensures all reps appear regardless of how they were added.
      const fromUsers = users
        .filter((u: any) => u.role === "sales_rep" && u.isActive !== false)
        .map((u: any) => u.name);
      // Extract names from SalesRep objects for dropdown compatibility
      const fromLegacy = getCurrentSalesReps().map((r) => r.name);
      // Deduplicate and sort
      const allReps = Array.from(new Set([...fromUsers, ...fromLegacy]))
