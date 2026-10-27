import { getStorageItem, setStorageItem } from "./compressedStorage";
import type { RefreshFn } from "./dataService";

// ═══════════════════════════════════════════════════════════════════════════════
//  Firebase Realtime Database sync layer
//  (c) Supreme Global Foods / Recircle  –  2024-2026
// ═══════════════════════════════════════════════════════════════════════════════

let db: any = null;
let app: any = null;
let isFirebaseConnected = false;
let pendingPushes: { path: string; data: any; resolve: (v: boolean) => void }[] = [];
let isProcessingPushes = false;
let autoSyncInitialized = false;
let autoSyncCleanup: (() => void) | null = null;
let initRetryTimer: ReturnType<typeof setTimeout> | null = null;
let dataServiceRefresh: RefreshFn | null = null;

const eventDebounceMs = 300;
let eventDebounceTimer: ReturnType<typeof setTimeout> | null = null;
const pendingEventTypes = new Set<string>();

// ── Firebase SDK lazy loader ─────────────────────────────────────────────────
async function getFirebase(): Promise<{ app: any; db: any; ref: any; set: any; get: any; push: any; update: any; remove: any; onValue: any; off: any; child: any; query: any; limitToLast: any; orderByChild: any; equalTo: any } | null> {
  try {
    const fb = await import("firebase/app");
    const rtdb = await import("firebase/database");
    return { app: fb, db: rtdb, ...rtdb } as any;
  } catch {
    return null;
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function getDbPath(type: string) {
  const config = getCompanyConfig();
  const prefix = config.name === "Recircle" ? "recircle" : "sgf";
  return `${prefix}/${type}`;
}

function getCompanyConfig() {
  try {
    const stored = localStorage.getItem("sgf_company_config");
    return stored ? JSON.parse(stored) : { name: "Supreme Global Foods", primaryColor: "#D4A843" };
  } catch {
    return { name: "Supreme Global Foods", primaryColor: "#D4A843" };
  }
}

function storeFingerprint(key: string, data: any[]) {
  try {
    const fp = JSON.stringify(data.map((x: any) => x.id ?? x.key).sort());
    localStorage.setItem(`fp_${key}`, fp);
  } catch { /* ignore */ }
}

function getFingerprint(key: string): string | null {
  try { return localStorage.getItem(`fp_${key}`); } catch { return null; }
}

function hasFingerprintChanged(key: string, data: any[]): boolean {
  try {
    const fp = JSON.stringify(data.map((x: any) => x.id ?? x.key).sort());
    return getFingerprint(key) !== fp;
  } catch { return true; }
}

// ── Connection state ─────────────────────────────────────────────────────────
export function onConnectionChange(cb: (connected: boolean) => void) {
  window.addEventListener("firebaseConnectionChange", ((e: CustomEvent) => cb(e.detail.connected)) as EventListener);
}

export function getConnectionState() { return isFirebaseConnected; }

function setConnectionState(connected: boolean) {
  if (isFirebaseConnected === connected) return;
  isFirebaseConnected = connected;
  window.dispatchEvent(new CustomEvent("firebaseConnectionChange", { detail: { connected } }));
}

// ── Config helpers ───────────────────────────────────────────────────────────
export function getFirebaseConfig(): { configured: boolean; projectId?: string } {
  try {
    const cfg = localStorage.getItem("firebase_config");
    if (!cfg) return { configured: false };
    const parsed = JSON.parse(cfg);
    return { configured: !!parsed.projectId, projectId: parsed.projectId };
  } catch { return { configured: false }; }
}

export function saveFirebaseConfig(userConfig: any): boolean {
  try {
    localStorage.setItem("firebase_config", JSON.stringify(userConfig));
    return true;
  } catch { return false; }
}

export function clearFirebaseConfig(): void {
  localStorage.removeItem("firebase_config");
}

// ── Init / Ready ─────────────────────────────────────────────────────────────
export function initFirebase(userConfig?: any): boolean {
  if (app && db) return true;
  try {
    const cfg = userConfig || getFirebaseConfig();
    if (!cfg.configured) return false;
    // Lazy-load and init
    getFirebase().then((fb) => {
      if (!fb) return;
      const { initializeApp } = fb.app;
      const { getDatabase } = fb.db;
      app = initializeApp({
        apiKey: cfg.apiKey,
        authDomain: cfg.authDomain,
        databaseURL: cfg.databaseURL,
        projectId: cfg.projectId,
        storageBucket: cfg.storageBucket,
        messagingSenderId: cfg.messagingSenderId,
        appId: cfg.appId,
      });
      db = getDatabase(app);
      const { onValue, ref } = fb;
      onValue(ref(db, ".info/connected"), (snap: any) => {
        setConnectionState(snap.val() === true);
      });
    });
    return true;
  } catch {
    return false;
  }
}

export function isFirebaseReady(): boolean {
  return !!db;
}

// ── Push helpers ─────────────────────────────────────────────────────────────
export async function flushPendingPushes(): Promise<void> {
  if (isProcessingPushes || pendingPushes.length === 0) return;
  isProcessingPushes = true;
  const batch = [...pendingPushes];
  pendingPushes = [];
  const fb = await getFirebase();
  if (!fb || !db) { isProcessingPushes = false; return; }
  const { set, ref, push, update, remove } = fb;
  for (const op of batch) {
    try {
      if (op.data === null) {
        await remove(ref(db, op.path));
      } else if (op.data.id !== undefined) {
        await set(ref(db, `${op.path}/${op.data.id}`), op.data);
      } else {
        await push(ref(db, op.path), op.data);
      }
      op.resolve(true);
    } catch {
      op.resolve(false);
    }
  }
  isProcessingPushes = false;
}

function queuePush(path: string, data: any): Promise<boolean> {
  return new Promise((resolve) => {
    pendingPushes.push({ path, data, resolve });
    if (!isProcessingPushes) flushPendingPushes();
  });
}

// ── Individual push functions ────────────────────────────────────────────────
export async function pushOrder(order: any): Promise<boolean> {
  if (!isFirebaseReady()) return false;
  const path = getDbPath("orders");
  return queuePush(path, order);
}

export async function pushCheckin(checkin: any): Promise<void> {
  if (!isFirebaseReady()) return;
  const path = getDbPath("checkins");
  await queuePush(path, checkin);
}

export async function pushAppointment(appointment: any): Promise<void> {
  if (!isFirebaseReady()) return;
  const path = getDbPath("appointments");
  await queuePush(path, appointment);
}

export async function pushInvoice(invoice: any): Promise<{ success: boolean; error?: string }> {
  if (!isFirebaseReady()) return { success: false, error: "Firebase not ready" };
  const path = getDbPath("invoices");
  const ok = await queuePush(path, invoice);
  return { success: ok };
}

export async function pushInvoices(invoices: any[]): Promise<{ success: boolean; error?: string }> {
  if (!isFirebaseReady()) return { success: false, error: "Firebase not ready" };
  const path = getDbPath("invoices");
  let ok = true;
  for (const inv of invoices) {
    const result = await queuePush(path, inv);
    if (!result) ok = false;
  }
  return { success: ok };
}

export async function removeOrder(id: number): Promise<void> {
  if (!isFirebaseReady()) return;
  const path = getDbPath("orders");
  await queuePush(`${path}/${id}`, null);
}

export async function removeInvoice(id: number): Promise<void> {
  if (!isFirebaseReady()) return;
  const path = getDbPath("invoices");
  await queuePush(`${path}/${id}`, null);
}

export async function pushFollowUpAction(action: any): Promise<void> {
  if (!isFirebaseReady()) return;
  const path = getDbPath("followUpActions");
  await queuePush(path, action);
}

export async function pushFollowUp(followUp: any): Promise<void> {
  if (!isFirebaseReady()) return;
  const path = getDbPath("followUps");
  await queuePush(path, followUp);
}

export async function pushOneReceipt(receipt: any): Promise<void> {
  if (!isFirebaseReady()) return;
  const path = getDbPath("receipts");
  await queuePush(path, receipt);
}

export async function pushReceipts(receipts: any[]): Promise<void> {
  if (!isFirebaseReady()) return;
  const path = getDbPath("receipts");
  for (const r of receipts) await queuePush(path, r);
}

export async function readFromFirebase(path: string): Promise<any[]> {
  if (!isFirebaseReady()) return [];
  const fb = await getFirebase();
  if (!fb) return [];
  const { get, ref } = fb;
  try {
    const snap = await get(ref(db, path));
    const val = snap.val();
    return val ? Object.values(val) : [];
  } catch {
    return [];
  }
}

export async function pushAppointmentDelete(id: number): Promise<void> {
  if (!isFirebaseReady()) return;
  const path = getDbPath("appointments");
  await queuePush(`${path}/${id}`, null);
}

export async function pushCheckinDelete(id: number): Promise<void> {
  if (!isFirebaseReady()) return;
  const path = getDbPath("checkins");
  await queuePush(`${path}/${id}`, null);
}

export async function pushOneCustomer(customer: any): Promise<void> {
  if (!isFirebaseReady()) return;
  const path = getDbPath("customers");
  await queuePush(path, customer);
}

export async function removeOneCustomer(customerId: number): Promise<void> {
  if (!isFirebaseReady()) return;
  const path = getDbPath("customers");
  await queuePush(`${path}/${customerId}`, null);
}

export async function pushOneStockItem(item: any): Promise<void> {
  if (!isFirebaseReady()) return;
  const path = getDbPath("products");
  await queuePush(path, item);
}

export async function removeOneStockItem(itemId: number): Promise<void> {
  if (!isFirebaseReady()) return;
  const path = getDbPath("products");
  await queuePush(`${path}/${itemId}`, null);
}

export async function pushCorporateCustomer(customer: any): Promise<void> {
  if (!isFirebaseReady()) return;
  const path = getDbPath("corporateCustomers");
  await queuePush(path, customer);
}

export async function removeCorporateCustomer(id: number): Promise<void> {
  if (!isFirebaseReady()) return;
  const path = getDbPath("corporateCustomers");
  await queuePush(`${path}/${id}`, null);
}

export async function pushPurchaseOrder(po: any): Promise<void> {
  if (!isFirebaseReady()) return;
  const path = getDbPath("purchaseOrders");
  await queuePush(path, po);
}

export async function removePurchaseOrder(id: number): Promise<void> {
  if (!isFirebaseReady()) return;
  const path = getDbPath("purchaseOrders");
  await queuePush(`${path}/${id}`, null);
}

export async function pushBarrel(barrel: any): Promise<void> {
  if (!isFirebaseReady()) return;
  const path = getDbPath("barrels");
  await queuePush(path, barrel);
}

export async function removeBarrel(id: number): Promise<void> {
  if (!isFirebaseReady()) return;
  const path = getDbPath("barrels");
  await queuePush(`${path}/${id}`, null);
}

export async function pushCOC(coc: any): Promise<void> {
  if (!isFirebaseReady()) return;
  const path = getDbPath("certificatesOfCompliance");
  await queuePush(path, coc);
}

export async function removeCOC(id: number): Promise<void> {
  if (!isFirebaseReady()) return;
  const path = getDbPath("certificatesOfCompliance");
  await queuePush(`${path}/${id}`, null);
}

export async function pushPackingListLine(pl: any): Promise<void> {
  if (!isFirebaseReady()) return;
  const path = getDbPath("packingListLines");
  await queuePush(path, pl);
}

export async function removePackingListLine(id: number): Promise<void> {
  if (!isFirebaseReady()) return;
  const path = getDbPath("packingListLines");
  await queuePush(`${path}/${id}`, null);
}

export async function pushCustomers(customers: any[]): Promise<void> {
  if (!isFirebaseReady()) return;
  const path = getDbPath("customers");
  for (const c of customers) await queuePush(path, c);
}

export async function pushStock(stock: any[]): Promise<void> {
  if (!isFirebaseReady()) return;
  const path = getDbPath("products");
  for (const s of stock) await queuePush(path, s);
}

export async function pushUser(user: any): Promise<void> {
  if (!isFirebaseReady()) return;
  const path = getDbPath("users");
  await queuePush(path, user);
}

export async function pushSalesRep(rep: any): Promise<void> {
  if (!isFirebaseReady()) return;
  const path = getDbPath("salesReps");
  await queuePush(path, rep);
}

export async function removeSalesRep(repId: any): Promise<void> {
  if (!isFirebaseReady()) return;
  const path = getDbPath("salesReps");
  await queuePush(`${path}/${repId}`, null);
}

export async function pushUserDelete(userId: number): Promise<void> {
  if (!isFirebaseReady()) return;
  const path = getDbPath("users");
  await queuePush(`${path}/${userId}`, null);
}

export async function pushCreditNote(cn: any): Promise<void> {
  if (!isFirebaseReady()) return;
  const path = getDbPath("creditNotes");
  await queuePush(path, cn);
}

export async function pushCollectionNote(note: any): Promise<void> {
  if (!isFirebaseReady()) return;
  const path = getDbPath("collectionNotes");
  await queuePush(path, note);
}

export async function pushCollectionPromise(promise: any): Promise<void> {
  if (!isFirebaseReady()) return;
  const path = getDbPath("collectionPromises");
  await queuePush(path, promise);
}

export async function pushAccountHold(hold: any): Promise<void> {
  if (!isFirebaseReady()) return;
  const path = getDbPath("accountHolds");
  await queuePush(path, hold);
}

export async function pushCustomer(customer: any): Promise<void> {
  if (!isFirebaseReady()) return;
  const path = getDbPath("customers");
  await queuePush(path, customer);
}

export async function pushPackingList(pl: any): Promise<void> {
  if (!isFirebaseReady()) return;
  const path = getDbPath("packingListLines");
  await queuePush(path, pl);
}

export async function pushAudit(audit: any): Promise<void> {
  if (!isFirebaseReady()) return;
  const path = getDbPath("audits");
  await queuePush(path, audit);
}

export async function pushSpecialPrice(sp: any): Promise<void> {
  if (!isFirebaseReady()) return;
  const path = getDbPath("specialPrices");
  await queuePush(path, sp);
}

export async function removeSpecialPrice(id: number): Promise<void> {
  if (!isFirebaseReady()) return;
  const path = getDbPath("specialPrices");
  await queuePush(`${path}/${id}`, null);
}

// ── Pull / sync ──────────────────────────────────────────────────────────────
export async function pullFromCloud(): Promise<Record<string, number>> {
  if (!isFirebaseReady()) return {};
  const { get, ref } = require("firebase/database");
  const counts: Record<string, number> = {};

  const pullType = async (path: string, storageKey: string, postProcess?: (items: any[]) => any[]) => {
    try {
      const timeoutMs = 15000;
      const snapshot = await Promise.race([
        get(ref(db, path)),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Firebase pull timeout: ${path}`)), timeoutMs)
        ),
      ]);
      const data = fbToArray((snapshot as any).val());
      storeFingerprint(storageKey, data);
      let merged = mergeWithCloudData(storageKey, data);
      if (postProcess) merged = postProcess(merged);
      setStorageItem(storageKey, JSON.stringify(merged));
      counts[path] = data.length;
      return data;
    } catch (e: any) {
      console.warn(`[FirebaseSync] pull ${path} failed:`, e.message);
      counts[path] = 0;
      return [];
    }
  };

  const dedupCustomers = (items: any[]) => {
    const custMap = new Map<string, any>();
    for (const c of items) {
      const key = `${c.name || ""}|${c.phone || ""}`.toLowerCase();
      if (!custMap.has(key) || (c.updatedAt > custMap.get(key)!.updatedAt)) {
        custMap.set(key, c);
      }
    }
    return Array.from(custMap.values());
  };

  await pullType("sgf/customers", "sgf_customers", dedupCustomers);
  await pullType("sgf/products", "sgf_products");
  await pullType("sgf/orders", "sgf_orders");
  await pullType("sgf/invoices", "sgf_invoices");
  await pullType("sgf/appointments", "sgf_appointments");
  await pullType("sgf/checkins", "sgf_checkins");
  await pullType("sgf/followUpActions", "sgf_followUpActions");
  await pullType("sgf/followUps", "sgf_followUps");
  await pullType("sgf/receipts", "sgf_receipts");
  await pullType("sgf/users", "sgf_users");
  await pullType("sgf/salesReps", "sgf_salesReps");
  await pullType("sgf/creditNotes", "sgf_creditNotes");
  await pullType("sgf/collectionNotes", "sgf_collectionNotes");
  await pullType("sgf/collectionPromises", "sgf_collectionPromises");
  await pullType("sgf/accountHolds", "sgf_accountHolds");
  await pullType("sgf/specialPrices", "sgf_specialPrices");
  await pullType("sgf/corporateCustomers", "sgf_corporateCustomers");
  await pullType("sgf/purchaseOrders", "sgf_purchaseOrders");
  await pullType("sgf/barrels", "sgf_barrels");
  await pullType("sgf/certificatesOfCompliance", "sgf_cocs");
  await pullType("sgf/packingListLines", "sgf_packingListLines");
  await pullType("sgf/audits", "sgf_audits");

  dataServiceRefresh?.();
  return counts;
}

export async function syncFromCloud(type: string, storageKey: string): Promise<void> {
  await pullFromCloud();
}

function fbToArray(data: any): any[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  return Object.values(data);
}

// ============================================================================
//  Merge helpers
// ============================================================================
export function mergeWithCloudData(key: string, incoming: any[]): any[] {
  try {
    const existingRaw = getStorageItem(key);
    const existing: any[] = existingRaw ? JSON.parse(existingRaw) : [];
    const existingMap = new Map(existing.map((x: any) => [x.id ?? x.key, x]));

    for (const item of incoming) {
      const id = item.id ?? item.key;
      const existingItem = existingMap.get(id);
      if (!existingItem) {
        existingMap.set(id, item);
      } else {
        const incomingTime = item.updatedAt ? new Date(item.updatedAt).getTime() : 0;
        const existingTime = existingItem.updatedAt ? new Date(existingItem.updatedAt).getTime() : 0;
        if (incomingTime >= existingTime) {
          existingMap.set(id, item);
        }
      }
    }

    return Array.from(existingMap.values());
  } catch {
    return incoming;
  }
}

// ============================================================================
//  Subscriptions (real-time listeners)
// ============================================================================
function handleReceived(type: string, storageKey: string) {
  return (items: any[]) => {
    try {
      const existingRaw = getStorageItem(storageKey);
      const existing: any[] = existingRaw ? JSON.parse(existingRaw) : [];
      const merged = mergeWithCloudData(storageKey, items);
      if (hasFingerprintChanged(storageKey, merged)) {
        setStorageItem(storageKey, JSON.stringify(merged));
        window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type, count: items.length } }));
      }
    } catch { /* ignore */ }
  };
}

export function subscribeToCustomers(onData?: (customers: any[]) => void): () => void {
  if (!isFirebaseReady()) return () => {};
  const path = getDbPath("customers");
  const { onValue, ref } = require("firebase/database");
  const unsub = onValue(ref(db, path), (snap: any) => {
    const data = fbToArray(snap.val());
    onData?.(data);
  });
  return unsub;
}

export function subscribeToStock(onData?: (stock: any[]) => void): () => void {
  if (!isFirebaseReady()) return () => {};
  const path = getDbPath("products");
  const { onValue, ref } = require("firebase/database");
  const unsub = onValue(ref(db, path), (snap: any) => {
    const data = fbToArray(snap.val());
    onData?.(data);
  });
  return unsub;
}

export function subscribeToOrders(onData: (orders: any[]) => void): () => void {
  if (!isFirebaseReady()) return () => {};
  const path = getDbPath("orders");
  const { onValue, ref } = require("firebase/database");
  const unsub = onValue(ref(db, path), (snap: any) => {
    const data = fbToArray(snap.val());
    onData(data);
  });
  return unsub;
}

export function subscribeToCheckins(onData: (checkins: any[]) => void): () => void {
  if (!isFirebaseReady()) return () => {};
  const path = getDbPath("checkins");
  const { onValue, ref } = require("firebase/database");
  const unsub = onValue(ref(db, path), (snap: any) => {
    const data = fbToArray(snap.val());
    onData(data);
  });
  return unsub;
}

export function subscribeToAppointments(onData: (appts: any[]) => void): () => void {
  if (!isFirebaseReady()) return () => {};
  const path = getDbPath("appointments");
  const { onValue, ref } = require("firebase/database");
  const unsub = onValue(ref(db, path), (snap: any) => {
    const data = fbToArray(snap.val());
    onData(data);
  });
  return unsub;
}

export function subscribeToInvoices(onData: (invoices: any[]) => void): () => void {
  if (!isFirebaseReady()) return () => {};
  const path = getDbPath("invoices");
  const { onValue, ref } = require("firebase/database");
  const unsub = onValue(ref(db, path), (snap: any) => {
    const data = fbToArray(snap.val());
    onData(data);
  });
  return unsub;
}

export function subscribeToFollowUpActions(onData: (actions: any[]) => void): () => void {
  if (!isFirebaseReady()) return () => {};
  const path = getDbPath("followUpActions");
  const { onValue, ref } = require("firebase/database");
  const unsub = onValue(ref(db, path), (snap: any) => {
    const data = fbToArray(snap.val());
    onData(data);
  });
  return unsub;
}

export function subscribeToFollowUps(onData?: (followUps: any[]) => void): () => void {
  if (!isFirebaseReady()) return () => {};
  const path = getDbPath("followUps");
  const { onValue, ref } = require("firebase/database");
  const unsub = onValue(ref(db, path), (snap: any) => {
    const data = fbToArray(snap.val());
    onData?.(data);
  });
  return unsub;
}

export function subscribeToReceipts(onData?: (receipts: any[]) => void): () => void {
  if (!isFirebaseReady()) return () => {};
  const path = getDbPath("receipts");
  const { onValue, ref } = require("firebase/database");
  const unsub = onValue(ref(db, path), (snap: any) => {
    const data = fbToArray(snap.val());
    onData?.(data);
  });
  return unsub;
}

export function subscribeToSalesReps(onData?: (reps: any[]) => void): () => void {
  if (!isFirebaseReady()) return () => {};
  const path = getDbPath("salesReps");
  const { onValue, ref } = require("firebase/database");
  const unsub = onValue(ref(db, path), (snap: any) => {
    const data = fbToArray(snap.val());
    onData?.(data);
  });
  return unsub;
}

export function subscribeToUsers(onData?: (users: any[]) => void): () => void {
  if (!isFirebaseReady()) return () => {};
  const path = getDbPath("users");
  const { onValue, ref } = require("firebase/database");
  const unsub = onValue(ref(db, path), (snap: any) => {
    const data = fbToArray(snap.val());
    onData?.(data);
  });
  return unsub;
}

export function subscribeToCreditNotes(onData?: (notes: any[]) => void): () => void {
  if (!isFirebaseReady()) return () => {};
  const path = getDbPath("creditNotes");
  const { onValue, ref } = require("firebase/database");
  const unsub = onValue(ref(db, path), (snap: any) => {
    const data = fbToArray(snap.val());
    onData?.(data);
  });
  return unsub;
}

export function subscribeToCollectionNotes(onData?: (notes: any[]) => void): () => void {
  if (!isFirebaseReady()) return () => {};
  const path = getDbPath("collectionNotes");
  const { onValue, ref } = require("firebase/database");
  const unsub = onValue(ref(db, path), (snap: any) => {
    const data = fbToArray(snap.val());
    onData?.(data);
  });
  return unsub;
}

export function subscribeToCollectionPromises(onData?: (promises: any[]) => void): () => void {
  if (!isFirebaseReady()) return () => {};
  const path = getDbPath("collectionPromises");
  const { onValue, ref } = require("firebase/database");
  const unsub = onValue(ref(db, path), (snap: any) => {
    const data = fbToArray(snap.val());
    onData?.(data);
  });
  return unsub;
}

export function subscribeToAccountHolds(onData?: (holds: any[]) => void): () => void {
  if (!isFirebaseReady()) return () => {};
  const path = getDbPath("accountHolds");
  const { onValue, ref } = require("firebase/database");
  const unsub = onValue(ref(db, path), (snap: any) => {
    const data = fbToArray(snap.val());
    onData?.(data);
  });
  return unsub;
}

export function subscribeToSpecialPrices(onData?: (prices: any[]) => void): () => void {
  if (!isFirebaseReady()) return () => {};
  const path = getDbPath("specialPrices");
  const { onValue, ref } = require("firebase/database");
  const unsub = onValue(ref(db, path), (snap: any) => {
    const data = fbToArray(snap.val());
    onData?.(data);
  });
  return unsub;
}

export function subscribeToCorporateCustomers(onData?: (items: any[]) => void): () => void {
  if (!isFirebaseReady()) return () => {};
  const path = getDbPath("corporateCustomers");
  const { onValue, ref } = require("firebase/database");
  const unsub = onValue(ref(db, path), (snap: any) => {
    const data = fbToArray(snap.val());
    onData?.(data);
  });
  return unsub;
}

export function subscribeToPurchaseOrders(onData?: (items: any[]) => void): () => void {
  if (!isFirebaseReady()) return () => {};
  const path = getDbPath("purchaseOrders");
  const { onValue, ref } = require("firebase/database");
  const unsub = onValue(ref(db, path), (snap: any) => {
    const data = fbToArray(snap.val());
    onData?.(data);
  });
  return unsub;
}

export function subscribeToBarrels(onData?: (items: any[]) => void): () => void {
  if (!isFirebaseReady()) return () => {};
  const path = getDbPath("barrels");
  const { onValue, ref } = require("firebase/database");
  const unsub = onValue(ref(db, path), (snap: any) => {
    const data = fbToArray(snap.val());
    onData?.(data);
  });
  return unsub;
}

export function subscribeToCOCs(onData?: (items: any[]) => void): () => void {
  if (!isFirebaseReady()) return () => {};
  const path = getDbPath("certificatesOfCompliance");
  const { onValue, ref } = require("firebase/database");
  const unsub = onValue(ref(db, path), (snap: any) => {
    const data = fbToArray(snap.val());
    onData?.(data);
  });
  return unsub;
}

export function subscribeToPackingListLines(onData?: (items: any[]) => void): () => void {
  if (!isFirebaseReady()) return () => {};
  const path = getDbPath("packingListLines");
  const { onValue, ref } = require("firebase/database");
  const unsub = onValue(ref(db, path), (snap: any) => {
    const data = fbToArray(snap.val());
    onData?.(data);
  });
  return unsub;
}

// ============================================================================
//  Bulk sync helpers
// ============================================================================
export async function syncAllLocalData(localData: {
  customers?: any[];
  products?: any[];
  orders?: any[];
  invoices?: any[];
  appointments?: any[];
  checkins?: any[];
  followUpActions?: any[];
  followUps?: any[];
  receipts?: any[];
  users?: any[];
  salesReps?: any[];
  creditNotes?: any[];
  collectionNotes?: any[];
  collectionPromises?: any[];
  accountHolds?: any[];
  specialPrices?: any[];
  corporateCustomers?: any[];
  purchaseOrders?: any[];
  barrels?: any[];
  certificatesOfCompliance?: any[];
  packingListLines?: any[];
  audits?: any[];
}): Promise<{ success: boolean; counts: Record<string, number> }> {
  if (!isFirebaseReady()) return { success: false, counts: {} };
  const counts: Record<string, number> = {};
  const pushToPath = async (type: string, items: any[]) => {
    const path = getDbPath(type);
    for (const item of items) {
      await queuePush(path, item);
    }
    counts[type] = items.length;
  };
  if (localData.customers) await pushToPath("customers", localData.customers);
  if (localData.products) await pushToPath("products", localData.products);
  if (localData.orders) await pushToPath("orders", localData.orders);
  if (localData.invoices) await pushToPath("invoices", localData.invoices);
  if (localData.appointments) await pushToPath("appointments", localData.appointments);
  if (localData.checkins) await pushToPath("checkins", localData.checkins);
  if (localData.followUpActions) await pushToPath("followUpActions", localData.followUpActions);
  if (localData.followUps) await pushToPath("followUps", localData.followUps);
  if (localData.receipts) await pushToPath("receipts", localData.receipts);
  if (localData.users) await pushToPath("users", localData.users);
  if (localData.salesReps) await pushToPath("salesReps", localData.salesReps);
  if (localData.creditNotes) await pushToPath("creditNotes", localData.creditNotes);
  if (localData.collectionNotes) await pushToPath("collectionNotes", localData.collectionNotes);
  if (localData.collectionPromises) await pushToPath("collectionPromises", localData.collectionPromises);
  if (localData.accountHolds) await pushToPath("accountHolds", localData.accountHolds);
  if (localData.specialPrices) await pushToPath("specialPrices", localData.specialPrices);
  if (localData.corporateCustomers) await pushToPath("corporateCustomers", localData.corporateCustomers);
  if (localData.purchaseOrders) await pushToPath("purchaseOrders", localData.purchaseOrders);
  if (localData.barrels) await pushToPath("barrels", localData.barrels);
  if (localData.certificatesOfCompliance) await pushToPath("certificatesOfCompliance", localData.certificatesOfCompliance);
  if (localData.packingListLines) await pushToPath("packingListLines", localData.packingListLines);
  if (localData.audits) await pushToPath("audits", localData.audits);
  return { success: true, counts };
}

export async function forcePushAllLocalData(onProgress?: (done: number, total: number, currentType: string) => void): Promise<{
  success: boolean;
  counts: Record<string, number>;
}> {
  try {
    const types = [
      "customers", "products", "orders", "invoices", "appointments",
      "checkins", "followUpActions", "followUps", "receipts", "users",
      "salesReps", "creditNotes", "collectionNotes", "collectionPromises",
      "accountHolds", "specialPrices", "corporateCustomers", "purchaseOrders",
      "barrels", "certificatesOfCompliance", "packingListLines", "audits"
    ];
    const counts: Record<string, number> = {};
    let done = 0;
    for (const type of types) {
      const key = `sgf_${type}`;
      const raw = getStorageItem(key);
      const items = raw ? JSON.parse(raw) : [];
      if (items.length > 0) {
        await syncAllLocalData({ [type]: items });
        counts[type] = items.length;
      }
      done++;
      onProgress?.(done, types.length, type);
    }
    return { success: true, counts };
  } catch (e: any) {
    return { success: false, counts: {} };
  }
}

export async function forcePullAllFromCloud(): Promise<{
  success: boolean;
  counts: Record<string, number>;
}> {
  try {
    const counts = await pullFromCloud();
    return { success: true, counts };
  } catch (e: any) {
    return { success: false, counts: {} };
  }
}

export async function diagnoseSync(): Promise<{
  firebaseReady: boolean;
  connected: boolean;
  localCounts: Record<string, number>;
  cloudCounts: Record<string, number>;
}> {
  const localCounts: Record<string, number> = {};
  const types = [
    "customers", "products", "orders", "invoices", "appointments",
    "checkins", "followUpActions", "followUps", "receipts", "users",
    "salesReps", "creditNotes", "collectionNotes", "collectionPromises",
    "accountHolds", "specialPrices", "corporateCustomers", "purchaseOrders",
    "barrels", "certificatesOfCompliance", "packingListLines", "audits"
  ];
  for (const type of types) {
    const key = `sgf_${type}`;
    const raw = getStorageItem(key);
    const items = raw ? JSON.parse(raw) : [];
    localCounts[type] = items.length;
  }
  const cloudCounts = isFirebaseReady() ? await pullFromCloud() : {};
  return {
    firebaseReady: isFirebaseReady(),
    connected: getConnectionState(),
    localCounts,
    cloudCounts,
  };
}

export async function forceResetAndSync(): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    if (!isFirebaseReady()) return { success: false, message: "Firebase not ready" };
    await pullFromCloud();
    return { success: true, message: "Sync completed" };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}

export async function clearCloudData(): Promise<boolean> {
  if (!isFirebaseReady()) return false;
  const fb = await getFirebase();
  if (!fb) return false;
  const { remove, ref } = fb;
  try {
    await remove(ref(db, getDbPath("")));
    return true;
  } catch {
    return false;
  }
}

export function unsubscribeAll(): void {
  if (autoSyncCleanup) {
    autoSyncCleanup();
    autoSyncCleanup = null;
  }
}

export function isAutoSyncInitialized(): boolean {
  return autoSyncInitialized;
}

export function disconnectFirebase(): void {
  if (app) {
    try { app.delete(); } catch { /* ignore */ }
  }
  app = null;
  db = null;
  setConnectionState(false);
}

export function reconnectFirebase(): void {
  initFirebase();
}

export function registerDataServiceRefresh(fn: RefreshFn): void {
  dataServiceRefresh = fn;
}

// ============================================================================
//  Auto-sync bootstrap
// ============================================================================
export function initAutoSync(): () => void {
  if (autoSyncInitialized) return autoSyncCleanup || (() => {});
  autoSyncInitialized = true;

  const unsubs: (() => void)[] = [];
  unsubs.push(subscribeToCustomers(handleReceived("customers", "sgf_customers")));
  unsubs.push(subscribeToStock(handleReceived("products", "sgf_products")));
  unsubs.push(subscribeToOrders(handleReceived("orders", "sgf_orders")));
  unsubs.push(subscribeToCheckins(handleReceived("checkins", "sgf_checkins")));
  unsubs.push(subscribeToAppointments(handleReceived("appointments", "sgf_appointments")));
  unsubs.push(subscribeToInvoices(handleReceived("invoices", "sgf_invoices")));
  unsubs.push(subscribeToFollowUpActions(handleReceived("followUpActions", "sgf_followUpActions")));
  unsubs.push(subscribeToFollowUps(handleReceived("followUps", "sgf_followUps")));
  unsubs.push(subscribeToReceipts(handleReceived("receipts", "sgf_receipts")));
  unsubs.push(subscribeToUsers(handleReceived("users", "sgf_users")));
  unsubs.push(subscribeToSalesReps(handleReceived("salesReps", "sgf_salesReps")));
  unsubs.push(subscribeToCreditNotes(handleReceived("creditNotes", "sgf_creditNotes")));
  unsubs.push(subscribeToCollectionNotes(handleReceived("collectionNotes", "sgf_collectionNotes")));
  unsubs.push(subscribeToCollectionPromises(handleReceived("collectionPromises", "sgf_collectionPromises")));
  unsubs.push(subscribeToAccountHolds(handleReceived("accountHolds", "sgf_accountHolds")));
  unsubs.push(subscribeToSpecialPrices(handleReceived("specialPrices", "sgf_specialPrices")));
  // ═══ CORPORATE MODULE — real-time subscriptions
  unsubs.push(subscribeToCorporateCustomers(handleReceived("corporateCustomers", "sgf_corporateCustomers")));
  unsubs.push(subscribeToPurchaseOrders(handleReceived("purchaseOrders", "sgf_purchaseOrders")));
  unsubs.push(subscribeToBarrels(handleReceived("barrels", "sgf_barrels")));
  unsubs.push(subscribeToCOCs(handleReceived("certificatesOfCompliance", "sgf_cocs")));
  unsubs.push(subscribeToPackingListLines(handleReceived("packingListLines", "sgf_packingListLines")));

  autoSyncCleanup = () => {
    autoSyncInitialized = false;
    if (initRetryTimer) { clearTimeout(initRetryTimer); initRetryTimer = null; }
    if (eventDebounceTimer) { clearTimeout(eventDebounceTimer); eventDebounceTimer = null; }
    pendingEventTypes.clear();
    for (const u of unsubs) u();
  };

  return autoSyncCleanup;
}
// Built: 2026-07-07T16:33:54Z
