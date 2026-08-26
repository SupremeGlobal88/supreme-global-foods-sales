import { getStorageItem, setStorageItem } from "./compressedStorage";

// Cloud Sync Service using JSONBlob + CORS proxy
// Admin uploads from PC → data goes to cloud → sales reps see it on their phones

const BLOB_ID = "019eefd9-c2a1-7887-a6f2-a75e3ed917ba";
const BASE_URL = "https://jsonblob.com/api/jsonBlob";

// CORS proxy - adds Access-Control-Allow-Origin header so browser can fetch
function proxy(url: string): string {
  return `https://corsproxy.io/?${encodeURIComponent(url)}`;
}

let cache: any = null;
let lastFetch = 0;
const CACHE_TTL = 3000;

async function getBlob(): Promise<any> {
  const now = Date.now();
  if (cache && (now - lastFetch) < CACHE_TTL) return cache;
  try {
    const res = await fetch(proxy(`${BASE_URL}/${BLOB_ID}`));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    cache = data;
    lastFetch = now;
    return data;
  } catch (e) {
    console.warn("[sync] Cloud fetch failed:", e);
    // Fallback to localStorage
    const local = getStorageItem("sgf_cloud_backup");
    if (local) return JSON.parse(local);
    return { stock: [], orders: [], appointments: [], checkins: [], invoices: [], specialPrices: [], followUps: [], auditLog: [] };
  }
}

async function saveBlob(data: any): Promise<void> {
  cache = data;
  lastFetch = Date.now();
  try {
    await fetch(proxy(`${BASE_URL}/${BLOB_ID}`), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  } catch (e) {
    console.warn("[sync] Cloud save failed:", e);
  }
  // Always save to localStorage as backup
  setStorageItem("sgf_cloud_backup", JSON.stringify(data));
}

// Initialize blob if empty
async function initBlob(): Promise<void> {
  try {
    const res = await fetch(proxy(`${BASE_URL}/${BLOB_ID}`));
    if (res.status === 404) {
      // Create empty blob
      const empty = { stock: [], orders: [], appointments: [], checkins: [], invoices: [], specialPrices: [], followUps: [], auditLog: [] };
      await saveBlob(empty);
    }
  } catch { /* ignore */ }
}

// Merge cloud data with local, keeping the newer version of each record
export async function syncFromCloud(): Promise<boolean> {
  try {
    const cloud = await getBlob();
    const types = ["stock", "orders", "appointments", "checkins", "invoices", "specialPrices", "followUps", "auditLog"];
    let updated = false;
    for (const type of types) {
      const cloudData = cloud[type] || [];
      const storageKey = type === "stock" ? "sgf_products" : `sgf_${type}`;
      const raw = getStorageItem(storageKey);
      const local = raw ? JSON.parse(raw) : [];
      if (cloudData.length > 0) {
        const merged = [...local];
        for (const cloudItem of cloudData) {
          const idx = merged.findIndex((l: any) => l.id === cloudItem.id);
          if (idx >= 0) {
            if ((cloudItem.updatedAt || cloudItem.createdAt || 0) > (merged[idx].updatedAt || merged[idx].createdAt || 0)) {
              merged[idx] = cloudItem;
              updated = true;
            }
          } else {
            merged.push(cloudItem);
            updated = true;
          }
        }
        setStorageItem(storageKey, JSON.stringify(merged));
      }
    }
    return updated;
  } catch (e) {
    console.error("[sync] syncFromCloud failed:", e);
    return false;
  }
}

// Push local data to cloud
export async function pushToCloud(): Promise<boolean> {
  try {
    const types = ["stock", "orders", "appointments", "checkins", "invoices", "specialPrices", "followUps", "auditLog"];
    const data: any = {};
    for (const type of types) {
      const storageKey = type === "stock" ? "sgf_products" : `sgf_${type}`;
      const raw = getStorageItem(storageKey);
      data[type] = raw ? JSON.parse(raw) : [];
    }
    await saveBlob(data);
    return true;
  } catch (e) {
    console.error("[sync] pushToCloud failed:", e);
    return false;
  }
}

// Quick sync - runs periodically
export async function quickSync(): Promise<boolean> {
  await initBlob();
  const pulled = await syncFromCloud();
  const pushed = await pushToCloud();
  return pulled || pushed;
}
