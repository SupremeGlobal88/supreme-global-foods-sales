/**
 * Check specifically which SGF invoices exist in cloud and which don't
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

async function checkInvoices() {
  const snapshot = await get(ref(db, "invoices"));
  const val = snapshot.val();
  if (!val) { console.log("No invoices in cloud"); return; }

  const invoices = Array.isArray(val)
    ? val.filter(x => x != null)
    : Object.values(val).filter(x => x != null);

  // Build map of all SGF invoices by number
  const sgfMap = new Map();
  invoices.forEach(inv => {
    if (inv.invoiceNumber && inv.invoiceNumber.startsWith("SGF")) {
      sgfMap.set(inv.invoiceNumber, inv);
    }
  });

  console.log(`Total invoices in cloud: ${invoices.length}`);
  console.log(`SGF invoices in cloud: ${sgfMap.size}`);

  // Check SGF1800-SGF1870 range
  console.log("\n=== SGF1800-SGF1870 EXISTS IN CLOUD? ===");
  let missing = [];
  let present = [];
  for (let i = 1800; i <= 1870; i++) {
    const num = `SGF${i}`;
    if (sgfMap.has(num)) {
      present.push(i);
    } else {
      missing.push(i);
    }
  }
  console.log(`Present (${present.length}): ${present.slice(0, 20).join(", ")}${present.length > 20 ? "..." : ""}`);
  console.log(`Missing (${missing.length}): ${missing.slice(0, 30).join(", ")}${missing.length > 30 ? "..." : ""}`);

  // Show details for SGF1860-SGF1867
  console.log("\n=== SGF1860-SGF1867 DETAILS ===");
  for (let i = 1860; i <= 1867; i++) {
    const num = `SGF${i}`;
    const inv = sgfMap.get(num);
    if (inv) {
      console.log(`  ${num}: ${inv.customer?.name || inv.customerName || "Unknown"} - R${(inv.total || 0).toFixed(2)} - createdAt: ${inv.createdAt || "no-date"} - orderId: ${inv.orderId || "none"}`);
    } else {
      console.log(`  ${num}: NOT IN CLOUD`);
    }
  }

  // Check orders from July 15-16 and whether they have invoices
  console.log("\n=== ORDERS FROM JULY 15-16 ===");
  const orderSnap = await get(ref(db, "orders"));
  const orderVal = orderSnap.val();
  if (orderVal) {
    const orders = Array.isArray(orderVal)
      ? orderVal.filter(x => x != null)
      : Object.values(orderVal).filter(x => x != null);

    const julyOrders = orders.filter(o => {
      const d = o.createdAt || "";
      return d.startsWith("2026-07-15") || d.startsWith("2026-07-16");
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    console.log(`  Total orders July 15-16: ${julyOrders.length}`);
    julyOrders.forEach(o => {
      const hasInvoice = invoices.some(i => i.orderId == o.id);
      console.log(`  ${o.orderNumber} - ${o.customerName || "Unknown"} - items: ${(o.items || []).length} - hasInvoice: ${hasInvoice}`);
    });
  }

  process.exit(0);
}

checkInvoices().catch(e => {
  console.error("Failed:", e);
  process.exit(1);
});
