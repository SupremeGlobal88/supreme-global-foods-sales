import { useState, useMemo } from "react";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { reloadFromStorage, dataService } from "@/lib/dataService";
import {
  Search, Printer, DollarSign, CheckCircle, FileText, X, ChevronDown, ChevronUp,
  Pencil, Trash2, Calendar, User, Mail, AlertCircle, Send, Receipt, RotateCcw,
  Database,
} from "lucide-react";

/* ─── InvoicePage ─── */
export default function InvoicesPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  const utils = trpc.useUtils();

  /* Search & filter */
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all"); // all | system | sage
  const [sortBy, setSortBy] = useState("date"); // date | number
  const [expanded, setExpanded] = useState<number | null>(null);

  /* Payment form */
  const [showPayForm, setShowPayForm] = useState(false);
  const [payInvId, setPayInvId] = useState(0);
  const [payInvNumber, setPayInvNumber] = useState("");
  const [payCustName, setPayCustName] = useState("");
  const [payAmt, setPayAmt] = useState("");
  const [payMethod, setPayMethod] = useState("cash");
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [payRef, setPayRef] = useState("");
  const [payNotes, setPayNotes] = useState("");
  const [editPayId, setEditPayId] = useState(0);

  /* Statement modal */
  const [showStmt, setShowStmt] = useState(false);
  const [stmtCust, setStmtCust] = useState(0);
  const [stmtFrom, setStmtFrom] = useState("2020-01-01");
  const [stmtTo, setStmtTo] = useState(new Date().toISOString().slice(0, 10));

  /* Receipt print modal */
  const [showReceipt, setShowReceipt] = useState<any>(null);

  /* Credit note form */
  const [showCreditNote, setShowCreditNote] = useState(false);
  const [cnInvId, setCnInvId] = useState(0);
  const [cnAmount, setCnAmount] = useState("");
  const [cnReason, setCnReason] = useState("");

  /* Admin edit invoice form */
  const [showEditInv, setShowEditInv] = useState(false);
  const [editInvId, setEditInvId] = useState(0);
  const [editInvNumber, setEditInvNumber] = useState("");
  const [editInvCustomerId, setEditInvCustomerId] = useState(0);
  const [editInvDate, setEditInvDate] = useState("");
  const [editInvTotal, setEditInvTotal] = useState("");
  const [editInvPaid, setEditInvPaid] = useState("");
  const [editInvNotes, setEditInvNotes] = useState("");
  const [editInvStatus, setEditInvStatus] = useState("sent");

  /* Data */
  const { data: invoices, refetch: refetchInvoices } = trpc.invoice.list.useQuery();
  const { data: customers } = trpc.customer.search.useQuery({ query: " " });
  const { data: stats } = trpc.invoice.getStats.useQuery();
  const { data: allReceipts } = trpc.invoice.getReceipts.useQuery();
  const { data: allCreditNotes } = trpc.invoice.getCreditNotes.useQuery();

  /* Mutations */
  const recordPay = trpc.invoice.recordPayment.useMutation({
    onSuccess: async (data: any) => {
      reloadFromStorage();
      await utils.invoice.list.invalidate();
      await utils.invoice.getReceipts.invalidate();
      closePay();
      // Show the receipt immediately
      if (data?.receipt) setShowReceipt(data.receipt);
    },
  });
  const editPay = trpc.invoice.editPayment.useMutation({
    onSuccess: async () => { reloadFromStorage(); await utils.invoice.list.invalidate(); closePay(); },
  });
  const delPay = trpc.invoice.deletePayment.useMutation({
    onSuccess: async () => { reloadFromStorage(); await utils.invoice.list.invalidate(); },
  });
  const createCreditNote = trpc.invoice.createCreditNote.useMutation({
    onSuccess: async () => { reloadFromStorage(); await utils.invoice.list.invalidate(); setShowCreditNote(false); setCnInvId(0); setCnAmount(""); setCnReason(""); },
  });
  const voidCreditNote = trpc.invoice.voidCreditNote.useMutation({
    onSuccess: async () => { reloadFromStorage(); await utils.invoice.list.invalidate(); },
  });
  const updateInvoice = trpc.invoice.update.useMutation({
    onSuccess: async () => { reloadFromStorage(); await utils.invoice.list.invalidate(); setShowEditInv(false); },
  });

  function closePay() {
    setShowPayForm(false); setPayInvId(0); setPayInvNumber(""); setPayCustName("");
    setPayAmt(""); setPayMethod("cash"); setPayDate(new Date().toISOString().slice(0, 10));
    setPayRef(""); setPayNotes(""); setEditPayId(0);
  }

  function openPay(inv: any) {
    const bal = Number(inv.balanceDue || inv.total || 0);
    setPayInvId(inv.id);
    setPayInvNumber(inv.invoiceNumber);
    setPayCustName(inv.customer?.name || "N/A");
    setPayAmt(bal > 0 ? String(bal) : "");
    setEditPayId(0);
    setShowPayForm(true);
  }

  function openEditPay(invId: number, invNumber: string, custName: string, p: any) {
    setPayInvId(invId); setPayInvNumber(invNumber); setPayCustName(custName);
    setEditPayId(p.id); setPayAmt(String(p.amount || ""));
    setPayMethod(p.paymentMethod || "cash"); setPayRef(p.referenceNumber || "");
    setPayNotes(p.notes || ""); setPayDate(p.paymentDate ? p.paymentDate.slice(0, 10) : new Date().toISOString().slice(0, 10));
    setShowPayForm(true);
  }

  /* Filtered list */
  const filtered = useMemo(() => {
    let list = invoices || [];
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((i: any) =>
        (i.invoiceNumber || "").toLowerCase().includes(q) ||
        (i.customer?.name || "").toLowerCase().includes(q) ||
        (i.customer?.customerCode || "").toLowerCase().includes(q) ||
        (i.orderNumber || "").toLowerCase().includes(q)
      );
    }
    if (statusFilter !== "all") list = list.filter((i: any) => i.status === statusFilter);
    // Source filter: show system-only, sage-only, or all
    if (sourceFilter === "system") list = list.filter((i: any) => i.source !== "sage");
    if (sourceFilter === "sage") list = list.filter((i: any) => i.source === "sage");
    return list.sort((a: any, b: any) => {
      if (sortBy === "date") {
        // Sort by invoice date descending (newest first)
        const aTime = new Date(a.invoiceDate || a.createdAt || 0).getTime();
        const bTime = new Date(b.invoiceDate || b.createdAt || 0).getTime();
        if (bTime !== aTime) return bTime - aTime;
      }
      // Extract numeric portion from any invoice number format
      const aNum = parseInt((a.invoiceNumber || "").replace(/\D/g, ""), 10) || 0;
      const bNum = parseInt((b.invoiceNumber || "").replace(/\D/g, ""), 10) || 0;
      // Sort by numeric value descending (highest number first)
      if (bNum !== aNum) return bNum - aNum;
      // Fallback: sort by created date
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });
  }, [invoices, search, statusFilter, sourceFilter, sortBy]);

  /* Status badge */
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

  /* ── Print Combined Invoice + Delivery Note ── */
  function printDoc(inv: any) {
    const cust = inv.customer || (customers || []).find((c: any) => c.id === inv.customerId);
    const logoUrl = `${window.location.origin}/sgf-logo.png`;
    const invDate = new Date(inv.invoiceDate || inv.createdAt);
    const retDate = new Date(invDate); retDate.setDate(retDate.getDate() + 7);
    const sub = Number(inv.subtotal || 0), vat = Number(inv.vatAmount || 0), tot = Number(inv.total || 0);
    const paid = Number(inv.amountPaid || 0), bal = Number(inv.balanceDue || tot - paid);
    const items = inv.items || [];

    const copy = (label: string, isOffice: boolean) => `
      <div style="position:relative; padding:18px 24px; min-height:720px; box-sizing:border-box;">
        <div style="position:absolute; top:10px; right:10px; background:#D4A843; color:#000; padding:3px 12px; font-size:10px; font-weight:800; letter-spacing:1px; border-radius:2px;">${label}</div>
        <div style="text-align:center; border-bottom:3px solid #D4A843; padding-bottom:10px; margin-bottom:14px;">
          <img src="${logoUrl}" style="height:55px; margin-bottom:4px;" onerror="this.style.display='none'" />
          <div style="font-size:10px; color:#666; line-height:1.4;">
            28 Nagington road, Wadeville, Germiston, 1422 &nbsp;|&nbsp; sales@supremeglobalfoods.co.za &nbsp;|&nbsp; Tel: 083 293 0644<br/>
            VAT Reg: 4120123456 &nbsp;|&nbsp; Reg No: 2015/123456/07
          </div>
          <div style="font-size:20px; font-weight:800; color:#D4A843; margin-top:8px; letter-spacing:2px; text-transform:uppercase;">Tax Invoice &amp; Delivery Note</div>
        </div>
        <table style="width:100%; font-size:11px; margin-bottom:12px; border-collapse:collapse;">
          <tr>
            <td style="vertical-align:top; width:55%; padding-right:12px;">
              <div style="font-size:10px; color:#888; text-transform:uppercase; letter-spacing:1px; margin-bottom:3px;">Bill To</div>
              <div style="font-weight:800; font-size:13px; color:#222;">${cust?.name || "N/A"}</div>
              <div style="color:#444;">${cust?.contactPerson || ""}</div>
              <div style="color:#555;">${cust?.physicalAddress || ""}${cust?.city ? `, ${cust.city}` : ""}${cust?.province ? `, ${cust.province}` : ""}</div>
              <div style="color:#555;">Tel: ${cust?.phone || "N/A"}</div>
              ${cust?.email ? `<div style="color:#555;">${cust.email}</div>` : ""}
              ${cust?.vatNumber ? `<div style="color:#555;">VAT: ${cust.vatNumber}</div>` : ""}
              ${cust?.salesRepName ? `<div style="color:#888; font-size:10px; margin-top:4px;">Sales Rep: ${cust.salesRepName}</div>` : ""}
            </td>
            <td style="vertical-align:top; text-align:right; width:45%;">
              <table style="font-size:11px; width:100%; text-align:right; border-collapse:collapse;">
                <tr><td style="color:#888; padding:2px 0;">Invoice Number</td><td style="font-weight:800; font-size:14px; color:#D4A843; padding:2px 0; padding-left:12px;">${inv.invoiceNumber}</td></tr>
                <tr><td style="color:#888; padding:2px 0;">Delivery Note</td><td style="padding:2px 0; padding-left:12px;">${inv.deliveryNoteNumber || `DN-${inv.orderNumber}`}</td></tr>
                <tr><td style="color:#888; padding:2px 0;">Order Number</td><td style="padding:2px 0; padding-left:12px;">${inv.orderNumber || ""}</td></tr>
                <tr><td style="color:#888; padding:2px 0;">Invoice Date</td><td style="padding:2px 0; padding-left:12px;">${invDate.toLocaleDateString("en-ZA")}</td></tr>
                <tr><td style="color:#888; padding:2px 0;">Payment Terms</td><td style="padding:2px 0; padding-left:12px;">${(inv.paymentTerms || "cod").replace("_", " ").toUpperCase()}</td></tr>
                <tr><td style="color:#888; padding:2px 0;">Return By</td><td style="padding:2px 0; padding-left:12px;">${retDate.toLocaleDateString("en-ZA")}</td></tr>
              </table>
            </td>
          </tr>
        </table>
        <table style="width:100%; border-collapse:collapse; font-size:11px;">
          <thead><tr style="background:#D4A843; color:#fff;">
            <th style="padding:7px 8px; text-align:left; font-size:10px; text-transform:uppercase; letter-spacing:0.5px;">#</th>
            <th style="padding:7px 8px; text-align:left; font-size:10px; text-transform:uppercase; letter-spacing:0.5px;">Description</th>
            <th style="padding:7px 8px; text-align:right; font-size:10px; text-transform:uppercase; letter-spacing:0.5px;">Qty</th>
            <th style="padding:7px 8px; text-align:right; font-size:10px; text-transform:uppercase; letter-spacing:0.5px;">Unit Price</th>
            <th style="padding:7px 8px; text-align:right; font-size:10px; text-transform:uppercase; letter-spacing:0.5px;">Line Total</th>
          </tr></thead>
          <tbody>
            ${items.map((it: any, idx: number) => `<tr style="border-bottom:1px solid #e5e5e5;">
              <td style="padding:7px 8px; color:#888;">${idx + 1}</td>
              <td style="padding:7px 8px;">${it.description || it.productName || ""}</td>
              <td style="padding:7px 8px; text-align:right;">${it.quantity || 0}</td>
              <td style="padding:7px 8px; text-align:right;">R ${Number(it.unitPrice || 0).toFixed(2)}</td>
              <td style="padding:7px 8px; text-align:right; font-weight:600;">R ${Number(it.lineTotal || 0).toFixed(2)}</td>
            </tr>`).join("")}
          </tbody>
        </table>
        <div style="display:flex; justify-content:flex-end; margin-top:12px;">
          <div style="width:260px; font-size:11px;">
            <div style="display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px solid #e5e5e5;"><span style="color:#666;">Subtotal (excl VAT)</span><strong>R ${sub.toFixed(2)}</strong></div>
            <div style="display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px solid #e5e5e5;"><span style="color:#666;">VAT @ 15%</span><strong>R ${vat.toFixed(2)}</strong></div>
            <div style="display:flex; justify-content:space-between; padding:5px 0; border-bottom:2px solid #D4A843;"><span style="font-weight:800; font-size:12px;">TOTAL DUE</span><strong style="color:#D4A843; font-size:13px;">R ${tot.toFixed(2)}</strong></div>
            ${paid > 0 ? `<div style="display:flex; justify-content:space-between; padding:3px 0;"><span style="color:#666;">Amount Paid</span><span style="color:#2E7D32;">R ${paid.toFixed(2)}</span></div>` : ""}
            ${bal > 0 ? `<div style="display:flex; justify-content:space-between; padding:4px 0; border-top:1px dashed #EF4444; margin-top:2px;"><span style="color:#EF4444; font-weight:800;">BALANCE OUTSTANDING</span><span style="color:#EF4444; font-weight:800;">R ${bal.toFixed(2)}</span></div>` : ""}
          </div>
        </div>
        <div style="margin-top:14px; padding:8px 12px; background:#FFF5F5; border:1.5px solid #EF4444; border-radius:3px; color:#EF4444; font-size:10px; font-weight:800; text-align:center; letter-spacing:0.3px;">
          PLEASE NOTE: NO EXCHANGES OR RETURNS AFTER 7 DAYS FROM INVOICE DATE. RETURNS ACCEPTED UNTIL: ${retDate.toLocaleDateString("en-ZA")}
        </div>
        ${isOffice ? `
        <div style="margin-top:14px; padding:10px; border:1.5px dashed #aaa; border-radius:4px;">
          <div style="font-weight:800; font-size:11px; color:#333; margin-bottom:8px; border-bottom:1px solid #ddd; padding-bottom:4px;">DELIVERY CONFIRMATION &mdash; OFFICE COPY</div>
          <table style="width:100%; font-size:10px; border-collapse:collapse;">
            <tr>
              <td style="width:33%; padding:6px; vertical-align:top;"><div style="color:#888; margin-bottom:4px;">Received By (Name &amp; Signature)</div><div style="border-bottom:1px solid #333; height:28px;"></div><div style="color:#999; font-size:9px; margin-top:3px;">Customer representative</div></td>
              <td style="width:33%; padding:6px; vertical-align:top;"><div style="color:#888; margin-bottom:4px;">Date &amp; Time Received</div><div style="border-bottom:1px solid #333; height:28px;"></div><div style="color:#999; font-size:9px; margin-top:3px;">DD/MM/YYYY HH:MM</div></td>
              <td style="width:33%; padding:6px; vertical-align:top;"><div style="color:#888; margin-bottom:4px;">Delivered By (Name &amp; Signature)</div><div style="border-bottom:1px solid #333; height:28px;"></div><div style="color:#999; font-size:9px; margin-top:3px;">Driver / Sales Rep</div></td>
            </tr>
          </table>
          <div style="font-size:9px; color:#999; text-align:center; margin-top:6px;">I confirm that the above goods were received in good order and condition. This signed copy must be returned to the Supreme Global Foods office.</div>
        </div>
        ` : `
        <div style="margin-top:14px; padding:10px; border:1.5px dashed #ccc; border-radius:4px;">
          <div style="font-weight:800; font-size:11px; color:#333; margin-bottom:6px;">GOODS RECEIPT</div>
          <div style="font-size:10px; color:#555; margin-bottom:8px;">Please sign below to confirm receipt of goods in good order:</div>
          <table style="width:100%; font-size:10px; border-collapse:collapse;">
            <tr>
              <td style="width:50%; padding:6px; vertical-align:top;"><div style="color:#888; margin-bottom:4px;">Received By (Signature)</div><div style="border-bottom:1px solid #333; height:28px;"></div></td>
              <td style="width:50%; padding:6px; vertical-align:top;"><div style="color:#888; margin-bottom:4px;">Date</div><div style="border-bottom:1px solid #333; height:28px;"></div></td>
            </tr>
          </table>
          <div style="font-size:9px; color:#999; text-align:center; margin-top:6px;">Keep this copy for your records. Returns accepted within 7 days of invoice date only.</div>
        </div>
        `}
        <div style="text-align:center; font-size:9px; color:#999; margin-top:12px; border-top:1px solid #ddd; padding-top:6px; line-height:1.5;">
          Banking: FNB | Account: 62001234567 | Branch Code: 250655 | Quote invoice number with payment<br/>
          E&nbsp;&amp;&nbsp;OE. Thank you for your business!
        </div>
      </div>`;

    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>SGF ${inv.invoiceNumber}</title>
      <style>@media print { body { padding: 0; margin: 0; } .page-break { page-break-before: always; } }
      body { font-family: Arial, Helvetica, sans-serif; color: #333; max-width: 210mm; margin: 0 auto; font-size: 11px; line-height: 1.4; }</style></head>
      <body>${copy("CUSTOMER COPY", false)}<div class="page-break"></div>${copy("OFFICE COPY", true)}
      <script>
        (function(){
          var done=false;
          function printIt(){ if(!done){ done=true; setTimeout(function(){ window.print(); }, 200); } }
          if(document.readyState==='complete') printIt();
          else window.onload=printIt;
          setTimeout(printIt, 2000);
        })();
      </script></body></html>`);
    w.document.close();
  }

  /* ── Print Receipt ── */
  function printReceipt(r: any) {
    const logoUrl = `${window.location.origin}/sgf-logo.png`;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>Receipt ${r.receiptNumber}</title>
      <style>
        @media print { body { padding: 12px; } }
        body { font-family: Arial, Helvetica, sans-serif; color: #333; max-width: 210mm; margin: 0 auto; font-size: 11px; line-height: 1.4; padding: 20px; }
        .header { text-align: center; border-bottom: 3px solid #D4A843; padding-bottom: 10px; margin-bottom: 16px; }
        .header img { height: 55px; margin-bottom: 4px; }
        .title { font-size: 22px; font-weight: 800; color: #D4A843; letter-spacing: 2px; text-transform: uppercase; margin-top: 6px; }
        .subtitle { font-size: 10px; color: #666; line-height: 1.5; margin-top: 4px; }
        .info-table { width: 100%; font-size: 11px; border-collapse: collapse; margin-bottom: 16px; }
        .info-table td { padding: 4px 0; vertical-align: top; }
        .info-table .label { color: #888; width: 35%; }
        .info-table .value { font-weight: 700; }
        .amount-box { background: #f9f9f9; border: 2px solid #D4A843; border-radius: 6px; padding: 16px; text-align: center; margin: 16px 0; }
        .amount-label { font-size: 10px; color: #888; text-transform: uppercase; letter-spacing: 1px; }
        .amount-value { font-size: 28px; font-weight: 800; color: #D4A843; margin-top: 4px; }
        .signatures { display: flex; gap: 40px; margin-top: 30px; }
        .sig-box { flex: 1; }
        .sig-label { font-size: 10px; color: #888; margin-bottom: 4px; }
        .sig-line { border-bottom: 1px solid #333; height: 30px; }
        .footer { text-align: center; font-size: 9px; color: #999; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
        .stamp-area { margin-top: 20px; padding: 15px; border: 2px dashed #D4A843; border-radius: 6px; text-align: center; }
        .stamp-text { font-size: 10px; color: #888; }
      </style></head>
      <body>
        <div class="header">
          <img src="${logoUrl}" onerror="this.style.display='none'" />
          <div class="subtitle">28 Nagington road, Wadeville, Germiston, 1422 &nbsp;|&nbsp; sales@supremeglobalfoods.co.za &nbsp;|&nbsp; Tel: 083 293 0644<br/>VAT Reg: 4120123456 &nbsp;|&nbsp; Reg No: 2015/123456/07</div>
          <div class="title">Payment Receipt</div>
        </div>

        <table class="info-table">
          <tr><td class="label">Receipt Number</td><td class="value" style="font-size:14px; color:#D4A843;">${r.receiptNumber}</td></tr>
          <tr><td class="label">Date</td><td class="value">${new Date(r.paymentDate || r.createdAt).toLocaleDateString("en-ZA")}</td></tr>
          <tr><td class="label">Received From</td><td class="value">${r.customerName || "N/A"}</td></tr>
          <tr><td class="label">Invoice Reference</td><td class="value">${r.invoiceNumber || "N/A"}</td></tr>
          <tr><td class="label">Order Reference</td><td class="value">${r.orderNumber || "N/A"}</td></tr>
          <tr><td class="label">Payment Method</td><td class="value">${(r.paymentMethod || "cash").toUpperCase()}</td></tr>
          ${r.referenceNumber ? `<tr><td class="label">Reference / Cheque #</td><td class="value">${r.referenceNumber}</td></tr>` : ""}
          ${r.notes ? `<tr><td class="label">Notes</td><td class="value" style="font-weight:400;">${r.notes}</td></tr>` : ""}
        </table>

        <div class="amount-box">
          <div class="amount-label">Amount Received</div>
          <div class="amount-value">R ${Number(r.amount || 0).toFixed(2)}</div>
        </div>

        <table class="info-table">
          <tr><td class="label">Total Invoice Amount</td><td>R ${Number(r.totalInvoiceAmount || 0).toFixed(2)}</td></tr>
          <tr><td class="label">Amount Paid Before</td><td>R ${Number(r.amountPaidBefore || 0).toFixed(2)}</td></tr>
          <tr><td class="label" style="color:#c00; font-weight:800;">Balance Remaining</td><td style="color:#c00; font-weight:800;">R ${Number(r.balanceAfter || 0).toFixed(2)}</td></tr>
        </table>

        <div class="stamp-area">
          <div class="stamp-text">OFFICIAL STAMP / AUTHORISED SIGNATURE</div>
          <div style="border-bottom:1px solid #333; height:35px; width:140px; margin:8px auto 0;"></div>
        </div>

        <div class="signatures">
          <div class="sig-box">
            <div class="sig-label">Received By (Signature)</div>
            <div class="sig-line"></div>
          </div>
          <div class="sig-box">
            <div class="sig-label">Date</div>
            <div class="sig-line"></div>
          </div>
        </div>

        <div class="footer">
          This receipt is proof of payment received by Supreme Global Foods.<br/>
          Please retain for your records. Queries: 083 293 0644
        </div>
      </body></html>`);
    w.document.write(`<script>
      (function(){
        var done=false;
        function printIt(){ if(!done){ done=true; setTimeout(function(){ window.print(); }, 200); } }
        if(document.readyState==='complete') printIt();
        else window.onload=printIt;
        setTimeout(printIt, 2000);
      })();
    </script>`);
    w.document.close();
  }

  /* ── Statement Print ── */
  async function printStmt() {
    // Force refresh tRPC data before generating statement — ensures Sage imports are included
    await refetchInvoices();
    await utils.invoice.list.invalidate();

    const cust = (customers || []).find((c: any) => c.id == stmtCust);
    if (!cust) { alert("Please select a customer."); return; }
    const logoUrl = `${window.location.origin}/sgf-logo.png`;

    // Build invoice list — match by customerId OR by customerCode (for Sage invoices)
    const custCode = cust.customerCode;
    let list = (invoices || []).filter((i: any) => {
      // Direct customerId match (app invoices and already-linked Sage invoices)
      if (i.customerId == stmtCust) return true;
      // Sage invoices: match by customerCode when customerId is 0/missing
      if (i.source === "sage" && custCode && (i.customerCode === custCode || (i.customer && i.customer.customerCode === custCode))) return true;
      return false;
    });
    if (stmtFrom) list = list.filter((i: any) => new Date(i.invoiceDate || i.createdAt) >= new Date(stmtFrom));
    if (stmtTo) list = list.filter((i: any) => new Date(i.invoiceDate || i.createdAt) <= new Date(stmtTo + "T23:59:59"));
    list = list.sort((a: any, b: any) => new Date(a.invoiceDate || a.createdAt).getTime() - new Date(b.invoiceDate || b.createdAt).getTime());

    let runningBal = 0;
    const lines = list.map((inv: any) => {
      const debit = Number(inv.total || 0);
      const credit = Number(inv.amountPaid || 0);
      runningBal += debit - credit;
      return { date: inv.invoiceDate || inv.createdAt, invoiceNumber: inv.invoiceNumber, orderNumber: inv.orderNumber || "", description: inv.notes || "Invoice", paymentTerms: inv.paymentTerms || "cod", debit, credit, balance: runningBal };
    });

    const totalDebit = list.reduce((s: number, i: any) => s + Number(i.total || 0), 0);
    const totalCredit = list.reduce((s: number, i: any) => s + Number(i.amountPaid || 0), 0);
    const closingBal = totalDebit - totalCredit;

    // Aging buckets
    const now = new Date();
    const aging = { current: 0, days30: 0, days60: 0, days90: 0, days90plus: 0 };
    for (const inv of list) {
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

    const fromStr = stmtFrom ? new Date(stmtFrom).toLocaleDateString("en-ZA") : "All time";
    const toStr = stmtTo ? new Date(stmtTo).toLocaleDateString("en-ZA") : new Date().toLocaleDateString("en-ZA");

    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>Statement - ${cust.name}</title>
      <style>
        @media print { body { padding: 0 12px; } }
        body { font-family: Arial, Helvetica, sans-serif; color: #333; max-width: 210mm; margin: 0 auto; font-size: 11px; line-height: 1.4; padding: 20px; }
        .header { text-align: center; border-bottom: 3px solid #D4A843; padding-bottom: 10px; margin-bottom: 16px; }
        .header img { height: 50px; margin-bottom: 6px; }
        .header h1 { font-size: 20px; font-weight: 800; color: #D4A843; margin: 6px 0; letter-spacing: 1px; text-transform: uppercase; }
        .info-grid { display: flex; justify-content: space-between; margin-bottom: 16px; font-size: 11px; }
        .info-block .label { font-size: 10px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px; }
        .info-block .value { font-weight: 700; font-size: 13px; color: #222; }
        table.ledger { width: 100%; border-collapse: collapse; font-size: 10.5px; }
        table.ledger thead th { background: #D4A843; color: #fff; padding: 7px 8px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
        table.ledger tbody td { padding: 6px 8px; border-bottom: 1px solid #e5e5e5; vertical-align: top; }
        table.ledger .num { text-align: right; }
        table.ledger .bal-positive { color: #c00; font-weight: 700; }
        .summary { margin-top: 12px; display: flex; justify-content: flex-end; }
        .summary-box { width: 260px; font-size: 11px; }
        .summary-box .row { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid #e5e5e5; }
        .summary-box .total { font-weight: 800; font-size: 13px; border-top: 2px solid #D4A843; border-bottom: 2px solid #D4A843; padding: 6px 0; margin-top: 2px; }
        .footer { text-align: center; font-size: 9px; color: #999; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; }
        .overdue-note { background: #FFF5F5; border: 1px solid #EF4444; color: #EF4444; padding: 6px; border-radius: 3px; font-size: 10px; font-weight: 700; text-align: center; margin-top: 12px; }
      </style></head>
      <body>
        <div class="header">
          <img src="${logoUrl}" onerror="this.style.display='none'" />
          <h1>Statement of Account</h1>
          <div style="font-size:10px; color:#666;">Period: ${fromStr} &nbsp;to&nbsp; ${toStr} &nbsp;|&nbsp; Generated: ${new Date().toLocaleDateString("en-ZA")}</div>
        </div>
        <div class="info-grid">
          <div class="info-block">
            <div class="label">Customer</div>
            <div class="value">${cust.name}</div>
            <div>${cust.contactPerson || ""}</div>
            <div>${cust.physicalAddress || ""}${cust.city ? `, ${cust.city}` : ""}</div>
            <div>Tel: ${cust.phone || "N/A"}</div>
            ${cust.email ? `<div>${cust.email}</div>` : ""}
          </div>
          <div class="info-block" style="text-align:right;">
            <div class="label">Account Summary</div>
            <div style="margin-top:4px;">Code: <strong>${cust.customerCode || "N/A"}</strong></div>
            <div>Total Debit: <strong>R ${totalDebit.toFixed(2)}</strong></div>
            <div>Total Credit: <strong>R ${totalCredit.toFixed(2)}</strong></div>
            ${closingBal > 0 ? `<div style="color:#c00; font-weight:800; font-size:13px; margin-top:4px;">BALANCE DUE: R ${closingBal.toFixed(2)}</div>` : `<div style="color:#2E7D32; font-weight:800; font-size:13px; margin-top:4px;">ACCOUNT SETTLED</div>`}
          </div>
        </div>
        <table class="ledger">
          <thead><tr>
            <th style="width:12%">Date</th>
            <th style="width:18%">Invoice #</th>
            <th style="width:18%">Order #</th>
            <th>Description</th>
            <th style="width:12%" class="num">Debit (R)</th>
            <th style="width:12%" class="num">Credit (R)</th>
            <th style="width:12%" class="num">Balance (R)</th>
          </tr></thead>
          <tbody>
            ${lines.length === 0 ? `<tr><td colspan="7" style="text-align:center; color:#999; padding:16px;">No invoices for the selected period.</td></tr>` : ""}
            ${lines.map((line: any) => `
              <tr>
                <td>${new Date(line.date).toLocaleDateString("en-ZA")}</td>
                <td><strong>${line.invoiceNumber}</strong></td>
                <td>${line.orderNumber || ""}</td>
                <td>${line.description || "Invoice"} <span style="color:#888;">(${(line.paymentTerms || "cod").replace("_"," ")})</span></td>
                <td class="num">${line.debit > 0 ? line.debit.toFixed(2) : "-"}</td>
                <td class="num" style="color:#2E7D32;">${line.credit > 0 ? line.credit.toFixed(2) : "-"}</td>
                <td class="num ${line.balance > 0 ? 'bal-positive' : ''}">${line.balance.toFixed(2)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
        <div class="summary">
          <div class="summary-box">
            <div class="row"><span style="color:#666;">Subtotal Debit</span><strong>R ${totalDebit.toFixed(2)}</strong></div>
            <div class="row"><span style="color:#666;">Subtotal Credit</span><strong>R ${totalCredit.toFixed(2)}</strong></div>
            <div class="total" style="${closingBal > 0 ? 'color:#c00;' : 'color:#2E7D32;'}">
              <span>${closingBal > 0 ? "CLOSING BALANCE DUE" : "ACCOUNT BALANCE"}</span>
              <strong>R ${Math.abs(closingBal).toFixed(2)}</strong>
            </div>
          </div>
        </div>
        <!-- Aging Summary -->
        <div style="margin-top:16px; border:1px solid #D4A843; border-radius:6px; overflow:hidden;">
          <div style="background:#D4A843; color:#fff; padding:6px 10px; font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px;">Outstanding Balance Aging</div>
          <table style="width:100%; border-collapse:collapse; font-size:10.5px;">
            <thead><tr style="background:#f9f9f9;">
              <th style="padding:6px 8px; text-align:left; border-bottom:1px solid #e5e5e5;">Current (0-30d)</th>
              <th style="padding:6px 8px; text-align:right; border-bottom:1px solid #e5e5e5;">30 Days</th>
              <th style="padding:6px 8px; text-align:right; border-bottom:1px solid #e5e5e5;">60 Days</th>
              <th style="padding:6px 8px; text-align:right; border-bottom:1px solid #e5e5e5;">90 Days</th>
              <th style="padding:6px 8px; text-align:right; border-bottom:1px solid #e5e5e5; color:#c00;">90+ Days</th>
              <th style="padding:6px 8px; text-align:right; border-bottom:1px solid #e5e5e5; background:#D4A843; color:#fff;">Total Outstanding</th>
            </tr></thead>
            <tbody><tr>
              <td style="padding:6px 8px; border-bottom:1px solid #e5e5e5;"><strong>R ${aging.current.toFixed(2)}</strong></td>
              <td style="padding:6px 8px; text-align:right; border-bottom:1px solid #e5e5e5;">R ${aging.days30.toFixed(2)}</td>
              <td style="padding:6px 8px; text-align:right; border-bottom:1px solid #e5e5e5;">R ${aging.days60.toFixed(2)}</td>
              <td style="padding:6px 8px; text-align:right; border-bottom:1px solid #e5e5e5;">R ${aging.days90.toFixed(2)}</td>
              <td style="padding:6px 8px; text-align:right; border-bottom:1px solid #e5e5e5; color:#c00; font-weight:700;">R ${aging.days90plus.toFixed(2)}</td>
              <td style="padding:6px 8px; text-align:right; border-bottom:1px solid #e5e5e5; font-weight:800; background:#FFF9E6;">R ${(aging.current + aging.days30 + aging.days60 + aging.days90 + aging.days90plus).toFixed(2)}</td>
            </tr></tbody>
          </table>
        </div>

        ${closingBal > 0 ? `<div class="overdue-note">Please arrange payment within your agreed terms. Outstanding balance must be settled to avoid account hold.</div>` : ""}
        <div class="footer">
          Supreme Global Foods &nbsp;|&nbsp; 28 Nagington road, Wadeville, Germiston, 1422 &nbsp;|&nbsp; 083 293 0644<br/>
          Banking: FNB | Acc: 62001234567 | Branch: 250655 | Quote customer code with payment
        </div>
      <script>
        (function(){
          var done=false;
          function printIt(){ if(!done){ done=true; setTimeout(function(){ window.print(); }, 200); } }
          if(document.readyState==='complete') printIt();
          else window.onload=printIt;
          setTimeout(printIt, 2000);
        })();
      </script></body></html>`);
    w.document.close();
  }

  /* ─── Email invoice via mailto ─── */
  function sendEmail(inv: any) {
    const cust = inv.customer || (customers || []).find((c: any) => c.id === inv.customerId);
    if (!cust?.email) { alert("Customer has no email address."); return; }
    const subject = encodeURIComponent(`Tax Invoice ${inv.invoiceNumber} - ${cust.name || ""}`);
    const body = encodeURIComponent(
      `Dear ${cust.name || "Valued Customer"},\n\n` +
      `Please find attached your Tax Invoice ${inv.invoiceNumber} for order ${inv.orderNumber || ""}.\n\n` +
      `Invoice Date: ${new Date(inv.invoiceDate || inv.createdAt).toLocaleDateString("en-ZA")}\n` +
      `Total Amount: R ${Number(inv.total || 0).toFixed(2)}\n` +
      `Payment Terms: ${(inv.paymentTerms || "cod").replace("_", " ").toUpperCase()}\n\n` +
      `Banking Details:\nFNB | Account: 62001234567 | Branch Code: 250655\n` +
      `Please quote your invoice number with payment.\n\n` +
      `PLEASE NOTE: NO EXCHANGES OR RETURNS AFTER 7 DAYS FROM INVOICE DATE.\n\n` +
      `Kind regards,\nSupreme Global Foods Team\nTel: 083 293 0644`
    );
    window.location.href = `mailto:${cust.email}?subject=${subject}&body=${body}`;
  }

  /* ─── Render ─── */
  return (
    <div className="space-y-6">

      {/* ═══════ HEADER ═══════ */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display font-semibold text-white" style={{ fontSize: "clamp(1.8rem,3vw,2.5rem)", letterSpacing: "-0.03em" }}>Invoices</h1>
          <p className="text-[#8A8B8C] font-body text-sm mt-1">
            Outstanding: R {(stats?.outstanding || 0).toLocaleString("en-ZA", { minimumFractionDigits: 2 })} &middot; {stats?.total || 0} invoices
          </p>
        </div>
        <button onClick={() => { setShowStmt(true); setStmtCust(0); setStmtFrom("2020-01-01"); setStmtTo(new Date().toISOString().slice(0, 10)); }} className="btn-secondary text-xs">
          <FileText className="w-3.5 h-3.5" /> Print Statement
        </button>
      </div>

      {/* ═══════ STATS CARDS (clickable filters) ═══════ */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { key: "all", label: "ALL", v: stats?.total || 0, c: "#8A8B8C" },
          { key: "draft", label: "DRAFT", v: stats?.draft || 0, c: "#8B5CF6" },
          { key: "sent", label: "SENT", v: stats?.sent || 0, c: "#3B82F6" },
          { key: "partially_paid", label: "PARTIAL", v: stats?.partiallyPaid || 0, c: "#F59E0B" },
          { key: "paid", label: "PAID", v: stats?.paid || 0, c: "#4ADE80" },
          { key: "overdue", label: "OVERDUE", v: stats?.overdue || 0, c: "#EF4444" },
        ].map((s) => (
          <button
            key={s.key}
            onClick={() => setStatusFilter(s.key)}
            className="card-surface p-3 text-center cursor-pointer transition-all hover:brightness-110"
            style={{ border: statusFilter === s.key ? `2px solid ${s.c}` : "1px solid #222324" }}
          >
            <div className="label-text mb-1">{s.label}</div>
            <div className="stat-number" style={{ fontSize: "1.5rem", color: s.c }}>{s.v}</div>
          </button>
        ))}
      </div>

      {/* ═══════ SEARCH + SOURCE FILTER + SORT ═══════ */}
      <div className="card-surface p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#8A8B8C]" />
            <input
              type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search invoice number, customer name, order number..."
              className="input-field w-full pl-10"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {/* Source filter */}
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="input-field text-sm py-2 px-3"
              style={{ minWidth: "120px" }}
            >
              <option value="all">All Sources</option>
              <option value="system">System Only</option>
              <option value="sage">Sage Import</option>
            </select>
            {/* Sort by */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="input-field text-sm py-2 px-3"
              style={{ minWidth: "110px" }}
            >
              <option value="date">Sort by Date</option>
              <option value="number">Sort by Number</option>
            </select>
          </div>
        </div>
        {/* Sage count indicator */}
        {(invoices || []).filter((i: any) => i.source === "sage").length > 0 && (
          <div className="mt-3 flex items-center gap-2 text-xs">
            <span className="px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(99,102,241,0.15)", color: "#818CF8", border: "1px solid rgba(99,102,241,0.3)" }}>
              Sage Import
            </span>
            <span className="text-[#8A8B8C]">
              {(invoices || []).filter((i: any) => i.source === "sage").length} historical invoice(s) loaded
              {sourceFilter !== "all" && (
                <button onClick={() => setSourceFilter("all")} className="ml-2 underline text-[#D4A843] hover:text-white">Show all</button>
              )}
            </span>
          </div>
        )}
      </div>

      {/* ═══════ INVOICE TABLE ═══════ */}
      <div className="card-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ backgroundColor: "#131415", borderBottom: "1px solid #222324" }}>
                <th className="text-left p-3 label-text" style={{ width: "18%" }}>Invoice #</th>
                <th className="text-left p-3 label-text">Customer</th>
                <th className="text-left p-3 label-text">Order #</th>
                <th className="text-left p-3 label-text">Date</th>
                <th className="text-right p-3 label-text">Amount</th>
                <th className="text-right p-3 label-text">Balance</th>
                <th className="text-center p-3 label-text">Status</th>
                <th className="text-right p-3 label-text">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="text-center py-8 text-[#8A8B8C] font-body">No invoices found.</td></tr>
              )}
              {filtered.map((inv: any) => {
                const isExp = expanded === inv.id;
                const tot = Number(inv.total || 0);
                const paid = Number(inv.amountPaid || 0);
                const bal = Number(inv.balanceDue || tot - paid);
                const invReceipts = (allReceipts || []).filter((r: any) => r.invoiceId === inv.id);
                return (
                  <>
                    <tr
                      key={inv.id}
                      className="cursor-pointer transition-colors hover:bg-[#131415]"
                      style={{ borderBottom: "1px solid #18191A" }}
                      onClick={() => setExpanded(isExp ? null : inv.id)}
                    >
                      <td className="p-3 font-display font-semibold text-sm text-[#D4A843]">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {inv.invoiceNumber}
                          {inv.source === "sage" && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ backgroundColor: "rgba(99,102,241,0.15)", color: "#818CF8", border: "1px solid rgba(99,102,241,0.3)" }}>SAGE</span>
                          )}
                          {(inv.items || []).length > 0 && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ backgroundColor: "rgba(74,222,128,0.1)", color: "#4ADE80" }}>{inv.items.length} item{(inv.items || []).length !== 1 ? "s" : ""}</span>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-sm text-[#E8E8E9] font-body">{inv.customer?.name || "N/A"}</td>
                      <td className="p-3 text-xs text-[#8A8B8C] font-mono-data">{inv.orderNumber || "-"}</td>
                      <td className="p-3 text-xs text-[#8A8B8C]">{new Date(inv.invoiceDate || inv.createdAt).toLocaleDateString("en-ZA")}</td>
                      <td className="p-3 text-right text-sm text-white font-display">R {tot.toFixed(2)}</td>
                      <td className="p-3 text-right text-sm font-display" style={{ color: bal > 0 && inv.status !== "draft" ? "#EF4444" : "#4ADE80" }}>
                        {inv.status === "draft" ? "-" : `R ${bal.toFixed(2)}`}
                      </td>
                      <td className="p-3 text-center">{badge(inv.status)}</td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => printDoc(inv)} className="p-1.5 rounded hover:bg-[#222324]" title="Print Invoice & Delivery Note"><Printer className="w-3.5 h-3.5 text-[#8A8B8C]" /></button>
                          {isAdmin && (
                            <button onClick={() => { setEditInvId(inv.id); setEditInvNumber(inv.invoiceNumber); setEditInvCustomerId(inv.customerId || 0); setEditInvDate(inv.invoiceDate ? inv.invoiceDate.slice(0, 10) : ""); setEditInvTotal(String(inv.total || 0)); setEditInvPaid(String(inv.amountPaid || 0)); setEditInvNotes(inv.notes || ""); setEditInvStatus(inv.status || "sent"); setShowEditInv(true); }} className="p-1.5 rounded hover:bg-[#222324]" title="Edit Invoice"><Pencil className="w-3.5 h-3.5 text-[#D4A843]" /></button>
                          )}
                          {isAdmin && inv.status !== "draft" && bal > 0 && (
                            <button onClick={() => openPay(inv)} className="p-1.5 rounded hover:bg-[#222324]" title="Record Payment"><DollarSign className="w-3.5 h-3.5 text-[#4ADE80]" /></button>
                          )}
                          {isAdmin && inv.status !== "draft" && (
                            <button onClick={() => sendEmail(inv)} className="p-1.5 rounded hover:bg-[#222324]" title="Email Invoice"><Mail className="w-3.5 h-3.5 text-[#3B82F6]" /></button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Expanded detail row */}
                    {isExp && (
                      <tr><td colSpan={8} className="p-0">
                        <div className="p-5" style={{ backgroundColor: "#0A0A0B" }}>

                          {/* 7-day returns notice */}
                          <div className="flex items-center gap-2 p-2.5 rounded-lg text-xs font-bold mb-4" style={{ backgroundColor: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", color: "#EF4444" }}>
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            PLEASE NOTE: NO EXCHANGES OR RETURNS AFTER 7 DAYS FROM INVOICE DATE
                          </div>

                          {/* Items table */}
                          {(inv.items || []).length > 0 && (
                            <div className="mb-4">
                              <div className="label-text mb-2 flex items-center gap-2">
                                {inv.source === "sage" ? (
                                  <>
                                    <Database className="w-3.5 h-3.5 text-[#818CF8]" /> Sage Order Details — {(inv.items || []).length} line item{(inv.items || []).length !== 1 ? "s" : ""}
                                  </>
                                ) : (
                                  <>Invoice Items</>
                                )}
                              </div>
                              <table className="w-full text-xs">
                                <thead>
                                  <tr style={{ borderBottom: "1px solid #222324" }}>
                                    <th className="text-left p-2 label-text">#</th>
                                    <th className="text-left p-2 label-text">Description</th>
                                    <th className="text-right p-2 label-text">Qty</th>
                                    <th className="text-right p-2 label-text">Unit Price</th>
                                    <th className="text-right p-2 label-text">Line Total</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {inv.items.map((it: any, idx: number) => (
                                    <tr key={idx} style={{ borderBottom: "1px solid #18191A" }}>
                                      <td className="p-2 text-[#888]">{idx + 1}</td>
                                      <td className="p-2 text-[#E8E8E9]">{it.description || it.productName || "Item"}</td>
                                      <td className="p-2 text-right text-white">{it.quantity || 0}</td>
                                      <td className="p-2 text-right text-[#8A8B8C]">R {Number(it.unitPrice || 0).toFixed(2)}</td>
                                      <td className="p-2 text-right text-[#D4A843] font-medium">R {Number(it.lineTotal || 0).toFixed(2)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}

                          {/* Totals */}
                          <div className="flex justify-end mb-4">
                            <div className="text-right space-y-1 text-xs" style={{ width: 220 }}>
                              <div className="flex justify-between"><span className="text-[#8A8B8C]">Subtotal (excl VAT):</span><span>R {Number(inv.subtotal || 0).toFixed(2)}</span></div>
                              <div className="flex justify-between"><span className="text-[#8A8B8C]">VAT 15%:</span><span>R {Number(inv.vatAmount || 0).toFixed(2)}</span></div>
                              <div className="flex justify-between pt-1" style={{ borderTop: "1px solid #D4A843" }}>
                                <span className="text-[#D4A843] font-semibold">Total:</span><span className="text-[#D4A843] font-bold">R {tot.toFixed(2)}</span>
                              </div>
                              {paid > 0 && <div className="flex justify-between"><span className="text-[#8A8B8C]">Paid:</span><span className="text-[#4ADE80]">R {paid.toFixed(2)}</span></div>}
                              {bal > 0 && inv.status !== "draft" && (
                                <div className="flex justify-between pt-1" style={{ borderTop: "1px solid #EF4444" }}>
                                  <span className="text-[#EF4444] font-bold">Balance Due:</span><span className="text-[#EF4444] font-bold">R {bal.toFixed(2)}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Payment History */}
                          {inv.payments && inv.payments.length > 0 && (
                            <div className="mb-4">
                              <div className="label-text mb-2 flex items-center gap-2">
                                <DollarSign className="w-3.5 h-3.5" /> Payment History
                              </div>
                              <div className="space-y-1">
                                {inv.payments.map((p: any) => (
                                  <div key={p.id} className="flex items-center justify-between p-2.5 rounded-lg text-xs" style={{ backgroundColor: "#18191A" }}>
                                    <div className="flex items-center gap-3 flex-wrap">
                                      <CheckCircle className="w-3.5 h-3.5 text-[#4ADE80] shrink-0" />
                                      <span className="text-[#4ADE80] font-semibold">R {Number(p.amount || 0).toFixed(2)}</span>
                                      <span className="text-[#8A8B8C] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#0A0A0B" }}>{(p.paymentMethod || "cash").toUpperCase()}</span>
                                      {p.referenceNumber && <span className="text-[#8A8B8C]">Ref: {p.referenceNumber}</span>}
                                      <span className="text-[#8A8B8C]">{new Date(p.paymentDate || p.createdAt).toLocaleDateString("en-ZA")}</span>
                                      {p.notes && <span className="text-[#8A8B8C] italic">{p.notes}</span>}
                                    </div>
                                    {isAdmin && (
                                      <div className="flex gap-1">
                                        <button onClick={() => openEditPay(inv.id, inv.invoiceNumber, inv.customer?.name, p)} className="p-1.5 rounded hover:bg-[#222324]" title="Edit"><Pencil className="w-3 h-3 text-[#D4A843]" /></button>
                                        <button onClick={() => { if (confirm("Delete this payment?")) delPay.mutate({ invoiceId: inv.id, paymentId: p.id }); }} className="p-1.5 rounded hover:bg-[#222324]" title="Delete"><Trash2 className="w-3 h-3 text-[#EF4444]" /></button>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Receipts for this invoice */}
                          {invReceipts.length > 0 && (
                            <div className="mb-4">
                              <div className="label-text mb-2 flex items-center gap-2">
                                <Receipt className="w-3.5 h-3.5" /> Receipts Issued
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {invReceipts.map((r: any) => (
                                  <button
                                    key={r.id}
                                    onClick={() => setShowReceipt(r)}
                                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all hover:brightness-110"
                                    style={{ backgroundColor: "rgba(212,168,67,0.12)", border: "1px solid rgba(212,168,67,0.3)", color: "#D4A843" }}
                                  >
                                    <Receipt className="w-3.5 h-3.5" />
                                    {r.receiptNumber} &mdash; R {Number(r.amount || 0).toFixed(2)} &mdash; {new Date(r.createdAt).toLocaleDateString("en-ZA")}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Credit Notes */}
                          {isAdmin && (
                            <div className="mb-4">
                              <div className="label-text mb-2 flex items-center gap-2">
                                <RotateCcw className="w-3.5 h-3.5" /> Credit Notes
                              </div>
                              {(() => {
                                const invCreditNotes = (allCreditNotes || []).filter((cn: any) => cn.invoiceId === inv.id && !cn.voided);
                                return invCreditNotes.length > 0 ? (
                                  <div className="space-y-1">
                                    {invCreditNotes.map((cn: any) => (
                                      <div key={cn.id} className="flex items-center justify-between p-2.5 rounded-lg text-xs" style={{ backgroundColor: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}>
                                        <div className="flex items-center gap-2">
                                          <RotateCcw className="w-3.5 h-3.5 text-[#F59E0B] shrink-0" />
                                          <span className="text-[#F59E0B] font-semibold">{cn.creditNoteNumber}</span>
                                          <span className="text-[#F59E0B]">R {Number(cn.amount || 0).toFixed(2)}</span>
                                          <span className="text-[#8A8B8C]">{cn.reason}</span>
                                          <span className="text-[#8A8B8C]">{new Date(cn.createdAt).toLocaleDateString("en-ZA")}</span>
                                        </div>
                                        <button onClick={() => { if (confirm("Void this credit note? The invoice balance will be restored.")) voidCreditNote.mutate(cn.id); }} className="p-1.5 rounded hover:bg-[#222324]" title="Void"><Trash2 className="w-3 h-3 text-[#EF4444]" /></button>
                                      </div>
                                    ))}
                                  </div>
                                ) : <div className="text-xs text-[#8A8B8C]">No credit notes</div>;
                              })()}
                            </div>
                          )}

                          {/* Action buttons row */}
                          <div className="flex gap-2 flex-wrap pt-3" style={{ borderTop: "1px solid #222324" }}>
                            <button onClick={() => printDoc(inv)} className="btn-secondary text-xs"><Printer className="w-3 h-3" /> Print Invoice &amp; DN</button>
                            {isAdmin && inv.status !== "draft" && bal > 0 && (
                              <button onClick={() => openPay(inv)} className="btn-primary text-xs"><DollarSign className="w-3 h-3" /> Record Payment</button>
                            )}
                            {isAdmin && inv.status !== "draft" && bal > 0 && (
                              <button onClick={() => { setCnInvId(inv.id); setCnAmount(String(bal)); setShowCreditNote(true); }} className="btn-secondary text-xs" style={{ borderColor: "rgba(245,158,11,0.3)" }}><RotateCcw className="w-3 h-3" /> Credit Note</button>
                            )}
                            {isAdmin && inv.status !== "draft" && (
                              <button onClick={() => sendEmail(inv)} className="btn-secondary text-xs" style={{ borderColor: "rgba(59,130,246,0.3)" }}><Mail className="w-3 h-3" /> Email to Customer</button>
                            )}
                          </div>

                        </div>
                      </td></tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══════ PAYMENT MODAL ═══════ */}
      {showPayForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.7)" }}>
          <div className="card-surface p-6 max-w-md w-full mx-4" style={{ borderRadius: 16 }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-display font-semibold text-white text-lg">{editPayId ? "Edit Payment" : "Record Payment"}</h2>
                <p className="text-xs text-[#8A8B8C] mt-0.5">{payInvNumber} &middot; {payCustName}</p>
              </div>
              <button onClick={closePay} className="cursor-pointer"><X className="w-5 h-5 text-[#8A8B8C]" /></button>
            </div>
            <div className="p-3 rounded-lg mb-4 text-xs" style={{ backgroundColor: "rgba(74,222,128,0.06)", border: "1px solid rgba(74,222,128,0.15)", color: "#4ADE80" }}>
              After saving, a payment receipt will be generated automatically and can be printed for the customer.
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
                <label className="label-text block mb-1.5">Reference / Cheque #</label>
                <input type="text" value={payRef} onChange={(e) => setPayRef(e.target.value)} className="input-field" placeholder="EFT ref or cheque number" />
              </div>
              <div>
                <label className="label-text block mb-1.5">Notes</label>
                <textarea value={payNotes} onChange={(e) => setPayNotes(e.target.value)} className="input-field" rows={2} />
              </div>
              <button
                onClick={() => {
                  const payload = { invoiceId: payInvId, amount: parseFloat(payAmt), paymentMethod: payMethod, paymentDate: payDate, referenceNumber: payRef, notes: payNotes };
                  if (editPayId) editPay.mutate({ ...payload, paymentId: editPayId });
                  else recordPay.mutate(payload);
                }}
                className="btn-primary w-full justify-center"
              >
                <DollarSign className="w-4 h-4" /> {editPayId ? "Update Payment" : "Record Payment & Generate Receipt"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════ STATEMENT MODAL ═══════ */}
      {showStmt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.7)" }}>
          <div className="card-surface p-6 max-w-md w-full mx-4" style={{ borderRadius: 16 }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-semibold text-white text-lg">Print Statement</h2>
              <button onClick={() => setShowStmt(false)} className="cursor-pointer"><X className="w-5 h-5 text-[#8A8B8C]" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label-text block mb-1.5">Customer *</label>
                <select value={stmtCust} onChange={(e) => setStmtCust(parseInt(e.target.value))} className="input-field">
                  <option value={0}>Select customer...</option>
                  {(customers || []).map((c: any) => <option key={c.id} value={c.id}>{c.name} ({c.customerCode || ""})</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label-text block mb-1.5">From Date</label><input type="date" value={stmtFrom} onChange={(e) => setStmtFrom(e.target.value)} className="input-field" /></div>
                <div><label className="label-text block mb-1.5">To Date</label><input type="date" value={stmtTo} onChange={(e) => setStmtTo(e.target.value)} className="input-field" /></div>
              </div>
              {stmtCust > 0 && (
                <div className="text-xs text-center" style={{ color: (invoices || []).filter((i: any) => i.customerId == stmtCust).length > 0 ? "#4ADE80" : "#8A8B8C" }}>
                  {(invoices || []).filter((i: any) => i.customerId == stmtCust).length} invoice{(invoices || []).filter((i: any) => i.customerId == stmtCust).length !== 1 ? "s" : ""} found
                </div>
              )}
              <button
                onClick={async () => { if (stmtCust) { await printStmt(); setShowStmt(false); } }}
                disabled={!stmtCust}
                className="btn-primary w-full justify-center"
                style={{ opacity: stmtCust ? 1 : 0.5 }}
              >
                <Printer className="w-4 h-4" /> Print Statement
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════ CREDIT NOTE MODAL ═══════ */}
      {showCreditNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.7)" }}>
          <div className="card-surface p-6 max-w-md w-full mx-4" style={{ borderRadius: 16 }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-semibold text-white text-lg flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-[#F59E0B]" /> Create Credit Note
              </h2>
              <button onClick={() => setShowCreditNote(false)} className="cursor-pointer"><X className="w-5 h-5 text-[#8A8B8C]" /></button>
            </div>
            <div className="p-3 rounded-lg mb-4 text-xs" style={{ backgroundColor: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", color: "#F59E0B" }}>
              A credit note reduces the customer's outstanding balance. The invoice will be updated automatically.
            </div>
            <div className="space-y-4">
              <div>
                <label className="label-text block mb-1.5">Credit Amount (R) *</label>
                <input type="number" step="0.01" value={cnAmount} onChange={(e) => setCnAmount(e.target.value)} className="input-field" placeholder="0.00" />
              </div>
              <div>
                <label className="label-text block mb-1.5">Reason *</label>
                <select value={cnReason} onChange={(e) => setCnReason(e.target.value)} className="input-field">
                  <option value="">Select reason...</option>
                  <option value="Stock return">Stock Return</option>
                  <option value="Damaged goods">Damaged Goods</option>
                  <option value="Price adjustment">Price Adjustment</option>
                  <option value="Discount applied">Discount Applied</option>
                  <option value="Other">Other</option>
                </select>
                {cnReason === "Other" && (
                  <input type="text" value={cnReason} onChange={(e) => setCnReason(e.target.value)} className="input-field mt-2" placeholder="Enter reason..." />
                )}
              </div>
              <button
                onClick={() => {
                  if (!cnAmount || parseFloat(cnAmount) <= 0) return;
                  if (!cnReason) return;
                  createCreditNote.mutate({ invoiceId: cnInvId, amount: parseFloat(cnAmount), reason: cnReason });
                }}
                className="btn-primary w-full justify-center"
              >
                <RotateCcw className="w-4 h-4" /> Create Credit Note
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════ RECEIPT PRINT MODAL ═══════ */}
      {showReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.7)" }}>
          <div className="card-surface p-6 max-w-md w-full mx-4" style={{ borderRadius: 16 }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-display font-semibold text-white text-lg flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-[#D4A843]" /> Receipt {showReceipt.receiptNumber}
                </h2>
                <p className="text-xs text-[#8A8B8C] mt-0.5">{showReceipt.customerName} &middot; {new Date(showReceipt.createdAt).toLocaleDateString("en-ZA")}</p>
              </div>
              <button onClick={() => setShowReceipt(null)} className="cursor-pointer"><X className="w-5 h-5 text-[#8A8B8C]" /></button>
            </div>

            <div className="p-4 rounded-lg mb-4 text-center" style={{ backgroundColor: "rgba(212,168,67,0.08)", border: "2px solid #D4A843" }}>
              <div className="text-xs text-[#8A8B8C] uppercase tracking-wider mb-1">Amount Received</div>
              <div className="text-3xl font-display font-bold" style={{ color: "#D4A843" }}>R {Number(showReceipt.amount || 0).toFixed(2)}</div>
            </div>

            <div className="space-y-2 text-xs mb-4">
              <div className="flex justify-between py-1" style={{ borderBottom: "1px solid #222324" }}>
                <span className="text-[#8A8B8C]">Invoice</span><span className="text-white">{showReceipt.invoiceNumber}</span>
              </div>
              <div className="flex justify-between py-1" style={{ borderBottom: "1px solid #222324" }}>
                <span className="text-[#8A8B8C]">Payment Method</span><span className="text-white">{(showReceipt.paymentMethod || "cash").toUpperCase()}</span>
              </div>
              {showReceipt.referenceNumber && (
                <div className="flex justify-between py-1" style={{ borderBottom: "1px solid #222324" }}>
                  <span className="text-[#8A8B8C]">Reference</span><span className="text-white">{showReceipt.referenceNumber}</span>
                </div>
              )}
              <div className="flex justify-between py-1" style={{ borderBottom: "1px solid #222324" }}>
                <span className="text-[#8A8B8C]">Invoice Total</span><span className="text-white">R {Number(showReceipt.totalInvoiceAmount || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-1" style={{ borderBottom: "1px solid #222324" }}>
                <span className="text-[#8A8B8C]">Paid Before</span><span className="text-white">R {Number(showReceipt.amountPaidBefore || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-2" style={{ borderTop: "1px solid #EF4444", borderBottom: "1px solid #EF4444" }}>
                <span className="text-[#EF4444] font-bold">Balance Remaining</span>
                <span className="text-[#EF4444] font-bold">R {Number(showReceipt.balanceAfter || 0).toFixed(2)}</span>
              </div>
            </div>

            {showReceipt.notes && (
              <div className="p-2.5 rounded-lg mb-4 text-xs text-[#8A8B8C] italic" style={{ backgroundColor: "#18191A" }}>{showReceipt.notes}</div>
            )}

            <button onClick={() => printReceipt(showReceipt)} className="btn-primary w-full justify-center">
              <Printer className="w-4 h-4" /> Print Receipt for Customer
            </button>
          </div>
        </div>
      )}

      {/* ═══════ ADMIN EDIT INVOICE MODAL ═══════ */}
      {showEditInv && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.7)" }}>
          <div className="card-surface p-6 max-w-md w-full mx-4" style={{ borderRadius: 16 }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-semibold text-white text-lg flex items-center gap-2">
                <Pencil className="w-5 h-5 text-[#D4A843]" /> Edit Invoice {editInvNumber}
              </h2>
              <button onClick={() => setShowEditInv(false)} className="cursor-pointer"><X className="w-5 h-5 text-[#8A8B8C]" /></button>
            </div>
            <div className="p-3 rounded-lg mb-4 text-xs" style={{ backgroundColor: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", color: "#F59E0B" }}>
              Admin only: Use this to correct historical invoice data. Changes are saved immediately.
            </div>
            <div className="space-y-4">
              <div>
                <label className="label-text block mb-1.5">Invoice Number *</label>
                <input
                  type="text"
                  value={editInvNumber}
                  onChange={(e) => setEditInvNumber(e.target.value)}
                  className="input-field"
                  placeholder="e.g. SGF1817"
                />
              </div>
              <div>
                <label className="label-text block mb-1.5">Customer *</label>
                <select value={editInvCustomerId} onChange={(e) => setEditInvCustomerId(parseInt(e.target.value))} className="input-field">
                  <option value={0}>Select customer...</option>
                  {(customers || []).map((c: any) => <option key={c.id} value={c.id}>{c.name} ({c.customerCode || ""})</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-text block mb-1.5">Invoice Date</label>
                  <input type="date" value={editInvDate} onChange={(e) => setEditInvDate(e.target.value)} className="input-field" />
                </div>
                <div>
                  <label className="label-text block mb-1.5">Status</label>
                  <select value={editInvStatus} onChange={(e) => setEditInvStatus(e.target.value)} className="input-field">
                    <option value="sent">Sent</option>
                    <option value="paid">Paid</option>
                    <option value="partially_paid">Partially Paid</option>
                    <option value="overdue">Overdue</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-text block mb-1.5">Total (R)</label>
                  <input type="number" step="0.01" value={editInvTotal} onChange={(e) => setEditInvTotal(e.target.value)} className="input-field" />
                </div>
                <div>
                  <label className="label-text block mb-1.5">Amount Paid (R)</label>
                  <input type="number" step="0.01" value={editInvPaid} onChange={(e) => setEditInvPaid(e.target.value)} className="input-field" />
                </div>
              </div>
              <div>
                <label className="label-text block mb-1.5">Notes</label>
                <textarea value={editInvNotes} onChange={(e) => setEditInvNotes(e.target.value)} className="input-field" rows={2} />
              </div>
              <button
                onClick={() => {
                  if (!editInvCustomerId) return;
                  const payload: any = {
                    id: editInvId,
                    data: {
                      invoiceNumber: editInvNumber,
                      customerId: editInvCustomerId,
                      invoiceDate: editInvDate ? new Date(editInvDate).toISOString() : undefined,
                      total: parseFloat(editInvTotal),
                      amountPaid: parseFloat(editInvPaid),
                      balanceDue: parseFloat(editInvTotal) - parseFloat(editInvPaid),
                      status: editInvStatus,
                      notes: editInvNotes,
                    },
                  };
                  updateInvoice.mutate(payload);
                }}
                className="btn-primary w-full justify-center"
              >
                <Pencil className="w-4 h-4" /> Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
