import { useState, useMemo } from "react";
import { trpc } from "@/providers/trpc";
import { Search, Download, FileSpreadsheet, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function CustomerBalanceReportPage() {
  const { data: invoices } = trpc.invoice.list.useQuery();
  const { data: customers } = trpc.customer.list.useQuery();
  const [searchTerm, setSearchTerm] = useState("");
  const [isExporting, setIsExporting] = useState(false);

  const customerBalances = useMemo(() => {
    if (!invoices || !customers) return [];

    const customerMap = new Map<number, { id: number; name: string; totalOutstanding: number; invoiceCount: number }>();

    // Initialize all customers with 0
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

    // Sum outstanding balances per customer
    for (const inv of invoices) {
      if (!inv) continue;
      const status = inv.status;
      if (status === "paid" || status === "cancelled" || status === "void" || status === "draft") continue;

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

    // Convert to array and sort by total outstanding desc
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

  const handleExport = async () => {
    if (!filtered.length) return;
    setIsExporting(true);
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();
      const reportDate = new Date().toLocaleDateString("en-ZA");

      // Cover
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

      // Data sheet
      const rows = [["Customer Name", "Total Outstanding (R)", "Invoice Count"]];
      for (const c of filtered) {
        rows.push([c.name, c.totalOutstanding, c.invoiceCount]);
      }
      rows.push([]);
      rows.push(["GRAND TOTAL", grandTotal, ""]);

      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws["!cols"] = [{ wch: 50 }, { wch: 25 }, { wch: 15 }];
      XLSX.utils.book_append_sheet(wb, ws, "Customer Balances");

      XLSX.writeFile(wb, `Customer_Balance_Report_${new Date().toISOString().split("T")[0]}.xlsx`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0C0D0E" }}>
      <div className="max-w-6xl mx-auto px-4 py-6">
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
