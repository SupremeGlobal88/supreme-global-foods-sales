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
          actionType: actionType !== undefined ? actionType : followUps[idx].actionType,
          title: title !== undefined ? title : followUps[idx].title,
          scheduledAppointmentId: scheduledAppointmentId !== undefined ? scheduledAppointmentId : followUps[idx].scheduledAppointmentId,
          updatedAt: new Date().toISOString(),
        };
        saveItem("sgf_followUps", followUps);
        logAudit("UPDATE", "followUp", id, `Follow-up updated: status ${oldStatus} → ${status}${reason ? `, reason: ${reason}` : ""}`);
        return followUps[idx];
      }
      return null;
    },
    getStats: () => ({
      pending: followUps.filter((fu) => fu.status === "pending").length,
      completed: followUps.filter((fu) => fu.status === "completed").length,
      overdue: followUps.filter((fu) => fu.followUpDate < new Date().toISOString() && fu.status === "pending").length,
    }),
  },
  customerFollowUp: {
    getAllFollowUps: () => followUps,
  },

  collections: {
    getOverdueInvoices: () => {
      const now = new Date();
      return invoices
        .filter((inv) => inv.status !== "paid" && inv.status !== "cancelled")
        .map((inv) => {
          const customer = customers.find((c) => c.id == inv.customerId);
          // Use invoiceDate (actual invoice date) not createdAt (import date)
          const invoiceDate = new Date(inv.invoiceDate || inv.createdAt);
          // Calculate due date from payment terms
          const terms = inv.paymentTerms || "30_days";
          const termDays = terms === "30_days" ? 30 : terms === "14_days" ? 14 : terms === "7_days" ? 7 : terms === "cod" ? 0 : 30;
          const dueDate = new Date(invoiceDate);
          dueDate.setDate(dueDate.getDate() + termDays);
          const daysOverdue = Math.max(0, Math.floor((now.getTime() - dueDate.getTime()) / 86400000));
          let bucket = "pre_due";
          if (daysOverdue >= 21) bucket = "days_21_plus";
          else if (daysOverdue >= 11) bucket = "days_11_20";
          else if (daysOverdue >= 6) bucket = "days_6_10";
          else if (daysOverdue >= 3) bucket = "days_3_5";
          else if (daysOverdue >= 1) bucket = "days_1_2";
          else if (daysOverdue === 0) bucket = "due_today";
          const notes = collectionNotes.filter((n) => n.invoiceId == inv.id);
          const latestPromise = collectionPromises
            .filter((p) => p.invoiceId == inv.id)
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] || null;
          return {
            ...inv,
            customer: customer || null,
            invoiceDate: inv.invoiceDate || inv.createdAt,
            dueDate: dueDate.toISOString(),
            daysOverdue,
            bucket,
            notes,
            latestPromise,
            lastFollowUp: notes.length > 0
              ? notes.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
              : null,
          };
        })
        .sort((a, b) => b.daysOverdue - a.daysOverdue);
    },
  },

  sampleReport: {
    getByCustomer: ({ customerId }: { customerId: number }) => {
      const customerOrders = orders.filter((o) => o.customerId == customerId && o.orderType === "sample");
      const report = customerOrders.flatMap((o) =>
        (o.items || []).map((item: any) => {
          const product = products.find((p) => p.id == item.stockItemId);
          const invoice = invoices.find((i) => i.orderId == o.id);
          const unitCost = Number(item.unitPrice || product?.corporatePrice || 0);
          const lineSubtotal = unitCost * item.quantity;
          const lineVat = lineSubtotal * 0.15;
          const lineTotal = lineSubtotal + lineVat;
          return {
            productCode: product?.productCode || "",
            productName: product?.productName || "Unknown",
            dateTaken: o.createdAt,
            orderNumber: o.orderNumber,
            invoiceNumber: invoice?.invoiceNumber || "N/A",
            quantity: item.quantity,
            unitCost,
            subtotal: lineSubtotal,
            vatAmount: lineVat,
            totalCost: lineTotal,
          };
        })
      );
      const grandSubtotal = report.reduce((sum, r) => sum + r.subtotal, 0);
      const grandVat = report.reduce((sum, r) => sum + r.vatAmount, 0);
      const grandTotal = report.reduce((sum, r) => sum + r.totalCost, 0);
      return { items: report, grandSubtotal, grandVat, grandTotal };
    },
    getAll: () => {
      const sampleOrders = orders.filter((o) => o.orderType === "sample");
      const report = [] as any[];
      for (const customer of [...customers].sort((a, b) => (a.name || "").localeCompare(b.name || ""))) {
        const custSamples = sampleOrders.filter((o) => o.customerId == customer.id);
        if (custSamples.length === 0) continue;
        const items = custSamples.flatMap((o) =>
          (o.items || []).map((item: any) => {
            const product = products.find((p) => p.id == item.stockItemId);
            const invoice = invoices.find((i) => i.orderId == o.id);
            const unitCost = Number(item.unitPrice || product?.corporatePrice || 0);
            const lineSubtotal = unitCost * item.quantity;
            const lineVat = lineSubtotal * 0.15;
            const lineTotal = lineSubtotal + lineVat;
            return {
              productCode: product?.productCode || "",
              productName: product?.productName || "Unknown",
              dateTaken: o.createdAt,
              orderNumber: o.orderNumber,
              invoiceNumber: invoice?.invoiceNumber || "N/A",
              quantity: item.quantity,
              unitCost,
              subtotal: lineSubtotal,
              vatAmount: lineVat,
              totalCost: lineTotal,
            };
          })
        );
        const grandSubtotal = items.reduce((sum: number, r: any) => sum + r.subtotal, 0);
        const grandVat = items.reduce((sum: number, r: any) => sum + r.vatAmount, 0);
        const grandTotal = items.reduce((sum: number, r: any) => sum + r.totalCost, 0);
        report.push({
          customer: { id: customer.id, name: customer.name, city: customer.city },
          items,
          grandSubtotal,
          grandVat,
          grandTotal,
        });
      }
      const totalGrandSubtotal = report.reduce((sum, r) => sum + r.grandSubtotal, 0);
      const totalGrandVat = report.reduce((sum, r) => sum + r.grandVat, 0);
      const totalGrandTotal = report.reduce((sum, r) => sum + r.grandTotal, 0);
      return { report, totalGrandSubtotal, totalGrandVat, totalGrandTotal };
    },
  },

  // INVENTORY (RAW INGREDIENTS)
  inventory: {
    list: () => rawIngredients,
    getById: (id: number) => rawIngredients.find((i) => i.id === id),
    create: (item: any) => {
      const id = Math.max(0, ...rawIngredients.map((i) => i.id)) + 1;
      const newItem = { ...item, id, createdAt: new Date().toISOString() };
      rawIngredients.push(newItem);
      saveItem("sgf_rawIngredients", rawIngredients);
      logAudit("CREATE", "rawIngredient", id, `Created raw ingredient ${item.name}`);
      return newItem;
    },
    update: (item: any) => {
      const idx = rawIngredients.findIndex((i) => i.id === item.id);
      if (idx >= 0) {
        rawIngredients[idx] = { ...rawIngredients[idx], ...item, updatedAt: new Date().toISOString() };
        saveItem("sgf_rawIngredients", rawIngredients);
        logAudit("UPDATE", "rawIngredient", item.id, `Updated raw ingredient ${item.name}`);
        return rawIngredients[idx];
      }
      return null;
    },
    delete: ({ id }: { id: number }) => {
      const idx = rawIngredients.findIndex((i) => i.id === id);
      if (idx >= 0) {
        rawIngredients.splice(idx, 1);
        saveItem("sgf_rawIngredients", rawIngredients);
        logAudit("DELETE", "rawIngredient", id, `Deleted raw ingredient`);
        return { success: true };
      }
      return { success: false, error: "Not found" };
    },
  },

  salesRep: {
    list: () => getCurrentSalesReps(),
    listActive: () => getCurrentSalesReps().filter((r) => r.isActive !== false),
    getByName: (name: string) => getCurrentSalesReps().find((r) => r.name === name),
    getById: (id: number) => {
      const reps = getCurrentSalesReps();
      return id > 0 && id <= reps.length ? reps[id - 1] : null;
    },
    create: (rep: SalesRep) => {
      const reps = getCurrentSalesReps();
      if (reps.find((r) => r.name === rep.name)) return null;
      const newRep = { ...rep, id: reps.length + 1 };
      reps.push(newRep);
      SALES_REPS.length = 0;
      SALES_REPS.push(...reps);
      saveSalesReps();
      return newRep;
    },
    update: ({ id, data }: { id: number; data: Partial<SalesRep> }) => {
      const reps = [...getCurrentSalesReps()];
      const idx = id - 1;
      if (idx < 0 || idx >= reps.length) return null;
      reps[idx] = { ...reps[idx], ...data, id };
      SALES_REPS.length = 0;
      SALES_REPS.push(...reps);
      saveSalesReps();
      return reps[idx];
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

  getSalesReps: () => getCurrentSalesReps(),
  getSalesRepNames: () => getCurrentSalesReps().map((r) => r.name),

  // Corporate customers
  corporateCustomer: {
    list: () => corporateCustomers,
    getById: (id: number) => corporateCustomers.find((c) => c.id === id),
    getByCustomerId: (customerId: number) => corporateCustomers.find((c) => c.customerId === customerId),
    create: (data: any) => {
      const id = corporateCustomers.length > 0 ? Math.max(...corporateCustomers.map((c) => c.id)) + 1 : 1;
      const newCustomer = { ...data, id, createdAt: new Date().toISOString() };
      corporateCustomers.push(newCustomer);
      saveItem("sgf_corporateCustomers", corporateCustomers);
      return newCustomer;
    },
    update: ({ id, data }: { id: number; data: any }) => {
      const idx = corporateCustomers.findIndex((c) => c.id === id);
      if (idx >= 0) {
        corporateCustomers[idx] = { ...corporateCustomers[idx], ...data, updatedAt: new Date().toISOString() };
        saveItem("sgf_corporateCustomers", corporateCustomers);
        return corporateCustomers[idx];
      }
      return null;
    },
    delete: ({ id }: { id: number }) => {
      const idx = corporateCustomers.findIndex((c) => c.id === id);
      if (idx >= 0) {
        corporateCustomers.splice(idx, 1);
        saveItem("sgf_corporateCustomers", corporateCustomers);
        return { success: true };
      }
      return { success: false, error: "Not found" };
    },
  },

  // Purchase Orders
  purchaseOrder: {
    list: () => purchaseOrders,
    getById: (id: number) => purchaseOrders.find((po) => po.id === id),
    getByCustomer: (customerId: number) => purchaseOrders.filter((po) => po.customerId === customerId),
    getByCorporateCustomer: (corporateCustomerId: number) => purchaseOrders.filter((po) => po.corporateCustomerId === corporateCustomerId),
    getStats: () => ({
      total: purchaseOrders.length,
      pending: purchaseOrders.filter((po) => po.status === "pending").length,
      fulfilled: purchaseOrders.filter((po) => po.status === "fulfilled").length,
      cancelled: purchaseOrders.filter((po) => po.status === "cancelled").length,
    }),
    create: (data: any) => {
      const id = purchaseOrders.length > 0 ? Math.max(...purchaseOrders.map((po) => po.id)) + 1 : 1;
      const newPO = { ...data, id, createdAt: new Date().toISOString() };
      purchaseOrders.push(newPO);
      saveItem("sgf_purchaseOrders", purchaseOrders);
      return newPO;
    },
    update: ({ id, data }: { id: number; data: any }) => {
      const idx = purchaseOrders.findIndex((po) => po.id === id);
      if (idx >= 0) {
        purchaseOrders[idx] = { ...purchaseOrders[idx], ...data, updatedAt: new Date().toISOString() };
        saveItem("sgf_purchaseOrders", purchaseOrders);
        return purchaseOrders[idx];
      }
      return null;
    },
    delete: ({ id }: { id: number }) => {
      const idx = purchaseOrders.findIndex((po) => po.id === id);
      if (idx >= 0) {
        purchaseOrders.splice(idx, 1);
        saveItem("sgf_purchaseOrders", purchaseOrders);
        return { success: true };
      }
      return { success: false, error: "Not found" };
    },
  },

  // Barrels
  barrel: {
    list: () => barrels,
    getById: (id: number) => barrels.find((b) => b.id === id),
    getByCustomer: (customerId: number) => barrels.filter((b) => b.customerId === customerId),
    create: (data: any) => {
      const id = barrels.length > 0 ? Math.max(...barrels.map((b) => b.id)) + 1 : 1;
      const newBarrel = { ...data, id, createdAt: new Date().toISOString() };
      barrels.push(newBarrel);
      saveItem("sgf_barrels", barrels);
      return newBarrel;
    },
    update: ({ id, data }: { id: number; data: any }) => {
      const idx = barrels.findIndex((b) => b.id === id);
      if (idx >= 0) {
        barrels[idx] = { ...barrels[idx], ...data, updatedAt: new Date().toISOString() };
        saveItem("sgf_barrels", barrels);
        return barrels[idx];
      }
      return null;
    },
    delete: ({ id }: { id: number }) => {
      const idx = barrels.findIndex((b) => b.id === id);
      if (idx >= 0) {
        barrels.splice(idx, 1);
        saveItem("sgf_barrels", barrels);
        return { success: true };
      }
      return { success: false, error: "Not found" };
    },
  },

  // Certificates of Compliance
  coc: {
    list: () => certificatesOfCompliance,
    getById: (id: number) => certificatesOfCompliance.find((c) => c.id === id),
    getByCustomer: (customerId: number) => certificatesOfCompliance.filter((c) => c.customerId === customerId),
    create: (data: any) => {
      const id = certificatesOfCompliance.length > 0 ? Math.max(...certificatesOfCompliance.map((c) => c.id)) + 1 : 1;
      const newCOC = { ...data, id, createdAt: new Date().toISOString() };
      certificatesOfCompliance.push(newCOC);
      saveItem("sgf_certificatesOfCompliance", certificatesOfCompliance);
      return newCOC;
    },
    update: ({ id, data }: { id: number; data: any }) => {
      const idx = certificatesOfCompliance.findIndex((c) => c.id === id);
      if (idx >= 0) {
        certificatesOfCompliance[idx] = { ...certificatesOfCompliance[idx], ...data, updatedAt: new Date().toISOString() };
        saveItem("sgf_certificatesOfCompliance", certificatesOfCompliance);
        return certificatesOfCompliance[idx];
      }
      return null;
    },
    delete: ({ id }: { id: number }) => {
      const idx = certificatesOfCompliance.findIndex((c) => c.id === id);
      if (idx >= 0) {
        certificatesOfCompliance.splice(idx, 1);
        saveItem("sgf_certificatesOfCompliance", certificatesOfCompliance);
        return { success: true };
      }
      return { success: false, error: "Not found" };
    },
  },

  // Packing List
  packingList: {
    list: () => packingListLines,
    getById: (id: number) => packingListLines.find((pl) => pl.id === id),
    getByCustomer: (customerId: number) => packingListLines.filter((pl) => pl.customerId === customerId),
    create: (data: any) => {
      const id = packingListLines.length > 0 ? Math.max(...packingListLines.map((pl) => pl.id)) + 1 : 1;
      const newPL = { ...data, id, createdAt: new Date().toISOString() };
      packingListLines.push(newPL);
      saveItem("sgf_packingListLines", packingListLines);
      return newPL;
    },
    update: ({ id, data }: { id: number; data: any }) => {
      const idx = packingListLines.findIndex((pl) => pl.id === id);
      if (idx >= 0) {
        packingListLines[idx] = { ...packingListLines[idx], ...data, updatedAt: new Date().toISOString() };
        saveItem("sgf_packingListLines", packingListLines);
        return packingListLines[idx];
      }
      return null;
    },
    delete: ({ id }: { id: number }) => {
      const idx = packingListLines.findIndex((pl) => pl.id === id);
      if (idx >= 0) {
        packingListLines.splice(idx, 1);
        saveItem("sgf_packingListLines", packingListLines);
        return { success: true };
      }
      return { success: false, error: "Not found" };
    },
  },

  // Raw ingredients
  rawIngredient: {
    list: () => rawIngredients,
    getById: (id: number) => rawIngredients.find((i) => i.id === id),
    create: (data: any) => {
      const id = rawIngredients.length > 0 ? Math.max(...rawIngredients.map((i) => i.id)) + 1 : 1;
      const newItem = { ...data, id, createdAt: new Date().toISOString() };
      rawIngredients.push(newItem);
      saveItem("sgf_rawIngredients", rawIngredients);
      return newItem;
    },
    update: ({ id, data }: { id: number; data: any }) => {
      const idx = rawIngredients.findIndex((i) => i.id === id);
      if (idx >= 0) {
        rawIngredients[idx] = { ...rawIngredients[idx], ...data, updatedAt: new Date().toISOString() };
        saveItem("sgf_rawIngredients", rawIngredients);
        return rawIngredients[idx];
      }
      return null;
    },
    delete: ({ id }: { id: number }) => {
      const idx = rawIngredients.findIndex((i) => i.id === id);
      if (idx >= 0) {
        rawIngredients.splice(idx, 1);
        saveItem("sgf_rawIngredients", rawIngredients);
        return { success: true };
      }
      return { success: false, error: "Not found" };
    },
  },

  // SPECIAL PRICES
  specialPrice: {
    list: () => specialPrices,
    getById: (id: number) => specialPrices.find((sp) => sp.id === id),
    getByCustomer: (customerId: number) => specialPrices.filter((sp) => sp.customerId === customerId),
    getByProduct: (stockItemId: number) => specialPrices.filter((sp) => sp.stockItemId === stockItemId),
    create: (data: any) => {
      const id = specialPrices.length > 0 ? Math.max(...specialPrices.map((sp) => sp.id)) + 1 : 1;
      const newSP = { ...data, id, createdAt: new Date().toISOString() };
      specialPrices.push(newSP);
      saveItem("sgf_specialPrices", specialPrices);
      return newSP;
    },
    update: ({ id, data }: { id: number; data: any }) => {
      const idx = specialPrices.findIndex((sp) => sp.id === id);
      if (idx >= 0) {
        specialPrices[idx] = { ...specialPrices[idx], ...data, updatedAt: new Date().toISOString() };
        saveItem("sgf_specialPrices", specialPrices);
        return specialPrices[idx];
      }
      return null;
    },
    delete: ({ id }: { id: number }) => {
      const idx = specialPrices.findIndex((sp) => sp.id === id);
      if (idx >= 0) {
        specialPrices.splice(idx, 1);
        saveItem("sgf_specialPrices", specialPrices);
        return { success: true };
      }
      return { success: false, error: "Not found" };
    },
  },

  other: {
    getAddressChanges: () => {
      return auditLog
        .filter((entry) => entry.action === "UPDATE" && entry.entity === "customer")
        .map((entry) => ({
          ...entry,
          customer: customers.find((c) => c.id == entry.entityId),
        }));
    },
    getStats: () => {
      const today = new Date().toISOString().slice(0, 10);
      const todayOrders = orders.filter((o) => o.createdAt?.startsWith(today));
      const todayInvoices = invoices.filter((i) => i.createdAt?.startsWith(today));
      return {
        totalCustomers: customers.length,
        totalProducts: products.length,
        totalOrders: orders.length,
        totalInvoices: invoices.length,
        todayOrders: todayOrders.length,
        todayInvoices: todayInvoices.length,
        todayRevenue: todayInvoices.reduce((sum, i) => sum + (i.total || 0), 0),
        outstandingBalance: invoices
          .filter((i) => i.status !== "paid" && i.status !== "cancelled")
          .reduce((sum, i) => sum + (i.balanceDue || 0), 0),
      };
    },
    getFullTrail: () => auditLog,
    getMissedAppointments: () => {
      const now = new Date().toISOString();
      return appointments
        .filter((a) => a.status !== "completed" && a.status !== "cancelled" && a.dateTime < now)
        .map((a) => ({
          ...a,
          customer: customers.find((c) => c.id == a.customerId),
        }));
    },
    getCheckInReport: () => {
      return checkins.map((c) => ({
        ...c,
        customer: customers.find((cust) => cust.id == c.customerId),
      }));
    },
  },

  dashboard: {
    summary: () => {
      const today = new Date().toISOString().slice(0, 10);
      const todayOrders = orders.filter((o) => o.createdAt?.startsWith(today));
      const todayInvoices = invoices.filter((i) => i.createdAt?.startsWith(today));
      return {
        totalCustomers: customers.length,
        totalProducts: products.length,
        totalOrders: orders.length,
        totalInvoices: invoices.length,
        todayOrders: todayOrders.length,
        todayInvoices: todayInvoices.length,
        todayRevenue: todayInvoices.reduce((sum, i) => sum + (i.total || 0), 0),
        outstandingBalance: invoices
          .filter((i) => i.status !== "paid" && i.status !== "cancelled")
          .reduce((sum, i) => sum + (i.balanceDue || 0), 0),
      };
    },
    salesTrend: (days: number = 30) => {
      const result = [] as any[];
      for (let i = days - 1; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().slice(0, 10);
        const dayInvoices = invoices.filter((inv) => inv.createdAt?.startsWith(dateStr));
        result.push({
          date: dateStr,
          revenue: dayInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0),
          count: dayInvoices.length,
        });
      }
      return result;
    },
    repPerformance: () => {
      const reps = getCurrentSalesReps();
      return reps.map((rep) => {
        const repOrders = orders.filter((o) => o.salesRepName === rep.name);
        const repInvoices = invoices.filter((i) => i.salesRepName === rep.name);
        return {
          name: rep.name,
          orders: repOrders.length,
          revenue: repInvoices.reduce((sum, i) => sum + (i.total || 0), 0),
          outstanding: repInvoices
            .filter((i) => i.status !== "paid" && i.status !== "cancelled")
            .reduce((sum, i) => sum + (i.balanceDue || 0), 0),
        };
      });
    },
    collectionMetrics: () => {
      const now = new Date();
      const overdueInvoices = invoices.filter((inv) => inv.status !== "paid" && inv.status !== "cancelled");
      const totalOutstanding = overdueInvoices.reduce((sum, inv) => sum + (inv.balanceDue || 0), 0);
      const overdue = overdueInvoices.filter((inv) => {
        const dueDate = new Date(inv.invoiceDate || inv.createdAt);
        dueDate.setDate(dueDate.getDate() + 30);
        return dueDate < now;
      });
      return {
        totalOutstanding,
        overdueCount: overdue.length,
        overdueAmount: overdue.reduce((sum, inv) => sum + (inv.balanceDue || 0), 0),
      };
    },
    stockAlerts: () => {
      return products
        .filter((p) => p.quantity !== undefined && p.quantity < (p.minStock || 10))
        .map((p) => ({
          ...p,
          shortfall: (p.minStock || 10) - p.quantity,
        }));
    },
    upcomingAppointments: (days: number = 7) => {
      const now = new Date();
      const future = new Date();
      future.setDate(future.getDate() + days);
      return appointments
        .filter((a) => a.dateTime >= now.toISOString() && a.dateTime <= future.toISOString())
        .map((a) => ({
          ...a,
          customer: customers.find((c) => c.id == a.customerId),
        }));
    },
    todayCheckIns: () => {
      const today = new Date().toISOString().slice(0, 10);
      return checkins
        .filter((c) => c.checkInTime?.startsWith(today))
        .map((c) => ({
          ...c,
          customer: customers.find((cust) => cust.id == c.customerId),
        }));
    },
  },

  subscription: {
    listen: () => {
      // Return a mock subscription that emits data changes
      return {
        subscribe: (callback: (data: any) => void) => {
          const handler = (event: any) => callback(event.detail);
          window.addEventListener("firebaseDataReceived", handler);
          return () => window.removeEventListener("firebaseDataReceived", handler);
        },
      };
    },
  },

  // Backward compat
  getSalesReps: () => getCurrentSalesReps(),
  getSalesRepNames: () => getCurrentSalesReps().map((r) => r.name),
};

// Load data on module init
load();

export { dataService };
