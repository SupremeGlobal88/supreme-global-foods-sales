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
          stockItemId: it.stockItemId || 0,
          productCode: it.productCode || "",
          productName: it.productName || it.description || "",
          quantity: it.quantity || 1,
          unitPrice: it.unitPrice || 0,
          lineTotal: it.lineTotal || (it.unitPrice || 0) * (it.quantity || 1),
        })),
        subtotal: inv.subtotal || 0,
        vatAmount: inv.vatAmount || 0,
        total: inv.total || inv.totalAmount || 0,
        status: "delivered",
        orderType: "normal",
        paymentTerms: inv.paymentTerms || "cod",
        priceTier: "corporate",
        deliveryDate: inv.invoiceDate || new Date().toISOString(),
        deliveryAddress: inv.customer?.physicalAddress || "",
        notes: poNumber
          ? `Recreated from invoice ${inv.invoiceNumber} (linked to PO ${poNumber})`
          : `Recreated from invoice ${inv.invoiceNumber}`,
        salesRepName: inv.customer?.salesRepName || "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      orders.push(newOrder);
      saveItem("sgf_orders", orders);

      // Link the invoice to the new order
      inv.orderId = newOrder.id;
      inv.orderNumber = newOrder.orderNumber;
      inv.updatedAt = new Date().toISOString();
      saveItem("sgf_invoices", invoices);

      logAudit("CREATE", "order", newOrder.id, `Order ${orderNumber} recreated from invoice ${inv.invoiceNumber}`);
      return newOrder;
    },
    repairOrders: () => {
      let repaired = 0;
      for (const order of orders) {
        let needsSave = false;
        const isSample = order.orderType === "sample";
        const isQuote = order.orderType === "quote";

        // Repair items: ensure each item has lineTotal, productName, unitPrice
        if (Array.isArray(order.items)) {
          for (const item of order.items) {
            const qty = Number(item.quantity) || 0;
            const price = Number(item.unitPrice) || 0;
            const expectedLineTotal = price * qty;

            if (!item.lineTotal || Number.isNaN(item.lineTotal) || item.lineTotal === 0 && expectedLineTotal > 0) {
              item.lineTotal = expectedLineTotal;
              needsSave = true;
            }
            if (!item.productName || item.productName === "Unknown") {
              const product = products.find((p) => p.id == item.stockItemId);
              if (product?.productName) {
                item.productName = product.productName;
                item.productCode = product.productCode || "";
                needsSave = true;
              }
            }
            if (!item.unitPrice || Number.isNaN(item.unitPrice)) {
              const product = products.find((p) => p.id == item.stockItemId);
              if (product) {
                const tier = isSample ? "corporate" : (order.priceTier || "corporate");
                const conv = Number(item.conversion) || 1;
                const base = getEffectivePrice(item.stockItemId, tier, order.customerId || 0, isSample);
                item.unitPrice = base * conv;
                needsSave = true;
              }
            }
          }
        }

        // Recalculate order-level totals
        const items = order.items || [];
        const subtotal = isSample ? 0 : items.reduce((sum: number, item: any) => sum + (Number(item.lineTotal) || 0), 0);
        const orderCustomer = customers.find((c) => c.id == order.customerId);
        const vatRate = isSample ? 0 : (orderCustomer?.vatExempt ? 0 : 0.15);
        const vatAmount = isSample ? 0 : subtotal * vatRate;
        const total = isSample ? 0 : subtotal + vatAmount;

        if (Number.isNaN(order.subtotal) || order.subtotal === undefined || order.subtotal === null || order.subtotal !== subtotal) {
          order.subtotal = subtotal;
          needsSave = true;
        }
        if (Number.isNaN(order.vatAmount) || order.vatAmount === undefined || order.vatAmount === null || order.vatAmount !== vatAmount) {
          order.vatAmount = vatAmount;
          needsSave = true;
        }
        if (Number.isNaN(order.total) || order.total === undefined || order.total === null || order.total !== total) {
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
      return { repaired, total: orders.length };
    },
    delete: ({ id }: { id: number }) => {
      const ord = orders.find((o) => o.id == id);
      if (ord) {
        orders = orders.map((o) => o.id == id ? { ...o, status: "cancelled", updatedAt: new Date().toISOString() } : o);
        saveItem("sgf_orders", orders);
        logAudit("DELETE", "order", id, `Order cancelled: ${ord.invoiceNumber || ord.id}`);
      }
      return { success: true };
    },
    generateInvoice: (orderId: number) => generateInvoiceForOrder(orderId),
    generateMissingInvoices: () => repairOrders(),
  },

  invoice: {
    list: () => invoices
      .map((inv) => {
