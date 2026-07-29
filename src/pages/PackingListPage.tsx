import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { reloadFromStorage } from "@/lib/dataService";
import { getCompanyConfig, type CompanyKey } from "@/lib/companyConfig";
import { useParams, useNavigate } from "react-router";
import {
  ArrowLeft, Plus, Trash2, X, Pencil, Printer, Package, ClipboardCheck,
  AlertCircle, CheckCircle2,
} from "lucide-react";

export default function PackingListPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const poId = parseInt(id || "0");
  const utils = trpc.useUtils();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [lotError, setLotError] = useState("");

  // Form state for factory entry
  const [form, setForm] = useState({
    poLineIndex: -1,
    customerStockCode: "",
    productDescription: "",
    productSize: "",
    linkedStockItemId: null as number | null,
    barrelNumber: "",
    totalBarrels: "",
    quantityBundles: 0,
    grossWeight: 0,
    netWeight: 0,
    lotSealNumber: "",
  });

  const { data: purchaseOrders } = trpc.purchaseOrder.list.useQuery();
  const { data: packingListLines } = trpc.packingList.listByPurchaseOrder.useQuery(poId, { enabled: !!poId });
  const { data: stockItems } = trpc.stock.search.useQuery({ query: " " });

  const createLine = trpc.packingList.create.useMutation({
    onSuccess: async () => { reloadFromStorage(); await utils.packingList.listByPurchaseOrder.invalidate(poId); closeForm(); },
  });
  const updateLine = trpc.packingList.update.useMutation({
    onSuccess: async () => { reloadFromStorage(); await utils.packingList.listByPurchaseOrder.invalidate(poId); closeForm(); },
  });
  const deleteLine = trpc.packingList.delete.useMutation({
    onSuccess: async () => { reloadFromStorage(); await utils.packingList.listByPurchaseOrder.invalidate(poId); },
  });

  const po = (purchaseOrders || []).find((p: any) => p.id === poId);

  if (!po) {
    return (
      <div className="p-6 text-center">
        <AlertCircle className="w-12 h-12 mx-auto mb-3 text-[#EF4444] opacity-40" />
        <p className="text-white">Purchase order not found</p>
        <button onClick={() => navigate("/purchase-orders")} className="btn-gold mt-4">Back</button>
      </div>
    );
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setLotError("");
    setForm({ poLineIndex: -1, customerStockCode: "", productDescription: "", productSize: "", linkedStockItemId: null, barrelNumber: "", totalBarrels: "", quantityBundles: 0, grossWeight: 0, netWeight: 0, lotSealNumber: "" });
  }

  function selectPOLine(index: number) {
    const line = (po.lineItems || [])[index];
    if (!line) return;
    // Try to get product size from linked stock
    let size = "";
    if (line.linkedStockItemId && stockItems) {
      const stock = (stockItems as any[]).find((s: any) => s.id === line.linkedStockItemId);
      if (stock?.size || stock?.dimensions) size = stock.size || stock.dimensions;
      if (stock?.category) size = size ? `${size} | ${stock.category}` : stock.category;
    }
    setForm(prev => ({
      ...prev,
      poLineIndex: index,
      customerStockCode: line.customerStockCode || "",
      productDescription: line.linkedProductName || line.customerDescription || "",
      productSize: size,
      linkedStockItemId: line.linkedStockItemId || null,
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLotError("");
    // Validate lot number is exactly 10 digits if provided
    if (form.lotSealNumber && form.lotSealNumber.length > 0 && !/^\d{10}$/.test(form.lotSealNumber)) {
      setLotError("Lot/Seal number must be exactly 10 digits");
      return;
    }
    if (!form.customerStockCode.trim() || !form.barrelNumber.trim()) return;
    const payload = {
      ...form,
      purchaseOrderId: poId,
      poNumber: po.poNumber,
      quantityBundles: Number(form.quantityBundles) || 0,
      grossWeight: Number(form.grossWeight) || 0,
      netWeight: Number(form.netWeight) || 0,
      linkedStockItemId: form.linkedStockItemId,
    };
    if (editingId) {
      updateLine.mutate({ id: editingId, data: payload });
    } else {
      createLine.mutate(payload);
    }
  }

  function handleEdit(line: any) {
    setForm({
      poLineIndex: line.poLineIndex ?? -1,
      customerStockCode: line.customerStockCode || "",
      productDescription: line.productDescription || "",
      productSize: line.productSize || "",
      barrelNumber: line.barrelNumber || "",
      totalBarrels: line.totalBarrels || "",
      quantityBundles: line.quantityBundles || 0,
      grossWeight: line.grossWeight || 0,
      netWeight: line.netWeight || 0,
      lotSealNumber: line.lotSealNumber || line.lotNumber || line.sealNumber || "",
      linkedStockItemId: line.linkedStockItemId || null,
    });
    setEditingId(line.id);
    setShowForm(true);
  }

  function handlePrint() {
    const cfg = getCompanyConfig(po.company);
    const lines = packingListLines || [];
    const totalBundles = lines.reduce((s: number, l: any) => s + (l.quantityBundles || 0), 0);
    const totalGross = lines.reduce((s: number, l: any) => s + (l.grossWeight || 0), 0);
    const totalNet = lines.reduce((s: number, l: any) => s + (l.netWeight || 0), 0);

    const w = window.open("", "_blank");
    if (!w) return;

    const lineRows = lines.map((l: any, idx: number) => `
      <tr>
        <td style="padding:6px;border:1px solid #333;text-align:center;font-size:10px;">${idx + 1}</td>
        <td style="padding:6px;border:1px solid #333;font-family:monospace;font-size:10px;">${l.customerStockCode || "-"}</td>
        <td style="padding:6px;border:1px solid #333;font-size:10px;">${l.productDescription || "-"}</td>
        <td style="padding:6px;border:1px solid #333;font-size:10px;text-align:center;">${l.productSize || "-"}</td>
        <td style="padding:6px;border:1px solid #333;font-size:10px;text-align:center;font-weight:bold;">${l.quantityBundles || 0}</td>
        <td style="padding:6px;border:1px solid #333;font-size:10px;text-align:center;">${l.grossWeight || "-"}</td>
        <td style="padding:6px;border:1px solid #333;font-size:10px;text-align:center;">${l.netWeight || "-"}</td>
        <td style="padding:6px;border:1px solid #333;font-family:monospace;font-size:10px;text-align:center;">${l.lotSealNumber || l.lotNumber || l.sealNumber || "-"}</td>
        <td style="padding:6px;border:1px solid #333;font-size:10px;text-align:center;font-weight:bold;">${l.barrelNumber || "-"}</td>
      </tr>
    `).join("");

    const poDate = po.orderDate ? new Date(po.orderDate).toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" }) : new Date().toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" });

    w.document.write(`
      <html><head><title>Packing List - ${po.poNumber}</title></head>
      <body style="font-family:Arial,sans-serif;padding:30px;background:#fff;color:#000;">
        <div style="text-align:center;margin-bottom:5px;">
          <h1 style="font-size:18px;margin-bottom:3px;color:${cfg.documentColor};">${cfg.legalName}</h1>
          <p style="font-size:9px;color:#666;">${cfg.address.street}, ${cfg.address.city}, ${cfg.address.province}, ${cfg.address.country}</p>
        </div>
        <div style="border:2px solid #000;padding:15px;margin-bottom:15px;">
          <h2 style="font-size:16px;font-weight:bold;margin:0 0 10px 0;text-decoration:underline;">PACKING LIST:</h2>
          <table style="width:100%;font-size:11px;border-collapse:collapse;">
            <tr>
              <td style="padding:3px 0;font-weight:bold;width:35%;">Supplier Name:</td>
              <td style="padding:3px 0;">${cfg.name}</td>
            </tr>
            <tr>
              <td style="padding:3px 0;font-weight:bold;">Customer Receiving:</td>
              <td style="padding:3px 0;">${po.corporateCustomerName || "-"}</td>
            </tr>
            <tr>
              <td style="padding:3px 0;font-weight:bold;">Order Number:</td>
              <td style="padding:3px 0;font-family:monospace;">${po.poNumber}</td>
            </tr>
            <tr>
              <td style="padding:3px 0;font-weight:bold;">Date:</td>
              <td style="padding:3px 0;">${poDate}</td>
            </tr>
            <tr>
              <td style="padding:3px 0;font-weight:bold;">Product Information:</td>
              <td style="padding:3px 0;">${lines.length} Barrels (${totalBundles} Bundles)</td>
            </tr>
          </table>
        </div>
        <table style="width:100%;border-collapse:collapse;">
          <thead><tr style="background:${cfg.documentColor};color:#fff;font-size:10px;">
            <th style="padding:6px;border:1px solid #333;">#</th>
            <th style="padding:6px;border:1px solid #333;">Cust. Stock Code</th>
            <th style="padding:6px;border:1px solid #333;">Product Description</th>
            <th style="padding:6px;border:1px solid #333;">Size</th>
            <th style="padding:6px;border:1px solid #333;">Qty (BND)</th>
            <th style="padding:6px;border:1px solid #333;">Gross Wt (kg)</th>
            <th style="padding:6px;border:1px solid #333;">Net Wt (kg)</th>
            <th style="padding:6px;border:1px solid #333;">Lot / Seal #</th>
            <th style="padding:6px;border:1px solid #333;">Barrel #</th>
          </tr></thead>
          <tbody>${lineRows}</tbody>
          <tfoot><tr style="background:#f0f0f0;font-weight:bold;font-size:10px;">
            <td style="padding:6px;border:1px solid #333;text-align:right;" colspan="4">TOTALS</td>
            <td style="padding:6px;border:1px solid #333;text-align:center;">${totalBundles}</td>
            <td style="padding:6px;border:1px solid #333;text-align:center;">${totalGross.toFixed(2)}</td>
            <td style="padding:6px;border:1px solid #333;text-align:center;">${totalNet.toFixed(2)}</td>
            <td style="padding:6px;border:1px solid #333;" colspan="3"></td>
          </tr></tfoot>
        </table>
        <div style="margin-top:20px;padding:12px;border:2px solid ${cfg.documentColor};border-radius:4px;">
          <h3 style="font-size:11px;margin-bottom:8px;color:${cfg.documentColor};">CUSTOMER SIGN-OFF</h3>
          <p style="font-size:10px;color:#555;margin-bottom:10px;">I confirm that the above goods were received in good order and condition. The quantities and barrel counts have been verified.</p>
          <table style="width:100%;font-size:10px;border-collapse:collapse;">
            <tr>
              <td style="width:33%;padding:6px;vertical-align:top;"><div style="color:#888;margin-bottom:4px;">Received By (Name &amp; Signature)</div><div style="border-bottom:1px solid #333;height:28px;"></div></td>
              <td style="width:33%;padding:6px;vertical-align:top;"><div style="color:#888;margin-bottom:4px;">Date &amp; Time</div><div style="border-bottom:1px solid #333;height:28px;"></div></td>
              <td style="width:33%;padding:6px;vertical-align:top;"><div style="color:#888;margin-bottom:4px;">Company Stamp</div><div style="border-bottom:1px solid #333;height:28px;"></div></td>
            </tr>
          </table>
        </div>
        <div style="margin-top:15px;padding:12px;border:1.5px dashed #ccc;border-radius:4px;">
          <h3 style="font-size:11px;margin-bottom:8px;color:#666;">OFFICE COPY - KEEP FOR RECORDS</h3>
          <table style="width:100%;font-size:10px;border-collapse:collapse;">
            <tr>
              <td style="width:50%;padding:6px;vertical-align:top;"><div style="color:#888;margin-bottom:4px;">Packed By (Signature)</div><div style="border-bottom:1px solid #333;height:28px;"></div></td>
              <td style="width:50%;padding:6px;vertical-align:top;"><div style="color:#888;margin-bottom:4px;">Checked By (Signature)</div><div style="border-bottom:1px solid #333;height:28px;"></div></td>
            </tr>
          </table>
        </div>
        <div style="text-align:center;margin-top:12px;font-size:9px;color:#999;border-top:1px solid #ccc;padding-top:6px;">
          <strong>${cfg.legalName}</strong> | Packing List for PO ${po.poNumber} | ${lines.length} Barrel(s) | ${totalBundles} Bundle(s)
        </div>
        <script>(function(){var d=false;function p(){if(!d){d=true;setTimeout(function(){window.print();},300);}}if(document.readyState==='complete')p();else window.onload=p;setTimeout(p,2000);})();</script>
      </body></html>
    `);
    w.document.close();
    w.focus();
  }

  const poLines = po.lineItems || [];
  const lines = packingListLines || [];
  const totalBundles = lines.reduce((s: number, l: any) => s + (l.quantityBundles || 0), 0);
  const cfg = getCompanyConfig(po.company);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={() => navigate(`/purchase-order/${poId}`)} className="p-2 rounded-lg hover:bg-[#222324]"><ArrowLeft className="w-5 h-5 text-[#8A8B8C]" /></button>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-semibold text-white flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5" style={{ color: cfg.documentColor }} />
              Packing List
            </h1>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: cfg.documentColor + "22", color: cfg.documentColor }}>{cfg.shortName}</span>
          </div>
          <p className="text-sm text-[#8A8B8C]">PO: {po.poNumber} | Factory barrel packing entry</p>
        </div>
        <div className="flex items-center gap-2">
          {lines.length > 0 && (
            <button onClick={handlePrint} className="btn-gold flex items-center gap-2 text-sm">
              <Printer className="w-4 h-4" /> Print &amp; Sign
            </button>
          )}
          <button onClick={() => { closeForm(); setShowForm(true); }} className="btn-secondary flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" /> Add Barrel Line
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card-glass text-center">
          <div className="text-xs text-[#8A8B8C]">Barrels Packed</div>
          <div className="text-lg font-semibold text-white">{lines.length}</div>
        </div>
        <div className="card-glass text-center">
          <div className="text-xs text-[#8A8B8C]">Total Bundles</div>
          <div className="text-lg font-semibold text-white">{totalBundles}</div>
        </div>
        <div className="card-glass text-center">
          <div className="text-xs text-[#8A8B8C]">PO Lines</div>
          <div className="text-lg font-semibold text-white">{poLines.length}</div>
        </div>
        <div className="card-glass text-center">
          <div className="text-xs text-[#8A8B8C]">Status</div>
          <div className="text-lg font-semibold" style={{ color: lines.length > 0 ? "#4ADE80" : "#F59E0B" }}>{lines.length > 0 ? "In Progress" : "Not Started"}</div>
        </div>
      </div>

      {/* Packing List Table */}
      <div className="card-glass overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-[#8A8B8C] border-b border-[#222324]" style={{ backgroundColor: "#131415" }}>
                <th className="p-3 font-medium">#</th>
                <th className="p-3 font-medium">Cust. Stock Code</th>
                <th className="p-3 font-medium">Product Description</th>
                <th className="p-3 font-medium text-center">Size</th>
                <th className="p-3 font-medium text-center">Qty (BND)</th>
                <th className="p-3 font-medium text-center">Gross Wt</th>
                <th className="p-3 font-medium text-center">Net Wt</th>
                <th className="p-3 font-medium text-center">Lot / Seal #</th>
                <th className="p-3 font-medium text-center">Barrel #</th>
                <th className="p-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {lines.length === 0 && (
                <tr>
                  <td colSpan={11} className="p-8 text-center text-[#8A8B8C]">
                    <Package className="w-10 h-10 mx-auto mb-2 opacity-20" />
                    <p>No packing lines yet. Click &quot;Add Barrel Line&quot; to start.</p>
                  </td>
                </tr>
              )}
              {lines.map((line: any, idx: number) => (
                <tr key={line.id} className="border-b border-[#222324] last:border-0 hover:bg-[#131415]">
                  <td className="p-3 text-[#8A8B8C]">{idx + 1}</td>
                  <td className="p-3 font-mono text-xs text-white">{line.customerStockCode}</td>
                  <td className="p-3 text-white">{line.productDescription}</td>
                  <td className="p-3 text-[#8A8B8C] text-center text-xs">{line.productSize || "-"}</td>
                  <td className="p-3 text-white text-center font-medium">{line.quantityBundles}</td>
                  <td className="p-3 text-[#8A8B8C] text-center">{line.grossWeight || "-"} kg</td>
                  <td className="p-3 text-[#8A8B8C] text-center">{line.netWeight || "-"} kg</td>
                  <td className="p-3 font-mono text-xs text-center" style={{ color: "#D4A843" }}>{line.lotSealNumber || line.lotNumber || line.sealNumber || "-"}</td>
                  <td className="p-3 text-white text-center font-medium">{line.barrelNumber}</td>
                  <td className="p-3 text-right">
                    <button onClick={() => handleEdit(line)} className="p-1.5 rounded hover:bg-[#222324] mr-1" title="Edit"><Pencil className="w-3.5 h-3.5 text-[#D4A843]" /></button>
                    <button onClick={() => { if (confirm("Delete this line?")) deleteLine.mutate(line.id); }} className="p-1.5 rounded hover:bg-[#222324]" title="Delete"><Trash2 className="w-3.5 h-3.5 text-[#EF4444]" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.7)" }}>
          <div className="modal-content w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">{editingId ? "Edit" : "Add"} Barrel Packing Line</h2>
              <button onClick={closeForm} className="p-1 rounded hover:bg-[#222324]"><X className="w-5 h-5 text-[#8A8B8C]" /></button>
            </div>

            {/* Step 1: Select PO Line */}
            {!editingId && (
              <div className="mb-4 p-3 rounded-lg" style={{ backgroundColor: "#131415" }}>
                <label className="label-text text-xs">Step 1: Select PO Line Item (auto-fills product info)</label>
                <select
                  value={form.poLineIndex}
                  onChange={(e) => selectPOLine(parseInt(e.target.value))}
                  className="input-field w-full text-sm mt-1"
                >
                  <option value={-1}>Choose a purchase order line...</option>
                  {poLines.map((li: any, idx: number) => (
                    <option key={idx} value={idx}>
                      {li.customerStockCode} - {li.customerDescription} (Qty: {li.quantity} {li.uom})
                    </option>
                  ))}
                </select>
                {form.poLineIndex >= 0 && (
                  <div className="flex items-center gap-1 mt-2 text-xs" style={{ color: "#4ADE80" }}>
                    <CheckCircle2 className="w-3 h-3" /> Product info loaded from PO line
                  </div>
                )}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
              {/* Auto-filled from PO */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-text">Customer Stock Code</label>
                  <input value={form.customerStockCode} onChange={(e) => setForm({ ...form, customerStockCode: e.target.value })} className="input-field w-full text-sm" />
                </div>
                <div>
                  <label className="label-text">Product Size / Category</label>
                  <input value={form.productSize} onChange={(e) => setForm({ ...form, productSize: e.target.value })} className="input-field w-full text-sm" placeholder="e.g., 28/32mm | Hog Casings" />
                </div>
              </div>
              <div>
                <label className="label-text">Product Description</label>
                <input value={form.productDescription} onChange={(e) => setForm({ ...form, productDescription: e.target.value })} className="input-field w-full text-sm" />
              </div>

              {/* Factory inputs */}
              <div className="pt-3 border-t border-[#222324]">
                <h4 className="text-xs font-medium text-white mb-2" style={{ color: cfg.documentColor }}>Factory Entry Fields</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="label-text">Barrel # *</label>
                    <input required value={form.barrelNumber} onChange={(e) => setForm({ ...form, barrelNumber: e.target.value })} className="input-field w-full text-sm" placeholder="e.g., 1 of 5" />
                  </div>
                  <div>
                    <label className="label-text">Total Barrels</label>
                    <input value={form.totalBarrels} onChange={(e) => setForm({ ...form, totalBarrels: e.target.value })} className="input-field w-full text-sm" placeholder="e.g., 5" />
                  </div>
                  <div>
                    <label className="label-text">Qty Bundles *</label>
                    <input type="number" required value={form.quantityBundles || ""} onChange={(e) => setForm({ ...form, quantityBundles: parseInt(e.target.value) || 0 })} className="input-field w-full text-sm" placeholder="100-200" min={1} max={200} />
                  </div>
                  <div>
                    <label className="label-text">Gross Weight (kg)</label>
                    <input type="number" step="0.01" value={form.grossWeight || ""} onChange={(e) => setForm({ ...form, grossWeight: parseFloat(e.target.value) || 0 })} className="input-field w-full text-sm" placeholder="Barrel + product" />
                  </div>
                  <div>
                    <label className="label-text">Net Weight (kg)</label>
                    <input type="number" step="0.01" value={form.netWeight || ""} onChange={(e) => setForm({ ...form, netWeight: parseFloat(e.target.value) || 0 })} className="input-field w-full text-sm" placeholder="Product only" />
                  </div>
                  <div>
                    <label className="label-text">Lot # (10 digits)</label>
                    <input value={form.lotSealNumber} onChange={(e) => { setLotError(""); setForm({ ...form, lotSealNumber: e.target.value.replace(/\D/g, "").slice(0, 10) }); }} className={`input-field w-full text-sm font-mono ${lotError ? "border-red-500" : ""}`} placeholder="1234567890" maxLength={10} />
                    {lotError && <p className="text-xs text-[#EF4444] mt-1">{lotError}</p>}
                    {form.lotSealNumber.length > 0 && form.lotSealNumber.length < 10 && <p className="text-xs text-[#F59E0B] mt-1">{10 - form.lotSealNumber.length} more digits needed</p>}
                    {form.lotSealNumber.length === 10 && <p className="text-xs text-[#4ADE80] mt-1">Valid 10-digit lot/seal number</p>}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#222324]">
                <button type="button" onClick={closeForm} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-gold" disabled={!form.customerStockCode.trim() || !form.barrelNumber.trim()}>
                  {editingId ? "Update Line" : "Add Line"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
