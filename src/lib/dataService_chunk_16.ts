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
        // Update existing — same id, orders/invoices unaffected
        const existing = customers[existingIdx];
        customers[existingIdx] = {
          ...existing,
          ...data,
          id: existing.id,
          company: data.company || existing.company || getCurrentCompany(),
          isActive: data.isActive !== undefined ? data.isActive : existing.isActive,
          updatedAt: new Date().toISOString(),
        };
        saveItem("sgf_customers", customers);
        return customers[existingIdx];
      }
      const newItem = {
        ...data,
        id: Date.now() + Math.floor(Math.random() * 1000),
        company: data.company || getCurrentCompany(),
        isActive: data.isActive !== undefined ? data.isActive : true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      customers.push(newItem);
      saveItem("sgf_customers", customers);
      logAudit("CREATE", "customer", newItem.id, `Customer created: ${newItem.name || ""}`);
      return newItem;
    },
    update: ({ id, data }: { id: number; data: any }) => {
      const idx = customers.findIndex((c) => c.id == id);
      if (idx >= 0) {
        customers[idx] = { ...customers[idx], ...data, updatedAt: new Date().toISOString() };
        saveItem("sgf_customers", customers);
        logAudit("UPDATE", "customer", id, `Customer updated: ${customers[idx].name || ""}`);
      }
      return customers[idx];
    },
    delete: (id: number) => {
      const idx = customers.findIndex((c) => c.id == id);
      if (idx >= 0) {
        customers.splice(idx, 1);
        saveItem("sgf_customers", customers);
        logAudit("DELETE", "customer", id, "Customer deleted");
      }
      return { success: idx >= 0 };
    },
  },

  corporateCustomer: {
    list: () => corporateCustomers,
    search: ({ query }: { query: string }) => searchItems(corporateCustomers, query),
    getById: (id: number) => corporateCustomers.find((c) => c.id == id) || null,
    create: (data: any) => {
      const newItem = {
        ...data,
        id: Date.now() + Math.floor(Math.random() * 1000),
        company: data.company || getCurrentCompany(),
        isActive: data.isActive !== undefined ? data.isActive : true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      corporateCustomers.push(newItem);
      saveItem("sgf_corporateCustomers", corporateCustomers);
      logAudit("CREATE", "corporateCustomer", newItem.id, `Corporate customer created: ${newItem.name || ""}`);
      return newItem;
    },
    update: ({ id, data }: { id: number; data: any }) => {
      const idx = corporateCustomers.findIndex((c) => c.id == id);
      if (idx >= 0) {
        corporateCustomers[idx] = { ...corporateCustomers[idx], ...data, updatedAt: new Date().toISOString() };
        saveItem("sgf_corporateCustomers", corporateCustomers);
        logAudit("UPDATE", "corporateCustomer", id, `Corporate customer updated: ${corporateCustomers[idx].name || ""}`);
      }
      return corporateCustomers[idx];
    },
    delete: (id: number) => {
      const idx = corporateCustomers.findIndex((c) => c.id == id);
      if (idx >= 0) {
        corporateCustomers.splice(idx, 1);
        saveItem("sgf_corporateCustomers", corporateCustomers);
        logAudit("DELETE", "corporateCustomer", id, "Corporate customer deleted");
      }
      return { success: idx >= 0 };
    },
  },

  priceTier: {
    list: () => priceTiers,
    getById: (id: number) => priceTiers.find((p) => p.id == id) || null,
    create: (data: any) => {
      const newItem = {
        ...data,
        id: Date.now(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      priceTiers.push(newItem);
      saveItem("sgf_priceTiers", priceTiers);
      return newItem;
    },
    update: ({ id, data }: { id: number; data: any }) => {
      const idx = priceTiers.findIndex((p) => p.id == id);
      if (idx >= 0) {
        priceTiers[idx] = { ...priceTiers[idx], ...data, updatedAt: new Date().toISOString() };
        saveItem("sgf_priceTiers", priceTiers);
      }
      return priceTiers[idx];
    },
    delete: (id: number) => {
      const idx = priceTiers.findIndex((p) => p.id == id);
      if (idx >= 0) {
        priceTiers.splice(idx, 1);
        saveItem("sgf_priceTiers", priceTiers);
      }
      return { success: idx >= 0 };
    },
  },

  specialPrice: {
    list: () => specialPrices,
    getById: (id: number) => specialPrices.find((sp) => sp.id == id) || null,
    getByCustomer: (customerId: number) => specialPrices.filter((sp) => sp.customerId == customerId),
    getByProduct: (stockItemId: number) => specialPrices.filter((sp) => sp.stockItemId == stockItemId),
    create: (data: any) => {
      const newItem = {
        ...data,
        id: Date.now(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      specialPrices.push(newItem);
      saveItem("sgf_specialPrices", specialPrices);
      return newItem;
    },
    update: ({ id, data }: { id: number; data: any }) => {
      const idx = specialPrices.findIndex((sp) => sp.id == id);
      if (idx >= 0) {
        specialPrices[idx] = { ...specialPrices[idx], ...data, updatedAt: new Date().toISOString() };
        saveItem("sgf_specialPrices", specialPrices);
      }
      return specialPrices[idx];
    },
    delete: (id: number) => {
      const idx = specialPrices.findIndex((sp) => sp.id == id);
      if (idx >= 0) {
        specialPrices.splice(idx, 1);
        saveItem("sgf_specialPrices", specialPrices);
      }
      return { success: idx >= 0 };
    },
  },

  deliveryRoute: {
    list: () => deliveryRoutes,
    getById: (id: number) => deliveryRoutes.find((dr) => dr.id == id) || null,
    create: (data: any) => {
      const newItem = {
        ...data,
        id: Date.now(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      deliveryRoutes.push(newItem);
      saveItem("sgf_deliveryRoutes", deliveryRoutes);
      return newItem;
    },
    update: ({ id, data }: { id: number; data: any }) => {
      const idx = deliveryRoutes.findIndex((dr) => dr.id == id);
      if (idx >= 0) {
        deliveryRoutes[idx] = { ...deliveryRoutes[idx], ...data, updatedAt: new Date().toISOString() };
        saveItem("sgf_deliveryRoutes", deliveryRoutes);
      }
      return deliveryRoutes[idx];
    },
    delete: (id: number) => {
      const idx = deliveryRoutes.findIndex((dr) => dr.id == id);
      if (idx >= 0) {
        deliveryRoutes.splice(idx, 1);
        saveItem("sgf_deliveryRoutes", deliveryRoutes);
      }
      return { success: idx >= 0 };
    },
  },

  geoCheckin: {
    list: () => geoCheckins,
    getById: (id: number) => geoCheckins.find((g) => g.id == id) || null,
    getByRep: (salesRepId: number) => geoCheckins.filter((g) => g.salesRepId == salesRepId),
    create: (data: any) => {
      const newItem = {
        ...data,
        id: Date.now(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      geoCheckins.push(newItem);
      saveItem("sgf_geoCheckins", geoCheckins);
      return newItem;
    },
    update: ({ id, data }: { id: number; data: any }) => {
      const idx = geoCheckins.findIndex((g) => g.id == id);
      if (idx >= 0) {
        geoCheckins[idx] = { ...geoCheckins[idx], ...data, updatedAt: new Date().toISOString() };
        saveItem("sgf_geoCheckins", geoCheckins);
      }
      return geoCheckins[idx];
    },
    delete: (id: number) => {
      const idx = geoCheckins.findIndex((g) => g.id == id);
      if (idx >= 0) {
        geoCheckins.splice(idx, 1);
        saveItem("sgf_geoCheckins", geoCheckins);
      }
      return { success: idx >= 0 };
    },
  },

  accountHold: {
    list: () => accountHolds,
    getById: (id: number) => accountHolds.find((ah) => ah.id == id) || null,
    getByCustomer: (customerId: number) => accountHolds.filter((ah) => ah.customerId == customerId),
    create: (data: any) => {
      const newItem = {
        ...data,
        id: Date.now(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      accountHolds.push(newItem);
      saveItem("sgf_accountHolds", accountHolds);
      return newItem;
    },
    update: ({ id, data }: { id: number; data: any }) => {
      const idx = accountHolds.findIndex((ah) => ah.id == id);
      if (idx >= 0) {
        accountHolds[idx] = { ...accountHolds[idx], ...data, updatedAt: new Date().toISOString() };
        saveItem("sgf_accountHolds", accountHolds);
      }
      return accountHolds[idx];
    },
    delete: (id: number) => {
      const idx = accountHolds.findIndex((ah) => ah.id == id);
      if (idx >= 0) {
        accountHolds.splice(idx, 1);
        saveItem("sgf_accountHolds", accountHolds);
      }
      return { success: idx >= 0 };
    },
  },
