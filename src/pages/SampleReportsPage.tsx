import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { FlaskConical, Download, Search, DollarSign, Package, Calendar, FileText } from "lucide-react";

export default function SampleReportsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  const [selectedCustomer, setSelectedCustomer] = useState<number | null>(null);

  const { data: report } = trpc.sampleReport.getAll.useQuery(undefined, { refetchOnWindowFocus: true });
  const { data: customerReport } = trpc.sampleReport.getByCustomer.useQuery(
    { customerId: selectedCustomer || 0 },
    { enabled: !!selectedCustomer, refetchOnWindowFocus: true }
  );
  const { data: customers } = trpc.customer.search.useQuery({ query: " " });

  const handleExport = () => {
    if (!report) return;
    const headers = ["Customer Code", "Customer Name", "Sales Rep", "Product Code", "Product Name", "Date Taken", "Order Number", "Invoice Number", "Qty", "Unit Cost", "Total Cost"];
    const rows: any[] = [];
    report.customers.forEach((cust: any) => {
      cust.items.forEach((item: any) => {
        rows.push([
          cust.customerCode, cust.customerName, cust.salesRepName,
          item.productCode, item.productName,
          new Date(item.dateTaken).toLocaleDateString("en-ZA"),
          item.orderNumber, item.invoiceNumber,
          item.quantity, item.unitCost.toFixed(2), item.totalCost.toFixed(2),
        ]);
      });
    });
    const csv = [headers.join(","), ...rows.map((r) => r.map((v: any) => `"${v}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sample_report_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  const handleCustomerExport = () => {
    if (!customerReport || !selectedCustomer) return;
    const cust = (customers || []).find((c) => c.id === selectedCustomer);
    const headers = ["Product Code", "Product Name", "Date Taken", "Order Number", "Invoice Number", "Qty", "Unit Cost", "Total Cost"];
    const rows = customerReport.items.map((item: any) => [
      item.productCode, item.productName,
      new Date(item.dateTaken).toLocaleDateString("en-ZA"),
      item.orderNumber, item.invoiceNumber,
      item.quantity, item.unitCost.toFixed(2), item.totalCost.toFixed(2),
    ]);
    const csv = [headers.join(","), ...rows.map((r: any[]) => r.map((v) => `"${v}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sample_report_${cust?.customerCode || "customer"}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  if (!isAdmin) {
    return (
      <div className="card-surface p-12 text-center">
        <FlaskConical className="w-16 h-16 mx-auto mb-4 opacity-20" style={{ color: "#D4A843" }} />
        <p className="text-[#8A8B8C] font-body">Only administrators can access sample reports</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display font-semibold text-white" style={{ fontSize: "clamp(1.8rem, 3vw, 2.5rem)", letterSpacing: "-0.03em" }}>Sample Reports</h1>
          <p className="text-[#8A8B8C] font-body text-sm mt-1">
            {(report?.customers || []).length} customers with samples &middot; Total cost: R {(report?.grandTotal || 0).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}
          </p>
        </div>
        <button onClick={handleExport} className="btn-secondary"><Download className="w-4 h-4" /> Export All</button>
      </div>

      {/* Grand Total Card */}
      <div className="card-surface p-6 flex items-center gap-4">
        <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(212, 168, 67, 0.12)" }}>
          <DollarSign className="w-6 h-6 text-[#D4A843]" />
        </div>
        <div>
          <div className="label-text">TOTAL SAMPLE COST</div>
          <div className="stat-number" style={{ color: "#D4A843" }}>R {(report?.grandTotal || 0).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</div>
        </div>
      </div>

      {/* Customer Filter */}
      <div className="card-surface p-4">
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="label-text block mb-1.5">Filter by Customer</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8B8C]" />
              <select
                value={selectedCustomer || ""}
                onChange={(e) => setSelectedCustomer(e.target.value ? parseInt(e.target.value) : null)}
                className="input-field pl-10 w-full"
              >
                <option value="">All customers with samples</option>
                {(report?.customers || []).map((cust: any) => (
                  <option key={cust.customerId} value={cust.customerId}>
                    {cust.customerName} ({cust.sampleCount} samples) — R {cust.totalCost.toFixed(2)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {selectedCustomer && (
            <button onClick={handleCustomerExport} className="btn-secondary"><Download className="w-4 h-4" /> Export</button>
          )}
        </div>
      </div>

      {/* Customer-level Summary */}
      {!selectedCustomer && (
        <div className="card-surface overflow-hidden">
          <table className="w-full">
            <thead>
              <tr style={{ backgroundColor: "#131415", borderBottom: "1px solid #222324" }}>
                <th className="text-left p-4 label-text">Customer</th>
                <th className="text-left p-4 label-text">Sales Rep</th>
                <th className="text-right p-4 label-text">Samples</th>
                <th className="text-right p-4 label-text">Products</th>
                <th className="text-right p-4 label-text">Total Cost</th>
              </tr>
            </thead>
            <tbody>
              {(report?.customers || []).map((cust: any) => (
                <tr
                  key={cust.customerId}
                  className="cursor-pointer transition-colors hover:bg-[#131415]"
                  onClick={() => setSelectedCustomer(cust.customerId)}
                  style={{ borderBottom: "1px solid #18191A" }}
                >
                  <td className="p-4">
                    <div className="text-sm text-white font-body font-medium">{cust.customerName}</div>
                    <div className="text-xs text-[#8A8B8C] font-mono-data">{cust.customerCode}</div>
                  </td>
                  <td className="p-4 text-sm text-[#E8E8E9]">{cust.salesRepName}</td>
                  <td className="p-4 text-right text-sm text-white font-display">{cust.sampleCount}</td>
                  <td className="p-4 text-right text-sm text-white font-display">{cust.items.length}</td>
                  <td className="p-4 text-right font-display font-semibold" style={{ color: "#D4A843" }}>
                    R {cust.totalCost.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
              {(report?.customers || []).length === 0 && (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-[#8A8B8C] font-body">
                    <FlaskConical className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    No samples have been sent yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Detailed Customer Sample Report */}
      {selectedCustomer && customerReport && (
        <div className="space-y-4">
          <button onClick={() => setSelectedCustomer(null)} className="btn-secondary text-sm">&larr; Back to all customers</button>

          <div className="card-surface p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-display font-semibold text-white text-lg">
                  {(customers || []).find((c) => c.id === selectedCustomer)?.name || "Customer"}
                </h2>
                <p className="text-[#8A8B8C] text-sm">
                  {(customers || []).find((c) => c.id === selectedCustomer)?.salesRepName || "No rep assigned"}
                </p>
              </div>
              <div className="text-right">
                <div className="label-text">TOTAL SAMPLE COST</div>
                <div className="stat-number" style={{ color: "#D4A843", fontSize: "1.5rem" }}>
                  R {customerReport.grandTotal.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>
          </div>

          <div className="card-surface overflow-hidden">
            <table className="w-full">
              <thead>
                <tr style={{ backgroundColor: "#131415", borderBottom: "1px solid #222324" }}>
                  <th className="text-left p-3 label-text"><Package className="w-3 h-3 inline" /> Product</th>
                  <th className="text-left p-3 label-text"><Calendar className="w-3 h-3 inline" /> Date</th>
                  <th className="text-left p-3 label-text"><FileText className="w-3 h-3 inline" /> Order #</th>
                  <th className="text-left p-3 label-text"><FileText className="w-3 h-3 inline" /> Invoice #</th>
                  <th className="text-right p-3 label-text">Qty</th>
                  <th className="text-right p-3 label-text">Unit Cost</th>
                  <th className="text-right p-3 label-text">Total Cost</th>
                </tr>
              </thead>
              <tbody>
                {customerReport.items.map((item: any, idx: number) => (
                  <tr key={idx} style={{ borderBottom: "1px solid #18191A" }}>
                    <td className="p-3">
                      <div className="text-sm text-white font-body">{item.productName}</div>
                      <div className="text-xs text-[#8A8B8C] font-mono-data">{item.productCode}</div>
                    </td>
                    <td className="p-3 text-sm text-[#E8E8E9]">{new Date(item.dateTaken).toLocaleDateString("en-ZA")}</td>
                    <td className="p-3 text-sm font-mono-data text-[#D4A843]">{item.orderNumber}</td>
                    <td className="p-3 text-sm font-mono-data text-[#6366F1]">{item.invoiceNumber}</td>
                    <td className="p-3 text-right text-sm text-white">{item.quantity}</td>
                    <td className="p-3 text-right text-sm text-[#8A8B8C]">R {item.unitCost.toFixed(2)}</td>
                    <td className="p-3 text-right text-sm font-display font-semibold text-white">R {item.totalCost.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
