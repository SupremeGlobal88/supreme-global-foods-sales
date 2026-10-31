// =============================================================================
// DATA MIGRATION SERVICE
// =============================================================================

export const migrationService = {
  getVersion: () => {
    try {
      const raw = getStorageItem("sgf_dataVersion");
      if (raw) return parseInt(raw, 10);
    } catch { /* ignore */ }
    return 1;
  },
  setVersion: (version: number) => {
    setStorageItem("sgf_dataVersion", String(version));
    return version;
  },
  runMigrations: () => {
    const currentVersion = migrationService.getVersion();
    let version = currentVersion;

    // Migration 1 → 2: Add updatedAt to all records
    if (version < 2) {
      for (const customer of customers) {
        if (!customer.updatedAt) customer.updatedAt = customer.createdAt || new Date().toISOString();
      }
      for (const product of products) {
        if (!product.updatedAt) product.updatedAt = product.createdAt || new Date().toISOString();
      }
      for (const order of orders) {
        if (!order.updatedAt) order.updatedAt = order.createdAt || new Date().toISOString();
      }
      for (const invoice of invoices) {
        if (!invoice.updatedAt) invoice.updatedAt = invoice.createdAt || new Date().toISOString();
      }
      saveItem("sgf_customers", customers);
      saveItem("sgf_products", products);
      saveItem("sgf_orders", orders);
      saveItem("sgf_invoices", invoices);
      version = 2;
    }

    // Migration 2 → 3: Add isActive to customers
    if (version < 3) {
      for (const customer of customers) {
        if (customer.isActive === undefined) customer.isActive = true;
      }
      saveItem("sgf_customers", customers);
      version = 3;
    }

    // Migration 3 → 4: Add classification to customers
    if (version < 4) {
      for (const customer of customers) {
        if (!customer.classification) customer.classification = "standard";
      }
      saveItem("sgf_customers", customers);
      version = 4;
    }

    // Migration 4 → 5: Add creditLimit to customers
    if (version < 5) {
      for (const customer of customers) {
        if (customer.creditLimit === undefined) customer.creditLimit = 0;
      }
      saveItem("sgf_customers", customers);
      version = 5;
    }

    // Migration 5 → 6: Add priceTier to customers
    if (version < 6) {
      for (const customer of customers) {
        if (!customer.priceTier) customer.priceTier = "wholesale";
      }
      saveItem("sgf_customers", customers);
      version = 6;
    }

    // Migration 6 → 7: Add onStopList to customers
    if (version < 7) {
      for (const customer of customers) {
        if (customer.onStopList === undefined) customer.onStopList = false;
      }
      saveItem("sgf_customers", customers);
      version = 7;
    }

    // Migration 7 → 8: Add salesRepName to customers
    if (version < 8) {
      for (const customer of customers) {
        if (!customer.salesRepName) customer.salesRepName = "";
      }
      saveItem("sgf_customers", customers);
      version = 8;
    }

    // Migration 8 → 9: Ensure all users have PINs
    if (version < 9) {
      for (const user of users) {
        if (!user.pin) user.pin = "0000";
      }
      saveItem("sgf_users", users);
      version = 9;
    }

    // Migration 9 → 10: Add orderType to orders (default "regular")
    if (version < 10) {
      for (const order of orders) {
        if (!order.orderType) order.orderType = "regular";
      }
      saveItem("sgf_orders", orders);
      version = 10;
    }

    // Migration 10 → 11: Add status to orders (default "draft")
    if (version < 11) {
      for (const order of orders) {
        if (!order.status) order.status = "draft";
      }
      saveItem("sgf_orders", orders);
      version = 11;
    }

    migrationService.setVersion(version);
    return { fromVersion: currentVersion, toVersion: version };
  },
};

// =============================================================================
// FIREBASE SYNC HELPERS
// =============================================================================

export function getDataForFirebaseSync(): Record<string, any[]> {
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
}

