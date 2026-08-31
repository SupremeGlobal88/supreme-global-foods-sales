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

import { dataService, reloadFromStorage } from "./dataService";
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
    console.log("[FirebaseSync] Initialized with project:", config.projectId);
    return true;
  } catch (e: any) {
    console.warn("[FirebaseSync] Init failed:", e.message);
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
  console.warn(
    `[FirebaseSync] Queued ${type} for later sync (Firebase not ready):`,
    item?.name || item?.id
  );
}

/** Flush all pending pushes to Firebase. Called when Firebase becomes ready. */
export async function flushPendingPushes(): Promise<void> {
  if (!isFirebaseReady()) {
    console.warn("[FirebaseSync] Cannot flush pending pushes — Firebase not ready");
    return;
  }
  const queue = getPendingQueue();
  if (queue.length === 0) return;

  console.log(`[FirebaseSync] Flushing ${queue.length} pending pushes...`);
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
        default: console.warn("[flushPendingPushes] Unknown type:", type);
      }
    } catch (e: any) {
      console.error(`[flushPendingPushes] FAILED ${type}:`, e.message);
      remaining.push({ type, item, timestamp: Date.now() });
    }
  }

  savePendingQueue(remaining);
  console.log(
    `[FirebaseSync] Flushed ${queue.length - remaining.length}/${queue.length} pending pushes. ${remaining.length} remaining.`
  );
}

// =============================================================================
// PUSH: Save a single item to Firebase
// =============================================================================

export async function pushOrder(order: any): Promise<boolean> {
  if (!isFirebaseReady()) { addToPendingQueue("order", order); return false; }
  try {
    await set(ref(db, `orders/${safeFbKey(order.id)}`), { ...order, _syncedAt: Date.now() });
    return true;
  } catch (e: any) { console.warn("[FirebaseSync] pushOrder failed:", e.message); return false; }
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
  } catch (e: any) { console.error(`[pushAppointment] FAILED: ${appointment?.id}:`, e.message); }
}

