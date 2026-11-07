import { useState, useEffect } from "react";
import { trpc } from "@/providers/trpc";
import { reloadFromStorage, getBankingDetails } from "@/lib/dataService";
import { getCompanyConfig } from "@/lib/companyConfig";
import CustomerSearchDropdown from "@/components/CustomerSearchDropdown";
import DatePicker from "@/components/DatePicker";
import {
  AlertTriangle, Phone, Mail, MessageSquare, HandCoins,
  Ban, FileText, Calendar, CheckCircle, Clock, User,
  DollarSign, TrendingUp, ShieldAlert, ClipboardList,
  Printer, X, ChevronDown, ChevronUp, Send, Lock, LockOpen,
  Users, Filter, ExternalLink, Download,
} from "lucide-react";

const BUCKET_CONFIG: Record<string, { label: string; color: string; bg: string; desc: string }> = {
  pre_due: { label: "Due Soon", color: "#6366F1", bg: "rgba(99,102,241,0.1)", desc: "0-2 days before due" },
  due_today: { label: "Due Today", color: "#F59E0B", bg: "rgba(245,158,11,0.1)", desc: "Payment due today" },
  days_1_2: { label: "1-2 Days Over", color: "#F59E0B", bg: "rgba(245,158,11,0.12)", desc: "Friendly reminder" },
  days_3_5: { label: "3-5 Days Over", color: "#F97316", bg: "rgba(249,115,22,0.12)", desc: "Phone call required" },
  days_6_10: { label: "6-10 Days Over", color: "#EF4444", bg: "rgba(239,68,68,0.12)", desc: "Formal follow-up" },
  days_11_20: { label: "11-20 Days Over", color: "#EF4444", bg: "rgba(239,68,68,0.15)", desc: "Final notice" },
  days_21_plus: { label: "21+ Days Over", color: "#DC2626", bg: "rgba(220,38,38,0.2)", desc: "Management follow-up" }, 
};

function getCompanyPhone(): string {
  try {
    const raw = localStorage.getItem("sgf_settings_company");
    if (raw) {
      const saved = JSON.parse(raw);
      if (saved.phone) return saved.phone;
    }
  } catch { /* ignore */ }
  return getCompanyConfig("sgf").contact.phone;
}

function getReminderTemplates(): Record<string, { subject: string; body: string }> {
  const phone = getCompanyPhone();
  const companyName = getCompanyConfig("sgf").name;
  return {
    pre_due: {
      subject: "Payment Reminder - Invoice {invoiceNumber}",
      body: `Dear {customerName},\n\nThis is a friendly reminder that your invoice {invoiceNumber} for R {amount} is due on {dueDate}.\n\nPlease ensure payment is arranged to avoid any inconvenience.\n\nBanking Details:\n{bankingDetails}\nQuote: {invoiceNumber}\n\nThank you for your continued business.\n\n${companyName}`,
    },
    days_1_2: {
      subject: "Friendly Reminder - Outstanding Invoice {invoiceNumber}",
      body: `Dear {customerName},\n\nWe noticed that invoice {invoiceNumber} for R {amount} is now {daysOverdue} day(s) overdue.\n\nIf payment has already been made, please disregard this notice and send us proof of payment.\n\nBanking Details:\n{bankingDetails}\nQuote: {invoiceNumber}\n\nPlease contact us if you need to discuss payment arrangements.\n\n${companyName}`,
    },
    days_3_5: {
      subject: "Urgent: Invoice {invoiceNumber} - {daysOverdue} Days Overdue",
      body: `Dear {customerName},\n\nInvoice {invoiceNumber} for R {amount} is now {daysOverdue} days overdue.\n\nWe kindly request immediate payment or a call to arrange a payment plan.\n\nOutstanding balance: R {balanceDue}\n\nBanking Details:\n{bankingDetails}\nQuote: {invoiceNumber}\n\nPlease contact our accounts department on ${phone} to discuss.\n\n${companyName}`,
    },
    days_6_10: {
      subject: "FOLLOW-UP REQUIRED - Invoice {invoiceNumber} - {daysOverdue} Days Overdue",
      body: `Dear {customerName},\n\nDespite our previous reminders, invoice {invoiceNumber} for R {amount} remains unpaid and is now {daysOverdue} days overdue.\n\nOutstanding balance: R {balanceDue}\n\nTo continue enjoying our services, please arrange payment or contact us to discuss a payment plan.\n\nBanking Details:\n{bankingDetails}\nQuote: {invoiceNumber}\n\nContact: ${phone}\n\n${companyName}`,
    },
    days_11_20: {
      subject: "URGENT FOLLOW-UP - Invoice {invoiceNumber}",
      body: `Dear {customerName},\n\nInvoice {invoiceNumber} for R {amount} is now {daysOverdue} days overdue.\n\nWe have attempted to contact you on several occasions without success.\n\nOUTSTANDING: R {balanceDue}\n\nPlease contact management urgently to resolve this matter: ${phone}\n\n${companyName}`,
    },
    days_21_plus: {
      subject: "URGENT: Invoice {invoiceNumber} - {daysOverdue} Days Overdue",
      body: `Dear {customerName},\n\nInvoice {invoiceNumber} for R {amount} is now {daysOverdue} days overdue.\n\nWe have been unable to reach you despite several attempts.\n\nOUTSTANDING: R {balanceDue}\n\nPlease contact management urgently: ${phone}\n\n${companyName}`,
    },
  };
}

