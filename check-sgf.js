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

async function check() {
  const invSnap = await get(ref(db, "invoices"));
  const invVal = invSnap.val();
  if (!invVal) { console.log("No invoices in cloud"); process.exit(0); }

  const invoices = Array.isArray(invVal) ? invVal.filter(x => x != null) : Object.values(invVal).filter(x => x != null);
  console.log(`Total invoices in cloud: ${invoices.length}`);

  const sgf = invoices.filter(i => i.invoiceNumber && i.invoiceNumber.startsWith("SGF"));
  console.log(`SGF invoices: ${sgf.length}`);

  // Get all SGF numbers sorted
  const sorted = sgf
    .map(i => ({ num: parseInt((i.invoiceNumber.match(/SGF(\d+)/) || ["","0"])[1]), inv: i }))
    .filter(i => i.num > 0)
    .sort((a, b) => b.num - a.num);

  console.log(`\n=== LATEST 20 SGF INVOICES ===`);
  sorted.slice(0, 20).forEach(({ num, inv }) => {
    const synced = inv._syncedAt ? new Date(inv._syncedAt).toISOString().slice(0, 10) : "no-sync";
    console.log(`  SGF${num} - ${inv.customer?.name || inv.customerName || "Unknown"} - R${(inv.total || 0).toFixed(2)} - synced: ${synced}`);
  });

  // Check SGF1906-SGF1915 range
  console.log(`\n=== SGF1900-SGF1920 RANGE ===`);
  for (let i = 1900; i <= 1920; i++) {
    const num = `SGF${i}`;
    const found = sgf.filter(x => x.invoiceNumber === num);
    if (found.length > 0) {
      console.log(`  ${num}: ${found.length} invoice(s)`);
    }
  }

  process.exit(0);
}

check().catch(e => { console.error(e); process.exit(1); });
