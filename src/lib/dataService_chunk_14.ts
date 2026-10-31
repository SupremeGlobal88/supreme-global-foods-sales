// =============================================================================
// DISCIPLINARY SERVICE
// =============================================================================

export const disciplinaryService = {
  list: () => {
    const comp = getCurrentCompany();
    return disciplinaryRecords.filter((d) => d.company === comp);
  },
  getById: (id: number) => {
    return disciplinaryRecords.find((d) => d.id === id);
  },
  getByEmployee: (employeeId: number) => {
    return disciplinaryRecords.filter((d) => d.employeeId === employeeId);
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
    disciplinaryRecords.push(newItem);
    saveItem("sgf_disciplinaryRecords", disciplinaryRecords);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = disciplinaryRecords.findIndex((d) => d.id === id);
    if (idx >= 0) {
      disciplinaryRecords[idx] = { ...disciplinaryRecords[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_disciplinaryRecords", disciplinaryRecords);
    }
    return disciplinaryRecords[idx];
  },
  delete: (id: number) => {
    const idx = disciplinaryRecords.findIndex((d) => d.id === id);
    if (idx >= 0) {
      disciplinaryRecords.splice(idx, 1);
      saveItem("sgf_disciplinaryRecords", disciplinaryRecords);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// GRIEVANCE SERVICE
// =============================================================================

export const grievanceService = {
  list: () => {
    const comp = getCurrentCompany();
    return grievances.filter((g) => g.company === comp);
  },
  getById: (id: number) => {
    return grievances.find((g) => g.id === id);
  },
  getByEmployee: (employeeId: number) => {
    return grievances.filter((g) => g.employeeId === employeeId);
  },
  getByStatus: (status: string) => {
    const comp = getCurrentCompany();
    return grievances.filter((g) => g.company === comp && g.status === status);
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
    grievances.push(newItem);
    saveItem("sgf_grievances", grievances);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = grievances.findIndex((g) => g.id === id);
    if (idx >= 0) {
      grievances[idx] = { ...grievances[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_grievances", grievances);
    }
    return grievances[idx];
  },
  delete: (id: number) => {
    const idx = grievances.findIndex((g) => g.id === id);
    if (idx >= 0) {
      grievances.splice(idx, 1);
      saveItem("sgf_grievances", grievances);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// HEALTH AND SAFETY SERVICE
// =============================================================================

export const healthSafetyService = {
  list: () => {
    const comp = getCurrentCompany();
    return healthSafetyRecords.filter((h) => h.company === comp);
  },
  getById: (id: number) => {
    return healthSafetyRecords.find((h) => h.id === id);
  },
  getByType: (type: string) => {
    const comp = getCurrentCompany();
    return healthSafetyRecords.filter((h) => h.company === comp && h.type === type);
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
    healthSafetyRecords.push(newItem);
    saveItem("sgf_healthSafetyRecords", healthSafetyRecords);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = healthSafetyRecords.findIndex((h) => h.id === id);
    if (idx >= 0) {
      healthSafetyRecords[idx] = { ...healthSafetyRecords[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_healthSafetyRecords", healthSafetyRecords);
    }
    return healthSafetyRecords[idx];
  },
  delete: (id: number) => {
    const idx = healthSafetyRecords.findIndex((h) => h.id === id);
    if (idx >= 0) {
      healthSafetyRecords.splice(idx, 1);
      saveItem("sgf_healthSafetyRecords", healthSafetyRecords);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// INCIDENT SERVICE
// =============================================================================

export const incidentService = {
  list: () => {
    const comp = getCurrentCompany();
    return incidents.filter((i) => i.company === comp);
  },
  getById: (id: number) => {
    return incidents.find((i) => i.id === id);
  },
  getByType: (type: string) => {
    const comp = getCurrentCompany();
    return incidents.filter((i) => i.company === comp && i.type === type);
  },
  getByStatus: (status: string) => {
    const comp = getCurrentCompany();
    return incidents.filter((i) => i.company === comp && i.status === status);
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
    incidents.push(newItem);
    saveItem("sgf_incidents", incidents);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = incidents.findIndex((i) => i.id === id);
    if (idx >= 0) {
      incidents[idx] = { ...incidents[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_incidents", incidents);
    }
    return incidents[idx];
  },
  delete: (id: number) => {
    const idx = incidents.findIndex((i) => i.id === id);
    if (idx >= 0) {
      incidents.splice(idx, 1);
      saveItem("sgf_incidents", incidents);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// RISK REGISTER SERVICE
// =============================================================================

export const riskRegisterService = {
  list: () => {
    const comp = getCurrentCompany();
    return riskRegisters.filter((r) => r.company === comp);
  },
  getById: (id: number) => {
    return riskRegisters.find((r) => r.id === id);
  },
  getByCategory: (category: string) => {
    const comp = getCurrentCompany();
    return riskRegisters.filter((r) => r.company === comp && r.category === category);
  },
  getByStatus: (status: string) => {
    const comp = getCurrentCompany();
    return riskRegisters.filter((r) => r.company === comp && r.status === status);
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
    riskRegisters.push(newItem);
    saveItem("sgf_riskRegisters", riskRegisters);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = riskRegisters.findIndex((r) => r.id === id);
    if (idx >= 0) {
      riskRegisters[idx] = { ...riskRegisters[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_riskRegisters", riskRegisters);
    }
    return riskRegisters[idx];
  },
  delete: (id: number) => {
    const idx = riskRegisters.findIndex((r) => r.id === id);
    if (idx >= 0) {
      riskRegisters.splice(idx, 1);
      saveItem("sgf_riskRegisters", riskRegisters);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// EMERGENCY CONTACT SERVICE
// =============================================================================

export const emergencyContactService = {
  list: () => {
    const comp = getCurrentCompany();
    return emergencyContacts.filter((e) => e.company === comp);
  },
  getById: (id: number) => {
    return emergencyContacts.find((e) => e.id === id);
  },
  getByEmployee: (employeeId: number) => {
    return emergencyContacts.filter((e) => e.employeeId === employeeId);
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
    emergencyContacts.push(newItem);
    saveItem("sgf_emergencyContacts", emergencyContacts);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = emergencyContacts.findIndex((e) => e.id === id);
    if (idx >= 0) {
      emergencyContacts[idx] = { ...emergencyContacts[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_emergencyContacts", emergencyContacts);
    }
    return emergencyContacts[idx];
  },
  delete: (id: number) => {
    const idx = emergencyContacts.findIndex((e) => e.id === id);
    if (idx >= 0) {
      emergencyContacts.splice(idx, 1);
      saveItem("sgf_emergencyContacts", emergencyContacts);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// MEDICAL RECORD SERVICE
// =============================================================================

export const medicalRecordService = {
  list: () => {
    const comp = getCurrentCompany();
    return medicalRecords.filter((m) => m.company === comp);
  },
  getById: (id: number) => {
    return medicalRecords.find((m) => m.id === id);
  },
  getByEmployee: (employeeId: number) => {
    return medicalRecords.filter((m) => m.employeeId === employeeId);
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
    medicalRecords.push(newItem);
    saveItem("sgf_medicalRecords", medicalRecords);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = medicalRecords.findIndex((m) => m.id === id);
    if (idx >= 0) {
      medicalRecords[idx] = { ...medicalRecords[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_medicalRecords", medicalRecords);
    }
    return medicalRecords[idx];
  },
  delete: (id: number) => {
    const idx = medicalRecords.findIndex((m) => m.id === id);
    if (idx >= 0) {
      medicalRecords.splice(idx, 1);
      saveItem("sgf_medicalRecords", medicalRecords);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// FIRST AID SERVICE
// =============================================================================

export const firstAidService = {
  list: () => {
    const comp = getCurrentCompany();
    return firstAidRecords.filter((f) => f.company === comp);
  },
  getById: (id: number) => {
    return firstAidRecords.find((f) => f.id === id);
  },
  getByEmployee: (employeeId: number) => {
    return firstAidRecords.filter((f) => f.employeeId === employeeId);
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
    firstAidRecords.push(newItem);
    saveItem("sgf_firstAidRecords", firstAidRecords);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = firstAidRecords.findIndex((f) => f.id === id);
    if (idx >= 0) {
      firstAidRecords[idx] = { ...firstAidRecords[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_firstAidRecords", firstAidRecords);
    }
    return firstAidRecords[idx];
  },
  delete: (id: number) => {
    const idx = firstAidRecords.findIndex((f) => f.id === id);
    if (idx >= 0) {
      firstAidRecords.splice(idx, 1);
      saveItem("sgf_firstAidRecords", firstAidRecords);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// FIRE SAFETY SERVICE
// =============================================================================

export const fireSafetyService = {
  list: () => {
    const comp = getCurrentCompany();
    return fireSafetyRecords.filter((f) => f.company === comp);
  },
  getById: (id: number) => {
    return fireSafetyRecords.find((f) => f.id === id);
  },
  getDue: () => {
    const comp = getCurrentCompany();
    const now = new Date().toISOString();
    return fireSafetyRecords.filter((f) => f.company === comp && f.nextCheck && f.nextCheck <= now);
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
    fireSafetyRecords.push(newItem);
    saveItem("sgf_fireSafetyRecords", fireSafetyRecords);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = fireSafetyRecords.findIndex((f) => f.id === id);
    if (idx >= 0) {
      fireSafetyRecords[idx] = { ...fireSafetyRecords[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_fireSafetyRecords", fireSafetyRecords);
    }
    return fireSafetyRecords[idx];
  },
  delete: (id: number) => {
    const idx = fireSafetyRecords.findIndex((f) => f.id === id);
    if (idx >= 0) {
      fireSafetyRecords.splice(idx, 1);
      saveItem("sgf_fireSafetyRecords", fireSafetyRecords);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// EQUIPMENT SERVICE
// =============================================================================

export const equipmentService = {
  list: () => {
    const comp = getCurrentCompany();
    return equipmentRecords.filter((e) => e.company === comp);
  },
  getById: (id: number) => {
    return equipmentRecords.find((e) => e.id === id);
  },
  getByCode: (code: string) => {
    return equipmentRecords.find((e) => e.code === code);
  },
  getByCategory: (category: string) => {
    const comp = getCurrentCompany();
    return equipmentRecords.filter((e) => e.company === comp && e.category === category);
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
    equipmentRecords.push(newItem);
    saveItem("sgf_equipmentRecords", equipmentRecords);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = equipmentRecords.findIndex((e) => e.id === id);
    if (idx >= 0) {
      equipmentRecords[idx] = { ...equipmentRecords[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_equipmentRecords", equipmentRecords);
    }
    return equipmentRecords[idx];
  },
  delete: (id: number) => {
    const idx = equipmentRecords.findIndex((e) => e.id === id);
    if (idx >= 0) {
      equipmentRecords.splice(idx, 1);
      saveItem("sgf_equipmentRecords", equipmentRecords);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// VEHICLE SERVICE
// =============================================================================

export const vehicleService = {
  list: () => {
    const comp = getCurrentCompany();
    return vehicles.filter((v) => v.company === comp);
  },
  getById: (id: number) => {
    return vehicles.find((v) => v.id === id);
  },
  getByRegistration: (registration: string) => {
    return vehicles.find((v) => v.registration === registration);
  },
  getByStatus: (status: string) => {
    const comp = getCurrentCompany();
    return vehicles.filter((v) => v.company === comp && v.status === status);
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
    vehicles.push(newItem);
    saveItem("sgf_vehicles", vehicles);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = vehicles.findIndex((v) => v.id === id);
    if (idx >= 0) {
      vehicles[idx] = { ...vehicles[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_vehicles", vehicles);
    }
    return vehicles[idx];
  },
  delete: (id: number) => {
    const idx = vehicles.findIndex((v) => v.id === id);
    if (idx >= 0) {
      vehicles.splice(idx, 1);
      saveItem("sgf_vehicles", vehicles);
    }
    return { success: idx >= 0 };
  },
};
