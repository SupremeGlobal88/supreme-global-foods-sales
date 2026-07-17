import { useState, useEffect } from "react";
import {
  Building2,
  Save,
  CreditCard,
  Bell,
  Cloud,
  CloudOff,
  CheckCircle,
  AlertTriangle,
  Copy,
  Trash2,
  Wrench,
  Hash,
  FileText,
  Link,
  RefreshCw,
} from "lucide-react";
import { reloadFromStorage } from "@/lib/dataService";
import { trpc } from "@/providers/trpc";
import { getFirebaseConfig, getConfigFromStorage, saveFirebaseConfig, clearFirebaseConfig, syncAllLocalData, pushCustomers, pushStock, disconnectFirebase, clearCloudData, pullFromCloud, forcePushAllLocalData, forcePullAllFromCloud, diagnoseSync } from "@/lib/firebaseSync";
import { useRole } from "@/hooks/useRole";
import { resetTransactionData, clearAppointmentsAndCheckins, factoryReset, fixDuplicateInvoiceNumbers } from "@/lib/dataService";

const DEFAULT_COMPANY = {
  name: "Supreme Global Foods",
  tradingName: "Supreme Global Foods",
  regNumber: "2015/123456/07",
  vatNumber: "4120123456",
  phone: "083 293 0644",
  email: "sales@supremeglobalfoods.co.za",
  address: "28 Nagington road, Wadeville, Germiston",
  city: "Germiston",
  province: "Gauteng",
  postalCode: "1422",
  website: "https://www.supremeglobalfoods.co.za",
};

const DEFAULT_BANKING = {
  bankName: "First National Bank (FNB)",
  accountName: "Supreme Global Foods",
  accountNumber: "62001234567",
  branchCode: "250655",
  swiftCode: "FIRNZAJJ",
};

const DEFAULT_NOTIFICATIONS = {
  emailOnOrder: true,
  emailOnPayment: true,
  smsOnOverdue: false,
  dailyReport: true,
  lowStockAlert: true,
};

function loadSettings<T>(key: string, defaults: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return { ...defaults, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...defaults };
}