export default function CollectionsPage() {
  const utils = trpc.useUtils();
  const [activeTab, setActiveTab] = useState<"pipeline" | "followups" | "daily" | "history">("pipeline");
  const [selectedBucket, setSelectedBucket] = useState<string>("all");
  const [selectedSalesRep, setSelectedSalesRep] = useState<string>("");
  const [expandedInvoice, setExpandedInvoice] = useState<number | null>(null);
  const [showActionModal, setShowActionModal] = useState<string | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [historyCustomerId, setHistoryCustomerId] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");

  // Listen for Firebase data updates and refresh collections
  useEffect(() => {
    const handler = (e: any) => {
      const type = e.detail?.type;
      if (type === "invoices" || type === "customers" || type === "collections") {
        invalidateCollections();
      }
    };
    window.addEventListener("firebaseDataReceived", handler);
    return () => window.removeEventListener("firebaseDataReceived", handler);
  }, []);

  // Queries
  const { data: overdueInvoices } = trpc.collections.getOverdueInvoices.useQuery();
  const { data: dailyReport } = trpc.collections.getDailyReport.useQuery();
  const { data: stats } = trpc.collections.getStats.useQuery();
  const { data: followUpsDue } = trpc.collections.getFollowUpsDue.useQuery();
  const { data: customers } = trpc.customer.search.useQuery({ query: " " });
  const { data: salesReps } = trpc.customer.getSalesReps.useQuery();
  const { data: customerHistory } = trpc.collections.getCustomerPaymentHistory.useQuery(historyCustomerId, { enabled: historyCustomerId > 0 });

  // Helper: resolve customer name from customerId (fixes N/A for Sage/PO invoices
  // where customerId doesn't match loaded customers array). Falls back to the
  // invoice's own customer/customerName.
  const getCustomerName = (customerId: any, fallbackName?: string) => {
    if (!customerId) return fallbackName || "N/A";
    const c = (customers || []).find((c: any) => c.id == customerId);
    return c?.name || fallbackName || "N/A";
  };

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

  const filteredInvoices = (overdueInvoices || [])
    .filter((inv: any) => selectedBucket === "all" || inv.bucket === selectedBucket)
    .filter((inv: any) => !selectedSalesRep || inv.salesRepName === selectedSalesRep)
    .filter((inv: any) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const invNum = String(inv.invoiceNumber || "").toLowerCase();
      const custName = String(inv.customerName || inv.customer?.name || "").toLowerCase();
      return invNum.includes(q) || custName.includes(q);
    });

  // Sales rep summary from filtered data
  const repSummary = (salesReps || []).map((rep: string) => {
    const repInvs = (overdueInvoices || []).filter((inv: any) => inv.salesRepName === rep);
    return {
      name: rep,
      count: repInvs.length,
      total: repInvs.reduce((s: number, inv: any) => s + inv.balanceDue, 0),
    };
  }).filter((r: any) => r.count > 0).sort((a: any, b: any) => b.total - a.total);

  function openAction(action: string, invoice: any) {
    setSelectedInvoice(invoice);
    setShowActionModal(action);
  }

  function generateReminderText(invoice: any, bucket: string) {
    const banking = getBankingDetails();
    const bankingStr = `${banking.bankName} | Acc: ${banking.accountNumber} | Branch: ${banking.branchCode}`;
    const templates = getReminderTemplates();
    const template = templates[bucket] || templates.days_1_2;
    return template.body
      .replace(/{customerName}/g, getCustomerName(invoice.customerId, invoice.customer?.name || invoice.customerName) || "Valued Customer")
      .replace(/{invoiceNumber}/g, invoice.invoiceNumber)
      .replace(/{amount}/g, Number(invoice.total).toFixed(2))
      .replace(/{balanceDue}/g, Number(invoice.balanceDue).toFixed(2))
      .replace(/{daysOverdue}/g, String(invoice.daysOverdue))
      .replace(/{dueDate}/g, invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString("en-ZA") : "N/A")
      .replace(/{salesRep}/g, invoice.salesRepName || invoice.customer?.salesRepName || "")
      .replace(/{bankingDetails}/g, bankingStr);
  }

  async function exportToExcel() {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    const todayStr = new Date().toLocaleDateString("en-ZA");
    const fileDate = new Date().toISOString().split("T")[0];

    // -- Sheet 1: Pipeline (filtered invoices) --
    const pipelineRows = [
      ["Invoice #", "Customer", "Sales Rep", "Balance Due", "Total", "Paid", "Days Over", "Bucket", "Due Date", "Invoice Date", "On Hold", "Latest Promise", "Source"],
    ];
    for (const inv of filteredInvoices) {
      const holdStatus = inv.accountHold ? "YES" : "NO";
      const promiseDate = inv.latestPromise ? new Date(inv.latestPromise.promiseDate).toLocaleDateString("en-ZA") : "";
      pipelineRows.push([
        inv.invoiceNumber || "",
        inv.customer?.name || inv.customerName || "",
        inv.salesRepName || "",
        inv.balanceDue || 0,
        inv.total || inv.totalAmount || 0,
        inv.amountPaid || 0,
        inv.daysOverdue || 0,
        BUCKET_CONFIG[inv.bucket]?.label || inv.bucket || "",
        inv.dueDate ? new Date(inv.dueDate).toLocaleDateString("en-ZA") : "",
        inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString("en-ZA") : "",
        holdStatus,
        promiseDate,
        inv.source || "app",
      ]);
    }
    // Totals row
    const totalBalance = filteredInvoices.reduce((s, i) => s + (i.balanceDue || 0), 0);
    pipelineRows.push([]);
    pipelineRows.push(["TOTAL", "", "", totalBalance, "", "", "", "", "", "", "", "", ""]);

    const wsPipeline = XLSX.utils.aoa_to_sheet(pipelineRows);
    wsPipeline["!cols"] = [
      { wch: 14 }, { wch: 30 }, { wch: 18 }, { wch: 14 },
      { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 16 },
      { wch: 12 }, { wch: 12 }, { wch: 8 }, { wch: 14 }, { wch: 10 },
    ];
    XLSX.utils.book_append_sheet(wb, wsPipeline, "Pipeline");

    // -- Sheet 2: Daily Summary --
    const summaryRows = [
      ["Supreme Global Foods -- Collections Daily Summary"],
      [],
      ["Report Date:", todayStr],
      ["Total Outstanding:", `R ${(stats?.totalOutstanding || 0).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
      ["Total Overdue Invoices:", stats?.totalOverdueInvoices || 0],
      ["On Hold:", stats?.onHold || 0],
      ["Pending Promises:", stats?.pendingPromises || 0],
      ["Collected Today:", dailyReport?.summary?.todayActivities || 0],
      [],
      ["Bucket", "Count", "Total Balance (R)", "Description"],
    ];
    for (const [key, cfg] of Object.entries(BUCKET_CONFIG)) {
      const items = (dailyReport?.byBucket as any)?.[key] || [];
      summaryRows.push([
        cfg.label,
        items.length,
        items.reduce((s: number, i: any) => s + (i.balanceDue || 0), 0),
        cfg.desc,
      ]);
    }
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
    wsSummary["!cols"] = [{ wch: 18 }, { wch: 10 }, { wch: 18 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, wsSummary, "Daily Summary");

    // -- Sheet 3: Today's Activities --
    const activityRows = [["Time", "Type", "Invoice", "Customer", "Notes / Reason"]];
    for (const act of (dailyReport?.todayActivities || [])) {
      activityRows.push([
        act.createdAt ? new Date(act.createdAt).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" }) : "",
        act.type || "",
        act.invoiceNumber || "",
        act.customerName || "",
        act.notes || act.reason || "",
      ]);
    }
    const wsActivity = XLSX.utils.aoa_to_sheet(activityRows);
    wsActivity["!cols"] = [{ wch: 10 }, { wch: 12 }, { wch: 14 }, { wch: 28 }, { wch: 50 }];
    XLSX.utils.book_append_sheet(wb, wsActivity, "Today's Activities");

    // -- Sheet 4: Follow-ups Due --
    const followUpRows = [["Customer", "Outstanding Balance", "Days Since Follow-up", "Bucket", "Invoices"]];
    for (const fu of (followUpsDue || [])) {
      const invList = (fu.invoices || []).map((i: any) => `${i.invoiceNumber} (R ${(i.balanceDue || 0).toFixed(2)})`).join("; ");
      followUpRows.push([
        fu.customer?.name || "",
        fu.outstandingBalance || 0,
        fu.daysSinceFollowUp != null ? fu.daysSinceFollowUp : "Never",
        BUCKET_CONFIG[fu.bucket]?.label || fu.bucket || "",
        invList,
      ]);
    }
    const wsFollowUp = XLSX.utils.aoa_to_sheet(followUpRows);
    wsFollowUp["!cols"] = [{ wch: 30 }, { wch: 18 }, { wch: 20 }, { wch: 18 }, { wch: 50 }];
    XLSX.utils.book_append_sheet(wb, wsFollowUp, "Follow-ups Due");

    // -- Sheet 5: Stats --
    const statsRows = [
      ["Metric", "Value"],
      ["Total Outstanding", `R ${(stats?.totalOutstanding || 0).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
      ["Total Overdue Invoices", stats?.totalOverdueInvoices || 0],
      ["On Hold", stats?.onHold || 0],
      ["Pending Promises", stats?.pendingPromises || 0],
      ["Collected Today", dailyReport?.summary?.todayActivities || 0],
    ];
    const wsStats = XLSX.utils.aoa_to_sheet(statsRows);
    wsStats["!cols"] = [{ wch: 30 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, wsStats, "Stats");

    XLSX.writeFile(wb, `Collections_Report_${fileDate}.xlsx`);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display font-semibold text-white" style={{ fontSize: "clamp(1.8rem, 3vw, 2.5rem)", letterSpacing: "-0.03em" }}>Collections</h1>
          <p className="text-[#8A8B8C] font-body text-sm mt-1">Automated payment collection &amp; overdue tracking</p>
        </div>
        <button
          onClick={exportToExcel}
          className="btn-secondary flex items-center gap-2 text-sm"
          title="Export collections data to Excel"
        >
          <Download className="w-4 h-4" /> Export to Excel
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <div className="card-surface p-4">
          <div className="label-text mb-1">OUTSTANDING</div>
          <div className="stat-number" style={{ color: "#F59E0B", fontSize: "1.3rem" }}>R {(stats?.totalOutstanding || 0).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
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
        <button onClick={() => setActiveTab("followups")} className="px-4 py-2 rounded-full text-sm font-body font-medium transition-all cursor-pointer relative" style={{ backgroundColor: activeTab === "followups" ? "#D4A843" : "#18191A", color: activeTab === "followups" ? "#0A0A0B" : "#8A8B8C" }}>
          Follow-ups Due
          {followUpsDue && followUpsDue.length > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">{followUpsDue.length}</span>
          )}
        </button>
        <button onClick={() => setActiveTab("daily")} className="px-4 py-2 rounded-full text-sm font-body font-medium transition-all cursor-pointer" style={{ backgroundColor: activeTab === "daily" ? "#D4A843" : "#18191A", color: activeTab === "daily" ? "#0A0A0B" : "#8A8B8C" }}>Daily Report</button>
        <button onClick={() => setActiveTab("history")} className="px-4 py-2 rounded-full text-sm font-body font-medium transition-all cursor-pointer" style={{ backgroundColor: activeTab === "history" ? "#D4A843" : "#18191A", color: activeTab === "history" ? "#0A0A0B" : "#8A8B8C" }}>Customer History</button>
      </div>

      {/* Sales Rep Filter + Summary */}
      <div className="card-surface p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-[#D4A843]" />
            <span className="text-sm text-[#8A8B8C]">Filter by Sales Rep:</span>
          </div>
          <div className="relative">
            <select
              value={selectedSalesRep}
              onChange={(e) => setSelectedSalesRep(e.target.value)}
              className="input-field text-sm pr-8 appearance-none cursor-pointer min-w-[200px]"
              style={{ backgroundColor: "#131415", borderColor: "#222324", color: "#E8E8E9" }}
            >
              <option value="">All Sales Reps</option>
              {(salesReps || []).sort((a: string, b: string) => a.localeCompare(b)).map((rep: string) => (
                <option key={rep} value={rep}>{rep}</option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 text-[#8A8B8C] pointer-events-none" />
          </div>
          {selectedSalesRep && (
            <button onClick={() => setSelectedSalesRep("")} className="text-xs text-[#EF4444] hover:underline">Clear filter</button>
          )}
        </div>
        {/* Per-sales-rep summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {repSummary.map((rep: any) => (
            <button
              key={rep.name}
              onClick={() => setSelectedSalesRep(selectedSalesRep === rep.name ? "" : rep.name)}
              className="p-2.5 rounded-lg text-left transition-all hover:brightness-110"
              style={{
                backgroundColor: selectedSalesRep === rep.name ? "rgba(212,168,67,0.15)" : "#131415",
                border: `1px solid ${selectedSalesRep === rep.name ? "#D4A843" : "#222324"}`,
              }}
            >
              <div className="text-[10px] text-[#8A8B8C] uppercase tracking-wide truncate">{rep.name}</div>
              <div className="text-sm font-display font-semibold" style={{ color: "#D4A843" }}>R {rep.total.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              <div className="text-[10px] text-[#8A8B8C]">{rep.count} invoice{rep.count !== 1 ? "s" : ""}</div>
            </button>
          ))}
          {repSummary.length === 0 && (
            <div className="text-xs text-[#8A8B8C] col-span-full">No outstanding invoices</div>
          )}
        </div>
      </div>

      {/* PIPELINE VIEW */}
      {activeTab === "pipeline" && (
        <div className="space-y-4">
          {/* Search + Bucket Filter */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setSelectedBucket("all")} className="px-3 py-1.5 rounded-full text-xs font-body font-medium transition-all cursor-pointer" style={{ backgroundColor: selectedBucket === "all" ? "#D4A843" : "#18191A", color: selectedBucket === "all" ? "#0A0A0B" : "#8A8B8C" }}>All ({(overdueInvoices || []).filter((i: any) => !selectedSalesRep || i.salesRepName === selectedSalesRep).length})</button>
              {Object.entries(BUCKET_CONFIG).map(([key, cfg]) => {
                const count = (overdueInvoices || []).filter((i: any) => i.bucket === key && (!selectedSalesRep || i.salesRepName === selectedSalesRep)).length;
                return (
                  <button key={key} onClick={() => setSelectedBucket(key)} className="px-3 py-1.5 rounded-full text-xs font-body font-medium transition-all cursor-pointer" style={{ backgroundColor: selectedBucket === key ? cfg.color : "#18191A", color: selectedBucket === key ? "#fff" : "#8A8B8C", border: `1px solid ${selectedBucket === key ? cfg.color : "transparent"}` }}>
                    {cfg.label} ({count})
                  </button>
                );
              })}
            </div>
            <div className="relative w-full sm:w-72">
              <input
                type="text"
                placeholder="Search invoice or customer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-field text-sm w-full pr-8"
                style={{ backgroundColor: "#131415", borderColor: "#222324", color: "#E8E8E9" }}
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#8A8B8C] hover:text-[#EF4444]">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
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
                            <td className="p-3 font-mono-data text-xs text-[#D4A843]">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {inv.invoiceNumber}
                                {inv.source === "sage" && (
                                  <span className="px-1 py-0.5 rounded text-[9px] font-medium" style={{ backgroundColor: "rgba(99,102,241,0.15)", color: "#818CF8", border: "1px solid rgba(99,102,241,0.3)" }}>SAGE</span>
                                )}
                              </div>
                            </td>
                            <td className="p-3 text-sm text-[#E8E8E9] font-body">{getCustomerName(inv.customerId, inv.customer?.name || inv.customerName)}</td>
                            <td className="p-3 text-sm text-[#4ADE80] font-body">{inv.salesRepName || inv.customer?.salesRepName || "-"}</td>
                            <td className="p-3 text-right font-display text-white">R {inv.balanceDue.toFixed(2)}</td>
                            <td className="p-3 text-center">
                              <span className="text-sm font-body font-semibold" style={{ color: inv.daysOverdue > 5 ? "#EF4444" : "#F59E0B" }}>{inv.daysOverdue > 0 ? `+${inv.daysOverdue}` : inv.daysOverdue}</span>
                            </td>
                            <td className="p-3">
                              <span className="status-badge text-xs" style={{ backgroundColor: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                            </td>
                            <td className="p-3 text-sm font-body">
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
                          {expandedInvoice === inv.id && (
                            <tr>
                              <td colSpan={9} className="p-4" style={{ backgroundColor: "#0A0A0B" }}>
                                <div className="flex flex-wrap gap-2 mb-3">
                                  <button onClick={() => openAction("call", inv)} className="btn-primary text-xs"><Phone className="w-3 h-3" /> Log Call</button>
                                  <button onClick={() => openAction("email", inv)} className="btn-secondary text-xs"><Mail className="w-3 h-3" /> Email</button>
                                  <button onClick={() => openAction("sms", inv)} className="btn-secondary text-xs"><MessageSquare className="w-3 h-3" /> SMS</button>
                                  <button onClick={() => openAction("whatsapp", inv)} className="btn-secondary text-xs" style={{ borderColor: "rgba(37,211,102,0.2)", color: "#25D366" }}><ExternalLink className="w-3 h-3" /> WhatsApp</button>
                                  <button onClick={() => openAction("promise", inv)} className="btn-secondary text-xs"><HandCoins className="w-3 h-3" /> Promise</button>
                                  <button onClick={() => openAction("note", inv)} className="btn-secondary text-xs"><ClipboardList className="w-3 h-3" /> Note</button>
                                  {!inv.accountHold && <button onClick={() => openAction("hold", inv)} className="btn-secondary text-xs hover:text-[#EF4444]" style={{ borderColor: "rgba(239,68,68,0.2)" }}><Lock className="w-3 h-3" /> Place Hold</button>}
                                  {inv.accountHold && <button onClick={() => { releaseHold.mutate({ holdId: inv.accountHold.id }); }} className="btn-secondary text-xs hover:text-[#4ADE80]" style={{ borderColor: "rgba(74,222,128,0.2)" }}><LockOpen className="w-3 h-3" /> Release Hold</button>}
                                </div>
                                {(inv.collectionNotes || []).length > 0 && (
                                  <div className="space-y-2">
                                    <p className="text-xs text-[#8A8B8C] font-body">Recent notes:</p>
                                    {(inv.collectionNotes || []).slice(0, 3).map((note: any) => (
                                      <div key={note.id} className="text-xs font-body p-2 rounded" style={{ backgroundColor: "#131415" }}>
                                        <span className="text-[#D4A843] capitalize">{note.type || "note"}</span>
                                        <span className="text-[#8A8B8C] ml-2">{new Date(note.createdAt).toLocaleDateString("en-ZA")}</span>
                                        <p className="text-white mt-1">{note.notes || note.reason || "-"}</p>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </td>
                            </tr>
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

      {/* FOLLOW-UPS VIEW */}
      {activeTab === "followups" && (
        <div className="space-y-4">
          <div className="card-surface p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-semibold text-white">Follow-ups Due</h3>
              <div className="card-surface p-3">
                <span className="stat-number" style={{ color: "#EF4444" }}>{followUpsDue?.length || 0}</span>
                <p className="text-xs text-[#8A8B8C] font-body">customers need follow-up</p>
              </div>
            </div>
            {followUpsDue && followUpsDue.length > 0 ? (
              <div className="space-y-3">
                {(followUpsDue || []).map((fu: any, idx: number) => (
                  <div key={idx} className="p-4 rounded-lg" style={{ backgroundColor: "#0A0A0B" }}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-[#D4A843]" />
                          <span className="font-body text-sm text-white">{fu.customer?.name || "Unknown"}</span>
                          <span className="text-xs text-[#8A8B8C]">(R {(fu.outstandingBalance || 0).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Clock className="w-3 h-3 text-[#8A8B8C]" />
                          <span className="text-xs text-[#8A8B8C]">
                            {fu.daysSinceFollowUp != null ? `${fu.daysSinceFollowUp} days since last follow-up` : "No follow-up recorded"}
                          </span>
                        </div>
                        {/* Invoice list */}
                        {fu.invoices && fu.invoices.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {fu.invoices.map((inv: any, i: number) => (
                              <span key={i} className="status-badge text-xs" style={{ backgroundColor: "rgba(212,168,67,0.1)", color: "#D4A843" }}>
                                {inv.invoiceNumber} (R {inv.balanceDue?.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || "0.00"})
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => openAction("call", fu.invoices?.[0])}
                        className="btn-primary text-xs shrink-0"
                      >
                        <Phone className="w-3 h-3" /> Follow Up
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <CheckCircle className="w-12 h-12 mx-auto mb-3 text-[#4ADE80] opacity-40" />
                <p className="text-[#8A8B8C] font-body text-sm">No follow-ups due at this time</p>
                <p className="text-xs text-[#8A8B8C] mt-1">All customers are within the 3-day follow-up cycle</p>
              </div>
            )}
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
                    {count > 0 && <div className="text-xs font-body mt-1" style={{ color: "#8A8B8C" }}>R {total.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>}
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
          {customerHistory && customerHistory.length > 0 && (
            <div className="space-y-3">
              {customerHistory.map((inv: any) => (
                <div key={inv.id} className="p-4 rounded-lg" style={{ backgroundColor: "#0A0A0B" }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono-data text-xs text-[#D4A843]">{inv.invoiceNumber}</span>
                    <span className="status-badge text-xs" style={{ backgroundColor: inv.status === "paid" ? "rgba(74,222,128,0.12)" : "rgba(245,158,11,0.12)", color: inv.status === "paid" ? "#4ADE80" : "#F59E0B" }}>{inv.status}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div><span className="text-[#8A8B8C]">Total:</span> <span className="text-white">R {Number(inv.total || inv.totalAmount || 0).toFixed(2)}</span></div>
                    <div><span className="text-[#8A8B8C]">Paid:</span> <span className="text-white">R {Number(inv.amountPaid || 0).toFixed(2)}</span></div>
                    <div><span className="text-[#8A8B8C]">Balance:</span> <span className="text-white">R {Number(inv.balanceDue || 0).toFixed(2)}</span></div>
                  </div>
                  {(inv.notes || []).length > 0 && (
                    <div className="mt-3 space-y-1">
                      <p className="text-xs text-[#8A8B8C]">Collection notes:</p>
                      {inv.notes.slice(0, 3).map((n: any) => (
                        <div key={n.id} className="text-xs p-2 rounded" style={{ backgroundColor: "#131415" }}>
                          <span className="text-[#D4A843] capitalize">{n.type || "note"}</span>
                          <span className="text-[#8A8B8C] ml-2">{new Date(n.createdAt).toLocaleDateString("en-ZA")}</span>
                          <p className="text-white mt-0.5">{n.notes || n.reason || "-"}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          {historyCustomerId > 0 && (!customerHistory || customerHistory.length === 0) && (
            <div className="text-center py-8">
              <FileText className="w-12 h-12 mx-auto mb-3 text-[#8A8B8C] opacity-40" />
              <p className="text-[#8A8B8C] font-body text-sm">No invoices found for this customer</p>
            </div>
          )}
        </div>
      )}

      {/* Action Modal */}
      {showActionModal && selectedInvoice && (
        <ActionModal
          action={showActionModal}
          invoice={selectedInvoice}
          onClose={() => setShowActionModal(null)}
          onSubmit={(data: any) => {
            const invId = selectedInvoice.id;
            const custId = selectedInvoice.customerId;
            if (showActionModal === "promise") {
              recordPromise.mutate({ invoiceId: invId, customerId: custId, ...data });
            } else if (showActionModal === "hold") {
              placeHold.mutate({ invoiceId: invId, customerId: custId, ...data });
            } else {
              addNote.mutate({ invoiceId: invId, customerId: custId, ...data });
            }
            setShowActionModal(null);
          }}
        />
      )}
    </div>
  );
}

function ActionModal({ action, invoice, onClose, onSubmit }: { action: string; invoice: any; onClose: () => void; onSubmit: (data: any) => void }) {
  const [notes, setNotes] = useState("");
  const [promiseDate, setPromiseDate] = useState("");
  const [promisedAmount, setPromisedAmount] = useState("");
  const [holdReason, setHoldReason] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");

  const isPaymentRelated = action === "promise" || action === "hold";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.7)" }}>
      <div className="card-glass p-6 w-full max-w-lg space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-semibold text-white">
            {action === "call" && "Log Collection Call"}
            {action === "email" && "Send Payment Reminder Email"}
            {action === "sms" && "Send Payment Reminder SMS"}
            {action === "whatsapp" && "Send WhatsApp Reminder"}
            {action === "promise" && "Record Payment Promise"}
            {action === "hold" && "Place Account Hold"}
            {action === "note" && "Add Collection Note"}
          </h3>
          <button onClick={onClose} className="p-1 hover:text-[#EF4444] transition-colors"><X className="w-5 h-5" /></button>
        </div>

        <div className="text-xs text-[#8A8B8C] font-body">
          Invoice: <span className="text-[#D4A843] font-mono-data">{invoice.invoiceNumber}</span>
          <span className="mx-2">|</span>
          Customer: <span className="text-white">{invoice.customer?.name || invoice.customerName || "Unknown"}</span>
          <span className="mx-2">|</span>
          Balance: <span className="text-white">R {invoice.balanceDue?.toFixed(2) || "0.00"}</span>
        </div>

        {action === "promise" && (
          <div className="space-y-3">
            <div>
              <label className="label-text block mb-1">Promise Date</label>
              <DatePicker value={promiseDate} onChange={setPromiseDate} />
            </div>
            <div>
              <label className="label-text block mb-1">Promised Amount (R)</label>
              <input type="number" value={promisedAmount} onChange={(e) => setPromisedAmount(e.target.value)} className="input-field w-full" placeholder="e.g. 5000" />
            </div>
          </div>
        )}

        {action === "hold" && (
          <div>
            <label className="label-text block mb-1">Hold Reason</label>
            <textarea value={holdReason} onChange={(e) => setHoldReason(e.target.value)} className="input-field w-full" rows={3} placeholder="Reason for placing account on hold..." />
          </div>
        )}

        {(action === "call" || action === "note") && (
          <div className="space-y-3">
            <div>
              <label className="label-text block mb-1">Contact Person</label>
              <input type="text" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} className="input-field w-full" placeholder="Name of person spoken to" />
            </div>
            <div>
              <label className="label-text block mb-1">Next Follow-up Date</label>
              <DatePicker value={followUpDate} onChange={setFollowUpDate} />
            </div>
          </div>
        )}

        <div>
          <label className="label-text block mb-1">
            {action === "email" || action === "sms" || action === "whatsapp" ? "Message" : "Notes"}
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="input-field w-full"
            rows={action === "email" || action === "sms" || action === "whatsapp" ? 8 : 4}
            placeholder={
              action === "email" || action === "sms" || action === "whatsapp"
                ? "Message will be pre-filled from template. Edit here if needed..."
                : "Enter notes about this interaction..."
            }
          />
        </div>

        {action === "call" && (
          <div className="text-xs text-[#8A8B8C] font-body">
            <p>Recommended script:</p>
            <p className="mt-1 text-white/80 whitespace-pre-wrap">{getReminderTemplates()["days_3_5"]?.body.replace(/{customerName}/g, invoice.customer?.name || invoice.customerName || "Valued Customer").replace(/{invoiceNumber}/g, invoice.invoiceNumber).replace(/{amount}/g, Number(invoice.total).toFixed(2)).replace(/{balanceDue}/g, Number(invoice.balanceDue).toFixed(2)).replace(/{daysOverdue}/g, String(invoice.daysOverdue)).replace(/{dueDate}/g, invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString("en-ZA") : "N/A").replace(/{bankingDetails}/g, `${getBankingDetails().bankName} | Acc: ${getBankingDetails().accountNumber} | Branch: ${getBankingDetails().branchCode}`) || ""}</p>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          {action === "whatsapp" && (
            <button onClick={() => {
              const notes = generateReminderText(invoice, invoice.bucket);
              const clean = (invoice.customer?.phone || "").replace(/\s/g, "");
              const url = `https://wa.me/${clean.replace(/^\+/, "")}?text=${encodeURIComponent(notes)}`;
              window.open(url, "_blank");
              const data: any = { notes, type: "whatsapp", contactMethod: "whatsapp" };
              onSubmit(data);
            }} className="btn-primary flex-1 justify-center" style={{ backgroundColor: "#25D366" }}>
              <ExternalLink className="w-4 h-4" /> Open WhatsApp
            </button>
          )}
          {action === "email" && (
            <button onClick={() => {
              // Copy to clipboard
              navigator.clipboard.writeText(notes).catch(() => {});
              // Build mailto link
              const subject = encodeURIComponent(`Payment Reminder - Invoice ${invoice.invoiceNumber}`);
              const body = encodeURIComponent(notes);
              const to = invoice.customer?.email || "";
              const mailto = `mailto:${to}?subject=${subject}&body=${body}`;
              window.open(mailto, "_blank");
              const data: any = { notes, type: "email", contactMethod: "email" };
              onSubmit(data);
            }} className="btn-primary flex-1 justify-center">
              <Send className="w-4 h-4" /> Send Email
            </button>
          )}
          {action === "sms" && (
            <button onClick={() => {
              navigator.clipboard.writeText(notes).catch(() => {});
              const data: any = { notes, type: "sms", contactMethod: "sms" };
              onSubmit(data);
              alert("Message copied to clipboard. Paste into your SMS app.");
            }} className="btn-primary flex-1 justify-center">
              <Send className="w-4 h-4" /> Copy & Send SMS
            </button>
          )}
          {action !== "whatsapp" && action !== "email" && action !== "sms" && (
            <button onClick={() => {
              const data: any = { notes };
              if (action === "call") { data.type = "call"; data.contactMethod = "phone"; data.contactPerson = contactPerson; data.followUpDate = followUpDate || undefined; }
              else if (action === "note") { data.type = "note"; data.contactMethod = "manual"; }
              else if (action === "promise") { data.promiseDate = promiseDate; data.promisedAmount = promisedAmount; }
              else if (action === "hold") { data.reason = holdReason; }
              onSubmit(data);
            }} className="btn-primary flex-1 justify-center">
              {action === "promise" && <HandCoins className="w-4 h-4" />}
              {action === "hold" && <Lock className="w-4 h-4" />}
              {action === "call" && <Phone className="w-4 h-4" />}
              {action === "note" && <ClipboardList className="w-4 h-4" />}
              {action === "promise" ? "Record Promise" : action === "hold" ? "Place Hold" : "Save"}
            </button>
          )}
          <button onClick={onClose} className="btn-secondary">Cancel</button>
        </div>

        {action === "email" && (
          <p className="text-xs text-[#8A8B8C] font-body mt-3">Clicking "Send Email" will open your default email client with the customer email, subject, and message pre-filled. The message is also copied to your clipboard as a backup.</p>
        )}
        {action === "sms" && (
          <p className="text-xs text-[#8A8B8C] font-body mt-3">Clicking "Copy & Send SMS" will copy the message to your clipboard. Paste it into your SMS app to send.</p>
        )}
        {action === "whatsapp" && (
          <p className="text-xs text-[#8A8B8C] font-body mt-3">Clicking "Open WhatsApp" will open WhatsApp Web or the WhatsApp app with this message pre-filled. The customer must have WhatsApp installed.</p>
        )}
      </div>
    </div>
  );
}
