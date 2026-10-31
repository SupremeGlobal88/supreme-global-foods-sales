// =============================================================================
// INVENTORY COUNT / STOCKTAKE SERVICE
// =============================================================================

export const stocktakeService = {
  list: () => {
    try {
      const raw = getStorageItem("sgf_stocktakes");
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return [];
  },
  getById: (id: number) => {
    const stocktakes = stocktakeService.list();
    return stocktakes.find((s: any) => s.id === id);
  },
  getByStatus: (status: string) => {
    const stocktakes = stocktakeService.list();
    return stocktakes.filter((s: any) => s.status === status);
  },
  create: (data: any) => {
    const stocktakes = stocktakeService.list();
    const newStocktake = {
      id: Date.now() + Math.random(),
      ...data,
      status: data.status || "draft",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    stocktakes.push(newStocktake);
    setStorageItem("sgf_stocktakes", JSON.stringify(stocktakes));
    logAudit("create", "stocktake", newStocktake.id, data);
    return newStocktake;
  },
  update: (id: number, data: any) => {
    const stocktakes = stocktakeService.list();
    const index = stocktakes.findIndex((s: any) => s.id === id);
    if (index === -1) return null;
    stocktakes[index] = { ...stocktakes[index], ...data, updatedAt: new Date().toISOString() };
    setStorageItem("sgf_stocktakes", JSON.stringify(stocktakes));
    logAudit("update", "stocktake", id, data);
    return stocktakes[index];
  },
  delete: (id: number) => {
    const stocktakes = stocktakeService.list();
    const index = stocktakes.findIndex((s: any) => s.id === id);
    if (index === -1) return { success: false, error: "Stocktake not found" };
    stocktakes.splice(index, 1);
    setStorageItem("sgf_stocktakes", JSON.stringify(stocktakes));
    logAudit("delete", "stocktake", id, {});
    return { success: true };
  },
  complete: (id: number) => {
    const stocktake = stocktakeService.getById(id);
    if (!stocktake) return { success: false, error: "Stocktake not found" };
    stocktake.status = "completed";
    stocktake.completedAt = new Date().toISOString();
    stocktake.updatedAt = new Date().toISOString();
    // Apply adjustments
    if (stocktake.items) {
      for (const item of stocktake.items) {
        const product = products.find((p) => p.id === item.productId);
        if (product) {
          product.quantity = item.countedQuantity;
          product.updatedAt = new Date().toISOString();
        }
      }
    }
    saveItem("sgf_stocktakes", stocktakeService.list());
    saveItem("sgf_products", products);
    logAudit("complete", "stocktake", id, {});
    return { success: true, stocktake };
  },
};

// =============================================================================
// GOODS RECEIVED NOTE (GRN) SERVICE
// =============================================================================

export const grnService = {
  list: () => {
    try {
      const raw = getStorageItem("sgf_grns");
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return [];
  },
  getById: (id: number) => {
    const grns = grnService.list();
    return grns.find((g: any) => g.id === id);
  },
  getBySupplier: (supplierId: number) => {
    const grns = grnService.list();
    return grns.filter((g: any) => g.supplierId === supplierId);
  },
  getByPO: (poId: number) => {
    const grns = grnService.list();
    return grns.filter((g: any) => g.purchaseOrderId === poId);
  },
  create: (data: any) => {
    const grns = grnService.list();
    const newGRN = {
      id: Date.now() + Math.random(),
      ...data,
      status: data.status || "draft",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    grns.push(newGRN);
    setStorageItem("sgf_grns", JSON.stringify(grns));
    logAudit("create", "grn", newGRN.id, data);
    return newGRN;
  },
  update: (id: number, data: any) => {
    const grns = grnService.list();
    const index = grns.findIndex((g: any) => g.id === id);
    if (index === -1) return null;
    grns[index] = { ...grns[index], ...data, updatedAt: new Date().toISOString() };
    setStorageItem("sgf_grns", JSON.stringify(grns));
    logAudit("update", "grn", id, data);
    return grns[index];
  },
  delete: (id: number) => {
    const grns = grnService.list();
    const index = grns.findIndex((g: any) => g.id === id);
    if (index === -1) return { success: false, error: "GRN not found" };
    grns.splice(index, 1);
    setStorageItem("sgf_grns", JSON.stringify(grns));
    logAudit("delete", "grn", id, {});
    return { success: true };
  },
};

// =============================================================================
// TRANSFER / MOVEMENT SERVICE
// =============================================================================

export const transferService = {
  list: () => {
    try {
      const raw = getStorageItem("sgf_transfers");
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return [];
  },
  getById: (id: number) => {
    const transfers = transferService.list();
    return transfers.find((t: any) => t.id === id);
  },
  getByWarehouse: (warehouseId: number) => {
    const transfers = transferService.list();
    return transfers.filter((t: any) => t.fromWarehouseId === warehouseId || t.toWarehouseId === warehouseId);
  },
  create: (data: any) => {
    const transfers = transferService.list();
    const newTransfer = {
      id: Date.now() + Math.random(),
      ...data,
      status: data.status || "draft",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    transfers.push(newTransfer);
    setStorageItem("sgf_transfers", JSON.stringify(transfers));
    logAudit("create", "transfer", newTransfer.id, data);
    return newTransfer;
  },
  update: (id: number, data: any) => {
    const transfers = transferService.list();
    const index = transfers.findIndex((t: any) => t.id === id);
    if (index === -1) return null;
    transfers[index] = { ...transfers[index], ...data, updatedAt: new Date().toISOString() };
    setStorageItem("sgf_transfers", JSON.stringify(transfers));
    logAudit("update", "transfer", id, data);
    return transfers[index];
  },
  delete: (id: number) => {
    const transfers = transferService.list();
    const index = transfers.findIndex((t: any) => t.id === id);
    if (index === -1) return { success: false, error: "Transfer not found" };
    transfers.splice(index, 1);
    setStorageItem("sgf_transfers", JSON.stringify(transfers));
    logAudit("delete", "transfer", id, {});
    return { success: true };
  },
};

// =============================================================================
// SERIAL / BATCH TRACKING SERVICE
// =============================================================================

export const serialTrackingService = {
  list: () => {
    try {
      const raw = getStorageItem("sgf_serials");
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return [];
  },
  getById: (id: number) => {
    const serials = serialTrackingService.list();
    return serials.find((s: any) => s.id === id);
  },
  getByProduct: (productId: number) => {
    const serials = serialTrackingService.list();
    return serials.filter((s: any) => s.productId === productId);
  },
  getBySerial: (serial: string) => {
    const serials = serialTrackingService.list();
    return serials.find((s: any) => s.serialNumber === serial);
  },
  create: (data: any) => {
    const serials = serialTrackingService.list();
    const newSerial = {
      id: Date.now() + Math.random(),
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    serials.push(newSerial);
    setStorageItem("sgf_serials", JSON.stringify(serials));
    logAudit("create", "serial", newSerial.id, data);
    return newSerial;
  },
  update: (id: number, data: any) => {
    const serials = serialTrackingService.list();
    const index = serials.findIndex((s: any) => s.id === id);
    if (index === -1) return null;
    serials[index] = { ...serials[index], ...data, updatedAt: new Date().toISOString() };
    setStorageItem("sgf_serials", JSON.stringify(serials));
    logAudit("update", "serial", id, data);
    return serials[index];
  },
  delete: (id: number) => {
    const serials = serialTrackingService.list();
    const index = serials.findIndex((s: any) => s.id === id);
    if (index === -1) return { success: false, error: "Serial not found" };
    serials.splice(index, 1);
    setStorageItem("sgf_serials", JSON.stringify(serials));
    logAudit("delete", "serial", id, {});
    return { success: true };
  },
};

// =============================================================================
// WARRANTY / GUARANTEE SERVICE
// =============================================================================

export const warrantyService = {
  list: () => {
    try {
      const raw = getStorageItem("sgf_warranties");
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return [];
  },
  getById: (id: number) => {
    const warranties = warrantyService.list();
    return warranties.find((w: any) => w.id === id);
  },
  getByProduct: (productId: number) => {
    const warranties = warrantyService.list();
    return warranties.filter((w: any) => w.productId === productId);
  },
  getByCustomer: (customerId: number) => {
    const warranties = warrantyService.list();
    return warranties.filter((w: any) => w.customerId === customerId);
  },
  create: (data: any) => {
    const warranties = warrantyService.list();
    const newWarranty = {
      id: Date.now() + Math.random(),
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    warranties.push(newWarranty);
    setStorageItem("sgf_warranties", JSON.stringify(warranties));
    logAudit("create", "warranty", newWarranty.id, data);
    return newWarranty;
  },
  update: (id: number, data: any) => {
    const warranties = warrantyService.list();
    const index = warranties.findIndex((w: any) => w.id === id);
    if (index === -1) return null;
    warranties[index] = { ...warranties[index], ...data, updatedAt: new Date().toISOString() };
    setStorageItem("sgf_warranties", JSON.stringify(warranties));
    logAudit("update", "warranty", id, data);
    return warranties[index];
  },
  delete: (id: number) => {
    const warranties = warrantyService.list();
    const index = warranties.findIndex((w: any) => w.id === id);
    if (index === -1) return { success: false, error: "Warranty not found" };
    warranties.splice(index, 1);
    setStorageItem("sgf_warranties", JSON.stringify(warranties));
    logAudit("delete", "warranty", id, {});
    return { success: true };
  },
};
