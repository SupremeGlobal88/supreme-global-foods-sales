import { useState } from "react";
import { trpc } from "@/providers/trpc";
import {
  FileText,
  Plus,
  X,
  Printer,
  Mail,
  DollarSign,
  CheckCircle,
  AlertTriangle,
  Clock,
} from "lucide-react";

export default function InvoicesPage() {
  const utils = trpc.useUtils();

  const [activeTab, setActiveTab] = useState<"invoices" | "statements">("invoices");
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<number | null>(null);

  const { data: invoices } = trpc.invoice.list.useQuery();
  const { data: stats } = trpc.invoice.getStats.useQuery();
  const { data: customers } = trpc.customer.search.useQuery({ query: " " });

  const recordPayment = trpc.invoice.recordPayment.useMutation({
    onSuccess: () => { utils.invoice.list.invalidate(); utils.invoice.getStats.invalidate(); setShowPaymentForm(false); },
  });
  const createInvoice = trpc.invoice.create.useMutation({
    onSuccess: () => { utils.invoice.list.invalidate(); utils.invoice.getStats.invalidate(); setShowInvoiceForm(false); },
  });

  function getStatusStyle(status: string) {
    switch (status) {
      case "paid": return { bg: "rgba(74,222,128,0.12)", color: "#4ADE80" };
      case "overdue": return { bg: "rgba(239,68,68,0.12)", color: "#EF4444" };
      case "sent": return { bg: "rgba(245,158,11,0.12)", color: "#F59E0B" };
      case "partially_paid": return { bg: "rgba(99,102,241,0.12)", color: "#6366F1" };
      default: return { bg: "rgba(42,43,44,0.5)", color: "#8A8B8C" };
    }
  }

  function printInvoice(invoice: NonNullable<typeof invoices>[0]) {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    const style = getStatusStyle(invoice.status);
    printWindow.document.write(`
      <html><head><title>Invoice - ${invoice.invoiceNumber}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; color: #333; }
        .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #D4A843; padding-bottom: 20px; }
        .logo { font-size: 28px; font-weight: bold; color: #D4A843; }
        .subtitle { color: #666; font-size: 13px; margin-top: 4px; }
        .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; margin-top: 8px; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin: 24px 0; padding: 16px; background: #f9f9f9; border-radius: 8px; }
        .label { font-size: 11px; color: #999; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
        .value { font-size: 14px; font-weight: 600; }
        table { width: 100%; border-collapse: collapse; margin: 24px 0; }
        th { background: #f5f5f5; padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #666; border-bottom: 2px solid #ddd; }
        td { padding: 12px; border-bottom: 1px solid #eee; font-size: 13px; }
        .totals { text-align: right; margin-top: 24px; padding: 20px; background: #f9f9f9; border-radius: 8px; }
        .totals-row { display: flex; justify-content: flex-end; gap: 40px; margin-bottom: 8px; }
        .grand-total { font-size: 20px; font-weight: bold; color: #D4A843; margin-top: 12px; padding-top: 12px; border-top: 2px solid #D4A843; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; font-size: 12px; color: #999; }
        .delivery-note { margin-top: 30px; padding: 20px; border: 2px dashed #ddd; border-radius: 8px; }
      </style></head><body>
      <div class="header">
        <div class="logo">Supreme Global Foods</div>
        <div class="subtitle">Germiston, 1422, South Africa | +27614788888</div>
        <div class="subtitle">sales@supremeglobalfoods.co.za | www.supremeglobalfoods.co.za</div>
        <div class="subtitle">VAT: 4120123456 | Reg: 2015/123456/07</div>
      </div>
      <div style="text-align:center;">
        <h1 style="font-size:32px; margin:0; color:#333;">TAX INVOICE</h1>
        <div class="badge" style="background:${style.bg}; color:${style.color};">${invoice.status.toUpperCase()}</div>
      </div>
      <div class="info-grid">
        <div><div class="label">Invoice Number</div><div class="value">${invoice.invoiceNumber}</div></div>
        <div><div class="label">Invoice Date</div><div class="value">${new Date(invoice.invoiceDate!).toLocaleDateString("en-ZA")}</div></div>
        <div><div class="label">Due Date</div><div class="value">${invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString("en-ZA") : "N/A"}</div></div>
        <div><div class="label">Payment Terms</div><div class="value">${invoice.paymentTerms.replace("_", " ").toUpperCase()}</div></div>
      </div>
      <div class="info-grid" style="background:#fff; border:1px solid #eee;">
        <div><div class="label">Bill To</div><div class="value">${invoice.customer?.name || "N/A"}</div><div style="font-size:13px; color:#666; margin-top:4px;">${invoice.customer?.businessName || ""}<br>${invoice.customer?.physicalAddress || ""}<br>${invoice.customer?.city || ""}, ${invoice.customer?.province || ""}</div></div>
        <div><div class="label">Delivery Note</div><div class="value">${invoice.deliveryNoteNumber || "N/A"}</div></div>
      </div>
      <table>
        <thead><tr><th>Description</th><th style="text-align:right;">Amount</th></tr></thead>
        <tbody><tr><td>Order value (incl. VAT)</td><td style="text-align:right;">R ${Number(invoice.subtotal).toFixed(2)}</td></tr></tbody>
      </table>
      <div class="totals">
        <div class="totals-row"><span>Subtotal:</span><strong>R ${Number(invoice.subtotal).toFixed(2)}</strong></div>
        <div class="totals-row"><span>VAT (15%):</span><strong>R ${Number(invoice.vatAmount).toFixed(2)}</strong></div>
        <div class="totals-row grand-total"><span>Total Due:</span><strong>R ${Number(invoice.total).toFixed(2)}</strong></div>
        <div class="totals-row" style="margin-top:8px; font-size:13px; color:#666;"><span>Amount Paid:</span><span>R ${Number(invoice.amountPaid).toFixed(2)}</span></div>
        <div class="totals-row" style="font-size:14px;"><span>Balance Due:</span><strong style="color:${Number(invoice.balanceDue) > 0 ? '#EF4444' : '#4ADE80'};">R ${Number(invoice.balanceDue).toFixed(2)}</strong></div>
      </div>
      <div class="delivery-note">
        <h3 style="margin-top:0; color:#333;">Delivery Note - ${invoice.deliveryNoteNumber || "N/A"}</h3>
        <p style="font-size:13px; color:#666;">This invoice includes a delivery note. Goods delivered as per order.</p>
      </div>
      <div class="footer">
        <p>Banking Details: FNB | Account: 62001234567 | Branch: 250655</p>
        <p>Please quote invoice number with payment. E&OE.</p>
      </div>
      </body></html>
    `);
    printWindow.document.close();
    printWindow.print();
  }

  function emailInvoice(invoice: NonNullable<typeof invoices>[0]) {
    const subject = encodeURIComponent(`Invoice ${invoice.invoiceNumber} from Supreme Global Foods`);
    const body = encodeURIComponent(`Dear ${invoice.customer?.name || "Valued Customer"},\n\nPlease find your invoice attached.\n\nInvoice Number: ${invoice.invoiceNumber}\nAmount Due: R ${Number(invoice.total).toFixed(2)}\nDue Date: ${invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString("en-ZA") : "N/A"}\n\nThank you for your business.\n\nSupreme Global Foods\nGermiston, 1422, South Africa\nsales@supremeglobalfoods.co.za`);
    window.open(`mailto:${invoice.customer?.email || "sales@supremeglobalfoods.co.za"}?subject=${subject}&body=${body}`);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display font-semibold text-white" style={{ fontSize: "clamp(1.8rem, 3vw, 2.5rem)", letterSpacing: "-0.03em" }}>Invoices & Statements</h1>
          <p className="text-[#8A8B8C] font-body text-sm mt-1">{stats?.total || 0} invoices &middot; R {(stats?.outstanding || 0).toLocaleString("en-ZA", { minimumFractionDigits: 2 })} outstanding</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setActiveTab("statements")} className="btn-secondary"><FileText className="w-4 h-4" /> Statement</button>
          <button onClick={() => setShowInvoiceForm(true)} className="btn-primary"><Plus className="w-4 h-4" /> New Invoice</button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card-surface p-4"><div className="label-text mb-1">TOTAL INVOICED</div><div className="stat-number" style={{ fontSize: "1.3rem" }}>R {(stats?.totalValue || 0).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</div></div>
        <div className="card-surface p-4"><div className="label-text mb-1">PAID</div><div className="stat-number" style={{ color: "#4ADE80", fontSize: "1.3rem" }}>R {(stats?.totalPaid || 0).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</div></div>
        <div className="card-surface p-4"><div className="label-text mb-1">OUTSTANDING</div><div className="stat-number" style={{ color: "#F59E0B", fontSize: "1.3rem" }}>R {(stats?.outstanding || 0).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</div></div>
        <div className="card-surface p-4"><div className="label-text mb-1">OVERDUE</div><div className="stat-number" style={{ color: "#EF4444" }}>{stats?.overdue || 0}</div></div>
      </div>

      <div className="flex gap-2">
        <button onClick={() => setActiveTab("invoices")} className="px-4 py-2 rounded-full text-sm font-body font-medium transition-all cursor-pointer" style={{ backgroundColor: activeTab === "invoices" ? "#D4A843" : "#18191A", color: activeTab === "invoices" ? "#0A0A0B" : "#8A8B8C" }}>Invoices</button>
        <button onClick={() => setActiveTab("statements")} className="px-4 py-2 rounded-full text-sm font-body font-medium transition-all cursor-pointer" style={{ backgroundColor: activeTab === "statements" ? "#D4A843" : "#18191A", color: activeTab === "statements" ? "#0A0A0B" : "#8A8B8C" }}>Statements</button>
      </div>

      {activeTab === "invoices" && (
        <div className="card-surface overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ backgroundColor: "#131415", borderBottom: "1px solid #222324" }}>
                  <th className="text-left p-4 label-text">Invoice #</th>
                  <th className="text-left p-4 label-text">Customer</th>
                  <th className="text-left p-4 label-text">Date</th>
                  <th className="text-left p-4 label-text">Due Date</th>
                  <th className="text-right p-4 label-text">Total</th>
                  <th className="text-right p-4 label-text">Balance</th>
                  <th className="text-left p-4 label-text">Status</th>
                  <th className="text-right p-4 label-text">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(invoices || []).map((inv) => {
                  const style = getStatusStyle(inv.status);
                  return (
                    <tr key={inv.id} className="transition-colors hover:bg-[#131415]">
                      <td className="p-4 font-mono-data text-xs text-[#D4A843]">{inv.invoiceNumber}</td>
                      <td className="p-4 text-sm text-[#E8E8E9] font-body">{inv.customer?.name || "N/A"}</td>
                      <td className="p-4 text-sm text-[#8A8B8C] font-body">{inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString("en-ZA") : "-"}</td>
                      <td className="p-4 text-sm text-[#8A8B8C] font-body">{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString("en-ZA") : "-"}</td>
                      <td className="p-4 text-right font-display text-white">R {Number(inv.total).toFixed(2)}</td>
                      <td className="p-4 text-right font-display" style={{ color: Number(inv.balanceDue) > 0 ? "#F59E0B" : "#4ADE80" }}>R {Number(inv.balanceDue).toFixed(2)}</td>
                      <td className="p-4">
                        <span className="status-badge" style={{ backgroundColor: style.bg, color: style.color }}>
                          {inv.status === "paid" ? <CheckCircle className="w-3 h-3" /> : inv.status === "overdue" ? <AlertTriangle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                          {inv.status}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <button onClick={() => printInvoice(inv)} className="p-1.5 hover:text-[#D4A843] transition-colors cursor-pointer" title="Print"><Printer className="w-4 h-4 text-[#8A8B8C]" /></button>
                        <button onClick={() => emailInvoice(inv)} className="p-1.5 hover:text-[#6366F1] transition-colors cursor-pointer ml-1" title="Email"><Mail className="w-4 h-4 text-[#8A8B8C]" /></button>
                        {inv.status !== "paid" && inv.status !== "cancelled" && (
                          <button onClick={() => { setSelectedInvoice(inv.id); setShowPaymentForm(true); }} className="p-1.5 hover:text-[#4ADE80] transition-colors cursor-pointer ml-1" title="Record Payment"><DollarSign className="w-4 h-4 text-[#8A8B8C]" /></button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "statements" && <StatementGenerator />}

      {showPaymentForm && selectedInvoice && (
        <PaymentDialog invoiceId={selectedInvoice} invoices={invoices || []} onClose={() => setShowPaymentForm(false)} onSubmit={(data) => recordPayment.mutate(data)} />
      )}

      {showInvoiceForm && (
        <InvoiceFormDialog customers={customers || []} onClose={() => setShowInvoiceForm(false)} onSubmit={(data) => createInvoice.mutate(data)} />
      )}
    </div>
  );
}

function PaymentDialog({ invoiceId, invoices, onClose, onSubmit }: {
  invoiceId: number;
  invoices: Array<{ id: number; invoiceNumber: string; total: string; balanceDue: string; customer?: { name: string } | null }>;
  onClose: () => void;
  onSubmit: (data: { invoiceId: number; amount: number; paymentMethod: "cash" | "eft" | "card" | "cheque"; paymentDate: string; referenceNumber?: string; notes?: string }) => void;
}) {
  const inv = invoices.find((i) => i.id === invoiceId);
  const [amount, setAmount] = useState(Number(inv?.balanceDue) || 0);
  const [method, setMethod] = useState<"cash" | "eft" | "card" | "cheque">("cash");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [ref, setRef] = useState("");
  const [notes, setNotes] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.7)" }}>
      <div className="card-surface p-8 max-w-md w-full mx-4" style={{ borderRadius: 16 }}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display font-semibold text-white text-xl">Record Payment</h2>
          <button onClick={onClose} className="cursor-pointer"><X className="w-5 h-5 text-[#8A8B8C]" /></button>
        </div>
        <div className="mb-4 p-3 rounded-lg" style={{ backgroundColor: "#0A0A0B" }}>
          <div className="text-xs text-[#8A8B8C]">Invoice: <span className="text-[#D4A843] font-mono-data">{inv?.invoiceNumber}</span></div>
          <div className="text-xs text-[#8A8B8C]">Customer: <span className="text-white">{inv?.customer?.name}</span></div>
          <div className="text-xs text-[#8A8B8C]">Total: <span className="text-white">R {Number(inv?.total).toFixed(2)}</span></div>
          <div className="text-xs text-[#8A8B8C]">Balance Due: <span className="text-[#F59E0B]">R {Number(inv?.balanceDue).toFixed(2)}</span></div>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); onSubmit({ invoiceId, amount, paymentMethod: method, paymentDate: date, referenceNumber: ref, notes }); }} className="space-y-4">
          <div><label className="label-text block mb-1.5">Payment Amount (R)</label><input type="number" step="0.01" value={amount} onChange={(e) => setAmount(parseFloat(e.target.value))} className="input-field" required /></div>
          <div><label className="label-text block mb-1.5">Payment Method</label><select value={method} onChange={(e) => setMethod(e.target.value as "cash" | "eft" | "card" | "cheque")} className="input-field"><option value="cash">Cash</option><option value="eft">EFT</option><option value="card">Card</option><option value="cheque">Cheque</option></select></div>
          <div><label className="label-text block mb-1.5">Payment Date</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input-field" required /></div>
          <div><label className="label-text block mb-1.5">Reference Number</label><input type="text" value={ref} onChange={(e) => setRef(e.target.value)} className="input-field" placeholder="e.g., EFT reference" /></div>
          <div><label className="label-text block mb-1.5">Notes</label><textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="input-field" rows={2} /></div>
          <button type="submit" className="btn-primary w-full justify-center">Record Payment</button>
        </form>
      </div>
    </div>
  );
}

function InvoiceFormDialog({ customers, onClose, onSubmit }: {
  customers: Array<{ id: number; name: string }>;
  onClose: () => void;
  onSubmit: (data: { customerId: number; paymentTerms: "cod" | "7_days" | "14_days" | "30_days"; subtotal: number; vatAmount: number; total: number; invoiceDate: string; notes?: string; items: Array<{ description: string; quantity: number; unitPrice: number; lineTotal: number }> }) => void;
}) {
  const [customerId, setCustomerId] = useState(0);
  const [paymentTerms, setPaymentTerms] = useState<"cod" | "7_days" | "14_days" | "30_days">("cod");
  const [subtotal, setSubtotal] = useState(0);
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");

  const vatAmount = subtotal * 0.15;
  const total = subtotal + vatAmount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.7)" }}>
      <div className="card-surface p-8 max-w-lg w-full mx-4" style={{ borderRadius: 16 }}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display font-semibold text-white text-xl">Create Invoice</h2>
          <button onClick={onClose} className="cursor-pointer"><X className="w-5 h-5 text-[#8A8B8C]" /></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); if (customerId === 0) return; onSubmit({ customerId, paymentTerms, subtotal, vatAmount, total, invoiceDate, notes, items: [{ description: "Order value", quantity: 1, unitPrice: subtotal, lineTotal: subtotal }] }); }} className="space-y-4">
          <div><label className="label-text block mb-1.5">Customer *</label><select value={customerId} onChange={(e) => setCustomerId(parseInt(e.target.value))} className="input-field" required><option value={0}>Select customer...</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label-text block mb-1.5">Payment Terms</label><select value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value as "cod" | "7_days" | "14_days" | "30_days")} className="input-field"><option value="cod">COD</option><option value="7_days">7 Days</option><option value="14_days">14 Days</option><option value="30_days">30 Days</option></select></div>
            <div><label className="label-text block mb-1.5">Invoice Date</label><input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} className="input-field" required /></div>
          </div>
          <div><label className="label-text block mb-1.5">Amount (Excl. VAT) (R)</label><input type="number" step="0.01" value={subtotal} onChange={(e) => setSubtotal(parseFloat(e.target.value) || 0)} className="input-field" required /></div>
          <div className="p-4 rounded-lg" style={{ backgroundColor: "#0A0A0B" }}>
            <div className="flex justify-between text-sm mb-2"><span className="text-[#8A8B8C]">Subtotal:</span><span className="text-white">R {subtotal.toFixed(2)}</span></div>
            <div className="flex justify-between text-sm mb-2"><span className="text-[#8A8B8C]">VAT (15%):</span><span className="text-white">R {vatAmount.toFixed(2)}</span></div>
            <div className="flex justify-between text-lg font-display font-semibold" style={{ color: "#D4A843" }}><span>Total:</span><span>R {total.toFixed(2)}</span></div>
          </div>
          <div><label className="label-text block mb-1.5">Notes</label><textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="input-field" rows={2} /></div>
          <button type="submit" className="btn-primary w-full justify-center">Create Invoice</button>
        </form>
      </div>
    </div>
  );
}

