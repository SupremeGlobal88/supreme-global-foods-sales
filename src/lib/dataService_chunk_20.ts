      const invoiceNumber = generateInvoiceForOrder(newOrder.id);
      if (invoiceNumber) {
        // Link invoice to the new order
        const inv = invoices.find((i) => i.orderId == newOrder.id);
        if (inv) {
          newOrder.invoiceId = inv.id;
          newOrder.invoiceNumber = inv.invoiceNumber;
          saveItem("sgf_orders", orders);
        }
    logAudit("CREATE", "invoice", newOrder.id, `Invoice ${invoiceNumber} generated for converted order ${orderNumber}`);
      }

      logAudit("CONVERT", "quote", quote.id, `Quote ${quote.orderNumber} converted to order ${orderNumber}`);

      return { error: null, order: newOrder };
    },
    /** Create a new order from an existing invoice that has no linked order.
     *  This fixes the case where an invoice exists but its order was lost. */
    createFromInvoice: (invoiceId: number) => {
      const inv = invoices.find((i) => i.id == invoiceId);
      if (!inv) return null;
      // Check if order already exists
      const existingOrder = orders.find((o) => o.id == inv.orderId);
      if (existingOrder) return { error: "Order already exists", order: existingOrder };

      // If invoice has a PO number, try to use it as the order number (with uniqueness check)
      let orderNumber: string;
      const poNumber = (inv as any).poNumber;
      if (poNumber) {
        const duplicate = orders.find((o) => o.orderNumber === poNumber);
        if (!duplicate) {
          orderNumber = poNumber;
        } else {
          // PO number already used as an order number — fall back to ORD-xxx
          const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
          const now = new Date();
          const hhmm = String(now.getHours()).padStart(2, "0") + String(now.getMinutes()).padStart(2, "0");
          const msCounter = String(Date.now() % 10000).padStart(4, "0");
          orderNumber = `ORD-${dateStr}-${hhmm}${msCounter}`;
        }
      } else {
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
        const now = new Date();
        const hhmm = String(now.getHours()).padStart(2, "0") + String(now.getMinutes()).padStart(2, "0");
        const msCounter = String(Date.now() % 10000).padStart(4, "0");
        orderNumber = `ORD-${dateStr}-${hhmm}${msCounter}`;
      }

      const newOrder = {
        id: Date.now(),
        orderNumber,
        customerId: inv.customerId,
        customerName: inv.customer?.name || "",
        customer: inv.customer || null,
        items: (inv.items || []).map((it: any) => ({
          stockItemId: it.stockItemId,
          productCode: it.productCode || "",
          productName: it.productName || it.description || "",
          description: it.description || "",
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          lineTotal: it.lineTotal,
          unit: it.unit || "each",
          conversion: it.conversion || 1,
          unitLabel: it.unitLabel || "Each",
        })),
        subtotal: inv.subtotal || 0,
        vatAmount: inv.vatAmount || 0,
        total: inv.total || 0,
        totalAmount: inv.totalAmount || 0,
        status: "pending",
        paymentTerms: inv.paymentTerms || "cod",
        company: inv.company || "sgf",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      orders.push(newOrder);
      saveItem("sgf_orders", orders);
      logAudit("CREATE", "order", newOrder.id, `Order ${orderNumber} created from invoice ${inv.invoiceNumber}`);
      return { error: null, order: newOrder };
    },
  },

  invoice: {
    list: () => invoices
      .map((inv) => repairInvoiceCompany(inv))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    getById: (id: number) => {
      const inv = invoices.find((i) => i.id == id);
      return inv ? repairInvoiceCompany(inv) : null;
    },
    getByNumber: (num: string) => {
      const inv = invoices.find((i) => i.invoiceNumber === num);
      return inv ? repairInvoiceCompany(inv) : null;
    },
    getByOrderId: (orderId: number) => {
      const inv = invoices.find((i) => i.orderId == orderId);
      return inv ? repairInvoiceCompany(inv) : null;
    },
    getByCustomer: (customerId: number) => invoices
      .filter((i) => i.customerId == customerId)
      .map((inv) => repairInvoiceCompany(inv))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    create: (data: any) => {
      const newItem = {
        ...data,
        id: Date.now(),
        company: data.company || getCurrentCompany(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      invoices.push(newItem);
      saveItem("sgf_invoices", invoices);
      logAudit("CREATE", "invoice", newItem.id, `Invoice created: ${newItem.invoiceNumber || ""}`);
      return newItem;
    },
    update: ({ id, data }: { id: number; data: any }) => {
      const idx = invoices.findIndex((i) => i.id == id);
      if (idx >= 0) {
        invoices[idx] = { ...invoices[idx], ...data, updatedAt: new Date().toISOString() };
        saveItem("sgf_invoices", invoices);
        logAudit("UPDATE", "invoice", id, `Invoice updated: ${invoices[idx].invoiceNumber || ""}`);
      }
      return invoices[idx];
    },
    updateStatus: ({ id, status }: { id: number; status: string }) => {
      const idx = invoices.findIndex((i) => i.id == id);
      if (idx >= 0) {
        const oldStatus = invoices[idx].status;
        invoices[idx].status = status;
        invoices[idx].updatedAt = new Date().toISOString();
        saveItem("sgf_invoices", invoices);
        logAudit("UPDATE", "invoice", id, `Invoice ${invoices[idx].invoiceNumber} status changed from ${oldStatus} to ${status}`);
      }
      return invoices[idx];
    },
    delete: (id: number) => {
      const idx = invoices.findIndex((i) => i.id == id);
      if (idx >= 0) {
        invoices.splice(idx, 1);
        saveItem("sgf_invoices", invoices);
        logAudit("DELETE", "invoice", id, "Invoice deleted");
      }
      return { success: idx >= 0 };
    },
    getStats: () => {
      const comp = getCurrentCompany();
      const companyInvoices = invoices.filter((inv) => (inv.company || "sgf") === comp);
      return {
        total: companyInvoices.length,
        outstanding: companyInvoices.filter((i) => (i.balanceDue || 0) > 0.01).length,
        totalOutstanding: Math.round(companyInvoices.filter((i) => (i.balanceDue || 0) > 0.01).reduce((sum, i) => sum + (i.balanceDue || 0), 0) * 100) / 100,
        totalValue: Math.round(companyInvoices.reduce((sum, i) => sum + (i.total || 0), 0) * 100) / 100,
      };
    },
    markAsPaid: ({ id, amount, paymentMethod }: { id: number; amount: number; paymentMethod: string }) => {
      const idx = invoices.findIndex((i) => i.id == id);
      if (idx < 0) return { success: false, error: "Invoice not found" };
      const inv = invoices[idx];
      const paymentAmount = Number(amount) || 0;
      const newPaid = (inv.amountPaid || 0) + paymentAmount;
      const total = inv.total || inv.totalAmount || 0;
      const newBalance = Math.max(0, total - newPaid);
      const newStatus = newBalance <= 0.01 ? "paid" : "sent";
      invoices[idx] = {
        ...inv,
        amountPaid: newPaid,
        balanceDue: newBalance,
        status: newStatus,
        updatedAt: new Date().toISOString(),
      };
      saveItem("sgf_invoices", invoices);
      logAudit("PAYMENT", "invoice", id, `Payment of R${paymentAmount.toFixed(2)} recorded for invoice ${inv.invoiceNumber}`);
      return { success: true, invoice: invoices[idx] };
    },
    // Consolidate multiple invoices into one payment receipt
    consolidatePayments: ({ invoiceIds, amount, paymentMethod }: { invoiceIds: number[]; amount: number; paymentMethod: string }) => {
      const totalAmount = Number(amount) || 0;
      let remaining = totalAmount;
      const updatedInvoices: any[] = [];
      for (const id of invoiceIds) {
        const idx = invoices.findIndex((i) => i.id == id);
        if (idx < 0) continue;
        const inv = invoices[idx];
        const balance = (inv.total || 0) - (inv.amountPaid || 0);
        if (balance <= 0) continue;
        const payment = Math.min(remaining, balance);
        inv.amountPaid = (inv.amountPaid || 0) + payment;
        inv.balanceDue = (inv.total || 0) - inv.amountPaid;
        inv.status = inv.balanceDue <= 0.01 ? "paid" : "sent";
        inv.updatedAt = new Date().toISOString();
        updatedInvoices.push(inv);
        remaining -= payment;
        if (remaining <= 0) break;
      }
      saveItem("sgf_invoices", invoices);
      // Record the consolidated receipt
      const receipt = {
        id: Date.now(),
        invoiceIds,
        amount: totalAmount,
        paymentMethod,
        createdAt: new Date().toISOString(),
      };
      receipts.push(receipt);
      saveItem("sgf_receipts", receipts);
      return { success: true, invoices: updatedInvoices, remaining: Math.max(0, remaining) };
    },
    /** Repair all invoice statuses to match order statuses.
     *  Fixes invoices that are "draft" but orders are "delivered",
     *  or invoices that are not "cancelled" but orders are "cancelled".
     *  Returns summary of repairs. */
    repairAllInvoiceStatuses: () => {
      let repaired = 0;
      for (const inv of invoices) {
        const order = orders.find((o) => o.id == inv.orderId);
        if (!order) continue;
        const orderStatus = order.status;
        const invStatus = inv.status;
        let needsSave = false;
        if (orderStatus === "cancelled" && invStatus !== "cancelled") {
          inv.status = "cancelled";
          inv.balanceDue = 0;
          inv.cancelledAt = inv.cancelledAt || new Date().toISOString();
          inv.cancellationReason = inv.cancellationReason || "Order cancelled";
          needsSave = true;
        }
        if ((orderStatus === "ready" || orderStatus === "delivered") && invStatus === "draft") {
          inv.status = "sent";
          needsSave = true;
        }
        if (needsSave) {
          inv.updatedAt = new Date().toISOString();
          repaired++;
        }
      }
      if (repaired > 0) {
        saveItem("sgf_invoices", invoices);
      }
      return { repaired };
    },
    /** Recalculate all invoice totals from their items array.
     *  Fixes corrupted totals after order edits or bulk imports.
     *  Returns summary of repairs. */
    repairAllInvoiceTotals: () => {
      let repaired = 0;
      for (const inv of invoices) {
        const items = inv.items || [];
        let needsSave = false;
        // Recalculate from items
        const subtotal = items.reduce((sum: number, it: any) => sum + (it.lineTotal || 0), 0);
        const vatRate = inv.vatRate !== undefined ? inv.vatRate : 0.15;
        const vatAmount = subtotal * vatRate;
        const total = subtotal + vatAmount;
        if (Math.abs((inv.subtotal || 0) - subtotal) > 0.01) {
          inv.subtotal = subtotal;
          needsSave = true;
        }
        if (Math.abs((inv.vatAmount || 0) - vatAmount) > 0.01) {
          inv.vatAmount = vatAmount;
          needsSave = true;
        }
        if (Math.abs((inv.total || inv.totalAmount || 0) - total) > 0.01) {
          inv.total = total;
          inv.totalAmount = total;
          needsSave = true;
        }
        if (needsSave) {
          repaired++;
          inv.updatedAt = new Date().toISOString();
        }
      }
      if (repaired > 0) {
        saveItem("sgf_invoices", invoices);
      }
      return { repaired };
    },
    /** Recalculate all order totals from their items array.
     *  Fixes corrupted totals after order edits or bulk imports.
     *  Returns summary of repairs. */
    repairAllOrderTotals: () => {
      let repaired = 0;
      for (const order of orders) {
        const items = order.items || [];
        let needsSave = false;
        const subtotal = items.reduce((sum: number, it: any) => sum + (it.lineTotal || 0), 0);
        const vatRate = order.vatRate !== undefined ? order.vatRate : 0.15;
        const vatAmount = subtotal * vatRate;
        const total = subtotal + vatAmount;
        if (Math.abs((order.subtotal || 0) - subtotal) > 0.01) {
          order.subtotal = subtotal;
          needsSave = true;
        }
        if (Math.abs((order.vatAmount || 0) - vatAmount) > 0.01) {
          order.vatAmount = vatAmount;
          needsSave = true;
        }
        if (Math.abs((order.total || order.totalAmount || 0) - total) > 0.01) {
          order.total = total;
          order.totalAmount = total;
          needsSave = true;
        }
        if (needsSave) {
          repaired++;
          order.updatedAt = new Date().toISOString();
        }
      }
      if (repaired > 0) {
        saveItem("sgf_orders", orders);
      }
      return { repaired };
    },
