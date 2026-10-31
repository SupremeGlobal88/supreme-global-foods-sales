// =============================================================================
// BULK SYNC OPERATIONS (used by SettingsPage)
// =============================================================================

export async function pushCustomers(customers: any[]): Promise<void> {
  for (const c of customers) await pushCustomer(c);
}

export async function syncAllLocalData(data?: { orders?: any[]; checkins?: any[]; appointments?: any[]; invoices?: any[] }): Promise<{ orders: number; invoices: number }> {
  const result = { orders: 0, invoices: 0 };
  if (data?.orders) { for (const o of data.orders) { await pushOrder(o); result.orders++; } }
  if (data?.invoices) { for (const i of data.invoices) { await pushInvoice(i); result.invoices++; } }
  if (data?.checkins) { for (const c of data.checkins) await pushCheckin(c); }
  if (data?.appointments) { for (const a of data.appointments) await pushAppointment(a); }
  return result;
}

export async function forcePushAllLocalData(onProgress?: (done: number, total: number, type: string) => void): Promise<Record<string, number>> {
  const result: Record<string, number> = {};
  const types = ["orders", "invoices", "customers", "products", "appointments", "checkins", "followUps", "receipts", "creditNotes", "collectionNotes", "collectionPromises", "accountHolds", "specialPrices", "corporateCustomers", "purchaseOrders", "barrels", "certificatesOfCompliance", "packingListLines", "followUpActions", "users"];
  let done = 0;
  const allItems: { type: string; items: any[] }[] = [];
  for (const type of types) {
    try {
      const raw = getStorageItem(`sgf_${type}`);
      const items = raw ? JSON.parse(raw) : [];
      if (Array.isArray(items) && items.length > 0) allItems.push({ type, items });
    } catch { /* ignore */ }
  }
  const total = allItems.reduce((sum, t) => sum + t.items.length, 0);
  for (const { type, items } of allItems) {
    result[type] = 0;
    for (const item of items) {
      try {
        switch (type) {
          case "orders": await pushOrder(item); break;
          case "invoices": await pushInvoice(item); break;
          case "customers": await pushCustomer(item); break;
          case "products": await pushStock(item); break;
          case "appointments": await pushAppointment(item); break;
          case "checkins": await pushCheckin(item); break;
          case "followUps": await pushFollowUp(item); break;
          case "receipts": await pushOneReceipt(item); break;
          case "creditNotes": await pushCreditNote(item); break;
          case "collectionNotes": await pushCollectionNote(item); break;
          case "collectionPromises": await pushCollectionPromise(item); break;
          case "accountHolds": break; // no individual push
          case "specialPrices": await pushSpecialPrice(item); break;
          case "corporateCustomers": await pushCorporateCustomer(item); break;
          case "purchaseOrders": await pushPurchaseOrder(item); break;
          case "barrels": await pushBarrel(item); break;
          case "certificatesOfCompliance": await pushCOC(item); break;
          case "packingListLines": await pushPackingList(item); break;
          case "followUpActions": await pushFollowUpAction(item); break;
          case "users": await pushUser(item); break;
        }
        result[type]++;
      } catch { /* ignore */ }
      done++;
      if (onProgress) onProgress(done, total, type);
    }
  }
  return result;
}

export async function forcePullAllFromCloud(): Promise<{ orders: number; invoices: number; customers: number; stock: number; errors: string[] }> {
  const result = await pullFromCloud();
  return {
    orders: result.orders || 0,
    invoices: result.invoices || 0,
    customers: result.customers || 0,
    stock: result.stock || 0,
    errors: [],
  };
}

export async function diagnoseSync(): Promise<{ localStorage: Record<string, number>; firebase: Record<string, number>; ghosts: Record<string, number>; drafts: Record<string, number>; duplicates: Record<string, number>; idMismatches: Record<string, number> }> {
  const localStorage: Record<string, number> = {};
  const firebase: Record<string, number> = {};
  const ghosts: Record<string, number> = {};
  const drafts: Record<string, number> = {};
  const duplicates: Record<string, number> = {};
  const idMismatches: Record<string, number> = {};
  const keys = ["sgf_orders", "sgf_invoices", "sgf_customers", "sgf_products", "sgf_appointments", "sgf_checkins"];
  for (const key of keys) {
    try {
      const raw = getStorageItem(key);
      const items = raw ? JSON.parse(raw) : [];
      localStorage[key] = Array.isArray(items) ? items.length : 0;
    } catch { localStorage[key] = 0; }
  }
  return { localStorage, firebase, ghosts, drafts, duplicates, idMismatches };
}

export async function forceResetAndSync(): Promise<{ success: boolean; cleared: string[]; pulled: Record<string, number> }> {
  const cleared: string[] = [];
  const keys = Object.keys(localStorage).filter(k => k.startsWith("sgf_") && k !== "sgf_firebaseConfig");
  for (const key of keys) { localStorage.removeItem(key); cleared.push(key); }
  const pulled = await pullFromCloud();
  return { success: true, cleared, pulled };
}

export async function clearCloudData(): Promise<boolean> {
  if (!isFirebaseReady()) return false;
  const paths = ["orders", "invoices", "customers", "products", "appointments", "checkins", "followUps", "receipts", "creditNotes", "collectionNotes", "collectionPromises", "accountHolds", "specialPrices", "corporateCustomers", "purchaseOrders", "barrels", "certificatesOfCompliance", "packingListLines", "followUpActions", "users"];
  try {
    for (const p of paths) { await remove(ref(db, p)); }
    return true;
  } catch { return false; }
}
