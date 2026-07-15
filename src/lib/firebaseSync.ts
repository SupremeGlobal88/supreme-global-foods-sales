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

import { dataService } from "./dataService";
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
    await set(ref(db, `orders/${order.id}`), { ...order, _syncedAt: Date.now() });
    return true;
  } catch (e: any) { console.warn("[FirebaseSync] pushOrder failed:", e.message); return false; }
}

export async function pushCheckin(checkin: any): Promise<void> {
  if (!isFirebaseReady()) return;
  try {
    await set(ref(db, `checkins/${checkin.id}`), { ...checkin, _syncedAt: Date.now() });
  } catch { /* ignore */ }
}

export async function pushAppointment(appointment: any): Promise<void> {
  if (!isFirebaseReady()) return;
  try {
    await set(ref(db, `appointments/${appointment.id}`), { ...appointment, _syncedAt: Date.now() });
  } catch { /* ignore */ }
}

export async function pushInvoice(invoice: any): Promise<void> {
  if (!isFirebaseReady()) return;
  try {
    await set(ref(db, `invoices/${invoice.id}`), { ...invoice, _syncedAt: Date.now() });
  } catch { /* ignore */ }
}

/** Push all invoices to Firebase (used after bulk historical import) */
export async function pushInvoices(invoices: any[]): Promise<void> {
  if (!isFirebaseReady()) return;
  try {
    await set(ref(db, "invoices"), invoices);
  } catch { /* ignore */ }
}

export async function pushFollowUpAction(action: any): Promise<void> {
  if (!isFirebaseReady()) return;
  try {
    await set(ref(db, `followUpActions/${action.id}`), { ...action, _syncedAt: Date.now() });
  } catch { /* ignore */ }
}

export async function pushFollowUp(followUp: any): Promise<void> {
  if (!isFirebaseReady()) return;
  try {
    await set(ref(db, `followUps/${followUp.id}`), { ...followUp, _syncedAt: Date.now() });
  } catch { /* ignore */ }
}

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
  try { await set(ref(db, `appointments/${id}`), null); } catch { /* ignore */ }
}

export async function pushCheckinDelete(id: number): Promise<void> {
  if (!isFirebaseReady()) return;
  try { await set(ref(db, `checkins/${id}`), null); } catch { /* ignore */ }
}

// Customer and Stock sync — admin pushes, sales reps pull
export async function pushCustomers(customers: any[]): Promise<void> {
  if (!isFirebaseReady()) return;
  try { await set(ref(db, "customers"), customers); } catch { /* ignore */ }
}

export async function pushStock(stock: any[]): Promise<void> {
  if (!isFirebaseReady()) return;
  try { await set(ref(db, "stock"), stock); } catch { /* ignore */ }
}

export async function pushUser(user: any): Promise<void> {
  if (!isFirebaseReady()) return;
  try { await set(ref(db, `users/${user.id}`), { ...user, _syncedAt: Date.now() }); } catch { /* ignore */ }
}

export async function pushUserDelete(userId: number): Promise<void> {
  if (!isFirebaseReady()) return;
  try { await set(ref(db, `users/${userId}`), null); } catch { /* ignore */ }
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

    // For items in BOTH: merge local properties into Firebase item.
    // Local non-null values win over Firebase null/missing values.
    // This preserves customerCode, customerId updates from relinkSageInvoices().
    for (const item of local) {
      const k = getStableKey(item, key);
      if (k !== null && incomingMap.has(k)) {
        const fbItem = incomingMap.get(k)!;
        const mergedItem = { ...fbItem };
        for (const prop of Object.keys(item)) {
          if (item[prop] != null && fbItem[prop] == null) {
            mergedItem[prop] = item[prop]; // Local enrichment wins
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
      try { localStorage.setItem("sgf_receipts", JSON.stringify(receipts)); } catch { /* ignore */ }
    }
    if (onData) onData(receipts);
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
      if (["orders", "checkins", "appointments", "invoices", "customers", "stock", "followUpActions", "followUps", "receipts"].includes(type)) {
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

  autoSyncCleanup = () => {
    autoSyncInitialized = false;
    for (const u of unsubs) u();
  };
  return autoSyncCleanup;
}
// Built: 2026-07-07T16:33:54Z