export default function SettingsPage() {
  const { isAdmin, isSuperAdmin } = useRole();
  const utils = trpc.useUtils();
  const generateMissingInvoices = trpc.order.generateMissingInvoices.useMutation({
    onSuccess: async (result) => {
      await utils.invoice.list.invalidate();
      await utils.order.list.invalidate();
      if (result.created > 0) {
        setSyncMessage(`Generated ${result.created} missing invoices: ${result.details.join(", ")}`);
      } else {
        setSyncMessage("No missing invoices found.");
      }
      setTimeout(() => setSyncMessage(""), 8000);
    },
    onError: (e) => {
      setSyncMessage("Error: " + e.message);
      setTimeout(() => setSyncMessage(""), 5000);
    },
  });
  const relinkSage = trpc.invoice.relinkSageInvoices.useMutation({
    onSuccess: async (result: any) => {
      reloadFromStorage();
      await utils.invoice.list.refetch();
      await utils.invoice.getStats.invalidate();
      if (result?.relinked > 0) {
        setSyncMessage(`Re-linked ${result.relinked} Sage invoices. ${result.details.slice(0, 5).join(", ")}${result.details.length > 5 ? "..." : ""}`);
      } else {
        setSyncMessage("No Sage invoices needed re-linking.");
      }
      setTimeout(() => setSyncMessage(""), 10000);
    },
    onError: (e) => {
      setSyncMessage("Error: " + e.message);
      setTimeout(() => setSyncMessage(""), 5000);
    },
  });
  const [saved, setSaved] = useState(false);

  const [company, setCompany] = useState(() => loadSettings("sgf_settings_company", DEFAULT_COMPANY));
  const [banking, setBanking] = useState(() => loadSettings("sgf_settings_banking", DEFAULT_BANKING));
  const [notifications, setNotifications] = useState(() => loadSettings("sgf_settings_notifications", DEFAULT_NOTIFICATIONS));

  // Persist to localStorage whenever state changes
  useEffect(() => { localStorage.setItem("sgf_settings_company", JSON.stringify(company)); }, [company]);
  useEffect(() => { localStorage.setItem("sgf_settings_banking", JSON.stringify(banking)); }, [banking]);
  useEffect(() => { localStorage.setItem("sgf_settings_notifications", JSON.stringify(notifications)); }, [notifications]);

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  function handleClearAllData() {
    if (!confirm("WARNING: This will permanently delete ALL orders, invoices, receipts, payments, appointments, check-ins, follow-ups, collection notes, and audit logs.\n\nCustomers, products, and users will be kept.\n\nAre you sure?")) return;
    if (!confirm("Are you absolutely sure? This cannot be undone.")) return;
    setClearStatus("Disconnecting Firebase...");
    setTimeout(() => {
      disconnectFirebase();
      setClearStatus("Clearing transaction data...");
      setTimeout(() => {
        resetTransactionData();
        setClearStatus("Data cleared. Reloading...");
        setTimeout(() => {
          window.location.href = window.location.pathname + "?_=" + Date.now();
        }, 500);
      }, 300);
    }, 100);
  }

  function handleClearAppointments() {
    if (!confirm("This will delete ALL appointments and check-ins.\n\nAre you sure?")) return;
    setClearStatus("Disconnecting Firebase...");
    setTimeout(() => {
      disconnectFirebase();
      setClearStatus("Clearing appointments...");
      setTimeout(() => {
        clearAppointmentsAndCheckins();
        setClearStatus("Appointments cleared. Reloading...");
        setTimeout(() => {
          window.location.href = window.location.pathname + "?_=" + Date.now();
        }, 500);
      }, 300);
    }, 100);
  }

  function handleFullReset() {
    if (!confirm("EXTREME WARNING: This will delete ALL data including orders, invoices, customers, and products.\n\nThe app will reload with factory defaults (383 customers, 203 products, 7 users).\n\nThis cannot be undone!")) return;
    if (!confirm("FINAL WARNING: All your data will be lost. Are you 100% sure?")) return;
    setClearStatus("Disconnecting Firebase...");
    setTimeout(() => {
      // Step 1: Stop Firebase from re-downloading data
      disconnectFirebase();
      setClearStatus("Clearing all data...");
      setTimeout(() => {
        // Step 2: Clear localStorage
        Object.keys(localStorage).forEach(k => { if (k.startsWith("sgf_")) localStorage.removeItem(k); });
        // Keep disconnect flag
        localStorage.setItem("sgf_firebase_disconnected", "true");
        setClearStatus("Reset complete. Reloading...");
        setTimeout(() => {
          window.location.href = window.location.pathname + "?_=" + Date.now();
        }, 500);
      }, 300);
    }, 100);
  }

  // Force Sync from Cloud
  async function handleForceSync() {
    setForceSyncStatus("Pulling data from cloud...");
    try {
      const counts = await pullFromCloud();
      reloadFromStorage();
      // Invalidate ALL tRPC queries so UI refreshes with new data
      await utils.invoice.list.invalidate();
      await utils.invoice.getStats.invalidate();
      await utils.order.list.invalidate();
      await utils.order.getStats.invalidate();
      await utils.customer.search.invalidate();
      await utils.customer.list.invalidate();
      await utils.stock.list.invalidate();
      await utils.appointment.list.invalidate();
      await utils.checkIn.list.invalidate();
      await utils.followUp.list.invalidate();
      await utils.followUpAction.list.invalidate();
      await utils.sampleReport.getAll.invalidate();
      await utils.dashboard.stats.invalidate();
      const parts = Object.entries(counts).map(([k, v]) => `${k}: ${v}`).join(", ");
      setForceSyncStatus(`Sync complete! ${parts || "No data found"} — pages refreshed`);
      setTimeout(() => setForceSyncStatus(""), 8000);
    } catch (e: any) {
      setForceSyncStatus("Sync failed: " + (e.message || "Unknown error"));
      setTimeout(() => setForceSyncStatus(""), 8000);
    }
  }

  // Cloud Sync
  const [syncStatus, setSyncStatus] = useState(getFirebaseConfig());
  const [firebaseJson, setFirebaseJson] = useState("");
  const [syncMessage, setSyncMessage] = useState("");
  const [syncError, setSyncError] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [clearStatus, setClearStatus] = useState("");
  const [forceSyncStatus, setForceSyncStatus] = useState("");
  const [forcePushStatus, setForcePushStatus] = useState("");
  const [forcePullStatus, setForcePullStatus] = useState("");
  const [diagnoseResult, setDiagnoseResult] = useState("");

  useEffect(() => {
    try {
      const cfg = localStorage.getItem("sgf_firebase_config");
      if (cfg) {
        const encoded = btoa(cfg);
        setShareUrl(window.location.origin + window.location.pathname + "?fb=" + encoded);
      }
    } catch { setShareUrl(""); }
  }, [syncStatus.configured]);

  async function handleCopyShareLink() {
    const cfg = getConfigFromStorage();
    if (!cfg || !cfg.apiKey) { setSyncError("No config found. Reconnect first."); setTimeout(() => setSyncError(""), 5000); return; }
    const cfgStr = JSON.stringify(cfg);
    const url = window.location.origin + window.location.pathname + "?fb=" + btoa(cfgStr);
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
        setSyncMessage("Link copied! Send to sales reps.");
        setTimeout(() => setSyncMessage(""), 5000);
      } else { throw new Error("no api"); }
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = url; document.body.appendChild(ta); ta.select();
        const ok = document.execCommand("copy"); document.body.removeChild(ta);
        if (ok) { setSyncMessage("Link copied! Send to sales reps."); setTimeout(() => setSyncMessage(""), 5000); }
        else { throw new Error("fallback failed"); }
      } catch {
        setSyncError("Copy blocked. Select and copy the URL below manually.");
        setTimeout(() => setSyncError(""), 8000);
      }
    }
  }

  // FORCE PUSH ALL: Push every item from localStorage to Firebase individually
  // Use this when Collin's data needs to be safely pushed to cloud
  async function handleForcePushAll() {
    setForcePushStatus("Reading all local data and pushing to Firebase...");
    try {
      const result = await forcePushAllLocalData();
      setForcePushStatus(
        `PUSHED: ${result.orders} orders, ${result.invoices} invoices, ${result.customers} customers, ${result.stock} stock items. ` +
        (result.errors.length > 0 ? `Errors: ${result.errors.slice(0, 3).join("; ")}` : "All done!")
      );
      setTimeout(() => setForcePushStatus(""), 15000);
    } catch (e: any) {
      setForcePushStatus("Force push failed: " + (e.message || "Unknown error"));
      setTimeout(() => setForcePushStatus(""), 10000);
    }
  }

  // FORCE PULL ALL: Pull every item from Firebase and merge into localStorage
  // Use this when a user's device has stale data and needs fresh data from cloud
  async function handleForcePullAll() {
    setForcePullStatus("Pulling all data from Firebase...");
    try {
      const result = await forcePullAllFromCloud();
      // Invalidate all queries so UI refreshes
      await utils.invoice.list.invalidate();
      await utils.invoice.getStats.invalidate();
      await utils.order.list.invalidate();
      await utils.order.getStats.invalidate();
      await utils.customer.search.invalidate();
      await utils.customer.list.invalidate();
      await utils.stock.list.invalidate();
      await utils.appointment.list.invalidate();
      await utils.checkIn.list.invalidate();
      await utils.followUp.list.invalidate();
      await utils.followUpAction.list.invalidate();
      await utils.dashboard.stats.invalidate();
      setForcePullStatus(
        `PULLED: ${result.orders} orders, ${result.invoices} invoices, ${result.customers} customers, ${result.stock} stock from cloud. ` +
        (result.errors.length > 0 ? `Errors: ${result.errors.slice(0, 3).join("; ")}` : "All pages refreshed!")
      );
      setTimeout(() => setForcePullStatus(""), 15000);
    } catch (e: any) {
      setForcePullStatus("Force pull failed: " + (e.message || "Unknown error"));
      setTimeout(() => setForcePullStatus(""), 10000);
    }
  }

  // DIAGNOSE: Show what's in Firebase vs localStorage
  async function handleDiagnose() {
    setDiagnoseResult("Checking...");
    try {
      const result = await diagnoseSync();
      const fb = Object.entries(result.firebase).map(([k, v]) => `${k}: ${v}`).join(", ");
      const ls = Object.entries(result.localStorage).map(([k, v]) => `${k}: ${v}`).join(", ");
      setDiagnoseResult(`Firebase: ${fb} | localStorage: ${ls}`);
    } catch (e: any) {
      setDiagnoseResult("Diagnose failed: " + (e.message || "Unknown error"));
    }
  }

  async function handleSyncToCloud() {
    setSyncMessage("Syncing...");
    const localOrders = JSON.parse(localStorage.getItem("sgf_orders") || "[]");
    const localCheckins = JSON.parse(localStorage.getItem("sgf_checkins") || "[]");
    const localAppointments = JSON.parse(localStorage.getItem("sgf_appointments") || "[]");
    const localInvoices = JSON.parse(localStorage.getItem("sgf_invoices") || "[]");
    const localCustomers = JSON.parse(localStorage.getItem("sgf_customers") || "[]");
    const localStock = JSON.parse(localStorage.getItem("sgf_products") || "[]");
    const result = await syncAllLocalData({ orders: localOrders, checkins: localCheckins, appointments: localAppointments, invoices: localInvoices });
    if (localCustomers.length > 0) await pushCustomers(localCustomers);
    if (localStock.length > 0) await pushStock(localStock);
    setSyncMessage(`Synced to cloud! ${result.invoices} invoices, ${result.orders} orders pushed. Sales reps will receive data automatically.`);
    setTimeout(() => setSyncMessage(""), 8000);
  }

  function parseFirebaseConfig(input: string): any {
    // Step 1: Strip ALL non-ASCII and control characters (aggressive)
    let raw = input.replace(/[^\x20-\x7E\s]/g, "");
    // Step 2: Remove JS comments
    raw = raw.replace(/\/\/.*$/gm, "");
    // Step 3: Remove const declaration and trailing semicolon
    raw = raw.replace(/const\s+\w+\s*=\s*/, "");
    raw = raw.replace(/;\s*$/, "");
    // Step 4: Extract { } block
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) raw = match[0];
    // Step 5: Quote unquoted property names (JS → JSON)
    raw = raw.replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '$1"$2":');
    // Step 6: Remove trailing commas
    raw = raw.replace(/,\s*([}\]])/g, "$1");
    return JSON.parse(raw);
  }

  function handleConnect() {
    setSyncError("");
    setSyncMessage("");
    try {
      const raw = firebaseJson.trim();
      if (!raw) { setSyncError("Please paste your Firebase config"); return; }
      const parsed = parseFirebaseConfig(raw);
      if (!parsed || typeof parsed !== "object") { setSyncError("Invalid config object"); return; }
      if (!parsed.apiKey || parsed.apiKey.length < 10) { setSyncError("Invalid apiKey"); return; }
      if (!parsed.databaseURL) { setSyncError("Missing databaseURL"); return; }
      // Remove disconnect flag so sync can work
      localStorage.removeItem("sgf_firebase_disconnected");
      const success = saveFirebaseConfig(parsed);
      if (success) {
        setSyncStatus(getFirebaseConfig());
        setSyncMessage("Connected!");
        setFirebaseJson("");
        setTimeout(() => setSyncMessage(""), 5000);
      } else {
        setSyncError("Failed to connect");
      }
    } catch (err: any) {
      setSyncError("Parse error: " + (err?.message || "Check your { } brackets"));
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display font-semibold text-white" style={{ fontSize: "clamp(1.8rem, 3vw, 2.5rem)", letterSpacing: "-0.03em" }}>
          Settings
        </h1>
        <p className="text-[#8A8B8C] font-body text-sm mt-1">
          Manage your company settings and preferences
        </p>
      </div>

      {/* Company Details */}
      <div className="card-surface p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(212, 168, 67, 0.12)" }}>
            <Building2 className="w-5 h-5 text-[#D4A843]" />
          </div>
          <h2 className="font-display font-semibold text-white text-lg">Company Details</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label-text block mb-1.5">Company Name</label>
            <input type="text" value={company.name} onChange={(e) => setCompany({ ...company, name: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="label-text block mb-1.5">Trading Name</label>
            <input type="text" value={company.tradingName} onChange={(e) => setCompany({ ...company, tradingName: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="label-text block mb-1.5">Registration Number</label>
            <input type="text" value={company.regNumber} onChange={(e) => setCompany({ ...company, regNumber: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="label-text block mb-1.5">VAT Number</label>
            <input type="text" value={company.vatNumber} onChange={(e) => setCompany({ ...company, vatNumber: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="label-text block mb-1.5">Phone</label>
            <input type="text" value={company.phone} onChange={(e) => setCompany({ ...company, phone: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="label-text block mb-1.5">Email</label>
            <input type="email" value={company.email} onChange={(e) => setCompany({ ...company, email: e.target.value })} className="input-field" />
          </div>
          <div className="sm:col-span-2">
            <label className="label-text block mb-1.5">Physical Address</label>
            <input type="text" value={company.address} onChange={(e) => setCompany({ ...company, address: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="label-text block mb-1.5">City</label>
            <input type="text" value={company.city} onChange={(e) => setCompany({ ...company, city: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="label-text block mb-1.5">Province</label>
            <input type="text" value={company.province} onChange={(e) => setCompany({ ...company, province: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="label-text block mb-1.5">Postal Code</label>
            <input type="text" value={company.postalCode} onChange={(e) => setCompany({ ...company, postalCode: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="label-text block mb-1.5">Website</label>
            <input type="text" value={company.website} onChange={(e) => setCompany({ ...company, website: e.target.value })} className="input-field" />
          </div>
        </div>
      </div>

      {/* Banking Details */}
      <div className="card-surface p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(99, 102, 241, 0.12)" }}>
            <CreditCard className="w-5 h-5 text-[#6366F1]" />
          </div>
          <h2 className="font-display font-semibold text-white text-lg">Banking Details</h2>
        </div>
        <p className="text-sm text-[#8A8B8C] font-body mb-4">
          These details will appear on invoices and statements
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label-text block mb-1.5">Bank Name</label>
            <input type="text" value={banking.bankName} onChange={(e) => setBanking({ ...banking, bankName: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="label-text block mb-1.5">Account Name</label>
            <input type="text" value={banking.accountName} onChange={(e) => setBanking({ ...banking, accountName: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="label-text block mb-1.5">Account Number</label>
            <input type="text" value={banking.accountNumber} onChange={(e) => setBanking({ ...banking, accountNumber: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="label-text block mb-1.5">Branch Code</label>
            <input type="text" value={banking.branchCode} onChange={(e) => setBanking({ ...banking, branchCode: e.target.value })} className="input-field" />
          </div>
          <div className="sm:col-span-2">
            <label className="label-text block mb-1.5">SWIFT Code</label>
            <input type="text" value={banking.swiftCode} onChange={(e) => setBanking({ ...banking, swiftCode: e.target.value })} className="input-field" />
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div className="card-surface p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(74, 222, 128, 0.12)" }}>
            <Bell className="w-5 h-5 text-[#4ADE80]" />
          </div>
          <h2 className="font-display font-semibold text-white text-lg">Notifications</h2>
        </div>
        <div className="space-y-4">
          {[
            { key: "emailOnOrder" as const, label: "Email on new order", desc: "Send email when a sales rep places a new order" },
            { key: "emailOnPayment" as const, label: "Email on payment received", desc: "Send email when a payment is recorded" },
            { key: "smsOnOverdue" as const, label: "SMS on overdue invoice", desc: "Send SMS reminder for overdue invoices" },
            { key: "dailyReport" as const, label: "Daily summary report", desc: "Receive a daily summary of sales activity" },
            { key: "lowStockAlert" as const, label: "Low stock alert", desc: "Get notified when stock items are running low" },
          ].map((item) => (
            <div key={item.key} className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: "#0A0A0B" }}>
              <div>
                <div className="text-sm text-white font-body">{item.label}</div>
                <div className="text-xs text-[#8A8B8C] font-body">{item.desc}</div>
              </div>
              <button
                onClick={() => setNotifications({ ...notifications, [item.key]: !notifications[item.key] })}
                className="cursor-pointer relative w-11 h-6 rounded-full transition-colors duration-200"
                style={{ backgroundColor: notifications[item.key] ? "#D4A843" : "#2A2B2C" }}
              >
                <div
                  className="absolute top-0.5 w-5 h-5 rounded-full transition-transform duration-200"
                  style={{
                    backgroundColor: "#FFFFFF",
                    transform: notifications[item.key] ? "translateX(20px)" : "translateX(2px)",
                  }}
                />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Cloud Sync */}
      <div className="card-surface p-6 mb-6" style={{ border: syncStatus.configured ? "1px solid rgba(74, 222, 128, 0.2)" : "1px solid rgba(245, 158, 11, 0.2)" }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: syncStatus.configured ? "rgba(74, 222, 128, 0.12)" : "rgba(245, 158, 11, 0.12)" }}>
            {syncStatus.configured ? <Cloud className="w-5 h-5 text-[#4ADE80]" /> : <CloudOff className="w-5 h-5 text-[#F59E0B]" />}
          </div>
          <div>
            <h2 className="font-display font-semibold text-white text-lg">Cloud Sync</h2>
            <p className="text-xs text-[#8A8B8C] font-body">
              {syncStatus.configured ? `Connected: ${syncStatus.projectId}` : "NOT connected - sales rep data won't sync"}
            </p>
          </div>
        </div>

        {!syncStatus.configured ? (
          <>
            <div className="p-3 rounded-lg mb-3 text-xs" style={{ backgroundColor: "#0A0A0B", border: "1px solid #222324" }}>
              <div className="text-[#8A8B8C] mb-1">Paste your Firebase config below. You can paste the <strong>entire web snippet</strong> — comments, <code>const firebaseConfig =</code>, and all:</div>
              <code className="text-[#D4A843] font-mono-data block mt-1">// const firebaseConfig = {"{"} apiKey: "...", databaseURL: "..." {"}"};</code>
            </div>
            <textarea value={firebaseJson} onChange={(e) => setFirebaseJson(e.target.value)} placeholder='{"apiKey":"AIza...","authDomain":"your-app.firebaseapp.com","databaseURL":"https://your-app-default-rtdb.firebaseio.com","projectId":"your-app",...}' className="input-field w-full font-mono text-xs mb-3" rows={6} />
            <div className="flex gap-2">
              <button onClick={handleConnect} className="btn-primary text-sm"><Cloud className="w-4 h-4" /> Connect</button>
            </div>
            {syncError && <div className="mt-2 text-xs text-[#EF4444]"><AlertTriangle className="w-3 h-3 inline mr-1" />{syncError}</div>}
            {syncMessage && <div className="mt-2 text-xs text-[#4ADE80]"><CheckCircle className="w-3 h-3 inline mr-1" />{syncMessage}</div>}
          </>
        ) : (
          <>
            <div className="p-3 rounded-lg mb-3" style={{ backgroundColor: "rgba(74, 222, 128, 0.05)", border: "1px solid rgba(74, 222, 128, 0.15)" }}>
              <div className="text-xs text-[#4ADE80] font-body">Cloud sync is active. All devices will sync orders, check-ins, and appointments.</div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button onClick={handleSyncToCloud} className="btn-secondary text-sm"><Cloud className="w-4 h-4" /> Sync to Cloud</button>
              <button onClick={handleForceSync} className="btn-secondary text-sm"><RefreshCw className="w-4 h-4" /> Force Sync from Cloud</button>
              <button onClick={handleCopyShareLink} className="btn-secondary text-sm"><Copy className="w-4 h-4" /> Copy Share Link</button>
              <button onClick={() => { clearFirebaseConfig(); setSyncStatus(getFirebaseConfig()); }} className="px-4 py-2 rounded-lg text-sm" style={{ backgroundColor: "#222324", color: "#EF4444" }}>Disconnect</button>
              {isSuperAdmin && (
                <button onClick={async () => { if (!window.confirm("WARNING: This will WIPE all data from Firebase cloud for ALL devices. Sales reps will lose unsynced data. Are you sure?")) return; setSyncMessage("Clearing cloud data..."); const ok = await clearCloudData(); if (ok) { setSyncMessage("Cloud data cleared! Tell sales reps to disconnect and reconnect."); } else { setSyncError("Failed to clear cloud data."); } setTimeout(() => { setSyncMessage(""); setSyncError(""); }, 5000); }} className="px-4 py-2 rounded-lg text-sm" style={{ backgroundColor: "#EF4444", color: "#fff" }}>Clear Cloud Data</button>
              )}
            </div>
            {/* Emergency Sync Buttons */}
            <div className="mt-4 p-4 rounded-lg" style={{ backgroundColor: "rgba(212, 168, 67, 0.05)", border: "1px solid rgba(212, 168, 67, 0.2)" }}>
              <div className="text-xs font-semibold text-[#D4A843] mb-2">Emergency Sync Tools</div>
              <div className="flex gap-2 flex-wrap">
                <button onClick={handleForcePushAll} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ backgroundColor: "rgba(212, 168, 67, 0.15)", color: "#D4A843", border: "1px solid rgba(212, 168, 67, 0.3)" }}>
                  <Cloud className="w-4 h-4 inline mr-1" /> Force Push ALL My Data
                </button>
                <button onClick={handleForcePullAll} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ backgroundColor: "rgba(99, 102, 241, 0.15)", color: "#6366F1", border: "1px solid rgba(99, 102, 241, 0.3)" }}>
                  <RefreshCw className="w-4 h-4 inline mr-1" /> Force Pull ALL from Cloud
                </button>
                <button onClick={handleDiagnose} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ backgroundColor: "rgba(74, 222, 128, 0.1)", color: "#4ADE80", border: "1px solid rgba(74, 222, 128, 0.3)" }}>
                  Diagnose Sync
                </button>
              </div>
              {forcePushStatus && <div className="mt-2 text-xs text-[#D4A843]"><Cloud className="w-3 h-3 inline mr-1" />{forcePushStatus}</div>}
              {forcePullStatus && <div className="mt-2 text-xs text-[#6366F1]"><RefreshCw className="w-3 h-3 inline mr-1" />{forcePullStatus}</div>}
              {diagnoseResult && <div className="mt-2 text-xs text-[#4ADE80] break-all">{diagnoseResult}</div>}
              <div className="mt-2 text-[10px] text-[#8A8B8C]">
                <strong>Force Push</strong>: Sends every item from this device to Firebase. Use if other users can't see your data.<br />
                <strong>Force Pull</strong>: Downloads all data from Firebase to this device. Use if you're seeing stale data.<br />
                <strong>Diagnose</strong>: Shows item counts in Firebase vs this device. Use to check if sync is working.
              </div>
            </div>
            {syncStatus.configured && shareUrl && (
              <div className="mt-2 p-2 rounded text-xs break-all select-all" style={{ backgroundColor: "#0A0A0B", border: "1px solid #222324", color: "#8A8B8C" }} onClick={(e) => { const range = document.createRange(); range.selectNodeContents(e.currentTarget); const sel = window.getSelection()!; sel.removeAllRanges(); sel.addRange(range); }}>
                Share URL: {shareUrl}
              </div>
            )}
            {syncError && <div className="mt-2 text-xs text-[#EF4444]"><AlertTriangle className="w-3 h-3 inline mr-1" />{syncError}</div>}
            {syncMessage && <div className="mt-2 text-xs text-[#4ADE80]"><CheckCircle className="w-3 h-3 inline mr-1" />{syncMessage}</div>}
            {forceSyncStatus && <div className="mt-2 text-xs text-[#D4A843]"><RefreshCw className="w-3 h-3 inline mr-1" />{forceSyncStatus}</div>}
          </>
        )}
      </div>

      {/* Save */}
      <div className="flex items-center gap-4">
        <button onClick={handleSave} className="btn-primary">
          <Save className="w-4 h-4" /> Save Settings
        </button>
        {saved && (
          <span className="text-sm text-[#4ADE80] font-body">Settings saved successfully!</span>
        )}
      </div>

      {/* Clear status overlay */}
      {clearStatus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.85)" }}>
          <div className="text-center">
            <div className="w-12 h-12 border-3 border-[#D4A843] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <div className="text-white font-display text-lg">{clearStatus}</div>
            <div className="text-[#8A8B8C] text-sm mt-2">Please wait...</div>
          </div>
        </div>
      )}

      {/* Admin Tools - Admin & Super Admin */}
      {isAdmin && (
        <div className="card-surface p-6 mt-6" style={{ border: "1px solid rgba(212, 168, 67, 0.2)" }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(212, 168, 67, 0.12)" }}>
              <Wrench className="w-5 h-5 text-[#D4A843]" />
            </div>
            <h2 className="font-display font-semibold text-white text-lg">Admin Tools</h2>
          </div>
          <p className="text-sm text-[#8A8B8C] font-body mb-4">
            Maintenance tools. Only use if instructed.
          </p>
          <div className="space-y-3">
            <button
              onClick={() => {
                const result = fixDuplicateInvoiceNumbers();
                if (result.changes.length > 0) {
                  setSyncMessage(`Fixed ${result.changes.length} duplicate invoice numbers. See audit log for details.`);
                } else {
                  setSyncMessage("No duplicate invoice numbers found — all clean!");
                }
                setTimeout(() => setSyncMessage(""), 5000);
              }}
              className="btn-secondary text-sm w-full"
            >
              <Hash className="w-4 h-4" /> Fix Duplicate SGF Numbers
            </button>
            <button
              onClick={() => {
                setSyncMessage("Scanning for missing invoices...");
                generateMissingInvoices.mutate();
              }}
              className="btn-secondary text-sm w-full mt-3"
            >
              <FileText className="w-4 h-4" /> Generate Missing Invoices
            </button>
            <button
              onClick={() => {
                setSyncMessage("Re-linking Sage invoices by customerCode...");
                relinkSage.mutate();
              }}
              className="btn-secondary text-sm w-full mt-3"
            >
              <Link className="w-4 h-4" /> Re-link Sage Invoices to Customers
            </button>
            <p className="text-[10px] text-[#8A8B8C] mt-1">
              Scans all orders and creates SGF invoices for any missing ones. Results are pushed to the cloud automatically.
            </p>
            <p className="text-[10px] text-[#8A8B8C]">
              Links existing Sage invoices to app customers using customerCode. Run this after updating Sage data with app customerCodes. Safe to run anytime.
            </p>
            <p className="text-[10px] text-[#8A8B8C]">
              Safety net: scans all invoices. Only fixes if duplicates are found. Safe to run anytime — does nothing if all invoices are clean.
            </p>
          </div>
        </div>
      )}

      {/* Danger Zone - Super Admin Only */}
      {isSuperAdmin && (
        <div className="card-surface p-6 mt-6" style={{ border: "1px solid rgba(239, 68, 68, 0.2)" }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(239, 68, 68, 0.12)" }}>
              <Trash2 className="w-5 h-5 text-[#EF4444]" />
            </div>
            <h2 className="font-display font-semibold text-white text-lg">Danger Zone</h2>
          </div>
          <p className="text-sm text-[#8A8B8C] font-body mb-4">
            Use these options to clear data before going live. These actions cannot be undone.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
            <button onClick={handleClearAppointments} className="px-4 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-all" style={{ backgroundColor: "rgba(99, 102, 241, 0.12)", color: "#6366F1", border: "1px solid rgba(99, 102, 241, 0.3)" }}>
              <Trash2 className="w-4 h-4 inline mr-2" />Clear Appointments &amp; Check-ins
            </button>
            <button onClick={handleClearAllData} className="px-4 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-all" style={{ backgroundColor: "rgba(245, 158, 11, 0.12)", color: "#F59E0B", border: "1px solid rgba(245, 158, 11, 0.3)" }}>
              <Trash2 className="w-4 h-4 inline mr-2" />Clear All Transaction Data
            </button>
            <button onClick={handleFullReset} className="px-4 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-all" style={{ backgroundColor: "rgba(239, 68, 68, 0.12)", color: "#EF4444", border: "1px solid rgba(239, 68, 68, 0.3)" }}>
              <Trash2 className="w-4 h-4 inline mr-2" />Factory Reset (Everything)
            </button>
          </div>
          <div className="mt-3 text-xs text-[#8A8B8C]">
            <strong>Clear Transaction Data</strong> removes: orders, invoices, receipts, payments, appointments, check-ins, follow-ups, collections, audit logs. Keeps: users, customers, products, company settings.<br />
            <strong>Factory Reset</strong> removes everything and reloads defaults.
          </div>
        </div>
      )}
    </div>
  );
}
