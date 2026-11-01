      logAudit("DELETE", "stock", id, `Stock item deleted: ${prod?.productName || prod?.productCode || "Unnamed"}`);
      return { success: true };
    },
    bulkCreate: (items: any[]) => {
      const created = [];
      const updated = [];
      for (let i = 0; i < items.length; i++) {
        const incoming = items[i];
        // Check if product already exists by productName (case-insensitive)
        // productCode can differ between uploads, but productName is the reliable identifier
        let existingIdx = products.findIndex(
          (p) => (p.productName || "").toLowerCase().trim() === (incoming.productName || "").toLowerCase().trim()
        );
        // Fallback: if no name match, try matching by ALL non-empty shared attributes
        if (existingIdx < 0) {
          const inStrands = String(incoming.strands || "").trim().toLowerCase();
          const inSize    = String(incoming.size    || "").trim().toLowerCase();
          const inGrade   = String(incoming.grade   || "").trim().toLowerCase();
          const inColor   = String(incoming.color   || "").trim().toLowerCase();
          const inSpecies = String(incoming.species || "").trim().toLowerCase();
          existingIdx = products.findIndex((p) => {
            const pStrands = String(p.strands || "").trim().toLowerCase();
            const pSize    = String(p.size    || "").trim().toLowerCase();
            const pGrade   = String(p.grade   || "").trim().toLowerCase();
            const pColor   = String(p.color   || "").trim().toLowerCase();
            const pSpecies = String(p.species || "").trim().toLowerCase();
            let possible = 0, matched = 0;
            if (pStrands && inStrands) { possible++; if (pStrands === inStrands) matched++; }
            if (pSize    && inSize)    { possible++; if (pSize    === inSize)    matched++; }
            if (pGrade   && inGrade)   { possible++; if (pGrade   === inGrade)   matched++; }
            if (pColor   && inColor)   { possible++; if (pColor   === inColor)   matched++; }
            if (pSpecies && inSpecies) { possible++; if (pSpecies === inSpecies) matched++; }
            return possible >= 2 && matched === possible;
          });
        }
        if (existingIdx >= 0) {
          // Update existing product: new SOH, update prices if provided, keep id
          const existing = products[existingIdx];
          // PRICE PROTECTION: never overwrite an existing price with 0/empty from a bulk upload.
          // Uploads that lack price columns parse prices as 0 — treat those as "not provided".
          const safePrice = (incomingVal: any, existingVal: any) =>
            Number(incomingVal) > 0 ? incomingVal : existingVal;
          products[existingIdx] = {
            ...existing,
            quantity: incoming.quantity !== undefined ? incoming.quantity : existing.quantity,
            corporatePrice: safePrice(incoming.corporatePrice, existing.corporatePrice),
            bulkPrice: safePrice(incoming.bulkPrice, existing.bulkPrice),
            wholesalePrice: safePrice(incoming.wholesalePrice, existing.wholesalePrice),
            retailPrice: safePrice(incoming.retailPrice, existing.retailPrice),
            // Update optional fields if provided
            ...(incoming.strands !== undefined && { strands: incoming.strands }),
            ...(incoming.size !== undefined && { size: incoming.size }),
            ...(incoming.grade !== undefined && { grade: incoming.grade }),
            ...(incoming.color !== undefined && { color: incoming.color }),
            ...(incoming.species !== undefined && { species: incoming.species }),
            ...(incoming.category !== undefined && { category: incoming.category }),
            ...(incoming.productName !== undefined && { productName: incoming.productName }),
            updatedAt: new Date().toISOString(),
            // Recalculate status based on new quantity
            status: (incoming.quantity || existing.quantity) === 0
              ? "out_of_stock"
              : (incoming.quantity || existing.quantity) < 20
                ? "low_stock"
                : "in_stock",
          };
          updated.push(products[existingIdx]);
        } else {
          // New product - create with new id
          const newItem = {
            ...incoming,
            id: Date.now() + i,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            status: (incoming.quantity || 0) === 0
              ? "out_of_stock"
              : (incoming.quantity || 0) < 20
                ? "low_stock"
                : "in_stock",
          };
          products.push(newItem);
          created.push(newItem);
        }
      }
      saveItem("sgf_products", products);
      logAudit("BULK_UPLOAD", "stock", 0, `Bulk stock upload: ${created.length} created, ${updated.length} updated`);
      return { created: created.length, updated: updated.length };
    },

    /** Daily Invoiced Stock Report — shows what stock was invoiced on a given date */
    getDailyInvoicedStock: ({ from, to }: { from?: string; to?: string }) => {
      const fromDate = from || new Date().toISOString().slice(0, 10);
      const toDate = to || fromDate;
      const fromTs = new Date(fromDate + "T00:00:00").getTime();
      const toTs = new Date(toDate + "T23:59:59").getTime();

      const results: any[] = [];

      for (const inv of invoices) {
        const invTs = new Date(inv.createdAt || inv.invoiceDate).getTime();
        if (invTs < fromTs || invTs > toTs) continue;

        const order = orders.find((o) => o.id == inv.orderId);
        if (!order) continue;

        const customer = customers.find((c) => c.id == inv.customerId || c.id == order.customerId);
        if (!customer) continue;

        const repName = customer.salesRepName || customer.salesRep || "";
        const priceTier = customer.priceTier || "retail";

        for (const item of inv.items || order.items || []) {
          const product = products.find((p) => p.id == item.stockItemId);
          const specialPrice = specialPrices.find(
            (sp: any) => sp.customerId == customer.id && sp.stockItemId == item.stockItemId
          );

          const unitPrice = Number(item.unitPrice || 0);
          const quantity = Number(item.quantity || 0);
          const lineTotal = Number(item.lineTotal || unitPrice * quantity);

          // Determine if special price was used
          let isSpecialPrice = false;
          let tierPrice = 0;
          if (product) {
            tierPrice = Number((product as any)[`${priceTier}Price`] || 0);
            if (specialPrice && Math.abs(specialPrice.specialPrice - unitPrice) < 0.01) {
              isSpecialPrice = true;
            }
          }

          results.push({
            invoiceNumber: inv.invoiceNumber,
            orderNumber: inv.orderNumber || order.orderNumber,
            invoiceDate: inv.invoiceDate || inv.createdAt,
            productName: item.description || item.productName || product?.name || "Unknown",
            productCode: product?.productCode || "",
            quantity,
            unitPrice,
            lineTotal,
            priceTier,
            isSpecialPrice,
            specialPriceAmount: specialPrice?.specialPrice || null,
            tierPrice: tierPrice || null,
            salesRep: repName,
