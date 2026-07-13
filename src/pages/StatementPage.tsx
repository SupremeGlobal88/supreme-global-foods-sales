import { useParams, useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import { ArrowLeft, Printer, FileText } from "lucide-react";

export default function StatementPage() {
  const { customerId } = useParams<{ customerId: string }>();
  const navigate = useNavigate();
  const cid = parseInt(customerId || "0");

  const { data: invoices } = trpc.invoice.list.useQuery();
  const { data: allCustomers } = trpc.customer.list.useQuery();
  const { data: payments } = trpc.invoice.getReceiptsByCustomer.useQuery(
    { customerId: cid },
    { enabled: cid > 0 }
  );

  const customer = (allCustomers || []).find((c: any) => c.id === cid);

  // Filter invoices for this customer — same logic as invoice list
  const custInvoices = (invoices || [])
    .filter((i: any) => i.customerId === cid)
    .sort((a: any, b: any) => new Date(a.invoiceDate || a.createdAt).getTime() - new Date(b.invoiceDate || b.createdAt).getTime());

  // Build statement lines
  const lines: any[] = [];
  let balance = 0;

  for (const inv of custInvoices) {
    const date = inv.invoiceDate || inv.createdAt;
    const desc = inv.source === "sage" ? `Sage Invoice` : `Invoice for ${inv.orderNumber || ""}`;
    const amount = inv.total || 0;
    const amtPaid = inv.amountPaid || 0;

    // Invoice line (debit)
    balance += amount;
    lines.push({
      date,
      ref: inv.invoiceNumber || inv.orderNumber || "",
      description: desc,
      debit: amount,
      credit: 0,
      balance,
      type: "invoice",
      source: inv.source || "app",
    });

    // Payment line (credit) if paid
    if (amtPaid > 0) {
      balance -= amtPaid;
      lines.push({
        date: inv.updatedAt || date,
        ref: `Payment - ${inv.invoiceNumber || ""}`,
        description: "Payment Received",
        debit: 0,
        credit: amtPaid,
        balance,
        type: "payment",
        source: inv.source || "app",
      });
    }
  }

  // Add any standalone payments
  for (const pmt of (payments || [])) {
    const existing = lines.find((l: any) => l.ref === `Payment - ${pmt.invoiceNumber || ""}`);
    if (!existing && pmt.amount > 0) {
      balance -= pmt.amount;
      lines.push({
        date: pmt.date || pmt.createdAt,
        ref: `Payment - ${pmt.invoiceNumber || pmt.receiptNumber || ""}`,
        description: "Payment Received",
        debit: 0,
        credit: pmt.amount,
        balance,
        type: "payment",
        source: "app",
      });
    }
  }

  // Sort all lines by date
  lines.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Recalculate running balance after sort
  let runningBal = 0;
  for (const line of lines) {
    runningBal += line.debit - line.credit;
    line.balance = runningBal;
  }

  const totalDebit = lines.reduce((s: number, l: any) => s + l.debit, 0);
  const totalCredit = lines.reduce((s: number, l: any) => s + l.credit, 0);

  function printStatement() {
    window.print();
  }

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
        <button onClick={printStatement} className="btn-primary">
          <Printer className="w-4 h-4" /> Print Statement
        </button>
      </div>

      {/* Statement Header */}
      <div className="text-center mb-8 statement-header">
        <img src="/sgf-logo.png" alt="SGF" className="h-16 mx-auto mb-4" />
        <h1 className="font-display text-2xl font-semibold text-white">Customer Statement</h1>
        <div className="mt-4 text-sm text-[#8A8B8C]">
          <p className="font-semibold text-white text-lg">{customer.name}</p>
          {customer.customerCode && <p>Code: {customer.customerCode}</p>}
          {customer.phone && <p>Tel: {customer.phone}</p>}
          {customer.email && <p>Email: {customer.email}</p>}
          <p className="mt-2">Statement Date: {new Date().toLocaleDateString("en-ZA")}</p>
        </div>
      </div>

      {/* Statement Table */}
      {lines.length === 0 ? (
        <div className="text-center py-12 text-[#8A8B8C]">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No transaction history for this customer.</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2" style={{ borderColor: "#D4A843" }}>
                  <th className="text-left p-3 text-[#8A8B8C] font-medium">Date</th>
                  <th className="text-left p-3 text-[#8A8B8C] font-medium">Reference</th>
                  <th className="text-left p-3 text-[#8A8B8C] font-medium">Description</th>
                  <th className="text-right p-3 text-[#8A8B8C] font-medium">Debit (R)</th>
                  <th className="text-right p-3 text-[#8A8B8C] font-medium">Credit (R)</th>
                  <th className="text-right p-3 text-[#8A8B8C] font-medium">Balance (R)</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line: any, idx: number) => (
                  <tr
                    key={idx}
                    className="border-b"
                    style={{
                      borderColor: "#222324",
                      backgroundColor: line.type === "payment" ? "rgba(74,222,128,0.05)" : "transparent",
                    }}
                  >
                    <td className="p-3 text-white whitespace-nowrap">
                      {new Date(line.date).toLocaleDateString("en-ZA")}
                    </td>
                    <td className="p-3 font-mono-data text-[#D4A843]">{line.ref}</td>
                    <td className="p-3 text-white">
                      {line.description}
                      {line.source === "sage" && (
                        <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "rgba(99,102,241,0.2)", color: "#6366F1" }}>
                          SAGE
                        </span>
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
                  <td className="p-3 text-right font-bold" style={{ color: "#D4A843", fontSize: "1.1em" }}>
                    {runningBal.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}
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
            <div className="flex justify-between text-sm mt-1">
              <span className="text-[#8A8B8C]">Total Debits:</span>
              <span className="text-white font-semibold">R {totalDebit.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className="text-[#8A8B8C]">Total Credits:</span>
              <span className="font-semibold" style={{ color: "#4ADE80" }}>R {totalCredit.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-sm mt-2 pt-2 border-t" style={{ borderColor: "#333435" }}>
              <span className="text-white font-semibold">Balance Due:</span>
              <span className="font-bold" style={{ color: runningBal > 0 ? "#D4A843" : "#4ADE80", fontSize: "1.1em" }}>
                R {runningBal.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </>
      )}

      {/* Footer */}
      <div className="mt-8 text-center text-xs text-[#8A8B8C] statement-footer">
        <p>Supreme Global Foods (Pty) Ltd</p>
        <p>For queries contact: accounts@supremeglobalfoods.co.za</p>
        <p className="mt-1">This statement was generated on {new Date().toLocaleDateString("en-ZA")}</p>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; color: black !important; }
          .statement-header { page-break-after: avoid; }
          .statement-footer { page-break-before: avoid; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; page-break-after: auto; }
        }
      `}</style>
    </div>
  );
}
