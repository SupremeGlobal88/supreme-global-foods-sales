            return ts >= monthStart.getTime() && ts <= monthEnd.getTime();
          }).reduce((sum, po) => sum + getPOTotal(po), 0)) * 100) / 100;

        return { name, todaySales, weekSales, monthSales };
      });

      return {
        today: todayStr,
        weekRange: `${weekStart.toISOString().slice(0, 10)} to ${weekEnd.toISOString().slice(0, 10)}`,
        month: now.toLocaleString("en-ZA", { month: "long", year: "numeric" }),
        repSales,
        totals: {
          today: repSales.reduce((s, r) => s + r.todaySales, 0),
          week: repSales.reduce((s, r) => s + r.weekSales, 0),
          month: repSales.reduce((s, r) => s + r.monthSales, 0),
        },
      };
    },

    // CRUD for sales reps
    create: (data: any) => {
      const reps = [...getCurrentSalesReps()]; // COPY
      const name = (data.name || "").trim();
      if (!name) return null;
      // Prevent duplicate names (case-insensitive)
      if (reps.some((r) => r.name.toLowerCase() === name.toLowerCase())) return null;
      const newRep: SalesRep = {
        name,
        email: data.email || "",
        phone: data.phone || "",
        region: data.region || "",
        vehicleReg: data.vehicleReg || "",
        isActive: true,
      };
      reps.push(newRep);
      // Update both localStorage and in-memory
      SALES_REPS.length = 0;
      SALES_REPS.push(...reps);
      saveSalesReps();
      return { id: reps.length, ...newRep };
    },
    update: ({ id, data }: { id: number; data: any }) => {
      const reps = [...getCurrentSalesReps()]; // COPY
      const idx = id - 1;
      if (idx < 0 || idx >= reps.length) return null;
      const oldName = reps[idx].name;
      const newName = (data.name || reps[idx].name).trim();
      if (!newName) return null;
      // If renaming, ensure no duplicate
      if (newName.toLowerCase() !== oldName.toLowerCase()) {
        if (reps.some((r, i) => i !== idx && r.name.toLowerCase() === newName.toLowerCase())) {
          return null; // would create duplicate
        }
      }
      reps[idx] = {
        ...reps[idx],
        name: newName,
        email: data.email !== undefined ? data.email : reps[idx].email,
        phone: data.phone !== undefined ? data.phone : reps[idx].phone,
        region: data.region !== undefined ? data.region : reps[idx].region,
        vehicleReg: data.vehicleReg !== undefined ? data.vehicleReg : reps[idx].vehicleReg,
      };
      // Update customers who had the old rep name
      if (oldName !== newName) {
        customers.filter((c) => c.salesRepName === oldName).forEach((c) => (c.salesRepName = newName));
        saveItem("sgf_customers", customers);
      }
      SALES_REPS.length = 0;
      SALES_REPS.push(...reps);
      saveSalesReps();
      return { id, ...reps[idx], oldName };
    },
    toggleActive: ({ id }: { id: number }) => {
      const reps = [...getCurrentSalesReps()]; // COPY
      const idx = id - 1;
      if (idx < 0 || idx >= reps.length) return null;
      reps[idx].isActive = !reps[idx].isActive;
      SALES_REPS.length = 0;
      SALES_REPS.push(...reps);
      saveSalesReps();
      return { id, ...reps[idx] };
    },
    delete: ({ id }: { id: number }) => {
      const reps = [...getCurrentSalesReps()]; // COPY
      const idx = id - 1;
      if (idx < 0 || idx >= reps.length) return null;
      const deletedName = reps[idx].name;
      reps.splice(idx, 1);
      SALES_REPS.length = 0;
      SALES_REPS.push(...reps);
      saveSalesReps();
      return { success: true, deletedName };
    },
  },

  followUp: {
    list: () => {
      // Show ALL pending follow-ups (sales rep needs to action them)
      return followUps
        .filter((fu) => fu.status === "pending")
        .map((fu) => {
          const order = orders.find((o) => o.id == fu.orderId);
          const customer = customers.find((c) => c.id == fu.customerId);
          return {
            ...fu,
            customer: customer || null,
            order: order ? { ...order, customer: customer || null } : null,
          };
        });
    },
    listAll: (days: number = 10) => {
      // Unified list: sample follow-ups + 10-day no-order follow-ups
      const now = new Date();
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      const cutoffMs = cutoff.getTime();

      // Sample follow-ups
      const sampleFollowUps = followUps
        .filter((fu) => fu.status === "pending")
        .map((fu) => {
          const order = orders.find((o) => o.id == fu.orderId);
          const customer = customers.find((c) => c.id == fu.customerId);
          return {
            ...fu,
            followUpKind: "sample",
            customer: customer || null,
            order: order ? { ...order, customer: customer || null } : null,
            daysSince: fu.followUpDate
              ? Math.floor((now.getTime() - new Date(fu.followUpDate).getTime()) / 86400000)
              : 0,
          };
        });

      // 10-day no-order follow-ups (computed, not stored)
      const noOrderFollowUps = customers
        .filter((c) => c.isActive === "active")
        .map((c) => {
          const custOrders = orders
            .filter((o) => o.customerId == c.id)
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          const lastOrder = custOrders[0] || null;
          const lastOrderDate = lastOrder ? new Date(lastOrder.createdAt).getTime() : 0;
          const daysSinceLastOrder = lastOrderDate
            ? Math.floor((Date.now() - lastOrderDate) / 86400000)
            : 999;
          return {
            ...c,
            lastOrder,
            lastOrderDate: lastOrder?.createdAt || null,
            daysSinceLastOrder,
            totalOrders: custOrders.length,
            needsFollowUp: !lastOrder || lastOrderDate < cutoffMs,
          };
        })
        .filter((c) => c.needsFollowUp)
        .map((c) => ({
          id: `noorder-${c.id}`,
          orderId: null,
          customerId: c.id,
          orderNumber: null,
          followUpDate: cutoff.toISOString(),
          status: "pending",
          reason: null,
          expectedOrderDate: null,
          salesRepName: c.salesRepName || "",
          actionType: null,
          title: null,
          scheduledAppointmentId: null,
          createdAt: c.createdAt,
          followUpKind: "no_order",
          customer: c,
          order: null,
          daysSince: c.daysSinceLastOrder,
        }));

      // Combine and sort by days since (most overdue first)
      return [...sampleFollowUps, ...noOrderFollowUps].sort(
        (a, b) => (b.daysSince || 0) - (a.daysSince || 0)
      );
    },
    update: ({ id, status, reason, expectedOrderDate, actionType, title, scheduledAppointmentId }: { id: number; status: string; reason?: string; expectedOrderDate?: string; actionType?: string; title?: string; scheduledAppointmentId?: number }) => {
      const idx = followUps.findIndex((fu) => fu.id == id);
      if (idx >= 0) {
        const oldStatus = followUps[idx].status;
        followUps[idx] = {
          ...followUps[idx],
          status,
          reason: reason !== undefined ? reason : followUps[idx].reason,
          expectedOrderDate: expectedOrderDate !== undefined ? expectedOrderDate : followUps[idx].expectedOrderDate,
