import { useState, useRef, useMemo } from "react";
import { trpc } from "@/providers/trpc";
import { useRole } from "@/hooks/useRole";
import { reloadFromStorage } from "@/lib/dataService";
import {
  Upload, FileText, CheckCircle, AlertTriangle, XCircle,
  HelpCircle, DollarSign, ChevronDown, ChevronUp, User,
  ArrowRight, Banknote, Receipt, Ban, AlertCircle,
  CheckCheck, X, Percent, Search, CalendarDays, Loader2,
} from "lucide-react";

/* ─── Types ─── */
interface BankPaymentRow {
  rowIndex: number;
  invoiceDate: string;
  customerName: string;
  invoiceNumber: string;
  amountDue: number;
  amountPaid: number;
  paidDate: string | null;
}

interface PaymentMatchResult {
  row: BankPaymentRow;
  matchStatus: "ready_full" | "partial" | "overpayment" | "name_mismatch" | "invoice_not_found" | "fuzzy_name";
  invoice: any | null;
  appCustomer: any | null;
  nameSimilarity: number;
  message: string;
}

interface AllocationItem {
  row: BankPaymentRow;
  invoiceId: number;
  status: string;
  originalStatus?: string;
  amount: number;
  paidDate: string | null;
  customerName: string;
  invoiceNumber: string;
}

/* ─── Status Config ─── */
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  ready_full:    { label: "Ready — Full Payment",    color: "#4ADE80", bg: "rgba(74,222,128,0.1)",  icon: CheckCircle },
  partial:       { label: "Partial Payment",         color: "#F59E0B", bg: "rgba(245,158,11,0.1)",  icon: Percent },
  overpayment:   { label: "Overpayment (Credit)",    color: "#3B82F6", bg: "rgba(59,130,246,0.1)", icon: DollarSign },
  fuzzy_name:    { label: "Fuzzy Name Match",        color: "#8B5CF6", bg: "rgba(139,92,246,0.1)", icon: HelpCircle },
  name_mismatch: { label: "Name Mismatch",           color: "#EF4444", bg: "rgba(239,68,68,0.1)",  icon: XCircle },
  invoice_not_found: { label: "Invoice Not Found",    color: "#F97316", bg: "rgba(249,115,22,0.1)", icon: AlertTriangle },
};

