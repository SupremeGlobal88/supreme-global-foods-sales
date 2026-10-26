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
      alert("Failed to update order: " + (err.message || "Unknown error"));
      console.error("[updateOrder] error:", err);
    },
    onSettled: () => {
      setShowForm(false); setEditingOrder(null); sampleOverrideRef.current = false;
    },
  });
  const deleteOrder = trpc.order.delete.useMutation({
    onSuccess: async () => {
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
  const restoreOrder = trpc.order.restore.useMutation({
    onSuccess: async () => {
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

  const { data: salesReps } = trpc.salesRep.list.useQuery(undefined, {
    refetchInterval: 5000,
    refetchOnMount: "always",
  });

  // ── stock availability (SOH minus committed quantities) ──
  const availableStock = useMemo(() => {
    const map: Record<number, number> = {};
    (stockItems || []).forEach((s) => { map[s.id] = safeNum(s.quantity); });
    // Subtract committed quantities from non-delivered, non-cancelled orders
    (orders || []).forEach((o: any) => {
      if (o.status === "delivered" || o.status === "cancelled" || o.status === "sample_delivered") return;
      (o.items || []).forEach((it: any) => {
        const id = Number(it.stockItemId);
        if (!id) return;
        const conversion = it.conversion || 1;
        const qtyInKg = safeNum(it.quantity) * conversion;
        map[id] = safeNum(map[id]) - qtyInKg;
      });
    });
    return map;
  }, [stockItems, orders]);

  // ── in-progress orders per product (for stock commitment display) ──
  const productOrderStatuses = useMemo(() => {
    const map: Record<number, { orderNumber: string; qty: number; status: string }[]> = {};
    (orders || []).forEach((o: any) => {
      if (o.status === "delivered" || o.status === "cancelled" || o.status === "sample_delivered") return;
      (o.items || []).forEach((it: any) => {
        const id = Number(it.stockItemId);
        if (!id) return;
        if (!map[id]) map[id] = [];
        map[id].push({ orderNumber: o.orderNumber || `#${o.id}`, qty: it.quantity, status: o.status });
      });
    });
    return map;
  }, [orders]);

  function getTierPrice(stockItemId: number): number {
    const item = (stockItems || []).find((s) => s.id === stockItemId);
    if (!item) return 0;
    switch (formData.priceTier) {
      case "corporate": return safeNum(item.corporatePrice);
      case "bulk": return safeNum(item.bulkPrice);
      case "wholesale": return safeNum(item.wholesalePrice);
      case "retail": return safeNum(item.retailPrice);
      default: return safeNum(item.wholesalePrice);
    }
  }

  function getEffectivePrice(stockItemId: number, customPrice?: number): number {
    if (customPrice && customPrice > 0) return customPrice;
    const special = (customerSpecialPrices || []).find((sp: any) => sp.stockItemId === stockItemId);
    if (special && Number(special.price) > 0) return Number(special.price);
    return getTierPrice(stockItemId);
  }

  function getUnitLabel(stockItemId: number, unit?: string): string {
    const item = (stockItems || []).find((s) => s.id === stockItemId);
    if (!item || !unit || unit === "each") return "unit";
    const u = (item.sellingUnits || []).find((x: any) => x.unit === unit);
    return u?.label || unit;
  }

  function formatCurrency(n: number) {
    return "R " + n.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function resetForm() {
    setFormData({ customerId: 0, orderType: "regular", paymentTerms: "cod", priceTier: "wholesale", deliveryAddress: "", notes: "", items: [] });
    setCustomerSearch("");
    setAdminOverride(false);
    setAdminPin("");
    setShowCustomerDropdown(false);
  }

  // ── build filtered orders list ──
  const filteredOrders = useMemo(() => {
    let list = (orders || []).filter((o: any) => {
      if (!o || typeof o !== "object") return false;
      if (activeTab === "all") return true;
      if (activeTab === "sample") return o.orderType === "sample";
      if (activeTab === "quotes") return o.orderType === "quote";
      return o.status === activeTab;
    });
    if (orderSearch.trim()) {
      const q = orderSearch.toLowerCase();
      list = list.filter((o: any) =>
        (o.orderNumber || "").toLowerCase().includes(q) ||
        (o.customerName || "").toLowerCase().includes(q) ||
        String(o.id).includes(q)
      );
    }
    // Sort: pending first, then by date desc
    return list.sort((a: any, b: any) => {
      const aPending = a.status === "pending" ? 1 : 0;
      const bPending = b.status === "pending" ? 1 : 0;
      if (aPending !== bPending) return bPending - aPending;
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });
  }, [orders, activeTab, orderSearch]);

  // ── totals for an order ──
  function calcOrderTotal(order: any) {
    return (order.items || []).reduce((sum: number, it: any) => {
      const price = it.unitPrice || it.priceAtOrder || 0;
      return sum + price * safeNum(it.quantity);
    }, 0);
  }

  function calcOrderTotalWithVat(order: any) {
    const sub = calcOrderTotal(order);
    const vat = sub * 0.15;
    return sub + vat;
  }

  // ── validation helper ──
  function canPlaceOrder(): { valid: boolean; error?: string } {
    if (formData.items.length === 0) return { valid: false, error: "Add at least one item." };
    for (const it of formData.items) {
      if (!it.stockItemId) return { valid: false, error: "Select a product for every item." };
      if (!it.quantity || it.quantity < 1) return { valid: false, error: "Quantity must be at least 1." };
    }

    // CUSTOMER ACCOUNT CHECK
    const customer = (customers || []).find((c) => String(c.id) === String(formData.customerId));
    if (customer) {
      if (customer.isActive === false && !isSuperAdmin && !adminOverride) {
        return { valid: false, error: "Customer account is inactive. Contact admin." };
      }
      const creditLimit = safeNum(customer.creditLimit);
      const outstanding = safeNum(customer.balanceOutstanding);
      if (creditLimit > 0 && formData.paymentTerms !== "cod") {
        if (outstanding >= creditLimit && !isSuperAdmin && !adminOverride) {
          return { valid: false, error: `Credit limit exceeded (R${outstanding.toFixed(2)} / R${creditLimit.toFixed(2)}).` };
        }
      }
      if (formData.paymentTerms === "cod") {
        const unpaidCOD = (invoices || []).filter((inv: any) =>
          String(inv.customerId) === String(customer.id) &&
          inv.paymentTerms === "cod" &&
          inv.status !== "paid" &&
          inv.status !== "cancelled"
        );
        if (unpaidCOD.length > 0 && !isSuperAdmin && !adminOverride) {
          return { valid: false, error: `This COD customer has ${unpaidCOD.length} unpaid COD invoice(s). Please settle before placing a new COD order.` };
        }
      }
    }

    const total = formData.items.reduce((sum, it) => {
      const price = getEffectivePrice(it.stockItemId, it.unitPrice);
      return sum + price * safeNum(it.quantity);
    }, 0);
    if (total <= 0) return { valid: false, error: "Order total must be greater than zero." };

    // Admin override: below-corporate pricing
    if (formData.orderType !== "sample" && formData.orderType !== "quote") {
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
      if (belowItems.length > 0 && !isAdmin && !adminOverride) {
        return { valid: false, error: `Below corporate floor: ${belowItems.join(" | ")}. Admin PIN required.` };
      }
    }

    if (adminOverride) {
      if (!adminPin || adminPin.length < 4) {
        return { valid: false, error: "Enter a valid admin PIN (min 4 digits)." };
      }
    }

    return { valid: true };
  }

  const orderCheck = useMemo(() => canPlaceOrder(), [formData, customers, stockItems, invoices, isAdmin, isSuperAdmin, adminOverride, adminPin]);

  function handleAddItem() {
    setFormData((prev) => ({ ...prev, items: [...prev.items, { stockItemId: 0, quantity: 1, unitPrice: undefined }] }));
  }
  function handleRemoveItem(index: number) {
    setFormData((prev) => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }));
  }
  function handleUpdateItem(index: number, field: string, value: any) {
    setFormData((prev) => {
      const updated = [...prev.items];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, items: updated };
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!orderCheck.valid) return;

    const payload: any = {
      ...formData,
      customerId: Number(formData.customerId),
      items: formData.items.map((it) => ({
        stockItemId: Number(it.stockItemId),
        quantity: Number(it.quantity),
        unitPrice: it.unitPrice,
        unit: it.unit || "each",
        conversion: it.conversion || 1,
      })),
      status: "pending",
    };

    if (adminOverride && adminPin) {
      payload.superAdminOverride = true;
    }

    if (editingOrder) {
      updateOrder.mutate({ id: editingOrder.id, data: payload });
    } else {
      createOrder.mutate(payload);
    }
  }

  function handlePrint(order: any) {
    const company = getCompanyConfig();
    const customer = (customers || []).find((c: any) => String(c.id) === String(order.customerId));
    const rep = (salesReps || []).find((r: any) => String(r.id) === String(order.salesRepId));
    const repName = rep?.name || order.salesRepName || "";
    const repCell = rep?.cell || "";

    const subtotal = (order.items || []).reduce((sum: number, it: any) => {
      const price = it.unitPrice || it.priceAtOrder || 0;
      return sum + price * safeNum(it.quantity);
    }, 0);
    const vat = subtotal * 0.15;
    const total = subtotal + vat;

    const itemsHtml = (order.items || []).map((it: any) => {
      const stock = (stockItems || []).find((s: any) => s.id === it.stockItemId);
      const unitLabel = getUnitLabel(it.stockItemId, it.unit);
      const price = it.unitPrice || it.priceAtOrder || 0;
      const lineTotal = price * safeNum(it.quantity);
      return `
        <tr>
          <td style="padding:6px 8px;border-bottom:1px solid #eee;font-size:13px;">${stock?.productName || "Product"}${it.unit && it.unit !== "each" ? ` <span style="color:#888;font-size:11px;">(${unitLabel})</span>` : ""}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #eee;font-size:13px;text-align:center;">${it.quantity}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #eee;font-size:13px;text-align:right;">R ${price.toFixed(2)}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #eee;font-size:13px;text-align:right;">R ${lineTotal.toFixed(2)}</td>
        </tr>
      `;
    }).join("");

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>Order ${order.orderNumber || order.id}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #222; }
            .header { border-bottom: 2px solid #D4A843; padding-bottom: 12px; margin-bottom: 16px; }
            .header h1 { margin: 0; font-size: 22px; color: #D4A843; }
            .meta { font-size: 12px; color: #555; margin-bottom: 16px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
            th { background: #f8f8f8; padding: 8px; font-size: 12px; text-align: left; border-bottom: 2px solid #ddd; }
            .totals { text-align: right; font-size: 14px; margin-top: 8px; }
            .totals strong { font-size: 16px; color: #D4A843; }
            .footer { margin-top: 24px; font-size: 11px; color: #777; border-top: 1px solid #eee; padding-top: 8px; }
            .status-badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: bold; margin-left: 8px; }
            .banking { background: #f8f8f8; padding: 10px; border-radius: 6px; font-size: 12px; margin-top: 12px; }
            .banking strong { color: #D4A843; }
            .vat-row { color: #666; font-size: 13px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${company.name}</h1>
            <div style="font-size:12px;color:#555;">${company.registrationNumber || ""} | ${company.vatNumber || ""}</div>
            <div style="font-size:12px;color:#555;">${company.address || ""}</div>
            <div style="font-size:12px;color:#555;">${company.email || ""} | ${company.phone || ""}</div>
          </div>

          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;">
            <div>
              <strong style="font-size:16px;">ORDER ${order.orderNumber || order.id}</strong>
              <span class="status-badge" style="background:${STATUS_LABELS[order.status]?.color || "#ccc"}22;color:${STATUS_LABELS[order.status]?.color || "#ccc"};">${STATUS_LABELS[order.status]?.label || order.status}</span>
            </div>
            <div style="text-align:right;font-size:12px;color:#555;">
              <div>Date: ${new Date(order.createdAt).toLocaleDateString("en-ZA")}</div>
              <div>Payment: ${(order.paymentTerms || "").replace("_", " ")}</div>
            </div>
          </div>

          <div class="meta">
            <strong>Customer:</strong> ${customer?.name || order.customerName || "N/A"}<br/>
            <strong>Delivery:</strong> ${order.deliveryAddress || customer?.deliveryAddress || "N/A"}<br/>
            <strong>Sales Rep:</strong> ${repName}${repCell ? ` | ${repCell}` : ""}
          </div>

          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th style="text-align:center;">Qty</th>
                <th style="text-align:right;">Unit Price</th>
                <th style="text-align:right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <div class="totals">
            <div>Subtotal: R ${subtotal.toFixed(2)}</div>
            <div class="vat-row">VAT (15%): R ${vat.toFixed(2)}</div>
            <div><strong>Total: R ${total.toFixed(2)}</strong></div>
          </div>

          <div class="banking">
            <strong>Banking Details</strong><br/>
            Bank: ${banking.bankName || "N/A"}<br/>
            Account: ${banking.accountNumber || "N/A"}<br/>
            Branch: ${banking.branchCode || "N/A"}<br/>
            Account Name: ${banking.accountName || "N/A"}
          </div>

          <div class="footer">
            ${company.name} — Order generated from Supreme Global Foods Sales App<br/>
            Thank you for your business!
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 300);
  }

  function handlePrintDeliveryNote(order: any) {
    const company = getCompanyConfig();
    const customer = (customers || []).find((c: any) => String(c.id) === String(order.customerId));
    const rep = (salesReps || []).find((r: any) => String(r.id) === String(order.salesRepId));
    const repName = rep?.name || order.salesRepName || "";
    const repCell = rep?.cell || "";

    const itemsHtml = (order.items || []).map((it: any) => {
      const stock = (stockItems || []).find((s: any) => s.id === it.stockItemId);
      const unitLabel = getUnitLabel(it.stockItemId, it.unit);
      return `
        <tr>
          <td style="padding:6px 8px;border-bottom:1px solid #eee;font-size:13px;">${stock?.productName || "Product"}${it.unit && it.unit !== "each" ? ` <span style="color:#888;font-size:11px;">(${unitLabel})</span>` : ""}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #eee;font-size:13px;text-align:center;">${it.quantity}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #eee;font-size:13px;text-align:right;">R ${(it.unitPrice || it.priceAtOrder || 0).toFixed(2)}</td>
        </tr>
      `;
    }).join("");

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>Delivery Note ${order.orderNumber || order.id}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #222; }
            .header { border-bottom: 2px solid #4ADE80; padding-bottom: 12px; margin-bottom: 16px; }
            .header h1 { margin: 0; font-size: 22px; color: #4ADE80; }
            .meta { font-size: 12px; color: #555; margin-bottom: 16px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
            th { background: #f8f8f8; padding: 8px; font-size: 12px; text-align: left; border-bottom: 2px solid #ddd; }
            .footer { margin-top: 24px; font-size: 11px; color: #777; border-top: 1px solid #eee; padding-top: 8px; }
            .signature { margin-top: 40px; display: flex; justify-content: space-between; }
            .signature-box { width: 200px; border-top: 1px solid #333; padding-top: 4px; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${company.name}</h1>
            <div style="font-size:12px;color:#555;">${company.registrationNumber || ""} | ${company.vatNumber || ""}</div>
            <div style="font-size:12px;color:#555;">${company.address || ""}</div>
          </div>

          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;">
            <div>
              <strong style="font-size:16px;">DELIVERY NOTE — ${order.orderNumber || order.id}</strong>
            </div>
            <div style="text-align:right;font-size:12px;color:#555;">
              <div>Date: ${new Date(order.createdAt).toLocaleDateString("en-ZA")}</div>
            </div>
          </div>

          <div class="meta">
            <strong>Customer:</strong> ${customer?.name || order.customerName || "N/A"}<br/>
            <strong>Delivery Address:</strong> ${order.deliveryAddress || customer?.deliveryAddress || "N/A"}<br/>
            <strong>Sales Rep:</strong> ${repName}${repCell ? ` | ${repCell}` : ""}
          </div>

          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th style="text-align:center;">Qty</th>
                <th style="text-align:right;">Unit Price</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <div class="signature">
            <div class="signature-box">Received By<br/><span style="font-size:10px;color:#888;">Name & Signature</span></div>
            <div class="signature-box">Date Received</div>
          </div>

          <div class="footer">
            ${company.name} — Delivery Note generated from Supreme Global Foods Sales App
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 300);
  }

  // ── START EDIT ORDER ──
  function startEditOrder(order: any) {
    setEditingOrder(order);
    const mappedItems = (order.items || []).map((it: any) => ({
      stockItemId: it.stockItemId,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      unit: it.unit || "each",
      conversion: it.conversion || 1,
    }));
    setFormData({
      customerId: order.customerId,
      orderType: order.orderType || "regular",
      paymentTerms: order.paymentTerms || "cod",
      priceTier: order.priceTier || "wholesale",
      deliveryAddress: order.deliveryAddress || "",
      notes: order.notes || "",
      items: mappedItems,
    });
    setCustomerSearch(order.customerName || "");
    setAdminOverride(false);
    setAdminPin("");
    setShowForm(true);
  }

  // ── Sales rep view: filter to own orders ──
  const myOrders = useMemo(() => {
    if (isAdmin || isSuperAdmin) return filteredOrders;
    return filteredOrders.filter((o: any) => {
      const repNameMatch = (o.salesRepName || "").toLowerCase().trim() === myRepName.toLowerCase().trim();
      const repIdMatch = user && String(o.salesRepId) === String(user.id);
      return repNameMatch || repIdMatch;
    });
  }, [filteredOrders, isAdmin, isSuperAdmin, myRepName, user]);

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-white">Orders</h1>
          <p className="text-[#8A8B8C] text-sm mt-1">Manage orders, quotes & samples</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => { resetForm(); setShowForm(true); }} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> New Order
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Pending", value: stats?.pending || 0, color: "#F59E0B" },
          { label: "Picking", value: stats?.picking || 0, color: "#6366F1" },
          { label: "Ready", value: stats?.ready || 0, color: "#4ADE80" },
          { label: "Delivered", value: stats?.delivered || 0, color: "#4ADE80" },
        ].map((s) => (
          <div key={s.label} className="card-surface p-4" style={{ borderLeft: `4px solid ${s.color}` }}>
            <div className="text-[#8A8B8C] text-xs font-body uppercase tracking-wider">{s.label}</div>
            <div className="text-2xl font-display font-bold text-white mt-1">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {statusTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="px-3 py-1.5 rounded-lg text-xs font-body font-medium whitespace-nowrap transition-colors cursor-pointer"
              style={{
                backgroundColor: activeTab === tab.key ? "rgba(212,168,67,0.15)" : "#0A0A0B",
                color: activeTab === tab.key ? "#D4A843" : "#8A8B8C",
                border: activeTab === tab.key ? "1px solid rgba(212,168,67,0.3)" : "1px solid #222324",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={orderSearch}
          onChange={(e) => setOrderSearch(e.target.value)}
          placeholder="Search orders..."
          className="input-field w-full sm:w-64"
        />
      </div>

      {/* Orders List */}
      <div className="space-y-3">
        {myOrders.length === 0 && (
          <div className="card-surface p-8 text-center text-[#8A8B8C] text-sm">
            No orders found.
          </div>
        )}
        {myOrders.map((order: any) => {
          const isExpanded = expandedOrder === order.id;
          const customer = (customers || []).find((c: any) => String(c.id) === String(order.customerId));
          const total = calcOrderTotal(order);
          const totalWithVat = calcOrderTotalWithVat(order);
          const statusInfo = STATUS_LABELS[order.status] || { label: order.status, color: "#8A8B8C" };
          const hasInvoice = liveInvoiceOrderIds.has(Number(order.id));

          return (
            <div key={order.id} className="card-surface overflow-hidden">
              {/* Order Header */}
              <div
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer"
                onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${statusInfo.color}15` }}>
                    <Package className="w-5 h-5" style={{ color: statusInfo.color }} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-display font-semibold text-white">{order.orderNumber || `#${order.id}`}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full font-body" style={{ backgroundColor: `${statusInfo.color}20`, color: statusInfo.color }}>
                        {statusInfo.label}
                      </span>
                      {order.orderType === "sample" && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-body" style={{ backgroundColor: "rgba(212,168,67,0.15)", color: "#D4A843" }}>
                          Sample
                        </span>
                      )}
                      {order.orderType === "quote" && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-body" style={{ backgroundColor: "rgba(99,102,241,0.15)", color: "#6366F1" }}>
                          Quote
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-[#8A8B8C] mt-0.5">
                      {customer?.name || order.customerName || "Unknown"} · {(order.paymentTerms || "").replace("_", " ")} · {new Date(order.createdAt).toLocaleDateString("en-ZA")}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="font-display font-semibold text-white">{formatCurrency(totalWithVat)}</div>
                    <div className="text-xs text-[#8A8B8C]">incl. VAT</div>
                  </div>
                  <ChevronDown className={`w-5 h-5 text-[#8A8B8C] transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                </div>
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="border-t" style={{ borderColor: "#222324" }}>
                  <div className="p-4 space-y-4">
                    {/* Order Info */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                      <div>
                        <div className="text-[#8A8B8C] text-xs">Customer</div>
                        <div className="text-white font-body">{customer?.name || order.customerName || "N/A"}</div>
                        <div className="text-[#8A8B8C] text-xs mt-0.5">{customer?.contactPerson || order.contactPerson || ""}</div>
                      </div>
                      <div>
                        <div className="text-[#8A8B8C] text-xs">Delivery Address</div>
                        <div className="text-white font-body">{order.deliveryAddress || customer?.deliveryAddress || "N/A"}</div>
                      </div>
                      <div>
                        <div className="text-[#8A8B8C] text-xs">Sales Rep</div>
                        <div className="text-white font-body">{order.salesRepName || "N/A"}</div>
                      </div>
                      <div>
                        <div className="text-[#8A8B8C] text-xs">Notes</div>
                        <div className="text-white font-body">{order.notes || "—"}</div>
                      </div>
                    </div>

                    {/* Items Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-[#8A8B8C] text-xs" style={{ borderBottom: "1px solid #222324" }}>
                            <th className="pb-2">Product</th>
                            <th className="pb-2 text-center">Qty</th>
                            <th className="pb-2 text-right">Unit Price</th>
                            <th className="pb-2 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(order.items || []).map((it: any, idx: number) => {
                            const stock = (stockItems || []).find((s: any) => s.id === it.stockItemId);
                            const unitLabel = getUnitLabel(it.stockItemId, it.unit);
                            const price = it.unitPrice || it.priceAtOrder || 0;
                            const lineTotal = price * safeNum(it.quantity);
                            return (
                              <tr key={idx} className="text-white" style={{ borderBottom: "1px solid #18191A" }}>
                                <td className="py-2">{stock?.productName || "Product"}{it.unit && it.unit !== "each" ? <span className="text-[#8A8B8C] text-xs"> ({unitLabel})</span> : ""}</td>
                                <td className="py-2 text-center">{it.quantity}</td>
                                <td className="py-2 text-right">R {price.toFixed(2)}</td>
                                <td className="py-2 text-right font-display">R {lineTotal.toFixed(2)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Totals */}
                    <div className="flex justify-end">
                      <div className="text-right space-y-1">
                        <div className="text-sm text-[#8A8B8C]">Subtotal: <span className="text-white font-display">{formatCurrency(total)}</span></div>
                        <div className="text-sm text-[#8A8B8C]">VAT (15%): <span className="text-white font-display">{formatCurrency(total * 0.15)}</span></div>
                        <div className="text-lg font-display font-bold text-white">Total: {formatCurrency(totalWithVat)}</div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2 pt-2">
                      {/* Print buttons */}
                      <button onClick={() => handlePrint(order)} className="btn-secondary text-xs flex items-center gap-1.5">
                        <Printer className="w-3 h-3" /> Print Order
                      </button>
                      <button onClick={() => handlePrintDeliveryNote(order)} className="btn-secondary text-xs flex items-center gap-1.5">
                        <Truck className="w-3 h-3" /> Delivery Note
                      </button>

                      {/* Invoice button */}
                      <GenerateInvoiceButton orderId={order.id} />

                      {/* Status transitions */}
                      {order.status === "pending" && (
                        <button
                          onClick={() => updateStatus.mutate({ id: order.id, status: "picking" })}
                          className="btn-secondary text-xs flex items-center gap-1.5"
                          style={{ borderColor: "rgba(99,102,241,0.3)", color: "#6366F1" }}
                        >
                          <ShoppingBag className="w-3 h-3" /> Start Picking
                        </button>
                      )}
                      {order.status === "picking" && (
                        <button
                          onClick={() => updateStatus.mutate({ id: order.id, status: "ready" })}
                          className="btn-secondary text-xs flex items-center gap-1.5"
                          style={{ borderColor: "rgba(74,222,128,0.3)", color: "#4ADE80" }}
                        >
                          <CheckCircle className="w-3 h-3" /> Mark Ready
                        </button>
                      )}
                      {order.status === "ready" && (
                        <button
                          onClick={() => updateStatus.mutate({ id: order.id, status: "delivered" })}
                          className="btn-secondary text-xs flex items-center gap-1.5"
                          style={{ borderColor: "rgba(74,222,128,0.3)", color: "#4ADE80" }}
                        >
                          <Truck className="w-3 h-3" /> Mark Delivered
                        </button>
                      )}

                      {/* Cancel / Restore */}
                      {order.status !== "cancelled" && order.status !== "delivered" && order.status !== "sample_delivered" && (
                        <button
                          onClick={() => {
                            if (confirm("Cancel this order? Stock will be restored.")) {
                              deleteOrder.mutate(order.id);
                            }
                          }}
                          className="btn-secondary text-xs flex items-center gap-1.5"
                          style={{ borderColor: "rgba(239,68,68,0.3)", color: "#EF4444" }}
                        >
                          <Ban className="w-3 h-3" /> Cancel
                        </button>
                      )}
                      {order.status === "cancelled" && (
                        <button
                          onClick={() => restoreOrder.mutate(order.id)}
                          className="btn-secondary text-xs flex items-center gap-1.5"
                          style={{ borderColor: "rgba(245,158,11,0.3)", color: "#F59E0B" }}
                        >
                          <RotateCcw className="w-3 h-3" /> Restore
                        </button>
                      )}

                      {/* Edit */}
                      {(isAdmin || isSuperAdmin) && order.status !== "delivered" && order.status !== "cancelled" && order.status !== "sample_delivered" && (
                        <button onClick={() => startEditOrder(order)} className="btn-secondary text-xs flex items-center gap-1.5">
                          <Pencil className="w-3 h-3" /> Edit
                        </button>
                      )}
                    </div>

                    {/* Invoice status */}
                    {!hasInvoice && order.status !== "cancelled" && order.status !== "quote" && (
                      <div className="text-xs text-[#EF4444] flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> No invoice generated
                      </div>
                    )}
                    {hasInvoice && (
                      <div className="text-xs text-[#4ADE80] flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> Invoice generated
                      </div>
                    )}
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
          <div
            className="card-surface w-full sm:max-w-2xl sm:mx-4 max-h-[90vh] overflow-y-auto"
            style={{ borderRadius: "16px 16px 0 0" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b" style={{ backgroundColor: "#18191A", borderColor: "#222324" }}>
              <h2 className="text-lg font-display font-semibold text-white">{editingOrder ? "Edit Order" : "New Order"}</h2>
              <button onClick={() => setShowForm(false)} className="p-2 rounded-full hover:bg-[#222324] cursor-pointer">
                <X className="w-5 h-5 text-[#8A8B8C]" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              {/* Order Type */}
              <div>
                <label className="label-text block mb-2">Order Type *</label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { key: "regular", label: "Regular", icon: ShoppingBag },
                    { key: "sample", label: "Sample", icon: FlaskConical },
                    { key: "quote", label: "Quote", icon: FileText },
                  ].map((type) => (
                    <button
                      key={type.key}
                      type="button"
                      onClick={() => setFormData({ ...formData, orderType: type.key as any })}
                      className="p-3 rounded-xl text-center transition-all cursor-pointer"
                      style={{
                        backgroundColor: formData.orderType === type.key ? "rgba(212,168,67,0.15)" : "#0A0A0B",
                        border: formData.orderType === type.key ? "2px solid #D4A843" : "2px solid #222324",
                      }}
                    >
                      <type.icon className="w-5 h-5 mx-auto mb-1" style={{ color: formData.orderType === type.key ? "#D4A843" : "#8A8B8C" }} />
                      <div className="text-sm font-display font-semibold" style={{ color: formData.orderType === type.key ? "#D4A843" : "#8A8B8C" }}>{type.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Customer */}
              <div className="relative">
                <label className="label-text block mb-1.5">Customer *</label>
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
                  <div className="absolute z-20 w-full mt-1 card-surface max-h-48 overflow-y-auto" style={{ border: "1px solid #222324" }}>
                    {(customers || [])
                      .filter((c: any) => {
                        if (!customerSearch.trim()) return true;
                        const q = customerSearch.toLowerCase();
                        return (c.name || "").toLowerCase().includes(q) || (c.contactPerson || "").toLowerCase().includes(q);
                      })
                      .map((c: any) => (
                        <div
                          key={c.id}
                          onClick={() => {
                            setFormData({ ...formData, customerId: c.id });
                            setCustomerSearch(c.name);
                            setShowCustomerDropdown(false);
                          }}
                          className="p-2 hover:bg-[#222324] cursor-pointer text-sm"
                        >
                          <div className="text-white">{c.name}</div>
                          <div className="text-[#8A8B8C] text-xs">{c.contactPerson} · {c.paymentTerms?.replace("_", " ")}</div>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* Payment Terms */}
              <div>
                <label className="label-text block mb-2">Payment Terms *</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { key: "cod", label: "COD" },
                    { key: "7_days", label: "7 Days" },
                    { key: "14_days", label: "14 Days" },
                    { key: "30_days", label: "30 Days" },
                  ].map((term) => (
                    <button
                      key={term.key}
                      type="button"
                      onClick={() => setFormData({ ...formData, paymentTerms: term.key as any })}
                      className="p-3 rounded-xl text-center transition-all cursor-pointer"
                      style={{
                        backgroundColor: formData.paymentTerms === term.key ? "rgba(212,168,67,0.15)" : "#0A0A0B",
                        border: formData.paymentTerms === term.key ? "2px solid #D4A843" : "2px solid #222324",
                      }}
                    >
                      <div className="text-sm font-display font-semibold" style={{ color: formData.paymentTerms === term.key ? "#D4A843" : "#8A8B8C" }}>{term.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Pricing Tier */}
              <div>
                {formData.orderType === "sample" ? (
                  <div className="p-3 rounded-lg" style={{ backgroundColor: "rgba(212, 168, 67, 0.08)", border: "1px solid rgba(212, 168, 67, 0.15)" }}>
                    <div className="flex items-center gap-2">
                      <FlaskConical className="w-4 h-4 text-[#D4A843]" />
                      <span className="text-sm text-[#D4A843] font-body">Sample orders use Corporate pricing</span>
                    </div>
                  </div>
                ) : (
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