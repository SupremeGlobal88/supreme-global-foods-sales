import { useState, useMemo } from "react";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import {
  Calendar, CalendarDays, CalendarRange, MapPin, Navigation,
  DollarSign, Users, TrendingUp, Printer, ChevronDown, ChevronUp,
  Route, Clock, Settings, FileText, BarChart3,
} from "lucide-react";

export default function SalesRepReportsPage() {
  const { user } = useAuth();
  const { isAdmin } = useRole();
  const myRepName = user?.name || "";

  // Report period selection
  const [activeTab, setActiveTab] = useState<"daily" | "weekly" | "monthly">("daily");

  // Date selectors
  const [dailyDate, setDailyDate] = useState(new Date().toISOString().slice(0, 10));
  const [weeklyYear, setWeeklyYear] = useState(new Date().getFullYear());
  const [weeklyWeek, setWeeklyWeek] = useState(getWeekNumber(new Date()));
  const [monthlyYear, setMonthlyYear] = useState(new Date().getFullYear());
  const [monthlyMonth, setMonthlyMonth] = useState(new Date().getMonth());

  // Expanded rep detail
  const [expandedRep, setExpandedRep] = useState<string | null>(null);

  // Settings
  const [showSettings, setShowSettings] = useState(false);
  const [aaRateInput, setAaRateInput] = useState("");

  // ─── Data Fetching ───
  const { data: dailyReport, refetch: refetchDaily } = trpc.checkIn.getDailyReport.useQuery(
    { date: dailyDate },
    { enabled: activeTab === "daily" }
  );
  const { data: weeklyReport, refetch: refetchWeekly } = trpc.checkIn.getWeeklyReport.useQuery(
    { year: weeklyYear, week: weeklyWeek },
    { enabled: activeTab === "weekly" }
  );
  const { data: monthlyReport, refetch: refetchMonthly } = trpc.checkIn.getMonthlyReport.useQuery(
    { year: monthlyYear, month: monthlyMonth },
    { enabled: activeTab === "monthly" }
  );
  const { data: aaRate } = trpc.checkIn.getAARate.useQuery();

  const setAARate = trpc.checkIn.setAARate.useMutation({
    onSuccess: () => {
      setShowSettings(false);
      setAaRateInput("");
      window.location.reload();
    },
  });

  const currentReport = activeTab === "daily" ? dailyReport : activeTab === "weekly" ? weeklyReport : monthlyReport;

  // Filter report by role: sales reps see only their own data, admins see all
  const filteredReport = useMemo(() => {
    if (!currentReport) return null;
    if (isAdmin) return currentReport; // Admins see everything
    // Sales reps see only their own data
    const myReps = (currentReport.repReports || []).filter(
      (r: any) => r.salesRep === myRepName
    );
    return {
      ...currentReport,
      summary: myReps.reduce((s: any, r: any) => ({
        totalReps: 1,
        totalVisits: s.totalVisits + r.totalVisits,
        totalCustomersVisited: s.totalCustomersVisited + r.uniqueCustomersVisited,
        totalKm: s.totalKm + r.totalKm,
        totalCost: s.totalCost + r.totalCost,
      }), { totalReps: myReps.length > 0 ? 1 : 0, totalVisits: 0, totalCustomersVisited: 0, totalKm: 0, totalCost: 0 }),
      repReports: myReps,
    };
  }, [currentReport, isAdmin, myRepName]);

  // ─── Helpers ───
  function getWeekNumber(d: Date): number {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    return Math.ceil((((+date - +yearStart) / 86400000) + 1) / 7);
  }

  function getWeekRange(year: number, week: number): string {
    const jan4 = new Date(year, 0, 4);
    const jan4Day = jan4.getDay() || 7;
    const monday = new Date(year, 0, 4 + (week - 1) * 7 - jan4Day + 1);
    const sunday = new Date(monday);
    sunday.setDate(sunday.getDate() + 6);
    return `${monday.toLocaleDateString("en-ZA")} - ${sunday.toLocaleDateString("en-ZA")}`;
  }

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  // ─── Print Report ───
  function printReport() {
    if (!filteredReport) return;
    const w = window.open("", "_blank");
    if (!w) return;

    const rows = (filteredReport.repReports || []).map((r: any) => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #ddd;font-weight:600;">${r.salesRep}</td>
        <td style="padding:8px;border-bottom:1px solid #ddd;text-align:center;">${r.totalVisits}</td>
        <td style="padding:8px;border-bottom:1px solid #ddd;text-align:center;">${r.uniqueCustomersVisited}</td>
        <td style="padding:8px;border-bottom:1px solid #ddd;text-align:right;">${r.totalKm.toFixed(2)}</td>
        <td style="padding:8px;border-bottom:1px solid #ddd;text-align:right;">R ${r.totalCost.toFixed(2)}</td>
      </tr>
    `).join("");

    w.document.write(`<!DOCTYPE html><html><head><title>Sales Rep Report</title>
      <style>
        @media print { body { padding: 0; } }
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; color: #333; }
        .header { text-align: center; border-bottom: 3px solid #D4A843; padding-bottom: 10px; margin-bottom: 20px; }
        .header h1 { color: #D4A843; margin: 0; font-size: 22px; }
        .header p { color: #666; margin: 5px 0 0; font-size: 12px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th { background: #D4A843; color: #fff; padding: 10px 8px; text-align: left; font-size: 11px; text-transform: uppercase; }
        .summary { margin-top: 20px; padding: 15px; background: #f9f9f9; border-radius: 6px; }
        .summary-row { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #e5e5e5; }
        .footer { text-align: center; font-size: 10px; color: #999; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 10px; }
      </style></head>
      <body>
        <div class="header">
          <h1>Sales Representative Visit Report</h1>
          <p>${filteredReport.periodLabel} | Generated: ${new Date().toLocaleDateString("en-ZA")} | AA Rate: R ${filteredReport.aaRatePerKm?.toFixed(2) || "5.50"}/km</p>
        </div>
        <table>
          <thead><tr>
            <th>Sales Rep</th>
            <th style="text-align:center;">Visits</th>
            <th style="text-align:center;">Unique Customers</th>
            <th style="text-align:right;">Distance (km)</th>
            <th style="text-align:right;">Cost (R)</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="summary">
          <div class="summary-row"><span><strong>Total Sales Reps</strong></span><span>${filteredReport.summary?.totalReps || 0}</span></div>
          <div class="summary-row"><span><strong>Total Visits</strong></span><span>${filteredReport.summary?.totalVisits || 0}</span></div>
          <div class="summary-row"><span><strong>Total Unique Customers</strong></span><span>${filteredReport.summary?.totalCustomersVisited || 0}</span></div>
          <div class="summary-row"><span><strong>Total Distance</strong></span><span>${(filteredReport.summary?.totalKm || 0).toFixed(2)} km</span></div>
          <div class="summary-row" style="border-top:2px solid #D4A843;font-weight:800;font-size:14px;">
            <span>Total Travel Cost</span>
            <span style="color:#D4A843;">R ${(filteredReport.summary?.totalCost || 0).toFixed(2)}</span>
          </div>
        </div>
        <div class="footer">
          Supreme Global Foods | 28 Nagington road, Wadeville, Germiston | 083 293 0644
        </div>
        <script>(function(){var d=false;function p(){if(!d){d=true;setTimeout(function(){window.print();},200);}}if(document.readyState==='complete')p();else window.onload=p;setTimeout(p,2000);})();</script>
      </body></html>`);
    w.document.close();
  }

  // ─── Print Rep Detail ───
  function printRepDetail(rep: any) {
    const w = window.open("", "_blank");
    if (!w) return;

    const visitRows = (rep.visits || []).map((v: any) => `
      <tr>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;">${new Date(v.time).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;">${v.customerName}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;">${v.location || "-"}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:center;">${v.outcome || "visit"}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:center;">${v.durationMinutes > 0 ? v.durationMinutes + " min" : "-"}</td>
      </tr>
    `).join("");

    const routeRows = (rep.routeSegments || []).map((s: any, i: number) => `
      <tr>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;">${i + 1}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;">${s.from.location}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;">${s.to.location}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;">${s.km.toFixed(2)}</td>
      </tr>
    `).join("");

    w.document.write(`<!DOCTYPE html><html><head><title>${rep.salesRep} - Visit Detail</title>
      <style>
        @media print { body { padding: 0; } }
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; color: #333; font-size: 11px; }
        .header { text-align: center; border-bottom: 3px solid #D4A843; padding-bottom: 10px; margin-bottom: 20px; }
        .header h1 { color: #D4A843; margin: 0; font-size: 18px; }
        h2 { font-size: 14px; color: #333; margin-top: 20px; border-bottom: 1px solid #ddd; padding-bottom: 5px; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #D4A843; color: #fff; padding: 8px; text-align: left; font-size: 10px; text-transform: uppercase; }
        td { padding: 6px 8px; }
        .footer { text-align: center; font-size: 9px; color: #999; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 10px; }
      </style></head>
      <body>
        <div class="header">
          <h1>${rep.salesRep} - Visit Detail Report</h1>
          <p>${filteredReport?.periodLabel || ""} | AA Rate: R ${(filteredReport?.aaRatePerKm || 5.50).toFixed(2)}/km</p>
        </div>
        <div style="display:flex;gap:20px;margin-bottom:20px;">
          <div style="flex:1;padding:10px;background:#f9f9f9;border-radius:6px;">
            <div style="font-size:10px;color:#888;">Total Visits</div>
            <div style="font-size:20px;font-weight:800;">${rep.totalVisits}</div>
          </div>
          <div style="flex:1;padding:10px;background:#f9f9f9;border-radius:6px;">
            <div style="font-size:10px;color:#888;">Unique Customers</div>
            <div style="font-size:20px;font-weight:800;">${rep.uniqueCustomersVisited}</div>
          </div>
          <div style="flex:1;padding:10px;background:#f9f9f9;border-radius:6px;">
            <div style="font-size:10px;color:#888;">Distance</div>
            <div style="font-size:20px;font-weight:800;">${rep.totalKm.toFixed(2)} km</div>
          </div>
          <div style="flex:1;padding:10px;background:#f9f9f9;border-radius:6px;">
            <div style="font-size:10px;color:#888;">Travel Cost</div>
            <div style="font-size:20px;font-weight:800;color:#D4A843;">R ${rep.totalCost.toFixed(2)}</div>
          </div>
        </div>
        <h2>Visit Log</h2>
        <table><thead><tr>
          <th>Time</th><th>Customer</th><th>Location</th><th style="text-align:center;">Outcome</th><th style="text-align:center;">Duration</th>
        </tr></thead><tbody>${visitRows}</tbody></table>
        <h2>Route Segments</h2>
        <table><thead><tr>
          <th>#</th><th>From</th><th>To</th><th style="text-align:right;">Distance (km)</th>
        </tr></thead><tbody>${routeRows}</tbody></table>
        <div class="footer">Supreme Global Foods | 28 Nagington road, Wadeville</div>
        <script>(function(){var d=false;function p(){if(!d){d=true;setTimeout(function(){window.print();},200);}}if(document.readyState==='complete')p();else window.onload=p;setTimeout(p,2000);})();</script>
      </body></html>`);
    w.document.close();
  }

  // ─── Render ───
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display font-semibold text-white" style={{ fontSize: "clamp(1.8rem,3vw,2.5rem)", letterSpacing: "-0.03em" }}>
            Sales Rep Reports
          </h1>
          <p className="text-[#8A8B8C] font-body text-sm mt-1">
            GPS-based visit tracking, distance & travel cost reports
          </p>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <button onClick={() => { setAaRateInput(String(aaRate || 5.50)); setShowSettings(true); }} className="btn-secondary text-xs">
              <Settings className="w-3.5 h-3.5" /> AA Rate: R {(aaRate || 5.50).toFixed(2)}/km
            </button>
          )}
          <button onClick={printReport} className="btn-secondary text-xs">
            <Printer className="w-3.5 h-3.5" /> Print Report
          </button>
        </div>
      </div>

      {/* Tab Selector */}
      <div className="flex gap-2">
        {[
          { key: "daily" as const, label: "Daily", icon: Calendar },
          { key: "weekly" as const, label: "Weekly", icon: CalendarDays },
          { key: "monthly" as const, label: "Monthly", icon: CalendarRange },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all"
            style={{
              backgroundColor: activeTab === t.key ? "rgba(212,168,67,0.15)" : "#18191A",
              color: activeTab === t.key ? "#D4A843" : "#8A8B8C",
              border: activeTab === t.key ? "1px solid rgba(212,168,67,0.4)" : "1px solid #222324",
            }}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Period Selector */}
      <div className="card-surface p-4">
        {activeTab === "daily" && (
          <div className="flex items-center gap-3">
            <label className="label-text">Date:</label>
            <input
              type="date"
              value={dailyDate}
              onChange={(e) => setDailyDate(e.target.value)}
              className="input-field"
            />
            <button onClick={() => refetchDaily()} className="btn-primary text-xs">
              <BarChart3 className="w-3.5 h-3.5" /> Generate
            </button>
          </div>
        )}
        {activeTab === "weekly" && (
          <div className="flex items-center gap-3 flex-wrap">
            <label className="label-text">Year:</label>
            <input type="number" value={weeklyYear} onChange={(e) => setWeeklyYear(parseInt(e.target.value))} className="input-field w-24" />
            <label className="label-text">Week:</label>
            <input type="number" value={weeklyWeek} onChange={(e) => setWeeklyWeek(parseInt(e.target.value))} className="input-field w-20" min={1} max={53} />
            <span className="text-xs text-[#8A8B8C]">{getWeekRange(weeklyYear, weeklyWeek)}</span>
            <button onClick={() => refetchWeekly()} className="btn-primary text-xs">
              <BarChart3 className="w-3.5 h-3.5" /> Generate
            </button>
          </div>
        )}
        {activeTab === "monthly" && (
          <div className="flex items-center gap-3 flex-wrap">
            <label className="label-text">Year:</label>
            <input type="number" value={monthlyYear} onChange={(e) => setMonthlyYear(parseInt(e.target.value))} className="input-field w-24" />
            <label className="label-text">Month:</label>
            <select value={monthlyMonth} onChange={(e) => setMonthlyMonth(parseInt(e.target.value))} className="input-field">
              {monthNames.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
            <button onClick={() => refetchMonthly()} className="btn-primary text-xs">
              <BarChart3 className="w-3.5 h-3.5" /> Generate
            </button>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      {filteredReport?.summary && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: "Sales Reps", value: filteredReport.summary.totalReps, icon: Users, color: "#D4A843" },
            { label: "Total Visits", value: filteredReport.summary.totalVisits, icon: MapPin, color: "#3B82F6" },
            { label: "Customers", value: filteredReport.summary.totalCustomersVisited, icon: Users, color: "#4ADE80" },
            { label: "Total km", value: `${(filteredReport.summary.totalKm || 0).toFixed(1)}`, icon: Navigation, color: "#F59E0B" },
            { label: "Total Cost", value: `R ${(filteredReport.summary.totalCost || 0).toFixed(2)}`, icon: DollarSign, color: "#EF4444" },
          ].map((s) => (
            <div key={s.label} className="card-surface p-4 text-center">
              <div className="flex items-center justify-center gap-1.5 mb-2">
                <s.icon className="w-4 h-4" style={{ color: s.color }} />
                <span className="label-text text-[10px]">{s.label.toUpperCase()}</span>
              </div>
              <div className="stat-number" style={{ fontSize: "1.6rem", color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Report Table */}
      <div className="card-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ backgroundColor: "#131415", borderBottom: "1px solid #222324" }}>
                <th className="text-left p-3 label-text">Sales Rep</th>
                <th className="text-center p-3 label-text">Visits</th>
                <th className="text-center p-3 label-text">Unique Customers</th>
                <th className="text-right p-3 label-text">Distance (km)</th>
                <th className="text-right p-3 label-text">Travel Cost</th>
                <th className="text-center p-3 label-text">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(!filteredReport?.repReports || filteredReport.repReports.length === 0) && (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-[#8A8B8C] font-body">
                    No check-in data with GPS coordinates for the selected period.
                    <br />
                    <span className="text-xs">Sales reps need to check in with GPS enabled for reports to generate.</span>
                  </td>
                </tr>
              )}
              {filteredReport?.repReports?.map((rep: any) => {
                const isExp = expandedRep === rep.salesRep;
                return (
                  <>
                    <tr key={rep.salesRep} className="cursor-pointer hover:bg-[#131415]" style={{ borderBottom: "1px solid #18191A" }} onClick={() => setExpandedRep(isExp ? null : rep.salesRep)}>
                      <td className="p-3 font-display font-semibold text-sm text-[#E8E8E9]">
                        <div className="flex items-center gap-2">
                          {isExp ? <ChevronUp className="w-4 h-4 text-[#D4A843]" /> : <ChevronDown className="w-4 h-4 text-[#8A8B8C]" />}
                          {rep.salesRep}
                        </div>
                      </td>
                      <td className="p-3 text-center text-sm text-white">{rep.totalVisits}</td>
                      <td className="p-3 text-center text-sm text-[#4ADE80]">{rep.uniqueCustomersVisited}</td>
                      <td className="p-3 text-right text-sm text-[#F59E0B] font-display">{rep.totalKm.toFixed(2)}</td>
                      <td className="p-3 text-right text-sm text-[#EF4444] font-display">R {rep.totalCost.toFixed(2)}</td>
                      <td className="p-3 text-center">
                        <button onClick={(e) => { e.stopPropagation(); printRepDetail(rep); }} className="p-1.5 rounded hover:bg-[#222324]" title="Print Detail">
                          <FileText className="w-3.5 h-3.5 text-[#D4A843]" />
                        </button>
                      </td>
                    </tr>
                    {isExp && (
                      <tr><td colSpan={6} className="p-0">
                        <div className="p-4" style={{ backgroundColor: "#0A0A0B" }}>
                          {/* Visit Log */}
                          <div className="mb-4">
                            <h4 className="text-xs font-semibold text-[#D4A843] mb-2 flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5" /> Visit Log ({rep.visits?.length || 0})
                            </h4>
                            <div className="space-y-1 max-h-64 overflow-y-auto">
                              {rep.visits?.map((v: any, i: number) => (
                                <div key={i} className="flex items-center gap-3 p-2 rounded text-xs" style={{ backgroundColor: "#18191A" }}>
                                  <span className="text-[#8A8B8C] w-14 shrink-0">{new Date(v.time).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}</span>
                                  <span className="text-white font-medium flex-1">{v.customerName}</span>
                                  <span className="text-[#8A8B8C] flex-1 truncate">{v.location || "-"}</span>
                                  <span className="px-1.5 py-0.5 rounded text-[10px]" style={{
                                    backgroundColor: v.outcome === "order" ? "rgba(74,222,128,0.1)" : v.outcome === "sample" ? "rgba(139,92,246,0.1)" : "rgba(59,130,246,0.1)",
                                    color: v.outcome === "order" ? "#4ADE80" : v.outcome === "sample" ? "#8B5CF6" : "#3B82F6",
                                  }}>{v.outcome || "visit"}</span>
                                  {v.durationMinutes > 0 && <span className="text-[#8A8B8C]">{v.durationMinutes} min</span>}
                                </div>
                              ))}
                            </div>
                          </div>
                          {/* Route Segments */}
                          {rep.routeSegments?.length > 0 && (
                            <div>
                              <h4 className="text-xs font-semibold text-[#F59E0B] mb-2 flex items-center gap-1.5">
                                <Route className="w-3.5 h-3.5" /> Route Segments ({rep.routeSegments.length})
                              </h4>
                              <div className="space-y-1 max-h-48 overflow-y-auto">
                                {rep.routeSegments.map((s: any, i: number) => (
                                  <div key={i} className="flex items-center gap-2 p-2 rounded text-xs" style={{ backgroundColor: "#18191A" }}>
                                    <span className="text-[#888] w-6">{i + 1}</span>
                                    <span className="text-[#8A8B8C] flex-1 truncate">{s.from.location}</span>
                                    <Navigation className="w-3 h-3 text-[#D4A843]" />
                                    <span className="text-[#8A8B8C] flex-1 truncate">{s.to.location}</span>
                                    <span className="text-[#F59E0B] font-medium">{s.km.toFixed(2)} km</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </td></tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* AA Rate Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.7)" }}>
          <div className="card-surface p-6 max-w-sm w-full mx-4" style={{ borderRadius: 16 }}>
            <h2 className="font-display font-semibold text-white text-lg mb-4 flex items-center gap-2">
              <Settings className="w-5 h-5 text-[#D4A843]" /> AA Travel Rate
            </h2>
            <p className="text-xs text-[#8A8B8C] mb-4">
              Set the South African Automobile Association travel rate per kilometer. This is used to calculate travel costs for sales reps.
            </p>
            <div className="space-y-4">
              <div>
                <label className="label-text block mb-1.5">Rate per km (R)</label>
                <input
                  type="number"
                  step="0.01"
                  value={aaRateInput}
                  onChange={(e) => setAaRateInput(e.target.value)}
                  className="input-field"
                  placeholder="5.50"
                />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowSettings(false)} className="btn-secondary flex-1 text-xs">Cancel</button>
                <button
                  onClick={() => { const r = parseFloat(aaRateInput); if (r > 0) setAARate.mutate(r); }}
                  className="btn-primary flex-1 text-xs"
                >
                  Save Rate
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
