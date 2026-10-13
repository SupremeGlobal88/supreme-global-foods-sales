import { useState, useMemo } from "react";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { reloadFromStorage } from "@/lib/dataService";
import {
  Bell, CheckCircle, Clock, AlertTriangle, MessageSquare, Calendar,
  User, Download, ArrowUpDown, ClipboardList, X, MapPin, Phone,
  Search,
} from "lucide-react";

// ─── Shared Constants from AppointmentsPage ───
const APPOINTMENT_TYPES = [
  { value: "site_visit", label: "Site Visit" },
  { value: "call", label: "Call the Customer" },
  { value: "whatsapp", label: "WhatsApp the Customer" },
  { value: "email", label: "Email the Customer" },
  { value: "other", label: "Other" },
];

const EXISTING_CUSTOMER_TITLES = [
  { value: "routine_checkin", label: "Routine Check-in / Visit" },
  { value: "sample_followup", label: "Sample Trails / Sample Follow-up" },
  { value: "payment_collection", label: "Payment Collections" },
  { value: "complaints", label: "Complaints or Issues" },
  { value: "collect_returned", label: "Collect Returned Stock" },
  { value: "confirm_next_order", label: "Confirm Next Order" },
  { value: "payment_terms", label: "Payment Terms" },
];

const NEW_CUSTOMER_TITLES = [
  { value: "first_site_visit", label: "First Site Visit Scheduled" },
  { value: "sample_trails", label: "Sample Trails Scheduled" },
];

