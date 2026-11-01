      // Helper: find product by stockItemId, productCode, or fuzzy description match
      function findProductForItem(it: any) {
        // 1. Exact match by stockItemId
        if (it.stockItemId != null) {
          const byId = products.find((p) => p.id == it.stockItemId);
          if (byId) return byId;
        }
        // 2. Exact match by productCode
        if (it.productCode) {
          const byCode = products.find((p) => p.productCode === it.productCode);
          if (byCode) return byCode;
        }
        // 3. Exact match by productName
        if (it.productName) {
          const nameNorm = String(it.productName).toLowerCase().trim();
          const byName = products.find((p) => {
            const pNameNorm = String(p.productName || "").toLowerCase().trim();
            return pNameNorm === nameNorm;
          });
          if (byName) return byName;
        }
        // 4. Substring match in both directions
        if (it.description) {
          const descNorm = String(it.description).toLowerCase().trim();
          // Find product whose name is contained in the description
          const byDescContainsName = products.find((p) => {
            const nameNorm = String(p.productName || "").toLowerCase().trim();
            return nameNorm.length > 3 && descNorm.includes(nameNorm);
          });
          if (byDescContainsName) return byDescContainsName;
          // Find product whose name contains the description
          const byNameContainsDesc = products.find((p) => {
            const nameNorm = String(p.productName || "").toLowerCase().trim();
            return descNorm.length > 3 && nameNorm.includes(descNorm);
          });
          if (byNameContainsDesc) return byNameContainsDesc;
        }
        // 5. Fuzzy word matching - score products by keyword overlap
        const searchText = it.description || it.productName || "";
        const searchWords = getKeywords(searchText);
        if (searchWords.length > 0) {
          let bestProduct: any = null;
          let bestScore = 0;
          for (const p of products) {
            const prodWords = getKeywords(p.productName || "");
            const matches = searchWords.filter((sw) => prodWords.some((pw) => pw.includes(sw) || sw.includes(pw)));
            const score = matches.length / Math.max(searchWords.length, prodWords.length, 1);
            if (score > bestScore) {
              bestScore = score;
              bestProduct = p;
            }
          }
          if (bestScore >= 0.4 && bestProduct) return bestProduct; // at least 40% word overlap
        }
        return null;
      }

      const newCOCs = (inv.items || []).map((it: any, idx: number) => {
        const product = findProductForItem(it);
        const qtyBundles = it.quantity || 0;
        const isSheep = (product?.species || product?.category || "").toLowerCase().includes("sheep");
        const animalName = isSheep ? "sheep" : "hog";
        const casingType = (product?.category || "").toLowerCase().includes("long") ? "LONG" :
                           (product?.category || "").toLowerCase().includes("short") ? "SHORT" : "LONG";
        const size = product?.size || "";
        const calibration = size || "-";
        const strands = product?.strands || "";
        const qtyStrands = strands ? `${strands} strands / bundle` : "13 strands / bundle";
        const length = strands && strands.includes("90") ? "Minimum 90 to 91m/bundle" :
                       strands && strands.includes("30") ? "Minimum 30m/bundle" : "Minimum 90 to 91m/bundle";
        const stuffingCapacity = qtyBundles <= 150 ? "44kg average / bundle" : "58kg average / bundle";
        const sgfProductCode = product?.productCode || it.productCode || "";
        const productDesc = it.description || product?.productName || it.productName || "";
        // Extract color from invoice description if product color doesn't match
        const descColor = extractColorFromDesc(it.description || "");
        const cocColour = descColor || product?.color || "White / Beige color";

        return {
          id: Date.now() + idx,
          invoiceId,
          invoiceNumber: inv.invoiceNumber || "",
          orderNumber: inv.orderNumber || "",
          poNumber: inv.poNumber || "",
          customerId: inv.customerId,
          customerName: customerRecord?.name || inv.customer?.name || "",
          company: inv.company || "sgf",
          // Corporate-style COC fields
          recircleProductCode: sgfProductCode,
          customerProductCode: sgfProductCode, // regular customers use same SGF code
          productDescription: productDesc,
          batchNumber: `${batchPrefix}-${String(idx + 1).padStart(3, "0")}`,
          lotSealNumber: `${lotPrefix}-${String(idx + 1).padStart(3, "0")}`,
          manufacturingDate: mfgDateStr,
          useByDate: useByStr,
          barrelNumber: `Total: ${qtyBundles} Bundles`,
          quantityBundles: qtyBundles,
          calibration,
          length,
          qtyStrands,
          stuffingCapacity,
          odour: "No off odors to be present",
          colour: cocColour,
          packing: "Bundles packed in barrels of 150 or 200",
          countryOfOrigin: "South Africa",
          status: "Non HALAAL",
          casingType,
          animalType: animalName,
          cleaningProcess: "Collect small intestines from Abattoir. Manure stripped by hand. Mucosa is removed, through a series of soaking and feeding through a combination of rollers. Final: Quality control, calibration and measuring processed. Product salted and stored in plastic drums ready for delivery.",
          handlingStorage: "Casings to be handled, transported, packed, selected and dispatched in conformance with Good Manufacturing Practice. Casing supplier to store casings in salt, and at ambient/cool temperature. End user to store casings under refrigerated conditions and use within 10-12 months (Opened/Unopened) of receiving it.",
          cocDate: now.toISOString(),
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        };
      });

      certificatesOfCompliance.push(...newCOCs);
      saveItem("sgf_certificatesOfCompliance", certificatesOfCompliance);
      saveItem("sgf_cocs", certificatesOfCompliance);
      return newCOCs;
    },
    create: (data: any) => {
      let company = data.company;
      if (!company && data.barrelId) {
        const b = barrels.find((br) => br.id == data.barrelId);
        if (b?.company) company = b.company;
      }
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
      certificatesOfCompliance.push(newItem);
      saveItem("sgf_certificatesOfCompliance", certificatesOfCompliance);
      saveItem("sgf_cocs", certificatesOfCompliance);
      return newItem;
    },
    update: ({ id, data }: { id: number; data: any }) => {
      const idx = certificatesOfCompliance.findIndex((c) => c.id == id);
      if (idx >= 0) {