function StatementGenerator() {
  const [customerId, setCustomerId] = useState(0);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const { data: customers } = trpc.customer.search.useQuery({ query: " " });
  const { data: statement } = trpc.invoice.getCustomerStatement.useQuery(
    { customerId, fromDate, toDate },
    { enabled: customerId > 0 && fromDate !== "" && toDate !== "" }
  );

  function printStatement() {
    if (!statement) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <html><head><title>Statement - ${statement.customer?.name || "Customer"}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; color: #333; }
        .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #D4A843; padding-bottom: 20px; }
        .logo { font-size: 28px; font-weight: bold; color: #D4A843; }
        .subtitle { color: #666; font-size: 13px; }
        .customer-info { margin: 24px 0; padding: 16px; background: #f9f9f9; border-radius: 8px; }
        table { width: 100%; border-collapse: collapse; margin: 24px 0; }
        th { background: #f5f5f5; padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; border-bottom: 2px solid #ddd; }
        td { padding: 12px; border-bottom: 1px solid #eee; font-size: 13px; }
        .num { text-align: right; }
        .totals { text-align: right; margin-top: 24px; padding: 20px; background: #f9f9f9; border-radius: 8px; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; font-size: 12px; color: #999; }
      </style></head><body>
      <div class="header">
        <div class="logo">Supreme Global Foods</div>
        <div class="subtitle">Germiston, 1422, South Africa</div>
        <div class="subtitle">+27614788888 | sales@supremeglobalfoods.co.za</div>
      </div>
      <h2 style="text-align:center;">STATEMENT OF ACCOUNT</h2>
      <div class="customer-info">
        <div style="font-weight:bold; font-size:16px;">${statement.customer?.name || ""}</div>
        <div style="color:#666; font-size:13px;">${statement.customer?.businessName || ""}</div>
        <div style="color:#666; font-size:13px;">${statement.customer?.physicalAddress || ""}, ${statement.customer?.city || ""}</div>
      </div>
      <div style="display:flex; justify-content:space-between; margin-bottom:20px;"><div><span style="color:#999; font-size:12px;">Period:</span> <strong>${new Date(statement.fromDate).toLocaleDateString("en-ZA")} - ${new Date(statement.toDate).toLocaleDateString("en-ZA")}</strong></div></div>
      <table>
        <thead><tr><th>Date</th><th>Description</th><th class="num">Debit</th><th class="num">Credit</th><th class="num">Balance</th></tr></thead>
        <tbody>
          <tr style="font-weight:600; background:#fafafa;"><td colspan="4">Opening Balance</td><td class="num">R ${statement.openingBalance.toFixed(2)}</td></tr>
          ${statement.lines.map((line) => `
            <tr><td>${new Date(line.date).toLocaleDateString("en-ZA")}</td><td>${line.description}</td><td class="num">${line.debit > 0 ? "R " + line.debit.toFixed(2) : ""}</td><td class="num">${line.credit > 0 ? "R " + line.credit.toFixed(2) : ""}</td><td class="num" style="font-weight:600;">R ${line.balance.toFixed(2)}</td></tr>
          `).join("")}
        </tbody>
      </table>
      <div class="totals"><div style="font-size:20px; font-weight:bold; color:#D4A843;">Closing Balance: R ${statement.closingBalance.toFixed(2)}</div></div>
      <div class="footer"><p>Please settle outstanding amounts promptly. Banking: FNB 62001234567 Branch 250655</p></div>
      </body></html>
    `);
    printWindow.document.close();
    printWindow.print();
  }

  return (
    <div className="card-surface p-6">
      <h3 className="font-display font-semibold text-white mb-4">Generate Statement</h3>
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div><label className="label-text block mb-1.5">Customer</label><select value={customerId} onChange={(e) => setCustomerId(parseInt(e.target.value))} className="input-field"><option value={0}>Select...</option>{(customers || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <div><label className="label-text block mb-1.5">From Date</label><input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="input-field" /></div>
        <div><label className="label-text block mb-1.5">To Date</label><input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="input-field" /></div>
      </div>

      {statement && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-display font-semibold text-white">Statement Preview</h3>
            <div className="flex gap-2">
              <button onClick={printStatement} className="btn-secondary text-xs"><Printer className="w-3 h-3" /> Print</button>
              <button onClick={() => { const subject = encodeURIComponent(`Statement of Account - Supreme Global Foods`); const body = encodeURIComponent(`Please find your statement attached.\n\nClosing Balance: R ${statement.closingBalance.toFixed(2)}\n\nSupreme Global Foods`); window.open(`mailto:${statement.customer?.email || ""}?subject=${subject}&body=${body}`); }} className="btn-secondary text-xs"><Mail className="w-3 h-3" /> Email</button>
            </div>
          </div>
          <div className="p-4 rounded-lg" style={{ backgroundColor: "#0A0A0B" }}>
            <div className="flex justify-between text-sm mb-4"><span className="text-[#8A8B8C]">Opening Balance:</span><span className="text-white font-display">R {statement.openingBalance.toFixed(2)}</span></div>
            <div className="max-h-[300px] overflow-y-auto space-y-2">
              {statement.lines.map((line, i) => (
                <div key={i} className="flex justify-between text-sm py-2" style={{ borderBottom: "1px solid #18191A" }}>
                  <div><div className="text-white">{line.description}</div><div className="text-xs text-[#8A8B8C]">{new Date(line.date).toLocaleDateString("en-ZA")}</div></div>
                  <div className="text-right">
                    {line.debit > 0 && <div className="text-[#F59E0B]">R {line.debit.toFixed(2)}</div>}
                    {line.credit > 0 && <div className="text-[#4ADE80]">R {line.credit.toFixed(2)}</div>}
                    <div className="font-display font-semibold text-white">R {line.balance.toFixed(2)}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-between text-lg font-display font-semibold mt-4 pt-4" style={{ borderTop: "2px solid #D4A843", color: "#D4A843" }}><span>Closing Balance:</span><span>R {statement.closingBalance.toFixed(2)}</span></div>
          </div>
        </div>
      )}
      {!statement && (customerId === 0 || !fromDate || !toDate) && <div className="text-center py-8 text-[#8A8B8C] font-body">Select a customer and date range to generate statement</div>}
    </div>
  );
}
