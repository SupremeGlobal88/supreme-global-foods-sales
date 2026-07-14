import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router";
import {
  FileText, AlertTriangle, Phone, DollarSign, User,
  ChevronDown, ChevronUp, ArrowRight,
} from "lucide-react";

export default function SalesRepInvoicesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const myRepName = user?.name || "";
  const [expandedCustomer, setExpandedCustomer] = useState<number | null>(null);

  const { data: allInvoices, isLoading } = trpc.invoice.list.useQuery();
  const { data: allCustomers } = trpc.customer.search.useQuery({ query: " " });

  // Filter: only MY customers
  const myCustomers = (allCustomers || []).filter(
    (c: any) => c.salesRepName === myRepName
  );
  const myCustomerIds = new Set(myCustomers.map((c: any) => c.id));

  // Filter: only invoices for MY customers with balance due > 0
  const myOutstandingInvoices = (allInvoices || []).filter((inv: any) => {
    const custId = inv.customerId;
    const custName = inv.customer?.name;
    // Match by customerId OR by customer name
    const isMyCustomer =
      myCustomerIds.has(custId) ||
      myCustomers.some((c: any) => c.name === custName);
    const hasBalance = (inv.balanceDue || inv.total || 0) - (inv.amountPaid || 0) > 0;
    return isMyCustomer && hasBalance;
  });

  // Group by customer
  const grouped = new Map<number, { customer: any; invoices: any[]; totalDue: number }>();
  for (const inv of myOutstandingInvoices) {
    const cid = inv.customerId || 0;
    const cust = myCustomers.find((c: any) => c.id === cid) || inv.customer;
    if (!grouped.has(cid)) {
      grouped.set(cid, { customer: cust, invoices: [], totalDue: 0 });
    }
    const g = grouped.get(cid)!;
    g.invoices.push(inv);
    g.totalDue += (inv.balanceDue || inv.total || 0) - (inv.amountPaid || 0);
  }
  const groupedArray = Array.from(grouped.values()).sort(
    (a, b) => b.totalDue - a.totalDue
  );

  const grandTotal = groupedArray.reduce((s, g) => s + g.totalDue, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display font-semibold text-white" style={{ fontSize: "clamp(1.8rem, 3vw, 2.5rem)", letterSpacing: "-0.03em" }}>
          My Customers&apos; Invoices
        </h1>
        <p className="text-[#8A8B8C] font-body text-sm mt-1">
          Outstanding invoices for customers assigned to you
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card-surface p-4">
          <div className="label-text mb-1">MY CUSTOMERS</div>
          <div className="stat-number" style={{ color: "#D4A843" }}>{myCustomers.length}</div>
        </div>
        <div className="card-surface p-4">
          <div className="label-text mb-1">WITH OUTSTANDING</div>
          <div className="stat-number" style={{ color: "#F59E0B" }}>{groupedArray.length}</div>
        </div>
        <div className="card-surface p-4">
          <div className="label-text mb-1">TOTAL INVOICES</div>
          <div className="stat-number" style={{ color: "#EF4444" }}>{myOutstandingInvoices.length}</div>
        </div>
        <div className="card-surface p-4">
          <div className="label-text mb-1">TOTAL DUE</div>
          <div className="stat-number" style={{ color: "#EF4444", fontSize: "1.3rem" }}>
            R {grandTotal.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      {/* Grouped Invoices */}
      {isLoading ? (
        <div className="text-center py-12 text-[#8A8B8C]">Loading...</div>
      ) : groupedArray.length === 0 ? (
        <div className="card-surface p-8 text-center">
          <div className="flex justify-center mb-3">
            <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(74,222,128,0.1)" }}>
              <DollarSign className="w-7 h-7" style={{ color: "#4ADE80" }} />
            </div>
          </div>
          <p className="text-white font-body text-lg">All caught up!</p>
          <p className="text-[#8A8B8C] font-body text-sm mt-1">
            None of your customers have outstanding invoices.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {groupedArray.map(({ customer, invoices, totalDue }) => {
            const isExpanded = expandedCustomer === (customer?.id || 0);
            return (
              <div key={customer?.id || 0} className="card-surface overflow-hidden">
                {/* Customer Header */}
                <button
                  onClick={() => setExpandedCustomer(isExpanded ? null : (customer?.id || 0))}
                  className="w-full flex items-center justify-between p-4 hover:bg-[#131415] transition-colors cursor-pointer text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "rgba(212,168,67,0.12)" }}>
                      <User className="w-5 h-5" style={{ color: "#D4A843" }} />
                    </div>
                    <div>
                      <div className="text-white font-body font-semibold">{customer?.name || "Unknown"}</div>
                      <div className="text-xs text-[#8A8B8C] font-body">
                        Code: {customer?.customerCode || "N/A"} &nbsp;|&nbsp; Tel: {customer?.phone || "N/A"}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-xs text-[#8A8B8C]">{invoices.length} invoice{invoices.length !== 1 ? "s" : ""}</div>
                      <div className="font-display font-bold" style={{ color: "#EF4444" }}>
                        R {totalDue.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-[#8A8B8C]" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-[#8A8B8C]" />
                    )}
                  </div>
                </button>

                {/* Expanded Invoice List */}
                {isExpanded && (
                  <div style={{ borderTop: "1px solid #222324" }}>
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ backgroundColor: "#0A0A0B" }}>
                          <th className="text-left p-3 label-text">Invoice #</th>
                          <th className="text-left p-3 label-text">Date</th>
                          <th className="text-right p-3 label-text">Total (R)</th>
                          <th className="text-right p-3 label-text">Paid (R)</th>
                          <th className="text-right p-3 label-text">Balance (R)</th>
                          <th className="text-center p-3 label-text">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoices.map((inv: any) => {
                          const bal = (inv.balanceDue || inv.total || 0) - (inv.amountPaid || 0);
                          return (
                            <tr key={inv.id} style={{ borderBottom: "1px solid #18191A" }}>
                              <td className="p-3 font-mono-data text-xs text-[#D4A843]">
                                <div className="flex items-center gap-1">
                                  {inv.invoiceNumber}
                                  {inv.source === "sage" && (
                                    <span className="px-1 py-0.5 rounded text-[9px]" style={{ backgroundColor: "rgba(99,102,241,0.15)", color: "#818CF8" }}>SAGE</span>
                                  )}
                                </div>
                              </td>
                              <td className="p-3 text-white text-xs">
                                {new Date(inv.invoiceDate || inv.createdAt).toLocaleDateString("en-ZA")}
                              </td>
                              <td className="p-3 text-right text-white">
                                R {Number(inv.total || 0).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}
                              </td>
                              <td className="p-3 text-right" style={{ color: "#4ADE80" }}>
                                R {Number(inv.amountPaid || 0).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}
                              </td>
                              <td className="p-3 text-right font-semibold" style={{ color: "#EF4444" }}>
                                R {bal.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}
                              </td>
                              <td className="p-3 text-center">
                                <span
                                  className="status-badge text-xs"
                                  style={{
                                    backgroundColor: bal <= 0 ? "rgba(74,222,128,0.12)" : "rgba(239,68,68,0.12)",
                                    color: bal <= 0 ? "#4ADE80" : "#EF4444",
                                  }}
                                >
                                  {bal <= 0 ? "Paid" : "Outstanding"}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {/* Customer total */}
                    <div className="p-3 flex justify-end" style={{ backgroundColor: "#0A0A0B" }}>
                      <div className="text-xs text-[#8A8B8C]">
                        Total for {customer?.name}:&nbsp;
                        <strong className="text-white">R {totalDue.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</strong>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