/* ─── Component ─── */
export default function BankImportPage() {
  const { isAdmin } = useRole();
  const utils = trpc.useUtils();
  const fileRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<BankPaymentRow[]>([]);
  const [matchResults, setMatchResults] = useState<PaymentMatchResult[]>([]);
  const [expandedStatus, setExpandedStatus] = useState<string | null>("ready_full");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [allocationResult, setAllocationResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"upload" | "review" | "done">("upload");

  /* tRPC Mutations */
  const parseMutation = trpc.invoice.parseBankStatement.useMutation();
  const matchMutation = trpc.invoice.matchBankPayments.useMutation();
  const allocateMutation = trpc.invoice.allocateBankPayments.useMutation({
    onSuccess: async (data: any) => {
      reloadFromStorage();
      await utils.invoice.list.invalidate();
      await utils.invoice.getStats.invalidate();
      setAllocationResult(data);
      setStep("done");
      setLoading(false);
    },
    onError: (err: any) => {
      alert("Allocation failed: " + (err.message || "Unknown error"));
      setLoading(false);
    },
  });

  /* Parse Excel */
  async function readExcel(file: File): Promise<any[][]> {
    const XLSX = await import("xlsx");
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    return XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setLoading(true);
    try {
      const rawRows = await readExcel(f);
      const parsed = parseMutation.mutate(rawRows as any) as unknown as BankPaymentRow[];
      // Since parseBankStatement returns directly (not a promise), we need to handle this differently
      // The mutation returns the parsed data via onSuccess
      parseMutation.mutate(rawRows as any, {
        onSuccess: (parsed: any) => {
          setParsedRows(parsed || []);
          if ((parsed || []).length > 0) {
            // Auto-match after parsing
            matchMutation.mutate(parsed, {
              onSuccess: (matches: any) => {
                setMatchResults(matches || []);
                // Auto-select all ready_full items
                const readyIds = new Set<number>();
                (matches || []).forEach((m: PaymentMatchResult) => {
                  if (m.matchStatus === "ready_full") readyIds.add(m.row.rowIndex);
                });
                setSelected(readyIds);
                setStep("review");
                setLoading(false);
              },
            });
          } else {
            alert("No SGF payment rows found in the uploaded file.");
            setLoading(false);
          }
        },
        onError: () => setLoading(false),
      });
    } catch (err: any) {
      alert("Failed to read file: " + err.message);
      setLoading(false);
    }
  }

  /* Group by status */
  const grouped = useMemo(() => {
    const g: Record<string, PaymentMatchResult[]> = {};
    for (const m of matchResults) {
      if (!g[m.matchStatus]) g[m.matchStatus] = [];
      g[m.matchStatus].push(m);
    }
    return g;
  }, [matchResults]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const s of Object.keys(STATUS_CONFIG)) c[s] = matchResults.filter((m) => m.matchStatus === s).length;
    return c;
  }, [matchResults]);

  const totalAmount = useMemo(() => {
    return matchResults
      .filter((m) => selected.has(m.row.rowIndex) && (m.matchStatus === "ready_full" || m.matchStatus === "partial" || m.matchStatus === "overpayment" || m.matchStatus === "fuzzy_name"))
      .reduce((sum, m) => sum + m.row.amountPaid, 0);
  }, [matchResults, selected]);

  function toggleSelect(rowIndex: number) {
    const next = new Set(selected);
    if (next.has(rowIndex)) next.delete(rowIndex);
    else next.add(rowIndex);
    setSelected(next);
  }

  function selectAllInStatus(status: string) {
    const next = new Set(selected);
    for (const m of grouped[status] || []) next.add(m.row.rowIndex);
    setSelected(next);
  }

  function deselectAllInStatus(status: string) {
    const next = new Set(selected);
    for (const m of grouped[status] || []) next.delete(m.row.rowIndex);
    setSelected(next);
  }

  function runAllocation() {
    const allocations: AllocationItem[] = [];
    for (const m of matchResults) {
      if (!selected.has(m.row.rowIndex)) continue;
      if (!m.invoice) continue;
      allocations.push({
        row: m.row,
        invoiceId: m.invoice.id,
        status: m.matchStatus,
        amount: m.row.amountPaid,
        paidDate: m.row.paidDate,
        customerName: m.row.customerName,
        invoiceNumber: m.row.invoiceNumber,
      });
    }
    if (allocations.length === 0) { alert("No items selected for allocation."); return; }
    setLoading(true);
    allocateMutation.mutate(allocations);
  }

  function reset() {
    setFile(null);
    setParsedRows([]);
    setMatchResults([]);
    setSelected(new Set());
    setAllocationResult(null);
    setStep("upload");
    if (fileRef.current) fileRef.current.value = "";
  }

  /* ─── RENDER ─── */
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-display font-semibold text-white">Bank Statement Import</h1>
          <p className="text-sm text-[#8A8B8C] mt-1">Upload customer receipt/payment data and allocate to invoices</p>
        </div>
        {step !== "upload" && (
          <button onClick={reset} className="btn-secondary text-sm"><X className="w-4 h-4" /> Reset</button>
        )}
      </div>

      {/* Step 1: Upload */}
      {step === "upload" && (
        <div className="card-surface p-8 text-center">
          <input ref={fileRef} type="file" accept=".xls,.xlsx" onChange={handleFile} style={{ display: "none" }} />
          <div className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: "rgba(212,168,67,0.1)" }}>
            <Upload className="w-10 h-10 text-[#D4A843]" />
          </div>
          <h3 className="text-lg font-display font-semibold text-white mb-2">Upload Bank Statement</h3>
          <p className="text-sm text-[#8A8B8C] mb-4 max-w-md mx-auto">
            Upload an Excel file with customer payment data. The system will match SGF invoice numbers,
            verify customer names, and show you a review before allocating payments.
          </p>
          <button onClick={() => fileRef.current?.click()} className="btn-primary" disabled={loading}>
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</> : <><FileText className="w-4 h-4" /> Select Excel File</>}
          </button>
        </div>
      )}

      {/* Step 2: Review */}
      {step === "review" && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
              const Icon = cfg.icon;
              const count = counts[key] || 0;
              const isExpanded = expandedStatus === key;
              return (
                <button
                  key={key}
                  onClick={() => setExpandedStatus(isExpanded ? null : key)}
                  className="card-surface p-3 text-left transition-all hover:brightness-110"
                  style={{ borderLeft: `3px solid ${cfg.color}`, opacity: count === 0 ? 0.5 : 1 }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className="w-4 h-4" style={{ color: cfg.color }} />
                    <span className="text-lg font-display font-bold" style={{ color: cfg.color }}>{count}</span>
                  </div>
                  <div className="text-[10px] text-[#8A8B8C] uppercase tracking-wide">{cfg.label}</div>
                </button>
              );
            })}
          </div>

          {/* Summary bar */}
          <div className="card-surface p-4 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <CheckCheck className="w-5 h-5 text-[#4ADE80]" />
              <span className="text-sm text-white font-display">{selected.size} of {matchResults.length} items selected</span>
            </div>
            <div className="flex items-center gap-2">
              <Banknote className="w-5 h-5 text-[#D4A843]" />
              <span className="text-sm text-[#D4A843] font-display font-semibold">R {totalAmount.toFixed(2)}</span>
            </div>
            <div className="flex-1" />
            <button onClick={runAllocation} className="btn-primary" disabled={loading || selected.size === 0}>
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Allocating...</> : <><Receipt className="w-4 h-4" /> Allocate Selected Payments</>}
            </button>
          </div>

          {/* Expandable sections per status */}
          {expandedStatus && grouped[expandedStatus] && grouped[expandedStatus].length > 0 && (
            <div className="card-surface overflow-hidden" style={{ borderLeft: `3px solid ${STATUS_CONFIG[expandedStatus].color}` }}>
              <div className="p-4 flex items-center justify-between" style={{ backgroundColor: STATUS_CONFIG[expandedStatus].bg }}>
                <div className="flex items-center gap-2">
                  {(() => { const Icon = STATUS_CONFIG[expandedStatus].icon; return <Icon className="w-5 h-5" style={{ color: STATUS_CONFIG[expandedStatus].color }} />; })()}
                  <span className="font-display font-semibold text-white">{STATUS_CONFIG[expandedStatus].label}</span>
                  <span className="text-xs text-[#8A8B8C]">({grouped[expandedStatus].length} items)</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => selectAllInStatus(expandedStatus)} className="text-xs px-2 py-1 rounded hover:bg-[#222324] text-[#4ADE80]">Select All</button>
                  <button onClick={() => deselectAllInStatus(expandedStatus)} className="text-xs px-2 py-1 rounded hover:bg-[#222324] text-[#EF4444]">Deselect All</button>
                </div>
              </div>

              <table className="w-full">
                <thead>
                  <tr style={{ backgroundColor: "#131415", borderBottom: "1px solid #222324" }}>
                    <th className="p-3 text-left label-text w-10">#</th>
                    <th className="p-3 text-left label-text">Invoice</th>
                    <th className="p-3 text-left label-text">Customer (File)</th>
                    <th className="p-3 text-left label-text">Customer (App)</th>
                    <th className="p-3 text-right label-text">Amount Paid</th>
                    <th className="p-3 text-right label-text">Balance / Status</th>
                    <th className="p-3 text-left label-text">Message</th>
                    <th className="p-3 text-center label-text w-16">Select</th>
                  </tr>
                </thead>
                <tbody>
                  {grouped[expandedStatus].map((m) => {
                    const isSel = selected.has(m.row.rowIndex);
                    const invBalance = m.invoice ? Math.max(0, Number(m.invoice.total || 0) - Number(m.invoice.amountPaid || 0)) : 0;
                    return (
                      <tr key={m.row.rowIndex} className="transition-colors hover:bg-[#131415]" style={{ borderBottom: "1px solid #18191A" }}>
                        <td className="p-3 text-xs text-[#8A8B8C]">{m.row.rowIndex}</td>
                        <td className="p-3">
                          <div className="font-display font-semibold text-sm text-[#D4A843]">{m.row.invoiceNumber}</div>
                          <div className="text-[10px] text-[#8A8B8C]">{m.row.invoiceDate}</div>
                        </td>
                        <td className="p-3 text-sm text-[#E8E8E9]">{m.row.customerName || "—"}</td>
                        <td className="p-3">
                          {m.appCustomer ? (
                            <div>
                              <div className="text-sm text-[#E8E8E9]">{m.appCustomer.name}</div>
                              {m.nameSimilarity < 90 && (
                                <div className="text-[10px]" style={{ color: m.nameSimilarity >= 60 ? "#F59E0B" : "#EF4444" }}>
                                  {m.nameSimilarity}% match
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-[#8A8B8C]">—</span>
                          )}
                        </td>
                        <td className="p-3 text-right text-sm text-white font-display">R {m.row.amountPaid.toFixed(2)}</td>
                        <td className="p-3 text-right">
                          {m.invoice ? (
                            <div>
                              <div className="text-xs text-[#8A8B8C]">Balance: R {invBalance.toFixed(2)}</div>
                              <div className="text-[10px]" style={{ color: STATUS_CONFIG[m.matchStatus].color }}>{m.invoice.status}</div>
                            </div>
                          ) : (
                            <span className="text-xs text-[#8A8B8C]">—</span>
                          )}
                        </td>
                        <td className="p-3 text-xs text-[#8A8B8C] max-w-[200px]">{m.message}</td>
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            checked={isSel}
                            onChange={() => toggleSelect(m.row.rowIndex)}
                            className="w-4 h-4 accent-[#D4A843] cursor-pointer"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {expandedStatus && (!grouped[expandedStatus] || grouped[expandedStatus].length === 0) && (
            <div className="card-surface p-6 text-center text-[#8A8B8C]">No items in this category.</div>
          )}
        </>
      )}

      {/* Step 3: Done */}
      {step === "done" && allocationResult && (
        <div className="card-surface p-8 text-center">
          <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: "rgba(74,222,128,0.1)" }}>
            <CheckCircle className="w-8 h-8 text-[#4ADE80]" />
          </div>
          <h3 className="text-xl font-display font-semibold text-white mb-2">Payments Allocated Successfully</h3>
          <div className="text-sm text-[#8A8B8C] mb-6 space-y-1">
            <p><span className="text-[#4ADE80] font-display font-semibold">{allocationResult.processed}</span> payment(s) allocated</p>
            {allocationResult.errors.length > 0 && (
              <p className="text-[#EF4444]">{allocationResult.errors.length} error(s) — see details below</p>
            )}
            <p className="text-xs">All changes synced to cloud. Other devices will see the updated payment data.</p>
          </div>
          {allocationResult.errors.length > 0 && (
            <div className="text-left max-w-2xl mx-auto mb-6 p-4 rounded-lg" style={{ backgroundColor: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.2)" }}>
              <div className="text-xs font-semibold text-[#EF4444] mb-2">Errors:</div>
              {allocationResult.errors.map((e: string, i: number) => (
                <div key={i} className="text-xs text-[#EF4444]">• {e}</div>
              ))}
            </div>
          )}
          <button onClick={reset} className="btn-primary"><Upload className="w-4 h-4" /> Import Another File</button>
        </div>
      )}
    </div>
  );
}
