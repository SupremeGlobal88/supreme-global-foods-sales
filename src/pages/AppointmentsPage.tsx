import { useState, useMemo } from "react";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { reloadFromStorage } from "@/lib/dataService";
import {
  Plus, X, MapPin, Clock, CheckCircle, Calendar,
  Navigation, User, Filter, ExternalLink, LogIn, LogOut,
  AlertTriangle, Phone, Briefcase, Search, ChevronDown, ChevronUp,
  Edit, Trash2,
} from "lucide-react";

type MapTarget = { customerId: number; address: string } | null;

export default function AppointmentsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  const myRepName = user?.name || "";
  const utils = trpc.useUtils();

  // ===================== STATE =====================

  // Tabs: visits (checkins), schedule (appointments), followups
  const [activeTab, setActiveTab] = useState<"visits" | "schedule" | "followups">("visits");

  // Schedule form
  const [showForm, setShowForm] = useState(false);
  const [scheduleMode, setScheduleMode] = useState<"existing" | "new">("existing");
  const [showEditForm, setShowEditForm] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<any>(null);
  const [showEditCheckinForm, setShowEditCheckinForm] = useState(false);
  const [editingCheckin, setEditingCheckin] = useState<any>(null);
  const [formData, setFormData] = useState({
    customerId: 0, title: "", notes: "",
    appointmentDate: new Date().toISOString().slice(0, 16),
    startTime: "09:00", location: "",
  });
  const [newCustomer, setNewCustomer] = useState({ name: "", contactPerson: "", phone: "", address: "", priceTier: "wholesale" as "corporate" | "bulk" | "wholesale" | "retail", paymentTerms: "cod" as "cod" | "7_days" | "14_days" | "30_days" });

  // Check-in flow
  const [showCheckinForm, setShowCheckinForm] = useState(false);
  const [checkinCustomerId, setCheckinCustomerId] = useState(0);
  const [checkinNotes, setCheckinNotes] = useState("");
  const [mapTarget, setMapTarget] = useState<MapTarget>(null);
  const [geoError, setGeoError] = useState("");
  const [checkinOutcome, setCheckinOutcome] = useState<"visit" | "order" | "sample">("visit");

  // Check-out flow
  const [showCheckoutForm, setShowCheckoutForm] = useState(false);
  const [checkoutCheckinId, setCheckoutCheckinId] = useState(0);
  const [checkoutNotes, setCheckoutNotes] = useState("");

  const [filterRep, setFilterRep] = useState<string>("all");
  const [expandedVisit, setExpandedVisit] = useState<number | null>(null);
  const [expandedAppt, setExpandedAppt] = useState<number | null>(null);

  // Customer search for check-in
  const [checkinSearch, setCheckinSearch] = useState("");

  // Follow-up action logging
  const [showActionForm, setShowActionForm] = useState(false);
  const [actionCustomerId, setActionCustomerId] = useState(0);
  const [actionType, setActionType] = useState<"phone_call" | "site_visit" | "email" | "whatsapp" | "sms" | "other">("phone_call");
  const [actionNotes, setActionNotes] = useState("");
  const [expandedCustomerActions, setExpandedCustomerActions] = useState<number | null>(null);

  // ===================== DATA =====================

  const { data: appointments } = trpc.appointment.list.useQuery();
  const { data: checkins } = trpc.checkIn.list.useQuery();
  const { data: customers } = trpc.customer.search.useQuery({ query: " " });
  const { data: salesReps } = trpc.customer.getSalesReps.useQuery();
  const { data: apptStats } = trpc.appointment.getStats.useQuery();
  const { data: checkinStats } = trpc.checkIn.getStats.useQuery();
  const { data: followUpCustomers } = trpc.customer.getCustomersNeedingFollowUp.useQuery({ days: 10 });
  const { data: followUpActions } = trpc.followUpAction.list.useQuery();

  // ===================== MUTATIONS =====================

  // Create new customer from appointments page
  const createCustomer = trpc.customer.create.useMutation({
    onSuccess: async (res: any) => {
      reloadFromStorage();
      await utils.customer.search.invalidate();
      await utils.customer.getStats.invalidate();
      if (res?.id) {
        setFormData({ ...formData, customerId: res.id });
        setScheduleMode("existing");
      }
    },
  });

  const createAppointment = trpc.appointment.create.useMutation({
    onSuccess: async () => {
      reloadFromStorage();
      await utils.appointment.list.invalidate(); await utils.appointment.getStats.invalidate();
      setShowForm(false); resetForm();
    },
  });
  const updateAppointment = trpc.appointment.update.useMutation({
    onSuccess: async () => {
      reloadFromStorage();
      await utils.appointment.list.invalidate(); await utils.appointment.getStats.invalidate();
      setShowEditForm(false); setEditingAppointment(null); resetForm();
    },
  });
  const deleteAppointment = trpc.appointment.delete.useMutation({
    onSuccess: async () => {
      reloadFromStorage();
      await utils.appointment.list.invalidate(); await utils.appointment.getStats.invalidate();
    },
  });
  const updateCheckin = trpc.checkIn.update.useMutation({
    onSuccess: async () => {
      reloadFromStorage();
      await utils.checkIn.list.invalidate(); await utils.checkIn.getStats.invalidate();
      setShowEditCheckinForm(false); setEditingCheckin(null);
    },
  });
  const deleteCheckin = trpc.checkIn.delete.useMutation({
    onSuccess: async () => {
      reloadFromStorage();
      await utils.checkIn.list.invalidate(); await utils.checkIn.getStats.invalidate();
      setShowEditCheckinForm(false); setEditingCheckin(null);
    },
  });
  const createCheckin = trpc.checkIn.create.useMutation({
    onSuccess: async () => {
      reloadFromStorage();
      await utils.checkIn.list.invalidate(); await utils.checkIn.getStats.invalidate();
      setMapTarget(null); setGeoError(""); setShowCheckinForm(false); setCheckinCustomerId(0); setCheckinNotes("");
    },
  });
  const checkoutMutation = trpc.checkIn.checkout.useMutation({
    onSuccess: async () => {
      reloadFromStorage();
      await utils.checkIn.list.invalidate(); await utils.checkIn.getStats.invalidate();
      setShowCheckoutForm(false); setCheckoutCheckinId(0); setCheckoutNotes("");
    },
  });
  const createFollowUpAction = trpc.followUpAction.create.useMutation({
    onSuccess: async () => {
      reloadFromStorage();
      await utils.followUpAction.list.invalidate();
      setShowActionForm(false); setActionCustomerId(0); setActionNotes(""); setActionType("phone_call");
    },
  });

  // ===================== HELPERS =====================

  function resetForm() {
    setFormData({ customerId: 0, title: "", notes: "", appointmentDate: new Date().toISOString().slice(0, 10) + "T09:00", startTime: "09:00", location: "" });
    setNewCustomer({ name: "", contactPerson: "", phone: "", address: "", priceTier: "wholesale", paymentTerms: "cod" });
  }

  function handleAddNewCustomerAndSchedule() {
    if (!newCustomer.name.trim()) { alert("Enter customer name"); return; }
    // Actually create the customer in the main database
    createCustomer.mutate({
      name: newCustomer.name.trim(),
      businessName: newCustomer.name.trim(),
      contactPerson: newCustomer.contactPerson || "",
      phone: newCustomer.phone || "",
      physicalAddress: newCustomer.address || "",
      city: "",
      province: "",
      postalCode: "",
      paymentTerms: newCustomer.paymentTerms,
      priceTier: newCustomer.priceTier,
      salesRepName: myRepName,
      status: "active",
    });
  }

  // Filter: admin sees all, sales rep sees own
  const myAppointments = isAdmin
    ? (filterRep === "all" ? (appointments || []) : (appointments || []).filter((a: any) => a.salesRepName === filterRep))
    : (appointments || []).filter((a: any) => a.salesRepName === myRepName);

  const myCheckins = isAdmin
    ? (filterRep === "all" ? (checkins || []) : (checkins || []).filter((ci: any) => ci.salesRepName === filterRep))
    : (checkins || []).filter((ci: any) => ci.salesRepName === myRepName);

  const myFollowUps = isAdmin
    ? (filterRep === "all" ? (followUpCustomers || []) : (followUpCustomers || []).filter((c: any) => c.salesRepName === filterRep))
    : (followUpCustomers || []).filter((c: any) => c.salesRepName === myRepName);

  // ===================== CHECK-IN FLOW =====================

  function openCheckinForm() {
    setShowCheckinForm(true);
    setCheckinCustomerId(0);
    setCheckinNotes("");
    setCheckinSearch("");
    setMapTarget(null);
    setGeoError("");
    setCheckinOutcome("visit");
  }

  function submitCheckinForm() {
    if (checkinCustomerId === 0) { alert("Select a customer"); return; }
    const customer = (customers || []).find((c) => c.id === checkinCustomerId);
    if (!customer) return;

    setGeoError("");
    setMapTarget(null);

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          createCheckin.mutate({
            customerId: checkinCustomerId,
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            notes: `[${checkinOutcome.toUpperCase()}] ${checkinNotes || customer.physicalAddress || ""}`,
            salesRepName: myRepName,
            location: customer.physicalAddress || customer.name,
            outcome: checkinOutcome,
          });
        },
        () => {
          setGeoError("GPS unavailable — confirm location on map");
          setMapTarget({
            customerId: checkinCustomerId,
            address: customer.physicalAddress || customer.name,
          });
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      setGeoError("GPS not available — confirm location on map");
      setMapTarget({
        customerId: checkinCustomerId,
        address: customer.physicalAddress || customer.name,
      });
    }
  }

  function confirmMapCheckin() {
    if (!mapTarget) return;
    const customer = (customers || []).find((c) => c.id === mapTarget.customerId);
    createCheckin.mutate({
      customerId: mapTarget.customerId,
      notes: `[${checkinOutcome.toUpperCase()}] ${checkinNotes || customer?.physicalAddress || mapTarget.address}`,
      salesRepName: myRepName,
      location: customer?.physicalAddress || mapTarget.address,
      outcome: checkinOutcome,
    });
  }

  // ===================== CHECK-OUT FLOW =====================

  function openCheckoutForm(checkinId: number) {
    setShowCheckoutForm(true);
    setCheckoutCheckinId(checkinId);
    setCheckoutNotes("");
  }

  function submitCheckout() {
    if (checkoutCheckinId === 0) return;
    checkoutMutation.mutate({ id: checkoutCheckinId, notes: checkoutNotes });
  }

  function openActionForm(customerId: number) {
    setActionCustomerId(customerId);
    setActionType("phone_call");
    setActionNotes("");
    setShowActionForm(true);
  }

  function submitActionForm() {
    if (actionCustomerId === 0) return;
    createFollowUpAction.mutate({
      customerId: actionCustomerId,
      actionType,
      notes: actionNotes,
      salesRepName: myRepName,
    });
  }

  // ===================== SCHEDULE APPOINTMENT =====================

  function handleScheduleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (formData.customerId === 0) { alert("Select a customer"); return; }
    if (!formData.title.trim()) { alert("Enter a title"); return; }
    createAppointment.mutate({
      ...formData,
      salesRepName: myRepName,
      appointmentDate: formData.appointmentDate,
    });
  }

  // ===================== APPOINTMENT STATUS GROUPS =====================

  const upcoming = myAppointments.filter((a: any) => a.status === "scheduled");
  const inProgress = myAppointments.filter((a: any) => a.status === "in_progress");
  const completed = myAppointments.filter((a: any) => a.status === "completed");

  // Check-in groups
  const activeCheckins = myCheckins.filter((ci: any) => ci.status === "checked_in");
  const completedCheckins = myCheckins.filter((ci: any) => ci.status === "checked_out");

  // Customer search for check-in
  const filteredCheckinCustomers = useMemo(() => {
    const q = checkinSearch.toLowerCase().trim();
    if (!q) return customers || [];
    return (customers || []).filter((c: any) =>
      (c.name || "").toLowerCase().includes(q) ||
      (c.customerCode || "").toLowerCase().includes(q) ||
      (c.city || "").toLowerCase().includes(q)
    );
  }, [customers, checkinSearch]);

  // ===================== GOOGLE MAPS URLS =====================

  const mapEmbedUrl = mapTarget
    ? `https://maps.google.com/maps?q=${encodeURIComponent(mapTarget.address)}&z=15&ie=UTF8&iwloc=&output=embed`
    : "";
  const mapLinkUrl = mapTarget
    ? `https://www.google.com/maps?q=${encodeURIComponent(mapTarget.address)}`
    : "";

  // ===================== RENDER =====================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display font-semibold text-white" style={{ fontSize: "clamp(1.8rem, 3vw, 2.5rem)", letterSpacing: "-0.03em" }}>Appointments</h1>
          <p className="text-[#8A8B8C] font-body text-sm mt-1">
            {apptStats?.total || 0} appointments &middot; {checkinStats?.checkedIn || 0} currently checked in &middot; {checkinStats?.total || 0} total visits
          </p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <button onClick={openCheckinForm} className="btn-primary" style={{ backgroundColor: "#4ADE80", borderColor: "#4ADE80", color: "#0A0A0B" }}>
            <LogIn className="w-4 h-4" /> Check In at Location
          </button>
          <button onClick={() => { setShowForm(true); resetForm(); }} className="btn-primary"><Plus className="w-4 h-4" /> Schedule</button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card-surface p-4"><div className="label-text mb-1">TOTAL APPOINTMENTS</div><div className="stat-number">{apptStats?.total || 0}</div></div>
        <div className="card-surface p-4"><div className="label-text mb-1">TODAY</div><div className="stat-number" style={{ color: "#D4A843" }}>{apptStats?.today || 0}</div></div>
        <div className="card-surface p-4"><div className="label-text mb-1">CHECKED IN NOW</div><div className="stat-number" style={{ color: "#4ADE80" }}>{checkinStats?.checkedIn || 0}</div></div>
        <div className="card-surface p-4"><div className="label-text mb-1">COMPLETED VISITS</div><div className="stat-number" style={{ color: "#6366F1" }}>{checkinStats?.checkedOut || 0}</div></div>
      </div>

      {/* Follow-up Alert Banner */}
      {myFollowUps && myFollowUps.length > 0 && (
        <div className="card-surface p-4" style={{ backgroundColor: "rgba(245, 158, 11, 0.06)", border: "1px solid rgba(245, 158, 11, 0.2)" }}>
          <div className="flex items-center gap-3 mb-3">
            <AlertTriangle className="w-5 h-5" style={{ color: "#F59E0B" }} />
            <h3 className="font-display font-semibold text-white text-sm" style={{ color: "#F59E0B" }}>
              {myFollowUps.length} customer{myFollowUps.length > 1 ? "s" : ""} need{myFollowUps.length === 1 ? "s" : ""} follow-up (no order in 10+ days)
            </h3>
          </div>
          <div className="flex gap-2 flex-wrap">
            {myFollowUps.slice(0, 5).map((c: any) => (
              <button
                key={c.id}
                onClick={() => setActiveTab("followups")}
                className="text-xs px-3 py-1.5 rounded-full font-body"
                style={{ backgroundColor: "rgba(245, 158, 11, 0.12)", color: "#F59E0B", border: "1px solid rgba(245, 158, 11, 0.2)" }}
              >
                {c.name} ({c.daysSinceLastOrder === 999 ? "Never" : c.daysSinceLastOrder + "d"})
              </button>
            ))}
            {myFollowUps.length > 5 && (
              <button onClick={() => setActiveTab("followups")} className="text-xs px-3 py-1.5 rounded-full font-body" style={{ color: "#8A8B8C" }}>
                +{myFollowUps.length - 5} more
              </button>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-lg" style={{ backgroundColor: "#18191A", border: "1px solid #222324" }}>
        {(["visits", "schedule", "followups"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="flex-1 py-2 rounded-md text-sm font-body font-medium transition-all cursor-pointer"
            style={{
              backgroundColor: activeTab === tab ? "#222324" : "transparent",
              color: activeTab === tab ? "#D4A843" : "#8A8B8C",
            }}
          >
            {tab === "visits" && `Visits (${myCheckins.length})`}
            {tab === "schedule" && `Schedule (${myAppointments.length})`}
            {tab === "followups" && `Follow-ups (${myFollowUps?.length || 0})`}
          </button>
        ))}
      </div>

      {/* Sales Rep Filter — Admin Only */}
      {isAdmin && (
        <div className="card-surface p-4">
          <div className="flex items-center gap-3">
            <Filter className="w-4 h-4 text-[#8A8B8C]" />
            <label className="label-text">Filter by Sales Rep:</label>
            <select value={filterRep} onChange={(e) => setFilterRep(e.target.value)} className="input-field w-auto">
              <option value="all">All Sales Reps</option>
              {(salesReps || []).map((rep: string) => <option key={rep} value={rep}>{rep}</option>)}
            </select>
          </div>
        </div>
      )}

      {/* ===================== VISITS TAB ===================== */}
      {activeTab === "visits" && (
        <div className="space-y-6">
          {/* Active Visits — Checked In */}
          {activeCheckins.length > 0 && (
            <div>
              <h2 className="font-display font-semibold text-white text-lg mb-4 flex items-center gap-2">
                <LogIn className="w-5 h-5 text-[#4ADE80]" /> Active Visits — Checked In ({activeCheckins.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeCheckins.map((ci: any) => (
                  <div key={ci.id} className="card-surface p-4" style={{ borderLeft: "3px solid #4ADE80" }}>
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <User className="w-4 h-4 text-[#D4A843]" />
                          <span className="text-sm font-body font-semibold text-white">{ci.salesRepName || "Unknown Rep"}</span>
                          {isAdmin && (
                            <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: "rgba(74,222,128,0.12)", color: "#4ADE80" }}>
                              {ci.outcome || "visit"}
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-[#E8E8E9] font-body mb-1">
                          {ci.customer?.name || (ci.notes?.includes("Customer:") ? ci.notes.split("\n").find((l: string) => l.startsWith("Customer:"))?.replace("Customer: ", "") : "Unknown Customer")}
                        </div>
                        {ci.location && <div className="flex items-center gap-1 text-xs text-[#8A8B8C]"><MapPin className="w-3 h-3" />{ci.location}</div>}
                      </div>
                      <div className="text-right">
                        <span className="inline-block px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: "rgba(74, 222, 128, 0.12)", color: "#4ADE80" }}>Active</span>
                        <div className="text-xs text-[#8A8B8C] mt-1">{new Date(ci.createdAt).toLocaleDateString("en-ZA")}</div>
                        <div className="text-xs text-[#8A8B8C] font-mono-data">{new Date(ci.createdAt).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}</div>
                      </div>
                    </div>
                    {ci.latitude && ci.longitude && (
                      <div className="mt-3 p-2 rounded-lg flex items-center justify-between" style={{ backgroundColor: "#0A0A0B" }}>
                        <span className="text-xs font-mono-data text-[#8A8B8C]">{ci.latitude.toFixed(6)}, {ci.longitude.toFixed(6)}</span>
                        <a href={`https://www.google.com/maps?q=${ci.latitude},${ci.longitude}`} target="_blank" rel="noopener noreferrer" className="text-xs text-[#D4A843] underline">View on Map</a>
                      </div>
                    )}
                    {ci.notes && <p className="text-xs text-[#8A8B8C] mt-2 italic">{ci.notes}</p>}
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => openCheckoutForm(ci.id)} className="btn-primary flex-1 justify-center" style={{ backgroundColor: "#EF4444", borderColor: "#EF4444" }}>
                        <LogOut className="w-4 h-4" /> Check Out
                      </button>
                      <button onClick={() => { setEditingCheckin(ci); setShowEditCheckinForm(true); }} className="btn-secondary" title="Edit"><Edit className="w-4 h-4" /></button>
                      <button onClick={() => { if (confirm("Delete this check-in?")) deleteCheckin.mutate(ci.id); }} className="btn-secondary" style={{ color: "#EF4444" }} title="Delete"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Completed Visits — Checked Out */}
          <div>
            <h2 className="font-display font-semibold text-white text-lg mb-4 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-[#6366F1]" /> Completed Visits ({completedCheckins.length})
            </h2>
            {completedCheckins.length === 0 ? (
              <div className="card-surface p-8 text-center text-[#8A8B8C] font-body">No completed visits yet. Check in at a customer, then check out when done.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {completedCheckins.map((ci: any) => (
                  <div key={ci.id} className="card-surface p-4">
                    <div className="flex items-start justify-between cursor-pointer" onClick={() => setExpandedVisit(expandedVisit === ci.id ? null : ci.id)}>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <User className="w-4 h-4 text-[#D4A843]" />
                          <span className="text-sm font-body font-semibold text-white">{ci.salesRepName || "Unknown Rep"}</span>
                          {isAdmin && (
                            <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: "rgba(99,102,241,0.12)", color: "#6366F1" }}>
                              {ci.outcome || "visit"}
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-[#E8E8E9] font-body mb-1">
                          {ci.customer?.name || (ci.notes?.includes("Customer:") ? ci.notes.split("\n").find((l: string) => l.startsWith("Customer:"))?.replace("Customer: ", "") : "Unknown Customer")}
                        </div>
                        {ci.location && <div className="flex items-center gap-1 text-xs text-[#8A8B8C]"><MapPin className="w-3 h-3" />{ci.location}</div>}
                      </div>
                      <div className="text-right flex flex-col items-end gap-1">
                        <span className="inline-block px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: "rgba(99, 102, 241, 0.12)", color: "#6366F1" }}>Done</span>
                        <div className="flex gap-1">
                          <button onClick={(e) => { e.stopPropagation(); setEditingCheckin(ci); setShowEditCheckinForm(true); }} className="text-[#8A8B8C] hover:text-[#D4A843] transition-colors p-1" title="Edit"><Edit className="w-3.5 h-3.5" /></button>
                          <button onClick={(e) => { e.stopPropagation(); if (confirm("Delete this check-in?")) deleteCheckin.mutate(ci.id); }} className="text-[#8A8B8C] hover:text-[#EF4444] transition-colors p-1" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                        <div className="text-xs text-[#8A8B8C]">{new Date(ci.createdAt).toLocaleDateString("en-ZA")}</div>
                      </div>
                    </div>

                    {expandedVisit === ci.id && (
                      <div className="mt-3 space-y-2 pt-3" style={{ borderTop: "1px solid #222324" }}>
                        {ci.durationMinutes !== undefined && (
                          <div className="flex items-center gap-2">
                            <Clock className="w-3 h-3 text-[#D4A843]" />
                            <span className="text-xs text-[#D4A843] font-body font-medium">
                              {ci.durationMinutes < 60 ? `${ci.durationMinutes} min` : `${Math.floor(ci.durationMinutes / 60)}h ${ci.durationMinutes % 60}m`}
                            </span>
                            <span className="text-xs text-[#8A8B8C]">
                              ({new Date(ci.createdAt).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })} - {new Date(ci.checkedOutAt).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })})
                            </span>
                          </div>
                        )}
                        {ci.latitude && ci.longitude && (
                          <div className="p-2 rounded-lg flex items-center justify-between" style={{ backgroundColor: "#0A0A0B" }}>
                            <span className="text-xs font-mono-data text-[#8A8B8C]">{ci.latitude.toFixed(6)}, {ci.longitude.toFixed(6)}</span>
                            <a href={`https://www.google.com/maps?q=${ci.latitude},${ci.longitude}`} target="_blank" rel="noopener noreferrer" className="text-xs text-[#D4A843] underline">View on Map</a>
                          </div>
                        )}
                        {ci.notes && <p className="text-xs text-[#8A8B8C] italic">Check-in: {ci.notes}</p>}
                        {ci.checkoutNotes && (
                          <div className="p-2 rounded-lg" style={{ backgroundColor: "rgba(239, 68, 68, 0.06)", border: "1px solid rgba(239, 68, 68, 0.15)" }}>
                            <p className="text-xs text-[#EF4444] font-body font-medium mb-0.5">Check-out notes:</p>
                            <p className="text-xs text-[#E8E8E9] font-body">{ci.checkoutNotes}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================== SCHEDULE TAB ===================== */}
      {activeTab === "schedule" && (
        <div className="space-y-6">
          <div>
            <h2 className="font-display font-semibold text-white text-lg mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#D4A843]" /> Scheduled Appointments ({myAppointments.length})
            </h2>

            {inProgress.length > 0 && (
              <div className="mb-4">
                <h3 className="label-text mb-2" style={{ color: "#6366F1" }}>IN PROGRESS</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {inProgress.map((appt: any) => (
                    <div key={appt.id} className="card-surface p-4" style={{ borderLeft: "3px solid #6366F1" }}>
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <User className="w-3 h-3 text-[#D4A843]" />
                            <span className="text-xs font-body" style={{ color: "#D4A843" }}>{appt.salesRepName || "Unassigned"}</span>
                          </div>
                          <h4 className="font-display font-medium text-white mt-1">{appt.title}</h4>
                          <p className="text-sm text-[#E8E8E9] font-body">{appt.customer?.name || appt.notes?.split("\n")[0]?.replace("Customer: ", "") || "No customer"}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="status-badge text-xs" style={{ backgroundColor: "rgba(99, 102, 241, 0.12)", color: "#6366F1" }}>In Progress</span>
                          <button onClick={() => { setEditingAppointment(appt); setFormData({ customerId: appt.customerId || 0, title: appt.title || "", notes: appt.notes || "", appointmentDate: appt.appointmentDate || new Date().toISOString().slice(0, 16), startTime: appt.appointmentDate ? appt.appointmentDate.slice(11, 16) : "09:00", location: appt.location || "" }); setShowEditForm(true); }} className="text-[#8A8B8C] hover:text-[#D4A843] transition-colors" title="Edit"><Edit className="w-4 h-4" /></button>
                          <button onClick={() => { if (confirm("Delete this appointment?")) deleteAppointment.mutate(appt.id); }} className="text-[#8A8B8C] hover:text-[#EF4444] transition-colors" title="Delete"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-[#8A8B8C]">
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(appt.appointmentDate).toLocaleString("en-ZA")}</span>
                        {appt.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{appt.location}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {upcoming.length > 0 && (
              <div className="mb-4">
                <h3 className="label-text mb-2" style={{ color: "#F59E0B" }}>UPCOMING</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {upcoming.map((appt: any) => (
                    <div key={appt.id} className="card-surface p-4" style={{ borderLeft: "3px solid #F59E0B" }}>
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <User className="w-3 h-3 text-[#D4A843]" />
                            <span className="text-xs font-body" style={{ color: "#D4A843" }}>{appt.salesRepName || "Unassigned"}</span>
                          </div>
                          <h4 className="font-display font-medium text-white mt-1">{appt.title}</h4>
                          <p className="text-sm text-[#E8E8E9] font-body">{appt.customer?.name || appt.notes?.split("\n")[0]?.replace("Customer: ", "") || "No customer"}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="status-badge text-xs" style={{ backgroundColor: "rgba(245, 158, 11, 0.12)", color: "#F59E0B" }}>Scheduled</span>
                          <button onClick={() => { setEditingAppointment(appt); setFormData({ customerId: appt.customerId || 0, title: appt.title || "", notes: appt.notes || "", appointmentDate: appt.appointmentDate || new Date().toISOString().slice(0, 16), startTime: appt.appointmentDate ? appt.appointmentDate.slice(11, 16) : "09:00", location: appt.location || "" }); setShowEditForm(true); }} className="text-[#8A8B8C] hover:text-[#D4A843] transition-colors" title="Edit"><Edit className="w-4 h-4" /></button>
                          <button onClick={() => { if (confirm("Delete this appointment?")) deleteAppointment.mutate(appt.id); }} className="text-[#8A8B8C] hover:text-[#EF4444] transition-colors" title="Delete"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-[#8A8B8C]">
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(appt.appointmentDate).toLocaleString("en-ZA")}</span>
                        {appt.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{appt.location}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {myAppointments.length === 0 && (
              <div className="card-surface p-8 text-center text-[#8A8B8C] font-body">No appointments scheduled. Tap "Schedule" to create one.</div>
            )}
          </div>
        </div>
      )}

      {/* ===================== FOLLOW-UPS TAB ===================== */}
      {activeTab === "followups" && (
        <div className="space-y-6">
          <div>
            <h2 className="font-display font-semibold text-white text-lg mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-[#F59E0B]" /> Customers Needing Follow-up
            </h2>
            {myFollowUps?.length === 0 ? (
              <div className="card-surface p-8 text-center text-[#8A8B8C] font-body">
                <CheckCircle className="w-12 h-12 mx-auto mb-3 text-[#4ADE80]" />
                <p className="text-[#4ADE80] font-body font-medium mb-1">All caught up!</p>
                <p className="text-sm">All customers have ordered within the last 10 days.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {myFollowUps?.map((c: any) => {
                  const customerActions = (followUpActions || []).filter((fa: any) => fa.customerId === c.id);
                  const isExpanded = expandedCustomerActions === c.id;
                  return (
                    <div key={c.id} className="card-surface p-4" style={{ borderLeft: "3px solid #F59E0B" }}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Briefcase className="w-4 h-4 text-[#D4A843]" />
                            <span className="text-sm font-body font-semibold text-white">{c.name}</span>
                            <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: "rgba(245,158,11,0.12)", color: "#F59E0B" }}>
                              {c.priceTier || "wholesale"}
                            </span>
                            {customerActions.length > 0 && (
                              <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: "rgba(74,222,128,0.12)", color: "#4ADE80" }}>
                                {customerActions.length} action{customerActions.length > 1 ? "s" : ""} logged
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-xs text-[#8A8B8C] mb-2">
                            {c.contactPerson && <span className="flex items-center gap-1"><User className="w-3 h-3" />{c.contactPerson}</span>}
                            {c.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{c.phone}</span>}
                            {c.physicalAddress && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{c.physicalAddress}{c.city ? `, ${c.city}` : ""}</span>}
                          </div>
                          <div className="flex items-center gap-4 text-xs">
                            <span className="text-[#EF4444] font-medium">
                              {c.daysSinceLastOrder === 999 ? "Never ordered" : `${c.daysSinceLastOrder} days since last order`}
                            </span>
                            {c.lastOrder && (
                              <span className="text-[#8A8B8C]">
                                Last: {new Date(c.lastOrderDate).toLocaleDateString("en-ZA")} — R {Number(c.lastOrder.total || 0).toFixed(2)}
                              </span>
                            )}
                            <span className="text-[#8A8B8C]">{c.totalOrders} total orders</span>
                          </div>

                          {/* Previous actions */}
                          {customerActions.length > 0 && isExpanded && (
                            <div className="mt-3 space-y-2 pt-3" style={{ borderTop: "1px solid #222324" }}>
                              <p className="text-xs font-body font-medium text-[#8A8B8C] mb-2">Previous Actions:</p>
                              {customerActions.map((fa: any) => (
                                <div key={fa.id} className="flex items-start gap-2 p-2 rounded" style={{ backgroundColor: "#0A0A0B" }}>
                                  <span className="text-xs px-2 py-0.5 rounded font-medium shrink-0" style={{
                                    backgroundColor: fa.actionType === "site_visit" ? "rgba(99,102,241,0.15)" : fa.actionType === "phone_call" ? "rgba(74,222,128,0.15)" : fa.actionType === "whatsapp" ? "rgba(37,211,102,0.15)" : fa.actionType === "email" ? "rgba(59,130,246,0.15)" : "rgba(212,168,67,0.15)",
                                    color: fa.actionType === "site_visit" ? "#6366F1" : fa.actionType === "phone_call" ? "#4ADE80" : fa.actionType === "whatsapp" ? "#25D366" : fa.actionType === "email" ? "#3B82F6" : "#D4A843",
                                  }}>
                                    {(fa.actionType || "other").replace("_", " ")}
                                  </span>
                                  <div className="flex-1 min-w-0">
                                    {fa.notes && <p className="text-xs text-[#E8E8E9] font-body">{fa.notes}</p>}
                                    <p className="text-xs text-[#8A8B8C]">{fa.salesRepName || "Unknown"} — {new Date(fa.createdAt).toLocaleDateString("en-ZA")}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-2 ml-4">
                          <span className="text-xs font-body" style={{ color: "#D4A843" }}>{c.salesRepName || "Unassigned"}</span>
                          <button
                            onClick={() => openActionForm(c.id)}
                            className="text-xs px-3 py-1.5 rounded-lg font-body font-medium cursor-pointer"
                            style={{ backgroundColor: "rgba(212,168,67,0.15)", color: "#D4A843", border: "1px solid rgba(212,168,67,0.3)" }}
                          >
                            + Log Action
                          </button>
                          {customerActions.length > 0 && (
                            <button
                              onClick={() => setExpandedCustomerActions(isExpanded ? null : c.id)}
                              className="text-xs cursor-pointer"
                              style={{ color: "#8A8B8C" }}
                            >
                              {isExpanded ? "Hide" : "View Actions"}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================== MODALS ===================== */}

      {/* Check-in Form Modal */}
      {showCheckinForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.7)" }}>
          <div className="card-surface p-6 max-w-md w-full mx-4" style={{ borderRadius: 16, maxHeight: "90vh", overflowY: "auto" }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-semibold text-white text-lg flex items-center gap-2"><LogIn className="w-5 h-5 text-[#4ADE80]" /> Check In</h2>
              <button onClick={() => { setShowCheckinForm(false); setMapTarget(null); setGeoError(""); }} className="cursor-pointer"><X className="w-5 h-5 text-[#8A8B8C]" /></button>
            </div>

            {!mapTarget ? (
              <div className="space-y-4">
                {/* Customer search */}
                <div>
                  <label className="label-text block mb-1.5">Search Customer *</label>
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#8A8B8C]" />
                    <input
                      type="text"
                      value={checkinSearch}
                      onChange={(e) => setCheckinSearch(e.target.value)}
                      placeholder="Type to search customers..."
                      className="input-field w-full pl-10"
                    />
                  </div>
                  <div className="mt-2 max-h-40 overflow-y-auto rounded-lg" style={{ backgroundColor: "#0A0A0B", border: "1px solid #222324" }}>
                    {filteredCheckinCustomers.length === 0 && (
                      <div className="p-3 text-xs text-[#8A8B8C]">No customers found</div>
                    )}
                    {filteredCheckinCustomers.map((c: any) => (
                      <div
                        key={c.id}
                        onClick={() => setCheckinCustomerId(c.id)}
                        className="p-3 cursor-pointer flex items-center justify-between"
                        style={{
                          borderBottom: "1px solid #222324",
                          backgroundColor: checkinCustomerId === c.id ? "rgba(212,168,67,0.1)" : "transparent",
                        }}
                      >
                        <div>
                          <div className="text-sm font-body" style={{ color: checkinCustomerId === c.id ? "#D4A843" : "#E8E8E9" }}>{c.name}</div>
                          <div className="text-xs text-[#8A8B8C]">{c.physicalAddress}{c.city ? `, ${c.city}` : ""}</div>
                        </div>
                        {checkinCustomerId === c.id && <CheckCircle className="w-4 h-4 text-[#D4A843]" />}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Visit outcome */}
                <div>
                  <label className="label-text block mb-1.5">Visit Outcome</label>
                  <div className="flex gap-2">
                    {(["visit", "order", "sample"] as const).map((o) => (
                      <button
                        key={o}
                        onClick={() => setCheckinOutcome(o)}
                        className="flex-1 py-2 rounded-lg text-xs font-body font-medium capitalize cursor-pointer"
                        style={{
                          backgroundColor: checkinOutcome === o ? "#D4A843" : "#222324",
                          color: checkinOutcome === o ? "#0A0A0B" : "#8A8B8C",
                        }}
                      >
                        {o}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="label-text block mb-1.5">Notes (optional)</label>
                  <textarea value={checkinNotes} onChange={(e) => setCheckinNotes(e.target.value)} className="input-field" rows={2} placeholder="What did you discuss?" />
                </div>
                {geoError && <p className="text-xs text-[#EF4444]">{geoError}</p>}
                <button onClick={submitCheckinForm} className="btn-primary w-full justify-center"><Navigation className="w-4 h-4" /> Check In Now</button>
                <p className="text-xs text-[#8A8B8C] font-body text-center">GPS will be captured automatically. If unavailable, you'll confirm on Google Maps.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-[#D4A843] font-body">GPS unavailable — confirm your location on the map below.</p>
                <div className="rounded-lg overflow-hidden" style={{ border: "1px solid #222324" }}>
                  <iframe
                    src={mapEmbedUrl}
                    width="100%"
                    height="280"
                    style={{ border: 0, filter: "grayscale(0.3)" }}
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    title="Customer Location"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <a href={mapLinkUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-[#D4A843] underline flex items-center gap-1"><ExternalLink className="w-3 h-3" /> Open in Google Maps</a>
                  <div className="flex gap-2">
                    <button onClick={() => setMapTarget(null)} className="btn-secondary text-xs">Back</button>
                    <button onClick={confirmMapCheckin} className="btn-primary text-xs" style={{ backgroundColor: "#4ADE80", borderColor: "#4ADE80", color: "#0A0A0B" }}><CheckCircle className="w-3 h-3" /> Confirm</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Check-Out Form Modal */}
      {showCheckoutForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.7)" }}>
          <div className="card-surface p-6 max-w-md w-full mx-4" style={{ borderRadius: 16 }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-semibold text-white text-lg flex items-center gap-2"><LogOut className="w-5 h-5 text-[#EF4444]" /> Check Out</h2>
              <button onClick={() => setShowCheckoutForm(false)} className="cursor-pointer"><X className="w-5 h-5 text-[#8A8B8C]" /></button>
            </div>
            <div className="space-y-4">
              <p className="text-sm text-[#8A8B8C] font-body">End your visit and record any notes about the appointment.</p>
              <div>
                <label className="label-text block mb-1.5">Visit Notes</label>
                <textarea value={checkoutNotes} onChange={(e) => setCheckoutNotes(e.target.value)} className="input-field" rows={3} placeholder="e.g. Took sample order, discussed pricing, follow-up in 2 weeks..." />
              </div>
              <button onClick={submitCheckout} className="btn-primary w-full justify-center" style={{ backgroundColor: "#EF4444", borderColor: "#EF4444" }}><LogOut className="w-4 h-4" /> Check Out Now</button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.7)" }}>
          <div className="card-surface p-6 max-w-lg w-full mx-4" style={{ borderRadius: 16, maxHeight: "90vh", overflowY: "auto" }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-semibold text-white text-lg">Schedule Appointment</h2>
              <button onClick={() => setShowForm(false)} className="cursor-pointer"><X className="w-5 h-5 text-[#8A8B8C]" /></button>
            </div>

            {/* Toggle: Existing vs New Customer */}
            <div className="flex p-1 rounded-full mb-5" style={{ backgroundColor: "#18191A", border: "1px solid #222324" }}>
              <button
                onClick={() => setScheduleMode("existing")}
                className="flex-1 py-2 rounded-full text-sm font-body font-medium transition-all cursor-pointer"
                style={{ backgroundColor: scheduleMode === "existing" ? "#D4A843" : "transparent", color: scheduleMode === "existing" ? "#0A0A0B" : "#8A8B8C" }}
              >Existing Customer</button>
              <button
                onClick={() => setScheduleMode("new")}
                className="flex-1 py-2 rounded-full text-sm font-body font-medium transition-all cursor-pointer"
                style={{ backgroundColor: scheduleMode === "new" ? "#D4A843" : "transparent", color: scheduleMode === "new" ? "#0A0A0B" : "#8A8B8C" }}
              >New Customer</button>
            </div>

            {scheduleMode === "existing" ? (
              <form onSubmit={handleScheduleSubmit} className="space-y-4">
                <div>
                  <label className="label-text block mb-1.5">Customer *</label>
                  <select value={formData.customerId} onChange={(e) => setFormData({ ...formData, customerId: parseInt(e.target.value) })} className="input-field" required>
                    <option value={0}>Select customer...</option>
                    {(customers || []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div><label className="label-text block mb-1.5">Title *</label><input type="text" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} className="input-field" required placeholder="e.g. Product demo / First visit" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="label-text block mb-1.5">Date *</label><input type="date" value={formData.appointmentDate.slice(0, 10)} onChange={(e) => setFormData({ ...formData, appointmentDate: e.target.value + "T" + formData.startTime })} className="input-field" required /></div>
                  <div><label className="label-text block mb-1.5">Time *</label><input type="time" value={formData.startTime} onChange={(e) => setFormData({ ...formData, startTime: e.target.value })} className="input-field" required /></div>
                </div>
                <div><label className="label-text block mb-1.5">Location</label><input type="text" value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} className="input-field" placeholder="e.g. Customer office address" /></div>
                <div><label className="label-text block mb-1.5">Notes</label><textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} className="input-field" rows={3} placeholder="Any additional details..." /></div>
                <button type="submit" className="btn-primary w-full justify-center">Schedule Appointment</button>
              </form>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="label-text block mb-1.5">Customer Name *</label>
                  <input type="text" value={newCustomer.name} onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })} className="input-field" placeholder="e.g. Joe's Butchery" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="label-text block mb-1.5">Contact Person</label><input type="text" value={newCustomer.contactPerson} onChange={(e) => setNewCustomer({ ...newCustomer, contactPerson: e.target.value })} className="input-field" placeholder="e.g. John Smith" /></div>
                  <div><label className="label-text block mb-1.5">Phone</label><input type="tel" value={newCustomer.phone} onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })} className="input-field" placeholder="e.g. 011 123 4567" /></div>
                </div>
                <div><label className="label-text block mb-1.5">Address</label><input type="text" value={newCustomer.address} onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })} className="input-field" placeholder="e.g. 123 Main St, Germiston" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label-text block mb-1.5">Price Tier</label>
                    <select value={newCustomer.priceTier} onChange={(e) => setNewCustomer({ ...newCustomer, priceTier: e.target.value as any })} className="input-field">
                      <option value="wholesale">Wholesale</option><option value="bulk">Bulk</option><option value="corporate">Corporate</option><option value="retail">Retail</option>
                    </select>
                  </div>
                  <div>
                    <label className="label-text block mb-1.5">Payment Terms</label>
                    <select value={newCustomer.paymentTerms} onChange={(e) => setNewCustomer({ ...newCustomer, paymentTerms: e.target.value as any })} className="input-field">
                      <option value="cod">COD</option><option value="7_days">7 Days</option><option value="14_days">14 Days</option><option value="30_days">30 Days</option>
                    </select>
                  </div>
                </div>
                <div><label className="label-text block mb-1.5">Appointment Title *</label><input type="text" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} className="input-field" placeholder="e.g. First visit / Product demo" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="label-text block mb-1.5">Date *</label><input type="date" value={formData.appointmentDate.slice(0, 10)} onChange={(e) => setFormData({ ...formData, appointmentDate: e.target.value + "T" + formData.startTime })} className="input-field" required /></div>
                  <div><label className="label-text block mb-1.5">Time *</label><input type="time" value={formData.startTime} onChange={(e) => setFormData({ ...formData, startTime: e.target.value })} className="input-field" required /></div>
                </div>
                <div><label className="label-text block mb-1.5">Location</label><input type="text" value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} className="input-field" placeholder="e.g. Customer office" /></div>
                <div><label className="label-text block mb-1.5">Notes</label><textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} className="input-field" rows={3} placeholder="Any additional details..." /></div>
                <button onClick={handleAddNewCustomerAndSchedule} className="btn-primary w-full justify-center">
                  <Plus className="w-4 h-4" /> Create Customer & Schedule
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================== EDIT APPOINTMENT MODAL ===================== */}
      {showEditForm && editingAppointment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.7)" }}>
          <div className="card-surface p-6 max-w-lg w-full mx-4" style={{ borderRadius: 16, maxHeight: "90vh", overflowY: "auto" }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-semibold text-white text-lg flex items-center gap-2"><Edit className="w-5 h-5 text-[#D4A843]" /> Edit Appointment</h2>
              <button onClick={() => { setShowEditForm(false); setEditingAppointment(null); }} className="cursor-pointer"><X className="w-5 h-5 text-[#8A8B8C]" /></button>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              if (!editingAppointment) return;
              updateAppointment.mutate({
                id: editingAppointment.id,
                data: {
                  title: formData.title,
                  notes: formData.notes,
                  appointmentDate: formData.appointmentDate,
                  location: formData.location,
                  customerId: formData.customerId,
                },
              });
            }} className="space-y-4">
              <div>
                <label className="label-text block mb-1.5">Customer</label>
                <select value={formData.customerId} onChange={(e) => setFormData({ ...formData, customerId: parseInt(e.target.value) })} className="input-field" required>
                  <option value={0}>Select customer...</option>
                  {(customers || []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div><label className="label-text block mb-1.5">Title *</label><input type="text" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} className="input-field" required placeholder="e.g. Product demo / Follow-up visit" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label-text block mb-1.5">Date *</label><input type="date" value={formData.appointmentDate.slice(0, 10)} onChange={(e) => setFormData({ ...formData, appointmentDate: e.target.value + "T" + formData.startTime })} className="input-field" required /></div>
                <div><label className="label-text block mb-1.5">Time *</label><input type="time" value={formData.startTime} onChange={(e) => setFormData({ ...formData, startTime: e.target.value })} className="input-field" required /></div>
              </div>
              <div><label className="label-text block mb-1.5">Location</label><input type="text" value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} className="input-field" placeholder="e.g. Customer office address" /></div>
              <div><label className="label-text block mb-1.5">Notes</label><textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} className="input-field" rows={3} placeholder="Any additional details..." /></div>
              <div className="flex gap-3">
                <button type="button" onClick={() => { if (confirm("Delete this appointment?")) { deleteAppointment.mutate(editingAppointment.id); setShowEditForm(false); setEditingAppointment(null); } }} className="btn-secondary flex items-center gap-2" style={{ color: "#EF4444", borderColor: "#EF4444" }}><Trash2 className="w-4 h-4" /> Delete</button>
                <button type="submit" className="btn-primary flex-1 justify-center" disabled={updateAppointment.isPending}>
                  {updateAppointment.isPending ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================== EDIT CHECK-IN MODAL ===================== */}
      {showEditCheckinForm && editingCheckin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.7)" }}>
          <div className="card-surface p-6 max-w-lg w-full mx-4" style={{ borderRadius: 16, maxHeight: "90vh", overflowY: "auto" }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-semibold text-white text-lg flex items-center gap-2"><Edit className="w-5 h-5 text-[#D4A843]" /> Edit Check-in</h2>
              <button onClick={() => { setShowEditCheckinForm(false); setEditingCheckin(null); }} className="cursor-pointer"><X className="w-5 h-5 text-[#8A8B8C]" /></button>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              if (!editingCheckin) return;
              updateCheckin.mutate({
                id: editingCheckin.id,
                data: {
                  notes: editingCheckin.notes,
                  location: editingCheckin.location,
                  outcome: editingCheckin.outcome,
                },
              });
            }} className="space-y-4">
              <div>
                <label className="label-text block mb-1.5">Customer</label>
                <div className="text-sm text-white font-body p-3 rounded-lg" style={{ backgroundColor: "#0A0A0B" }}>
                  {editingCheckin.customer?.name || editingCheckin.location || "Unknown"}
                </div>
              </div>
              <div>
                <label className="label-text block mb-1.5">Sales Rep</label>
                <div className="text-sm text-white font-body p-3 rounded-lg" style={{ backgroundColor: "#0A0A0B" }}>
                  {editingCheckin.salesRepName || "Unknown"}
                </div>
              </div>
              <div>
                <label className="label-text block mb-1.5">Outcome</label>
                <div className="flex gap-2">
                  {(["visit", "order", "sample"] as const).map((o) => (
                    <button
                      key={o}
                      type="button"
                      onClick={() => setEditingCheckin({ ...editingCheckin, outcome: o })}
                      className="flex-1 py-2 rounded-lg text-xs font-body font-medium capitalize cursor-pointer"
                      style={{ backgroundColor: editingCheckin.outcome === o ? "#D4A843" : "#222324", color: editingCheckin.outcome === o ? "#0A0A0B" : "#8A8B8C" }}
                    >
                      {o}
                    </button>
                  ))}
                </div>
              </div>
              <div><label className="label-text block mb-1.5">Location</label><input type="text" value={editingCheckin.location || ""} onChange={(e) => setEditingCheckin({ ...editingCheckin, location: e.target.value })} className="input-field" placeholder="e.g. Customer address" /></div>
              <div><label className="label-text block mb-1.5">Notes</label><textarea value={editingCheckin.notes || ""} onChange={(e) => setEditingCheckin({ ...editingCheckin, notes: e.target.value })} className="input-field" rows={3} placeholder="Check-in notes..." /></div>
              <div className="flex gap-3">
                <button type="button" onClick={() => { if (confirm("Delete this check-in?")) { deleteCheckin.mutate(editingCheckin.id); setShowEditCheckinForm(false); setEditingCheckin(null); } }} className="btn-secondary flex items-center gap-2" style={{ color: "#EF4444", borderColor: "#EF4444" }}><Trash2 className="w-4 h-4" /> Delete</button>
                <button type="submit" className="btn-primary flex-1 justify-center" disabled={updateCheckin.isPending}>
                  {updateCheckin.isPending ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================== LOG ACTION MODAL ===================== */}
      {showActionForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.7)" }}>
          <div className="card-surface p-6 max-w-md w-full mx-4" style={{ borderRadius: 16 }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-semibold text-white text-lg">Log Follow-up Action</h2>
              <button onClick={() => setShowActionForm(false)} className="cursor-pointer"><X className="w-5 h-5 text-[#8A8B8C]" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label-text block mb-1.5">Customer</label>
                <div className="text-sm text-white font-body p-3 rounded-lg" style={{ backgroundColor: "#0A0A0B" }}>
                  {(customers || []).find((c: any) => c.id === actionCustomerId)?.name || "Unknown"}
                </div>
              </div>
              <div>
                <label className="label-text block mb-1.5">Action Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { value: "phone_call", label: "Phone Call", color: "#4ADE80" },
                    { value: "site_visit", label: "Site Visit", color: "#6366F1" },
                    { value: "email", label: "Email", color: "#3B82F6" },
                    { value: "whatsapp", label: "WhatsApp", color: "#25D366" },
                    { value: "sms", label: "SMS", color: "#D4A843" },
                    { value: "other", label: "Other", color: "#8A8B8C" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setActionType(opt.value as any)}
                      className="py-2 rounded-lg text-xs font-body font-medium cursor-pointer"
                      style={{
                        backgroundColor: actionType === opt.value ? `${opt.color}20` : "#222324",
                        color: actionType === opt.value ? opt.color : "#8A8B8C",
                        border: actionType === opt.value ? `1px solid ${opt.color}40` : "1px solid transparent",
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="label-text block mb-1.5">Notes</label>
                <textarea
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  className="input-field"
                  rows={3}
                  placeholder="e.g. Discussed new product line, sent pricing, follow-up next week..."
                />
              </div>
              <button onClick={submitActionForm} className="btn-primary w-full justify-center">
                <CheckCircle className="w-4 h-4" /> Log Action
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
