import { useState } from "react";
import { trpc } from "@/providers/trpc";
import {
  Calendar,
  Plus,
  X,
  MapPin,
  Clock,
  CheckCircle,
  XCircle,
  Play,
  Navigation,
  LocateFixed,
} from "lucide-react";

export default function AppointmentsPage() {
  const utils = trpc.useUtils();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [view, setView] = useState<"calendar" | "checkins">("calendar");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [checkInLoading, setCheckInLoading] = useState(false);
  const [checkInResult, setCheckInResult] = useState<{
    latitude: number;
    longitude: number;
    address?: string;
    accuracy?: number;
  } | null>(null);

  const { data: appointments } = trpc.appointment.list.useQuery();
  const { data: checkIns } = trpc.checkIn.list.useQuery();
  const { data: customers } = trpc.customer.search.useQuery({ query: " " });

  const createAppointment = trpc.appointment.create.useMutation({
    onSuccess: () => { utils.appointment.list.invalidate(); setShowForm(false); resetForm(); },
  });
  const updateAppointment = trpc.appointment.update.useMutation({
    onSuccess: () => { utils.appointment.list.invalidate(); setShowForm(false); setEditingId(null); },
  });
  const createCheckIn = trpc.checkIn.create.useMutation({
    onSuccess: () => { utils.checkIn.list.invalidate(); setCheckInResult(null); },
  });

  const [formData, setFormData] = useState({
    customerId: 0,
    customerName: "",
    title: "",
    description: "",
    appointmentDate: selectedDate,
    startTime: "09:00",
    endTime: "10:00",
    location: "",
    latitude: 0,
    longitude: 0,
    reminder: "none" as "none" | "15_min" | "30_min" | "1_hour",
    notes: "",
  });

  function resetForm() {
    setFormData({
      customerId: 0, customerName: "", title: "", description: "",
      appointmentDate: selectedDate, startTime: "09:00", endTime: "10:00",
      location: "", latitude: 0, longitude: 0, reminder: "none", notes: "",
    });
  }

  function handleCheckIn() {
    setCheckInLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCheckInLoading(false);
        setCheckInResult({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      },
      (error) => {
        setCheckInLoading(false);
        console.error("Geolocation error:", error);
        alert("Could not get location. Please enable location services.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  function confirmCheckIn() {
    if (!checkInResult) return;
    createCheckIn.mutate({
      latitude: checkInResult.latitude,
      longitude: checkInResult.longitude,
      accuracy: checkInResult.accuracy,
      address: checkInResult.address,
    });
  }

  function getStatusColor(status: string) {
    switch (status) {
      case "completed": return "#4ADE80";
      case "in_progress": return "#6366F1";
      case "cancelled": return "#EF4444";
      default: return "#D4A843";
    }
  }

  const todaysAppointments = (appointments || []).filter((a) => {
    const d = new Date(a.appointmentDate);
    const today = new Date(selectedDate);
    return d.toDateString() === today.toDateString();
  });

  const todaysCheckIns = (checkIns || []).filter((ci) => {
    const d = new Date(ci.checkInTime);
    const today = new Date();
    return d.toDateString() === today.toDateString();
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display font-semibold text-white" style={{ fontSize: "clamp(1.8rem, 3vw, 2.5rem)", letterSpacing: "-0.03em" }}>
            Appointments & Check-In
          </h1>
          <p className="text-[#8A8B8C] font-body text-sm mt-1">
            {(appointments || []).length} appointments &middot; {(checkIns || []).length} check-ins
          </p>
        </div>
        <div className="flex gap-3">
          <div className="flex p-1 rounded-full" style={{ backgroundColor: "#18191A", border: "1px solid #222324" }}>
            <button onClick={() => setView("calendar")} className="px-4 py-2 rounded-full text-xs font-body font-medium transition-all cursor-pointer" style={{ backgroundColor: view === "calendar" ? "#D4A843" : "transparent", color: view === "calendar" ? "#0A0A0B" : "#8A8B8C" }}>Calendar</button>
            <button onClick={() => setView("checkins")} className="px-4 py-2 rounded-full text-xs font-body font-medium transition-all cursor-pointer" style={{ backgroundColor: view === "checkins" ? "#D4A843" : "transparent", color: view === "checkins" ? "#0A0A0B" : "#8A8B8C" }}>Check-Ins</button>
          </div>
          <button onClick={() => { setShowForm(true); resetForm(); setEditingId(null); }} className="btn-primary"><Plus className="w-4 h-4" /> New Appointment</button>
        </div>
      </div>

      {view === "calendar" && (
        <>
          <div className="card-surface p-4 flex items-center gap-4">
            <Calendar className="w-5 h-5 text-[#D4A843]" />
            <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="input-field w-auto" />
            <button onClick={() => setSelectedDate(new Date().toISOString().slice(0, 10))} className="btn-secondary text-xs">Today</button>
          </div>

          <div className="card-surface p-6">
            <h3 className="font-display font-semibold text-white mb-4 flex items-center gap-2">
              <LocateFixed className="w-5 h-5 text-[#D4A843]" /> Geo Check-In
            </h3>
            {!checkInResult ? (
              <button onClick={handleCheckIn} disabled={checkInLoading} className="btn-primary w-full justify-center py-4" style={{ animation: checkInLoading ? "none" : "pulse-gold 2s infinite" }}>
                {checkInLoading ? <><div className="w-5 h-5 border-2 border-[#0A0A0B] border-t-transparent rounded-full animate-spin mr-2" /> Getting location...</> : <><Navigation className="w-5 h-5 mr-2" /> Check In at Current Location</>}
              </button>
            ) : (
              <div className="p-4 rounded-lg" style={{ backgroundColor: "rgba(74, 222, 128, 0.08)", border: "1px solid rgba(74, 222, 128, 0.2)" }}>
                <div className="flex items-center gap-2 mb-3">
                  <MapPin className="w-5 h-5 text-[#4ADE80]" />
                  <span className="text-white font-body">Location captured successfully</span>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                  <div className="p-2 rounded" style={{ backgroundColor: "#0A0A0B" }}><div className="label-text">Latitude</div><div className="text-white font-mono-data">{checkInResult.latitude.toFixed(6)}</div></div>
                  <div className="p-2 rounded" style={{ backgroundColor: "#0A0A0B" }}><div className="label-text">Longitude</div><div className="text-white font-mono-data">{checkInResult.longitude.toFixed(6)}</div></div>
                  {checkInResult.accuracy && <div className="p-2 rounded col-span-2" style={{ backgroundColor: "#0A0A0B" }}><div className="label-text">Accuracy</div><div className="text-white font-mono-data">{Math.round(checkInResult.accuracy)} meters</div></div>}
                </div>
                <div className="flex gap-3">
                  <button onClick={confirmCheckIn} className="btn-primary flex-1 justify-center"><CheckCircle className="w-4 h-4" /> Confirm Check-In</button>
                  <button onClick={() => setCheckInResult(null)} className="btn-secondary"><X className="w-4 h-4" /> Cancel</button>
                </div>
              </div>
            )}
          </div>

          <div>
            <h3 className="font-display font-semibold text-white mb-4">
              Appointments for {new Date(selectedDate).toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long" })}
            </h3>
            {todaysAppointments.length === 0 ? (
              <div className="card-surface p-8 text-center text-[#8A8B8C] font-body"><Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />No appointments for this date</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {todaysAppointments.map((appt) => (
                  <div key={appt.id} className="card-surface p-5" style={{ borderLeft: `3px solid ${getStatusColor(appt.status)}` }}>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-display font-medium text-white">{appt.title}</h4>
                        <p className="text-sm text-[#8A8B8C] font-body">{appt.customerName || "No customer"}</p>
                      </div>
                      <span className="status-badge text-xs" style={{ backgroundColor: `${getStatusColor(appt.status)}20`, color: getStatusColor(appt.status) }}>{appt.status}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-[#8A8B8C] mb-3">
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {appt.startTime}{appt.endTime ? ` - ${appt.endTime}` : ""}</span>
                      {appt.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {appt.location}</span>}
                    </div>
                    {appt.description && <p className="text-sm text-[#8A8B8C] font-body mb-3">{appt.description}</p>}
                    <div className="flex gap-2">
                      {appt.status === "scheduled" && <button onClick={() => updateAppointment.mutate({ id: appt.id, status: "in_progress" })} className="btn-primary text-xs"><Play className="w-3 h-3" /> Start</button>}
                      {appt.status === "in_progress" && <button onClick={() => updateAppointment.mutate({ id: appt.id, status: "completed" })} className="btn-primary text-xs"><CheckCircle className="w-3 h-3" /> Complete</button>}
                      {appt.status !== "cancelled" && <button onClick={() => updateAppointment.mutate({ id: appt.id, status: "cancelled" })} className="btn-secondary text-xs hover:text-[#EF4444]"><XCircle className="w-3 h-3" /> Cancel</button>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {view === "checkins" && (
        <div>
          <h3 className="font-display font-semibold text-white mb-4">Today's Check-Ins</h3>
          {todaysCheckIns.length === 0 ? (
            <div className="card-surface p-8 text-center text-[#8A8B8C] font-body"><MapPin className="w-12 h-12 mx-auto mb-3 opacity-30" />No check-ins today</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {todaysCheckIns.map((ci) => (
                <div key={ci.id} className="card-surface p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(74, 222, 128, 0.12)" }}>
                      <CheckCircle className="w-5 h-5 text-[#4ADE80]" />
                    </div>
                    <div>
                      <h4 className="font-display font-medium text-white text-sm">{ci.customerName || "Check-In"}</h4>
                      <p className="text-xs text-[#8A8B8C] font-body">{new Date(ci.checkInTime).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                    <div className="p-2 rounded" style={{ backgroundColor: "#0A0A0B" }}><div className="label-text">Lat</div><div className="text-white font-mono-data">{Number(ci.latitude).toFixed(5)}</div></div>
                    <div className="p-2 rounded" style={{ backgroundColor: "#0A0A0B" }}><div className="label-text">Lng</div><div className="text-white font-mono-data">{Number(ci.longitude).toFixed(5)}</div></div>
                  </div>
                  {ci.accuracy && <div className="text-xs text-[#8A8B8C]">Accuracy: {Math.round(ci.accuracy)}m</div>}
                  {ci.address && <div className="text-xs text-[#8A8B8C] mt-1">{ci.address}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.7)" }}>
          <div className="card-surface p-8 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto" style={{ borderRadius: 16 }}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display font-semibold text-white text-xl">{editingId ? "Edit" : "New"} Appointment</h2>
              <button onClick={() => setShowForm(false)} className="cursor-pointer"><X className="w-5 h-5 text-[#8A8B8C]" /></button>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              const data = { ...formData, customerId: formData.customerId || undefined };
              if (editingId) { updateAppointment.mutate({ id: editingId, ...data }); }
              else { createAppointment.mutate(data); }
            }} className="space-y-4">
              <div>
                <label className="label-text block mb-1.5">Customer</label>
                <select value={formData.customerId} onChange={(e) => setFormData({ ...formData, customerId: parseInt(e.target.value) })} className="input-field">
                  <option value={0}>Select customer (optional)...</option>
                  {(customers || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div><label className="label-text block mb-1.5">Title *</label><input type="text" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} className="input-field" required /></div>
              <div><label className="label-text block mb-1.5">Description</label><textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="input-field" rows={2} /></div>
              <div className="grid grid-cols-3 gap-4">
                <div><label className="label-text block mb-1.5">Date</label><input type="date" value={formData.appointmentDate} onChange={(e) => setFormData({ ...formData, appointmentDate: e.target.value })} className="input-field" required /></div>
                <div><label className="label-text block mb-1.5">Start</label><input type="time" value={formData.startTime} onChange={(e) => setFormData({ ...formData, startTime: e.target.value })} className="input-field" required /></div>
                <div><label className="label-text block mb-1.5">End</label><input type="time" value={formData.endTime} onChange={(e) => setFormData({ ...formData, endTime: e.target.value })} className="input-field" /></div>
              </div>
              <div><label className="label-text block mb-1.5">Location</label><input type="text" value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} className="input-field" placeholder="e.g., 123 Main St, Germiston" /></div>
              <div><label className="label-text block mb-1.5">Reminder</label>
                <select value={formData.reminder} onChange={(e) => setFormData({ ...formData, reminder: e.target.value as "none" | "15_min" | "30_min" | "1_hour" })} className="input-field">
                  <option value="none">None</option><option value="15_min">15 minutes before</option><option value="30_min">30 minutes before</option><option value="1_hour">1 hour before</option>
                </select>
              </div>
              <div><label className="label-text block mb-1.5">Notes</label><textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} className="input-field" rows={2} /></div>
              <button type="submit" className="btn-primary w-full justify-center">{editingId ? "Update" : "Save"} Appointment</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
