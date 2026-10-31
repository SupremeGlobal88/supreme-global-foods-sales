// =============================================================================
// PULL: Load ALL data from Firebase into localStorage
// =============================================================================

export async function pullFromCloud(): Promise<Record<string, number>> {
  if (pullFromCloudDone) return {};
  if (!isFirebaseReady()) return {};

  const counts: Record<string, number> = {};

  async function pullList(path: string, storageKey: string): Promise<void> {
    try {
      const snap = await get(ref(db, path));
      if (snap.exists()) {
        const val = snap.val();
        const list = Object.values(val);
        setStorageItem(storageKey, JSON.stringify(list));
        counts[path] = list.length;
      }
    } catch { /* ignore */ }
  }

  await pullList("customers", "sgf_customers");
  await pullList("products", "sgf_products");
  await pullList("orders", "sgf_orders");
  await pullList("invoices", "sgf_invoices");
  await pullList("appointments", "sgf_appointments");
  await pullList("checkins", "sgf_checkins");
  await pullList("specialPrices", "sgf_specialPrices");
  await pullList("auditLog", "sgf_auditLog");
  await pullList("followUps", "sgf_followUps");
  await pullList("followUpActions", "sgf_followUpActions");
  await pullList("collectionNotes", "sgf_collectionNotes");
  await pullList("collectionPromises", "sgf_collectionPromises");
  await pullList("accountHolds", "sgf_accountHolds");
  await pullList("receipts", "sgf_receipts");
  await pullList("creditNotes", "sgf_creditNotes");
  await pullList("users", "sgf_users");
  await pullList("salesReps", "sgf_salesReps");
  await pullList("corporateCustomers", "sgf_corporateCustomers");
  await pullList("purchaseOrders", "sgf_purchaseOrders");
  await pullList("barrels", "sgf_barrels");
  await pullList("certificatesOfCompliance", "sgf_certificatesOfCompliance");
  await pullList("packingListLines", "sgf_packingListLines");
  await pullList("systemLogs", "sgf_systemLogs");

  pullFromCloudDone = true;
  return counts;
}

// =============================================================================
// SUBSCRIPTIONS: Real-time sync FROM Firebase
// =============================================================================

function createSubscription<T>(
  path: string,
  storageKey: string,
  handler: (items: T[]) => void
): () => void {
  if (!db) return () => {};
  const r = ref(db, path);
  const unsub = onValue(r, (snap: any) => {
    if (!snap.exists()) return;
    const val = snap.val();
    const list: T[] = Object.values(val);
    setStorageItem(storageKey, JSON.stringify(list));
    handler(list);
  });
  return unsub;
}

function handleReceived(type: string, storageKey: string) {
  return (items: any[]) => {
    window.dispatchEvent(
      new CustomEvent("firebaseDataReceived", {
        detail: { type, count: items.length },
      })
    );
  };
}

function getCurrentUserRole(): string {
  try {
    const user = JSON.parse(localStorage.getItem("sgf_user") || "{}");
    return user.role || "";
  } catch { return ""; }
}

export function initAutoSync(): () => void {
  if (!isFirebaseReady()) return () => {};

  const unsubs: Array<() => void> = [];

  unsubs.push(subscribeToCustomers(handleReceived("customers", "sgf_customers")));
  unsubs.push(subscribeToProducts(handleReceived("products", "sgf_products")));
  unsubs.push(subscribeToOrders(handleReceived("orders", "sgf_orders")));
  unsubs.push(subscribeToInvoices(handleReceived("invoices", "sgf_invoices")));
  unsubs.push(subscribeToAppointments(handleReceived("appointments", "sgf_appointments")));
  unsubs.push(subscribeToCheckins(handleReceived("checkIns", "sgf_checkins")));
  unsubs.push(subscribeToSpecialPrices(handleReceived("specialPrices", "sgf_specialPrices")));
  unsubs.push(subscribeToFollowUps(handleReceived("followUps", "sgf_followUps")));
  unsubs.push(subscribeToFollowUpActions(handleReceived("followUpActions", "sgf_followUpActions")));
  unsubs.push(subscribeToCollectionNotes(handleReceived("collectionNotes", "sgf_collectionNotes")));
  unsubs.push(subscribeToCollectionPromises(handleReceived("collectionPromises", "sgf_collectionPromises")));
  unsubs.push(subscribeToAccountHolds(handleReceived("accountHolds", "sgf_accountHolds")));
  unsubs.push(subscribeToReceipts(handleReceived("receipts", "sgf_receipts")));
  unsubs.push(subscribeToCreditNotes(handleReceived("creditNotes", "sgf_creditNotes")));
  unsubs.push(subscribeToUsers(handleReceived("users", "sgf_users")));
  unsubs.push(subscribeToSalesReps(handleReceived("salesReps", "sgf_salesReps")));
  unsubs.push(subscribeToCorporateCustomers(handleReceived("corporateCustomers", "sgf_corporateCustomers")));
  unsubs.push(subscribeToPurchaseOrders(handleReceived("purchaseOrders", "sgf_purchaseOrders")));
  unsubs.push(subscribeToBarrels(handleReceived("barrels", "sgf_barrels")));
  unsubs.push(subscribeToCOC(handleReceived("certificatesOfCompliance", "sgf_certificatesOfCompliance")));
  unsubs.push(subscribeToPackingListLines(handleReceived("packingListLines", "sgf_packingListLines")));

  if (getCurrentUserRole() === "admin" || getCurrentUserRole() === "super_admin") {
    unsubs.push(subscribeToSystemLogs(handleReceived("systemLogs", "sgf_systemLogs")));
  }

  return () => { unsubs.forEach((u) => u()); };
}

