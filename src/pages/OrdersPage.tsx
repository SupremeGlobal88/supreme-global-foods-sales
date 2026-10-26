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
      let staticProd = (staticData.STATIC_PRODUCTS || []).find((p: any) => String(p.id) === String(stockItemId) || p.productCode === stock.productCode);
      if (!staticProd && stock.productCode) {
        staticProd = (staticData.STATIC_PRODUCTS || []).find((p: any) => p.productCode === stock.productCode);
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
    return Number.isFinite(rawPrice) ? rawPrice : 0;
  }

  // Price helpers for the selected tier with special pricing
  function getUnitPrice(stockItemId: number | string, tier?: string): number {
    const special = (customerSpecialPrices || []).find(
      (sp: any) => String(sp.stockItemId) === String(stockItemId)
    );
    if (special && Number.isFinite(Number(special.price)) && Number(special.price) > 0) {
      return Number(special.price);
    }
    return getTierPrice(stockItemId, tier);
  }

  function getPriceBreakdown(stockItemId: number | string, qty: number, tier?: string) {
    const basePrice = getUnitPrice(stockItemId, tier);
    return { basePrice, total: basePrice * qty };
  }

  const subtotal = useMemo(() => {
    return (formData.items || []).reduce((sum, it) => {
      const price = getUnitPrice(it.stockItemId);
      return sum + price * (it.quantity || 0);
    }, 0);
  }, [formData.items, stockItems, customerSpecialPrices, formData.priceTier]);

  const vatRate = getCompanyConfig().vatRate || 0.15;
  const vatAmount = subtotal * vatRate;
  const totalWithVat = subtotal + vatAmount;

  const allCustomers = useMemo(() => {
    const regular = (customers || []).map((c: any) => ({ ...c, _type: "regular" }));
    const corporate = (customers || [])
      .filter((c: any) => c.type === "corporate")
      .map((c: any) => ({ ...c, _type: "corporate" }));
    // Merge, preferring corporate entries for deduplication
    const map = new Map<string, any>();
    regular.forEach((c: any) => { if (c.name) map.set(c.name.toLowerCase(), c); });
    corporate.forEach((c: any) => { if (c.name) map.set(c.name.toLowerCase(), c); });
    return Array.from(map.values());
  }, [customers]);

  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return allCustomers.slice(0, 50);
    const q = customerSearch.toLowerCase();
    return allCustomers
      .filter((c: any) =>
        c.name?.toLowerCase().includes(q) ||
        c.contactPerson?.toLowerCase().includes(q) ||
        c.phone?.includes(q)
      )
      .slice(0, 50);
  }, [allCustomers, customerSearch]);

  const selectedCustomer = useMemo(() => {
    return allCustomers.find((c: any) => c.id == formData.customerId);
  }, [allCustomers, formData.customerId]);

  function canPlaceOrder(): { ok: boolean; message?: string } {
    if (!formData.customerId) return { ok: false, message: "Please select a customer" };
    if (!formData.items.length) return { ok: false, message: "Please add at least one item" };
    if (formData.items.some((it) => !it.stockItemId || (it.quantity || 0) <= 0)) {
      return { ok: false, message: "Please select a product and enter a valid quantity for every item" };
    }

    const customer = allCustomers.find((c: any) => c.id == formData.customerId);
    if (!customer) return { ok: false, message: "Customer not found" };

    // Block inactive customers unless super admin or admin override
    if (customer.isActive === false && !isSuperAdmin && !adminOverride) {
      return { ok: false, message: "This customer is inactive. Please activate the customer before placing an order, or use admin override." };
    }

    // Credit limit check for non-super-admins (unless admin override)
    if (!isSuperAdmin && !adminOverride) {
      const creditLimit = Number(customer.creditLimit) || 0;
      if (creditLimit > 0) {
        const allOrders = orders || [];
        const customerOrders = allOrders.filter((o: any) => o.customerId == customer.id && o.status !== "cancelled");
        const outstanding = customerOrders.reduce((sum: number, o: any) => {
          const invs = (invoices || []).filter((i: any) => i.orderId == o.id && i.status !== "cancelled" && i.status !== "paid");
          return sum + invs.reduce((s: number, i: any) => s + (Number(i.total) || 0), 0);
        }, 0);
        if (outstanding >= creditLimit && !isSuperAdmin && !adminOverride) {
          return { ok: false, message: `Credit limit exceeded. Outstanding: R ${outstanding.toFixed(2)}, Limit: R ${creditLimit.toFixed(2)}. Please settle outstanding invoices or use admin override.` };
        }
      }
    }

    // COD overdue check for non-super-admins (unless admin override)
    if (!isSuperAdmin && !adminOverride) {
      const allOrders = orders || [];
      const customerOrders = allOrders.filter((o: any) => o.customerId == customer.id && o.status !== "cancelled");
      const unpaidCOD = customerOrders.filter((o: any) => {
        if (o.paymentTerms !== "cod") return false;
        const invs = (invoices || []).filter((i: any) => i.orderId == o.id && i.status !== "cancelled" && i.status !== "paid");
        return invs.length > 0;
      }).filter((o: any) => {
        const orderDate = new Date(o.createdAt || o.orderDate || Date.now());
        const now = new Date();
        const daysDiff = (now.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24);
        return daysDiff > 2;
      });
      if (unpaidCOD.length > 0 && !isSuperAdmin && !adminOverride) {
        return { ok: false, message: `This customer has ${unpaidCOD.length} unpaid COD invoice(s) older than 2 days. Please settle before placing a new order, or use admin override.` };
      }
    }

    // Stock availability check (skip for super admin with override)
    if (!isSuperAdmin || !adminOverride) {
      for (const it of formData.items) {
        const avail = availableStock[it.stockItemId] || 0;
        if ((it.quantity || 0) > avail) {
          return { ok: false, message: `Insufficient stock for item ${it.stockItemId}. Available: ${avail}, Requested: ${it.quantity}` };
        }
      }
    }

    return { ok: true };
  }

  function startEditOrder(order: any) {
    setEditingOrder(order);
    setFormData({
      customerId: order.customerId,
      orderType: order.orderType || "regular",
      paymentTerms: order.paymentTerms || "cod",
      priceTier: order.priceTier || "wholesale",
      deliveryAddress: order.deliveryAddress || "",
      notes: order.notes || "",
      items: (order.items || []).map((it: any) => ({
        stockItemId: it.stockItemId,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
      })),
    });
    const cust = allCustomers.find((c: any) => c.id == order.customerId);
    setCustomerSearch(cust?.name || "");
    setAdminOverride(false);
    setAdminPin("");
    sampleOverrideRef.current = false;
    setShowForm(true);
  }

  // Print picking slip
  function printPickingSlip(order: any) {
    const items = (order.items || []).map((it: any) => {
      const stock = (stockItems || []).find((s) => s.id == it.stockItemId);
      return { ...it, productName: stock?.productName || "Unknown", productCode: stock?.productCode || "" };
    });
    const customer = allCustomers.find((c: any) => c.id == order.customerId);
    const company = getCompanyConfig();
    const html = `
      <html><head><title>Picking Slip ${order.orderNumber}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
        h2 { margin-bottom: 5px; }
        .meta { margin-bottom: 15px; font-size: 13px; color: #666; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { border: 1px solid #ccc; padding: 8px; text-align: left; font-size: 13px; }
        th { background: #f5f5f5; }
        .footer { margin-top: 20px; font-size: 12px; color: #888; }
      </style></head><body>
      <h2>Picking Slip — ${order.orderNumber}</h2>
      <div class="meta">
        <strong>Customer:</strong> ${customer?.name || "N/A"}<br/>
        <strong>Date:</strong> ${new Date(order.createdAt || Date.now()).toLocaleString()}<br/>
        <strong>Status:</strong> ${order.status}<br/>
        <strong>Delivery:</strong> ${order.deliveryAddress || "Collect"}
      </div>
      <table>
        <tr><th>Code</th><th>Product</th><th>Qty</th><th>Unit</th></tr>
        ${items.map((it: any) => `<tr><td>${it.productCode}</td><td>${it.productName}</td><td>${it.quantity}</td><td>${it.unit || "each"}</td></tr>`).join("")}
      </table>
      <div class="footer">Printed from ${company.name} on ${new Date().toLocaleString()}</div>
      </body></html>
    `;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); w.print(); }
  }

  // Print quote
  function printQuote(order: any) {
    const items = (order.items || []).map((it: any) => {
      const stock = (stockItems || []).find((s) => s.id == it.stockItemId);
      return { ...it, productName: stock?.productName || "Unknown", productCode: stock?.productCode || "" };
    });
    const customer = allCustomers.find((c: any) => c.id == order.customerId);
    const company = getCompanyConfig();
    const subtotal = items.reduce((sum: number, it: any) => sum + (it.unitPrice || 0) * (it.quantity || 0), 0);
    const vat = subtotal * vatRate;
    const total = subtotal + vat;
    const html = `
      <html><head><title>Quote ${order.orderNumber}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
        .header { border-bottom: 2px solid #D4A843; padding-bottom: 10px; margin-bottom: 20px; }
        h2 { margin: 0; color: #D4A843; }
        .meta { font-size: 13px; color: #666; margin-top: 5px; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        th, td { border: 1px solid #ccc; padding: 8px; text-align: left; font-size: 13px; }
        th { background: #f5f5f5; }
        .totals { margin-top: 15px; text-align: right; font-size: 14px; }
        .total { font-size: 18px; font-weight: bold; color: #D4A843; }
        .footer { margin-top: 30px; font-size: 12px; color: #888; border-top: 1px solid #eee; padding-top: 10px; }
        .validity { background: #fff8e1; padding: 10px; border-left: 4px solid #D4A843; margin-top: 15px; font-size: 13px; }
      </style></head><body>
      <div class="header">
        <h2>${company.name}</h2>
        <div class="meta">${company.address || ""}<br/>Tel: ${company.phone || ""} | Email: ${company.email || ""}</div>
      </div>
      <h3>QUOTATION — ${order.orderNumber}</h3>
      <div class="meta">
        <strong>Customer:</strong> ${customer?.name || "N/A"}<br/>
        <strong>Contact:</strong> ${customer?.contactPerson || "N/A"}<br/>
        <strong>Date:</strong> ${new Date(order.createdAt || Date.now()).toLocaleDateString()}<br/>
        <strong>Valid for:</strong> 30 days
      </div>
      <table>
        <tr><th>Code</th><th>Product</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr>
        ${items.map((it: any) => {
          const lineTotal = (it.unitPrice || 0) * (it.quantity || 0);
          return `<tr><td>${it.productCode}</td><td>${it.productName}</td><td>${it.quantity}</td><td>R ${(it.unitPrice || 0).toFixed(2)}</td><td>R ${lineTotal.toFixed(2)}</td></tr>`;
        }).join("")}
      </table>
      <div class="totals">
        <div>Subtotal: R ${subtotal.toFixed(2)}</div>
        <div>VAT (${(vatRate * 100).toFixed(0)}%): R ${vat.toFixed(2)}</div>
        <div class="total">Total: R ${total.toFixed(2)}</div>
      </div>
      <div class="validity">This quotation is valid for 30 days from the date of issue. Prices are subject to change thereafter.</div>
      <div class="footer">Thank you for your business!<br/>Banking: ${banking.bankName || ""} | Acc: ${banking.accountNumber || ""} | Branch: ${banking.branchCode || ""}</div>
      </body></html>
    `;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); w.print(); }
  }

  // Send quote via email
  async function sendQuoteEmail(order: any) {
    const customer = allCustomers.find((c: any) => c.id == order.customerId);
    if (!customer?.email) {
      alert("Customer has no email address. Please add an email first.");
      return;
    }
    const items = (order.items || []).map((it: any) => {
      const stock = (stockItems || []).find((s) => s.id == it.stockItemId);
      return { ...it, productName: stock?.productName || "Unknown", productCode: stock?.productCode || "" };
    });
    const company = getCompanyConfig();
    const subtotal = items.reduce((sum: number, it: any) => sum + (it.unitPrice || 0) * (it.quantity || 0), 0);
    const vat = subtotal * vatRate;
    const total = subtotal + vat;

    const subject = encodeURIComponent(`Quotation ${order.orderNumber} from ${company.name}`);
    const body = encodeURIComponent(
      `Dear ${customer.contactPerson || customer.name},\n\n` +
      `Please find your quotation below:\n\n` +
      `Quote Ref: ${order.orderNumber}\n` +
      `Date: ${new Date(order.createdAt || Date.now()).toLocaleDateString()}\n` +
      `Valid for: 30 days\n\n` +
      `Items:\n` +
      items.map((it: any) => `• ${it.productName} (${it.productCode}) — Qty: ${it.quantity} @ R ${(it.unitPrice || 0).toFixed(2)} = R ${((it.unitPrice || 0) * it.quantity).toFixed(2)}`).join("\n") +
      `\n\nSubtotal: R ${subtotal.toFixed(2)}\n` +
      `VAT (${(vatRate * 100).toFixed(0)}%): R ${vat.toFixed(2)}\n` +
      `Total: R ${total.toFixed(2)}\n\n` +
      `Banking Details:\n` +
      `Bank: ${banking.bankName || "N/A"}\n` +
      `Account: ${banking.accountNumber || "N/A"}\n` +
      `Branch: ${banking.branchCode || "N/A"}\n\n` +
      `Thank you for your business!\n` +
      `${company.name}\n${company.phone || ""}\n${company.email || ""}`
    );
    window.location.href = `mailto:${customer.email}?subject=${subject}&body=${body}`;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validation = canPlaceOrder();
    if (!validation.ok) {
      alert(validation.message);
      return;
    }
    try {
      const payload: any = {
        customerId: formData.customerId,
        orderType: formData.orderType,
        paymentTerms: formData.paymentTerms,
        priceTier: formData.priceTier,
        deliveryAddress: formData.deliveryAddress,
        notes: formData.notes,
        items: formData.items.map((it) => ({
          stockItemId: it.stockItemId,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
        })),
      };
      if (editingOrder) {
        await updateOrder.mutateAsync({ id: editingOrder.id, ...payload });
      } else {
        // Super admin override flag — send when adminOverride checkbox is checked and PIN entered
        if (adminOverride && adminPin) {
          payload.superAdminOverride = true;
        }
        await createOrder.mutateAsync(payload);
      }
    } catch (err: any) {
      alert("Order submission failed: " + (err.message || "Unknown error"));
    }
  }

  const filteredOrders = useMemo(() => {
    let list = (orders || []);
    if (activeTab === "quotes") {
      list = list.filter((o) => o.orderType === "quote");
    } else if (activeTab === "sample") {
      list = list.filter((o) => o.orderType === "sample");
    } else if (activeTab !== "all") {
      list = list.filter((o) => o.status === activeTab);
    }
    if (orderSearch.trim()) {
      const q = orderSearch.toLowerCase();
      list = list.filter((o) =>
        o.orderNumber?.toLowerCase().includes(q) ||
        o.customerName?.toLowerCase().includes(q) ||
        o.status?.toLowerCase().includes(q)
      );
    }
    return list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }, [orders, activeTab, orderSearch]);

  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = { all: 0, pending: 0, picking: 0, ready: 0, delivered: 0, cancelled: 0, sample: 0, quotes: 0 };
    (orders || []).forEach((o) => {
      counts.all++;
      if (o.status) counts[o.status] = (counts[o.status] || 0) + 1;
      if (o.orderType === "sample") counts.sample++;
      if (o.orderType === "quote") counts.quotes++;
    });
    return counts;
  }, [orders]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-display font-bold text-white">Orders</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setShowForm(true); setEditingOrder(null); resetForm(); sampleOverrideRef.current = false; }}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> New Order
          </button>
        </div>
      </div>

      <div className="card-surface">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex flex-wrap gap-2">
            {statusTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab.key
                    ? "bg-[#D4A843] text-[#0A0A0B]"
                    : "bg-[#18191A] text-[#8A8B8C] hover:text-white"
                }`}
              >
                {tab.label} ({tabCounts[tab.key] || 0})
              </button>
            ))}
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#8A8B8C]" />
            <input
              type="text"
              placeholder="Search orders..."
              value={orderSearch}
              onChange={(e) => setOrderSearch(e.target.value)}
              className="input-field w-full pl-10"
            />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {filteredOrders.length === 0 && (
          <div className="card-surface p-8 text-center text-[#8A8B8C]">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-lg font-medium">No orders found</p>
            <p className="text-sm mt-1">{activeTab === "all" ? "Get started by creating your first order" : `No ${activeTab} orders`}</p>
          </div>
        )}

        {filteredOrders.map((order) => {
          const isExpanded = expandedOrder === order.id;
          const statusInfo = STATUS_LABELS[order.status] || { label: order.status, color: "#8A8B8C" };
          const isQuote = order.orderType === "quote";
          const isSample = order.orderType === "sample";
          const customer = allCustomers.find((c: any) => c.id == order.customerId);
          const orderInvoices = (invoices || []).filter((i: any) => i.orderId == order.id);
          const hasCancelledInvoice = orderInvoices.some((i: any) => i.status === "cancelled");
          const hasActiveInvoice = orderInvoices.some((i: any) => i.status !== "cancelled" && (i.invoiceNumber?.startsWith("SGF") || i.invoiceNumber?.startsWith("RC")));

          return (
            <div key={order.id} className="card-surface">
              <div
                className="flex items-center justify-between p-4 cursor-pointer"
                onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
              >
                <div className="flex items-center gap-3">
                  {isQuote ? <FileText className="w-5 h-5 text-[#6366F1]" /> : isSample ? <FlaskConical className="w-5 h-5 text-[#D4A843]" /> : <ShoppingBag className="w-5 h-5 text-[#D4A843]" />}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-display font-semibold text-white">{order.orderNumber}</span>
                      <span
                        className="px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{ backgroundColor: statusInfo.color + "20", color: statusInfo.color }}
                      >
                        {statusInfo.label}
                      </span>
                      {isQuote && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[#6366F1]/20 text-[#6366F1]">
                          Quote
                        </span>
                      )}
                      {isSample && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[#D4A843]/20 text-[#D4A843]">
                          Sample
                        </span>
                      )}
                      {hasCancelledInvoice && order.status !== "cancelled" && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[#F59E0B]/20 text-[#F59E0B]">
                          NEEDS CANCEL
                        </span>
                      )}
                      {/* "NO INVOICE" badge: only for delivered orders that have NO active invoice */}
                      {order.status === "delivered" && !hasActiveInvoice && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[#EF4444]/20 text-[#EF4444]">
                          NO INVOICE
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-[#8A8B8C] mt-0.5">{customer?.name || order.customerName || "Unknown"} • {new Date(order.createdAt || Date.now()).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-display font-semibold text-[#D4A843]">
                    R {Number(order.total || 0).toFixed(2)}
                  </span>
                  {isExpanded ? <ChevronUp className="w-5 h-5 text-[#8A8B8C]" /> : <ChevronDown className="w-5 h-5 text-[#8A8B8C]" />}
                </div>
              </div>

              {isExpanded && (
                <div className="border-t p-4 space-y-4" style={{ borderColor: "#222324" }}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-[#8A8B8C]">Customer</span>
                      <p className="font-medium text-white">{customer?.name || order.customerName || "N/A"}</p>
                    </div>
                    <div>
                      <span className="text-[#8A8B8C]">Contact</span>
                      <p className="font-medium text-white">{customer?.contactPerson || "N/A"}</p>
                    </div>
                    <div>
                      <span className="text-[#8A8B8C]">Payment Terms</span>
                      <p className="font-medium text-white capitalize">{(order.paymentTerms || "cod").replace("_", " ")}</p>
                    </div>
                    <div>
                      <span className="text-[#8A8B8C]">Price Tier</span>
                      <p className="font-medium text-white capitalize">{order.priceTier || "wholesale"}</p>
                    </div>
                    <div>
                      <span className="text-[#8A8B8C]">Delivery</span>
                      <p className="font-medium text-white">{order.deliveryAddress || "Collect from warehouse"}</p>
                    </div>
                    <div>
                      <span className="text-[#8A8B8C]">Sales Rep</span>
                      <p className="font-medium text-white">{order.salesRepName || myRepName || "N/A"}</p>
                    </div>
                    <div>
                      <span className="text-[#8A8B8C]">Created</span>
                      <p className="font-medium text-white">{new Date(order.createdAt || Date.now()).toLocaleString()}</p>
                    </div>
                    <div>
                      <span className="text-[#8A8B8C]">Subtotal / VAT / Total</span>
                      <p className="font-medium text-white">R {Number(order.subtotal || 0).toFixed(2)} / R {Number(order.vatAmount || 0).toFixed(2)} / R {Number(order.total || 0).toFixed(2)}</p>
                    </div>
                  </div>

                  {order.notes && (
                    <div className="bg-[#18191A] rounded-lg p-3">
                      <span className="text-[#8A8B8C] text-sm">Notes</span>
                      <p className="text-sm text-white mt-1">{order.notes}</p>
                    </div>
                  )}

                  <div>
                    <h4 className="text-sm font-medium text-white mb-2">Items</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b" style={{ borderColor: "#222324" }}>
                            <th className="text-left py-2 text-[#8A8B8C] font-medium">Product</th>
                            <th className="text-left py-2 text-[#8A8B8C] font-medium">Code</th>
                            <th className="text-right py-2 text-[#8A8B8C] font-medium">Qty</th>
                            <th className="text-right py-2 text-[#8A8B8C] font-medium">Unit Price</th>
                            <th className="text-right py-2 text-[#8A8B8C] font-medium">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(order.items || []).map((item: any, idx: number) => {
                            const stock = (stockItems || []).find((s) => s.id == item.stockItemId);
                            return (
                              <tr key={idx} className="border-b" style={{ borderColor: "#18191A" }}>
                                <td className="py-2 text-white">{stock?.productName || "Unknown"}</td>
                                <td className="py-2 text-[#8A8B8C] font-mono-data">{stock?.productCode || "N/A"}</td>
                                <td className="py-2 text-right text-white">{item.quantity}</td>
                                <td className="py-2 text-right text-white">R {Number(item.unitPrice || 0).toFixed(2)}</td>
                                <td className="py-2 text-right text-[#D4A843] font-display">R {Number((item.unitPrice || 0) * item.quantity).toFixed(2)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {/* Status update buttons */}
                    {order.status === "pending" && (
                      <button
                        onClick={() => updateStatus.mutate({ id: order.id, status: "picking" })}
                        className="btn-secondary text-xs flex items-center gap-1.5"
                      >
                        <Package className="w-3 h-3" /> Start Picking
                      </button>
                    )}
                    {order.status === "picking" && (
                      <button
                        onClick={() => updateStatus.mutate({ id: order.id, status: "ready" })}
                        className="btn-secondary text-xs flex items-center gap-1.5"
                      >
                        <CheckCircle className="w-3 h-3" /> Mark Ready
                      </button>
                    )}
                    {order.status === "ready" && (
                      <button
                        onClick={() => updateStatus.mutate({ id: order.id, status: "delivered" })}
                        className="btn-secondary text-xs flex items-center gap-1.5"
                      >
                        <Truck className="w-3 h-3" /> Mark Delivered
                      </button>
                    )}
                    {(order.status === "pending" || order.status === "picking") && (
                      <button
                        onClick={() => {
                          if (confirm("Cancel this order? Stock will be restored.")) {
                            updateStatus.mutate({ id: order.id, status: "cancelled" });
                          }
                        }}
                        className="btn-secondary text-xs flex items-center gap-1.5"
                        style={{ borderColor: "rgba(239,68,68,0.5)", color: "#EF4444" }}
                      >
                        <Ban className="w-3 h-3" /> Cancel
                      </button>
                    )}

                    {/* Print Picking Slip */}
                    <button
                      onClick={() => printPickingSlip(order)}
                      className="btn-secondary text-xs flex items-center gap-1.5"
                    >
                      <Printer className="w-3 h-3" /> Picking Slip
                    </button>

                    {/* Generate Invoice (only for non-quotes) */}
                    {!isQuote && <GenerateInvoiceButton orderId={order.id} />}

                    {/* Quote actions */}
                    {isQuote && order.status !== "converted" && (
                      <>
                        <button
                          onClick={() => printQuote(order)}
                          className="btn-secondary text-xs flex items-center gap-1.5"
                        >
                          <Printer className="w-3 h-3" /> Print Quote
                        </button>
                        <button
                          onClick={() => sendQuoteEmail(order)}
                          className="btn-secondary text-xs flex items-center gap-1.5"
                        >
                          <Mail className="w-3 h-3" /> Email Quote
                        </button>
                        <button
                          onClick={() => {
                            if (confirm("Convert this quote to a regular order?")) {
                              convertQuoteToOrder.mutate({ id: order.id });
                            }
                          }}
                          className="btn-primary text-xs flex items-center gap-1.5"
                        >
                          <RotateCcw className="w-3 h-3" /> Convert to Order
                        </button>
                      </>
                    )}

                    {/* Edit button */}
                    <button
                      onClick={() => startEditOrder(order)}
                      className="btn-secondary text-xs flex items-center gap-1.5"
                    >
                      <Pencil className="w-3 h-3" /> Edit
                    </button>
                  </div>

                  {/* Invoice list for this order */}
                  {orderInvoices.length > 0 && (
                    <div className="mt-3">
                      <h4 className="text-sm font-medium text-white mb-2">Invoices</h4>
                      <div className="space-y-1">
                        {orderInvoices.map((inv: any) => (
                          <div key={inv.id} className="flex items-center justify-between bg-[#18191A] rounded-lg px-3 py-2 text-sm">
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4 text-[#D4A843]" />
                              <span className="text-white font-mono-data">{inv.invoiceNumber}</span>
                              <span
                                className="px-2 py-0.5 rounded-full text-xs"
                                style={{
                                  backgroundColor: inv.status === "paid" ? "rgba(74,222,128,0.2)" : inv.status === "cancelled" ? "rgba(239,68,68,0.2)" : "rgba(245,158,11,0.2)",
                                  color: inv.status === "paid" ? "#4ADE80" : inv.status === "cancelled" ? "#EF4444" : "#F59E0B",
                                }}
                              >
                                {inv.status}
                              </span>
                            </div>
                            <span className="text-[#D4A843] font-display">R {Number(inv.total || 0).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Order Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.8)" }}>
          <div className="card-surface w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: "#222324" }}>
              <h2 className="text-xl font-display font-bold text-white">
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
              {/* Customer selection */}
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
                          onClick={() => {
                            setFormData((prev) => ({ ...prev, customerId: c.id }));
                            setCustomerSearch(c.name || "");
                            setShowCustomerDropdown(false);
                          }}
                          className="p-3 hover:bg-[#222324] cursor-pointer border-b"
                          style={{ borderColor: "#18191A" }}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-white font-medium">{c.name}</span>
                            <span className="text-xs text-[#8A8B8C]">{c._type === "corporate" ? "Corporate" : "Regular"}</span>
                          </div>
                          <div className="text-xs text-[#8A8B8C] mt-0.5">{c.contactPerson} • {c.phone}</div>
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

              {/* Order type, payment terms, price tier */}
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

              {/* Admin override for below-corporate pricing */}
              {formData.priceTier !== "corporate" && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="adminOverride"
                      checked={adminOverride}
                      onChange={(e) => { setAdminOverride(e.target.checked); if (!e.target.checked) setAdminPin(""); }}
                      className="w-4 h-4 rounded border-[#333334] bg-[#18191A] text-[#D4A843] focus:ring-[#D4A843]"
                    />
                    <label htmlFor="adminOverride" className="text-sm text-white cursor-pointer">
                      Admin Override (below corporate pricing)
                    </label>
                  </div>
                  {adminOverride && (
                    <div className="flex items-center gap-2">
                      <input
                        type="password"
                        value={adminPin}
                        onChange={(e) => setAdminPin(e.target.value)}
                        placeholder="Enter admin PIN"
                        className="input-field w-48"
                      />
                      <span className="text-xs text-[#8A8B8C]">Required for below-corporate pricing</span>
                    </div>
                  )}
                </div>
              )}

              {/* Delivery address */}
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

              {/* Notes */}
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

              {/* Items */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-white">Items</label>
                  <button
                    type="button"
                    onClick={() => {
                      setFormData((prev) => ({
                        ...prev,
                        items: [...prev.items, { stockItemId: 0, quantity: 1 }],
                      }));
                    }}
                    className="btn-secondary text-xs flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Add Item
                  </button>
                </div>

                {formData.items.map((item, idx) => {
                  const stock = (stockItems || []).find((s) => s.id == item.stockItemId);
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
                            onClick={() => {
                              setFormData((prev) => ({
                                ...prev,
                                items: prev.items.filter((_, i) => i !== idx),
                              }));
                            }}
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

              {/* Totals */}
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

              {/* Validation warnings */}
              {(() => {
                const validation = canPlaceOrder();
                if (!validation.ok) {
                  return (
                    <div className="flex items-center gap-2 p-3 bg-[#EF4444]/10 border rounded-lg" style={{ borderColor: "rgba(239,68,68,0.3)" }}>
                      <AlertTriangle className="w-4 h-4 text-[#EF4444] flex-shrink-0" />
                      <span className="text-sm text-[#EF4444]">{validation.message}</span>
                    </div>
                  );
                }
                return null;
              })()}

              {/* Submit button */}
              <button
                type="submit"
                disabled={createOrder.isPending || updateOrder.isPending || !canPlaceOrder().ok}
                className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {createOrder.isPending || updateOrder.isPending ? (
                  <span className="animate-pulse">Processing...</span>
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