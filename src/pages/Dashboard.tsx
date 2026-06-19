import { useEffect, useRef } from "react";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import {
  DollarSign,
  ShoppingCart,
  Users,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
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
  const { data: orderStats } = trpc.order.getStats.useQuery();
  const { data: customerStats } = trpc.customer.getStats.useQuery();
  const { data: stockStats } = trpc.stock.getStats.useQuery();
  const { data: invoiceStats } = trpc.invoice.getStats.useQuery();
  const { data: recentOrders } = trpc.order.list.useQuery();

  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartRef.current) return;
    gsap.from(chartRef.current, {
      y: 24,
      opacity: 0,
      duration: 0.6,
      ease: "power3.out",
      scrollTrigger: {
        trigger: chartRef.current,
        start: "top 85%",
      },
    });
  }, []);

  const isAdmin = user?.role === "admin";

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display font-semibold text-white" style={{ fontSize: "clamp(1.8rem, 3vw, 2.5rem)", letterSpacing: "-0.03em", lineHeight: 1.1 }}>
            Dashboard
          </h1>
          <p className="text-[#8A8B8C] font-body mt-1" style={{ fontSize: "0.85rem" }}>
            {isAdmin ? "Admin Overview" : "Sales Rep Overview"} &middot; {new Date().toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="TOTAL REVENUE" value={formatCurrency(invoiceStats?.totalValue || 0)} change={12.5} icon={DollarSign} accent="#D4A843" delay={0} />
        <StatCard label="TOTAL ORDERS" value={(orderStats?.total || 0).toString()} change={8.2} icon={ShoppingCart} accent="#4ADE80" delay={0.08} />
        <StatCard label="CUSTOMERS" value={(customerStats?.total || 0).toString()} change={5.1} icon={Users} accent="#6366F1" delay={0.16} />
        <StatCard label="LOW STOCK ITEMS" value={(stockStats?.lowStock || 0).toString()} change={-2.4} icon={AlertTriangle} accent="#F59E0B" delay={0.24} />
      </div>

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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card-surface p-6">
          <div className="flex items-center justify-between mb-3">
            <span className="label-text">PENDING ORDERS</span>
            <ShoppingCart className="w-5 h-5 text-[#F59E0B]" />
          </div>
          <div className="stat-number" style={{ color: "#F59E0B" }}>{orderStats?.pending || 0}</div>
        </div>
        <div className="card-surface p-6">
          <div className="flex items-center justify-between mb-3">
            <span className="label-text">READY FOR DELIVERY</span>
            <ShoppingCart className="w-5 h-5 text-[#6366F1]" />
          </div>
          <div className="stat-number" style={{ color: "#6366F1" }}>{orderStats?.ready || 0}</div>
        </div>
        <div className="card-surface p-6">
          <div className="flex items-center justify-between mb-3">
            <span className="label-text">OVERDUE INVOICES</span>
            <AlertTriangle className="w-5 h-5 text-[#EF4444]" />
          </div>
          <div className="stat-number" style={{ color: "#EF4444" }}>{invoiceStats?.overdue || 0}</div>
        </div>
      </div>
    </div>
  );
}