export async function pushInvoice(invoice: any): Promise<{ success: boolean; error?: string }> {
  if (!isFirebaseReady()) { addToPendingQueue("invoice", invoice); return { success: false, error: "Firebase not ready — queued for sync" }; }
  if (!invoice || !invoice.id) return { success: false, error: "Invalid invoice (no id)" };
  try {
    await set(ref(db, `invoices/${safeFbKey(invoice.id)}`), { ...invoice, _syncedAt: Date.now() });
    return { success: true };
  } catch (e: any) {
    console.error("[pushInvoice] FAILED:", invoice.invoiceNumber || invoice.id, e.message);
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
    console.error("[pushInvoices] FAILED:", e.message);
    return { success: false, error: e.message };
  }
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

/** Push a single receipt to Firebase (safe — won't overwrite other users' receipts).
 *  Use this for individual payment recording operations.
 *  Only use pushReceiptsFullList for explicit bulk operations. */
export async function pushOneReceipt(receipt: any): Promise<void> {
  if (!isFirebaseReady()) { addToPendingQueue("receipt", receipt); return; }
  try { await set(ref(db, `receipts/${safeFbKey(receipt.id)}`), { ...receipt, _syncedAt: Date.now() }); } catch { /* ignore */ }
}

/** ⚠️ DANGER: Replaces ENTIRE receipts list in Firebase.
 *  Only use for explicit bulk operations. */
export async function pushReceipts(receipts: any[]): Promise<void> {
  if (!isFirebaseReady()) return;
  try { await set(ref(db, "receipts"), receipts); } catch { /* ignore */ }
}

// =============================================================================
// READ: Read directly from Firebase — CLOUD FIRST approach
// Every query handler in localLink.ts calls this to get LATEST Firebase data
// before returning results. This ensures all users see live cloud data.
// =============================================================================

const FB_PATHS: Record<string, string> = {
  orders: "orders",
  invoices: "invoices",
  customers: "customers",
  stock: "stock",
  appointments: "appointments",
  checkins: "checkins",
  followUps: "followUps",
  followUpActions: "followUpActions",
  receipts: "receipts",
  users: "users",
  salesReps: "salesReps",
  creditNotes: "creditNotes",
  corporateCustomers: "corporateCustomers",
  purchaseOrders: "purchaseOrders",
  barrels: "barrels",
  certificatesOfCompliance: "certificatesOfCompliance",
  packingListLines: "packingListLines",
};

/** Read data directly from Firebase. Returns array of items or empty array.
 *  This is the CLOUD FIRST read — every query goes to Firebase first.
 *  CRITICAL: 10-second timeout prevents the app from hanging forever if Firebase is slow/unresponsive. */
export async function readFromFirebase(path: string): Promise<any[]> {
  if (!isFirebaseReady()) return [];
  try {
    // Race Firebase get() against a 15-second timeout to prevent indefinite hangs.
    // Large datasets download via onValue subscription; readFromFirebase is a backup.
    const timeoutMs = 15000;
    const snapshot = await Promise.race([
      get(ref(db, FB_PATHS[path] || path)),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Firebase read timeout: ${path}`)), timeoutMs)
      ),
    ]);
    const val = (snapshot as any).val();
    if (!val) return [];
    // Handle both array and object formats
    if (Array.isArray(val)) return val.filter((x) => x != null);
    return Object.values(val).filter((x) => x != null);
  } catch (e: any) {
    console.warn(`[FirebaseSync] read ${path} failed:`, e.message);
    return [];
  }
}

export async function pushAppointmentDelete(id: number): Promise<void> {
  if (!isFirebaseReady()) return;
  try { await set(ref(db, `appointments/${safeFbKey(id)}`), null); } catch { /* ignore */ }
}

export async function pushCheckinDelete(id: number): Promise<void> {
  if (!isFirebaseReady()) return;
  try { await set(ref(db, `checkins/${safeFbKey(id)}`), null); } catch { /* ignore */ }
}

// Customer and Stock sync — admin pushes, sales reps pull
/** Push a single customer to Firebase (safe — won't overwrite other users' data).
 *  If Firebase is not ready, the customer is queued for later sync.
 *  Only use pushCustomersFullList for explicit bulk operations. */
export async function pushOneCustomer(customer: any): Promise<void> {
  if (!isFirebaseReady()) {
    addToPendingQueue("customer", customer);
    return;
  }
  try {
    await set(ref(db, `customers/${safeFbKey(customer.id)}`), { ...customer, _syncedAt: Date.now() });
  } catch (e: any) {
    console.error(`[pushOneCustomer] FAILED: ${customer?.name} (${customer?.id}):`, e.message);
  }
}

/** Remove a single customer from Firebase by ID */
export async function removeOneCustomer(customerId: number): Promise<void> {
  if (!isFirebaseReady()) return;
  try { await set(ref(db, `customers/${safeFbKey(customerId)}`), null); } catch { /* ignore */ }
}

/** Push a single stock item to Firebase (safe — won't overwrite other users' data).
 *  Use this for individual create/update/delete operations.
 *  Only use pushStockFullList for explicit bulk operations. */
export async function pushOneStockItem(item: any): Promise<void> {
  if (!isFirebaseReady()) { addToPendingQueue("stock", item); return; }
  try { await set(ref(db, `stock/${safeFbKey(item.id)}`), { ...item, _syncedAt: Date.now() }); } catch { /* ignore */ }
}

/** Remove a single stock item from Firebase by ID */
export async function removeOneStockItem(itemId: number): Promise<void> {
  if (!isFirebaseReady()) return;
  try { await set(ref(db, `stock/${safeFbKey(itemId)}`), null); } catch { /* ignore */ }
}

// ═══════════════════════════════════════════════════════════════
// CORPORATE MODULE PUSH
// ═══════════════════════════════════════════════════════════════
export async function pushCorporateCustomer(customer: any): Promise<void> {
  if (!isFirebaseReady()) { addToPendingQueue("corporateCustomer", customer); return; }
  try { await set(ref(db, `corporateCustomers/${safeFbKey(customer.id)}`), { ...customer, _syncedAt: Date.now() }); } catch { /* ignore */ }
}
export async function removeCorporateCustomer(id: number): Promise<void> {
  if (!isFirebaseReady()) return;
  try { await set(ref(db, `corporateCustomers/${safeFbKey(id)}`), null); } catch { /* ignore */ }
}
export async function pushPurchaseOrder(po: any): Promise<void> {
  if (!isFirebaseReady()) { addToPendingQueue("purchaseOrder", po); return; }
  try { await set(ref(db, `purchaseOrders/${safeFbKey(po.id)}`), { ...po, _syncedAt: Date.now() }); } catch { /* ignore */ }
}
export async function removePurchaseOrder(id: number): Promise<void> {
  if (!isFirebaseReady()) return;
  try { await set(ref(db, `purchaseOrders/${safeFbKey(id)}`), null); } catch { /* ignore */ }
}
export async function pushBarrel(barrel: any): Promise<void> {
  if (!isFirebaseReady()) { addToPendingQueue("barrel", barrel); return; }
  try { await set(ref(db, `barrels/${safeFbKey(barrel.id)}`), { ...barrel, _syncedAt: Date.now() }); } catch { /* ignore */ }
}
export async function removeBarrel(id: number): Promise<void> {
  if (!isFirebaseReady()) return;
  try { await set(ref(db, `barrels/${safeFbKey(id)}`), null); } catch { /* ignore */ }
}
export async function pushCOC(coc: any): Promise<void> {
  if (!isFirebaseReady()) { addToPendingQueue("coc", coc); return; }
  try { await set(ref(db, `certificatesOfCompliance/${safeFbKey(coc.id)}`), { ...coc, _syncedAt: Date.now() }); } catch { /* ignore */ }
}
export async function removeCOC(id: number): Promise<void> {
  if (!isFirebaseReady()) return;
  try { await set(ref(db, `certificatesOfCompliance/${safeFbKey(id)}`), null); } catch { /* ignore */ }
}
export async function pushPackingListLine(pl: any): Promise<void> {
  if (!isFirebaseReady()) return;
  try { await set(ref(db, `packingListLines/${safeFbKey(pl.id)}`), { ...pl, _syncedAt: Date.now() }); } catch { /* ignore */ }
}
export async function removePackingListLine(id: number): Promise<void> {
  if (!isFirebaseReady()) return;
  try { await set(ref(db, `packingListLines/${safeFbKey(id)}`), null); } catch { /* ignore */ }
}

/** ⚠️ DANGER: Replaces ENTIRE customer list in Firebase.
 *  Only use for explicit bulk operations (import, initial sync).
 *  NEVER use after a single create/update — it will delete other users' customers. */
export async function pushCustomers(customers: any[]): Promise<void> {
  if (!isFirebaseReady()) return;
  try { await set(ref(db, "customers"), customers); } catch { /* ignore */ }
}

/** ⚠️ DANGER: Replaces ENTIRE stock list in Firebase.
 *  Only use for explicit bulk operations (bulk upload, initial sync).
 *  NEVER use after a single create/update — it will delete other users' stock items. */
export async function pushStock(stock: any[]): Promise<void> {
  if (!isFirebaseReady()) return;
  try {
    // Push each item individually using safeFbKey (consistent with other push operations)
    for (const item of stock) {
      if (item && item.id != null) {
        await set(ref(db, `stock/${safeFbKey(item.id)}`), { ...item, _syncedAt: Date.now() });
      }
    }
  } catch (e: any) {
    console.error("[pushStock] FAILED:", e.message);
  }
}

export async function pushUser(user: any): Promise<void> {
  if (!isFirebaseReady()) { addToPendingQueue("user", user); return; }
  try {
    await set(ref(db, `users/${safeFbKey(user.id)}`), { ...user, _syncedAt: Date.now() });
  } catch (e: any) {
    console.error("[pushUser] FAILED:", user?.name, user?.id, e.message);
  }
}

export async function pushSalesRep(rep: any): Promise<void> {
  if (!isFirebaseReady()) { addToPendingQueue("salesRep", rep); return; }
  try {
    // Use the rep NAME as the Firebase key (stable, doesn't change on deletions)
    const key = safeFbKey(rep.name || String(rep));
    // Push the FULL rep object (including email, phone, etc.) plus sync timestamp
    const payload = { ...rep, _syncedAt: Date.now() };
    delete payload.id; // Don't store UI-only id in Firebase
    await set(ref(db, `salesReps/${key}`), cleanForFirebase(payload));
  } catch (e: any) {
    console.error("[pushSalesRep] FAILED:", rep?.name, e.message);
  }
}

export async function removeSalesRep(repId: any): Promise<void> {
  if (!isFirebaseReady()) return;
  try {
    // repId may be a SalesRep object, a name string, or a numeric id
    const name = typeof repId === "string" ? repId : repId?.name;
    const key = safeFbKey(name || String(repId));
    await set(ref(db, `salesReps/${key}`), null);
  } catch (e: any) {
    console.error("[removeSalesRep] FAILED:", repId, e.message);
  }
}

export async function pushUserDelete(userId: number): Promise<void> {
  if (!isFirebaseReady()) return;
  try {
    await set(ref(db, `users/${safeFbKey(userId)}`), null);
  } catch (e: any) {
    console.error("[pushUserDelete] FAILED:", userId, e.message);
  }
}

/** Strip undefined values and convert Dates for Firebase RTDB.
 *  Firebase cannot store undefined values or Date objects. */
function cleanForFirebase(obj: any): any {
  if (obj === null || typeof obj !== "object") return obj;
  if (obj instanceof Date) return obj.toISOString();
  if (Array.isArray(obj)) return obj.map(cleanForFirebase);
  const cleaned: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      cleaned[key] = cleanForFirebase(value);
    }
  }
  return cleaned;
}

/** Push a single credit note to Firebase */
export async function pushCreditNote(cn: any): Promise<void> {
  if (!isFirebaseReady() || !cn || !cn.id) return;
  try {
    await set(ref(db, `creditNotes/${safeFbKey(cn.id)}`), cleanForFirebase(cn));
  } catch (e: any) {
    console.error("[pushCreditNote] FAILED:", cn.creditNoteNumber, e.message);
  }
}

/** Subscribe to real-time credit note updates */
export function subscribeToCreditNotes(onData?: (notes: any[]) => void): () => void {
  return createSubscription("creditNotes", "sgf_creditNotes", onData);
}

// ═══════════════════════════════════════════════════════════════
// CORPORATE MODULE SUBSCRIPTIONS
// ═══════════════════════════════════════════════════════════════

export function subscribeToCorporateCustomers(onData?: (items: any[]) => void): () => void {
  return createSubscription("corporateCustomers", "sgf_corporateCustomers", onData);
}

export function subscribeToPurchaseOrders(onData?: (items: any[]) => void): () => void {
  return createSubscription("purchaseOrders", "sgf_purchaseOrders", onData);
}

export function subscribeToBarrels(onData?: (items: any[]) => void): () => void {
  return createSubscription("barrels", "sgf_barrels", onData);
}

export function subscribeToCOCs(onData?: (items: any[]) => void): () => void {
  return createSubscription("certificatesOfCompliance", "sgf_cocs", onData);
}

export function subscribeToPackingListLines(onData?: (items: any[]) => void): () => void {
  return createSubscription("packingListLines", "sgf_packingListLines", onData);
}

// =============================================================================
// MANUAL PULL: Force-fetch all data from Firebase into localStorage
// =============================================================================

/** Pull all data from Firebase and merge into localStorage. Returns counts per type. */
export async function pullFromCloud(): Promise<Record<string, number>> {
  if (!isFirebaseReady()) return {};
  const counts: Record<string, number> = {};

  const pullType = async (path: string, storageKey: string, postProcess?: (items: any[]) => any[]) => {
    try {
      // CRITICAL: 15-second timeout prevents the app from hanging forever if Firebase is slow.
      // onValue subscription downloads data in parallel; readFromFirebase is a backup check.
      const timeoutMs = 15000;
      const snapshot = await Promise.race([
        get(ref(db, path)),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Firebase pull timeout: ${path}`)), timeoutMs)
        ),
      ]);
      const data = fbToArray((snapshot as any).val());
      // Store fingerprint of raw cloud data BEFORE merge.
      // Subscriptions receive the same raw data; this lets them skip
      // redundant merge/write/reload when data hasn't actually changed.
      storeFingerprint(storageKey, data);
      // ALWAYS merge — even when cloud is empty, to clear deleted items locally
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

  // Customer dedup post-process: same customer from different devices may have different IDs
  const dedupCustomers = (items: any[]) => {
    const custMap = new Map<string, any>();
    for (const c of items) {
      const key = (c.name || "").toString().trim().replace(/\s+/g, " ").toLowerCase();
      if (!key) continue;
      const existing = custMap.get(key);
      if (!existing || ((c.updatedAt || c.createdAt || 0) > (existing.updatedAt || existing.createdAt || 0))) {
        custMap.set(key, c);
      }
    }
    return Array.from(custMap.values());
  };

  await pullType("orders", "sgf_orders");
  await pullType("appointments", "sgf_appointments");
  await pullType("checkins", "sgf_checkins");
  await pullType("invoices", "sgf_invoices");
  await pullType("customers", "sgf_customers", dedupCustomers);
  await pullType("stock", "sgf_products");
  await pullType("followUpActions", "sgf_followUpActions");
  await pullType("followUps", "sgf_followUps");
  await pullType("receipts", "sgf_receipts");
  await pullType("creditNotes", "sgf_creditNotes");
  await pullType("users", "sgf_users");
  await pullType("salesReps", "sgf_salesReps");

  dataServiceRefresh?.();
  return counts;
}

