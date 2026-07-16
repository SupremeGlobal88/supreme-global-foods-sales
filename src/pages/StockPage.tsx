import { useState, useRef } from "react";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { reloadFromStorage } from "@/lib/dataService";
import {
  Search, Upload, Plus, Pencil, Trash2, X, Package, AlertTriangle, CheckCircle,
  FileText, Calendar, Printer, Tag, BarChart3,
} from "lucide-react";

export default function StockPage() {
  const { user } = useAuth();
  const { isAdmin } = useRole();
  const utils = trpc.useUtils();

  /* Daily Invoiced Stock Report */
  const todayStr = new Date().toISOString().slice(0, 10);
  const [reportFrom, setReportFrom] = useState(todayStr);
  const [reportTo, setReportTo] = useState(todayStr);
  const [showReport, setShowReport] = useState(false);

  // Stock Reconciliation
  const [reconcileFrom, setReconcileFrom] = useState(todayStr);
  const [reconcileTo, setReconcileTo] = useState(todayStr);
  const [showReconcile, setShowReconcile] = useState(false);
  const reconcileQuery = trpc.stock.reconcileStock.useQuery(
    { from: reconcileFrom, to: reconcileTo },
    { enabled: showReconcile }
  );
  const { data: dailyReport } = trpc.stock.getDailyInvoicedStock.useQuery(
    { from: reportFrom, to: reportTo },
    { enabled: isAdmin && showReport },
  );

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadStatus, setUploadStatus] = useState<string>("");

  const [formData, setFormData] = useState({
    productCode: "", productName: "", category: "", strands: "", size: "", grade: "", color: "", species: "", origin: "",
    quantity: 0, corporatePrice: 0, bulkPrice: 0, wholesalePrice: 0, retailPrice: 0, description: "",
  });

  const { data: stockItems } = trpc.stock.search.useQuery({ query: search || " " }, { enabled: true });
  const { data: categories } = trpc.stock.getCategories.useQuery();
  const { data: stats } = trpc.stock.getStats.useQuery();

  const createStock = trpc.stock.create.useMutation({
    onSuccess: async () => { reloadFromStorage(); await utils.stock.search.invalidate(); await utils.stock.getStats.invalidate(); setShowForm(false); resetForm(); },
  });
  const updateStock = trpc.stock.update.useMutation({
    onSuccess: async () => { reloadFromStorage(); await utils.stock.search.invalidate(); await utils.stock.getStats.invalidate(); setShowForm(false); setEditingId(null); resetForm(); },
  });
  const deleteStock = trpc.stock.delete.useMutation({
    onSuccess: async () => { reloadFromStorage(); await utils.stock.search.invalidate(); await utils.stock.getStats.invalidate(); },
  });
  const bulkUpload = trpc.stock.bulkUpload.useMutation({
    onSuccess: async () => { reloadFromStorage(); await utils.stock.search.invalidate(); await utils.stock.getStats.invalidate(); setShowUpload(false); },
  });

  function resetForm() {
    setFormData({ productCode: "", productName: "", category: "", strands: "", size: "", grade: "", color: "", species: "", origin: "", quantity: 0, corporatePrice: 0, bulkPrice: 0, wholesalePrice: 0, retailPrice: 0, description: "" });
  }

  function handleEdit(item: NonNullable<typeof stockItems>[0]) {
    setFormData({
      productCode: item.productCode, productName: item.productName, category: item.category,
      strands: item.strands || "", size: item.size || "", grade: item.grade || "", color: item.color || "",
      species: item.species || "", origin: item.origin || "", quantity: item.quantity,
      corporatePrice: Number(item.corporatePrice), bulkPrice: Number(item.bulkPrice),
      wholesalePrice: Number(item.wholesalePrice), retailPrice: Number(item.retailPrice),
      description: item.description || "",
    });
    setEditingId(item.id); setShowForm(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editingId) { updateStock.mutate({ id: editingId, ...formData }); }
    else { createStock.mutate(formData); }
  }

  // Auto-detect category from product name
  function detectCategory(name: string): string {
    const n = name.toUpperCase();
    if (n.includes("BARREL")) return "Barrels";
    if (n.includes("THREAD")) return "Threads";
    if (n.includes("SALT")) return "Salt";
    if (n.includes("MEGA LONG")) return n.includes("TUBED") ? "Mega Long Tubed" : "Mega Long";
    if (n.includes("ELITE LONG")) return n.includes("TUBED") ? "Elite Long Tubed" : "Elite Long";
    if (n.includes("ULTRA LONG")) return n.includes("TUBED") ? "Ultra Long Tubed" : n.includes("VALUE") ? "Ultra Long Value" : "Ultra Long Lux";
    if (n.includes("SUPER LONG")) return n.includes("TUBED") ? "Super Long Tubed" : n.includes("VALUE") ? "Super Long Value" : "Super Long Lux";
    if (n.includes("SELECTED LONG")) return n.includes("TUBED") ? "Selected Long Tubed" : n.includes("VALUE") ? "Selected Long Value" : "Selected Long Lux";
    if (n.includes("MEDIUM LONG")) return n.includes("TUBED") ? "Medium Long Tubed" : n.includes("VALUE") ? "Medium Long Value" : "Medium Long Lux";
    if (n.includes("LONG LUX")) return n.includes("TUBED") ? "Long Lux Tubed" : "Long Lux";
    if (n.includes("LONG VALUE")) return n.includes("TUBED") ? "Long Value Tubed" : "Long Value";
    return "General";
  }

  // Generate product code from product name
  function generateProductCode(name: string): string {
    return name.trim().toUpperCase().replace(/\s+/g, "-").replace(/\//g, "-").substring(0, 50);
  }

  // Print Daily Invoiced Stock Report to PDF
  function printReport() {
    if (!dailyReport || !dailyReport.items) return;
    const logoUrl = `${window.location.origin}/sgf-logo.png`;
    const period = dailyReport.from === dailyReport.to ? dailyReport.from : `${dailyReport.from} to ${dailyReport.to}`;

    const rows = dailyReport.items.map((item: any) => `
      <tr style="border-bottom:1px solid #e5e5e5;">
        <td style="padding:7px 8px; font-size:10px; font-weight:700; color:#D4A843;">${item.invoiceNumber}</td>
        <td style="padding:7px 8px; font-size:10px; color:#555;">${new Date(item.invoiceDate).toLocaleDateString("en-ZA")}</td>
        <td style="padding:7px 8px; font-size:10px;">
          <strong>${item.productName}</strong>
          ${item.productCode ? `<br/><span style="color:#888; font-size:9px;">${item.productCode}</span>` : ""}
        </td>
        <td style="padding:7px 8px; font-size:10px; text-align:right;">${item.quantity}</td>
        <td style="padding:7px 8px; font-size:10px; text-align:right;">R ${Number(item.unitPrice).toFixed(2)}</td>
        <td style="padding:7px 8px; font-size:10px; text-align:right;">R ${Number(item.lineTotal).toFixed(2)}</td>
        <td style="padding:7px 8px; font-size:10px; text-align:center;">
          ${item.isSpecialPrice ? '<span style="background:#FFF8E1; color:#D4A843; padding:2px 6px; border-radius:8px; font-weight:700; font-size:9px;">SPECIAL</span>' : '<span style="color:#888;">-</span>'}
        </td>
        <td style="padding:7px 8px; font-size:10px; text-align:center; text-transform:capitalize;">${item.priceTier}</td>
        <td style="padding:7px 8px; font-size:10px;">${item.salesRep || "-"}</td>
      </tr>
    `).join("");

    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!DOCTYPE html>
      <html><head><title>Daily Invoiced Stock Report - ${period}</title>
      <style>
        @media print { body { padding: 0; } }
        body { font-family: Arial, Helvetica, sans-serif; color: #333; max-width: 297mm; margin: 0 auto; font-size: 11px; line-height: 1.4; padding: 20px; }
        .header { text-align: center; border-bottom: 3px solid #D4A843; padding-bottom: 10px; margin-bottom: 14px; }
        .header img { height: 50px; margin-bottom: 4px; }
        .header h1 { font-size: 18px; font-weight: 800; color: #D4A843; margin: 4px 0; letter-spacing: 1px; text-transform: uppercase; }
        .header .sub { font-size: 10px; color: #666; }
        .summary { display: flex; justify-content: space-between; margin-bottom: 14px; padding: 10px; background: #f9f9f9; border-radius: 6px; }
        .summary-box { text-align: center; flex: 1; }
        .summary-box .label { font-size: 9px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; }
        .summary-box .value { font-size: 16px; font-weight: 800; color: #222; }
        table.ledger { width: 100%; border-collapse: collapse; font-size: 10px; }
        table.ledger thead th { background: #D4A843; color: #fff; padding: 8px; text-align: left; font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; }
        table.ledger tbody td { padding: 6px 8px; vertical-align: top; }
        .footer { text-align: center; font-size: 9px; color: #999; margin-top: 16px; border-top: 1px solid #ddd; padding-top: 8px; }
      </style></head>
      <body>
        <div class="header">
          <img src="${logoUrl}" onerror="this.style.display='none'" />
          <h1>Daily Invoiced Stock Report</h1>
          <div class="sub">${period} &nbsp;|&nbsp; Generated: ${new Date().toLocaleDateString("en-ZA")}</div>
          <div class="sub">28 Nagington road, Wadeville, Germiston &nbsp;|&nbsp; Tel: 083 293 0644</div>
        </div>
        <div class="summary">
          <div class="summary-box"><div class="label">Total Lines</div><div class="value">${dailyReport.totalLines}</div></div>
          <div class="summary-box"><div class="label">Total Value</div><div class="value" style="color:#D4A843;">R ${Number(dailyReport.totalValue || 0).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</div></div>
          <div class="summary-box"><div class="label">Period</div><div class="value" style="font-size:12px;">${period}</div></div>
        </div>
        <table class="ledger">
          <thead><tr>
            <th>Invoice #</th><th>Date</th><th>Product</th><th style="text-align:right">Qty</th>
            <th style="text-align:right">Unit Price</th><th style="text-align:right">Line Total</th>
            <th style="text-align:center">Special</th><th style="text-align:center">Tier</th><th>Sales Rep</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="footer">
          Supreme Global Foods &nbsp;|&nbsp; Confidential Internal Report &nbsp;|&nbsp; Page 1 of 1
        </div>
      </body></html>`);
    w.document.close();
    w.print();
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    e.target.value = "";
    setUploadStatus("Reading file...");

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const XLSX = await import("xlsx");
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: "" }) as any[][];

        if (rows.length < 2) {
          setUploadStatus("Error: File appears to be empty or has no data rows.");
          return;
        }

        // Find header row (first row with text headers)
        let headerRowIdx = 0;
        const headerRow = rows[0].map((h: any) => String(h).toLowerCase().trim());
        if (!headerRow.some((h) => h.includes("product") || h.includes("soh"))) {
          // Try second row if first isn't headers
          headerRowIdx = 1;
        }
        const headers = rows[headerRowIdx].map((h: any) => String(h).toLowerCase().trim());

        // Find column indices by matching headers
        const findCol = (...names: string[]) => {
          for (const n of names) {
            const i = headers.findIndex((h) => h === n.toLowerCase() || h.includes(n.toLowerCase()));
            if (i >= 0) return i;
          }
          return -1;
        };

        const colIdx = {
          product: findCol("product"),
          strands: findCol("strands"),
          size: findCol("size"),
          grade: findCol("grade"),
          color: findCol("color"),
          species: findCol("species"),
          soh: findCol("soh", "qty", "quantity", "stock"),
          corpPrice: findCol("corporate price", "corporate"),
          bulkPrice: findCol("bulk price", "bulk"),
          wholesalePrice: findCol("wholesale price", "wholesale"),
          retailPrice: findCol("retail price", "retail"),
        };

        if (colIdx.product < 0) {
          setUploadStatus(`Error: Could not find "Product" column. Headers found: ${headers.join(", ")}`);
          return;
        }
        if (colIdx.soh < 0) {
          setUploadStatus(`Error: Could not find "SOH" column. Headers found: ${headers.join(", ")}`);
          return;
        }

        const items = [];
        let skipped = 0;
        const dataStartRow = headerRowIdx + 1;

        for (let i = dataStartRow; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0) { skipped++; continue; }

          const productName = String(row[colIdx.product] || "").trim();
          if (!productName) { skipped++; continue; }

          // Get quantity from SOH column
          const qtyVal = row[colIdx.soh];
          const quantity = qtyVal !== "" && qtyVal !== undefined ? parseInt(String(qtyVal)) || 0 : 0;

          // Get prices (may be empty for some rows like THREADS)
          const getPrice = (idx: number) => idx >= 0 && row[idx] !== "" && row[idx] !== undefined ? parseFloat(String(row[idx])) || 0 : 0;

          const category = detectCategory(productName);
          const productCode = generateProductCode(productName);

          items.push({
            productCode,
            productName,
            category,
            strands: colIdx.strands >= 0 ? String(row[colIdx.strands] || "") : "",
            size: colIdx.size >= 0 ? String(row[colIdx.size] || "") : "",
            grade: colIdx.grade >= 0 ? String(row[colIdx.grade] || "") : "",
            color: colIdx.color >= 0 ? String(row[colIdx.color] || "") : "",
            species: colIdx.species >= 0 ? String(row[colIdx.species] || "") : "",
            origin: "",
            quantity,
            corporatePrice: getPrice(colIdx.corpPrice),
            bulkPrice: getPrice(colIdx.bulkPrice),
            wholesalePrice: getPrice(colIdx.wholesalePrice),
            retailPrice: getPrice(colIdx.retailPrice),
            description: "",
          });
        }

        if (items.length > 0) {
          setUploadStatus(`Parsed ${items.length} products. Uploading...`);
          bulkUpload.mutate(items, {
            onSuccess: (res: any) => {
              const created = res?.created || 0;
              const updated = res?.updated || 0;
              if (created > 0 && updated > 0) {
                setUploadStatus(`${updated} products updated, ${created} new products added!`);
              } else if (updated > 0) {
                setUploadStatus(`${updated} products updated!`);
              } else {
                setUploadStatus(`${created} new products added!`);
              }
              setTimeout(() => { setUploadStatus(""); setShowUpload(false); }, 3000);
            },
            onError: (err: any) => {
              setUploadStatus(`Upload failed: ${err.message || "Unknown error"}`);
            },
          });
        } else {
          setUploadStatus(`No valid products found. Headers detected: ${headers.join(", ")}. Skipped ${skipped} empty rows.`);
        }
      } catch (err: any) {
        setUploadStatus(`Error reading file: ${err.message || "Unknown error"}`);
      }
    };
    reader.onerror = () => {
      setUploadStatus("Error: Could not read the file. Try a different format.");
    };
    reader.readAsArrayBuffer(file);
  }

  const filtered = (stockItems || []).filter((item) => !category || item.category === category);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display font-semibold text-white" style={{ fontSize: "clamp(1.8rem, 3vw, 2.5rem)", letterSpacing: "-0.03em" }}>Stock on Hand</h1>
          <p className="text-[#8A8B8C] font-body text-sm mt-1">
            {stats?.totalProducts || 0} products
            {isAdmin && stats?.totalRetailValue ? ` \u00B7 R ${stats.totalRetailValue.toLocaleString("en-ZA", { minimumFractionDigits: 2 })} retail value` : ""}
          </p>
        </div>
        {isAdmin && (
          <div className="flex gap-3">
            <button onClick={() => setShowUpload(true)} className="btn-secondary"><Upload className="w-4 h-4" /> Upload Stock</button>
            <button onClick={() => { setShowForm(true); resetForm(); setEditingId(null); }} className="btn-primary"><Plus className="w-4 h-4" /> Add Product</button>
          </div>
        )}
      </div>

      <div className={`grid grid-cols-2 ${isAdmin ? "sm:grid-cols-4" : "sm:grid-cols-3"} gap-4`}>
        <div className="card-surface p-4"><div className="label-text mb-1">TOTAL PRODUCTS</div><div className="stat-number">{stats?.totalProducts || 0}</div></div>
        {isAdmin && <div className="card-surface p-4"><div className="label-text mb-1">RETAIL VALUE</div><div className="stat-number" style={{ fontSize: "1.3rem" }}>R {(stats?.totalRetailValue || 0).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</div></div>}
        <div className="card-surface p-4"><div className="label-text mb-1">LOW STOCK</div><div className="stat-number" style={{ color: "#F59E0B" }}>{stats?.lowStock || 0}</div></div>
        <div className="card-surface p-4"><div className="label-text mb-1">OUT OF STOCK</div><div className="stat-number" style={{ color: "#EF4444" }}>{stats?.outOfStock || 0}</div></div>
      </div>

      <div className="card-surface p-4 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8B8C]" /><input type="text" placeholder="Search products..." value={search} onChange={(e) => setSearch(e.target.value)} className="input-field pl-10 w-full" /></div>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="input-field sm:w-48"><option value="">All Categories</option>{(categories || []).map((c) => <option key={c} value={c}>{c}</option>)}</select>
      </div>

      <div className="card-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ backgroundColor: "#131415", borderBottom: "1px solid #222324" }}>
                <th className="text-left p-3 label-text">Product</th>
                <th className="text-left p-3 label-text">Details</th>
                <th className="text-left p-3 label-text">SOH</th>
                <th className="text-right p-3 label-text">Corp</th>
                <th className="text-right p-3 label-text">Bulk</th>
                <th className="text-right p-3 label-text">Wholesale</th>
                {isAdmin && <th className="text-right p-3 label-text">Retail</th>}
                <th className="text-left p-3 label-text">Status</th>
                {isAdmin && <th className="text-right p-3 label-text">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id} className="transition-colors hover:bg-[#131415]" style={{
                  borderLeft: item.status === "low_stock" ? "3px solid #F59E0B" : item.status === "out_of_stock" ? "3px solid #EF4444" : "3px solid transparent",
                }}>
                  <td className="p-3">
                    <div className="text-sm text-white font-body font-medium">{item.productName}</div>
                    <div className="font-mono-data text-xs text-[#D4A843]">{item.productCode}</div>
                  </td>
                  <td className="p-3 text-xs text-[#8A8B8C] font-body">
                    {item.species} &middot; {item.size} &middot; {item.grade} &middot; {item.color}<br />
                    {item.strands} &middot; {item.origin}
                  </td>
                  <td className="p-3 text-white font-display font-semibold">{item.quantity}</td>
                  <td className="p-3 text-right text-sm text-[#E8E8E9] font-display">R {Number(item.corporatePrice).toFixed(2)}</td>
                  <td className="p-3 text-right text-sm text-[#E8E8E9] font-display">R {Number(item.bulkPrice).toFixed(2)}</td>
                  <td className="p-3 text-right text-sm font-display" style={{ color: "#D4A843" }}>R {Number(item.wholesalePrice).toFixed(2)}</td>
                  {isAdmin && <td className="p-3 text-right text-sm text-[#E8E8E9] font-display">R {Number(item.retailPrice).toFixed(2)}</td>}
                  <td className="p-3">
                    <span className="status-badge" style={{
                      backgroundColor: item.status === "in_stock" ? "rgba(74, 222, 128, 0.12)" : item.status === "low_stock" ? "rgba(245, 158, 11, 0.12)" : "rgba(239, 68, 68, 0.12)",
                      color: item.status === "in_stock" ? "#4ADE80" : item.status === "low_stock" ? "#F59E0B" : "#EF4444",
                    }}>
                      {item.status === "in_stock" ? <><CheckCircle className="w-3 h-3" /> IN</> : item.status === "low_stock" ? <><AlertTriangle className="w-3 h-3" /> LOW</> : <><X className="w-3 h-3" /> OUT</>}
                    </span>
                  </td>
                  {isAdmin && (
                    <td className="p-3 text-right">
                      <button onClick={() => handleEdit(item)} className="p-1.5 hover:text-[#D4A843] transition-colors cursor-pointer"><Pencil className="w-4 h-4 text-[#8A8B8C]" /></button>
                      <button onClick={() => { if (confirm("Delete?")) deleteStock.mutate({ id: item.id }); }} className="p-1.5 hover:text-[#EF4444] transition-colors cursor-pointer ml-1"><Trash2 className="w-4 h-4 text-[#8A8B8C]" /></button>
                    </td>
                  )}
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={isAdmin ? 9 : 7} className="p-8 text-center text-[#8A8B8C] font-body"><Package className="w-12 h-12 mx-auto mb-3 opacity-30" />No products found</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Upload Dialog */}
      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.7)" }}>
          <div className="card-surface p-8 max-w-md w-full mx-4" style={{ borderRadius: 16 }}>
            <div className="flex items-center justify-between mb-6"><h2 className="font-display font-semibold text-white text-xl">Upload Stock CSV</h2><button onClick={() => { setShowUpload(false); setUploadStatus(""); }} className="cursor-pointer"><X className="w-5 h-5 text-[#8A8B8C]" /></button></div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.csv,.txt"
              onChange={handleFileUpload}
              style={{ display: "none" }}
            />
            <div
              className="border-2 border-dashed rounded-xl p-8 text-center mb-4 cursor-pointer"
              style={{ borderColor: "#D4A843", backgroundColor: "rgba(212, 168, 67, 0.05)" }}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-12 h-12 mx-auto mb-4" style={{ color: "#D4A843" }} />
              <p className="text-[#E8E8E9] font-body text-sm mb-2">Tap here to browse for Excel file</p>
              <p className="text-[#8A8B8C] text-xs font-body">Supports: Excel (.xlsx) and CSV files</p>
            </div>
            <div className="text-xs text-[#8A8B8C] font-body space-y-1 mb-4">
              <p>Expected columns: Product, Strands, Size, Grade, Color, Species, SOH, Corporate Price, Bulk Price, Wholesale Price, Retail Price</p>
              <p>Upload your Supreme Global Foods Excel stock sheet - we auto-detect everything.</p>
            </div>
            {uploadStatus && (
              <div className={`p-3 rounded-lg text-sm font-body ${uploadStatus.includes("Success") ? "text-[#4ADE80]" : uploadStatus.includes("Error") || uploadStatus.includes("failed") ? "text-[#EF4444]" : "text-[#D4A843]"}`} style={{ backgroundColor: uploadStatus.includes("Success") ? "rgba(74,222,128,0.08)" : uploadStatus.includes("Error") || uploadStatus.includes("failed") ? "rgba(239,68,68,0.08)" : "rgba(212,168,67,0.08)" }}>
                {uploadStatus}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Form Dialog */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.7)" }}>
          <div className="card-surface p-8 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto" style={{ borderRadius: 16 }}>
            <div className="flex items-center justify-between mb-6"><h2 className="font-display font-semibold text-white text-xl">{editingId ? "Edit" : "Add"} Product</h2><button onClick={() => setShowForm(false)} className="cursor-pointer"><X className="w-5 h-5 text-[#8A8B8C]" /></button></div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label-text block mb-1.5">Product Code *</label><input type="text" value={formData.productCode} onChange={(e) => setFormData({ ...formData, productCode: e.target.value })} className="input-field" required /></div>
                <div><label className="label-text block mb-1.5">Product Name *</label><input type="text" value={formData.productName} onChange={(e) => setFormData({ ...formData, productName: e.target.value })} className="input-field" required /></div>
              </div>
              <div className="grid grid-cols-4 gap-3">
                <div><label className="label-text block mb-1.5">Category *</label><input type="text" value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} className="input-field" required placeholder="HOG - LONG" /></div>
                <div><label className="label-text block mb-1.5">Species</label><input type="text" value={formData.species} onChange={(e) => setFormData({ ...formData, species: e.target.value })} className="input-field" placeholder="HOG / SHEEP" /></div>
                <div><label className="label-text block mb-1.5">Size</label><input type="text" value={formData.size} onChange={(e) => setFormData({ ...formData, size: e.target.value })} className="input-field" placeholder="26/28" /></div>
                <div><label className="label-text block mb-1.5">Grade</label><input type="text" value={formData.grade} onChange={(e) => setFormData({ ...formData, grade: e.target.value })} className="input-field" placeholder="A / AB" /></div>
              </div>
              <div className="grid grid-cols-4 gap-3">
                <div><label className="label-text block mb-1.5">Color</label><input type="text" value={formData.color} onChange={(e) => setFormData({ ...formData, color: e.target.value })} className="input-field" placeholder="Brown" /></div>
                <div><label className="label-text block mb-1.5">Strands</label><input type="text" value={formData.strands} onChange={(e) => setFormData({ ...formData, strands: e.target.value })} className="input-field" placeholder="3/13/90" /></div>
                <div><label className="label-text block mb-1.5">Origin</label><input type="text" value={formData.origin} onChange={(e) => setFormData({ ...formData, origin: e.target.value })} className="input-field" placeholder="Local / Import" /></div>
                <div><label className="label-text block mb-1.5">Qty *</label><input type="number" value={formData.quantity} onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })} className="input-field" required min={0} /></div>
              </div>
              <div className="grid grid-cols-4 gap-3">
                <div><label className="label-text block mb-1.5">Corporate (R) *</label><input type="number" step="0.01" value={formData.corporatePrice} onChange={(e) => setFormData({ ...formData, corporatePrice: parseFloat(e.target.value) || 0 })} className="input-field" required min={0} /></div>
                <div><label className="label-text block mb-1.5">Bulk (R) *</label><input type="number" step="0.01" value={formData.bulkPrice} onChange={(e) => setFormData({ ...formData, bulkPrice: parseFloat(e.target.value) || 0 })} className="input-field" required min={0} /></div>
                <div><label className="label-text block mb-1.5">Wholesale (R) *</label><input type="number" step="0.01" value={formData.wholesalePrice} onChange={(e) => setFormData({ ...formData, wholesalePrice: parseFloat(e.target.value) || 0 })} className="input-field" required min={0} /></div>
                <div><label className="label-text block mb-1.5">Retail (R) *</label><input type="number" step="0.01" value={formData.retailPrice} onChange={(e) => setFormData({ ...formData, retailPrice: parseFloat(e.target.value) || 0 })} className="input-field" required min={0} /></div>
              </div>
              <div><label className="label-text block mb-1.5">Description</label><textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="input-field" rows={2} /></div>
              <button type="submit" className="btn-primary w-full justify-center">{editingId ? "Update" : "Add"} Product</button>
            </form>
          </div>
        </div>
      )}

      {/* ═══════ DAILY INVOICED STOCK REPORT (Admin/Super Admin Only) ═══════ */}
      {isAdmin && (
        <div className="card-surface overflow-hidden mt-6">
          <div className="p-4" style={{ borderBottom: "1px solid #222324" }}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(212,168,67,0.12)" }}>
                  <FileText className="w-5 h-5 text-[#D4A843]" />
                </div>
                <div>
                  <h2 className="font-display font-semibold text-white text-lg">Daily Invoiced Stock Report</h2>
                  <p className="text-[#8A8B8C] font-body text-xs">Track what stock was invoiced and by whom</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#8A8B8C]" />
                  <input type="date" value={reportFrom} onChange={(e) => setReportFrom(e.target.value)} className="input-field text-xs py-1.5" />
                  <span className="text-[#8A8B8C] text-xs">to</span>
                  <input type="date" value={reportTo} onChange={(e) => setReportTo(e.target.value)} className="input-field text-xs py-1.5" />
                </div>
                <button onClick={() => setShowReport(true)} className="btn-primary text-xs"><FileText className="w-3.5 h-3.5" /> Generate</button>
                {showReport && dailyReport && dailyReport.items && dailyReport.items.length > 0 && (
                  <button onClick={printReport} className="btn-secondary text-xs"><Printer className="w-3.5 h-3.5" /> Print / PDF</button>
                )}
              </div>
            </div>
          </div>

          {showReport && dailyReport && (
            <>
              {/* Summary bar */}
              <div className="grid grid-cols-3 gap-4 p-4" style={{ borderBottom: "1px solid #222324", backgroundColor: "#131415" }}>
                <div>
                  <div className="label-text mb-1">Period</div>
                  <div className="text-sm text-white font-body">{dailyReport.from === dailyReport.to ? dailyReport.from : `${dailyReport.from} to ${dailyReport.to}`}</div>
                </div>
                <div>
                  <div className="label-text mb-1">Total Lines</div>
                  <div className="stat-number">{dailyReport.totalLines}</div>
                </div>
                <div>
                  <div className="label-text mb-1">Total Value</div>
                  <div className="stat-number" style={{ color: "#D4A843" }}>R {Number(dailyReport.totalValue || 0).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</div>
                </div>
              </div>

              {/* Report table */}
              {dailyReport.items && dailyReport.items.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr style={{ backgroundColor: "#131415", borderBottom: "1px solid #222324" }}>
                        <th className="text-left p-3 label-text">Invoice #</th>
                        <th className="text-left p-3 label-text">Date</th>
                        <th className="text-left p-3 label-text">Product</th>
                        <th className="text-right p-3 label-text">Qty</th>
                        <th className="text-right p-3 label-text">Price Charged</th>
                        <th className="text-center p-3 label-text">Special</th>
                        <th className="text-left p-3 label-text">Tier</th>
                        <th className="text-left p-3 label-text">Sales Rep</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dailyReport.items.map((item: any, idx: number) => (
                        <tr key={idx} className="transition-colors hover:bg-[#131415]" style={{ borderBottom: "1px solid #18191A" }}>
                          <td className="p-3 font-display font-semibold text-sm text-[#D4A843]">{item.invoiceNumber}</td>
                          <td className="p-3 text-xs text-[#8A8B8C]">{new Date(item.invoiceDate).toLocaleDateString("en-ZA")}</td>
                          <td className="p-3">
                            <div className="text-sm text-white font-body">{item.productName}</div>
                            {item.productCode && <div className="text-xs text-[#8A8B8C] font-mono-data">{item.productCode}</div>}
                          </td>
                          <td className="p-3 text-right text-sm text-white font-display">{item.quantity}</td>
                          <td className="p-3 text-right">
                            <div className="text-sm text-white font-display">R {Number(item.unitPrice).toFixed(2)}</div>
                            <div className="text-xs text-[#8A8B8C]">R {Number(item.lineTotal).toFixed(2)} total</div>
                          </td>
                          <td className="p-3 text-center">
                            {item.isSpecialPrice ? (
                              <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ backgroundColor: "rgba(212,168,67,0.15)", color: "#D4A843" }}>
                                <Tag className="w-3 h-3 inline mr-1" />YES
                              </span>
                            ) : (
                              <span className="text-xs text-[#8A8B8C]">-</span>
                            )}
                          </td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium capitalize" style={{ backgroundColor: "rgba(59,130,246,0.12)", color: "#3B82F6" }}>
                              {item.priceTier}
                            </span>
                          </td>
                          <td className="p-3 text-sm text-[#E8E8E9] font-body">{item.salesRep || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : showReport && (
                <div className="p-8 text-center text-[#8A8B8C] font-body">
                  <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  No invoiced stock found for the selected period.
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Stock Reconciliation */}
      <div className="card-surface">
        <button onClick={() => setShowReconcile(!showReconcile)} className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-5 h-5" style={{ color: "#D4A843" }} />
          <h2 className="text-lg font-display font-semibold text-white">Stock Reconciliation</h2>
          <span className="text-xs text-[#8A8B8C] ml-2">(Stock vs Orders)</span>
        </button>
        {showReconcile && (
          <>
            <div className="flex gap-3 mb-4 flex-wrap">
              <input type="date" value={reconcileFrom} onChange={(e) => setReconcileFrom(e.target.value)} className="input-field text-sm py-2" />
              <input type="date" value={reconcileTo} onChange={(e) => setReconcileTo(e.target.value)} className="input-field text-sm py-2" />
              <button onClick={() => reconcileQuery.refetch()} className="btn-primary text-sm">Generate Report</button>
            </div>
            {reconcileQuery.data && (
              <>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="p-3 rounded-lg text-center" style={{ backgroundColor: "#0A0A0B" }}>
                    <div className="text-xs text-[#8A8B8C]">Products</div>
                    <div className="text-lg font-bold text-white">{(reconcileQuery.data as any).totalProducts}</div>
                  </div>
                  <div className="p-3 rounded-lg text-center" style={{ backgroundColor: "#0A0A0B" }}>
                    <div className="text-xs text-[#8A8B8C]">Current Stock</div>
                    <div className="text-lg font-bold text-[#D4A843]">{(reconcileQuery.data as any).totalCurrentStock}</div>
                  </div>
                  <div className="p-3 rounded-lg text-center" style={{ backgroundColor: "#0A0A0B" }}>
                    <div className="text-xs text-[#8A8B8C]">Total Ordered</div>
                    <div className="text-lg font-bold text-[#EF4444]">{(reconcileQuery.data as any).totalOrdered}</div>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ backgroundColor: "#131415" }}>
                        <th className="text-left p-3 label-text">Product</th>
                        <th className="text-right p-3 label-text">Starting SOH</th>
                        <th className="text-right p-3 label-text">Ordered</th>
                        <th className="text-right p-3 label-text">Current SOH</th>
                        <th className="text-center p-3 label-text">Status</th>
                        <th className="text-left p-3 label-text">Orders</th>
                      </tr>
                    </thead>
                    <tbody>
                      {((reconcileQuery.data as any).items || []).map((item: any, idx: number) => (
                        <tr key={idx} style={{ borderBottom: "1px solid #18191A" }}>
                          <td className="p-3 text-white">{item.productName} <span className="text-[#8A8B8C] text-xs">({item.productCode})</span></td>
                          <td className="p-3 text-right text-white font-mono-data">{item.startingStock}</td>
                          <td className="p-3 text-right font-semibold" style={{ color: "#EF4444" }}>{item.totalOrdered}</td>
                          <td className="p-3 text-right font-semibold" style={{ color: "#D4A843" }}>{item.currentStock}</td>
                          <td className="p-3 text-center">
                            <span className="px-2 py-0.5 rounded-full text-xs capitalize" style={{
                              backgroundColor: item.status === "out_of_stock" ? "rgba(239,68,68,0.12)" : item.status === "low_stock" ? "rgba(245,158,11,0.12)" : "rgba(74,222,128,0.12)",
                              color: item.status === "out_of_stock" ? "#EF4444" : item.status === "low_stock" ? "#F59E0B" : "#4ADE80"
                            }}>{item.status}</span>
                          </td>
                          <td className="p-3 text-xs text-[#8A8B8C]">
                            {item.orderDetails.slice(0, 3).map((o: any, i: number) => (
                              <div key={i}>{o.orderNumber}: {o.quantity} ({o.customer})</div>
                            ))}
                            {item.orderDetails.length > 3 && <div className="text-[#D4A843]">+{item.orderDetails.length - 3} more</div>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
