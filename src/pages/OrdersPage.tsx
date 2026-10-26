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

// Ref for sample quantity override — updated synchronously in startEditOrder
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
  // Quote statuses
  draft: { label: "Draft", color: "#8A8B8C" },
  sent: { label: "Sent", color: "#6366F1" },
  accepted: { label: "Accepted", color: "#4ADE80" },
  rejected: { label: "Rejected", color: "#EF4444" },
  converted: { label: "Converted", color: "#D4A843" },
};

/** Dedicated component for Generate Invoice button.
 *  Uses tRPC useQuery with 5s polling so React auto-re-renders
 *  when invoices change from other devices. This guarantees the
 *  button always shows correct state after any admin generates. */
function safeNum(n: any, fallback = 0): number {
  const val = Number(n);
  return Number.isFinite(val) ? val : fallback;
}
function GenerateInvoiceButton({
  orderId,
}: {
  orderId: number;
}) {
  const [busy, setBusy] = useState(false);
  const utils = trpc.useUtils();

  // Use tRPC useQuery — ALWAYS fetch fresh on mount + poll every 5s
  // The button only mounts when an order is EXPANDED, so refetchOnMount
  // guarantees we see the latest invoices from other admins
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
          // Push to Firebase — CRITICAL: push BOTH invoice AND order
          // so all devices see the invoiceNumber link on the order
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

  // Admin override for below-corporate pricing
  const [adminOverride, setAdminOverride] = useState(false);
  const [adminPin, setAdminPin] = useState("");

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
      reloadFromStorage(); // Force re-read from localStorage into memory
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
      // CRITICAL FIX: Close popup IMMEDIATELY before any async work.
      // Previously setShowForm(false) was AFTER await invalidate() calls.
      // If refetching 5000+ items hangs, the popup stays open forever.
      setShowForm(false); setEditingOrder(null); sampleOverrideRef.current = false; resetForm();
      // Background sync — don't block the UI
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
      // Safety net: always re-enable the form regardless of success/failure
      setShowForm(false); setEditingOrder(null); sampleOverrideRef.current = false;
    },
  });
  const updateOrder = trpc.order.update.useMutation({
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
      alert("Update failed: " + (err.message || "Unknown error"));
    },
    onSettled: () => {
      setShowForm(false); setEditingOrder(null); sampleOverrideRef.current = false;
    },
  });
  const convertQuoteToOrder = trpc.order.convertQuoteToOrder.useMutation({
    onSuccess: async (data) => {
      reloadFromStorage();
      await utils.order.list.invalidate();
      await utils.order.getStats.invalidate();
      await utils.salesRep.getStats.invalidate();
      await utils.salesRep.getSalesBreakdown.invalidate();
      await utils.stock.search.invalidate();
      await utils.stock.list.invalidate();
      await utils.stock.getStats.invalidate();
      await utils.invoice.list.invalidate();
      if (data?.order) {
        alert(`Quote converted to order ${data.order.orderNumber} successfully!`);
      }
    },
    onError: (err: any) => {
      alert("Failed to convert quote: " + (err.message || "Unknown error"));
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
    setCustomerSearch("");
    setShowCustomerDropdown(false);
    setAdminOverride(false);
    setAdminPin("");
  }

  function getTierPrice(stockItemId: number | string, tier?: string): number {
    const stock = (stockItems || []).find((s) => String(s.id) === String(stockItemId));
    if (!stock) return 0;
    // Sample orders ALWAYS use corporate price tier regardless of formData.priceTier
    const effectiveTier = formData.orderType === "sample" ? "corporate" : (tier || formData.priceTier);
    let rawPrice: number;
    switch (effectiveTier) {
      case "corporate": rawPrice = Number(stock.corporatePrice); break;
      case "bulk": rawPrice = Number(stock.bulkPrice); break;
      case "retail": rawPrice = Number(stock.retailPrice); break;
      default: rawPrice = Number(stock.wholesalePrice); break;
    }
    // If loaded price is 0 or missing, fall back to STATIC_PRODUCTS (source of truth)
    if (!Number.isFinite(rawPrice) || rawPrice <= 0) {
      let staticProd = (staticData.STATIC_PRODUCTS || []).find((p: any) => String(p.id) === String(stockItemId) || p.productCode === stock.productCode || (stock.productName && p.productName && String(p.productName).toLowerCase().trim() === String(stock.productName).toLowerCase().trim()));
      // Renamed-format fallback: productCode may hold the static name (e.g. "20 MEGA LONG VALUE")
      // with color appended to productName (e.g. "MEGA LONG VALUE Brown")
      if (!staticProd && stock.productCode) {
        const codeNorm = String(stock.productCode).toLowerCase().trim().replace(/\s+/g, " ");
        const colorNorm = String(stock.color || "").toLowerCase().trim();
        staticProd = (staticData.STATIC_PRODUCTS || []).find((p: any) =>
          String(p.productName || "").toLowerCase().trim().replace(/\s+/g, " ") === codeNorm &&
          (!colorNorm || String(p.color || "").toLowerCase().trim() === colorNorm)
        );
      }
      if (staticProd) {
        switch (effectiveTier) {
          case "corporate": rawPrice = Number(staticProd.corporatePrice); break;
          case "bulk": rawPrice = Number(staticProd.bulkPrice); break;
          case "retail": rawPrice = Number(staticProd.retailPrice); break;
          default: rawPrice = Number(staticProd.wholesalePrice); break;
        }
      }
    }
    return rawPrice;
  }

  function getEffectivePrice(stockItemId: number | string, customPrice?: number): number {
    if (customPrice && customPrice > 0) return customPrice;
    // Sample orders must ALWAYS use corporate price — never special/customer prices
    if (formData.orderType === "sample") {
      return getTierPrice(stockItemId);
    }
    const sp = (customerSpecialPrices || []).find((p: any) => String(p.stockItemId) === String(stockItemId));
    if (sp) return Number(sp.specialPrice);
    return getTierPrice(stockItemId);
  }

  function handleCustomerSelect(cid: number | string) {
    const customer = (customers || []).find((c) => String(c.id) === String(cid));
    setFormData({ ...formData, customerId: Number(cid) || 0,
      priceTier: (customer?.priceTier as any) || "wholesale",
      paymentTerms: (customer?.paymentTerms as any) || "cod",
      deliveryAddress: customer?.physicalAddress || "",
      // Only clear items when creating a NEW order — preserve items when editing
      items: editingOrder ? formData.items : [],
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
    const list = (customers || []).filter(Boolean).sort((a: any, b: any) => a.name?.localeCompare(b.name || "") || 0);
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

  const handleUpdateItem = (index: number, field: string, value: number | string) => {
    setFormData((prev) => {
      const updated = [...prev.items];
      updated[index] = { ...updated[index], [field]: value };
      if (field === "stockItemId" && Number(value) > 0) {
        const product = (stockItems || []).find((s) => String(s.id) === String(value));
        const units = product?.sellingUnits || [];
        if (units.length > 0) {
          updated[index].unit = units[0].unit;
          updated[index].conversion = units[0].conversion;
          updated[index].unitLabel = units[0].label;
        } else {
          updated[index].unit = "each";
          updated[index].conversion = 1;
          updated[index].unitLabel = "Each";
        }
        if (prev.orderType === "sample" && !sampleOverrideRef.current) updated[index].quantity = 1;
      }
      if (prev.orderType === "sample" && field === "quantity" && Number(value) > 1 && !sampleOverrideRef.current) {
        updated[index].quantity = 1;
      }
      return { ...prev, items: updated };
    });
  };

  function canEditOrderBasic(): { valid: boolean; error?: string } {
    // Basic validation for admin editing existing orders — no stock check
    const validItems = formData.items.filter((i) => Number(i.stockItemId) > 0 && Number(i.quantity) > 0);
    if (validItems.length === 0) return { valid: false, error: "Add at least one item" };
    if (Number(formData.customerId) === 0) return { valid: false, error: "Select a customer" };
    return { valid: true };
  }

  function canPlaceOrder(): { valid: boolean; error?: string } {
    const validItems = formData.items.filter((i) => Number(i.stockItemId) > 0 && Number(i.quantity) > 0);
    if (validItems.length === 0) return { valid: false, error: "Add at least one item" };
    if (Number(formData.customerId) === 0) return { valid: false, error: "Select a customer" };
    // Quotes don't deduct stock — skip stock validation
    if (formData.orderType === "quote") return { valid: true };
    for (const item of validItems) {
      const stockId = Number(item.stockItemId);
      const avail = availableStock[stockId] || 0;
      const conversion = item.conversion || 1;
      const requestedQty = Number(item.quantity) * conversion;
      if (avail <= 0) { const s = (stockItems || []).find((x) => Number(x.id) === stockId); return { valid: false, error: `${s?.productName || "Product"} is OUT OF STOCK.` }; }
      if (formData.orderType === "sample") {
        // When editing, exclude the current order from the duplicate check
        const existing = (orders || []).some((o) => 
          o.id !== editingOrder?.id && // Exclude the order being edited
          Number(o.customerId) === Number(formData.customerId) && 
          o.orderType === "sample" && 
          o.items?.some((it: any) => Number(it.stockItemId) === stockId)
        );
        if (existing) { const s = (stockItems || []).find((x) => Number(x.id) === stockId); return { valid: false, error: `Customer already sampled ${s?.productName || "this product"}.` }; }
        if (Number(item.quantity) > 1 && !sampleOverrideRef.current) return { valid: false, error: "Sample orders: 1 unit per product max. Only Super Admin can override." };
      } else { if (requestedQty > avail) { const s = (stockItems || []).find((x) => Number(x.id) === stockId); return { valid: false, error: `Insufficient stock for ${s?.productName || "product"}. Available: ${avail} kg, Requested: ${requestedQty} kg (${item.quantity} ${item.unitLabel || "units"})` }; } }
    }

    // CUSTOMER ACCOUNT CHECK: validate active status, credit limit, COD overdue
    const customer = (customers || []).find((c) => String(c.id) === String(formData.customerId));
    if (customer) {
      // Check inactive
      if (customer.isActive === false && !isSuperAdmin && !adminOverride) {
        return { valid: false, error: `Customer account is INACTIVE. Only Super Admin can place orders for inactive customers.` };
      }
      // Check credit limit (non-COD only)
      const creditLimit = Number(customer.creditLimit || 0);
      if (creditLimit > 0 && formData.paymentTerms !== "cod") {
        const outstanding = (invoices || [])
          .filter((inv: any) => inv.customerId == customer.id && inv.status !== "cancelled" && (inv.balanceDue || 0) > 0.01)
          .reduce((sum: number, inv: any) => sum + (inv.balanceDue || 0), 0);
        if (outstanding >= creditLimit && !isSuperAdmin && !adminOverride) {
          return { valid: false, error: `Credit limit exceeded. Limit: R ${creditLimit.toFixed(2)}, Outstanding: R ${outstanding.toFixed(2)}. Only Super Admin can override.` };
        }
      }
      // Check COD overdue (2 days)
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

    // ZERO AMOUNT VALIDATION: Calculate running total — reject if R0
    if (formData.orderType !== "sample" && formData.orderType !== "quote") {
      let runningSubtotal = 0;
      for (const item of validItems) {
        const stock = (stockItems || []).find((s) => Number(s.id) === Number(item.stockItemId));
        const conversion = item.conversion || 1;
        const basePrice = getEffectivePrice(item.stockItemId);
        const unitPrice = item.unitPrice && item.unitPrice > 0 ? item.unitPrice : basePrice * conversion;
        runningSubtotal += unitPrice * item.quantity;
      }
      const runningTotal = runningSubtotal * 1.15;
      if (runningTotal <= 0) {
        return { valid: false, error: "Order total is R0.00. Please enter a valid unit price for each item before placing the order." };
      }

      // BELOW-CORPORATE VALIDATION: Check custom prices against corporate floor
      const belowItems: string[] = [];
      for (const item of validItems) {
        // Only check items where a custom price was explicitly entered (> 0)
        if (item.unitPrice && item.unitPrice > 0) {
          const stock = (stockItems || []).find((s) => Number(s.id) === Number(item.stockItemId));
          if (stock) {
            const conversion = item.conversion || 1;
            const corporateFloor = Number(stock.corporatePrice || 0) * conversion;
            if (corporateFloor > 0 && item.unitPrice < corporateFloor * 0.99) {
              belowItems.push(`${stock.productName}: R${item.unitPrice.toFixed(2)} (floor R${corporateFloor.toFixed(2)})`);
            }
          }
        }
      }
      if (belowItems.length > 0 && !isAdmin && !adminOverride) {
        return { valid: false, error: `PRICE BELOW CORPORATE FLOOR:\n${belowItems.join("\n")}\n\nSuper admin approval required.` };
      }
    }

    // SUPER ADMIN PIN VALIDATION: if override checkbox is checked, require valid PIN
    if (adminOverride) {
      if (!adminPin || adminPin.trim().length === 0) {
        return { valid: false, error: "Please enter your admin PIN to approve this order." };
      }
      // Resolve PIN from multiple sources (cloud-first: Firebase may not have pin field synced)
      let effectivePin = "";
      // 1. Hardcoded defaults (most reliable — survives any data corruption)
      const DEFAULT_USERS = [
        { id: 1, name: "Collin", pin: "2580" },
        { id: 2, name: "Adeli", pin: "1111" },
        { id: 3, name: "Inhouse", pin: "2222" },
        { id: 4, name: "Michael", pin: "3333" },
        { id: 5, name: "Nkosana", pin: "4444" },
        { id: 6, name: "Tebogo Bila", pin: "6666" },
        { id: 7, name: "Aggie", pin: "1018" },
        { id: 8, name: "Ronald", pin: "2581" },
        { id: 9, name: "Jolene", pin: "7777" },
        { id: 10, name: "David", pin: "8888" },
      ];
      const defaultUser = DEFAULT_USERS.find((u) =>
        u.id === user?.id ||
        (u.name && user?.name && u.name.toLowerCase() === user.name.toLowerCase())
      );
      if (defaultUser) effectivePin = defaultUser.pin;
      // 2. Direct localStorage read (bypasses React state / tRPC cache)
      if (!effectivePin) {
        try {
          const demoStr = localStorage.getItem("demo_user");
          if (demoStr) {
            const demo = JSON.parse(demoStr);
            if (demo.pin != null) effectivePin = String(demo.pin);
          }
        } catch { /* ignore */ }
      }
      // 3. sgf_users in localStorage (Firebase-synced users)
      if (!effectivePin) {
        try {
          const rawUsers = localStorage.getItem("sgf_users");
          if (rawUsers) {
            const allUsers = JSON.parse(rawUsers);
            const dbUser = allUsers.find((u: any) =>
              u.id === user?.id ||
              (u.name && user?.name && u.name.toLowerCase() === user.name.toLowerCase())
            );
            if (dbUser?.pin != null) effectivePin = String(dbUser.pin);
          }
        } catch { /* ignore */ }
      }
      if (adminPin !== effectivePin) {
        return { valid: false, error: "Incorrect admin PIN. Please enter your correct PIN to approve this order." };
      }
    }

    return { valid: true };
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // When editing ANY order, use basic validation (no stock check, no duplicate checks)
    // Stock was already deducted when order was created; we're just updating details
    const check = editingOrder ? canEditOrderBasic() : canPlaceOrder();
    if (!check.valid) { alert(check.error); return; }
    const validItems = formData.items.filter((i) => Number(i.stockItemId) > 0 && Number(i.quantity) > 0);
    // CRITICAL FIX: Coerce IDs to numbers because Firebase returns them as strings.
    // tRPC Zod schema expects numbers; without coercion, client-side validation
    // fails silently (no onError), making the Place Order button appear to do nothing.
    const payload: any = {
      customerId: Number(formData.customerId) || 0,
      orderType: formData.orderType,
      paymentTerms: formData.paymentTerms,
      priceTier: formData.priceTier,
      deliveryAddress: formData.deliveryAddress,
      notes: formData.notes,
      items: validItems.map((item) => ({
        stockItemId: Number(item.stockItemId) || 0,
        quantity: formData.orderType === "sample" && !sampleOverrideRef.current ? 1 : Number(item.quantity) || 0,
        unitPrice: formData.orderType === "sample" ? 0 : (item.unitPrice && item.unitPrice > 0 ? item.unitPrice : undefined),
        unit: item.unit || "each",
        conversion: item.conversion || 1,
        unitLabel: item.unitLabel || "Each"
      }))
    };
    // Only set salesRepName on NEW orders. On edit, preserve original.
    // Use the customer's assigned sales rep, not the logged-in user.
    if (!editingOrder) {
      const customer = (customers || []).find((c) => String(c.id) === String(formData.customerId));
      payload.salesRepName = customer?.salesRepName || user?.name || "";
      // Pass admin override flag for below-corporate pricing approval
      if (adminOverride) {
        payload.adminApproved = true;
      }
      // Pass super admin override for customer blocking (inactive, credit limit, COD overdue)
      if (adminOverride && adminPin) {
        payload.superAdminOverride = true;
      }
    }
    if (editingOrder) {
      updateOrder.mutate({ id: editingOrder.id, data: payload });
    } else {
      createOrder.mutate(payload);
    }
  }

  function startEditOrder(order: any) {
    setEditingOrder(order);
    sampleOverrideRef.current = order?.orderType === "sample" && user?.role === "super_admin";
    setAdminOverride(false);
    setAdminPin("");
    setFormData({
      customerId: order.customerId, orderType: order.orderType || "regular",
      paymentTerms: order.paymentTerms || "cod", priceTier: order.priceTier || "wholesale",
      deliveryAddress: order.deliveryAddress || "", notes: order.notes || "",
      items: (order.items || []).map((it: any) => ({ stockItemId: it.stockItemId, quantity: it.quantity, unitPrice: it.unitPrice, unit: it.unit || "each", conversion: it.conversion || 1, unitLabel: it.unitLabel || "Each" })),
    });
    // Pre-fill customer search with existing customer name so field is not blank
    const cust = (customers || []).find((c: any) => c.id === order.customerId);
    setCustomerSearch(cust?.name || "");
    setShowForm(true);
  }

  function canEditOrder(order: any): boolean {
    // ONLY ADMIN can edit orders (admin or super_admin).
    // Sales reps can NO LONGER edit their own orders — they must contact admin.
    // Quotes: only admin can edit while in draft or sent status.
    if (order.orderType === "quote") {
      if (order.status === "converted" || order.status === "rejected") return false;
      return isAdmin;
    }
    // Admin can edit ANY order (including delivered/cancelled/sample_delivered)
    return isAdmin;
  }

  function canCancelOrder(order: any): boolean {
    // ONLY ADMIN can cancel orders.
    // Sales reps can NO LONGER cancel orders — they must contact admin.
    // Quotes: only admin can reject while in draft or sent status.
    if (order.orderType === "quote") {
      if (order.status === "converted" || order.status === "rejected") return false;
      return isAdmin;
    }
    // Admin can cancel ANY non-cancelled order
    return isAdmin && order.status !== "cancelled";
  }

  function canProgressOrder(order: any): boolean {
    // Quotes don't use the normal order status flow
    if (order.orderType === "quote") return false;
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
    <div class="subtitle">Tel: ${getCompanyConfig((order.company || "sgf") as any).contact.phone}</div>
  </div>
  <div class="doc-title">FACTORY PICKING SLIP</div>
  <div style="text-align:center;margin-bottom:15px;">
    <span class="badge ${order.orderType === "sample" ? "badge-sample" : ""}">${order.orderType === "sample" ? "SAMPLE ORDER — NO CHARGE" : `PRICE TIER: ${(order.priceTier || "WHOLESALE").toUpperCase()}`}</span>
  </div>
  <div class="info-section">
    <div class="info-block"><div class="label">Invoice Number</div><div class="value inv-num">${invoiceNumber}</div></div>
    <div class="info-block"><div class="label">Order Number</div><div class="value">${order.orderNumber}</div></div>
    <div class="info-block"><div class="label">Date</div><div class="value">${new Date(order.createdAt).toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" })}</div></div>
    <div class="info-block"><div class="label">Sales Rep</div><div class="value" style="color:#D4A843;font-weight:700;">${customer?.salesRepName || order.salesRepName || "N/A"}</div></div>
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
      ${order.items?.map((item: any) => `<tr><td>${item.productCode}</td><td>${item.productName}</td><td style="font-weight:bold;font-size:16px;">${item.quantity}${item.unitLabel ? ` <span style="color:#888;font-size:10px;">${item.unitLabel}</span>` : ""}</td></tr>`).join("") || ""}
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

  /** Print a professional quote document on Supreme Global Foods stationery */
  function printQuote(order: any) {
    const customer = getCustomer(order);
    const logoUrl = `${window.location.origin}/sgf-logo.png`;
    const validUntil = new Date(order.createdAt);
    validUntil.setDate(validUntil.getDate() + 30);
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`
<html><head><title>Quote - ${order.orderNumber}</title>
<style>
  @page { size: A4; margin: 10mm; }
  @media print { body { padding: 0; } .no-print { display: none; } }
  body { font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; color: #333; }
  .header { text-align: center; margin-bottom: 12px; border-bottom: 3px solid #D4A843; padding-bottom: 10px; }
  .logo-img { height: 45px; margin-bottom: 2px; }
  .logo-fallback { font-size: 24px; font-weight: bold; color: #D4A843; letter-spacing: 1px; display: none; }
  .subtitle { color: #666; font-size: 11px; margin-top: 2px; }
  .doc-title { text-align: center; color: #D4A843; font-size: 20px; font-weight: bold; margin: 10px 0; letter-spacing: 2px; }
  .badge { display: inline-block; padding: 3px 10px; border-radius: 4px; font-size: 10px; font-weight: bold; text-transform: uppercase; background: #6366F1; color: white; }
  .info-section { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px; padding: 10px; background: #f9f9f9; border-radius: 6px; }
  .label { font-size: 9px; color: #888; text-transform: uppercase; letter-spacing: 1px; }
  .value { font-size: 12px; font-weight: 600; margin-top: 2px; color: #222; }
  .full-width { grid-column: 1 / -1; }
  table { width: 100%; border-collapse: collapse; margin-top: 10px; }
  th { background: #D4A843; color: white; padding: 8px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; }
  td { padding: 8px; border-bottom: 1px solid #e0e0e0; font-size: 11px; }
  .text-right { text-align: right; }
  .totals { margin-top: 12px; padding: 10px; background: #fafafa; border-radius: 6px; border-left: 4px solid #D4A843; }
  .total-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 12px; }
  .total-final { font-size: 16px; font-weight: bold; color: #D4A843; border-top: 2px solid #D4A843; padding-top: 6px; margin-top: 4px; }
  .terms { margin-top: 14px; padding: 10px; background: #f5f5f5; border-radius: 6px; }
  .terms-title { font-size: 11px; font-weight: bold; color: #D4A843; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; }
  .terms-text { font-size: 10px; color: #666; line-height: 1.5; }
  .footer { margin-top: 16px; text-align: center; font-size: 10px; color: #999; border-top: 1px solid #e0e0e0; padding-top: 10px; }
  .banking { margin-top: 12px; padding: 10px; background: #fafafa; border-radius: 6px; border: 1px solid #e0e0e0; }
  .banking-title { font-size: 11px; font-weight: bold; color: #D4A843; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; }
  .banking-row { display: grid; grid-template-columns: 120px 1fr; font-size: 11px; padding: 2px 0; }
  .banking-label { color: #888; }
  .banking-value { color: #333; font-weight: 600; }
</style></head><body>
  <div class="header">
    <img class="logo-img" src="${logoUrl}" onerror="this.style.display='none';document.getElementById('logo-fb').style.display='block'" />
    <div id="logo-fb" class="logo-fallback">SUPREME GLOBAL FOODS</div>
    <div class="subtitle">28 Nagington Road, Wadeville, Germiston, 1422</div>
    <div class="subtitle">sales@supremeglobalfoods.co.za &middot; Tel: 061 478 8888</div>
  </div>
  <div class="doc-title">QUOTATION</div>
  <div style="text-align:center;margin-bottom:10px;"><span class="badge">QUOTE</span></div>
  <div class="info-section">
    <div><div class="label">Quote Number</div><div class="value" style="color:#D4A843;font-size:14px;">${order.orderNumber}</div></div>
    <div><div class="label">Date</div><div class="value">${new Date(order.createdAt).toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" })}</div></div>
    <div><div class="label">Valid Until</div><div class="value" style="color:#6366F1;">${validUntil.toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" })}</div></div>
    <div><div class="label">Prepared By</div><div class="value">${customer?.salesRepName || order.salesRepName || "N/A"}</div></div>
    <div class="full-width" style="margin-top:4px;border-top:1px solid #e0e0e0;padding-top:8px;">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        <div>
          <div class="label">Customer</div><div class="value">${customer?.name || "N/A"}</div>
          <div class="label" style="margin-top:4px;">Customer Code</div><div class="value">${customer?.customerCode || "N/A"}</div>
          <div class="label" style="margin-top:4px;">Contact Person</div><div class="value">${customer?.contactPerson || "N/A"}</div>
          <div class="label" style="margin-top:4px;">Phone</div><div class="value">${customer?.phone || "N/A"}</div>
        </div>
        <div>
          <div class="label">Delivery Address</div><div class="value">${order.deliveryAddress || customer?.physicalAddress || "N/A"}${customer?.city ? `, ${customer.city}` : ""}</div>
          <div class="label" style="margin-top:4px;">Payment Terms</div><div class="value">${order.paymentTerms === "cod" ? "Cash on Delivery" : order.paymentTerms === "7_days" ? "7 Days" : order.paymentTerms === "14_days" ? "14 Days" : order.paymentTerms === "30_days" ? "30 Days" : order.paymentTerms || "N/A"}</div>
          <div class="label" style="margin-top:4px;">Price Tier</div><div class="value">${(order.priceTier || "wholesale").toUpperCase()}</div>
        </div>
      </div>
    </div>
  </div>
  <table>
    <thead><tr><th>Product Code</th><th>Product Name</th><th style="text-align:center;">Qty</th><th style="text-align:right;">Unit</th><th style="text-align:right;">Unit Price</th><th style="text-align:right;">Line Total</th></tr></thead>
    <tbody>
      ${order.items?.map((item: any) => `
        <tr>
          <td>${item.productCode || "N/A"}</td>
          <td><strong>${item.productName || "Unknown"}</strong>${item.unitLabel ? `<br/><span style="color:#888;font-size:9px;">${item.unitLabel}</span>` : ""}</td>
          <td style="text-align:center;font-weight:bold;">${item.quantity}</td>
          <td style="text-align:right;">${item.unit || "each"}</td>
          <td style="text-align:right;">R ${safeNum(item.unitPrice).toFixed(2)}</td>
          <td style="text-align:right;font-weight:600;">R ${safeNum(item.lineTotal).toFixed(2)}</td>
        </tr>
      `).join("") || ""}
    </tbody>
  </table>
  <div class="totals">
    <div class="total-row"><span>Subtotal</span><span>R ${safeNum(order.subtotal).toFixed(2)}</span></div>
    <div class="total-row"><span>VAT (15%)</span><span>R ${safeNum(order.vat).toFixed(2)}</span></div>
    <div class="total-final"><span>TOTAL</span><span>R ${safeNum(order.total).toFixed(2)}</span></div>
  </div>
  <div class="banking">
    <div class="banking-title">Banking Details</div>
    <div class="banking-row"><span class="banking-label">Bank</span><span class="banking-value">${banking.bankName}</span></div>
    <div class="banking-row"><span class="banking-label">Account Name</span><span class="banking-value">${banking.accountName}</span></div>
    <div class="banking-row"><span class="banking-label">Account Number</span><span class="banking-value">${banking.accountNumber}</span></div>
    <div class="banking-row"><span class="banking-label">Branch Code</span><span class="banking-value">${banking.branchCode}</span></div>
    <div class="banking-row"><span class="banking-label">Branch Name</span><span class="banking-value">${banking.branchName}</span></div>
  </div>
  <div class="terms">
    <div class="terms-title">Terms & Conditions</div>
    <div class="terms-text">This quotation is valid for 30 days from the date of issue. Prices are subject to change without notice after the validity period. Payment terms are strictly as stated above. Goods remain the property of Supreme Global Foods until paid in full. E&OE.</div>
  </div>
  <div class="footer">
    <div>28 Nagington Road, Wadeville, Germiston, 1422 &middot; sales@supremeglobalfoods.co.za &middot; Tel: 061 478 8888</div>
    <div style="margin-top:4px;">Reg: 2018/123456/07 &middot; VAT: 4120263826</div>
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
    w.document.close();
  }

  /** Print a professional invoice on Supreme Global Foods stationery */
  function printInvoice(order: any) {
    const customer = getCustomer(order);
    const matchedInvoice = (invoices || []).find((i: any) => i.orderId == order.id);
    const invoiceNumber = matchedInvoice?.invoiceNumber || "N/A";
    const logoUrl = `${window.location.origin}/sgf-logo.png`;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
<html><head><title>Invoice - ${invoiceNumber}</title>
<style>
  @page { size: A4; margin: 10mm; }
  @media print { body { padding: 0; } .no-print { display: none; } }
  body { font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; color: #333; }
  .header { text-align: center; margin-bottom: 12px; border-bottom: 3px solid #D4A843; padding-bottom: 10px; }
  .logo-img { height: 45px; margin-bottom: 2px; }
  .logo-fallback { font-size: 24px; font-weight: bold; color: #D4A843; letter-spacing: 1px; display: none; }
  .subtitle { color: #666; font-size: 11px; margin-top: 2px; }
  .doc-title { text-align: center; color: #D4A843; font-size: 20px; font-weight: bold; margin: 10px 0; letter-spacing: 2px; }
  .badge { display: inline-block; padding: 3px 10px; border-radius: 4px; font-size: 10px; font-weight: bold; text-transform: uppercase; background: #4ADE80; color: white; }
  .info-section { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px; padding: 10px; background: #f9f9f9; border-radius: 6px; }
  .label { font-size: 9px; color: #888; text-transform: uppercase; letter-spacing: 1px; }
  .value { font-size: 12px; font-weight: 600; margin-top: 2px; color: #222; }
  .full-width { grid-column: 1 / -1; }
  table { width: 100%; border-collapse: collapse; margin-top: 10px; }
  th { background: #D4A843; color: white; padding: 8px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; }
  td { padding: 8px; border-bottom: 1px solid #e0e0e0; font-size: 11px; }
  .text-right { text-align: right; }
  .totals { margin-top: 12px; padding: 10px; background: #fafafa; border-radius: 6px; border-left: 4px solid #D4A843; }
  .total-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 12px; }
  .total-final { font-size: 16px; font-weight: bold; color: #D4A843; border-top: 2px solid #D4A843; padding-top: 6px; margin-top: 4px; }
  .terms { margin-top: 14px; padding: 10px; background: #f5f5f5; border-radius: 6px; }
  .terms-title { font-size: 11px; font-weight: bold; color: #D4A843; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; }
  .terms-text { font-size: 10px; color: #666; line-height: 1.5; }
  .footer { margin-top: 16px; text-align: center; font-size: 10px; color: #999; border-top: 1px solid #e0e0e0; padding-top: 10px; }
  .banking { margin-top: 12px; padding: 10px; background: #fafafa; border-radius: 6px; border: 1px solid #e0e0e0; }
  .banking-title { font-size: 11px; font-weight: bold; color: #D4A843; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; }
  .banking-row { display: grid; grid-template-columns: 120px 1fr; font-size: 11px; padding: 2px 0; }
  .banking-label { color: #888; }
  .banking-value { color: #333; font-weight: 600; }
</style></head><body>
  <div class="header">
    <img class="logo-img" src="${logoUrl}" onerror="this.style.display='none';document.getElementById('logo-fb').style.display='block'" />
    <div id="logo-fb" class="logo-fallback">SUPREME GLOBAL FOODS</div>
    <div class="subtitle">28 Nagington Road, Wadeville, Germiston, 1422</div>
    <div class="subtitle">sales@supremeglobalfoods.co.za &middot; Tel: 061 478 8888</div>
  </div>
  <div class="doc-title">TAX INVOICE</div>
  <div style="text-align:center;margin-bottom:10px;"><span class="badge">INVOICE</span></div>
  <div class="info-section">
    <div><div class="label">Invoice Number</div><div class="value" style="color:#D4A843;font-size:14px;">${invoiceNumber}</div></div>
    <div><div class="label">Order Number</div><div class="value">${order.orderNumber}</div></div>
    <div><div class="label">Date</div><div class="value">${new Date(order.createdAt).toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" })}</div></div>
    <div><div class="label">Sales Rep</div><div class="value">${customer?.salesRepName || order.salesRepName || "N/A"}</div></div>
    <div class="full-width" style="margin-top:4px;border-top:1px solid #e0e0e0;padding-top:8px;">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        <div>
          <div class="label">Customer</div><div class="value">${customer?.name || "N/A"}</div>
          <div class="label" style="margin-top:4px;">Customer Code</div><div class="value">${customer?.customerCode || "N/A"}</div>
          <div class="label" style="margin-top:4px;">Contact Person</div><div class="value">${customer?.contactPerson || "N/A"}</div>
          <div class="label" style="margin-top:4px;">Phone</div><div class="value">${customer?.phone || "N/A"}</div>
        </div>
        <div>
          <div class="label">Delivery Address</div><div class="value">${order.deliveryAddress || customer?.physicalAddress || "N/A"}${customer?.city ? `, ${customer.city}` : ""}</div>
          <div class="label" style="margin-top:4px;">Payment Terms</div><div class="value">${order.paymentTerms === "cod" ? "Cash on Delivery" : order.paymentTerms === "7_days" ? "7 Days" : order.paymentTerms === "14_days" ? "14 Days" : order.paymentTerms === "30_days" ? "30 Days" : order.paymentTerms || "N/A"}</div>
          <div class="label" style="margin-top:4px;">Price Tier</div><div class="value">${(order.priceTier || "wholesale").toUpperCase()}</div>
        </div>
      </div>
    </div>
  </div>
  <table>
    <thead><tr><th>Product Code</th><th>Product Name</th><th style="text-align:center;">Qty</th><th style="text-align:right;">Unit</th><th style="text-align:right;">Unit Price</th><th style="text-align:right;">Line Total</th></tr></thead>
    <tbody>
      ${order.items?.map((item: any) => `
        <tr>
          <td>${item.productCode || "N/A"}</td>
          <td><strong>${item.productName || "Unknown"}</strong>${item.unitLabel ? `<br/><span style="color:#888;font-size:9px;">${item.unitLabel}</span>` : ""}</td>
          <td style="text-align:center;font-weight:bold;">${item.quantity}</td>
          <td style="text-align:right;">${item.unit || "each"}</td>
          <td style="text-align:right;">R ${safeNum(item.unitPrice).toFixed(2)}</td>
          <td style="text-align:right;font-weight:600;">R ${safeNum(item.lineTotal).toFixed(2)}</td>
        </tr>
      `).join("") || ""}
    </tbody>
  </table>
  <div class="totals">
    <div class="total-row"><span>Subtotal</span><span>R ${safeNum(order.subtotal).toFixed(2)}</span></div>
    <div class="total-row"><span>VAT (15%)</span><span>R ${safeNum(order.vat).toFixed(2)}</span></div>
    <div class="total-final"><span>TOTAL</span><span>R ${safeNum(order.total).toFixed(2)}</span></div>
  </div>
  <div class="banking">
    <div class="banking-title">Banking Details</div>
    <div class="banking-row"><span class="banking-label">Bank</span><span class="banking-value">${banking.bankName}</span></div>
    <div class="banking-row"><span class="banking-label">Account Name</span><span class="banking-value">${banking.accountName}</span></div>
    <div class="banking-row"><span class="banking-label">Account Number</span><span class="banking-value">${banking.accountNumber}</span></div>
    <div class="banking-row"><span class="banking-label">Branch Code</span><span class="banking-value">${banking.branchCode}</span></div>
    <div class="banking-row"><span class="banking-label">Branch Name</span><span class="banking-value">${banking.branchName}</span></div>
  </div>
  <div class="terms">
    <div class="terms-title">Terms & Conditions</div>
    <div class="terms-text">Payment is due strictly in accordance with the payment terms stated above. Interest will be charged on overdue accounts. Goods remain the property of Supreme Global Foods until paid in full. E&OE.</div>
  </div>
  <div class="footer">
    <div>28 Nagington Road, Wadeville, Germiston, 1422 &middot; sales@supremeglobalfoods.co.za &middot; Tel: 061 478 8888</div>
    <div style="margin-top:4px;">Reg: 2018/123456/07 &middot; VAT: 4120263826</div>
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

  /** Email a professional invoice as a shareable mailto link */
  function emailInvoice(order: any) {
    const customer = getCustomer(order);
    const matchedInvoice = (invoices || []).find((i: any) => i.orderId == order.id);
    const invoiceNumber = matchedInvoice?.invoiceNumber || "N/A";
    const subject = encodeURIComponent(`Tax Invoice ${invoiceNumber} — Supreme Global Foods`);
    const body = encodeURIComponent(`Dear ${customer?.name || "Customer"},\n\nPlease find your tax invoice attached.\n\nInvoice Number: ${invoiceNumber}\nOrder Number: ${order.orderNumber}\nDate: ${new Date(order.createdAt).toLocaleDateString("en-ZA")}\nTotal: R ${safeNum(order.total).toFixed(2)}\n\nPayment Terms: ${order.paymentTerms === "cod" ? "Cash on Delivery" : order.paymentTerms === "7_days" ? "7 Days" : order.paymentTerms === "14_days" ? "14 Days" : order.paymentTerms === "30_days" ? "30 Days" : order.paymentTerms || "N/A"}\n\nBanking Details:\nBank: ${banking.bankName}\nAccount Name: ${banking.accountName}\nAccount Number: ${banking.accountNumber}\nBranch Code: ${banking.branchCode}\nBranch Name: ${banking.branchName}\n\nKind regards,\nSupreme Global Foods Team\nsales@supremeglobalfoods.co.za\n061 478 8888`);
    window.location.href = `mailto:${customer?.email || ""}?subject=${subject}&body=${body}`;
  }

  // Build filtered orders
  const filteredOrders = useMemo(() => {
    let list = (orders || []).filter((o: any) => {
      if (activeTab === "all") return true;
      if (activeTab === "sample") return o.orderType === "sample";
      if (activeTab === "quotes") return o.orderType === "quote";
      return o.status === activeTab && o.orderType !== "sample" && o.orderType !== "quote";
    });
    const q = orderSearch.toLowerCase().trim();
    if (q) {
      list = list.filter((o: any) =>
        o.orderNumber?.toLowerCase().includes(q) ||
        o.customerName?.toLowerCase().includes(q) ||
        o.salesRepName?.toLowerCase().includes(q) ||
        String(o.id).includes(q)
      );
    }
    return list.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [orders, activeTab, orderSearch]);

  // Stats
  const orderCounts = useMemo(() => {
    const all = orders || [];
    return {
      all: all.length,
      pending: all.filter((o: any) => o.status === "pending" && o.orderType !== "sample" && o.orderType !== "quote").length,
      picking: all.filter((o: any) => o.status === "picking" && o.orderType !== "sample" && o.orderType !== "quote").length,
      ready: all.filter((o: any) => o.status === "ready" && o.orderType !== "sample" && o.orderType !== "quote").length,
      delivered: all.filter((o: any) => o.status === "delivered" && o.orderType !== "sample" && o.orderType !== "quote").length,
      cancelled: all.filter((o: any) => o.status === "cancelled" && o.orderType !== "sample" && o.orderType !== "quote").length,
      sample: all.filter((o: any) => o.orderType === "sample").length,
      quotes: all.filter((o: any) => o.orderType === "quote").length,
    };
  }, [orders]);

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {statusTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="card-surface p-3 text-center transition-all cursor-pointer"
            style={{
              border: activeTab === tab.key ? "2px solid #D4A843" : "2px solid transparent",
              backgroundColor: activeTab === tab.key ? "rgba(212,168,67,0.1)" : undefined,
            }}
          >
            <div className="text-2xl font-display font-bold" style={{ color: activeTab === tab.key ? "#D4A843" : "#E8E8E9" }}>
              {orderCounts[tab.key as keyof typeof orderCounts] || 0}
            </div>
            <div className="text-xs text-[#8A8B8C] mt-1">{tab.label}</div>
          </button>
        ))}
      </div>

      {/* Search + Add */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#8A8B8C]" />
          <input
            type="text"
            value={orderSearch}
            onChange={(e) => setOrderSearch(e.target.value)}
            placeholder="Search orders..."
            className="input-field w-full pl-10"
          />
        </div>
        <button
          onClick={() => { setShowForm(true); setEditingOrder(null); sampleOverrideRef.current = false; resetForm(); }}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> New Order
        </button>
      </div>

      {/* Orders List */}
      <div className="space-y-3">
        {filteredOrders.length === 0 && (
          <div className="card-surface p-8 text-center text-[#8A8B8C]">
            <ShoppingBag className="w-8 h-8 mx-auto mb-3 opacity-50" />
            <p>No orders found</p>
          </div>
        )}
        {filteredOrders.map((order: any) => {
          const customer = getCustomer(order);
          const isExpanded = expandedOrder === order.id;
          const hasInvoice = liveInvoiceOrderIds.has(Number(order.id));
          const matchedInvoice = (invoices || []).find((i: any) => i.orderId == order.id);
          const invoiceNumber = matchedInvoice?.invoiceNumber || "";
          const statusConfig = STATUS_LABELS[order.status] || { label: order.status, color: "#8A8B8C" };
          const canEdit = canEditOrder(order);
          const canCancel = canCancelOrder(order);
          const canProgress = canProgressOrder(order);
          const isQuote = order.orderType === "quote";
          const quoteStatusConfig = STATUS_LABELS[order.status] || { label: order.status, color: "#8A8B8C" };

          return (
            <div key={order.id} className="card-surface overflow-hidden">
              {/* Order Header */}
              <div
                className="p-4 flex items-center justify-between cursor-pointer"
                onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${statusConfig.color}15` }}>
                    {order.orderType === "sample" ? <FlaskConical className="w-5 h-5" style={{ color: statusConfig.color }} /> :
                     isQuote ? <FileText className="w-5 h-5" style={{ color: statusConfig.color }} /> :
                     <Package className="w-5 h-5" style={{ color: statusConfig.color }} />}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-display font-semibold text-white">{order.orderNumber}</span>
                      <span className="status-badge text-xs" style={{ backgroundColor: `${statusConfig.color}20`, color: statusConfig.color }}>
                        {statusConfig.label}
                      </span>
                      {order.orderType === "sample" && <span className="status-badge text-xs" style={{ backgroundColor: "rgba(212,168,67,0.15)", color: "#D4A843" }}>Sample</span>}
                      {isQuote && <span className="status-badge text-xs" style={{ backgroundColor: "rgba(99,102,241,0.15)", color: "#6366F1" }}>Quote</span>}
                      {hasInvoice && <span className="status-badge text-xs" style={{ backgroundColor: "rgba(74,222,128,0.15)", color: "#4ADE80" }}><FileText className="w-3 h-3" /> {invoiceNumber}</span>}
                      {!hasInvoice && order.status !== "cancelled" && order.orderType !== "sample" && order.orderType !== "quote" && (
                        <span className="status-badge text-xs" style={{ backgroundColor: "rgba(239,68,68,0.15)", color: "#EF4444" }}>NO INVOICE</span>
                      )}
                    </div>
                    <div className="text-sm text-[#8A8B8C] mt-0.5 truncate">
                      {customer?.name || order.customerName || "Unknown"} · {order.salesRepName || "No rep"} · {new Date(order.createdAt).toLocaleDateString("en-ZA")}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="font-display font-semibold text-white">R {safeNum(order.total).toFixed(2)}</span>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-[#8A8B8C]" /> : <ChevronDown className="w-4 h-4 text-[#8A8B8C]" />}
                </div>
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="border-t" style={{ borderColor: "#222324" }}>
                  <div className="p-4 space-y-4">
                    {/* Order Info */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                      <div><div className="text-[#8A8B8C] text-xs">Customer</div><div className="text-white font-medium">{customer?.name || order.customerName || "N/A"}</div></div>
                      <div><div className="text-[#8A8B8C] text-xs">Customer Code</div><div className="text-white font-medium">{customer?.customerCode || "N/A"}</div></div>
                      <div><div className="text-[#8A8B8C] text-xs">Sales Rep</div><div className="text-white font-medium">{order.salesRepName || "N/A"}</div></div>
                      <div><div className="text-[#8A8B8C] text-xs">Date</div><div className="text-white font-medium">{new Date(order.createdAt).toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" })}</div></div>
                      <div><div className="text-[#8A8B8C] text-xs">Payment Terms</div><div className="text-white font-medium">{order.paymentTerms === "cod" ? "Cash on Delivery" : order.paymentTerms === "7_days" ? "7 Days" : order.paymentTerms === "14_days" ? "14 Days" : order.paymentTerms === "30_days" ? "30 Days" : order.paymentTerms || "N/A"}</div></div>
                      <div><div className="text-[#8A8B8C] text-xs">Price Tier</div><div className="text-white font-medium">{(order.priceTier || "wholesale").toUpperCase()}</div></div>
                      <div className="col-span-2"><div className="text-[#8A8B8C] text-xs">Delivery Address</div><div className="text-white font-medium">{order.deliveryAddress || customer?.physicalAddress || "N/A"}{customer?.city ? `, ${customer.city}` : ""}</div></div>
                      {order.notes && <div className="col-span-2"><div className="text-[#8A8B8C] text-xs">Notes</div><div className="text-white font-medium italic">{order.notes}</div></div>}
                    </div>

                    {/* Items */}
                    <div>
                      <div className="text-xs text-[#8A8B8C] mb-2">Order Items</div>
                      <div className="space-y-2">
                        {(order.items || []).map((item: any, idx: number) => {
                          const stock = (stockItems || []).find((s) => String(s.id) === String(item.stockItemId));
                          return (
                            <div key={idx} className="flex items-center justify-between p-2 rounded-lg" style={{ backgroundColor: "#0A0A0B" }}>
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "rgba(212,168,67,0.1)" }}>
                                  <Tag className="w-4 h-4 text-[#D4A843]" />
                                </div>
                                <div>
                                  <div className="text-sm font-medium text-white">{item.productName || stock?.productName || "Unknown"}</div>
                                  <div className="text-xs text-[#8A8B8C]">{item.productCode || stock?.productCode || "N/A"} · {item.unitLabel || item.unit || "each"}</div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-sm font-display font-semibold text-white">{item.quantity} × R {safeNum(item.unitPrice).toFixed(2)}</div>
                                <div className="text-xs text-[#8A8B8C]">= R {safeNum(item.lineTotal).toFixed(2)}</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Totals */}
                    <div className="flex justify-end">
                      <div className="text-right space-y-1">
                        <div className="text-sm text-[#8A8B8C]">Subtotal: <span className="text-white font-display">R {safeNum(order.subtotal).toFixed(2)}</span></div>
                        <div className="text-sm text-[#8A8B8C]">VAT (15%): <span className="text-white font-display">R {safeNum(order.vat).toFixed(2)}</span></div>
                        <div className="text-lg font-display font-bold text-[#D4A843]">Total: R {safeNum(order.total).toFixed(2)}</div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2">
                      {canEdit && (
                        <button onClick={() => startEditOrder(order)} className="btn-secondary text-xs flex items-center gap-1.5">
                          <Pencil className="w-3 h-3" /> Edit
                        </button>
                      )}
                      {canCancel && (
                        <button
                          onClick={() => {
                            if (confirm(`Cancel order ${order.orderNumber}?`)) {
                              updateStatus.mutate({ id: order.id, status: "cancelled" });
                            }
                          }}
                          className="btn-secondary text-xs flex items-center gap-1.5"
                          style={{ borderColor: "rgba(239,68,68,0.3)", color: "#EF4444" }}
                        >
                          <Ban className="w-3 h-3" /> Cancel
                        </button>
                      )}
                      {canProgress && (
                        <>
                          {order.status === "pending" && (
                            <button onClick={() => updateStatus.mutate({ id: order.id, status: "picking" })} className="btn-secondary text-xs flex items-center gap-1.5" style={{ borderColor: "rgba(99,102,241,0.3)", color: "#6366F1" }}>
                              <Package className="w-3 h-3" /> Mark Picking
                            </button>
                          )}
                          {order.status === "picking" && (
                            <button onClick={() => updateStatus.mutate({ id: order.id, status: "ready" })} className="btn-secondary text-xs flex items-center gap-1.5" style={{ borderColor: "rgba(245,158,11,0.3)", color: "#F59E0B" }}>
                              <CheckCircle className="w-3 h-3" /> Mark Ready
                            </button>
                          )}
                          {order.status === "ready" && (
                            <button onClick={() => updateStatus.mutate({ id: order.id, status: "delivered" })} className="btn-secondary text-xs flex items-center gap-1.5" style={{ borderColor: "rgba(74,222,128,0.3)", color: "#4ADE80" }}>
                              <Truck className="w-3 h-3" /> Mark Delivered
                            </button>
                          )}
                        </>
                      )}
                      {/* Quote actions */}
                      {isQuote && isAdmin && order.status !== "converted" && order.status !== "rejected" && (
                        <>
                          <button
                            onClick={() => {
                              if (confirm(`Convert quote ${order.orderNumber} to an order?`)) {
                                convertQuoteToOrder.mutate({ quoteId: order.id });
                              }
                            }}
                            className="btn-secondary text-xs flex items-center gap-1.5"
                            style={{ borderColor: "rgba(74,222,128,0.3)", color: "#4ADE80" }}
                          >
                            <CheckCircle className="w-3 h-3" /> Convert to Order
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Reject quote ${order.orderNumber}?`)) {
                                updateStatus.mutate({ id: order.id, status: "rejected" });
                              }
                            }}
                            className="btn-secondary text-xs flex items-center gap-1.5"
                            style={{ borderColor: "rgba(239,68,68,0.3)", color: "#EF4444" }}
                          >
                            <Ban className="w-3 h-3" /> Reject
                          </button>
                        </>
                      )}
                      {!isQuote && (
                        <>
                          <button onClick={() => printPickingSlip(order)} className="btn-secondary text-xs flex items-center gap-1.5">
                            <Printer className="w-3 h-3" /> Picking Slip
                          </button>
                          <GenerateInvoiceButton orderId={order.id} />
                          {hasInvoice && (
                            <>
                              <button onClick={() => printInvoice(order)} className="btn-secondary text-xs flex items-center gap-1.5">
                                <Printer className="w-3 h-3" /> Print Invoice
                              </button>
                              <button onClick={() => emailInvoice(order)} className="btn-secondary text-xs flex items-center gap-1.5">
                                <Mail className="w-3 h-3" /> Email Invoice
                              </button>
                            </>
                          )}
                        </>
                      )}
                      {isQuote && (
                        <button onClick={() => printQuote(order)} className="btn-secondary text-xs flex items-center gap-1.5">
                          <Printer className="w-3 h-3" /> Print Quote
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Order Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.8)" }} onClick={() => setShowForm(false)}>
          <div className="card-surface w-full sm:max-w-2xl sm:mx-4 max-h-[90vh] flex flex-col" style={{ borderRadius: "16px 16px 0 0" }} onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b flex-shrink-0" style={{ borderColor: "#222324" }}>
              <h2 className="font-display font-semibold text-white text-lg">
                {editingOrder ? `Edit Order — ${editingOrder.orderNumber}` : "New Order"}
              </h2>
              <button onClick={() => setShowForm(false)} className="p-2 rounded-full hover:bg-[#222324] cursor-pointer">
                <X className="w-5 h-5 text-[#8A8B8C]" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-4 space-y-4 overflow-y-auto flex-1" style={{ maxHeight: "calc(90vh - 80px)" }}>
              {/* Order Type */}
              <div>
                <label className="label-text block mb-2">Order Type *</label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { key: "regular", label: "Regular", icon: ShoppingBag },
                    { key: "sample", label: "Sample", icon: FlaskConical },
                    { key: "quote", label: "Quote", icon: FileText },
                  ].map((type) => (
                    <button key={type.key} type="button" onClick={() => setFormData({ ...formData, orderType: type.key as any })} className="p-3 rounded-xl text-center transition-all cursor-pointer" style={{ backgroundColor: formData.orderType === type.key ? "rgba(212,168,67,0.1)" : "#0A0A0B", border: formData.orderType === type.key ? "2px solid #D4A843" : "2px solid #222324" }}>
                      <type.icon className="w-5 h-5 mx-auto mb-1" style={{ color: formData.orderType === type.key ? "#D4A843" : "#8A8B8C" }} />
                      <div className="text-sm font-display font-semibold" style={{ color: formData.orderType === type.key ? "#D4A843" : "#8A8B8C" }}>{type.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Customer */}
              <div className="relative">
                <label className="label-text block mb-1.5">Customer *</label>
                <div className="relative">
                  <input
                    ref={customerInputRef}
                    type="text"
                    value={customerSearch}
                    onChange={(e) => { setCustomerSearch(e.target.value); setShowCustomerDropdown(true); }}
                    onFocus={() => setShowCustomerDropdown(true)}
                    placeholder="Search customers..."
                    className="input-field w-full"
                    autoComplete="off"
                  />
                  {showCustomerDropdown && filteredCustomers.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 rounded-lg border overflow-hidden max-h-60 overflow-y-auto" style={{ backgroundColor: "#18191A", borderColor: "#222324" }}>
                      {filteredCustomers.map((c: any) => (
                        <div
                          key={c.id}
                          onClick={() => handleCustomerSelect(c.id)}
                          className="p-3 cursor-pointer hover:bg-[#222324] border-b"
                          style={{ borderColor: "#222324" }}
                        >
                          <div className="text-sm font-medium text-white">{c.name}</div>
                          <div className="text-xs text-[#8A8B8C]">{c.customerCode || "N/A"} · {c.city || "N/A"}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Payment Terms & Price Tier */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label-text block mb-1.5">Payment Terms *</label>
                  <select value={formData.paymentTerms} onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value as any })} className="input-field w-full">
                    <option value="cod">Cash on Delivery</option>
                    <option value="7_days">7 Days</option>
                    <option value="14_days">14 Days</option>
                    <option value="30_days">30 Days</option>
                  </select>
                </div>
                {formData.orderType !== "sample" && (
                  <div>
                    <label className="label-text block mb-2">Pricing Tier *</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {PRICE_TIERS.map((tier) => (
                        <button key={tier.key} type="button" onClick={() => setFormData({ ...formData, priceTier: tier.key as any })} className="p-3 rounded-xl text-center transition-all cursor-pointer" style={{ backgroundColor: formData.priceTier === tier.key ? `${tier.color}20` : "#0A0A0B", border: formData.priceTier === tier.key ? `2px solid ${tier.color}` : "2px solid #222324" }}>
                          <DollarSign className="w-5 h-5 mx-auto mb-1" style={{ color: tier.color }} />
                          <div className="text-sm font-display font-semibold" style={{ color: formData.priceTier === tier.key ? tier.color : "#8A8B8C" }}>{tier.label}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

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
                    const product = Number(item.stockItemId) > 0 ? (stockItems || []).find((s) => String(s.id) === String(item.stockItemId)) : null;
                    const sellingUnits = product?.sellingUnits || [];
                    const hasMultipleUnits = sellingUnits.length > 1;
                    const selectedUnit = hasMultipleUnits ? sellingUnits.find((u: any) => u.unit === item.unit) : null;
                    const conversion = item.conversion || 1;
                    const effectivePrice = getEffectivePrice(item.stockItemId, item.unitPrice);
                    const hasSpecial = Number(item.stockItemId) > 0 && !!(customerSpecialPrices || []).find((sp: any) => String(sp.stockItemId) === String(item.stockItemId));
                    const isCustom = item.unitPrice && item.unitPrice > 0;
                    const tierPrice = getTierPrice(item.stockItemId);
                    const availSOH = availableStock[Number(item.stockItemId)] || 0;
                    const availInUnit = Math.floor(availSOH / conversion);
                    const inProgressOrders = productOrderStatuses[Number(item.stockItemId)] || [];

                    return (
                      <div key={index} className="p-3 rounded-lg" style={{ backgroundColor: "#0A0A0B", border: availSOH <= 0 && Number(item.stockItemId) > 0 ? "1px solid #EF4444" : "1px solid #222324" }}>
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
                                ? product?.productName || "Select product..."
                                : "Select product..."}
                            </span>
                            <ChevronDown className="w-4 h-4 text-[#8A8B8C] flex-shrink-0" />
                          </button>
                          {/* Unit selector for products with multiple selling units */}
                          {hasMultipleUnits && formData.orderType !== "sample" && (
                            <select
                              value={item.unit || "each"}
                              onChange={(e) => {
                                const unit = sellingUnits.find((u: any) => u.unit === e.target.value);
                                if (unit) {
                                  const updated = [...formData.items];
                                  updated[index] = {
                                    ...updated[index],
                                    unit: unit.unit,
                                    conversion: unit.conversion,
                                    unitLabel: unit.label,
                                    unitPrice: 0, // reset custom price so tier price recalculates
                                  };
                                  setFormData({ ...formData, items: updated });
                                }
                              }}
                              className="input-field w-32 text-xs"
                            >
                              {sellingUnits.map((u: any) => (
                                <option key={u.unit} value={u.unit}>{u.label}</option>
                              ))}
                            </select>
                          )}
                          {(() => {
                            const allowEdit = !(formData.orderType === "sample" && editingOrder && !sampleOverrideRef.current);
                            if (!allowEdit) {
                              return <div className="w-20 p-2 rounded-lg text-center text-sm font-display" style={{ backgroundColor: "rgba(212, 168, 67, 0.12)", color: "#D4A843" }}>{item.quantity}</div>;
                            }
                            return <input type="number" value={item.quantity} onChange={(e) => handleUpdateItem(index, "quantity", parseInt(e.target.value) || 1)} className="input-field w-20" min={1} max={(editingOrder && isAdmin) ? undefined : (availInUnit > 0 ? availInUnit : undefined)} />;
                          })()}
                          <button type="button" onClick={() => handleRemoveItem(index)} className="p-2 hover:text-[#EF4444] cursor-pointer"><X className="w-4 h-4 text-[#8A8B8C]" /></button>
                        </div>
                        {item.stockItemId > 0 && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-[#8A8B8C]">Available Stock:</span>
                              <span className={`text-sm font-display font-semibold ${availSOH <= 0 ? "text-[#EF4444]" : "text-[#4ADE80]"}`}>
                                {availSOH} kg
                                {hasMultipleUnits && (
                                  <span className="text-[#8A8B8C] font-normal"> ({availInUnit} {selectedUnit?.label || "units"})</span>
                                )}
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
                              {formData.orderType === "sample" ? (
                                // Sample orders: show ONLY corporate price, no custom input, no special badge
                                <div className="flex items-center gap-2 text-xs">
                                  <span className="text-[#8A8B8C]">corporate:</span>
                                  <span className="font-display" style={{ color: "#D4A843" }}>
                                    R {(tierPrice * conversion).toFixed(2)}
                                    {hasMultipleUnits && <span className="text-[#8A8B8C] font-normal text-[10px]"> / {selectedUnit?.label || "unit"}</span>}
                                  </span>
                                  <span className="text-[#8A8B8C] text-[10px]">(Sample — Corporate Price)</span>
                                </div>
                              ) : (
                                <>
                                  <div className="flex items-center gap-2 text-xs">
                                    <span className="text-[#8A8B8C]">{formData.priceTier}:</span>
                                    <span className="font-display" style={{ color: PRICE_TIERS.find((t) => t.key === formData.priceTier)?.color }}>
                                      R {(tierPrice * conversion).toFixed(2)}
                                      {hasMultipleUnits && <span className="text-[#8A8B8C] font-normal text-[10px]"> / {selectedUnit?.label || "unit"}</span>}
                                    </span>
                                  </div>
                                  {hasSpecial && !isCustom && <span className="status-badge text-xs" style={{ backgroundColor: "rgba(212, 168, 67, 0.12)", color: "#D4A843" }}><Tag className="w-3 h-3" /> Special: R {(effectivePrice * conversion).toFixed(2)}</span>}
                                  <div className="flex items-center gap-2 ml-auto">
                                    <span className="text-xs text-[#8A8B8C]">Custom Price (R):</span>
                                    <input type="number" step="0.01" value={item.unitPrice || ""} onChange={(e) => handleUpdateItem(index, "unitPrice", parseFloat(e.target.value) || 0)} className="input-field w-28 text-sm" placeholder={`${(effectivePrice * conversion).toFixed(2)}`} min={0} />
                                    {isCustom && <span className="status-badge text-xs" style={{ backgroundColor: "rgba(99, 102, 241, 0.12)", color: "#6366F1" }}>Custom</span>}
                                  </div>
                                </>
                              )}
                              <div className="font-display font-semibold text-sm text-white">= R {((item.unitPrice || effectivePrice * conversion) * item.quantity).toFixed(2)}</div>
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

              {/* Admin Override — below-corporate pricing or customer blocking */}
              {(() => {
                if (formData.orderType === "sample" || formData.orderType === "quote" || !isAdmin) return null;
                const validItems = formData.items.filter((i) => Number(i.stockItemId) > 0 && Number(i.quantity) > 0);
                const belowItems: string[] = [];
                for (const item of validItems) {
                  if (item.unitPrice && item.unitPrice > 0) {
                    const stock = (stockItems || []).find((s) => Number(s.id) === Number(item.stockItemId));
                    if (stock) {
                      const conversion = item.conversion || 1;
                      const corporateFloor = Number(stock.corporatePrice || 0) * conversion;
                      if (corporateFloor > 0 && item.unitPrice < corporateFloor * 0.99) {
                        belowItems.push(`${stock.productName}: R${item.unitPrice.toFixed(2)} (floor R${corporateFloor.toFixed(2)})`);
                      }
                    }
                  }
                }
                if (belowItems.length === 0) return null;
                return (
                  <div className="p-3 rounded-lg text-sm" style={{ backgroundColor: "rgba(245, 158, 11, 0.08)", border: "1px solid rgba(245, 158, 11, 0.3)" }}>
                    <div className="flex items-start gap-2 mb-2">
                      <AlertTriangle className="w-4 h-4 text-[#F59E0B] flex-shrink-0 mt-0.5" />
                      <div className="text-[#F59E0B]">
                        <strong>Below Corporate Floor Detected</strong>
                        <div className="text-xs mt-1 opacity-80">{belowItems.join(" | ")}</div>
                      </div>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={adminOverride}
                        onChange={(e) => { setAdminOverride(e.target.checked); if (!e.target.checked) setAdminPin(""); }}
                        className="w-4 h-4 rounded accent-[#D4A843]"
                      />
                      <span className="text-[#E8E8E9] text-xs">I am a Super Admin — approve this below-corporate pricing</span>
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
                );
              })()}

              <button type="submit" className="btn-primary w-full justify-center" disabled={!orderCheck.valid || createOrder.isPending || updateOrder.isPending}>
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
    </div>
  );
}