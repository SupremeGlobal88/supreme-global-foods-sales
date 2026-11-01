        const customer = customers.find((c) => c.id == inv.customerId);
        return {
          ...inv,
          customer: customer || null,
          subtotal: inv.subtotal ?? inv.totalAmount ?? 0,
          vatAmount: inv.vatAmount ?? (inv.totalAmount ?? 0) * 0.15 / 1.15,
          total: inv.total ?? inv.totalAmount ?? 0,
          balanceDue: inv.balanceDue ?? (inv.total ?? inv.totalAmount ?? 0) - (inv.amountPaid ?? 0),
          invoiceDate: inv.invoiceDate || inv.createdAt,
          dueDate: inv.dueDate || inv.createdAt,
          paymentTerms: inv.paymentTerms || "cod",
          deliveryNoteNumber: inv.deliveryNoteNumber || `DN-${inv.orderId}`,
        };
      })
      .sort((a, b) => new Date(b.invoiceDate || b.createdAt).getTime() - new Date(a.invoiceDate || a.createdAt).getTime()),
    getById: (id: number) => {
      const inv = invoices.find((i) => i.id == id);
      if (!inv) return null;
      const customer = customers.find((c) => c.id == inv.customerId);
      return { ...inv, customer: customer || null };
    },
    create: (data: any) => {
      const invoiceNumber = `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${String(invoices.length + 1).padStart(4, "0")}`;
      const customer = customers.find((c) => c.id == data.customerId);
      const now = new Date().toISOString();
      const newInvoice = {
        ...data,
        id: Date.now(),
        invoiceNumber,
        status: "sent",
        invoiceDate: now,
        dueDate: now,
        customerName: customer?.name || "",
        customer: customer || null,
        subtotal: data.subtotal || 0,
        vatAmount: data.vatAmount || 0,
        total: data.total || data.subtotal || 0,
        totalAmount: data.total || data.subtotal || 0,
        balanceDue: data.total || data.subtotal || 0,
        amountPaid: 0,
        deliveryNoteNumber: `DN-MANUAL-${String(invoices.length + 1).padStart(4, "0")}`,
        createdAt: now,
        updatedAt: now,
      };
      invoices.push(newInvoice);
      saveItem("sgf_invoices", invoices);
      return newInvoice;
    },
    updateStatus: ({ id, status, amountPaid }: { id: number; status: string; amountPaid?: number }) => {
      const idx = invoices.findIndex((i) => i.id == id);
      if (idx >= 0) {
        invoices[idx].status = status;
        if (status === "cancelled") {
          invoices[idx].balanceDue = 0;
          invoices[idx].cancelledAt = invoices[idx].cancelledAt || new Date().toISOString();
          invoices[idx].cancellationReason = invoices[idx].cancellationReason || "Invoice cancelled";
        }
        invoices[idx].amountPaid = amountPaid || 0;
        saveItem("sgf_invoices", invoices);
        return invoices[idx];
      }
      return null;
    },
    delete: (id: number) => {
      const idx = invoices.findIndex((i) => i.id == id);
      if (idx < 0) return null;
      const deleted = invoices[idx];
      // If this invoice is linked to an order, clear the order's invoice reference
      if (deleted.orderId) {
        const orderIdx = orders.findIndex((o) => o.id == deleted.orderId);
        if (orderIdx >= 0) {
          orders[orderIdx].invoiceId = undefined;
          orders[orderIdx].invoiceNumber = undefined;
          saveItem("sgf_orders", orders);
        }
      }
      invoices.splice(idx, 1);
      saveItem("sgf_invoices", invoices);
      logAudit("DELETE", "invoice", id, `Deleted invoice ${deleted.invoiceNumber}`);
      return deleted;
    },
    recordPayment: ({ invoiceId, amount, paymentMethod, paymentDate, referenceNumber, notes }: any) => {
      const idx = invoices.findIndex((i) => i.id == invoiceId);
      if (idx < 0) return null;
      const inv = invoices[idx];
      // Auto-activate draft invoices when payment is recorded
      if (inv.status === "draft") {
        inv.status = "sent";
      }
      const currentPaid = Number(inv.amountPaid || 0);
      const newPaid = currentPaid + amount;
      const total = Number(inv.total || inv.totalAmount || 0);
      inv.amountPaid = newPaid;
      const allocCredits = (inv.creditAllocations || []).reduce((sum: number, a: any) => sum + (a.amount || 0), 0);
      const lineCredits = (inv.creditedLines || []).reduce((sum: number, cl: any) => sum + (cl.creditAmount || 0), 0);
      const creditsApplied2 = allocCredits + lineCredits;
      inv.balanceDue = total - newPaid - creditsApplied2; // Allow negative = customer credit
      if (inv.balanceDue <= 0.01) {
        inv.status = "paid";
      } else if (newPaid > 0) {
        inv.status = "partially_paid";
      }
      // Store payment record
      if (!inv.payments) inv.payments = [];
      inv.payments.push({
        id: Date.now() + Math.random(),
        amount,
        paymentMethod: paymentMethod || "cash",
        paymentDate: paymentDate || new Date().toISOString(),
        referenceNumber: referenceNumber || "",
        notes: notes || "",
        createdAt: new Date().toISOString(),
      });
      // Add payment as a collection note
      collectionNotes.push({
        id: Date.now() + Math.random(),
        invoiceId,
        customerId: inv.customerId,
        type: "payment_received",
        notes: `Payment of R ${amount.toFixed(2)} via ${paymentMethod || "cash"}. Ref: ${referenceNumber || "N/A"}. ${notes || ""}`,
        contactMethod: paymentMethod || "cash",
        contactPerson: "",
        followUpDate: null,
        createdAt: paymentDate || new Date().toISOString(),
      });
      // Generate receipt for this payment
      const receiptNumber = getNextReceiptNumber();
      const receipt = {
        id: Date.now() + Math.random(),
        receiptNumber,
        invoiceId,
        invoiceNumber: inv.invoiceNumber,
        orderNumber: inv.orderNumber,
        customerId: inv.customerId,
        customerName: (customers.find((c) => c.id == inv.customerId) || {}).name || "",
        amount,
        paymentMethod: paymentMethod || "cash",
        paymentDate: paymentDate || new Date().toISOString(),
        referenceNumber: referenceNumber || "",
        notes: notes || "",
        totalInvoiceAmount: total,
        amountPaidBefore: currentPaid,
        balanceAfter: Math.max(0, total - newPaid - creditsApplied2),
        createdAt: new Date().toISOString(),
      };
      receipts.push(receipt);
      inv.updatedAt = new Date().toISOString();
      saveItem("sgf_receipts", receipts);
      saveItem("sgf_collectionNotes", collectionNotes);
      saveItem("sgf_invoices", invoices);
      logAudit("PAYMENT", "invoice", invoiceId, `Payment of R${amount.toFixed(2)} recorded on invoice ${inv.invoiceNumber}. Balance now R${inv.balanceDue.toFixed(2)}`);
      return { invoice: inv, receipt };
    },
    editPayment: ({ invoiceId, paymentId, amount, paymentMethod, paymentDate, referenceNumber, notes }: any) => {
      const invIdx = invoices.findIndex((i) => i.id == invoiceId);
      if (invIdx < 0) return null;
      const inv = invoices[invIdx];
      if (!inv.payments) return null;
      const payIdx = inv.payments.findIndex((p: any) => p.id == paymentId);
      if (payIdx < 0) return null;
      // Update the payment
      inv.payments[payIdx] = {
        ...inv.payments[payIdx],
        amount,
        paymentMethod: paymentMethod || inv.payments[payIdx].paymentMethod,
        paymentDate: paymentDate || inv.payments[payIdx].paymentDate,
