import { useState, useRef } from "react";
import { trpc } from "@/providers/trpc";
import { useRole } from "@/hooks/useRole";
import { reloadFromStorage } from "@/lib/dataService";
import { disconnectFirebase, syncAllLocalData } from "@/lib/firebaseSync";
import {
  Upload, FileText, Database, CheckCircle, AlertTriangle, User,
  X, ChevronDown, ChevronUp, RotateCcw, Link, Unlink,
} from "lucide-react";

export default function HistoricalImportPage() {
  const { isAdmin } = useRole();
  const utils = trpc.useUtils();
  const invoiceFileRef = useRef<HTMLInputElement>(null);
  const orderFileRef = useRef<HTMLInputElement>(null);

  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [orderFile, setOrderFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null);

  const bulkImport = trpc.invoice.bulkHistoricalImport.useMutation({
    onSuccess: async (data: any) => {
      reloadFromStorage();
      await utils.invoice.list.invalidate();
      await utils.invoice.getStats.invalidate();
      try { await syncAllLocalData(); } catch { /* ignore */ }
      setResult(data);
      setImporting(false);
    },
    onError: (err: any) => { setError(err.message || "Import failed"); setImporting(false); },
  });

  async function readExcel(file: File): Promise<any[][]> {
    const XLSX = await import("xlsx");
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    return XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
  }

  async function handleInvoiceFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setInvoiceFile(f);
    setError("");
    setPreview(null);
    setResult(null);
    try {
      const rawData = await readExcel(f);
      parseInvoiceReport(rawData);
    } catch (err: any) { setError("Failed to read invoice report: " + err.message); }
  }

  async function handleOrderFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setOrderFile(f);
    setError("");
    if (preview?.invoices) {
      try {
        const rawData = await readExcel(f);
        const matched = mergeOrderData(rawData);
        setPreview({ ...preview, invoices: matched, orderFileLoaded: true });
      } catch (err: any) { setError("Failed to read order report: " + err.message); }
    }
  }

  function parseInvoiceReport(rawData: any[][]) {
    const invoices: Record<string, any> = {};
    let totalOutstanding = 0;

    for (const row of rawData) {
      const date = String(row[0] || "").trim();
      const docNo = String(row[1] || "").trim();
      const custRef = String(row[2] || "").trim();
      const customer = String(row[3] || "").trim();
      const salesRep = String(row[4] || "").trim();
      const dueDate = String(row[5] || "").trim();
      const exclusive = parseFloat(String(row[7] || "0").replace(/,/g, "")) || 0;
      const vat = parseFloat(String(row[8] || "0").replace(/,/g, "")) || 0;
      const totalSelling = parseFloat(String(row[9] || "0").replace(/,/g, "")) || 0;
      const outstanding = parseFloat(String(row[10] || "0").replace(/,/g, "")) || 0;

      if (!docNo || docNo === "Document No." || !customer || !date) continue;
      if (!docNo.startsWith("INV") && !docNo.startsWith("SGF") && !docNo.startsWith("CRN")) continue;

      const parts = date.split("/");
      const year = parts.length === 3 ? (parts[2].length === 2 ? `20${parts[2]}` : parts[2]) : "";
      const dateStr = parts.length === 3 ? `${year}-${parts[1]}-${parts[0]}` : date;
      const dueParts = dueDate.split("/");
      const dueYear = dueParts.length === 3 ? (dueParts[2].length === 2 ? `20${dueParts[2]}` : dueParts[2]) : "";
      const dueDateStr = dueParts.length === 3 ? `${dueYear}-${dueParts[1]}-${dueParts[0]}` : dueDate;

      const isCreditNote = docNo.startsWith("CRN");

      invoices[docNo] = {
        invoiceNumber: docNo,
        date: dateStr,
        dateDisplay: date,
        dueDate: dueDateStr,
        customerName: customer,
        salesRep,
        exclusive,
        vat,
        total: totalSelling,
        outstanding: isCreditNote ? 0 : outstanding,
        isCreditNote,
        isPaid: !isCreditNote && outstanding === 0,
        notes: custRef || (isCreditNote ? "Credit note from Sage" : ""),
        items: [], // Will be filled from order report
      };

      if (!isCreditNote) totalOutstanding += outstanding;
    }

    const invoiceList = Object.values(invoices);
    setPreview({
      invoices: invoiceList,
      totalInvoices: invoiceList.filter((i: any) => !i.isCreditNote).length,
      totalCreditNotes: invoiceList.filter((i: any) => i.isCreditNote).length,
      totalValue: invoiceList.reduce((s: number, i: any) => s + Math.abs(i.total), 0),
      totalOutstanding,
      orderFileLoaded: false,
    });
  }

  /** Smart Sage order report parser — scans all columns to find data */
  function mergeOrderData(rawData: any[][]): any[] {
    const lineItems: Record<string, any[]> = {};
    let currentInvRef = "";

    // Helper: find invoice number in any column
    function findInvoiceRef(row: any[]): string {
      for (const cell of row) {
        const s = String(cell || "").trim();
        if (s && (s.startsWith("SGF") || s.startsWith("INV")) && s.length > 5) return s;
      }
      return "";
    }

    // Helper: find description (text with product name, not a number/code)
    function findDescription(row: any[]): string {
      for (let i = 0; i < row.length; i++) {
        const s = String(row[i] || "").trim();
        if (s.length > 3 && s !== "Description" && s !== "nan" && s !== "Item Description" &&
            !s.match(/^\d{2}\/\d{2}\/\d{2,4}$/) && // not a date
            !s.match(/^R?\s*[\d,]+\.?\d*$/) && // not just a number/amount
            !s.match(/^(SGF|INV|CRN|DN)/i) && // not an invoice ref
            !s.match(/^(Qty|Quantity|Unit Price|Total|Tax|VAT|Code|Account|Customer)/i)) {
          return s;
        }
      }
      return "";
    }

    // Helper: find quantity (small positive number, usually 1-9999)
    function findQty(row: any[]): number {
      for (const cell of row) {
        const n = parseFloat(String(cell || "0"));
        if (n > 0 && n < 100000 && Number.isFinite(n)) return n;
      }
      return 0;
    }

    // Helper: find amount (larger number, could have R prefix)
    function findAmount(row: any[]): number {
      let bestVal = 0;
      for (const cell of row) {
        try {
          const s = String(cell || "").replace(/[R,\s]/g, "").trim();
          const n = parseFloat(s);
          if (n > bestVal && n < 10000000) bestVal = n;
        } catch { /* ignore */ }
      }
      return bestVal;
    }

    // First pass: scan for any rows that look like invoice headers
    const invoiceRefCols: number[] = [];
    if (rawData.length > 0) {
      const headerRow = rawData[0];
      for (let i = 0; i < headerRow.length; i++) {
        const h = String(headerRow[i] || "").toLowerCase();
        if (h.includes("document") || h.includes("inv") || h.includes("invoice") || h.includes("reference") || h.includes("doc no")) {
          invoiceRefCols.push(i);
        }
      }
    }

    for (const row of rawData) {
      // Try to find invoice reference in this row
      let invRef = findInvoiceRef(row);

      // Also check known invoice ref columns
      if (!invRef && invoiceRefCols.length > 0) {
        for (const colIdx of invoiceRefCols) {
          const s = String(row[colIdx] || "").trim();
          if (s && (s.startsWith("SGF") || s.startsWith("INV")) && s.length > 5) {
            invRef = s;
            break;
          }
        }
      }

      if (invRef) {
        currentInvRef = invRef;
        if (!lineItems[currentInvRef]) lineItems[currentInvRef] = [];
        continue;
      }

      // Try to parse line item
      if (currentInvRef) {
        const desc = findDescription(row);
        const qty = findQty(row);
        const amount = findAmount(row);

        if (desc && (qty > 0 || amount > 0)) {
          if (!lineItems[currentInvRef]) lineItems[currentInvRef] = [];
          lineItems[currentInvRef].push({
            description: desc,
            qty,
            amount,
            unitPrice: qty > 0 ? amount / qty : amount,
          });
        }
      }
    }

    // Merge line items into invoices
    return preview.invoices.map((inv: any) => {
      const items = lineItems[inv.invoiceNumber] || [];
      return {
        ...inv,
        items: items.length > 0 ? items : [{ description: "Historical invoice — no order report line items matched", qty: 1, amount: Math.abs(inv.total), unitPrice: Math.abs(inv.total) }],
        hasLineItems: items.length > 0,
        lineItemCount: items.length,
      };
    });
  }

  function handleImport() {
    if (!preview?.invoices) return;
    setImporting(true);
    disconnectFirebase();

    const invoicesToImport = preview.invoices.map((inv: any) => {
      const items = inv.items.map((it: any) => ({
        description: it.description,
        quantity: it.qty,
        unitPrice: it.unitPrice,
        lineTotal: it.amount,
      }));

      const amountPaid = inv.isCreditNote ? 0 : Math.max(0, inv.total - inv.outstanding);

      return {
        invoiceNumber: inv.invoiceNumber,
        invoiceDate: inv.date,
        customerName: inv.customerName,
        items,
        subtotal: inv.isCreditNote ? -Math.abs(inv.exclusive || inv.total) : (inv.exclusive || inv.total),
        total: inv.isCreditNote ? -Math.abs(inv.total) : inv.total,
        vatAmount: inv.vat || 0,
        amountPaid,
        balanceDue: inv.isCreditNote ? 0 : inv.outstanding,
        status: inv.isCreditNote ? "paid" : (inv.outstanding > 0 ? "sent" : "paid"),
        paymentTerms: "cod",
        notes: inv.notes || "Historical import from Sage",
        source: "sage",
        salesRep: inv.salesRep,
      };
    });

    bulkImport.mutate(invoicesToImport);
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <AlertTriangle className="w-16 h-16 mb-4" style={{ color: "#EF4444", opacity: 0.4 }} />
        <h2 className="font-display font-semibold text-white text-xl mb-2">Access Denied</h2>
        <p className="text-[#8A8B8C] font-body text-sm">Only Admin and Super Admin can import historical data.</p>
      </div>
    );
  }

  return (
    <>
      {/* Hidden file inputs — rendered outside layout flow to avoid spacing issues */}
      <input ref={invoiceFileRef} type="file" accept=".xls,.xlsx" onChange={handleInvoiceFile} style={{ display: "none" }} />
      <input ref={orderFileRef} type="file" accept=".xls,.xlsx" onChange={handleOrderFile} style={{ display: "none" }} />
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display font-semibold text-white" style={{ fontSize: "clamp(1.8rem,3vw,2.5rem)", letterSpacing: "-0.03em" }}>
            Historical Data Import
          </h1>
          <p className="text-[#8A8B8C] font-body text-sm mt-1">
            Import Sage data with line items — upload both reports for best results
          </p>
        </div>
      </div>

      {/* File upload */}
      {!preview && !result && (
        <div className="card-surface p-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Invoice report */}
            <div className="text-center p-6 rounded-xl" style={{ backgroundColor: "#0A0A0B", border: "1px solid #222324" }}>
              <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3" style={{ backgroundColor: "rgba(212,168,67,0.12)" }}>
                <FileText className="w-6 h-6 text-[#D4A843]" />
              </div>
              <h3 className="font-display font-semibold text-white mb-1">Step 1: Invoice Report</h3>
              <p className="text-xs text-[#8A8B8C] mb-4">Customer Invoice Report — has dates, totals, outstanding balances</p>
              <button onClick={() => invoiceFileRef.current?.click()} className="btn-primary text-sm">
                <Upload className="w-3.5 h-3.5" /> Select Invoice Report
              </button>
            </div>

            {/* Order report */}
            <div className="text-center p-6 rounded-xl" style={{ backgroundColor: "#0A0A0B", border: "1px solid #222324" }}>
              <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3" style={{ backgroundColor: "rgba(99,102,241,0.12)" }}>
                <Database className="w-6 h-6 text-[#6366F1]" />
              </div>
              <h3 className="font-display font-semibold text-white mb-1">Step 2: Order Report (Optional)</h3>
              <p className="text-xs text-[#8A8B8C] mb-4">Sales By Customer Report — has line items per invoice</p>
              <button onClick={() => orderFileRef.current?.click()} className="btn-secondary text-sm" disabled={!preview} style={{ opacity: preview ? 1 : 0.5 }}>
                <Upload className="w-3.5 h-3.5" /> Select Order Report
              </button>
            </div>
          </div>
          {error && <div className="mt-4 p-3 rounded-lg text-sm" style={{ backgroundColor: "rgba(239,68,68,0.12)", color: "#EF4444" }}>{error}</div>}
        </div>
      )}

      {/* Preview */}
      {preview && !result && (
        <>
          {/* File status */}
          <div className="flex gap-3 flex-wrap">
            {invoiceFile && (
              <div className="px-3 py-2 rounded-lg text-xs flex items-center gap-2" style={{ backgroundColor: "rgba(74,222,128,0.12)", color: "#4ADE80" }}>
                <FileText className="w-3.5 h-3.5" /> Invoice Report: {invoiceFile.name}
              </div>
            )}
            {preview.orderFileLoaded && orderFile && (
              <div className="px-3 py-2 rounded-lg text-xs flex items-center gap-2" style={{ backgroundColor: "rgba(99,102,241,0.12)", color: "#6366F1" }}>
                <Link className="w-3.5 h-3.5" /> Order Report: {orderFile.name} — Line items linked
              </div>
            )}
            {!preview.orderFileLoaded && (
              <div className="px-3 py-2 rounded-lg text-xs flex items-center gap-2" style={{ backgroundColor: "rgba(245,158,11,0.12)", color: "#F59E0B" }}>
                <Unlink className="w-3.5 h-3.5" /> No order report — invoices will show single-line items
              </div>
            )}
          </div>

          {/* Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="card-surface p-4 text-center">
              <div className="label-text mb-1">Invoices</div>
              <div className="stat-number" style={{ color: "#D4A843" }}>{preview.totalInvoices}</div>
            </div>
            <div className="card-surface p-4 text-center">
              <div className="label-text mb-1">Credit Notes</div>
              <div className="stat-number" style={{ color: "#F59E0B" }}>{preview.totalCreditNotes}</div>
            </div>
            <div className="card-surface p-4 text-center">
              <div className="label-text mb-1">Total Value</div>
              <div className="stat-number" style={{ color: "#D4A843" }}>R {preview.totalValue.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</div>
            </div>
            <div className="card-surface p-4 text-center">
              <div className="label-text mb-1">Outstanding</div>
              <div className="stat-number" style={{ color: "#EF4444" }}>R {preview.totalOutstanding.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 flex-wrap">
            <button onClick={handleImport} disabled={importing} className="btn-primary">
              {importing ? (
                <><div className="w-4 h-4 border-2 border-[#0A0A0B] border-t-transparent rounded-full animate-spin mr-2" /> Importing...</>
              ) : (
                <><Database className="w-4 h-4" /> Import {preview.totalInvoices + preview.totalCreditNotes} Documents</>
              )}
            </button>
            {!preview.orderFileLoaded && (
              <button onClick={() => orderFileRef.current?.click()} className="btn-secondary">
                <Upload className="w-4 h-4" /> Add Order Report for Line Items
              </button>
            )}
            <button onClick={() => { setPreview(null); setInvoiceFile(null); setOrderFile(null); }} className="btn-secondary">
              <RotateCcw className="w-4 h-4" /> Start Over
            </button>
          </div>

          {/* Invoice preview */}
          <div className="card-surface overflow-hidden">
            <div className="p-4" style={{ borderBottom: "1px solid #222324" }}>
              <h3 className="font-display font-semibold text-white">Invoice Preview</h3>
              <p className="text-xs text-[#8A8B8C]">
                Click to expand — green dot = has line items from order report
                {preview.invoices.filter((i: any) => i.hasLineItems).length > 0 && (
                  <span className="ml-2 text-[#4ADE80]">
                    {preview.invoices.filter((i: any) => i.hasLineItems).length} of {preview.invoices.length} invoices have line items
                  </span>
                )}
              </p>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {preview.invoices.map((inv: any) => {
                const isExp = expandedCustomer === inv.invoiceNumber;
                return (
                  <div key={inv.invoiceNumber} style={{ borderBottom: "1px solid #18191A" }}>
                    <button onClick={() => setExpandedCustomer(isExp ? null : inv.invoiceNumber)} className="w-full flex items-center justify-between p-3 text-left hover:bg-[#131415] transition-colors">
                      <div className="flex items-center gap-2">
                        {inv.hasLineItems && <span className="w-2 h-2 rounded-full bg-[#4ADE80] shrink-0" title="Has line items" />}
                        {!inv.hasLineItems && <span className="w-2 h-2 rounded-full bg-[#8A8B8C] shrink-0" title="No line items" />}
                        <span className="text-sm text-[#D4A843] font-display">{inv.invoiceNumber}</span>
                        <span className="text-sm text-white font-body">{inv.customerName}</span>
                        {inv.isCreditNote && <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: "rgba(245,158,11,0.15)", color: "#F59E0B" }}>CRN</span>}
                        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: inv.hasLineItems ? "rgba(74,222,128,0.1)" : "rgba(138,139,140,0.1)", color: inv.hasLineItems ? "#4ADE80" : "#8A8A8A" }}>
                          {inv.lineItemCount || inv.items?.length || 0} lines
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        {inv.outstanding > 0 && <span className="text-xs text-[#EF4444]">R {inv.outstanding.toLocaleString("en-ZA", { minimumFractionDigits: 2 })} due</span>}
                        <span className="text-sm text-white font-display">R {Math.abs(inv.total).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</span>
                        {isExp ? <ChevronUp className="w-4 h-4 text-[#8A8B8C]" /> : <ChevronDown className="w-4 h-4 text-[#8A8B8C]" />}
                      </div>
                    </button>
                    {isExp && (
                      <div className="p-3 pl-8 space-y-1" style={{ backgroundColor: "#0A0A0B" }}>
                        {inv.items.map((it: any, idx: number) => (
                          <div key={idx} className="flex items-center justify-between text-xs py-1">
                            <span className="text-[#E8E8E9]">{it.description}</span>
                            <div className="flex items-center gap-3 text-[#8A8B8C]">
                              <span>{it.qty} x R {it.unitPrice.toFixed(2)}</span>
                              <span className="text-[#D4A843]">R {it.amount.toFixed(2)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Result */}
      {result && (
        <div className="card-surface p-8 text-center">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: "rgba(74,222,128,0.12)" }}>
            <CheckCircle className="w-8 h-8 text-[#4ADE80]" />
          </div>
          <h2 className="font-display font-semibold text-white text-xl mb-2">Import Complete!</h2>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 max-w-2xl mx-auto mt-6">
            <div><div className="stat-number text-[#4ADE80]">{result.created}</div><div className="label-text text-xs">New</div></div>
            {(result.updated || 0) > 0 && <div><div className="stat-number text-[#6366F1]">{result.updated}</div><div className="label-text text-xs">Line Items Added</div></div>}
            <div><div className="stat-number text-[#F59E0B]">{result.skipped}</div><div className="label-text text-xs">Skipped</div></div>
            <div><div className="stat-number text-[#D4A843]">{result.total}</div><div className="label-text text-xs">Total</div></div>
            {result.unmatchedCount > 0 && <div><div className="stat-number text-[#EF4444]">{result.unmatchedCount}</div><div className="label-text text-xs">Unmatched</div></div>}
          </div>
          {result.unmatchedCount > 0 && (
            <div className="mt-4 p-3 rounded-lg text-left max-w-md mx-auto" style={{ backgroundColor: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
              <div className="text-[#EF4444] font-semibold text-sm mb-1"><AlertTriangle className="w-3.5 h-3.5 inline mr-1" /> {result.unmatchedCount} unmatched customer(s)</div>
              <div className="max-h-24 overflow-y-auto">
                {result.unmatched.map((name: string, i: number) => <div key={i} className="text-xs text-[#EF4444]">{name}</div>)}
              </div>
            </div>
          )}
          <div className="mt-4 p-3 rounded-lg text-xs" style={{ backgroundColor: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)", color: "#3B82F6" }}>
            Firebase sync was paused. To enable for sales reps, go to Settings → Cloud Sync → Connect.
          </div>
        </div>
      )}
    </div>
    </>
  );
}
