import { useState, useMemo, useEffect } from "react";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import {
  Shield, Calendar, MapPin, Clock, User, Filter, CheckCircle,
  LogIn, LogOut, AlertTriangle, ExternalLink, RefreshCw, Wifi, WifiOff,
} from "lucide-react";
import { syncService } from "@/lib/syncService";
import DatePicker from "@/components/DatePicker";

export default function AdminAuditPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  const [filterRep, setFilterRep] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [tab, setTab] = useState<"trail" | "checkins" | "missed" | "followups">("trail");
  const [expandedAuditId, setExpandedAuditId] = useState<string | null>(null);

  const { data: salesReps } = trpc.customer.getSalesReps.useQuery();
  const { data: auditStats } = trpc.audit.getStats.useQuery();
  const { data: auditTrail, refetch: refetchTrail } = trpc.audit.getFullTrail.useQuery(
    { salesRep: filterRep === "all" ? undefined : filterRep, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined },
    { enabled: tab === "trail" }
  );
  const { data: checkinReport, refetch: refetchCheckins } = trpc.audit.getCheckInReport.useQuery(
    { salesRep: filterRep === "all" ? undefined : filterRep, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined },
    { enabled: tab === "checkins" }
  );
  const { data: missedAppts, refetch: refetchMissed } = trpc.audit.getMissedAppointments.useQuery(undefined, { enabled: tab === "missed" });
  const { data: appointments, refetch: refetchAppts } = trpc.appointment.list.useQuery();
  const { data: checkins, refetch: refetchCheckinsList } = trpc.checkIn.list.useQuery();
  const { data: apptStats } = trpc.appointment.getStats.useQuery();
  const { data: checkinStats } = trpc.checkIn.getStats.useQuery();
  const { data: allFollowUps, refetch: refetchFollowUps } = trpc.customerFollowUp.getAllFollowUps.useQuery(
    { status: "all" },
    { enabled: tab === "followups" }
  );
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [cloudError, setCloudError] = useState("");

  async function handleRefresh() {
    setIsRefreshing(true);
    setCloudError("");
    try {
      await syncService.refresh();
      await refetchAppts();
      await refetchCheckinsList();
      if (tab === "trail") await refetchTrail();
      if (tab === "checkins") await refetchCheckins();
      if (tab === "missed") await refetchMissed();
      if (tab === "followups") await refetchFollowUps();
    } catch (err: any) {
      setCloudError("Could not connect to cloud. Data shown is from local cache.");
    }
    setIsRefreshing(false);
  }

  const myMissed = useMemo(() => {
    if (!missedAppts) return [];
    return filterRep === "all" ? missedAppts : missedAppts.filter((a: any) => a.salesRepName === filterRep);
  }, [missedAppts, filterRep]);

  // Action type badge colour
  function actionColour(action: string) {
    if (action.includes("CREATE")) return { bg: "rgba(74,222,128,0.12)", text: "#4ADE80" };
    if (action.includes("UPDATE")) return { bg: "rgba(245,158,11,0.12)", text: "#F59E0B" };
    if (action.includes("STATUS")) return { bg: "rgba(99,102,241,0.12)", text: "#6366F1" };
    if (action.includes("CHECKOUT")) return { bg: "rgba(239,68,68,0.12)", text: "#EF4444" };
    if (action.includes("DELETE")) return { bg: "rgba(239,68,68,0.12)", text: "#EF4444" };
    return { bg: "rgba(138,139,140,0.12)", text: "#8A8B8C" };
  }

  function actionLabel(action: string) {
    return action.replace(/_/g, " ");
  }

  if (!isAdmin) {
    return (
      <div className="card-surface p-8 text-center">
        <Shield className="w-12 h-12 text-[#EF4444] mx-auto mb-4" />
        <h2 className="font-display font-semibold text-white text-xl">Admin Only</h2>
        <p className="text-[#8A8B8C] font-body mt-2">This page is restricted to admin users.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display font-semibold text-white" style={{ fontSize: "clamp(1.8rem, 3vw, 2.5rem)", letterSpacing: "-0.03em" }}>Audit Trail</h1>
        <p className="text-[#8A8B8C] font-body text-sm mt-1">Complete visibility of all sales rep activity</p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card-surface p-4">
          <div className="label-text mb-1">APPOINTMENTS</div>
          <div className="stat-number">{apptStats?.total || 0}</div>
          <div className="text-xs text-[#8A8B8C] mt-1">{auditStats?.appointmentsCreated || 0} created</div>
        </div>
        <div className="card-surface p-4">
          <div className="label-text mb-1">CHECK-INS</div>
          <div className="stat-number" style={{ color: "#4ADE80" }}>{checkinStats?.total || 0}</div>
          <div className="text-xs text-[#8A8B8C] mt-1">{checkinStats?.checkedOut || 0} checked out</div>
        </div>
        <div className="card-surface p-4">
          <div className="label-text mb-1">MISSED</div>
          <div className="stat-number" style={{ color: "#EF4444" }}>{myMissed.length}</div>
          <div className="text-xs text-[#8A8B8C] mt-1">No check-in</div>
        </div>
        <div className="card-surface p-4">
          <div className="label-text mb-1">AUDIT LOG</div>
          <div className="stat-number" style={{ color: "#6366F1" }}>{auditStats?.totalAuditEntries || 0}</div>
          <div className="text-xs text-[#8A8B8C] mt-1">Total entries</div>
        </div>
      </div>

      {/* Filters */}
      <div className="card-surface p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 flex-wrap items-start">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-[#8A8B8C]" />
            <label className="label-text">Sales Rep:</label>
            <select value={filterRep} onChange={(e) => setFilterRep(e.target.value)} className="input-field w-auto text-sm py-1.5">
              <option value="all">All Sales Reps</option>
              {(salesReps || []).map((rep: string) => <option key={rep} value={rep}>{rep}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#8A8B8C]" />
            <label className="label-text">From:</label>
            <DatePicker value={dateFrom} onChange={setDateFrom} className="w-auto text-sm" />
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#8A8B8C]" />
            <label className="label-text">To:</label>
            <DatePicker value={dateTo} onChange={setDateTo} className="w-auto text-sm" />
          </div>
          <button onClick={handleRefresh} disabled={isRefreshing} className="btn-secondary text-sm py-1.5" style={{ marginLeft: "auto" }}>
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} /> {isRefreshing ? "Syncing..." : "Refresh Data"}
          </button>
        </div>
        {cloudError && (
          <div className="flex items-center gap-2 p-2 rounded-lg text-sm" style={{ backgroundColor: "rgba(239,68,68,0.08)", color: "#EF4444" }}>
            <WifiOff className="w-4 h-4" /> {cloudError}
          </div>
        )}
        {(!cloudError && appointments && appointments.length === 0 && checkins && checkins.length === 0) && (
          <div className="flex items-center gap-2 p-2 rounded-lg text-sm" style={{ backgroundColor: "rgba(212,168,67,0.08)", color: "#D4A843" }}>
            <Wifi className="w-4 h-4" /> Cloud connected — no data yet. Ask sales reps to create appointments or check in.
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex p-1 rounded-full" style={{ backgroundColor: "#18191A", border: "1px solid #222324" }}>
        <button onClick={() => setTab("trail")} className="flex-1 py-2 rounded-full text-sm font-body font-medium transition-all duration-200 cursor-pointer" style={{ backgroundColor: tab === "trail" ? "#D4A843" : "transparent", color: tab === "trail" ? "#0A0A0B" : "#8A8B8C" }}>Audit Trail</button>
        <button onClick={() => setTab("checkins")} className="flex-1 py-2 rounded-full text-sm font-body font-medium transition-all duration-200 cursor-pointer" style={{ backgroundColor: tab === "checkins" ? "#D4A843" : "transparent", color: tab === "checkins" ? "#0A0A0B" : "#8A8B8C" }}>Check-In Report</button>
        <button onClick={() => setTab("missed")} className="flex-1 py-2 rounded-full text-sm font-body font-medium transition-all duration-200 cursor-pointer" style={{ backgroundColor: tab === "missed" ? "#D4A843" : "transparent", color: tab === "missed" ? "#0A0A0B" : "#8A8B8C" }}>Missed Appointments</button>
        <button onClick={() => setTab("followups")} className="flex-1 py-2 rounded-full text-sm font-body font-medium transition-all duration-200 cursor-pointer" style={{ backgroundColor: tab === "followups" ? "#D4A843" : "transparent", color: tab === "followups" ? "#0A0A0B" : "#8A8B8C" }}>Customer Follow-ups</button>
      </div>

      {/* === AUDIT TRAIL TAB === */}
      {tab === "trail" && (
        <div className="space-y-3">
          {(auditTrail || []).length === 0 ? (
            <div className="card-surface p-8 text-center">
              <Wifi className="w-10 h-10 text-[#8A8B8C] mx-auto mb-3" />
              <p className="text-[#8A8B8C] font-body">No audit entries yet.</p>
              <p className="text-xs text-[#8A8B8C] mt-2">Data from all sales reps appears here automatically. Ask a rep to create an appointment or check in, then tap Refresh.</p>
            </div>
          ) : (
            (auditTrail || []).map((entry: any, idx: number) => {
              const colours = actionColour(entry.action);
              const isExpanded = expandedAuditId === entry.timestamp + idx;
              return (
                <div key={idx} className="card-surface p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="inline-block px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: colours.bg, color: colours.text }}>{actionLabel(entry.action)}</span>
                        <span className="text-xs text-[#8A8B8C]">{entry.entityType}</span>
                        {entry.userName && <span className="flex items-center gap-1 text-xs text-[#D4A843]"><User className="w-3 h-3" />{entry.userName}</span>}
                      </div>
                      <p className="text-sm text-[#E8E8E9] font-body">{entry.details}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-xs text-[#8A8B8C] font-mono-data">{new Date(entry.timestamp).toLocaleDateString("en-ZA")}</div>
                      <div className="text-xs text-[#8A8B8C] font-mono-data">{new Date(entry.timestamp).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}</div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* === CHECK-IN REPORT TAB === */}
      {tab === "checkins" && (
        <div className="space-y-3">
          {(checkinReport || []).length === 0 ? (
            <div className="card-surface p-8 text-center">
              <MapPin className="w-10 h-10 text-[#8A8B8C] mx-auto mb-3" />
              <p className="text-[#8A8B8C] font-body">No check-ins yet.</p>
              <p className="text-xs text-[#8A8B8C] mt-2">Sales rep check-ins with GPS coordinates will appear here.</p>
            </div>
          ) : (
            (checkinReport || []).map((ci: any) => (
              <div key={ci.id} className="card-surface p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="flex items-center gap-1 text-sm font-body font-semibold text-white"><User className="w-4 h-4 text-[#D4A843]" />{ci.salesRepName || "Unknown"}</span>
                      <span className="inline-block px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: ci.status === "checked_in" ? "rgba(74,222,128,0.12)" : "rgba(99,102,241,0.12)", color: ci.status === "checked_in" ? "#4ADE80" : "#6366F1" }}>{ci.status === "checked_in" ? "Active" : "Completed"}</span>
                      {ci.isGPS ? <span className="inline-block px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: "rgba(74,222,128,0.12)", color: "#4ADE80" }}><MapPin className="w-3 h-3 inline" /> GPS</span> : <span className="inline-block px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: "rgba(245,158,11,0.12)", color: "#F59E0B" }}><MapPin className="w-3 h-3 inline" /> Map</span>}
                    </div>
                    <p className="text-sm text-[#E8E8E9] font-body">{ci.customer?.name || "Unknown Customer"}</p>
                    {ci.location && <p className="text-xs text-[#8A8B8C] mt-0.5">{ci.location}</p>}
                    {ci.durationMinutes !== undefined && (
                      <div className="flex items-center gap-1 mt-1">
                        <Clock className="w-3 h-3 text-[#D4A843]" />
                        <span className="text-xs text-[#D4A843]">{ci.durationMinutes < 60 ? `${ci.durationMinutes} min` : `${Math.floor(ci.durationMinutes / 60)}h ${ci.durationMinutes % 60}m`}</span>
                      </div>
                    )}
                    {ci.checkoutNotes && <p className="text-xs text-[#EF4444] mt-1 italic">{ci.checkoutNotes}</p>}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-xs text-[#8A8B8C]">{new Date(ci.createdAt).toLocaleDateString("en-ZA")}</div>
                    <div className="text-xs text-[#8A8B8C] font-mono-data">{new Date(ci.createdAt).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}</div>
                    {ci.mapUrl && (
                      <a href={ci.mapUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-[#D4A843] underline flex items-center gap-1 mt-1 justify-end"><ExternalLink className="w-3 h-3" /> Validate Location</a>
                    )}
                  </div>
                </div>
                {/* Customer Address Validation */}
                {ci.customer?.physicalAddress && (
                  <div className="mt-3 p-2 rounded-lg" style={{ backgroundColor: "#0A0A0B", border: "1px solid #222324" }}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[#8A8B8C]">Customer address: {ci.customer.physicalAddress}</span>
                      <a href={`https://www.google.com/maps?q=${encodeURIComponent(ci.customer.physicalAddress)}`} target="_blank" rel="noopener noreferrer" className="text-xs text-[#D4A843] underline">Compare on Map</a>
                    </div>
                    {ci.latitude && ci.longitude && (
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs font-mono-data text-[#8A8B8C]">GPS: {ci.latitude.toFixed(6)}, {ci.longitude.toFixed(6)}</span>
                        <a href={`https://www.google.com/maps/dir/${ci.latitude},${ci.longitude}/${encodeURIComponent(ci.customer.physicalAddress)}`} target="_blank" rel="noopener noreferrer" className="text-xs text-[#D4A843] underline">Check Distance</a>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* === MISSED APPOINTMENTS TAB === */}
      {tab === "missed" && (
        <div className="space-y-3">
          {myMissed.length === 0 ? (
            <div className="card-surface p-8 text-center">
              <CheckCircle className="w-10 h-10 text-[#4ADE80] mx-auto mb-3" />
              <p className="text-[#8A8B8C] font-body">No missed appointments.</p>
              <p className="text-xs text-[#8A8B8C] mt-2">All scheduled appointments have corresponding check-ins. Good work!</p>
            </div>
          ) : (
            myMissed.map((appt: any) => (
              <div key={appt.id} className="card-surface p-4" style={{ borderLeft: "3px solid #EF4444" }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="flex items-center gap-1 text-sm font-body font-semibold text-white"><User className="w-4 h-4 text-[#D4A843]" />{appt.salesRepName || "Unassigned"}</span>
                      <span className="inline-block px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: "rgba(239,68,68,0.12)", color: "#EF4444" }}><AlertTriangle className="w-3 h-3 inline" /> No Check-in</span>
                    </div>
                    <h4 className="font-display font-medium text-white">{appt.title}</h4>
                    <p className="text-sm text-[#E8E8E9] font-body">{appt.customerName}</p>
                    <div className="flex items-center gap-4 text-xs text-[#8A8B8C] mt-2">
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(appt.appointmentDate).toLocaleString("en-ZA")}</span>
                      {appt.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{appt.location}</span>}
                    </div>
                    {appt.notes && <p className="text-xs text-[#8A8B8C] mt-2">{appt.notes}</p>}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* === CUSTOMER FOLLOW-UPS TAB === */}
      {tab === "followups" && (
        <div className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="card-surface p-4"><div className="label-text mb-1">PENDING</div><div className="stat-number" style={{ color: "#F59E0B" }}>{(allFollowUps || []).filter((f: any) => f.status === "pending").length}</div></div>
            <div className="card-surface p-4"><div className="label-text mb-1">COMPLETED</div><div className="stat-number" style={{ color: "#4ADE80" }}>{(allFollowUps || []).filter((f: any) => f.status === "completed").length}</div></div>
            <div className="card-surface p-4"><div className="label-text mb-1">SNOOZED</div><div className="stat-number" style={{ color: "#6366F1" }}>{(allFollowUps || []).filter((f: any) => f.status === "snoozed").length}</div></div>
            <div className="card-surface p-4"><div className="label-text mb-1">OVERDUE (20d+)</div><div className="stat-number" style={{ color: "#EF4444" }}>{(allFollowUps || []).filter((f: any) => f.status === "pending" && f.daysSinceLastOrder > 20).length}</div></div>
          </div>

          {/* Follow-ups Table */}
          <div className="card-surface overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ backgroundColor: "#131415", borderBottom: "1px solid #222324" }}>
                    <th className="text-left p-3 label-text">Customer</th>
                    <th className="text-left p-3 label-text">Sales Rep</th>
                    <th className="text-center p-3 label-text">Days</th>
                    <th className="text-left p-3 label-text">Status</th>
                    <th className="text-left p-3 label-text">Reason</th>
                    <th className="text-left p-3 label-text">Outcome</th>
                    <th className="text-left p-3 label-text">Completed By</th>
                    <th className="text-left p-3 label-text">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {(allFollowUps || []).length === 0 ? (
                    <tr><td colSpan={8} className="p-8 text-center text-[#8A8B8C] font-body">No follow-up records yet. Follow-ups appear when sales reps log customer calls from the Appointments page.</td></tr>
                  ) : (
                    (allFollowUps || []).map((f: any) => (
                      <tr key={f.id} className="transition-colors hover:bg-[#131415]" style={{ borderBottom: "1px solid #18191A" }}>
                        <td className="p-3 text-sm text-white font-body">{f.customerName} <span className="text-[#8A8B8C]">({f.customerCode})</span></td>
                        <td className="p-3 text-sm text-[#4ADE80] font-body">{f.salesRepName}</td>
                        <td className="p-3 text-center">
                          <span className="text-sm font-body font-semibold" style={{ color: f.daysSinceLastOrder > 20 ? "#EF4444" : f.daysSinceLastOrder > 10 ? "#F59E0B" : "#8A8B8C" }}>{f.daysSinceLastOrder}d</span>
                        </td>
                        <td className="p-3">
                          <span className="status-badge text-xs" style={{
                            backgroundColor: f.status === "completed" ? "rgba(74,222,128,0.12)" : f.status === "pending" ? "rgba(245,158,11,0.12)" : "rgba(99,102,241,0.12)",
                            color: f.status === "completed" ? "#4ADE80" : f.status === "pending" ? "#F59E0B" : "#6366F1",
                          }}>{f.status}</span>
                        </td>
                        <td className="p-3 text-sm text-[#E8E8E9] font-body">{f.reason || "-"}</td>
                        <td className="p-3 text-sm text-[#E8E8E9] font-body">{f.outcome ? f.outcome.replace(/_/g, " ") : "-"}</td>
                        <td className="p-3 text-sm text-[#8A8B8C] font-body">{f.completedBy || "-"}</td>
                        <td className="p-3 text-xs text-[#8A8B8C] font-body">{f.followUpDate ? new Date(f.followUpDate).toLocaleDateString("en-ZA") : f.createdAt ? new Date(f.createdAt).toLocaleDateString("en-ZA") : "-"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
