// =============================================================================
// SAMPLE ORDER SERVICE
// =============================================================================

export const sampleOrderService = {
  list: () => orders.filter((o) => o.orderType === "sample"),
  getById: (id: number) => orders.find((o) => o.id === id && o.orderType === "sample"),
  getByCustomer: (customerId: number) => orders.filter((o) => o.customerId === customerId && o.orderType === "sample"),
  getByStatus: (status: string) => orders.filter((o) => o.status === status && o.orderType === "sample"),
  getBySalesRep: (repName: string) => orders.filter((o) => o.salesRepName === repName && o.orderType === "sample"),
  create: (data: any) => {
    const newOrder = {
      id: Date.now() + Math.random(),
      orderNumber: generateOrderNumber("sample"),
      orderType: "sample",
      ...data,
      status: data.status || "draft",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    orders.push(newOrder);
    saveItem("sgf_orders", orders);
    logAudit("create", "sampleOrder", newOrder.id, data);
    return newOrder;
  },
  update: (id: number, data: any) => {
    const index = orders.findIndex((o) => o.id === id && o.orderType === "sample");
    if (index === -1) return null;
    orders[index] = { ...orders[index], ...data, updatedAt: new Date().toISOString() };
    saveItem("sgf_orders", orders);
    logAudit("update", "sampleOrder", id, data);
    return orders[index];
  },
  delete: (id: number) => {
    const index = orders.findIndex((o) => o.id === id && o.orderType === "sample");
    if (index === -1) return { success: false, error: "Sample order not found" };
    orders.splice(index, 1);
    saveItem("sgf_orders", orders);
    logAudit("delete", "sampleOrder", id, {});
    return { success: true };
  },
  getStats: () => {
    const samples = orders.filter((o) => o.orderType === "sample");
    return {
      total: samples.length,
      draft: samples.filter((o) => o.status === "draft").length,
      pending: samples.filter((o) => o.status === "pending").length,
      confirmed: samples.filter((o) => o.status === "confirmed").length,
      delivered: samples.filter((o) => o.status === "delivered").length,
      totalValue: samples.reduce((sum, o) => sum + (o.total || 0), 0),
    };
  },
};

// =============================================================================
// QUOTE SERVICE
// =============================================================================

export const quoteService = {
  list: () => orders.filter((o) => o.orderType === "quote"),
  getById: (id: number) => orders.find((o) => o.id === id && o.orderType === "quote"),
  getByCustomer: (customerId: number) => orders.filter((o) => o.customerId === customerId && o.orderType === "quote"),
  getByStatus: (status: string) => orders.filter((o) => o.status === status && o.orderType === "quote"),
  getBySalesRep: (repName: string) => orders.filter((o) => o.salesRepName === repName && o.orderType === "quote"),
  create: (data: any) => {
    const newQuote = {
      id: Date.now() + Math.random(),
      orderNumber: generateOrderNumber("quote"),
      orderType: "quote",
      ...data,
      status: data.status || "draft",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    orders.push(newQuote);
    saveItem("sgf_orders", orders);
    logAudit("create", "quote", newQuote.id, data);
    return newQuote;
  },
  update: (id: number, data: any) => {
    const index = orders.findIndex((o) => o.id === id && o.orderType === "quote");
    if (index === -1) return null;
    orders[index] = { ...orders[index], ...data, updatedAt: new Date().toISOString() };
    saveItem("sgf_orders", orders);
    logAudit("update", "quote", id, data);
    return orders[index];
  },
  delete: (id: number) => {
    const index = orders.findIndex((o) => o.id === id && o.orderType === "quote");
    if (index === -1) return { success: false, error: "Quote not found" };
    orders.splice(index, 1);
    saveItem("sgf_orders", orders);
    logAudit("delete", "quote", id, {});
    return { success: true };
  },
  convertToOrder: (id: number) => {
    const index = orders.findIndex((o) => o.id === id && o.orderType === "quote");
    if (index === -1) return { success: false, error: "Quote not found" };
    const quote = orders[index];
    quote.orderType = "regular";
    quote.status = "pending";
    quote.orderNumber = generateOrderNumber("regular");
    quote.updatedAt = new Date().toISOString();
    saveItem("sgf_orders", orders);
    logAudit("convert", "quote", id, { newOrderNumber: quote.orderNumber });
    return { success: true, order: quote };
  },
  getStats: () => {
    const quotes = orders.filter((o) => o.orderType === "quote");
    return {
      total: quotes.length,
      draft: quotes.filter((o) => o.status === "draft").length,
      sent: quotes.filter((o) => o.status === "sent").length,
      accepted: quotes.filter((o) => o.status === "accepted").length,
      rejected: quotes.filter((o) => o.status === "rejected").length,
      converted: quotes.filter((o) => o.status === "converted").length,
      totalValue: quotes.reduce((sum, o) => sum + (o.total || 0), 0),
    };
  },
};

// =============================================================================
// RETURN / CREDIT SERVICE
// =============================================================================

export const returnService = {
  list: () => {
    try {
      const raw = getStorageItem("sgf_returns");
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return [];
  },
  getById: (id: number) => {
    const returns = returnService.list();
    return returns.find((r: any) => r.id === id);
  },
  getByCustomer: (customerId: number) => {
    const returns = returnService.list();
    return returns.filter((r: any) => r.customerId === customerId);
  },
  getByOrder: (orderId: number) => {
    const returns = returnService.list();
    return returns.filter((r: any) => r.orderId === orderId);
  },
  create: (data: any) => {
    const returns = returnService.list();
    const newReturn = {
      id: Date.now() + Math.random(),
      ...data,
      status: data.status || "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    returns.push(newReturn);
    setStorageItem("sgf_returns", JSON.stringify(returns));
    logAudit("create", "return", newReturn.id, data);
    return newReturn;
  },
  update: (id: number, data: any) => {
    const returns = returnService.list();
    const index = returns.findIndex((r: any) => r.id === id);
    if (index === -1) return null;
    returns[index] = { ...returns[index], ...data, updatedAt: new Date().toISOString() };
    setStorageItem("sgf_returns", JSON.stringify(returns));
    logAudit("update", "return", id, data);
    return returns[index];
  },
  delete: (id: number) => {
    const returns = returnService.list();
    const index = returns.findIndex((r: any) => r.id === id);
    if (index === -1) return { success: false, error: "Return not found" };
    returns.splice(index, 1);
    setStorageItem("sgf_returns", JSON.stringify(returns));
    logAudit("delete", "return", id, {});
    return { success: true };
  },
};

// =============================================================================
// PRODUCTION / BATCH SERVICE
// =============================================================================

export const productionService = {
  list: () => {
    try {
      const raw = getStorageItem("sgf_production");
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return [];
  },
  getById: (id: number) => {
    const batches = productionService.list();
    return batches.find((b: any) => b.id === id);
  },
  getByOrder: (orderId: number) => {
    const batches = productionService.list();
    return batches.filter((b: any) => b.orderId === orderId);
  },
  getByStatus: (status: string) => {
    const batches = productionService.list();
    return batches.filter((b: any) => b.status === status);
  },
  create: (data: any) => {
    const batches = productionService.list();
    const newBatch = {
      id: Date.now() + Math.random(),
      ...data,
      status: data.status || "planned",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    batches.push(newBatch);
    setStorageItem("sgf_production", JSON.stringify(batches));
    logAudit("create", "production", newBatch.id, data);
    return newBatch;
  },
  update: (id: number, data: any) => {
    const batches = productionService.list();
    const index = batches.findIndex((b: any) => b.id === id);
    if (index === -1) return null;
    batches[index] = { ...batches[index], ...data, updatedAt: new Date().toISOString() };
    setStorageItem("sgf_production", JSON.stringify(batches));
    logAudit("update", "production", id, data);
    return batches[index];
  },
  delete: (id: number) => {
    const batches = productionService.list();
    const index = batches.findIndex((b: any) => b.id === id);
    if (index === -1) return { success: false, error: "Production batch not found" };
    batches.splice(index, 1);
    setStorageItem("sgf_production", JSON.stringify(batches));
    logAudit("delete", "production", id, {});
    return { success: true };
  },
};

// =============================================================================
// QUALITY CONTROL SERVICE
// =============================================================================

export const qualityControlService = {
  list: () => {
    try {
      const raw = getStorageItem("sgf_qualityControl");
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return [];
  },
  getById: (id: number) => {
    const records = qualityControlService.list();
    return records.find((r: any) => r.id === id);
  },
  getByBatch: (batchId: number) => {
    const records = qualityControlService.list();
    return records.filter((r: any) => r.batchId === batchId);
  },
  create: (data: any) => {
    const records = qualityControlService.list();
    const newRecord = {
      id: Date.now() + Math.random(),
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    records.push(newRecord);
    setStorageItem("sgf_qualityControl", JSON.stringify(records));
    logAudit("create", "qualityControl", newRecord.id, data);
    return newRecord;
  },
  update: (id: number, data: any) => {
    const records = qualityControlService.list();
    const index = records.findIndex((r: any) => r.id === id);
    if (index === -1) return null;
    records[index] = { ...records[index], ...data, updatedAt: new Date().toISOString() };
    setStorageItem("sgf_qualityControl", JSON.stringify(records));
    logAudit("update", "qualityControl", id, data);
    return records[index];
  },
  delete: (id: number) => {
    const records = qualityControlService.list();
    const index = records.findIndex((r: any) => r.id === id);
    if (index === -1) return { success: false, error: "QC record not found" };
    records.splice(index, 1);
    setStorageItem("sgf_qualityControl", JSON.stringify(records));
    logAudit("delete", "qualityControl", id, {});
    return { success: true };
  },
};
