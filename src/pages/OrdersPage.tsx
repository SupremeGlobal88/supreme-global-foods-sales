import { useState, useMemo, useRef, useEffect } from "react";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { reloadFromStorage, generateInvoiceForOrder, dataService, getBankingDetails } from "@/lib/dataService";
import {
  Plus, X, Printer, ChevronDown, ChevronUp, Package, CheckCircle,
  Truck, Ban, Tag, DollarSign, AlertTriangle, FlaskConical,
  ShoppingBag, Pencil, RotateCcw, Info, Search, FileText,
} from "lucide-react";

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
};

/** Dedicated component for Generate Invoice button.
 *  Uses tRPC useQuery with 5s polling so React auto-re-renders
 *  when invoices change from other devices. This guarantees the
 *  button always shows correct state after any admin generates. */
function GenerateInvoiceButton({
  orderId,
}: {
  orderId: number;
}) {
  const [busy, setBusy] = useState(false);

  // Use tRPC useQuery — ALWAYS fetch fresh on mount + poll every 5s
  // The button only mounts when an order is EXPANDED, so refetchOnMount
  // guarantees we see the latest invoices from other admins
  const { data: liveInvoices } = trpc.invoice.list.useQuery(undefined, {
    refetchInterval: 5000,
    refetchOnMount: "always",
    staleTime: 0,
  });

  const hasInvoice = (liveInvoices || []).some(
    (i: any) => i.orderId == orderId && i.invoiceNumber?.startsWith("SGF")
  );

  return (
    <button
      onClick={async () => {
        if (busy) return;
        setBusy(true);
        reloadFromStorage();
        const invNum = generateInvoiceForOrder(orderId);
        if (invNum) {
          // Push to Firebase
          try {
            const allInv = dataService.invoice.list();
            const newInv = allInv.find((i: any) => i.orderId == orderId && i.invoiceNumber === invNum);
            if (newInv) {
              const { pushInvoice } = await import("@/lib/firebaseSync");
              await pushInvoice(newInv);
            }
          } catch (e: any) {
            console.warn("[Invoice] Firebase push:", e?.message);
          }
          // Force UI refresh — tRPC will auto-re-render with fresh data
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

// Mobile-friendly product picker modal
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
      // Only auto-focus on desktop — mobile keyboard pushes modal up
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
      // Sort by availability first (in-stock first), then alphabetically
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
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: "#222324" }}>
          <h3 className="font-display font-semibold text-white text-lg">Select Product</h3>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-[#222324] cursor-pointer">
            <X className="w-5 h-5 text-[#8A8B8C]" />
          </button>
        </div>

        {/* Search */}
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
            <span className="text-[#4ADE80]">● In Stock</span>
            <span className="text-[#EF4444]">● Out of Stock</span>
            <span className="text-[#8A8B8C]">{filtered.length} products</span>
          </div>
        </div>

        {/* Product List */}
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
                  // Only select if user actually tapped (minimal movement)
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
];

export default function OrdersPage() {
  const { user } = useAuth();
  const { isAdmin, isSalesRep, role } = useRole();
  const myRepName = user?.name || "";
  const banking = getBankingDetails();
  const utils = trpc.useUtils();

  const [activeTab, setActiveTab] = useState("all");
  const [orderSearch, setOrderSearch] = useState("");
  const [expandedOrder, setExpandedOrder] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingOrder, setEditingOrder] = useState<any>(null);

  const [formData, setFormData] = useState({
    customerId: 0, orderType: "regular" as "regular" | "sample",
    paymentTerms: "cod" as "cod" | "7_days" | "14_days" | "30_days",
    priceTier: "wholesale" as "corporate" | "bulk" | "wholesale" | "retail",
    deliveryAddress: "", notes: "",
    items: [] as { stockItemId: number; quantity: number; unitPrice?: number }[],
  });
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const customerInputRef = useRef<HTMLInputElement>(null);

  // Product picker modal state
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

  // Direct dataService check — bypasses tRPC cache for "NO INVOICE" detection
  const [liveInvoiceOrderIds, setLiveInvoiceOrderIds] = useState<Set<number>>(new Set());
  useEffect(() => {
    function refresh() {
      const allInv = dataService.invoice.list();
      const ids = new Set(allInv.filter((i: any) => i.invoiceNumber?.startsWith("SGF")).map((i: any) => Number(i.orderId)));
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
      reloadFromStorage(); // Force re-read from localStorage into memory
      await utils.order.list.invalidate();
      await utils.order.getStats.invalidate();
      await utils.stock.search.invalidate();
      await utils.stock.list.invalidate();
      await utils.stock.getStats.invalidate();
      await utils.sampleReport.getAll.invalidate();
    },
  });
  const createOrder = trpc.order.create.useMutation({
    onSuccess: async () => {
      reloadFromStorage();
      await utils.order.list.invalidate();
      await utils.order.getStats.invalidate();
      await utils.stock.search.invalidate();
      await utils.stock.list.invalidate();
      await utils.stock.getStats.invalidate();
      await utils.sampleReport.getAll.invalidate();
      setShowForm(false); setEditingOrder(null); resetForm();
    },
  });
  const updateOrder = trpc.order.update.useMutation({
    onSuccess: async () => {
      reloadFromStorage();
      await utils.order.list.invalidate();
      await utils.order.getStats.invalidate();
      await utils.stock.search.invalidate();
      await utils.stock.list.invalidate();
      await utils.stock.getStats.invalidate();
      await utils.sampleReport.getAll.invalidate();
      setShowForm(false); setEditingOrder(null); resetForm();
    },
    onError: (err: any) => {
      alert("Update failed: " + (err.message || "Unknown error"));
    },
  });

  // Build committed stock map: for each product, total qty in non-delivered/cancelled orders
  const committedStock = useMemo(() => {
    const map: Record<number, number> = {};
    (orders || [])
      .filter((o) => o.status !== "delivered" && o.status !== "cancelled" && o.status !== "sample_delivered")
      .flatMap((o) => o.items || [])
      .forEach((item: any) => { map[item.stockItemId] = (map[item.stockItemId] || 0) + (item.quantity || 0); });
    return map;
  }, [orders]);

  // Available = current SOH (stock already deducted at order creation).
  // Stock is physically deducted in order.create and stays deducted through
  // the entire lifecycle. Only cancelled orders restore stock.
  // committedStock is used for display/info only, NOT for availability calc.
  const availableStock = useMemo(() => {
    const map: Record<number, number> = {};
    (stockItems || []).forEach((s) => {
      map[s.id] = s.quantity || 0;
    });
    return map;
  }, [stockItems]);

  // For each product, get the active order statuses consuming that stock
  const productOrderStatuses = useMemo(() => {
    const map: Record<number, Array<{ orderNumber: string; status: string; qty: number }>> = {};
    (orders || [])
      .filter((o) => o.status !== "delivered" && o.status !== "cancelled" && o.status !== "sample_delivered")
      .forEach((o) => {
        (o.items || []).forEach((item: any) => {
          if (!map[item.stockItemId]) map[item.stockItemId] = [];
          map[item.stockItemId].push({ orderNumber: o.orderNumber, status: o.status, qty: item.quantity });
        });
      });
    return map;
  }, [orders]);

  function resetForm() {
    setFormData({ customerId: 0, orderType: "regular", paymentTerms: "cod", priceTier: "wholesale", deliveryAddress: "", notes: "", items: [] });
  }

  function getTierPrice(stockItemId: number, tier?: string): number {
    const stock = (stockItems || []).find((s) => s.id === stockItemId);
    if (!stock) return 0;
    const t = tier || formData.priceTier;
    switch (t) { case "corporate": return Number(stock.corporatePrice); case "bulk": return Number(stock.bulkPrice); case "retail": return Number(stock.retailPrice); default: return Number(stock.wholesalePrice); }
  }

  function getEffectivePrice(stockItemId: number, customPrice?: number): number {
    if (customPrice && customPrice > 0) return customPrice;
    const sp = (customerSpecialPrices || []).find((p: any) => p.stockItemId === stockItemId);
    if (sp) return Number(sp.specialPrice);
    return getTierPrice(stockItemId);
  }

  function handleCustomerSelect(cid: number) {
    const customer = (customers || []).find((c) => c.id === cid);
    setFormData({ ...formData, customerId: cid,
      priceTier: (customer?.priceTier as any) || "wholesale",
      paymentTerms: (customer?.paymentTerms as any) || "cod",
      deliveryAddress: customer?.physicalAddress || "", items: [],
    });
    setCustomerSearch(customer?.name || "");
    setShowCustomerDropdown(false);
  }

  function handleOpenCustomerDropdown() {
    setShowCustomerDropdown(true);
    setCustomerSearch("");
    setTimeout(() => customerInputRef.current?.focus(), 50);
  }

  const filteredCustomers = useMemo(() => {
    const list = (customers || []).sort((a: any, b: any) => a.name?.localeCompare(b.name || "") || 0);
    if (!showCustomerDropdown) return [];
    const q = customerSearch.toLowerCase().trim();
    if (!q || q.length < 1) return list;
    return list.filter((c) =>
      c.name?.toLowerCase().includes(q) ||
      c.customerCode?.toLowerCase().includes(q) ||
      c.city?.toLowerCase().includes(q)
    );
  }, [customers, customerSearch, showCustomerDropdown]);

  function handleAddItem() { setFormData({ ...formData, items: [...formData.items, { stockItemId: 0, quantity: 1 }] }); }
  function handleRemoveItem(index: number) { setFormData({ ...formData, items: formData.items.filter((_, i) => i !== index) }); }

  function handleUpdateItem(index: number, field: string, value: number) {
    const updated = [...formData.items];
    updated[index] = { ...updated[index], [field]: value };
    if (field === "stockItemId" && value > 0 && formData.orderType === "sample") updated[index].quantity = 1;
    if (formData.orderType === "sample" && field === "quantity" && value > 1) updated[index].quantity = 1;
    setFormData({ ...formData, items: updated });
  }

  function canEditOrderBasic(): { valid: boolean; error?: string } {
    // Basic validation for admin editing existing orders — no stock check
    const validItems = formData.items.filter((i) => i.stockItemId > 0 && i.quantity > 0);
    if (validItems.length === 0) return { valid: false, error: "Add at least one item" };
    if (formData.customerId === 0) return { valid: false, error: "Select a customer" };
    return { valid: true };
  }

  function canPlaceOrder(): { valid: boolean; error?: string } {
    const validItems = formData.items.filter((i) => i.stockItemId > 0 && i.quantity > 0);
    if (validItems.length === 0) return { valid: false, error: "Add at least one item" };
    if (formData.customerId === 0) return { valid: false, error: "Select a customer" };
    for (const item of validItems) {
      const avail = availableStock[item.stockItemId] || 0;
      if (avail <= 0) { const s = (stockItems || []).find((x) => x.id === item.stockItemId); return { valid: false, error: `${s?.productName || "Product"} is OUT OF STOCK.` }; }
      if (formData.orderType === "sample") {
        // When editing, exclude the current order from the duplicate check
        const existing = (orders || []).some((o) => 
          o.id !== editingOrder?.id && // Exclude the order being edited
          o.customerId === formData.customerId && 
          o.orderType === "sample" && 
          o.items?.some((it: any) => it.stockItemId === item.stockItemId)
        );
        if (existing) { const s = (stockItems || []).find((x) => x.id === item.stockItemId); return { valid: false, error: `Customer already sampled ${s?.productName || "this product"}.` }; }
        if (item.quantity > 1) return { valid: false, error: "Sample orders: 1 unit per product max." };
      } else { if (item.quantity > avail) { const s = (stockItems || []).find((x) => x.id === item.stockItemId); return { valid: false, error: `Insufficient stock for ${s?.productName || "product"}. Available: ${avail}, Requested: ${item.quantity}` }; } }
    }
    return { valid: true };
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // When editing ANY order, use basic validation (no stock check, no duplicate checks)
    // Stock was already deducted when order was created; we're just updating details
    const check = editingOrder ? canEditOrderBasic() : canPlaceOrder();
    if (!check.valid) { alert(check.error); return; }
    const validItems = formData.items.filter((i) => i.stockItemId > 0 && i.quantity > 0);
    const payload: any = { customerId: formData.customerId, orderType: formData.orderType, paymentTerms: formData.paymentTerms, priceTier: formData.priceTier, deliveryAddress: formData.deliveryAddress, notes: formData.notes, items: validItems.map((item) => ({ stockItemId: item.stockItemId, quantity: formData.orderType === "sample" ? 1 : item.quantity, unitPrice: formData.orderType === "sample" ? 0 : (item.unitPrice && item.unitPrice > 0 ? item.unitPrice : undefined) })) };
    // Only set salesRepName on NEW orders. On edit, preserve original.
    if (!editingOrder) {
      payload.salesRepName = user?.name || "";
    }
    if (editingOrder) {
      updateOrder.mutate({ id: editingOrder.id, ...payload });
    } else {
      createOrder.mutate(payload);
    }
  }

  function startEditOrder(order: any) {
    setEditingOrder(order);
    setFormData({
      customerId: order.customerId, orderType: order.orderType || "regular",
      paymentTerms: order.paymentTerms || "cod", priceTier: order.priceTier || "wholesale",
      deliveryAddress: order.deliveryAddress || "", notes: order.notes || "",
      items: (order.items || []).map((it: any) => ({ stockItemId: it.stockItemId, quantity: it.quantity, unitPrice: it.unitPrice })),
    });
    setShowForm(true);
  }

  function canEditOrder(order: any): boolean {
    // Admin can edit ANY order (including delivered/cancelled/sample_delivered)
    if (isAdmin) return true;
    // Sales reps can edit their own orders while status is "pending" only
    if (order.status === "delivered" || order.status === "cancelled" || order.status === "sample_delivered") return false;
    if (order.status !== "pending") return false;
    const cust = (customers || []).find((c) => c.id === order.customerId);
    return cust?.salesRepName === myRepName;
  }

  function canCancelOrder(order: any): boolean {
    // Admin can cancel ANY non-cancelled order
    if (isAdmin) return order.status !== "cancelled";
    // Sales rep can only cancel their own pending orders
    if (order.status === "cancelled" || order.status === "delivered" || order.status === "sample_delivered") return false;
    if (order.status !== "pending") return false;
    const cust = (customers || []).find((c) => c.id === order.customerId);
    return cust?.salesRepName === myRepName;
  }

  function canProgressOrder(order: any): boolean {
    // ONLY ADMIN can click status buttons (Mark Picking / Mark Ready / Mark Delivered)
    if (!isAdmin) return false;
    if (order.status === "delivered" || order.status === "cancelled") return false;
    return true;
  }

  function getCustomer(order: any) {
    return (customers || []).find((c) => c.id === order.customerId);
  }

  function printPickingSlip(order: any) {
    const customer = getCustomer(order);
    const matchedInvoice = (invoices || []).find((i: any) => i.orderId == order.id);
    const invoiceNumber = matchedInvoice?.invoiceNumber || "N/A";
    const logoUrl = `${window.location.origin}/sgf-logo.png`;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
<html><head><title>Picking Slip - ${order.orderNumber}</title>
<style>
  @media print { body { padding: 0; } .no-print { display: none; } }
  body { font-family: Arial, sans-serif; padding: 30px; max-width: 800px; margin: 0 auto; color: #333; }
  .header { text-align: center; margin-bottom: 20px; border-bottom: 3px solid #D4A843; padding-bottom: 15px; }
  .logo-img { height: 55px; margin-bottom: 4px; }
  .logo-fallback { font-size: 28px; font-weight: bold; color: #D4A843; letter-spacing: 1px; display: none; }
  .subtitle { color: #666; font-size: 12px; margin-top: 4px; }
  .doc-title { text-align: center; color: #D4A843; font-size: 22px; font-weight: bold; margin: 15px 0; letter-spacing: 2px; }
  .info-section { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; padding: 15px; background: #f9f9f9; border-radius: 8px; }
  .label { font-size: 10px; color: #888; text-transform: uppercase; letter-spacing: 1px; }
  .value { font-size: 14px; font-weight: 600; margin-top: 3px; color: #222; }
  .inv-num { color: #D4A843; font-size: 16px; }
  table { width: 100%; border-collapse: collapse; margin-top: 15px; }
  th { background: #D4A843; color: white; padding: 12px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; }
  td { padding: 12px; border-bottom: 1px solid #e0e0e0; font-size: 13px; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: bold; text-transform: uppercase; }
  .badge-sample { background: #FFF3E0; color: #E65100; }
  .footer { margin-top: 40px; border-top: 2px solid #D4A843; padding-top: 20px; }
  .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 20px; }
  .sig-line { border-bottom: 1px solid #333; height: 40px; margin-top: 8px; }
  .sig-label { font-size: 11px; color: #666; margin-top: 6px; }
</style></head><body>
  <div class="header">
    <img class="logo-img" src="${logoUrl}" onerror="this.style.display='none';document.getElementById('logo-fb').style.display='block'" />
    <div id="logo-fb" class="logo-fallback">SUPREME GLOBAL FOODS</div>
    <div class="subtitle">28 Nagington road, Wadeville, Germiston, 1422 &middot; sales@supremeglobalfoods.co.za</div>
    <div class="subtitle">Tel: 083 293 0644</div>
  </div>
  <div class="doc-title">FACTORY PICKING SLIP</div>
  <div style="text-align:center;margin-bottom:15px;">
    <span class="badge ${order.orderType === "sample" ? "badge-sample" : ""}">${order.orderType === "sample" ? "SAMPLE ORDER — NO CHARGE" : `PRICE TIER: ${(order.priceTier || "WHOLESALE").toUpperCase()}`}</span>
  </div>
  <div class="info-section">
    <div class="info-block"><div class="label">Invoice Number</div><div class="value inv-num">${invoiceNumber}</div></div>
    <div class="info-block"><div class="label">Order Number</div><div class="value">${order.orderNumber}</div></div>
    <div class="info-block"><div class="label">Date</div><div class="value">${new Date(order.createdAt).toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" })}</div></div>
    <div class="info-block"><div class="label">Sales Rep</div><div class="value" style="color:#D4A843;font-weight:700;">${order.salesRepName || customer?.salesRepName || "N/A"}</div></div>
    <div class="info-block"><div class="label">Customer</div><div class="value">${customer?.name || "N/A"}</div></div>
    <div class="info-block"><div class="label">Customer Code</div><div class="value">${customer?.customerCode || "N/A"}</div></div>
    <div class="info-block"><div class="label">Contact Person</div><div class="value">${customer?.contactPerson || "N/A"}</div></div>
    <div class="info-block"><div class="label">Phone</div><div class="value">${customer?.phone || "N/A"}</div></div>
    <div class="info-block" style="grid-column: 1 / -1;"><div class="label">Delivery Address</div><div class="value">${order.deliveryAddress || customer?.physicalAddress || "N/A"}${customer?.city ? `, ${customer.city}` : ""}</div></div>
    ${order.notes ? `<div class="info-block" style="grid-column: 1 / -1;"><div class="label">Notes</div><div class="value" style="font-style:italic;color:#888;">${order.notes}</div></div>` : ""}
  </div>
  <table>
    <thead><tr><th>Product Code</th><th>Product Name</th><th>Qty</th></tr></thead>
    <tbody>
      ${order.items?.map((item: any) => `<tr><td>${item.productCode}</td><td>${item.productName}</td><td style="font-weight:bold;font-size:16px;">${item.quantity}</td></tr>`).join("") || ""}
    </tbody>
  </table>
  <div class="footer">
    <div class="signatures">
      <div><div class="label">Picked By (Name & Signature)</div><div class="sig-line"></div><div class="sig-label">Print name and sign</div></div>
      <div><div class="label">Time Completed</div><div class="sig-line"></div><div class="sig-label">Date & Time order was picked</div></div>
    </div>
    <div style="margin-top:30px;text-align:center;font-size:10px;color:#999;">This is an internal factory document. Prices are not shown. For office use only.</div>
  </div>
  <script>
    (function(){
      var done=false;
      function printIt(){ if(!done){ done=true; setTimeout(function(){ window.print(); }, 200); } }
      if(document.readyState==='complete') printIt();
      else window.onload=printIt;
      setTimeout(printIt, 2000);
    })();
  </script>
</body></html>`);
    printWindow.document.close();
  }

  function printCombinedInvoiceDelivery(order: any) {
    const customer = getCustomer(order);
    // Look up the actual SGF invoice number for this order
    const matchedInvoice = (invoices || []).find((i: any) => i.orderId == order.id);
    const invoiceNumber = matchedInvoice?.invoiceNumber || `INV-${order.orderNumber}`;
    const deliveryNoteNumber = `DN-${order.orderNumber}`;
    const logoUrl = `${window.location.origin}/sgf-logo.png`;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    const subtotal = Number(order.subtotal || 0);
    const vatAmount = Number(order.vatAmount || 0);
    const total = Number(order.total || 0);
    const logoBlock = (id: string) => `
      <img class="logo-img" src="${logoUrl}" onerror="this.style.display='none';document.getElementById('${id}').style.display='block'" />
      <div id="${id}" class="logo-fallback">SUPREME GLOBAL FOODS</div>`;
    printWindow.document.write(`
<html><head><title>Invoice & Delivery Note - ${order.orderNumber}</title>
<style>
  @media print { body { padding: 0; } .no-print { display: none; } }
  body { font-family: Arial, sans-serif; padding: 30px; max-width: 800px; margin: 0 auto; color: #333; }
  .header { text-align: center; margin-bottom: 20px; border-bottom: 3px solid #D4A843; padding-bottom: 15px; }
  .logo-img { height: 55px; margin-bottom: 4px; }
  .logo-fallback { font-size: 28px; font-weight: bold; color: #D4A843; letter-spacing: 1px; display: none; }
  .subtitle { color: #666; font-size: 12px; margin-top: 4px; }
  .doc-title { text-align: center; color: #D4A843; font-size: 22px; font-weight: bold; margin: 15px 0; letter-spacing: 2px; }
  .info-section { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; padding: 15px; background: #f9f9f9; border-radius: 8px; }
  .label { font-size: 10px; color: #888; text-transform: uppercase; letter-spacing: 1px; }
  .value { font-size: 14px; font-weight: 600; margin-top: 3px; color: #222; }
  table { width: 100%; border-collapse: collapse; margin-top: 15px; }
  th { background: #D4A843; color: white; padding: 12px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; }
  td { padding: 12px; border-bottom: 1px solid #e0e0e0; font-size: 13px; }
  .totals { text-align: right; margin-top: 15px; padding: 15px; background: #f9f9f9; border-radius: 8px; }
  .grand-total { font-size: 18px; font-weight: bold; color: #D4A843; margin-top: 8px; padding-top: 8px; border-top: 2px solid #D4A843; }
  .copy-separator { border-top: 3px dashed #999; margin: 40px 0; padding-top: 20px; }
  .footer { margin-top: 30px; padding-top: 15px; border-top: 1px solid #ddd; text-align: center; font-size: 11px; color: #666; }
  .copy-label { position: fixed; top: 10px; right: 10px; background: #D4A843; color: white; padding: 4px 12px; font-size: 11px; font-weight: bold; border-radius: 4px; }
</style></head><body>
  <!-- ===== COPY 1: Customer Copy ===== -->
  <div class="copy-label">CUSTOMER COPY</div>
  <div class="header">
    ${logoBlock("lf1")}
    <div class="subtitle">28 Nagington road, Wadeville, Germiston, 1422</div>
    <div class="subtitle">sales@supremeglobalfoods.co.za &middot; Tel: 083 293 0644</div>
    <div class="subtitle">VAT: 4120123456 &middot; Reg: 2015/123456/07</div>
  </div>
  <div class="doc-title">TAX INVOICE &amp; DELIVERY NOTE</div>
  <div class="info-section">
    <div class="info-block"><div class="label">Invoice Number</div><div class="value">${invoiceNumber}</div></div>
    <div class="info-block"><div class="label">Delivery Note</div><div class="value">${deliveryNoteNumber}</div></div>
    <div class="info-block"><div class="label">Order Number</div><div class="value">${order.orderNumber}</div></div>
    <div class="info-block"><div class="label">Date</div><div class="value">${new Date(order.createdAt).toLocaleDateString("en-ZA")}</div></div>
    <div class="info-block"><div class="label">Customer</div><div class="value">${customer?.name || "N/A"}</div></div>
    <div class="info-block"><div class="label">Customer Code</div><div class="value">${customer?.customerCode || "N/A"}</div></div>
    <div class="info-block"><div class="label">Deliver To</div><div class="value">${order.deliveryAddress || customer?.physicalAddress || "N/A"}${customer?.city ? `, ${customer.city}` : ""}</div></div>
    <div class="info-block"><div class="label">Payment Terms</div><div class="value">${(order.paymentTerms || "COD").replace("_", " ").toUpperCase()}</div></div>
  </div>
  <table>
    <thead><tr><th>Product</th><th style="text-align:right;">Qty</th><th style="text-align:right;">Unit Price</th><th style="text-align:right;">Line Total</th></tr></thead>
    <tbody>
      ${order.items?.map((item: any) => `<tr><td>${item.productName}</td><td style="text-align:right;">${item.quantity}</td><td style="text-align:right;">R ${Number(item.unitPrice).toFixed(2)}</td><td style="text-align:right;">R ${Number(item.lineTotal).toFixed(2)}</td></tr>`).join("") || ""}
    </tbody>
  </table>
  <div class="totals">
    <div style="display:flex;justify-content:flex-end;gap:40px;margin-bottom:6px;"><span>Subtotal:</span><strong>R ${subtotal.toFixed(2)}</strong></div>
    <div style="display:flex;justify-content:flex-end;gap:40px;margin-bottom:6px;"><span>VAT (15%):</span><strong>R ${vatAmount.toFixed(2)}</strong></div>
    <div class="grand-total" style="display:flex;justify-content:flex-end;gap:40px;"><span>Total Due:</span><strong>R ${total.toFixed(2)}</strong></div>
  </div>
  <div style="margin-top:20px;padding:15px;border:2px dashed #ddd;border-radius:8px;">
    <div style="font-size:12px;color:#666;"><strong>Delivery Note:</strong> Goods received in good order. Returns accepted within 7 days.</div>
  </div>
  <div class="footer">
    <p>Banking: {banking.bankName} | Acc: {banking.accountNumber} | Branch: {banking.branchCode} | Quote invoice number with payment</p>
    <p style="font-size:10px;color:#999;">E&amp;OE. Thank you for your business!</p>
  </div>

  <!-- ===== COPY 2: Office Copy ===== -->
  <div class="copy-separator"></div>
  <div class="copy-label">OFFICE COPY</div>
  <div class="header">
    ${logoBlock("lf2")}
    <div class="subtitle">28 Nagington road, Wadeville, Germiston, 1422</div>
    <div class="subtitle">sales@supremeglobalfoods.co.za &middot; Tel: 083 293 0644</div>
  </div>
  <div class="doc-title">TAX INVOICE &amp; DELIVERY NOTE — OFFICE COPY</div>
  <div class="info-section">
    <div class="info-block"><div class="label">Invoice Number</div><div class="value">${invoiceNumber}</div></div>
    <div class="info-block"><div class="label">Delivery Note</div><div class="value">${deliveryNoteNumber}</div></div>
    <div class="info-block"><div class="label">Order Number</div><div class="value">${order.orderNumber}</div></div>
    <div class="info-block"><div class="label">Date</div><div class="value">${new Date(order.createdAt).toLocaleDateString("en-ZA")}</div></div>
    <div class="info-block"><div class="label">Customer</div><div class="value">${customer?.name || "N/A"}</div></div>
    <div class="info-block"><div class="label">Sales Rep</div><div class="value">${customer?.salesRepName || "N/A"}</div></div>
    <div class="info-block" style="grid-column:1/-1;"><div class="label">Delivery Address</div><div class="value">${order.deliveryAddress || customer?.physicalAddress || "N/A"}${customer?.city ? `, ${customer.city}` : ""}</div></div>
  </div>
  <table>
    <thead><tr><th>Product</th><th style="text-align:right;">Qty</th><th style="text-align:right;">Unit Price</th><th style="text-align:right;">Line Total</th></tr></thead>
    <tbody>
      ${order.items?.map((item: any) => `<tr><td>${item.productName}</td><td style="text-align:right;">${item.quantity}</td><td style="text-align:right;">R ${Number(item.unitPrice).toFixed(2)}</td><td style="text-align:right;">R ${Number(item.lineTotal).toFixed(2)}</td></tr>`).join("") || ""}
    </tbody>
  </table>
  <div class="totals">
    <div style="display:flex;justify-content:flex-end;gap:40px;margin-bottom:6px;"><span>Subtotal:</span><strong>R ${subtotal.toFixed(2)}</strong></div>
    <div style="display:flex;justify-content:flex-end;gap:40px;margin-bottom:6px;"><span>VAT (15%):</span><strong>R ${vatAmount.toFixed(2)}</strong></div>
    <div class="grand-total" style="display:flex;justify-content:flex-end;gap:40px;"><span>Total Due:</span><strong>R ${total.toFixed(2)}</strong></div>
  </div>
  <div style="margin-top:20px;padding:15px;background:#f9f9f9;border-radius:8px;">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:30px;">
      <div><div class="label">Received By (Name &amp; Signature)</div><div style="border-bottom:1px solid #333;height:40px;margin-top:8px;"></div><div style="font-size:11px;color:#666;margin-top:6px;">Customer sign here</div></div>
      <div><div class="label">Delivered By (Name &amp; Signature)</div><div style="border-bottom:1px solid #333;height:40px;margin-top:8px;"></div><div style="font-size:11px;color:#666;margin-top:6px;">Driver sign here</div></div>
    </div>
  </div>
  <script>
    (function(){
      var done=false;
      function printIt(){ if(!done){ done=true; setTimeout(function(){ window.print(); }, 200); } }
      if(document.readyState==='complete') printIt();
      else window.onload=printIt;
      setTimeout(printIt, 2000);
    })();
  </script>
</body></html>`);
    printWindow.document.close();
  }

  const filteredOrders = (orders || [])
    .filter((o) => {
      if (activeTab === "all") return true;
      if (activeTab === "sample") return o.orderType === "sample";
      return o.status === activeTab;
    })
    .filter((o) => {
      if (!orderSearch.trim()) return true;
      const q = orderSearch.toLowerCase();
      return (
        (o.orderNumber || "").toLowerCase().includes(q) ||
        (o.customer?.name || "").toLowerCase().includes(q) ||
        (o.customerName || "").toLowerCase().includes(q) ||
        (o.status || "").toLowerCase().includes(q) ||
        (o.invoiceNumber || "").toLowerCase().includes(q)
      );
    })
    .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const orderCheck = editingOrder && isAdmin ? canEditOrderBasic() : canPlaceOrder();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display font-semibold text-white" style={{ fontSize: "clamp(1.8rem, 3vw, 2.5rem)", letterSpacing: "-0.03em" }}>Orders</h1>
          <p className="text-[#8A8B8C] font-body text-sm mt-1">{stats?.total || 0} orders &middot; R {(stats?.totalValue || 0).toLocaleString("en-ZA", { minimumFractionDigits: 2 })} total value</p>
        </div>
        <button onClick={() => { setShowForm(true); setEditingOrder(null); resetForm(); }} className="btn-primary"><Plus className="w-4 h-4" /> New Order</button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {["pending", "picking", "ready", "delivered"].map((key) => (
          <div key={key} className="card-surface p-3 text-center">
            <div className="label-text mb-1">{STATUS_LABELS[key]?.label.toUpperCase()}</div>
            <div className="stat-number" style={{ fontSize: "1.5rem", color: STATUS_LABELS[key]?.color }}>
              {key === "pending" ? stats?.pending : key === "picking" ? stats?.picking : key === "ready" ? stats?.ready : stats?.delivered}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {statusTabs.map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} className="px-4 py-2 rounded-full text-sm font-body font-medium transition-all cursor-pointer" style={{ backgroundColor: activeTab === tab.key ? "#D4A843" : "#18191A", color: activeTab === tab.key ? "#0A0A0B" : "#8A8B8C", border: activeTab === tab.key ? "none" : "1px solid #2A2B2C" }}>{tab.label}</button>
        ))}
      </div>

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#8A8B8C]" />
        <input
          type="text"
          value={orderSearch}
          onChange={(e) => setOrderSearch(e.target.value)}
          placeholder="Search by order number, customer name, status or invoice number..."
          className="w-full bg-[#18191A] border border-[#2A2B2C] rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-[#555] focus:outline-none focus:border-[#D4A843]"
        />
        {orderSearch && (
          <button onClick={() => setOrderSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8A8B8C] hover:text-white text-xs">Clear</button>
        )}
      </div>

      <div className="card-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ backgroundColor: "#131415", borderBottom: "1px solid #222324" }}>
                <th className="text-left p-4 label-text">Order #</th>
                <th className="text-left p-4 label-text">Customer</th>
                <th className="text-left p-4 label-text">Tier</th>
                <th className="text-left p-4 label-text">Date</th>
                <th className="text-right p-4 label-text">Items</th>
                <th className="text-right p-4 label-text">Total</th>
                <th className="text-left p-4 label-text">Status</th>
                <th className="text-right p-4 label-text">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(filteredOrders || []).map((order) => (
                <>
                  <tr key={order.id} className="transition-colors hover:bg-[#131415]" style={{ borderBottom: "1px solid #18191A" }}>
                    <td className="p-4 font-mono-data text-xs text-[#D4A843] cursor-pointer" onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}>
                      {order.orderNumber}
                      {order.orderType === "sample" && <span className="ml-2 status-badge text-xs" style={{ backgroundColor: "rgba(212, 168, 67, 0.15)", color: "#D4A843" }}><FlaskConical className="w-3 h-3 inline" /> SAMPLE</span>}
                      {isAdmin && !(invoices || []).some((inv: any) => inv.orderId == order.id && inv.invoiceNumber?.startsWith("SGF")) && (
                        <span className="ml-2 status-badge text-xs" style={{ backgroundColor: "rgba(239, 68, 68, 0.15)", color: "#EF4444" }}>NO INVOICE</span>
                      )}
                    </td>
                    <td className="p-4 text-sm text-[#E8E8E9] font-body cursor-pointer" onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}>{order.customer?.name || "N/A"}</td>
                    <td className="p-4 cursor-pointer" onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}>
                      {order.orderType === "sample"
                        ? <span className="status-badge text-xs" style={{ backgroundColor: "rgba(212, 168, 67, 0.12)", color: "#D4A843" }}><FlaskConical className="w-3 h-3 inline" /> SAMPLE</span>
                        : <span className="status-badge text-xs" style={{ backgroundColor: `${PRICE_TIERS.find((t) => t.key === order.priceTier)?.color || "#4ADE80"}20`, color: PRICE_TIERS.find((t) => t.key === order.priceTier)?.color || "#4ADE80" }}>{order.priceTier?.toUpperCase() || "WHOLESALE"}</span>
                      }
                    </td>
                    <td className="p-4 text-sm text-[#8A8B8C] font-body cursor-pointer" onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}>{new Date(order.createdAt).toLocaleDateString("en-ZA")}</td>
                    <td className="p-4 text-right text-sm text-white font-display cursor-pointer" onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}>{order.items?.length || 0}</td>
                    <td className="p-4 text-right font-display font-semibold cursor-pointer" onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)} style={{ color: order.orderType === "sample" ? "#D4A843" : "#FFFFFF" }}>
                      {order.orderType === "sample" ? "R 0.00" : `R ${Number(order.total).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`}
                    </td>
                    <td className="p-4 cursor-pointer" onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}>
                      <span className="status-badge" style={{ backgroundColor: `${STATUS_LABELS[order.status]?.color}20`, color: STATUS_LABELS[order.status]?.color }}>{STATUS_LABELS[order.status]?.label || order.status}</span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Status flow buttons always visible */}
                        {canProgressOrder(order) && order.status === "pending" && (
                          <button onClick={(e) => { e.stopPropagation(); updateStatus.mutate({ id: order.id, status: "picking" }); }} className="btn-primary text-xs"><Package className="w-3 h-3" /> Mark Picking</button>
                        )}
                        {canProgressOrder(order) && order.status === "picking" && (
                          <button onClick={(e) => { e.stopPropagation(); updateStatus.mutate({ id: order.id, status: "ready" }); }} className="btn-primary text-xs"><CheckCircle className="w-3 h-3" /> Mark Ready</button>
                        )}
                        {canProgressOrder(order) && order.status === "ready" && (
                          <button onClick={(e) => { e.stopPropagation(); updateStatus.mutate({ id: order.id, status: "delivered" }); }} className="btn-primary text-xs"><Truck className="w-3 h-3" /> Mark Delivered</button>
                        )}
                        {canEditOrder(order) && (
                          <button onClick={(e) => { e.stopPropagation(); startEditOrder(order); }} className="p-1.5 rounded hover:bg-[#222324]" title="Edit order"><Pencil className="w-4 h-4 text-[#D4A843]" /></button>
                        )}
                        {expandedOrder === order.id ? <ChevronUp className="w-4 h-4 text-[#8A8B8C]" /> : <ChevronDown className="w-4 h-4 text-[#8A8B8C]" />}
                      </div>
                    </td>
                  </tr>
                  {expandedOrder === order.id && (
                    <tr><td colSpan={8} className="p-0">
                      <div className="p-6" style={{ backgroundColor: "#0A0A0B" }}>
                        {/* Status flow indicator */}
                        <div className="flex items-center gap-2 mb-4 p-3 rounded-lg" style={{ backgroundColor: "#0A0A0B" }}>
                          {["pending", "picking", "ready", "delivered"].map((s, i, arr) => {
                            const isCurrent = order.status === s;
                            const isPast = arr.indexOf(order.status) > i;
                            const colors: Record<string, string> = { pending: "#F59E0B", picking: "#6366F1", ready: "#4ADE80", delivered: "#4ADE80" };
                            return (
                              <div key={s} className="flex items-center gap-2">
                                <span className="text-xs font-body px-3 py-1 rounded-full" style={{ backgroundColor: isCurrent ? `${colors[s]}30` : isPast ? `${colors[s]}15` : "#222324", color: isCurrent ? colors[s] : isPast ? "#8A8B8C" : "#555", border: isCurrent ? `1px solid ${colors[s]}` : "1px solid transparent", fontWeight: isCurrent ? 700 : 400 }}>
                                  {STATUS_LABELS[s]?.label}
                                </span>
                                {i < arr.length - 1 && <span style={{ color: isPast ? "#4ADE80" : "#333" }}>→</span>}
                              </div>
                            );
                          })}
                        </div>

                        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                          <div>
                            <h3 className="font-display font-semibold text-white">Order Details</h3>
                            <span className="text-xs text-[#8A8B8C]">{order.orderType === "sample" ? "Sample Order — No Charge" : `Price Tier: ${(order.priceTier || "wholesale").toUpperCase()}`}</span>
                          </div>
                          <div className="flex gap-2 flex-wrap">
                            {canEditOrder(order) && (
                              <button onClick={() => startEditOrder(order)} className="btn-secondary text-xs" style={{ borderColor: "rgba(212,168,67,0.3)" }}><Pencil className="w-3 h-3" /> Edit Order</button>
                            )}
                            <button onClick={() => printPickingSlip(order)} className="btn-secondary text-xs"><Printer className="w-3 h-3" /> Print Picking Slip</button>
                            {order.orderType !== "sample" && (
                              <button onClick={() => printCombinedInvoiceDelivery(order)} className="btn-secondary text-xs" style={{ borderColor: "rgba(74,222,128,0.3)" }}><Printer className="w-3 h-3" /> Print Invoice &amp; Delivery Note</button>
                            )}
                            {isAdmin && (
                              <GenerateInvoiceButton
                                orderId={order.id}
                              />
                            )}
                          </div>
                        </div>

                        {/* Status flow buttons */}
                        <div className="flex gap-2 flex-wrap mb-4">
                          {canProgressOrder(order) && order.status === "pending" && <button onClick={() => updateStatus.mutate({ id: order.id, status: "picking" })} className="btn-primary text-xs"><Package className="w-3 h-3" /> Mark Picking</button>}
                          {canProgressOrder(order) && order.status === "picking" && <button onClick={() => updateStatus.mutate({ id: order.id, status: "ready" })} className="btn-primary text-xs"><CheckCircle className="w-3 h-3" /> Mark Ready</button>}
                          {canProgressOrder(order) && order.status === "ready" && <button onClick={() => updateStatus.mutate({ id: order.id, status: "delivered" })} className="btn-primary text-xs"><Truck className="w-3 h-3" /> Mark Delivered</button>}
                          {canCancelOrder(order) && <button onClick={() => { if (confirm("Cancel this order? Stock will be restored.")) updateStatus.mutate({ id: order.id, status: "cancelled" }); }} className="btn-secondary text-xs hover:text-[#EF4444]"><Ban className="w-3 h-3" /> Cancel</button>}
                          {isAdmin && order.status === "cancelled" && <button onClick={() => updateStatus.mutate({ id: order.id, status: "pending" })} className="btn-primary text-xs"><RotateCcw className="w-3 h-3" /> Re-activate</button>}
                        </div>
                        <table className="w-full mb-4">
                          <thead><tr style={{ borderBottom: "1px solid #222324" }}><th className="text-left p-2 label-text">Product</th><th className="text-right p-2 label-text">Qty</th><th className="text-right p-2 label-text">Unit Price</th><th className="text-right p-2 label-text">Line Total</th></tr></thead>
                          <tbody>
                            {order.items?.map((item: any) => (
                              <tr key={item.id || item.stockItemId} style={{ borderBottom: "1px solid #18191A" }}>
                                <td className="p-2 text-sm text-[#E8E8E9]">{item.productName}</td>
                                <td className="p-2 text-right text-sm text-white">{item.quantity}</td>
                                <td className="p-2 text-right text-sm text-[#8A8B8C]">R {Number(item.unitPrice).toFixed(2)}</td>
                                <td className="p-2 text-right text-sm text-white font-display">R {Number(item.lineTotal).toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <div className="flex justify-end gap-6 text-sm">
                          {order.orderType === "sample"
                            ? <div className="font-display font-semibold text-[#D4A843] text-lg"><FlaskConical className="w-5 h-5 inline mr-2" />SAMPLE ORDER — No Charge</div>
                            : <><div className="text-[#8A8B8C]">Subtotal: <span className="text-white">R {Number(order.subtotal).toFixed(2)}</span></div><div className="text-[#8A8B8C]">VAT (15%): <span className="text-white">R {Number(order.vatAmount).toFixed(2)}</span></div><div className="font-display font-semibold text-[#D4A843]">Total: R {Number(order.total).toFixed(2)}</div></>
                          }
                        </div>
                        {order.deliveryAddress && <div className="mt-4 p-3 rounded-lg" style={{ backgroundColor: "#18191A" }}><div className="label-text mb-1">Delivery Address</div><div className="text-sm text-[#E8E8E9]">{order.deliveryAddress}</div></div>}
                        {order.notes && <div className="mt-2 p-3 rounded-lg" style={{ backgroundColor: "#18191A" }}><div className="label-text mb-1">Notes</div><div className="text-sm text-[#E8E8E9]">{order.notes}</div></div>}
                      </div>
                    </td></tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Product Picker Modal */}
      <ProductPickerModal
        isOpen={productPickerOpen}
        onClose={() => setProductPickerOpen(false)}
        onSelect={(id) => handleUpdateItem(productPickerIndex, "stockItemId", id)}
        stockItems={stockItems || []}
        availableStock={availableStock}
        selectedId={formData.items[productPickerIndex]?.stockItemId || 0}
      />

      {/* New / Edit Order Dialog */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.7)" }}>
          <div className="card-surface p-8 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto" style={{ borderRadius: 16 }}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display font-semibold text-white text-xl">{editingOrder ? `Edit Order ${editingOrder.orderNumber}` : "New Order"}</h2>
              <button onClick={() => { setShowForm(false); setEditingOrder(null); }} className="cursor-pointer"><X className="w-5 h-5 text-[#8A8B8C]" /></button>
            </div>
            {editingOrder && (
              <div className="mb-4 p-3 rounded-lg text-sm" style={{ backgroundColor: "rgba(212, 168, 67, 0.08)", border: "1px solid rgba(212, 168, 67, 0.2)", color: "#D4A843" }}>
                <Info className="w-4 h-4 inline mr-2" />
                {isAdmin
                  ? "Admin: Editing will restore old stock and re-deduct new quantities."
                  : "Editing will restore old stock and re-deduct new quantities."
                }
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div style={{ position: "relative", zIndex: 20 }}>
                  <label className="label-text block mb-1.5">Customer *</label>
                  {editingOrder ? (
                    <div className="input-field" style={{ opacity: 0.7 }}>
                      {(customers || []).find((c) => c.id === formData.customerId)?.name || "Unknown"}
                    </div>
                  ) : (
                    <>
                      <input
                        ref={customerInputRef}
                        type="text"
                        value={customerSearch}
                        onChange={(e) => { setCustomerSearch(e.target.value); setShowCustomerDropdown(true); }}
                        onFocus={handleOpenCustomerDropdown}
                        placeholder="Type to search customers..."
                        className="input-field w-full"
                        required
                        autoComplete="off"
                      />
                      {showCustomerDropdown && (
                        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, maxHeight: 200, overflowY: "auto", backgroundColor: "#18191A", border: "1px solid #2A2B2C", borderRadius: 8, zIndex: 30, marginTop: 4 }}>
                          {filteredCustomers.length === 0 && (
                            <div style={{ padding: 12, color: "#8A8B8C", fontSize: 12 }}>No customers found</div>
                          )}
                          {filteredCustomers.map((c) => (
                            <div
                              key={c.id}
                              onClick={() => handleCustomerSelect(c.id)}
                              style={{ padding: "10px 12px", cursor: "pointer", borderBottom: "1px solid #222324", color: formData.customerId === c.id ? "#D4A843" : "#E8E8E9", fontSize: 13 }}
                              className="hover:bg-[#222324]"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-body font-medium">{c.name}</span>
                                <span className="font-mono-data text-xs" style={{ color: "#8A8B8C" }}>{c.customerCode}</span>
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs" style={{ color: "#4ADE80" }}>{c.priceTier}</span>
                                <span className="text-xs" style={{ color: "#8A8B8C" }}>{c.city}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
                <div>
                  <label className="label-text block mb-1.5">Payment Terms</label>
                  <select value={formData.paymentTerms} onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value as any })} className="input-field">
                    <option value="cod">COD</option><option value="7_days">7 Days</option><option value="14_days">14 Days</option><option value="30_days">30 Days</option>
                  </select>
                </div>
              </div>

              {/* Order Type */}
              <div>
                <label className="label-text block mb-2">Order Type *</label>
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => setFormData({ ...formData, orderType: "regular" })} className="p-3 rounded-xl text-center transition-all cursor-pointer" style={{ backgroundColor: formData.orderType === "regular" ? "rgba(74, 222, 128, 0.08)" : "#0A0A0B", border: formData.orderType === "regular" ? "2px solid #4ADE80" : "2px solid #222324" }}>
                    <ShoppingBag className="w-5 h-5 mx-auto mb-1" style={{ color: formData.orderType === "regular" ? "#4ADE80" : "#8A8B8C" }} />
                    <div className="text-sm font-display font-semibold" style={{ color: formData.orderType === "regular" ? "#4ADE80" : "#8A8B8C" }}>Regular Order</div>
                    <div className="text-xs text-[#8A8B8C] mt-1">Customer is charged</div>
                  </button>
                  <button type="button" onClick={() => setFormData({ ...formData, orderType: "sample" })} className="p-3 rounded-xl text-center transition-all cursor-pointer" style={{ backgroundColor: formData.orderType === "sample" ? "rgba(212, 168, 67, 0.08)" : "#0A0A0B", border: formData.orderType === "sample" ? "2px solid #D4A843" : "2px solid #222324" }}>
                    <FlaskConical className="w-5 h-5 mx-auto mb-1" style={{ color: formData.orderType === "sample" ? "#D4A843" : "#8A8B8C" }} />
                    <div className="text-sm font-display font-semibold" style={{ color: formData.orderType === "sample" ? "#D4A843" : "#8A8B8C" }}>Sample Order</div>
                    <div className="text-xs text-[#8A8B8C] mt-1">Customer is NOT charged</div>
                  </button>
                </div>
                {formData.orderType === "sample" && (
                  <div className="mt-2 p-2 rounded-lg text-xs" style={{ backgroundColor: "rgba(212, 168, 67, 0.05)", color: "#D4A843" }}>
                    1 unit per product max. Customer not charged. Follow-up in 4 days.
                  </div>
                )}
              </div>

              {/* Price Tier */}
              {formData.orderType === "regular" && (
                <div>
                  <label className="label-text block mb-2">Pricing Tier *</label>
                  <div className="grid grid-cols-4 gap-3">
                    {PRICE_TIERS.map((tier) => (
                      <button key={tier.key} type="button" onClick={() => setFormData({ ...formData, priceTier: tier.key as any })} className="p-3 rounded-xl text-center transition-all cursor-pointer" style={{ backgroundColor: formData.priceTier === tier.key ? `${tier.color}20` : "#0A0A0B", border: formData.priceTier === tier.key ? `2px solid ${tier.color}` : "2px solid #222324" }}>
                        <DollarSign className="w-5 h-5 mx-auto mb-1" style={{ color: tier.color }} />
                        <div className="text-sm font-display font-semibold" style={{ color: formData.priceTier === tier.key ? tier.color : "#8A8B8C" }}>{tier.label}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {formData.customerId > 0 && (customerSpecialPrices || []).length > 0 && (
                <div className="p-3 rounded-lg flex items-center gap-2" style={{ backgroundColor: "rgba(212, 168, 67, 0.08)", border: "1px solid rgba(212, 168, 67, 0.15)" }}>
                  <Tag className="w-4 h-4 text-[#D4A843]" />
                  <span className="text-sm text-[#D4A843] font-body">{(customerSpecialPrices || []).length} special price(s) active</span>
                </div>
              )}

              {/* Order Items */}
              <div>
                <label className="label-text block mb-2">Order Items</label>
                <div className="space-y-3">
                  {formData.items.map((item, index) => {
                    const effectivePrice = getEffectivePrice(item.stockItemId, item.unitPrice);
                    const hasSpecial = item.stockItemId > 0 && !!(customerSpecialPrices || []).find((sp: any) => sp.stockItemId === item.stockItemId);
                    const isCustom = item.unitPrice && item.unitPrice > 0;
                    const tierPrice = getTierPrice(item.stockItemId);
                    const availSOH = availableStock[item.stockItemId] || 0;
                    const inProgressOrders = productOrderStatuses[item.stockItemId] || [];

                    return (
                      <div key={index} className="p-3 rounded-lg" style={{ backgroundColor: "#0A0A0B", border: availSOH <= 0 && item.stockItemId > 0 ? "1px solid #EF4444" : "1px solid #222324" }}>
                        <div className="flex gap-3 mb-2">
                          {/* Mobile-friendly product picker */}
                          <button
                            type="button"
                            onClick={() => { setProductPickerIndex(index); setProductPickerOpen(true); }}
                            className="input-field flex-1 text-left flex items-center justify-between cursor-pointer"
                            style={{ minHeight: 40 }}
                          >
                            <span className={item.stockItemId > 0 ? "text-[#E8E8E9]" : "text-[#8A8B8C]"}>
                              {item.stockItemId > 0
                                ? (stockItems || []).find((s) => s.id === item.stockItemId)?.productName || "Select product..."
                                : "Select product..."}
                            </span>
                            <ChevronDown className="w-4 h-4 text-[#8A8B8C] flex-shrink-0" />
                          </button>
                          {formData.orderType === "sample" ? (
                            <div className="w-20 p-2 rounded-lg text-center text-sm font-display" style={{ backgroundColor: "rgba(212, 168, 67, 0.12)", color: "#D4A843" }}>1</div>
                          ) : (
                            <input type="number" value={item.quantity} onChange={(e) => handleUpdateItem(index, "quantity", parseInt(e.target.value) || 1)} className="input-field w-20" min={1} max={editingOrder && isAdmin ? undefined : (availSOH > 0 ? availSOH : undefined)} />
                          )}
                          <button type="button" onClick={() => handleRemoveItem(index)} className="p-2 hover:text-[#EF4444] cursor-pointer"><X className="w-4 h-4 text-[#8A8B8C]" /></button>
                        </div>
                        {item.stockItemId > 0 && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-[#8A8B8C]">Available Stock:</span>
                              <span className={`text-sm font-display font-semibold ${availSOH <= 0 ? "text-[#EF4444]" : "text-[#4ADE80]"}`}>
                                {availSOH} units
                                {availSOH <= 0 && <span className="ml-2"><AlertTriangle className="w-3 h-3 inline" /> OUT OF STOCK</span>}
                              </span>
                            </div>
                            {/* In-progress orders for this product */}
                            {inProgressOrders.length > 0 && (
                              <div className="p-2 rounded-lg" style={{ backgroundColor: "rgba(99, 102, 241, 0.06)", border: "1px solid rgba(99, 102, 241, 0.15)" }}>
                                <div className="text-xs text-[#6366F1] mb-1"><Info className="w-3 h-3 inline mr-1" />Stock committed by other orders:</div>
                                {inProgressOrders.map((io: any, idx: number) => (
                                  <div key={idx} className="flex items-center justify-between text-xs">
                                    <span className="text-[#8A8B8C]">{io.orderNumber}</span>
                                    <span className="font-mono-data" style={{ color: STATUS_LABELS[io.status]?.color }}>{io.qty} units — {STATUS_LABELS[io.status]?.label || io.status}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            <div className="flex items-center gap-4 flex-wrap">
                              <div className="flex items-center gap-2 text-xs"><span className="text-[#8A8B8C]">{formData.priceTier}:</span><span className="font-display" style={{ color: PRICE_TIERS.find((t) => t.key === formData.priceTier)?.color }}>R {tierPrice.toFixed(2)}</span></div>
                              {hasSpecial && !isCustom && <span className="status-badge text-xs" style={{ backgroundColor: "rgba(212, 168, 67, 0.12)", color: "#D4A843" }}><Tag className="w-3 h-3" /> Special: R {effectivePrice.toFixed(2)}</span>}
                              <div className="flex items-center gap-2 ml-auto">
                                <span className="text-xs text-[#8A8B8C]">Custom Price (R):</span>
                                <input type="number" step="0.01" value={item.unitPrice || ""} onChange={(e) => handleUpdateItem(index, "unitPrice", parseFloat(e.target.value) || 0)} className="input-field w-28 text-sm" placeholder={`${effectivePrice.toFixed(2)}`} min={0} />
                                {isCustom && <span className="status-badge text-xs" style={{ backgroundColor: "rgba(99, 102, 241, 0.12)", color: "#6366F1" }}>Custom</span>}
                              </div>
                              <div className="font-display font-semibold text-sm text-white">= R {(effectivePrice * item.quantity).toFixed(2)}</div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <button type="button" onClick={handleAddItem} className="btn-secondary text-xs mt-3"><Plus className="w-3 h-3" /> Add Item</button>
              </div>

              <div>
                <label className="label-text block mb-1.5">Delivery Address</label>
                <textarea value={formData.deliveryAddress} onChange={(e) => setFormData({ ...formData, deliveryAddress: e.target.value })} className="input-field" rows={2} />
              </div>
              <div><label className="label-text block mb-1.5">Notes</label><textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} className="input-field" rows={2} /></div>

              {!orderCheck.valid && formData.items.length > 0 && (
                <div className="p-3 rounded-lg text-sm" style={{ backgroundColor: "rgba(239, 68, 68, 0.08)", border: "1px solid rgba(239, 68, 68, 0.2)", color: "#EF4444" }}><AlertTriangle className="w-4 h-4 inline mr-2" />{orderCheck.error}</div>
              )}

              <button type="submit" className="btn-primary w-full justify-center" disabled={!orderCheck.valid}>
                {editingOrder ? "Update Order" : "Place Order"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
