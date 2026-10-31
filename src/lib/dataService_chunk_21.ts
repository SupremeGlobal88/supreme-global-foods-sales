      if (repaired > 0) {
        saveItem("sgf_orders", orders);
      }
      return { repaired, total: orders.length };
    },
    delete: ({ id }: { id: number }) => {
      const ord = orders.find((o) => o.id == id);
      if (!ord) return { success: false };
      // Restore stock for cancelled order
      if (ord.status !== "cancelled" && ord.status !== "delivered" && ord.orderType !== "quote") {
        for (const item of (ord.items || [])) {
          const prodIdx = products.findIndex((p) => p.id == item.stockItemId);
          if (prodIdx >= 0) {
            const conversion = item.conversion || 1;
            const restoreQty = item.quantity * conversion;
            const newQty = (products[prodIdx].quantity || 0) + restoreQty;
            products[prodIdx].quantity = newQty;
            products[prodIdx].status = newQty === 0 ? "out_of_stock" : newQty < 20 ? "low_stock" : "in_stock";
          }
        }
        saveItem("sgf_products", products);
      }
      const idx = orders.findIndex((o) => o.id == id);
      if (idx >= 0) {
        orders.splice(idx, 1);
        saveItem("sgf_orders", orders);
        logAudit("DELETE", "order", id, `Order ${ord.orderNumber} deleted`);
      }
      return { success: idx >= 0 };
    },
    generateInvoice: (orderId: number) => {
      const invNum = createInvoiceFromOrder(orderId);
      return { invoiceNumber: invNum };
    },
  },

  receipt: {
    list: () => receipts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    getById: (id: number) => receipts.find((r) => r.id == id) || null,
    getByInvoiceId: (invoiceId: number) => receipts.filter((r) => r.invoiceId == invoiceId),
    getByCustomerId: (customerId: number) => receipts.filter((r) => r.customerId == customerId),
    create: (data: any) => {
      const newItem = {
        ...data,
        id: Date.now(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      receipts.push(newItem);
      saveItem("sgf_receipts", receipts);
      logAudit("CREATE", "receipt", newItem.id, `Receipt created: ${newItem.referenceNumber || ""}`);
      return newItem;
    },
    update: ({ id, data }: { id: number; data: any }) => {
      const idx = receipts.findIndex((r) => r.id == id);
      if (idx >= 0) {
        receipts[idx] = { ...receipts[idx], ...data, updatedAt: new Date().toISOString() };
        saveItem("sgf_receipts", receipts);
        logAudit("UPDATE", "receipt", id, `Receipt updated: ${receipts[idx].referenceNumber || ""}`);
      }
      return receipts[idx];
    },
    delete: (id: number) => {
      const idx = receipts.findIndex((r) => r.id == id);
      if (idx >= 0) {
        receipts.splice(idx, 1);
        saveItem("sgf_receipts", receipts);
        logAudit("DELETE", "receipt", id, "Receipt deleted");
      }
      return { success: idx >= 0 };
    },
    /** Record a payment against a single invoice.
     *  Updates invoice amountPaid and balanceDue, creates receipt record.
     *  Returns updated invoice and receipt. */
    recordPayment: (data: any) => {
      const { invoiceId, amount, paymentMethod, referenceNumber, notes, bankReference, collectorId } = data;
      const invIdx = invoices.findIndex((i) => i.id == invoiceId);
      if (invIdx < 0) return { success: false, error: "Invoice not found" };
      const inv = invoices[invIdx];
      const currentPaid = inv.amountPaid || 0;
      const total = inv.total || inv.totalAmount || 0;
      const paymentAmount = Number(amount) || 0;
      const newPaid = currentPaid + paymentAmount;
      const creditsApplied2 = inv.creditsApplied || 0;

      // Update invoice
      inv.amountPaid = newPaid;
      inv.balanceDue = Math.max(0, total - newPaid - creditsApplied2);
      inv.status = inv.balanceDue <= 0.01 ? "paid" : "sent";
      inv.updatedAt = new Date().toISOString();

      // Create receipt
      const receipt = {
        id: Date.now(),
        invoiceId,
        invoiceNumber: inv.invoiceNumber,
        customerId: inv.customerId,
        customerName: inv.customerName,
        amount: paymentAmount,
        paymentMethod: paymentMethod || "cash",
        referenceNumber: referenceNumber || "",
        notes: notes || "",
        totalInvoiceAmount: total,
        amountPaidBefore: currentPaid,
        balanceAfter: Math.max(0, total - newPaid - creditsApplied2),
