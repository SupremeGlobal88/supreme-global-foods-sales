// =============================================================================
// SHIFT SERVICE
// =============================================================================

export const shiftService = {
  list: () => {
    const comp = getCurrentCompany();
    return shifts.filter((s) => s.company === comp);
  },
  getById: (id: number) => {
    return shifts.find((s) => s.id === id);
  },
  getByName: (name: string) => {
    const comp = getCurrentCompany();
    return shifts.find((s) => s.company === comp && s.name === name);
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
    shifts.push(newItem);
    saveItem("sgf_shifts", shifts);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = shifts.findIndex((s) => s.id === id);
    if (idx >= 0) {
      shifts[idx] = { ...shifts[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_shifts", shifts);
    }
    return shifts[idx];
  },
  delete: (id: number) => {
    const idx = shifts.findIndex((s) => s.id === id);
    if (idx >= 0) {
      shifts.splice(idx, 1);
      saveItem("sgf_shifts", shifts);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// ROSTER SERVICE
// =============================================================================

export const rosterService = {
  list: () => {
    const comp = getCurrentCompany();
    return rosters.filter((r) => r.company === comp);
  },
  getById: (id: number) => {
    return rosters.find((r) => r.id === id);
  },
  getByEmployee: (employeeId: number) => {
    return rosters.filter((r) => r.employeeId === employeeId);
  },
  getByDate: (date: string) => {
    const comp = getCurrentCompany();
    return rosters.filter((r) => r.company === comp && r.date === date);
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
    rosters.push(newItem);
    saveItem("sgf_rosters", rosters);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = rosters.findIndex((r) => r.id === id);
    if (idx >= 0) {
      rosters[idx] = { ...rosters[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_rosters", rosters);
    }
    return rosters[idx];
  },
  delete: (id: number) => {
    const idx = rosters.findIndex((r) => r.id === id);
    if (idx >= 0) {
      rosters.splice(idx, 1);
      saveItem("sgf_rosters", rosters);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// ATTENDANCE SERVICE
// =============================================================================

export const attendanceService = {
  list: () => {
    const comp = getCurrentCompany();
    return attendanceRecords.filter((a) => a.company === comp);
  },
  getById: (id: number) => {
    return attendanceRecords.find((a) => a.id === id);
  },
  getByEmployee: (employeeId: number) => {
    return attendanceRecords.filter((a) => a.employeeId === employeeId);
  },
  getByDate: (date: string) => {
    const comp = getCurrentCompany();
    return attendanceRecords.filter((a) => a.company === comp && a.date === date);
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
    attendanceRecords.push(newItem);
    saveItem("sgf_attendanceRecords", attendanceRecords);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = attendanceRecords.findIndex((a) => a.id === id);
    if (idx >= 0) {
      attendanceRecords[idx] = { ...attendanceRecords[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_attendanceRecords", attendanceRecords);
    }
    return attendanceRecords[idx];
  },
  delete: (id: number) => {
    const idx = attendanceRecords.findIndex((a) => a.id === id);
    if (idx >= 0) {
      attendanceRecords.splice(idx, 1);
      saveItem("sgf_attendanceRecords", attendanceRecords);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// OVERTIME SERVICE
// =============================================================================

export const overtimeService = {
  list: () => {
    const comp = getCurrentCompany();
    return overtimeRecords.filter((o) => o.company === comp);
  },
  getById: (id: number) => {
    return overtimeRecords.find((o) => o.id === id);
  },
  getByEmployee: (employeeId: number) => {
    return overtimeRecords.filter((o) => o.employeeId === employeeId);
  },
  getByDate: (date: string) => {
    const comp = getCurrentCompany();
    return overtimeRecords.filter((o) => o.company === comp && o.date === date);
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
    overtimeRecords.push(newItem);
    saveItem("sgf_overtimeRecords", overtimeRecords);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = overtimeRecords.findIndex((o) => o.id === id);
    if (idx >= 0) {
      overtimeRecords[idx] = { ...overtimeRecords[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_overtimeRecords", overtimeRecords);
    }
    return overtimeRecords[idx];
  },
  delete: (id: number) => {
    const idx = overtimeRecords.findIndex((o) => o.id === id);
    if (idx >= 0) {
      overtimeRecords.splice(idx, 1);
      saveItem("sgf_overtimeRecords", overtimeRecords);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// BENEFIT SERVICE
// =============================================================================

export const benefitService = {
  list: () => {
    const comp = getCurrentCompany();
    return benefits.filter((b) => b.company === comp);
  },
  getById: (id: number) => {
    return benefits.find((b) => b.id === id);
  },
  getByEmployee: (employeeId: number) => {
    return benefits.filter((b) => b.employeeId === employeeId);
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
    benefits.push(newItem);
    saveItem("sgf_benefits", benefits);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = benefits.findIndex((b) => b.id === id);
    if (idx >= 0) {
      benefits[idx] = { ...benefits[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_benefits", benefits);
    }
    return benefits[idx];
  },
  delete: (id: number) => {
    const idx = benefits.findIndex((b) => b.id === id);
    if (idx >= 0) {
      benefits.splice(idx, 1);
      saveItem("sgf_benefits", benefits);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// DEDUCTION SERVICE
// =============================================================================

export const deductionService = {
  list: () => {
    const comp = getCurrentCompany();
    return deductions.filter((d) => d.company === comp);
  },
  getById: (id: number) => {
    return deductions.find((d) => d.id === id);
  },
  getByEmployee: (employeeId: number) => {
    return deductions.filter((d) => d.employeeId === employeeId);
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
    deductions.push(newItem);
    saveItem("sgf_deductions", deductions);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = deductions.findIndex((d) => d.id === id);
    if (idx >= 0) {
      deductions[idx] = { ...deductions[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_deductions", deductions);
    }
    return deductions[idx];
  },
  delete: (id: number) => {
    const idx = deductions.findIndex((d) => d.id === id);
    if (idx >= 0) {
      deductions.splice(idx, 1);
      saveItem("sgf_deductions", deductions);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// EXPENSE CLAIM SERVICE
// =============================================================================

export const expenseClaimService = {
  list: () => {
    const comp = getCurrentCompany();
    return expenseClaims.filter((e) => e.company === comp);
  },
  getById: (id: number) => {
    return expenseClaims.find((e) => e.id === id);
  },
  getByEmployee: (employeeId: number) => {
    return expenseClaims.filter((e) => e.employeeId === employeeId);
  },
  getByStatus: (status: string) => {
    const comp = getCurrentCompany();
    return expenseClaims.filter((e) => e.company === comp && e.status === status);
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
    expenseClaims.push(newItem);
    saveItem("sgf_expenseClaims", expenseClaims);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = expenseClaims.findIndex((e) => e.id === id);
    if (idx >= 0) {
      expenseClaims[idx] = { ...expenseClaims[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_expenseClaims", expenseClaims);
    }
    return expenseClaims[idx];
  },
  delete: (id: number) => {
    const idx = expenseClaims.findIndex((e) => e.id === id);
    if (idx >= 0) {
      expenseClaims.splice(idx, 1);
      saveItem("sgf_expenseClaims", expenseClaims);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// ASSET SERVICE
// =============================================================================

export const assetService = {
  list: () => {
    const comp = getCurrentCompany();
    return assets.filter((a) => a.company === comp);
  },
  getById: (id: number) => {
    return assets.find((a) => a.id === id);
  },
  getByCode: (code: string) => {
    return assets.find((a) => a.code === code);
  },
  getByCategory: (category: string) => {
    const comp = getCurrentCompany();
    return assets.filter((a) => a.company === comp && a.category === category);
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
    assets.push(newItem);
    saveItem("sgf_assets", assets);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = assets.findIndex((a) => a.id === id);
    if (idx >= 0) {
      assets[idx] = { ...assets[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_assets", assets);
    }
    return assets[idx];
  },
  delete: (id: number) => {
    const idx = assets.findIndex((a) => a.id === id);
    if (idx >= 0) {
      assets.splice(idx, 1);
      saveItem("sgf_assets", assets);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// DEPRECIATION SERVICE
// =============================================================================

export const depreciationService = {
  list: () => {
    const comp = getCurrentCompany();
    return depreciationRecords.filter((d) => d.company === comp);
  },
  getById: (id: number) => {
    return depreciationRecords.find((d) => d.id === id);
  },
  getByAsset: (assetId: number) => {
    return depreciationRecords.filter((d) => d.assetId === assetId);
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
    depreciationRecords.push(newItem);
    saveItem("sgf_depreciationRecords", depreciationRecords);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = depreciationRecords.findIndex((d) => d.id === id);
    if (idx >= 0) {
      depreciationRecords[idx] = { ...depreciationRecords[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_depreciationRecords", depreciationRecords);
    }
    return depreciationRecords[idx];
  },
  delete: (id: number) => {
    const idx = depreciationRecords.findIndex((d) => d.id === id);
    if (idx >= 0) {
      depreciationRecords.splice(idx, 1);
      saveItem("sgf_depreciationRecords", depreciationRecords);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// INSURANCE SERVICE
// =============================================================================

export const insuranceService = {
  list: () => {
    const comp = getCurrentCompany();
    return insuranceRecords.filter((i) => i.company === comp);
  },
  getById: (id: number) => {
    return insuranceRecords.find((i) => i.id === id);
  },
  getByAsset: (assetId: number) => {
    return insuranceRecords.filter((i) => i.assetId === assetId);
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
    insuranceRecords.push(newItem);
    saveItem("sgf_insuranceRecords", insuranceRecords);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = insuranceRecords.findIndex((i) => i.id === id);
    if (idx >= 0) {
      insuranceRecords[idx] = { ...insuranceRecords[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_insuranceRecords", insuranceRecords);
    }
    return insuranceRecords[idx];
  },
  delete: (id: number) => {
    const idx = insuranceRecords.findIndex((i) => i.id === id);
    if (idx >= 0) {
      insuranceRecords.splice(idx, 1);
      saveItem("sgf_insuranceRecords", insuranceRecords);
    }
    return { success: idx >= 0 };
  },
};
