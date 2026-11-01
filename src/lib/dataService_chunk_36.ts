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
        id: Date.now(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      packingListLines.push(newItem);
      saveItem("sgf_packingListLines", packingListLines);
      return newItem;
    },
    update: ({ id, data }: { id: number; data: any }) => {
      const idx = packingListLines.findIndex((pl) => pl.id == id);
      if (idx >= 0) {
        packingListLines[idx] = { ...packingListLines[idx], ...data, updatedAt: new Date().toISOString() };
        saveItem("sgf_packingListLines", packingListLines);
        return packingListLines[idx];
      }
      return null;
    },
    delete: (id: number) => {
      packingListLines = packingListLines.filter((pl) => pl.id !== id);
      saveItem("sgf_packingListLines", packingListLines);
      return { success: true };
    },
  },

  /** Generate an invoice from a Purchase Order (corporate customer).
   *  Exposed on dataService so localLink can call it via dataService.generateInvoiceForPO */
  generateInvoiceForPO: (poId: number) => {
    // ACQUIRE LOCK: prevent concurrent generation
    if (invoiceGenerationLock) {

      return null;
    }
    invoiceGenerationLock = true;

    try {
      reloadFromStorage(["sgf_invoices", "sgf_orders", "sgf_purchaseOrders"]);
      logSystemEvent("INFO", "invoiceGeneration", `generateInvoiceForPO START poId=${poId}, invoiceCount=${invoices.length}, lock=${invoiceGenerationLock}`);
      const po = purchaseOrders.find((p) => p.id == poId);
      if (!po) return null;

      // Calculate totals from PO line items
      const items = po.lineItems || [];
      const subtotal = items.reduce((sum: number, item: any) => sum + (item.quantity * item.unitPrice || 0), 0);
      // Check if corporate customer is VAT exempt
      const corpCustomer = corporateCustomers.find((c) => c.id == po.corporateCustomerId);
      const vatRate = corpCustomer?.vatExempt ? 0 : 0.15;
      const vatAmount = subtotal * vatRate;
      const total = subtotal + vatAmount;

      // Resolve the main customer ID from the linked corporate customer
      const mainCustomerId = corpCustomer?.linkedCustomerId || po.corporateCustomerId;
      const mainCustomer = customers.find((c) => c.id == mainCustomerId);

      // Build a rich customer object — prefer linked main customer, fallback to corp customer fields
      const richCustomer = mainCustomer || {
        name: po.corporateCustomerName || corpCustomer?.name || "Corporate Customer",
        contactPerson: corpCustomer?.contactPerson || "",
        phone: corpCustomer?.phone || "",
        email: corpCustomer?.email || "",
        physicalAddress: corpCustomer?.deliveryAddress || corpCustomer?.physicalAddress || "",
        city: corpCustomer?.city || "",
        province: corpCustomer?.province || "",
        postalCode: corpCustomer?.postalCode || "",
        vatNumber: corpCustomer?.vatNumber || "",
        salesRepName: corpCustomer?.salesRepName || "",
      };

      // Check if invoice already exists for this PO
      const existingIdx = invoices.findIndex((i) => i.purchaseOrderId == poId);

      // Get corporate customer for payment terms
      const paymentTerms = corpCustomer?.paymentTerms || po.paymentTerms || "30_days";
      const days = paymentTerms === "30_days" ? 30 : paymentTerms === "14_days" ? 14 : paymentTerms === "7_days" ? 7 : 0;

      if (existingIdx >= 0) {
        const existing = invoices[existingIdx];
        const amountPaid = Number(existing.amountPaid || 0);
        const newBalanceDue = total - amountPaid;
        invoices[existingIdx] = {
          ...existing,
          subtotal,
          vatAmount,
          vatRate,
          total,
          totalAmount: total,
          balanceDue: newBalanceDue,
          paymentTerms,
          customerId: mainCustomerId,
          customer: richCustomer,
          deliveryNoteNumber: existing.deliveryNoteNumber || `DN-${poRef}`,
          items: items.map((item: any) => ({
            description: `${item.customerStockCode || ""} - ${item.customerDescription || ""}`,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            lineTotal: item.quantity * item.unitPrice,
          })),
          updatedAt: new Date().toISOString(),
