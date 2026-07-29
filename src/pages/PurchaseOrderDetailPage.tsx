import { useState, useMemo } from "react";
import { trpc } from "@/providers/trpc";
import { reloadFromStorage } from "@/lib/dataService";
import { getCompanyConfig, type CompanyKey } from "@/lib/companyConfig";
import { useParams, useNavigate } from "react-router";
import {
  ArrowLeft, Package, Plus, Trash2, X, FileText, Printer, Building2,
  Calendar, Hash, FlaskConical, CheckCircle2, Clock, AlertCircle, ChevronDown,
  Link2,
} from "lucide-react";

const STATUS_FLOW = [
  { key: "received", label: "Received", color: "#4ADE80", bg: "#1A8C3F1A" },
  { key: "in_progress", label: "In Progress", color: "#818CF8", bg: "#6366F11A" },
  { key: "fulfilled", label: "Fulfilled", color: "#38BDF8", bg: "#0E74901A" },
];

export default function PurchaseOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const poId = parseInt(id || "0");
  const utils = trpc.useUtils();

  const [showBarrelForm, setShowBarrelForm] = useState(false);
  const [showPackingList, setShowPackingList] = useState(false);
  const [showCOCForm, setShowCOCForm] = useState(false);
  const [selectedBarrelId, setSelectedBarrelId] = useState<number | null>(null);

  // Barrel form state
  const [barrelForm, setBarrelForm] = useState({
    barrelNumber: "",
    poLineIndex: -1, // which PO line item this barrel fulfills
    productDescription: "",
    batchNumber: "",
    lotNumber: "",
    sealNumber: "",
    manufacturingDate: "",
    useByDate: "",
    quantityBundles: 0,
    recircleProductCode: "",
    customerProductCode: "",
    calibration: "Min 28/30 mm",
    length: "Minimum 90 to 91m/bundle",
    qtyStrands: "13 strands / bundle",
    stuffingCapacity: "44kg average / bundle",
    odour: "No off odours to be present",
    colour: "White / Beige color",
    packing: "Bundles packed in barrels of 150 or 200",
    countryOfOrigin: "South Africa",
    status: "Non HALAAL",
  });

  // Get PO line items with linked stock for barrel creation dropdown
  const poLineItems = po?.lineItems || [];
  const linkedStockItems = useMemo(() => {
    return poLineItems
      .filter((li: any) => li.linkedStockItemId)
      .map((li: any, idx: number) => ({
        index: idx,
        customerStockCode: li.customerStockCode,
        customerDescription: li.customerDescription,
        linkedStockItemId: li.linkedStockItemId,
        linkedProductName: li.linkedProductName,
        linkedProductCode: li.linkedProductCode,
        quantity: li.quantity,
      }));
  }, [poLineItems]);

  const { data: purchaseOrders } = trpc.purchaseOrder.list.useQuery();
  const { data: corporateCustomers } = trpc.corporateCustomer.list.useQuery();
  const { data: barrels } = trpc.barrel.listByPurchaseOrder.useQuery(poId, { enabled: !!poId });
  const { data: cocs } = trpc.coc.listByPurchaseOrder.useQuery(poId, { enabled: !!poId });

  const updateStatus = trpc.purchaseOrder.updateStatus.useMutation({
    onSuccess: async () => { reloadFromStorage(); await utils.purchaseOrder.list.invalidate(); },
  });
  const createBarrel = trpc.barrel.create.useMutation({
    onSuccess: async (data) => {
      reloadFromStorage();
      await utils.barrel.listByPurchaseOrder.invalidate(poId);
      setShowBarrelForm(false);
      resetBarrelForm();
      // If first barrel, auto-move to in_progress
      const po = (purchaseOrders || []).find((p: any) => p.id === poId);
      if (po && po.status === "received") {
        updateStatus.mutate({ id: poId, status: "in_progress" });
      }
    },
  });
  const deleteBarrel = trpc.barrel.delete.useMutation({
    onSuccess: async () => { reloadFromStorage(); await utils.barrel.listByPurchaseOrder.invalidate(poId); },
  });
  const createCOC = trpc.coc.create.useMutation({
    onSuccess: async () => { reloadFromStorage(); await utils.coc.listByPurchaseOrder.invalidate(poId); setShowCOCForm(false); },
  });
  const deleteCOC = trpc.coc.delete.useMutation({
    onSuccess: async () => { reloadFromStorage(); await utils.coc.listByPurchaseOrder.invalidate(poId); },
  });

  const po = (purchaseOrders || []).find((p: any) => p.id === poId);
  const customer = po ? (corporateCustomers || []).find((c: any) => c.id === po.corporateCustomerId) : null;

  if (!po) {
    return (
      <div className="p-6 text-center">
        <AlertCircle className="w-12 h-12 mx-auto mb-3 text-[#EF4444] opacity-40" />
        <p className="text-white">Purchase order not found</p>
        <button onClick={() => navigate("/purchase-orders")} className="btn-gold mt-4">Back to POs</button>
      </div>
    );
  }

  function resetBarrelForm() {
    setBarrelForm({
      barrelNumber: "", poLineIndex: -1, productDescription: "", batchNumber: "", lotNumber: "", sealNumber: "",
      manufacturingDate: "", useByDate: "", quantityBundles: 0,
      recircleProductCode: "", customerProductCode: "", calibration: "Min 28/30 mm",
      length: "Minimum 90 to 91m/bundle", qtyStrands: "13 strands / bundle",
      stuffingCapacity: "44kg average / bundle", odour: "No off odours to be present",
      colour: "White / Beige color", packing: "Bundles packed in barrels of 150 or 200",
      countryOfOrigin: "South Africa", status: "Non HALAAL",
    });
  }

  // When user selects a PO line, auto-populate barrel form with linked stock info
  function selectPOLine(index: number) {
    const line = poLineItems[index];
    if (!line) return;
    setBarrelForm(prev => ({
      ...prev,
      poLineIndex: index,
      productDescription: line.customerDescription || prev.productDescription,
      customerProductCode: line.customerStockCode || prev.customerProductCode,
      recircleProductCode: line.linkedProductCode || prev.recircleProductCode,
    }));
  }

  function handleCreateBarrel(e: React.FormEvent) {
    e.preventDefault();
    if (!barrelForm.barrelNumber.trim() || !barrelForm.batchNumber.trim()) return;
    createBarrel.mutate({
      ...barrelForm,
      poLineIndex: barrelForm.poLineIndex >= 0 ? barrelForm.poLineIndex : null,
      purchaseOrderId: poId,
      poNumber: po.poNumber,
      corporateCustomerId: po.corporateCustomerId,
      corporateCustomerName: customer?.name || "",
    });
  }

  function handleGenerateCOC(barrel: any) {
    createCOC.mutate({
      purchaseOrderId: poId,
      barrelId: barrel.id,
      poNumber: po.poNumber,
      corporateCustomerId: po.corporateCustomerId,
      corporateCustomerName: customer?.name || "",
      recircleProductCode: barrel.recircleProductCode || "",
      customerProductCode: barrel.customerProductCode || "",
      productDescription: barrel.productDescription || "",
      batchNumber: barrel.batchNumber || "",
      lotNumber: barrel.lotNumber || "",
      sealNumber: barrel.sealNumber || "",
      manufacturingDate: barrel.manufacturingDate || "",
      useByDate: barrel.useByDate || "",
      barrelNumber: barrel.barrelNumber || "",
      quantityBundles: barrel.quantityBundles || 0,
      calibration: barrel.calibration || "Min 28/30 mm",
      length: barrel.length || "Minimum 90 to 91m/bundle",
      qtyStrands: barrel.qtyStrands || "13 strands / bundle",
      stuffingCapacity: barrel.stuffingCapacity || "44kg average / bundle",
      odour: barrel.odour || "No off odours to be present",
      colour: barrel.colour || "White / Beige color",
      packing: barrel.packing || "Bundles packed in barrels of 150 or 200",
      countryOfOrigin: barrel.countryOfOrigin || "South Africa",
      status: barrel.status || "Non HALAAL",
      cleaningProcess: "Collect small intestines from Abattoir. Manure stripped by hand. Mucosa is removed, through a series of soaking and feeding through a combination of rollers. Final: Quality control, calibration and measuring processed. Product salted and stored in plastic drums ready for delivery.",
      handlingStorage: "Casings to be handled, transported, packed, selected and dispatched in conformance with Good Manufacturing Practice. Casing supplier to store casings in salt, and at ambient/cool temperature. End user to store casings under refrigerated conditions and use within 10-12 months (Opened/Unopened) of receiving it.",
    });
  }

  function handlePrintPackingList() {
    const poCompany: CompanyKey = po.company || "sgf";
    const cfg = getCompanyConfig(poCompany);
    setShowPackingList(true);
    setTimeout(() => {
      const printWindow = window.open("", "_blank");
      if (!printWindow) return;
      const barrelList = (barrels || []).map((b: any) => {
        const line = poLineItems[b.poLineIndex];
        return `
          <tr>
            <td style="padding:8px;border:1px solid #333;">${b.barrelNumber || "-"}</td>
            <td style="padding:8px;border:1px solid #333;">${b.recircleProductCode || "-"}</td>
            <td style="padding:8px;border:1px solid #333;">${b.customerProductCode || "-"}</td>
            <td style="padding:8px;border:1px solid #333;">${b.productDescription || "-"}</td>
            <td style="padding:8px;border:1px solid #333;">${line ? line.linkedProductName || "-" : "-"}</td>
            <td style="padding:8px;border:1px solid #333;text-align:center;">${b.quantityBundles || 0}</td>
            <td style="padding:8px;border:1px solid #333;">${b.batchNumber || "-"}</td>
            <td style="padding:8px;border:1px solid #333;">${b.lotNumber || "-"}</td>
            <td style="padding:8px;border:1px solid #333;">${b.sealNumber || "-"}</td>
          </tr>
        `;
      }).join("");
      printWindow.document.write(`
        <html><head><title>Packing List - ${po.poNumber}</title></head>
        <body style="font-family:Arial,sans-serif;padding:40px;background:#fff;color:#000;">
          <div style="text-align:center;margin-bottom:30px;">
            <h1 style="font-size:24px;margin-bottom:5px;color:${cfg.documentColor};">${cfg.legalName}</h1>
            <p style="font-size:12px;color:#666;">${cfg.address.street}, ${cfg.address.city}, ${cfg.address.province}, ${cfg.address.country}</p>
            <h2 style="font-size:18px;margin-top:15px;border-bottom:2px solid ${cfg.documentColor};padding-bottom:10px;color:#000;">PACKING LIST</h2>
          </div>
          <div style="display:flex;justify-content:space-between;margin-bottom:20px;font-size:12px;">
            <div><strong>PO Number:</strong> ${po.poNumber}<br/><strong>Customer:</strong> ${customer?.name || "-"}<br/><strong>Delivery:</strong> ${customer?.deliveryAddress || "-"}</div>
            <div><strong>Date:</strong> ${new Date().toLocaleDateString("en-ZA")}<br/><strong>Total Barrels:</strong> ${(barrels || []).length}<br/><strong>From:</strong> ${cfg.shortName}</div>
          </div>
          <table style="width:100%;border-collapse:collapse;font-size:11px;">
            <thead><tr style="background:${cfg.documentColor}15;">
              <th style="padding:8px;border:1px solid #333;text-align:left;">Barrel #</th>
              <th style="padding:8px;border:1px solid #333;text-align:left;">Recircle Code</th>
              <th style="padding:8px;border:1px solid #333;text-align:left;">Customer Code</th>
              <th style="padding:8px;border:1px solid #333;text-align:left;">Description</th>
              <th style="padding:8px;border:1px solid #333;text-align:left;">SGF Stock</th>
              <th style="padding:8px;border:1px solid #333;text-align:center;">Bundles</th>
              <th style="padding:8px;border:1px solid #333;text-align:left;">Batch #</th>
              <th style="padding:8px;border:1px solid #333;text-align:left;">Lot #</th>
              <th style="padding:8px;border:1px solid #333;text-align:left;">Seal #</th>
            </tr></thead>
            <tbody>${barrelList}</tbody>
          </table>
          <div style="margin-top:30px;font-size:11px;color:#666;border-top:2px solid ${cfg.documentColor};padding-top:10px;">
            <p><strong>Banking Details:</strong> ${cfg.banking.bankName} | Acc: ${cfg.banking.accountName} | ${cfg.banking.accountNumber} | Branch: ${cfg.banking.branchCode}</p>
            <p style="margin-top:10px;"><strong>IMPORTANT:</strong> Please note we require the following necessary documentation to process payments and must be supplied with all deliveries:</p>
            <p>1) DELIVERY NOTE &nbsp;&nbsp; 2) INVOICE &nbsp;&nbsp; 3) COA (CERTIFICATE OF ANALYSIS)</p>
            <p>Any deliveries received without these documents will not be accepted and will be returned on delivery.</p>
          </div>
        </body></html>
      `);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => printWindow.print(), 500);
    }, 100);
  }

  function handlePrintCOC(coc: any) {
    const cocCompany: CompanyKey = coc.company || po?.company || "sgf";
    const cfg = getCompanyConfig(cocCompany);
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <html><head><title>COC - ${coc.batchNumber}</title></head>
      <body style="font-family:Arial,sans-serif;padding:40px;background:#fff;color:#000;max-width:800px;margin:0 auto;">
        <div style="text-align:center;margin-bottom:10px;">
          <h1 style="font-size:22px;letter-spacing:2px;color:${cfg.documentColor};">${cfg.logoText}</h1>
          <p style="font-size:11px;color:#666;">${cfg.address.street}, ${cfg.address.city}, ${cfg.address.province}, ${cfg.address.country}</p>
        </div>
        <div style="text-align:center;margin-bottom:20px;border-bottom:2px solid ${cfg.documentColor};padding-bottom:10px;">
          <h2 style="font-size:16px;letter-spacing:1px;color:#000;">${cfg.cocHeader}</h2>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:20px;">
          <tr><td style="padding:6px;border:1px solid #ccc;font-weight:bold;width:30%;">PRODUCT CODE ${cfg.shortName}</td><td style="padding:6px;border:1px solid #ccc;">${coc.recircleProductCode || "-"}</td></tr>
          <tr><td style="padding:6px;border:1px solid #ccc;font-weight:bold;">PRODUCT CODE ${customer?.name?.toUpperCase() || "CUSTOMER"}</td><td style="padding:6px;border:1px solid #ccc;">${coc.customerProductCode || "-"}</td></tr>
          <tr><td style="padding:6px;border:1px solid #ccc;font-weight:bold;">PRODUCT DESCRIPTION</td><td style="padding:6px;border:1px solid #ccc;">${coc.productDescription || "-"}</td></tr>
          <tr><td style="padding:6px;border:1px solid #ccc;font-weight:bold;">LOT No</td><td style="padding:6px;border:1px solid #ccc;">${coc.lotNumber || "-"}</td></tr>
          <tr><td style="padding:6px;border:1px solid #ccc;font-weight:bold;">BATCH NUMBER</td><td style="padding:6px;border:1px solid #ccc;">${coc.batchNumber || "-"}</td></tr>
          <tr><td style="padding:6px;border:1px solid #ccc;font-weight:bold;">DATE OF MANUFACTURING</td><td style="padding:6px;border:1px solid #ccc;">${coc.manufacturingDate || "-"}</td></tr>
          <tr><td style="padding:6px;border:1px solid #ccc;font-weight:bold;">USE BY DATE</td><td style="padding:6px;border:1px solid #ccc;">${coc.useByDate || "-"}</td></tr>
          <tr><td style="padding:6px;border:1px solid #ccc;font-weight:bold;">BARREL/BAGS NUMBER</td><td style="padding:6px;border:1px solid #ccc;">${coc.barrelNumber || "-"} (${coc.quantityBundles || 0} Bundles)</td></tr>
        </table>
        <h3 style="font-size:14px;margin:15px 0 10px;">PHYSICAL REQUIREMENTS: PER BUNDLE</h3>
        <p style="font-size:11px;color:#666;margin-bottom:10px;">As per INSCA standards:</p>
        <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:20px;">
          <tr><td style="padding:6px;border:1px solid #ccc;font-weight:bold;width:30%;">CALIBRATION</td><td style="padding:6px;border:1px solid #ccc;">${coc.calibration || "-"}</td></tr>
          <tr><td style="padding:6px;border:1px solid #ccc;font-weight:bold;">LENGTH</td><td style="padding:6px;border:1px solid #ccc;">${coc.length || "-"}</td></tr>
          <tr><td style="padding:6px;border:1px solid #ccc;font-weight:bold;">QTY STRANDS</td><td style="padding:6px;border:1px solid #ccc;">${coc.qtyStrands || "-"}</td></tr>
          <tr><td style="padding:6px;border:1px solid #ccc;font-weight:bold;">STUFFING CAPACITY</td><td style="padding:6px;border:1px solid #ccc;">${coc.stuffingCapacity || "-"}</td></tr>
          <tr><td style="padding:6px;border:1px solid #ccc;font-weight:bold;">ODOUR</td><td style="padding:6px;border:1px solid #ccc;">${coc.odour || "-"}</td></tr>
          <tr><td style="padding:6px;border:1px solid #ccc;font-weight:bold;">COLOUR</td><td style="padding:6px;border:1px solid #ccc;">${coc.colour || "-"}</td></tr>
          <tr><td style="padding:6px;border:1px solid #ccc;font-weight:bold;">PACKING</td><td style="padding:6px;border:1px solid #ccc;">${coc.packing || "-"}</td></tr>
        </table>
        <h3 style="font-size:14px;margin:15px 0 10px;">TYPICAL ANALYSIS</h3>
        <p style="font-size:12px;margin-bottom:15px;">Natural hog casings are simply a thin layer of cleaned hog intestines that provide a natural casing for the sausage. It\'s edible and normally consumed with the sausage.</p>
        <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:20px;">
          <tr><td style="padding:6px;border:1px solid #ccc;font-weight:bold;width:30%;">COUNTRY OF ORIGIN</td><td style="padding:6px;border:1px solid #ccc;">${coc.countryOfOrigin || "South Africa"}</td></tr>
          <tr><td style="padding:6px;border:1px solid #ccc;font-weight:bold;">STATUS</td><td style="padding:6px;border:1px solid #ccc;">${coc.status || "Non HALAAL"}</td></tr>
        </table>
        <h3 style="font-size:14px;margin:15px 0 10px;">CLEANING PROCESS</h3>
        <p style="font-size:12px;margin-bottom:15px;">${coc.cleaningProcess || "Collect small intestines from Abattoir. Manure stripped by hand. Mucosa is removed, through a series of soaking and feeding through a combination of rollers. Final: Quality control, calibration and measuring processed. Product salted and stored in plastic drums ready for delivery."}</p>
        <h3 style="font-size:14px;margin:15px 0 10px;">HANDLING AND STORAGE CONDITIONS</h3>
        <p style="font-size:12px;margin-bottom:15px;">${coc.handlingStorage || "Casings to be handled, transported, packed, selected and dispatched in conformance with Good Manufacturing Practice. Casing supplier to store casings in salt, and at ambient/cool temperature. End user to store casings under refrigerated conditions and use within 10-12 months (Opened/Unopened) of receiving it."}</p>
        <div style="text-align:center;margin-top:30px;font-size:11px;color:#666;border-top:2px solid ${cfg.documentColor};padding-top:15px;">
          <p><strong>${cfg.legalName}</strong> | ${cfg.address.street}, ${cfg.address.city}, ${cfg.address.province} | ${cfg.address.country}</p>
        </div>
      </body></html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500);
  }

  const currentStep = STATUS_FLOW.findIndex(s => s.key === po.status);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Back + Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/purchase-orders")} className="p-2 rounded-lg hover:bg-[#222324]"><ArrowLeft className="w-5 h-5 text-[#8A8B8C]" /></button>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-semibold text-white">{po.poNumber}</h1>
            {(() => {
              const pcfg = getCompanyConfig(po.company);
              return <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: pcfg.documentColor + "22", color: pcfg.documentColor }}>{pcfg.shortName}</span>;
            })()}
            <span className="text-xs px-2 py-0.5 rounded-full capitalize" style={{ backgroundColor: STATUS_FLOW[currentStep]?.bg || "#1A8C3F1A", color: STATUS_FLOW[currentStep]?.color || "#4ADE80" }}>{po.status?.replace("_", " ")}</span>
          </div>
          <p className="text-sm text-[#8A8B8C] flex items-center gap-2 flex-wrap">
            <Building2 className="w-3 h-3" />{customer?.name || "Unknown"}
            <Calendar className="w-3 h-3 ml-2" /> Ordered: {po.orderDate}
            {po.dueDate && <><Calendar className="w-3 h-3 ml-2" /> Due: {po.dueDate}</>}
          </p>
        </div>
        {(barrels || []).length > 0 && (
          <button onClick={handlePrintPackingList} className="btn-secondary flex items-center gap-2 text-sm">
            <Printer className="w-4 h-4" /> Packing List
          </button>
        )}
      </div>

      {/* Status Progress */}
      <div className="card-glass">
        <div className="flex items-center gap-2 mb-3">
          {STATUS_FLOW.map((step, idx) => (
            <div key={step.key} className="flex items-center flex-1">
              <button
                onClick={() => {
                  if (idx <= currentStep + 1) updateStatus.mutate({ id: poId, status: step.key });
                }}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all text-center ${idx <= currentStep ? "text-white" : idx === currentStep + 1 ? "text-[#8A8B8C] hover:text-white" : "text-[#555556] cursor-not-allowed"}`}
                style={idx <= currentStep ? { backgroundColor: step.bg, color: step.color } : { backgroundColor: "#131415" }}
                disabled={idx > currentStep + 1}
              >
                {step.label}
              </button>
              {idx < STATUS_FLOW.length - 1 && <ChevronDown className="w-4 h-4 text-[#8A8B8C] mx-1 rotate-[-90deg]" />}
            </div>
          ))}
        </div>
        <p className="text-xs text-[#8A8B8C]">Click a status to advance the order. You can only move forward one step at a time.</p>
      </div>

      {/* PO Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card-glass">
          <div className="text-xs text-[#8A8B8C] mb-1">Total (Excl VAT)</div>
          <div className="text-lg font-semibold text-white">R {Number(po.totalExclVat || 0).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</div>
        </div>
        <div className="card-glass">
          <div className="text-xs text-[#8A8B8C] mb-1">VAT (15%)</div>
          <div className="text-lg font-semibold text-white">R {Number(po.vatAmount || 0).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</div>
        </div>
        <div className="card-glass">
          <div className="text-xs text-[#8A8B8C] mb-1">Total (Incl VAT)</div>
          <div className="text-lg font-semibold" style={{ color: "#D4A843" }}>R {Number(po.totalInclVat || 0).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</div>
        </div>
      </div>

      {/* Line Items */}
      <div className="card-glass">
        <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2"><Package className="w-4 h-4 text-[#D4A843]" /> Ordered Items</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-[#8A8B8C] border-b border-[#222324]">
              <th className="pb-2 font-medium">Cust. Stock Code</th>
              <th className="pb-2 font-medium">Cust. Description</th>
              <th className="pb-2 font-medium">Linked SGF Stock</th>
              <th className="pb-2 font-medium text-right">Qty</th>
              <th className="pb-2 font-medium">UOM</th>
              <th className="pb-2 font-medium text-right">Unit Price</th>
              <th className="pb-2 font-medium text-right">Amount</th>
            </tr></thead>
            <tbody>
              {(po.lineItems || []).map((item: any, idx: number) => (
                <tr key={idx} className="border-b border-[#222324] last:border-0">
                  <td className="py-2 text-white font-mono text-xs">{item.customerStockCode}</td>
                  <td className="py-2 text-white">{item.customerDescription}</td>
                  <td className="py-2">
                    {item.linkedStockItemId ? (
                      <div className="flex items-center gap-1">
                        <Link2 className="w-3 h-3 text-[#4ADE80]" />
                        <span className="text-xs text-white">{item.linkedProductName}</span>
                        <span className="text-[10px] text-[#8A8B8C] font-mono">{item.linkedProductCode}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-[#555]">Not linked</span>
                    )}
                  </td>
                  <td className="py-2 text-white text-right">{item.quantity}</td>
                  <td className="py-2 text-[#8A8B8C]">{item.uom}</td>
                  <td className="py-2 text-white text-right">R {Number(item.unitPrice).toFixed(2)}</td>
                  <td className="py-2 text-white text-right font-medium">R {(item.quantity * item.unitPrice).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Barrels Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-white flex items-center gap-2"><Hash className="w-4 h-4 text-[#D4A843]" /> Barrels / Batches ({(barrels || []).length})</h3>
          <button onClick={() => { resetBarrelForm(); setShowBarrelForm(true); }} className="btn-gold flex items-center gap-2 text-xs">
            <Plus className="w-3 h-3" /> Add Barrel
          </button>
        </div>

        {(barrels || []).length === 0 && (
          <div className="card-glass text-center py-8">
            <Hash className="w-10 h-10 mx-auto mb-2 text-[#8A8B8C] opacity-20" />
            <p className="text-[#8A8B8C] text-sm">No barrels added yet</p>
            <p className="text-[#8A8B8C] text-xs mt-1">Add barrels to track batch numbers, lot numbers, and seal numbers</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {(barrels || []).map((barrel: any) => {
            const barrelCOCs = (cocs || []).filter((c: any) => c.barrelId === barrel.id);
            const fulfilledLine = poLineItems[barrel.poLineIndex];
            return (
              <div key={barrel.id} className="card-glass space-y-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded flex items-center justify-center" style={{ backgroundColor: "#D4A8431A" }}>
                      <Package className="w-4 h-4" style={{ color: "#D4A843" }} />
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-white">Barrel {barrel.barrelNumber}</h4>
                      <p className="text-xs text-[#8A8B8C]">{barrel.productDescription}</p>
                    </div>
                  </div>
                  <button onClick={() => { if (confirm("Delete this barrel?")) deleteBarrel.mutate(barrel.id); }} className="p-1 rounded hover:bg-[#222324]"><Trash2 className="w-3 h-3 text-[#EF4444]" /></button>
                </div>
                {fulfilledLine && (
                  <div className="text-xs px-2 py-1 rounded flex items-center gap-1" style={{ backgroundColor: "#6366F11A" }}>
                    <Link2 className="w-3 h-3 text-[#818CF8]" />
                    <span className="text-[#818CF8]">Fulfills: {fulfilledLine.customerStockCode} - {fulfilledLine.customerDescription}</span>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <div><span className="text-[#8A8B8C]">Batch: </span><span className="text-white font-mono">{barrel.batchNumber}</span></div>
                  <div><span className="text-[#8A8B8C]">Lot: </span><span className="text-white font-mono">{barrel.lotNumber}</span></div>
                  <div><span className="text-[#8A8B8C]">Seal: </span><span className="text-white font-mono">{barrel.sealNumber}</span></div>
                  <div><span className="text-[#8A8B8C]">Bundles: </span><span className="text-white">{barrel.quantityBundles}</span></div>
                  <div><span className="text-[#8A8B8C]">Mfg: </span><span className="text-white">{barrel.manufacturingDate}</span></div>
                  <div><span className="text-[#8A8B8C]">Use By: </span><span className="text-white">{barrel.useByDate}</span></div>
                  {barrel.recircleProductCode && <div className="col-span-2"><span className="text-[#8A8B8C]">Recircle Code: </span><span className="text-white font-mono">{barrel.recircleProductCode}</span></div>}
                  {barrel.customerProductCode && <div className="col-span-2"><span className="text-[#8A8B8C]">Customer Code: </span><span className="text-white font-mono">{barrel.customerProductCode}</span></div>}
                </div>
                <div className="pt-2 border-t border-[#222324] flex gap-2">
                  {barrelCOCs.length === 0 ? (
                    <button onClick={() => handleGenerateCOC(barrel)} className="btn-secondary flex-1 text-xs flex items-center justify-center gap-1">
                      <FlaskConical className="w-3 h-3" /> Generate COC
                    </button>
                  ) : (
                    <div className="flex-1 space-y-1">
                      {barrelCOCs.map((coc: any) => (
                        <div key={coc.id} className="flex items-center gap-2">
                          <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: "#1A8C3F1A", color: "#4ADE80" }}>COC Ready</span>
                          <button onClick={() => handlePrintCOC(coc)} className="text-xs flex items-center gap-1 hover:underline" style={{ color: "#D4A843" }}><Printer className="w-3 h-3" /> Print</button>
                          <button onClick={() => { if (confirm("Delete this COC?")) deleteCOC.mutate(coc.id); }} className="p-0.5 rounded hover:bg-[#222324] ml-auto"><Trash2 className="w-3 h-3 text-[#EF4444]" /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Barrel Form Modal */}
      {showBarrelForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.7)" }}>
          <div className="modal-content w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Add Barrel</h2>
              <button onClick={() => setShowBarrelForm(false)} className="p-1 rounded hover:bg-[#222324]"><X className="w-5 h-5 text-[#8A8B8C]" /></button>
            </div>
            <form onSubmit={handleCreateBarrel} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label-text">Barrel Number *</label><input required value={barrelForm.barrelNumber} onChange={(e) => setBarrelForm({ ...barrelForm, barrelNumber: e.target.value })} className="input-field w-full" placeholder="e.g., 1/43" /></div>
                <div><label className="label-text">Quantity (Bundles)</label><input type="number" value={barrelForm.quantityBundles || ""} onChange={(e) => setBarrelForm({ ...barrelForm, quantityBundles: parseInt(e.target.value) || 0 })} className="input-field w-full" /></div>
                {/* PO Line selector - auto-populates from linked SGF stock */}
                <div className="col-span-2">
                  <label className="label-text">Fulfill PO Line Item</label>
                  {linkedStockItems.length > 0 ? (
                    <select value={barrelForm.poLineIndex} onChange={(e) => selectPOLine(parseInt(e.target.value))} className="input-field w-full text-sm">
                      <option value={-1}>Select PO line to auto-fill product info...</option>
                      {linkedStockItems.map((li) => (
                        <option key={li.index} value={li.index}>
                          {li.customerStockCode} - {li.customerDescription} (SGF: {li.linkedProductName})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="text-xs text-[#8A8B8C] px-2 py-1.5 rounded" style={{ backgroundColor: "#1A1A1B" }}>
                      No PO lines linked to SGF stock. Manual entry required.
                    </div>
                  )}
                </div>
                <div className="col-span-2"><label className="label-text">Product Description</label><input value={barrelForm.productDescription} onChange={(e) => setBarrelForm({ ...barrelForm, productDescription: e.target.value })} className="input-field w-full" placeholder="e.g., Supermarket Select SL (Hog 28/32)" /></div>
                <div><label className="label-text">Recircle Product Code</label><input value={barrelForm.recircleProductCode} onChange={(e) => setBarrelForm({ ...barrelForm, recircleProductCode: e.target.value })} className="input-field w-full" placeholder="220250212/24" /></div>
                <div><label className="label-text">Customer Product Code</label><input value={barrelForm.customerProductCode} onChange={(e) => setBarrelForm({ ...barrelForm, customerProductCode: e.target.value })} className="input-field w-full" placeholder="50101170" /></div>
                <div><label className="label-text">Batch Number *</label><input required value={barrelForm.batchNumber} onChange={(e) => setBarrelForm({ ...barrelForm, batchNumber: e.target.value })} className="input-field w-full" placeholder="250001112" /></div>
                <div><label className="label-text">Lot Number</label><input value={barrelForm.lotNumber} onChange={(e) => setBarrelForm({ ...barrelForm, lotNumber: e.target.value })} className="input-field w-full" placeholder="8429922341" /></div>
                <div><label className="label-text">Seal Number</label><input value={barrelForm.sealNumber} onChange={(e) => setBarrelForm({ ...barrelForm, sealNumber: e.target.value })} className="input-field w-full" /></div>
                <div><label className="label-text">Manufacturing Date</label><input type="date" value={barrelForm.manufacturingDate} onChange={(e) => setBarrelForm({ ...barrelForm, manufacturingDate: e.target.value })} className="input-field w-full" /></div>
                <div><label className="label-text">Use By Date</label><input type="date" value={barrelForm.useByDate} onChange={(e) => setBarrelForm({ ...barrelForm, useByDate: e.target.value })} className="input-field w-full" /></div>
              </div>
              <div className="pt-2 border-t border-[#222324]">
                <h4 className="text-xs font-medium text-white mb-2">Physical Specifications (for COC)</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="label-text text-[10px]">Calibration</label><input value={barrelForm.calibration} onChange={(e) => setBarrelForm({ ...barrelForm, calibration: e.target.value })} className="input-field w-full text-xs" placeholder="Min 28/30 mm" /></div>
                  <div><label className="label-text text-[10px]">Length</label><input value={barrelForm.length} onChange={(e) => setBarrelForm({ ...barrelForm, length: e.target.value })} className="input-field w-full text-xs" placeholder="Minimum 90 to 91m/bundle" /></div>
                  <div><label className="label-text text-[10px]">Qty Strands</label><input value={barrelForm.qtyStrands} onChange={(e) => setBarrelForm({ ...barrelForm, qtyStrands: e.target.value })} className="input-field w-full text-xs" placeholder="13 strands / bundle" /></div>
                  <div><label className="label-text text-[10px]">Stuffing Capacity</label><input value={barrelForm.stuffingCapacity} onChange={(e) => setBarrelForm({ ...barrelForm, stuffingCapacity: e.target.value })} className="input-field w-full text-xs" placeholder="44kg average / bundle" /></div>
                  <div><label className="label-text text-[10px]">Odour</label><input value={barrelForm.odour} onChange={(e) => setBarrelForm({ ...barrelForm, odour: e.target.value })} className="input-field w-full text-xs" /></div>
                  <div><label className="label-text text-[10px]">Colour</label><input value={barrelForm.colour} onChange={(e) => setBarrelForm({ ...barrelForm, colour: e.target.value })} className="input-field w-full text-xs" /></div>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button type="button" onClick={() => setShowBarrelForm(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-gold">Add Barrel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