export default function FollowUpsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  const isManager = user?.role === "sales_manager";
  const canViewAll = isAdmin || isManager;
  const myRepName = user?.name || "";
  const utils = trpc.useUtils();

  const { data: allFollowUps, isLoading } = trpc.followUp.listAll.useQuery({ days: 10 }, { refetchInterval: 10000 });
  const { data: stats } = trpc.followUp.getStats.useQuery(undefined, { refetchInterval: 10000 });
  const { data: salesReps } = trpc.salesRep.list.useQuery();

  // Filtering & Sorting
  const [sortBy, setSortBy] = useState<"customer" | "salesRep" | "days">("days");
  const [filterKind, setFilterKind] = useState<"all" | "sample" | "no_order">("all");
  const [filterRep, setFilterRep] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Action form state
  const [showForm, setShowForm] = useState<string | number | null>(null);
  const [actionType, setActionType] = useState("site_visit");
  const [actionTitle, setActionTitle] = useState("");
  const [actionNotes, setActionNotes] = useState("");
  const [actionScheduleFollowUp, setActionScheduleFollowUp] = useState(false);
  const [actionFollowUpDate, setActionFollowUpDate] = useState("");
  const [actionFollowUpTime, setActionFollowUpTime] = useState("09:00");
  const [actionCustomerId, setActionCustomerId] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateFollowUp = trpc.followUp.update.useMutation({
    onSuccess: async () => { reloadFromStorage(); await utils.followUp.listAll.invalidate(); await utils.followUp.getStats.invalidate(); },
  });

  const createFollowUpAction = trpc.followUpAction.create.useMutation({
    onSuccess: async () => { await utils.followUpAction.list.invalidate(); },
  });

  const createAppointment = trpc.appointment.create.useMutation({
    onSuccess: async () => { await utils.appointment.list.invalidate(); },
  });

  // Filtered & sorted follow-ups
  const filteredFollowUps = useMemo(() => {
    let data = (allFollowUps || []) as any[];

    // Filter by kind
    if (filterKind !== "all") {
      data = data.filter((fu) => fu.followUpKind === filterKind);
    }

    // Filter by rep
    if (!canViewAll) {
      data = data.filter((fu) => (fu.salesRepName || "") === myRepName || (fu.customer?.salesRepName || "") === myRepName);
    } else if (filterRep !== "all") {
      data = data.filter((fu) => (fu.salesRepName || "") === filterRep || (fu.customer?.salesRepName || "") === filterRep);
    }

    // Search
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      data = data.filter((fu) =>
        (fu.customer?.name || "").toLowerCase().includes(q) ||
        (fu.orderNumber || "").toLowerCase().includes(q) ||
        (fu.salesRepName || "").toLowerCase().includes(q)
      );
    }

    // Sort
    data = [...data].sort((a: any, b: any) => {
      if (sortBy === "customer") {
        return (a.customer?.name || "").localeCompare(b.customer?.name || "");
      }
      if (sortBy === "salesRep") {
        return (a.salesRepName || a.customer?.salesRepName || "").localeCompare(b.salesRepName || b.customer?.salesRepName || "");
      }
      // days - most overdue first
      return (b.daysSince || 0) - (a.daysSince || 0);
    });

    return data;
  }, [allFollowUps, filterKind, filterRep, searchTerm, sortBy, canViewAll, myRepName]);

  const sampleCount = (allFollowUps || []).filter((fu: any) => fu.followUpKind === "sample").length;
  const noOrderCount = (allFollowUps || []).filter((fu: any) => fu.followUpKind === "no_order").length;

  function openActionForm(fu: any) {
    setActionCustomerId(fu.customerId || fu.customer?.id || 0);
    setActionType("site_visit");
    setActionTitle("");
    setActionNotes("");
    setActionScheduleFollowUp(false);
    setActionFollowUpDate("");
    setActionFollowUpTime("09:00");
    setShowForm(fu.id);
  }

  async function submitActionForm(fu: any) {
    if (!actionType) { alert("Please select an action type"); return; }
    if (!actionTitle) { alert("Please select an action title"); return; }

    setIsSubmitting(true);
    try {
      const notesParts = [];
      if (actionTitle) notesParts.push(`Title: ${actionTitle}`);
      if (actionNotes) notesParts.push(actionNotes);
      if (actionScheduleFollowUp && actionFollowUpDate) notesParts.push(`Follow-up appointment scheduled for ${actionFollowUpDate} at ${actionFollowUpTime}`);

      // Create follow-up action record
      createFollowUpAction.mutate({
        customerId: actionCustomerId,
        actionType,
        notes: notesParts.join("\n"),
        salesRepName: myRepName,
      });

      // If sample follow-up, update the followUp record
      if (fu.followUpKind === "sample" && typeof fu.id === "number") {
        let scheduledAppointmentId: number | undefined;

        // If scheduling requested, create appointment
        if (actionScheduleFollowUp && actionFollowUpDate) {
          const apptResult = createAppointment.mutate({
            customerId: actionCustomerId,
            title: actionTitle || "Follow-up",
            notes: actionNotes || "Follow-up from follow-ups page",
            appointmentDate: actionFollowUpDate + "T" + actionFollowUpTime,
            startTime: actionFollowUpTime,
            location: "",
            appointmentType: actionType as any,
            salesRepName: myRepName,
          });
          // Note: appointment ID won't be available synchronously; we'll skip linking for now
          scheduledAppointmentId = undefined;
        }

        updateFollowUp.mutate({
          id: fu.id,
          status: "completed",
          reason: actionNotes || undefined,
          actionType,
          title: actionTitle,
          scheduledAppointmentId,
        });
      }

      // If no-order follow-up, just create the action and optionally appointment
      if (fu.followUpKind === "no_order" && actionScheduleFollowUp && actionFollowUpDate) {
        createAppointment.mutate({
          customerId: actionCustomerId,
          title: actionTitle || "Follow-up",
          notes: actionNotes || "Follow-up from follow-ups page (10+ days no order)",
          appointmentDate: actionFollowUpDate + "T" + actionFollowUpTime,
          startTime: actionFollowUpTime,
          location: "",
          appointmentType: actionType as any,
          salesRepName: myRepName,
        });
      }

      setShowForm(null);
    } finally {
      setIsSubmitting(false);
    }
  }

  // Export to Excel
  async function handleExport() {
    if (!filteredFollowUps.length) return;
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();
      const rows: any[][] = [["Type", "Customer", "Sales Rep", "Order Number", "Days Since", "Follow-up Date", "Status", "Items / Reason"]];

      filteredFollowUps.forEach((fu: any) => {
        const kindLabel = fu.followUpKind === "sample" ? "Sample Order" : "No Order 10+ Days";
        const items = fu.order?.items?.map((i: any) => `${i.productName} (${i.quantity})`).join(", ") || "";
        rows.push([
          kindLabel,
          fu.customer?.name || "Unknown",
          fu.salesRepName || fu.customer?.salesRepName || "",
          fu.orderNumber || "—",
          fu.daysSince || 0,
          fu.followUpDate ? new Date(fu.followUpDate).toLocaleDateString("en-ZA") : "",
          fu.status,
          items || fu.reason || "",
        ]);
      });

      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws["!cols"] = [{ wch: 16 }, { wch: 30 }, { wch: 18 }, { wch: 20 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 40 }];
      XLSX.utils.book_append_sheet(wb, ws, "Follow-ups");

      const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([wbout], { type: "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Follow_Ups_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed:", err);
      alert("Export failed. Please try again.");
    }
  }

  return (
    <div className="space-y-6">
      {/* ─── HEADER ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display font-semibold text-white" style={{ fontSize: "clamp(1.8rem, 3vw, 2.5rem)", letterSpacing: "-0.03em" }}>Follow-ups</h1>
          <p className="text-[#8A8B8C] font-body text-sm mt-1">
            {stats?.pending || 0} pending sample follow-ups &middot; {noOrderCount} customers without orders (10+ days)
          </p>
        </div>
        <button onClick={handleExport} className="btn-secondary text-sm" disabled={!filteredFollowUps.length}>
          <Download className="w-4 h-4" /> Export to Excel
        </button>
      </div>

      {/* ─── STATS ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card-surface p-4">
          <div className="label-text mb-1">PENDING</div>
          <div className="stat-number" style={{ color: "#F59E0B" }}>{stats?.pending || 0}</div>
        </div>
        <div className="card-surface p-4">
          <div className="label-text mb-1">COMPLETED</div>
          <div className="stat-number" style={{ color: "#4ADE80" }}>{stats?.completed || 0}</div>
        </div>
        <div className="card-surface p-4">
          <div className="label-text mb-1">NO ORDER (10+ DAYS)</div>
          <div className="stat-number" style={{ color: "#EF4444" }}>{noOrderCount}</div>
        </div>
        <div className="card-surface p-4">
          <div className="label-text mb-1">OVERDUE</div>
          <div className="stat-number" style={{ color: "#EF4444" }}>{stats?.overdue || 0}</div>
        </div>
      </div>

      {/* ─── FILTERS ─── */}
      <div className="card-surface p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8B8C]" />
            <input
              type="text"
              placeholder="Search customer, order, rep..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field pl-10 w-full"
            />
          </div>

          {/* Kind filter */}
          <select value={filterKind} onChange={(e) => setFilterKind(e.target.value as any)} className="input-field">
            <option value="all">All Types</option>
            <option value="sample">Sample Orders</option>
            <option value="no_order">No Order (10+ Days)</option>
          </select>

          {/* Rep filter (admin/manager only) */}
          {canViewAll && (
            <select value={filterRep} onChange={(e) => setFilterRep(e.target.value)} className="input-field">
              <option value="all">All Reps</option>
              {(salesReps || []).map((rep: any) => (
                <option key={rep.name} value={rep.name}>{rep.name}</option>
              ))}
            </select>
          )}

          {/* Sort */}
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className="input-field">
            <option value="days">Sort: Most Overdue</option>
            <option value="customer">Sort: Customer Name</option>
            <option value="salesRep">Sort: Sales Rep</option>
          </select>
        </div>
      </div>

      {/* ─── LIST ─── */}
      {isLoading ? (
        <div className="card-surface p-12 text-center text-[#8A8B8C]">Loading follow-ups...</div>
      ) : filteredFollowUps.length === 0 ? (
        <div className="card-surface p-12 text-center">
          <Bell className="w-16 h-16 mx-auto mb-4 opacity-20" style={{ color: "#D4A843" }} />
          <p className="text-[#8A8B8C] font-body">No follow-ups required at this time</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredFollowUps.map((fu: any) => {
            const isOverdue = fu.followUpDate && new Date(fu.followUpDate) < new Date();
            const isNoOrder = fu.followUpKind === "no_order";
            const repName = fu.salesRepName || fu.customer?.salesRepName || "—";
            return (
              <div key={fu.id} className="card-surface p-5" style={{ borderLeft: isOverdue ? "3px solid #EF4444" : isNoOrder ? "3px solid #6366F1" : "3px solid #F59E0B" }}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {/* Badges row */}
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      {isNoOrder ? (
                        <span className="status-badge text-xs" style={{ backgroundColor: "rgba(99,102,241,0.15)", color: "#6366F1" }}>
                          <AlertTriangle className="w-3 h-3 inline mr-1" />No Order (10+ days)
                        </span>
                      ) : (
                        <span className="status-badge text-xs" style={{ backgroundColor: "rgba(245,158,11,0.15)", color: "#F59E0B" }}>
                          <Clock className="w-3 h-3 inline mr-1" />Sample Follow-up
                        </span>
                      )}
                      {isOverdue && (
                        <span className="status-badge text-xs" style={{ backgroundColor: "rgba(239,68,68,0.15)", color: "#EF4444" }}>
                          Overdue
                        </span>
                      )}
                      <span className="text-xs text-[#8A8B8C] flex items-center gap-1">
                        <User className="w-3 h-3" /> {repName}
                      </span>
                    </div>

                    <h3 className="font-display font-semibold text-white text-lg">{fu.customer?.name || "Unknown Customer"}</h3>

                    {isNoOrder ? (
                      <div className="text-[#8A8B8C] text-sm font-body mt-1 space-y-0.5">
                        <p>Last order: {fu.lastOrderDate ? new Date(fu.lastOrderDate).toLocaleDateString("en-ZA") : "Never"} ({fu.daysSince} days ago)</p>
                        <p>Total orders: {fu.totalOrders || 0}</p>
                      </div>
                    ) : (
                      <div className="text-[#8A8B8C] text-sm font-body mt-1">
                        <p>Order: {fu.orderNumber} &middot; Sent: {fu.order?.createdAt ? new Date(fu.order.createdAt).toLocaleDateString("en-ZA") : "—"}</p>
                        {fu.order?.items && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {fu.order.items.map((item: any, idx: number) => (
                              <span key={idx} className="status-badge text-xs" style={{ backgroundColor: "rgba(212, 168, 67, 0.12)", color: "#D4A843" }}>
                                {item.productName} ({item.quantity})
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    <p className="text-xs text-[#8A8B8C] mt-2">
                      {isNoOrder
                        ? `Follow-up due: ${fu.followUpDate ? new Date(fu.followUpDate).toLocaleDateString("en-ZA") : ""}`
                        : `Follow-up date: ${fu.followUpDate ? new Date(fu.followUpDate).toLocaleDateString("en-ZA") : ""} (${fu.daysSince || 0} days)`}
                    </p>
                  </div>

                  <button
                    onClick={() => openActionForm(fu)}
                    className="btn-primary text-sm shrink-0"
                    disabled={showForm === fu.id}
                  >
                    <MessageSquare className="w-4 h-4" /> Log Action
                  </button>
                </div>

                {/* ─── ACTION FORM ─── */}
                {showForm === fu.id && (
                  <div className="mt-4 p-4 rounded-lg" style={{ backgroundColor: "#0A0A0B" }}>
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-white font-body font-medium flex items-center gap-2">
                        <ClipboardList className="w-4 h-4 text-[#D4A843]" /> Record Follow-up Action
                      </h4>
                      <button onClick={() => setShowForm(null)} className="text-[#8A8B8C] hover:text-white"><X className="w-4 h-4" /></button>
                    </div>

                    <div className="space-y-4">
                      {/* Action Type */}
                      <div>
                        <label className="label-text block mb-1.5">Action Type *</label>
                        <select value={actionType} onChange={(e) => setActionType(e.target.value)} className="input-field" required>
                          {APPOINTMENT_TYPES.map((t) => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                          ))}
                        </select>
                      </div>

                      {/* Action Title */}
                      <div>
                        <label className="label-text block mb-1.5">Action Title *</label>
                        <select value={actionTitle} onChange={(e) => setActionTitle(e.target.value)} className="input-field" required>
                          <option value="">Select a title...</option>
                          {[...EXISTING_CUSTOMER_TITLES, ...NEW_CUSTOMER_TITLES].map((t) => (
                            <option key={t.value} value={t.label}>{t.label}</option>
                          ))}
                        </select>
                      </div>

                      {/* Notes */}
                      <div>
                        <label className="label-text block mb-1.5">Notes</label>
                        <textarea
                          value={actionNotes}
                          onChange={(e) => setActionNotes(e.target.value)}
                          className="input-field"
                          rows={3}
                          placeholder="e.g. Discussed pricing, customer will decide next week..."
                        />
                      </div>

                      {/* Schedule follow-up */}
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={actionScheduleFollowUp}
                          onChange={(e) => setActionScheduleFollowUp(e.target.checked)}
                          className="w-4 h-4 accent-[#D4A843]"
                        />
                        <span className="text-sm text-[#E8E8E9] font-body">Schedule follow-up appointment</span>
                      </label>
                      {actionScheduleFollowUp && (
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="label-text block mb-1.5">Date *</label>
                            <input
                              type="date"
                              value={actionFollowUpDate}
                              onChange={(e) => setActionFollowUpDate(e.target.value)}
                              className="input-field"
                              min={new Date().toISOString().slice(0, 10)}
                            />
                          </div>
                          <div>
                            <label className="label-text block mb-1.5">Time *</label>
                            <input
                              type="time"
                              value={actionFollowUpTime}
                              onChange={(e) => setActionFollowUpTime(e.target.value)}
                              className="input-field"
                            />
                          </div>
                        </div>
                      )}

                      <div className="flex gap-3">
                        <button
                          onClick={() => submitActionForm(fu)}
                          className="btn-primary"
                          disabled={isSubmitting}
                        >
                          <CheckCircle className="w-4 h-4" /> {isSubmitting ? "Saving..." : "Complete Follow-up"}
                        </button>
                        <button onClick={() => setShowForm(null)} className="btn-secondary">Cancel</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
