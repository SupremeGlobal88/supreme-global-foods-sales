import { useState, useMemo } from "react";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { reloadFromStorage } from "@/lib/dataService";
import {
  Search, Printer, DollarSign, CheckCircle, FileText, X, ChevronDown, ChevronUp, Pencil, Trash2, Calendar, User,
} from "lucide-react";

export default function InvoicesPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const utils = trpc.useUtils();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [expanded, setExpanded] = useState<number | null>(null);

  // Payment form
  const [showPayForm, setShowPayForm] = useState(false);
  const [payInvId, setPayInvId] = useState(0);
  const [payAmt, setPayAmt] = useState("");
  const [payMethod, setPayMethod] = useState("cash");
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [payRef, setPayRef] = useState("");
  const [payNotes, setPayNotes] = useState("");
  const [editPayId, setEditPayId] = useState(0);

  // Statement
  const [showStmt, setShowStmt] = useState(false);
  const [stmtCust, setStmtCust] = useState(0);
  const [stmtFrom, setStmtFrom] = useState("");
  const [stmtTo, setStmtTo] = useState(new Date().toISOString().slice(0, 10));

  const { data: invoices } = trpc.invoice.list.useQuery();
  const { data: customers } = trpc.customer.search.useQuery({ query: " " });
  const { data: stats } = trpc.invoice.getStats.useQuery();

  const recordPay = trpc.invoice.recordPayment.useMutation({
    onSuccess: async () => { reloadFromStorage(); await utils.invoice.list.invalidate(); closePay(); },
  });
  const editPay = trpc.invoice.editPayment.useMutation({
    onSuccess: async () => { reloadFromStorage(); await utils.invoice.list.invalidate(); closePay(); },
  });
  const delPay = trpc.invoice.deletePayment.useMutation({
    onSuccess: async () => { reloadFromStorage(); await utils.invoice.list.invalidate(); },
  });

  function closePay() {
    setShowPayForm(false); setPayInvId(0); setPayAmt(""); setPayMethod("cash");
    setPayDate(new Date().toISOString().slice(0, 10)); setPayRef(""); setPayNotes(""); setEditPayId(0);
  }

  function openPay(invId: number, bal: number) {
    setPayInvId(invId); setPayAmt(bal > 0 ? String(bal) : ""); setEditPayId(0); setShowPayForm(true);
  }

  function openEditPay(invId: number, p: any) {
    setPayInvId(invId); setEditPayId(p.id); setPayAmt(String(p.amount || ""));
    setPayMethod(p.paymentMethod || "cash"); setPayRef(p.referenceNumber || "");
    setPayNotes(p.notes || ""); setPayDate(p.paymentDate ? p.paymentDate.slice(0, 10) : new Date().toISOString().slice(0, 10));
    setShowPayForm(true);
  }

  const filtered = useMemo(() => {
    let list = invoices || [];
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((i: any) => (i.invoiceNumber || "").toLowerCase().includes(q) || (i.customer?.name || "").toLowerCase().includes(q));
    if (statusFilter !== "all") list = list.filter((i: any) => i.status === statusFilter);
    return list;
  }, [invoices, search, statusFilter]);

  const badge = (s: string) => {
    const m: Record<string, { bg: string; c: string; l: string }> = {
      draft: { bg: "rgba(139,92,246,0.12)", c: "#8B5CF6", l: "Draft" },
      sent: { bg: "rgba(59,130,246,0.12)", c: "#3B82F6", l: "Sent" },
      partially_paid: { bg: "rgba(245,158,11,0.12)", c: "#F59E0B", l: "Partial" },
      paid: { bg: "rgba(74,222,128,0.12)", c: "#4ADE80", l: "Paid" },
      overdue: { bg: "rgba(239,68,68,0.12)", c: "#EF4444", l: "Overdue" },
    };
    const x = m[s] || { bg: "#222324", c: "#8A8B8C", l: s };
    return <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: x.bg, color: x.c }}>{x.l}</span>;
  };

  function printDoc(inv: any) {
    const cust = inv.customer || (customers || []).find((c: any) => c.id === inv.customerId);
    const logo = `${window.location.origin}/sgf-logo.png`;
    const invDate = new Date(inv.invoiceDate || inv.createdAt);
    const retDate = new Date(invDate); retDate.setDate(retDate.getDate() + 7);
    const sub = Number(inv.subtotal || 0), vat = Number(inv.vatAmount || 0), tot = Number(inv.total || 0);
    const paid = Number(inv.amountPaid || 0), bal = Number(inv.balanceDue || tot - paid);
    const items = inv.items || [];

    const copy = (label: string, isOffice: boolean) => `
      <div style="position:relative; margin-bottom:20px;">
        <div style="position:absolute; top:0; right:0; background:#D4A843; color:#000; padding:2px 8px; font-size:9px; font-weight:bold;">${label}</div>
        <div style="text-align:center; border-bottom:2px solid #D4A843; padding-bottom:8px; margin-bottom:12px;">
          <img src="${logo}" style="height:45px; margin-bottom:4px;" onerror="this.style.display='none'" />
          <div style="font-size:11px; color:#666;">19A Steel Road, Spartan, Germiston, 1422 | sales@supremeglobalfoods.co.za | 083 293 0644</div>
          <div style="font-size:18px; font-weight:bold; color:#D4A843; margin-top:6px;">TAX INVOICE &amp; DELIVERY NOTE</div>
        </div>
        <div style="display:flex; justify-content:space-between; font-size:11px; margin-bottom:10px;">
          <div><div style="font-weight:bold; color:#D4A843;">BILL TO:</div>
            <div style="font-weight:bold;">${cust?.name || "N/A"}</div>
            <div>${cust?.physicalAddress || ""}${cust?.city ? `, ${cust.city}` : ""}</div>
            <div>Tel: ${cust?.phone || "N/A"}</div>
          </div>
          <div style="text-align:right;">
            <div><strong>Invoice:</strong> <span style="font-size:14px; font-weight:bold; color:#D4A843;">${inv.invoiceNumber}</span></div>
            <div><strong>DN:</strong> ${inv.deliveryNoteNumber || ""}</div>
            <div><strong>Order:</strong> ${inv.orderNumber || ""}</div>
            <div><strong>Date:</strong> ${invDate.toLocaleDateString("en-ZA")}</div>
            <div><strong>Terms:</strong> ${(inv.paymentTerms || "cod").replace("_", " ").toUpperCase()}</div>
          </div>
        </div>
        <table style="width:100%; border-collapse:collapse; font-size:11px;">
          <thead><tr style="background:#D4A843; color:#fff;"><th style="padding:6px; text-align:left;">Item</th><th style="padding:6px; text-align:right;">Qty</th><th style="padding:6px; text-align:right;">Price</th><th style="padding:6px; text-align:right;">Total</th></tr></thead>
          <tbody>
            ${items.map((it: any) => `<tr style="border-bottom:1px solid #e0e0e0;"><td style="padding:6px;">${it.description || it.productName || ""}</td><td style="padding:6px; text-align:right;">${it.quantity || 0}</td><td style="padding:6px; text-align:right;">R ${Number(it.unitPrice || 0).toFixed(2)}</td><td style="padding:6px; text-align:right;">R ${Number(it.lineTotal || 0).toFixed(2)}</td></tr>`).join("")}
          </tbody>
        </table>
        <div style="display:flex; justify-content:flex-end; margin-top:8px;">
          <div style="width:240px; font-size:11px;">
            <div style="display:flex; justify-content:space-between; padding:3px 0; border-bottom:1px solid #e0e0e0;"><span>Subtotal:</span><strong>R ${sub.toFixed(2)}</strong></div>
            <div style="display:flex; justify-content:space-between; padding:3px 0; border-bottom:1px solid #e0e0e0;"><span>VAT 15%:</span><strong>R ${vat.toFixed(2)}</strong></div>
            <div style="display:flex; justify-content:space-between; padding:3px 0; border-bottom:2px solid #D4A843;"><span><strong>Total:</strong></span><strong style="color:#D4A843;">R ${tot.toFixed(2)}</strong></div>
            ${paid > 0 ? `<div style="display:flex; justify-content:space-between; padding:3px 0;"><span>Paid:</span><span>R ${paid.toFixed(2)}</span></div>` : ""}
            ${bal > 0 ? `<div style="display:flex; justify-content:space-between; padding:3px 0; color:#c00; font-weight:bold;"><span>Balance Due:</span><span>R ${bal.toFixed(2)}</span></div>` : ""}
          </div>
        </div>
        ${isOffice ? `<div style="margin:10px 0; padding:8px; border:1px dashed #999;"><div style="font-weight:bold; font-size:11px; margin-bottom:6px;">DELIVERY CONFIRMATION:</div><div style="display:flex; gap:30px;"><div style="flex:1;"><div style="font-size:10px; color:#666;">Received By:</div><div style="border-bottom:1px solid #333; height:25px;"></div></div><div style="flex:1;"><div style="font-size:10px; color:#666;">Date &amp; Time:</div><div style="border-bottom:1px solid #333; height:25px;"></div></div></div><div style="font-size:9px; color:#666; margin-top:4px;">I confirm receipt of goods in good order.</div></div>` : ""}
        <div style="margin-top:8px; padding:6px; background:#FFF5F5; border:1px solid #EF4444; border-radius:3px; color:#EF4444; font-size:10px; font-weight:bold; text-align:center;">PLEASE NOTE: NO EXCHANGES OR RETURNS AFTER 7 DAYS FROM INVOICE DATE. RETURNS ACCEPTED UNTIL: ${retDate.toLocaleDateString("en-ZA")}</div>
        <div style="text-align:center; font-size:9px; color:#999; margin-top:6px;">Banking: FNB | Acc: 62001234567 | Branch: 250655 | Quote invoice number with payment</div>
      </div>`;

    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>SGF ${inv.invoiceNumber}</title><style>@media print{body{padding:12px;}}</style></head><body style="font-family:Arial,sans-serif;color:#333;max-width:750px;margin:0 auto;font-size:11px;">${copy("CUSTOMER COPY", false)}<div style="page-break-before:always;"></div>${copy("OFFICE COPY", true)}</body></html>`);
    w.document.close(); w.print();
  }

  function printStmt(custId: number) {
    const cust = (customers || []).find((c: any) => c.id === custId); if (!cust) return;
    const logo = `${window.location.origin}/sgf-logo.png`;
    const list = (invoices || []).filter((i: any) => i.customerId === custId).sort((a: any, b: any) => new Date(b.invoiceDate || b.createdAt).getTime() - new Date(a.invoiceDate || a.createdAt).getTime());
    const out = list.reduce((s: number, i: any) => s + (Number(i.total || 0) - Number(i.amountPaid || 0)), 0);
    const w = window.open("", "_blank"); if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>Statement - ${cust.name}</title></head><body style="font-family:Arial,sans-serif;color:#333;padding:25px;max-width:700px;margin:0 auto;">
      <div style="text-align:center;border-bottom:2px solid #D4A843;padding-bottom:10px;margin-bottom:15px;"><img src="${logo}" style="height:40px;margin-bottom:4px;" onerror="this.style.display='none'"/><div style="font-size:18px;font-weight:bold;color:#D4A843;">STATEMENT OF ACCOUNT</div><div style="font-size:10px;color:#666;">${stmtFrom || "All time"} to ${stmtTo}</div></div>
      <div style="font-size:11px;margin-bottom:12px;"><div style="font-weight:bold;font-size:13px;">${cust.name}</div><div>${cust.physicalAddress || ""}${cust.city ? `, ${cust.city}` : ""}</div><div>Tel: ${cust.phone || "N/A"}</div></div>
      <table style="width:100%;border-collapse:collapse;font-size:11px;"><thead><tr style="background:#D4A843;color:#fff;"><th style="padding:6px;text-align:left;">Date</th><th style="padding:6px;text-align:left;">Invoice #</th><th style="padding:6px;text-align:right;">Debit</th><th style="padding:6px;text-align:right;">Credit</th><th style="padding:6px;text-align:right;">Balance</th></tr></thead><tbody>
      ${list.map((inv: any) => { const b = Number(inv.total || 0) - Number(inv.amountPaid || 0); return `<tr style="border-bottom:1px solid #e0e0e0;"><td style="padding:6px;">${new Date(inv.invoiceDate || inv.createdAt).toLocaleDateString("en-ZA")}</td><td style="padding:6px;">${inv.invoiceNumber}</td><td style="padding:6px;text-align:right;">R ${Number(inv.total || 0).toFixed(2)}</td><td style="padding:6px;text-align:right;">R ${Number(inv.amountPaid || 0).toFixed(2)}</td><td style="padding:6px;text-align:right;${b > 0 ? 'color:#c00;font-weight:bold;' : ''}">R ${b.toFixed(2)}</td></tr>`; }).join("")}
      </tbody></table><div style="text-align:right;font-size:13px;font-weight:bold;color:#D4A843;margin-top:10px;">Total Outstanding: R ${out.toFixed(2)}</div><div style="text-align:center;font-size:9px;color:#999;margin-top:8px;">Banking: FNB | Acc: 62001234567 | Branch: 250655</div></body></html>`);
    w.document.close(); w.print();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display font-semibold text-white" style={{ fontSize: "clamp(1.8rem,3vw,2.5rem)", letterSpacing: "-0.03em" }}>Invoices</h1>
          <p className="text-[#8A8B8C] font-body text-sm mt-1">
            Outstanding: R {(stats?.outstanding || 0).toLocaleString("en-ZA", { minimumFractionDigits: 2 })} &middot; {stats?.total || 0} invoices
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {[
          { label: "DRAFT", v: stats?.draft || 0, c: "#8B5CF6" },
          { label: "SENT", v: stats?.sent || 0, c: "#3B82F6" },
          { label: "PARTIAL", v: stats?.partiallyPaid || 0, c: "#F59E0B" },
          { label: "PAID", v: stats?.paid || 0, c: "#4ADE80" },
          { label: "OVERDUE", v: stats?.overdue || 0, c: "#EF4444" },
        ].map((s) => (
          <div key={s.label} className="card-surface p-4">
            <div className="label-text mb-1">{s.label}</div>
            <div className="stat-number" style={{ color: s.c }}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="card-surface p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#8A8B8C]" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search invoice # or customer name..." className="input-field w-full pl-10" />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input-field w-auto">
            <option value="all">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="partially_paid">Partially Paid</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
          </select>
        </div>
      </div>

      {/* Invoice List */}
      <div className="card-surface overflow-hidden">
        <div className="grid gap-3 p-4">
          {filtered.length === 0 && <div className="text-center py-8 text-[#8A8B8C] font-body">No invoices found.</div>}
          {filtered.map((inv: any) => {
            const isExp = expanded === inv.id;
            const tot = Number(inv.total || 0);
            const paid = Number(inv.amountPaid || 0);
            const bal = Number(inv.balanceDue || tot - paid);
            return (
              <div key={inv.id} className="p-4 rounded-lg" style={{ backgroundColor: "#18191A", border: "1px solid #222324" }}>
                {/* Header */}
                <div className="flex items-start justify-between cursor-pointer" onClick={() => setExpanded(isExp ? null : inv.id)}>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1 flex-wrap">
                      <span className="font-display font-semibold text-white text-sm">{inv.invoiceNumber}</span>
                      {badge(inv.status)}
                      {inv.status === "draft" && <span className="text-xs text-[#8B5CF6] italic">Not ready for delivery</span>}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-[#8A8B8C] flex-wrap">
                      <span className="flex items-center gap-1"><User className="w-3 h-3" />{inv.customer?.name || "N/A"}</span>
                      <span className="flex items-center gap-1"><FileText className="w-3 h-3" />{inv.orderNumber || ""}</span>
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(inv.invoiceDate || inv.createdAt).toLocaleDateString("en-ZA")}</span>
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    <div className="font-display font-semibold text-white">R {tot.toFixed(2)}</div>
                    {bal > 0 && inv.status !== "draft" && <div className="text-xs" style={{ color: "#EF4444" }}>Due: R {bal.toFixed(2)}</div>}
                    {isExp ? <ChevronUp className="w-4 h-4 text-[#8A8B8C]" /> : <ChevronDown className="w-4 h-4 text-[#8A8B8C]" />}
                  </div>
                </div>

                {/* Expanded */}
                {isExp && (
                  <div className="mt-4 pt-4 space-y-4" style={{ borderTop: "1px solid #222324" }}>
                    {/* Items */}
                    {(inv.items || []).length > 0 && (
                      <div>
                        <div className="label-text mb-2">Items</div>
                        <div className="space-y-1">
                          {inv.items.map((it: any, idx: number) => (
                            <div key={idx} className="flex items-center justify-between text-xs py-1" style={{ borderBottom: "1px solid #222324" }}>
                              <span className="text-[#E8E8E9]">{it.description || it.productName || "Item"}</span>
                              <div className="flex items-center gap-4 text-[#8A8B8C]">
                                <span>{it.quantity || 0} x R {Number(it.unitPrice || 0).toFixed(2)}</span>
                                <span className="text-[#D4A843] font-medium">R {Number(it.lineTotal || 0).toFixed(2)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Totals */}
                    <div className="flex justify-end">
                      <div className="text-right space-y-1 text-xs">
                        <div className="flex justify-between gap-8"><span className="text-[#8A8B8C]">Subtotal:</span><span>R {Number(inv.subtotal || 0).toFixed(2)}</span></div>
                        <div className="flex justify-between gap-8"><span className="text-[#8A8B8C]">VAT 15%:</span><span>R {Number(inv.vatAmount || 0).toFixed(2)}</span></div>
                        <div className="flex justify-between gap-8 pt-1" style={{ borderTop: "1px solid #D4A843" }}>
                          <span className="text-[#D4A843] font-semibold">Total:</span><span className="text-[#D4A843] font-bold">R {tot.toFixed(2)}</span>
                        </div>
                        {paid > 0 && <div className="flex justify-between gap-8"><span className="text-[#8A8B8C]">Paid:</span><span className="text-[#4ADE80]">R {paid.toFixed(2)}</span></div>}
                        {bal > 0 && inv.status !== "draft" && (
                          <div className="flex justify-between gap-8 pt-1" style={{ borderTop: "1px solid #EF4444" }}>
                            <span className="text-[#EF4444] font-bold">Balance Due:</span><span className="text-[#EF4444] font-bold">R {bal.toFixed(2)}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Payment History */}
                    {inv.payments && inv.payments.length > 0 && (
                      <div>
                        <div className="label-text mb-2">Payment History</div>
                        <div className="space-y-1">
                          {inv.payments.map((p: any) => (
                            <div key={p.id} className="flex items-center justify-between p-2 rounded text-xs" style={{ backgroundColor: "#0A0A0B" }}>
                              <div className="flex items-center gap-2">
                                <CheckCircle className="w-3 h-3 text-[#4ADE80]" />
                                <span className="text-[#4ADE80] font-medium">R {Number(p.amount || 0).toFixed(2)}</span>
                                <span className="text-[#8A8B8C]">{p.paymentMethod || "cash"}</span>
                                {p.referenceNumber && <span className="text-[#8A8B8C]">Ref: {p.referenceNumber}</span>}
                                <span className="text-[#8A8B8C]">{new Date(p.paymentDate || p.createdAt).toLocaleDateString("en-ZA")}</span>
                              </div>
                              {isAdmin && (
                                <div className="flex gap-1">
                                  <button onClick={() => openEditPay(inv.id, p)} className="p-1 rounded hover:bg-[#222324] cursor-pointer" title="Edit"><Pencil className="w-3 h-3 text-[#D4A843]" /></button>
                                  <button onClick={() => { if (confirm("Delete this payment?")) delPay.mutate({ invoiceId: inv.id, paymentId: p.id }); }} className="p-1 rounded hover:bg-[#222324] cursor-pointer" title="Delete"><Trash2 className="w-3 h-3 text-[#EF4444]" /></button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 flex-wrap">
                      <button onClick={() => printDoc(inv)} className="btn-secondary text-xs"><Printer className="w-3 h-3" /> Print Invoice &amp; DN</button>
                      {isAdmin && inv.status !== "draft" && bal > 0 && (
                        <button onClick={() => openPay(inv.id, bal)} className="btn-secondary text-xs" style={{ borderColor: "rgba(74,222,128,0.3)" }}>
                          <DollarSign className="w-3 h-3" /> Record Payment
                        </button>
                      )}
                      <button onClick={() => { setStmtCust(inv.customerId); setShowStmt(true); }} className="btn-secondary text-xs"><FileText className="w-3 h-3" /> Statement</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Payment Modal */}
      {showPayForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.7)" }}>
          <div className="card-surface p-6 max-w-md w-full mx-4" style={{ borderRadius: 16 }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-semibold text-white text-lg">{editPayId ? "Edit Payment" : "Record Payment"}</h2>
              <button onClick={closePay} className="cursor-pointer"><X className="w-5 h-5 text-[#8A8B8C]" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label-text block mb-1.5">Amount (R) *</label>
                <input type="number" step="0.01" value={payAmt} onChange={(e) => setPayAmt(e.target.value)} className="input-field" placeholder="0.00" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-text block mb-1.5">Method</label>
                  <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)} className="input-field">
                    <option value="cash">Cash</option>
                    <option value="eft">EFT</option>
                    <option value="card">Card</option>
                    <option value="cheque">Cheque</option>
                  </select>
                </div>
                <div>
                  <label className="label-text block mb-1.5">Date</label>
                  <input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} className="input-field" />
                </div>
              </div>
              <div>
                <label className="label-text block mb-1.5">Reference #</label>
                <input type="text" value={payRef} onChange={(e) => setPayRef(e.target.value)} className="input-field" placeholder="EFT reference" />
              </div>
              <div>
                <label className="label-text block mb-1.5">Notes</label>
                <textarea value={payNotes} onChange={(e) => setPayNotes(e.target.value)} className="input-field" rows={2} />
              </div>
              <button onClick={editPayId ? () => editPay.mutate({ invoiceId: payInvId, paymentId: editPayId, amount: parseFloat(payAmt), paymentMethod: payMethod, paymentDate: payDate, referenceNumber: payRef, notes: payNotes }) : () => recordPay.mutate({ invoiceId: payInvId, amount: parseFloat(payAmt), paymentMethod: payMethod, paymentDate: payDate, referenceNumber: payRef, notes: payNotes })} className="btn-primary w-full justify-center">
                <DollarSign className="w-4 h-4" /> {editPayId ? "Update Payment" : "Record Payment"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Statement Modal */}
      {showStmt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.7)" }}>
          <div className="card-surface p-6 max-w-md w-full mx-4" style={{ borderRadius: 16 }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-semibold text-white text-lg">Customer Statement</h2>
              <button onClick={() => setShowStmt(false)} className="cursor-pointer"><X className="w-5 h-5 text-[#8A8B8C]" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label-text block mb-1.5">Customer</label>
                <select value={stmtCust} onChange={(e) => setStmtCust(parseInt(e.target.value))} className="input-field">
                  <option value={0}>Select customer...</option>
                  {(customers || []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label-text block mb-1.5">From</label><input type="date" value={stmtFrom} onChange={(e) => setStmtFrom(e.target.value)} className="input-field" /></div>
                <div><label className="label-text block mb-1.5">To</label><input type="date" value={stmtTo} onChange={(e) => setStmtTo(e.target.value)} className="input-field" /></div>
              </div>
              <button onClick={() => { if (stmtCust) { printStmt(stmtCust); setShowStmt(false); } }} className="btn-primary w-full justify-center"><Printer className="w-4 h-4" /> Print Statement</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
