import { useState, useMemo, useRef, useEffect } from "react";
import { trpc } from "@/providers/trpc";
import { reloadFromStorage } from "@/lib/dataService";
import { getCompanyConfig, type CompanyKey } from "@/lib/companyConfig";
import { useParams, useNavigate } from "react-router";
import {
  ArrowLeft, Package, Plus, Trash2, X, FileText, Printer, Building2,
  Calendar, Hash, FlaskConical, CheckCircle2, Clock, AlertCircle, ChevronDown,
  Link2, Pencil, ClipboardList, Search,
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
  const [showEditForm, setShowEditForm] = useState(false);
  const [showRegenPrompt, setShowRegenPrompt] = useState(false);
  const [editPickerLine, setEditPickerLine] = useState<number>(-1);
  const [selectedBarrelId, setSelectedBarrelId] = useState<number | null>(null);
  const [stockPickerFilter, setStockPickerFilter] = useState("");

  // Edit form state
  const [editForm, setEditForm] = useState({
    poNumber: "", orderDate: "", dueDate: "", memoDate: "",
    shippingInstructions: "", notes: "",
    lineItems: [] as Array<{
      customerStockCode: string; customerDescription: string; dueDate: string;
      quantity: number; uom: string; unitPrice: number; linkedStockItemId: number | null;
      linkedProductName: string; linkedProductCode: string;
    }>,
  });

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

  const { data: purchaseOrders, isLoading: poLoading } = trpc.purchaseOrder.list.useQuery();
  const { data: corporateCustomers } = trpc.corporateCustomer.list.useQuery();
  const { data: stockItems } = trpc.stock.search.useQuery({ query: " " });
  const { data: barrels } = trpc.barrel.listByPurchaseOrder.useQuery(poId, { enabled: !!poId });
  const { data: cocs } = trpc.coc.listByPurchaseOrder.useQuery(poId, { enabled: !!poId });
  const { data: allCocsList } = trpc.coc.list.useQuery();
  const { data: packingLines } = trpc.packingList.listByPurchaseOrder.useQuery(poId, { enabled: !!poId });

  const updateStatus = trpc.purchaseOrder.updateStatus.useMutation({
    onSuccess: async () => { reloadFromStorage(); await utils.purchaseOrder.list.invalidate(); },
  });
  const generateInvForPO = trpc.invoice.generateForPO.useMutation({
    onSuccess: async (invNum) => {
      if (invNum) {
        reloadFromStorage();
        await utils.invoice.list.invalidate();
        alert(`Invoice ${invNum} generated successfully!`);
      }
    },
  });
  const updatePO = trpc.purchaseOrder.update.useMutation({
    onSuccess: async (result) => {
      reloadFromStorage();
      await utils.purchaseOrder.list.invalidate();
      setShowEditForm(false);
      // Check if an invoice exists for this PO — prompt to re-generate
      const { data: allInvoices } = await utils.invoice.list.ensureQueryData();
      const hasInvoice = (allInvoices || []).some((i: any) => i.purchaseOrderId === poId || i.poNumber === po?.poNumber);
      if (hasInvoice) {
        setShowRegenPrompt(true);
      }
    },
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

  // Derive PO line items for barrel creation and packing list (after po is defined)
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

  if (poLoading) {
    return (
      <div className="p-6 text-center min-h-[60vh] flex flex-col items-center justify-center">
        <div className="w-10 h-10 border-4 border-[#D4A843] border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-[#E5E7EB] text-sm">Loading purchase order...</p>
      </div>
    );
  }

  if (!po) {
    return (
      <div className="p-6 text-center min-h-[60vh] flex flex-col items-center justify-center">
        <AlertCircle className="w-12 h-12 mx-auto mb-3 text-[#EF4444] opacity-40" />
        <p className="text-white font-medium">Purchase order not found</p>
        <p className="text-[#9CA3AF] text-sm mt-1 mb-4">Data may still be syncing from the cloud.</p>
        <button onClick={() => navigate("/purchase-orders")} className="btn-gold">Back to POs</button>
      </div>
    );
  }

  function resetBarrelForm() {
    setBarrelForm({
      barrelNumber: "", poLineIndex: -1, productDescription: "", batchNumber: "", lotSealNumber: "",
      manufacturingDate: "", useByDate: "", quantityBundles: 0,
      recircleProductCode: "", customerProductCode: "", calibration: "Min 28/30 mm",
      length: "Minimum 90 to 91m/bundle", qtyStrands: "13 strands / bundle",
      stuffingCapacity: "44kg average / bundle", odour: "No off odours to be present",
      colour: "White / Beige color", packing: "Bundles packed in barrels of 150 or 200",
      countryOfOrigin: "South Africa", status: "Non HALAAL",
    });
  }

  // When user selects a PO line, auto-populate barrel form with linked stock info
  // ═══ EDIT PO FUNCTIONS ═══
  function openEditForm() {
    if (!po) return;
    setEditForm({
      poNumber: po.poNumber || "",
      orderDate: po.orderDate || "",
      dueDate: po.dueDate || "",
      memoDate: po.memoDate || "",
      shippingInstructions: po.shippingInstructions || "",
      notes: po.notes || "",
      lineItems: (po.lineItems || []).map((li: any) => ({
        customerStockCode: li.customerStockCode || "",
        customerDescription: li.customerDescription || "",
        dueDate: li.dueDate || "",
        quantity: li.quantity || 0,
        uom: li.uom || "BND",
        unitPrice: li.unitPrice || 0,
        linkedStockItemId: li.linkedStockItemId || null,
        linkedProductName: li.linkedProductName || "",
        linkedProductCode: li.linkedProductCode || "",
      })),
    });
    setShowEditForm(true);
  }

  function handleUpdateLineItem(index: number, field: string, value: any) {
    setEditForm(prev => ({
      ...prev,
      lineItems: prev.lineItems.map((item, i) => i === index ? { ...item, [field]: value } : item),
    }));
  }

  function linkStockToEditLine(index: number, stockItemId: number) {
    const stock = (stockItems || []).find((s: any) => s.id === stockItemId);
    if (!stock) return;
    setEditForm(prev => ({
      ...prev,
      lineItems: prev.lineItems.map((item, i) =>
        i === index
          ? { ...item, linkedStockItemId: stockItemId, linkedProductName: stock.productName || "", linkedProductCode: stock.productCode || "" }
          : item
      ),
    }));
    setEditPickerLine(-1);
  }

  function handleAddEditLineItem() {
    setEditForm(prev => ({
      ...prev,
      lineItems: [...prev.lineItems, { customerStockCode: "", customerDescription: "", dueDate: prev.dueDate, quantity: 0, uom: "BND", unitPrice: 0, linkedStockItemId: null, linkedProductName: "", linkedProductCode: "" }],
    }));
  }

  function handleRemoveEditLineItem(index: number) {
    setEditForm(prev => ({ ...prev, lineItems: prev.lineItems.filter((_, i) => i !== index) }));
  }

  function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!po) return;
    const totalExclVat = editForm.lineItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    const vatAmount = totalExclVat * 0.15;
    updatePO.mutate({
      id: poId,
      data: {
        ...editForm,
        totalExclVat,
        vatAmount,
        totalInclVat: totalExclVat + vatAmount,
      },
    });
  }

  // ═══ PICKING SLIP PRINT ═══
  function handlePrintPickingSlip() {
    const cfg = getCompanyConfig(po?.company);
    const printWindow = window.open("", "_blank");
    if (!printWindow || !po) return;
    const lineRows = (po.lineItems || []).map((li: any, idx: number) => `
      <tr>
        <td style="padding:8px;border:1px solid #333;text-align:center;">${idx + 1}</td>
        <td style="padding:8px;border:1px solid #333;font-family:monospace;font-size:11px;">${li.customerStockCode || "-"}</td>
        <td style="padding:8px;border:1px solid #333;">${li.customerDescription || "-"}</td>
        <td style="padding:8px;border:1px solid #333;font-family:monospace;font-size:11px;">${li.linkedProductCode || "-"}</td>
        <td style="padding:8px;border:1px solid #333;">${li.linkedProductName || "-"}</td>
        <td style="padding:8px;border:1px solid #333;text-align:center;font-weight:bold;">${li.quantity || 0}</td>
        <td style="padding:8px;border:1px solid #333;text-align:center;">${li.uom || "BND"}</td>
        <td style="padding:8px;border:1px solid #333;text-align:center;"><div style="border-bottom:1px solid #333;height:20px;"></div></td>
        <td style="padding:8px;border:1px solid #333;text-align:center;"><div style="border-bottom:1px solid #333;height:20px;"></div></td>
      </tr>
    `).join("");
    printWindow.document.write(`
      <html><head><title>Picking Slip - ${po.poNumber}</title></head>
      <body style="font-family:Arial,sans-serif;padding:30px;background:#fff;color:#000;">
        <div style="text-align:center;margin-bottom:20px;">
          <h1 style="font-size:22px;margin-bottom:3px;color:${cfg.documentColor};">${cfg.legalName}</h1>
          <p style="font-size:10px;color:#666;">${cfg.address.street}, ${cfg.address.city}, ${cfg.address.province}, ${cfg.address.country}</p>
          <h2 style="font-size:16px;margin-top:12px;border-bottom:2px solid ${cfg.documentColor};padding-bottom:8px;">FACTORY PICKING SLIP</h2>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:20px;font-size:12px;">
          <div>
            <strong>PO Number:</strong> ${po.poNumber}<br/>
            <strong>Customer:</strong> ${customer?.name || "-"}<br/>
            <strong>Customer VAT:</strong> ${customer?.vatNumber || "-"}
          </div>
          <div style="text-align:right;">
            <strong>Print Date:</strong> ${new Date().toLocaleDateString("en-ZA")}<br/>
            <strong>Due Date:</strong> ${po.dueDate || "-"}<br/>
            <strong>Memo Date:</strong> ${po.memoDate || "-"}
          </div>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:11px;">
          <thead><tr style="background:${cfg.documentColor};color:#fff;">
            <th style="padding:8px;border:1px solid #333;">#</th>
            <th style="padding:8px;border:1px solid #333;">Cust Stock Code</th>
            <th style="padding:8px;border:1px solid #333;">Cust Description</th>
            <th style="padding:8px;border:1px solid #333;">SGF Code</th>
            <th style="padding:8px;border:1px solid #333;">SGF Product</th>
            <th style="padding:8px;border:1px solid #333;">Qty</th>
            <th style="padding:8px;border:1px solid #333;">UOM</th>
            <th style="padding:8px;border:1px solid #333;">Picked</th>
            <th style="padding:8px;border:1px solid #333;">Checked</th>
          </tr></thead>
          <tbody>${lineRows}</tbody>
        </table>
        <div style="margin-top:25px;padding:15px;border:2px solid ${cfg.documentColor};border-radius:4px;">
          <h3 style="font-size:12px;margin-bottom:10px;color:${cfg.documentColor};">FACTORY CHECKLIST</h3>
          <div style="display:flex;gap:40px;font-size:11px;">
            <div><input type="checkbox" style="margin-right:5px;" /> Correct products picked</div>
            <div><input type="checkbox" style="margin-right:5px;" /> Quantities verified</div>
            <div><input type="checkbox" style="margin-right:5px;" /> Batch numbers recorded</div>
            <div><input type="checkbox" style="margin-right:5px;" /> Barrel labels applied</div>
          </div>
        </div>
        <div style="margin-top:20px;display:flex;justify-content:space-between;font-size:11px;">
          <div style="width:30%;">
            <strong>Picked By:</strong><div style="border-bottom:1px solid #333;height:25px;margin-top:5px;"></div>
            <div style="font-size:9px;color:#666;margin-top:3px;">Name & Signature</div>
          </div>
          <div style="width:30%;">
            <strong>Checked By:</strong><div style="border-bottom:1px solid #333;height:25px;margin-top:5px;"></div>
            <div style="font-size:9px;color:#666;margin-top:3px;">Name & Signature</div>
          </div>
          <div style="width:30%;">
            <strong>Date & Time:</strong><div style="border-bottom:1px solid #333;height:25px;margin-top:5px;"></div>
            <div style="font-size:9px;color:#666;margin-top:3px;">DD/MM/YYYY HH:MM</div>
          </div>
        </div>
        <div style="text-align:center;margin-top:20px;font-size:9px;color:#999;border-top:1px solid #ccc;padding-top:8px;">
          <strong>${cfg.legalName}</strong> | Picking Slip for PO ${po.poNumber} | Page 1 of 1
        </div>
      </body></html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500);
  }

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

  // ═══ AUTO-GENERATE COCs FROM PACKING LIST ═══
  function handleAutoGenerateCOCs() {
    const pls = packingLines || [];
    if (pls.length === 0) {
      alert("No packing list lines found. Please complete the packing list first.");
      return;
    }

    // Check if COCs already exist (uses tRPC data = cloud-first)
    const existingCOCs = cocs || [];
    const generateAll = existingCOCs.length > 0
      ? confirm(`${existingCOCs.length} COC(s) already exist. Replace all with new auto-generated COCs?`)
      : true;
    if (!generateAll) return;

    // Delete existing COCs via tRPC mutation (cloud-first)
    existingCOCs.forEach((c: any) => {
      deleteCOC.mutate(c.id);
    });

    // Get next batch number base
    let batchCounter = 1;
    const existingBatches = (allCocsList || [])
      .map((c: any) => c.batchNumber)
      .filter(Boolean);

    // Calculate dates
    const orderDate = po.orderDate ? new Date(po.orderDate) : new Date();
    const mfgStart = new Date(orderDate);
    mfgStart.setDate(mfgStart.getDate() + 1); // Day 1 of manufacturing
    const mfgEnd = new Date(orderDate);
    mfgEnd.setDate(mfgEnd.getDate() + 3); // Day 3 of manufacturing
    const useBy = new Date();
    useBy.setFullYear(useBy.getFullYear() + 2); // 2 years from now

    // Format dates
    const formatDate = (d: Date) => d.toLocaleDateString("en-ZA", { day: "2-digit", month: "long", year: "numeric" });
    const mfgDateStr = `${formatDate(mfgStart)} - ${formatDate(mfgEnd)}`;
    const useByStr = formatDate(useBy);

    pls.forEach((pl: any) => {
      // Get stock data for specs
      let stock: any = null;
      if (pl.linkedStockItemId && stockItems) {
        stock = (stockItems as any[]).find((s: any) => s.id === pl.linkedStockItemId);
      }

      // Auto-detect hog vs sheep
      const descLower = (pl.productDescription || "").toLowerCase();
      const sizeLower = (pl.productSize || "").toLowerCase();
      const isSheep = descLower.includes("sheep") || sizeLower.includes("sheep") || descLower.includes("lamb");
      const isHog = !isSheep;
      const animalType = isSheep ? "sheep" : "hog";
      const casingType = isSheep ? "SHEEP CASINGS" : "HOG CASINGS";

      // Generate unique batch number
      let batchNumber = "";
      do {
        const base = `${String(orderDate.getFullYear()).slice(-2)}${String(orderDate.getMonth() + 1).padStart(2, "0")}`;
        batchNumber = `${base}${String(batchCounter).padStart(4, "0")}`;
        batchCounter++;
      } while (existingBatches.includes(batchNumber));
      existingBatches.push(batchNumber);

      // Build product description with full spec
      const productDesc = pl.productDescription || "";
      const fullDesc = stock
        ? `${productDesc} (${casingType.replace(" CASINGS", "")} ${stock.size || ""} ${stock.strands || ""}/${stock.hanks || ""}/${stock.length || ""} ${stock.calibration || ""})`
        : productDesc;

      // Get customer stock code from PO line
      const poLine = (po.lineItems || [])[pl.poLineIndex || 0];
      const customerStockCode = poLine?.customerStockCode || "";

      // Get Recircle product code from stock
      const recircleCode = stock?.productCode || pl.recircleProductCode || `22025${String(orderDate.getMonth() + 1).padStart(2, "0")}${String(orderDate.getDate()).padStart(2, "0")}`;

      // Physical specs from stock or defaults
      const calibration = stock?.size || "Min 28/30 mm";
      const strands = stock?.strands ? `${stock.strands} strands / bundle` : "13 strands / bundle";
      const length = stock?.length ? `Minimum ${stock.length}m/bundle` : "Minimum 90 to 91m/bundle";

      createCOC.mutate({
        purchaseOrderId: poId,
        packingListLineId: pl.id,
        poNumber: po.poNumber,
        corporateCustomerId: po.corporateCustomerId,
        corporateCustomerName: customer?.name || "",
        recircleProductCode: recircleCode,
        customerProductCode: customerStockCode,
        productDescription: fullDesc,
        batchNumber,
        lotSealNumber: pl.lotSealNumber || pl.lotNumber || pl.sealNumber || "",
        manufacturingDate: mfgDateStr,
        useByDate: useByStr,
        barrelNumber: pl.barrelNumber || "",
        quantityBundles: pl.quantityBundles || 0,
        calibration,
        length,
        qtyStrands: strands,
        stuffingCapacity: pl.quantityBundles <= 150 ? "44kg average / bundle" : "58kg average / bundle",
        odour: "No off odors to be present",
        colour: "White / Beige color",
        packing: pl.quantityBundles <= 150
          ? "Bundles packed in barrels of 150"
          : pl.quantityBundles <= 200
            ? "Bundles packed in barrels of 200"
            : `Bundles packed in barrels of ${pl.quantityBundles}`,
        countryOfOrigin: "South Africa",
        status: "Non HALAAL",
        casingType,
        animalType,
        cleaningProcess: isSheep
          ? "Collect small intestines from Abattoir. Manure stripped by hand. Mucosa is removed, through a series of soaking and feeding through a combination of rollers. Final: Quality control, calibration and measuring processed. Product salted and stored in plastic drums ready for delivery."
          : "Collect small intestines from Abattoir. Manure stripped by hand. Mucosa is removed, through a series of soaking and feeding through a combination of rollers. Final: Quality control, calibration and measuring processed. Product salted and stored in plastic drums ready for delivery.",
        handlingStorage: "Casings to be handled, transported, packed, selected and dispatched in conformance with Good Manufacturing Practice. Casing supplier to store casings in salt, and at ambient/cool temperature. End user to store casings under refrigerated conditions and use within 10-12 months (Opened/Unopened) of receiving it.",
        grossWeight: pl.grossWeight || 0,
        netWeight: pl.netWeight || 0,
      });
    });
  }

  // Print all COCs as multi-page document
  function handlePrintAllCOCs() {
    const allCocs = cocs || [];
    if (allCocs.length === 0) {
      alert("No COCs found. Please auto-generate COCs first.");
      return;
    }
    const cfg = getCompanyConfig(po?.company);
    const w = window.open("", "_blank");
    if (!w) return;

    // Check if customer has a custom logo
    const customerLogo = customer?.logoUrl || "";
    const hasCustomerLogo = !!customerLogo;

    const cocPages = allCocs.map((coc: any) => {
      const isSheep = coc.animalType === "sheep";
      const animalName = isSheep ? "sheep" : "hog";
      const casingName = isSheep ? "Sheep casings" : "hog casings";
      // Build full logo URL
      const logoSrc = hasCustomerLogo
        ? (customerLogo.startsWith("http") || customerLogo.startsWith("/") ? customerLogo : `/${customerLogo}`)
        : "";
      return `
        <div style="page-break-after:always; padding:40px; max-width:800px; margin:0 auto; font-family:Arial,sans-serif; color:#000;">
          <div style="text-align:center; margin-bottom:10px;">
            ${hasCustomerLogo ? `
              <div style="display:flex; align-items:center; justify-content:center; gap:20px; margin-bottom:8px;">
                <div style="text-align:left;">
                  <h1 style="font-size:14px; letter-spacing:1px; color:${cfg.documentColor}; margin:0;">${cfg.logoText}</h1>
                  <p style="font-size:8px; color:#666; margin:2px 0;">${cfg.address.street}, ${cfg.address.city}, ${cfg.address.province}</p>
                </div>
                <div style="width:80px; height:80px; display:flex; align-items:center; justify-content:center;">
                  <img src="${logoSrc}" style="max-width:75px; max-height:75px; object-fit:contain;" onerror="this.style.display='none'; this.parentElement.style.display='none';" />
                </div>
              </div>
            ` : `
              <h1 style="font-size:22px; letter-spacing:2px; color:${cfg.documentColor}; margin:0;">${cfg.logoText}</h1>
              <p style="font-size:10px; color:#666; margin:3px 0;">${cfg.address.street}, ${cfg.address.city}, ${cfg.address.province}, ${cfg.address.country}</p>
            `}
          </div>
          <div style="text-align:center; margin-bottom:15px; border-bottom:2px solid ${cfg.documentColor}; padding-bottom:8px;">
            <h2 style="font-size:16px; letter-spacing:1px; color:#000; margin:0;">${cfg.cocHeader}</h2>
          </div>

          <table style="width:100%; border-collapse:collapse; font-size:12px; margin-bottom:15px;">
            <tr><td style="padding:5px; border:1px solid #ccc; font-weight:bold; width:35%;">PRODUCT CODE ${cfg.shortName}</td><td style="padding:5px; border:1px solid #ccc;">${coc.recircleProductCode || "-"}</td></tr>
            <tr><td style="padding:5px; border:1px solid #ccc; font-weight:bold;">PRODUCT CODE ${(customer?.name || "CUSTOMER").toUpperCase()}</td><td style="padding:5px; border:1px solid #ccc;">${coc.customerProductCode || "-"}</td></tr>
            <tr><td style="padding:5px; border:1px solid #ccc; font-weight:bold;">PRODUCT DESCRIPTION</td><td style="padding:5px; border:1px solid #ccc;">${coc.productDescription || "-"}</td></tr>
            <tr><td style="padding:5px; border:1px solid #ccc; font-weight:bold;">LOT No</td><td style="padding:5px; border:1px solid #ccc; font-family:monospace;">${coc.lotSealNumber || "-"}</td></tr>
            <tr><td style="padding:5px; border:1px solid #ccc; font-weight:bold;">BATCH NUMBER</td><td style="padding:5px; border:1px solid #ccc; font-family:monospace;">${coc.batchNumber || "-"}</td></tr>
            <tr><td style="padding:5px; border:1px solid #ccc; font-weight:bold;">DATE OF MANUFACTURING</td><td style="padding:5px; border:1px solid #ccc;">${coc.manufacturingDate || "-"}</td></tr>
            <tr><td style="padding:5px; border:1px solid #ccc; font-weight:bold;">USE BY DATE</td><td style="padding:5px; border:1px solid #ccc;">${coc.useByDate || "-"}</td></tr>
            <tr><td style="padding:5px; border:1px solid #ccc; font-weight:bold;">BARREL/BAGS NUMBER</td><td style="padding:5px; border:1px solid #ccc;">${coc.barrelNumber || "-"} (${coc.quantityBundles || 0} Bundles)</td></tr>
          </table>

          <h3 style="font-size:13px; margin:12px 0 6px; text-decoration:underline;">PHYSICAL REQUIREMENTS: PER BUNDLE</h3>
          <p style="font-size:10px; color:#666; margin:0 0 8px;">As per INSCA standards:</p>
          <table style="width:100%; border-collapse:collapse; font-size:12px; margin-bottom:15px;">
            <tr><td style="padding:5px; border:1px solid #ccc; font-weight:bold; width:35%;">CALIBRATION</td><td style="padding:5px; border:1px solid #ccc;">${coc.calibration || "-"}</td></tr>
            <tr><td style="padding:5px; border:1px solid #ccc; font-weight:bold;">LENGTH</td><td style="padding:5px; border:1px solid #ccc;">${coc.length || "-"}</td></tr>
            <tr><td style="padding:5px; border:1px solid #ccc; font-weight:bold;">QTY STRANDS</td><td style="padding:5px; border:1px solid #ccc;">${coc.qtyStrands || "-"}</td></tr>
            <tr><td style="padding:5px; border:1px solid #ccc; font-weight:bold;">STUFFING CAPACITY</td><td style="padding:5px; border:1px solid #ccc;">${coc.stuffingCapacity || "-"}</td></tr>
            <tr><td style="padding:5px; border:1px solid #ccc; font-weight:bold;">ODOUR</td><td style="padding:5px; border:1px solid #ccc;">${coc.odour || "-"}</td></tr>
            <tr><td style="padding:5px; border:1px solid #ccc; font-weight:bold;">COLOUR</td><td style="padding:5px; border:1px solid #ccc;">${coc.colour || "-"}</td></tr>
            <tr><td style="padding:5px; border:1px solid #ccc; font-weight:bold;">PACKING</td><td style="padding:5px; border:1px solid #ccc;">${coc.packing || "-"}</td></tr>
          </table>

          <h3 style="font-size:13px; margin:12px 0 6px; text-decoration:underline;">TYPICAL ANALYSIS</h3>
          <p style="font-size:11px; margin:0 0 12px; line-height:1.5;">Natural ${animalName} casings are simply a thin layer of cleaned ${animalName} intestines that provide a natural casing for the sausage. It's edible and normally consumed with the sausage.</p>

          <table style="width:100%; border-collapse:collapse; font-size:12px; margin-bottom:15px;">
            <tr><td style="padding:5px; border:1px solid #ccc; font-weight:bold; width:35%;">COUNTRY OF ORIGIN</td><td style="padding:5px; border:1px solid #ccc;">${coc.countryOfOrigin || "South Africa"}</td></tr>
            <tr><td style="padding:5px; border:1px solid #ccc; font-weight:bold;">STATUS</td><td style="padding:5px; border:1px solid #ccc;">${coc.status || "Non HALAAL"}</td></tr>
          </table>

          <h3 style="font-size:13px; margin:12px 0 6px; text-decoration:underline;">CLEANING PROCESS</h3>
          <p style="font-size:11px; margin:0 0 12px; line-height:1.5;">${coc.cleaningProcess || "Collect small intestines from Abattoir. Manure stripped by hand. Mucosa is removed, through a series of soaking and feeding through a combination of rollers. Final: Quality control, calibration and measuring processed. Product salted and stored in plastic drums ready for delivery."}</p>

          <h3 style="font-size:13px; margin:12px 0 6px; text-decoration:underline;">HANDLING AND STORAGE CONDITIONS</h3>
          <p style="font-size:11px; margin:0 0 15px; line-height:1.5;">${coc.handlingStorage || "Casings to be handled, transported, packed, selected and dispatched in conformance with Good Manufacturing Practice. Casing supplier to store casings in salt, and at ambient/cool temperature. End user to store casings under refrigerated conditions and use within 10-12 months (Opened/Unopened) of receiving it."}</p>

          <div style="text-align:center; margin-top:20px; font-size:10px; color:#666; border-top:2px solid ${cfg.documentColor}; padding-top:10px;">
            <p style="margin:2px 0;"><strong>${cfg.legalName}</strong></p>
            <p style="margin:2px 0;">${cfg.address.street}, ${cfg.address.city}, ${cfg.address.province} | ${cfg.address.country}</p>
          </div>
        </div>
      `;
    }).join("");

    w.document.write(`<!DOCTYPE html><html><head><title>COCs - ${po.poNumber}</title><style>@media print{body{-webkit-print-color-adjust:exact;}}</style></head><body style="background:#fff;">${cocPages}<script>(function(){var d=false;function p(){if(!d){d=true;setTimeout(function(){window.print();},300);}}if(document.readyState==='complete')p();else window.onload=p;setTimeout(p,2000);})();</script></body></html>`);
    w.document.close();
    w.focus();
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
            <td style="padding:8px;border:1px solid #333;">${b.lotSealNumber || b.lotNumber || b.sealNumber || "-"}</td>
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
          <tr><td style="padding:6px;border:1px solid #ccc;font-weight:bold;">LOT / SEAL No</td><td style="padding:6px;border:1px solid #ccc;">${coc.lotSealNumber || coc.lotNumber || coc.sealNumber || "-"}</td></tr>
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
        <button
          onClick={() => generateInvForPO.mutate(poId)}
          className="btn-gold flex items-center gap-2 text-sm"
          disabled={generateInvForPO.isPending}
        >
          <FileText className="w-4 h-4" />
          {generateInvForPO.isPending ? "Generating..." : "Generate Invoice"}
        </button>
        <button onClick={handleAutoGenerateCOCs} className="btn-secondary flex items-center gap-2 text-sm" style={{ borderColor: "#0E7490", color: "#38BDF8" }}>
          <FlaskConical className="w-4 h-4" /> Auto-Gen COCs
        </button>
        <button onClick={openEditForm} className="btn-secondary flex items-center gap-2 text-sm">
          <Pencil className="w-4 h-4" /> Edit PO
        </button>
        <button onClick={() => navigate(`/packing-list/${poId}`)} className="btn-secondary flex items-center gap-2 text-sm">
          <ClipboardList className="w-4 h-4" /> Packing List
        </button>
        <button onClick={handlePrintPickingSlip} className="btn-secondary flex items-center gap-2 text-sm">
          <Printer className="w-4 h-4" /> Picking Slip
        </button>
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
                  <div><span className="text-[#8A8B8C]">Lot/Seal: </span><span className="text-white font-mono">{barrel.lotSealNumber || barrel.lotNumber || barrel.sealNumber}</span></div>
                  <div><span className="text-[#8A8B8C]">Bundles: </span><span className="text-white">{barrel.quantityBundles}</span></div>
                  <div><span className="text-[#8A8B8C]">Mfg: </span><span className="text-white">{barrel.manufacturingDate}</span></div>
                  <div><span className="text-[#8A8B8C]">Use By: </span><span className="text-white">{barrel.useByDate}</span></div>
                  {barrel.recircleProductCode && <div className="col-span-2"><span className="text-[#8A8B8C]">Recircle Code: </span><span className="text-white font-mono">{barrel.recircleProductCode}</span></div>}
                  {barrel.customerProductCode && <div className="col-span-2"><span className="text-[#8A8B8C]">Customer Code: </span><span className="text-white font-mono">{barrel.customerProductCode}</span></div>}
                </div>
                {/* COC actions removed - now auto-generated from packing list */}
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
                <div><label className="label-text">Lot / Seal Number</label><input value={barrelForm.lotSealNumber} onChange={(e) => setBarrelForm({ ...barrelForm, lotSealNumber: e.target.value })} className="input-field w-full font-mono" placeholder="8429922341" /></div>
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

      {/* ═══ COC SECTION ═══ */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-white flex items-center gap-2">
            <FlaskConical className="w-4 h-4 text-[#38BDF8]" /> Certificates of Compliance
          </h3>
          {(cocs || []).length > 0 && (
            <button onClick={handlePrintAllCOCs} className="btn-gold flex items-center gap-2 text-xs">
              <Printer className="w-3 h-3" /> Print All COCs ({(cocs || []).length})
            </button>
          )}
        </div>
        {(cocs || []).length === 0 && (
          <div className="card-glass text-center py-6">
            <FlaskConical className="w-8 h-8 mx-auto mb-2 text-[#8A8B8C] opacity-20" />
            <p className="text-[#8A8B8C] text-sm">No COCs yet. Click &quot;Auto-Gen COCs&quot; after packing list is complete.</p>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {(cocs || []).map((coc: any) => (
            <div key={coc.id} className="card-glass space-y-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded flex items-center justify-center" style={{ backgroundColor: "#0E74901A" }}>
                    <FlaskConical className="w-4 h-4 text-[#38BDF8]" />
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-white">Batch: {coc.batchNumber}</h4>
                    <p className="text-xs text-[#8A8B8C]">{coc.productDescription}</p>
                  </div>
                </div>
                <button onClick={() => { if (confirm("Delete this COC?")) deleteCOC.mutate(coc.id); }} className="p-1 rounded hover:bg-[#222324]">
                  <Trash2 className="w-3 h-3 text-[#EF4444]" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <div><span className="text-[#8A8B8C]">Barrel: </span><span className="text-white font-medium">{coc.barrelNumber}</span></div>
                <div><span className="text-[#8A8B8C]">Bundles: </span><span className="text-white">{coc.quantityBundles}</span></div>
                <div><span className="text-[#8A8B8C]">Lot/Seal: </span><span className="text-white font-mono" style={{ color: "#D4A843" }}>{coc.lotSealNumber}</span></div>
                <div><span className="text-[#8A8B8C]">Mfg: </span><span className="text-white">{coc.manufacturingDate}</span></div>
                <div><span className="text-[#8A8B8C]">Use By: </span><span className="text-white">{coc.useByDate}</span></div>
                <div><span className="text-[#8A8B8C]">Type: </span><span className="text-white">{coc.casingType || "HOG"}</span></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ EDIT PO MODAL ═══ */}
      {showEditForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.7)" }}>
          <div className="modal-content w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Edit Purchase Order</h2>
              <button onClick={() => setShowEditForm(false)} className="p-1 rounded hover:bg-[#222324]"><X className="w-5 h-5 text-[#8A8B8C]" /></button>
            </div>
            <form onSubmit={handleSaveEdit} className="space-y-4">
              {/* Row 1: PO Number */}
              <div>
                <label className="label-text">PO Number *</label>
                <input required value={editForm.poNumber} onChange={(e) => setEditForm({ ...editForm, poNumber: e.target.value })} className="input-field w-full" />
              </div>
              {/* Row 2: Dates - 3 columns */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="label-text">Order Date</label>
                  <input type="date" value={editForm.orderDate} onChange={(e) => setEditForm({ ...editForm, orderDate: e.target.value })} className="input-field w-full" />
                </div>
                <div>
                  <label className="label-text">Due Date</label>
                  <input type="date" value={editForm.dueDate} onChange={(e) => setEditForm({ ...editForm, dueDate: e.target.value })} className="input-field w-full" />
                </div>
                <div>
                  <label className="label-text">Memo Date</label>
                  <input type="date" value={editForm.memoDate} onChange={(e) => setEditForm({ ...editForm, memoDate: e.target.value })} className="input-field w-full" />
                </div>
              </div>
              {/* Row 3: Shipping Instructions */}
              <div>
                <label className="label-text">Shipping Instructions</label>
                <input value={editForm.shippingInstructions} onChange={(e) => setEditForm({ ...editForm, shippingInstructions: e.target.value })} className="input-field w-full" />
              </div>
              {/* Line Items */}
              <div className="pt-3 border-t border-[#222324]">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-white">Line Items</h3>
                  <button type="button" onClick={handleAddEditLineItem} className="text-xs px-2 py-1 rounded" style={{ color: "#D4A843" }}>+ Add Line</button>
                </div>
                <div className="space-y-3">
                  {editForm.lineItems.map((item, idx) => (
                    <div key={idx} className="p-3 rounded-lg space-y-2" style={{ backgroundColor: "#131415" }}>
                      <div className="grid grid-cols-12 gap-2">
                        <div className="col-span-3">
                          <label className="label-text text-[10px]">Cust. Stock Code *</label>
                          <input required value={item.customerStockCode} onChange={(e) => handleUpdateLineItem(idx, "customerStockCode", e.target.value)} className="input-field w-full text-xs" placeholder="50101170" />
                        </div>
                        <div className="col-span-5">
                          <label className="label-text text-[10px]">Cust. Description *</label>
                          <input required value={item.customerDescription} onChange={(e) => handleUpdateLineItem(idx, "customerDescription", e.target.value)} className="input-field w-full text-xs" placeholder="SUPERMARKET SELECT SL" />
                        </div>
                        <div className="col-span-2">
                          <label className="label-text text-[10px]">Qty</label>
                          <input type="number" value={item.quantity || ""} onChange={(e) => handleUpdateLineItem(idx, "quantity", parseFloat(e.target.value) || 0)} className="input-field w-full text-xs" />
                        </div>
                        <div className="col-span-1">
                          <label className="label-text text-[10px]">UOM</label>
                          <input value={item.uom} onChange={(e) => handleUpdateLineItem(idx, "uom", e.target.value)} className="input-field w-full text-xs" />
                        </div>
                        <div className="col-span-1">
                          <button type="button" onClick={() => handleRemoveEditLineItem(idx)} className="p-1 rounded hover:bg-red-900/30 mt-4"><Trash2 className="w-3 h-3 text-[#EF4444]" /></button>
                        </div>
                      </div>
                      <div className="grid grid-cols-12 gap-2 items-center">
                        <div className="col-span-3">
                          <label className="label-text text-[10px]">Unit Price (R)</label>
                          <input type="number" step="0.01" value={item.unitPrice || ""} onChange={(e) => handleUpdateLineItem(idx, "unitPrice", parseFloat(e.target.value) || 0)} className="input-field w-full text-xs" />
                        </div>
                        <div className="col-span-6">
                          <label className="label-text text-[10px]">Linked SGF Stock</label>
                          {item.linkedStockItemId ? (
                            <div className="flex items-center gap-2 px-2 py-1.5 rounded text-xs" style={{ backgroundColor: "#1A8C3F1A" }}>
                              <Link2 className="w-3 h-3 text-[#4ADE80] flex-shrink-0" />
                              <span className="text-white truncate flex-1">{item.linkedProductName}</span>
                              <span className="text-[#8A8B8C] font-mono flex-shrink-0">{item.linkedProductCode}</span>
                              <button type="button" onClick={() => setEditPickerLine(idx)} className="text-[#D4A843] hover:underline ml-1 flex-shrink-0 text-[10px]">Change</button>
                              <button type="button" onClick={() => { handleUpdateLineItem(idx, "linkedStockItemId", null); handleUpdateLineItem(idx, "linkedProductName", ""); handleUpdateLineItem(idx, "linkedProductCode", ""); }} className="text-[#EF4444] hover:underline ml-1 flex-shrink-0 text-[10px]">Unlink</button>
                            </div>
                          ) : (
                            <button type="button" onClick={() => setEditPickerLine(idx)} className="w-full text-left px-2 py-1.5 rounded text-xs border border-dashed border-[#444] text-[#8A8B8C] hover:text-white hover:border-[#666] transition-all flex items-center gap-1">
                              <Link2 className="w-3 h-3" /> Click to link SGF/Recircle stock...
                            </button>
                          )}
                          {/* Inline stock picker for edit */}
                          {editPickerLine === idx && (
                            <div className="mt-2 p-3 rounded-lg border border-[#333]" style={{ backgroundColor: "#0A0A0B" }}>
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs text-[#8A8B8C]">Select SGF stock:</span>
                                <button type="button" onClick={() => { setEditPickerLine(-1); setStockPickerFilter(""); }} className="text-[#8A8B8C] hover:text-white"><X className="w-3 h-3" /></button>
                              </div>
                              <input
                                type="text"
                                placeholder="Search product name or code..."
                                value={stockPickerFilter}
                                onChange={(e) => setStockPickerFilter(e.target.value)}
                                className="input-field w-full text-xs mb-2"
                                autoFocus
                              />
                              <div className="max-h-48 overflow-y-auto space-y-1">
                                {(() => {
                                  const filter = stockPickerFilter.trim().toLowerCase();
                                  const filtered = (stockItems || []).filter((s: any) => {
                                    if (!filter) return true;
                                    return (s.productName || "").toLowerCase().includes(filter) ||
                                           (s.productCode || "").toLowerCase().includes(filter);
                                  });
                                  if (filtered.length === 0) return <p className="text-xs text-[#555] p-2">No products match "{stockPickerFilter}"</p>;
                                  return filtered.map((s: any) => (
                                    <div key={s.id} onClick={() => { linkStockToEditLine(idx, s.id); setStockPickerFilter(""); }} className="flex items-center gap-2 p-2 rounded hover:bg-[#222324] cursor-pointer transition-colors">
                                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: s.quantity > 0 ? "#4ADE80" : "#EF4444" }} />
                                      <span className="text-xs text-white truncate flex-1">{s.productName}</span>
                                      <span className="text-[10px] text-[#8A8B8C] font-mono flex-shrink-0">{s.productCode}</span>
                                      <span className="text-[10px] text-[#8A8B8C] flex-shrink-0">{s.quantity || 0} SOH</span>
                                    </div>
                                  ));
                                })()}
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="col-span-3 text-right">
                          <span className="text-xs text-[#8A8B8C]">Line Total: </span>
                          <span className="text-xs font-medium text-white">R {(item.quantity * item.unitPrice).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <label className="label-text">Notes</label>
                <textarea value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} className="input-field w-full" rows={2} />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-[#222324]">
                <button type="button" onClick={() => setShowEditForm(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-gold" disabled={editForm.lineItems.length === 0 || !editForm.poNumber.trim()}>
                  {updatePO.isPending ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══ INVOICE RE-GENERATION PROMPT ═══ */}
      {showRegenPrompt && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.8)" }}>
          <div className="modal-content w-full max-w-md">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: "#F59E0B1A" }}>
                <AlertCircle className="w-5 h-5 text-[#F59E0B]" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Invoice Update Required</h3>
                <p className="text-sm text-[#8A8B8C]">This PO has a linked invoice that needs updating.</p>
              </div>
            </div>
            <div className="p-3 rounded-lg mb-4" style={{ backgroundColor: "#131415" }}>
              <p className="text-sm text-[#E8E8E9]">The Purchase Order has been updated. You should re-generate the invoice to reflect the changes (new quantities, prices, or line items).</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowRegenPrompt(false)} className="btn-secondary flex-1">Later</button>
              <button
                onClick={() => { generateInvForPO.mutate(poId); setShowRegenPrompt(false); }}
                className="btn-gold flex-1 flex items-center justify-center gap-2"
                disabled={generateInvForPO.isPending}
              >
                <FileText className="w-4 h-4" />
                {generateInvForPO.isPending ? "Re-generating..." : "Re-generate Invoice"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
