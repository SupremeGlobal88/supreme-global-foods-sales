// =============================================================================
// CORPORATE MODULE SERVICES
// =============================================================================

export const corporateCustomerService = {
  list: () => corporateCustomers,
  getById: (id: number) => corporateCustomers.find((c) => c.id === id),
  getByName: (name: string) => corporateCustomers.find((c) => c.name.toLowerCase() === name.toLowerCase()),
  create: (data: any) => {
    const newCustomer = {
      id: Date.now() + Math.random(),
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isActive: data.isActive !== false,
    };
    corporateCustomers.push(newCustomer);
    saveItem("sgf_corporateCustomers", corporateCustomers);
    logAudit("create", "corporateCustomer", newCustomer.id, data);
    return newCustomer;
  },
  update: (id: number, data: any) => {
    const index = corporateCustomers.findIndex((c) => c.id === id);
    if (index === -1) return null;
    corporateCustomers[index] = { ...corporateCustomers[index], ...data, updatedAt: new Date().toISOString() };
    saveItem("sgf_corporateCustomers", corporateCustomers);
    logAudit("update", "corporateCustomer", id, data);
    return corporateCustomers[index];
  },
  delete: (id: number) => {
    const index = corporateCustomers.findIndex((c) => c.id === id);
    if (index === -1) return { success: false, error: "Corporate customer not found" };
    corporateCustomers.splice(index, 1);
    saveItem("sgf_corporateCustomers", corporateCustomers);
    logAudit("delete", "corporateCustomer", id, {});
    return { success: true };
  },
};

export const purchaseOrderService = {
  list: () => purchaseOrders,
  getById: (id: number) => purchaseOrders.find((p) => p.id === id),
  getByCustomer: (customerId: number) => purchaseOrders.filter((p) => p.customerId === customerId),
  getByStatus: (status: string) => purchaseOrders.filter((p) => p.status === status),
  create: (data: any) => {
    const newPO = {
      id: Date.now() + Math.random(),
      ...data,
      status: data.status || "draft",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    purchaseOrders.push(newPO);
    saveItem("sgf_purchaseOrders", purchaseOrders);
    logAudit("create", "purchaseOrder", newPO.id, data);
    return newPO;
  },
  update: (id: number, data: any) => {
    const index = purchaseOrders.findIndex((p) => p.id === id);
    if (index === -1) return null;
    purchaseOrders[index] = { ...purchaseOrders[index], ...data, updatedAt: new Date().toISOString() };
    saveItem("sgf_purchaseOrders", purchaseOrders);
    logAudit("update", "purchaseOrder", id, data);
    return purchaseOrders[index];
  },
  delete: (id: number) => {
    const index = purchaseOrders.findIndex((p) => p.id === id);
    if (index === -1) return { success: false, error: "Purchase order not found" };
    purchaseOrders.splice(index, 1);
    saveItem("sgf_purchaseOrders", purchaseOrders);
    logAudit("delete", "purchaseOrder", id, {});
    return { success: true };
  },
};

export const barrelService = {
  list: () => barrels,
  getById: (id: number) => barrels.find((b) => b.id === id),
  getByCustomer: (customerId: number) => barrels.filter((b) => b.customerId === customerId),
  getByStatus: (status: string) => barrels.filter((b) => b.status === status),
  create: (data: any) => {
    const newBarrel = {
      id: Date.now() + Math.random(),
      ...data,
      status: data.status || "available",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    barrels.push(newBarrel);
    saveItem("sgf_barrels", barrels);
    logAudit("create", "barrel", newBarrel.id, data);
    return newBarrel;
  },
  update: (id: number, data: any) => {
    const index = barrels.findIndex((b) => b.id === id);
    if (index === -1) return null;
    barrels[index] = { ...barrels[index], ...data, updatedAt: new Date().toISOString() };
    saveItem("sgf_barrels", barrels);
    logAudit("update", "barrel", id, data);
    return barrels[index];
  },
  delete: (id: number) => {
    const index = barrels.findIndex((b) => b.id === id);
    if (index === -1) return { success: false, error: "Barrel not found" };
    barrels.splice(index, 1);
    saveItem("sgf_barrels", barrels);
    logAudit("delete", "barrel", id, {});
    return { success: true };
  },
};

export const certificateService = {
  list: () => certificatesOfCompliance,
  getById: (id: number) => certificatesOfCompliance.find((c) => c.id === id),
  getByCustomer: (customerId: number) => certificatesOfCompliance.filter((c) => c.customerId === customerId),
  create: (data: any) => {
    const newCert = {
      id: Date.now() + Math.random(),
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    certificatesOfCompliance.push(newCert);
    saveItem("sgf_certificatesOfCompliance", certificatesOfCompliance);
    logAudit("create", "certificate", newCert.id, data);
    return newCert;
  },
  update: (id: number, data: any) => {
    const index = certificatesOfCompliance.findIndex((c) => c.id === id);
    if (index === -1) return null;
    certificatesOfCompliance[index] = { ...certificatesOfCompliance[index], ...data, updatedAt: new Date().toISOString() };
    saveItem("sgf_certificatesOfCompliance", certificatesOfCompliance);
    logAudit("update", "certificate", id, data);
    return certificatesOfCompliance[index];
  },
  delete: (id: number) => {
    const index = certificatesOfCompliance.findIndex((c) => c.id === id);
    if (index === -1) return { success: false, error: "Certificate not found" };
    certificatesOfCompliance.splice(index, 1);
    saveItem("sgf_certificatesOfCompliance", certificatesOfCompliance);
    logAudit("delete", "certificate", id, {});
    return { success: true };
  },
};

export const packingListService = {
  list: () => packingListLines,
  getById: (id: number) => packingListLines.find((p) => p.id === id),
  getByCustomer: (customerId: number) => packingListLines.filter((p) => p.customerId === customerId),
  getByOrder: (orderId: number) => packingListLines.filter((p) => p.orderId === orderId),
  create: (data: any) => {
    const newLine = {
      id: Date.now() + Math.random(),
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    packingListLines.push(newLine);
    saveItem("sgf_packingListLines", packingListLines);
    logAudit("create", "packingListLine", newLine.id, data);
    return newLine;
  },
  update: (id: number, data: any) => {
    const index = packingListLines.findIndex((p) => p.id === id);
    if (index === -1) return null;
    packingListLines[index] = { ...packingListLines[index], ...data, updatedAt: new Date().toISOString() };
    saveItem("sgf_packingListLines", packingListLines);
    logAudit("update", "packingListLine", id, data);
    return packingListLines[index];
  },
  delete: (id: number) => {
    const index = packingListLines.findIndex((p) => p.id === id);
    if (index === -1) return { success: false, error: "Packing list line not found" };
    packingListLines.splice(index, 1);
    saveItem("sgf_packingListLines", packingListLines);
    logAudit("delete", "packingListLine", id, {});
    return { success: true };
  },
};
