import { useState, useMemo } from "react";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { Printer, Calendar, User, FileText, ArrowLeft, Search } from "lucide-react";
import { useNavigate } from "react-router";

/** Customer Statement — Clean Slate
 *  Uses the EXACT same data as the Invoices page.
 *  Select a customer → see ALL their invoices (Sage + app) → print proper statement.
 */
export default function CustomerStatementPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  const { data: invoices } = trpc.invoice.list.useQuery();
  const { data: customers } = trpc.customer.search.useQuery({ query: " " });

  const [selectedCustomerId, setSelectedCustomerId] = useState<number>(0);
  const [stmtFrom, setStmtFrom] = useState("2020-01-01");
  const [stmtTo, setStmtTo] = useState(new Date().toISOString().slice(0, 10));
  const [searchTerm, setSearchTerm] = useState("");

  // Selected customer object
  const selectedCustomer = useMemo(() => {
    return (customers || []).find((c: any) => c.id === selectedCustomerId) || null;
  }, [customers, selectedCustomerId]);

  // Filtered invoices for selected customer — EXACT same approach as InvoicesPage
  // The invoice page simply checks: invoice.customer.name.includes(searchTerm)
  // We do the same: match by customerId OR by customer name (contains, not exact)
  const custInvoices = useMemo(() => {
    if (!selectedCustomer || !invoices) return [];
    const cName = (selectedCustomer.name || "").toLowerCase().trim();
    const cId = selectedCustomer.id;

    return invoices
      .filter((inv: any) => {
        // 1. Match by customerId — app invoices and linked Sage invoices
        if (inv.customerId && inv.customerId === cId) return true;
        // 2. Match by nested customer.name — same as invoice page search!
        const invCustName = (inv.customer?.name || "").toLowerCase().trim();
        if (invCustName && invCustName === cName) return true;
        // 3. Match by top-level customerName field (Sage invoices)
        const invTopName = (inv.customerName || "").toLowerCase().trim();
        if (invTopName && invTopName === cName) return true;
        // 4. Match by customerCode
        const invCode = (inv.customerCode || "").toString().trim().toLowerCase();
        const cCode = (selectedCustomer.customerCode || "").toString().trim().toLowerCase();
        if (invCode && cCode && invCode === cCode) return true;
        return false;
      })
      .filter((inv: any) => {
        const d = new Date(inv.invoiceDate || inv.createdAt);
        return d >= new Date(stmtFrom) && d <= new Date(stmtTo + "T23:59:59");
      })
      .sort((a: any, b: any) =>
        new Date(a.invoiceDate || a.createdAt).getTime() -
        new Date(b.invoiceDate || b.createdAt).getTime()
      );
  }, [invoices, selectedCustomer, stmtFrom, stmtTo]);

  // Build running balance ledger lines
  const lines = useMemo(() => {
    const result: any[] = [];
    let bal = 0;
    for (const inv of custInvoices) {
      const debit = Number(inv.total || 0);
      const credit = Number(inv.amountPaid || 0);
      bal += debit;
      result.push({
        date: inv.invoiceDate || inv.createdAt,
        ref: inv.invoiceNumber || inv.orderNumber || "-",
        desc: inv.source === "sage" ? "Sage Historical Invoice" : (inv.notes || `Invoice`),
        terms: inv.paymentTerms || "cod",
        debit,
        credit: 0,
        balance: bal,
        source: inv.source || "app",
      });
      if (credit > 0) {
        bal -= credit;
        result.push({
          date: inv.updatedAt || inv.invoiceDate || inv.createdAt,
          ref: "Payment",
          desc: "Payment Received",
          terms: "",
          debit: 0,
          credit,
          balance: bal,
          source: "app",
        });
      }
    }
    return result;
  }, [custInvoices]);

  const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
  const totalCredit = lines.reduce((s, l) => s + l.credit, 0);

  // Aging
  const aging = useMemo(() => {
    const a = { current: 0, days30: 0, days60: 0, days90: 0, days90plus: 0 };
    const now = new Date();
    for (const inv of custInvoices) {
      const bal = Number(inv.balanceDue || inv.total || 0) - Number(inv.amountPaid || 0);
      if (bal <= 0) continue;
      const dd = Math.floor((now.getTime() - new Date(inv.invoiceDate || inv.createdAt).getTime()) / 86400000);
      if (dd <= 30) a.current += bal;
      else if (dd <= 60) a.days30 += bal;
      else if (dd <= 90) a.days60 += bal;
      else if (dd <= 120) a.days90 += bal;
      else a.days90plus += bal;
    }
    return a;
  }, [custInvoices]);

  const totalOutstanding = aging.current + aging.days30 + aging.days60 + aging.days90 + aging.days90plus;

  // Customer dropdown list (filtered by search)
  const filteredCustomers = useMemo(() => {
    if (!customers) return [];
    const sorted = [...customers].sort((a: any, b: any) => a.name?.localeCompare(b.name || "") || 0);
    const q = searchTerm.toLowerCase().trim();
    if (!q) return sorted;
    return sorted.filter((c: any) =>
      (c.name || "").toLowerCase().includes(q) ||
      (c.customerCode || "").toString().toLowerCase().includes(q)
    );
  }, [customers, searchTerm]);

  // ─── PRINT ───
  function printStatement() {
    if (!selectedCustomer || custInvoices.length === 0) return;
    const logoUrl = `${window.location.origin}/sgf-logo.png`;
    const fromStr = new Date(stmtFrom).toLocaleDateString("en-ZA");
    const toStr = new Date(stmtTo).toLocaleDateString("en-ZA");
    const closingBal = totalDebit - totalCredit;

    const ledgerRows = lines.map(l =>
      `<tr>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e5e5;font-size:10.5px;white-space:nowrap">${new Date(l.date).toLocaleDateString("en-ZA")}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e5e5;font-size:10.5px;font-weight:600;color:#D4A843">${l.ref}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e5e5;font-size:10.5px">${l.desc}${l.source === "sage" ? ' <span style="color:#6366F1;font-size:9px;background:rgba(99,102,241,0.08);padding:1px 4px;border-radius:2px">SAGE</span>' : ""} <span style="color:#888">(${(l.terms || "cod").replace("_", " ")})</span></td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e5e5;font-size:10.5px;text-align:right">${l.debit > 0 ? l.debit.toFixed(2) : "-"}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e5e5;font-size:10.5px;text-align:right;color:#2E7D32">${l.credit > 0 ? l.credit.toFixed(2) : "-"}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e5e5;font-size:10.5px;text-align:right;font-weight:700;${l.balance > 0 ? "color:#c00" : ""}">${l.balance.toFixed(2)}</td>
      </tr>`
    ).join("");

    const agingHtml = totalOutstanding > 0 ? `
      <div style="margin-top:16px;border:1px solid #D4A843;border-radius:6px;overflow:hidden">
        <div style="background:#D4A843;color:#fff;padding:6px 10px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px">Outstanding Balance Aging</div>
        <table style="width:100%;border-collapse:collapse;font-size:10.5px">
          <thead><tr style="background:#f9f9f9">
            <th style="padding:6px 8px;text-align:left;border-bottom:1px solid #e5e5e5">Current (0-30d)</th>
            <th style="padding:6px 8px;text-align:right;border-bottom:1px solid #e5e5e5">30 Days</th>
            <th style="padding:6px 8px;text-align:right;border-bottom:1px solid #e5e5e5">60 Days</th>
            <th style="padding:6px 8px;text-align:right;border-bottom:1px solid #e5e5e5">90 Days</th>
            <th style="padding:6px 8px;text-align:right;border-bottom:1px solid #e5e5e5;color:#c00">90+ Days</th>
            <th style="padding:6px 8px;text-align:right;border-bottom:1px solid #e5e5e5;background:#D4A843;color:#fff">Total Outstanding</th>
          </tr></thead>
          <tbody><tr>
            <td style="padding:6px 8px;border-bottom:1px solid #e5e5e5"><strong>R ${aging.current.toFixed(2)}</strong></td>
            <td style="padding:6px 8px;text-align:right;border-bottom:1px solid #e5e5e5">R ${aging.days30.toFixed(2)}</td>
            <td style="padding:6px 8px;text-align:right;border-bottom:1px solid #e5e5e5">R ${aging.days60.toFixed(2)}</td>
            <td style="padding:6px 8px;text-align:right;border-bottom:1px solid #e5e5e5">R ${aging.days90.toFixed(2)}</td>
            <td style="padding:6px 8px;text-align:right;border-bottom:1px solid #e5e5e5;color:#c00;font-weight:700">R ${aging.days90plus.toFixed(2)}</td>
            <td style="padding:6px 8px;text-align:right;border-bottom:1px solid #e5e5e5;font-weight:800;background:#FFF9E6">R ${totalOutstanding.toFixed(2)}</td>
          </tr></tbody>
        </table>
      </div>` : "";

    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>Statement - ${selectedCustomer.name}</title><style>
      @media print{body{padding:0 12px}}
      body{font-family:Arial,Helvetica,sans-serif;color:#333;max-width:210mm;margin:0 auto;font-size:11px;line-height:1.4;padding:20px;background:#fff}
      .header{text-align:center;border-bottom:3px solid #D4A843;padding-bottom:10px;margin-bottom:16px}
      .header img{height:55px;margin-bottom:4px}
      .header h1{font-size:20px;font-weight:800;color:#D4A843;margin:6px 0;letter-spacing:1px;text-transform:uppercase}
      .header .subtitle{font-size:10px;color:#666;line-height:1.5}
      .info-grid{display:flex;justify-content:space-between;margin-bottom:16px;font-size:11px}
      .info-block .label{font-size:10px;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:2px}
      .info-block .value{font-weight:700;font-size:13px;color:#222}
      table.ledger{width:100%;border-collapse:collapse;font-size:10.5px}
      table.ledger thead th{background:#D4A843;color:#fff;padding:7px 8px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:0.5px}
      table.ledger tbody td{padding:6px 8px;border-bottom:1px solid #e5e5e5;vertical-align:top}
      table.ledger .num{text-align:right}
      .summary{margin-top:12px;display:flex;justify-content:flex-end}
      .summary-box{width:260px;font-size:11px}
      .summary-box .row{display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #e5e5e5}
      .summary-box .total{font-weight:800;font-size:13px;border-top:2px solid #D4A843;border-bottom:2px solid #D4A843;padding:6px 0;margin-top:2px}
      .footer{text-align:center;font-size:9px;color:#999;margin-top:20px;border-top:1px solid #ddd;padding-top:8px}
      .overdue-note{background:#FFF5F5;border:1px solid #EF4444;color:#EF4444;padding:6px;border-radius:3px;font-size:10px;font-weight:700;text-align:center;margin-top:12px}
    </style></head><body>
      <div class="header">
        <img src="${logoUrl}" onerror="this.style.display='none'"/>
        <div class="subtitle">28 Nagington road, Wadeville, Germiston, 1422 &nbsp;|&nbsp; sales@supremeglobalfoods.co.za &nbsp;|&nbsp; Tel: 083 293 0644<br/>VAT Reg: 4120123456 &nbsp;|&nbsp; Reg No: 2015/123456/07</div>
        <h1>Statement of Account</h1>
        <div style="font-size:10px;color:#666">Period: ${fromStr} &nbsp;to&nbsp; ${toStr} &nbsp;|&nbsp; Generated: ${new Date().toLocaleDateString("en-ZA")}</div>
      </div>
      <div class="info-grid">
        <div class="info-block">
          <div class="label">Customer</div>
          <div class="value">${selectedCustomer.name}</div>
          <div>${selectedCustomer.contactPerson || ""}</div>
          <div>${selectedCustomer.physicalAddress || ""}${selectedCustomer.city ? `, ${selectedCustomer.city}` : ""}</div>
          <div>Tel: ${selectedCustomer.phone || "N/A"}</div>
          ${selectedCustomer.email ? `<div>${selectedCustomer.email}</div>` : ""}
        </div>
        <div class="info-block" style="text-align:right">
          <div class="label">Account Summary</div>
          <div style="margin-top:4px">Code: <strong>${selectedCustomer.customerCode || "N/A"}</strong></div>
          <div>Total Debit: <strong>R ${totalDebit.toFixed(2)}</strong></div>
          <div>Total Credit: <strong>R ${totalCredit.toFixed(2)}</strong></div>
          ${closingBal > 0 ? `<div style="color:#c00;font-weight:800;font-size:13px;margin-top:4px">BALANCE DUE: R ${closingBal.toFixed(2)}</div>` : `<div style="color:#2E7D32;font-weight:800;font-size:13px;margin-top:4px">ACCOUNT SETTLED</div>`}
        </div>
      </div>
      <table class="ledger"><thead><tr>
        <th style="width:12%">Date</th><th style="width:16%">Invoice #</th><th>Description</th><th style="width:12%" class="num">Debit (R)</th><th style="width:12%" class="num">Credit (R)</th><th style="width:12%" class="num">Balance (R)</th>
      </tr></thead><tbody>
        ${lines.length === 0 ? `<tr><td colspan="6" style="text-align:center;color:#999;padding:16px">No invoices for the selected period.</td></tr>` : ledgerRows}
      </tbody></table>
      <div class="summary"><div class="summary-box">
        <div class="row"><span style="color:#666">Subtotal Debit</span><strong>R ${totalDebit.toFixed(2)}</strong></div>
        <div class="row"><span style="color:#666">Subtotal Credit</span><strong>R ${totalCredit.toFixed(2)}</strong></div>
        <div class="total" style="${closingBal > 0 ? "color:#c00" : "color:#2E7D32"}">
          <span>${closingBal > 0 ? "CLOSING BALANCE DUE" : "ACCOUNT BALANCE"}</span>
          <strong>R ${Math.abs(closingBal).toFixed(2)}</strong>
        </div>
      </div></div>
      ${agingHtml}
      ${closingBal > 0 ? `<div class="overdue-note">Please arrange payment within your agreed terms. Outstanding balance must be settled to avoid account hold.</div>` : ""}
      <div class="footer">
        Supreme Global Foods &nbsp;|&nbsp; 28 Nagington road, Wadeville, Germiston, 1422 &nbsp;|&nbsp; 083 293 0644<br/>
        Banking: FNB | Acc: 62001234567 | Branch: 250655 | Quote customer code with payment
      </div>
      <script>(function(){var d=false;function p(){if(!d){d=true;setTimeout(function(){window.print()},200)}}if(document.readyState==="complete")p();else window.onload=p;setTimeout(p,2000)})()</script>
    </body></html>`);
    w.document.close();
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display font-semibold text-white" style={{ fontSize: "clamp(1.8rem, 3vw, 2.5rem)", letterSpacing: "-0.03em" }}>
            Customer Statement
          </h1>
          <p className="text-[#8A8B8C] font-body text-sm mt-1">
            Select a customer to generate a printable statement
          </p>
        </div>
      </div>

      {/* Customer Selection */}
      <div className="card-surface p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Customer Search */}
          <div className="flex-1 relative">
            <div className="flex items-center gap-2 mb-2">
              <User className="w-4 h-4 text-[#D4A843]" />
              <label className="text-xs text-[#8A8B8C]">Search Customer</label>
            </div>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#8A8B8C]" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setSelectedCustomerId(0); }}
                placeholder="Type customer name or code..."
                className="input-field w-full pl-9 text-sm"
              />
            </div>
            {/* Dropdown results */}
            {searchTerm.length >= 2 && !selectedCustomerId && filteredCustomers.length > 0 && (
              <div className="absolute z-20 w-full mt-1 rounded-lg overflow-hidden" style={{ backgroundColor: "#18191A", border: "1px solid #222324", maxHeight: 240, overflowY: "auto" }}>
                {filteredCustomers.slice(0, 20).map((c: any) => (
                  <button
                    key={c.id}
                    onClick={() => { setSelectedCustomerId(c.id); setSearchTerm(c.name); }}
                    className="w-full text-left px-3 py-2 hover:bg-[#222324] transition-colors cursor-pointer flex items-center justify-between"
                  >
                    <span className="text-white text-sm">{c.name}</span>
                    <span className="text-[#8A8B8C] text-xs font-mono-data">{c.customerCode}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Date Range */}
          <div className="flex gap-2 items-end">
            <div>
              <div className="flex items-center gap-1 mb-1">
                <Calendar className="w-3 h-3 text-[#8A8B8C]" />
                <label className="text-xs text-[#8A8B8C]">From</label>
              </div>
              <input type="date" value={stmtFrom} onChange={(e) => setStmtFrom(e.target.value)} className="input-field text-xs py-2" />
            </div>
            <div>
              <div className="flex items-center gap-1 mb-1">
                <Calendar className="w-3 h-3 text-[#8A8B8C]" />
                <label className="text-xs text-[#8A8B8C]">To</label>
              </div>
              <input type="date" value={stmtTo} onChange={(e) => setStmtTo(e.target.value)} className="input-field text-xs py-2" />
            </div>
          </div>
        </div>

        {/* Selected customer chip */}
        {selectedCustomer && (
          <div className="flex items-center gap-2">
            <span className="px-3 py-1.5 rounded-full text-xs font-medium" style={{ backgroundColor: "rgba(212,168,67,0.12)", color: "#D4A843" }}>
              {selectedCustomer.name} ({selectedCustomer.customerCode})
            </span>
            <span className="text-xs text-[#8A8B8C]">{custInvoices.length} invoice{custInvoices.length !== 1 ? "s" : ""}</span>
          </div>
        )}
      </div>

      {/* Statement Display */}
      {selectedCustomer && (
        <>
          {custInvoices.length === 0 ? (
            <div className="card-surface p-8 text-center">
              <FileText className="w-10 h-10 text-[#8A8B8C] mx-auto mb-3" />
              <p className="text-white font-body">No invoices found for this customer in the selected date range.</p>
              <p className="text-[#8A8B8C] text-sm mt-1">Try adjusting the date range or select a different customer.</p>
            </div>
          ) : (
            <>
              {/* Print Button */}
              <div className="flex justify-end no-print">
                <button onClick={printStatement} className="btn-primary">
                  <Printer className="w-4 h-4" /> Print Statement
                </button>
              </div>

              {/* Statement Card */}
              <div className="card-surface overflow-hidden">
                {/* Statement Header */}
                <div className="p-6 text-center" style={{ borderBottom: "2px solid #D4A843" }}>
                  <h2 className="font-display text-xl font-semibold text-white">Statement of Account</h2>
                  <p className="text-[#8A8B8C] text-sm mt-1">
                    {new Date(stmtFrom).toLocaleDateString("en-ZA")} — {new Date(stmtTo).toLocaleDateString("en-ZA")}
                  </p>
                  <div className="mt-3">
                    <p className="text-white font-semibold text-lg">{selectedCustomer.name}</p>
                    <p className="text-[#8A8B8C] text-xs">Code: {selectedCustomer.customerCode} | Tel: {selectedCustomer.phone || "N/A"}</p>
                  </div>
                </div>

                {/* Ledger Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ backgroundColor: "#131415" }}>
                        <th className="text-left p-3 label-text">Date</th>
                        <th className="text-left p-3 label-text">Reference</th>
                        <th className="text-left p-3 label-text">Description</th>
                        <th className="text-right p-3 label-text">Debit (R)</th>
                        <th className="text-right p-3 label-text">Credit (R)</th>
                        <th className="text-right p-3 label-text">Balance (R)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((l, idx) => (
                        <tr key={idx} style={{ borderBottom: "1px solid #18191A" }}>
                          <td className="p-3 text-white text-xs whitespace-nowrap">{new Date(l.date).toLocaleDateString("en-ZA")}</td>
                          <td className="p-3 font-mono-data text-xs text-[#D4A843]">{l.ref}</td>
                          <td className="p-3 text-white text-xs">
                            {l.desc}
                            {l.source === "sage" && (
                              <span className="ml-2 px-1 py-0.5 rounded text-[9px]" style={{ backgroundColor: "rgba(99,102,241,0.15)", color: "#818CF8" }}>SAGE</span>
                            )}
                          </td>
                          <td className="p-3 text-right text-white text-xs">{l.debit > 0 ? l.debit.toLocaleString("en-ZA", { minimumFractionDigits: 2 }) : "-"}</td>
                          <td className="p-3 text-right text-xs" style={{ color: "#4ADE80" }}>{l.credit > 0 ? l.credit.toLocaleString("en-ZA", { minimumFractionDigits: 2 }) : "-"}</td>
                          <td className="p-3 text-right font-semibold text-xs" style={{ color: l.balance > 0 ? "#D4A843" : "#4ADE80" }}>
                            {l.balance.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ borderTop: "2px solid #D4A843" }}>
                        <td colSpan={3} className="p-3 font-semibold text-white text-right">TOTALS</td>
                        <td className="p-3 text-right font-semibold text-white">{totalDebit.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</td>
                        <td className="p-3 text-right font-semibold" style={{ color: "#4ADE80" }}>{totalCredit.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</td>
                        <td className="p-3 text-right font-bold" style={{ color: "#D4A843" }}>{(totalDebit - totalCredit).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Summary */}
                <div className="p-4" style={{ backgroundColor: "#0A0A0B" }}>
                  <div className="flex justify-between text-sm">
                    <span className="text-[#8A8B8C]">Total Invoices:</span>
                    <span className="text-white font-semibold">{custInvoices.length}</span>
                  </div>
                  <div className="flex justify-between text-sm mt-2 pt-2" style={{ borderTop: "1px solid #222324" }}>
                    <span className="text-white font-semibold">Balance Due:</span>
                    <span className="font-bold" style={{ color: totalDebit - totalCredit > 0 ? "#D4A843" : "#4ADE80" }}>
                      R {(totalDebit - totalCredit).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Aging */}
              {totalOutstanding > 0 && (
                <div className="rounded-lg overflow-hidden" style={{ border: "1px solid #D4A843" }}>
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
                          <th className="p-3 text-right text-[#EF4444]">90+ Days</th>
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
                          <td className="p-3 text-right font-bold text-[#D4A843]" style={{ backgroundColor: "rgba(212,168,67,0.08)" }}>R {totalOutstanding.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      <style>{`@media print { .no-print { display: none !important; } }`}</style>
    </div>
  );
}