/** Firebase stores arrays as objects with numeric keys. Convert back to array. */
function fbToArray(data: any): any[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  return Object.values(data);
}

// ============================================================================
// DATA FINGERPRINTING: Skip redundant subscription processing
// ============================================================================
// At startup, pullFromCloud() downloads all data and saves to localStorage.
// Then Firebase subscriptions fire with the SAME data. Without fingerprinting,
// each subscription would redundantly merge+compress+write+parse, blocking the
// main thread for 6-10 seconds with 4000+ invoices.
// ============================================================================

const dataFingerprints: Record<string, string> = {};

/** Compute a lightweight fingerprint of an array of items.
 *  Uses item IDs and updatedAt timestamps to detect changes. */
function computeFingerprint(items: any[]): string {
  let hash = items.length * 997;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const id = String(item?.id || "");
    const updatedAt = String(item?.updatedAt || item?.createdAt || "");
    const str = id + ":" + updatedAt;
    for (let j = 0; j < str.length; j++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(j);
      hash |= 0;
    }
  }
  return hash.toString();
}

/** Check if incoming data is different from the last processed batch.
 *  Returns true if changed, false if identical. */
function hasDataChanged(key: string, items: any[]): boolean {
  const fp = computeFingerprint(items);
  const lastFp = dataFingerprints[key];
  if (fp === lastFp) return false;
  dataFingerprints[key] = fp;
  return true;
}

