  try { await remove(ref(db, `customers/${safeFbKey(id)}`)); } catch { /* ignore */ }
}

export async function pushStock(stock: any): Promise<void> {
  if (!isFirebaseReady()) { addToPendingQueue("stock", stock); return; }
  try {
    await set(ref(db, `products/${safeFbKey(stock.id)}`), { ...stock, _syncedAt: Date.now() });
  } catch { /* ignore */ }
}

export async function pushOneStockItem(stock: any): Promise<void> {
  await pushStock(stock);
}

export async function removeOneStockItem(id: number): Promise<void> {
  if (!isFirebaseReady()) return;
  try { await remove(ref(db, `products/${safeFbKey(id)}`)); } catch { /* ignore */ }
}

export async function pushUser(user: any): Promise<void> {
  if (!isFirebaseReady()) { addToPendingQueue("user", user); return; }
  try {
    await set(ref(db, `users/${safeFbKey(user.id)}`), { ...user, _syncedAt: Date.now() });
  } catch { /* ignore */ }
}

export async function pushUserDelete(id: number): Promise<void> {
  if (!isFirebaseReady()) return;
  try { await remove(ref(db, `users/${safeFbKey(id)}`)); } catch { /* ignore */ }
}

export async function pushSalesRep(rep: any): Promise<void> {
  if (!isFirebaseReady()) { addToPendingQueue("salesRep", rep); return; }
  try {
    await set(ref(db, `salesReps/${safeFbKey(rep.id || rep.name)}`), { ...rep, _syncedAt: Date.now() });
  } catch { /* ignore */ }
}

export async function removeSalesRep(id: number | string): Promise<void> {
  if (!isFirebaseReady()) return;
  try { await remove(ref(db, `salesReps/${safeFbKey(id)}`)); } catch { /* ignore */ }
}

export async function pushSpecialPrice(sp: any): Promise<void> {
  if (!isFirebaseReady()) return;
  try {
    await set(ref(db, `specialPrices/${safeFbKey(sp.id)}`), { ...sp, _syncedAt: Date.now() });
  } catch { /* ignore */ }
}

export async function removeSpecialPrice(id: number): Promise<void> {
  if (!isFirebaseReady()) return;
  try { await remove(ref(db, `specialPrices/${safeFbKey(id)}`)); } catch { /* ignore */ }
}

export async function pushCorporateCustomer(cc: any): Promise<void> {
  if (!isFirebaseReady()) { addToPendingQueue("corporateCustomer", cc); return; }
  try {
    await set(ref(db, `corporateCustomers/${safeFbKey(cc.id)}`), { ...cc, _syncedAt: Date.now() });
  } catch { /* ignore */ }
}

export async function removeCorporateCustomer(id: number): Promise<void> {
  if (!isFirebaseReady()) return;
  try { await remove(ref(db, `corporateCustomers/${safeFbKey(id)}`)); } catch { /* ignore */ }
}

export async function pushPurchaseOrder(po: any): Promise<void> {
  if (!isFirebaseReady()) { addToPendingQueue("purchaseOrder", po); return; }
  try {
    await set(ref(db, `purchaseOrders/${safeFbKey(po.id)}`), { ...po, _syncedAt: Date.now() });
  } catch { /* ignore */ }
}

export async function removePurchaseOrder(id: number): Promise<void> {
  if (!isFirebaseReady()) return;
  try { await remove(ref(db, `purchaseOrders/${safeFbKey(id)}`)); } catch { /* ignore */ }
}

export async function pushBarrel(barrel: any): Promise<void> {
  if (!isFirebaseReady()) { addToPendingQueue("barrel", barrel); return; }
  try {
    await set(ref(db, `barrels/${safeFbKey(barrel.id)}`), { ...barrel, _syncedAt: Date.now() });
  } catch { /* ignore */ }
}

export async function removeBarrel(id: number): Promise<void> {
  if (!isFirebaseReady()) return;
  try { await remove(ref(db, `barrels/${safeFbKey(id)}`)); } catch { /* ignore */ }
}

export async function pushCOC(coc: any): Promise<void> {
  if (!isFirebaseReady()) { addToPendingQueue("coc", coc); return; }
  try {
    await set(ref(db, `certificatesOfCompliance/${safeFbKey(coc.id)}`), { ...coc, _syncedAt: Date.now() });
  } catch { /* ignore */ }
}

export async function removeCOC(id: number): Promise<void> {
  if (!isFirebaseReady()) return;
  try { await remove(ref(db, `certificatesOfCompliance/${safeFbKey(id)}`)); } catch { /* ignore */ }
}

export async function pushPackingList(line: any): Promise<void> {
  if (!isFirebaseReady()) return;
  try {
    await set(ref(db, `packingListLines/${safeFbKey(line.id)}`), { ...line, _syncedAt: Date.now() });
  } catch { /* ignore */ }
}

export async function removePackingListLine(id: number): Promise<void> {
  if (!isFirebaseReady()) return;
  try { await remove(ref(db, `packingListLines/${safeFbKey(id)}`)); } catch { /* ignore */ }
}

export async function pushOneReceipt(receipt: any): Promise<void> {
  if (!isFirebaseReady()) return;
  try {
    await set(ref(db, `receipts/${safeFbKey(receipt.id)}`), { ...receipt, _syncedAt: Date.now() });
  } catch { /* ignore */ }
}

export async function pushCreditNote(cn: any): Promise<void> {
  if (!isFirebaseReady()) return;
  try {
    await set(ref(db, `creditNotes/${safeFbKey(cn.id)}`), { ...cn, _syncedAt: Date.now() });
  } catch { /* ignore */ }
}

export async function removeCreditNote(id: number): Promise<void> {
  if (!isFirebaseReady()) return;
  try { await remove(ref(db, `creditNotes/${safeFbKey(id)}`)); } catch { /* ignore */ }
}

export async function pushAppointmentDelete(id: number): Promise<void> {
  if (!isFirebaseReady()) return;
  try { await remove(ref(db, `appointments/${safeFbKey(id)}`)); } catch { /* ignore */ }
}

export async function pushCheckinDelete(id: number): Promise<void> {
  if (!isFirebaseReady()) return;
  try { await remove(ref(db, `checkins/${safeFbKey(id)}`)); } catch { /* ignore */ }
}

// =============================================================================
// REGISTER DATA SERVICE REFRESH
// =============================================================================

export function registerDataServiceRefresh(refreshFn: () => void): void {
  window.addEventListener("firebaseDataReceived", (e: any) => {
    const type = e.detail?.type;
    if (type) refreshFn();
  });
}

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
