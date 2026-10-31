      
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

      logAudit("CREATE", "order", newOrder.id, `${isQuote ? "Quote" : isSample ? "Sam<response clipped><NOTE>Result is longer than **10000 characters**, will be **truncated**.</NOTE>