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
import { initializeApp, getApps } from "firebase/app";
import {
  getDatabase,
  ref,
  set,
  onValue,
  update,
  get,
} from "firebase/database";

const CONFIG_KEY = "sgf_firebase_config";

/** Firebase RTDB keys cannot contain ".", "#", "$", "[", or "]".
 *  This function sanitizes any ID to be a valid Firebase key. */
function safeFbKey(id: any): string {
  return String(id).replace(/[.#$[\]]/g, '_');
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
    const stored = localStorage.getItem(CONFIG_KEY);
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

export function initFirebase(userConfig?: any): boolean {
  // If user provides config, save it
  if (userConfig && userConfig.apiKey && !userConfig.apiKey.includes("PLACEHOLDER")) {
    config = userConfig;
    try { localStorage.setItem(CONFIG_KEY, JSON.stringify(userConfig)); } catch { /* ignore */ }
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
    return true;
  }

  try {
    const app = initializeApp(config);
    db = getDatabase(app);
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
    localStorage.setItem(CONFIG_KEY, JSON.stringify(userConfig));
    config = userConfig;
    return initFirebase(userConfig);
  } catch {
    return false;
  }
}

/** Clear config */
export function clearFirebaseConfig(): void {
  localStorage.removeItem(CONFIG_KEY);
  config = null;
  db = null;
}

// =============================================================================
// PUSH: Save a single item to Firebase
// =============================================================================

export async function pushOrder(order: any): Promise<boolean> {
  if (!isFirebaseReady()) return false;
  try {
    await set(ref(db, `orders/${safeFbKey(order.id)}`), { ...order, _syncedAt: Date.now() });
    return true;
  } catch (e: any) { console.warn("[FirebaseSync] pushOrder failed:", e.message); return false; }
}

export async function pushCheckin(checkin: any): Promise<void> {
  if (!isFirebaseReady()) return;
  try {
    await set(ref(db, `checkins/${safeFbKey(checkin.id)}`), { ...checkin, _syncedAt: Date.now() });
  } catch { /* ignore */ }
}

export async function pushAppointment(appointment: any): Promise<void> {
  if (!isFirebaseReady()) return;
  try {
    await set(ref(db, `appointments/${safeFbKey(appointment.id)}`), { ...appointment, _syncedAt: Date.now() });
  } catch { /* ignore */ }
}

export async function pushInvoice(invoice: any): Promise<{ success: boolean; error?: string }> {
  if (!isFirebaseReady()) return { success: false, error: "Firebase not ready" };
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
  if (!isFirebaseReady()) return;
  try {
    await set(ref(db, `followUpActions/${safeFbKey(action.id)}`), { ...action, _syncedAt: Date.now() });
  } catch { /* ignore */ }
}

export async function pushFollowUp(followUp: any): Promise<void> {
  if (!isFirebaseReady()) return;
  try {
    await set(ref(db, `followUps/${safeFbKey(followUp.id)}`), { ...followUp, _syncedAt: Date.now() });
  } catch { /* ignore */ }
}

/** Push a single receipt to Firebase (safe — won't overwrite other users' receipts).
 *  Use this for individual payment recording operations.
 *  Only use pushReceiptsFullList for explicit bulk operations. */
export async function pushOneReceipt(receipt: any): Promise<void> {
  if (!isFirebaseReady()) return;
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
};

/** Read data directly from Firebase. Returns array of items or empty array.
 *  This is the CLOUD FIRST read — every query goes to Firebase first. */
export async function readFromFirebase(path: string): Promise<any[]> {
  if (!isFirebaseReady()) return [];
  try {
    const snapshot = await get(ref(db, FB_PATHS[path] || path));
    const val = snapshot.val();
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
 *  Use this for individual create/update/delete operations.
 *  Only use pushCustomersFullList for explicit bulk operations. */
export async function pushOneCustomer(customer: any): Promise<void> {
  if (!isFirebaseReady()) return;
  try { await set(ref(db, `customers/${safeFbKey(customer.id)}`), { ...customer, _syncedAt: Date.now() }); } catch { /* ignore */ }
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
  if (!isFirebaseReady()) return;
  try { await set(ref(db, `stock/${safeFbKey(item.id)}`), { ...item, _syncedAt: Date.now() }); } catch { /* ignore */ }
}

/** Remove a single stock item from Firebase by ID */
export async function removeOneStockItem(itemId: number): Promise<void> {
  if (!isFirebaseReady()) return;
  try { await set(ref(db, `stock/${safeFbKey(itemId)}`), null); } catch { /* ignore */ }
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
  try { await set(ref(db, "stock"), stock); } catch { /* ignore */ }
}

export async function pushUser(user: any): Promise<void> {
  if (!isFirebaseReady()) return;
  try {
    await set(ref(db, `users/${safeFbKey(user.id)}`), { ...user, _syncedAt: Date.now() });
  } catch (e: any) {
    console.error("[pushUser] FAILED:", user?.name, user?.id, e.message);
  }
}

export async function pushSalesRep(rep: any): Promise<void> {
  if (!isFirebaseReady()) return;
  try {
    await set(ref(db, `salesReps/${safeFbKey(rep.id)}`), { ...rep, _syncedAt: Date.now() });
  } catch (e: any) {
    console.error("[pushSalesRep] FAILED:", rep?.name, rep?.id, e.message);
  }
}

export async function removeSalesRep(repId: number): Promise<void> {
  if (!isFirebaseReady()) return;
  try {
    await set(ref(db, `salesReps/${safeFbKey(repId)}`), null);
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
  if (!isFirebaseReady()) return () => {};
  const cnRef = ref(db, "creditNotes");
  const unsub = onValue(cnRef, (snapshot) => {
    const data = snapshot.val();
    const notes = fbToArray(data);
    if (notes.length > 0) {
      const merged = mergeWithCloudData("sgf_creditNotes", notes);
      try { localStorage.setItem("sgf_creditNotes", JSON.stringify(merged)); } catch { /* ignore */ }
      dataService.reloadFromStorage();
    }
    if (onData) onData(notes);
  });
  listeners.push(unsub);
  return unsub;
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
      const snapshot = await get(ref(db, path));
      const data = fbToArray(snapshot.val());
      if (data.length > 0) {
        let merged = mergeWithCloudData(storageKey, data);
        if (postProcess) merged = postProcess(merged);
        localStorage.setItem(storageKey, JSON.stringify(merged));
      }
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

  dataServiceRefresh?.();
  return counts;
}

/** Firebase stores arrays as objects with numeric keys. Convert back to array. */
function fbToArray(data: any): any[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  return Object.values(data);
}

/** Get the stable key for an item based on its data type */
function getStableKey(item: any, storageKey: string): string | null {
  if (!item) return null;
  // Use invoiceNumber for invoices (fallback to id), orderNumber for orders (fallback to id), id for everything else
  if (storageKey === "sgf_invoices") return item.invoiceNumber != null ? String(item.invoiceNumber) : (item.id != null ? String(item.id) : null);
  if (storageKey === "sgf_orders") return item.orderNumber != null ? String(item.orderNumber) : (item.id != null ? String(item.id) : null);
  return item.id != null ? String(item.id) : null;
}

/** Smart merge: Firebase is source of truth, but local-only items are preserved.
 *  For items in BOTH, local properties win over null/missing Firebase properties.
 *  This preserves local enrichment (customerCode matching, status updates)
 *  without losing Firebase updates. */
export function mergeWithCloudData(key: string, incoming: any[]): any[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return incoming;
    const local = JSON.parse(raw) as any[];
    if (!Array.isArray(local) || local.length === 0) return incoming;

    // Build map of incoming (Firebase) items by stable key
    const incomingMap = new Map<string, any>();
    for (const item of incoming) {
      const k = getStableKey(item, key);
      if (k !== null) incomingMap.set(k, item);
    }

    // Start with all Firebase items (source of truth)
    const merged = new Map<string, any>(incomingMap);

    // Add local items that DON'T exist in Firebase (unsynced / newly created)
    for (const item of local) {
      const k = getStableKey(item, key);
      if (k !== null && !incomingMap.has(k)) {
        merged.set(k, item); // Preserve local-only item
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
        const mergedItem = localUpdated > fbUpdated ? { ...item } : { ...fbItem };
        // Always enrich with local properties that are missing/null in the winner
        const loser = localUpdated > fbUpdated ? fbItem : item;
        for (const prop of Object.keys(loser)) {
          if (loser[prop] != null && mergedItem[prop] == null) {
            mergedItem[prop] = loser[prop];
          }
        }
        merged.set(k, mergedItem);
      }
    }

    return Array.from(merged.values());
  } catch {
    return incoming;
  }
}

export function subscribeToCustomers(onData?: (customers: any[]) => void): () => void {
  if (!isFirebaseReady()) return () => {};
  const customersRef = ref(db, "customers");
  const unsub = onValue(customersRef, (snapshot) => {
    const data = snapshot.val();
    const customers = fbToArray(data);
    if (customers.length > 0) {
      let merged = mergeWithCloudData("sgf_customers", customers);
      // Deduplicate customers by normalized name after merge.
      // Same customer from different devices may have different IDs.
      const custMap = new Map<string, any>();
      for (const c of merged) {
        const key = (c.name || "").toString().trim().replace(/\s+/g, " ").toLowerCase();
        if (!key) continue;
        const existing = custMap.get(key);
        if (!existing || ((c.updatedAt || c.createdAt || 0) > (existing.updatedAt || existing.createdAt || 0))) {
          custMap.set(key, c);
        }
      }
      merged = Array.from(custMap.values());
      try {
        localStorage.setItem("sgf_customers", JSON.stringify(merged));
        console.log("[FirebaseSync] Downloaded", customers.length, "customers from cloud, deduped to", merged.length);
      } catch { /* ignore */ }
    }
    if (onData) onData(customers);
  });
  listeners.push(unsub);
  return unsub;
}

export function subscribeToStock(onData?: (stock: any[]) => void): () => void {
  if (!isFirebaseReady()) return () => {};
  const stockRef = ref(db, "stock");
  const unsub = onValue(stockRef, (snapshot) => {
    const data = snapshot.val();
    const stock = fbToArray(data);
    if (stock.length > 0) {
      const merged = mergeWithCloudData("sgf_products", stock);
      try {
        localStorage.setItem("sgf_products", JSON.stringify(merged));
        console.log("[FirebaseSync] Downloaded", stock.length, "products from cloud");
      } catch { /* ignore */ }
    }
    if (onData) onData(stock);
  });
  listeners.push(unsub);
  return unsub;
}

// =============================================================================
// PULL: Subscribe to Firebase data changes
// =============================================================================

export function subscribeToOrders(onData: (orders: any[]) => void): () => void {
  if (!isFirebaseReady()) return () => {};
  const ordersRef = ref(db, "orders");
  const unsub = onValue(ordersRef, (snapshot) => {
    const data = snapshot.val();
    const orders = fbToArray(data);
    if (orders.length > 0) {
      const merged = mergeWithCloudData("sgf_orders", orders);
      try { localStorage.setItem("sgf_orders", JSON.stringify(merged)); } catch { /* ignore */ }
    }
    onData(orders);
  });
  listeners.push(unsub);
  return unsub;
}

export function subscribeToCheckins(onData: (checkins: any[]) => void): () => void {
  if (!isFirebaseReady()) return () => {};
  const ref_path = ref(db, "checkins");
  const unsub = onValue(ref_path, (snapshot) => {
    const data = snapshot.val();
    const checkins = fbToArray(data);
    if (checkins.length > 0) {
      const merged = mergeWithCloudData("sgf_checkins", checkins);
      try { localStorage.setItem("sgf_checkins", JSON.stringify(merged)); } catch { /* ignore */ }
    }
    onData(checkins);
  });
  listeners.push(unsub);
  return unsub;
}

export function subscribeToAppointments(onData: (appts: any[]) => void): () => void {
  if (!isFirebaseReady()) return () => {};
  const ref_path = ref(db, "appointments");
  const unsub = onValue(ref_path, (snapshot) => {
    const data = snapshot.val();
    const appts = fbToArray(data);
    if (appts.length > 0) {
      const merged = mergeWithCloudData("sgf_appointments", appts);
      try { localStorage.setItem("sgf_appointments", JSON.stringify(merged)); } catch { /* ignore */ }
    }
    onData(appts);
  });
  listeners.push(unsub);
  return unsub;
}

export function subscribeToInvoices(onData: (invoices: any[]) => void): () => void {
  if (!isFirebaseReady()) return () => {};
  const ref_path = ref(db, "invoices");
  const unsub = onValue(ref_path, (snapshot) => {
    const data = snapshot.val();
    const invoices = fbToArray(data);
    if (invoices.length > 0) {
      const merged = mergeWithCloudData("sgf_invoices", invoices);
      try { localStorage.setItem("sgf_invoices", JSON.stringify(merged)); } catch { /* ignore */ }
    }
    onData(invoices);
  });
  listeners.push(unsub);
  return unsub;
}

export function subscribeToFollowUpActions(onData: (actions: any[]) => void): () => void {
  if (!isFirebaseReady()) return () => {};
  const ref_path = ref(db, "followUpActions");
  const unsub = onValue(ref_path, (snapshot) => {
    const data = snapshot.val();
    const actions = fbToArray(data);
    if (actions.length > 0) {
      const merged = mergeWithCloudData("sgf_followUpActions", actions);
      try { localStorage.setItem("sgf_followUpActions", JSON.stringify(merged)); } catch { /* ignore */ }
    }
    onData(actions);
  });
  listeners.push(unsub);
  return unsub;
}

export function subscribeToFollowUps(onData?: (followUps: any[]) => void): () => void {
  if (!isFirebaseReady()) return () => {};
  const followUpsRef = ref(db, "followUps");
  const unsub = onValue(followUpsRef, (snapshot) => {
    const data = snapshot.val();
    const followUps = fbToArray(data);
    if (followUps.length > 0) {
      const merged = mergeWithCloudData("sgf_followUps", followUps);
      try { localStorage.setItem("sgf_followUps", JSON.stringify(merged)); } catch { /* ignore */ }
    }
    if (onData) onData(followUps);
  });
  listeners.push(unsub);
  return unsub;
}

export function subscribeToReceipts(onData?: (receipts: any[]) => void): () => void {
  if (!isFirebaseReady()) return () => {};
  const receiptsRef = ref(db, "receipts");
  const unsub = onValue(receiptsRef, (snapshot) => {
    const data = snapshot.val();
    const receipts = fbToArray(data);
    if (receipts.length > 0) {
      // Use mergeWithCloudData to preserve local receipts that haven't been pushed yet
      const merged = mergeWithCloudData("sgf_receipts", receipts);
      try { localStorage.setItem("sgf_receipts", JSON.stringify(merged)); } catch { /* ignore */ }
    }
    if (onData) onData(receipts);
  });
  listeners.push(unsub);
  return unsub;
}

export function subscribeToSalesReps(onData?: (reps: any[]) => void): () => void {
  if (!isFirebaseReady()) return () => {};
  const repsRef = ref(db, "salesReps");
  const unsub = onValue(repsRef, (snapshot) => {
    const data = snapshot.val();
    const reps = fbToArray(data);
    if (reps.length > 0) {
      const merged = mergeWithCloudData("sgf_salesReps_data", reps);
      try { localStorage.setItem("sgf_salesReps_data", JSON.stringify(merged)); } catch { /* ignore */ }
      // CRITICAL: Also update SALES_REPS in dataService so list() and getSalesReps() are in sync
      try {
        const names = reps.map((r: any) => r.name).filter((n: any) => typeof n === "string");
        if (names.length > 0) {
          // Update dataService's SALES_REPS via the shared localStorage key
          localStorage.setItem("sgf_salesReps", JSON.stringify(names));
        }
      } catch { /* ignore */ }
      reloadFromStorage(); // Update in-memory SALES_REPS array
    }
    if (onData) onData(reps);
  });
  listeners.push(unsub);
  return unsub;
}

export function subscribeToUsers(onData?: (users: any[]) => void): () => void {
  if (!isFirebaseReady()) return () => {};
  const usersRef = ref(db, "users");
  const unsub = onValue(usersRef, (snapshot) => {
    const data = snapshot.val();
    const users = fbToArray(data);
    if (users.length > 0) {
      const merged = mergeWithCloudData("sgf_users", users);
      try { localStorage.setItem("sgf_users", JSON.stringify(merged)); } catch { /* ignore */ }
      reloadFromStorage(); // Update in-memory users array
    }
    if (onData) onData(users);
  });
  listeners.push(unsub);
  return unsub;
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
      const raw = localStorage.getItem(list.storageKey);
      if (raw) {
        const items = JSON.parse(raw);
        if (Array.isArray(items)) totalItems += items.filter(x => x != null).length;
      }
    } catch { /* ignore */ }
  }

  let pushedSoFar = 0;

  for (const list of lists) {
    try {
      const raw = localStorage.getItem(list.storageKey);
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
      localStorage.setItem(storageKey, JSON.stringify(merged));
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
}> {
  const firebase: Record<string, number> = {};
  const localStorageCounts: Record<string, number> = {};

  // Check Firebase
  if (isFirebaseReady()) {
    const paths = ["orders", "invoices", "customers", "stock", "appointments", "checkins", "followUps", "receipts"];
    for (const p of paths) {
      try {
        const snapshot = await get(ref(db, p));
        firebase[p] = fbToArray(snapshot.val()).length;
      } catch { firebase[p] = -1; }
    }
  }

  // Check localStorage
  const localKeys = ["sgf_orders", "sgf_invoices", "sgf_customers", "sgf_products", "sgf_appointments", "sgf_checkins", "sgf_followUps", "sgf_receipts"];
  for (const k of localKeys) {
    try {
      const raw = localStorage.getItem(k);
      if (!raw) { localStorageCounts[k] = 0; continue; }
      const parsed = JSON.parse(raw);
      localStorageCounts[k] = Array.isArray(parsed) ? parsed.length : 0;
    } catch { localStorageCounts[k] = -1; }
  }

  console.log("[diagnoseSync] Firebase:", firebase);
  console.log("[diagnoseSync] localStorage:", localStorageCounts);
  return { firebase, localStorage: localStorageCounts };
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
  localStorage.setItem("sgf_firebase_disconnected", "true");
  console.log("[FirebaseSync] Disconnected. Flag set.");
}

/** Reconnect Firebase after disconnect */
export function reconnectFirebase(): void {
  localStorage.removeItem("sgf_firebase_disconnected");
  autoSyncInitialized = false;
  initAutoSync();
}

// Allow dataService to refresh its in-memory cache after Firebase writes to localStorage
type RefreshFn = () => void;
let dataServiceRefresh: RefreshFn | null = null;
export function registerDataServiceRefresh(fn: RefreshFn): void {
  dataServiceRefresh = fn;
}

/** Get current user role from localStorage */
function getCurrentUserRole(): string {
  try {
    const userStr = localStorage.getItem("sgf_user");
    if (userStr) {
      const user = JSON.parse(userStr);
      return user.role || "sales_rep";
    }
  } catch { /* ignore */ }
  return "sales_rep";
}

export function initAutoSync(): () => void {
  // Check disconnect flag
  if (localStorage.getItem("sgf_firebase_disconnected") === "true") {
    console.log("[FirebaseSync] Skipped — disconnected by user");
    return () => {};
  }
  if (autoSyncInitialized) return () => {};
  if (!isFirebaseReady()) return () => {};

  autoSyncInitialized = true;
  console.log("[FirebaseSync] Auto-sync initializing...");

  const unsubs: Array<() => void> = [];
  const lastCounts: Record<string, number> = {};

  /** Merge received Firebase data into localStorage then refresh dataService */
  const handleReceived = (type: string, storageKey: string) => (data: any[]) => {
    if (data && data.length > 0) {
      console.log(`[FirebaseSync] Received ${data.length} ${type}`);
      // Smart merge: Firebase is source of truth, but preserve local-only items
      try {
        const merged = mergeWithCloudData(storageKey, data);
        localStorage.setItem(storageKey, JSON.stringify(merged));
      } catch (e) {
        console.warn("[FirebaseSync] Failed to merge", type, e);
      }
      dataServiceRefresh?.();
      // Deduplicate orders/invoices after sync to fix duplicates from old merge bug
      if (type === "orders" || type === "invoices") {
        try {
          const result = dataService.deduplicateData();
          if (result.ordersRemoved > 0 || result.invoicesRemoved > 0) {
            console.log(`[FirebaseSync] Auto-dedup removed ${result.ordersRemoved} orders, ${result.invoicesRemoved} invoices`);
          }
        } catch { /* ignore */ }
      }
      // Dispatch firebaseDataReceived event for ALL data types.
      // This ensures tRPC cache invalidates on every device when ANY
      // user creates/updates data — not just when the count increases.
      if (["orders", "checkins", "appointments", "invoices", "customers", "stock", "followUpActions", "followUps", "receipts", "users", "salesReps", "creditNotes"].includes(type)) {
        const prev = lastCounts[type] || 0;
        const curr = data.length;
        lastCounts[type] = curr;
        try {
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type, count: curr, newItems: Math.max(0, curr - prev) } }));
        } catch { /* ignore */ }
      }
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
  unsubs.push(subscribeToSalesReps(handleReceived("salesReps", "sgf_salesReps_data")));
  unsubs.push(subscribeToCreditNotes(handleReceived("creditNotes", "sgf_creditNotes")));

  autoSyncCleanup = () => {
    autoSyncInitialized = false;
    for (const u of unsubs) u();
  };
  return autoSyncCleanup;
}
// Built: 2026-07-07T16:33:54Z
