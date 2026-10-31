// =============================================================================
// HACCP SERVICE
// =============================================================================

export const haccpService = {
  list: () => {
    const comp = getCurrentCompany();
    return haccpRecords.filter((h) => h.company === comp);
  },
  getById: (id: number) => {
    return haccpRecords.find((h) => h.id === id);
  },
  getByType: (type: string) => {
    const comp = getCurrentCompany();
    return haccpRecords.filter((h) => h.company === comp && h.type === type);
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
    haccpRecords.push(newItem);
    saveItem("sgf_haccpRecords", haccpRecords);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = haccpRecords.findIndex((h) => h.id === id);
    if (idx >= 0) {
      haccpRecords[idx] = { ...haccpRecords[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_haccpRecords", haccpRecords);
    }
    return haccpRecords[idx];
  },
  delete: (id: number) => {
    const idx = haccpRecords.findIndex((h) => h.id === id);
    if (idx >= 0) {
      haccpRecords.splice(idx, 1);
      saveItem("sgf_haccpRecords", haccpRecords);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// CLEANING SCHEDULE SERVICE
// =============================================================================

export const cleaningScheduleService = {
  list: () => {
    const comp = getCurrentCompany();
    return cleaningSchedules.filter((c) => c.company === comp);
  },
  getById: (id: number) => {
    return cleaningSchedules.find((c) => c.id === id);
  },
  getDue: () => {
    const comp = getCurrentCompany();
    const now = new Date().toISOString();
    return cleaningSchedules.filter((c) => c.company === comp && c.nextDue && c.nextDue <= now);
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
    cleaningSchedules.push(newItem);
    saveItem("sgf_cleaningSchedules", cleaningSchedules);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = cleaningSchedules.findIndex((c) => c.id === id);
    if (idx >= 0) {
      cleaningSchedules[idx] = { ...cleaningSchedules[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_cleaningSchedules", cleaningSchedules);
    }
    return cleaningSchedules[idx];
  },
  delete: (id: number) => {
    const idx = cleaningSchedules.findIndex((c) => c.id === id);
    if (idx >= 0) {
      cleaningSchedules.splice(idx, 1);
      saveItem("sgf_cleaningSchedules", cleaningSchedules);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// PEST CONTROL SERVICE
// =============================================================================

export const pestControlService = {
  list: () => {
    const comp = getCurrentCompany();
    return pestControlRecords.filter((p) => p.company === comp);
  },
  getById: (id: number) => {
    return pestControlRecords.find((p) => p.id === id);
  },
  getDue: () => {
    const comp = getCurrentCompany();
    const now = new Date().toISOString();
    return pestControlRecords.filter((p) => p.company === comp && p.nextDue && p.nextDue <= now);
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
    pestControlRecords.push(newItem);
    saveItem("sgf_pestControlRecords", pestControlRecords);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = pestControlRecords.findIndex((p) => p.id === id);
    if (idx >= 0) {
      pestControlRecords[idx] = { ...pestControlRecords[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_pestControlRecords", pestControlRecords);
    }
    return pestControlRecords[idx];
  },
  delete: (id: number) => {
    const idx = pestControlRecords.findIndex((p) => p.id === id);
    if (idx >= 0) {
      pestControlRecords.splice(idx, 1);
      saveItem("sgf_pestControlRecords", pestControlRecords);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// ALLERGEN MANAGEMENT SERVICE
// =============================================================================

export const allergenService = {
  list: () => {
    const comp = getCurrentCompany();
    return allergens.filter((a) => a.company === comp);
  },
  getById: (id: number) => {
    return allergens.find((a) => a.id === id);
  },
  getByProduct: (productId: number) => {
    return allergens.filter((a) => a.productId === productId);
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
    allergens.push(newItem);
    saveItem("sgf_allergens", allergens);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = allergens.findIndex((a) => a.id === id);
    if (idx >= 0) {
      allergens[idx] = { ...allergens[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_allergens", allergens);
    }
    return allergens[idx];
  },
  delete: (id: number) => {
    const idx = allergens.findIndex((a) => a.id === id);
    if (idx >= 0) {
      allergens.splice(idx, 1);
      saveItem("sgf_allergens", allergens);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// SPECIFICATION SERVICE
// =============================================================================

export const specificationService = {
  list: () => {
    const comp = getCurrentCompany();
    return specifications.filter((s) => s.company === comp);
  },
  getById: (id: number) => {
    return specifications.find((s) => s.id === id);
  },
  getByProduct: (productId: number) => {
    return specifications.filter((s) => s.productId === productId);
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
    specifications.push(newItem);
    saveItem("sgf_specifications", specifications);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = specifications.findIndex((s) => s.id === id);
    if (idx >= 0) {
      specifications[idx] = { ...specifications[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_specifications", specifications);
    }
    return specifications[idx];
  },
  delete: (id: number) => {
    const idx = specifications.findIndex((s) => s.id === id);
    if (idx >= 0) {
      specifications.splice(idx, 1);
      saveItem("sgf_specifications", specifications);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// LABELING SERVICE
// =============================================================================

export const labelingService = {
  list: () => {
    const comp = getCurrentCompany();
    return labels.filter((l) => l.company === comp);
  },
  getById: (id: number) => {
    return labels.find((l) => l.id === id);
  },
  getByProduct: (productId: number) => {
    return labels.filter((l) => l.productId === productId);
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
    labels.push(newItem);
    saveItem("sgf_labels", labels);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = labels.findIndex((l) => l.id === id);
    if (idx >= 0) {
      labels[idx] = { ...labels[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_labels", labels);
    }
    return labels[idx];
  },
  delete: (id: number) => {
    const idx = labels.findIndex((l) => l.id === id);
    if (idx >= 0) {
      labels.splice(idx, 1);
      saveItem("sgf_labels", labels);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// PACKAGING SERVICE
// =============================================================================

export const packagingService = {
  list: () => {
    const comp = getCurrentCompany();
    return packagingRecords.filter((p) => p.company === comp);
  },
  getById: (id: number) => {
    return packagingRecords.find((p) => p.id === id);
  },
  getByProduct: (productId: number) => {
    return packagingRecords.filter((p) => p.productId === productId);
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
    packagingRecords.push(newItem);
    saveItem("sgf_packagingRecords", packagingRecords);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = packagingRecords.findIndex((p) => p.id === id);
    if (idx >= 0) {
      packagingRecords[idx] = { ...packagingRecords[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_packagingRecords", packagingRecords);
    }
    return packagingRecords[idx];
  },
  delete: (id: number) => {
    const idx = packagingRecords.findIndex((p) => p.id === id);
    if (idx >= 0) {
      packagingRecords.splice(idx, 1);
      saveItem("sgf_packagingRecords", packagingRecords);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// RECALL SERVICE
// =============================================================================

export const recallService = {
  list: () => {
    const comp = getCurrentCompany();
    return recalls.filter((r) => r.company === comp);
  },
  getById: (id: number) => {
    return recalls.find((r) => r.id === id);
  },
  getByStatus: (status: string) => {
    const comp = getCurrentCompany();
    return recalls.filter((r) => r.company === comp && r.status === status);
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
    recalls.push(newItem);
    saveItem("sgf_recalls", recalls);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = recalls.findIndex((r) => r.id === id);
    if (idx >= 0) {
      recalls[idx] = { ...recalls[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_recalls", recalls);
    }
    return recalls[idx];
  },
  delete: (id: number) => {
    const idx = recalls.findIndex((r) => r.id === id);
    if (idx >= 0) {
      recalls.splice(idx, 1);
      saveItem("sgf_recalls", recalls);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// WASTE MANAGEMENT SERVICE
// =============================================================================

export const wasteService = {
  list: () => {
    const comp = getCurrentCompany();
    return wasteRecords.filter((w) => w.company === comp);
  },
  getById: (id: number) => {
    return wasteRecords.find((w) => w.id === id);
  },
  getByType: (type: string) => {
    const comp = getCurrentCompany();
    return wasteRecords.filter((w) => w.company === comp && w.type === type);
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
    wasteRecords.push(newItem);
    saveItem("sgf_wasteRecords", wasteRecords);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = wasteRecords.findIndex((w) => w.id === id);
    if (idx >= 0) {
      wasteRecords[idx] = { ...wasteRecords[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_wasteRecords", wasteRecords);
    }
    return wasteRecords[idx];
  },
  delete: (id: number) => {
    const idx = wasteRecords.findIndex((w) => w.id === id);
    if (idx >= 0) {
      wasteRecords.splice(idx, 1);
      saveItem("sgf_wasteRecords", wasteRecords);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// WATER QUALITY SERVICE
// =============================================================================

export const waterQualityService = {
  list: () => {
    const comp = getCurrentCompany();
    return waterQualityRecords.filter((w) => w.company === comp);
  },
  getById: (id: number) => {
    return waterQualityRecords.find((w) => w.id === id);
  },
  getOutOfSpec: () => {
    const comp = getCurrentCompany();
    return waterQualityRecords.filter((w) => w.company === comp && w.status === "out_of_spec");
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
    waterQualityRecords.push(newItem);
    saveItem("sgf_waterQualityRecords", waterQualityRecords);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = waterQualityRecords.findIndex((w) => w.id === id);
    if (idx >= 0) {
      waterQualityRecords[idx] = { ...waterQualityRecords[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_waterQualityRecords", waterQualityRecords);
    }
    return waterQualityRecords[idx];
  },
  delete: (id: number) => {
    const idx = waterQualityRecords.findIndex((w) => w.id === id);
    if (idx >= 0) {
      waterQualityRecords.splice(idx, 1);
      saveItem("sgf_waterQualityRecords", waterQualityRecords);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// AIR QUALITY SERVICE
// =============================================================================

export const airQualityService = {
  list: () => {
    const comp = getCurrentCompany();
    return airQualityRecords.filter((a) => a.company === comp);
  },
  getById: (id: number) => {
    return airQualityRecords.find((a) => a.id === id);
  },
  getOutOfSpec: () => {
    const comp = getCurrentCompany();
    return airQualityRecords.filter((a) => a.company === comp && a.status === "out_of_spec");
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
    airQualityRecords.push(newItem);
    saveItem("sgf_airQualityRecords", airQualityRecords);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = airQualityRecords.findIndex((a) => a.id === id);
    if (idx >= 0) {
      airQualityRecords[idx] = { ...airQualityRecords[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_airQualityRecords", airQualityRecords);
    }
    return airQualityRecords[idx];
  },
  delete: (id: number) => {
    const idx = airQualityRecords.findIndex((a) => a.id === id);
    if (idx >= 0) {
      airQualityRecords.splice(idx, 1);
      saveItem("sgf_airQualityRecords", airQualityRecords);
    }
    return { success: idx >= 0 };
  },
};
