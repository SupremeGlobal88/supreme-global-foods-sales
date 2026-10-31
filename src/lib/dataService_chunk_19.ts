// =============================================================================
// PERMISSION / ROLE SERVICE
// =============================================================================

const DEFAULT_PERMISSIONS: Record<string, string[]> = {
  super_admin: ["*"],
  admin: [
    "customers.read", "customers.write",
    "products.read", "products.write",
    "orders.read", "orders.write",
    "invoices.read", "invoices.write",
    "receipts.read", "receipts.write",
    "reports.read",
    "users.read", "users.write",
    "settings.read", "settings.write",
  ],
  sales_rep: [
    "customers.read", "customers.write",
    "products.read",
    "orders.read", "orders.write",
    "invoices.read",
    "receipts.read", "receipts.write",
    "appointments.read", "appointments.write",
    "checkins.read", "checkins.write",
  ],
  viewer: [
    "customers.read",
    "products.read",
    "orders.read",
    "invoices.read",
    "reports.read",
  ],
};

export const permissionService = {
  getPermissions: (role: string) => {
    return DEFAULT_PERMISSIONS[role] || [];
  },
  hasPermission: (role: string, permission: string) => {
    const permissions = permissionService.getPermissions(role);
    return permissions.includes("*") || permissions.includes(permission);
  },
  checkPermission: (role: string, permission: string) => {
    if (!permissionService.hasPermission(role, permission)) {
      throw new Error(`Permission denied: ${permission}`);
    }
  },
};

// =============================================================================
// SESSION / AUTH SERVICE
// =============================================================================

export const sessionService = {
  getCurrentUser: () => {
    try {
      const raw = getStorageItem("sgf_currentUser");
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return null;
  },
  setCurrentUser: (user: any) => {
    setStorageItem("sgf_currentUser", JSON.stringify(user));
    return user;
  },
  clearCurrentUser: () => {
    removeStorageItem("sgf_currentUser");
    return null;
  },
  isLoggedIn: () => {
    return !!sessionService.getCurrentUser();
  },
};

// =============================================================================
// PIN / PASSWORD SERVICE
// =============================================================================

export const pinService = {
  verifyPin: (userId: number, pin: string) => {
    const user = users.find((u) => u.id === userId);
    if (!user) return false;
    return String(user.pin) === String(pin);
  },
  changePin: (userId: number, oldPin: string, newPin: string) => {
    const user = users.find((u) => u.id === userId);
    if (!user) return { success: false, error: "User not found" };
    if (!pinService.verifyPin(userId, oldPin)) return { success: false, error: "Incorrect old PIN" };
    user.pin = newPin;
    user.updatedAt = new Date().toISOString();
    saveItem("sgf_users", users);
    logAudit("update", "userPin", userId, {});
    return { success: true };
  },
  resetPin: (userId: number, newPin: string) => {
    const user = users.find((u) => u.id === userId);
    if (!user) return { success: false, error: "User not found" };
    user.pin = newPin;
    user.updatedAt = new Date().toISOString();
    saveItem("sgf_users", users);
    logAudit("update", "userPin", userId, { action: "reset" });
    return { success: true };
  },
};

// =============================================================================
// SYNC / CLOUD SYNC SERVICE (localStorage-based)
// =============================================================================

export const syncService = {
  getLastSync: () => {
    try {
      const raw = getStorageItem("sgf_lastSync");
      if (raw) return raw;
    } catch { /* ignore */ }
    return null;
  },
  setLastSync: (timestamp: string) => {
    setStorageItem("sgf_lastSync", timestamp);
    return timestamp;
  },
  getSyncStatus: () => {
    const lastSync = syncService.getLastSync();
    return {
      lastSync,
      isSynced: !!lastSync,
      syncAge: lastSync ? Date.now() - new Date(lastSync).getTime() : null,
    };
  },
  exportAll: () => {
    return {
      customers: deepClone(customers),
      products: deepClone(products),
      orders: deepClone(orders),
      invoices: deepClone(invoices),
      appointments: deepClone(appointments),
      checkins: deepClone(checkins),
      specialPrices: deepClone(specialPrices),
      auditLog: deepClone(auditLog),
      systemLogs: deepClone(systemLogs),
      followUps: deepClone(followUps),
      followUpActions: deepClone(followUpActions),
      collectionNotes: deepClone(collectionNotes),
      collectionPromises: deepClone(collectionPromises),
      accountHolds: deepClone(accountHolds),
      receipts: deepClone(receipts),
      creditNotes: deepClone(creditNotes),
      users: deepClone(users),
      corporateCustomers: deepClone(corporateCustomers),
      purchaseOrders: deepClone(purchaseOrders),
      barrels: deepClone(barrels),
      certificatesOfCompliance: deepClone(certificatesOfCompliance),
      packingListLines: deepClone(packingListLines),
    };
  },
  importAll: (data: any) => {
    if (data.customers) { customers = data.customers; saveItem("sgf_customers", customers); }
    if (data.products) { products = data.products; saveItem("sgf_products", products); }
    if (data.orders) { orders = data.orders; saveItem("sgf_orders", orders); }
    if (data.invoices) { invoices = data.invoices; saveItem("sgf_invoices", invoices); }
    if (data.appointments) { appointments = data.appointments; saveItem("sgf_appointments", appointments); }
    if (data.checkins) { checkins = data.checkins; saveItem("sgf_checkins", checkins); }
    if (data.specialPrices) { specialPrices = data.specialPrices; saveItem("sgf_specialPrices", specialPrices); }
    if (data.auditLog) { auditLog = data.auditLog; saveItem("sgf_auditLog", auditLog); }
    if (data.systemLogs) { systemLogs = data.systemLogs; saveItem("sgf_systemLogs", systemLogs); }
    if (data.followUps) { followUps = data.followUps; saveItem("sgf_followUps", followUps); }
    if (data.followUpActions) { followUpActions = data.followUpActions; saveItem("sgf_followUpActions", followUpActions); }
    if (data.collectionNotes) { collectionNotes = data.collectionNotes; saveItem("sgf_collectionNotes", collectionNotes); }
    if (data.collectionPromises) { collectionPromises = data.collectionPromises; saveItem("sgf_collectionPromises", collectionPromises); }
    if (data.accountHolds) { accountHolds = data.accountHolds; saveItem("sgf_accountHolds", accountHolds); }
    if (data.receipts) { receipts = data.receipts; saveItem("sgf_receipts", receipts); }
    if (data.creditNotes) { creditNotes = data.creditNotes; saveItem("sgf_creditNotes", creditNotes); }
    if (data.users) { users = data.users; saveItem("sgf_users", users); }
    if (data.corporateCustomers) { corporateCustomers = data.corporateCustomers; saveItem("sgf_corporateCustomers", corporateCustomers); }
    if (data.purchaseOrders) { purchaseOrders = data.purchaseOrders; saveItem("sgf_purchaseOrders", purchaseOrders); }
    if (data.barrels) { barrels = data.barrels; saveItem("sgf_barrels", barrels); }
    if (data.certificatesOfCompliance) { certificatesOfCompliance = data.certificatesOfCompliance; saveItem("sgf_certificatesOfCompliance", certificatesOfCompliance); }
    if (data.packingListLines) { packingListLines = data.packingListLines; saveItem("sgf_packingListLines", packingListLines); }
    logAudit("import", "system", 0, { timestamp: new Date().toISOString() });
    return { success: true };
  },
};
