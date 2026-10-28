import { useState } from "react";
import { useParams, useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { getCompanyConfig } from "@/lib/companyConfig";
import {
  ArrowLeft, Mail, Phone, MapPin, User, CreditCard, Building2,
  FileText, Package, Receipt, TrendingUp, AlertCircle, Calendar,
  Tag, Edit2, Ban, CheckCircle2, DollarSign, FileSpreadsheet,
  Clock, History
} from "lucide-react";

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const company = getCompanyConfig(user?.company);
  const customerId = Number(id);
  const [activeTab, setActiveTab] = useState<"overview" | "orders" | "invoices" | "payments" | "prices">("overview");

  const { data: customer } = trpc.customer.getById.useQuery(customerId);
  const { data: allOrders } = trpc.order.list.useQuery();
  const { data: allInvoices } = trpc.invoice.list.useQuery();
  const { data: specialPrices } = trpc.specialPrice.listByCustomer.useQuery(
    { customerId },
    { enabled: !!customerId }
  );

  const orders = (allOrders || []).filter((o: any) => String(o.customerId) === String(customerId)).sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  const invoices = (allInvoices || []).filter((inv: any) => String(inv.customerId) === String(customerId)).sort((a: any, b: any) => new Date(b.date || b.createdAt || 0).getTime() - new Date(a.date || a.createdAt || 0).getTime());

  const totalOrders = orders.length;
  const totalInvoiced = invoices.reduce((sum: number, inv: any) => sum + (Number(inv.total) || 0), 0);
  const totalPaid = invoices.reduce((sum: number, inv: any) => sum + (Number(inv.paidAmount) || 0), 0);
  const balanceDue = totalInvoiced - totalPaid;

  const formatDate = (d: string) => {
    if (!d) return "—";
    const date = new Date(d);
    return date.toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" });
  };
  const formatMoney = (n: number) => `R ${(n || 0).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  if (!customer) {
    return (
      <div className="flex items-center justify-center h-screen text-[#D4A843]">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg">Customer not found</p>
          <button onClick={() => navigate(-1)} className="mt-4 px-4 py-2 bg-[#D4A843] text-black rounded-lg font-body">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#F5F5F0]">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-[#0a0a0a]/95 backdrop-blur-md border-b" style={{ borderColor: "rgba(212,168,67,0.15)" }}>
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-[#1a1a1a] transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-heading text-[#F5F5F0]">{customer.name}</h1>
              <p className="text-sm text-[#9CA3AF] font-body">{customer.customerCode || "No code"} · {customer.city || "No city"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-body ${customer.isActive !== false ? "bg-[#4ADE80]/10 text-[#4ADE80]" : "bg-[#EF4444]/10 text-[#EF4444]"}`}>
              {customer.isActive !== false ? "Active" : "Inactive"}
            </span>
            <button onClick={() => navigate(`/statement/${customerId}`)} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#D4A843]/10 text-[#D4A843] hover:bg-[#D4A843]/20 text-sm font-body transition-colors">
              <FileSpreadsheet className="w-4 h-4" />
              Statement
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard icon={<Package className="w-5 h-5" />} label="Total Orders" value={totalOrders} color="#D4A843" />
          <StatCard icon={<Receipt className="w-5 h-5" />} label="Total Invoiced" value={formatMoney(totalInvoiced)} color="#4ADE80" />
          <StatCard icon={<DollarSign className="w-5 h-5" />} label="Total Paid" value={formatMoney(totalPaid)} color="#60A5FA" />
          <StatCard icon={<CreditCard className="w-5 h-5" />} label="Balance Due" value={formatMoney(balanceDue)} color={balanceDue > 0 ? "#EF4444" : "#4ADE80"} />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 p-1 rounded-xl bg-[#1a1a1a] border" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
          {(["overview", "orders", "invoices", "payments", "prices"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-body capitalize transition-all ${
                activeTab === tab
                  ? "bg-[#D4A843] text-black font-semibold"
                  : "text-[#9CA3AF] hover:text-[#F5F5F0]"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Info Card */}
            <div className="lg:col-span-1 card-surface rounded-xl p-6">
              <h3 className="text-lg font-heading mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-[#D4A843]" />
                Customer Info
              </h3>
              <div className="space-y-3 text-sm font-body">
                <InfoRow icon={<Building2 className="w-4 h-4" />} label="Business Name" value={customer.businessName || customer.name} />
                <InfoRow icon={<User className="w-4 h-4" />} label="Contact Person" value={customer.contactPerson || "—"} />
                <InfoRow icon={<Mail className="w-4 h-4" />} label="Email" value={customer.email || "—"} />
                <InfoRow icon={<Phone className="w-4 h-4" />} label="Phone" value={customer.phone || "—"} />
                <InfoRow icon={<MapPin className="w-4 h-4" />} label="Address" value={`${customer.address || ""}${customer.city ? `, ${customer.city}` : ""}`} />
                <InfoRow icon={<Tag className="w-4 h-4" />} label="Price Tier" value={customer.priceTier || "Standard"} />
                <InfoRow icon={<CreditCard className="w-4 h-4" />} label="Credit Limit" value={customer.creditLimit ? formatMoney(customer.creditLimit) : "—"} />
                <InfoRow icon={<TrendingUp className="w-4 h-4" />} label="VAT Number" value={customer.vatNumber || "—"} />
                <InfoRow icon={<Calendar className="w-4 h-4" />} label="Created" value={formatDate(customer.createdAt)} />
                <InfoRow icon={<User className="w-4 h-4" />} label="Sales Rep" value={customer.salesRepName || "—"} />
              </div>
            </div>

            {/* Recent Activity */}
            <div className="lg:col-span-2 space-y-6">
              <div className="card-surface rounded-xl p-6">
                <h3 className="text-lg font-heading mb-4 flex items-center gap-2">
                  <History className="w-5 h-5 text-[#D4A843]" />
                  Recent Orders
                </h3>
                {orders.slice(0, 5).length === 0 ? (
                  <p className="text-[#9CA3AF] text-sm font-body">No orders yet</p>
                ) : (
                  <div className="space-y-2">
                    {orders.slice(0, 5).map((o: any) => (
                      <div key={o.id} className="flex items-center justify-between p-3 rounded-lg bg-[#0a0a0a] border" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                        <div>
                          <p className="text-sm font-body text-[#F5F5F0]">{o.invoiceNumber || `Order #${o.id}`}</p>
                          <p className="text-xs text-[#9CA3AF]">{formatDate(o.createdAt)} · {o.status || "pending"}</p>
                        </div>
                        <span className="text-sm font-body text-[#D4A843]">{formatMoney(o.total)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="card-surface rounded-xl p-6">
                <h3 className="text-lg font-heading mb-4 flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-[#D4A843]" />
                  Recent Invoices
                </h3>
                {invoices.slice(0, 5).length === 0 ? (
                  <p className="text-[#9CA3AF] text-sm font-body">No invoices yet</p>
                ) : (
                  <div className="space-y-2">
                    {invoices.slice(0, 5).map((inv: any) => (
                      <div key={inv.id} className="flex items-center justify-between p-3 rounded-lg bg-[#0a0a0a] border" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                        <div>
                          <p className="text-sm font-body text-[#F5F5F0]">{inv.invoiceNumber || `INV-${inv.id}`}</p>
                          <p className="text-xs text-[#9CA3AF]">{formatDate(inv.date || inv.createdAt)} · {inv.status || "unpaid"}</p>
                        </div>
                        <span className="text-sm font-body text-[#D4A843]">{formatMoney(inv.total)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "orders" && (
          <div className="card-surface rounded-xl p-6">
            <h3 className="text-lg font-heading mb-4">All Orders</h3>
            {orders.length === 0 ? (
              <p className="text-[#9CA3AF] text-sm font-body">No orders found</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm font-body">
                  <thead>
                    <tr className="border-b" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
                      <th className="text-left py-3 px-4 text-[#9CA3AF] font-medium">Order #</th>
                      <th className="text-left py-3 px-4 text-[#9CA3AF] font-medium">Date</th>
                      <th className="text-left py-3 px-4 text-[#9CA3AF] font-medium">Status</th>
                      <th className="text-right py-3 px-4 text-[#9CA3AF] font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o: any) => (
                      <tr key={o.id} className="border-b hover:bg-[#1a1a1a]/50 transition-colors" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                        <td className="py-3 px-4">{o.invoiceNumber || `#${o.id}`}</td>
                        <td className="py-3 px-4">{formatDate(o.createdAt)}</td>
                        <td className="py-3 px-4">
                          <StatusBadge status={o.status} />
                        </td>
                        <td className="py-3 px-4 text-right text-[#D4A843]">{formatMoney(o.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === "invoices" && (
          <div className="card-surface rounded-xl p-6">
            <h3 className="text-lg font-heading mb-4">All Invoices</h3>
            {invoices.length === 0 ? (
              <p className="text-[#9CA3AF] text-sm font-body">No invoices found</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm font-body">
                  <thead>
                    <tr className="border-b" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
                      <th className="text-left py-3 px-4 text-[#9CA3AF] font-medium">Invoice #</th>
                      <th className="text-left py-3 px-4 text-[#9CA3AF] font-medium">Date</th>
                      <th className="text-left py-3 px-4 text-[#9CA3AF] font-medium">Status</th>
                      <th className="text-right py-3 px-4 text-[#9CA3AF] font-medium">Total</th>
                      <th className="text-right py-3 px-4 text-[#9CA3AF] font-medium">Paid</th>
                      <th className="text-right py-3 px-4 text-[#9CA3AF] font-medium">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((inv: any) => (
                      <tr key={inv.id} className="border-b hover:bg-[#1a1a1a]/50 transition-colors" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                        <td className="py-3 px-4">{inv.invoiceNumber || `INV-${inv.id}`}</td>
                        <td className="py-3 px-4">{formatDate(inv.date || inv.createdAt)}</td>
                        <td className="py-3 px-4"><StatusBadge status={inv.status} /></td>
                        <td className="py-3 px-4 text-right text-[#D4A843]">{formatMoney(inv.total)}</td>
                        <td className="py-3 px-4 text-right text-[#4ADE80]">{formatMoney(inv.paidAmount)}</td>
                        <td className="py-3 px-4 text-right" style={{ color: (inv.total - (inv.paidAmount || 0)) > 0 ? "#EF4444" : "#4ADE80" }}>
                          {formatMoney(inv.total - (inv.paidAmount || 0))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === "payments" && (
          <div className="card-surface rounded-xl p-6">
            <h3 className="text-lg font-heading mb-4">Payment Summary</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="p-4 rounded-lg bg-[#0a0a0a] border" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                <p className="text-xs text-[#9CA3AF] font-body mb-1">Total Invoiced</p>
                <p className="text-xl font-heading text-[#F5F5F0]">{formatMoney(totalInvoiced)}</p>
              </div>
              <div className="p-4 rounded-lg bg-[#0a0a0a] border" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                <p className="text-xs text-[#9CA3AF] font-body mb-1">Total Paid</p>
                <p className="text-xl font-heading text-[#4ADE80]">{formatMoney(totalPaid)}</p>
              </div>
              <div className="p-4 rounded-lg bg-[#0a0a0a] border" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                <p className="text-xs text-[#9CA3AF] font-body mb-1">Balance Due</p>
                <p className={`text-xl font-heading ${balanceDue > 0 ? "text-[#EF4444]" : "text-[#4ADE80]"}`}>{formatMoney(balanceDue)}</p>
              </div>
            </div>
            <p className="text-sm text-[#9CA3AF] font-body">View detailed payment history on the Invoices page or generate a customer statement.</p>
          </div>
        )}

        {activeTab === "prices" && (
          <div className="card-surface rounded-xl p-6">
            <h3 className="text-lg font-heading mb-4">Special Prices</h3>
            {(specialPrices || []).length === 0 ? (
              <p className="text-[#9CA3AF] text-sm font-body">No special prices set</p>
            ) : (
              <div className="space-y-2">
                {(specialPrices || []).map((sp: any) => (
                  <div key={sp.id} className="flex items-center justify-between p-3 rounded-lg bg-[#0a0a0a] border" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                    <span className="text-sm font-body text-[#F5F5F0]">{sp.itemName || `Item ${sp.itemId}`}</span>
                    <span className="text-sm font-body text-[#D4A843]">{formatMoney(sp.price)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string | number; color: string }) {
  return (
    <div className="card-surface rounded-xl p-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 rounded-lg" style={{ backgroundColor: `${color}15`, color }}>{icon}</div>
        <span className="text-xs text-[#9CA3AF] font-body uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-2xl font-heading" style={{ color }}>{value}</p>
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 py-2 border-b" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
      <div className="text-[#9CA3AF] mt-0.5">{icon}</div>
      <div>
        <p className="text-xs text-[#9CA3AF] font-body">{label}</p>
        <p className="text-sm text-[#F5F5F0] font-body">{value || "—"}</p>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status?: string }) {
  const colorMap: Record<string, string> = {
    paid: "#4ADE80",
    sent: "#60A5FA",
    draft: "#9CA3AF",
    cancelled: "#EF4444",
    pending: "#D4A843",
    fulfilled: "#4ADE80",
    delivered: "#4ADE80",
  };
  const color = colorMap[status || ""] || "#9CA3AF";
  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-body capitalize" style={{ backgroundColor: `${color}15`, color }}>
      {status || "pending"}
    </span>
  );
}
