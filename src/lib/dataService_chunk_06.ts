      errors.push(`Failed to process ${alloc.invoiceNumber}: ${e.message}`);
    }
  }
  if (processed > 0) saveItem("sgf_invoices", invoices);
  return { processed, errors };
}

/** Auto-link Sage invoices to customers on every app startup.
 *  Silent version — no Firebase push, just local fix.
 *  This ensures ALL devices have matched Sage invoices.
 *  Handles both old CUST0001 format and new 10001 format. */
function autoLinkSageInvoicesSilent() {
  let matched = 0;
  for (const inv of invoices) {
    if (!inv.customerId || inv.customerId <= 0) {
      const customer = customers.find(
        (c) =>
          c.code &&
          inv.customerCode &&
          c.code.toUpperCase() === inv.customerCode.toUpperCase()
      );
      if (customer) {
        inv.customerId = customer.id;
        inv.customerName = customer.name;
        matched++;
      }
    }
  }
  if (matched > 0) {
    saveItem("sgf_invoices", invoices);
  }
}

// Run auto-link on startup
autoLinkSageInvoicesSilent();

// =============================================================================
// CERTIFICATE OF COMPLIANCE SERVICE
// =============================================================================

export const certificateOfComplianceService = {
  list: () => {
    const comp = getCurrentCompany();
    return certificatesOfCompliance.filter((c) => c.company === comp);
  },
  getById: (id: number) => {
    return certificatesOfCompliance.find((c) => c.id === id);
  },
  create: (data: any) => {
    const comp = getCurrentCompany();
    let company = data.company;
    if (!company && data.customerId) {
      const customer = customers.find((c) => c.id === data.customerId);
      if (customer?.company) company = customer.company;
    }
    if (!company && data.orderId) {
      const order = orders.find((o) => o.id === data.orderId);
      if (order?.company) company = order.company;
    }
    if (!company && data.purchaseOrderId) {
      const po = purchaseOrders.find((p) => p.id === data.purchaseOrderId);
      if (po?.company) company = po.company;
    }
    const newItem = {
      ...data,
      company: company || comp,
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
    const idx = certificatesOfCompliance.findIndex((c) => c.id === id);
    if (idx >= 0) {
      certificatesOfCompliance[idx] = {
        ...certificatesOfCompliance[idx],
        ...data,
        updatedAt: new Date().toISOString(),
      };
      saveItem("sgf_certificatesOfCompliance", certificatesOfCompliance);
      saveItem("sgf_cocs", certificatesOfCompliance);
    }
    return certificatesOfCompliance[idx];
  },
  delete: (id: number) => {
    const idx = certificatesOfCompliance.findIndex((c) => c.id === id);
    if (idx >= 0) {
      certificatesOfCompliance.splice(idx, 1);
      saveItem("sgf_certificatesOfCompliance", certificatesOfCompliance);
      saveItem("sgf_cocs", certificatesOfCompliance);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// TRACEABILITY SERVICE
// =============================================================================

export const traceabilityService = {
  list: () => {
    const comp = getCurrentCompany();
    return traceabilityRecords.filter((t) => t.company === comp);
  },
  getById: (id: number) => {
    return traceabilityRecords.find((t) => t.id === id);
  },
  getByBatch: (batchNumber: string) => {
    return traceabilityRecords.filter((t) => t.batchNumber === batchNumber);
  },
  getByProduct: (productId: number) => {
    return traceabilityRecords.filter((t) => t.productId === productId);
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
    traceabilityRecords.push(newItem);
    saveItem("sgf_traceabilityRecords", traceabilityRecords);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = traceabilityRecords.findIndex((t) => t.id === id);
    if (idx >= 0) {
      traceabilityRecords[idx] = {
        ...traceabilityRecords[idx],
        ...data,
        updatedAt: new Date().toISOString(),
      };
      saveItem("sgf_traceabilityRecords", traceabilityRecords);
    }
    return traceabilityRecords[idx];
  },
  delete: (id: number) => {
    const idx = traceabilityRecords.findIndex((t) => t.id === id);
    if (idx >= 0) {
      traceabilityRecords.splice(idx, 1);
      saveItem("sgf_traceabilityRecords", traceabilityRecords);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// CALIBRATION SERVICE
// =============================================================================

export const calibrationService = {
  list: () => {
    const comp = getCurrentCompany();
    return calibrations.filter((c) => c.company === comp);
  },
  getById: (id: number) => {
    return calibrations.find((c) => c.id === id);
  },
  getDue: () => {
    const comp = getCurrentCompany();
    const now = new Date().toISOString();
    return calibrations.filter((c) => c.company === comp && c.nextDueDate && c.nextDueDate <= now);
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
    calibrations.push(newItem);
    saveItem("sgf_calibrations", calibrations);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = calibrations.findIndex((c) => c.id === id);
    if (idx >= 0) {
      calibrations[idx] = { ...calibrations[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_calibrations", calibrations);
    }
    return calibrations[idx];
  },
  delete: (id: number) => {
    const idx = calibrations.findIndex((c) => c.id === id);
    if (idx >= 0) {
      calibrations.splice(idx, 1);
      saveItem("sgf_calibrations", calibrations);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// MAINTENANCE SERVICE
// =============================================================================

export const maintenanceService = {
  list: () => {
    const comp = getCurrentCompany();
    return maintenanceRecords.filter((m) => m.company === comp);
  },
  getById: (id: number) => {
    return maintenanceRecords.find((m) => m.id === id);
  },
  getDue: () => {
    const comp = getCurrentCompany();
    const now = new Date().toISOString();
    return maintenanceRecords.filter((m) => m.company === comp && m.nextDueDate && m.nextDueDate <= now);
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
    maintenanceRecords.push(newItem);
    saveItem("sgf_maintenanceRecords", maintenanceRecords);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = maintenanceRecords.findIndex((m) => m.id === id);
    if (idx >= 0) {
      maintenanceRecords[idx] = { ...maintenanceRecords[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_maintenanceRecords", maintenanceRecords);
    }
    return maintenanceRecords[idx];
  },
  delete: (id: number) => {
    const idx = maintenanceRecords.findIndex((m) => m.id === id);
    if (idx >= 0) {
      maintenanceRecords.splice(idx, 1);
      saveItem("sgf_maintenanceRecords", maintenanceRecords);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// NON-CONFORMANCE SERVICE
// =============================================================================

export const nonConformanceService = {
  list: () => {
    const comp = getCurrentCompany();
    return nonConformances.filter((n) => n.company === comp);
  },
  getById: (id: number) => {
    return nonConformances.find((n) => n.id === id);
  },
  getByStatus: (status: string) => {
    const comp = getCurrentCompany();
    return nonConformances.filter((n) => n.company === comp && n.status === status);
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
    nonConformances.push(newItem);
    saveItem("sgf_nonConformances", nonConformances);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = nonConformances.findIndex((n) => n.id === id);
    if (idx >= 0) {
      nonConformances[idx] = { ...nonConformances[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_nonConformances", nonConformances);
    }
    return nonConformances[idx];
  },
  delete: (id: number) => {
    const idx = nonConformances.findIndex((n) => n.id === id);
    if (idx >= 0) {
      nonConformances.splice(idx, 1);
      saveItem("sgf_nonConformances", nonConformances);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// CORRECTIVE ACTION SERVICE
// =============================================================================

export const correctiveActionService = {
  list: () => {
    const comp = getCurrentCompany();
    return correctiveActions.filter((c) => c.company === comp);
  },
  getById: (id: number) => {
    return correctiveActions.find((c) => c.id === id);
  },
  getByNCR: (ncrId: number) => {
    return correctiveActions.filter((c) => c.ncrId === ncrId);
  },
  getByStatus: (status: string) => {
    const comp = getCurrentCompany();
    return correctiveActions.filter((c) => c.company === comp && c.status === status);
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
    correctiveActions.push(newItem);
    saveItem("sgf_correctiveActions", correctiveActions);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = correctiveActions.findIndex((c) => c.id === id);
    if (idx >= 0) {
      correctiveActions[idx] = { ...correctiveActions[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_correctiveActions", correctiveActions);
    }
    return correctiveActions[idx];
  },
  delete: (id: number) => {
    const idx = correctiveActions.findIndex((c) => c.id === id);
    if (idx >= 0) {
      correctiveActions.splice(idx, 1);
      saveItem("sgf_correctiveActions", correctiveActions);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// AUDIT SCHEDULE SERVICE
// =============================================================================

export const auditScheduleService = {
  list: () => {
    const comp = getCurrentCompany();
    return auditSchedules.filter((a) => a.company === comp);
  },
  getById: (id: number) => {
    return auditSchedules.find((a) => a.id === id);
  },
  getDue: () => {
    const comp = getCurrentCompany();
    const now = new Date().toISOString();
    return auditSchedules.filter((a) => a.company === comp && a.dueDate && a.dueDate <= now);
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
    auditSchedules.push(newItem);
    saveItem("sgf_auditSchedules", auditSchedules);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = auditSchedules.findIndex((a) => a.id === id);
    if (idx >= 0) {
      auditSchedules[idx] = { ...auditSchedules[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_auditSchedules", auditSchedules);
    }
    return auditSchedules[idx];
  },
  delete: (id: number) => {
    const idx = auditSchedules.findIndex((a) => a.id === id);
    if (idx >= 0) {
      auditSchedules.splice(idx, 1);
      saveItem("sgf_auditSchedules", auditSchedules);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// DOCUMENT CONTROL SERVICE
// =============================================================================

export const documentControlService = {
  list: () => {
    const comp = getCurrentCompany();
    return documents.filter((d) => d.company === comp);
  },
  getById: (id: number) => {
    return documents.find((d) => d.id === id);
  },
  getByType: (type: string) => {
    const comp = getCurrentCompany();
    return documents.filter((d) => d.company === comp && d.type === type);
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
    documents.push(newItem);
    saveItem("sgf_documents", documents);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = documents.findIndex((d) => d.id === id);
    if (idx >= 0) {
      documents[idx] = { ...documents[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_documents", documents);
    }
    return documents[idx];
  },
  delete: (id: number) => {
    const idx = documents.findIndex((d) => d.id === id);
    if (idx >= 0) {
      documents.splice(idx, 1);
      saveItem("sgf_documents", documents);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// TRAINING RECORD SERVICE
// =============================================================================

export const trainingRecordService = {
  list: () => {
    const comp = getCurrentCompany();
    return trainingRecords.filter((t) => t.company === comp);
  },
  getById: (id: number) => {
    return trainingRecords.find((t) => t.id === id);
  },
  getByEmployee: (employeeId: number) => {
    return trainingRecords.filter((t) => t.employeeId === employeeId);
  },
  getDue: () => {
    const comp = getCurrentCompany();
    const now = new Date().toISOString();
    return trainingRecords.filter((t) => t.company === comp && t.expiryDate && t.expiryDate <= now);
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
    trainingRecords.push(newItem);
    saveItem("sgf_trainingRecords", trainingRecords);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = trainingRecords.findIndex((t) => t.id === id);
    if (idx >= 0) {
      trainingRecords[idx] = { ...trainingRecords[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_trainingRecords", trainingRecords);
    }
    return trainingRecords[idx];
  },
  delete: (id: number) => {
    const idx = trainingRecords.findIndex((t) => t.id === id);
    if (idx >= 0) {
      trainingRecords.splice(idx, 1);
      saveItem("sgf_trainingRecords", trainingRecords);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// SUPPLIER AUDIT SERVICE
// =============================================================================

export const supplierAuditService = {
  list: () => {
    const comp = getCurrentCompany();
    return supplierAudits.filter((s) => s.company === comp);
  },
  getById: (id: number) => {
    return supplierAudits.find((s) => s.id === id);
  },
  getBySupplier: (supplierId: number) => {
    return supplierAudits.filter((s) => s.supplierId === supplierId);
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
    supplierAudits.push(newItem);
    saveItem("sgf_supplierAudits", supplierAudits);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = supplierAudits.findIndex((s) => s.id === id);
    if (idx >= 0) {
      supplierAudits[idx] = { ...supplierAudits[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_supplierAudits", supplierAudits);
    }
    return supplierAudits[idx];
  },
  delete: (id: number) => {
    const idx = supplierAudits.findIndex((s) => s.id === id);
    if (idx >= 0) {
      supplierAudits.splice(idx, 1);
      saveItem("sgf_supplierAudits", supplierAudits);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// CUSTOMER COMPLAINT SERVICE
// =============================================================================

export const customerComplaintService = {
  list: () => {
    const comp = getCurrentCompany();
    return customerComplaints.filter((c) => c.company === comp);
  },
  getById: (id: number) => {
    return customerComplaints.find((c) => c.id === id);
  },
  getByCustomer: (customerId: number) => {
    return customerComplaints.filter((c) => c.customerId === customerId);
  },
  getByStatus: (status: string) => {
    const comp = getCurrentCompany();
    return customerComplaints.filter((c) => c.company === comp && c.status === status);
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
    customerComplaints.push(newItem);
    saveItem("sgf_customerComplaints", customerComplaints);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = customerComplaints.findIndex((c) => c.id === id);
    if (idx >= 0) {
      customerComplaints[idx] = { ...customerComplaints[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_customerComplaints", customerComplaints);
    }
    return customerComplaints[idx];
  },
  delete: (id: number) => {
    const idx = customerComplaints.findIndex((c) => c.id === id);
    if (idx >= 0) {
      customerComplaints.splice(idx, 1);
      saveItem("sgf_customerComplaints", customerComplaints);
    }
    return { success: idx >= 0 };
  },
};