/** Store fingerprint for data that was just pulled from cloud.
 *  Called by pullFromCloud so subscriptions can skip redundant processing. */
function storeFingerprint(key: string, items: any[]): void {
  dataFingerprints[key] = computeFingerprint(items);
}

/** Create a Firebase subscription with automatic change detection.
 *  - Defers expensive merge/write/reload to setTimeout(..., 0) so the
 *    browser stays responsive when multiple subscriptions fire at startup.
 *  - Skips redundant processing when data hasn't actually changed.
 *  - Supports optional postMerge hook (for customer deduplication). */
function createSubscription(
  path: string,
  storageKey: string,
  onData?: (data: any[]) => void,
  options?: {
    postMerge?: (merged: any[]) => any[];
    logPrefix?: string;
  }
): () => void {
  if (!isFirebaseReady()) return () => {};
  const dbRef = ref(db, path);
  const unsub = onValue(dbRef, (snapshot) => {
    const data = snapshot.val();
    const items = fbToArray(data);

    // Defer expensive work to next tick so onValue returns immediately.
    // This prevents the main thread from freezing when 15+ subscriptions
    // fire simultaneously at startup.
    setTimeout(() => {
      // Skip if data hasn't changed since last processing
      if (!hasDataChanged(storageKey, items)) {
        if (onData) onData(items);
        return;
      }

      let merged = mergeWithCloudData(storageKey, items);
      if (options?.postMerge) {
        merged = options.postMerge(merged);
      }
      try {
        setStorageItem(storageKey, JSON.stringify(merged));
        if (options?.logPrefix) {
          console.log(`[FirebaseSync] ${options.logPrefix}: ${items.length} cloud → ${merged.length} merged`);
        }
      } catch { /* ignore */ }
      reloadFromStorage([storageKey]);
      if (onData) onData(items);
    }, 0);
  });
  listeners.push(unsub);
  return unsub;
}

/** Get the stable key for an item based on its data type */
function getStableKey(item: any, storageKey: string): string | null {
  if (!item) return null;
  // For sales reps (objects or strings), use name as the unique identifier
  if (storageKey === "sgf_salesReps" || storageKey === "sgf_salesReps_data") {
    if (item.name != null) return String(item.name);
    if (typeof item === "string") return item;
    return null;
  }
  // For simple string arrays, use the string itself as the stable key
  if (typeof item === "string") return item;
  // ALWAYS use item.id as the stable key for all other data types
  if (item.id != null) return String(item.id);
  return null;
}

/** Smart merge: Firebase is source of truth, but local-only items are preserved.
 *  For items in BOTH, local properties win over null/missing Firebase properties.
 *  This preserves local enrichment (customerCode matching, status updates)
 *  without losing Firebase updates. */
export function mergeWithCloudData(key: string, incoming: any[]): any[] {
  try {
    const raw = getStorageItem(key);
    if (!raw) return incoming;
    const local = JSON.parse(raw) as any[];
    if (!Array.isArray(local) || local.length === 0) return incoming;

    // Build map of incoming (Firebase) items by stable key
    const incomingMap = new Map<string, any>();
    for (const item of incoming) {
      const k = getStableKey(item, key);
      if (k !== null) incomingMap.set(k, item);
    }

    // SAFETY GUARD: If Firebase returns 0 items but local has ANY data,
    // preserve local data. A null snapshot during initial connection or a
    // timeout from readFromFirebase should NEVER wipe local data.
    // Legitimate mass-deletes are extremely rare and should use
    // forceResetAndSync(), not automatic sync.
    if (incoming.length === 0 && local.length > 0) {
      console.warn(`[mergeWithCloudData] SAFETY: Firebase returned 0 ${key} but local has ${local.length} items. Preserving local data.`);
      return local;
    }

    // Start with all Firebase items (source of truth)
    const merged = new Map<string, any>(incomingMap);

    // Add local items that DON'T exist in Firebase (unsynced / newly created).
    // CLOUD-FIRST RULE: If an item was previously synced (_syncedAt exists) but is
    // no longer in Firebase, it was DELETED from the cloud → remove it locally.
    // If an item was NEVER synced (no _syncedAt), it is a local draft → keep it.
    for (const item of local) {
      const k = getStableKey(item, key);
      if (k !== null && !incomingMap.has(k)) {
        if (item._syncedAt) {
          // Previously synced but now deleted from cloud → skip (remove ghost)
          continue;
        }
        // Never synced → preserve as local draft
        merged.set(k, item);
      }
    }

    // For items in BOTH: use timestamp-based merge.
    // If both have updatedAt, the NEWER version wins (prevents stale cloud data
    // from overwriting recent local changes like credit notes, payment edits).
    // If no timestamps, fall back to: local non-null values win over Firebase null.
    for (const item of local) {
      const k = getStableKey(item, key);
      if (k !== null && incomingMap.has(k)) {
        const fbItem = incomingMap.get(k)!;
        const localUpdated = item.updatedAt ? new Date(item.updatedAt).getTime() : 0;
        const fbUpdated = fbItem.updatedAt ? new Date(fbItem.updatedAt).getTime() : 0;
        // Use the newer version as the base
        const mergedItem = localUpdated >= fbUpdated ? { ...item } : { ...fbItem };
        // Always enrich with local properties that are missing/null in the winner
        const loser = localUpdated >= fbUpdated ? fbItem : item;
        for (const prop of Object.keys(loser)) {
          if (loser[prop] != null && mergedItem[prop] == null) {
            mergedItem[prop] = loser[prop];
          }
        }
        merged.set(k, mergedItem);
      }
    }

    // Mark all merged items as synced so future ghost-removal and safety guards work correctly
    const result = Array.from(merged.values());
    for (const item of result) {
      if (item && typeof item === "object") {
        item._syncedAt = item._syncedAt || Date.now();
      }
    }
    return result;
  } catch {
    return incoming;
  }
}

