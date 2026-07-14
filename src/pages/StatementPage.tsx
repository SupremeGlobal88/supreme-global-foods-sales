import { useParams, useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import { ArrowLeft, Printer, Calendar } from "lucide-react";
import { useState } from "react";

/** Build and open a professional printable statement in a new window.
 *  White background, SGF logo, company details, accounting format. */
function openPrintWindow(
  customer: any,
  invoices: any[],
  stmtFrom: string,
  stmtTo: string,
) {
  const logoUrl = `${window.location.origin}/sgf-logo.png`;
  const fromStr = stmtFrom
    ? new Date(stmtFrom).toLocaleDateString("en-ZA")
    : "All time";
  const toStr = stmtTo
    ? new Date(stmtTo).toLocaleDateString("en-ZA")
    : new Date().toLocaleDateString("en-ZA");

  let runningBal = 0;
  const lines = invoices.map((inv: any) => {
    const debit = Number(inv.total || 0);
    const credit = Number(inv.amountPaid || 0);
    runningBal += debit - credit;
    return {
      date: inv.invoiceDate || inv.createdAt,
      invoiceNumber: inv.invoiceNumber || "",
      orderNumber: inv.orderNumber || "",
      description:
        inv.source === "sage"
          ? "Sage Historical Invoice"
          : inv.notes || "Invoice",
      paymentTerms: inv.paymentTerms || "cod",
      debit,
      credit,
      balance: runningBal,
      isSage: inv.source === "sage",
    };
  });

  const totalDebit = invoices.reduce(
    (s: number, i: any) => s + Number(i.total || 0),
    0,
  );
  const totalCredit = invoices.reduce(
    (s: number, i: any) => s + Number(i.amountPaid || 0),
    0,
  );
  const closingBal = totalDebit - totalCredit;

  // Aging
  const now = new Date();
  const aging = { current: 0, days30: 0, days60: 0, days90: 0, days90plus: 0 };
  for (const inv of invoices) {
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
  const totalOutstanding =
    aging.current + aging.days30 + aging.days60 + aging.days90 + aging.days90plus;

  const sageStyle = `color:#6366F1;font-size:9px;background:rgba(99,102,241,0.08);padding:1px 4px;border-radius:2px;`;

  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(
    `<!DOCTYPE html><html><head><title>Statement - ${customer.name}</title>` +
      `<style>` +
      `@media print{body{padding:0 12px}}` +
      `body{font-family:Arial,Helvetica,sans-serif;color:#333;max-width:210mm;margin:0 auto;font-size:11px;line-height:1.4;padding:20px;background:#fff}` +
      `.header{text-align:center;border-bottom:3px solid #D4A843;padding-bottom:10px;margin-bottom:16px}` +
      `.header img{height:55px;margin-bottom:4px}` +
      `.header h1{font-size:20px;font-weight:800;color:#D4A843;margin:6px 0;letter-spacing:1px;text-transform:uppercase}` +
      `.header .subtitle{font-size:10px;color:#666;line-height:1.5}` +
      `.info-grid{display:flex;justify-content:space-between;margin-bottom:16px;font-size:11px}` +
      `.info-block .label{font-size:10px;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:2px}` +
      `.info-block .value{font-weight:700;font-size:13px;color:#222}` +
      `table.ledger{width:100%;border-collapse:collapse;font-size:10.5px}` +
      `table.ledger thead th{background:#D4A843;color:#fff;padding:7px 8px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:0.5px}` +
      `table.ledger tbody td{padding:6px 8px;border-bottom:1px solid #e5e5e5;vertical-align:top}` +
      `table.ledger .num{text-align:right}` +
      `table.ledger .bal-positive{color:#c00;font-weight:700}` +
      `.summary{margin-top:12px;display:flex;justify-content:flex-end}` +
      `.summary-box{width:260px;font-size:11px}` +
      `.summary-box .row{display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #e5e5e5}` +
      `.summary-box .total{font-weight:800;font-size:13px;border-top:2px solid #D4A843;border-bottom:2px solid #D4A843;padding:6px 0;margin-top:2px}` +
      `.footer{text-align:center;font-size:9px;color:#999;margin-top:20px;border-top:1px solid #ddd;padding-top:8px}` +
      `.overdue-note{background:#FFF5F5;border:1px solid #EF4444;color:#EF4444;padding:6px;border-radius:3px;font-size:10px;font-weight:700;text-align:center;margin-top:12px}` +
      `.aging{margin-top:16px;border:1px solid #D4A843;border-radius:6px;overflow:hidden}` +
      `.aging-header{background:#D4A843;color:#fff;padding:6px 10px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px}` +
      `.aging table{width:100%;border-collapse:collapse;font-size:10.5px}` +
      `.aging th{padding:6px 8px;text-align:left;background:#f9f9f9;border-bottom:1px solid #e5e5e5}` +
      `.aging td{padding:6px 8px;border-bottom:1px solid #e5e5e5}` +
      `</style></head><body>` +
      // Header
      `<div class="header">` +
      `<img src="${logoUrl}" onerror="this.style.display='none'"/>` +
      `<div class="subtitle">28 Nagington road, Wadeville, Germiston, 1422 &nbsp;|&nbsp; sales@supremeglobalfoods.co.za &nbsp;|&nbsp; Tel: 083 293 0644<br/>VAT Reg: 4120123456 &nbsp;|&nbsp; Reg No: 2015/123456/07</div>` +
      `<h1>Statement of Account</h1>` +
      `<div style="font-size:10px;color:#666">Period: ${fromStr} &nbsp;to&nbsp; ${toStr} &nbsp;|&nbsp; Generated: ${new Date().toLocaleDateString("en-ZA")}</div>` +
      `</div>` +
      // Customer + Summary
      `<div class="info-grid">` +
      `<div class="info-block">` +
      `<div class="label">Customer</div>` +
      `<div class="value">${customer.name}</div>` +
      `<div>${customer.contactPerson || ""}</div>` +
      `<div>${customer.physicalAddress || ""}${customer.city ? `, ${customer.city}` : ""}</div>` +
      `<div>Tel: ${customer.phone || "N/A"}</div>` +
      (customer.email ? `<div>${customer.email}</div>` : "") +
      `</div>` +
      `<div class="info-block" style="text-align:right">` +
      `<div class="label">Account Summary</div>` +
      `<div style="margin-top:4px">Code: <strong>${customer.customerCode || "N/A"}</strong></div>` +
      `<div>Total Debit: <strong>R ${totalDebit.toFixed(2)}</strong></div>` +
      `<div>Total Credit: <strong>R ${totalCredit.toFixed(2)}</strong></div>` +
      (closingBal > 0
        ? `<div style="color:#c00;font-weight:800;font-size:13px;margin-top:4px">BALANCE DUE: R ${closingBal.toFixed(2)}</div>`
        : `<div style="color:#2E7D32;font-weight:800;font-size:13px;margin-top:4px">ACCOUNT SETTLED</div>`) +
      `</div></div>` +
      // Ledger table
      `<table class="ledger"><thead><tr>` +
      `<th style="width:12%">Date</th><th style="width:16%">Invoice #</th><th style="width:14%">Order #</th>` +
      `<th>Description</th><th style="width:12%" class="num">Debit (R)</th>` +
      `<th style="width:12%" class="num">Credit (R)</th><th style="width:12%" class="num">Balance (R)</th>` +
      `</tr></thead><tbody>` +
      (lines.length === 0
        ? `<tr><td colspan="7" style="text-align:center;color:#999;padding:16px">No invoices for the selected period.</td></tr>`
        : lines
            .map(
              (line: any) =>
                `<tr>` +
                `<td>${new Date(line.date).toLocaleDateString("en-ZA")}</td>` +
                `<td><strong>${line.invoiceNumber}</strong>${line.isSage ? ` <span style="${sageStyle}">SAGE</span>` : ""}</td>` +
                `<td>${line.orderNumber || ""}</td>` +
                `<td>${line.description} <span style="color:#888">(${(line.paymentTerms || "cod").replace("_", " ")})</span></td>` +
                `<td class="num">${line.debit > 0 ? line.debit.toFixed(2) : "-"}</td>` +
                `<td class="num" style="color:#2E7D32">${line.credit > 0 ? line.credit.toFixed(2) : "-"}</td>` +
                `<td class="num ${line.balance > 0 ? "bal-positive" : ""}">${line.balance.toFixed(2)}</td>` +
                `</tr>`,
            )
            .join("")) +
      `</tbody></table>` +
      // Summary box
      `<div class="summary"><div class="summary-box">` +
      `<div class="row"><span style="color:#666">Subtotal Debit</span><strong>R ${totalDebit.toFixed(2)}</strong></div>` +
      `<div class="row"><span style="color:#666">Subtotal Credit</span><strong>R ${totalCredit.toFixed(2)}</strong></div>` +
      `<div class="total" style="${closingBal > 0 ? "color:#c00" : "color:#2E7D32"}">` +
      `<span>${closingBal > 0 ? "CLOSING BALANCE DUE" : "ACCOUNT BALANCE"}</span>` +
      `<strong>R ${Math.abs(closingBal).toFixed(2)}</strong></div>` +
      `</div></div>` +
      // Aging
      (totalOutstanding > 0
        ? `<div class="aging"><div class="aging-header">Outstanding Balance Aging</div>` +
          `<table><thead><tr style="background:#f9f9f9">` +
          `<th style="padding:6px 8px;text-align:left;border-bottom:1px solid #e5e5e5">Current (0-30d)</th>` +
          `<th style="padding:6px 8px;text-align:right;border-bottom:1px solid #e5e5e5">30 Days</th>` +
          `<th style="padding:6px 8px;text-align:right;border-bottom:1px solid #e5e5e5">60 Days</th>` +
          `<th style="padding:6px 8px;text-align:right;border-bottom:1px solid #e5e5e5">90 Days</th>` +
          `<th style="padding:6px 8px;text-align:right;border-bottom:1px solid #e5e5e5;color:#c00">90+ Days</th>` +
          `<th style="padding:6px 8px;text-align:right;border-bottom:1px solid #e5e5e5;background:#D4A843;color:#fff">Total Outstanding</th>` +
          `</tr></thead><tbody><tr>` +
          `<td style="padding:6px 8px;border-bottom:1px solid #e5e5e5"><strong>R ${aging.current.toFixed(2)}</strong></td>` +
          `<td style="padding:6px 8px;text-align:right;border-bottom:1px solid #e5e5e5">R ${aging.days30.toFixed(2)}</td>` +
          `<td style="padding:6px 8px;text-align:right;border-bottom:1px solid #e5e5e5">R ${aging.days60.toFixed(2)}</td>` +
          `<td style="padding:6px 8px;text-align:right;border-bottom:1px solid #e5e5e5">R ${aging.days90.toFixed(2)}</td>` +
          `<td style="padding:6px 8px;text-align:right;border-bottom:1px solid #e5e5e5;color:#c00;font-weight:700">R ${aging.days90plus.toFixed(2)}</td>` +
          `<td style="padding:6px 8px;text-align:right;border-bottom:1px solid #e5e5e5;font-weight:800;background:#FFF9E6">R ${totalOutstanding.toFixed(2)}</td>` +
          `</tr></tbody></table></div>`
        : "") +
      // Footer note + banking
      (closingBal > 0
        ? `<div class="overdue-note">Please arrange payment within your agreed terms. Outstanding balance must be settled to avoid account hold.</div>`
        : "") +
      `<div class="footer">` +
      `Supreme Global Foods &nbsp;|&nbsp; 28 Nagington road, Wadeville, Germiston, 1422 &nbsp;|&nbsp; 083 293 0644<br/>` +
      `Banking: FNB | Acc: 62001234567 | Branch: 250655 | Quote customer code with payment` +
      `</div>` +
      // Auto-print
      `<script>(function(){var d=false;function p(){if(!d){d=true;setTimeout(function(){window.print()},200)}}if(document.readyState==="complete")p();else window.onload=p;setTimeout(p,2000)})()</script>` +
      `</body></html>`,
  );
  w.document.close();
}

export default function StatementPage() {
  const { customerId } = useParams<{ customerId: string }>();
  const navigate = useNavigate();
  const cid = parseInt(customerId || "0");

  const { data: invoices, isLoading: invLoading } =
    trpc.invoice.list.useQuery();
  const { data: allCustomers } = trpc.customer.list.useQuery();

  const customer = (allCustomers || []).find((c: any) => c.id === cid);
  const custName = customer?.name || "";
  const custCode = customer?.customerCode || "";

  // Date range for filtering and printing
  const [stmtFrom, setStmtFrom] = useState("2020-01-01");
  const [stmtTo, setStmtTo] = useState(new Date().toISOString().slice(0, 10));

  // Filter invoices for this customer — match by customerId, customer.name, or customerCode
  // Handles both new format (10001) and legacy format (CUST0001) for backward compatibility
  const legacyCustCode = custCode ? "CUST" + custCode.padStart(4, "0") : "";
  let custInvoices = (invoices || []).filter((i: any) => {
    if (i.customerId === cid) return true;
    if (i.customer && i.customer.name === custName) return true;
    if (i.customerCode === custCode && custCode !== "") return true;
    if (i.customerCode === legacyCustCode && legacyCustCode !== "") return true;
    if (i.customer && i.customer.customerCode === custCode && custCode !== "")
      return true;
    return false;
  });

  // Apply date range filter
  if (stmtFrom)
    custInvoices = custInvoices.filter(
      (i: any) =>
        new Date(i.invoiceDate || i.createdAt) >= new Date(stmtFrom),
    );
  if (stmtTo)
    custInvoices = custInvoices.filter(
      (i: any) =>
        new Date(i.invoiceDate || i.createdAt) <=
        new Date(stmtTo + "T23:59:59"),
    );

  custInvoices = custInvoices.sort(
    (a: any, b: any) =>
      new Date(a.invoiceDate || a.createdAt).getTime() -
      new Date(b.invoiceDate || b.createdAt).getTime(),
  );

  // Build statement lines
  const lines: any[] = [];
  let balance = 0;

  for (const inv of custInvoices) {
    const date = inv.invoiceDate || inv.createdAt;
    const desc =
      inv.source === "sage"
        ? `Sage Invoice`
        : `Invoice for ${inv.orderNumber || ""}`;
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

  // Aging buckets
  const now = new Date();
  const aging = {
    current: 0,
    days30: 0,
    days60: 0,
    days90: 0,
    days90plus: 0,
  };
  for (const inv of custInvoices) {
    const bal =
      Number(inv.balanceDue || inv.total || 0) - Number(inv.amountPaid || 0);
    if (bal <= 0) continue;
    const invDate = new Date(inv.invoiceDate || inv.createdAt);
    const daysDiff = Math.floor(
      (now.getTime() - invDate.getTime()) / 86400000,
    );
    if (daysDiff <= 30) aging.current += bal;
    else if (daysDiff <= 60) aging.days30 += bal;
    else if (daysDiff <= 90) aging.days60 += bal;
    else if (daysDiff <= 120) aging.days90 += bal;
    else aging.days90plus += bal;
  }
  const totalOutstanding =
    aging.current +
    aging.days30 +
    aging.days60 +
    aging.days90 +
    aging.days90plus;

  if (!customer) {
    return (
      <div className="p-8 text-center">
        <p className="text-[#8A8B8C]">Customer not found</p>
        <button
          onClick={() => navigate("/invoices")}
          className="btn-primary mt-4"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Invoices
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 no-print">
        <button
          onClick={() => navigate("/invoices")}
          className="btn-secondary"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="flex gap-2">
          <button
            onClick={() =>
              openPrintWindow(customer, custInvoices, stmtFrom, stmtTo)
            }
            className="btn-primary"
          >
            <Printer className="w-4 h-4" /> Print / Email
          </button>
        </div>
      </div>

      {/* Date Range */}
      <div
        className="no-print mb-4 p-4 rounded-lg"
        style={{ backgroundColor: "#222324" }}
      >
        <div className="flex items-center gap-3 flex-wrap">
          <Calendar className="w-4 h-4 text-[#D4A843]" />
          <label className="text-xs text-[#8A8B8C]">From</label>
          <input
            type="date"
            value={stmtFrom}
            onChange={(e) => setStmtFrom(e.target.value)}
            className="input-field text-xs py-1 px-2"
          />
          <label className="text-xs text-[#8A8B8C]">To</label>
          <input
            type="date"
            value={stmtTo}
            onChange={(e) => setStmtTo(e.target.value)}
            className="input-field text-xs py-1 px-2"
          />
          <span className="text-xs text-[#8A8B8C]">
            {custInvoices.length} invoice
            {custInvoices.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Statement Header */}
      <div className="text-center mb-8">
        <h1 className="font-display text-2xl font-semibold text-white">
          Customer Statement
        </h1>
        <div className="mt-4 text-sm text-[#8A8B8C]">
          <p className="font-semibold text-white text-lg">{customer.name}</p>
          {customer.customerCode && <p>Code: {customer.customerCode}</p>}
          {customer.phone && <p>Tel: {customer.phone}</p>}
          <p className="mt-2">
            Date: {new Date().toLocaleDateString("en-ZA")}
          </p>
        </div>
      </div>

      {/* Statement Table */}
      {invLoading ? (
        <div className="text-center py-12 text-[#8A8B8C]">Loading...</div>
      ) : lines.length === 0 ? (
        <div className="text-center py-12 text-[#8A8B8C]">
          No invoices for this customer.
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr
                  className="border-b-2"
                  style={{ borderColor: "#D4A843" }}
                >
                  <th className="text-left p-3 text-[#8A8B8C]">Date</th>
                  <th className="text-left p-3 text-[#8A8B8C]">
                    Reference
                  </th>
                  <th className="text-left p-3 text-[#8A8B8C]">
                    Description
                  </th>
                  <th className="text-right p-3 text-[#8A8B8C]">
                    Debit (R)
                  </th>
                  <th className="text-right p-3 text-[#8A8B8C]">
                    Credit (R)
                  </th>
                  <th className="text-right p-3 text-[#8A8B8C]">
                    Balance (R)
                  </th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line: any, idx: number) => (
                  <tr
                    key={idx}
                    className="border-b"
                    style={{ borderColor: "#222324" }}
                  >
                    <td className="p-3 text-white whitespace-nowrap">
                      {new Date(line.date).toLocaleDateString("en-ZA")}
                    </td>
                    <td className="p-3 font-mono-data text-[#D4A843]">
                      {line.ref}
                    </td>
                    <td className="p-3 text-white">
                      {line.description}
                      {line.source === "sage" && (
                        <span
                          className="ml-2 text-[10px] px-1.5 py-0.5 rounded"
                          style={{
                            backgroundColor: "rgba(99,102,241,0.2)",
                            color: "#6366F1",
                          }}
                        >
                          SAGE
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-right text-white">
                      {line.debit > 0
                        ? line.debit.toLocaleString("en-ZA", {
                            minimumFractionDigits: 2,
                          })
                        : ""}
                    </td>
                    <td
                      className="p-3 text-right"
                      style={{ color: "#4ADE80" }}
                    >
                      {line.credit > 0
                        ? line.credit.toLocaleString("en-ZA", {
                            minimumFractionDigits: 2,
                          })
                        : ""}
                    </td>
                    <td
                      className="p-3 text-right font-semibold"
                      style={{
                        color: line.balance > 0 ? "#D4A843" : "#4ADE80",
                      }}
                    >
                      {line.balance.toLocaleString("en-ZA", {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr
                  className="border-t-2"
                  style={{ borderColor: "#D4A843" }}
                >
                  <td
                    colSpan={3}
                    className="p-3 font-semibold text-white text-right"
                  >
                    TOTALS
                  </td>
                  <td className="p-3 text-right font-semibold text-white">
                    {totalDebit.toLocaleString("en-ZA", {
                      minimumFractionDigits: 2,
                    })}
                  </td>
                  <td
                    className="p-3 text-right font-semibold"
                    style={{ color: "#4ADE80" }}
                  >
                    {totalCredit.toLocaleString("en-ZA", {
                      minimumFractionDigits: 2,
                    })}
                  </td>
                  <td
                    className="p-3 text-right font-bold"
                    style={{ color: "#D4A843" }}
                  >
                    {(totalDebit - totalCredit).toLocaleString("en-ZA", {
                      minimumFractionDigits: 2,
                    })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Summary */}
          <div
            className="mt-6 p-4 rounded-lg"
            style={{ backgroundColor: "#222324" }}
          >
            <div className="flex justify-between text-sm">
              <span className="text-[#8A8B8C]">Total Invoices:</span>
              <span className="text-white font-semibold">
                {custInvoices.length}
              </span>
            </div>
            <div
              className="flex justify-between text-sm mt-2 pt-2 border-t"
              style={{ borderColor: "#333435" }}
            >
              <span className="text-white font-semibold">Balance Due:</span>
              <span
                className="font-bold"
                style={{
                  color:
                    totalDebit - totalCredit > 0 ? "#D4A843" : "#4ADE80",
                }}
              >
                R{" "}
                {(totalDebit - totalCredit).toLocaleString("en-ZA", {
                  minimumFractionDigits: 2,
                })}
              </span>
            </div>
          </div>

          {/* Aging Summary */}
          {totalOutstanding > 0 && (
            <div
              className="mt-6 rounded-lg overflow-hidden"
              style={{ border: "1px solid #D4A843" }}
            >
              <div
                className="px-4 py-2 text-xs font-bold text-white uppercase tracking-wider"
                style={{ backgroundColor: "#D4A843" }}
              >
                Outstanding Balance Aging
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ backgroundColor: "#131415" }}>
                      <th className="p-3 text-left text-[#8A8B8C]">
                        Current (0-30d)
                      </th>
                      <th className="p-3 text-right text-[#8A8B8C]">
                        30 Days
                      </th>
                      <th className="p-3 text-right text-[#8A8B8C]">
                        60 Days
                      </th>
                      <th className="p-3 text-right text-[#8A8B8C]">
                        90 Days
                      </th>
                      <th
                        className="p-3 text-right text-[#8A8B8C]"
                        style={{ color: "#EF4444" }}
                      >
                        90+ Days
                      </th>
                      <th
                        className="p-3 text-right text-white"
                        style={{
                          backgroundColor: "rgba(212,168,67,0.2)",
                        }}
                      >
                        Total Outstanding
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderTop: "1px solid #222324" }}>
                      <td className="p-3 text-white font-semibold">
                        R{" "}
                        {aging.current.toLocaleString("en-ZA", {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                      <td className="p-3 text-right text-white">
                        R{" "}
                        {aging.days30.toLocaleString("en-ZA", {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                      <td className="p-3 text-right text-white">
                        R{" "}
                        {aging.days60.toLocaleString("en-ZA", {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                      <td className="p-3 text-right text-white">
                        R{" "}
                        {aging.days90.toLocaleString("en-ZA", {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                      <td
                        className="p-3 text-right font-semibold"
                        style={{ color: "#EF4444" }}
                      >
                        R{" "}
                        {aging.days90plus.toLocaleString("en-ZA", {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                      <td
                        className="p-3 text-right font-bold text-[#D4A843]"
                        style={{
                          backgroundColor: "rgba(212,168,67,0.08)",
                        }}
                      >
                        R{" "}
                        {totalOutstanding.toLocaleString("en-ZA", {
                          minimumFractionDigits: 2,
                        })}
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