export function applyFirebaseSync(data: Record<string, any[]>): void {
  if (data.customers) { customers = mergeWithCloudData(customers, data.customers); saveItem("sgf_customers", customers); }
  if (data.products) { products = mergeWithCloudData(products, data.products); saveItem("sgf_products", products); }
  if (data.orders) { orders = mergeWithCloudData(orders, data.orders); saveItem("sgf_orders", orders); }
  if (data.invoices) { invoices = mergeWithCloudData(invoices, data.invoices); saveItem("sgf_invoices", invoices); }
  if (data.appointments) { appointments = mergeWithCloudData(appointments, data.appointments); saveItem("sgf_appointments", appointments); }
  if (data.checkins) { checkins = mergeWithCloudData(checkins, data.checkins); saveItem("sgf_checkins", checkins); }
  if (data.specialPrices) { specialPrices = mergeWithCloudData(specialPrices, data.specialPrices); saveItem("sgf_specialPrices", specialPrices); }
  if (data.auditLog) { auditLog = mergeWithCloudData(auditLog, data.auditLog); saveItem("sgf_auditLog", auditLog); }
  if (data.systemLogs) { systemLogs = mergeWithCloudData(systemLogs, data.systemLogs); saveItem("sgf_systemLogs", systemLogs); }
  if (data.followUps) { followUps = mergeWithCloudData(followUps, data.followUps); saveItem("sgf_followUps", followUps); }
  if (data.followUpActions) { followUpActions = mergeWithCloudData(followUpActions, data.followUpActions); saveItem("sgf_followUpActions", followUpActions); }
  if (data.collectionNotes) { collectionNotes = mergeWithCloudData(collectionNotes, data.collectionNotes); saveItem("sgf_collectionNotes", collectionNotes); }
  if (data.collectionPromises) { collectionPromises = mergeWithCloudData(collectionPromises, data.collectionPromises); saveItem("sgf_collectionPromises", collectionPromises); }
  if (data.accountHolds) { accountHolds = mergeWithCloudData(accountHolds, data.accountHolds); saveItem("sgf_accountHolds", accountHolds); }
  if (data.receipts) { receipts = mergeWithCloudData(receipts, data.receipts); saveItem("sgf_receipts", receipts); }
  if (data.creditNotes) { creditNotes = mergeWithCloudData(creditNotes, data.creditNotes); saveItem("sgf_creditNotes", creditNotes); }
  if (data.users) { users = mergeWithCloudData(users, data.users); saveItem("sgf_users", users); }
  if (data.corporateCustomers) { corporateCustomers = mergeWithCloudData(corporateCustomers, data.corporateCustomers); saveItem("sgf_corporateCustomers", corporateCustomers); }
  if (data.purchaseOrders) { purchaseOrders = mergeWithCloudData(purchaseOrders, data.purchaseOrders); saveItem("sgf_purchaseOrders", purchaseOrders); }
  if (data.barrels) { barrels = mergeWithCloudData(barrels, data.barrels); saveItem("sgf_barrels", barrels); }
  if (data.certificatesOfCompliance) { certificatesOfCompliance = mergeWithCloudData(certificatesOfCompliance, data.certificatesOfCompliance); saveItem("sgf_certificatesOfCompliance", certificatesOfCompliance); }
  if (data.packingListLines) { packingListLines = mergeWithCloudData(packingListLines, data.packingListLines); saveItem("sgf_packingListLines", packingListLines); }
}

// =============================================================================
// FIREBASE PUSH/PULL STUBS (for SettingsPage compatibility)
// =============================================================================

export function forcePushAllLocalData(): Promise<{ success: boolean; message: string }> {
  return new Promise((resolve) => {
    try {
      const data = getDataForFirebaseSync();
      setStorageItem("sgf_firebase_backup", JSON.stringify({ timestamp: new Date().toISOString(), data }));
      resolve({ success: true, message: "Data backed up to localStorage" });
    } catch (e) {
      resolve({ success: false, message: String(e) });
    }
  });
}

export function forcePullAllFromCloud(): Promise<{ success: boolean; message: string }> {
  return new Promise((resolve) => {
    try {
      const raw = getStorageItem("sgf_firebase_backup");
      if (raw) {
        const backup = JSON.parse(raw);
        if (backup.data) {
          applyFirebaseSync(backup.data);
          resolve({ success: true, message: "Data restored from localStorage backup" });
          return;
        }
      }
      resolve({ success: false, message: "No backup found in localStorage" });
    } catch (e) {
      resolve({ success: false, message: String(e) });
    }
  });
}

export function clearLocalOnlyData(): Promise<{ success: boolean; message: string }> {
  return new Promise((resolve) => {
    try {
      removeStorageItem("sgf_firebase_backup");
      resolve({ success: true, message: "Local backup cleared" });
    } catch (e) {
      resolve({ success: false, message: String(e) });
    }
  });
}
