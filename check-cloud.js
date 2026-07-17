/**
 * Diagnostic script: Check what's in Firebase cloud RIGHT NOW.
 * Run with: node check-cloud.js
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

const paths = ["orders", "invoices", "customers", "stock", "appointments", "checkins", "followUps", "followUpActions", "receipts", "users"];

async function checkCloud() {
  console.log("========================================");
  console.log("  FIREBASE CLOUD DIAGNOSTIC");
  console.log("  Database:", DEFAULT_CONFIG.databaseURL);
  console.log("  Time:", new Date().toISOString());
  console.log("========================================\n");

  let totalItems = 0;

  for (const path of paths) {
    try {
      const snapshot = await get(ref(db, path));
      const val = snapshot.val();
      let count = 0;
      let sample = null;

      if (val) {
        if (Array.isArray(val)) {
          count = val.filter(x => x != null).length;
          sample = val.find(x => x != null);
        } else {
          const entries = Object.entries(val).filter(([k, v]) => v != null);
          count = entries.length;
          sample = entries.length > 0 ? entries[0][1] : null;
        }
      }

      totalItems += count;
      console.log(`${path.toUpperCase().padEnd(20)}: ${count.toString().padStart(6)} items`);

      if (count > 0 && sample) {
        // Show a sample item's key fields
        const id = sample.id || sample._id || "no-id";
        const keyField = path === "invoices" ? (sample.invoiceNumber || "no-number") :
                        path === "orders" ? (sample.orderNumber || "no-number") :
                        path === "customers" ? (sample.name || "no-name") :
                        path === "stock" ? (sample.productName || "no-name") :
                        id;
        console.log(`  └─ sample: ${keyField} (id: ${id})`);
      }
    } catch (e) {
      console.log(`${path.toUpperCase().padEnd(20)}: ERROR - ${e.message}`);
    }
  }

  console.log(`\n========================================`);
  console.log(`  TOTAL: ${totalItems} items in cloud`);
  console.log(`========================================`);

  // Check for SGF invoices specifically
  try {
    const snapshot = await get(ref(db, "invoices"));
    const val = snapshot.val();
    if (val) {
      const invoices = Array.isArray(val) ? val.filter(x => x != null) : Object.values(val).filter(x => x != null);
      const sgfInvoices = invoices.filter(i => i && i.invoiceNumber && i.invoiceNumber.startsWith("SGF"));
      const latestSGF = sgfInvoices
        .filter(i => i.invoiceNumber)
        .sort((a, b) => {
          const numA = parseInt((a.invoiceNumber || "").match(/SGF(\d+)/)?.[1] || "0");
          const numB = parseInt((b.invoiceNumber || "").match(/SGF(\d+)/)?.[1] || "0");
          return numB - numA;
        });

      console.log(`\n  SGF INVOICES: ${sgfInvoices.length} total`);
      console.log(`  Latest 10 SGF numbers:`);
      latestSGF.slice(0, 10).forEach(inv => {
        console.log(`    ${inv.invoiceNumber} - ${inv.customer?.name || inv.customerName || "Unknown"} - R${(inv.total || 0).toFixed(2)}`);
      });

      // Check for yesterday's date
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yestStr = yesterday.toISOString().slice(0, 10);
      const yestInvoices = invoices.filter(i => {
        const d = i.invoiceDate || i.createdAt || i._syncedAt;
        return d && d.toString().startsWith(yestStr);
      });
      console.log(`\n  Invoices from yesterday (${yestStr}): ${yestInvoices.length}`);

      // Check for today
      const todayStr = new Date().toISOString().slice(0, 10);
      const todayInvoices = invoices.filter(i => {
        const d = i.invoiceDate || i.createdAt || i._syncedAt;
        return d && d.toString().startsWith(todayStr);
      });
      console.log(`  Invoices from today (${todayStr}): ${todayInvoices.length}`);
    }
  } catch (e) {
    console.log("\n  Could not analyze invoices:", e.message);
  }

  process.exit(0);
}

checkCloud().catch(e => {
  console.error("Diagnostic failed:", e);
  process.exit(1);
});
