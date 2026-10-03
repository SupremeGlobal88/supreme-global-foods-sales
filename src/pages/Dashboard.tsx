import { useEffect, useRef, useState, useMemo } from "react";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { reloadFromStorage } from "@/lib/dataService";
import { pullFromCloud } from "@/lib/firebaseSync";
import {
  DollarSign, ShoppingCart, Users, AlertTriangle,
  ArrowUpRight, ArrowDownRight, TrendingUp, UserCheck,
  CheckCircle, FlaskConical, Calendar, Sun,
  BarChart3, CloudDownload, History, ChevronDown,
  Receipt, Package
} from "lucide-react";
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area,
} from "recharts";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const revenueData = [
  { month: "Jan", revenue: 125000, orders: 45 },
  { month: "Feb", revenue: 148000, orders: 52 },
  { month: "Mar", revenue: 132000, orders: 48 },
  { month: "Apr", revenue: 165000, orders: 61 },
  { month: "May", revenue: 189000, orders: 72 },
  { month: "Jun", revenue: 247500, orders: 89 },
];

function formatCurrency(value: number) {
  return `R ${value.toLocaleString("en-ZA")}`;
}

function generateMonthOptions(count: number): { value: string; label: string }[] {
  const opts: { value: string; label: string }[] = [{ value: "", label: "All Time" }];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const monthName = d.toLocaleString("en-ZA", { month: "long", year: "numeric" });
    opts.push({ value: `${y}-${m}`, label: monthName });
  }
  return opts;
}

function isInMonth(dateStr: string | undefined | null, month: string): boolean {
  if (!month || !dateStr) return true;
  return (dateStr || "").startsWith(month);
}

