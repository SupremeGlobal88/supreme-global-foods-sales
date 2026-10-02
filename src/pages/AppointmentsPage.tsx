import { useState, useMemo, useRef, useEffect } from "react";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { reloadFromStorage } from "@/lib/dataService";
import {
  Plus, X, MapPin, Clock, CheckCircle, Calendar,
  Navigation, User, Filter, ExternalLink, LogIn, LogOut,
  AlertTriangle, Phone, Briefcase, Search, ChevronDown, ChevronUp,
  Edit, Trash2, Bell, RotateCcw, XCircle, ClipboardList,
} from "lucide-react";

// ─── Appointment Type Options ───
const APPOINTMENT_TYPES = [
  { value: "site_visit", label: "Site Visit" },
  { value: "call", label: "Call the Customer" },
  { value: "whatsapp", label: "WhatsApp the Customer" },
  { value: "email", label: "Email the Customer" },
  { value: "other", label: "Other" },
];

// ─── Title Options for Existing Customers ───
const EXISTING_CUSTOMER_TITLES = [
  { value: "routine_checkin", label: "Routine Check-in / Visit" },
  { value: "sample_followup", label: "Sample Trails / Sample Follow-up" },
  { value: "payment_collection", label: "Payment Collections" },
  { value: "complaints", label: "Complaints or Issues" },
  { value: "collect_returned", label: "Collect Returned Stock" },
  { value: "confirm_next_order", label: "Confirm Next Order" },
  { value: "payment_terms", label: "Payment Terms" },
];

// ─── Title Options for New Customers ───
const NEW_CUSTOMER_TITLES = [
  { value: "first_site_visit", label: "First Site Visit Scheduled" },
  { value: "sample_trails", label: "Sample Trails Scheduled" },
];

// ─── Outcome Options for Existing Customers ───
const EXISTING_CUSTOMER_OUTCOMES = [
  { value: "placed_order", label: "The customer placed a new order" },
  { value: "pricing_too_high", label: "No order — our Pricing is too High" },
  { value: "no_stock", label: "Could not place order — we don't have stock" },
  { value: "not_available", label: "Customer was not available" },
  { value: "schedule_next", label: "Schedule next appointment" },
  { value: "other", label: "Other" },
];

// ─── Current Supplier Options ───
const CURRENT_SUPPLIERS = [
  { value: "EXIM", label: "EXIM" },
  { value: "Crown National", label: "Crown National" },
  { value: "Freddy Hirsch Group", label: "Freddy Hirsch Group" },
  { value: "Deli Spice", label: "Deli Spice" },
  { value: "Cooper Casings", label: "Cooper Casings" },
];

// ─── New Customer Action Items ───
const NEW_CUSTOMER_ACTIONS = [
  { value: "schedule_sample", label: "Schedule Sample Trails for Customer" },
  { value: "send_portfolio", label: "Send Business Portfolio and Compliance" },
  { value: "pricing_too_high", label: "Customer said our Pricing is too high" },
  { value: "dont_change", label: "Customer said he does not want to change supplier" },
  { value: "not_available", label: "Customer was not available" },
  { value: "reschedule", label: "Reschedule meeting with customer" },
  { value: "schedule_next", label: "Schedule next appointment" },
  { value: "other", label: "Other" },
];

type MapTarget = { customerId: number; address: string } | null;

