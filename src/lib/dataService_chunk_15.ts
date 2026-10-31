// =============================================================================
// FUEL LOG SERVICE
// =============================================================================

export const fuelLogService = {
  list: () => {
    const comp = getCurrentCompany();
    return fuelLogs.filter((f) => f.company === comp);
  },
  getById: (id: number) => {
    return fuelLogs.find((f) => f.id === id);
  },
  getByVehicle: (vehicleId: number) => {
    return fuelLogs.filter((f) => f.vehicleId === vehicleId);
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
    fuelLogs.push(newItem);
    saveItem("sgf_fuelLogs", fuelLogs);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = fuelLogs.findIndex((f) => f.id === id);
    if (idx >= 0) {
      fuelLogs[idx] = { ...fuelLogs[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_fuelLogs", fuelLogs);
    }
    return fuelLogs[idx];
  },
  delete: (id: number) => {
    const idx = fuelLogs.findIndex((f) => f.id === id);
    if (idx >= 0) {
      fuelLogs.splice(idx, 1);
      saveItem("sgf_fuelLogs", fuelLogs);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// SERVICE LOG SERVICE
// =============================================================================

export const serviceLogService = {
  list: () => {
    const comp = getCurrentCompany();
    return serviceLogs.filter((s) => s.company === comp);
  },
  getById: (id: number) => {
    return serviceLogs.find((s) => s.id === id);
  },
  getByVehicle: (vehicleId: number) => {
    return serviceLogs.filter((s) => s.vehicleId === vehicleId);
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
    serviceLogs.push(newItem);
    saveItem("sgf_serviceLogs", serviceLogs);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = serviceLogs.findIndex((s) => s.id === id);
    if (idx >= 0) {
      serviceLogs[idx] = { ...serviceLogs[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_serviceLogs", serviceLogs);
    }
    return serviceLogs[idx];
  },
  delete: (id: number) => {
    const idx = serviceLogs.findIndex((s) => s.id === id);
    if (idx >= 0) {
      serviceLogs.splice(idx, 1);
      saveItem("sgf_serviceLogs", serviceLogs);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// LICENSE SERVICE
// =============================================================================

export const licenseService = {
  list: () => {
    const comp = getCurrentCompany();
    return licenses.filter((l) => l.company === comp);
  },
  getById: (id: number) => {
    return licenses.find((l) => l.id === id);
  },
  getByEmployee: (employeeId: number) => {
    return licenses.filter((l) => l.employeeId === employeeId);
  },
  getExpiring: () => {
    const comp = getCurrentCompany();
    const thirtyDays = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    return licenses.filter((l) => l.company === comp && l.expiryDate && l.expiryDate <= thirtyDays);
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
    licenses.push(newItem);
    saveItem("sgf_licenses", licenses);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = licenses.findIndex((l) => l.id === id);
    if (idx >= 0) {
      licenses[idx] = { ...licenses[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_licenses", licenses);
    }
    return licenses[idx];
  },
  delete: (id: number) => {
    const idx = licenses.findIndex((l) => l.id === id);
    if (idx >= 0) {
      licenses.splice(idx, 1);
      saveItem("sgf_licenses", licenses);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// PERMIT SERVICE
// =============================================================================

export const permitService = {
  list: () => {
    const comp = getCurrentCompany();
    return permits.filter((p) => p.company === comp);
  },
  getById: (id: number) => {
    return permits.find((p) => p.id === id);
  },
  getByType: (type: string) => {
    const comp = getCurrentCompany();
    return permits.filter((p) => p.company === comp && p.type === type);
  },
  getExpiring: () => {
    const comp = getCurrentCompany();
    const thirtyDays = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    return permits.filter((p) => p.company === comp && p.expiryDate && p.expiryDate <= thirtyDays);
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
    permits.push(newItem);
    saveItem("sgf_permits", permits);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = permits.findIndex((p) => p.id === id);
    if (idx >= 0) {
      permits[idx] = { ...permits[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_permits", permits);
    }
    return permits[idx];
  },
  delete: (id: number) => {
    const idx = permits.findIndex((p) => p.id === id);
    if (idx >= 0) {
      permits.splice(idx, 1);
      saveItem("sgf_permits", permits);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// INSPECTION SERVICE
// =============================================================================

export const inspectionService = {
  list: () => {
    const comp = getCurrentCompany();
    return inspections.filter((i) => i.company === comp);
  },
  getById: (id: number) => {
    return inspections.find((i) => i.id === id);
  },
  getByType: (type: string) => {
    const comp = getCurrentCompany();
    return inspections.filter((i) => i.company === comp && i.type === type);
  },
  getByStatus: (status: string) => {
    const comp = getCurrentCompany();
    return inspections.filter((i) => i.company === comp && i.status === status);
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
    inspections.push(newItem);
    saveItem("sgf_inspections", inspections);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = inspections.findIndex((i) => i.id === id);
    if (idx >= 0) {
      inspections[idx] = { ...inspections[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_inspections", inspections);
    }
    return inspections[idx];
  },
  delete: (id: number) => {
    const idx = inspections.findIndex((i) => i.id === id);
    if (idx >= 0) {
      inspections.splice(idx, 1);
      saveItem("sgf_inspections", inspections);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// CHECKLIST SERVICE
// =============================================================================

export const checklistService = {
  list: () => {
    const comp = getCurrentCompany();
    return checklists.filter((c) => c.company === comp);
  },
  getById: (id: number) => {
    return checklists.find((c) => c.id === id);
  },
  getByType: (type: string) => {
    const comp = getCurrentCompany();
    return checklists.filter((c) => c.company === comp && c.type === type);
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
    checklists.push(newItem);
    saveItem("sgf_checklists", checklists);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = checklists.findIndex((c) => c.id === id);
    if (idx >= 0) {
      checklists[idx] = { ...checklists[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_checklists", checklists);
    }
    return checklists[idx];
  },
  delete: (id: number) => {
    const idx = checklists.findIndex((c) => c.id === id);
    if (idx >= 0) {
      checklists.splice(idx, 1);
      saveItem("sgf_checklists", checklists);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// FORM BUILDER SERVICE
// =============================================================================

export const formBuilderService = {
  list: () => {
    const comp = getCurrentCompany();
    return forms.filter((f) => f.company === comp);
  },
  getById: (id: number) => {
    return forms.find((f) => f.id === id);
  },
  getByType: (type: string) => {
    const comp = getCurrentCompany();
    return forms.filter((f) => f.company === comp && f.type === type);
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
    forms.push(newItem);
    saveItem("sgf_forms", forms);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = forms.findIndex((f) => f.id === id);
    if (idx >= 0) {
      forms[idx] = { ...forms[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_forms", forms);
    }
    return forms[idx];
  },
  delete: (id: number) => {
    const idx = forms.findIndex((f) => f.id === id);
    if (idx >= 0) {
      forms.splice(idx, 1);
      saveItem("sgf_forms", forms);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// FORM SUBMISSION SERVICE
// =============================================================================

export const formSubmissionService = {
  list: () => {
    const comp = getCurrentCompany();
    return formSubmissions.filter((f) => f.company === comp);
  },
  getById: (id: number) => {
    return formSubmissions.find((f) => f.id === id);
  },
  getByForm: (formId: number) => {
    return formSubmissions.filter((f) => f.formId === formId);
  },
  getByEmployee: (employeeId: number) => {
    return formSubmissions.filter((f) => f.employeeId === employeeId);
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
    formSubmissions.push(newItem);
    saveItem("sgf_formSubmissions", formSubmissions);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = formSubmissions.findIndex((f) => f.id === id);
    if (idx >= 0) {
      formSubmissions[idx] = { ...formSubmissions[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_formSubmissions", formSubmissions);
    }
    return formSubmissions[idx];
  },
  delete: (id: number) => {
    const idx = formSubmissions.findIndex((f) => f.id === id);
    if (idx >= 0) {
      formSubmissions.splice(idx, 1);
      saveItem("sgf_formSubmissions", formSubmissions);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// SIGN-OFF SERVICE
// =============================================================================

export const signOffService = {
  list: () => {
    const comp = getCurrentCompany();
    return signOffs.filter((s) => s.company === comp);
  },
  getById: (id: number) => {
    return signOffs.find((s) => s.id === id);
  },
  getByDocument: (documentId: number) => {
    return signOffs.filter((s) => s.documentId === documentId);
  },
  getByEmployee: (employeeId: number) => {
    return signOffs.filter((s) => s.employeeId === employeeId);
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
    signOffs.push(newItem);
    saveItem("sgf_signOffs", signOffs);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = signOffs.findIndex((s) => s.id === id);
    if (idx >= 0) {
      signOffs[idx] = { ...signOffs[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_signOffs", signOffs);
    }
    return signOffs[idx];
  },
  delete: (id: number) => {
    const idx = signOffs.findIndex((s) => s.id === id);
    if (idx >= 0) {
      signOffs.splice(idx, 1);
      saveItem("sgf_signOffs", signOffs);
    }
    return { success: idx >= 0 };
  },
};
