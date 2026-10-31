// =============================================================================
// TEMPERATURE MONITORING SERVICE
// =============================================================================

export const temperatureService = {
  list: () => {
    const comp = getCurrentCompany();
    return temperatureRecords.filter((t) => t.company === comp);
  },
  getById: (id: number) => {
    return temperatureRecords.find((t) => t.id === id);
  },
  getByEquipment: (equipmentId: number) => {
    return temperatureRecords.filter((t) => t.equipmentId === equipmentId);
  },
  getOutOfRange: () => {
    const comp = getCurrentCompany();
    return temperatureRecords.filter((t) => t.company === comp && t.status === "out_of_range");
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
    temperatureRecords.push(newItem);
    saveItem("sgf_temperatureRecords", temperatureRecords);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = temperatureRecords.findIndex((t) => t.id === id);
    if (idx >= 0) {
      temperatureRecords[idx] = { ...temperatureRecords[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_temperatureRecords", temperatureRecords);
    }
    return temperatureRecords[idx];
  },
  delete: (id: number) => {
    const idx = temperatureRecords.findIndex((t) => t.id === id);
    if (idx >= 0) {
      temperatureRecords.splice(idx, 1);
      saveItem("sgf_temperatureRecords", temperatureRecords);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// MICROBIOLOGICAL TESTING SERVICE
// =============================================================================

export const microbiologicalService = {
  list: () => {
    const comp = getCurrentCompany();
    return microbiologicalRecords.filter((m) => m.company === comp);
  },
  getById: (id: number) => {
    return microbiologicalRecords.find((m) => m.id === id);
  },
  getByProduct: (productId: number) => {
    return microbiologicalRecords.filter((m) => m.productId === productId);
  },
  getFailed: () => {
    const comp = getCurrentCompany();
    return microbiologicalRecords.filter((m) => m.company === comp && m.status === "failed");
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
    microbiologicalRecords.push(newItem);
    saveItem("sgf_microbiologicalRecords", microbiologicalRecords);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = microbiologicalRecords.findIndex((m) => m.id === id);
    if (idx >= 0) {
      microbiologicalRecords[idx] = { ...microbiologicalRecords[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_microbiologicalRecords", microbiologicalRecords);
    }
    return microbiologicalRecords[idx];
  },
  delete: (id: number) => {
    const idx = microbiologicalRecords.findIndex((m) => m.id === id);
    if (idx >= 0) {
      microbiologicalRecords.splice(idx, 1);
      saveItem("sgf_microbiologicalRecords", microbiologicalRecords);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// CHEMICAL TESTING SERVICE
// =============================================================================

export const chemicalTestingService = {
  list: () => {
    const comp = getCurrentCompany();
    return chemicalRecords.filter((c) => c.company === comp);
  },
  getById: (id: number) => {
    return chemicalRecords.find((c) => c.id === id);
  },
  getByProduct: (productId: number) => {
    return chemicalRecords.filter((c) => c.productId === productId);
  },
  getFailed: () => {
    const comp = getCurrentCompany();
    return chemicalRecords.filter((c) => c.company === comp && c.status === "failed");
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
    chemicalRecords.push(newItem);
    saveItem("sgf_chemicalRecords", chemicalRecords);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = chemicalRecords.findIndex((c) => c.id === id);
    if (idx >= 0) {
      chemicalRecords[idx] = { ...chemicalRecords[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_chemicalRecords", chemicalRecords);
    }
    return chemicalRecords[idx];
  },
  delete: (id: number) => {
    const idx = chemicalRecords.findIndex((c) => c.id === id);
    if (idx >= 0) {
      chemicalRecords.splice(idx, 1);
      saveItem("sgf_chemicalRecords", chemicalRecords);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// PHYSICAL TESTING SERVICE
// =============================================================================

export const physicalTestingService = {
  list: () => {
    const comp = getCurrentCompany();
    return physicalRecords.filter((p) => p.company === comp);
  },
  getById: (id: number) => {
    return physicalRecords.find((p) => p.id === id);
  },
  getByProduct: (productId: number) => {
    return physicalRecords.filter((p) => p.productId === productId);
  },
  getFailed: () => {
    const comp = getCurrentCompany();
    return physicalRecords.filter((p) => p.company === comp && p.status === "failed");
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
    physicalRecords.push(newItem);
    saveItem("sgf_physicalRecords", physicalRecords);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = physicalRecords.findIndex((p) => p.id === id);
    if (idx >= 0) {
      physicalRecords[idx] = { ...physicalRecords[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_physicalRecords", physicalRecords);
    }
    return physicalRecords[idx];
  },
  delete: (id: number) => {
    const idx = physicalRecords.findIndex((p) => p.id === id);
    if (idx >= 0) {
      physicalRecords.splice(idx, 1);
      saveItem("sgf_physicalRecords", physicalRecords);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// SENSORY TESTING SERVICE
// =============================================================================

export const sensoryTestingService = {
  list: () => {
    const comp = getCurrentCompany();
    return sensoryRecords.filter((s) => s.company === comp);
  },
  getById: (id: number) => {
    return sensoryRecords.find((s) => s.id === id);
  },
  getByProduct: (productId: number) => {
    return sensoryRecords.filter((s) => s.productId === productId);
  },
  getFailed: () => {
    const comp = getCurrentCompany();
    return sensoryRecords.filter((s) => s.company === comp && s.status === "failed");
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
    sensoryRecords.push(newItem);
    saveItem("sgf_sensoryRecords", sensoryRecords);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = sensoryRecords.findIndex((s) => s.id === id);
    if (idx >= 0) {
      sensoryRecords[idx] = { ...sensoryRecords[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_sensoryRecords", sensoryRecords);
    }
    return sensoryRecords[idx];
  },
  delete: (id: number) => {
    const idx = sensoryRecords.findIndex((s) => s.id === id);
    if (idx >= 0) {
      sensoryRecords.splice(idx, 1);
      saveItem("sgf_sensoryRecords", sensoryRecords);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// NUTRITIONAL TESTING SERVICE
// =============================================================================

export const nutritionalTestingService = {
  list: () => {
    const comp = getCurrentCompany();
    return nutritionalRecords.filter((n) => n.company === comp);
  },
  getById: (id: number) => {
    return nutritionalRecords.find((n) => n.id === id);
  },
  getByProduct: (productId: number) => {
    return nutritionalRecords.filter((n) => n.productId === productId);
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
    nutritionalRecords.push(newItem);
    saveItem("sgf_nutritionalRecords", nutritionalRecords);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = nutritionalRecords.findIndex((n) => n.id === id);
    if (idx >= 0) {
      nutritionalRecords[idx] = { ...nutritionalRecords[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_nutritionalRecords", nutritionalRecords);
    }
    return nutritionalRecords[idx];
  },
  delete: (id: number) => {
    const idx = nutritionalRecords.findIndex((n) => n.id === id);
    if (idx >= 0) {
      nutritionalRecords.splice(idx, 1);
      saveItem("sgf_nutritionalRecords", nutritionalRecords);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// SHELF LIFE TESTING SERVICE
// =============================================================================

export const shelfLifeService = {
  list: () => {
    const comp = getCurrentCompany();
    return shelfLifeRecords.filter((s) => s.company === comp);
  },
  getById: (id: number) => {
    return shelfLifeRecords.find((s) => s.id === id);
  },
  getByProduct: (productId: number) => {
    return shelfLifeRecords.filter((s) => s.productId === productId);
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
    shelfLifeRecords.push(newItem);
    saveItem("sgf_shelfLifeRecords", shelfLifeRecords);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = shelfLifeRecords.findIndex((s) => s.id === id);
    if (idx >= 0) {
      shelfLifeRecords[idx] = { ...shelfLifeRecords[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_shelfLifeRecords", shelfLifeRecords);
    }
    return shelfLifeRecords[idx];
  },
  delete: (id: number) => {
    const idx = shelfLifeRecords.findIndex((s) => s.id === id);
    if (idx >= 0) {
      shelfLifeRecords.splice(idx, 1);
      saveItem("sgf_shelfLifeRecords", shelfLifeRecords);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// FOREIGN BODY DETECTION SERVICE
// =============================================================================

export const foreignBodyService = {
  list: () => {
    const comp = getCurrentCompany();
    return foreignBodyRecords.filter((f) => f.company === comp);
  },
  getById: (id: number) => {
    return foreignBodyRecords.find((f) => f.id === id);
  },
  getByProduct: (productId: number) => {
    return foreignBodyRecords.filter((f) => f.productId === productId);
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
    foreignBodyRecords.push(newItem);
    saveItem("sgf_foreignBodyRecords", foreignBodyRecords);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = foreignBodyRecords.findIndex((f) => f.id === id);
    if (idx >= 0) {
      foreignBodyRecords[idx] = { ...foreignBodyRecords[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_foreignBodyRecords", foreignBodyRecords);
    }
    return foreignBodyRecords[idx];
  },
  delete: (id: number) => {
    const idx = foreignBodyRecords.findIndex((f) => f.id === id);
    if (idx >= 0) {
      foreignBodyRecords.splice(idx, 1);
      saveItem("sgf_foreignBodyRecords", foreignBodyRecords);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// METAL DETECTION SERVICE
// =============================================================================

export const metalDetectionService = {
  list: () => {
    const comp = getCurrentCompany();
    return metalDetectionRecords.filter((m) => m.company === comp);
  },
  getById: (id: number) => {
    return metalDetectionRecords.find((m) => m.id === id);
  },
  getByProduct: (productId: number) => {
    return metalDetectionRecords.filter((m) => m.productId === productId);
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
    metalDetectionRecords.push(newItem);
    saveItem("sgf_metalDetectionRecords", metalDetectionRecords);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = metalDetectionRecords.findIndex((m) => m.id === id);
    if (idx >= 0) {
      metalDetectionRecords[idx] = { ...metalDetectionRecords[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_metalDetectionRecords", metalDetectionRecords);
    }
    return metalDetectionRecords[idx];
  },
  delete: (id: number) => {
    const idx = metalDetectionRecords.findIndex((m) => m.id === id);
    if (idx >= 0) {
      metalDetectionRecords.splice(idx, 1);
      saveItem("sgf_metalDetectionRecords", metalDetectionRecords);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// WEIGHT CHECK SERVICE
// =============================================================================

export const weightCheckService = {
  list: () => {
    const comp = getCurrentCompany();
    return weightCheckRecords.filter((w) => w.company === comp);
  },
  getById: (id: number) => {
    return weightCheckRecords.find((w) => w.id === id);
  },
  getByProduct: (productId: number) => {
    return weightCheckRecords.filter((w) => w.productId === productId);
  },
  getOutOfSpec: () => {
    const comp = getCurrentCompany();
    return weightCheckRecords.filter((w) => w.company === comp && w.status === "out_of_spec");
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
    weightCheckRecords.push(newItem);
    saveItem("sgf_weightCheckRecords", weightCheckRecords);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = weightCheckRecords.findIndex((w) => w.id === id);
    if (idx >= 0) {
      weightCheckRecords[idx] = { ...weightCheckRecords[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_weightCheckRecords", weightCheckRecords);
    }
    return weightCheckRecords[idx];
  },
  delete: (id: number) => {
    const idx = weightCheckRecords.findIndex((w) => w.id === id);
    if (idx >= 0) {
      weightCheckRecords.splice(idx, 1);
      saveItem("sgf_weightCheckRecords", weightCheckRecords);
    }
    return { success: idx >= 0 };
  },
};
