import { useParams, useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import { ArrowLeft, Printer } from "lucide-react";

export default function StatementPage() {
  const { customerId } = useParams<{ customerId: string }>();
  const navigate = useNavigate();
  const cid = parseInt(customerId || "0");

  const { data: invoices, isLoading: invLoading } = trpc.invoice.list.useQuery();
  const { data: allCustomers } = trpc.customer.list.useQuery();

  const customer = (allCustomers || []).find((c: any) => c.id === cid);
  const custName = customer?.name || "";
  const custCode = customer?.customerCode || "";

  // Filter invoices for this customer — match by customerId, customer.name, or customerCode
  // This ensures BOTH Sage invoices (which may have customerId: 0) AND app invoices are included
  const custInvoices = (invoices || [])
    .filter((i: any) => {
      if (i.customerId === cid) return true;
      if (i.customer && i.customer.name === custName) return true;
      if (i.customerCode === custCode && custCode !== "") return true;
      if (i.customer && i.customer.customerCode === custCode && custCode !== "") return true;
      return false;
    })
    .sort((a: any, b: any) => new Date(a.invoiceDate || a.createdAt).getTime() - new Date(b.invoiceDate || b.createdAt).getTime());

  // Build statement lines
  const lines: any[] = [];
  let balance = 0;

  for (const inv of custInvoices) {
    const date = inv.invoiceDate || inv.createdAt;
    const desc = inv.source === "sage" ? `Sage Invoice` : `Invoice for ${inv.orderNumber || ""}`;
    const amount = inv.total || 0;
    const amtPaid = inv.amountPaid || 0;

    balance += amount;
    lines.push({
      date,
      ref: inv.invoiceNumber || inv.orderNumber || "",
      description: desc,
      debit: amount,
      credit: 0,
      balance,
      source: inv.source || "app",
    });

    if (amtPaid > 0) {
      balance -= amtPaid;
      lines.push({
        date: inv.updatedAt || date,
        ref: `Payment`,
        description: "Payment Received",
        debit: 0,
        credit: amtPaid,
        balance,
        source: "app",
      });
    }
  }

  const totalDebit = lines.reduce((s: number, l: any) => s + l.debit, 0);
  const totalCredit = lines.reduce((s: number, l: any) => s + l.credit, 0);

  // Aging buckets — calculate from invoices (not payment lines)
  const now = new Date();
  const aging = { current: 0, days30: 0, days60: 0, days90: 0, days90plus: 0 };
  for (const inv of custInvoices) {
    const bal = Number(inv.balanceDue || inv.total || 0) - Number(inv.amountPaid || 0);
    if (bal <= 0) continue;
    const invDate = new Date(inv.invoiceDate || inv.createdAt);
    const daysDiff = Math.floor((now.getTime() - invDate.getTime()) / 86400000);
    if (daysDiff <= 30) aging.current += bal;
    else if (daysDiff <= 60) aging.days30 += bal;
    else if (daysDiff <= 90) aging.days60 += bal;
    else if (daysDiff <= 120) aging.days90 += bal;
    else aging.days90plus += bal;
  }
  const totalOutstanding = aging.current + aging.days30 + aging.days60 + aging.days90 + aging.days90plus;

  if (!customer) {
    return (
      <div className="p-8 text-center">
        <p className="text-[#8A8B8C]">Customer not found</p>
        <button onClick={() => navigate("/invoices")} className="btn-primary mt-4">
          <ArrowLeft className="w-4 h-4" /> Back to Invoices
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 no-print">
        <button onClick={() => navigate("/invoices")} className="btn-secondary">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <button onClick={() => window.print()} className="btn-primary">
          <Printer className="w-4 h-4" /> Print
        </button>
      </div>

      {/* Statement Header */}
      <div className="text-center mb-8">
        <h1 className="font-display text-2xl font-semibold text-white">Customer Statement</h1>
        <div className="mt-4 text-sm text-[#8A8B8C]">
          <p className="font-semibold text-white text-lg">{customer.name}</p>
          {customer.customerCode && <p>Code: {customer.customerCode}</p>}
          {customer.phone && <p>Tel: {customer.phone}</p>}
          <p className="mt-2">Date: {new Date().toLocaleDateString("en-ZA")}</p>
        </div>
      </div>

      {/* Statement Table */}
      {invLoading ? (
        <div className="text-center py-12 text-[#8A8B8C]">Loading...</div>
      ) : lines.length === 0 ? (
        <div className="text-center py-12 text-[#8A8B8C]">No invoices for this customer.</div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2" style={{ borderColor: "#D4A843" }}>
                  <th className="text-left p-3 text-[#8A8B8C]">Date</th>
                  <th className="text-left p-3 text-[#8A8B8C]">Reference</th>
                  <th className="text-left p-3 text-[#8A8B8C]">Description</th>
                  <th className="text-right p-3 text-[#8A8B8C]">Debit (R)</th>
                  <th className="text-right p-3 text-[#8A8B8C]">Credit (R)</th>
                  <th className="text-right p-3 text-[#8A8B8C]">Balance (R)</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line: any, idx: number) => (
                  <tr key={idx} className="border-b" style={{ borderColor: "#222324" }}>
                    <td className="p-3 text-white whitespace-nowrap">
                      {new Date(line.date).toLocaleDateString("en-ZA")}
                    </td>
                    <td className="p-3 font-mono-data text-[#D4A843]">{line.ref}</td>
                    <td className="p-3 text-white">
                      {line.description}
                      {line.source === "sage" && (
                        <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "rgba(99,102,241,0.2)", color: "#6366F1" }}>SAGE</span>
                      )}
                    </td>
                    <td className="p-3 text-right text-white">
                      {line.debit > 0 ? line.debit.toLocaleString("en-ZA", { minimumFractionDigits: 2 }) : ""}
                    </td>
                    <td className="p-3 text-right" style={{ color: "#4ADE80" }}>
                      {line.credit > 0 ? line.credit.toLocaleString("en-ZA", { minimumFractionDigits: 2 }) : ""}
                    </td>
                    <td className="p-3 text-right font-semibold" style={{ color: line.balance > 0 ? "#D4A843" : "#4ADE80" }}>
                      {line.balance.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2" style={{ borderColor: "#D4A843" }}>
                  <td colSpan={3} className="p-3 font-semibold text-white text-right">TOTALS</td>
                  <td className="p-3 text-right font-semibold text-white">
                    {totalDebit.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-3 text-right font-semibold" style={{ color: "#4ADE80" }}>
                    {totalCredit.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-3 text-right font-bold" style={{ color: "#D4A843" }}>
                    {(totalDebit - totalCredit).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Summary */}
          <div className="mt-6 p-4 rounded-lg" style={{ backgroundColor: "#222324" }}>
            <div className="flex justify-between text-sm">
              <span className="text-[#8A8B8C]">Total Invoices:</span>
              <span className="text-white font-semibold">{custInvoices.length}</span>
            </div>
            <div className="flex justify-between text-sm mt-2 pt-2 border-t" style={{ borderColor: "#333435" }}>
              <span className="text-white font-semibold">Balance Due:</span>
              <span className="font-bold" style={{ color: (totalDebit - totalCredit) > 0 ? "#D4A843" : "#4ADE80" }}>
                R {(totalDebit - totalCredit).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Aging Summary */}
          {totalOutstanding > 0 && (
            <div className="mt-6 rounded-lg overflow-hidden" style={{ border: "1px solid #D4A843" }}>
              <div className="px-4 py-2 text-xs font-bold text-white uppercase tracking-wider" style={{ backgroundColor: "#D4A843" }}>
                Outstanding Balance Aging
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ backgroundColor: "#131415" }}>
                      <th className="p-3 text-left text-[#8A8B8C]">Current (0-30d)</th>
                      <th className="p-3 text-right text-[#8A8B8C]">30 Days</th>
                      <th className="p-3 text-right text-[#8A8B8C]">60 Days</th>
                      <th className="p-3 text-right text-[#8A8B8C]">90 Days</th>
                      <th className="p-3 text-right text-[#8A8B8C]" style={{ color: "#EF4444" }}>90+ Days</th>
                      <th className="p-3 text-right text-white" style={{ backgroundColor: "rgba(212,168,67,0.2)" }}>Total Outstanding</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderTop: "1px solid #222324" }}>
                      <td className="p-3 text-white font-semibold">R {aging.current.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</td>
                      <td className="p-3 text-right text-white">R {aging.days30.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</td>
                      <td className="p-3 text-right text-white">R {aging.days60.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</td>
                      <td className="p-3 text-right text-white">R {aging.days90.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</td>
                      <td className="p-3 text-right font-semibold" style={{ color: "#EF4444" }}>R {aging.days90plus.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</td>
                      <td className="p-3 text-right font-bold text-[#D4A843]" style={{ backgroundColor: "rgba(212,168,67,0.08)" }}>
                        R {totalOutstanding.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      <style>{`@media print { .no-print { display: none !important; } }`}</style>
    </div>
  );
}
