// =============================================================================
// DOCUMENT / FILE ATTACHMENT SERVICE
// =============================================================================

export const documentService = {
  list: () => {
    try {
      const raw = getStorageItem("sgf_documents");
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return [];
  },
  getById: (id: number) => {
    const docs = documentService.list();
    return docs.find((d: any) => d.id === id);
  },
  getByEntity: (entityType: string, entityId: number) => {
    const docs = documentService.list();
    return docs.filter((d: any) => d.entityType === entityType && d.entityId === entityId);
  },
  create: (data: any) => {
    const docs = documentService.list();
    const newDoc = {
      id: Date.now() + Math.random(),
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    docs.push(newDoc);
    setStorageItem("sgf_documents", JSON.stringify(docs));
    logAudit("create", "document", newDoc.id, data);
    return newDoc;
  },
  update: (id: number, data: any) => {
    const docs = documentService.list();
    const index = docs.findIndex((d: any) => d.id === id);
    if (index === -1) return null;
    docs[index] = { ...docs[index], ...data, updatedAt: new Date().toISOString() };
    setStorageItem("sgf_documents", JSON.stringify(docs));
    logAudit("update", "document", id, data);
    return docs[index];
  },
  delete: (id: number) => {
    const docs = documentService.list();
    const index = docs.findIndex((d: any) => d.id === id);
    if (index === -1) return { success: false, error: "Document not found" };
    docs.splice(index, 1);
    setStorageItem("sgf_documents", JSON.stringify(docs));
    logAudit("delete", "document", id, {});
    return { success: true };
  },
};

// =============================================================================
// EMAIL / MESSAGE TEMPLATE SERVICE
// =============================================================================

export const templateService = {
  list: () => {
    try {
      const raw = getStorageItem("sgf_templates");
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return [];
  },
  getById: (id: number) => {
    const templates = templateService.list();
    return templates.find((t: any) => t.id === id);
  },
  getByType: (type: string) => {
    const templates = templateService.list();
    return templates.filter((t: any) => t.type === type);
  },
  create: (data: any) => {
    const templates = templateService.list();
    const newTemplate = {
      id: Date.now() + Math.random(),
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    templates.push(newTemplate);
    setStorageItem("sgf_templates", JSON.stringify(templates));
    logAudit("create", "template", newTemplate.id, data);
    return newTemplate;
  },
  update: (id: number, data: any) => {
    const templates = templateService.list();
    const index = templates.findIndex((t: any) => t.id === id);
    if (index === -1) return null;
    templates[index] = { ...templates[index], ...data, updatedAt: new Date().toISOString() };
    setStorageItem("sgf_templates", JSON.stringify(templates));
    logAudit("update", "template", id, data);
    return templates[index];
  },
  delete: (id: number) => {
    const templates = templateService.list();
    const index = templates.findIndex((t: any) => t.id === id);
    if (index === -1) return { success: false, error: "Template not found" };
    templates.splice(index, 1);
    setStorageItem("sgf_templates", JSON.stringify(templates));
    logAudit("delete", "template", id, {});
    return { success: true };
  },
};

// =============================================================================
// INTEGRATION / API KEY SERVICE
// =============================================================================

export const integrationService = {
  getApiKeys: () => {
    try {
      const raw = getStorageItem("sgf_apiKeys");
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return [];
  },
  createApiKey: (data: any) => {
    const keys = integrationService.getApiKeys();
    const newKey = {
      id: Date.now() + Math.random(),
      key: `sk_${Math.random().toString(36).substring(2, 15)}`,
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    keys.push(newKey);
    setStorageItem("sgf_apiKeys", JSON.stringify(keys));
    logAudit("create", "apiKey", newKey.id, data);
    return newKey;
  },
  revokeApiKey: (id: number) => {
    const keys = integrationService.getApiKeys();
    const index = keys.findIndex((k: any) => k.id === id);
    if (index === -1) return { success: false, error: "API key not found" };
    keys[index].revoked = true;
    keys[index].updatedAt = new Date().toISOString();
    setStorageItem("sgf_apiKeys", JSON.stringify(keys));
    logAudit("update", "apiKey", id, { action: "revoked" });
    return { success: true };
  },
};

// =============================================================================
// SYSTEM HEALTH / STATUS
// =============================================================================

export const systemHealthService = {
  getStatus: () => {
    const integrity = validateDataIntegrity();
    const storageUsed = Object.keys(localStorage)
      .filter((k) => k.startsWith("sgf_"))
      .reduce((sum, k) => sum + (localStorage.getItem(k)?.length || 0), 0);
    return {
      dataIntegrity: integrity.valid ? "healthy" : "issues_found",
      issues: integrity.issues,
      storageUsed,
      storageLimit: 5 * 1024 * 1024, // Approximate 5MB limit
      lastBackup: getStorageItem("sgf_lastBackup") || null,
      version: "2.0",
    };
  },
  runDiagnostics: () => {
    const results: string[] = [];
    const integrity = validateDataIntegrity();
    if (integrity.valid) {
      results.push("Data integrity: OK");
    } else {
      results.push("Data integrity: FAILED");
      results.push(...integrity.issues);
    }
    const health = systemHealthService.getStatus();
    const usagePercent = Math.round((health.storageUsed / health.storageLimit) * 100);
    results.push(`Storage usage: ${usagePercent}% (${health.storageUsed} / ${health.storageLimit} bytes)`);
    if (usagePercent > 90) results.push("WARNING: Storage nearly full");
    return results;
  },
};

// =============================================================================
// BULK IMPORT / EXPORT SERVICE
// =============================================================================

export const bulkImportService = {
  importCustomers: (data: any[]) => {
    let created = 0;
    let updated = 0;
    let failed = 0;
    for (const row of data) {
      try {
        const existing = customers.find((c) => c.customerCode === row.customerCode || c.name === row.name);
        if (existing) {
          Object.assign(existing, row, { updatedAt: new Date().toISOString() });
          updated++;
        } else {
          customers.push({
            id: Date.now() + Math.random(),
            ...row,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          created++;
        }
      } catch {
        failed++;
      }
    }
    saveItem("sgf_customers", customers);
    return { created, updated, failed };
  },
  importProducts: (data: any[]) => {
    let created = 0;
    let updated = 0;
    let failed = 0;
    for (const row of data) {
      try {
        const existing = products.find((p) => p.productCode === row.productCode || p.productName === row.productName);
        if (existing) {
          Object.assign(existing, row, { updatedAt: new Date().toISOString() });
          updated++;
        } else {
          products.push({
            id: Date.now() + Math.random(),
            ...row,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          created++;
        }
      } catch {
        failed++;
      }
    }
    saveItem("sgf_products", products);
    return { created, updated, failed };
  },
  importOrders: (data: any[]) => {
    let created = 0;
    let failed = 0;
    for (const row of data) {
      try {
        orders.push({
          id: Date.now() + Math.random(),
          ...row,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        created++;
      } catch {
        failed++;
      }
    }
    saveItem("sgf_orders", orders);
    return { created, failed };
  },
};

// =============================================================================
// SEARCH / GLOBAL SEARCH SERVICE
// =============================================================================

export const searchService = {
  search: (query: string) => {
    const q = query.toLowerCase().trim();
    if (!q) return { customers: [], products: [], orders: [], invoices: [] };
    return {
      customers: customers.filter((c) =>
        c.name?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.phone?.toLowerCase().includes(q) ||
        c.customerCode?.toLowerCase().includes(q)
      ),
      products: products.filter((p) =>
        p.productName?.toLowerCase().includes(q) ||
        p.productCode?.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q)
      ),
      orders: orders.filter((o) =>
        o.orderNumber?.toLowerCase().includes(q) ||
        getCustomerName(o.customerId)?.toLowerCase().includes(q)
      ),
      invoices: invoices.filter((i) =>
        i.invoiceNumber?.toLowerCase().includes(q) ||
        getCustomerName(i.customerId)?.toLowerCase().includes(q)
      ),
    };
  },
};
