import { useState, useMemo, useRef } from "react";
import { trpc } from "@/providers/trpc";
import {
  Search, Download, FileSpreadsheet, Users, Upload, AlertCircle,
  CheckCircle, XCircle, AlertTriangle, Trash2, UserCircle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/* ─── Ding reconciliation row type ─── */
type DingRow = {
  invoiceNo: string;
  customerName: string;
  salesRep: string;
  amount: number;      // Ding total invoice amount
  outstanding: number; // Ding outstanding (OP column)
  paid: number;        // Ding amount paid (AP column)
};

type ReconResult =
  | { type: "matched"; ding: DingRow; app: any; diff: number }
  | { type: "balance_mismatch"; ding: DingRow; app: any; appBalance: number; diff: number }
  | { type: "sales_rep_mismatch"; ding: DingRow; app: any; appSalesRep: string; diff: number }
  | { type: "missing_in_app"; ding: DingRow }
  | { type: "missing_in_ding"; app: any; appBalance: number };

export default function CustomerBalanceReportPage() {
  const { data: invoices } = trpc.invoice.list.useQuery();
  const { data: customers } = trpc.customer.list.useQuery();
  const [searchTerm, setSearchTerm] = useState("");
  const [isExporting, setIsExporting] = useState(false);

  /* ─── Ding reconciliation state ─── */
  const [dingData, setDingData] = useState<DingRow[]>([]);
  const [dingFileName, setDingFileName] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [selectedRep, setSelectedRep] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ─── Existing customer balance logic ─── */
  const customerBalances = useMemo(() => {
    if (!invoices || !customers) return [];

    const customerMap = new Map<number, { id: number; name: string; totalOutstanding: number; invoiceCount: number }>();

    for (const cust of customers) {
      if (cust?.id) {
        customerMap.set(cust.id, {
          id: cust.id,
          name: cust.name || "Unnamed Customer",
          totalOutstanding: 0,
          invoiceCount: 0,
        });
      }
    }

    for (const inv of invoices) {
      if (!inv) continue;
      const status = inv.status;
      if (status === "paid" || status === "cancelled" || status === "void" || status === "draft") continue;

      const notes = (inv.notes || "").toLowerCase();
      const invNum = (inv.invoiceNumber || "").toLowerCase();
      if (inv.orderType === "sample" || notes.includes("sample") || invNum.includes("sample") || invNum.startsWith("sgf-smp-")) continue;

      const balance = typeof inv.balanceDue === "number" ? inv.balanceDue : 0;
      if (balance <= 0.01) continue;

      const custId = inv.customerId;
      if (!custId) continue;

      const existing = customerMap.get(custId);
      if (existing) {
        existing.totalOutstanding += balance;
        existing.invoiceCount += 1;
      } else {
        customerMap.set(custId, {
          id: custId,
          name: inv.customerName || "Unknown Customer",
          totalOutstanding: balance,
          invoiceCount: 1,
        });
      }
    }

    return Array.from(customerMap.values())
      .filter((c) => c.totalOutstanding > 0.01)
      .sort((a, b) => b.totalOutstanding - a.totalOutstanding);
  }, [invoices, customers]);

  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return customerBalances;
    const term = searchTerm.toLowerCase();
    return customerBalances.filter((c) => c.name.toLowerCase().includes(term));
  }, [customerBalances, searchTerm]);

  const grandTotal = useMemo(
    () => filtered.reduce((sum, c) => sum + c.totalOutstanding, 0),
    [filtered]
  );

  /* ─── Sales Rep balance summary ─── */
  const salesRepBalances = useMemo(() => {
    if (!customerBalances.length || !customers) return [];
    const custMap = new Map<number, any>();
    for (const c of customers) {
      if (c?.id) custMap.set(c.id, c);
    }
    const repMap = new Map<string, {
      repName: string; totalOutstanding: number; invoiceCount: number; customerCount: number; customers: typeof customerBalances;
    }>();
    for (const cb of customerBalances) {
      const cust = custMap.get(cb.id);
      const repName = (cust?.salesRepName || "Unassigned").trim();
      const existing = repMap.get(repName);
      if (existing) {
        existing.totalOutstanding += cb.totalOutstanding;
        existing.invoiceCount += cb.invoiceCount;
        existing.customerCount += 1;
        existing.customers.push(cb);
      } else {
        repMap.set(repName, {
          repName,
          totalOutstanding: cb.totalOutstanding,
          invoiceCount: cb.invoiceCount,
          customerCount: 1,
          customers: [cb],
        });
      }
    }
    return Array.from(repMap.values()).sort((a, b) => b.totalOutstanding - a.totalOutstanding);
  }, [customerBalances, customers]);

  /* ─── Reconciliation logic ─── */
  const reconResults = useMemo<ReconResult[]>(() => {
    if (!dingData.length || !invoices) return [];

    const appInvMap = new Map<string, any>();
    for (const inv of invoices) {
      const key = String(inv.invoiceNumber || "").trim().toUpperCase();
      if (key) appInvMap.set(key, inv);
    }

    const results: ReconResult[] = [];
    const matchedDing = new Set<string>();

    // 1. Check every Ding row against app
    for (const ding of dingData) {
      const appInv = appInvMap.get(ding.invoiceNo.toUpperCase());
      if (!appInv) {
        results.push({ type: "missing_in_app", ding });
        continue;
      }
      matchedDing.add(ding.invoiceNo.toUpperCase());

      const appBalance = typeof appInv.balanceDue === "number"
        ? appInv.balanceDue
        : (Number(appInv.total || appInv.totalAmount || 0) - Number(appInv.amountPaid || 0));

      const diff = Math.abs(ding.outstanding - appBalance);

      // Check sales rep mismatch
      const appCust = custMap.get(Number(appInv.customerId));
      const appSalesRep = (appCust?.salesRepName || "").trim();
      const dingSalesRep = (ding.salesRep || "").trim();
      const repMismatch = dingSalesRep && appSalesRep && dingSalesRep.toLowerCase() !== appSalesRep.toLowerCase();

      if (diff < 0.01 && !repMismatch) {
        results.push({ type: "matched", ding, app: appInv, diff });
      } else if (diff >= 0.01) {
        results.push({ type: "balance_mismatch", ding, app: appInv, appBalance, diff });
      } else if (repMismatch) {
        results.push({ type: "sales_rep_mismatch", ding, app: appInv, appSalesRep, diff: 0 });
      }
    }

    // 2. Check app invoices NOT in Ding (outstanding only)
    for (const inv of invoices) {
      const key = String(inv.invoiceNumber || "").trim().toUpperCase();
      if (!key || matchedDing.has(key)) continue;

      const status = inv.status;
      if (status === "paid" || status === "cancelled" || status === "void" || status === "draft") continue;

      const notes = (inv.notes || "").toLowerCase();
      const invNum = (inv.invoiceNumber || "").toLowerCase();
      if (inv.orderType === "sample" || notes.includes("sample") || invNum.includes("sample") || invNum.startsWith("sgf-smp-")) continue;

      const appBalance = typeof inv.balanceDue === "number"
        ? inv.balanceDue
        : (Number(inv.total || inv.totalAmount || 0) - Number(inv.amountPaid || 0));
      if (appBalance <= 0.01) continue;

      results.push({ type: "missing_in_ding", app: inv, appBalance });
    }

    return results.sort((a, b) => {
      const order = { missing_in_app: 0, balance_mismatch: 1, sales_rep_mismatch: 2, missing_in_ding: 3, matched: 4 };
      return (order[a.type] ?? 5) - (order[b.type] ?? 5);
    });
  }, [dingData, invoices]);

  const reconSummary = useMemo(() => {
    const matched = reconResults.filter((r) => r.type === "matched").length;
    const balanceMismatch = reconResults.filter((r) => r.type === "balance_mismatch").length;
    const salesRepMismatch = reconResults.filter((r) => r.type === "sales_rep_mismatch").length;
    const missingInApp = reconResults.filter((r) => r.type === "missing_in_app").length;
    const missingInDing = reconResults.filter((r) => r.type === "missing_in_ding").length;
    const totalVariance = reconResults
      .filter((r) => r.type === "balance_mismatch")
      .reduce((sum, r) => sum + (r as any).diff, 0);
    return { matched, balanceMismatch, salesRepMismatch, missingInApp, missingInDing, totalVariance };
  }, [reconResults]);

  /* ─── Import Ding report ─── */
  const handleDingImport = async (file: File) => {
    setIsImporting(true);
    setDingFileName(file.name);
    try {
      const XLSX = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

      if (rows.length < 2) {
        alert("The Ding report appears to be empty.");
        setDingData([]);
        return;
      }

      const headers = (rows[0] || []).map((h: any) => String(h || "").trim().toLowerCase());
      const findCol = (...names: string[]) => {
        for (const n of names) {
          const idx = headers.findIndex((h: string) => h === n.toLowerCase());
          if (idx >= 0) return idx;
        }
        return -1;
      };

      const colIdx = {
        invoiceNo: findCol("Invoice No"),
        name: findCol("Name"),
        salesBy: findCol("Sales By"),
        amount: findCol("Amount"),
        op: findCol("OP"),
        ap: findCol("AP"),
      };

      if (colIdx.invoiceNo < 0) {
        alert(`Could not find "Invoice No" column. Headers: ${headers.join(", ")}`);
        setDingData([]);
        return;
      }

      const cleanNum = (v: any) => {
        if (v == null || v === "") return 0;
        const s = String(v).replace(/,/g, "").trim();
        const n = parseFloat(s);
        return isNaN(n) ? 0 : n;
      };

      const parsed: DingRow[] = [];
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;
        const invoiceNo = String(row[colIdx.invoiceNo] || "").trim();
        if (!invoiceNo) continue;

        parsed.push({
          invoiceNo,
          customerName: colIdx.name >= 0 ? String(row[colIdx.name] || "").trim() : "",
          salesRep: colIdx.salesBy >= 0 ? String(row[colIdx.salesBy] || "").trim() : "",
          amount: cleanNum(colIdx.amount >= 0 ? row[colIdx.amount] : 0),
          outstanding: cleanNum(colIdx.op >= 0 ? row[colIdx.op] : 0),
          paid: cleanNum(colIdx.ap >= 0 ? row[colIdx.ap] : 0),
        });
      }

      setDingData(parsed);
    } catch (err: any) {
      alert("Failed to read Ding report: " + (err.message || "Unknown error"));
      setDingData([]);
    } finally {
      setIsImporting(false);
    }
  };

  const clearDing = () => {
    setDingData([]);
    setDingFileName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  /* ─── Export mismatch report ─── */
  const exportMismatch = async () => {
    const mismatches = reconResults.filter((r) => r.type !== "matched");
    if (!mismatches.length) { alert("No mismatches to export."); return; }

    setIsExporting(true);
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();
      const rows: any[][] = [
        ["Status", "Invoice #", "Customer (Ding)", "Customer (App)", "Ding Outstanding", "App Balance Due", "Difference", "Sales Rep (Ding)", "Sales Rep (App)"],
      ];

      for (const r of mismatches) {
        if (r.type === "missing_in_app") {
          rows.push([
            "Missing in App",
            r.ding.invoiceNo,
            r.ding.customerName,
            "—",
            r.ding.outstanding,
            "—",
            r.ding.outstanding,
            r.ding.salesRep,
            "—",
          ]);
        } else if (r.type === "balance_mismatch") {
          rows.push([
            "Balance Mismatch",
            r.ding.invoiceNo,
            r.ding.customerName,
            r.app.customerName || r.app.customer?.name || "",
            r.ding.outstanding,
            r.appBalance,
            r.diff,
            r.ding.salesRep,
            "",
          ]);
        } else if (r.type === "sales_rep_mismatch") {
          rows.push([
            "Sales Rep Mismatch",
            r.ding.invoiceNo,
            r.ding.customerName,
            r.app.customerName || r.app.customer?.name || "",
            r.ding.outstanding,
            r.ding.outstanding,
            0,
            r.ding.salesRep,
            r.appSalesRep,
          ]);
        } else if (r.type === "missing_in_ding") {
          rows.push([
            "Missing in Ding",
            r.app.invoiceNumber,
            "—",
            r.app.customerName || r.app.customer?.name || "",
            "—",
            r.appBalance,
            r.appBalance,
            "",
            "",
          ]);
        }
      }

      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws["!cols"] = [{ wch: 18 }, { wch: 14 }, { wch: 28 }, { wch: 28 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
      XLSX.utils.book_append_sheet(wb, ws, "Mismatches");
      XLSX.writeFile(wb, `Ding_Reconciliation_Mismatches_${new Date().toISOString().split("T")[0]}.xlsx`);
    } finally {
      setIsExporting(false);
    }
  };

  /* ─── Export existing balance report ─── */
  const handleExport = async () => {
    if (!filtered.length) return;
    setIsExporting(true);
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();
      const reportDate = new Date().toLocaleDateString("en-ZA");

      const coverWs = XLSX.utils.aoa_to_sheet([
        ["SUPREME GLOBAL FOODS — CUSTOMER BALANCE REPORT"],
        [],
        ["Report Date:", reportDate],
        ["Total Customers:", filtered.length],
        ["Grand Total Outstanding:", `R ${grandTotal.toFixed(2)}`],
      ]);
      coverWs["!cols"] = [{ wch: 35 }, { wch: 30 }];
      coverWs["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];
      XLSX.utils.book_append_sheet(wb, coverWs, "Cover");

      // Customer Balances sheet (with Sales Rep)
      const custRows = [["Customer Name", "Sales Rep", "Total Outstanding (R)", "Invoice Count"]];
      const custMap = new Map<number, any>();
      if (customers) {
        for (const c of customers) {
          if (c?.id) custMap.set(c.id, c);
        }
      }
      for (const c of filtered) {
        const cust = custMap.get(c.id);
        custRows.push([c.name, cust?.salesRepName || "", c.totalOutstanding, c.invoiceCount]);
      }
      custRows.push([]);
      custRows.push(["GRAND TOTAL", "", grandTotal, ""]);

      const ws = XLSX.utils.aoa_to_sheet(custRows);
      ws["!cols"] = [{ wch: 45 }, { wch: 18 }, { wch: 22 }, { wch: 14 }];
      XLSX.utils.book_append_sheet(wb, ws, "Customer Balances");

      // Sales Rep Balances sheet
      if (salesRepBalances.length) {
        const repRows = [["Sales Rep", "Total Outstanding (R)", "Invoices", "Customers"]];
        for (const r of salesRepBalances) {
          repRows.push([r.repName, r.totalOutstanding, r.invoiceCount, r.customerCount]);
        }
        repRows.push([]);
        repRows.push(["GRAND TOTAL", grandTotal, filtered.reduce((s, c) => s + c.invoiceCount, 0), filtered.length]);
        const repWs = XLSX.utils.aoa_to_sheet(repRows);
        repWs["!cols"] = [{ wch: 20 }, { wch: 22 }, { wch: 12 }, { wch: 12 }];
        XLSX.utils.book_append_sheet(wb, repWs, "Sales Rep Balances");
      }

      XLSX.writeFile(wb, `Customer_Balance_Report_${new Date().toISOString().split("T")[0]}.xlsx`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0C0D0E" }}>
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Users className="w-6 h-6 text-[#D4A853]" />
            <div>
              <h1 className="text-xl font-semibold text-white">Customer Balance Report</h1>
              <p className="text-sm text-[#8A8B8C]">All customers with outstanding balances</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-[#D4A853] border-[#D4A853]/30 hover:bg-[#D4A853]/10"
            onClick={handleExport}
            disabled={isExporting || !filtered.length}
          >
            <FileSpreadsheet className="w-4 h-4" />
            {isExporting ? "Exporting..." : "Export to Excel"}
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="p-4 rounded-xl border" style={{ backgroundColor: "#15171A", borderColor: "rgba(212,168,83,0.2)" }}>
            <p className="text-xs text-[#8A8B8C] mb-1">Total Customers</p>
            <p className="text-2xl font-bold text-white">{filtered.length}</p>
          </div>
          <div className="p-4 rounded-xl border" style={{ backgroundColor: "#15171A", borderColor: "rgba(212,168,83,0.2)" }}>
            <p className="text-xs text-[#8A8B8C] mb-1">Grand Total Outstanding</p>
            <p className="text-2xl font-bold text-[#D4A853]">R {grandTotal.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
          <div className="p-4 rounded-xl border" style={{ backgroundColor: "#15171A", borderColor: "rgba(212,168,83,0.2)" }}>
            <p className="text-xs text-[#8A8B8C] mb-1">Total Invoices Outstanding</p>
            <p className="text-2xl font-bold text-[#3B82F6]">
              {filtered.reduce((sum, c) => sum + c.invoiceCount, 0)}
            </p>
          </div>
        </div>

        {/* ─── Balances by Sales Rep ─── */}
        {salesRepBalances.length > 0 && (
          <div className="rounded-xl border p-4 mb-6" style={{ backgroundColor: "#15171A", borderColor: "rgba(212,168,83,0.2)" }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <UserCircle className="w-4 h-4 text-[#D4A853]" />
                <h2 className="text-sm font-semibold text-white">Balances by Sales Rep</h2>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-[#D4A853] border-[#D4A853]/30 hover:bg-[#D4A853]/10 text-xs"
                onClick={async () => {
                  if (!salesRepBalances.length) return;
                  setIsExporting(true);
                  try {
                    const XLSX = await import("xlsx");
                    const wb = XLSX.utils.book_new();
                    const rows: any[][] = [["Sales Rep", "Total Outstanding (R)", "Invoices", "Customers"]];
                    for (const r of salesRepBalances) {
                      rows.push([r.repName, r.totalOutstanding, r.invoiceCount, r.customerCount]);
                    }
                    rows.push([]);
                    rows.push(["GRAND TOTAL", grandTotal, filtered.reduce((s, c) => s + c.invoiceCount, 0), filtered.length]);
                    const ws = XLSX.utils.aoa_to_sheet(rows);
                    ws["!cols"] = [{ wch: 20 }, { wch: 22 }, { wch: 12 }, { wch: 12 }];
                    XLSX.utils.book_append_sheet(wb, ws, "Sales Rep Balances");
                    XLSX.writeFile(wb, `Sales_Rep_Balances_${new Date().toISOString().split("T")[0]}.xlsx`);
                  } finally {
                    setIsExporting(false);
                  }
                }}
                disabled={isExporting}
              >
                <Download className="w-3 h-3" />
                {isExporting ? "Exporting..." : "Export"}
              </Button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {salesRepBalances.map((rep) => (
                <div
                  key={rep.repName}
                  className="p-3 rounded-lg border transition-colors hover:bg-[rgba(212,168,83,0.06)] cursor-pointer"
                  style={{
                    backgroundColor: selectedRep === rep.repName ? "rgba(212,168,83,0.08)" : "#0A0A0B",
                    borderColor: selectedRep === rep.repName ? "rgba(212,168,83,0.4)" : "rgba(255,255,255,0.06)",
                  }}
                  onClick={() => setSelectedRep(selectedRep === rep.repName ? null : rep.repName)}
                  title="Click to view customers"
                >
                  <p className="text-xs text-[#8A8B8C] truncate" title={rep.repName}>{rep.repName}</p>
                  <p className="text-lg font-bold text-[#D4A853]">
                    R {rep.totalOutstanding.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <div className="flex items-center gap-3 mt-1 text-[10px] text-[#8A8B8C]">
                    <span>{rep.invoiceCount} invoice{rep.invoiceCount !== 1 ? "s" : ""}</span>
                    <span>{rep.customerCount} customer{rep.customerCount !== 1 ? "s" : ""}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Selected rep detail */}
            {selectedRep && (
              <div className="mt-3 rounded-lg border overflow-hidden" style={{ backgroundColor: "#0A0A0B", borderColor: "rgba(212,168,83,0.15)" }}>
                <div className="flex items-center justify-between px-3 py-2" style={{ backgroundColor: "rgba(212,168,83,0.06)" }}>
                  <h3 className="text-xs font-semibold text-[#D4A853]">{selectedRep} — Customer Detail</h3>
                  <button onClick={() => setSelectedRep(null)} className="text-[10px] text-[#8A8B8C] hover:text-white">Close</button>
                </div>
                <table className="w-full text-[11px]">
                  <thead>
                    <tr style={{ backgroundColor: "rgba(212,168,83,0.04)" }}>
                      <th className="text-left px-3 py-1.5 font-medium text-[#D4A853]">Customer</th>
                      <th className="text-right px-3 py-1.5 font-medium text-[#D4A853]">Invoices</th>
                      <th className="text-right px-3 py-1.5 font-medium text-[#D4A853]">Outstanding</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salesRepBalances.find((r) => r.repName === selectedRep)?.customers.map((c: any) => (
                      <tr key={c.id} className="border-t" style={{ borderColor: "rgba(255,255,255,0.03)" }}>
                        <td className="px-3 py-1.5 text-white">{c.name}</td>
                        <td className="px-3 py-1.5 text-right text-[#8A8B8C]">{c.invoiceCount}</td>
                        <td className="px-3 py-1.5 text-right font-medium text-[#D4A853]">
                          R {c.totalOutstanding.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ─── Ding Reconciliation Import ─── */}
        <div className="rounded-xl border p-4 mb-6" style={{ backgroundColor: "#15171A", borderColor: "rgba(212,168,83,0.2)" }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Upload className="w-4 h-4 text-[#D4A853]" />
              <h2 className="text-sm font-semibold text-white">Reconcile with Ding Due Report</h2>
            </div>
            {dingData.length > 0 && (
              <button onClick={clearDing} className="flex items-center gap-1 text-xs text-[#EF4444] hover:underline">
                <Trash2 className="w-3 h-3" /> Clear
              </button>
            )}
          </div>

          {dingData.length === 0 ? (
            <label className="flex flex-col items-center justify-center gap-2 p-6 rounded-lg border border-dashed cursor-pointer transition-colors hover:bg-[rgba(212,168,83,0.04)]" style={{ borderColor: "rgba(212,168,83,0.3)" }}>
              <Upload className="w-6 h-6 text-[#8A8B8C]" />
              <span className="text-xs text-[#8A8B8C]">Click or drag & drop the Ding Due Report (.xlsx)</span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleDingImport(f);
                }}
              />
            </label>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs text-[#8A8B8C]">
                <FileSpreadsheet className="w-3.5 h-3.5 text-[#4ADE80]" />
                <span>{dingFileName}</span>
                <span className="text-[#4ADE80]">{dingData.length} invoices loaded</span>
              </div>

              {/* Reconciliation summary cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <div className="p-3 rounded-lg text-center" style={{ backgroundColor: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.2)" }}>
                  <CheckCircle className="w-4 h-4 text-[#4ADE80] mx-auto mb-1" />
                  <p className="text-lg font-bold text-[#4ADE80]">{reconSummary.matched}</p>
                  <p className="text-[10px] text-[#8A8B8C]">Matched</p>
                </div>
                <div className="p-3 rounded-lg text-center" style={{ backgroundColor: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}>
                  <AlertTriangle className="w-4 h-4 text-[#F59E0B] mx-auto mb-1" />
                  <p className="text-lg font-bold text-[#F59E0B]">{reconSummary.balanceMismatch}</p>
                  <p className="text-[10px] text-[#8A8B8C]">Balance Mismatch</p>
                </div>
                <div className="p-3 rounded-lg text-center" style={{ backgroundColor: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.2)" }}>
                  <UserCircle className="w-4 h-4 text-[#A855F7] mx-auto mb-1" />
                  <p className="text-lg font-bold text-[#A855F7]">{reconSummary.salesRepMismatch}</p>
                  <p className="text-[10px] text-[#8A8B8C]">Sales Rep Mismatch</p>
                </div>
                <div className="p-3 rounded-lg text-center" style={{ backgroundColor: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
                  <XCircle className="w-4 h-4 text-[#EF4444] mx-auto mb-1" />
                  <p className="text-lg font-bold text-[#EF4444]">{reconSummary.missingInApp}</p>
                  <p className="text-[10px] text-[#8A8B8C]">Missing in App</p>
                </div>
                <div className="p-3 rounded-lg text-center" style={{ backgroundColor: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)" }}>
                  <AlertCircle className="w-4 h-4 text-[#3B82F6] mx-auto mb-1" />
                  <p className="text-lg font-bold text-[#3B82F6]">{reconSummary.missingInDing}</p>
                  <p className="text-[10px] text-[#8A8B8C]">Missing in Ding</p>
                </div>
              </div>

              {reconSummary.balanceMismatch > 0 && (
                <div className="text-xs text-[#F59E0B] text-center">
                  Total variance on mismatched balances: <span className="font-bold">R {reconSummary.totalVariance.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              )}

              {/* Export mismatches */}
              {(reconSummary.balanceMismatch + reconSummary.salesRepMismatch + reconSummary.missingInApp + reconSummary.missingInDing) > 0 && (
                <div className="text-center">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 text-[#EF4444] border-[#EF4444]/30 hover:bg-[#EF4444]/10"
                    onClick={exportMismatch}
                    disabled={isExporting}
                  >
                    <Download className="w-3.5 h-3.5" />
                    {isExporting ? "Exporting..." : "Export Mismatch Report"}
                  </Button>
                </div>
              )}

              {/* Reconciliation table */}
              <div className="rounded-lg border overflow-hidden" style={{ backgroundColor: "#0A0A0B", borderColor: "rgba(255,255,255,0.05)" }}>
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ backgroundColor: "rgba(212,168,83,0.08)" }}>
                      <th className="text-left px-3 py-2 font-semibold text-[#D4A853]">Status</th>
                      <th className="text-left px-3 py-2 font-semibold text-[#D4A853]">Invoice #</th>
                      <th className="text-left px-3 py-2 font-semibold text-[#D4A853]">Customer</th>
                      <th className="text-right px-3 py-2 font-semibold text-[#D4A853]">Ding Outstanding</th>
                      <th className="text-right px-3 py-2 font-semibold text-[#D4A853]">App Balance</th>
                      <th className="text-right px-3 py-2 font-semibold text-[#D4A853]">Difference</th>
                      <th className="text-left px-3 py-2 font-semibold text-[#D4A853]">Sales Rep</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reconResults.map((r, idx) => {
                      if (r.type === "matched") {
                        return (
                          <tr key={`m-${idx}`} className="border-t" style={{ borderColor: "rgba(255,255,255,0.03)" }}>
                            <td className="px-3 py-2">
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ backgroundColor: "rgba(74,222,128,0.1)", color: "#4ADE80" }}>
                                <CheckCircle className="w-3 h-3" /> Matched
                              </span>
                            </td>
                            <td className="px-3 py-2 text-white font-mono">{r.ding.invoiceNo}</td>
                            <td className="px-3 py-2 text-[#8A8B8C]">{r.ding.customerName}</td>
                            <td className="px-3 py-2 text-right text-[#8A8B8C]">R {r.ding.outstanding.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            <td className="px-3 py-2 text-right text-[#8A8B8C]">R {r.ding.outstanding.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            <td className="px-3 py-2 text-right text-[#4ADE80]">—</td>
                            <td className="px-3 py-2 text-[#8A8B8C]">{r.ding.salesRep}</td>
                          </tr>
                        );
                      }
                      if (r.type === "balance_mismatch") {
                        return (
                          <tr key={`mm-${idx}`} className="border-t" style={{ borderColor: "rgba(255,255,255,0.03)", backgroundColor: "rgba(245,158,11,0.03)" }}>
                            <td className="px-3 py-2">
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ backgroundColor: "rgba(245,158,11,0.1)", color: "#F59E0B" }}>
                                <AlertTriangle className="w-3 h-3" /> Mismatch
                              </span>
                            </td>
                            <td className="px-3 py-2 text-white font-mono">{r.ding.invoiceNo}</td>
                            <td className="px-3 py-2 text-[#8A8B8C]">{r.ding.customerName}</td>
                            <td className="px-3 py-2 text-right text-[#F59E0B]">R {r.ding.outstanding.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            <td className="px-3 py-2 text-right text-[#F59E0B]">R {r.appBalance.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            <td className="px-3 py-2 text-right font-bold text-[#EF4444]">R {r.diff.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            <td className="px-3 py-2 text-[#8A8B8C]">{r.ding.salesRep}</td>
                          </tr>
                        );
                      }
                      if (r.type === "sales_rep_mismatch") {
                        return (
                          <tr key={`srm-${idx}`} className="border-t" style={{ borderColor: "rgba(255,255,255,0.03)", backgroundColor: "rgba(168,85,247,0.03)" }}>
                            <td className="px-3 py-2">
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ backgroundColor: "rgba(168,85,247,0.1)", color: "#A855F7" }}>
                                <UserCircle className="w-3 h-3" /> Rep Mismatch
                              </span>
                            </td>
                            <td className="px-3 py-2 text-white font-mono">{r.ding.invoiceNo}</td>
                            <td className="px-3 py-2 text-[#8A8B8C]">{r.ding.customerName}</td>
                            <td className="px-3 py-2 text-right text-[#A855F7]">R {r.ding.outstanding.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            <td className="px-3 py-2 text-right text-[#A855F7]">R {r.ding.outstanding.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            <td className="px-3 py-2 text-right font-bold text-[#A855F7]">—</td>
                            <td className="px-3 py-2 text-[#8A8B8C]">
                              <span className="block text-[#EF4444]" title="Ding">D: {r.ding.salesRep}</span>
                              <span className="block text-[#4ADE80]" title="App">A: {r.appSalesRep}</span>
                            </td>
                          </tr>
                        );
                      }
                      if (r.type === "missing_in_app") {
                        return (
                          <tr key={`mia-${idx}`} className="border-t" style={{ borderColor: "rgba(255,255,255,0.03)", backgroundColor: "rgba(239,68,68,0.03)" }}>
                            <td className="px-3 py-2">
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ backgroundColor: "rgba(239,68,68,0.1)", color: "#EF4444" }}>
                                <XCircle className="w-3 h-3" /> Missing in App
                              </span>
                            </td>
                            <td className="px-3 py-2 text-white font-mono">{r.ding.invoiceNo}</td>
                            <td className="px-3 py-2 text-[#8A8B8C]">{r.ding.customerName}</td>
                            <td className="px-3 py-2 text-right text-[#EF4444]">R {r.ding.outstanding.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            <td className="px-3 py-2 text-right text-[#8A8B8C]">—</td>
                            <td className="px-3 py-2 text-right font-bold text-[#EF4444]">R {r.ding.outstanding.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            <td className="px-3 py-2 text-[#8A8B8C]">{r.ding.salesRep}</td>
                          </tr>
                        );
                      }
                      if (r.type === "missing_in_ding") {
                        return (
                          <tr key={`mid-${idx}`} className="border-t" style={{ borderColor: "rgba(255,255,255,0.03)", backgroundColor: "rgba(59,130,246,0.03)" }}>
                            <td className="px-3 py-2">
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ backgroundColor: "rgba(59,130,246,0.1)", color: "#3B82F6" }}>
                                <AlertCircle className="w-3 h-3" /> Missing in Ding
                              </span>
                            </td>
                            <td className="px-3 py-2 text-white font-mono">{r.app.invoiceNumber}</td>
                            <td className="px-3 py-2 text-[#8A8B8C]">{r.app.customerName || r.app.customer?.name || "Unknown"}</td>
                            <td className="px-3 py-2 text-right text-[#8A8B8C]">—</td>
                            <td className="px-3 py-2 text-right text-[#3B82F6]">R {r.appBalance.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            <td className="px-3 py-2 text-right font-bold text-[#3B82F6]">R {r.appBalance.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            <td className="px-3 py-2 text-[#8A8B8C]">—</td>
                          </tr>
                        );
                      }
                      return null;
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8B8C]" />
          <Input
            placeholder="Search customer name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            style={{ backgroundColor: "#15171A", borderColor: "rgba(212,168,83,0.2)" }}
          />
        </div>

        {/* Table */}
        <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: "#15171A", borderColor: "rgba(212,168,83,0.2)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: "rgba(212,168,83,0.08)" }}>
                <th className="text-left px-4 py-3 font-semibold text-[#D4A853]">#</th>
                <th className="text-left px-4 py-3 font-semibold text-[#D4A853]">Customer Name</th>
                <th className="text-right px-4 py-3 font-semibold text-[#D4A853]">Invoices</th>
                <th className="text-right px-4 py-3 font-semibold text-[#D4A853]">Total Outstanding</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-[#8A8B8C]">
                    {searchTerm ? "No customers match your search." : "No customers with outstanding balances."}
                  </td>
                </tr>
              ) : (
                filtered.map((c, idx) => (
                  <tr
                    key={c.id}
                    className="border-t transition-colors hover:bg-[rgba(212,168,83,0.04)]"
                    style={{ borderColor: "rgba(255,255,255,0.05)" }}
                  >
                    <td className="px-4 py-3 text-[#8A8B8C]">{idx + 1}</td>
                    <td className="px-4 py-3 text-white font-medium">{c.name}</td>
                    <td className="px-4 py-3 text-right text-[#8A8B8C]">{c.invoiceCount}</td>
                    <td className="px-4 py-3 text-right font-semibold text-[#D4A853]">
                      R {c.totalOutstanding.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))
              )}
              {filtered.length > 0 && (
                <tr style={{ backgroundColor: "rgba(212,168,83,0.08)" }}>
                  <td colSpan={3} className="px-4 py-3 text-right font-bold text-white">GRAND TOTAL</td>
                  <td className="px-4 py-3 text-right font-bold text-[#D4A853]">
                    R {grandTotal.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