function KpiCard({ label, value, change, icon: Icon, accent }: {
  label: string; value: string; change: number;
  icon: React.ElementType; accent: string;
}) {
  const isPositive = change >= 0;
  return (
    <div className="card-surface p-4 flex items-center gap-4">
      <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${accent}18` }}>
        <Icon className="w-5 h-5" style={{ color: accent }} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="label-text mb-1">{label}</div>
        <div className="text-xl font-display font-bold text-white tracking-tight truncate">{value}</div>
        <div className="flex items-center gap-1.5 mt-1">
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full flex items-center gap-0.5"
            style={{ backgroundColor: isPositive ? "rgba(74,222,128,0.12)" : "rgba(239,68,68,0.12)", color: isPositive ? "#4ADE80" : "#EF4444" }}>
            {isPositive ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownRight className="w-2.5 h-2.5" />}
            {Math.abs(change)}%
          </span>
          <span className="text-[10px] text-[#8A8B8C]">vs last month</span>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { isAdmin, isSalesManager, canViewAll } = useRole();
  const { data: orderStats } = trpc.order.getStats.useQuery();
  const { data: customerStats } = trpc.customer.getStats.useQuery();
  const { data: stockStats } = trpc.stock.getStats.useQuery();
  const { data: invoiceStats } = trpc.invoice.getStats.useQuery();
  const { data: recentOrders } = trpc.order.list.useQuery();
  const { data: allInvoices } = trpc.invoice.list.useQuery();
  const { data: salesRepStats } = trpc.salesRep.getStats.useQuery();
  const { data: salesBreakdown } = trpc.salesRep.getSalesBreakdown.useQuery(undefined, { enabled: canViewAll });
  const { data: customers } = trpc.customer.search.useQuery({ query: " " });
  const { data: corporateCustomers } = trpc.corporateCustomer.list.useQuery();

  const chartRef = useRef<HTMLDivElement>(null);
  const [pullStatus, setPullStatus] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const utils = trpc.useUtils();

  const monthOptions = useMemo(() => generateMonthOptions(18), []);

  /* Customer lookup map — fixes N/A when customer object not embedded */
  const customerMap = useMemo(() => {
    const map = new Map();
    for (const c of customers || []) map.set(String(c.id), c);
    for (const c of corporateCustomers || []) map.set(String(c.id), c);
    return map;
  }, [customers, corporateCustomers]);
  const getCustomerName = (customerId: any) => {
    if (!customerId) return "Unknown";
    const c = customerMap.get(String(customerId));
    return c?.name || "Unknown";
  };
  const getCustomerRep = (customerId: any) => {
    if (!customerId) return "";
    const c = customerMap.get(String(customerId));
    return c?.salesRepName || "";
  };

  const filteredInvoices = useMemo(() => {
    if (!selectedMonth) return allInvoices || [];
    return (allInvoices || []).filter((i: any) => isInMonth(i.invoiceDate || i.createdAt, selectedMonth));
  }, [allInvoices, selectedMonth]);

  const filteredOrders = useMemo(() => {
    if (!selectedMonth) return recentOrders || [];
    return (recentOrders || []).filter((o: any) => isInMonth(o.createdAt, selectedMonth));
  }, [recentOrders, selectedMonth]);

  const filteredRevenue = useMemo(() =>
    filteredInvoices.filter((i: any) => !i.notes?.includes("Sample")).reduce((s: number, i: any) => s + Number(i.total || i.totalAmount || 0), 0),
  [filteredInvoices]);

  const filteredOutstanding = useMemo(() =>
    filteredInvoices.filter((i: any) => i.status !== "draft" && i.status !== "paid").reduce((s: number, i: any) => s + (Number(i.balanceDue) || Number(i.total || i.totalAmount || 0) - Number(i.amountPaid || 0)), 0),
  [filteredInvoices]);

  const filteredOrderCount = useMemo(() =>
    filteredOrders.filter((o: any) => o.orderType !== "sample").length,
  [filteredOrders]);

  const filteredSalesBreakdown = useMemo(() => {
    if (!selectedMonth) return salesBreakdown;
    const repNames = ((salesRepStats as any)?.repStats || []).map((r: any) => r.name);
    const monthLabel = monthOptions.find((m) => m.value === selectedMonth)?.label || selectedMonth;
    const repSales = repNames.map((name: string) => {
      const repOrders = filteredOrders.filter((o: any) => {
        return getCustomerRep(o.customerId) === name && o.orderType !== "sample";
      });
      const monthSales = repOrders.reduce((sum: number, o: any) => sum + Number(o.total || 0), 0);
      return { name, todaySales: 0, weekSales: 0, monthSales };
    });
    return {
      today: "", weekRange: "", month: monthLabel,
      repSales,
      totals: { today: 0, week: 0, month: repSales.reduce((s: number, r: any) => s + r.monthSales, 0) },
    };
  }, [selectedMonth, filteredOrders, salesBreakdown, salesRepStats, recentOrders, monthOptions, customerMap]);

  useEffect(() => {
    if (!chartRef.current) return;
    gsap.from(chartRef.current, {
      y: 24, opacity: 0, duration: 0.6, ease: "power3.out",
      scrollTrigger: { trigger: chartRef.current, start: "top 85%" },
    });
  }, []);

  const myRepName = user?.name || "";
  const myStats = ((salesRepStats as any)?.repStats || []).find((r: Record<string, any>) => r.name === myRepName);

  const outstandingInvoices = useMemo(() =>
    (filteredInvoices || [])
      .filter((i: any) => (i.balanceDue || 0) > 0 && i.status !== "paid")
      .sort((a: any, b: any) => new Date(a.dueDate || 0).getTime() - new Date(b.dueDate || 0).getTime())
      .slice(0, 12),
  [filteredInvoices]);

  return (
    <div className="space-y-5">
      {/* ─── HEADER ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-white tracking-tight">Dashboard</h1>
          <p className="text-[#8A8B8C] text-xs mt-0.5">
            {isAdmin ? "Admin Overview" : isSalesManager ? "Sales Manager Overview" : `Sales Rep: ${myRepName}`}
            {" "}&middot;{" "}
            {new Date().toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="input-field text-xs pr-8 py-2 appearance-none cursor-pointer min-w-[140px]"
              style={{ backgroundColor: "#131415", borderColor: "#222324", color: "#E8E8E9" }}
            >
              {monthOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8A8B8C] pointer-events-none" />
          </div>
          {isAdmin && (
            <button
              onClick={async () => {
                setPullStatus("Pulling...");
                try {
                  const counts = await pullFromCloud();
                  reloadFromStorage();
                  await utils.order.list.invalidate();
                  await utils.appointment.list.invalidate();
                  await utils.invoice.list.invalidate();
                  const total = Object.values(counts).reduce((a, b) => a + b, 0);
                  setPullStatus(total > 0 ? `Pulled ${total}` : "No new data");
                } catch {
                  setPullStatus("Pull failed");
                }
                setTimeout(() => setPullStatus(""), 3000);
              }}
              className="btn-secondary text-xs px-3 py-2"
              disabled={!!pullStatus}
            >
              <CloudDownload className="w-3.5 h-3.5" />
              {pullStatus || "Pull from Cloud"}
            </button>
          )}
        </div>
      </div>

      {/* ─── KPI CARDS ─── */}
      <div className={`grid grid-cols-2 ${canViewAll ? "lg:grid-cols-4" : "lg:grid-cols-3"} gap-3`}>
        {canViewAll && (
          <KpiCard label={selectedMonth ? "MONTH REVENUE" : "TOTAL REVENUE"} value={formatCurrency(filteredRevenue)} change={12.5} icon={DollarSign} accent="#D4A843" />
        )}
        {!canViewAll && (
          <KpiCard label="MY SALES" value={formatCurrency(myStats?.totalSales || 0)} change={8.2} icon={TrendingUp} accent="#D4A843" />
        )}
        <KpiCard label={selectedMonth ? "MONTH ORDERS" : "TOTAL ORDERS"} value={(selectedMonth ? filteredOrderCount : (orderStats?.total || 0)).toString()} change={8.2} icon={ShoppingCart} accent="#4ADE80" />
        <KpiCard label="CUSTOMERS" value={(customerStats?.total || 0).toString()} change={5.1} icon={Users} accent="#6366F1" />
        <KpiCard label="LOW STOCK" value={(stockStats?.lowStock || 0).toString()} change={-2.4} icon={AlertTriangle} accent="#F59E0B" />
      </div>

      {/* ─── SAGE BANNER ─── */}
      {canViewAll && (invoiceStats?.sageCount || 0) > 0 && (
        <div className="card-surface p-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: "rgba(99,102,241,0.12)" }}>
              <History className="w-4 h-4 text-[#818CF8]" />
            </div>
            <div>
              <div className="text-sm font-medium text-white">Sage Historical Data Loaded</div>
              <div className="text-xs text-[#8A8B8C]">
                {invoiceStats?.sageCount} historical invoices &middot; Outstanding: R {(invoiceStats?.sageOutstanding || 0).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>
          <a href="#/invoices" className="btn-secondary text-xs px-3 py-1.5">
            <Receipt className="w-3 h-3" /> View
          </a>
        </div>
      )}

      {/* ─── MAIN CONTENT: 2-COLUMN LAYOUT ─── */}
      {canViewAll && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

          {/* LEFT COLUMN (2/3) */}
          <div className="xl:col-span-2 space-y-4">

            {/* Revenue Chart */}
            <div ref={chartRef} className="card-surface p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display font-semibold text-white text-sm">Revenue Overview</h2>
                <div className="flex gap-1 p-0.5 rounded-lg" style={{ backgroundColor: "#0A0A0B" }}>
                  {["7D", "30D", "90D"].map((range) => (
                    <button key={range} className="px-2.5 py-1 rounded-md text-[10px] font-medium transition-all cursor-pointer"
                      style={{ backgroundColor: range === "30D" ? "#D4A843" : "transparent", color: range === "30D" ? "#0A0A0B" : "#8A8B8C" }}>
                      {range}
                    </button>
                  ))}
                </div>
              </div>
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueData}>
                    <defs>
                      <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#D4A843" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#D4A843" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#222324" vertical={false} />
                    <XAxis dataKey="month" tick={{ fill: "#8A8B8C", fontSize: 11, fontFamily: "JetBrains Mono" }} axisLine={{ stroke: "#222324" }} tickLine={false} />
                    <YAxis tick={{ fill: "#8A8B8C", fontSize: 11, fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false} tickFormatter={(v) => `R ${(v / 1000).toFixed(0)}k`} />
                    <Tooltip contentStyle={{ backgroundColor: "#18191A", border: "1px solid #222324", borderRadius: 8, color: "#FFF", fontSize: 12 }} formatter={(value: number) => [formatCurrency(value), ""]} />
                    <Area type="monotone" dataKey="revenue" stroke="#D4A843" strokeWidth={2} fill="url(#revGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Sales by Rep */}
            {(filteredSalesBreakdown || salesBreakdown) && (
              <div className="card-surface p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-display font-semibold text-white text-sm flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-[#D4A843]" />
                    Sales by Rep{selectedMonth ? ` · ${monthOptions.find(m => m.value === selectedMonth)?.label || ""}` : ""}
                  </h2>
                </div>

                {!selectedMonth && (
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {[
                      { label: "TODAY", value: (filteredSalesBreakdown || salesBreakdown)?.totals?.today || 0, icon: Sun, color: "#F59E0B", date: (filteredSalesBreakdown || salesBreakdown)?.today },
                      { label: "THIS WEEK", value: (filteredSalesBreakdown || salesBreakdown)?.totals?.week || 0, icon: Calendar, color: "#6366F1", date: (filteredSalesBreakdown || salesBreakdown)?.weekRange },
                      { label: "THIS MONTH", value: (filteredSalesBreakdown || salesBreakdown)?.totals?.month || 0, icon: BarChart3, color: "#4ADE80", date: (filteredSalesBreakdown || salesBreakdown)?.month },
                    ].map((s) => (
                      <div key={s.label} className="p-3 rounded-lg border border-[#222324] bg-[#131415]/50">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <s.icon className="w-3 h-3" style={{ color: s.color }} />
                          <span className="label-text">{s.label}</span>
                        </div>
                        <div className="text-base font-display font-bold text-white">R {Number(s.value).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</div>
                        <div className="text-[10px] text-[#8A8B8C] mt-0.5 truncate">{s.date}</div>
                      </div>
                    ))}
                  </div>
                )}
                {selectedMonth && (
                  <div className="p-3 rounded-lg border border-[#222324] bg-[#131415]/50 mb-3">
                    <span className="label-text">TOTAL</span>
                    <div className="text-base font-display font-bold text-white mt-1">R {Number((filteredSalesBreakdown || salesBreakdown)?.totals?.month || 0).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</div>
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#222324] text-[#8A8B8C] text-[10px] uppercase tracking-wider">
                        <th className="text-left p-2">Rep</th>
                        {!selectedMonth && <th className="text-right p-2">Today</th>}
                        {!selectedMonth && <th className="text-right p-2">Week</th>}
                        <th className="text-right p-2">{selectedMonth ? "Sales" : "Month"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {((filteredSalesBreakdown || salesBreakdown)?.repSales || []).map((rep: any) => (
                        <tr key={rep.name} className="border-b border-[#18191A] hover:bg-[#131415]">
                          <td className="p-2 text-sm text-white font-medium">{rep.name}</td>
                          {!selectedMonth && <td className="p-2 text-right text-sm" style={{ color: rep.todaySales > 0 ? "#D4A843" : "#8A8B8C" }}>R {Number(rep.todaySales).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</td>}
                          {!selectedMonth && <td className="p-2 text-right text-sm" style={{ color: rep.weekSales > 0 ? "#D4A843" : "#8A8B8C" }}>R {Number(rep.weekSales).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</td>}
                          <td className="p-2 text-right text-sm font-semibold" style={{ color: "#D4A843" }}>R {Number(rep.monthSales).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Sales Rep Overview */}
            <div className="card-surface p-4">
              <h2 className="font-display font-semibold text-white text-sm mb-3 flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-[#D4A843]" />
                Sales Rep Overview{selectedMonth ? ` · ${monthOptions.find(m => m.value === selectedMonth)?.label || ""}` : ""}
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#222324] text-[#8A8B8C] text-[10px] uppercase tracking-wider">
                      <th className="text-left p-2">Rep</th>
                      <th className="text-right p-2">Customers</th>
                      <th className="text-right p-2">Orders</th>
                      <th className="text-right p-2">{selectedMonth ? "Month Sales" : "Total Sales"}</th>
                      <th className="text-left p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {((salesRepStats as any)?.repStats || []).map((rep: Record<string, any>) => {
                      const repMonthSales = selectedMonth
                        ? (filteredOrders || []).filter((o: any) => {
                            return getCustomerRep(o.customerId) === rep.name && o.orderType !== "sample";
                          }).reduce((s: number, o: any) => s + Number(o.total || 0), 0)
                        : rep.totalSales;
                      return (
                        <tr key={rep.name} className="border-b border-[#18191A] hover:bg-[#131415]">
                          <td className="p-2 text-sm text-white font-medium">{rep.name}</td>
                          <td className="p-2 text-right text-sm text-[#E8E8E9]">{rep.customerCount}</td>
                          <td className="p-2 text-right text-sm text-[#E8E8E9]">
                            {selectedMonth
                              ? (filteredOrders || []).filter((o: any) => getCustomerRep(o.customerId) === rep.name && o.orderType !== "sample").length
                              : rep.orderCount}
                          </td>
                          <td className="p-2 text-right text-sm font-semibold" style={{ color: "#D4A843" }}>R {Number(repMonthSales).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</td>
                          <td className="p-2"><span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-green-900/30 text-green-400">Active</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN (1/3) */}
          <div className="space-y-4">

            {/* Outstanding Invoices */}
            <div className="card-surface p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-display font-semibold text-white text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-[#EF4444]" />
                  Outstanding
                </h2>
                <span className="text-[10px] text-[#8A8B8C]">{outstandingInvoices.length} invoices</span>
              </div>
              <div className="space-y-2 max-h-[420px] overflow-y-auto">
                {outstandingInvoices.map((inv: any) => {
                  const daysOverdue = Math.max(0, Math.floor((Date.now() - new Date(inv.dueDate || Date.now()).getTime()) / 86400000));
                  return (
                    <div key={inv.id} className="p-2.5 rounded-lg border border-[#222324] bg-[#131415]/40 hover:bg-[#131415] transition-colors">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-display font-semibold text-[#D4A843]">{inv.invoiceNumber}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${daysOverdue > 30 ? "bg-red-900/30 text-red-400" : daysOverdue > 7 ? "bg-yellow-900/30 text-yellow-400" : "bg-green-900/30 text-green-400"}`}>
                          {daysOverdue === 0 ? "Due" : `${daysOverdue}d`}
                        </span>
                      </div>
                      <div className="text-xs text-white truncate">{inv.customer?.name || getCustomerName(inv.customerId) || inv.customerName || "Unknown"}</div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[10px] text-[#8A8B8C]">{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString("en-ZA") : "—"}</span>
                        <span className="text-xs font-display font-semibold text-white">R {Number(inv.balanceDue).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                  );
                })}
                {outstandingInvoices.length === 0 && (
                  <div className="text-center py-6 text-[#8A8B8C] text-xs">{selectedMonth ? "No outstanding for this month" : "All paid up!"}</div>
                )}
              </div>
            </div>

            {/* Recent Orders */}
            <div className="card-surface p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-display font-semibold text-white text-sm flex items-center gap-2">
                  <Package className="w-4 h-4 text-[#4ADE80]" />
                  Recent Orders
                </h2>
              </div>
              <div className="space-y-2">
                {(filteredOrders || []).slice(0, 6).map((order: any) => (
                  <div key={order.id} className="flex items-center justify-between p-2.5 rounded-lg border border-[#222324] bg-[#131415]/40 hover:bg-[#131415] transition-colors">
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] font-mono-data text-[#D4A843]">{order.orderNumber}</div>
                      <div className="text-xs text-[#E8E8E9] truncate">{getCustomerName(order.customerId)}</div>
                    </div>
                    <div className="text-right ml-3 flex-shrink-0">
                      <div className="text-xs text-white font-display font-semibold">R {Number(order.total).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</div>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full mt-0.5 inline-block"
                        style={{
                          backgroundColor: order.status === "delivered" ? "rgba(74,222,128,0.12)" : order.status === "pending" ? "rgba(245,158,11,0.12)" : "rgba(99,102,241,0.12)",
                          color: order.status === "delivered" ? "#4ADE80" : order.status === "pending" ? "#F59E0B" : "#6366F1",
                        }}>
                        {order.status}
                      </span>
                    </div>
                  </div>
                ))}
                {(!filteredOrders || filteredOrders.length === 0) && (
                  <div className="text-center py-6 text-[#8A8B8C] text-xs">{selectedMonth ? "No orders this month" : "No orders yet"}</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── ORDER STATUS ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "PENDING", value: orderStats?.pending ?? 0, icon: ShoppingCart, color: "#F59E0B", desc: "Awaiting" },
          { label: "PICKING", value: orderStats?.picking ?? 0, icon: Package, color: "#6366F1", desc: "In warehouse" },
          { label: "READY", value: orderStats?.ready ?? 0, icon: CheckCircle, color: "#4ADE80", desc: "For delivery" },
          { label: "DELIVERED", value: orderStats?.delivered ?? 0, icon: CheckCircle, color: "#D4A843", desc: "Completed" },
        ].map((s) => (
          <div key={s.label} className="card-surface p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="label-text">{s.label}</span>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${s.color}18` }}>
                <s.icon className="w-4 h-4" style={{ color: s.color }} />
              </div>
            </div>
            <div className="text-xl font-display font-bold" style={{ color: s.color }}>{s.value}</div>
            <div className="text-[10px] text-[#8A8B8C] mt-0.5">{s.desc}</div>
          </div>
        ))}
      </div>

      {/* ─── BOTTOM STATS ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: "OVERDUE INVOICES", value: invoiceStats?.overdue ?? 0, icon: AlertTriangle, color: "#EF4444", desc: "Past due" },
          { label: "SAMPLE ORDERS", value: orderStats?.samples ?? 0, icon: FlaskConical, color: "#8B5CF6", desc: "Follow-ups" },
          { label: "OUTSTANDING", value: `R ${(selectedMonth ? filteredOutstanding : (invoiceStats?.outstanding ?? 0)).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`, icon: DollarSign, color: "#D4A843", desc: "Unpaid" },
        ].map((s) => (
          <div key={s.label} className="card-surface p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="label-text">{s.label}</span>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${s.color}18` }}>
                <s.icon className="w-4 h-4" style={{ color: s.color }} />
              </div>
            </div>
            <div className="text-xl font-display font-bold truncate" style={{ color: s.color }}>{s.value}</div>
            <div className="text-[10px] text-[#8A8B8C] mt-0.5">{s.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
