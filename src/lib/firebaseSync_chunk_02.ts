        case "coc": await pushCOC(item); break;
        case "followUp": await pushFollowUp(item); break;
        case "followUpAction": await pushFollowUpAction(item); break;
        case "receipt": await pushOneReceipt(item); break;
        default: /* ignore */
      }
    } catch (e: any) {

      remaining.push({ type, item, timestamp: Date.now() });
    }
  }

  savePendingQueue(remaining);

}

// =============================================================================
// PUSH: Save a single item to Firebase
// =============================================================================

export async function pushOrder(order: any): Promise<boolean> {
  if (!isFirebaseReady()) { addToPendingQueue("order", order); return false; }
  try {
    await set(ref(db, `orders/${safeFbKey(order.id)}`), { ...order, _syncedAt: Date.now() });

    return true;
  } catch (e: any) { return false; }
}

export async function pushCheckin(checkin: any): Promise<void> {
  if (!isFirebaseReady()) { addToPendingQueue("checkin", checkin); return; }
  try {
    await set(ref(db, `checkins/${safeFbKey(checkin.id)}`), { ...checkin, _syncedAt: Date.now() });
  } catch { /* ignore */ }
}

export async function pushAppointment(appointment: any): Promise<void> {
  if (!isFirebaseReady()) { addToPendingQueue("appointment", appointment); return; }
  try {
    await set(ref(db, `appointments/${safeFbKey(appointment.id)}`), { ...appointment, _syncedAt: Date.now() });
  } catch { /* ignore */ }
}

export async function pushInvoice(invoice: any): Promise<{ success: boolean; error?: string }> {
  if (!isFirebaseReady()) { addToPendingQueue("invoice", invoice); return { success: false, error: "Firebase not ready — queued for sync" }; }
  if (!invoice || !invoice.id) return { success: false, error: "Invalid invoice (no id)" };
  try {
    await set(ref(db, `invoices/${safeFbKey(invoice.id)}`), cleanForFirebase(invoice));
    return { success: true };
  } catch (e: any) {

    return { success: false, error: e.message };
  }
}

/** Push all invoices to Firebase (used after bulk historical import) */
export async function pushInvoices(invoices: any[]): Promise<{ success: boolean; error?: string }> {
  if (!isFirebaseReady()) return { success: false, error: "Firebase not ready" };
  try {
    await set(ref(db, "invoices"), invoices);
    return { success: true };
  } catch (e: any) {

    return { success: false, error: e.message };
  }
}

export async function removeOrder(id: number): Promise<void> {
  if (!isFirebaseReady()) return;
  try { await set(ref(db, `orders/${safeFbKey(id)}`), null); } catch { /* ignore */ }
}

export async function removeInvoice(id: number): Promise<void> {
  if (!isFirebaseReady()) return;
  try { await set(ref(db, `invoices/${safeFbKey(id)}`), null); } catch { /* ignore */ }
}

export async function pushFollowUpAction(action: any): Promise<void> {
  if (!isFirebaseReady()) { addToPendingQueue("followUpAction", action); return; }
  try {
    await set(ref(db, `followUpActions/${safeFbKey(action.id)}`), { ...action, _syncedAt: Date.now() });
  } catch { /* ignore */ }
}

export async function pushFollowUp(followUp: any): Promise<void> {
  if (!isFirebaseReady()) { addToPendingQueue("followUp", followUp); return; }
  try {
    await set(ref(db, `followUps/${safeFbKey(followUp.id)}`), { ...followUp, _syncedAt: Date.now() });
  } catch { /* ignore */ }
}

export async function pushCollectionNote(note: any): Promise<void> {
  if (!isFirebaseReady()) return;
  try {
    await set(ref(db, `collectionNotes/${safeFbKey(note.id)}`), { ...note, _syncedAt: Date.now() });
  } catch { /* ignore */ }
}

export async function pushCollectionPromise(promise: any): Promise<void> {
  if (!isFirebaseReady()) return;
  try {
    await set(ref(db, `collectionPromises/${safeFbKey(promise.id)}`), { ...promise, _syncedAt: Date.now() });
  } catch { /* ignore */ }
}

export async function pushAudit(audit: any): Promise<void> {
  if (!isFirebaseReady()) return;
  try {
    await set(ref(db, `auditLog/${safeFbKey(audit.id)}`), { ...audit, _syncedAt: Date.now() });
  } catch { /* ignore */ }
}

export async function pushSystemLog(entry: any): Promise<void> {
  if (!isFirebaseReady()) return;
  try {
    const safeId = String(entry.id || Date.now() + Math.random()).replace(/[.#$[\]]/g, '_');
    await set(ref(db, `systemLogs/${safeId}`), { ...entry, _syncedAt: Date.now() });
  } catch { /* ignore */ }
}

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
