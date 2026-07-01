import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { reloadFromStorage } from "@/lib/dataService";
import CustomerSearchDropdown from "@/components/CustomerSearchDropdown";
import DatePicker from "@/components/DatePicker";
import {
  AlertTriangle, Phone, Mail, MessageSquare, HandCoins,
  Ban, FileText, Calendar, CheckCircle, Clock, User,
  DollarSign, TrendingUp, ShieldAlert, ClipboardList,
  Printer, X, ChevronDown, ChevronUp, Send, Lock, LockOpen,
} from "lucide-react";

const BUCKET_CONFIG: Record<string, { label: string; color: string; bg: string; desc: string }> = {
  pre_due: { label: "Due Soon", color: "#6366F1", bg: "rgba(99,102,241,0.1)", desc: "0-2 days before due" },
  due_today: { label: "Due Today", color: "#F59E0B", bg: "rgba(245,158,11,0.1)", desc: "Payment due today" },
  days_1_2: { label: "1-2 Days Over", color: "#F59E0B", bg: "rgba(245,158,11,0.12)", desc: "Friendly reminder" },
  days_3_5: { label: "3-5 Days Over", color: "#F97316", bg: "rgba(249,115,22,0.12)", desc: "Phone call required" },
  days_6_10: { label: "6-10 Days Over", color: "#EF4444", bg: "rgba(239,68,68,0.12)", desc: "Formal follow-up" },
  days_11_20: { label: "11-20 Days Over", color: "#EF4444", bg: "rgba(239,68,68,0.15)", desc: "Final notice" },
  days_21_plus: { label: "21+ Days Over", color: "#DC2626", bg: "rgba(220,38,38,0.2)", desc: "Legal/Management" },
};

const REMINDER_TEMPLATES: Record<string, { subject: string; body: string }> = {
  pre_due: {
    subject: "Payment Reminder - Invoice {invoiceNumber}",
    body: `Dear {customerName},\n\nThis is a friendly reminder that your invoice {invoiceNumber} for R {amount} is due on {dueDate}.\n\nPlease ensure payment is arranged to avoid any inconvenience.\n\nBanking Details:\nFNB | Account: 62001234567 | Branch: 250655\nQuote: {invoiceNumber}\n\nThank you for your continued business.\n\nSupreme Global Foods`,
  },
  days_1_2: {
    subject: "Friendly Reminder - Outstanding Invoice {invoiceNumber}",
    body: `Dear {customerName},\n\nWe noticed that invoice {invoiceNumber} for R {amount} is now {daysOverdue} day(s) overdue.\n\nIf payment has already been made, please disregard this notice and send us proof of payment.\n\nBanking Details:\nFNB | Account: 62001234567 | Branch: 250655\nQuote: {invoiceNumber}\n\nPlease contact us if you need to discuss payment arrangements.\n\nSupreme Global Foods`,
  },
  days_3_5: {
    subject: "Urgent: Invoice {invoiceNumber} - {daysOverdue} Days Overdue",
    body: `Dear {customerName},\n\nInvoice {invoiceNumber} for R {amount} is now {daysOverdue} days overdue.\n\nWe kindly request immediate payment or a call to arrange a payment plan.\n\nOutstanding balance: R {balanceDue}\n\nBanking Details:\nFNB | Account: 62001234567 | Branch: 250655\nQuote: {invoiceNumber}\n\nPlease contact our accounts department on 083 293 0644 to discuss.\n\nSupreme Global Foods`,
  },
  days_6_10: {
    subject: "FINAL NOTICE - Invoice {invoiceNumber} - {daysOverdue} Days Overdue",
    body: `Dear {customerName},\n\nDespite our previous reminders, invoice {invoiceNumber} for R {amount} remains unpaid and is now {daysOverdue} days overdue.\n\nOutstanding balance: R {balanceDue}\n\nUnless payment is received or a satisfactory arrangement is made within 48 hours, we will regrettably have to place your account on hold, which will prevent future deliveries.\n\nBanking Details:\nFNB | Account: 62001234567 | Branch: 250655\nQuote: {invoiceNumber}\n\nContact: 083 293 0644\n\nSupreme Global Foods`,
  },
  days_11_20: {
    subject: "ACCOUNT HOLD PENDING - Invoice {invoiceNumber}",
    body: `Dear {customerName},\n\nInvoice {invoiceNumber} for R {amount} is now {daysOverdue} days overdue.\n\nWe have attempted to contact you on several occasions without success.\n\nOUTSTANDING: R {balanceDue}\n\nYour account has been flagged for immediate hold. No further orders will be processed until this matter is resolved.\n\nPlease contact management urgently: 083 293 0644\n\nSupreme Global Foods`,
  },
  days_21_plus: {
    subject: "LEGAL NOTICE PENDING - Invoice {invoiceNumber}",
    body: `Dear {customerName},\n\nInvoice {invoiceNumber} for R {amount} is now {daysOverdue} days overdue.\n\nThis matter has been escalated to management for legal action consideration.\n\nOUTSTANDING: R {balanceDue}\n\nTo avoid legal proceedings, please make immediate payment or contact our legal department within 24 hours.\n\nContact: 083 293 0644\n\nSupreme Global Foods`,
  },
};

