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

import { initializeApp, getApps } from "firebase/app";
import {
  getDatabase,
  ref,
  set,
  onValue,
  update,
} from "firebase/database";

const CONFIG_KEY = "sgf_firebase_config";

// Default placeholder config (will be replaced at runtime from localStorage)
const DEFAULT_CONFIG = {
  apiKey: "PLACEHOLDER",
  authDomain: "placeholder.firebaseapp.com",
  databaseURL: "https://placeholder-default-rtdb.firebaseio.com",
  projectId: "placeholder",
  storageBucket: "placeholder.appspot.com",
  messagingSenderId: "000000",
  appId: "1:000000:web:000000",
};

function getConfigFromStorage(): any {
  try {
    const stored = localStorage.getItem(CONFIG_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && parsed.apiKey && !parsed.apiKey.includes("PLACEHOLDER")) {
        return parsed;
      }
    }
  } catch { /* ignore */ }
  return null;
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

export async function pushOrder(order: any): Promise<void> {
  if (!isFirebaseReady()) return;
  try {
    await set(ref(db, `orders/${order.id}`), { ...order, _syncedAt: Date.now() });
  } catch { /* ignore */ }
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

export async function pushFollowUpAction(action: any): Promise<void> {
  if (!isFirebaseReady()) return;
  try {
    await set(ref(db, `followUpActions/${action.id}`), { ...action, _syncedAt: Date.now() });
  } catch { /* ignore */ }
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

/** Firebase stores arrays as objects with numeric keys. Convert back to array. */
function fbToArray(data: any): any[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  return Object.values(data);
}

/** Merge Firebase data with localStorage data — preserves local items that haven't been synced yet */
function mergeWithLocal(key: string, incoming: any[]): any[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return incoming;
    const local = JSON.parse(raw) as any[];
    if (!Array.isArray(local) || local.length === 0) return incoming;
    // Build map of local items by id
    const merged = new Map<number, any>();
    for (const item of local) {
      if (item && item.id !== undefined) merged.set(item.id, item);
    }
    // Overlay Firebase items (newer data from other devices)
    for (const item of incoming) {
      if (item && item.id !== undefined) merged.set(item.id, item);
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
      const merged = mergeWithLocal("sgf_customers", customers);
      try {
        localStorage.setItem("sgf_customers", JSON.stringify(merged));
        console.log("[FirebaseSync] Downloaded", customers.length, "customers from cloud");
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
      const merged = mergeWithLocal("sgf_products", stock);
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
      const merged = mergeWithLocal("sgf_orders", orders);
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
      const merged = mergeWithLocal("sgf_checkins", checkins);
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
      const merged = mergeWithLocal("sgf_appointments", appts);
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
      const merged = mergeWithLocal("sgf_invoices", invoices);
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
      const merged = mergeWithLocal("sgf_followUpActions", actions);
      try { localStorage.setItem("sgf_followUpActions", JSON.stringify(merged)); } catch { /* ignore */ }
    }
    onData(actions);
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
}): Promise<void> {
  if (!isFirebaseReady()) return;
  try {
    const updates: Record<string, any> = {};
    for (const o of localData.orders) updates[`orders/${o.id}`] = { ...o, _syncedAt: Date.now() };
    for (const c of localData.checkins) updates[`checkins/${c.id}`] = { ...c, _syncedAt: Date.now() };
    for (const a of localData.appointments) updates[`appointments/${a.id}`] = { ...a, _syncedAt: Date.now() };
    for (const i of localData.invoices) updates[`invoices/${i.id}`] = { ...i, _syncedAt: Date.now() };
    await update(ref(db), updates);
  } catch { /* ignore */ }
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

// Allow dataService to refresh its in-memory cache after Firebase writes to localStorage
type RefreshFn = () => void;
let dataServiceRefresh: RefreshFn | null = null;
export function registerDataServiceRefresh(fn: RefreshFn): void {
  dataServiceRefresh = fn;
}

export function initAutoSync(): () => void {
  if (autoSyncInitialized) return () => {};
  if (!isFirebaseReady()) return () => {};

  autoSyncInitialized = true;
  console.log("[FirebaseSync] Auto-sync initializing...");

  // Subscribe to all data channels:
  // - customers + stock: admin pushes, sales reps pull
  // - orders + appointments + checkins: sales reps push, admin pulls
  const unsubs: Array<() => void> = [];

  // Track last known counts per type — notify admin whenever count increases
  const lastCounts: Record<string, number> = {};

  const handleReceived = (type: string) => (data: any[]) => {
    if (data && data.length > 0) {
      console.log(`[FirebaseSync] Received ${data.length} ${type}`);
      dataServiceRefresh?.(); // refresh dataService in-memory cache
      // For bidirectional data (orders/checkins/appointments from sales reps),
      // dispatch event whenever count increases so admin knows to refresh
      if (["orders", "checkins", "appointments"].includes(type)) {
        const prev = lastCounts[type] || 0;
        const curr = data.length;
        lastCounts[type] = curr;
        if (curr > prev) {
          try {
            window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type, count: curr, newItems: curr - prev } }));
          } catch { /* ignore */ }
        }
      }
    }
  };

  unsubs.push(subscribeToCustomers(handleReceived("customers")));
  unsubs.push(subscribeToStock(handleReceived("stock")));
  unsubs.push(subscribeToOrders(handleReceived("orders")));
  unsubs.push(subscribeToAppointments(handleReceived("appointments")));
  unsubs.push(subscribeToCheckins(handleReceived("checkins")));
  unsubs.push(subscribeToInvoices(handleReceived("invoices")));
  unsubs.push(subscribeToFollowUpActions(handleReceived("followUpActions")));

  return () => {
    autoSyncInitialized = false;
    for (const u of unsubs) u();
  };
}