// ------------------------------------------------------------------
// Subscription helpers
// ------------------------------------------------------------------

function subscribeToCustomers(handler: (items: any[]) => void) {
  return createSubscription("customers", "sgf_customers", handler);
}
function subscribeToProducts(handler: (items: any[]) => void) {
  return createSubscription("products", "sgf_products", handler);
}
function subscribeToOrders(handler: (items: any[]) => void) {
  return createSubscription("orders", "sgf_orders", handler);
}
function subscribeToInvoices(handler: (items: any[]) => void) {
  return createSubscription("invoices", "sgf_invoices", handler);
}
function subscribeToAppointments(handler: (items: any[]) => void) {
  return createSubscription("appointments", "sgf_appointments", handler);
}
function subscribeToCheckins(handler: (items: any[]) => void) {
  return createSubscription("checkins", "sgf_checkins", handler);
}
function subscribeToSpecialPrices(handler: (items: any[]) => void) {
  return createSubscription("specialPrices", "sgf_specialPrices", handler);
}
function subscribeToFollowUps(handler: (items: any[]) => void) {
  return createSubscription("followUps", "sgf_followUps", handler);
}
function subscribeToFollowUpActions(handler: (items: any[]) => void) {
  return createSubscription("followUpActions", "sgf_followUpActions", handler);
}
function subscribeToCollectionNotes(handler: (items: any[]) => void) {
  return createSubscription("collectionNotes", "sgf_collectionNotes", handler);
}
function subscribeToCollectionPromises(handler: (items: any[]) => void) {
  return createSubscription("collectionPromises", "sgf_collectionPromises", handler);
}
function subscribeToAccountHolds(handler: (items: any[]) => void) {
  return createSubscription("accountHolds", "sgf_accountHolds", handler);
}
function subscribeToReceipts(handler: (items: any[]) => void) {
  return createSubscription("receipts", "sgf_receipts", handler);
}
function subscribeToCreditNotes(handler: (items: any[]) => void) {
  return createSubscription("creditNotes", "sgf_creditNotes", handler);
}
function subscribeToUsers(handler: (items: any[]) => void) {
  return createSubscription("users", "sgf_users", handler);
}
function subscribeToSalesReps(handler: (items: any[]) => void) {
  return createSubscription("salesReps", "sgf_salesReps", handler);
}
function subscribeToCorporateCustomers(handler: (items: any[]) => void) {
  return createSubscription("corporateCustomers", "sgf_corporateCustomers", handler);
}
function subscribeToPurchaseOrders(handler: (items: any[]) => void) {
  return createSubscription("purchaseOrders", "sgf_purchaseOrders", handler);
}
function subscribeToBarrels(handler: (items: any[]) => void) {
  return createSubscription("barrels", "sgf_barrels", handler);
}
function subscribeToCOC(handler: (items: any[]) => void) {
  return createSubscription("certificatesOfCompliance", "sgf_certificatesOfCompliance", handler);
}
function subscribeToPackingListLines(handler: (items: any[]) => void) {
  return createSubscription("packingListLines", "sgf_packingListLines", handler);
}
function subscribeToSystemLogs(handler: (items: any[]) => void) {
  return createSubscription("systemLogs", "sgf_systemLogs", handler);
}

// =============================================================================
// CLEAN FOR FIREBASE: Remove undefined values and functions
// =============================================================================

function cleanForFirebase(obj: any): any {
  if (obj === null || obj === undefined) return null;
  if (typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(cleanForFirebase);
  const cleaned: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined && typeof value !== "function") {
      cleaned[key] = cleanForFirebase(value);
    }
  }
  return cleaned;
}

// =============================================================================
// DISCONNECT
// =============================================================================

export function disconnectFirebase(): void {
  listeners.forEach((l) => l());
  listeners = [];
  if (connectionListener) {
    connectionListener();
    connectionListener = null;
  }
  db = null;
  config = null;
}
