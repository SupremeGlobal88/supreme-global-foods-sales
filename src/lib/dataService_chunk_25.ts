// =============================================================================
// PAYROLL / SALARY SERVICE
// =============================================================================

export const payrollService = {
  list: () => {
    try {
      const raw = getStorageItem("sgf_payroll");
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return [];
  },
  getById: (id: number) => {
    const payroll = payrollService.list();
    return payroll.find((p: any) => p.id === id);
  },
  getByUser: (userId: number) => {
    const payroll = payrollService.list();
    return payroll.filter((p: any) => p.userId === userId);
  },
  getByMonth: (month: string) => {
    const payroll = payrollService.list();
    return payroll.filter((p: any) => p.month === month);
  },
  create: (data: any) => {
    const payroll = payrollService.list();
    const newPayroll = {
      id: Date.now() + Math.random(),
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    payroll.push(newPayroll);
    setStorageItem("sgf_payroll", JSON.stringify(payroll));
    logAudit("create", "payroll", newPayroll.id, data);
    return newPayroll;
  },
  update: (id: number, data: any) => {
    const payroll = payrollService.list();
    const index = payroll.findIndex((p: any) => p.id === id);
    if (index === -1) return null;
    payroll[index] = { ...payroll[index], ...data, updatedAt: new Date().toISOString() };
    setStorageItem("sgf_payroll", JSON.stringify(payroll));
    logAudit("update", "payroll", id, data);
    return payroll[index];
  },
  delete: (id: number) => {
    const payroll = payrollService.list();
    const index = payroll.findIndex((p: any) => p.id === id);
    if (index === -1) return { success: false, error: "Payroll record not found" };
    payroll.splice(index, 1);
    setStorageItem("sgf_payroll", JSON.stringify(payroll));
    logAudit("delete", "payroll", id, {});
    return { success: true };
  },
};

// =============================================================================
// ASSET / EQUIPMENT SERVICE
// =============================================================================

export const assetService = {
  list: () => {
    try {
      const raw = getStorageItem("sgf_assets");
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return [];
  },
  getById: (id: number) => {
    const assets = assetService.list();
    return assets.find((a: any) => a.id === id);
  },
  getByCategory: (category: string) => {
    const assets = assetService.list();
    return assets.filter((a: any) => a.category === category);
  },
  getByStatus: (status: string) => {
    const assets = assetService.list();
    return assets.filter((a: any) => a.status === status);
  },
  create: (data: any) => {
    const assets = assetService.list();
    const newAsset = {
      id: Date.now() + Math.random(),
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    assets.push(newAsset);
    setStorageItem("sgf_assets", JSON.stringify(assets));
    logAudit("create", "asset", newAsset.id, data);
    return newAsset;
  },
  update: (id: number, data: any) => {
    const assets = assetService.list();
    const index = assets.findIndex((a: any) => a.id === id);
    if (index === -1) return null;
    assets[index] = { ...assets[index], ...data, updatedAt: new Date().toISOString() };
    setStorageItem("sgf_assets", JSON.stringify(assets));
    logAudit("update", "asset", id, data);
    return assets[index];
  },
  delete: (id: number) => {
    const assets = assetService.list();
    const index = assets.findIndex((a: any) => a.id === id);
    if (index === -1) return { success: false, error: "Asset not found" };
    assets.splice(index, 1);
    setStorageItem("sgf_assets", JSON.stringify(assets));
    logAudit("delete", "asset", id, {});
    return { success: true };
  },
};

// =============================================================================
// MAINTENANCE / SERVICE SERVICE
// =============================================================================

export const maintenanceService = {
  list: () => {
    try {
      const raw = getStorageItem("sgf_maintenance");
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return [];
  },
  getById: (id: number) => {
    const records = maintenanceService.list();
    return records.find((r: any) => r.id === id);
  },
  getByAsset: (assetId: number) => {
    const records = maintenanceService.list();
    return records.filter((r: any) => r.assetId === assetId);
  },
  getByStatus: (status: string) => {
    const records = maintenanceService.list();
    return records.filter((r: any) => r.status === status);
  },
  create: (data: any) => {
    const records = maintenanceService.list();
    const newRecord = {
      id: Date.now() + Math.random(),
      ...data,
      status: data.status || "scheduled",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    records.push(newRecord);
    setStorageItem("sgf_maintenance", JSON.stringify(records));
    logAudit("create", "maintenance", newRecord.id, data);
    return newRecord;
  },
  update: (id: number, data: any) => {
    const records = maintenanceService.list();
    const index = records.findIndex((r: any) => r.id === id);
    if (index === -1) return null;
    records[index] = { ...records[index], ...data, updatedAt: new Date().toISOString() };
    setStorageItem("sgf_maintenance", JSON.stringify(records));
    logAudit("update", "maintenance", id, data);
    return records[index];
  },
  delete: (id: number) => {
    const records = maintenanceService.list();
    const index = records.findIndex((r: any) => r.id === id);
    if (index === -1) return { success: false, error: "Maintenance record not found" };
    records.splice(index, 1);
    setStorageItem("sgf_maintenance", JSON.stringify(records));
    logAudit("delete", "maintenance", id, {});
    return { success: true };
  },
};

// =============================================================================
// INSURANCE / POLICY SERVICE
// =============================================================================

export const insuranceService = {
  list: () => {
    try {
      const raw = getStorageItem("sgf_insurance");
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return [];
  },
  getById: (id: number) => {
    const policies = insuranceService.list();
    return policies.find((p: any) => p.id === id);
  },
  getByAsset: (assetId: number) => {
    const policies = insuranceService.list();
    return policies.filter((p: any) => p.assetId === assetId);
  },
  getActive: () => {
    const policies = insuranceService.list();
    return policies.filter((p: any) => p.status === "active");
  },
  create: (data: any) => {
    const policies = insuranceService.list();
    const newPolicy = {
      id: Date.now() + Math.random(),
      ...data,
      status: data.status || "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    policies.push(newPolicy);
    setStorageItem("sgf_insurance", JSON.stringify(policies));
    logAudit("create", "insurance", newPolicy.id, data);
    return newPolicy;
  },
  update: (id: number, data: any) => {
    const policies = insuranceService.list();
    const index = policies.findIndex((p: any) => p.id === id);
    if (index === -1) return null;
    policies[index] = { ...policies[index], ...data, updatedAt: new Date().toISOString() };
    setStorageItem("sgf_insurance", JSON.stringify(policies));
    logAudit("update", "insurance", id, data);
    return policies[index];
  },
  delete: (id: number) => {
    const policies = insuranceService.list();
    const index = policies.findIndex((p: any) => p.id === id);
    if (index === -1) return { success: false, error: "Insurance policy not found" };
    policies.splice(index, 1);
    setStorageItem("sgf_insurance", JSON.stringify(policies));
    logAudit("delete", "insurance", id, {});
    return { success: true };
  },
};

// =============================================================================
// DEPRECIATION SERVICE
// =============================================================================

export const depreciationService = {
  calculate: (cost: number, salvageValue: number, usefulLife: number, method: "straight" | "reducing" = "straight") => {
    if (method === "straight") {
      const annualDepreciation = (cost - salvageValue) / usefulLife;
      return {
        annualDepreciation,
        monthlyDepreciation: annualDepreciation / 12,
        totalDepreciation: cost - salvageValue,
      };
    } else {
      const rate = 1 - Math.pow(salvageValue / cost, 1 / usefulLife);
      const annualDepreciation = cost * rate;
      return {
        annualDepreciation,
        monthlyDepreciation: annualDepreciation / 12,
        totalDepreciation: cost - salvageValue,
        rate,
      };
    }
  },
  getSchedule: (cost: number, salvageValue: number, usefulLife: number, method: "straight" | "reducing" = "straight") => {
    const schedule = [];
    let bookValue = cost;
    for (let year = 1; year <= usefulLife; year++) {
      let depreciation;
      if (method === "straight") {
        depreciation = (cost - salvageValue) / usefulLife;
      } else {
        const rate = 1 - Math.pow(salvageValue / cost, 1 / usefulLife);
        depreciation = bookValue * rate;
      }
      bookValue -= depreciation;
      schedule.push({ year, depreciation, bookValue: Math.max(bookValue, salvageValue) });
    }
    return schedule;
  },
};
