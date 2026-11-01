      const corpCustomer = corporateCustomers.find((c) => c.id == data.corporateCustomerId);
      if (!company && corpCustomer?.company) company = corpCustomer.company;
      // Calculate total from lineItems (same pattern as order total + invoice generation)
      const items = data.lineItems || [];
      const subtotal = items.reduce((sum: number, item: any) => sum + ((item.quantity || 0) * (item.unitPrice || 0)), 0);
      const vatRate = corpCustomer?.vatExempt ? 0 : 0.15;
      const total = subtotal * (1 + vatRate);
      const newItem = {
        ...data,
        company: company || "sgf",
        id: Date.now(),
        status: data.status || "received",
        salesRepName: corpCustomer?.salesRepName || "",
        total: Math.round(total * 100) / 100,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      purchaseOrders.push(newItem);
      saveItem("sgf_purchaseOrders", purchaseOrders);
      logAudit("CREATE", "purchaseOrder", newItem.id, `Purchase order created: ${newItem.poNumber || "PO"}`);
      return newItem;
    },
    update: ({ id, data }: { id: number; data: any }) => {
      const idx = purchaseOrders.findIndex((po) => po.id == id);
      if (idx >= 0) {
        const merged = { ...purchaseOrders[idx], ...data, updatedAt: new Date().toISOString() };
        // Recalculate total if lineItems changed (same pattern as order update)
        if (data.lineItems) {
          const corpCustomer = corporateCustomers.find((c) => c.id == merged.corporateCustomerId);
          const items = merged.lineItems || [];
          const subtotal = items.reduce((sum: number, item: any) => sum + ((item.quantity || 0) * (item.unitPrice || 0)), 0);
          const vatRate = corpCustomer?.vatExempt ? 0 : 0.15;
          merged.total = Math.round(subtotal * (1 + vatRate) * 100) / 100;
        }
        // Update salesRepName if corporateCustomerId changed
        if (data.corporateCustomerId) {
          const corpCustomer = corporateCustomers.find((c) => c.id == data.corporateCustomerId);
          merged.salesRepName = corpCustomer?.salesRepName || "";
        }
        purchaseOrders[idx] = merged;
        saveItem("sgf_purchaseOrders", purchaseOrders);
        logAudit("UPDATE", "purchaseOrder", id, `Purchase order updated: ${purchaseOrders[idx].poNumber || "PO"}`);
        return purchaseOrders[idx];
      }
      return null;
    },
    updateStatus: ({ id, status }: { id: number; status: string }) => {
      const idx = purchaseOrders.findIndex((po) => po.id == id);
      if (idx >= 0) {
        const oldStatus = purchaseOrders[idx].status;
        purchaseOrders[idx].status = status;
        purchaseOrders[idx].updatedAt = new Date().toISOString();
        saveItem("sgf_purchaseOrders", purchaseOrders);
        // Activate linked invoice when PO is fulfilled
        if (status === "fulfilled") {
          activateInvoiceFromPO(id);
        }
        logAudit("UPDATE", "purchaseOrder", id, `Purchase order status changed: ${purchaseOrders[idx].poNumber || "PO"} ${oldStatus} → ${status}`);
        return purchaseOrders[idx];
      }
      return null;
    },
    delete: (id: number) => {
      const po = purchaseOrders.find((p) => p.id == id);
      purchaseOrders = purchaseOrders.filter((po) => po.id !== id);
      saveItem("sgf_purchaseOrders", purchaseOrders);
      logAudit("DELETE", "purchaseOrder", id, `Purchase order deleted: ${po?.poNumber || "PO"}`);
      return { success: true };
    },
  },

  barrel: {
    list: () => barrels,
    listByPurchaseOrder: (poId: number) => barrels.filter((b) => b.purchaseOrderId === poId),
    getById: (id: number) => barrels.find((b) => b.id == id) || null,
    create: (data: any) => {
      // Auto-inherit company from linked PO if not explicitly set
      let company = data.company;
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
      barrels.push(newItem);
      saveItem("sgf_barrels", barrels);
      return newItem;
    },
    update: ({ id, data }: { id: number; data: any }) => {
      const idx = barrels.findIndex((b) => b.id == id);
      if (idx >= 0) {
        barrels[idx] = { ...barrels[idx], ...data, updatedAt: new Date().toISOString() };
        saveItem("sgf_barrels", barrels);
        return barrels[idx];
      }
      return null;
    },
    delete: (id: number) => {
      barrels = barrels.filter((b) => b.id !== id);
      saveItem("sgf_barrels", barrels);
      return { success: true };
    },
  },

  coc: {
    list: () => certificatesOfCompliance,
    listByBarrel: (barrelId: number) => certificatesOfCompliance.filter((c) => c.barrelId == barrelId),
    listByPurchaseOrder: (poId: number) => certificatesOfCompliance.filter((c) => c.purchaseOrderId == poId),
    listByInvoice: (invoiceId: number) => certificatesOfCompliance.filter((c) => c.invoiceId == invoiceId || c.invoiceNumber == invoiceId),
    getById: (id: number) => certificatesOfCompliance.find((c) => c.id == id) || null,
    generateForInvoice: (invoiceId: number) => {
      const inv = invoices.find((i) => i.id == invoiceId);
      if (!inv) return [];
      // Remove any existing COCs for this invoice
      certificatesOfCompliance = certificatesOfCompliance.filter((c) => c.invoiceId != invoiceId);
      const customerRecord = customers.find((c) => c.id == inv.customerId);
      const now = new Date();
      const mfgDateStr = now.toLocaleDateString("en-GB");
      const useByDate = new Date(now.getFullYear() + 2, now.getMonth(), now.getDate());
      const useByStr = useByDate.toLocaleDateString("en-GB");
      const batchPrefix = `${String(now.getDate()).padStart(2, "0")}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getFullYear()).slice(-2)}`;
      const lotPrefix = `${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;

      // Helper: extract meaningful keywords from a string
      function getKeywords(text: string): string[] {
        return String(text).toLowerCase()
          .replace(/[^a-z0-9\/\s]/g, " ") // keep slashes for sizes like 26/28
          .split(/\s+/)
          .filter((w) => w.length >= 2 && !["of","the","a","an","to","in","for","with","and","or","per","kg","m","mm"].includes(w));
      }

      // Helper: extract color hint from description (last word if it's a color)
      function extractColorFromDesc(desc: string): string | null {
        const colorWords = ["white", "red", "brown", "black", "beige", "green", "blue", "yellow", "pink", "grey", "gray", "natural", "mixed", "calico"];
        const words = String(desc).toLowerCase().trim().split(/\s+/);
        const lastWord = words[words.length - 1];
        if (colorWords.includes(lastWord)) return lastWord.charAt(0).toUpperCase() + lastWord.slice(1);
        // Also check any word in the description
        for (const w of words) {
          if (colorWords.includes(w)) return w.charAt(0).toUpperCase() + w.slice(1);
        }
        return null;
      }

