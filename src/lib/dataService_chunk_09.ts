// =============================================================================
// GLASS AND BRITTLE PLASTICS SERVICE
// =============================================================================

export const glassBrittleService = {
  list: () => {
    const comp = getCurrentCompany();
    return glassBrittleRecords.filter((g) => g.company === comp);
  },
  getById: (id: number) => {
    return glassBrittleRecords.find((g) => g.id === id);
  },
  create: (data: any) => {
    const comp = getCurrentCompany();
    const newItem = {
      ...data,
      company: data.company || comp,
      id: Date.now(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    glassBrittleRecords.push(newItem);
    saveItem("sgf_glassBrittleRecords", glassBrittleRecords);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = glassBrittleRecords.findIndex((g) => g.id === id);
    if (idx >= 0) {
      glassBrittleRecords[idx] = { ...glassBrittleRecords[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_glassBrittleRecords", glassBrittleRecords);
    }
    return glassBrittleRecords[idx];
  },
  delete: (id: number) => {
    const idx = glassBrittleRecords.findIndex((g) => g.id === id);
    if (idx >= 0) {
      glassBrittleRecords.splice(idx, 1);
      saveItem("sgf_glassBrittleRecords", glassBrittleRecords);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// PRODUCTION PLANNING SERVICE
// =============================================================================

export const productionPlanningService = {
  list: () => {
    const comp = getCurrentCompany();
    return productionPlans.filter((p) => p.company === comp);
  },
  getById: (id: number) => {
    return productionPlans.find((p) => p.id === id);
  },
  getByStatus: (status: string) => {
    const comp = getCurrentCompany();
    return productionPlans.filter((p) => p.company === comp && p.status === status);
  },
  create: (data: any) => {
    const comp = getCurrentCompany();
    const newItem = {
      ...data,
      company: data.company || comp,
      id: Date.now(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    productionPlans.push(newItem);
    saveItem("sgf_productionPlans", productionPlans);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = productionPlans.findIndex((p) => p.id === id);
    if (idx >= 0) {
      productionPlans[idx] = { ...productionPlans[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_productionPlans", productionPlans);
    }
    return productionPlans[idx];
  },
  delete: (id: number) => {
    const idx = productionPlans.findIndex((p) => p.id === id);
    if (idx >= 0) {
      productionPlans.splice(idx, 1);
      saveItem("sgf_productionPlans", productionPlans);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// PRODUCTION BATCH SERVICE
// =============================================================================

export const productionBatchService = {
  list: () => {
    const comp = getCurrentCompany();
    return productionBatches.filter((b) => b.company === comp);
  },
  getById: (id: number) => {
    return productionBatches.find((b) => b.id === id);
  },
  getByBatchNumber: (batchNumber: string) => {
    return productionBatches.find((b) => b.batchNumber === batchNumber);
  },
  getByProduct: (productId: number) => {
    return productionBatches.filter((b) => b.productId === productId);
  },
  create: (data: any) => {
    const comp = getCurrentCompany();
    const newItem = {
      ...data,
      company: data.company || comp,
      id: Date.now(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    productionBatches.push(newItem);
    saveItem("sgf_productionBatches", productionBatches);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = productionBatches.findIndex((b) => b.id === id);
    if (idx >= 0) {
      productionBatches[idx] = { ...productionBatches[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_productionBatches", productionBatches);
    }
    return productionBatches[idx];
  },
  delete: (id: number) => {
    const idx = productionBatches.findIndex((b) => b.id === id);
    if (idx >= 0) {
      productionBatches.splice(idx, 1);
      saveItem("sgf_productionBatches", productionBatches);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// WORK ORDER SERVICE
// =============================================================================

export const workOrderService = {
  list: () => {
    const comp = getCurrentCompany();
    return workOrders.filter((w) => w.company === comp);
  },
  getById: (id: number) => {
    return workOrders.find((w) => w.id === id);
  },
  getByStatus: (status: string) => {
    const comp = getCurrentCompany();
    return workOrders.filter((w) => w.company === comp && w.status === status);
  },
  create: (data: any) => {
    const comp = getCurrentCompany();
    const newItem = {
      ...data,
      company: data.company || comp,
      id: Date.now(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    workOrders.push(newItem);
    saveItem("sgf_workOrders", workOrders);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = workOrders.findIndex((w) => w.id === id);
    if (idx >= 0) {
      workOrders[idx] = { ...workOrders[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_workOrders", workOrders);
    }
    return workOrders[idx];
  },
  delete: (id: number) => {
    const idx = workOrders.findIndex((w) => w.id === id);
    if (idx >= 0) {
      workOrders.splice(idx, 1);
      saveItem("sgf_workOrders", workOrders);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// BOM (BILL OF MATERIALS) SERVICE
// =============================================================================

export const bomService = {
  list: () => {
    const comp = getCurrentCompany();
    return boms.filter((b) => b.company === comp);
  },
  getById: (id: number) => {
    return boms.find((b) => b.id === id);
  },
  getByProduct: (productId: number) => {
    return boms.filter((b) => b.productId === productId);
  },
  create: (data: any) => {
    const comp = getCurrentCompany();
    const newItem = {
      ...data,
      company: data.company || comp,
      id: Date.now(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    boms.push(newItem);
    saveItem("sgf_boms", boms);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = boms.findIndex((b) => b.id === id);
    if (idx >= 0) {
      boms[idx] = { ...boms[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_boms", boms);
    }
    return boms[idx];
  },
  delete: (id: number) => {
    const idx = boms.findIndex((b) => b.id === id);
    if (idx >= 0) {
      boms.splice(idx, 1);
      saveItem("sgf_boms", boms);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// ROUTING SERVICE
// =============================================================================

export const routingService = {
  list: () => {
    const comp = getCurrentCompany();
    return routings.filter((r) => r.company === comp);
  },
  getById: (id: number) => {
    return routings.find((r) => r.id === id);
  },
  getByProduct: (productId: number) => {
    return routings.filter((r) => r.productId === productId);
  },
  create: (data: any) => {
    const comp = getCurrentCompany();
    const newItem = {
      ...data,
      company: data.company || comp,
      id: Date.now(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    routings.push(newItem);
    saveItem("sgf_routings", routings);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = routings.findIndex((r) => r.id === id);
    if (idx >= 0) {
      routings[idx] = { ...routings[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_routings", routings);
    }
    return routings[idx];
  },
  delete: (id: number) => {
    const idx = routings.findIndex((r) => r.id === id);
    if (idx >= 0) {
      routings.splice(idx, 1);
      saveItem("sgf_routings", routings);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// LABOR RECORD SERVICE
// =============================================================================

export const laborService = {
  list: () => {
    const comp = getCurrentCompany();
    return laborRecords.filter((l) => l.company === comp);
  },
  getById: (id: number) => {
    return laborRecords.find((l) => l.id === id);
  },
  getByEmployee: (employeeId: number) => {
    return laborRecords.filter((l) => l.employeeId === employeeId);
  },
  getByWorkOrder: (workOrderId: number) => {
    return laborRecords.filter((l) => l.workOrderId === workOrderId);
  },
  create: (data: any) => {
    const comp = getCurrentCompany();
    const newItem = {
      ...data,
      company: data.company || comp,
      id: Date.now(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    laborRecords.push(newItem);
    saveItem("sgf_laborRecords", laborRecords);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = laborRecords.findIndex((l) => l.id === id);
    if (idx >= 0) {
      laborRecords[idx] = { ...laborRecords[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_laborRecords", laborRecords);
    }
    return laborRecords[idx];
  },
  delete: (id: number) => {
    const idx = laborRecords.findIndex((l) => l.id === id);
    if (idx >= 0) {
      laborRecords.splice(idx, 1);
      saveItem("sgf_laborRecords", laborRecords);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// MACHINE SERVICE
// =============================================================================

export const machineService = {
  list: () => {
    const comp = getCurrentCompany();
    return machines.filter((m) => m.company === comp);
  },
  getById: (id: number) => {
    return machines.find((m) => m.id === id);
  },
  getByStatus: (status: string) => {
    const comp = getCurrentCompany();
    return machines.filter((m) => m.company === comp && m.status === status);
  },
  create: (data: any) => {
    const comp = getCurrentCompany();
    const newItem = {
      ...data,
      company: data.company || comp,
      id: Date.now(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    machines.push(newItem);
    saveItem("sgf_machines", machines);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = machines.findIndex((m) => m.id === id);
    if (idx >= 0) {
      machines[idx] = { ...machines[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_machines", machines);
    }
    return machines[idx];
  },
  delete: (id: number) => {
    const idx = machines.findIndex((m) => m.id === id);
    if (idx >= 0) {
      machines.splice(idx, 1);
      saveItem("sgf_machines", machines);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// DOWNTIME SERVICE
// =============================================================================

export const downtimeService = {
  list: () => {
    const comp = getCurrentCompany();
    return downtimeRecords.filter((d) => d.company === comp);
  },
  getById: (id: number) => {
    return downtimeRecords.find((d) => d.id === id);
  },
  getByMachine: (machineId: number) => {
    return downtimeRecords.filter((d) => d.machineId === machineId);
  },
  create: (data: any) => {
    const comp = getCurrentCompany();
    const newItem = {
      ...data,
      company: data.company || comp,
      id: Date.now(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    downtimeRecords.push(newItem);
    saveItem("sgf_downtimeRecords", downtimeRecords);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = downtimeRecords.findIndex((d) => d.id === id);
    if (idx >= 0) {
      downtimeRecords[idx] = { ...downtimeRecords[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_downtimeRecords", downtimeRecords);
    }
    return downtimeRecords[idx];
  },
  delete: (id: number) => {
    const idx = downtimeRecords.findIndex((d) => d.id === id);
    if (idx >= 0) {
      downtimeRecords.splice(idx, 1);
      saveItem("sgf_downtimeRecords", downtimeRecords);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// QUALITY CHECK SERVICE
// =============================================================================

export const qualityCheckService = {
  list: () => {
    const comp = getCurrentCompany();
    return qualityChecks.filter((q) => q.company === comp);
  },
  getById: (id: number) => {
    return qualityChecks.find((q) => q.id === id);
  },
  getByBatch: (batchId: number) => {
    return qualityChecks.filter((q) => q.batchId === batchId);
  },
  getFailed: () => {
    const comp = getCurrentCompany();
    return qualityChecks.filter((q) => q.company === comp && q.status === "failed");
  },
  create: (data: any) => {
    const comp = getCurrentCompany();
    const newItem = {
      ...data,
      company: data.company || comp,
      id: Date.now(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    qualityChecks.push(newItem);
    saveItem("sgf_qualityChecks", qualityChecks);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = qualityChecks.findIndex((q) => q.id === id);
    if (idx >= 0) {
      qualityChecks[idx] = { ...qualityChecks[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_qualityChecks", qualityChecks);
    }
    return qualityChecks[idx];
  },
  delete: (id: number) => {
    const idx = qualityChecks.findIndex((q) => q.id === id);
    if (idx >= 0) {
      qualityChecks.splice(idx, 1);
      saveItem("sgf_qualityChecks", qualityChecks);
    }
    return { success: idx >= 0 };
  },
};
