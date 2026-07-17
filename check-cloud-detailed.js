/**
 * Detailed diagnostic: Check most recent items and sync timestamps
 */
import { initializeApp, getApps } from "firebase/app";
import { getDatabase, ref, get } from "firebase/database";

const DEFAULT_CONFIG = {
  apiKey: "AIzaSyAj68G-CmO9ImmBB5MgPwlas389gHWqPu8",
  authDomain: "supreme-global-foods-835b0.firebaseapp.com",
  databaseURL: "https://supreme-global-foods-835b0-default-rtdb.firebaseio.com",
  projectId: "supreme-global-foods-835b0",
  storageBucket: "supreme-global-foods-835b0.firebasestorage.app",
  messagingSenderId: "570220829537",
  appId: "1:570220829537:web:3c8d3c870887e9cc7a4320",
};

const app = getApps().length > 0 ? getApps()[0] : initializeApp(DEFAULT_CONFIG);
const db = getDatabase(app);

async function checkDetailed() {
  // Check ORDERS - most recent by createdAt
  console.log("=== MOST RECENT ORDERS (last 15) ===");
  try {
    const snapshot = await get(ref(db, "orders"));
    const val = snapshot.val();
    if (val) {
      const orders = Array.isArray(val)
        ? val.filter(x => x != null)
        : Object.values(val).filter(x => x != null);
      const sorted = orders
        .filter(o => o.createdAt || o._syncedAt)
        .sort((a, b) => {
          const tA = new Date(a.createdAt || a._syncedAt || 0).getTime();
          const tB = new Date(b.createdAt || b._syncedAt || 0).getTime();
          return tB - tA;
        });
      sorted.slice(0, 15).forEach((o, i) => {
        const date = o.createdAt || o._syncedAt || "no-date";
        const syncedAgo = o._syncedAt ? ` (synced: ${new Date(o._syncedAt).toISOString()})` : "";
        console.log(`  ${i + 1}. ${o.orderNumber || "no-number"} - ${o.customerName || o.customer?.name || "Unknown"} - ${date}${syncedAgo}`);
      });
    }
  } catch (e) { console.log("  Error:", e.message); }

  // Check INVOICES - most recent by createdAt
  console.log("\n=== MOST RECENT INVOICES (last 20) ===");
  try {
    const snapshot = await get(ref(db, "invoices"));
    const val = snapshot.val();
    if (val) {
      const invoices = Array.isArray(val)
        ? val.filter(x => x != null)
        : Object.values(val).filter(x => x != null);
      const sorted = invoices
        .filter(i => i.createdAt || i._syncedAt || i.invoiceDate)
        .sort((a, b) => {
          const tA = new Date(a.createdAt || a._syncedAt || a.invoiceDate || 0).getTime();
          const tB = new Date(b.createdAt || b._syncedAt || b.invoiceDate || 0).getTime();
          return tB - tA;
        });
      sorted.slice(0, 20).forEach((inv, i) => {
        const date = inv.createdAt || inv.invoiceDate || inv._syncedAt || "no-date";
        const syncedAgo = inv._syncedAt ? ` (synced: ${new Date(inv._syncedAt).toISOString()})` : "";
        console.log(`  ${i + 1}. ${inv.invoiceNumber || "no-number"} - ${inv.customer?.name || inv.customerName || "Unknown"} - R${(inv.total || 0).toFixed(2)} - ${date}${syncedAgo}`);
      });
    }
  } catch (e) { console.log("  Error:", e.message); }

  // Check SGF invoice number range
  console.log("\n=== SGF INVOICE NUMBER RANGE ===");
  try {
    const snapshot = await get(ref(db, "invoices"));
    const val = snapshot.val();
    if (val) {
      const invoices = Array.isArray(val)
        ? val.filter(x => x != null)
        : Object.values(val).filter(x => x != null);
      const sgfNumbers = invoices
        .filter(i => i.invoiceNumber && i.invoiceNumber.startsWith("SGF"))
        .map(i => parseInt((i.invoiceNumber.match(/SGF(\d+)/) || ["", "0"])[1]))
        .filter(n => n > 0)
        .sort((a, b) => a - b);
      if (sgfNumbers.length > 0) {
        console.log(`  Range: SGF${sgfNumbers[0]} to SGF${sgfNumbers[sgfNumbers.length - 1]}`);
        console.log(`  Count: ${sgfNumbers.length} SGF invoices`);
        // Check for gaps
        const gaps = [];
        for (let i = 1; i < sgfNumbers.length; i++) {
          if (sgfNumbers[i] - sgfNumbers[i - 1] > 1) {
            for (let g = sgfNumbers[i - 1] + 1; g < sgfNumbers[i]; g++) {
              gaps.push(g);
            }
          }
        }
        if (gaps.length > 0) {
          console.log(`  Gaps (missing numbers): ${gaps.slice(0, 20).join(", ")}${gaps.length > 20 ? "..." : ""}`);
        } else {
          console.log("  No gaps - sequential numbering");
        }
      }
    }
  } catch (e) { console.log("  Error:", e.message); }

  // Check what's in localStorage on this machine (build server)
  console.log("\n=== BUILD SERVER localStorage ===");
  console.log("  (localStorage not available in Node.js - skipping)");

  // Check USERS in cloud
  console.log("\n=== USERS IN CLOUD ===");
  try {
    const snapshot = await get(ref(db, "users"));
    const val = snapshot.val();
    if (val) {
      const users = Array.isArray(val)
        ? val.filter(x => x != null)
        : Object.values(val).filter(x => x != null);
      users.forEach(u => {
        console.log(`  - ${u.name || "Unknown"} (${u.role || "no-role"}) - id: ${u.id}`);
      });
    }
  } catch (e) { console.log("  Error:", e.message); }

  // Check items synced in last 24 hours
  console.log("\n=== ITEMS SYNCED IN LAST 24 HOURS ===");
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  for (const path of ["orders", "invoices", "customers", "stock"]) {
    try {
      const snapshot = await get(ref(db, path));
      const val = snapshot.val();
      if (val) {
        const items = Array.isArray(val)
          ? val.filter(x => x != null)
          : Object.values(val).filter(x => x != null);
        const recent = items.filter(i => i._syncedAt && i._syncedAt > cutoff);
        if (recent.length > 0) {
          console.log(`  ${path}: ${recent.length} items synced in last 24h`);
          recent.slice(0, 5).forEach(i => {
            const name = i.invoiceNumber || i.orderNumber || i.name || i.productName || i.id;
            console.log(`    - ${name} (synced: ${new Date(i._syncedAt).toISOString()})`);
          });
        } else {
          console.log(`  ${path}: 0 items synced in last 24h`);
        }
      }
    } catch (e) { console.log(`  ${path}: Error - ${e.message}`); }
  }

  process.exit(0);
}

checkDetailed().catch(e => {
  console.error("Diagnostic failed:", e);
  process.exit(1);
});