export default function AppointmentsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  const isManager = user?.role === "sales_manager";
  const myRepName = user?.name || "";
  // Sales manager sees ALL reps' appointments/check-ins (view-only), like admin
  const canViewAll = isAdmin || isManager;
  // Edit/delete only own appointments (admins can manage all)
  const canManage = (repName: string) => isAdmin || repName === myRepName;
  const utils = trpc.useUtils();

  // ===================== STATE =====================

  // Tabs: visits (checkins), schedule (appointments), followups, geoAudit
  const [activeTab, setActiveTab] = useState<"visits" | "schedule" | "followups" | "geoAudit">("visits");

  // Geo Audit state
  const [geoAuditMonth, setGeoAuditMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [geoAuditFlagOnly, setGeoAuditFlagOnly] = useState(false);
  const [geoAuditRepFilter, setGeoAuditRepFilter] = useState<string>("all");

  // Schedule form
  const [showForm, setShowForm] = useState(false);
  const [scheduleMode, setScheduleMode] = useState<"existing" | "new">("existing");
  const [showEditForm, setShowEditForm] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<any>(null);
  const [showEditCheckinForm, setShowEditCheckinForm] = useState(false);
  const [editingCheckin, setEditingCheckin] = useState<any>(null);
  const [formData, setFormData] = useState({
    customerId: 0,
    title: "",
    notes: "",
    appointmentDate: new Date().toISOString().slice(0, 16),
    startTime: "09:00",
    location: "",
    appointmentType: "site_visit" as "site_visit" | "call" | "whatsapp" | "email" | "other",
    outcome: "",
    outcomeNotes: "",
    currentSupplier: "",
    newCustomerActions: [] as string[],
  });
  const [newCustomer, setNewCustomer] = useState({ name: "", contactPerson: "", phone: "", address: "", priceTier: "wholesale" as "corporate" | "bulk" | "wholesale" | "retail", paymentTerms: "cod" as "cod" | "7_days" | "14_days" | "30_days" });

  // Check-in flow
  const [showCheckinForm, setShowCheckinForm] = useState(false);
  const [checkinCustomerId, setCheckinCustomerId] = useState(0);
  const [checkinNotes, setCheckinNotes] = useState("");
  const [mapTarget, setMapTarget] = useState<MapTarget>(null);
  const [geoError, setGeoError] = useState("");
  const [checkinOutcome, setCheckinOutcome] = useState<"visit" | "order" | "sample">("visit");
  const [checkinAppointmentId, setCheckinAppointmentId] = useState<number | null>(null);
  const [checkinAppointmentType, setCheckinAppointmentType] = useState("site_visit");
  const [checkinTitle, setCheckinTitle] = useState("");

  // Customer type-ahead search state
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [editCustomerSearch, setEditCustomerSearch] = useState("");
  const [showEditCustomerDropdown, setShowEditCustomerDropdown] = useState(false);
  const customerDropdownRef = useRef<HTMLDivElement>(null);
  const editCustomerDropdownRef = useRef<HTMLDivElement>(null);

  // Click outside to close dropdowns
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(e.target as Node)) {
        setShowCustomerDropdown(false);
      }
      if (editCustomerDropdownRef.current && !editCustomerDropdownRef.current.contains(e.target as Node)) {
        setShowEditCustomerDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Check-out flow
  const [showCheckoutForm, setShowCheckoutForm] = useState(false);
  const [checkoutCheckinId, setCheckoutCheckinId] = useState(0);
  const [checkoutNotes, setCheckoutNotes] = useState("");
  const [checkoutOutcome, setCheckoutOutcome] = useState("");
  const [checkoutOutcomeNotes, setCheckoutOutcomeNotes] = useState("");
  const [checkoutCurrentSupplier, setCheckoutCurrentSupplier] = useState("");
  const [checkoutNewCustomerActions, setCheckoutNewCustomerActions] = useState<string[]>([]);
  const [checkoutCustomerType, setCheckoutCustomerType] = useState<"existing" | "new">("existing");

  const [filterRep, setFilterRep] = useState<string>("all");
  const [expandedVisit, setExpandedVisit] = useState<number | null>(null);
  const [expandedAppt, setExpandedAppt] = useState<number | null>(null);

  // Customer search for check-in
  const [checkinSearch, setCheckinSearch] = useState("");

  // Follow-up action logging
  const [showActionForm, setShowActionForm] = useState(false);
  const [actionCustomerId, setActionCustomerId] = useState(0);
  const [actionType, setActionType] = useState("site_visit");
  const [actionNotes, setActionNotes] = useState("");
  const [actionTitle, setActionTitle] = useState("");
  const [actionScheduleFollowUp, setActionScheduleFollowUp] = useState(false);
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
        // Auto-create the appointment for the new customer
        const payload: any = {
          customerId: res.id,
          title: formData.title,
          notes: formData.notes,
          appointmentDate: formData.appointmentDate,
          startTime: formData.startTime,
          location: formData.location,
          appointmentType: formData.appointmentType,
          salesRepName: myRepName,
        };
        if (formData.currentSupplier) payload.currentSupplier = formData.currentSupplier;
        if (formData.newCustomerActions.length > 0) payload.newCustomerActions = formData.newCustomerActions;
        // Auto-schedule the appointment
        createAppointment.mutate(payload);
      }
    },
  });

  const createAppointment = trpc.appointment.create.useMutation({
    onSuccess: async () => {
      reloadFromStorage();
      await utils.appointment.list.invalidate();
      await utils.appointment.getStats.invalidate();
      setShowForm(false);
      resetForm();
    },
  });

  const updateAppointment = trpc.appointment.update.useMutation({
    onSuccess: async () => {
      reloadFromStorage();
      await utils.appointment.list.invalidate();
      await utils.appointment.getStats.invalidate();
      setShowEditForm(false);
      setEditingAppointment(null);
      resetForm();
    },
  });

  // Cloud-first: dedicated mutation for marking reminder as sent
  const markReminderSent = trpc.appointment.update.useMutation({
    onSuccess: async () => {
      reloadFromStorage();
      await utils.appointment.list.invalidate();
    },
  });

  const deleteAppointment = trpc.appointment.delete.useMutation({
    onSuccess: async () => {
      reloadFromStorage();
      await utils.appointment.list.invalidate();
      await utils.appointment.getStats.invalidate();
    },
  });

  const updateCheckin = trpc.checkIn.update.useMutation({
    onSuccess: async () => {
      reloadFromStorage();
      await utils.checkIn.list.invalidate();
      await utils.checkIn.getStats.invalidate();
      setShowEditCheckinForm(false);
      setEditingCheckin(null);
    },
  });

  const deleteCheckin = trpc.checkIn.delete.useMutation({
    onSuccess: async () => {
      reloadFromStorage();
      await utils.checkIn.list.invalidate();
      await utils.checkIn.getStats.invalidate();
      setShowEditCheckinForm(false);
      setEditingCheckin(null);
    },
  });

  const createCheckin = trpc.checkIn.create.useMutation({
    onSuccess: async () => {
      reloadFromStorage();
      await utils.checkIn.list.invalidate();
      await utils.checkIn.getStats.invalidate();
      setMapTarget(null);
      setGeoError("");
      setShowCheckinForm(false);
      setCheckinCustomerId(0);
      setCheckinNotes("");
      setCheckinAppointmentId(null);
      setCheckinAppointmentType("site_visit");
      setCheckinTitle("");
    },
  });

  const checkoutMutation = trpc.checkIn.checkout.useMutation({
    onSuccess: async () => {
      reloadFromStorage();
      await utils.checkIn.list.invalidate();
      await utils.checkIn.getStats.invalidate();
      setShowCheckoutForm(false);
      setCheckoutCheckinId(0);
      setCheckoutNotes("");
      setCheckoutOutcome("");
      setCheckoutOutcomeNotes("");
      setCheckoutCurrentSupplier("");
      setCheckoutNewCustomerActions([]);
    },
  });

  const createFollowUpAction = trpc.followUpAction.create.useMutation({
    onSuccess: async () => {
      reloadFromStorage();
      await utils.followUpAction.list.invalidate();
      setShowActionForm(false);
      setActionCustomerId(0);
      setActionNotes("");
      setActionType("site_visit");
      setActionTitle("");
      setActionScheduleFollowUp(false);
    },
  });

  const updateAppointmentStatus = trpc.appointment.updateStatus.useMutation({
    onSuccess: async () => {
      reloadFromStorage();
      await utils.appointment.list.invalidate();
      await utils.appointment.getStats.invalidate();
    },
  });

  // ===================== HELPERS =====================

  function resetForm() {
    setFormData({
      customerId: 0,
      title: "",
      notes: "",
      appointmentDate: new Date().toISOString().slice(0, 10) + "T09:00",
      startTime: "09:00",
      location: "",
      appointmentType: "site_visit",
      outcome: "",
      outcomeNotes: "",
      currentSupplier: "",
      newCustomerActions: [],
    });
    setNewCustomer({ name: "", contactPerson: "", phone: "", address: "", priceTier: "wholesale", paymentTerms: "cod" });
    setCustomerSearch("");
    setEditCustomerSearch("");
  }

  function handleAddNewCustomerAndSchedule() {
    if (!newCustomer.name.trim()) { alert("Enter customer name"); return; }
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

  // Filter: admin/manager sees all, sales rep sees own
  const myAppointments = canViewAll
    ? (filterRep === "all" ? (appointments || []) : (appointments || []).filter((a: any) => a.salesRepName === filterRep))
    : (appointments || []).filter((a: any) => a.salesRepName === myRepName);

  const myCheckins = canViewAll
    ? (filterRep === "all" ? (checkins || []) : (checkins || []).filter((ci: any) => ci.salesRepName === filterRep))
    : (checkins || []).filter((ci: any) => ci.salesRepName === myRepName);

  const myFollowUps = canViewAll
    ? (filterRep === "all" ? (followUpCustomers || []) : (followUpCustomers || []).filter((c: any) => c.salesRepName === filterRep))
    : (followUpCustomers || []).filter((c: any) => c.salesRepName === myRepName);

  // ===================== APPOINTMENT ACTIONS =====================

  function cancelAppointment(apptId: number) {
    if (!confirm("Cancel this appointment?")) return;
    updateAppointmentStatus.mutate({ id: apptId, status: "cancelled" });
  }

  function rescheduleAppointment(appt: any) {
    setEditingAppointment(appt);
    setFormData({
      customerId: appt.customerId || 0,
      title: appt.title || "",
      notes: appt.notes || "",
      appointmentDate: appt.appointmentDate || new Date().toISOString().slice(0, 16),
      startTime: appt.appointmentDate ? appt.appointmentDate.slice(11, 16) : "09:00",
      location: appt.location || "",
      appointmentType: appt.appointmentType || "site_visit",
      outcome: appt.outcome || "",
      outcomeNotes: appt.outcomeNotes || "",
      currentSupplier: appt.currentSupplier || "",
      newCustomerActions: appt.newCustomerActions || [],
    });
    const cust = (customers || []).find((c: any) => c.id === appt.customerId);
    setEditCustomerSearch(cust?.name || "");
    setShowEditForm(true);
  }

  function openCheckinForAppointment(appt: any) {
    setCheckinAppointmentId(appt.id);
    setCheckinAppointmentType(appt.appointmentType || "site_visit");
    setCheckinTitle(appt.title || "");
    setCheckinCustomerId(appt.customerId || 0);
    setCheckinOutcome("visit");
    setShowCheckinForm(true);
  }

  // ===================== 30-MINUTE REMINDER EFFECT =====================
  useEffect(() => {
    if (!myRepName) return;
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
    const interval = setInterval(() => {
      const now = new Date().getTime();
      const upcomingAppointments = (appointments || [])
        .filter((a: any) => a.status === "scheduled" && a.salesRepName === myRepName && !a.reminderSent);
      upcomingAppointments.forEach((appt: any) => {
        const apptTime = new Date(appt.appointmentDate).getTime();
        const diffMs = apptTime - now;
        const diffMins = Math.round(diffMs / 60000);
        if (diffMins <= 30 && diffMins > 0) {
          const custName = appt.customer?.name || "Customer";
          const apptType = APPOINTMENT_TYPES.find((t) => t.value === appt.appointmentType)?.label || appt.appointmentType || "Appointment";
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification("Appointment Reminder", {
              body: `${apptType} with ${custName} in ${diffMins} minute${diffMins !== 1 ? "s" : ""}`,
              icon: "/favicon.ico",
            });
          }
          // Cloud-first: mark reminder as sent through the proper mutation pipeline
          markReminderSent.mutate({ id: appt.id, data: { reminderSent: true } });
        }
      });
    }, 60000);
    return () => clearInterval(interval);
  }, [myRepName, appointments, markReminderSent]);

  // ===================== CHECK-IN HANDLERS =====================

  function getGeoAndCheckIn(customerId: number) {
    setGeoError("");
    if (!navigator.geolocation) {
      setGeoError("Geolocation not supported");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const customer = (customers || []).find((c: any) => c.id === customerId);
        const linkedAppt = checkinAppointmentId
          ? (appointments || []).find((a: any) => a.id === checkinAppointmentId)
          : null;
        createCheckin.mutate({
          customerId,
          notes: checkinNotes || checkinTitle || "",
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          location: customer?.physicalAddress || customer?.address || "",
          salesRepName: myRepName,
          outcome: checkinOutcome,
          appointmentId: checkinAppointmentId,
          appointmentType: linkedAppt?.appointmentType || checkinAppointmentType,
          title: linkedAppt?.title || checkinTitle || "",
        });
      },
      (err) => {
        setGeoError(`Location error: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  // ===================== CHECK-OUT HANDLERS =====================

  function submitCheckout() {
    if (!checkoutOutcome) { alert("Select an outcome"); return; }
    checkoutMutation.mutate({
      id: checkoutCheckinId,
      notes: checkoutNotes,
      outcome: checkoutOutcome,
      outcomeNotes: checkoutOutcomeNotes,
      currentSupplier: checkoutCurrentSupplier,
      newCustomerActions: checkoutNewCustomerActions,
      customerType: checkoutCustomerType,
    });
  }

  // ===================== FOLLOW-UP ACTION HANDLERS =====================

  function submitActionForm() {
    if (!actionNotes.trim()) { alert("Enter action notes"); return; }
    createFollowUpAction.mutate({
      customerId: actionCustomerId,
      actionType: actionType as any,
      notes: actionNotes,
      title: actionTitle,
      salesRepName: myRepName,
    });
  }

  // ===================== GEO AUDIT =====================

  const geoAuditData = useMemo(() => {
    const [year, month] = geoAuditMonth.split("-").map(Number);
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59);

    const monthCheckins = (checkins || []).filter((ci: any) => {
      const d = new Date(ci.checkInTime);
      return d >= startOfMonth && d <= endOfMonth;
    });

    const monthAppointments = (appointments || []).filter((a: any) => {
      const d = new Date(a.appointmentDate);
      return d >= startOfMonth && d <= endOfMonth;
    });

    const rows = (customers || [])
      .filter((c: any) => {
        if (geoAuditRepFilter !== "all" && c.salesRepName !== geoAuditRepFilter) return false;
        return true;
      })
      .map((c: any) => {
        const ci = monthCheckins
          .filter((x: any) => x.customerId === c.id)
          .sort((a: any, b: any) => new Date(b.checkInTime).getTime() - new Date(a.checkInTime).getTime())[0];
        const appt = monthAppointments
          .filter((a: any) => a.customerId === c.id && a.status === "scheduled")
          .sort((a: any, b: any) => new Date(a.appointmentDate).getTime() - new Date(b.appointmentDate).getTime())[0];

        let flag = "";
        if (!ci && !appt) flag = "No visit & no appointment";
        else if (!ci && appt) flag = "Has appointment, no visit yet";
        else if (ci && !appt) {
          const daysSince = Math.floor((Date.now() - new Date(ci.checkInTime).getTime()) / 86400000);
          flag = daysSince > 14 ? `No follow-up appt (${daysSince}d since last visit)` : "";
        }
        else if (ci && appt) {
          const apptDate = new Date(appt.appointmentDate).getTime();
          const ciDate = new Date(ci.checkInTime).getTime();
          if (apptDate < ciDate) flag = "Appointment before last visit — stale?";
        }

        return {
          customer: c,
          lastVisit: ci,
          nextAppt: appt,
          flag,
        };
      });

    return rows.filter((r: any) => !geoAuditFlagOnly || r.flag);
  }, [checkins, appointments, customers, geoAuditMonth, geoAuditFlagOnly, geoAuditRepFilter]);

  // ===================== RENDER =====================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <h1 className="font-display text-2xl font-bold text-white flex items-center gap-2">
          <Calendar className="w-6 h-6 text-[#D4A843]" />
          Appointments & Visits
        </h1>
        <div className="flex items-center gap-3">
          {canViewAll && (
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-[#8A8B8C]" />
              <select
                value={filterRep}
                onChange={(e) => setFilterRep(e.target.value)}
                className="input-field text-sm py-1.5"
              >
                <option value="all">All Reps</option>
                {(salesReps || []).map((r: any) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
          )}
          <button
            onClick={() => { setShowForm(true); setScheduleMode("existing"); resetForm(); }}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Schedule Appointment
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card-surface p-4" style={{ borderRadius: 12 }}>
          <div className="text-xs text-[#8A8B8C] font-body mb-1">Scheduled</div>
          <div className="text-2xl font-display font-bold text-white">{apptStats?.scheduled || 0}</div>
        </div>
        <div className="card-surface p-4" style={{ borderRadius: 12 }}>
          <div className="text-xs text-[#8A8B8C] font-body mb-1">Today</div>
          <div className="text-2xl font-display font-bold text-[#D4A843]">{apptStats?.today || 0}</div>
        </div>
        <div className="card-surface p-4" style={{ borderRadius: 12 }}>
          <div className="text-xs text-[#8A8B8C] font-body mb-1">This Week</div>
          <div className="text-2xl font-display font-bold text-white">{apptStats?.thisWeek || 0}</div>
        </div>
        <div className="card-surface p-4" style={{ borderRadius: 12 }}>
          <div className="text-xs text-[#8A8B8C] font-body mb-1">Active Visits</div>
          <div className="text-2xl font-display font-bold text-[#4ADE80]">{checkinStats?.active || 0}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-[#2A2A2C]">
        {[
          { key: "visits", label: "Visits", icon: LogIn },
          { key: "schedule", label: "Schedule", icon: Calendar },
          { key: "followups", label: "Follow-ups", icon: Phone },
          { key: "geoAudit", label: "Geo Audit", icon: MapPin },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-body font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? "border-[#D4A843] text-[#D4A843]"
                : "border-transparent text-[#8A8B8C] hover:text-white"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ─── VISITS TAB ─── */}
      {activeTab === "visits" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-semibold text-white text-lg flex items-center gap-2">
              <LogIn className="w-5 h-5 text-[#D4A843]" />
              Active & Past Visits
            </h2>
            <button
              onClick={() => { setShowCheckinForm(true); setCheckinCustomerId(0); setCheckinNotes(""); setCheckinAppointmentId(null); setCheckinAppointmentType("site_visit"); setCheckinTitle(""); setCheckinOutcome("visit"); }}
              className="btn-primary flex items-center gap-2"
            >
              <LogIn className="w-4 h-4" /> Check In
            </button>
          </div>

          {myCheckins.length === 0 && (
            <div className="card-surface p-8 text-center" style={{ borderRadius: 12 }}>
              <LogIn className="w-10 h-10 text-[#8A8B8C] mx-auto mb-3" />
              <p className="text-[#8A8B8C] font-body">No visits yet</p>
            </div>
          )}

          {myCheckins.map((ci: any) => {
            const isActive = !ci.checkOutTime;
            const customer = (customers || []).find((c: any) => c.id === ci.customerId);
            const appt = ci.appointmentId ? (appointments || []).find((a: any) => a.id === ci.appointmentId) : null;
            return (
              <div key={ci.id} className="card-surface p-4" style={{ borderRadius: 12 }}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded text-xs font-body font-medium ${
                        isActive ? "bg-[#4ADE8020] text-[#4ADE80]" : "bg-[#8A8B8C20] text-[#8A8B8C]"
                      }`}>
                        {isActive ? "Active" : "Completed"}
                      </span>
                      {appt && (
                        <span className="px-2 py-0.5 rounded text-xs font-body bg-[#D4A84320] text-[#D4A843]">
                          {APPOINTMENT_TYPES.find((t) => t.value === appt.appointmentType)?.label || appt.appointmentType}
                        </span>
                      )}
                      {ci.title && (
                        <span className="text-xs text-[#8A8B8C] font-body">{ci.title}</span>
                      )}
                    </div>
                    <div className="font-body font-medium text-white">{customer?.name || ci.location || "Unknown"}</div>
                    <div className="text-xs text-[#8A8B8C] font-body mt-1">
                      {ci.salesRepName && <span className="mr-3">Rep: {ci.salesRepName}</span>}
                      <span>In: {new Date(ci.checkInTime).toLocaleString()}</span>
                    </div>
                    {ci.checkOutTime && (
                      <div className="text-xs text-[#8A8B8C] font-body mt-1">
                        <span>Out: {new Date(ci.checkOutTime).toLocaleString()}</span>
                        {ci.duration && <span className="ml-3">Duration: {Math.round(ci.duration / 60)} min</span>}
                      </div>
                    )}
                    {ci.notes && (
                      <div className="mt-2 text-sm text-[#E8E8E9] font-body bg-[#0A0A0B] p-2 rounded">
                        {ci.notes}
                      </div>
                    )}
                    {ci.outcome && (
                      <div className="mt-1 text-xs text-[#D4A843] font-body">
                        Outcome: {ci.outcome}
                      </div>
                    )}
                    {ci.outcomeNotes && (
                      <div className="mt-1 text-xs text-[#8A8B8C] font-body">
                        {ci.outcomeNotes}
                      </div>
                    )}
                    {ci.currentSupplier && (
                      <div className="mt-1 text-xs text-[#8A8B8C] font-body">
                        Current Supplier: {ci.currentSupplier}
                      </div>
                    )}
                    {ci.newCustomerActions && ci.newCustomerActions.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {ci.newCustomerActions.map((a: string, i: number) => (
                          <span key={i} className="px-2 py-0.5 rounded text-xs font-body bg-[#6366F120] text-[#6366F1]">
                            {NEW_CUSTOMER_ACTIONS.find((x) => x.value === a)?.label || a}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    {isActive ? (
                      <button
                        onClick={() => { setShowCheckoutForm(true); setCheckoutCheckinId(ci.id); setCheckoutCustomerType(ci.customerType || "existing"); }}
                        className="btn-primary flex items-center gap-1 text-xs"
                      >
                        <LogOut className="w-3 h-3" /> Check Out
                      </button>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          onClick={() => { setEditingCheckin(ci); setShowEditCheckinForm(true); }}
                          className="p-2 rounded-lg hover:bg-[#2A2A2C] transition-colors"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4 text-[#8A8B8C]" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── SCHEDULE TAB ─── */}
      {activeTab === "schedule" && (
        <div className="space-y-4">
          <h2 className="font-display font-semibold text-white text-lg flex items-center gap-2">
            <Calendar className="w-5 h-5 text-[#D4A843]" />
            Scheduled Appointments
          </h2>

          {myAppointments.length === 0 && (
            <div className="card-surface p-8 text-center" style={{ borderRadius: 12 }}>
              <Calendar className="w-10 h-10 text-[#8A8B8C] mx-auto mb-3" />
              <p className="text-[#8A8B8C] font-body">No appointments scheduled</p>
            </div>
          )}

          {myAppointments.map((appt: any) => {
            const customer = (customers || []).find((c: any) => c.id === appt.customerId);
            const isExpanded = expandedAppt === appt.id;
            const canEdit = canManage(appt.salesRepName);
            const apptDate = new Date(appt.appointmentDate);
            const isPast = apptDate < new Date();
            const isToday = apptDate.toDateString() === new Date().toDateString();

            return (
              <div key={appt.id} className="card-surface p-4" style={{ borderRadius: 12 }}>
                <div className="flex items-start justify-between">
                  <div className="flex-1 cursor-pointer" onClick={() => setExpandedAppt(isExpanded ? null : appt.id)}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded text-xs font-body font-medium ${
                        appt.status === "cancelled" ? "bg-[#EF444420] text-[#EF4444]" :
                        appt.status === "completed" ? "bg-[#4ADE8020] text-[#4ADE80]" :
                        appt.status === "in_progress" ? "bg-[#6366F120] text-[#6366F1]" :
                        isPast ? "bg-[#8A8B8C20] text-[#8A8B8C]" :
                        isToday ? "bg-[#D4A84320] text-[#D4A843]" :
                        "bg-[#3B82F620] text-[#3B82F6]"
                      }`}>
                        {appt.status === "cancelled" ? "Cancelled" :
                         appt.status === "completed" ? "Completed" :
                         appt.status === "in_progress" ? "In Progress" :
                         isPast ? "Past" :
                         isToday ? "Today" :
                         "Upcoming"}
                      </span>
                      <span className="px-2 py-0.5 rounded text-xs font-body bg-[#2A2A2C] text-[#8A8B8C]">
                        {APPOINTMENT_TYPES.find((t) => t.value === appt.appointmentType)?.label || appt.appointmentType}
                      </span>
                      {appt.reminderSent && (
                        <Bell className="w-3 h-3 text-[#D4A843]" title="Reminder sent" />
                      )}
                    </div>
                    <div className="font-body font-medium text-white">{appt.title || "Untitled"}</div>
                    <div className="text-sm text-[#E8E8E9] font-body">{customer?.name || "Unknown Customer"}</div>
                    <div className="text-xs text-[#8A8B8C] font-body mt-1">
                      <Clock className="w-3 h-3 inline mr-1" />
                      {apptDate.toLocaleString()}
                      {appt.location && <span className="ml-3"><MapPin className="w-3 h-3 inline mr-1" />{appt.location}</span>}
                    </div>
                    {appt.salesRepName && (
                      <div className="text-xs text-[#8A8B8C] font-body mt-1">
                        Rep: {appt.salesRepName}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {canEdit && appt.status === "scheduled" && !isPast && (
                      <>
                        <button
                          onClick={() => openCheckinForAppointment(appt)}
                          className="btn-primary flex items-center gap-1 text-xs"
                          title="Check In"
                        >
                          <LogIn className="w-3 h-3" /> Check In
                        </button>
                        <button
                          onClick={() => rescheduleAppointment(appt)}
                          className="p-2 rounded-lg hover:bg-[#2A2A2C] transition-colors"
                          title="Reschedule"
                        >
                          <RotateCcw className="w-4 h-4 text-[#8A8B8C]" />
                        </button>
                        <button
                          onClick={() => cancelAppointment(appt.id)}
                          className="p-2 rounded-lg hover:bg-[#2A2A2C] transition-colors"
                          title="Cancel"
                        >
                          <XCircle className="w-4 h-4 text-[#EF4444]" />
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => setExpandedAppt(isExpanded ? null : appt.id)}
                      className="p-2 rounded-lg hover:bg-[#2A2A2C] transition-colors"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-[#8A8B8C]" /> : <ChevronDown className="w-4 h-4 text-[#8A8B8C]" />}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-[#2A2A2C] space-y-3">
                    {appt.notes && (
                      <div>
                        <div className="text-xs text-[#8A8B8C] font-body mb-1">Notes</div>
                        <div className="text-sm text-[#E8E8E9] font-body bg-[#0A0A0B] p-3 rounded">{appt.notes}</div>
                      </div>
                    )}
                    {appt.outcome && (
                      <div>
                        <div className="text-xs text-[#8A8B8C] font-body mb-1">Outcome</div>
                        <div className="text-sm text-[#D4A843] font-body">{appt.outcome}</div>
                      </div>
                    )}
                    {appt.outcomeNotes && (
                      <div>
                        <div className="text-xs text-[#8A8B8C] font-body mb-1">Outcome Notes</div>
                        <div className="text-sm text-[#E8E8E9] font-body">{appt.outcomeNotes}</div>
                      </div>
                    )}
                    {appt.currentSupplier && (
                      <div>
                        <div className="text-xs text-[#8A8B8C] font-body mb-1">Current Supplier</div>
                        <div className="text-sm text-[#E8E8E9] font-body">{appt.currentSupplier}</div>
                      </div>
                    )}
                    {appt.newCustomerActions && appt.newCustomerActions.length > 0 && (
                      <div>
                        <div className="text-xs text-[#8A8B8C] font-body mb-1">Actions</div>
                        <div className="flex flex-wrap gap-2">
                          {appt.newCustomerActions.map((a: string, i: number) => (
                            <span key={i} className="px-2 py-1 rounded text-xs font-body bg-[#6366F120] text-[#6366F1]">
                              {NEW_CUSTOMER_ACTIONS.find((x) => x.value === a)?.label || a}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {customer && (
                      <div className="flex gap-2">
                        {customer.phone && (
                          <a href={`tel:${customer.phone}`} className="btn-secondary flex items-center gap-1 text-xs">
                            <Phone className="w-3 h-3" /> Call
                          </a>
                        )}
                        {customer.physicalAddress && (
                          <a
                            href={`https://maps.google.com/?q=${encodeURIComponent(customer.physicalAddress)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-secondary flex items-center gap-1 text-xs"
                          >
                            <Navigation className="w-3 h-3" /> Directions
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ─── FOLLOW-UPS TAB ─── */}
      {activeTab === "followups" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-semibold text-white text-lg flex items-center gap-2">
              <Phone className="w-5 h-5 text-[#D4A843]" />
              Customers Needing Follow-up
            </h2>
            <button
              onClick={() => { setShowActionForm(true); setActionCustomerId(0); setActionNotes(""); setActionType("site_visit"); setActionTitle(""); setActionScheduleFollowUp(false); }}
              className="btn-primary flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Log Action
            </button>
          </div>

          {myFollowUps.length === 0 && (
            <div className="card-surface p-8 text-center" style={{ borderRadius: 12 }}>
              <CheckCircle className="w-10 h-10 text-[#4ADE80] mx-auto mb-3" />
              <p className="text-[#8A8B8C] font-body">All caught up! No follow-ups needed.</p>
            </div>
          )}

          {myFollowUps.map((customer: any) => {
            const actions = (followUpActions || []).filter((a: any) => a.customerId === customer.id).sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            const isExpanded = expandedCustomerActions === customer.id;
            const lastAction = actions[0];
            const daysSince = lastAction ? Math.floor((Date.now() - new Date(lastAction.createdAt).getTime()) / 86400000) : null;

            return (
              <div key={customer.id} className="card-surface p-4" style={{ borderRadius: 12 }}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="font-body font-medium text-white">{customer.name}</div>
                    <div className="text-sm text-[#E8E8E9] font-body">{customer.contactPerson || "No contact"}</div>
                    <div className="text-xs text-[#8A8B8C] font-body mt-1">
                      Rep: {customer.salesRepName || "Unassigned"}
                      {customer.phone && <span className="ml-3">{customer.phone}</span>}
                    </div>
                    {lastAction && (
                      <div className="mt-2 text-xs text-[#8A8B8C] font-body">
                        Last action: <span className="text-[#D4A843]">{lastAction.actionType}</span> ({daysSince}d ago)
                        {lastAction.notes && <span className="block mt-1 text-[#E8E8E9]">{lastAction.notes}</span>}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => { setActionCustomerId(customer.id); setShowActionForm(true); }}
                      className="btn-primary flex items-center gap-1 text-xs"
                    >
                      <ClipboardList className="w-3 h-3" /> Log Action
                    </button>
                    <button
                      onClick={() => setExpandedCustomerActions(isExpanded ? null : customer.id)}
                      className="text-xs text-[#8A8B8C] font-body hover:text-white transition-colors"
                    >
                      {isExpanded ? "Hide history" : `View history (${actions.length})`}
                    </button>
                  </div>
                </div>

                {isExpanded && actions.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-[#2A2A2C] space-y-2">
                    {actions.map((action: any) => (
                      <div key={action.id} className="text-xs font-body bg-[#0A0A0B] p-2 rounded">
                        <div className="flex items-center gap-2">
                          <span className="text-[#D4A843]">{action.actionType}</span>
                          <span className="text-[#8A8B8C]">{new Date(action.createdAt).toLocaleDateString()}</span>
                          {action.salesRepName && <span className="text-[#8A8B8C]">by {action.salesRepName}</span>}
                        </div>
                        {action.notes && <div className="text-[#E8E8E9] mt-1">{action.notes}</div>}
                        {action.title && <div className="text-[#8A8B8C] mt-1">{action.title}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ─── GEO AUDIT TAB ─── */}
      {activeTab === "geoAudit" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="font-display font-semibold text-white text-lg flex items-center gap-2">
              <MapPin className="w-5 h-5 text-[#D4A843]" />
              Geo Audit
            </h2>
            <div className="flex items-center gap-3">
              <input
                type="month"
                value={geoAuditMonth}
                onChange={(e) => setGeoAuditMonth(e.target.value)}
                className="input-field text-sm py-1.5"
              />
              {canViewAll && (
                <select
                  value={geoAuditRepFilter}
                  onChange={(e) => setGeoAuditRepFilter(e.target.value)}
                  className="input-field text-sm py-1.5"
                >
                  <option value="all">All Reps</option>
                  {(salesReps || []).map((r: any) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              )}
              <label className="flex items-center gap-2 text-sm text-[#E8E8E9] font-body cursor-pointer">
                <input
                  type="checkbox"
                  checked={geoAuditFlagOnly}
                  onChange={(e) => setGeoAuditFlagOnly(e.target.checked)}
                  className="w-4 h-4 accent-[#D4A843]"
                />
                Flagged only
              </label>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2A2A2C]">
                  <th className="text-left py-2 px-3 text-[#8A8B8C] font-body font-medium">Customer</th>
                  <th className="text-left py-2 px-3 text-[#8A8B8C] font-body font-medium">Rep</th>
                  <th className="text-left py-2 px-3 text-[#8A8B8C] font-body font-medium">Last Visit</th>
                  <th className="text-left py-2 px-3 text-[#8A8B8C] font-body font-medium">Next Appt</th>
                  <th className="text-left py-2 px-3 text-[#8A8B8C] font-body font-medium">Flag</th>
                </tr>
              </thead>
              <tbody>
                {geoAuditData.map((row: any) => (
                  <tr key={row.customer.id} className="border-b border-[#2A2A2C] hover:bg-[#1A1A1C]">
                    <td className="py-2 px-3 text-white font-body">{row.customer.name}</td>
                    <td className="py-2 px-3 text-[#8A8B8C] font-body">{row.customer.salesRepName || "-"}</td>
                    <td className="py-2 px-3 text-[#8A8B8C] font-body">
                      {row.lastVisit ? new Date(row.lastVisit.checkInTime).toLocaleDateString() : "-"}
                    </td>
                    <td className="py-2 px-3 text-[#8A8B8C] font-body">
                      {row.nextAppt ? new Date(row.nextAppt.appointmentDate).toLocaleDateString() : "-"}
                    </td>
                    <td className="py-2 px-3">
                      {row.flag ? (
                        <span className="flex items-center gap-1 text-xs text-[#EF4444] font-body">
                          <AlertTriangle className="w-3 h-3" /> {row.flag}
                        </span>
                      ) : (
                        <span className="text-xs text-[#4ADE80] font-body">OK</span>
                      )}
                    </td>
                  </tr>
                ))}
                {geoAuditData.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-[#8A8B8C] font-body">
                      No customers found for selected filters
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===================== SCHEDULE APPOINTMENT MODAL ===================== */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.7)" }}>
          <div className="card-surface p-6 max-w-lg w-full mx-4" style={{ borderRadius: 16, maxHeight: "90vh", overflowY: "auto" }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-semibold text-white text-lg flex items-center gap-2">
                <Plus className="w-5 h-5 text-[#D4A843]" />
                Schedule Appointment
              </h2>
              <button onClick={() => setShowForm(false)} className="cursor-pointer">
                <X className="w-5 h-5 text-[#8A8B8C]" />
              </button>
            </div>

            {/* Existing / New toggle */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setScheduleMode("existing")}
                className={`flex-1 py-2 rounded-lg text-sm font-body font-medium transition-colors ${
                  scheduleMode === "existing"
                    ? "bg-[#D4A843] text-[#0A0A0B]"
                    : "bg-[#2A2A2C] text-[#8A8B8C]"
                }`}
              >
                Existing Customer
              </button>
              <button
                onClick={() => setScheduleMode("new")}
                className={`flex-1 py-2 rounded-lg text-sm font-body font-medium transition-colors ${
                  scheduleMode === "new"
                    ? "bg-[#D4A843] text-[#0A0A0B]"
                    : "bg-[#2A2A2C] text-[#8A8B8C]"
                }`}
              >
                New Customer
              </button>
            </div>

            {scheduleMode === "existing" ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!formData.customerId) { alert("Select a customer"); return; }
                  if (!formData.title) { alert("Select a title"); return; }
                  const payload: any = {
                    customerId: formData.customerId,
                    title: formData.title,
                    notes: formData.notes,
                    appointmentDate: formData.appointmentDate,
                    startTime: formData.startTime,
                    location: formData.location,
                    appointmentType: formData.appointmentType,
                    salesRepName: myRepName,
                  };
                  if (formData.currentSupplier) payload.currentSupplier = formData.currentSupplier;
                  if (formData.newCustomerActions.length > 0) payload.newCustomerActions = formData.newCustomerActions;
                  createAppointment.mutate(payload);
                }}
                className="space-y-4"
              >
                {/* Customer type-ahead */}
                <div ref={customerDropdownRef} className="relative">
                  <label className="label-text block mb-1.5">Customer *</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={customerSearch}
                      onChange={(e) => { setCustomerSearch(e.target.value); setShowCustomerDropdown(true); }}
                      onFocus={() => setShowCustomerDropdown(true)}
                      placeholder="Type to search customer..."
                      className="input-field w-full pr-10"
                      required={formData.customerId === 0}
                    />
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8B8C]" />
                  </div>
                  {showCustomerDropdown && (
                    <div className="absolute z-50 w-full mt-1 max-h-60 overflow-y-auto rounded-lg border border-[#2A2A2C] bg-[#1A1A1C] shadow-xl">
                      {(customers || [])
                        .filter((c: any) => !customerSearch || c.name?.toLowerCase().includes(customerSearch.toLowerCase()) || c.contactPerson?.toLowerCase().includes(customerSearch.toLowerCase()))
                        .sort((a: any, b: any) => a.name?.localeCompare(b.name || "") || 0)
                        .map((c: any) => (
                          <div
                            key={c.id}
                            onClick={() => { setFormData({ ...formData, customerId: c.id }); setCustomerSearch(c.name); setShowCustomerDropdown(false); }}
                            className="px-4 py-2.5 cursor-pointer hover:bg-[#2A2A2C] transition-colors flex items-center justify-between"
                          >
                            <div>
                              <div className="text-sm font-body text-[#E8E8E9]">{c.name}</div>
                              {c.contactPerson && <div className="text-xs text-[#8A8B8C]">{c.contactPerson}</div>}
                            </div>
                            {formData.customerId === c.id && <CheckCircle className="w-4 h-4 text-[#D4A843]" />}
                          </div>
                        ))}
                      {(customers || []).filter((c: any) => !customerSearch || c.name?.toLowerCase().includes(customerSearch.toLowerCase())).length === 0 && (
                        <div className="px-4 py-3 text-sm text-[#8A8B8C]">No customers found</div>
                      )}
                    </div>
                  )}
                </div>

                {/* Appointment Type */}
                <div>
                  <label className="label-text block mb-1.5">Appointment Type *</label>
                  <select
                    value={formData.appointmentType}
                    onChange={(e) => setFormData({ ...formData, appointmentType: e.target.value as any })}
                    className="input-field w-full"
                    required
                  >
                    {APPOINTMENT_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>

                {/* Title */}
                <div>
                  <label className="label-text block mb-1.5">Title *</label>
                  <select
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="input-field w-full"
                    required
                  >
                    <option value="">Select title...</option>
                    {EXISTING_CUSTOMER_TITLES.map((t) => (
                      <option key={t.value} value={t.label}>{t.label}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label-text block mb-1.5">Date *</label>
                    <input
                      type="date"
                      value={formData.appointmentDate.slice(0, 10)}
                      onChange={(e) => setFormData({ ...formData, appointmentDate: e.target.value + "T" + formData.startTime })}
                      className="input-field"
                      required
                    />
                  </div>
                  <div>
                    <label className="label-text block mb-1.5">Time *</label>
                    <input
                      type="time"
                      value={formData.startTime}
                      onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                      className="input-field"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="label-text block mb-1.5">Location</label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="input-field"
                    placeholder="e.g. Customer office address"
                  />
                </div>
                <div>
                  <label className="label-text block mb-1.5">Notes</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="input-field"
                    rows={3}
                    placeholder="Any additional details..."
                  />
                </div>
                <button type="submit" className="btn-primary w-full justify-center" disabled={createAppointment.isPending}>
                  {createAppointment.isPending ? "Scheduling..." : "Schedule Appointment"}
                </button>
              </form>
            ) : (
              /* New Customer Form */
              <div className="space-y-4">
                <div>
                  <label className="label-text block mb-1.5">Business Name *</label>
                  <input
                    type="text"
                    value={newCustomer.name}
                    onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                    className="input-field"
                    placeholder="Customer business name"
                    required
                  />
                </div>
                <div>
                  <label className="label-text block mb-1.5">Contact Person</label>
                  <input
                    type="text"
                    value={newCustomer.contactPerson}
                    onChange={(e) => setNewCustomer({ ...newCustomer, contactPerson: e.target.value })}
                    className="input-field"
                    placeholder="Primary contact name"
                  />
                </div>
                <div>
                  <label className="label-text block mb-1.5">Phone</label>
                  <input
                    type="tel"
                    value={newCustomer.phone}
                    onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                    className="input-field"
                    placeholder="Contact phone number"
                  />
                </div>
                <div>
                  <label className="label-text block mb-1.5">Address</label>
                  <input
                    type="text"
                    value={newCustomer.address}
                    onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
                    className="input-field"
                    placeholder="Physical address"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label-text block mb-1.5">Price Tier</label>
                    <select
                      value={newCustomer.priceTier}
                      onChange={(e) => setNewCustomer({ ...newCustomer, priceTier: e.target.value as any })}
                      className="input-field w-full"
                    >
                      <option value="wholesale">Wholesale</option>
                      <option value="bulk">Bulk</option>
                      <option value="corporate">Corporate</option>
                      <option value="retail">Retail</option>
                    </select>
                  </div>
                  <div>
                    <label className="label-text block mb-1.5">Payment Terms</label>
                    <select
                      value={newCustomer.paymentTerms}
                      onChange={(e) => setNewCustomer({ ...newCustomer, paymentTerms: e.target.value as any })}
                      className="input-field w-full"
                    >
                      <option value="cod">COD</option>
                      <option value="7_days">7 Days</option>
                      <option value="14_days">14 Days</option>
                      <option value="30_days">30 Days</option>
                    </select>
                  </div>
                </div>

                {/* New customer appointment details */}
                <div>
                  <label className="label-text block mb-1.5">Appointment Type *</label>
                  <select
                    value={formData.appointmentType}
                    onChange={(e) => setFormData({ ...formData, appointmentType: e.target.value as any })}
                    className="input-field w-full"
                  >
                    {APPOINTMENT_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label-text block mb-1.5">Title *</label>
                  <select
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="input-field w-full"
                  >
                    <option value="">Select title...</option>
                    {NEW_CUSTOMER_TITLES.map((t) => (
                      <option key={t.value} value={t.label}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label-text block mb-1.5">Date *</label>
                    <input
                      type="date"
                      value={formData.appointmentDate.slice(0, 10)}
                      onChange={(e) => setFormData({ ...formData, appointmentDate: e.target.value + "T" + formData.startTime })}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="label-text block mb-1.5">Time *</label>
                    <input
                      type="time"
                      value={formData.startTime}
                      onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                      className="input-field"
                    />
                  </div>
                </div>
                <div>
                  <label className="label-text block mb-1.5">Location</label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="input-field"
                    placeholder="e.g. Customer office"
                  />
                </div>
                <div>
                  <label className="label-text block mb-1.5">Notes</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="input-field"
                    rows={3}
                    placeholder="Any additional details..."
                  />
                </div>
                <button onClick={handleAddNewCustomerAndSchedule} className="btn-primary w-full justify-center">
                  <Plus className="w-4 h-4" /> Create Customer & Schedule
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================== CHECK-IN MODAL ===================== */}
      {showCheckinForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.7)" }}>
          <div className="card-surface p-6 max-w-lg w-full mx-4" style={{ borderRadius: 16 }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-semibold text-white text-lg flex items-center gap-2">
                <LogIn className="w-5 h-5 text-[#D4A843]" />
                Check In
              </h2>
              <button onClick={() => setShowCheckinForm(false)} className="cursor-pointer">
                <X className="w-5 h-5 text-[#8A8B8C]" />
              </button>
            </div>

            {/* Customer search */}
            <div className="mb-4">
              <label className="label-text block mb-1.5">Customer *</label>
              <div className="relative">
                <input
                  type="text"
                  value={checkinSearch}
                  onChange={(e) => setCheckinSearch(e.target.value)}
                  placeholder="Type to search customer..."
                  className="input-field w-full pr-10"
                />
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8B8C]" />
              </div>
              <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-[#2A2A2C] bg-[#1A1A1C]">
                {(customers || [])
                  .filter((c: any) => !checkinSearch || c.name?.toLowerCase().includes(checkinSearch.toLowerCase()) || c.contactPerson?.toLowerCase().includes(checkinSearch.toLowerCase()))
                  .sort((a: any, b: any) => a.name?.localeCompare(b.name || "") || 0)
                  .map((c: any) => (
                    <div
                      key={c.id}
                      onClick={() => { setCheckinCustomerId(c.id); setCheckinSearch(c.name); }}
                      className={`px-4 py-2.5 cursor-pointer hover:bg-[#2A2A2C] transition-colors flex items-center justify-between ${
                        checkinCustomerId === c.id ? "bg-[#D4A84320]" : ""
                      }`}
                    >
                      <div>
                        <div className="text-sm font-body text-[#E8E8E9]">{c.name}</div>
                        {c.contactPerson && <div className="text-xs text-[#8A8B8C]">{c.contactPerson}</div>}
                      </div>
                      {checkinCustomerId === c.id && <CheckCircle className="w-4 h-4 text-[#D4A843]" />}
                    </div>
                  ))}
                {(customers || []).filter((c: any) => !checkinSearch || c.name?.toLowerCase().includes(checkinSearch.toLowerCase())).length === 0 && (
                  <div className="px-4 py-3 text-sm text-[#8A8B8C]">No customers found</div>
                )}
              </div>
            </div>

            {/* Outcome */}
            <div className="mb-4">
              <label className="label-text block mb-1.5">Visit Type</label>
              <div className="flex gap-2">
                {(["visit", "order", "sample"] as const).map((o) => (
                  <button
                    key={o}
                    type="button"
                    onClick={() => setCheckinOutcome(o)}
                    className="flex-1 py-2 rounded-lg text-xs font-body font-medium capitalize cursor-pointer"
                    style={{ backgroundColor: checkinOutcome === o ? "#D4A843" : "#222324", color: checkinOutcome === o ? "#0A0A0B" : "#8A8B8C" }}
                  >
                    {o}
                  </button>
                ))}
              </div>
            </div>

            {/* Linked appointment info */}
            {checkinAppointmentId && (
              <div className="mb-4 p-3 rounded-lg bg-[#D4A84310] border border-[#D4A84330]">
                <div className="text-xs text-[#D4A843] font-body mb-1">Linked Appointment</div>
                <div className="text-sm text-white font-body">{checkinTitle || "Appointment"}</div>
                <div className="text-xs text-[#8A8B8C] font-body">
                  {APPOINTMENT_TYPES.find((t) => t.value === checkinAppointmentType)?.label || checkinAppointmentType}
                </div>
              </div>
            )}

            <div className="mb-4">
              <label className="label-text block mb-1.5">Notes</label>
              <textarea
                value={checkinNotes}
                onChange={(e) => setCheckinNotes(e.target.value)}
                className="input-field"
                rows={3}
                placeholder="Check-in notes..."
              />
            </div>

            {geoError && (
              <div className="mb-4 p-3 rounded-lg bg-[#EF444410] border border-[#EF444430] text-sm text-[#EF4444] font-body">
                {geoError}
              </div>
            )}

            <button
              onClick={() => getGeoAndCheckIn(checkinCustomerId)}
              className="btn-primary w-full justify-center"
              disabled={!checkinCustomerId || createCheckin.isPending}
            >
              {createCheckin.isPending ? "Checking in..." : "Check In with Location"}
            </button>
          </div>
        </div>
      )}

      {/* ===================== CHECK-OUT MODAL ===================== */}
      {showCheckoutForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.7)" }}>
          <div className="card-surface p-6 max-w-lg w-full mx-4" style={{ borderRadius: 16, maxHeight: "90vh", overflowY: "auto" }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-semibold text-white text-lg flex items-center gap-2">
                <LogOut className="w-5 h-5 text-[#D4A843]" />
                Check Out
              </h2>
              <button onClick={() => setShowCheckoutForm(false)} className="cursor-pointer">
                <X className="w-5 h-5 text-[#8A8B8C]" />
              </button>
            </div>

            {/* Customer Type Toggle */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setCheckoutCustomerType("existing")}
                className={`flex-1 py-2 rounded-lg text-sm font-body font-medium transition-colors ${
                  checkoutCustomerType === "existing"
                    ? "bg-[#D4A843] text-[#0A0A0B]"
                    : "bg-[#2A2A2C] text-[#8A8B8C]"
                }`}
              >
                Existing Customer
              </button>
              <button
                onClick={() => setCheckoutCustomerType("new")}
                className={`flex-1 py-2 rounded-lg text-sm font-body font-medium transition-colors ${
                  checkoutCustomerType === "new"
                    ? "bg-[#D4A843] text-[#0A0A0B]"
                    : "bg-[#2A2A2C] text-[#8A8B8C]"
                }`}
              >
                New Customer
              </button>
            </div>

            {checkoutCustomerType === "existing" ? (
              <div className="space-y-4">
                <div>
                  <label className="label-text block mb-1.5">Outcome *</label>
                  <select
                    value={checkoutOutcome}
                    onChange={(e) => setCheckoutOutcome(e.target.value)}
                    className="input-field w-full"
                    required
                  >
                    <option value="">Select outcome...</option>
                    {EXISTING_CUSTOMER_OUTCOMES.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label-text block mb-1.5">Outcome Notes</label>
                  <textarea
                    value={checkoutOutcomeNotes}
                    onChange={(e) => setCheckoutOutcomeNotes(e.target.value)}
                    className="input-field"
                    rows={3}
                    placeholder="Additional details about the outcome..."
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="label-text block mb-1.5">Current Supplier</label>
                  <select
                    value={checkoutCurrentSupplier}
                    onChange={(e) => setCheckoutCurrentSupplier(e.target.value)}
                    className="input-field w-full"
                  >
                    <option value="">Select supplier...</option>
                    {CURRENT_SUPPLIERS.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label-text block mb-1.5">Actions</label>
                  <div className="space-y-2">
                    {NEW_CUSTOMER_ACTIONS.map((a) => (
                      <label key={a.value} className="flex items-center gap-2 text-sm text-[#E8E8E9] font-body cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checkoutNewCustomerActions.includes(a.value)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setCheckoutNewCustomerActions([...checkoutNewCustomerActions, a.value]);
                            } else {
                              setCheckoutNewCustomerActions(checkoutNewCustomerActions.filter((x) => x !== a.value));
                            }
                          }}
                          className="w-4 h-4 accent-[#D4A843]"
                        />
                        {a.label}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="mt-4">
              <label className="label-text block mb-1.5">Notes</label>
              <textarea
                value={checkoutNotes}
                onChange={(e) => setCheckoutNotes(e.target.value)}
                className="input-field"
                rows={3}
                placeholder="General notes..."
              />
            </div>

            <button
              onClick={submitCheckout}
              className="btn-primary w-full justify-center mt-4"
              disabled={checkoutMutation.isPending}
            >
              {checkoutMutation.isPending ? "Checking out..." : "Complete Check-out"}
            </button>
          </div>
        </div>
      )}

      {/* ===================== EDIT APPOINTMENT MODAL ===================== */}
      {showEditForm && editingAppointment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.7)" }}>
          <div className="card-surface p-6 max-w-lg w-full mx-4" style={{ borderRadius: 16, maxHeight: "90vh", overflowY: "auto" }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-semibold text-white text-lg flex items-center gap-2">
                <Edit className="w-5 h-5 text-[#D4A843]" />
                {editingAppointment.status === "rescheduled" ? "Reschedule" : "Edit"} Appointment
              </h2>
              <button onClick={() => { setShowEditForm(false); setEditingAppointment(null); }} className="cursor-pointer">
                <X className="w-5 h-5 text-[#8A8B8C]" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
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
                    appointmentType: formData.appointmentType,
                    outcome: formData.outcome,
                    outcomeNotes: formData.outcomeNotes,
                    currentSupplier: formData.currentSupplier,
                    newCustomerActions: formData.newCustomerActions,
                    status: editingAppointment.status === "cancelled" ? "scheduled" : editingAppointment.status === "rescheduled" ? "scheduled" : editingAppointment.status,
                  },
                });
              }}
              className="space-y-4"
            >
              <div ref={editCustomerDropdownRef} className="relative">
                <label className="label-text block mb-1.5">Customer</label>
                <div className="relative">
                  <input
                    type="text"
                    value={editCustomerSearch}
                    onChange={(e) => { setEditCustomerSearch(e.target.value); setShowEditCustomerDropdown(true); }}
                    onFocus={() => setShowEditCustomerDropdown(true)}
                    placeholder={formData.customerId > 0 ? (customers || []).find((c: any) => c.id === formData.customerId)?.name || "Search customer..." : "Type to search customer..."}
                    className="input-field w-full pr-10"
                    required={formData.customerId === 0}
                  />
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8B8C]" />
                </div>
                {showEditCustomerDropdown && (
                  <div className="absolute z-50 w-full mt-1 max-h-60 overflow-y-auto rounded-lg border border-[#2A2A2C] bg-[#1A1A1C] shadow-xl">
                    {(customers || [])
                      .filter((c: any) => !editCustomerSearch || c.name?.toLowerCase().includes(editCustomerSearch.toLowerCase()) || c.contactPerson?.toLowerCase().includes(editCustomerSearch.toLowerCase()))
                      .sort((a: any, b: any) => a.name?.localeCompare(b.name || "") || 0)
                      .map((c: any) => (
                        <div
                          key={c.id}
                          onClick={() => { setFormData({ ...formData, customerId: c.id }); setEditCustomerSearch(c.name); setShowEditCustomerDropdown(false); }}
                          className="px-4 py-2.5 cursor-pointer hover:bg-[#2A2A2C] transition-colors flex items-center justify-between"
                        >
                          <div>
                            <div className="text-sm font-body text-[#E8E8E9]">{c.name}</div>
                            {c.contactPerson && <div className="text-xs text-[#8A8B8C]">{c.contactPerson}</div>}
                          </div>
                          {formData.customerId === c.id && <CheckCircle className="w-4 h-4 text-[#D4A843]" />}
                        </div>
                      ))}
                    {(customers || []).filter((c: any) => !editCustomerSearch || c.name?.toLowerCase().includes(editCustomerSearch.toLowerCase())).length === 0 && (
                      <div className="px-4 py-3 text-sm text-[#8A8B8C]">No customers found</div>
                    )}
                  </div>
                )}
              </div>

              {/* Appointment Type */}
              <div>
                <label className="label-text block mb-1.5">Appointment Type *</label>
                <select
                  value={formData.appointmentType}
                  onChange={(e) => setFormData({ ...formData, appointmentType: e.target.value as any })}
                  className="input-field w-full"
                  required
                >
                  {APPOINTMENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              {/* Title */}
              <div>
                <label className="label-text block mb-1.5">Title *</label>
                <select
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="input-field w-full"
                  required
                >
                  <option value="">Select title...</option>
                  {EXISTING_CUSTOMER_TITLES.map((t) => (
                    <option key={t.value} value={t.label}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label-text block mb-1.5">Date *</label>
                  <input
                    type="date"
                    value={formData.appointmentDate.slice(0, 10)}
                    onChange={(e) => setFormData({ ...formData, appointmentDate: e.target.value + "T" + formData.startTime })}
                    className="input-field"
                    required
                  />
                </div>
                <div>
                  <label className="label-text block mb-1.5">Time *</label>
                  <input
                    type="time"
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    className="input-field"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="label-text block mb-1.5">Location</label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="input-field"
                  placeholder="e.g. Customer office address"
                />
              </div>
              <div>
                <label className="label-text block mb-1.5">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="input-field"
                  rows={3}
                  placeholder="Any additional details..."
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { if (confirm("Delete this appointment?")) { deleteAppointment.mutate(editingAppointment.id); setShowEditForm(false); setEditingAppointment(null); } }}
                  className="btn-secondary flex items-center gap-2"
                  style={{ color: "#EF4444", borderColor: "#EF4444" }}
                >
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
                <button type="submit" className="btn-primary flex-1 justify-center" disabled={updateAppointment.isPending}>
                  {updateAppointment.isPending ? "Saving..." : (editingAppointment.status === "rescheduled" ? "Reschedule" : "Save Changes")}
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
              <h2 className="font-display font-semibold text-white text-lg flex items-center gap-2">
                <Edit className="w-5 h-5 text-[#D4A843]" />
                Edit Check-in
              </h2>
              <button onClick={() => { setShowEditCheckinForm(false); setEditingCheckin(null); }} className="cursor-pointer">
                <X className="w-5 h-5 text-[#8A8B8C]" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
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
              }}
              className="space-y-4"
            >
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
              <div>
                <label className="label-text block mb-1.5">Location</label>
                <input
                  type="text"
                  value={editingCheckin.location || ""}
                  onChange={(e) => setEditingCheckin({ ...editingCheckin, location: e.target.value })}
                  className="input-field"
                  placeholder="e.g. Customer address"
                />
              </div>
              <div>
                <label className="label-text block mb-1.5">Notes</label>
                <textarea
                  value={editingCheckin.notes || ""}
                  onChange={(e) => setEditingCheckin({ ...editingCheckin, notes: e.target.value })}
                  className="input-field"
                  rows={3}
                  placeholder="Check-in notes..."
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { if (confirm("Delete this check-in?")) { deleteCheckin.mutate(editingCheckin.id); setShowEditCheckinForm(false); setEditingCheckin(null); } }}
                  className="btn-secondary flex items-center gap-2"
                  style={{ color: "#EF4444", borderColor: "#EF4444" }}
                >
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
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
              <button onClick={() => setShowActionForm(false)} className="cursor-pointer">
                <X className="w-5 h-5 text-[#8A8B8C]" />
              </button>
            </div>
            <div className="space-y-4">
              {/* Customer */}
              <div>
                <label className="label-text block mb-1.5">Customer</label>
                <select
                  value={actionCustomerId}
                  onChange={(e) => setActionCustomerId(Number(e.target.value))}
                  className="input-field w-full"
                >
                  <option value={0}>Select customer...</option>
                  {(customers || []).map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Action Type */}
              <div>
                <label className="label-text block mb-1.5">Action Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: "phone_call", label: "Phone Call", color: "#4ADE80" },
                    { value: "site_visit", label: "Site Visit", color: "#6366F1" },
                    { value: "email", label: "Email", color: "#3B82F6" },
                    { value: "whatsapp", label: "WhatsApp", color: "#25D366" },
                    { value: "sms", label: "SMS", color: "#D4A843" },
                    { value: "other", label: "Other", color: "#8A8B8C" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setActionType(opt.value)}
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

              {/* Title */}
              <div>
                <label className="label-text block mb-1.5">Title</label>
                <input
                  type="text"
                  value={actionTitle}
                  onChange={(e) => setActionTitle(e.target.value)}
                  className="input-field"
                  placeholder="Brief title for this action"
                />
              </div>

              {/* Notes */}
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

              <button
                onClick={submitActionForm}
                className="btn-primary w-full justify-center"
                disabled={createFollowUpAction.isPending}
              >
                {createFollowUpAction.isPending ? "Logging..." : "Log Action"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
