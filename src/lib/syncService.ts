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
    const local = localStorage.getItem("sgf_cloud_backup");
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
  localStorage.setItem("sgf_cloud_backup", JSON.stringify(data));
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

let writeQueue: Promise<any> = Promise.resolve();
async function withBlob(mutator: (data: any) => void): Promise<void> {
  writeQueue = writeQueue.then(async () => {
    const data = await getBlob();
    mutator(data);
    await saveBlob(data);
  });
  await writeQueue;
}

export const syncService = {
  // Initialize
  init: initBlob,

  // Generic CRUD
  getAll: async () => await getBlob(),

  // Stock
  getStock: async () => (await getBlob()).stock || [],
  saveStock: async (stock: any[]) => { await withBlob((data) => { data.stock = stock; }); },

  // Orders
  getOrders: async () => (await getBlob()).orders || [],
  saveOrders: async (orders: any[]) => { await withBlob((data) => { data.orders = orders; }); },

  // Appointments
  getAppointments: async () => (await getBlob()).appointments || [],
  saveAppointments: async (appointments: any[]) => { await withBlob((data) => { data.appointments = appointments; }); },

  // Check-ins
  getCheckins: async () => (await getBlob()).checkins || [],
  saveCheckins: async (checkins: any[]) => { await withBlob((data) => { data.checkins = checkins; }); },

  // Invoices
  getInvoices: async () => (await getBlob()).invoices || [],
  saveInvoices: async (invoices: any[]) => { await withBlob((data) => { data.invoices = invoices; }); },

  // Special Prices
  getSpecialPrices: async () => (await getBlob()).specialPrices || [],
  saveSpecialPrices: async (sp: any[]) => { await withBlob((data) => { data.specialPrices = sp; }); },

  // Save entire blob directly (used by localLink for cloud sync)
  saveBlob: async (data: any) => { await saveBlob(data); },

  // Refresh
  refresh: async () => { cache = null; lastFetch = 0; return await getBlob(); },
};
