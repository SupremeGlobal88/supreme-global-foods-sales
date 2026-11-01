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
