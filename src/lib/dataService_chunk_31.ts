      logAudit("CREATE", "accountHold", hold.id, `Account hold placed for customer #${customerId}: ${reason || "Non-payment"}`);
      return hold;
    },
    releaseHold: ({ holdId }: { holdId: number }) => {
      const idx = accountHolds.findIndex((h) => h.id == holdId);
      if (idx >= 0) {
        accountHolds[idx] = { ...accountHolds[idx], status: "released", releasedAt: new Date().toISOString() };
        collectionNotes.push({ id: Date.now() + Math.random(), invoiceId: null, customerId: accountHolds[idx].customerId, type: "hold", notes: "Account hold released", contactMethod: "manual", contactPerson: "", followUpDate: null, createdAt: new Date().toISOString() });
        saveItem("sgf_accountHolds", accountHolds);
        saveItem("sgf_collectionNotes", collectionNotes);
        logAudit("UPDATE", "accountHold", holdId, `Account hold released for customer #${accountHolds[idx].customerId}`);
      }
      return { success: true };
    },
    getFollowUpsDue: () => {
      const today = new Date().toISOString().slice(0, 10);
      const overdueInvoices = dataService.collections.getOverdueInvoices();
      // Get the latest collection note per customer and check if followUpDate <= today
      const customerFollowUps = [] as any[];
      const custIds = new Set<number>();
      // Get all customers with outstanding balance
      for (const inv of overdueInvoices) {
        if (custIds.has(inv.customerId)) continue;
        custIds.add(inv.customerId);
        const custNotes = collectionNotes
          .filter((n) => n.customerId == inv.customerId)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        const latestNote = custNotes[0] || null;
        const daysSinceFollowUp = latestNote && latestNote.followUpDate
          ? Math.ceil((new Date(today).getTime() - new Date(latestNote.followUpDate).getTime()) / 86400000)
          : null;
        const needsFollowUp = latestNote && latestNote.followUpDate && latestNote.followUpDate <= today;
        if (needsFollowUp || !latestNote) {
          customerFollowUps.push({
            customer: inv.customer,
            customerId: inv.customerId,
            latestNote,
            daysSinceFollowUp,
            outstandingBalance: inv.customerOutstanding || inv.balanceDue || 0,
            invoices: overdueInvoices.filter((i) => i.customerId == inv.customerId),
            bucket: inv.bucket,
          });
        }
      }
      // Sort: most overdue follow-up first, then no follow-up at all
      return customerFollowUps.sort((a, b) => {
        if (!a.latestNote?.followUpDate) return -1;
        if (!b.latestNote?.followUpDate) return 1;
        return a.latestNote.followUpDate.localeCompare(b.latestNote.followUpDate);
      });
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
        const totalSubtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
        const totalVat = items.reduce((sum, item) => sum + item.vatAmount, 0);
        const totalCost = items.reduce((sum, item) => sum + item.totalCost, 0);
        report.push({
          customerId: customer.id,
          customerName: customer.name,
          customerCode: customer.customerCode,
          salesRepName: customer.salesRepName || "Unassigned",
          items,
          totalSubtotal,
          totalVat,
          totalCost,
          sampleCount: custSamples.length,
        });
      }
      const grandSubtotal = report.reduce((sum, r) => sum + r.totalSubtotal, 0);
      const grandVat = report.reduce((sum, r) => sum + r.totalVat, 0);
      const grandTotal = report.reduce((sum, r) => sum + r.totalCost, 0);
      return { customers: report, grandSubtotal, grandVat, grandTotal };
    },
  },

  dashboard: {
    stats: () => ({
      totalRevenue: invoices.filter((i) => !i.notes?.includes("Sample")).reduce((s, i) => s + Number(i.total || i.totalAmount || 0), 0),
      totalOrders: orders.filter((o) => o.orderType !== "sample").length,
      totalCustomers: customers.length,
      lowStockItems: products.filter((p) => p.status === "low_stock" || p.status === "out_of_stock").length,
      pendingOrders: orders.filter((o) => o.status === "pending").length,
      readyForDelivery: orders.filter((o) => o.status === "ready").length,
      overdueInvoices: invoices.filter((i) => i.status === "overdue").length,
      recentOrders: orders.filter((o) => o.orderType !== "sample").slice(-5).reverse(),
    }),
  },

  audit: {
    list: () => auditLog,
    getCustomerDeletions: () => auditLog.filter((entry) => entry.entityType === "customer" && entry.action === "DELETE"),
