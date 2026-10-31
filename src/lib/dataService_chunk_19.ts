            const prodIdx = products.findIndex((p) => p.id == item.stockItemId);
            if (prodIdx >= 0) {
              const conversion = item.conversion || 1;
              const deductQty = item.quantity * conversion;
              const newQty = Math.max(0, (products[prodIdx].quantity || 0) - deductQty);
              products[prodIdx].quantity = newQty;
              products[prodIdx].status = newQty === 0 ? "out_of_stock" : newQty < 20 ? "low_stock" : "in_stock";
            }
          }
          saveItem("sgf_products", products);
        }
        
        orders[idx] = { ...oldOrder, ...data, items, subtotal, vatAmount, total, totalAmount: total, updatedAt: new Date().toISOString() };
        saveItem("sgf_orders", orders);
        logAudit("UPDATE", "order", id, `Order ${oldOrder.orderNumber} edited. New total: R${total.toFixed(2)}`);
        
        // Auto-update linked invoice with new order details (skip for quotes — they have no invoices)
        if (!isQuote) {
          updateInvoiceFromOrder(orders[idx]);
        }
        return orders[idx];
      }
      return null;
    },
    updateStatus: ({ id, status }: { id: number; status: string }) => {
      const idx = orders.findIndex((o) => o.id == id);
      if (idx >= 0) {
        const oldStatus = orders[idx].status;
        const order = orders[idx];
        const isQuote = order.orderType === "quote";
        
        // Quote status flow: draft → sent → accepted/rejected → converted
        order.status = status;
        order.updatedAt = new Date().toISOString();
        let cancelledInvoice: any | null = null;
        
        // RESTORE STOCK only when order is CANCELLED (not delivered).
        // Stock is deducted at order creation and stays deducted through the
        // entire lifecycle (pending → ready → delivered). Only cancelled orders
        // return stock to inventory. Skip for quotes — they never deducted stock.
        if (status === "cancelled" && oldStatus !== "cancelled" && oldStatus !== "delivered" && !isQuote) {
          for (const item of (order.items || [])) {
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
          // Also cancel the linked invoice if one exists
          cancelledInvoice = cancelInvoiceFromOrder(order.id);
        }
        // ACTIVATE INVOICE from draft to sent when order becomes ready or delivered
        // (only if invoice already exists — admin must generate it manually)
        if ((status === "ready" || status === "delivered") && !isQuote) {
          activateInvoiceFromOrder(order.id);
        }
        saveItem("sgf_orders", orders);
        logAudit("UPDATE", "order", id, `Order ${order.orderNumber} status changed from ${oldStatus} to ${status}`);
        return { order, cancelledInvoice };
      }
      return null;
    },
    getStats: () => ({
      total: orders.length,
      pending: orders.filter((o) => o.status === "pending").length,
      picking: orders.filter((o) => o.status === "picking").length,
      ready: orders.filter((o) => o.status === "ready").length,
      delivered: orders.filter((o) => o.status === "delivered").length,
      samples: orders.filter((o) => o.orderType === "sample").length,
      quotes: orders.filter((o) => o.orderType === "quote" && o.status !== "converted").length,
      totalValue: Math.round(orders.filter((o) => o.orderType !== "sample" && o.orderType !== "quote").reduce((sum, o) => sum + Number(o.total || 0), 0) * 100) / 100,
    }),
    checkExistingSample: ({ customerId, stockItemId }: { customerId: number; stockItemId: number }) => {
      return { exists: hasExistingSample(customerId, stockItemId) };
    },
    /** Convert a quote to a real order. Deducts stock, creates follow-ups if needed,
     *  and marks the original quote as "converted". Returns the new order. */
    convertQuoteToOrder: (quoteId: number) => {
      const quote = orders.find((o) => o.id == quoteId && o.orderType === "quote");
      if (!quote) return { error: "Quote not found", order: null };
      if (quote.status === "converted") return { error: "Quote already converted", order: null };

      // Generate new order number with ORD- prefix
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const now = new Date();
      const hhmm = String(now.getHours()).padStart(2, "0") + String(now.getMinutes()).padStart(2, "0");
      const msCounter = String(Date.now() % 10000).padStart(4, "0");
      const orderNumber = `ORD-${dateStr}-${hhmm}${msCounter}`;

      const newOrder = {
        ...quote,
        id: Date.now(),
        orderNumber,
        orderType: "normal",
        status: "pending",
        quoteId: quote.id,
        quoteNumber: quote.orderNumber,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      orders.push(newOrder);

      // VALIDATE stock availability before converting (quotes never deducted stock)
      for (const item of (newOrder.items || [])) {
        const product = products.find((p) => p.id == item.stockItemId);
        if (!product) continue;
        const available = Math.max(0, product.quantity || 0);
        const conversion = item.conversion || 1;
        const requestedQty = (item.quantity || 0) * conversion;
        if (requestedQty > available) {
          // Rollback: remove the new order we just pushed
          orders.pop();
          throw new Error(`Insufficient stock for ${product.productName}. Available: ${available}, Requested: ${requestedQty}`);
        }
      }

      // DEDUCT STOCK for each item
      for (const item of (newOrder.items || [])) {
        const prodIdx = products.findIndex((p) => p.id == item.stockItemId);
        if (prodIdx >= 0) {
          const conversion = item.conversion || 1;
          const deductQty = item.quantity * conversion;
          const newQty = Math.max(0, (products[prodIdx].quantity || 0) - deductQty);
          products[prodIdx].quantity = newQty;
          products[prodIdx].status = newQty === 0 ? "out_of_stock" : newQty < 20 ? "low_stock" : "in_stock";
        }
      }
      saveItem("sgf_products", products);

      // Mark original quote as converted
      quote.status = "converted";
      quote.convertedOrderId = newOrder.id;
      quote.convertedOrderNumber = newOrder.orderNumber;
      quote.updatedAt = new Date().toISOString();
      saveItem("sgf_orders", orders);

      // GENERATE INVOICE for the new order (normal order process)
