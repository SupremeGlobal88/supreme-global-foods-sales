// =============================================================================
// Individual push helpers
// =============================================================================

export async function pushCustomer(customer: any): Promise<void> {
  if (!isFirebaseReady()) { addToPendingQueue("customer", customer); return; }
  try {
    await set(ref(db, `customers/${safeFbKey(customer.id)}`), { ...customer, _syncedAt: Date.now() });
  } catch { /* ignore */ }
}

export async function pushOneCustomer(customer: any): Promise<void> {
  await pushCustomer(customer);
}

export async function removeOneCustomer(id: number): Promise<void> {
  if (!isFirebaseReady()) return;
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
