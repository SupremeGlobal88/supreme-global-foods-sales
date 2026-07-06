import { useEffect, useRef, useState } from "react";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { pullFromCloud } from "@/lib/firebaseSync";
import { reloadFromStorage } from "@/lib/dataService";
import {
  DollarSign,
  ShoppingCart,
  Users,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  UserCheck,
  CheckCircle,
  FlaskConical,
  Calendar,
  Sun,
  BarChart3,
  CloudDownload,
  History,
} from "lucide-react";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
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

function StatCard({
  label,
  value,
  change,
  icon: Icon,
  accent,
  delay,
}: {
  label: string;
  value: string;
  change: number;
  icon: React.ElementType;
  accent: string;
  delay: number;
}) {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!cardRef.current) return;
    gsap.from(cardRef.current, {
      y: 24,
      opacity: 0,
      duration: 0.5,
      ease: "power3.out",
      delay,
      scrollTrigger: {
        trigger: cardRef.current,
        start: "top 85%",
      },
    });
  }, [delay]);

  const isPositive = change >= 0;

  return (
    <div ref={cardRef} className="card-surface p-6 relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ backgroundColor: accent }} />
      <div className="flex justify-between items-start mb-4">
        <span className="label-text">{label}</span>
        <Icon className="w-5 h-5 text-[#8A8B8C]" />
      </div>
      <div className="stat-number mb-2">{value}</div>
      <div className="flex items-center gap-1.5">
        <span
          className="status-badge"
          style={{
            backgroundColor: isPositive ? "rgba(74, 222, 128, 0.12)" : "rgba(239, 68, 68, 0.12)",
            color: isPositive ? "#4ADE80" : "#EF4444",
          }}
        >
          {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
          {Math.abs(change)}%
        </span>
        <span className="text-xs text-[#8A8B8C] font-body">vs last month</span>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { isAdmin } = useRole();
  const { data: orderStats } = trpc.order.getStats.useQuery();
  const { data: customerStats } = trpc.customer.getStats.useQuery();
  const { data: stockStats } = trpc.stock.getStats.useQuery();
  const { data: invoiceStats } = trpc.invoice.getStats.useQuery();
  const { data: recentOrders } = trpc.order.list.useQuery();
  const { data: salesRepStats } = trpc.salesRep.getStats.useQuery();
  const { data: salesBreakdown } = trpc.salesRep.getSalesBreakdown.useQuery(undefined, { enabled: isAdmin });

  const chartRef = useRef<HTMLDivElement>(null);
  const perfRef = useRef<HTMLDivElement>(null);
  const salesRef = useRef<HTMLDivElement>(null);
  const [pullStatus, setPullStatus] = useState("");
  const utils = trpc.useUtils();

  useEffect(() => {
    if (!chartRef.current) return;
    gsap.from(chartRef.current, {
      y: 24, opacity: 0, duration: 0.6, ease: "power3.out",
      scrollTrigger: { trigger: chartRef.current, start: "top 85%" },
    });
  }, []);

  useEffect(() => {
    if (!perfRef.current) return;
    gsap.from(perfRef.current, {
      y: 24, opacity: 0, duration: 0.6, ease: "power3.out", delay: 0.2,
      scrollTrigger: { trigger: perfRef.current, start: "top 85%" },
    });
  }, []);

  useEffect(() => {
    if (!salesRef.current) return;
    gsap.from(salesRef.current, {
      y: 24, opacity: 0, duration: 0.6, ease: "power3.out", delay: 0.1,
      scrollTrigger: { trigger: salesRef.current, start: "top 85%" },
    });
  }, []);

  // Auto-pull data from Firebase for admin users on first load
  useEffect(() => {
    if (!isAdmin) return;
    let done = false;
    async function autoPull() {
      if (done) return;
      done = true;
      setPullStatus("Syncing data...");
      try {
        await pullFromCloud();
        reloadFromStorage();
        await utils.order.list.invalidate();
        await utils.appointment.list.invalidate();
        await utils.invoice.list.invalidate();
        await utils.customer.search.invalidate();
        setPullStatus("Data synced!");
      } catch {
        setPullStatus("");
      }
      setTimeout(() => setPullStatus(""), 3000);
    }
    autoPull();
  }, [isAdmin]);

  // Sales rep's own stats
  const myRepName = user?.name || "";
  const myStats = ((salesRepStats as any)?.repStats || []).find((r: Record<string, any>) => r.name === myRepName);

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display font-semibold text-white" style={{ fontSize: "clamp(1.8rem, 3vw, 2.5rem)", letterSpacing: "-0.03em", lineHeight: 1.1 }}>
            Dashboard
          </h1>
          <p className="text-[#8A8B8C] font-body mt-1" style={{ fontSize: "0.85rem" }}>
            {isAdmin ? "Admin Overview" : `Sales Rep: ${myRepName}`} &middot; {new Date().toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
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
                  setPullStatus(total > 0 ? `Pulled ${total} items!` : "No new data");
                } catch {
                  setPullStatus("Pull failed");
                }
                setTimeout(() => setPullStatus(""), 3000);
              }}
              className="btn-secondary text-sm"
              disabled={!!pullStatus}
            >
              <CloudDownload className="w-4 h-4" /> {pullStatus || "Pull from Cloud"}
            </button>
          </div>
        )}
      </div>

      {/* Stat Cards - Admin sees revenue, sales reps don't */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 ${isAdmin ? "xl:grid-cols-4" : "xl:grid-cols-3"} gap-4`}>
        {isAdmin && (
          <StatCard label="TOTAL REVENUE" value={formatCurrency(invoiceStats?.totalValue || 0)} change={12.5} icon={DollarSign} accent="#D4A843" delay={0} />
        )}
        {!isAdmin && myStats && (
          <StatCard label="MY SALES" value={formatCurrency(myStats.totalSales || 0)} change={8.2} icon={TrendingUp} accent="#D4A843" delay={0} />
        )}
        {!isAdmin && !myStats && (
          <StatCard label="MY SALES" value="R 0.00" change={0} icon={TrendingUp} accent="#D4A843" delay={0} />
        )}
        <StatCard label="TOTAL ORDERS" value={(orderStats?.total || 0).toString()} change={8.2} icon={ShoppingCart} accent="#4ADE80" delay={0.08} />
        <StatCard label="CUSTOMERS" value={(customerStats?.total || 0).toString()} change={5.1} icon={Users} accent="#6366F1" delay={0.16} />
        <StatCard label="LOW STOCK ITEMS" value={(stockStats?.lowStock || 0).toString()} change={-2.4} icon={AlertTriangle} accent="#F59E0B" delay={0.24} />
      </div>

      {/* Sage Historical Data Alert - Admin only */}
      {isAdmin && (invoiceStats?.sageCount || 0) > 0 && (
        <div className="card-surface p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(99,102,241,0.12)" }}>
              <History className="w-5 h-5 text-[#818CF8]" />
            </div>
            <div>
              <div className="text-sm font-display font-semibold text-white">Sage Historical Data Loaded</div>
              <div className="text-xs text-[#8A8B8C]">
                {invoiceStats?.sageCount} historical invoice(s) · Outstanding: R {(invoiceStats?.sageOutstanding || 0).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>
          <a href="#/invoices" className="btn-secondary text-xs">
            <History className="w-3.5 h-3.5" /> View Invoices
          </a>
        </div>
      )}

      {/* Revenue Chart - Admin only */}
      {isAdmin && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div ref={chartRef} className="card-surface p-6 xl:col-span-2">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display font-semibold text-white text-lg">Revenue Overview</h2>
              <div className="flex gap-1 p-1 rounded-full" style={{ backgroundColor: "#0A0A0B" }}>
                {["7D", "30D", "90D"].map((range) => (
                  <button key={range} className="px-3 py-1 rounded-full text-xs font-body font-medium transition-all cursor-pointer" style={{ backgroundColor: range === "30D" ? "#D4A843" : "transparent", color: range === "30D" ? "#0A0A0B" : "#8A8B8C" }}>
                    {range}
                  </button>
                ))}
              </div>
            </div>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueData}>
                  <defs>
                    <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#D4A843" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#D4A843" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#222324" vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: "#8A8B8C", fontSize: 12, fontFamily: "JetBrains Mono" }} axisLine={{ stroke: "#222324" }} tickLine={false} />
                  <YAxis tick={{ fill: "#8A8B8C", fontSize: 12, fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false} tickFormatter={(v) => `R ${(v / 1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={{ backgroundColor: "#18191A", border: "1px solid #222324", borderRadius: 8, color: "#FFFFFF", fontFamily: "Inter", fontSize: 13 }} formatter={(value: number) => [formatCurrency(value), ""]} />
                  <Area type="monotone" dataKey="revenue" stroke="#D4A843" strokeWidth={2} fill="url(#revenueGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card-surface p-6">
            <h2 className="font-display font-semibold text-white text-lg mb-4">Recent Orders</h2>
            <div className="space-y-3">
              {(recentOrders || []).slice(0, 5).map((order) => (
                <div key={order.id} className="flex items-center justify-between p-3 rounded-lg transition-colors hover:bg-[#131415]">
                  <div className="flex-1 min-w-0">
                    <div className="font-mono-data text-xs text-[#D4A843]">{order.orderNumber}</div>
                    <div className="text-sm text-[#E8E8E9] truncate font-body">{order.customer?.name || "Unknown"}</div>
                  </div>
                  <div className="text-right ml-4">
                    <div className="text-sm text-white font-display font-semibold">R {Number(order.total).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</div>
                    <span className="status-badge text-xs mt-1" style={{ backgroundColor: order.status === "delivered" ? "rgba(74, 222, 128, 0.12)" : order.status === "pending" ? "rgba(245, 158, 11, 0.12)" : "rgba(99, 102, 241, 0.12)", color: order.status === "delivered" ? "#4ADE80" : order.status === "pending" ? "#F59E0B" : "#6366F1" }}>
                      {order.status}
                    </span>
                  </div>
                </div>
              ))}
              {(!recentOrders || recentOrders.length === 0) && (
                <div className="text-center py-8 text-[#8A8B8C] font-body text-sm">No orders yet</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sales Rep Sales Breakdown - Admin only */}
      {isAdmin && salesBreakdown && (
        <div ref={salesRef} className="card-surface p-6">
          <h2 className="font-display font-semibold text-white text-lg mb-4 flex items-center gap-2"><BarChart3 className="w-5 h-5 text-[#D4A843]" /> Sales by Rep</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div className="p-4 rounded-lg" style={{ backgroundColor: "#131415", border: "1px solid #222324" }}>
              <div className="flex items-center gap-2 mb-2"><Sun className="w-4 h-4 text-[#F59E0B]" /><span className="label-text">TODAY</span></div>
              <div className="stat-number" style={{ color: "#D4A843", fontSize: "1.5rem" }}>R {Number(salesBreakdown.totals.today).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</div>
              <div className="text-xs text-[#8A8B8C] mt-1">{salesBreakdown.today}</div>
            </div>
            <div className="p-4 rounded-lg" style={{ backgroundColor: "#131415", border: "1px solid #222324" }}>
              <div className="flex items-center gap-2 mb-2"><Calendar className="w-4 h-4 text-[#6366F1]" /><span className="label-text">THIS WEEK</span></div>
              <div className="stat-number" style={{ color: "#D4A843", fontSize: "1.5rem" }}>R {Number(salesBreakdown.totals.week).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</div>
              <div className="text-xs text-[#8A8B8C] mt-1">{salesBreakdown.weekRange}</div>
            </div>
            <div className="p-4 rounded-lg" style={{ backgroundColor: "#131415", border: "1px solid #222324" }}>
              <div className="flex items-center gap-2 mb-2"><BarChart3 className="w-4 h-4 text-[#4ADE80]" /><span className="label-text">THIS MONTH</span></div>
              <div className="stat-number" style={{ color: "#D4A843", fontSize: "1.5rem" }}>R {Number(salesBreakdown.totals.month).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</div>
              <div className="text-xs text-[#8A8B8C] mt-1">{salesBreakdown.month}</div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ backgroundColor: "#131415", borderBottom: "1px solid #222324" }}>
                  <th className="text-left p-3 label-text">Sales Rep</th>
                  <th className="text-right p-3 label-text">Today</th>
                  <th className="text-right p-3 label-text">This Week</th>
                  <th className="text-right p-3 label-text">This Month</th>
                </tr>
              </thead>
              <tbody>
                {salesBreakdown.repSales.map((rep: any) => (
                  <tr key={rep.name} className="transition-colors hover:bg-[#131415]" style={{ borderBottom: "1px solid #18191A" }}>
                    <td className="p-3 text-sm text-white font-body font-medium">{rep.name}</td>
                    <td className="p-3 text-right text-sm font-display" style={{ color: rep.todaySales > 0 ? "#D4A843" : "#8A8B8C" }}>R {Number(rep.todaySales).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</td>
                    <td className="p-3 text-right text-sm font-display" style={{ color: rep.weekSales > 0 ? "#D4A843" : "#8A8B8C" }}>R {Number(rep.weekSales).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</td>
                    <td className="p-3 text-right text-sm font-display font-semibold" style={{ color: "#D4A843" }}>R {Number(rep.monthSales).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))}
                {salesBreakdown.repSales.length === 0 && (
                  <tr><td colSpan={4} className="p-8 text-center text-[#8A8B8C] font-body">No sales data available</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sales Rep Performance - Admin only */}
      {isAdmin && (
        <div ref={perfRef} className="card-surface p-6">
          <h2 className="font-display font-semibold text-white text-lg mb-4 flex items-center gap-2"><UserCheck className="w-5 h-5 text-[#D4A843]" /> Sales Rep Overview</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "1px solid #222324" }}>
                  <th className="text-left p-3 label-text">Sales Rep</th>
                  <th className="text-right p-3 label-text">Customers</th>
                  <th className="text-right p-3 label-text">Orders</th>
                  <th className="text-right p-3 label-text">Total Sales</th>
                  <th className="text-left p-3 label-text">Status</th>
                </tr>
              </thead>
              <tbody>
                {((salesRepStats as any)?.repStats || []).map((rep: Record<string, any>) => (
                  <tr key={rep.name} className="transition-colors hover:bg-[#131415]" style={{ borderBottom: "1px solid #18191A" }}>
                    <td className="p-3 text-sm text-white font-body font-medium">{rep.name}</td>
                    <td className="p-3 text-right text-sm text-[#E8E8E9] font-display">{rep.customerCount}</td>
                    <td className="p-3 text-right text-sm text-[#E8E8E9] font-display">{rep.orderCount}</td>
                    <td className="p-3 text-right text-sm font-display font-semibold" style={{ color: "#D4A843" }}>R {Number(rep.totalSales).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</td>
                    <td className="p-3"><span className="status-badge" style={{ backgroundColor: "rgba(74, 222, 128, 0.12)", color: "#4ADE80" }}>Active</span></td>
                  </tr>
                ))}
                {(!salesRepStats?.repStats || salesRepStats.repStats.length === 0) && (
                  <tr><td colSpan={5} className="p-8 text-center text-[#8A8B8C] font-body">No sales rep data available</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Order Status Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card-surface p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="label-text">PENDING</span>
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(245, 158, 11, 0.12)" }}>
              <ShoppingCart className="w-4 h-4" style={{ color: "#F59E0B" }} />
            </div>
          </div>
          <div className="stat-number" style={{ color: "#F59E0B" }}>{orderStats?.pending ?? 0}</div>
          <div className="text-xs text-[#8A8B8C] font-body mt-1">Awaiting picking</div>
        </div>
        <div className="card-surface p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="label-text">PICKING</span>
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(99, 102, 241, 0.12)" }}>
              <ShoppingCart className="w-4 h-4" style={{ color: "#6366F1" }} />
            </div>
          </div>
          <div className="stat-number" style={{ color: "#6366F1" }}>{orderStats?.picking ?? 0}</div>
          <div className="text-xs text-[#8A8B8C] font-body mt-1">In warehouse</div>
        </div>
        <div className="card-surface p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="label-text">READY</span>
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(74, 222, 128, 0.12)" }}>
              <ShoppingCart className="w-4 h-4" style={{ color: "#4ADE80" }} />
            </div>
          </div>
          <div className="stat-number" style={{ color: "#4ADE80" }}>{orderStats?.ready ?? 0}</div>
          <div className="text-xs text-[#8A8B8C] font-body mt-1">For delivery</div>
        </div>
        <div className="card-surface p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="label-text">DELIVERED</span>
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(212, 168, 67, 0.12)" }}>
              <CheckCircle className="w-4 h-4" style={{ color: "#D4A843" }} />
            </div>
          </div>
          <div className="stat-number" style={{ color: "#D4A843" }}>{orderStats?.delivered ?? 0}</div>
          <div className="text-xs text-[#8A8B8C] font-body mt-1">Completed</div>
        </div>
      </div>

      {/* Invoice + Sample Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="card-surface p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="label-text">OVERDUE INVOICES</span>
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(239, 68, 68, 0.12)" }}>
              <AlertTriangle className="w-4 h-4" style={{ color: "#EF4444" }} />
            </div>
          </div>
          <div className="stat-number" style={{ color: "#EF4444" }}>{invoiceStats?.overdue ?? 0}</div>
          <div className="text-xs text-[#8A8B8C] font-body mt-1">Past due date</div>
        </div>
        <div className="card-surface p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="label-text">SAMPLE ORDERS</span>
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(139, 92, 246, 0.12)" }}>
              <FlaskConical className="w-4 h-4" style={{ color: "#8B5CF6" }} />
            </div>
          </div>
          <div className="stat-number" style={{ color: "#8B5CF6" }}>{orderStats?.samples ?? 0}</div>
          <div className="text-xs text-[#8A8B8C] font-body mt-1">With follow-ups</div>
        </div>
        <div className="card-surface p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="label-text">OUTSTANDING</span>
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(212, 168, 67, 0.12)" }}>
              <DollarSign className="w-4 h-4" style={{ color: "#D4A843" }} />
            </div>
          </div>
          <div className="stat-number" style={{ color: "#D4A843" }}>R {(invoiceStats?.outstanding ?? 0).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</div>
          <div className="text-xs text-[#8A8B8C] font-body mt-1">Unpaid invoices</div>
        </div>
      </div>
    </div>
  );
}