export function subscribeToCustomers(onData?: (customers: any[]) => void): () => void {
  return createSubscription("customers", "sgf_customers", onData, {
    postMerge: (merged) => {
      const custMap = new Map<string, any>();
      for (const c of merged) {
        const key = (c.name || "").toString().trim().replace(/\s+/g, " ").toLowerCase();
        if (!key) continue;
        const existing = custMap.get(key);
        if (!existing || ((c.updatedAt || c.createdAt || 0) > (existing.updatedAt || existing.createdAt || 0))) {
          custMap.set(key, c);
        }
      }
      return Array.from(custMap.values());
    },
    logPrefix: "Downloaded customers from cloud, deduped",
  });
}

export function subscribeToStock(onData?: (stock: any[]) => void): () => void {
  return createSubscription("stock", "sgf_products", onData, {
    logPrefix: "Downloaded products from cloud",
  });
}

// =============================================================================
// PULL: Subscribe to Firebase data changes
// =============================================================================

export function subscribeToOrders(onData: (orders: any[]) => void): () => void {
  return createSubscription("orders", "sgf_orders", onData);
}

export function subscribeToCheckins(onData: (checkins: any[]) => void): () => void {
  return createSubscription("checkins", "sgf_checkins", onData);
}

export function subscribeToAppointments(onData: (appts: any[]) => void): () => void {
  return createSubscription("appointments", "sgf_appointments", onData);
}

export function subscribeToInvoices(onData: (invoices: any[]) => void): () => void {
  return createSubscription("invoices", "sgf_invoices", onData);
}

export function subscribeToFollowUpActions(onData: (actions: any[]) => void): () => void {
  return createSubscription("followUpActions", "sgf_followUpActions", onData);
}

export function subscribeToFollowUps(onData?: (followUps: any[]) => void): () => void {
  return createSubscription("followUps", "sgf_followUps", onData);
}

export function subscribeToReceipts(onData?: (receipts: any[]) => void): () => void {
  return createSubscription("receipts", "sgf_receipts", onData);
}

export function subscribeToSalesReps(onData?: (reps: any[]) => void): () => void {
  return createSubscription("salesReps", "sgf_salesReps", onData);
}

export function subscribeToUsers(onData?: (users: any[]) => void): () => void {
  return createSubscription("users", "sgf_users", onData);
}

// =============================================================================
// INITIAL SYNC: Push all local data to Firebase
// =============================================================================

export async function syncAllLocalData(localData: {
  orders: any[];
  checkins: any[];
  appointments: any[];
  invoices: any[];
}): Promise<{ orders: number; checkins: number; appointments: number; invoices: number }> {
  const result = { orders: 0, checkins: 0, appointments: 0, invoices: 0 };
  if (!isFirebaseReady()) return result;

  // Push orders one at a time
  for (const o of localData.orders) {
    try { await pushOrder(o); result.orders++; } catch (e) { console.error("[sync] order failed:", o.id, e); }
  }

  // Push checkins one at a time
  for (const c of localData.checkins) {
    try { await pushCheckin(c); result.checkins++; } catch (e) { console.error("[sync] checkin failed:", c.id, e); }
  }

  // Push appointments one at a time
  for (const a of localData.appointments) {
    try { await pushAppointment(a); result.appointments++; } catch (e) { console.error("[sync] appointment failed:", a.id, e); }
  }

  // Push invoices one at a time (critical - don't batch 1900+ invoices)
  for (const i of localData.invoices) {
    try { await pushInvoice(i); result.invoices++; } catch (e) { console.error("[sync] invoice failed:", i.id, e); }
  }

  return result;
}

// =============================================================================
// FORCE PUSH: Push ALL local data to Firebase (for Collin/super_admin to ensure
// their data is safely in the cloud). Reads directly from localStorage and
// pushes every item individually — safe, never overwrites other users' data.
// =============================================================================