export default function CollectionsPage() {
  const utils = trpc.useUtils();
  const [activeTab, setActiveTab] = useState<"pipeline" | "daily" | "history">("pipeline");
  const [selectedBucket, setSelectedBucket] = useState<string>("all");
  const [expandedInvoice, setExpandedInvoice] = useState<number | null>(null);
  const [showActionModal, setShowActionModal] = useState<string | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [historyCustomerId, setHistoryCustomerId] = useState(0);

  // Queries
  const { data: overdueInvoices } = trpc.collections.getOverdueInvoices.useQuery();
  const { data: dailyReport } = trpc.collections.getDailyReport.useQuery();
  const { data: stats } = trpc.collections.getStats.useQuery();
  const { data: customers } = trpc.customer.search.useQuery({ query: " " });
  const { data: customerHistory } = trpc.collections.getCustomerPaymentHistory.useQuery(historyCustomerId, { enabled: historyCustomerId > 0 });

  // Mutations
  const invalidateCollections = async () => {
    reloadFromStorage();
    await utils.collections.getOverdueInvoices.invalidate();
    await utils.collections.getDailyReport.invalidate();
    await utils.collections.getStats.invalidate();
    await utils.invoice.list.invalidate();
  };
  const addNote = trpc.collections.addNote.useMutation({ onSuccess: invalidateCollections });
  const recordPromise = trpc.collections.recordPromise.useMutation({ onSuccess: invalidateCollections });
  const placeHold = trpc.collections.placeHold.useMutation({ onSuccess: invalidateCollections });
  const releaseHold = trpc.collections.releaseHold.useMutation({ onSuccess: invalidateCollections });

  const filteredInvoices = selectedBucket === "all"
    ? (overdueInvoices || [])
    : (overdueInvoices || []).filter((inv: any) => inv.bucket === selectedBucket);

  function openAction(action: string, invoice: any) {
    setSelectedInvoice(invoice);
    setShowActionModal(action);
  }

  function generateReminderText(invoice: any, bucket: string) {
    const template = REMINDER_TEMPLATES[bucket] || REMINDER_TEMPLATES.days_1_2;
    return template.body
      .replace(/{customerName}/g, invoice.customer?.name || "Valued Customer")
      .replace(/{invoiceNumber}/g, invoice.invoiceNumber)
      .replace(/{amount}/g, Number(invoice.total).toFixed(2))
      .replace(/{balanceDue}/g, Number(invoice.balanceDue).toFixed(2))
      .replace(/{daysOverdue}/g, String(invoice.daysOverdue))
      .replace(/{dueDate}/g, invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString("en-ZA") : "N/A")
      .replace(/{salesRep}/g, invoice.salesRepName || invoice.customer?.salesRepName || "");
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display font-semibold text-white" style={{ fontSize: "clamp(1.8rem, 3vw, 2.5rem)", letterSpacing: "-0.03em" }}>Collections</h1>
          <p className="text-[#8A8B8C] font-body text-sm mt-1">Automated payment collection &amp; overdue tracking</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <div className="card-surface p-4">
          <div className="label-text mb-1">OUTSTANDING</div>
          <div className="stat-number" style={{ color: "#F59E0B", fontSize: "1.3rem" }}>R {(stats?.totalOutstanding || 0).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</div>
        </div>
        <div className="card-surface p-4">
          <div className="label-text mb-1">OVERDUE</div>
          <div className="stat-number" style={{ color: "#EF4444" }}>{stats?.totalOverdueInvoices || 0}</div>
        </div>
        <div className="card-surface p-4">
          <div className="label-text mb-1">ON HOLD</div>
          <div className="stat-number" style={{ color: "#DC2626" }}>{stats?.onHold || 0}</div>
        </div>
        <div className="card-surface p-4">
          <div className="label-text mb-1">PROMISES</div>
          <div className="stat-number" style={{ color: "#6366F1" }}>{stats?.pendingPromises || 0}</div>
        </div>
        <div className="card-surface p-4">
          <div className="label-text mb-1">COLLECTED TODAY</div>
          <div className="stat-number" style={{ color: "#4ADE80" }}>{dailyReport?.summary?.todayActivities || 0}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button onClick={() => setActiveTab("pipeline")} className="px-4 py-2 rounded-full text-sm font-body font-medium transition-all cursor-pointer" style={{ backgroundColor: activeTab === "pipeline" ? "#D4A843" : "#18191A", color: activeTab === "pipeline" ? "#0A0A0B" : "#8A8B8C" }}>Collection Pipeline</button>
        <button onClick={() => setActiveTab("daily")} className="px-4 py-2 rounded-full text-sm font-body font-medium transition-all cursor-pointer" style={{ backgroundColor: activeTab === "daily" ? "#D4A843" : "#18191A", color: activeTab === "daily" ? "#0A0A0B" : "#8A8B8C" }}>Daily Report</button>
        <button onClick={() => setActiveTab("history")} className="px-4 py-2 rounded-full text-sm font-body font-medium transition-all cursor-pointer" style={{ backgroundColor: activeTab === "history" ? "#D4A843" : "#18191A", color: activeTab === "history" ? "#0A0A0B" : "#8A8B8C" }}>Customer History</button>
      </div>

      {/* PIPELINE VIEW */}
      {activeTab === "pipeline" && (
        <div className="space-y-4">
          {/* Bucket Filter */}
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setSelectedBucket("all")} className="px-3 py-1.5 rounded-full text-xs font-body font-medium transition-all cursor-pointer" style={{ backgroundColor: selectedBucket === "all" ? "#D4A843" : "#18191A", color: selectedBucket === "all" ? "#0A0A0B" : "#8A8B8C" }}>All ({(overdueInvoices || []).length})</button>
            {Object.entries(BUCKET_CONFIG).map(([key, cfg]) => {
              const count = (overdueInvoices || []).filter((i: any) => i.bucket === key).length;
              return (
                <button key={key} onClick={() => setSelectedBucket(key)} className="px-3 py-1.5 rounded-full text-xs font-body font-medium transition-all cursor-pointer" style={{ backgroundColor: selectedBucket === key ? cfg.color : "#18191A", color: selectedBucket === key ? "#fff" : "#8A8B8C", border: `1px solid ${selectedBucket === key ? cfg.color : "transparent"}` }}>
                  {cfg.label} ({count})
                </button>
              );
            })}
          </div>

          {/* Invoices Table */}
          <div className="card-surface overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ backgroundColor: "#131415", borderBottom: "1px solid #222324" }}>
                    <th className="text-left p-3 label-text">Invoice</th>
                    <th className="text-left p-3 label-text">Customer</th>
                    <th className="text-left p-3 label-text">Rep</th>
                    <th className="text-right p-3 label-text">Balance</th>
                    <th className="text-center p-3 label-text">Days</th>
                    <th className="text-left p-3 label-text">Bucket</th>
                    <th className="text-left p-3 label-text">Promise</th>
                    <th className="text-center p-3 label-text">Hold</th>
                    <th className="text-right p-3 label-text">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.length === 0 ? (
                    <tr><td colSpan={9} className="p-8 text-center text-[#8A8B8C] font-body">No invoices in this category</td></tr>
                  ) : (
                    filteredInvoices.map((inv: any) => {
                      const cfg = BUCKET_CONFIG[inv.bucket] || BUCKET_CONFIG.days_1_2;
                      return (
                        <>
                          <tr key={inv.id} className="transition-colors hover:bg-[#131415]" style={{ borderBottom: "1px solid #18191A" }}>
                            <td className="p-3 font-mono-data text-xs text-[#D4A843]">{inv.invoiceNumber}</td>
                            <td className="p-3 text-sm text-[#E8E8E9] font-body">{inv.customer?.name || "N/A"}</td>
                            <td className="p-3 text-sm text-[#4ADE80] font-body">{inv.salesRepName || inv.customer?.salesRepName || "-"}</td>
                            <td className="p-3 text-right font-display text-white">R {inv.balanceDue.toFixed(2)}</td>
                            <td className="p-3 text-center">
                              <span className="text-sm font-body font-semibold" style={{ color: inv.daysOverdue > 5 ? "#EF4444" : "#F59E0B" }}>{inv.daysOverdue > 0 ? `+${inv.daysOverdue}` : inv.daysOverdue}</span>
                            </td>
                            <td className="p-3">
                              <span className="status-badge text-xs" style={{ backgroundColor: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                            </td>
                            <td className="p-3 text-xs font-body">
                              {inv.latestPromise ? (
                                <span className="text-[#6366F1]">{new Date(inv.latestPromise.promiseDate).toLocaleDateString("en-ZA")}</span>
                              ) : (
                                <span className="text-[#8A8B8C]">-</span>
                              )}
                            </td>
                            <td className="p-3 text-center">
                              {inv.accountHold ? <Ban className="w-4 h-4 text-[#EF4444] inline" /> : <span className="text-[#8A8B8C]">-</span>}
                            </td>
                            <td className="p-3 text-right">
                              <button onClick={() => setExpandedInvoice(expandedInvoice === inv.id ? null : inv.id)} className="p-1 hover:text-[#D4A843] transition-colors cursor-pointer" title="Actions"><ChevronDown className={`w-4 h-4 text-[#8A8B8C] transition-transform ${expandedInvoice === inv.id ? "rotate-180" : ""}`} /></button>
                            </td>
                          </tr>
                          {/* Expanded Actions */}
                          {expandedInvoice === inv.id && (
                            <tr><td colSpan={9} className="p-4" style={{ backgroundColor: "#0A0A0B" }}>
                              <div className="flex flex-wrap gap-2">
                                <button onClick={() => openAction("call", inv)} className="btn-secondary text-xs"><Phone className="w-3 h-3" /> Log Call</button>
                                <button onClick={() => openAction("email", inv)} className="btn-secondary text-xs"><Mail className="w-3 h-3" /> Send Reminder</button>
                                <button onClick={() => openAction("sms", inv)} className="btn-secondary text-xs"><MessageSquare className="w-3 h-3" /> SMS</button>
                                <button onClick={() => openAction("promise", inv)} className="btn-secondary text-xs" style={{ borderColor: "rgba(99,102,241,0.3)" }}><HandCoins className="w-3 h-3" /> Promise to Pay</button>
                                {!inv.accountHold && <button onClick={() => openAction("hold", inv)} className="btn-secondary text-xs hover:text-[#EF4444]" style={{ borderColor: "rgba(239,68,68,0.2)" }}><Lock className="w-3 h-3" /> Place Hold</button>}
                                {inv.accountHold && <button onClick={() => { releaseHold.mutate({ holdId: inv.accountHold.id }); }} className="btn-secondary text-xs hover:text-[#4ADE80]" style={{ borderColor: "rgba(74,222,128,0.2)" }}><LockOpen className="w-3 h-3" /> Release Hold</button>}
                                <button onClick={() => openAction("note", inv)} className="btn-secondary text-xs"><ClipboardList className="w-3 h-3" /> Add Note</button>
                              </div>
                              {/* Collection Notes */}
                              {(inv.collectionNotes || []).length > 0 && (
                                <div className="mt-3 space-y-1">
                                  <div className="text-xs text-[#8A8B8C] font-body font-semibold mb-1">Recent Activity:</div>
                                  {(inv.collectionNotes || []).slice(0, 3).map((note: any) => (
                                    <div key={note.id} className="text-xs text-[#8A8B8C] font-body flex items-center gap-2">
                                      <span className="text-[#D4A843]">{new Date(note.createdAt).toLocaleDateString("en-ZA")}</span>
                                      <span className="capitalize" style={{ color: note.type === "hold" ? "#EF4444" : note.type === "promise" ? "#6366F1" : "#8A8B8C" }}>[{note.type}]</span>
                                      {note.notes}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </td></tr>
                          )}
                        </>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* DAILY REPORT */}
      {activeTab === "daily" && (
        <div className="space-y-4">
          <div className="card-surface p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-display font-semibold text-white">Daily Collections Report</h3>
                <p className="text-xs text-[#8A8B8C] font-body">Generated: {dailyReport?.generatedAt ? new Date(dailyReport.generatedAt).toLocaleString("en-ZA") : "-"}</p>
              </div>
              <button onClick={() => printDailyReport(dailyReport)} className="btn-secondary text-xs"><Printer className="w-3 h-3" /> Print Report</button>
            </div>
            {/* Bucket Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
              {Object.entries(BUCKET_CONFIG).map(([key, cfg]) => {
                const bucketItems = (dailyReport?.byBucket as any)?.[key] || [];
                const count = bucketItems.length;
                const total = bucketItems.reduce((s: number, i: any) => s + i.balanceDue, 0);
                return (
                  <div key={key} className="p-3 rounded-lg text-center" style={{ backgroundColor: cfg.bg, border: `1px solid ${cfg.color}30` }}>
                    <div className="text-lg font-display font-bold" style={{ color: cfg.color }}>{count}</div>
                    <div className="text-xs font-body" style={{ color: cfg.color }}>{cfg.label}</div>
                    {count > 0 && <div className="text-xs font-body mt-1" style={{ color: "#8A8B8C" }}>R {total.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</div>}
                  </div>
                );
              })}
            </div>
            {/* Today's Activities */}
            {(dailyReport?.todayActivities || []).length > 0 && (
              <div>
                <h4 className="font-display font-semibold text-white text-sm mb-3">Today&apos;s Collection Activities</h4>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {(dailyReport?.todayActivities || []).map((activity: any, i: number) => (
                    <div key={i} className="flex items-center gap-3 p-2 rounded" style={{ backgroundColor: "#0A0A0B" }}>
                      {activity.type === "call" && <Phone className="w-4 h-4 text-[#D4A843]" />}
                      {activity.type === "email" && <Mail className="w-4 h-4 text-[#6366F1]" />}
                      {activity.type === "sms" && <MessageSquare className="w-4 h-4 text-[#4ADE80]" />}
                      {activity.type === "promise" && <HandCoins className="w-4 h-4 text-[#6366F1]" />}
                      {activity.type === "hold" && <Ban className="w-4 h-4 text-[#EF4444]" />}
                      {activity.type === "payment_received" && <DollarSign className="w-4 h-4 text-[#4ADE80]" />}
                      <span className="text-xs text-[#8A8B8C] font-body capitalize">{activity.type}</span>
                      <span className="text-xs text-white font-body">{activity.notes || activity.reason || "-"}</span>
                      <span className="text-xs text-[#8A8B8C] font-body ml-auto">{new Date(activity.createdAt).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CUSTOMER HISTORY */}
      {activeTab === "history" && (
        <div className="card-surface p-6 space-y-4">
          <div>
            <label className="label-text block mb-1.5">Search Customer</label>
            <CustomerSearchDropdown customers={customers || []} value={historyCustomerId} onChange={setHistoryCustomerId} placeholder="Search customer to view payment history..." />
          </div>
          {customerHistory && historyCustomerId > 0 && (
            <div className="space-y-3">
              {(customerHistory || []).map((inv: any) => (
                <div key={inv.id} className="p-4 rounded-lg" style={{ backgroundColor: "#0A0A0B" }}>
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="font-mono-data text-xs text-[#D4A843]">{inv.invoiceNumber}</span>
                      <span className="ml-3 text-sm text-white font-body">R {Number(inv.total).toFixed(2)}</span>
                    </div>
                    <span className="status-badge text-xs" style={{ backgroundColor: inv.status === "paid" ? "rgba(74,222,128,0.12)" : "rgba(245,158,11,0.12)", color: inv.status === "paid" ? "#4ADE80" : "#F59E0B" }}>{inv.status}</span>
                  </div>
                  {(inv.notes || []).length > 0 && (
                    <div className="mt-2 space-y-1">
                      {inv.notes.slice(0, 3).map((n: any) => (
                        <div key={n.id} className="text-xs text-[#8A8B8C] font-body">
                          <span className="text-[#D4A843]">{new Date(n.createdAt).toLocaleDateString("en-ZA")}</span> <span className="capitalize">[{n.type}]</span> {n.notes}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ACTION MODALS */}
      {showActionModal && selectedInvoice && (
        <ActionModal
          action={showActionModal}
          invoice={selectedInvoice}
          onClose={() => setShowActionModal(null)}
          onSubmit={(data: any) => {
            if (showActionModal === "call" || showActionModal === "note") {
              addNote.mutate({ invoiceId: selectedInvoice.id, customerId: selectedInvoice.customerId, ...data });
            } else if (showActionModal === "email" || showActionModal === "sms") {
              addNote.mutate({ invoiceId: selectedInvoice.id, customerId: selectedInvoice.customerId, type: showActionModal, contactMethod: showActionModal, ...data });
            } else if (showActionModal === "promise") {
              recordPromise.mutate({ invoiceId: selectedInvoice.id, customerId: selectedInvoice.customerId, ...data });
            } else if (showActionModal === "hold") {
              placeHold.mutate({ customerId: selectedInvoice.customerId, ...data });
            }
            setShowActionModal(null);
          }}
          reminderText={showActionModal === "email" || showActionModal === "sms" ? generateReminderText(selectedInvoice, selectedInvoice.bucket) : ""}
        />
      )}
    </div>
  );
}

function printDailyReport(report: any) {
  if (!report) return;
  const pw = window.open("", "_blank");
  if (!pw) return;
  const buckets = report.byBucket || {};
  const bucketCards = Object.entries(buckets).map(([bucket, items]: [string, any]) => {
    const cfg = BUCKET_CONFIG[bucket] || BUCKET_CONFIG.days_1_2;
    return '<div class="stat"><div class="stat-num" style="color:' + cfg.color + '">' + items.length + '</div><div class="stat-label">' + cfg.label + '</div></div>';
  }).join("");
  const rows = Object.entries(buckets).flatMap(([_, items]: [string, any]) => {
    return items.map((inv: any) => '<tr><td>' + inv.invoiceNumber + '</td><td>' + (inv.customer?.name || "") + '</td><td>R ' + inv.balanceDue.toFixed(2) + '</td><td>' + inv.daysOverdue + '</td><td>' + (BUCKET_CONFIG[inv.bucket]?.label || "") + '</td></tr>');
  }).join("");
  pw.document.write('<html><head><title>Daily Collections Report</title><style>body{font-family:Arial,sans-serif;padding:40px;max-width:900px;margin:0 auto;color:#333}.header{text-align:center;border-bottom:3px solid #D4A843;padding-bottom:20px;margin-bottom:30px}.stat{display:inline-block;padding:15px 25px;margin:10px;background:#f9f9f9;border-radius:8px;text-align:center}.stat-num{font-size:24px;font-weight:bold;color:#D4A843}.stat-label{font-size:12px;color:#666;text-transform:uppercase}table{width:100%;border-collapse:collapse;margin:20px 0}th{background:#f5f5f5;padding:10px;text-align:left;font-size:11px;text-transform:uppercase}td{padding:10px;border-bottom:1px solid #eee;font-size:13px}</style></head><body><div class="header"><h1 style="font-size:28px;color:#D4A843;margin:0">Supreme Global Foods</h1><p>Daily Collections Report - ' + report.today + '</p></div><div style="text-align:center">' + bucketCards + '</div><table><thead><tr><th>Invoice</th><th>Customer</th><th>Balance</th><th>Days Over</th><th>Bucket</th></tr></thead><tbody>' + rows + '</tbody></table></body></html>');
  pw.document.close();
  pw.print();
}

function ActionModal({ action, invoice, onClose, onSubmit, reminderText }: { action: string; invoice: any; onClose: () => void; onSubmit: (data: any) => void; reminderText: string }) {
  const [notes, setNotes] = useState(action === "email" || action === "sms" ? reminderText : "");
  const [contactPerson, setContactPerson] = useState("");
  const [promisedAmount, setPromisedAmount] = useState(Number(invoice.balanceDue) || 0);
  const [promiseDate, setPromiseDate] = useState(new Date().toISOString().slice(0, 10));
  const [holdReason, setHoldReason] = useState("Non-payment after multiple reminders");
  const [followUpDate, setFollowUpDate] = useState("");

  const titles: Record<string, string> = {
    call: "Log Phone Call",
    email: "Send Email Reminder",
    sms: "Send SMS Reminder",
    promise: "Record Promise to Pay",
    hold: "Place Account on Hold",
    note: "Add Collection Note",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.7)" }}>
      <div className="card-surface p-6 max-w-lg w-full mx-4" style={{ borderRadius: 16 }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-semibold text-white">{titles[action] || "Action"}</h3>
          <button onClick={onClose} className="cursor-pointer"><X className="w-5 h-5 text-[#8A8B8C]" /></button>
        </div>
        <div className="mb-4 p-3 rounded-lg" style={{ backgroundColor: "#0A0A0B" }}>
          <div className="text-xs text-[#8A8B8C]">Invoice: <span className="text-[#D4A843]">{invoice.invoiceNumber}</span></div>
          <div className="text-xs text-[#8A8B8C]">Customer: <span className="text-white">{invoice.customer?.name}</span></div>
          <div className="text-xs text-[#8A8B8C]">Balance: <span className="text-[#F59E0B]">R {invoice.balanceDue?.toFixed(2)}</span></div>
          <div className="text-xs text-[#8A8B8C]">Days Overdue: <span className="text-[#EF4444]">+{invoice.daysOverdue}</span></div>
        </div>

        {action === "promise" && (
          <div className="space-y-3">
            <div><label className="label-text block mb-1.5">Promised Amount (R)</label><input type="number" step="0.01" value={promisedAmount} onChange={(e) => setPromisedAmount(parseFloat(e.target.value))} className="input-field" /></div>
            <div><label className="label-text block mb-1.5">Promise Date *</label><DatePicker value={promiseDate} onChange={setPromiseDate} required /></div>
          </div>
        )}

        {action === "hold" && (
          <div className="space-y-3">
            <div className="p-3 rounded-lg" style={{ backgroundColor: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
              <div className="text-sm text-[#EF4444] font-body flex items-center gap-2"><ShieldAlert className="w-4 h-4" /> This will block all future orders for this customer.</div>
            </div>
            <div><label className="label-text block mb-1.5">Hold Reason</label><input type="text" value={holdReason} onChange={(e) => setHoldReason(e.target.value)} className="input-field" /></div>
          </div>
        )}

        {(action === "call" || action === "email" || action === "sms" || action === "note") && (
          <div className="space-y-3">
            {action === "call" && <div><label className="label-text block mb-1.5">Contact Person</label><input type="text" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} className="input-field" placeholder="Who did you speak to?" /></div>}
            <div><label className="label-text block mb-1.5">{action === "email" || action === "sms" ? "Message" : "Notes"}</label><textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="input-field" rows={action === "email" || action === "sms" ? 8 : 4} /></div>
            {action === "call" && <div><label className="label-text block mb-1.5">Follow-up Date (optional)</label><DatePicker value={followUpDate} onChange={setFollowUpDate} /></div>}
          </div>
        )}

        <div className="flex gap-3 mt-4">
          <button onClick={() => {
            const data: any = { notes };
            if (action === "call") { data.type = "call"; data.contactMethod = "phone"; data.contactPerson = contactPerson; data.followUpDate = followUpDate || undefined; }
            else if (action === "email") { data.type = "email"; data.contactMethod = "email"; }
            else if (action === "sms") { data.type = "sms"; data.contactMethod = "sms"; }
            else if (action === "note") { data.type = "note"; data.contactMethod = "manual"; }
            else if (action === "promise") { data.promiseDate = promiseDate; data.promisedAmount = promisedAmount; }
            else if (action === "hold") { data.reason = holdReason; }
            onSubmit(data);
          }} className="btn-primary flex-1 justify-center">
            {action === "email" && <Send className="w-4 h-4" />}
            {action === "sms" && <Send className="w-4 h-4" />}
            {action === "promise" && <HandCoins className="w-4 h-4" />}
            {action === "hold" && <Lock className="w-4 h-4" />}
            {action === "call" && <Phone className="w-4 h-4" />}
            {action === "note" && <ClipboardList className="w-4 h-4" />}
            {action === "email" ? "Copy & Open Email" : action === "sms" ? "Copy Message" : action === "promise" ? "Record Promise" : action === "hold" ? "Place Hold" : "Save"}
          </button>
          <button onClick={onClose} className="btn-secondary">Cancel</button>
        </div>

        {(action === "email" || action === "sms") && (
          <p className="text-xs text-[#8A8B8C] font-body mt-3">The reminder text is pre-filled based on the overdue stage. Copy it and paste into your email client or SMS app.</p>
        )}
      </div>
    </div>
  );
}
