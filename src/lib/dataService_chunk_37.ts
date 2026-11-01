        // 3. Exact match by productName
        if (it.productName) {
          const nameNorm = String(it.productName).toLowerCase().trim();
          const byName = products.find((p) => {
            const pNameNorm = String(p.productName || "").toLowerCase().trim();
            return pNameNorm === nameNorm;
          });
          if (byName) return byName;
        }
        // 4. Substring match in both directions
        if (it.description) {
          const descNorm = String(it.description).toLowerCase().trim();
          // Find product whose name is contained in the description
          const byDescContainsName = products.find((p) => {
            const nameNorm = String(p.productName || "").toLowerCase().trim();
            return nameNorm.length > 3 && descNorm.includes(nameNorm);
          });
          if (byDescContainsName) return byDescContainsName;
          // Find product whose name contains the description
          const byNameContainsDesc = products.find((p) => {
            const nameNorm = String(p.productName || "").toLowerCase().trim();
            return descNorm.length > 3 && nameNorm.includes(descNorm);
          });
          if (byNameContainsDesc) return byNameContainsDesc;
        }
        // 5. Fuzzy word matching - score products by keyword overlap
        const searchText = it.description || it.productName || "";
        const searchWords = getKeywords(searchText);
        if (searchWords.length > 0) {
          let bestProduct: any = null;
          let bestScore = 0;
          for (const p of products) {
            const prodWords = getKeywords(p.productName || "");
            const matches = searchWords.filter((sw) => prodWords.some((pw) => pw.includes(sw) || sw.includes(pw)));
            const score = matches.length / Math.max(searchWords.length, prodWords.length, 1);
            if (score > bestScore) {
              bestScore = score;
              bestProduct = p;
            }
          }
          if (bestScore >= 0.4 && bestProduct) return bestProduct; // at least 40% word overlap
        }
        return null;
      }

      const newCOCs = (inv.items || []).map((it: any, idx: number) => {
        const product = findProductForItem(it);
        const qtyBundles = it.quantity || 0;
        const isSheep = (product?.species || product?.category || "").toLowerCase().includes("sheep");
        const animalName = isSheep ? "sheep" : "hog";
        const casingType = (product?.category || "").toLowerCase().includes("long") ? "LONG" :
                           (product?.category || "").toLowerCase().includes("short") ? "SHORT" : "LONG";
        const size = product?.size || "";
        const calibration = size || "-";
        const strands = product?.strands || "";
        const qtyStrands = strands ? `${strands} strands / bundle` : "13 strands / bundle";
        const length = strands && strands.includes("90") ? "Minimum 90 to 91m/bundle" :
                       strands && strands.includes("30") ? "Minimum 30m/bundle" : "Minimum 90 to 91m/bundle";
        const stuffingCapacity = qtyBundles <= 150 ? "44kg average / bundle" : "58kg average / bundle";
        const sgfProductCode = product?.productCode || it.productCode || "";
        const productDesc = it.description || product?.productName || it.productName || "";
        // Extract color from invoice description if product color doesn't match
        const descColor = extractColorFromDesc(it.description || "");
        const cocColour = descColor || product?.color || "White / Beige color";

        return {
          id: Date.now() + idx,
          invoiceId,
          invoiceNumber: inv.invoiceNumber || "",
          orderNumber: inv.orderNumber || "",
          poNumber: inv.poNumber || "",
          customerId: inv.customerId,
          customerName: customerRecord?.name || inv.customer?.name || "",
          company: inv.company || "sgf",
          // Corporate-style COC fields
          recircleProductCode: sgfProductCode,
          customerProductCode: sgfProductCode, // regular customers use same SGF code
          productDescription: productDesc,
          batchNumber: `${batchPrefix}-${String(idx + 1).padStart(3, "0")}`,
          lotSealNumber: `${lotPrefix}-${String(idx + 1).padStart(3, "0")}`,
          manufacturingDate: mfgDateStr,
          useByDate: useByStr,
          barrelNumber: `Total: ${qtyBundles} Bundles`,
          quantityBundles: qtyBundles,
          calibration,
          length,
          qtyStrands,
          stuffingCapacity,
          odour: "No off odors to be present",
          colour: cocColour,
          packing: "Bundles packed in barrels of 150 or 200",
          countryOfOrigin: "South Africa",
          status: "Non HALAAL",
          casingType,
          animalType: animalName,
          cleaningProcess: "Collect small intestines from Abattoir. Manure stripped by hand. Mucosa is removed, through a series of soaking and feeding through a combination of rollers. Final: Quality control, calibration and measuring processed. Product salted and stored in plastic drums ready for delivery.",
          handlingStorage: "Casings to be handled, transported, packed, selected and dispatched in conformance with Good Manufacturing Practice. Casing supplier to store casings in salt, and at ambient/cool temperature. End user to store casings under refrigerated conditions and use within 10-12 months (Opened/Unopened) of receiving it.",
          cocDate: now.toISOString(),
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        };
      });

      certificatesOfCompliance.push(...newCOCs);
      saveItem("sgf_certificatesOfCompliance", certificatesOfCompliance);
      saveItem("sgf_cocs", certificatesOfCompliance);
      return newCOCs;
    },
    create: (data: any) => {
      let company = data.company;
      if (!company && data.barrelId) {
        const b = barrels.find((br) => br.id == data.barrelId);
        if (b?.company) company = b.company;
      }
      if (!company && data.purchaseOrderId) {
        const po = purchaseOrders.find((p) => p.id == data.purchaseOrderId);
        if (po?.company) company = po.company;
      }
      const newItem = {
        ...data,
        company: company || "sgf",
        id: Date.now(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      certificatesOfCompliance.push(newItem);
      saveItem("sgf_certificatesOfCompliance", certificatesOfCompliance);
      saveItem("sgf_cocs", certificatesOfCompliance);
      return newItem;
    },
    update: ({ id, data }: { id: number; data: any }) => {
      const idx = certificatesOfCompliance.findIndex((c) => c.id == id);
      if (idx >= 0) {
        certificatesOfCompliance[idx] = { ...certificatesOfCompliance[idx], ...data, updatedAt: new Date().toISOString() };
        saveItem("sgf_certificatesOfCompliance", certificatesOfCompliance);
        saveItem("sgf_cocs", certificatesOfCompliance);
        return certificatesOfCompliance[idx];
      }
      return null;
    },
    delete: (id: number) => {
      certificatesOfCompliance = certificatesOfCompliance.filter((c) => c.id != id);
      saveItem("sgf_certificatesOfCompliance", certificatesOfCompliance);
      saveItem("sgf_cocs", certificatesOfCompliance);
      return { success: true };
    },
    /** Atomically delete all existing COCs for a PO and create new ones.
     *  Prevents race conditions from rapid-fire individual creates/deletes.
     *  Preserves batch numbers and product codes for existing COCs.
     *  All COCs created in a single batch with unique sequential IDs. */
    bulkGenerateForPO: (poId: number, cocDataList: any[], deleteOrphanIds: number[] = []) => {
      // 1. Remove orphaned COCs (packing list lines that no longer exist)
      // Use string comparison because Firebase converts number IDs to strings
      const orphanIdSet = new Set(deleteOrphanIds.map((id) => String(id)));
      if (deleteOrphanIds.length > 0) {
        certificatesOfCompliance = certificatesOfCompliance.filter((c) => !orphanIdSet.has(String(c.id)));
      }

      // 2. Remove all existing COCs for this PO — the new list is complete
      // Use loose equality (==) because Firebase may convert number IDs to strings
      certificatesOfCompliance = certificatesOfCompliance.filter((c) => c.purchaseOrderId != poId);

      // 3. Create all new COCs with guaranteed unique sequential IDs
      const created: any[] = [];
      const baseTime = Date.now();
      for (let i = 0; i < cocDataList.length; i++) {
        const data = cocDataList[i];
        const company = data.company || (() => {
          const po = purchaseOrders.find((p) => p.id == poId);
          return po?.company || "sgf";
        })();
        const newCOC = {
          ...data,
          company,
          id: baseTime + i, // sequential IDs, guaranteed unique
          createdAt: data.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        certificatesOfCompliance.push(newCOC);
        created.push(newCOC);
      }

      // 4. Save ONCE to localStorage — atomic write (both keys)
      saveItem("sgf_certificatesOfCompliance", certificatesOfCompliance);
      saveItem("sgf_cocs", certificatesOfCompliance);
      return created;
    },
  },

  // ═══════════════════════════════════════════════════════════════
  //  PACKING LIST LINES (factory-filled barrel packing lines)
  // ═══════════════════════════════════════════════════════════════
  packingList: {
    list: () => packingListLines,
    listByPurchaseOrder: (poId: number) => packingListLines.filter((pl) => pl.purchaseOrderId === poId),
    getById: (id: number) => packingListLines.find((pl) => pl.id == id) || null,
    create: (data: any) => {
      const newItem = {
        ...data,
        company: data.company || "sgf",
        id: Date.now(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      packingListLines.push(newItem);
      saveItem("sgf_packingListLines", packingListLines);
      logAudit("CREATE", "packingList", newItem.id, `Packing list created: ${newItem.plNumber || "PL"}`);
      return newItem;
    },
    update: ({ id, data }: { id: number; data: any }) => {
      const idx = packingListLines.findIndex((pl) => pl.id == id);
      if (idx >= 0) {
        packingListLines[idx] = { ...packingListLines[idx], ...data, updatedAt: new Date().toISOString() };
        saveItem("sgf_packingListLines", packingListLines);
        logAudit("UPDATE", "packingList", id, `Packing list updated: ${packingListLines[idx].plNumber || "PL"}`);
        return packingListLines[idx];
      }
      return null;
    },
    delete: (id: number) => {
      const pl = packingListLines.find((p) => p.id == id);
      packingListLines = packingListLines.filter((pl) => pl.id !== id);
      saveItem("sgf_packingListLines", packingListLines);
      logAudit("DELETE", "packingList", id, `Packing list deleted: ${pl?.plNumber || "PL"}`);
      return { success: true };
    },
  },

  // ═══════════════════════════════════════════════════════════════
  //  REPORTS
  // ═══════════════════════════════════════════════════════════════
  report: {
    dailySales: (date: string) => {
      const dayInvoices = invoices.filter((inv) => inv.createdAt?.startsWith(date));
      return {
        date,
        revenue: dayInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0),
        count: dayInvoices.length,
        invoices: dayInvoices,
      };
    },
    weeklySales: (date: string) => {
      const start = new Date(date);
      start.setDate(start.getDate() - start.getDay());
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      const weekInvoices = invoices.filter((inv) => {
        const d = new Date(inv.createdAt);
        return d >= start && d <= end;
      });
      return {
        start: start.toISOString().slice(0, 10),
        end: end.toISOString().slice(0, 10),
        revenue: weekInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0),
        count: weekInvoices.length,
        invoices: weekInvoices,
      };
    },
    monthlySales: (date: string) => {
      const month = date.slice(0, 7);
      const monthInvoices = invoices.filter((inv) => inv.createdAt?.startsWith(month));
      return {
        month,
        revenue: monthInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0),
        count: monthInvoices.length,
        invoices: monthInvoices,
      };
    },
    customerSales: (customerId: string) => {
      const customerInvoices = invoices.filter((inv) => inv.customerId == customerId);
      return {
        customerId,
        revenue: customerInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0),
        count: customerInvoices.length,
        invoices: customerInvoices,
      };
    },
    productSales: (productId: string) => {
      let total = 0;
      let count = 0;
      for (const order of orders) {
        for (const item of order.items || []) {
          if (item.stockItemId == productId) {
            total += (item.quantity || 0) * (item.unitPrice || 0);
            count += item.quantity || 0;
          }
        }
      }
      return { productId, total, count };
    },
    repSales: (repName: string) => {
      const repInvoices = invoices.filter((inv) => inv.salesRepName === repName);
      return {
        repName,
        revenue: repInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0),
        count: repInvoices.length,
        invoices: repInvoices,
      };
    },
    outstandingInvoices: () => {
      return invoices.filter((inv) => inv.status !== "paid" && inv.status !== "cancelled");
    },
    paymentHistory: (customerId: string) => {
      return receipts.filter((r) => r.customerId == customerId);
    },
    collectionDashboard: () => {
      const now = new Date();
      const overdue = invoices.filter((inv) => {
        if (inv.status === "paid" || inv.status === "cancelled") return false;
        const dueDate = new Date(inv.invoiceDate || inv.createdAt);
        dueDate.setDate(dueDate.getDate() + 30);
        return dueDate < now;
      });
      return {
        totalOutstanding: invoices
          .filter((inv) => inv.status !== "paid" && inv.status !== "cancelled")
          .reduce((sum, inv) => sum + (inv.balanceDue || 0), 0),
        overdueCount: overdue.length,
        overdueAmount: overdue.reduce((sum, inv) => sum + (inv.balanceDue || 0), 0),
      };
    },
    stockMovement: (days: number = 30) => {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      return orders
        .filter((o) => new Date(o.createdAt) >= cutoff)
        .flatMap((o) => o.items || [])
        .reduce((acc: any[], item: any) => {
          const existing = acc.find((a) => a.stockItemId == item.stockItemId);
          if (existing) {
            existing.quantity += item.quantity || 0;
          } else {
            acc.push({ stockItemId: item.stockItemId, quantity: item.quantity || 0 });
          }
          return acc;
        }, []);
    },
    stockValuation: () => {
      return products.reduce((sum, p) => sum + (p.quantity || 0) * (p.costPrice || 0), 0);
    },
    lowStockReport: () => {
      return products.filter((p) => p.quantity !== undefined && p.quantity < (p.minStock || 10));
    },
    dailyCheckIns: (date: string) => {
      return checkins.filter((c) => c.checkInTime?.startsWith(date));
    },
    dailyAppointments: (date: string) => {
      return appointments.filter((a) => a.dateTime?.startsWith(date));
    },
    customerVisitFrequency: () => {
      return customers.map((c) => {
        const custCheckins = checkins.filter((ch) => ch.customerId == c.id);
        return {
          customer: c,
          totalVisits: custCheckins.length,
          lastVisit: custCheckins.length > 0
            ? custCheckins.sort((a, b) => new Date(b.checkInTime).getTime() - new Date(a.checkInTime).getTime())[0].checkInTime
            : null,
        };
      });
    },
    customerOrderHistory: (customerId: number) => {
      return orders
        .filter((o) => o.customerId == customerId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    },
    repPerformance: (repName: string) => {
      const repOrders = orders.filter((o) => o.salesRepName === repName);
      const repInvoices = invoices.filter((i) => i.salesRepName === repName);
      return {
        repName,
        orders: repOrders.length,
        revenue: repInvoices.reduce((sum, i) => sum + (i.total || 0), 0),
        outstanding: repInvoices
          .filter((i) => i.status !== "paid" && i.status !== "cancelled")
          .reduce((sum, i) => sum + (i.balanceDue || 0), 0),
      };
    },
    repActivity: (repName: string) => {
      const repCheckins = checkins.filter((c) => c.salesRepName === repName);
      const repAppointments = appointments.filter((a) => a.salesRepName === repName);
      return {
        repName,
        checkIns: repCheckins.length,
        appointments: repAppointments.length,
        lastCheckIn: repCheckins.length > 0
          ? repCheckins.sort((a, b) => new Date(b.checkInTime).getTime() - new Date(a.checkInTime).getTime())[0].checkInTime
          : null,
      };
    },
    auditTrail: (limit: number = 50) => {
      return auditLog.slice(-limit);
    },
    systemLogSummary: () => {
      const levels = ["INFO", "WARN", "ERROR", "DEBUG"];
      return levels.map((level) => ({
        level,
        count: systemLogs.filter((l) => l.level === level).length,
      }));
    },
    missedAppointments: () => {
      const now = new Date().toISOString();
      return appointments
        .filter((a) => a.status !== "completed" && a.status !== "cancelled" && a.dateTime < now)
        .map((a) => ({
          ...a,
          customer: customers.find((c) => c.id == a.customerId),
        }));
    },
    checkInReport: () => {
      return checkins.map((c) => ({
        ...c,
        customer: customers.find((cust) => cust.id == c.customerId),
      }));
    },
    deliveryRoute: (date: string) => {
      const dayOrders = orders.filter((o) => o.deliveryDate?.startsWith(date) || o.createdAt?.startsWith(date));
      return dayOrders.map((o) => ({
        ...o,
        customer: customers.find((c) => c.id == o.customerId),
      }));
    },
    invoiceAging: () => {
      const now = new Date();
      return invoices
        .filter((inv) => inv.status !== "paid" && inv.status !== "cancelled")
        .map((inv) => {
          const dueDate = new Date(inv.invoiceDate || inv.createdAt);
          dueDate.setDate(dueDate.getDate() + 30);
          const daysOverdue = Math.max(0, Math.floor((now.getTime() - dueDate.getTime()) / 86400000));
          return { ...inv, daysOverdue };
        })
        .sort((a, b) => b.daysOverdue - a.daysOverdue);
    },
    salesByCategory: () => {
      const categories: Record<string, number> = {};
      for (const order of orders) {
        for (const item of order.items || []) {
          const product = products.find((p) => p.id == item.stockItemId);
          const cat = product?.category || "Uncategorized";
          categories[cat] = (categories[cat] || 0) + (item.quantity || 0) * (item.unitPrice || 0);
        }
      }
      return Object.entries(categories).map(([category, revenue]) => ({ category, revenue }));
    },
    topCustomers: (limit: number = 10) => {
      const customerRevenue: Record<number, number> = {};
      for (const inv of invoices) {
        customerRevenue[inv.customerId] = (customerRevenue[inv.customerId] || 0) + (inv.total || 0);
      }
      return Object.entries(customerRevenue)
        .map(([customerId, revenue]) => ({
          customer: customers.find((c) => c.id == customerId),
          revenue,
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, limit);
    },
    topProducts: (limit: number = 10) => {
      const productSales: Record<number, number> = {};
      for (const order of orders) {
        for (const item of order.items || []) {
          productSales[item.stockItemId] = (productSales[item.stockItemId] || 0) + (item.quantity || 0);
        }
      }
      return Object.entries(productSales)
        .map(([stockItemId, quantity]) => ({
          product: products.find((p) => p.id == stockItemId),
          quantity,
        }))
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, limit);
    },
    dailyInvoicedStock: (date: string) => {
      const dayInvoices = invoices.filter((inv) => inv.createdAt?.startsWith(date));
      const stockMap: Record<number, number> = {};
      for (const inv of dayInvoices) {
        const order = orders.find((o) => o.id == inv.orderId);
        if (order) {
          for (const item of order.items || []) {
            stockMap[item.stockItemId] = (stockMap[item.stockItemId] || 0) + (item.quantity || 0);
          }
        }
      }
      return Object.entries(stockMap).map(([stockItemId, quantity]) => ({
        product: products.find((p) => p.id == stockItemId),
        quantity,
      }));
    },
    corporateDashboard: () => {
      const activePOs = purchaseOrders.filter((po) => po.status !== "cancelled");
      return {
        totalCorporateCustomers: corporateCustomers.length,
        totalPurchaseOrders: purchaseOrders.length,
        activePurchaseOrders: activePOs.length,
        totalPOValue: activePOs.reduce((sum, po) => sum + (po.total || 0), 0),
        barrelsInWarehouse: barrels.filter((b) => b.status === "in_warehouse").length,
        barrelsInTransit: barrels.filter((b) => b.status === "in_transit").length,
        barrelsAtCustomer: barrels.filter((b) => b.status === "at_customer").length,
        totalCOCs: certificatesOfCompliance.length,
        pendingCOCs: certificatesOfCompliance.filter((c) => c.status === "pending").length,
      };
    },
    creditNotesReport: () => creditNotes,
    creditNoteAging: () => {
      const now = new Date();
      return creditNotes
        .filter((cn) => cn.status !== "applied")
        .map((cn) => {
          const daysOld = Math.floor((now.getTime() - new Date(cn.createdAt).getTime()) / 86400000);
          return { ...cn, daysOld };
        })
        .sort((a, b) => b.daysOld - a.daysOld);
    },
    overpaymentReport: () => {
      return receipts.filter((r) => r.isOverpayment);
    },
    bankStatementParse: (input: any) => {
      return { success: true, transactions: [] };
    },
    bankStatementAllocate: (input: any) => {
      return { success: true, allocations: [] };
    },
    fixDuplicateInvoiceNumbers: () => {
      const seen = new Set<string>();
      const duplicates: any[] = [];
      for (const inv of invoices) {
        const num = inv.invoiceNumber;
        if (seen.has(num)) {
          duplicates.push(inv);
        } else {
          seen.add(num);
        }
      }
      return { duplicates, count: duplicates.length };
    },
    fixSageInvoiceDates: () => {
      let fixed = 0;
      for (const inv of invoices) {
        if (inv.sageInvoiceDate && !inv.invoiceDate) {
          inv.invoiceDate = inv.sageInvoiceDate;
          fixed++;
        }
      }
      if (fixed > 0) saveItem("sgf_invoices", invoices);
      return { fixed };
    },
    fixDraftInvoices: () => {
      let fixed = 0;
      for (const inv of invoices) {
        if (inv.status === "draft" && inv.orderId) {
          const order = orders.find((o) => o.id == inv.orderId);
          if (order && order.status === "delivered") {
            inv.status = "active";
            fixed++;
          }
        }
      }
      if (fixed > 0) saveItem("sgf_invoices", invoices);
      return { fixed };
    },
    autoLinkSageInvoices: () => {
      let linked = 0;
      for (const inv of invoices) {
        if (inv.sageInvoiceNumber && !inv.orderId) {
          const order = orders.find((o) => o.orderNumber === inv.sageOrderNumber);
          if (order) {
            inv.orderId = order.id;
            linked++;
          }
        }
      }
      if (linked > 0) saveItem("sgf_invoices", invoices);
      return { linked };
    },
  },

  // ═══════════════════════════════════════════════════════════════
  //  STATEMENTS
  // ═══════════════════════════════════════════════════════════════
  statement: {
    getByCustomer: (customerId: number) => {
      const customerInvoices = invoices
        .filter((inv) => inv.customerId == customerId)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      const customerReceipts = receipts
        .filter((r) => r.customerId == customerId)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      const balance = customerInvoices.reduce((sum, inv) => sum + (inv.balanceDue || 0), 0) -
        customerReceipts.reduce((sum, r) => sum + (r.amount || 0), 0);
      return {
        customer: customers.find((c) => c.id == customerId),
        invoices: customerInvoices,
        receipts: customerReceipts,
        balance,
      };
    },
    getAgedDebtors: () => {
      const now = new Date();
      const buckets = {
        current: 0,
        days_1_30: 0,
        days_31_60: 0,
        days_61_90: 0,
        days_90_plus: 0,
      };
      for (const inv of invoices) {
        if (inv.status === "paid" || inv.status === "cancelled") continue;
        const dueDate = new Date(inv.invoiceDate || inv.createdAt);
        dueDate.setDate(dueDate.getDate() + 30);
        const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / 86400000);
        const amount = inv.balanceDue || 0;
        if (daysOverdue <= 0) buckets.current += amount;
        else if (daysOverdue <= 30) buckets.days_1_30 += amount;
        else if (daysOverdue <= 60) buckets.days_31_60 += amount;
        else if (daysOverdue <= 90) buckets.days_61_90 += amount;
        else buckets.days_90_plus += amount;
      }
      return buckets;
    },
    getBankReconciliation: (date: string) => {
      const dayReceipts = receipts.filter((r) => r.createdAt?.startsWith(date));
      return {
        date,
        totalReceipts: dayReceipts.reduce((sum, r) => sum + (r.amount || 0), 0),
        count: dayReceipts.length,
        receipts: dayReceipts,
      };
    },
    getCustomerTransactions: (customerId: number) => {
      const customerInvoices = invoices.filter((inv) => inv.customerId == customerId);
      const customerReceipts = receipts.filter((r) => r.customerId == customerId);
      const transactions = [
        ...customerInvoices.map((inv) => ({ ...inv, type: "invoice", date: inv.createdAt })),
        ...customerReceipts.map((r) => ({ ...r, type: "receipt", date: r.createdAt })),
      ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      return { customer: customers.find((c) => c.id == customerId), transactions };
    },
    getSalesRepStatement: (repName: string) => {
      const repInvoices = invoices.filter((inv) => inv.salesRepName === repName);
      const repReceipts = receipts.filter((r) => r.salesRepName === repName);
      return {
        repName,
        invoices: repInvoices,
        receipts: repReceipts,
        totalInvoiced: repInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0),
        totalReceived: repReceipts.reduce((sum, r) => sum + (r.amount || 0), 0),
        outstanding: repInvoices
          .filter((inv) => inv.status !== "paid" && inv.status !== "cancelled")
          .reduce((sum, inv) => sum + (inv.balanceDue || 0), 0),
      };
    },
  },

  // ═══════════════════════════════════════════════════════════════
  //  RECEIPTS
  // ═══════════════════════════════════════════════════════════════
  receipt: {
    list: () => receipts,
    getById: (id: number) => receipts.find((r) => r.id == id) || null,
    getByInvoice: (invoiceId: number) => receipts.filter((r) => r.invoiceId == invoiceId),
    getByCustomer: (customerId: number) => receipts.filter((r) => r.customerId == customerId),
    getNextNumber: () => {
      const prefix = "RCP-" + new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const count = receipts.filter((r) => r.receiptNumber?.startsWith(prefix)).length;
      return `${prefix}-${String(count + 1).padStart(4, "0")}`;
    },
    create: (data: any) => {
      const newReceipt = {
        ...data,
        id: Date.now(),
        receiptNumber: data.receiptNumber || dataService.receipt.getNextNumber(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      receipts.push(newReceipt);
      saveItem("sgf_receipts", receipts);
      if (data.invoiceId) {
        const inv = invoices.find((i) => i.id == data.invoiceId);
        if (inv) {
          inv.balanceDue = Math.max(0, (inv.balanceDue || inv.total || 0) - (data.amount || 0));
          if (inv.balanceDue <= 0) inv.status = "paid";
          saveItem("sgf_invoices", invoices);
        }
      }
      logAudit("CREATE", "receipt", newReceipt.id, `Receipt created: ${newReceipt.receiptNumber}`);
      return newReceipt;
    },
    update: ({ id, data }: { id: number; data: any }) => {
      const idx = receipts.findIndex((r) => r.id == id);
      if (idx >= 0) {
        receipts[idx] = { ...receipts[idx], ...data, updatedAt: new Date().toISOString() };
        saveItem("sgf_receipts", receipts);
        logAudit("UPDATE", "receipt", id, `Receipt updated: ${receipts[idx].receiptNumber}`);
        return receipts[idx];
      }
      return null;
    },
    delete: (id: number) => {
      const receipt = receipts.find((r) => r.id == id);
      receipts = receipts.filter((r) => r.id !== id);
      saveItem("sgf_receipts", receipts);
      if (receipt?.invoiceId) {
        const inv = invoices.find((i) => i.id == receipt.invoiceId);
        if (inv) {
          inv.balanceDue = (inv.balanceDue || 0) + (receipt.amount || 0);
          if (inv.balanceDue > 0 && inv.status === "paid") inv.status = "active";
          saveItem("sgf_invoices", invoices);
        }
      }
      logAudit("DELETE", "receipt", id, `Receipt deleted: ${receipt?.receiptNumber || ""}`);
      return { success: true };
    },
  },

  // ═══════════════════════════════════════════════════════════════
  //  CREDIT NOTES
  // ═══════════════════════════════════════════════════════════════
  creditNote: {
    list: () => creditNotes,
    getById: (id: number) => creditNotes.find((cn) => cn.id == id) || null,
    getByInvoice: (invoiceId: number) => creditNotes.filter((cn) => cn.invoiceId == invoiceId),
    getByCustomer: (customerId: number) => creditNotes.filter((cn) => cn.customerId == customerId),
    create: (data: any) => {
      const newCN = {
        ...data,
        id: Date.now(),
        creditNoteNumber: data.creditNoteNumber || `CN-${Date.now()}`,
        status: data.status || "draft",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      creditNotes.push(newCN);
      saveItem("sgf_creditNotes", creditNotes);
      logAudit("CREATE", "creditNote", newCN.id, `Credit note created: ${newCN.creditNoteNumber}`);
      return newCN;
    },
    update: ({ id, data }: { id: number; data: any }) => {
      const idx = creditNotes.findIndex((cn) => cn.id == id);
      if (idx >= 0) {
        creditNotes[idx] = { ...creditNotes[idx], ...data, updatedAt: new Date().toISOString() };
        saveItem("sgf_creditNotes", creditNotes);
        logAudit("UPDATE", "creditNote", id, `Credit note updated: ${creditNotes[idx].creditNoteNumber}`);
        return creditNotes[idx];
      }
      return null;
    },
    delete: (id: number) => {
      const cn = creditNotes.find((c) => c.id == id);
      creditNotes = creditNotes.filter((cn) => cn.id !== id);
      saveItem("sgf_creditNotes", creditNotes);
      logAudit("DELETE", "creditNote", id, `Credit note deleted: ${cn?.creditNoteNumber || ""}`);
      return { success: true };
    },
    apply: ({ id }: { id: number }) => {
      const idx = creditNotes.findIndex((cn) => cn.id == id);
      if (idx >= 0 && creditNotes[idx].status === "draft") {
        creditNotes[idx].status = "applied";
        creditNotes[idx].appliedAt = new Date().toISOString();
        saveItem("sgf_creditNotes", creditNotes);
        if (creditNotes[idx].invoiceId) {
          const inv = invoices.find((i) => i.id == creditNotes[idx].invoiceId);
          if (inv) {
            inv.balanceDue = Math.max(0, (inv.balanceDue || inv.total || 0) - (creditNotes[idx].amount || 0));
            if (inv.balanceDue <= 0) inv.status = "paid";
            saveItem("sgf_invoices", invoices);
          }
        }
        logAudit("APPLY", "creditNote", id, `Credit note applied: ${creditNotes[idx].creditNoteNumber}`);
        return creditNotes[idx];
      }
      return null;
    },
  },

  // ═══════════════════════════════════════════════════════════════
  //  ACCOUNT HOLDS
  // ═══════════════════════════════════════════════════════════════
  accountHold: {
    list: () => accountHolds,
    getById: (id: number) => accountHolds.find((ah) => ah.id == id) || null,
    getByCustomer: (customerId: number) => accountHolds.filter((ah) => ah.customerId == customerId),
    create: (data: any) => {
      const newAH = {
        ...data,
        id: Date.now(),
        status: data.status || "active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      accountHolds.push(newAH);
      saveItem("sgf_accountHolds", accountHolds);
      logAudit("CREATE", "accountHold", newAH.id, `Account hold created for customer ${data.customerId}`);
      return newAH;
    },
    update: ({ id, data }: { id: number; data: any }) => {
      const idx = accountHolds.findIndex((ah) => ah.id == id);
      if (idx >= 0) {
        accountHolds[idx] = { ...accountHolds[idx], ...data, updatedAt: new Date().toISOString() };
        saveItem("sgf_accountHolds", accountHolds);
        logAudit("UPDATE", "accountHold", id, `Account hold updated`);
        return accountHolds[idx];
      }
      return null;
    },
    delete: (id: number) => {
      accountHolds = accountHolds.filter((ah) => ah.id !== id);
      saveItem("sgf_accountHolds", accountHolds);
      logAudit("DELETE", "accountHold", id, `Account hold deleted`);
      return { success: true };
    },
  },

  // ═══════════════════════════════════════════════════════════════
  //  SETTINGS
  // ═══════════════════════════════════════════════════════════════
  settings: {
    get: () => {
      try {
        const raw = getStorageItem("sgf_settings");
        if (raw) return JSON.parse(raw);
      } catch { /* ignore */ }
      return {};
    },
    update: (data: any) => {
      const current = dataService.settings.get();
      const updated = { ...current, ...data, updatedAt: new Date().toISOString() };
      setStorageItem("sgf_settings", JSON.stringify(updated));
      return updated;
    },
    getFirebaseConfig: () => {
      try {
        const raw = getStorageItem("sgf_firebase_config");
        if (raw) return JSON.parse(raw);
      } catch { /* ignore */ }
      return null;
    },
    saveFirebaseConfig: (config: any) => {
      setStorageItem("sgf_firebase_config", JSON.stringify(config));
      return config;
    },
    clearFirebaseConfig: () => {
      removeStorageItem("sgf_firebase_config");
      return true;
    },
    disconnectFirebase: () => {
      removeStorageItem("sgf_firebase_config");
      return true;
    },
    getTaxRate: () => 0.15,
    getCompanyInfo: () => ({
      name: "Supreme Global Foods",
      regNumber: "",
      vatNumber: "",
      address: "",
      phone: "",
      email: "",
    }),
    getBankDetails: () => ({
      bankName: "",
      accountNumber: "",
      branchCode: "",
      accountType: "",
    }),
    getPaymentTerms: () => ["cod", "7_days", "14_days", "30_days", "60_days"],
    getEmailTemplates: () => ({}),
    getSmsTemplates: () => ({}),
    getNotificationSettings: () => ({}),
    getIntegrationSettings: () => ({}),
    getBackupSettings: () => ({}),
    getSecuritySettings: () => ({}),
    getAuditSettings: () => ({}),
    getSystemSettings: () => ({}),
    getDisplaySettings: () => ({}),
    getReportSettings: () => ({}),
    getDashboardSettings: () => ({}),
    getSalesRepSettings: () => ({}),
    getCustomerSettings: () => ({}),
    getInvoiceSettings: () => ({}),
    getOrderSettings: () => ({}),
    getStockSettings: () => ({}),
    getCorporateSettings: () => ({}),
    getPurchaseOrderSettings: () => ({}),
    getBarrelSettings: () => ({}),
    getCocSettings: () => ({}),
    getPackingListSettings: () => ({}),
    getCollectionSettings: () => ({}),
    getFollowUpSettings: () => ({}),
    getFollowUpActionSettings: () => ({}),
    getAccountHoldSettings: () => ({}),
    getReceiptSettings: () => ({}),
    getCreditNoteSettings: () => ({}),
    getStatementSettings: () => ({}),
    getSystemLogSettings: () => ({}),
    getAuditLogSettings: () => ({}),
  },

  // ═══════════════════════════════════════════════════════════════
  //  HELPERS
  // ═══════════════════════════════════════════════════════════════
  getEffectivePrice,
  load,
  reloadFromStorage,
};

// Load data on module init
load();

export { dataService };