export async function forcePushAllLocalData(onProgress?: (done: number, total: number, currentType: string) => void): Promise<{
  orders: number; invoices: number; customers: number; stock: number;
  appointments: number; checkins: number; followUps: number; receipts: number;
  errors: string[];
}> {
  const result = { orders: 0, invoices: 0, customers: 0, stock: 0, appointments: 0, checkins: 0, followUps: 0, receipts: 0, errors: [] as string[] };
  if (!isFirebaseReady()) { result.errors.push("Firebase not ready"); return result; }

  // Count total items first for progress reporting
  const lists = [
    { storageKey: "sgf_orders", fbPath: "orders", counter: "orders" as const, label: "Orders" },
    { storageKey: "sgf_invoices", fbPath: "invoices", counter: "invoices" as const, label: "Invoices" },
    { storageKey: "sgf_customers", fbPath: "customers", counter: "customers" as const, label: "Customers" },
    { storageKey: "sgf_products", fbPath: "stock", counter: "stock" as const, label: "Stock" },
    { storageKey: "sgf_appointments", fbPath: "appointments", counter: "appointments" as const, label: "Appointments" },
    { storageKey: "sgf_checkins", fbPath: "checkins", counter: "checkins" as const, label: "Check-ins" },
    { storageKey: "sgf_followUps", fbPath: "followUps", counter: "followUps" as const, label: "Follow-ups" },
    { storageKey: "sgf_receipts", fbPath: "receipts", counter: "receipts" as const, label: "Receipts" },
  ];
  let totalItems = 0;
  for (const list of lists) {
    try {
      const raw = getStorageItem(list.storageKey);
      if (raw) {
        const items = JSON.parse(raw);
        if (Array.isArray(items)) totalItems += items.filter(x => x != null).length;
      }
    } catch { /* ignore */ }
  }

  let pushedSoFar = 0;

  for (const list of lists) {
    try {
      const raw = getStorageItem(list.storageKey);
      if (!raw) continue;
      const items = JSON.parse(raw);
      if (!Array.isArray(items)) continue;

      // Push in batches of 10 for speed (parallel instead of sequential)
      const validItems = items.filter(x => x != null);
      const batchSize = 10;
      for (let i = 0; i < validItems.length; i += batchSize) {
        const batch = validItems.slice(i, i + batchSize);
        await Promise.all(batch.map(async (item) => {
          if (!item) return;
          try {
            const rawId = item.id || item._id || Date.now() + Math.random();
            // Firebase keys cannot contain ".", "#", "$", "[", or "]"
            const safeId = String(rawId).replace(/[.#$[\]]/g, '_');
            await set(ref(db, `${list.fbPath}/${safeId}`), { ...item, _syncedAt: Date.now() });
            (result[list.counter] as number)++;
            pushedSoFar++;
          } catch (e: any) {
            result.errors.push(`${list.fbPath}/${item.id || 'unknown'}: ${e.message}`);
          }
        }));
        if (onProgress) onProgress(pushedSoFar, totalItems, list.label);
      }
      console.log(`[forcePush] Pushed ${result[list.counter]} ${list.label}`);
    } catch (e: any) {
      result.errors.push(`${list.fbPath}: ${e.message}`);
    }
  }

  console.log("[forcePush] COMPLETE:", result);
  return result;
}

// =============================================================================
// FORCE PULL: Pull ALL data from Firebase and MERGE into localStorage.
// For users who need to force-get the latest data from cloud.
// =============================================================================

export async function forcePullAllFromCloud(): Promise<{
  orders: number; invoices: number; customers: number; stock: number;
  appointments: number; checkins: number; followUps: number; receipts: number;
  errors: string[];
}> {
  const result = { orders: 0, invoices: 0, customers: 0, stock: 0, appointments: 0, checkins: 0, followUps: 0, receipts: 0, errors: [] as string[] };
  if (!isFirebaseReady()) { result.errors.push("Firebase not ready"); return result; }

  const pullList = async (fbPath: string, storageKey: string, counter: keyof typeof result) => {
    try {
      const snapshot = await get(ref(db, fbPath));
      const data = fbToArray(snapshot.val());
      if (data.length === 0) return;
      const merged = mergeWithCloudData(storageKey, data);
      setStorageItem(storageKey, JSON.stringify(merged));
      (result[counter] as number) = data.length;
      console.log(`[forcePull] Pulled ${data.length} items from ${fbPath}, merged to ${merged.length}`);
    } catch (e: any) {
      result.errors.push(`${fbPath}: ${e.message}`);
    }
  };

  await pullList("orders", "sgf_orders", "orders");
  await pullList("invoices", "sgf_invoices", "invoices");
  await pullList("customers", "sgf_customers", "customers");
  await pullList("stock", "sgf_products", "stock");
  await pullList("appointments", "sgf_appointments", "appointments");
  await pullList("checkins", "sgf_checkins", "checkins");
  await pullList("followUps", "sgf_followUps", "followUps");
  await pullList("receipts", "sgf_receipts", "receipts");

  dataServiceRefresh?.();
  console.log("[forcePull] COMPLETE:", result);
  return result;
}

// =============================================================================
// DIAGNOSE: Show what's in Firebase vs localStorage (for debugging)
// =============================================================================

export async function diagnoseSync(): Promise<{
  firebase: Record<string, number>;
  localStorage: Record<string, number>;
  ghosts: Record<string, number>;
  drafts: Record<string, number>;
  duplicates: Record<string, number>;
  idMismatches: Record<string, number>;
}> {
  const firebase: Record<string, number> = {};
  const localStorageCounts: Record<string, number> = {};
  const ghosts: Record<string, number> = {};
  const drafts: Record<string, number> = {};
  const duplicates: Record<string, number> = {};
  const idMismatches: Record<string, number> = {};

  const DATA_TYPES = [
    { path: "orders", key: "sgf_orders" },
    { path: "invoices", key: "sgf_invoices" },
    { path: "customers", key: "sgf_customers" },
    { path: "stock", key: "sgf_products" },
    { path: "appointments", key: "sgf_appointments" },
    { path: "checkins", key: "sgf_checkins" },
    { path: "followUps", key: "sgf_followUps" },
    { path: "receipts", key: "sgf_receipts" },
    { path: "creditNotes", key: "sgf_creditNotes" },
    { path: "users", key: "sgf_users" },
    { path: "salesReps", key: "sgf_salesReps" },
  ];

  // Check Firebase
  if (isFirebaseReady()) {
    for (const { path } of DATA_TYPES) {
      try {
        const snapshot = await get(ref(db, path));
        firebase[path] = fbToArray(snapshot.val()).length;
      } catch { firebase[path] = -1; }
    }
  }

  // Check localStorage and detect ghosts/drafts/duplicates
  for (const { path, key } of DATA_TYPES) {
    try {
      const raw = getStorageItem(key);
      if (!raw) { localStorageCounts[key] = 0; ghosts[key] = 0; drafts[key] = 0; duplicates[key] = 0; idMismatches[key] = 0; continue; }
      const parsed = JSON.parse(raw);
      const items = Array.isArray(parsed) ? parsed : [];
      localStorageCounts[key] = items.length;

      // Get Firebase IDs for this type
      let firebaseIds = new Set<string>();
      if (isFirebaseReady() && firebase[path] !== -1) {
        try {
          const snapshot = await get(ref(db, path));
          const fbItems = fbToArray(snapshot.val());
          firebaseIds = new Set(fbItems.map((item: any) => getStableKey(item, key)).filter((k: any) => k !== null));
        } catch { /* ignore */ }
      }

      // Count ghosts (synced but deleted from cloud), drafts (never synced), duplicates, ID mismatches
      let ghostCount = 0;
      let draftCount = 0;
      let dupCount = 0;
      let mismatchCount = 0;
      const seenIds = new Set<string>();
      const seenIdTypes = new Map<string, { string: boolean; number: boolean }>();

      for (const item of items) {
        const k = getStableKey(item, key);
        if (k === null) continue;

        // Ghost detection: has _syncedAt but not in Firebase
        if (item._syncedAt && !firebaseIds.has(k)) {
          ghostCount++;
        }
        // Draft detection: no _syncedAt and not in Firebase
        if (!item._syncedAt && !firebaseIds.has(k)) {
          draftCount++;
        }
        // Duplicate detection
        if (seenIds.has(k)) {
          dupCount++;
        } else {
          seenIds.add(k);
        }
        // ID type mismatch detection
        if (!seenIdTypes.has(k)) {
          seenIdTypes.set(k, { string: false, number: false });
        }
        const typeInfo = seenIdTypes.get(k)!;
        if (typeof item.id === "string") typeInfo.string = true;
        if (typeof item.id === "number") typeInfo.number = true;
      }

      // Count ID type mismatches (same stable key but different ID types)
      for (const [, typeInfo] of seenIdTypes) {
        if (typeInfo.string && typeInfo.number) {
          mismatchCount++;
        }
      }

      ghosts[key] = ghostCount;
      drafts[key] = draftCount;
      duplicates[key] = dupCount;
      idMismatches[key] = mismatchCount;
    } catch {
      localStorageCounts[key] = -1;
      ghosts[key] = -1;
      drafts[key] = -1;
      duplicates[key] = -1;
      idMismatches[key] = -1;
    }
  }

  console.log("[diagnoseSync] Firebase:", firebase);
  console.log("[diagnoseSync] localStorage:", localStorageCounts);
  console.log("[diagnoseSync] ghosts:", ghosts);
  console.log("[diagnoseSync] drafts:", drafts);
  console.log("[diagnoseSync] duplicates:", duplicates);
  console.log("[diagnoseSync] idMismatches:", idMismatches);
  return { firebase, localStorage: localStorageCounts, ghosts, drafts, duplicates, idMismatches };
}

// =============================================================================
// FORCE RESET & SYNC: Emergency clear all local data and re-pull from Firebase
// Use this when a device has corrupted data that won't sync properly.
// =============================================================================

export async function forceResetAndSync(): Promise<{
  cleared: string[];
  pulled: Record<string, number>;
  success: boolean;
}> {
  const result = { cleared: [] as string[], pulled: {} as Record<string, number>, success: false };

  if (!isFirebaseReady()) {
    console.warn("[forceResetAndSync] Firebase not ready");
    return result;
  }

  // Step 1: Clear all transaction data from localStorage
  const keysToClear = [
    "sgf_orders", "sgf_invoices", "sgf_checkins", "sgf_appointments",
    "sgf_receipts", "sgf_creditNotes", "sgf_followUps", "sgf_followUpActions",
    "sgf_collectionNotes", "sgf_collectionPromises", "sgf_accountHolds",
    "sgf_specialPrices", "sgf_auditLog",
  ];

  for (const key of keysToClear) {
    try {
      removeStorageItem(key);
      result.cleared.push(key);
    } catch { /* ignore */ }
  }

  // Step 2: Re-pull from Firebase
  const pulled = await pullFromCloud();
  result.pulled = pulled;

  // Step 3: Reload dataService
  reloadFromStorage?.();
  dataServiceRefresh?.();

  result.success = true;
  console.log("[forceResetAndSync] Cleared:", result.cleared, "Pulled:", result.pulled);
  return result;
}

// =============================================================================
// CLEAR CLOUD DATA
// =============================================================================

export async function clearCloudData(): Promise<boolean> {
  if (!isFirebaseReady()) return false;
  try {
    const rootRef = ref(db);
    await set(rootRef, null);
    return true;
  } catch {
    return false;
  }
}

// =============================================================================
// CLEANUP
// =============================================================================

export function unsubscribeAll(): void {
  for (const unsub of listeners) {
    try { unsub(); } catch { /* ignore */ }
  }
  listeners = [];
}

// =============================================================================
// MANUAL DOWNLOAD: For sales reps to pull data from cloud on demand
// =============================================================================

// =============================================================================
// AUTO-SYNC: Initialize subscriptions when app loads with valid config
// =============================================================================

let autoSyncInitialized = false;
let autoSyncCleanup: (() => void) | null = null;

/** Returns true if auto-sync subscriptions are already active */
export function isAutoSyncInitialized(): boolean {
  return autoSyncInitialized;
}

/** Disconnect Firebase: stop all subscriptions and prevent reconnection */
export function disconnectFirebase(): void {
  console.log("[FirebaseSync] Disconnecting...");
  // Stop auto-sync subscriptions
  if (autoSyncCleanup) {
    autoSyncCleanup();
    autoSyncCleanup = null;
  }
  // Stop manual subscriptions
  unsubscribeAll();
  // Set flag to prevent reconnection
  setStorageItem("sgf_firebase_disconnected", "true");
  console.log("[FirebaseSync] Disconnected. Flag set.");
}

/** Reconnect Firebase after disconnect */
export function reconnectFirebase(): void {
  removeStorageItem("sgf_firebase_disconnected");
  autoSyncInitialized = false;
  initAutoSync();
}

// Allow dataService to refresh its in-memory cache after Firebase writes to localStorage.
// The optional `keys` parameter lets callers reload only specific arrays (much faster
// when a subscription updates just one data type instead of reading all 15+ keys).
type RefreshFn = (keys?: string[]) => void;
let dataServiceRefresh: RefreshFn | null = null;
export function registerDataServiceRefresh(fn: RefreshFn): void {
  dataServiceRefresh = fn;
}

// Listen for price repair events from dataService and push repaired products to Firebase
if (typeof window !== "undefined") {
  window.addEventListener("sgf:productsRepaired", (e: any) => {
    const prods = e.detail?.products;
    if (prods && isFirebaseReady()) {
      console.log(`[FirebaseSync] Pushing ${prods.length} repaired products to cloud...`);
      pushStock(prods).catch((err: any) => console.error("[FirebaseSync] pushStock failed:", err?.message || err));
    }
  });

  window.addEventListener("sgf:quotesRepaired", (e: any) => {
    const count = e.detail?.count || 0;
    if (count > 0 && isFirebaseReady()) {
      console.log(`[FirebaseSync] Pushing repaired quotes to cloud...`);
      // Push orders (which includes repaired quotes)
      const allOrders = JSON.parse(localStorage.getItem("sgf_orders") || "[]");
      if (allOrders.length > 0) {
        fbPush("order", allOrders).catch((err: any) => console.error("[FirebaseSync] push orders failed:", err?.message || err));
      }
      // Also push products (stock was restored)
      const allProducts = JSON.parse(localStorage.getItem("sgf_products") || "[]");
      if (allProducts.length > 0) {
        fbPush("stock", allProducts).catch((err: any) => console.error("[FirebaseSync] push stock failed:", err?.message || err));
      }
    }
  });
}

/** Get current user role from localStorage */
function getCurrentUserRole(): string {
  try {
    const userStr = getStorageItem("sgf_user");
    if (userStr) {
      const user = JSON.parse(userStr);
      return user.role || "sales_rep";
    }
  } catch { /* ignore */ }
  return "sales_rep";
}

let initRetryTimer: ReturnType<typeof setTimeout> | null = null;

export function initAutoSync(): () => void {
  // Check disconnect flag
  if (getStorageItem("sgf_firebase_disconnected") === "true") {
    console.log("[FirebaseSync] Skipped — disconnected by user");
    return () => {};
  }
  if (autoSyncInitialized) return () => {};
  if (!isFirebaseReady()) {
    console.warn("[FirebaseSync] Firebase not ready — will retry...");
    // Retry every 3 seconds until Firebase is ready (max 20 attempts = 60s)
    let attempts = 0;
    const tryInit = () => {
      if (autoSyncInitialized) return;
      attempts++;
      if (isFirebaseReady()) {
        console.log(`[FirebaseSync] Firebase ready after ${attempts} attempts, initializing...`);
        initAutoSync();
      } else if (attempts < 20) {
        initRetryTimer = setTimeout(tryInit, 3000);
      } else {
        console.error("[FirebaseSync] Failed to initialize after 20 attempts. Sync disabled.");
      }
    };
    initRetryTimer = setTimeout(tryInit, 2000);
    return () => { if (initRetryTimer) clearTimeout(initRetryTimer); };
  }

  autoSyncInitialized = true;
  console.log("[FirebaseSync] Auto-sync initializing...");

  // CRITICAL: Flush any pending pushes that were queued while offline
  flushPendingPushes().catch((e) => console.error("[FirebaseSync] flushPendingPushes error:", e));

  const unsubs: Array<() => void> = [];
  const lastCounts: Record<string, number> = {};

  // Debounce timer for batching startup events from multiple subscriptions
  let eventDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  const pendingEventTypes = new Set<string>();

  function flushPendingEvents() {
    eventDebounceTimer = null;
    for (const type of pendingEventTypes) {
      try {
        window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type, count: lastCounts[type] || 0 } }));
      } catch { /* ignore */ }
    }
    pendingEventTypes.clear();
  }

  /** LIGHTWEIGHT callback after subscription receives data.
   *  CRITICAL: The individual subscribeTo* functions already handle:
   *    - mergeWithCloudData
   *    - setStorageItem
   *    - reloadFromStorage / dataServiceRefresh
   *  This callback ONLY dispatches an event so React Query invalidates its cache.
   *  DO NOT call deduplicateData() or reloadFromStorage() here — that would
   *  duplicate work already done by the subscription function, and with 15+
   *  subscriptions firing at startup, the duplicate work freezes the UI. */
  const handleReceived = (type: string, storageKey: string) => (data: any[]) => {
    const cloudCount = data?.length || 0;
    const prev = lastCounts[type] || 0;
    lastCounts[type] = cloudCount;

    console.log(`[FirebaseSync] Received ${cloudCount} ${type} (was ${prev})`);

    // ONLY dispatch event — React Query will refetch via tRPC invalidate.
    // The subscription function has already merged, saved, and reloaded.
    if (["orders","checkins","appointments","invoices","customers","stock","followUpActions","followUps","receipts","users","salesReps","creditNotes","corporateCustomers","purchaseOrders","barrels","certificatesOfCompliance","packingListLines"].includes(type)) {
      pendingEventTypes.add(type);
      if (eventDebounceTimer) clearTimeout(eventDebounceTimer);
      // On first load, batch all subscription events into a single dispatch
      // to prevent 15+ rapid invalidations from freezing the UI.
      eventDebounceTimer = setTimeout(flushPendingEvents, 500);
    }
  };

  // Subscribe to all data channels for all users
  // - customers + stock: shared reference data
  // - orders + appointments + checkins: bidirectional (reps create, admin sees)
  // - invoices + follow-ups: admin-managed
  unsubs.push(subscribeToCustomers(handleReceived("customers", "sgf_customers")));
  unsubs.push(subscribeToStock(handleReceived("stock", "sgf_products")));
  unsubs.push(subscribeToOrders(handleReceived("orders", "sgf_orders")));
  unsubs.push(subscribeToAppointments(handleReceived("appointments", "sgf_appointments")));
  unsubs.push(subscribeToCheckins(handleReceived("checkins", "sgf_checkins")));
  unsubs.push(subscribeToInvoices(handleReceived("invoices", "sgf_invoices")));
  unsubs.push(subscribeToFollowUpActions(handleReceived("followUpActions", "sgf_followUpActions")));
  unsubs.push(subscribeToFollowUps(handleReceived("followUps", "sgf_followUps")));
  unsubs.push(subscribeToReceipts(handleReceived("receipts", "sgf_receipts")));
  unsubs.push(subscribeToUsers(handleReceived("users", "sgf_users")));
  unsubs.push(subscribeToSalesReps(handleReceived("salesReps", "sgf_salesReps")));
  unsubs.push(subscribeToCreditNotes(handleReceived("creditNotes", "sgf_creditNotes")));
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
