import { useState, useMemo, useRef, useEffect } from "react";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { reloadFromStorage, generateInvoiceForOrder, dataService, getBankingDetails } from "@/lib/dataService";
import { getCompanyConfig } from "@/lib/companyConfig";
import * as staticData from "@/data/staticData";
import {
 Plus, X, Printer, ChevronDown, ChevronUp, Package, CheckCircle,
 Truck, Ban, Tag, DollarSign, AlertTriangle, FlaskConical,
 ShoppingBag, Pencil, RotateCcw, Info, Search, FileText, Mail,
 Shield,
} from "lucide-react";
const sampleOverrideRef = { current: false };
const PRICE_TIERS = [
 { key: "corporate", label: "Corporate", color: "#D4A843" },
 { key: "bulk", label: "Bulk", color: "#6366F1" },
 { key: "wholesale", label: "Wholesale", color: "#4ADE80" },
 { key: "retail", label: "Retail", color: "#F59E0B" },
];
const STATUS_LABELS: Record<string, { label: string; color: string }> = {
 pending: { label: "Pending", color: "#F59E0B" },
 picking: { label: "Picking", color: "#6366F1" },
 ready: { label: "Ready", color: "#4ADE80" },
 delivered: { label: "Delivered", color: "#4ADE80" },
 cancelled: { label: "Cancelled", color: "#EF4444" },
 sample_delivered: { label: "Sample", color: "#D4A843" },
 draft: { label: "Draft", color: "#8A8B8C" },
 sent: { label: "Sent", color: "#6366F1" },
 accepted: { label: "Accepted", color: "#4ADE80" },
 rejected: { label: "Rejected", color: "#EF4444" },
 converted: { label: "Converted", color: "#D4A843" },
};
function safeNum(n: any, fallback = 0): number {
 const val = Number(n);
 return Number.isFinite(val) ? val : fallback;
}
function GenerateInvoiceButton({ orderId }: { orderId: number }) {
 const [busy, setBusy] = useState(false);
 const utils = trpc.useUtils();
 const { data: liveInvoices } = trpc.invoice.list.useQuery(undefined, {
  refetchInterval: 5000,
  refetchOnMount: "always",
  staleTime: 0,
 });
 const hasInvoice = (liveInvoices || []).some(
  (i: any) => i.orderId == orderId && (i.invoiceNumber?.startsWith("SGF") || i.invoiceNumber?.startsWith("RC"))
 );
 return (
  <button
   onClick={async () => {
    if (busy) return;
    setBusy(true);
    reloadFromStorage();
    const invNum = generateInvoiceForOrder(orderId);
    if (invNum) {
     try {
      const allInv = dataService.invoice.list();
      const newInv = allInv.find((i: any) => i.orderId == orderId && i.invoiceNumber === invNum);
      const allOrd = dataService.order.list();
      const updatedOrd = allOrd.find((o: any) => o.id == orderId);
      const { pushInvoice, pushOrder } = await import("@/lib/firebaseSync");
      if (newInv) await pushInvoice(newInv);
      if (updatedOrd) await pushOrder(updatedOrd);
     } catch (e: any) {
      console.warn("[Invoice] Firebase push:", e?.message);
     }
     await utils.invoice.list.refetch();
     reloadFromStorage();
     alert("Invoice " + invNum + " created and synced!");
    } else {
     alert("Invoice generation is busy. Please wait and try again.");
     setBusy(false);
    }
   }}
   disabled={busy}
   className="btn-secondary text-xs flex items-center gap-1.5"
   style={{
    borderColor: hasInvoice ? "rgba(74,222,128,0.3)" : "rgba(239,68,68,0.5)",
    color: hasInvoice ? "#4ADE80" : busy ? "#8A8B8C" : "#EF4444",
    backgroundColor: hasInvoice ? "rgba(74,222,128,0.08)" : busy ? "rgba(138,139,140,0.08)" : "rgba(239,68,68,0.08)",
    opacity: busy ? 0.6 : 1,
    cursor: busy ? "not-allowed" : "pointer",
   }}
  >
   <FileText className="w-3 h-3" />
   {busy ? "Generating..." : hasInvoice ? "Regenerate Invoice" : "Generate Invoice"}
   {!hasInvoice && !busy && <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444] animate-pulse" />}
  </button>
 );
}
function ProductPickerModal({
 isOpen,
 onClose,
 onSelect,
 stockItems,
 availableStock,
 selectedId,
}: {
 isOpen: boolean;
 onClose: () => void;
 onSelect: (id: number) => void;
 stockItems: any[];
 availableStock: Record<number, number>;
 selectedId: number;
}) {
 const [search, setSearch] = useState("");
 const searchRef = useRef<HTMLInputElement>(null);
 useEffect(() => {
  if (isOpen) {
   setSearch("");
   const isMobile = window.innerWidth < 768 || "ontouchstart" in window;
   if (!isMobile) {
    setTimeout(() => searchRef.current?.focus(), 100);
   }
  }
 }, [isOpen]);
 if (!isOpen) return null;
 const filtered = (stockItems || [])
  .filter((s) => {
   if (!search.trim()) return true;
   const q = search.toLowerCase();
   return (
    s.productName?.toLowerCase().includes(q) ||
    s.productCode?.toLowerCase().includes(q) ||
    s.category?.toLowerCase().includes(q)
   );
  })
  .sort((a, b) => {
   const availA = availableStock[a.id] || 0;
   const availB = availableStock[b.id] || 0;
   if (availA > 0 && availB <= 0) return -1;
   if (availA <= 0 && availB > 0) return 1;
   return (a.productName || "").localeCompare(b.productName || "");
  });
 return (
  <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.8)" }} onClick={onClose}>
   <div
    className="card-surface w-full sm:max-w-lg sm:mx-4 max-h-[85vh] flex flex-col"
    style={{ borderRadius: "16px 16px 0 0", maxHeight: "85vh" }}
    onClick={(e) => e.stopPropagation()}
   >
    <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: "#222324" }}>
     <h3 className="font-display font-semibold text-white text-lg">Select Product</h3>
     <button onClick={onClose} className="p-2 rounded-full hover:bg-[#222324] cursor-pointer">
      <X className="w-5 h-5 text-[#8A8B8C]" />
     </button>
    </div>
    <div className="p-4 border-b" style={{ borderColor: "#222324" }}>
     <div className="relative">
      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#8A8B8C]" />
      <input
       ref={searchRef}
       type="text"
       value={search}
       onChange={(e) => setSearch(e.target.value)}
       placeholder="Search by name, code or category..."
       className="input-field w-full pl-10"
       autoComplete="off"
      />
     </div>
     <div className="flex items-center gap-4 mt-2 text-xs">
      <span className="text-[#4ADE80]">&#9679; In Stock</span>
      <span className="text-[#EF4444]">&#9679; Out of Stock</span>
      <span className="text-[#8A8B8C]">{filtered.length} products</span>
     </div>
    </div>
    <div className="flex-1 overflow-y-auto" style={{ maxHeight: "calc(85vh - 160px)" }}>
     {filtered.length === 0 && (
      <div className="p-8 text-center text-[#8A8B8C] text-sm">No products found</div>
     )}
     {filtered.map((s) => {
      const avail = availableStock[s.id] || 0;
      const isOutOfStock = avail <= 0;
      const isSelected = selectedId === s.id;
      const canSelect = !isOutOfStock || isSelected;
      return (
       <div
        key={s.id}
        onPointerUp={(e) => {
         if (canSelect) {
          onSelect(s.id);
          onClose();
         }
        }}
        className="w-full text-left border-b select-none"
        style={{
         borderColor: "#18191A",
         backgroundColor: isSelected ? "rgba(212, 168, 67, 0.12)" : "transparent",
         opacity: isOutOfStock && !isSelected ? 0.5 : 1,
         minHeight: 56,
         padding: "12px 16px",
         cursor: canSelect ? "pointer" : "not-allowed",
         touchAction: "manipulation",
         WebkitTapHighlightColor: "rgba(212,168,67,0.2)",
        }}
        role="button"
        aria-label={`${s.productName}, ${avail} available`}
       >
        <div className="flex items-center justify-between pointer-events-none">
         <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
           <span
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: isOutOfStock ? "#EF4444" : "#4ADE80" }}
           />
           <span className="text-sm font-body font-medium text-[#E8E8E9] truncate">
            {s.productName}
           </span>
           {isSelected && (
            <span className="text-xs flex-shrink-0 px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(212, 168, 67, 0.2)", color: "#D4A843" }}>
             Selected
            </span>
           )}
          </div>
          <div className="flex items-center gap-3 mt-1 ml-[18px]">
           <span className="text-xs text-[#8A8B8C] font-mono-data">{s.productCode}</span>
           <span className="text-xs text-[#8A8B8C]">{s.category}</span>
           {s.color && <span className="text-xs" style={{ color: "#D4A843" }}>{s.color}</span>}
           {s.description && <span className="text-xs text-[#8A8B8C] truncate max-w-[200px]">{s.description}</span>}
          </div>
         </div>
         <div className="text-right flex-shrink-0 ml-3">
          <div className={`text-sm font-display font-semibold ${isOutOfStock ? "text-[#EF4444]" : "text-[#4ADE80]"}`}>
           {avail} avail
          </div>
          <div className="text-xs text-[#8A8B8C]">SOH: {s.quantity || 0}</div>
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
const statusTabs = [
 { key: "all", label: "All" },
 { key: "pending", label: "Pending" },
 { key: "picking", label: "Picking" },
 { key: "ready", label: "Ready" },
 { key: "delivered", label: "Delivered" },
 { key: "cancelled", label: "Cancelled" },
 { key: "sample", label: "Samples" },
 { key: "quotes", label: "Quotes" },
];
export default function OrdersPage() {
 const { user } = useAuth();
 const { isAdmin, isSalesRep, isSuperAdmin, role } = useRole();
 const myRepName = user?.name || "";
 const banking = getBankingDetails();
 const utils = trpc.useUtils();
 const [activeTab, setActiveTab] = useState("all");
 const [orderSearch, setOrderSearch] = useState("");
 const [expandedOrder, setExpandedOrder] = useState<number | null>(null);
 const [showForm, setShowForm] = useState(false);
 const [editingOrder, setEditingOrder] = useState<any>(null);
 const [formData, setFormData] = useState({
  customerId: 0, orderType: "regular" as "regular" | "sample" | "quote",
  paymentTerms: "cod" as "cod" | "7_days" | "14_days" | "30_days",
  priceTier: "wholesale" as "corporate" | "bulk" | "wholesale" | "retail",
  deliveryAddress: "", notes: "",
  items: [] as { stockItemId: number; quantity: number; unitPrice?: number }[],
 });
 const [customerSearch, setCustomerSearch] = useState("");
 const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
 const customerInputRef = useRef<HTMLInputElement>(null);
 const [adminOverride, setAdminOverride] = useState(false);
 const [adminPin, setAdminPin] = useState("");
 const [productPickerOpen, setProductPickerOpen] = useState(false);
 const [productPickerIndex, setProductPickerIndex] = useState<number>(0);
 const { data: orders } = trpc.order.list.useQuery(undefined, {
  refetchInterval: 5000,
  refetchOnMount: "always",
 });
 const { data: invoices } = trpc.invoice.list.useQuery(undefined, {
  refetchInterval: 5000,
  refetchOnMount: "always",
 });
 const { data: customers } = trpc.customer.search.useQuery({ query: " " });
 const { data: stockItems } = trpc.stock.search.useQuery({ query: " " });
 const { data: stats } = trpc.order.getStats.useQuery();
 const [liveInvoiceOrderIds, setLiveInvoiceOrderIds] = useState<Set<number>>(new Set());
 useEffect(() => {
  function refresh() {
   const allInv = dataService.invoice.list();
   const ids = new Set(allInv.filter((i: any) => i.invoiceNumber?.startsWith("SGF") || i.invoiceNumber?.startsWith("RC")).map((i: any) => Number(i.orderId)));
   setLiveInvoiceOrderIds(ids);
  }
  refresh();
  const interval = setInterval(refresh, 3000);
  window.addEventListener("firebaseDataReceived", refresh);
  return () => { clearInterval(interval); window.removeEventListener("firebaseDataReceived", refresh); };
 }, []);
 const { data: customerSpecialPrices } = trpc.specialPrice.listByCustomer.useQuery(
  { customerId: formData.customerId }, { enabled: formData.customerId > 0 }
 );
 const updateStatus = trpc.order.updateStatus.useMutation({
  onSuccess: async () => {
   reloadFromStorage();
   await utils.order.list.invalidate();
   await utils.order.getStats.invalidate();
   await utils.salesRep.getStats.invalidate();
   await utils.salesRep.getSalesBreakdown.invalidate();
   await utils.stock.search.invalidate();
   await utils.stock.list.invalidate();
   await utils.stock.getStats.invalidate();
   await utils.sampleReport.getAll.invalidate();
  },
 });
 const createOrder = trpc.order.create.useMutation({
  onSuccess: async () => {
   setShowForm(false); setEditingOrder(null); sampleOverrideRef.current = false; resetForm();
   reloadFromStorage();
   utils.order.list.invalidate();
   utils.order.getStats.invalidate();
   utils.salesRep.getStats.invalidate();
   utils.salesRep.getSalesBreakdown.invalidate();
   utils.stock.search.invalidate();
   utils.stock.list.invalidate();
   utils.stock.getStats.invalidate();
   utils.sampleReport.getAll.invalidate();
  },
  onError: (err: any) => {
   alert("Failed to place order: " + (err.message || "Unknown error. Please check console for details."));
   console.error("[createOrder] error:", err);
  },
  onSettled: () => {
   setShowForm(false); setEditingOrder(null); sampleOverrideRef.current = false;
  },
 });
 const updateOrder = trpc.order.update.useMutation({
  onSuccess: async () => {
   setShowForm(false); setEditingOrder(null); sampleOverrideRef.current = false; resetForm();
   reloadFromStorage();
   await utils.order.list.invalidate();
   await utils.order.getStats.invalidate();
   await utils.salesRep.getStats.invalidate();
   await utils.salesRep.getSalesBreakdown.invalidate();
   await utils.stock.search.invalidate();
   await utils.stock.list.invalidate();
   await utils.stock.getStats.invalidate();
   await utils.sampleReport.getAll.invalidate();
  },
  onError: (err: any) => {
   alert("Failed to update order: " + (err.message || "Unknown error"));
   console.error("[updateOrder] error:", err);
  },
  onSettled: () => {
   setShowForm(false); setEditingOrder(null); sampleOverrideRef.current = false;
  },
 });
 const deleteOrder = trpc.order.delete.useMutation({
  onSuccess: () => {
   utils.order.list.invalidate();
   utils.order.getStats.invalidate();
  },
  onError: (err: any) => {
   alert("Failed to delete order: " + (err.message || "Unknown error"));
  },
 });
 const allCustomers = useMemo(() => {
  const merged = [...(customers || [])];
  const corpList = (customers || []).filter((c: any) => c.customerType === "corporate");
  corpList.forEach((c: any) => {
   if (!merged.find((m: any) => m.id === c.id)) merged.push(c);
  });
  return merged;
 }, [customers]);
 const filteredCustomers = useMemo(() => {
  if (!customerSearch.trim()) return allCustomers;
  const q = customerSearch.toLowerCase();
  return allCustomers.filter((c: any) =>
   (c.name || "").toLowerCase().includes(q) ||
   (c.companyName || "").toLowerCase().includes(q) ||
   (c.contactPerson || "").toLowerCase().includes(q) ||
   (c.phone || "").toLowerCase().includes(q)
  );
 }, [allCustomers, customerSearch]);
 const selectedCustomer = useMemo(() => {
  return allCustomers.find((c: any) => c.id === formData.customerId);
 }, [allCustomers, formData.customerId]);
 const committedStock = useMemo(() => {
  const map: Record<number, number> = {};
  (orders || []).forEach((order: any) => {
   if (order.status === "cancelled" || order.status === "delivered") return;
   (order.items || []).forEach((item: any) => {
    const stockId = Number(item.stockItemId);
    const conversion = item.conversion || 1;
    const qty = Number(item.quantity) || 0;
    if (!map[stockId]) map[stockId] = 0;
    map[stockId] += qty * conversion;
   });
  });
  return map;
 }, [orders]);
 const availableStock = useMemo(() => {
  const map: Record<number, number> = {};
  (stockItems || []).forEach((item: any) => {
   const id = Number(item.id);
   const current = Number(item.currentStock) || 0;
   const committed = committedStock[id] || 0;
   map[id] = Math.max(0, current - committed);
  });
  return map;
 }, [stockItems, committedStock]);
 const productOrderStatuses = useMemo(() => {
  const map: Record<number, { orderNumber: string; qty: number }[]> = {};
  (orders || []).forEach((order: any) => {
   if (order.status === "cancelled" || order.status === "delivered") return;
   (order.items || []).forEach((item: any) => {
    const stockId = Number(item.stockItemId);
    if (!map[stockId]) map[stockId] = [];
    map[stockId].push({ orderNumber: order.orderNumber || `#${order.id}`, qty: Number(item.quantity) || 0 });
   });
  });
  return map;
 }, [orders]);
 function getTierPrice(stockItemId: number | string, tier?: string): number {
  const item = (stockItems || []).find((s: any) => Number(s.id) === Number(stockItemId));
  if (!item) return 0;
  const t = tier || formData.priceTier || "wholesale";
  switch (t) {
   case "retail": return Number(item.retailPrice) || 0;
   case "wholesale": return Number(item.wholesalePrice) || 0;
   case "corporate": return Number(item.corporatePrice) || 0;
   case "bulk": return Number(item.bulkPrice) || 0;
   default: return Number(item.wholesalePrice) || 0;
  }
 }
 function getEffectivePrice(stockItemId: number, customPrice?: number): number {
  if (customPrice !== undefined && customPrice > 0) return customPrice;
  return getTierPrice(stockItemId, formData.priceTier);
 }
 function getPriceBreakdown(stockItemId: number, quantity: number) {
  const unitPrice = getEffectivePrice(stockItemId);
  const subtotal = unitPrice * quantity;
  const vat = subtotal * 0.15;
  const total = subtotal + vat;
  return { unitPrice, subtotal, vat, total, basePrice: unitPrice };
 }
 function resetForm() {
  setFormData({
   customerId: 0, orderType: "regular", paymentTerms: "cod",
   priceTier: "wholesale", deliveryAddress: "", notes: "",
   items: [],
  });
  setCustomerSearch("");
  setAdminOverride(false);
  setAdminPin("");
 }
 function canPlaceOrder(): { valid: boolean; error?: string } {
  const validItems = formData.items.filter((i) => i.stockItemId > 0 && i.quantity > 0);
  if (validItems.length === 0) return { valid: false, error: "Add at least one item" };
  if (formData.customerId === 0) return { valid: false, error: "Select a customer" };
  if (formData.orderType === "quote") return { valid: true };
  for (const item of validItems) {
   const stockId = item.stockItemId;
   const avail = availableStock[stockId] || 0;
   const conversion = item.conversion || 1;
   const requestedQty = item.quantity * conversion;
   if (avail <= 0) { const s = (stockItems || []).find((x: any) => Number(x.id) === stockId); return { valid: false, error: `${s?.productName || "Product"} is OUT OF STOCK.` }; }
   if (formData.orderType === "sample") {
    const existing = (orders || []).some((o: any) =>
     o.id !== editingOrder?.id &&
     o.customerId === formData.customerId &&
     o.orderType === "sample" &&
     o.items?.some((it: any) => Number(it.stockItemId) === stockId)
    );
    if (existing) { const s = (stockItems || []).find((x: any) => Number(x.id) === stockId); return { valid: false, error: `Customer already sampled ${s?.productName || "this product"}.` }; }
    if (item.quantity > 1 && !sampleOverrideRef.current) return { valid: false, error: "Sample orders: 1 unit per product max. Only Super Admin can override." };
   } else {
    if (requestedQty > avail) { const s = (stockItems || []).find((x: any) => Number(x.id) === stockId); return { valid: false, error: `Insufficient stock for ${s?.productName || "product"}. Available: ${avail} kg, Requested: ${requestedQty} kg (${item.quantity} units)` }; }
   }
  }
  const customer = (customers || []).find((c: any) => c.id === formData.customerId);
  if (customer) {
   if (customer.isActive === false && !isSuperAdmin && !adminOverride) {
    return { valid: false, error: `Customer account is INACTIVE. Only Super Admin can place orders for inactive customers.` };
   }
   const creditLimit = Number(customer.creditLimit || 0);
   if (creditLimit > 0 && formData.paymentTerms !== "cod") {
    const outstanding = (invoices || [])
     .filter((inv: any) => inv.customerId == customer.id && inv.status !== "cancelled" && (inv.balanceDue || 0) > 0.01)
     .reduce((sum: number, inv: any) => sum + (inv.balanceDue || 0), 0);
    if (outstanding >= creditLimit && !isSuperAdmin && !adminOverride) {
     return { valid: false, error: `Credit limit exceeded. Limit: R ${creditLimit.toFixed(2)}, Outstanding: R ${outstanding.toFixed(2)}. Only Super Admin can override.` };
    }
   }
   if (formData.paymentTerms === "cod") {
    const twoDaysAgo = new Date(Date.now() - 2 * 86400000);
    const unpaidCOD = (invoices || [])
     .filter((inv: any) => {
      if (inv.customerId != customer.id) return false;
      if (inv.status === "cancelled") return false;
      if ((inv.balanceDue || 0) <= 0.01) return false;
      return new Date(inv.invoiceDate || inv.createdAt) < twoDaysAgo;
     });
    if (unpaidCOD.length > 0 && !isSuperAdmin && !adminOverride) {
     const totalUnpaid = unpaidCOD.reduce((s: number, inv: any) => s + (inv.balanceDue || 0), 0);
     return { valid: false, error: `COD account has unpaid invoices older than 2 days (R ${totalUnpaid.toFixed(2)}). Settle in full before placing new orders. Only Super Admin can override.` };
    }
   }
  }
  return { valid: true };
 }
 function startEditOrder(order: any) {
  setEditingOrder(order);
  setFormData({
   customerId: order.customerId || 0,
   orderType: order.orderType || "regular",
   paymentTerms: order.paymentTerms || "cod",
   priceTier: order.priceTier || "wholesale",
   deliveryAddress: order.deliveryAddress || "",
   notes: order.notes || "",
   items: (order.items || []).map((item: any) => ({
    stockItemId: Number(item.stockItemId) || 0,
    quantity: Number(item.quantity) || 0,
    unitPrice: item.unitPrice ? Number(item.unitPrice) : undefined,
   })),
  });
  setCustomerSearch(order.customer?.name || "");
  setAdminOverride(order.superAdminOverride || false);
  setAdminPin("");
  setShowForm(true);
 }
 function handleSubmit(e: React.FormEvent) {
  e.preventDefault();
  const check = editingOrder ? canEditOrderBasic() : canPlaceOrder();
  if (!check.valid) { alert(check.error); return; }
  const payload: any = {
   customerId: formData.customerId,
   orderType: formData.orderType,
   paymentTerms: formData.paymentTerms,
   priceTier: formData.priceTier,
   deliveryAddress: formData.deliveryAddress,
   notes: formData.notes,
   items: formData.items
    .filter((i) => i.stockItemId > 0 && i.quantity > 0)
    .map((i) => ({
     stockItemId: i.stockItemId,
     quantity: i.quantity,
     unitPrice: i.unitPrice,
    })),
  };
  if (!editingOrder) {
   payload.salesRepName = customer?.salesRepName || user?.name || "";
   if (adminOverride) {
    payload.adminApproved = true;
   }
   if (isSuperAdmin && adminOverride && adminPin) {
    payload.superAdminOverride = true;
   }
  }
  if (editingOrder) {
   updateOrder.mutate({ id: editingOrder.id, data: payload });
  } else {
   createOrder.mutate(payload);
  }
 }
 function canEditOrderBasic(): { valid: boolean; error?: string } {
  if (formData.customerId === 0) return { valid: false, error: "Select a customer" };
  const validItems = formData.items.filter((i) => i.stockItemId > 0 && i.quantity > 0);
  if (validItems.length === 0) return { valid: false, error: "Add at least one item" };
  return { valid: true };
 }
 function canEditOrder(order: any): boolean {
  if (order.orderType === "quote") {
   if (order.status === "converted" || order.status === "rejected") return false;
   return isAdmin;
  }
  return isAdmin;
 }
 function canCancelOrder(order: any): boolean {
  if (order.orderType === "quote") {
   if (order.status === "converted" || order.status === "rejected") return false;
   return isAdmin;
  }
  return isAdmin && order.status !== "cancelled";
 }
 function canProgressOrder(order: any): boolean {
  if (order.orderType === "quote") return false;
  if (!isAdmin) return false;
  if (order.status === "delivered" || order.status === "cancelled") return false;
  return true;
 }
 function getCustomer(order: any) {
  return allCustomers.find((c: any) => c.id === order.customerId);
 }
 const tabCounts = useMemo(() => {
  const counts: Record<string, number> = { all: (orders || []).length };
  statusTabs.forEach((tab) => {
   if (tab.key === "all") return;
   if (tab.key === "sample") {
    counts[tab.key] = (orders || []).filter((o: any) => o.orderType === "sample").length;
   } else if (tab.key === "quotes") {
    counts[tab.key] = (orders || []).filter((o: any) => o.orderType === "quote").length;
   } else {
    counts[tab.key] = (orders || []).filter((o: any) => o.status === tab.key).length;
   }
  });
  return counts;
 }, [orders]);
 const filteredOrders = useMemo(() => {
  let list = [...(orders || [])];
  if (activeTab !== "all") {
   if (activeTab === "sample") {
    list = list.filter((o: any) => o.orderType === "sample");
   } else if (activeTab === "quotes") {
    list = list.filter((o: any) => o.orderType === "quote");
   } else {
    list = list.filter((o: any) => o.status === activeTab);
   }
  }
  if (orderSearch.trim()) {
   const q = orderSearch.toLowerCase();
   list = list.filter((o: any) => {
    const c = getCustomer(o);
    return (
     (o.orderNumber || "").toLowerCase().includes(q) ||
     (c?.name || "").toLowerCase().includes(q) ||
     (c?.companyName || "").toLowerCase().includes(q)
    );
   });
  }
  return list.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
 }, [orders, activeTab, orderSearch]);
 const subtotal = useMemo(() => {
  return formData.items.reduce((sum, item) => {
   const price = getEffectivePrice(item.stockItemId, item.unitPrice);
   return sum + (item.quantity * price);
  }, 0);
 }, [formData.items, formData.priceTier, stockItems, customerSpecialPrices]);
 const vatRate = 0.15;
 const vatAmount = subtotal * vatRate;
 const totalWithVat = subtotal + vatAmount;
 function printIt(content: string, title = "Print") {
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(content);
  w.document.close();
  setTimeout(() => { w.print(); }, 500);
 }
 function printPickingSlip(order: any) {
  const customer = getCustomer(order);
  const items = order.items || [];
  const date = new Date(order.createdAt).toLocaleDateString();
  const html = `
<!DOCTYPE html>
<html>
<head>
<title>Picking Slip - ${order.orderNumber || order.id}</title>
<style>
body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
.header { border-bottom: 2px solid #D4A843; padding-bottom: 10px; margin-bottom: 20px; }
.header h1 { margin: 0; color: #D4A843; font-size: 24px; }
.header p { margin: 5px 0; color: #666; }
table { width: 100%; border-collapse: collapse; margin-top: 20px; }
th { background: #f5f5f5; border: 1px solid #ddd; padding: 10px; text-align: left; font-weight: bold; }
td { border: 1px solid #ddd; padding: 10px; }
.footer { margin-top: 30px; padding-top: 10px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
</style>
</head>
<body>
<div class="header">
<h1>PICKING SLIP</h1>
<p><strong>Order:</strong> #${order.orderNumber || order.id}</p>
<p><strong>Date:</strong> ${date}</p>
<p><strong>Customer:</strong> ${customer?.name || "N/A"}</p>
<p><strong>Delivery:</strong> ${order.deliveryAddress || "Warehouse Collection"}</p>
</div>
<table>
<thead>
<tr>
<th>Product</th>
<th>Code</th>
<th>Qty</th>
<th>Checked</th>
</tr>
</thead>
<tbody>
${items.map((item: any) => {
  const stock = (stockItems || []).find((s: any) => s.id == item.stockItemId);
  return `<tr>
<td>${stock?.productName || "Unknown"}</td>
<td>${stock?.productCode || "N/A"}</td>
<td>${item.quantity}</td>
<td style="width: 60px; text-align: center;">&#9744;</td>
</tr>`;
}).join("")}
</tbody>
</table>
<div class="footer">
<p><strong>Notes:</strong> ${order.notes || "None"}</p>
<p>Printed: ${new Date().toLocaleString()}</p>
</div>
</body>
</html>
`;
  printIt(html, "Picking Slip");
 }
 function printQuote(order: any) {
  const customer = getCustomer(order);
  const items = order.items || [];
  const date = new Date(order.createdAt).toLocaleDateString();
  const company = getCompanyConfig();
  const html = `
<!DOCTYPE html>
<html>
<head>
<title>Quote - ${order.orderNumber || order.id}</title>
<style>
body { font-family: Arial, sans-serif; margin: 40px; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; }
.header { text-align: center; border-bottom: 3px solid #D4A843; padding-bottom: 20px; margin-bottom: 30px; }
.header h1 { margin: 0; color: #D4A843; font-size: 32px; }
.header h2 { margin: 10px 0; color: #666; font-size: 18px; }
.details { display: flex; justify-content: space-between; margin-bottom: 30px; }
.details div { flex: 1; }
.details h3 { margin: 0 0 10px 0; color: #D4A843; font-size: 14px; text-transform: uppercase; }
.details p { margin: 5px 0; font-size: 14px; }
table { width: 100%; border-collapse: collapse; margin: 20px 0; }
th { background: #f8f8f8; border-bottom: 2px solid #D4A843; padding: 12px; text-align: left; font-weight: bold; }
td { border-bottom: 1px solid #eee; padding: 12px; }
.total { text-align: right; margin-top: 20px; }
.total .row { display: flex; justify-content: flex-end; gap: 20px; margin: 5px 0; }
.total .grand { font-size: 20px; font-weight: bold; color: #D4A843; margin-top: 10px; padding-top: 10px; border-top: 2px solid #D4A843; }
.terms { margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
.footer { margin-top: 40px; text-align: center; font-size: 12px; color: #999; }
</style>
</head>
<body>
<div class="header">
<h1>${company.name || "Supreme Global Foods"}</h1>
<h2>QUOTATION</h2>
</div>
<div class="details">
<div>
<h3>Quote To</h3>
<p><strong>${customer?.name || "N/A"}</strong></p>
<p>${customer?.companyName || ""}</p>
<p>${customer?.phone || ""}</p>
<p>${customer?.email || ""}</p>
</div>
<div style="text-align: right;">
<h3>Quote Details</h3>
<p><strong>Quote #:</strong> ${order.orderNumber || order.id}</p>
<p><strong>Date:</strong> ${date}</p>
<p><strong>Valid For:</strong> 30 Days</p>
<p><strong>Payment Terms:</strong> ${order.paymentTerms?.replace(/_/g, " ") || "COD"}</p>
</div>
</div>
<table>
<thead>
<tr>
<th>Item</th>
<th>Description</th>
<th>Qty</th>
<th>Unit Price</th>
<th>Total</th>
</tr>
</thead>
<tbody>
${items.map((item: any, idx: number) => {
  const stock = (stockItems || []).find((s: any) => s.id == item.stockItemId);
  const total = (item.unitPrice || 0) * item.quantity;
  return `<tr>
<td>${idx + 1}</td>
<td>${stock?.productName || "Unknown"} (${stock?.productCode || "N/A"})</td>
<td>${item.quantity}</td>
<td>R ${(item.unitPrice || 0).toFixed(2)}</td>
<td>R ${total.toFixed(2)}</td>
</tr>`;
}).join("")}
</tbody>
</table>
<div class="total">
<div class="row"><span>Subtotal:</span><span>R ${safeNum(order.subtotal).toFixed(2)}</span></div>
<div class="row"><span>VAT (15%):</span><span>R ${safeNum(order.vatAmount).toFixed(2)}</span></div>
<div class="row grand"><span>Total:</span><span>R ${safeNum(order.totalAmount).toFixed(2)}</span></div>
</div>
<div class="terms">
<p><strong>Terms & Conditions</strong></p>
<p>1. This quotation is valid for 30 days from the date of issue.</p>
<p>2. Prices are subject to change without notice after the validity period.</p>
<p>3. Payment terms: ${order.paymentTerms?.replace(/_/g, " ") || "COD"}</p>
<p>4. Delivery address: ${order.deliveryAddress || "Warehouse Collection"}</p>
</div>
<div class="footer">
<p>${company.name || "Supreme Global Foods"} | ${company.phone || ""} | ${company.email || ""}</p>
<p>${company.address || ""}</p>
<p>Bank: ${banking.bankName || "N/A"} | Acc: ${banking.accountNumber || "N/A"} | Branch: ${banking.branchCode || "N/A"}</p>
</div>
</body>
</html>
`;
  printIt(html, "Quote");
 }
 function sendQuoteEmail(order: any) {
  const customer = getCustomer(order);
  const items = order.items || [];
  const company = getCompanyConfig();
  const subject = `Quote #${order.orderNumber || order.id} - ${company.name || "Supreme Global Foods"}`;
  const itemsHtml = items.map((item: any) => {
   const stock = (stockItems || []).find((s: any) => s.id == item.stockItemId);
   const total = (item.unitPrice || 0) * item.quantity;
   return `<tr>
<td style="padding: 10px; border: 1px solid #ddd;">${stock?.productName || "Unknown"}</td>
<td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${item.quantity}</td>
<td style="padding: 10px; border: 1px solid #ddd; text-align: right;">R ${(item.unitPrice || 0).toFixed(2)}</td>
<td style="padding: 10px; border: 1px solid #ddd; text-align: right;">R ${total.toFixed(2)}</td>
</tr>`;
  }).join("");
  const body = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
<h2 style="color: #D4A843; border-bottom: 2px solid #D4A843; padding-bottom: 10px;">Quotation</h2>
<p>Dear ${customer?.name || "Customer"},</p>
<p>Please find your quotation below:</p>
<table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
<thead>
<tr style="background: #f5f5f5;">
<th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Product</th>
<th style="padding: 10px; border: 1px solid #ddd;">Qty</th>
<th style="padding: 10px; border: 1px solid #ddd; text-align: right;">Unit Price</th>
<th style="padding: 10px; border: 1px solid #ddd; text-align: right;">Total</th>
</tr>
</thead>
<tbody>
${itemsHtml}
</tbody>
</table>
<div style="text-align: right;">
<p><strong>Subtotal:</strong> R ${safeNum(order.subtotal).toFixed(2)}</p>
<p><strong>VAT (15%):</strong> R ${safeNum(order.vatAmount).toFixed(2)}</p>
<p style="font-size: 18px; color: #D4A843;"><strong>Total: R ${safeNum(order.totalAmount).toFixed(2)}</strong></p>
</div>
<p style="margin-top: 30px; font-size: 12px; color: #666;">
This quote is valid for 30 days.<br/>
Payment terms: ${order.paymentTerms?.replace(/_/g, " ") || "COD"}<br/>
Delivery: ${order.deliveryAddress || "Warehouse Collection"}
</p>
<p style="margin-top: 20px;">
Best regards,<br/>
${company.name || "Supreme Global Foods"}<br/>
${company.phone || ""}<br/>
${company.email || ""}
</p>
</div>
`;
  const mailto = `mailto:${customer?.email || ""}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.open(mailto, "_blank");
 }
 function handleCustomerSelect(c: any) {
  setFormData((prev) => ({ ...prev, customerId: c.id }));
  setCustomerSearch(c.name || "");
  setShowCustomerDropdown(false);
 }
 function handleOpenCustomerDropdown() {
  setShowCustomerDropdown(true);
 }
 function handleAddItem() {
  setFormData((prev) => ({
   ...prev,
   items: [...prev.items, { stockItemId: 0, quantity: 1 }],
  }));
 }
 function handleRemoveItem(idx: number) {
  setFormData((prev) => ({
   ...prev,
   items: prev.items.filter((_, i) => i !== idx),
  }));
 }
 if (!orders) {
  return (
   <div className="space-y-4">
    <div className="h-8 w-48 bg-[#222324] rounded animate-pulse" />
    <div className="h-64 bg-[#222324] rounded animate-pulse" />
   </div>
  );
 }
 return (
  <div className="space-y-4">
   <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
    <div>
     <h1 className="font-display text-2xl font-bold text-white">Orders</h1>
     <p className="text-sm text-[#8A8B8C] mt-1">Manage orders, quotes, and samples</p>
    </div>
    <button
     onClick={() => { setEditingOrder(null); resetForm(); setShowForm(true); }}
     className="btn-primary flex items-center gap-2"
    >
     <Plus className="w-4 h-4" /> New Order
    </button>
   </div>
   <div className="flex flex-wrap gap-2">
    {statusTabs.map((tab) => (
     <button
      key={tab.key}
      onClick={() => setActiveTab(tab.key)}
      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
       activeTab === tab.key
        ? "bg-[#D4A843] text-black"
        : "bg-[#18191A] text-[#8A8B8C] hover:text-white border border-[#222324]"
      }`}
     >
      {tab.label} {tabCounts[tab.key] > 0 && <span className="text-xs opacity-70">({tabCounts[tab.key]})</span>}
     </button>
    ))}
   </div>
   <div className="relative">
    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8B8C]" />
    <input
     type="text"
     value={orderSearch}
     onChange={(e) => setOrderSearch(e.target.value)}
     placeholder="Search orders..."
     className="input-field pl-10 w-full"
    />
   </div>
   <div className="space-y-2">
    {filteredOrders.length === 0 && (
     <div className="text-center py-12 text-[#8A8B8C]">
      <Package className="w-12 h-12 mx-auto mb-4 opacity-30" />
      <p className="text-lg font-medium">No orders found</p>
      <p className="text-sm mt-1">{orderSearch ? "Try adjusting your search" : "Create your first order to get started"}</p>
     </div>
    )}
    {filteredOrders.map((order: any) => {
     const customer = getCustomer(order);
     const isQuote = order.orderType === "quote";
     const isSample = order.orderType === "sample";
     const isExpanded = expandedOrder === order.id;
     return (
      <div key={order.id} className="card overflow-hidden">
       <div
        className="p-4 cursor-pointer"
        onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
       >
        <div className="flex items-start justify-between gap-4">
         <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
           <span className="font-display font-semibold text-white">#{order.orderNumber || order.id}</span>
           <span
            className="px-2 py-0.5 rounded-full text-xs font-medium border"
            style={{
             backgroundColor: STATUS_LABELS[order.status]?.color + "20" || "#F59E0B20",
             color: STATUS_LABELS[order.status]?.color || "#F59E0B",
             borderColor: (STATUS_LABELS[order.status]?.color || "#F59E0B") + "40",
            }}
           >
            {STATUS_LABELS[order.status]?.label || order.status}
           </span>
           {isQuote && <span className="px-2 py-0.5 rounded-full text-xs bg-[#6366F1]/20 text-[#6366F1] border border-[#6366F1]/30">Quote</span>}
           {isSample && <span className="px-2 py-0.5 rounded-full text-xs bg-[#D4A843]/20 text-[#D4A843] border border-[#D4A843]/30">Sample</span>}
           {order.superAdminOverride && <span className="px-2 py-0.5 rounded-full text-xs bg-[#D4A843]/20 text-[#D4A843] border border-[#D4A843]/30">Admin Override</span>}
          </div>
          <div className="mt-1 text-sm text-[#8A8B8C]">
           <span className="text-white">{customer?.name || "Unknown"}</span>
           <span className="mx-2">&#183;</span>
           <span>{new Date(order.createdAt).toLocaleDateString()}</span>
           <span className="mx-2">&#183;</span>
           <span className="capitalize">{order.paymentTerms?.replace(/_/g, " ")}</span>
          </div>
         </div>
         <div className="text-right">
          <div className="font-display font-semibold text-white">R {safeNum(order.totalAmount).toFixed(2)}</div>
          <div className="text-xs text-[#8A8B8C]">{order.items?.length || 0} items</div>
         </div>
        </div>
       </div>
       {isExpanded && (
        <div className="px-4 pb-4 border-t" style={{ borderColor: "#222324" }}>
         <div className="mt-3 space-y-2">
          {(order.items || []).map((item: any, idx: number) => {
           const stock = (stockItems || []).find((s: any) => s.id == item.stockItemId);
           return (
            <div key={idx} className="flex items-center justify-between text-sm">
             <span className="text-[#8A8B8C]">{stock?.productName || "Unknown"} &#215; {item.quantity}</span>
             <span className="text-white">R {safeNum(item.unitPrice * item.quantity).toFixed(2)}</span>
            </div>
           );
          })}
          <div className="flex justify-between text-sm font-medium pt-2 border-t" style={{ borderColor: "#222324" }}>
           <span className="text-[#8A8B8C]">Subtotal</span>
           <span className="text-white">R {safeNum(order.subtotal).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
           <span className="text-[#8A8B8C]">VAT (15%)</span>
           <span className="text-white">R {safeNum(order.vatAmount).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-base font-display font-bold">
           <span className="text-white">Total</span>
           <span className="text-[#D4A843]">R {safeNum(order.totalAmount).toFixed(2)}</span>
          </div>
         </div>
         <div className="mt-4 flex flex-wrap gap-2">
          {canProgressOrder(order) && (
           <button
            onClick={() => {
             const flow = ["pending", "picking", "ready", "delivered"];
             const idx = flow.indexOf(order.status);
             if (idx >= 0 && idx < flow.length - 1) {
              updateStatus.mutate({ id: order.id, status: flow[idx + 1] });
             }
            }}
            className="btn-primary text-xs flex items-center gap-1"
           >
            <Truck className="w-3 h-3" /> Progress
           </button>
          )}
          <button onClick={() => printPickingSlip(order)} className="btn-secondary text-xs flex items-center gap-1">
           <Printer className="w-3 h-3" /> Picking Slip
          </button>
          {isQuote && (
           <>
            <button onClick={() => printQuote(order)} className="btn-secondary text-xs flex items-center gap-1">
             <Printer className="w-3 h-3" /> Print Quote
            </button>
            <button onClick={() => sendQuoteEmail(order)} className="btn-secondary text-xs flex items-center gap-1">
             <Mail className="w-3 h-3" /> Email Quote
            </button>
           </>
          )}
          <GenerateInvoiceButton orderId={order.id} />
          {canEditOrder(order) && (
           <button onClick={() => startEditOrder(order)} className="btn-secondary text-xs flex items-center gap-1">
            <Pencil className="w-3 h-3" /> Edit
           </button>
          )}
          {canCancelOrder(order) && (
           <button
            onClick={() => { if (confirm("Cancel this order?")) deleteOrder.mutate(order.id); }}
            className="btn-danger text-xs flex items-center gap-1"
           >
            <Ban className="w-3 h-3" /> Cancel
           </button>
          )}
         </div>
        </div>
       )}
      </div>
     );
    })}
   </div>
   {showForm && (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.8)" }} onClick={() => { setShowForm(false); setEditingOrder(null); sampleOverrideRef.current = false; resetForm(); }}>
     <div className="card-surface w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: "#222324" }}>
       <h2 className="font-display text-xl font-bold text-white">
        {editingOrder ? "Edit Order" : "New Order"}
       </h2>
       <button
        onClick={() => { setShowForm(false); setEditingOrder(null); sampleOverrideRef.current = false; resetForm(); }}
        className="p-2 rounded-full hover:bg-[#222324] cursor-pointer"
       >
        <X className="w-5 h-5 text-[#8A8B8C]" />
       </button>
      </div>
      <form onSubmit={handleSubmit} className="p-6 space-y-6">
       <div className="space-y-2">
        <label className="text-sm font-medium text-white">Customer</label>
        <div className="relative">
         <input
          ref={customerInputRef}
          type="text"
          value={customerSearch}
          onChange={(e) => { setCustomerSearch(e.target.value); setShowCustomerDropdown(true); }}
          onFocus={() => setShowCustomerDropdown(true)}
          placeholder="Search customer..."
          className="input-field w-full"
          autoComplete="off"
         />
         {showCustomerDropdown && (
          <div className="absolute z-10 w-full mt-1 card-surface max-h-60 overflow-y-auto" style={{ border: "1px solid #222324" }}>
           {filteredCustomers.length === 0 && (
            <div className="p-3 text-sm text-[#8A8B8C]">No customers found</div>
           )}
           {filteredCustomers.map((c: any) => (
            <div
             key={`${c._type}-${c.id}`}
             onClick={() => handleCustomerSelect(c)}
             className="p-3 hover:bg-[#222324] cursor-pointer border-b"
             style={{ borderColor: "#18191A" }}
            >
             <div className="flex items-center justify-between">
              <span className="text-sm text-white font-medium">{c.name}</span>
              <span className="text-xs text-[#8A8B8C]">{c._type === "corporate" ? "Corporate" : "Regular"}</span>
             </div>
             <div className="text-xs text-[#8A8B8C] mt-0.5">{c.contactPerson} &#183; {c.phone}</div>
            </div>
           ))}
          </div>
         )}
        </div>
        {selectedCustomer && (
         <div className="flex items-center gap-2 text-sm">
          <span className="text-[#8A8B8C]">Selected:</span>
          <span className="text-white font-medium">{selectedCustomer.name}</span>
          {selectedCustomer.isActive === false && (
           <span className="px-2 py-0.5 rounded-full text-xs bg-[#EF4444]/20 text-[#EF4444]">INACTIVE</span>
          )}
         </div>
        )}
       </div>
       <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-2">
         <label className="text-sm font-medium text-white">Order Type</label>
         <select
          value={formData.orderType}
          onChange={(e) => setFormData((prev) => ({ ...prev, orderType: e.target.value as any }))}
          className="input-field w-full"
         >
          <option value="regular">Regular</option>
          <option value="sample">Sample</option>
          <option value="quote">Quote</option>
         </select>
        </div>
        <div className="space-y-2">
         <label className="text-sm font-medium text-white">Payment Terms</label>
         <select
          value={formData.paymentTerms}
          onChange={(e) => setFormData((prev) => ({ ...prev, paymentTerms: e.target.value as any }))}
          className="input-field w-full"
         >
          <option value="cod">COD</option>
          <option value="7_days">7 Days</option>
          <option value="14_days">14 Days</option>
          <option value="30_days">30 Days</option>
         </select>
        </div>
        <div className="space-y-2">
         <label className="text-sm font-medium text-white">Price Tier</label>
         <select
          value={formData.priceTier}
          onChange={(e) => setFormData((prev) => ({ ...prev, priceTier: e.target.value as any }))}
          className="input-field w-full"
         >
          {PRICE_TIERS.map((t) => (
           <option key={t.key} value={t.key}>{t.label}</option>
          ))}
         </select>
        </div>
       </div>
       <div className="space-y-2">
        <label className="text-sm font-medium text-white">Delivery Address</label>
        <input
         type="text"
         value={formData.deliveryAddress}
         onChange={(e) => setFormData((prev) => ({ ...prev, deliveryAddress: e.target.value }))}
         placeholder="Leave blank for warehouse collection"
         className="input-field w-full"
        />
       </div>
       <div className="space-y-2">
        <label className="text-sm font-medium text-white">Notes</label>
        <textarea
         value={formData.notes}
         onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
         placeholder="Any special instructions..."
         rows={2}
         className="input-field w-full"
        />
       </div>
       {isAdmin && formData.orderType !== "sample" && formData.orderType !== "quote" && (
        <div className="p-3 rounded-lg text-sm" style={{ backgroundColor: "rgba(212, 168, 67, 0.08)", border: "1px solid rgba(212, 168, 67, 0.3)" }}>
         <div className="flex items-start gap-2 mb-2">
          <Shield className="w-4 h-4 text-[#D4A843] flex-shrink-0 mt-0.5" />
          <div className="text-[#D4A843]">
           <strong>Admin Override</strong>
           <div className="text-xs mt-1 opacity-80">Check and enter PIN to bypass inactive / credit-limit / COD restrictions</div>
          </div>
         </div>
         <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
           type="checkbox"
           checked={adminOverride}
           onChange={(e) => { setAdminOverride(e.target.checked); if (!e.target.checked) setAdminPin(""); }}
           className="w-4 h-4 rounded accent-[#D4A843]"
          />
          <span className="text-[#E8E8E9] text-xs">I am a Super Admin &#8212; override restrictions</span>
         </label>
         {adminOverride && (
          <div className="mt-2">
           <label className="label-text block mb-1 text-xs">Enter your PIN to approve</label>
           <input
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={adminPin}
            onChange={(e) => setAdminPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="Enter PIN"
            className="input-field w-32 text-sm"
            autoComplete="off"
           />
          </div>
         )}
        </div>
       )}
       <div className="space-y-3">
        <div className="flex items-center justify-between">
         <label className="text-sm font-medium text-white">Items</label>
         <button
          type="button"
          onClick={handleAddItem}
          className="btn-secondary text-xs flex items-center gap-1"
         >
          <Plus className="w-3 h-3" /> Add Item
         </button>
        </div>
        {formData.items.map((item, idx) => {
         const stock = (stockItems || []).find((s: any) => s.id == item.stockItemId);
         const avail = availableStock[item.stockItemId] || 0;
         const isOutOfStock = avail <= 0 && item.stockItemId > 0;
         const { basePrice, total } = getPriceBreakdown(item.stockItemId, item.quantity || 0);
         return (
          <div key={idx} className="flex flex-col sm:flex-row gap-3 p-3 bg-[#18191A] rounded-lg">
           <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
             <button
              type="button"
              onClick={() => {
               setProductPickerIndex(idx);
               setProductPickerOpen(true);
              }}
              className="flex-1 text-left input-field py-2 px-3 min-h-[40px] flex items-center gap-2"
             >
              {stock ? (
               <>
                <span
                 className="w-2 h-2 rounded-full flex-shrink-0"
                 style={{ backgroundColor: isOutOfStock ? "#EF4444" : "#4ADE80" }}
                />
                <span className="truncate">{stock.productName}</span>
                <span className="text-[#8A8B8C] text-xs flex-shrink-0">({stock.productCode})</span>
               </>
              ) : (
               <span className="text-[#8A8B8C]">Click to select product...</span>
              )}
             </button>
             <button
              type="button"
              onClick={() => handleRemoveItem(idx)}
              className="p-2 text-[#EF4444] hover:bg-[#EF4444]/10 rounded-lg flex-shrink-0"
             >
              <X className="w-4 h-4" />
             </button>
            </div>
            {stock && (
             <div className="flex items-center gap-4 mt-2 text-xs">
              <span className={isOutOfStock ? "text-[#EF4444]" : "text-[#4ADE80]"}>
               {avail} available
              </span>
              <span className="text-[#8A8B8C]">SOH: {stock.quantity || 0}</span>
              {productOrderStatuses[item.stockItemId]?.length > 0 && (
               <span className="text-[#8A8B8C]">
                In orders: {productOrderStatuses[item.stockItemId].map((o: any) => `${o.orderNumber}(${o.qty})`).join(", ")}
               </span>
              )}
             </div>
            )}
           </div>
           <div className="flex items-center gap-3">
            <div className="w-24">
             <input
              type="number"
              min={1}
              value={item.quantity}
              onChange={(e) => {
               const qty = parseInt(e.target.value) || 0;
               setFormData((prev) => {
                const newItems = [...prev.items];
                newItems[idx] = { ...newItems[idx], quantity: qty };
                return { ...prev, items: newItems };
               });
              }}
              className="input-field w-full text-center"
             />
            </div>
            <div className="w-28 text-right">
             <div className="text-sm text-[#8A8B8C]">R {basePrice.toFixed(2)}</div>
             <div className="text-sm font-display font-semibold text-[#D4A843]">R {total.toFixed(2)}</div>
            </div>
           </div>
          </div>
         );
        })}
        {formData.items.length === 0 && (
         <div className="text-center py-6 text-[#8A8B8C] text-sm">No items added. Click "Add Item" to start.</div>
        )}
       </div>
       <div className="border-t pt-4 space-y-2" style={{ borderColor: "#222324" }}>
        <div className="flex justify-between text-sm">
         <span className="text-[#8A8B8C]">Subtotal</span>
         <span className="text-white font-display">R {subtotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm">
         <span className="text-[#8A8B8C]">VAT ({(vatRate * 100).toFixed(0)}%)</span>
         <span className="text-white font-display">R {vatAmount.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-lg font-display font-bold">
         <span className="text-white">Total</span>
         <span className="text-[#D4A843]">R {totalWithVat.toFixed(2)}</span>
        </div>
       </div>
       {(() => {
        const validation = canPlaceOrder();
        if (!validation.valid) {
         return (
          <div className="flex items-center gap-2 p-3 bg-[#EF4444]/10 border rounded-lg" style={{ borderColor: "rgba(239,68,68,0.3)" }}>
           <AlertTriangle className="w-4 h-4 text-[#EF4444] flex-shrink-0" />
           <span className="text-sm text-[#EF4444]">{validation.error}</span>
          </div>
         );
        }
        return null;
       })()}
       <button
        type="submit"
        disabled={createOrder.isPending || updateOrder.isPending || !canPlaceOrder().valid}
        className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
       >
        {createOrder.isPending || updateOrder.isPending ? (
         <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Processing...</span>
        ) : editingOrder ? (
         "Update Order"
        ) : (
         "Place Order"
        )}
       </button>
      </form>
     </div>
    </div>
   )}
   <ProductPickerModal
    isOpen={productPickerOpen}
    onClose={() => setProductPickerOpen(false)}
    onSelect={(id) => {
     setFormData((prev) => {
      const newItems = [...prev.items];
      newItems[productPickerIndex] = { ...newItems[productPickerIndex], stockItemId: id };
      return { ...prev, items: newItems };
     });
    }}
    stockItems={stockItems || []}
    availableStock={availableStock}
    selectedId={formData.items[productPickerIndex]?.stockItemId || 0}
   />
  </div>
 );
}