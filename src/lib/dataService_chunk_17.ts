          productCode: product?.productCode || "",
          productName: product?.productName || "Unknown",
          lineTotal: unitPrice * item.quantity,
          unitPrice,
          unit: item.unit || "each",
          conversion,
          unitLabel: item.unitLabel || (conversion === 1 ? "Each" : `${conversion} units`),
        };
      });
      
      const subtotal = isSample ? 0 : items.reduce((sum: number, item: any) => sum + item.lineTotal, 0);
      const customerForVat = customers.find((c) => c.id == data.customerId);
      const vatRate = isSample ? 0 : (customerForVat?.vatExempt ? 0 : 0.15);
      const vatAmount = isSample ? 0 : subtotal * vatRate;
      const total = isSample ? 0 : subtotal + vatAmount;
      
      // ZERO AMOUNT VALIDATION: Reject orders with R0 total (skip for samples/quotes)
      if (!isSample && !isQuote && total <= 0) {
        throw new Error("Order total is R0.00. Please enter a valid unit price for each item before placing the order.");
      }

      // BELOW-CORPORATE PRICE VALIDATION: Reject if any custom unit price is below corporate floor
      // Skip for samples and quotes. Admin can override with data.adminApproved === true.
      if (!isSample && !isQuote) {
        const belowCorporateItems: string[] = [];
        for (const item of items) {
          const product = products.find((p) => p.id == item.stockItemId);
          if (!product) continue;
          // Only check items where a custom price was explicitly entered
          const customPrice = (data.items || []).find((it: any) => it.stockItemId == item.stockItemId)?.unitPrice;
          if (customPrice && customPrice > 0) {
            const conversion = item.conversion || 1;
            const corporateFloor = Number(product.corporatePrice || 0) * conversion;
            // Allow 1% tolerance for rounding
            if (customPrice < corporateFloor * 0.99) {
              belowCorporateItems.push(`${product.productName} (R${customPrice.toFixed(2)} < floor R${corporateFloor.toFixed(2)})`);
            }
          }
        }
        if (belowCorporateItems.length > 0 && data.adminApproved !== true) {
          throw new Error(
            `BELOW CORPORATE PRICE: The following items are priced below the corporate floor:\n${belowCorporateItems.join("\n")}\n\nSuper admin approval required to place this order.`
          );
        }
      }
      
      const customerRecord = customers.find((c) => c.id == data.customerId);
      const newOrder = {
        ...data,
        id: Date.now(),
        orderNumber,
        customerName: customerRecord?.name || "",
        status: isQuote ? "draft" : "pending",
        items,
        subtotal,
        vatAmount,
        total,
        totalAmount: total,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      orders.push(newOrder);

      logAudit("CREATE", "order", newOrder.id, `${isQuote ? "Quote" : isSample ? "Sample" : "Order"} ${orderNumber} created for customer #${data.customerId}, ${items.length} items, total R${total.toFixed(2)}`);

      // DEDUCT STOCK for each item (skip for quotes — stock is only committed when converted to order)
      if (!isQuote) {
        for (const item of items) {
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
      saveItem("sgf_orders", orders);

      if (isSample) {
        // Sample: create follow-up and zero-value invoice
        const followUpDate = new Date();
        followUpDate.setDate(followUpDate.getDate() + 4);
        const followUp = {
          id: Date.now() + Math.random(),
          orderId: newOrder.id,
          customerId: data.customerId,
          orderNumber,
          followUpDate: followUpDate.toISOString(),
          status: "pending",
          reason: null,
          expectedOrderDate: null,
          salesRepName: data.salesRepName || "",
          actionType: null,
          title: null,
          scheduledAppointmentId: null,
          createdAt: new Date().toISOString(),
        };
        followUps.push(followUp);
        saveItem("sgf_followUps", followUps);
      }

      // NOTE: Invoices are NO LONGER auto-generated on order creation.

      return newOrder;
    },
    update: ({ id, data }: { id: number; data: any }) => {
      const idx = orders.findIndex((o) => o.id == id);
      if (idx >= 0) {
        const oldOrder = orders[idx];
        const isQuote = oldOrder.orderType === "quote";
        const isSample = data.orderType === "sample" || oldOrder.orderType === "sample";
        
        // GUARD: Prevent changing a quote's orderType via edit — must use convertQuoteToOrder
        if (isQuote && data.orderType && data.orderType !== "quote") {
          throw new Error("Quotes cannot be changed to orders by editing. Please use the 'Convert to Order' button instead.");
        }
        
        // RESTORE old stock first (skip for quotes — they never deducted stock)
        if (!isQuote) {
          for (const item of (oldOrder.items || [])) {
            const prodIdx = products.findIndex((p) => p.id == item.stockItemId);
            if (prodIdx >= 0) {
              const conversion = item.conversion || 1;
              const restoreQty = item.quantity * conversion;
              const newQty = (products[prodIdx].quantity || 0) + restoreQty;
              products[prodIdx].quantity = newQty;
              products[prodIdx].status = newQty === 0 ? "out_of_stock" : newQty < 20 ? "low_stock" : "in_stock";
            }
          }
        }
        
        // Apply new items with fresh calculations
        const items = (data.items || []).map((item: any) => {
          const product = products.find((p) => p.id == item.stockItemId);
          const conversion = item.conversion || 1;
          const basePrice = getEffectivePrice(item.stockItemId, isSample ? "corporate" : data.priceTier, data.customerId, isSample);
          const unitPrice = isSample ? basePrice : (item.unitPrice && item.unitPrice > 0 ? item.unitPrice : basePrice * conversion);
          return { ...item, productCode: product?.productCode || "", productName: product?.productName || "Unknown", lineTotal: unitPrice * item.quantity, unitPrice, unit: item.unit || "each", conversion, unitLabel: item.unitLabel || "Each" };
        });
        const subtotal = isSample ? 0 : items.reduce((sum: number, item: any) => sum + item.lineTotal, 0);
        const customerForVat = customers.find((c) => c.id == data.customerId) || customers.find((c) => c.id == oldOrder.customerId);
        const vatRate = isSample ? 0 : (customerForVat?.vatExempt ? 0 : 0.15);
        const vatAmount = isSample ? 0 : subtotal * vatRate;
        const total = isSample ? 0 : subtotal + vatAmount;
        
        // DEDUCT new stock (skip for quotes)
        if (!isQuote) {
          for (const item of items) {
