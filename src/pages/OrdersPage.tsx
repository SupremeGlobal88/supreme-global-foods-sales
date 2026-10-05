import { useState, useMemo, useRef, useEffect } from "react";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { reloadFromStorage, generateInvoiceForOrder, dataService, getBankingDetails } from "@/lib/dataService";
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
  { key: "draft", label: "Quotes" },
  { key: "sample_delivered", label: "Samples" },
];

export default function OrdersPage() {
  const { user } = useAuth();
  const { role } = useRole();
  const isAdmin = role === "admin";
  const isSalesRep = role === "sales_rep";
  const isSalesManager = role === "sales_manager";
  const canManageAll = isAdmin || isSalesManager;
  const canCreate = isAdmin || isSalesRep || isSalesManager;

  const [showForm, setShowForm] = useState(false);
  const [editingOrder, setEditingOrder] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);

  const [customerSearch, setCustomerSearch] = useState("");
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const customerDropdownRef = useRef<HTMLDivElement>(null);

  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [pickerTargetIndex, setPickerTargetIndex] = useState<number | null>(null);

  const [showQuoteConfirm, setShowQuoteConfirm] = useState(false);
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [quoteOrder, setQuoteOrder] = useState<any>(null);
  const [quoteViewMode, setQuoteViewMode] = useState<"preview" | "email">("preview");
  const [bankingDetails, setBankingDetails] = useState<any>(null);

  const [showPickingModal, setShowPickingModal] = useState(false);
  const [pickingOrder, setPickingOrder] = useState<any>(null);

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<{from: string; to: string}>({ from: "", to: "" });
  const [repFilter, setRepFilter] = useState<string>("all");
  const [tierFilter, setTierFilter] = useState<string>("all");
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printOrder, setPrintOrder] = useState<any>(null);
  const [sortField, setSortField] = useState<string>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const { data: orders, isLoading } = trpc.order.list.useQuery(undefined, {
    refetchInterval: 5000,
    refetchOnMount: "always",
    staleTime: 0,
  });

  const { data: customers } = trpc.customer.list.useQuery(undefined, {
    refetchInterval: 10000,
    refetchOnMount: "always",
  });

  const { data: stockItems } = trpc.stock.list.useQuery(undefined, {
    refetchInterval: 10000,
    refetchOnMount: "always",
  });

  const { data: stockSearch } = trpc.stock.search.useQuery(undefined, {
    refetchInterval: 10000,
    refetchOnMount: "always",
  });

  const { data: availableStock } = trpc.stock.getAvailable.useQuery(undefined, {
    refetchInterval: 10000,
    refetchOnMount: "always",
  });

  const { data: salesReps } = trpc.salesRep.list.useQuery(undefined, {
    refetchInterval: 30000,
    refetchOnMount: "always",
  });

  const { data: currentUser } = trpc.user.me.useQuery();

  const utils = trpc.useContext();

  const [formData, setFormData] = useState({
    customerId: "",
    items: [{ productId: "", quantity: 1, unitPrice: 0 }],
    paymentTerms: "cod",
    deliveryMethod: "delivery",
    deliveryAddress: "",
    notes: "",
    priceTier: "retail",
    isQuote: false,
    salesRepId: "",
    sampleRequested: false,
  });

  useEffect(() => {
    if (isSalesRep && currentUser?.id) {
      setFormData(prev => ({ ...prev, salesRepId: String(currentUser.id) }));
    }
  }, [isSalesRep, currentUser]);

  const createOrder = trpc.order.create.useMutation({
    onSuccess: async () => {
      setShowForm(false);
      setEditingOrder(null);
      sampleOverrideRef.current = false;
      resetForm();
      reloadFromStorage();
      await utils.order.list.invalidate();
      await utils.order.getStats.invalidate();
      await utils.stock.search.invalidate();
      await utils.stock.list.invalidate();
      await utils.stock.getStats.invalidate();
      await utils.sampleReport.getAll.invalidate();
    },
  });

  const updateOrder = trpc.order.update.useMutation({
    onSuccess: async () => {
      setShowForm(false);
      setEditingOrder(null);
      sampleOverrideRef.current = false;
      resetForm();
      reloadFromStorage();
      await utils.order.list.invalidate();
      await utils.order.getStats.invalidate();
      await utils.stock.search.invalidate();
      await utils.stock.list.invalidate();
      await utils.stock.getStats.invalidate();
      await utils.sampleReport.getAll.invalidate();
    },
  });

  const updateStatus = trpc.order.updateStatus.useMutation({
    onSuccess: async () => {
      reloadFromStorage();
      await utils.order.list.invalidate();
      await utils.order.getStats.invalidate();
    },
  });

  const deleteOrder = trpc.order.delete.useMutation({
    onSuccess: async () => {
      reloadFromStorage();
      await utils.order.list.invalidate();
      await utils.order.getStats.invalidate();
      await utils.stock.search.invalidate();
      await utils.stock.list.invalidate();
      await utils.stock.getStats.invalidate();
      await utils.sampleReport.getAll.invalidate();
    },
  });

  const cancelOrder = trpc.order.cancel.useMutation({
    onSuccess: async () => {
      reloadFromStorage();
      await utils.order.list.invalidate();
      await utils.order.getStats.invalidate();
      await utils.stock.search.invalidate();
      await utils.stock.list.invalidate();
      await utils.stock.getStats.invalidate();
    },
  });

  const convertQuoteToOrder = trpc.order.convertQuoteToOrder.useMutation({
    onSuccess: async () => {
      reloadFromStorage();
      await utils.order.list.invalidate();
      await utils.order.getStats.invalidate();
      await utils.stock.search.invalidate();
      await utils.stock.list.invalidate();
      await utils.stock.getStats.invalidate();
    },
  });

  const sendQuote = trpc.order.sendQuote.useMutation({
    onSuccess: async () => {
      reloadFromStorage();
      await utils.order.list.invalidate();
      await utils.order.getStats.invalidate();
    },
  });

  const repCustomers = useMemo(() => {
    if (!customers) return [];
    if (isAdmin || isSalesManager) return customers;
    if (isSalesRep && currentUser?.id) {
      return customers.filter((c: any) => c.salesRepId == currentUser.id);
    }
    return customers;
  }, [customers, isAdmin, isSalesManager, isSalesRep, currentUser]);

  const repOrders = useMemo(() => {
    if (!orders) return [];
    if (isAdmin || isSalesManager) return orders;
    if (isSalesRep && currentUser?.id) {
      return orders.filter((o: any) => o.salesRepId == currentUser.id || (o.customer?.salesRepId == currentUser.id));
    }
    return orders;
  }, [orders, isAdmin, isSalesManager, isSalesRep, currentUser]);

  const filteredOrders = useMemo(() => {
    let result = [...(repOrders || [])];

    if (statusFilter !== "all" && activeTab === "all") {
      result = result.filter((o: any) => o.status === statusFilter);
    }

    if (activeTab !== "all") {
      if (activeTab === "draft") {
        result = result.filter((o: any) => ["draft", "sent", "accepted", "rejected", "converted"].includes(o.status));
      } else {
        result = result.filter((o: any) => o.status === activeTab);
      }
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter((o: any) =>
        o.orderNumber?.toLowerCase().includes(q) ||
        o.customer?.name?.toLowerCase().includes(q) ||
        o.customer?.company?.toLowerCase().includes(q) ||
        o.items?.some((i: any) => i.productName?.toLowerCase().includes(q))
      );
    }

    if (dateFilter.from || dateFilter.to) {
      result = result.filter((o: any) => {
        const d = new Date(o.createdAt);
        if (dateFilter.from && d < new Date(dateFilter.from)) return false;
        if (dateFilter.to && d > new Date(dateFilter.to)) return false;
        return true;
      });
    }

    if (repFilter !== "all") {
      result = result.filter((o: any) => String(o.salesRepId) === repFilter);
    }

    if (tierFilter !== "all") {
      result = result.filter((o: any) => o.priceTier === tierFilter);
    }

    result.sort((a: any, b: any) => {
      const aVal = a[sortField] || "";
      const bVal = b[sortField] || "";
      if (sortDir === "asc") return aVal > bVal ? 1 : -1;
      return aVal < bVal ? 1 : -1;
    });

    return result;
  }, [repOrders, statusFilter, activeTab, searchTerm, dateFilter, repFilter, tierFilter, sortField, sortDir]);

  const stats = useMemo(() => {
    const total = filteredOrders.length;
    const pending = filteredOrders.filter((o: any) => o.status === "pending").length;
    const picking = filteredOrders.filter((o: any) => o.status === "picking").length;
    const ready = filteredOrders.filter((o: any) => o.status === "ready").length;
    const delivered = filteredOrders.filter((o: any) => o.status === "delivered").length;
    const cancelled = filteredOrders.filter((o: any) => o.status === "cancelled").length;
    const draft = filteredOrders.filter((o: any) => o.status === "draft").length;
    const totalValue = filteredOrders.reduce((sum: number, o: any) => sum + (Number(o.total) || 0), 0);
    return { total, pending, picking, ready, delivered, cancelled, draft, totalValue };
  }, [filteredOrders]);

  function resetForm() {
    setFormData({
      customerId: "",
      items: [{ productId: "", quantity: 1, unitPrice: 0 }],
      paymentTerms: "cod",
      deliveryMethod: "delivery",
      deliveryAddress: "",
      notes: "",
      priceTier: "retail",
      isQuote: false,
      salesRepId: isSalesRep && currentUser?.id ? String(currentUser.id) : "",
      sampleRequested: false,
    });
    setSelectedCustomerId(null);
    setCustomerSearch("");
  }

  function getCustomerName(id: number) {
    const c = customers?.find((x: any) => x.id == id);
    return c?.name || c?.company || "Unknown";
  }

  function getCustomerById(id: number) {
    return customers?.find((x: any) => x.id == id);
  }

  function getStockItem(id: number) {
    return (stockItems || []).find((s: any) => s.id == id) || (stockSearch || []).find((s: any) => s.id == id);
  }

  function getProductName(id: number) {
    const s = getStockItem(id);
    return s?.productName || "Unknown Product";
  }

  function getUnitPrice(id: number, tier: string) {
    const s = getStockItem(id);
    if (!s) return 0;
    return s[tier + "Price"] || s.unitPrice || 0;
  }

  function addItem() {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { productId: "", quantity: 1, unitPrice: 0 }],
    }));
  }

  function removeItem(index: number) {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  }

  function updateItem(index: number, field: string, value: any) {
    setFormData(prev => {
      const newItems = [...prev.items];
      newItems[index] = { ...newItems[index], [field]: value };
      if (field === "productId") {
        newItems[index].unitPrice = getUnitPrice(Number(value), prev.priceTier);
      }
      return { ...prev, items: newItems };
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const customerId = Number(formData.customerId);
    if (!customerId) {
      alert("Please select a customer");
      return;
    }
    if (formData.items.length === 0 || formData.items.every(i => !i.productId)) {
      alert("Please add at least one product");
      return;
    }
    const validItems = formData.items
      .filter(i => i.productId && Number(i.quantity) > 0)
      .map(i => ({
        productId: Number(i.productId),
        quantity: sampleOverrideRef.current && formData.sampleRequested ? 1 : Number(i.quantity),
        unitPrice: Number(i.unitPrice) || 0,
      }));
    if (validItems.length === 0) {
      alert("Please add valid items");
      return;
    }
    const payload = {
      customerId,
      items: validItems,
      paymentTerms: formData.paymentTerms,
      deliveryMethod: formData.deliveryMethod,
      deliveryAddress: formData.deliveryAddress,
      notes: formData.notes,
      priceTier: formData.priceTier,
      isQuote: formData.isQuote,
      salesRepId: formData.salesRepId ? Number(formData.salesRepId) : undefined,
      sampleRequested: formData.sampleRequested,
    };
    if (editingOrder) {
      updateOrder.mutate({ id: editingOrder.id, ...payload });
    } else {
      createOrder.mutate(payload);
    }
  }

  function startEditOrder(order: any) {
    sampleOverrideRef.current = true;
    setEditingOrder(order);
    setFormData({
      customerId: String(order.customerId || ""),
      items: order.items?.map((i: any) => ({
        productId: String(i.productId || ""),
        quantity: i.quantity || 1,
        unitPrice: i.unitPrice || 0,
      })) || [{ productId: "", quantity: 1, unitPrice: 0 }],
      paymentTerms: order.paymentTerms || "cod",
      deliveryMethod: order.deliveryMethod || "delivery",
      deliveryAddress: order.deliveryAddress || "",
      notes: order.notes || "",
      priceTier: order.priceTier || "retail",
      isQuote: order.isQuote || false,
      salesRepId: order.salesRepId ? String(order.salesRepId) : "",
      sampleRequested: order.sampleRequested || false,
    });
    setSelectedCustomerId(order.customerId || null);
    setCustomerSearch(getCustomerName(order.customerId) || "");
    setShowForm(true);
  }

  function handlePrint(order: any) {
    setPrintOrder(order);
    setShowPrintModal(true);
  }

  function handleSendQuote(order: any) {
    setQuoteOrder(order);
    setShowQuoteModal(true);
    setQuoteViewMode("preview");
    setBankingDetails(getBankingDetails());
  }

  function handlePickingSlip(order: any) {
    setPickingOrder(order);
    setShowPickingModal(true);
  }

  const allStock = useMemo(() => {
    const map = new Map();
    (stockItems || []).forEach((s: any) => map.set(s.id, s));
    (stockSearch || []).forEach((s: any) => map.set(s.id, s));
    return Array.from(map.values());
  }, [stockItems, stockSearch]);

  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return repCustomers || [];
    const q = customerSearch.toLowerCase();
    return (repCustomers || []).filter((c: any) =>
      c.name?.toLowerCase().includes(q) ||
      c.company?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q)
    );
  }, [repCustomers, customerSearch]);

  const subtotal = useMemo(() => {
    return formData.items.reduce((sum: number, item: any) => {
      return sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
    }, 0);
  }, [formData.items]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(e.target as Node)) {
        setCustomerDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="page-container">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-white">Orders</h1>
          <p className="text-sm text-[#8A8B8C] mt-1">Manage orders, quotes and samples</p>
        </div>
        {canCreate && (
          <button
            onClick={() => { setEditingOrder(null); sampleOverrideRef.current = false; resetForm(); setShowForm(true); }}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Order
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
        {[
          { label: "Total", value: stats.total, color: "#D4A843" },
          { label: "Pending", value: stats.pending, color: "#F59E0B" },
          { label: "Picking", value: stats.picking, color: "#6366F1" },
          { label: "Ready", value: stats.ready, color: "#4ADE80" },
          { label: "Delivered", value: stats.delivered, color: "#4ADE80" },
          { label: "Quotes", value: stats.draft, color: "#8A8B8C" },
          { label: "Value", value: "R " + stats.totalValue.toFixed(2), color: "#D4A843" },
        ].map((stat) => (
          <div key={stat.label} className="card-surface p-3 text-center">
            <div className="text-lg font-display font-bold" style={{ color: stat.color }}>{stat.value}</div>
            <div className="text-xs text-[#8A8B8C]">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {statusTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-[#D4A843] text-[#0A0B0C]"
                : "bg-[#18191A] text-[#8A8B8C] hover:bg-[#222324]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#8A8B8C]" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search orders..."
            className="input-field w-full pl-10"
          />
        </div>
        {canManageAll && (
          <select
            value={repFilter}
            onChange={(e) => setRepFilter(e.target.value)}
            className="input-field"
          >
            <option value="all">All Reps</option>
            {(salesReps || []).map((rep: any) => (
              <option key={rep.id} value={String(rep.id)}>{rep.name}</option>
            ))}
          </select>
        )}
        <select
          value={tierFilter}
          onChange={(e) => setTierFilter(e.target.value)}
          className="input-field"
        >
          <option value="all">All Tiers</option>
          {PRICE_TIERS.map((tier) => (
            <option key={tier.key} value={tier.key}>{tier.label}</option>
          ))}
        </select>
        <input
          type="date"
          value={dateFilter.from}
          onChange={(e) => setDateFilter(prev => ({ ...prev, from: e.target.value }))}
          className="input-field"
        />
        <input
          type="date"
          value={dateFilter.to}
          onChange={(e) => setDateFilter(prev => ({ ...prev, to: e.target.value }))}
          className="input-field"
        />
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-[#8A8B8C]">Loading orders...</div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.length === 0 && (
            <div className="text-center py-12 text-[#8A8B8C]">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No orders found</p>
            </div>
          )}
          {filteredOrders.map((order: any) => {
            const isExpanded = expandedOrderId === order.id;
            const customer = getCustomerById(order.customerId);
            const rep = salesReps?.find((r: any) => r.id == order.salesRepId);
            return (
              <div
                key={order.id}
                className="card-surface overflow-hidden"
              >
                <div
                  className="p-4 cursor-pointer flex items-center justify-between"
                  onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: STATUS_LABELS[order.status]?.color + "20" }}>
                      {order.isQuote ? <Tag className="w-5 h-5" style={{ color: STATUS_LABELS[order.status]?.color }} /> :
                       order.sampleRequested ? <FlaskConical className="w-5 h-5" style={{ color: STATUS_LABELS[order.status]?.color }} /> :
                       <ShoppingBag className="w-5 h-5" style={{ color: STATUS_LABELS[order.status]?.color }} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-display font-semibold text-white">{order.orderNumber}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: STATUS_LABELS[order.status]?.color + "20", color: STATUS_LABELS[order.status]?.color }}>
                          {STATUS_LABELS[order.status]?.label}
                        </span>
                        {order.priceTier && (
                          <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: PRICE_TIERS.find(t => t.key === order.priceTier)?.color + "20", color: PRICE_TIERS.find(t => t.key === order.priceTier)?.color }}>
                            {PRICE_TIERS.find(t => t.key === order.priceTier)?.label}
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-[#8A8B8C] truncate">
                        {customer?.name || customer?.company || "Unknown Customer"} · {order.items?.length || 0} items · R {(Number(order.total) || 0).toFixed(2)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {isExpanded ? <ChevronUp className="w-5 h-5 text-[#8A8B8C]" /> : <ChevronDown className="w-5 h-5 text-[#8A8B8C]" />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t p-4" style={{ borderColor: "#222324" }}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <h4 className="text-sm font-semibold text-white mb-2">Order Details</h4>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between"><span className="text-[#8A8B8C]">Customer:</span> <span className="text-white">{customer?.name || customer?.company || "N/A"}</span></div>
                          <div className="flex justify-between"><span className="text-[#8A8B8C]">Email:</span> <span className="text-white">{customer?.email || "N/A"}</span></div>
                          <div className="flex justify-between"><span className="text-[#8A8B8C]">Phone:</span> <span className="text-white">{customer?.phone || "N/A"}</span></div>
                          <div className="flex justify-between"><span className="text-[#8A8B8C]">Payment:</span> <span className="text-white">{order.paymentTerms === "cod" ? "Cash on Delivery" : order.paymentTerms === "7_days" ? "7 Days" : order.paymentTerms === "14_days" ? "14 Days" : order.paymentTerms === "30_days" ? "30 Days" : order.paymentTerms}</span></div>
                          <div className="flex justify-between"><span className="text-[#8A8B8C]">Delivery:</span> <span className="text-white">{order.deliveryMethod === "delivery" ? "Delivery" : "Collection"}</span></div>
                          {order.deliveryAddress && <div className="flex justify-between"><span className="text-[#8A8B8C]">Address:</span> <span className="text-white">{order.deliveryAddress}</span></div>}
                          {rep && <div className="flex justify-between"><span className="text-[#8A8B8C]">Sales Rep:</span> <span className="text-white">{rep.name}</span></div>}
                          <div className="flex justify-between"><span className="text-[#8A8B8C]">Date:</span> <span className="text-white">{new Date(order.createdAt).toLocaleDateString()}</span></div>
                        </div>
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-white mb-2">Items</h4>
                        <div className="space-y-2">
                          {order.items?.map((item: any, idx: number) => (
                            <div key={idx} className="flex justify-between text-sm">
                              <span className="text-[#E8E8E9]">{item.productName}</span>
                              <span className="text-[#8A8B8C]">{item.quantity} × R {Number(item.unitPrice).toFixed(2)}</span>
                            </div>
                          ))}
                          <div className="border-t pt-2 mt-2" style={{ borderColor: "#222324" }}>
                            <div className="flex justify-between text-sm font-semibold">
                              <span className="text-white">Total</span>
                              <span className="text-[#D4A843]">R {Number(order.total).toFixed(2)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {order.status === "draft" && (
                        <>
                          <button onClick={() => sendQuote.mutate({ id: order.id })} className="btn-secondary text-xs flex items-center gap-1.5">
                            <Mail className="w-3 h-3" /> Send Quote
                          </button>
                          <button onClick={() => { handleSendQuote(order); }} className="btn-secondary text-xs flex items-center gap-1.5">
                            <Printer className="w-3 h-3" /> Print Quote
                          </button>
                        </>
                      )}
                      {order.status === "sent" && (
                        <button onClick={() => convertQuoteToOrder.mutate({ id: order.id })} className="btn-primary text-xs flex items-center gap-1.5">
                          <CheckCircle className="w-3 h-3" /> Convert to Order
                        </button>
                      )}
                      {["pending", "picking", "ready"].includes(order.status) && (
                        <>
                          {canManageAll && (
                            <>
                              <button onClick={() => { handlePickingSlip(order); }} className="btn-secondary text-xs flex items-center gap-1.5">
                                <Printer className="w-3 h-3" /> Picking Slip
                              </button>
                              <GenerateInvoiceButton orderId={order.id} />
                            </>
                          )}
                          {order.status === "pending" && (
                            <button onClick={() => updateStatus.mutate({ id: order.id, status: "picking" })} className="btn-secondary text-xs flex items-center gap-1.5">
                              <Package className="w-3 h-3" /> Start Picking
                            </button>
                          )}
                          {order.status === "picking" && (
                            <button onClick={() => updateStatus.mutate({ id: order.id, status: "ready" })} className="btn-secondary text-xs flex items-center gap-1.5">
                              <CheckCircle className="w-3 h-3" /> Mark Ready
                            </button>
                          )}
                          {order.status === "ready" && (
                            <button onClick={() => updateStatus.mutate({ id: order.id, status: "delivered" })} className="btn-secondary text-xs flex items-center gap-1.5">
                              <Truck className="w-3 h-3" /> Mark Delivered
                            </button>
                          )}
                        </>
                      )}
                      {canManageAll && (
                        <>
                          <button onClick={() => startEditOrder(order)} className="btn-secondary text-xs flex items-center gap-1.5">
                            <Pencil className="w-3 h-3" /> Edit
                          </button>
                          {order.status !== "cancelled" && order.status !== "delivered" && (
                            <button onClick={() => { if (confirm("Cancel this order?")) cancelOrder.mutate({ id: order.id }); }} className="btn-secondary text-xs flex items-center gap-1.5" style={{ color: "#EF4444" }}>
                              <Ban className="w-3 h-3" /> Cancel
                            </button>
                          )}
                          <button onClick={() => { if (confirm("Delete this order permanently?")) deleteOrder.mutate({ id: order.id }); }} className="btn-secondary text-xs flex items-center gap-1.5" style={{ color: "#EF4444" }}>
                            <X className="w-3 h-3" /> Delete
                          </button>
                        </>
                      )}
                      {isSalesRep && order.status === "draft" && (
                        <button onClick={() => startEditOrder(order)} className="btn-secondary text-xs flex items-center gap-1.5">
                          <Pencil className="w-3 h-3" /> Edit
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.8)" }}>
          <div className="card-surface w-full max-w-4xl max-h-[90vh] overflow-y-auto m-4">
            <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: "#222324" }}>
              <h2 className="text-xl font-display font-bold text-white">{editingOrder ? "Edit Order" : "New Order"}</h2>
              <button onClick={() => { setShowForm(false); setEditingOrder(null); sampleOverrideRef.current = false; }} className="p-2 rounded-full hover:bg-[#222324]">
                <X className="w-5 h-5 text-[#8A8B8C]" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="relative" ref={customerDropdownRef}>
                  <label className="block text-sm font-medium text-[#E8E8E9] mb-1">Customer *</label>
                  <input
                    type="text"
                    value={customerSearch}
                    onChange={(e) => { setCustomerSearch(e.target.value); setCustomerDropdownOpen(true); }}
                    onFocus={() => setCustomerDropdownOpen(true)}
                    placeholder="Search customer..."
                    className="input-field w-full"
                    required
                  />
                  {customerDropdownOpen && (
                    <div className="absolute z-10 w-full mt-1 card-surface max-h-60 overflow-y-auto" style={{ borderColor: "#222324" }}>
                      {filteredCustomers.length === 0 && (
                        <div className="p-3 text-sm text-[#8A8B8C]">No customers found</div>
                      )}
                      {filteredCustomers.map((c: any) => (
                        <div
                          key={c.id}
                          className="p-3 cursor-pointer hover:bg-[#222324] border-b"
                          style={{ borderColor: "#18191A" }}
                          onClick={() => {
                            setFormData(prev => ({ ...prev, customerId: String(c.id) }));
                            setSelectedCustomerId(c.id);
                            setCustomerSearch(c.name || c.company || "");
                            setCustomerDropdownOpen(false);
                          }}
                        >
                          <div className="text-sm text-white">{c.name || c.company}</div>
                          <div className="text-xs text-[#8A8B8C]">{c.email} · {c.phone}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#E8E8E9] mb-1">Price Tier</label>
                  <div className="flex gap-2">
                    {PRICE_TIERS.map((tier) => (
                      <button
                        key={tier.key}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, priceTier: tier.key }))}
                        className={`px-3 py-2 rounded-lg text-sm font-medium flex-1 ${
                          formData.priceTier === tier.key
                            ? "text-[#0A0B0C]"
                            : "bg-[#18191A] text-[#8A8B8C] hover:bg-[#222324]"
                        }`}
                        style={formData.priceTier === tier.key ? { backgroundColor: tier.color } : {}}
                      >
                        {tier.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-[#E8E8E9]">Items</label>
                  <button type="button" onClick={addItem} className="text-sm text-[#D4A843] hover:underline">
                    + Add Item
                  </button>
                </div>
                {formData.items.map((item, index) => (
                  <div key={index} className="flex gap-2 items-end">
                    <div className="flex-1">
                      <div className="flex gap-2">
                        <div className="flex-[2]">
                          <button
                            type="button"
                            onClick={() => { setPickerTargetIndex(index); setProductPickerOpen(true); }}
                            className="input-field w-full text-left"
                          >
                            {item.productId ? getProductName(Number(item.productId)) : "Select Product..."}
                          </button>
                        </div>
                        <div className="w-24">
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => updateItem(index, "quantity", Number(e.target.value))}
                            className="input-field w-full"
                          />
                        </div>
                        <div className="w-28">
                          <input
                            type="number"
                            step="0.01"
                            value={item.unitPrice}
                            onChange={(e) => updateItem(index, "unitPrice", Number(e.target.value))}
                            className="input-field w-full"
                          />
                        </div>
                      </div>
                    </div>
                    {formData.items.length > 1 && (
                      <button type="button" onClick={() => removeItem(index)} className="p-2 text-[#EF4444] hover:bg-[#222324] rounded">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#E8E8E9] mb-1">Payment Terms</label>
                  <select
                    value={formData.paymentTerms}
                    onChange={(e) => setFormData(prev => ({ ...prev, paymentTerms: e.target.value }))}
                    className="input-field w-full"
                  >
                    <option value="cod">Cash on Delivery</option>
                    <option value="7_days">7 Days</option>
                    <option value="14_days">14 Days</option>
                    <option value="30_days">30 Days</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#E8E8E9] mb-1">Delivery Method</label>
                  <select
                    value={formData.deliveryMethod}
                    onChange={(e) => setFormData(prev => ({ ...prev, deliveryMethod: e.target.value }))}
                    className="input-field w-full"
                  >
                    <option value="delivery">Delivery</option>
                    <option value="collection">Collection</option>
                  </select>
                </div>
              </div>

              {formData.deliveryMethod === "delivery" && (
                <div>
                  <label className="block text-sm font-medium text-[#E8E8E9] mb-1">Delivery Address</label>
                  <input
                    type="text"
                    value={formData.deliveryAddress}
                    onChange={(e) => setFormData(prev => ({ ...prev, deliveryAddress: e.target.value }))}
                    className="input-field w-full"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-[#E8E8E9] mb-1">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  className="input-field w-full h-20"
                />
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isQuote}
                    onChange={(e) => setFormData(prev => ({ ...prev, isQuote: e.target.checked }))}
                    className="w-4 h-4 rounded border-[#8A8B8C]"
                  />
                  <span className="text-sm text-[#E8E8E9]">This is a Quote</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.sampleRequested}
                    onChange={(e) => setFormData(prev => ({ ...prev, sampleRequested: e.target.checked }))}
                    className="w-4 h-4 rounded border-[#8A8B8C]"
                  />
                  <span className="text-sm text-[#E8E8E9]">Sample Request</span>
                </label>
              </div>

              <div className="flex justify-between items-center pt-4 border-t" style={{ borderColor: "#222324" }}>
                <div className="text-lg font-display font-bold text-[#D4A843]">
                  Total: R {subtotal.toFixed(2)}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setShowForm(false); setEditingOrder(null); sampleOverrideRef.current = false; }}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createOrder.isLoading || updateOrder.isLoading}
                    className="btn-primary"
                  >
                    {createOrder.isLoading || updateOrder.isLoading ? "Saving..." : editingOrder ? "Update Order" : "Place Order"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {productPickerOpen && (
        <ProductPickerModal
          isOpen={productPickerOpen}
          onClose={() => setProductPickerOpen(false)}
          onSelect={(id) => {
            if (pickerTargetIndex !== null) {
              updateItem(pickerTargetIndex, "productId", String(id));
            }
          }}
          stockItems={allStock}
          availableStock={availableStock || {}}
          selectedId={pickerTargetIndex !== null ? Number(formData.items[pickerTargetIndex]?.productId) : 0}
        />
      )}
    </div>
  );
}
