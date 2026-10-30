/**
 * Firebase Realtime Database Sync
 * =============================================================================
 * Setup: Go to Settings > Cloud Sync in the app and paste your Firebase config.
 * Or: Set the config in localStorage key "sgf_firebase_config" as JSON.
 *
 * To get a Firebase config:
 * 1. Go to https://console.firebase.google.com/
 * 2. Create a project
 * 3. Go to Project Settings > General
 * 4. Scroll down to "Your apps" and copy the config object
 * 5. Paste it into the app's Settings > Cloud Sync page
 * =============================================================================
 */

import { reloadFromStorage } from "./dataService";
import { getStorageItem, setStorageItem, removeStorageItem } from "./compressedStorage";
import { initializeApp, getApps } from "firebase/app";
import {
  getDatabase,
  ref,
  set,
  onValue,
  update,
  get,
  onDisconnect,
  remove,
} from "firebase/database";

const CONFIG_KEY = "sgf_firebase_config";

/** Firebase RTDB keys cannot contain ".", "#", "$", "[", or "]".
 *  This function sanitizes any ID to be a valid Firebase key. */
function safeFbKey(id: any): string {
  // Firebase RTDB path separator is / — MUST escape it or keys become nested paths
  return String(id).replace(/[.#$[\]\/]/g, '_');
}

// Supreme Global Foods Firebase — auto-connects
const DEFAULT_CONFIG = {
  apiKey: "AIzaSyAj68G-CmO9ImmBB5MgPwlas389gHWqPu8",
  authDomain: "supreme-global-foods-835b0.firebaseapp.com",
  databaseURL: "https://supreme-global-foods-835b0-default-rtdb.firebaseio.com",
  projectId: "supreme-global-foods-835b0",
  storageBucket: "supreme-global-foods-835b0.firebasestorage.app",
  messagingSenderId: "570220829537",
  appId: "1:570220829537:web:3c8d3c870887e9cc7a4320",
};

export function getConfigFromStorage(): any {
  try {
    const stored = getStorageItem(CONFIG_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && parsed.apiKey && !parsed.apiKey.includes("PLACEHOLDER")) {
        return parsed;
      }
    }
  } catch { /* ignore */ }
  // Return the built-in real config — no setup needed
  return DEFAULT_CONFIG;
}

let db: any = null;
let config: any = null;
let listeners: Array<() => void> = [];

/** Session-level guard: pullFromCloud should only run once per session.
 *  Real-time subscriptions handle ongoing sync after initial pull. */
let pullFromCloudDone = false;

/** Connection state monitoring */
let connectionListener: (() => void) | null = null;
let isFirebaseConnected = false;
let connectionCallbacks: Array<(connected: boolean) => void> = [];

export function onConnectionChange(cb: (connected: boolean) => void) {
  connectionCallbacks.push(cb);
  cb(isFirebaseConnected);
  return () => { connectionCallbacks = connectionCallbacks.filter((c) => c !== cb); };
}

export function getConnectionState() { return isFirebaseConnected; }

function setConnectionState(connected: boolean) {
  if (isFirebaseConnected === connected) return;
  isFirebaseConnected = connected;
  connectionCallbacks.forEach((cb) => cb(connected));
}

/** Set up Firebase connection state monitoring */
function monitorConnection() {
  if (!db) return;
  const connectedRef = ref(db, ".info/connected");
  if (connectionListener) connectionListener();
  connectionListener = onValue(connectedRef, (snap: any) => {
    setConnectionState(snap.val() === true);
  });
}
export function initFirebase(userConfig?: any): boolean {
  // If user provides config, save it
  if (userConfig && userConfig.apiKey && !userConfig.apiKey.includes("PLACEHOLDER")) {
    config = userConfig;
    try { setStorageItem(CONFIG_KEY, JSON.stringify(userConfig)); } catch { /* ignore */ }
  }

  // Try to get config from storage if not already set
  if (!config) {
    config = getConfigFromStorage();
  }

  // No valid config? Can't initialize
  if (!config || !config.apiKey || config.apiKey.includes("PLACEHOLDER")) {
    return false;
  }

  // Already initialized with same config?
  const existingApps = getApps();
  if (existingApps.length > 0) {
    db = getDatabase(existingApps[0]);
    monitorConnection();
    return true;
  }

  try {
    const app = initializeApp(config);
    db = getDatabase(app);
    monitorConnection();

    return true;
  } catch (e: any) {

    return false;
  }
}

/** Returns true if Firebase is ready to use */
export function isFirebaseReady(): boolean {
  if (db) return true;
  return initFirebase();
}

/** Get current config status */
export function getFirebaseConfig(): { configured: boolean; projectId?: string } {
  const cfg = getConfigFromStorage();
  return {
    configured: !!(cfg && cfg.apiKey && !cfg.apiKey.includes("PLACEHOLDER")),
    projectId: cfg?.projectId,
  };
}

/** Save config from user input */
export function saveFirebaseConfig(userConfig: any): boolean {
  try {
    setStorageItem(CONFIG_KEY, JSON.stringify(userConfig));
    config = userConfig;
    return initFirebase(userConfig);
  } catch {
    return false;
  }
}

/** Clear config */
export function clearFirebaseConfig(): void {
  removeStorageItem(CONFIG_KEY);
  config = null;
  db = null;
}

// =============================================================================
// PENDING PUSH QUEUE: Store items that couldn't be pushed because Firebase was
// offline. When Firebase comes back online, we flush the queue automatically.
// =============================================================================
const PENDING_QUEUE_KEY = "sgf_pendingPushQueue";

type PendingPush = { type: string; item: any; timestamp: number };

function getPendingQueue(): PendingPush[] {
  try {
    const raw = getStorageItem(PENDING_QUEUE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

function savePendingQueue(queue: PendingPush[]): void {
  try {
    setStorageItem(PENDING_QUEUE_KEY, JSON.stringify(queue));
  } catch { /* ignore */ }
}

function addToPendingQueue(type: string, item: any): void {
  const queue = getPendingQueue();
  // Don't add duplicates for the same item (by id)
  const existingIdx = queue.findIndex(
    (p) => p.item?.id != null && p.item.id == item?.id && p.type === type
  );
  if (existingIdx >= 0) {
    queue[existingIdx] = { type, item, timestamp: Date.now() };
  } else {
    queue.push({ type, item, timestamp: Date.now() });
  }
  savePendingQueue(queue);

}

/** Flush all pending pushes to Firebase. Called when Firebase becomes ready. */
export async function flushPendingPushes(): Promise<void> {
  if (!isFirebaseReady()) {

    return;
  }
  const queue = getPendingQueue();
  if (queue.length === 0) return;

  const remaining: PendingPush[] = [];

  for (const { type, item } of queue) {
    try {
      switch (type) {
        case "customer": await pushOneCustomer(item); break;
        case "order": await pushOrder(item); break;
        case "invoice": await pushInvoice(item); break;
        case "appointment": await pushAppointment(item); break;
        case "checkin": await pushCheckin(item); break;
        case "user": await pushUser(item); break;
        case "salesRep": await pushSalesRep(item); break;
        case "stock": await pushOneStockItem(item); break;
        case "corporateCustomer": await pushCorporateCustomer(item); break;
        case "purchaseOrder": await pushPurchaseOrder(item); break;
        case "barrel": await pushBarrel(item); break;
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
