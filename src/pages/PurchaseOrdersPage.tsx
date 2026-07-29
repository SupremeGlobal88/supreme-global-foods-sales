import { useState, useRef, useEffect } from "react";
import { trpc } from "@/providers/trpc";
import { reloadFromStorage } from "@/lib/dataService";
import { getCompanyConfig, type CompanyKey } from "@/lib/companyConfig";
import {
  Search, Plus, Trash2, X, FileText, Building2, Calendar, Package,
  CheckCircle2, Clock, AlertCircle, ChevronRight, Filter, Link2, Globe,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router";

const STATUS_COLORS: Record<string, { bg: string; text: string; icon: any }> = {
  received: { bg: "#1A8C3F1A", text: "#4ADE80", icon: CheckCircle2 },
  in_progress: { bg: "#6366F11A", text: "#818CF8", icon: Clock },
  fulfilled: { bg: "#0E74901A", text: "#38BDF8", icon: CheckCircle2 },
  cancelled: { bg: "#EF44441A", text: "#EF4444", icon: AlertCircle },
};

// Line item: customer stock code + description from their PO, linked to SGF stock
interface POLineItem {
  customerStockCode: string;
  customerDescription: string;
  dueDate: string;
  quantity: number;
  uom: string;
  unitPrice: number;
  linkedStockItemId: number | null;
  linkedProductName: string;
  linkedProductCode: string;
}

// Product picker for linking SGF stock to a PO line
function StockPickerModal({
  isOpen, onClose, onSelect, stockItems, selectedId,
}: {
  isOpen: boolean; onClose: () => void; onSelect: (id: number) => void;
  stockItems: any[]; selectedId: number | null;
}) {
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSearch("");
      const isMobile = window.innerWidth < 768 || "ontouchstart" in window;
      if (!isMobile) setTimeout(() => searchRef.current?.focus(), 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filtered = (stockItems || [])
    .filter((s) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return s.productName?.toLowerCase().includes(q) || s.productCode?.toLowerCase().includes(q) || s.category?.toLowerCase().includes(q);
    })
    .sort((a, b) => (a.productName || "").localeCompare(b.productName || ""));

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.8)" }} onClick={onClose}>
      <div className="card-surface w-full sm:max-w-lg sm:mx-4 max-h-[85vh] flex flex-col" style={{ borderRadius: "16px 16px 0 0" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: "#222324" }}>
          <h3 className="font-display font-semibold text-white text-lg">Link to SGF/Recircle Stock</h3>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-[#222324]"><X className="w-5 h-5 text-[#8A8B8C]" /></button>
        </div>
        <div className="p-4 border-b" style={{ borderColor: "#222324" }}>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#8A8B8C]" />
            <input ref={searchRef} type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search SGF stock by name or code..." className="input-field w-full pl-10" autoComplete="off" />
          </div>
          <p className="text-xs text-[#8A8B8C] mt-2">Select the SGF/Recircle SA product that matches this customer&apos;s order line</p>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 && <div className="p-8 text-center text-[#8A8B8C] text-sm">No products found</div>}
          {filtered.map((s) => {
            const isSelected = selectedId === s.id;
            return (
              <div key={s.id} onClick={() => { onSelect(s.id); onClose(); }} className="w-full text-left border-b select-none" style={{ borderColor: "#18191A", backgroundColor: isSelected ? "rgba(212,168,67,0.12)" : "transparent", padding: "12px 16px", cursor: "pointer" }}>
                <div className="flex items-center justify-between pointer-events-none">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.quantity > 0 ? "#4ADE80" : "#EF4444" }} />
                      <span className="text-sm font-medium text-[#E8E8E9] truncate">{s.productName}</span>
                      {isSelected && <span className="text-xs flex-shrink-0 px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(212,168,67,0.2)", color: "#D4A843" }}>Linked</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-1 ml-[18px]">
                      <span className="text-xs text-[#8A8B8C] font-mono">{s.productCode}</span>
                      <span className="text-xs text-[#8A8B8C]">{s.category}</span>
                      {s.color && <span className="text-xs" style={{ color: "#D4A843" }}>{s.color}</span>}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-3">
                    <div className={`text-sm font-semibold ${s.quantity > 0 ? "text-[#4ADE80]" : "text-[#EF4444]"}`}>{s.quantity || 0} SOH</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function PurchaseOrdersPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedCustomerId = searchParams.get("customer");
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [companyFilter, setCompanyFilter] = useState<"all" | CompanyKey>("all");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerIndex, setPickerIndex] = useState(0);

  const [formData, setFormData] = useState({
    poNumber: "",
    corporateCustomerId: preselectedCustomerId ? parseInt(preselectedCustomerId) : 0,
    orderDate: new Date().toISOString().slice(0, 10),
    dueDate: "",
    memoDate: "",
    lineItems: [] as POLineItem[],
    shippingInstructions: "",
    notes: "",
  });

  const { data: purchaseOrders } = trpc.purchaseOrder.list.useQuery();
  const { data: corporateCustomers } = trpc.corporateCustomer.list.useQuery();
  const { data: stockItems } = trpc.stock.search.useQuery({ query: " " });

  const createPO = trpc.purchaseOrder.create.useMutation({
    onSuccess: async () => { reloadFromStorage(); await utils.purchaseOrder.list.invalidate(); setShowForm(false); resetForm(); },
  });
  const deletePO = trpc.purchaseOrder.delete.useMutation({
    onSuccess: async () => { reloadFromStorage(); await utils.purchaseOrder.list.invalidate(); },
  });

  const filtered = (purchaseOrders || [])
    .filter((po: any) => {
      const q = search.toLowerCase();
      const customer = (corporateCustomers || []).find((c: any) => c.id === po.corporateCustomerId);
      const matchesSearch = !search || po.poNumber?.toLowerCase().includes(q) || customer?.name?.toLowerCase().includes(q);
      const matchesStatus = statusFilter === "all" || po.status === statusFilter;
      const matchesCompany = companyFilter === "all" || (po.company || "sgf") === companyFilter;
      if (preselectedCustomerId) return po.corporateCustomerId === parseInt(preselectedCustomerId) && matchesSearch && matchesStatus && matchesCompany;
      return matchesSearch && matchesStatus && matchesCompany;
    })
    .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  function resetForm() {
    setFormData({
      poNumber: "", corporateCustomerId: preselectedCustomerId ? parseInt(preselectedCustomerId) : 0,
      orderDate: new Date().toISOString().slice(0, 10), dueDate: "", memoDate: "",
      lineItems: [], shippingInstructions: "", notes: "",
    });
  }

  function addLineItem() {
    setFormData(prev => ({
      ...prev,
      lineItems: [...prev.lineItems, {
        customerStockCode: "", customerDescription: "", dueDate: prev.dueDate,
        quantity: 0, uom: "BND", unitPrice: 0, linkedStockItemId: null,
        linkedProductName: "", linkedProductCode: "",
      }],
    }));
  }

  function updateLineItem(index: number, field: keyof POLineItem, value: any) {
    setFormData(prev => ({
      ...prev,
      lineItems: prev.lineItems.map((item, i) => i === index ? { ...item, [field]: value } : item),
    }));
  }

  function linkStockItem(index: number, stockItemId: number) {
    const stock = (stockItems || []).find((s: any) => s.id === stockItemId);
    if (!stock) return;
    setFormData(prev => ({
      ...prev,
      lineItems: prev.lineItems.map((item, i) =>
        i === index
          ? { ...item, linkedStockItemId: stockItemId, linkedProductName: stock.productName || "", linkedProductCode: stock.productCode || "" }
          : item
      ),
    }));
  }

  function removeLineItem(index: number) {
    setFormData(prev => ({ ...prev, lineItems: prev.lineItems.filter((_, i) => i !== index) }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.poNumber.trim() || !formData.corporateCustomerId || formData.lineItems.length === 0) return;
    const customer = (corporateCustomers || []).find((c: any) => c.id === formData.corporateCustomerId);
    const totalExclVat = formData.lineItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    const vatAmount = totalExclVat * 0.15;
    createPO.mutate({
      ...formData,
      corporateCustomerName: customer?.name || "",
      totalExclVat, vatAmount, totalInclVat: totalExclVat + vatAmount,
      status: "received",
    });
  }

  function getCustomerName(customerId: number) {
    const c = (corporateCustomers || []).find((c: any) => c.id === customerId);
    return c?.name || "Unknown";
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white flex items-center gap-2">
            <FileText className="w-5 h-5" style={{ color: "#D4A843" }} />
            Purchase Orders
          </h1>
          <p className="text-sm text-[#8A8B8C] mt-1">Receive POs from corporate customers and link to SGF/Recircle stock</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="btn-gold flex items-center gap-2">
          <Plus className="w-4 h-4" /> Receive PO
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8B8C]" />
          <input type="text" placeholder="Search PO number or customer..." value={search} onChange={(e) => setSearch(e.target.value)} className="input-field pl-10 w-full" />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-[#8A8B8C]" />
          {["all", "received", "in_progress", "fulfilled", "cancelled"].map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${statusFilter === s ? "text-white" : "text-[#8A8B8C] hover:text-white"}`} style={statusFilter === s ? { backgroundColor: "#D4A84333" } : {}}>{s === "all" ? "All" : s.replace("_", " ")}</button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-[#8A8B8C]" />
          {["all", "sgf", "recircle"].map((c) => {
            const cfg = c === "all" ? null : getCompanyConfig(c as CompanyKey);
            const isActive = companyFilter === c;
            return (
              <button key={c} onClick={() => setCompanyFilter(c as any)} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 ${isActive ? "text-white" : "text-[#8A8B8C] hover:text-white"}`} style={isActive ? { backgroundColor: cfg ? cfg.documentColor + "33" : "#D4A84333" } : {}}>
                {c === "all" ? "All" : <><span className="w-2 h-2 rounded-full" style={{ backgroundColor: cfg?.documentColor }} />{cfg?.shortName}</>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {["received", "in_progress", "fulfilled", "cancelled"].map((status) => {
          const count = (purchaseOrders || []).filter((po: any) => po.status === status).length;
          const cfg = STATUS_COLORS[status];
          const Icon = cfg.icon;
          return (
            <div key={status} className="card-glass flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: cfg.bg }}><Icon className="w-5 h-5" style={{ color: cfg.text }} /></div>
              <div><div className="text-lg font-semibold text-white">{count}</div><div className="text-xs text-[#8A8B8C] capitalize">{status.replace("_", " ")}</div></div>
            </div>
          );
        })}
      </div>

      {/* PO List */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="card-glass text-center py-12">
            <FileText className="w-12 h-12 mx-auto mb-3 text-[#8A8B8C] opacity-30" />
            <p className="text-[#8A8B8C]">{search || statusFilter !== "all" ? "No matching purchase orders" : "No purchase orders yet"}</p>
          </div>
        )}
        {filtered.map((po: any) => {
          const cfg = STATUS_COLORS[po.status] || STATUS_COLORS.received;
          const StatusIcon = cfg.icon;
          return (
            <div key={po.id} onClick={() => navigate(`/purchase-order/${po.id}`)} className="card-glass cursor-pointer hover:border-[#333334] transition-all group">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: cfg.bg }}><StatusIcon className="w-5 h-5" style={{ color: cfg.text }} /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-medium text-white">{po.poNumber}</h3>
                      {(() => {
                        const ccfg = getCompanyConfig(po.company);
                        return <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: ccfg.documentColor + "22", color: ccfg.documentColor }}>{ccfg.shortName}</span>;
                      })()}
                      <span className="text-xs px-2 py-0.5 rounded-full capitalize" style={{ backgroundColor: cfg.bg, color: cfg.text }}>{po.status?.replace("_", " ")}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-[#8A8B8C]">
                      <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{getCustomerName(po.corporateCustomerId)}</span>
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{po.orderDate}</span>
                      <span className="flex items-center gap-1"><Package className="w-3 h-3" />{po.lineItems?.length || 0} line(s)</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="text-right">
                    <div className="text-sm font-medium text-white">R {Number(po.totalInclVat || 0).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</div>
                    <div className="text-xs text-[#8A8B8C]">incl. VAT</div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-[#8A8B8C] group-hover:text-white transition-colors" />
                  <button onClick={(e) => { e.stopPropagation(); if (confirm("Delete?")) deletePO.mutate(po.id); }} className="p-1.5 rounded hover:bg-[#222324] opacity-0 group-hover:opacity-100"><Trash2 className="w-3.5 h-3.5 text-[#EF4444]" /></button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Stock Picker Modal */}
      <StockPickerModal
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(id) => linkStockItem(pickerIndex, id)}
        stockItems={stockItems || []}
        selectedId={formData.lineItems[pickerIndex]?.linkedStockItemId || null}
      />

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.7)" }}>
          <div className="modal-content w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Receive Purchase Order</h2>
              <button onClick={() => setShowForm(false)} className="p-1 rounded hover:bg-[#222324]"><X className="w-5 h-5 text-[#8A8B8C]" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Row 1: PO Number */}
              <div>
                <label className="label-text">PO Number *</label>
                <input required value={formData.poNumber} onChange={(e) => setFormData({ ...formData, poNumber: e.target.value })} className="input-field w-full" placeholder="e.g., P01018869" />
              </div>
              {/* Row 2: Corporate Customer */}
              <div>
                <label className="label-text">Corporate Customer *</label>
                <select required value={formData.corporateCustomerId} onChange={(e) => setFormData({ ...formData, corporateCustomerId: parseInt(e.target.value) })} className="input-field w-full">
                  <option value={0}>Select customer...</option>
                  {(corporateCustomers || []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              {/* Row 3: Dates - 3 columns */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="label-text">Order Date</label>
                  <input type="date" value={formData.orderDate} onChange={(e) => setFormData({ ...formData, orderDate: e.target.value })} className="input-field w-full" />
                </div>
                <div>
                  <label className="label-text">Due Date</label>
                  <input type="date" value={formData.dueDate} onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })} className="input-field w-full" />
                </div>
                <div>
                  <label className="label-text">Memo Date</label>
                  <input type="date" value={formData.memoDate} onChange={(e) => setFormData({ ...formData, memoDate: e.target.value })} className="input-field w-full" />
                </div>
              </div>
              {/* Row 4: Shipping Instructions */}
              <div>
                <label className="label-text">Shipping Instructions</label>
                <input value={formData.shippingInstructions} onChange={(e) => setFormData({ ...formData, shippingInstructions: e.target.value })} className="input-field w-full" />
              </div>

              {/* Line Items */}
              <div className="pt-3 border-t border-[#222324]">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h3 className="text-sm font-medium text-white">Line Items</h3>
                    <p className="text-xs text-[#8A8B8C]">Enter customer&apos;s stock code & description from their PO, then link to SGF stock</p>
                  </div>
                  <button type="button" onClick={addLineItem} className="text-xs px-2 py-1 rounded" style={{ color: "#D4A843" }}>+ Add Line</button>
                </div>
                {formData.lineItems.length === 0 && <p className="text-xs text-[#8A8B8C]">No line items yet. Click &quot;Add Line&quot;.</p>}
                <div className="space-y-3">
                  {formData.lineItems.map((item, idx) => (
                    <div key={idx} className="p-3 rounded-lg space-y-2" style={{ backgroundColor: "#131415" }}>
                      {/* Row 1: Customer info */}
                      <div className="grid grid-cols-12 gap-2">
                        <div className="col-span-3">
                          <label className="label-text text-[10px]">Customer Stock Code *</label>
                          <input required value={item.customerStockCode} onChange={(e) => updateLineItem(idx, "customerStockCode", e.target.value)} className="input-field w-full text-xs" placeholder="50101170" />
                        </div>
                        <div className="col-span-5">
                          <label className="label-text text-[10px]">Customer Description *</label>
                          <input required value={item.customerDescription} onChange={(e) => updateLineItem(idx, "customerDescription", e.target.value)} className="input-field w-full text-xs" placeholder="SUPERMARKET SELECT SL" />
                        </div>
                        <div className="col-span-2">
                          <label className="label-text text-[10px]">Qty</label>
                          <input type="number" value={item.quantity || ""} onChange={(e) => updateLineItem(idx, "quantity", parseFloat(e.target.value) || 0)} className="input-field w-full text-xs" />
                        </div>
                        <div className="col-span-1">
                          <label className="label-text text-[10px]">UOM</label>
                          <input value={item.uom} onChange={(e) => updateLineItem(idx, "uom", e.target.value)} className="input-field w-full text-xs" />
                        </div>
                        <div className="col-span-1">
                          <button type="button" onClick={() => removeLineItem(idx)} className="p-1 rounded hover:bg-red-900/30 mt-4"><Trash2 className="w-3 h-3 text-[#EF4444]" /></button>
                        </div>
                      </div>
                      {/* Row 2: Unit price + SGF Stock link */}
                      <div className="grid grid-cols-12 gap-2 items-center">
                        <div className="col-span-3">
                          <label className="label-text text-[10px]">Unit Price (R)</label>
                          <input type="number" step="0.01" value={item.unitPrice || ""} onChange={(e) => updateLineItem(idx, "unitPrice", parseFloat(e.target.value) || 0)} className="input-field w-full text-xs" />
                        </div>
                        <div className="col-span-6">
                          <label className="label-text text-[10px]">Linked SGF/Recircle Stock</label>
                          {item.linkedStockItemId ? (
                            <div className="flex items-center gap-2 px-2 py-1.5 rounded text-xs" style={{ backgroundColor: "#1A8C3F1A" }}>
                              <Link2 className="w-3 h-3 text-[#4ADE80]" />
                              <span className="text-white truncate flex-1">{item.linkedProductName}</span>
                              <span className="text-[#8A8B8C] font-mono">{item.linkedProductCode}</span>
                              <button type="button" onClick={() => updateLineItem(idx, "linkedStockItemId", null)} className="text-[#EF4444] hover:underline ml-1">Unlink</button>
                            </div>
                          ) : (
                            <button type="button" onClick={() => { setPickerIndex(idx); setPickerOpen(true); }} className="w-full text-left px-2 py-1.5 rounded text-xs border border-dashed border-[#444] text-[#8A8B8C] hover:text-white hover:border-[#666] transition-all flex items-center gap-1">
                              <Link2 className="w-3 h-3" /> Click to link SGF/Recircle stock item...
                            </button>
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
                {formData.lineItems.length > 0 && (
                  <div className="flex justify-end gap-4 mt-3 text-sm">
                    <span className="text-[#8A8B8C]">Subtotal: <span className="text-white">R {formData.lineItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</span></span>
                    <span className="text-[#8A8B8C]">VAT (15%): <span className="text-white">R {(formData.lineItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0) * 0.15).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</span></span>
                    <span className="font-medium" style={{ color: "#D4A843" }}>Total: R {(formData.lineItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0) * 1.15).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
              </div>

              <div><label className="label-text">Notes</label><textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} className="input-field w-full" rows={2} /></div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#222324]">
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-gold" disabled={formData.lineItems.length === 0 || !formData.poNumber.trim() || !formData.corporateCustomerId}>Create PO</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
