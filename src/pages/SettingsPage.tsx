import { useState } from "react";
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
} from "lucide-react";
import { getFirebaseConfig, saveFirebaseConfig, clearFirebaseConfig, initFirebase, syncAllLocalData, pushCustomers, pushStock } from "@/lib/firebaseSync";

export default function SettingsPage() {
  const [saved, setSaved] = useState(false);

  const [company, setCompany] = useState({
    name: "Supreme Global Foods",
    tradingName: "Supreme Global Foods",
    regNumber: "2015/123456/07",
    vatNumber: "4120123456",
    phone: "+27614788888",
    email: "sales@supremeglobalfoods.co.za",
    address: "Germiston, 1422",
    city: "Germiston",
    province: "Gauteng",
    postalCode: "1422",
    website: "https://www.supremeglobalfoods.co.za",
  });

  const [banking, setBanking] = useState({
    bankName: "First National Bank (FNB)",
    accountName: "Supreme Global Foods",
    accountNumber: "62001234567",
    branchCode: "250655",
    swiftCode: "FIRNZAJJ",
  });

  const [notifications, setNotifications] = useState({
    emailOnOrder: true,
    emailOnPayment: true,
    smsOnOverdue: false,
    dailyReport: true,
    lowStockAlert: true,
  });

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  // Cloud Sync
  const [syncStatus, setSyncStatus] = useState(getFirebaseConfig());
  const [firebaseJson, setFirebaseJson] = useState("");
  const [syncMessage, setSyncMessage] = useState("");
  const [syncError, setSyncError] = useState("");

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
            <textarea value={firebaseJson} onChange={(e) => setFirebaseJson(e.target.value)} placeholder='Paste Firebase config JSON here...' className="input-field w-full font-mono text-xs mb-3" rows={6} />
            <div className="flex gap-2">
              <button onClick={() => { setSyncError(""); try { let raw = firebaseJson.trim(); const match = raw.match(/\{[\s\S]*\}/); if (match) raw = match[0]; const parsed = new Function("return " + raw)(); if (!parsed.apiKey || parsed.apiKey.length < 10) { setSyncError("Invalid apiKey"); return; } if (!parsed.databaseURL) { setSyncError("Missing databaseURL"); return; } const success = saveFirebaseConfig(parsed); if (success) { setSyncStatus(getFirebaseConfig()); setSyncMessage("Connected!"); setFirebaseJson(""); } else { setSyncError("Failed to connect"); } } catch { setSyncError("Invalid format"); } }} className="btn-primary text-sm"><Cloud className="w-4 h-4" /> Connect</button>
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
              <button onClick={async () => { setSyncMessage("Syncing..."); const localOrders = JSON.parse(localStorage.getItem("sgf_orders") || "[]"); const localCheckins = JSON.parse(localStorage.getItem("sgf_checkins") || "[]"); const localAppointments = JSON.parse(localStorage.getItem("sgf_appointments") || "[]"); const localInvoices = JSON.parse(localStorage.getItem("sgf_invoices") || "[]"); const localCustomers = JSON.parse(localStorage.getItem("sgf_customers") || "[]"); const localStock = JSON.parse(localStorage.getItem("sgf_products") || "[]"); await syncAllLocalData({ orders: localOrders, checkins: localCheckins, appointments: localAppointments, invoices: localInvoices }); if (localCustomers.length > 0) await pushCustomers(localCustomers); if (localStock.length > 0) await pushStock(localStock); setSyncMessage("Synced to cloud! Sales reps will receive data automatically."); setTimeout(() => setSyncMessage(""), 5000); }} className="btn-secondary text-sm"><Cloud className="w-4 h-4" /> Sync to Cloud</button>
              <button onClick={() => { const cfg = localStorage.getItem("sgf_firebase_config"); if (cfg) { navigator.clipboard.writeText(window.location.origin + window.location.pathname + "?fb=" + btoa(cfg)); setSyncMessage("Share link copied! Send this to your sales reps."); setTimeout(() => setSyncMessage(""), 5000); } }} className="btn-secondary text-sm"><Copy className="w-4 h-4" /> Copy Share Link</button>
              <button onClick={() => { clearFirebaseConfig(); setSyncStatus(getFirebaseConfig()); }} className="px-4 py-2 rounded-lg text-sm" style={{ backgroundColor: "#222324", color: "#EF4444" }}>Disconnect</button>
            </div>
            {syncMessage && <div className="mt-2 text-xs text-[#4ADE80]"><CheckCircle className="w-3 h-3 inline mr-1" />{syncMessage}</div>}
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
    </div>
  );
}
