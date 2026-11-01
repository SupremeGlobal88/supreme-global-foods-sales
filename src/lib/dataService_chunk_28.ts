        logAudit("CREATE", "specialPrice", newSp.id, `Special price set for ${cust?.name || "Customer"} on ${prod?.productName || "product"}: R${Number(price).toFixed(2)}`);
      }
      saveItem("sgf_specialPrices", specialPrices);
      return { id: Date.now(), updated: !!existing };
    },
    delete: ({ id }: { id: number }) => {
      const sp = specialPrices.find((s) => s.id === id);
      specialPrices = specialPrices.filter((sp) => sp.id !== id);
      saveItem("sgf_specialPrices", specialPrices);
      logAudit("DELETE", "specialPrice", id, `Special price deleted for ${customers.find((c) => c.id == sp?.customerId)?.name || "Customer"}`);
      return { success: true };
    },
  },

  salesRep: {
    list: () => {
      // Always read fresh from localStorage so Firebase-synced reps appear
      const reps = getCurrentSalesReps();
      return reps.map((rep, i) => ({
        id: i + 1,
        name: rep.name,
        email: rep.email || "",
        phone: rep.phone || "",
        region: rep.region || "",
        vehicleReg: rep.vehicleReg || "",
        role: "USER",
        isActive: rep.isActive !== false,
      }));
    },
    getStats: () => {
      const reps = getCurrentSalesReps();
      const repStats = reps.map((rep) => {
        const name = rep.name;
        const repCustomers = customers.filter((c) => c.salesRepName === name);
        const isCancelled = (o: any) => {
          const s = String(o.status || "").toLowerCase().trim();
          return s === "cancelled" || s === "canceled" || s === "cancel";
        };
        const repOrders = orders.filter((o) => {
          const cust = customers.find((c) => c.id == o.customerId);
          return cust?.salesRepName === name && o.orderType !== "sample" && o.orderType !== "quote" && !isCancelled(o);
        });
        const repSamples = orders.filter((o) => {
          const cust = customers.find((c) => c.id == o.customerId);
          return cust?.salesRepName === name && o.orderType === "sample" && !isCancelled(o);
        });
        // Include purchase orders (corporate) for this rep
        // Use po.salesRepName if stored directly (new pattern), fallback to corporateCustomer lookup (existing POs)
        const repPOs = purchaseOrders.filter((po) => {
          const poRepName = po.salesRepName || corporateCustomers.find((c) => c.id == po.corporateCustomerId)?.salesRepName;
          return poRepName === name && !isCancelled(po);
        });
        const poTotal = Math.round(repPOs.reduce((sum, po) => {
          if (po.total) return sum + Number(po.total);
          const items = po.lineItems || [];
          const subtotal = items.reduce((s: number, item: any) => s + (Number(item.quantity || 0) * Number(item.unitPrice || 0)), 0);
          const corpCustomer = corporateCustomers.find((c) => c.id == po.corporateCustomerId);
          const vatRate = corpCustomer?.vatExempt ? 0 : 0.15;
          return sum + Math.round(subtotal * (1 + vatRate) * 100) / 100;
        }, 0) * 100) / 100;

        const totalSales = Math.round((repOrders.reduce((sum, o) => sum + Number(o.total || 0), 0) + poTotal) * 100) / 100;
        const sampleCost = Math.round(repSamples.reduce((sum, o) => {
          const cost = o.items?.reduce((s: number, item: any) => {
            const prod = products.find((p) => p.id == item.stockItemId);
            return s + (Number(prod?.wholesalePrice || 0) * item.quantity);
          }, 0) || 0;
          return sum + cost;
        }, 0) * 100) / 100;
        return { name, customerCount: repCustomers.length, orderCount: repOrders.length + repPOs.length, sampleCount: repSamples.length, totalSales, sampleCost };
      });
      const activeCount = reps.filter((r) => r.isActive !== false).length;
      return { total: reps.length, active: activeCount, inactive: reps.length - activeCount, repStats };
    },

    /** Sales breakdown per rep: today, this week, this month */
    getSalesBreakdown: () => {
      const now = new Date();
      const todayStr = now.toISOString().slice(0, 10);

      // Week: Monday to Sunday
      const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ... 6=Sat
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const weekStart = new Date(now); weekStart.setDate(now.getDate() + mondayOffset);
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      // Month
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

      const repSales = getCurrentSalesReps().map((rep) => {
        const name = rep.name;
        const isCancelled = (o: any) => {
          const s = String(o.status || "").toLowerCase().trim();
          return s === "cancelled" || s === "canceled" || s === "cancel";
        };
        const repOrders = orders.filter((o) => {
          const cust = customers.find((c) => c.id == o.customerId);
          return cust?.salesRepName === name && o.orderType !== "sample" && o.orderType !== "quote" && !isCancelled(o);
        });

        // Include purchase orders (corporate) for this rep
        // Use po.salesRepName if stored directly (new pattern), fallback to corporateCustomer lookup (existing POs)
        const getPORepName = (po: any) => po.salesRepName || corporateCustomers.find((c) => c.id == po.corporateCustomerId)?.salesRepName;
        const getPOTotal = (po: any) => {
          if (po.total) return Number(po.total);
          const items = po.lineItems || [];
          const subtotal = items.reduce((s: number, item: any) => s + (Number(item.quantity || 0) * Number(item.unitPrice || 0)), 0);
          const corpCustomer = corporateCustomers.find((c) => c.id == po.corporateCustomerId);
          const vatRate = corpCustomer?.vatExempt ? 0 : 0.15;
          return Math.round(subtotal * (1 + vatRate) * 100) / 100;
        };
        const repPOs = purchaseOrders.filter((po) => getPORepName(po) === name && !isCancelled(po));

        const todaySales = Math.round((repOrders
          .filter((o) => (o.createdAt || "").startsWith(todayStr))
          .reduce((sum, o) => sum + Number(o.total || 0), 0) +
          repPOs.filter((po) => (po.createdAt || "").startsWith(todayStr))
            .reduce((sum, po) => sum + getPOTotal(po), 0)) * 100) / 100;

        const weekSales = Math.round((repOrders
          .filter((o) => {
            const ts = new Date(o.createdAt).getTime();
            return ts >= weekStart.getTime() && ts <= weekEnd.getTime();
          })
          .reduce((sum, o) => sum + Number(o.total || 0), 0) +
          repPOs.filter((po) => {
            const ts = new Date(po.createdAt).getTime();
            return ts >= weekStart.getTime() && ts <= weekEnd.getTime();
          }).reduce((sum, po) => sum + getPOTotal(po), 0)) * 100) / 100;

        const monthSales = Math.round((repOrders
          .filter((o) => {
            const ts = new Date(o.createdAt).getTime();
            return ts >= monthStart.getTime() && ts <= monthEnd.getTime();
          })
          .reduce((sum, o) => sum + Number(o.total || 0), 0) +
          repPOs.filter((po) => {
            const ts = new Date(po.createdAt).getTime();
