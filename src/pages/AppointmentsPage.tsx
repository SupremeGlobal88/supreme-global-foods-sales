import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import {
  Plus, X, MapPin, Clock, CheckCircle, Calendar,
  Navigation, User, Filter, Radio, ExternalLink, LogIn,
} from "lucide-react";

type MapTarget = { customerId: number; address: string } | null;

export default function AppointmentsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const myRepName = user?.name || "";
  const utils = trpc.useUtils();

  // Schedule form
  const [showForm, setShowForm] = useState(false);
  const [scheduleMode, setScheduleMode] = useState<"existing" | "new">("existing");
  const [formData, setFormData] = useState({
    customerId: 0, title: "", notes: "",
    appointmentDate: new Date().toISOString().slice(0, 16),
    startTime: "09:00", location: "",
  });
  const [newCustomer, setNewCustomer] = useState({ name: "", contactPerson: "", phone: "", address: "" });

  // Check-in flow
  const [showCheckinForm, setShowCheckinForm] = useState(false);
  const [checkinCustomerId, setCheckinCustomerId] = useState(0);
  const [checkinNotes, setCheckinNotes] = useState("");
  const [mapTarget, setMapTarget] = useState<MapTarget>(null);
  const [geoError, setGeoError] = useState("");

  const [filterRep, setFilterRep] = useState<string>("all");

  const { data: appointments } = trpc.appointment.list.useQuery();
  const { data: checkins } = trpc.checkIn.list.useQuery();
  const { data: customers } = trpc.customer.search.useQuery({ query: " " });
  const { data: salesReps } = trpc.customer.getSalesReps.useQuery();
  const { data: apptStats } = trpc.appointment.getStats.useQuery();
  const { data: checkinStats } = trpc.checkIn.getStats.useQuery();

  const createAppointment = trpc.appointment.create.useMutation({
    onSuccess: () => {
      utils.appointment.list.invalidate(); utils.appointment.getStats.invalidate();
      setShowForm(false);
      setFormData({ customerId: 0, title: "", notes: "", appointmentDate: new Date().toISOString().slice(0, 10), startTime: "09:00", location: "" });
      setNewCustomer({ name: "", contactPerson: "", phone: "", address: "" });
    },
  });
  const createCheckin = trpc.checkIn.create.useMutation({
    onSuccess: () => {
      utils.checkIn.list.invalidate(); utils.checkIn.getStats.invalidate();
      setMapTarget(null); setGeoError(""); setShowCheckinForm(false); setCheckinCustomerId(0); setCheckinNotes("");
    },
  });

  // Filter: admin sees all, sales rep sees own
  const myAppointments = isAdmin
    ? (filterRep === "all" ? (appointments || []) : (appointments || []).filter((a: any) => a.salesRepName === filterRep))
    : (appointments || []).filter((a: any) => a.salesRepName === myRepName);

  const myCheckins = isAdmin
    ? (filterRep === "all" ? (checkins || []) : (checkins || []).filter((ci: any) => ci.salesRepName === filterRep))
    : (checkins || []).filter((ci: any) => ci.salesRepName === myRepName);

  // ===================== CHECK-IN FLOW =====================

  function openCheckinForm() {
    setShowCheckinForm(true);
    setCheckinCustomerId(0);
    setCheckinNotes("");
    setMapTarget(null);
    setGeoError("");
  }

  function submitCheckinForm() {
    if (checkinCustomerId === 0) { alert("Select a customer"); return; }
    const customer = (customers || []).find((c) => c.id === checkinCustomerId);
    if (!customer) return;

    // Try GPS
    setGeoError("");
    setMapTarget(null);

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          // GPS success
          createCheckin.mutate({
            customerId: checkinCustomerId,
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            notes: checkinNotes || customer.physicalAddress || "",
            salesRepName: myRepName,
          });
        },
        () => {
          // GPS failed — show map
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
      notes: checkinNotes || customer?.physicalAddress || mapTarget.address,
      salesRepName: myRepName,
    });
  }

  // ===================== SCHEDULE APPOINTMENT =====================

  function handleScheduleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (scheduleMode === "existing") {
      if (formData.customerId === 0) { alert("Select a customer"); return; }
      createAppointment.mutate({ ...formData, salesRepName: myRepName });
    } else {
      // New customer mode
      if (!newCustomer.name.trim()) { alert("Enter customer name"); return; }
      // Create appointment with typed-in customer details stored in notes
      const detailLines = [
        newCustomer.name && `Customer: ${newCustomer.name}`,
        newCustomer.contactPerson && `Contact: ${newCustomer.contactPerson}`,
        newCustomer.phone && `Phone: ${newCustomer.phone}`,
        newCustomer.address && `Address: ${newCustomer.address}`,
        formData.location && `Location: ${formData.location}`,
        formData.notes && `Notes: ${formData.notes}`,
      ].filter(Boolean).join("\n");

      createAppointment.mutate({
        ...formData,
        customerId: 0,
        title: formData.title || `Visit: ${newCustomer.name}`,
        notes: detailLines,
        salesRepName: myRepName,
      });
    }
  }

  // ===================== APPOINTMENT STATUS GROUPS =====================

  const upcoming = myAppointments.filter((a: any) => a.status === "scheduled");
  const inProgress = myAppointments.filter((a: any) => a.status === "in_progress");
  const completed = myAppointments.filter((a: any) => a.status === "completed");

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
            {apptStats?.total || 0} appointments &middot; {apptStats?.today || 0} today &middot; {checkinStats?.total || 0} check-ins total
          </p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <button onClick={openCheckinForm} className="btn-primary" style={{ backgroundColor: "#4ADE80", borderColor: "#4ADE80", color: "#0A0A0B" }}>
            <LogIn className="w-4 h-4" /> Check In at Location
          </button>
          <button onClick={() => setShowForm(true)} className="btn-primary"><Plus className="w-4 h-4" /> Schedule</button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card-surface p-4"><div className="label-text mb-1">TOTAL APPOINTMENTS</div><div className="stat-number">{apptStats?.total || 0}</div></div>
        <div className="card-surface p-4"><div className="label-text mb-1">TODAY</div><div className="stat-number" style={{ color: "#D4A843" }}>{apptStats?.today || 0}</div></div>
        <div className="card-surface p-4"><div className="label-text mb-1">IN PROGRESS</div><div className="stat-number" style={{ color: "#6366F1" }}>{apptStats?.inProgress || 0}</div></div>
        <div className="card-surface p-4"><div className="label-text mb-1">CHECK-INS TODAY</div><div className="stat-number" style={{ color: "#4ADE80" }}>{checkinStats?.today || 0}</div></div>
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
                <div>
                  <label className="label-text block mb-1.5">Customer *</label>
                  <select value={checkinCustomerId} onChange={(e) => setCheckinCustomerId(parseInt(e.target.value))} className="input-field" required>
                    <option value={0}>Select customer...</option>
                    {(customers || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
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

      {/* Check-ins Section */}
      <div>
        <h2 className="font-display font-semibold text-white text-lg mb-4 flex items-center gap-2"><CheckCircle className="w-5 h-5 text-[#4ADE80]" /> Geo Check-ins</h2>
        {myCheckins.length === 0 ? (
          <div className="card-surface p-8 text-center text-[#8A8B8C] font-body">No check-ins yet. Tap "Check In at Location" above to record your first visit.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {myCheckins.map((ci: any) => (
              <div key={ci.id} className="card-surface p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <User className="w-4 h-4 text-[#D4A843]" />
                      <span className="text-sm font-body font-semibold text-white">{ci.salesRepName || "Unknown Rep"}</span>
                    </div>
                    <div className="text-sm text-[#E8E8E9] font-body mb-1">{ci.customer?.name || "Unknown Customer"}</div>
                    {ci.location && <div className="flex items-center gap-1 text-xs text-[#8A8B8C]"><MapPin className="w-3 h-3" />{ci.location}</div>}
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-[#8A8B8C]">{new Date(ci.createdAt).toLocaleDateString("en-ZA")}</div>
                    <div className="text-xs text-[#8A8B8C] font-mono-data">{new Date(ci.createdAt).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}</div>
                  </div>
                </div>
                {ci.latitude && ci.longitude ? (
                  <div className="mt-3 p-2 rounded-lg" style={{ backgroundColor: "#0A0A0B" }}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono-data text-[#8A8B8C]">{ci.latitude.toFixed(6)}, {ci.longitude.toFixed(6)}</span>
                      <a href={`https://www.google.com/maps?q=${ci.latitude},${ci.longitude}`} target="_blank" rel="noopener noreferrer" className="text-xs text-[#D4A843] underline">View on Map</a>
                    </div>
                  </div>
                ) : ci.location ? (
                  <div className="mt-3 p-2 rounded-lg" style={{ backgroundColor: "#0A0A0B" }}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[#8A8B8C] font-body">Location: {ci.location}</span>
                      <a href={`https://www.google.com/maps?q=${encodeURIComponent(ci.location)}`} target="_blank" rel="noopener noreferrer" className="text-xs text-[#D4A843] underline">View on Map</a>
                    </div>
                  </div>
                ) : null}
                {ci.notes && <p className="text-xs text-[#8A8B8C] mt-2 italic">{ci.notes}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Appointments Section */}
      <div>
        <h2 className="font-display font-semibold text-white text-lg mb-4 flex items-center gap-2"><Calendar className="w-5 h-5 text-[#D4A843]" /> Scheduled Appointments</h2>

        {/* In Progress */}
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
                    <span className="status-badge text-xs" style={{ backgroundColor: "rgba(99, 102, 241, 0.12)", color: "#6366F1" }}>In Progress</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-[#8A8B8C]">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(appt.appointmentDate).toLocaleString("en-ZA")}</span>
                    {appt.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{appt.location}</span>}
                  </div>
                  {appt.notes && <p className="text-xs text-[#8A8B8C] mt-2">{appt.notes}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upcoming */}
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
                    <span className="status-badge text-xs" style={{ backgroundColor: "rgba(245, 158, 11, 0.12)", color: "#F59E0B" }}>Scheduled</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-[#8A8B8C]">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(appt.appointmentDate).toLocaleString("en-ZA")}</span>
                    {appt.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{appt.location}</span>}
                  </div>
                  {appt.notes && <p className="text-xs text-[#8A8B8C] mt-2">{appt.notes}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Completed */}
        {completed.length > 0 && (
          <div>
            <h3 className="label-text mb-2" style={{ color: "#4ADE80" }}>COMPLETED</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {completed.map((appt: any) => (
                <div key={appt.id} className="card-surface p-4 opacity-60" style={{ borderLeft: "3px solid #4ADE80" }}>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <User className="w-3 h-3 text-[#D4A843]" />
                        <span className="text-xs font-body" style={{ color: "#D4A843" }}>{appt.salesRepName || "Unassigned"}</span>
                      </div>
                      <h4 className="font-display font-medium text-white mt-1">{appt.title}</h4>
                      <p className="text-sm text-[#E8E8E9] font-body">{appt.customer?.name || appt.notes?.split("\n")[0]?.replace("Customer: ", "") || "No customer"}</p>
                    </div>
                    <span className="status-badge text-xs" style={{ backgroundColor: "rgba(74, 222, 128, 0.12)", color: "#4ADE80" }}>Completed</span>
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
                className="flex-1 py-2 rounded-full text-sm font-body font-medium transition-all duration-200 cursor-pointer"
                style={{ backgroundColor: scheduleMode === "existing" ? "#D4A843" : "transparent", color: scheduleMode === "existing" ? "#0A0A0B" : "#8A8B8C" }}
              >Select Existing Customer</button>
              <button
                onClick={() => setScheduleMode("new")}
                className="flex-1 py-2 rounded-full text-sm font-body font-medium transition-all duration-200 cursor-pointer"
                style={{ backgroundColor: scheduleMode === "new" ? "#D4A843" : "transparent", color: scheduleMode === "new" ? "#0A0A0B" : "#8A8B8C" }}
              >Enter New Customer</button>
            </div>

            <form onSubmit={handleScheduleSubmit} className="space-y-4">
              {scheduleMode === "existing" ? (
                <div>
                  <label className="label-text block mb-1.5">Customer *</label>
                  <select value={formData.customerId} onChange={(e) => setFormData({ ...formData, customerId: parseInt(e.target.value) })} className="input-field" required>
                    <option value={0}>Select customer...</option>
                    {(customers || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="label-text block mb-1.5">Customer Name *</label>
                    <input type="text" value={newCustomer.name} onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })} className="input-field" required placeholder="e.g. Joe's Butchery" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label-text block mb-1.5">Contact Person</label>
                      <input type="text" value={newCustomer.contactPerson} onChange={(e) => setNewCustomer({ ...newCustomer, contactPerson: e.target.value })} className="input-field" placeholder="e.g. John Smith" />
                    </div>
                    <div>
                      <label className="label-text block mb-1.5">Phone</label>
                      <input type="tel" value={newCustomer.phone} onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })} className="input-field" placeholder="e.g. 011 123 4567" />
                    </div>
                  </div>
                  <div>
                    <label className="label-text block mb-1.5">Address</label>
                    <input type="text" value={newCustomer.address} onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })} className="input-field" placeholder="e.g. 123 Main St, Germiston" />
                  </div>
                </div>
              )}

              <div><label className="label-text block mb-1.5">Title *</label><input type="text" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} className="input-field" required placeholder="e.g. Product demo / First visit" /></div>

              <div className="grid grid-cols-2 gap-4">
                <div><label className="label-text block mb-1.5">Date *</label><input type="date" value={formData.appointmentDate.slice(0, 10)} onChange={(e) => setFormData({ ...formData, appointmentDate: e.target.value + 'T' + formData.startTime })} className="input-field" required /></div>
                <div><label className="label-text block mb-1.5">Start Time *</label><input type="time" value={formData.startTime} onChange={(e) => setFormData({ ...formData, startTime: e.target.value })} className="input-field" required /></div>
              </div>

              <div><label className="label-text block mb-1.5">Location</label><input type="text" value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} className="input-field" placeholder="e.g. Customer office address" /></div>

              <div><label className="label-text block mb-1.5">Notes</label><textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} className="input-field" rows={3} placeholder="Any additional details..." /></div>

              <button type="submit" className="btn-primary w-full justify-center">Schedule Appointment</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
