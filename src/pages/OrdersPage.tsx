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
      await utils.order.list.invalidate();
      await utils.order.getStats.invalidate();
      await utils.stock.search.invalidate();
      await utils.stock.list.invalidate();
      await utils.stock.getStats.invalidate();
      await utils.sampleReport.getAll.invalidate();
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
      await utils.order.list.invalidate();
      await utils.order.getStats.invalidate();
      await utils.stock.search.invalidate();
      await utils.stock.list.invalidate();
      await utils.stock.getStats.invalidate();
      await utils.sampleReport.getAll.invalidate();
    },
    onError: (err: any) => {
      alert("Update failed: " + (err.message || "Unknown error"));
    },
    onSettled: () => {
      setShowForm(false); setEditingOrder(null); sampleOverrideRef.current = false;
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
      await utils.sampleReport.getAll.invalidate();
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
      await utils.sampleReport.getAll.invalidate();
    },
  });
  const sendQuote = trpc.order.sendQuote.useMutation({
    onSuccess: async () => {
      reloadFromStorage();
      await utils.order.list.invalidate();
      await utils.order.getStats.invalidate();
    },
  });

  const handlePrint = (order: any) => {
    const customer = (customers || []).find((c: any) => c.id === order.customerId);
    const invoice = (invoices || []).find((i: any) => i.orderId === order.id);

    // Get logo from localStorage or use default
    const logoDataUrl = localStorage.getItem("sgf_logo");
    const logoHtml = logoDataUrl
      ? `<img src="${logoDataUrl}" style="max-height:90px;max-width:220px;object-fit:contain;" />`
      : `<div style="font-size:28px;font-weight:bold;color:#D4A843;">SUPREME GLOBAL FOODS</div>`;

    const orderItems = (order.items || [])
      .map((it: any) => {
        const product = (stockItems || []).find((s: any) => s.id === it.stockItemId);
        return `<tr>
          <td style="padding:8px;border:1px solid #ddd;">${product?.productName || it.productName || "Unknown"}</td>
          <td style="padding:8px;border:1px solid #ddd;text-align:center;">${it.quantity}</td>
          <td style="padding:8px;border:1px solid #ddd;text-align:right;">R ${(it.unitPrice || 0).toFixed(2)}</td>
          <td style="padding:8px;border:1px solid #ddd;text-align:right;">R ${((it.unitPrice || 0) * it.quantity).toFixed(2)}</td>
        </tr>`;
      })
      .join("");

    const subtotal = (order.items || []).reduce((sum: number, it: any) => sum + (it.unitPrice || 0) * it.quantity, 0);
    const vat = subtotal * 0.15;
    const total = subtotal + vat;

    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html><head><title>Order #${order.orderNumber}</title></head>
      <body style="font-family:Arial,sans-serif;padding:40px;max-width:800px;margin:0 auto;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:30px;">
          <div>${logoHtml}</div>
          <div style="text-align:right;">
            <div style="font-size:22px;font-weight:bold;">ORDER</div>
            <div style="color:#666;">${order.orderNumber}</div>
            <div style="color:#666;font-size:12px;margin-top:4px;">${new Date(order.createdAt).toLocaleDateString()}</div>
          </div>
        </div>
        <div style="margin-bottom:20px;">
          <strong>Customer:</strong> ${customer?.name || order.customerName || "Unknown"}<br/>
          <strong>Delivery:</strong> ${order.deliveryAddress || customer?.deliveryAddress || "N/A"}<br/>
          <strong>Payment Terms:</strong> ${order.paymentTerms || "N/A"}
        </div>
        <table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:14px;">
          <thead><tr style="background:#f5f5f5;"><th style="padding:8px;border:1px solid #ddd;text-align:left;">Product</th><th style="padding:8px;border:1px solid #ddd;">Qty</th><th style="padding:8px;border:1px solid #ddd;text-align:right;">Unit Price</th><th style="padding:8px;border:1px solid #ddd;text-align:right;">Total</th></tr></thead>
          <tbody>${orderItems}</tbody>
        </table>
        <div style="text-align:right;margin-bottom:6px;"><strong>Subtotal:</strong> R ${subtotal.toFixed(2)}</div>
        <div style="text-align:right;margin-bottom:6px;"><strong>VAT (15%):</strong> R ${vat.toFixed(2)}</div>
        <div style="text-align:right;font-size:18px;font-weight:bold;"><strong>Total:</strong> R ${total.toFixed(2)}</div>
        ${invoice ? `<div style="margin-top:20px;padding:10px;background:#f9f9f9;border-left:4px solid #D4A843;"><strong>Invoice:</strong> ${invoice.invoiceNumber} | Status: ${invoice.status}</div>` : ""}
        <div style="margin-top:30px;padding-top:20px;border-top:2px solid #eee;text-align:center;color:#999;font-size:12px;">
          ${staticData.companyInfo.name} | ${staticData.companyInfo.phone} | ${staticData.companyInfo.email}
        </div>
      </body></html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  };

  const handlePrintPickingList = (order: any) => {
    const win = window.open("", "_blank");
    if (!win) return;

    const items = (order.items || [])
      .map((it: any, idx: number) => {
        const product = (stockItems || []).find((s: any) => s.id === it.stockItemId);
        return `
          <tr>
            <td style="padding:10px;border:1px solid #333;text-align:center;">${idx + 1}</td>
            <td style="padding:10px;border:1px solid #333;">${product?.productCode || "N/A"}</td>
            <td style="padding:10px;border:1px solid #333;">${product?.productName || it.productName || "Unknown"}</td>
            <td style="padding:10px;border:1px solid #333;text-align:center;font-weight:bold;font-size:16px;">${it.quantity}</td>
            <td style="padding:10px;border:1px solid #333;text-align:center;"><div style="width:24px;height:24px;border:2px solid #333;margin:0 auto;"></div></td>
          </tr>
        `;
      })
      .join("");

    win.document.write(`
      <html><head><title>Picking List - ${order.orderNumber}</title></head>
      <body style="font-family:Arial,sans-serif;padding:20px;">
        <div style="text-align:center;margin-bottom:20px;">
          <div style="font-size:24px;font-weight:bold;">PICKING LIST</div>
          <div style="font-size:18px;color:#666;margin-top:5px;">${order.orderNumber}</div>
        </div>
        <div style="margin-bottom:15px;font-size:14px;">
          <strong>Route:</strong> ${order.route || "N/A"}<br/>
          <strong>Delivery:</strong> ${order.deliveryAddress || "N/A"}
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <thead>
            <tr style="background:#f5f5f5;">
              <th style="padding:10px;border:1px solid #333;width:50px;">#</th>
              <th style="padding:10px;border:1px solid #333;width:120px;">Code</th>
              <th style="padding:10px;border:1px solid #333;">Product</th>
              <th style="padding:10px;border:1px solid #333;width:80px;">Qty</th>
              <th style="padding:10px;border:1px solid #333;width:60px;">✓</th>
            </tr>
          </thead>
          <tbody>${items}</tbody>
        </table>
      </body></html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  };

  const handlePrintDeliveryNote = (order: any) => {
    const customer = (customers || []).find((c: any) => c.id === order.customerId);
    const invoice = (invoices || []).find((i: any) => i.orderId === order.id);
    const logoDataUrl = localStorage.getItem("sgf_logo");
    const logoHtml = logoDataUrl
      ? `<img src="${logoDataUrl}" style="max-height:70px;max-width:180px;object-fit:contain;" />`
      : `<div style="font-size:20px;font-weight:bold;color:#D4A843;">SUPREME GLOBAL FOODS</div>`;

    const items = (order.items || [])
      .map((it: any) => {
        const product = (stockItems || []).find((s: any) => s.id === it.stockItemId);
        return `
          <tr>
            <td style="padding:8px;border:1px solid #ddd;">${product?.productName || it.productName || "Unknown"}</td>
            <td style="padding:8px;border:1px solid #ddd;text-align:center;">${it.quantity}</td>
          </tr>
        `;
      })
      .join("");

    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html><head><title>Delivery Note - ${order.orderNumber}</title></head>
      <body style="font-family:Arial,sans-serif;padding:30px;max-width:700px;margin:0 auto;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;">
          <div>${logoHtml}</div>
          <div style="text-align:right;">
            <div style="font-size:18px;font-weight:bold;">DELIVERY NOTE</div>
            <div style="color:#666;">${order.orderNumber}</div>
          </div>
        </div>
        <div style="margin-bottom:15px;font-size:14px;">
          <strong>Customer:</strong> ${customer?.name || order.customerName || "Unknown"}<br/>
          <strong>Address:</strong> ${order.deliveryAddress || customer?.deliveryAddress || "N/A"}
        </div>
        <table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:14px;">
          <thead><tr style="background:#f5f5f5;"><th style="padding:8px;border:1px solid #ddd;text-align:left;">Product</th><th style="padding:8px;border:1px solid #ddd;width:80px;">Qty</th></tr></thead>
          <tbody>${items}</tbody>
        </table>
        <div style="margin-top:30px;display:flex;justify-content:space-between;font-size:13px;">
          <div><strong>Delivered By:</strong> _________________</div>
          <div><strong>Date:</strong> _________________</div>
          <div><strong>Customer Signature:</strong> _________________</div>
        </div>
      </body></html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  };

  // ---- email helpers ----
  const getEmailSubject = (order: any, type: "quote" | "invoice" | "statement") => {
    switch (type) {
      case "quote": return `Quote ${order.orderNumber} — ${staticData.companyInfo.name}`;
      case "invoice": return `Invoice for Order ${order.orderNumber}`;
      case "statement": return `Statement — ${staticData.companyInfo.name}`;
      default: return `Order ${order.orderNumber}`;
    }
  };

  const getEmailBody = (order: any, type: "quote" | "invoice" | "statement") => {
    const customer = (customers || []).find((c: any) => c.id === order.customerId);
    const cName = customer?.name || order.customerName || "Valued Customer";
    const itemsList = (order.items || [])
      .map((it: any) => {
        const product = (stockItems || []).find((s: any) => s.id === it.stockItemId);
        return `• ${product?.productName || it.productName || "Unknown"} × ${it.quantity} @ R${(it.unitPrice || 0).toFixed(2)} = R${((it.unitPrice || 0) * it.quantity).toFixed(2)}`;
      })
      .join("%0D%0A");
    const subtotal = (order.items || []).reduce((sum: number, it: any) => sum + (it.unitPrice || 0) * it.quantity, 0);
    const total = subtotal * 1.15;

    switch (type) {
      case "quote":
        return `Dear ${cName},%0D%0A%0D%0AThank you for your interest. Please find your quote below:%0D%0A%0D%0AQuote: ${order.orderNumber}%0D%0A${itemsList}%0D%0A%0D%0ASubtotal: R${subtotal.toFixed(2)}%0D%0AVAT (15%): R${(subtotal * 0.15).toFixed(2)}%0D%0ATotal: R${total.toFixed(2)}%0D%0A%0D%0APlease reply to accept this quote.%0D%0A%0D%0ABest regards,%0D%0A${staticData.companyInfo.name}`;
      case "invoice":
        return `Dear ${cName},%0D%0A%0D%0APlease find your invoice details for order ${order.orderNumber}:%0D%0A%0D%0A${itemsList}%0D%0A%0D%0ATotal: R${total.toFixed(2)}%0D%0A%0D%0APayment terms: ${order.paymentTerms || "N/A"}%0D%0A%0D%0ABanking Details:%0D%0A${banking?.bankName || "N/A"}%0D%0AAccount: ${banking?.accountNumber || "N/A"}%0D%0ABranch: ${banking?.branchCode || "N/A"}%0D%0A%0D%0ABest regards,%0D%0A${staticData.companyInfo.name}`;
      case "statement":
        return `Dear ${cName},%0D%0A%0D%0APlease find your statement attached.%0D%0A%0D%0ABest regards,%0D%0A${staticData.companyInfo.name}`;
      default:
        return "";
    }
  };
  // ---- /email helpers ----

  // ---------- helpers for OrderForm ----------
  const resetForm = () => {
    setFormData({
      customerId: 0, orderType: "regular",
      paymentTerms: "cod", priceTier: "wholesale",
      deliveryAddress: "", notes: "", items: [],
    });
    setCustomerSearch("");
    setAdminOverride(false);
    setAdminPin("");
  };

  const handleAddItem = () => {
    setFormData({ ...formData, items: [...formData.items, { stockItemId: 0, quantity: 1 }] });
  };

  const handleUpdateItem = (index: number, field: string, value: any) => {
    const updated = [...formData.items];
    updated[index] = { ...updated[index], [field]: value };

    // Auto-populate unitPrice from tier if not already set
    if (field === "stockItemId" || field === "unit") {
      const product = (stockItems || []).find((s: any) => s.id === (field === "stockItemId" ? value : updated[index].stockItemId));
      if (product && !updated[index].unitPrice) {
        const conversion = updated[index].conversion || 1;
        const tierPrice = (() => {
          switch (formData.priceTier) {
            case "corporate": return Number(product.corporatePrice || 0);
            case "bulk": return Number(product.bulkPrice || 0);
            case "wholesale": return Number(product.wholesalePrice || 0);
            case "retail": return Number(product.retailPrice || 0);
            default: return Number(product.wholesalePrice || 0);
          }
        })();
        // Check for special price
        const special = (customerSpecialPrices || []).find((sp: any) => String(sp.stockItemId) === String(product.id));
        if (special) {
          updated[index].unitPrice = Number(special.price || 0) * conversion;
        } else {
          updated[index].unitPrice = tierPrice * conversion;
        }
      }
      // Set default unit/conversion if not set
      if (field === "stockItemId" && product?.sellingUnits?.length > 0 && !updated[index].unit) {
        updated[index].unit = product.sellingUnits[0].unit;
        updated[index].conversion = product.sellingUnits[0].conversion;
        updated[index].unitLabel = product.sellingUnits[0].label;
      }
    }

    setFormData({ ...formData, items: updated });
  };

  const handleRemoveItem = (index: number) => {
    setFormData({ ...formData, items: formData.items.filter((_, i) => i !== index) });
  };

  const getTierPrice = (stockItemId: number) => {
    const product = (stockItems || []).find((s: any) => s.id === stockItemId);
    if (!product) return 0;
    switch (formData.priceTier) {
      case "corporate": return Number(product.corporatePrice || 0);
      case "bulk": return Number(product.bulkPrice || 0);
      case "wholesale": return Number(product.wholesalePrice || 0);
      case "retail": return Number(product.retailPrice || 0);
      default: return Number(product.wholesalePrice || 0);
    }
  };

  const getEffectivePrice = (stockItemId: number, customPrice?: number) => {
    if (customPrice && customPrice > 0) return customPrice;
    const special = (customerSpecialPrices || []).find((sp: any) => String(sp.stockItemId) === String(stockItemId));
    if (special) return Number(special.price || 0);
    return getTierPrice(stockItemId);
  };

  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return customers || [];
    const q = customerSearch.toLowerCase();
    return (customers || []).filter((c: any) =>
      c.name?.toLowerCase().includes(q) ||
      c.contactPerson?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.phone?.includes(q)
    );
  }, [customers, customerSearch]);

  const selectedCustomer = (customers || []).find((c: any) => c.id === formData.customerId);

  // Calculate available stock = current SOH minus qty committed by in-progress orders
  const availableStock = useMemo(() => {
    const avail: Record<number, number> = {};
    for (const s of stockItems || []) {
      avail[s.id] = Number(s.quantity || 0);
    }
    for (const o of orders || []) {
      if (["pending", "picking", "ready", "sample_delivered"].includes(o.status)) {
        for (const it of o.items || []) {
          const sid = Number(it.stockItemId);
          if (avail[sid] !== undefined) {
            avail[sid] -= Number(it.quantity || 0);
          }
        }
      }
    }
    return avail;
  }, [stockItems, orders]);

  // Map of product ID → in-progress order references
  const productOrderStatuses = useMemo(() => {
    const map: Record<number, { orderNumber: string; qty: number; status: string }[]> = {};
    for (const o of orders || []) {
      if (["pending", "picking", "ready"].includes(o.status)) {
        for (const it of o.items || []) {
          const sid = Number(it.stockItemId);
          if (!map[sid]) map[sid] = [];
          map[sid].push({ orderNumber: o.orderNumber, qty: it.quantity, status: o.status });
        }
      }
    }
    return map;
  }, [orders]);

  // Stock validation
  const orderCheck = useMemo(() => {
    if (formData.items.length === 0) return { valid: false, error: "Add at least one item" };
    if (!formData.customerId) return { valid: false, error: "Select a customer" };
    // For sample orders: always valid quantity-wise
    if (formData.orderType === "sample") return { valid: true, error: "" };
    // Check stock
    for (const item of formData.items) {
      const stockId = Number(item.stockItemId);
      const qty = Number(item.quantity || 0);
      const conversion = Number(item.conversion || 1);
      const sohNeeded = qty * conversion;
      const avail = availableStock[stockId] || 0;
      // Allow admin edit without stock check
      if (editingOrder && isAdmin) continue;
      if (avail < sohNeeded) {
        const product = (stockItems || []).find((s: any) => s.id === stockId);
        return {
          valid: false,
          error: `Insufficient stock for "${product?.productName || "Unknown"}" (need ${sohNeeded} kg, have ${avail} kg)`,
        };
      }
    }
    // Check admin PIN for below-corporate pricing
    if (formData.orderType !== "sample" && formData.orderType !== "quote" && isAdmin) {
      const validItems = formData.items.filter((i) => Number(i.stockItemId) > 0 && Number(i.quantity) > 0);
      let hasBelowCorporate = false;
      for (const item of validItems) {
        if (item.unitPrice && item.unitPrice > 0) {
          const stock = (stockItems || []).find((s) => Number(s.id) === Number(item.stockItemId));
          if (stock) {
            const conversion = item.conversion || 1;
            const corporateFloor = Number(stock.corporatePrice || 0) * conversion;
            if (corporateFloor > 0 && item.unitPrice < corporateFloor * 0.99) {
              hasBelowCorporate = true;
              break;
            }
          }
        }
      }
      if (hasBelowCorporate && (!adminOverride || !adminPin)) {
        return { valid: false, error: "Admin approval required for below-corporate pricing. Check the approval box and enter your PIN." };
      }
    }
    return { valid: true, error: "" };
  }, [formData, availableStock, stockItems, editingOrder, isAdmin, adminOverride, adminPin]);

  // ---------- /helpers ----------

  // Status update handlers
  const handleStatusUpdate = (orderId: number, newStatus: string) => {
    updateStatus.mutate({ id: orderId, status: newStatus });
  };

  const handleConvertQuote = (orderId: number) => {
    if (!confirm("Convert this quote to an order?")) return;
    convertQuoteToOrder.mutate({ id: orderId });
  };

  const handleDeleteOrder = (orderId: number) => {
    if (!confirm("Delete this order permanently?")) return;
    deleteOrder.mutate({ id: orderId });
  };

  const handleCancelOrder = (orderId: number) => {
    if (!confirm("Cancel this order? Stock will be released.")) return;
    cancelOrder.mutate({ id: orderId });
  };

  const handleSendQuote = (orderId: number) => {
    if (!confirm("Send this quote to the customer via email?")) return;
    sendQuote.mutate({ id: orderId });
  };

  // Rep filter — sales reps only see their own customers' orders
  const repFilteredOrders = useMemo(() => {
    if (!orders) return [];
    if (isAdmin || isSuperAdmin) return orders;
    // Sales rep: only show orders for customers assigned to them
    const myCustomers = new Set(
      (customers || [])
        .filter((c: any) =>
          c.salesRepName === myRepName ||
          c.salesRepEmail === user?.email
        )
        .map((c: any) => c.id)
    );
    return orders.filter((o: any) => myCustomers.has(o.customerId));
  }, [orders, customers, isAdmin, isSuperAdmin, isSalesRep, myRepName, user?.email]);

  // Tab filter
  const tabFilteredOrders = useMemo(() => {
    let list = repFilteredOrders || [];
    if (activeTab === "sample") {
      list = list.filter((o: any) => o.orderType === "sample");
    } else if (activeTab === "quotes") {
      list = list.filter((o: any) => o.orderType === "quote");
    } else if (activeTab !== "all") {
      list = list.filter((o: any) => o.status === activeTab);
    }
    return list;
  }, [repFilteredOrders, activeTab]);

  // Search filter
  const filteredOrders = useMemo(() => {
    if (!orderSearch.trim()) return tabFilteredOrders;
    const q = orderSearch.toLowerCase();
    return tabFilteredOrders.filter((o: any) => {
      const customer = (customers || []).find((c: any) => c.id === o.customerId);
      return (
        o.orderNumber?.toLowerCase().includes(q) ||
        customer?.name?.toLowerCase().includes(q) ||
        customer?.contactPerson?.toLowerCase().includes(q) ||
        o.deliveryAddress?.toLowerCase().includes(q) ||
        o.notes?.toLowerCase().includes(q)
      );
    });
  }, [tabFilteredOrders, orderSearch, customers]);

  const totalOrderValue = (order: any) =>
    (order.items || []).reduce((sum: number, it: any) => sum + (it.unitPrice || 0) * it.quantity, 0);

  const totalOrderItems = (order: any) =>
    (order.items || []).reduce((sum: number, it: any) => sum + it.quantity, 0);

  // Start edit
  const startEditOrder = (order: any) => {
    sampleOverrideRef.current = true; // MUST set before setEditingOrder
    setEditingOrder(order);
    setFormData({
      customerId: order.customerId || 0,
      orderType: order.orderType || "regular",
      paymentTerms: order.paymentTerms || "cod",
      priceTier: order.priceTier || "wholesale",
      deliveryAddress: order.deliveryAddress || "",
      notes: order.notes || "",
      items: (order.items || []).map((it: any) => ({
        stockItemId: it.stockItemId,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        unit: it.unit,
        conversion: it.conversion,
        unitLabel: it.unitLabel,
      })),
    });
    const customer = (customers || []).find((c: any) => c.id === order.customerId);
    setCustomerSearch(customer?.name || "");
    setShowForm(true);
  };

  // Submit handler
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderCheck.valid) return;

    // Validate admin PIN for below-corporate pricing
    if (formData.orderType !== "sample" && formData.orderType !== "quote" && isAdmin) {
      const validItems = formData.items.filter((i) => Number(i.stockItemId) > 0 && Number(i.quantity) > 0);
      let hasBelowCorporate = false;
      for (const item of validItems) {
        if (item.unitPrice && item.unitPrice > 0) {
          const stock = (stockItems || []).find((s) => Number(s.id) === Number(item.stockItemId));
          if (stock) {
            const conversion = item.conversion || 1;
            const corporateFloor = Number(stock.corporatePrice || 0) * conversion;
            if (corporateFloor > 0 && item.unitPrice < corporateFloor * 0.99) {
              hasBelowCorporate = true;
              break;
            }
          }
        }
      }
      if (hasBelowCorporate) {
        if (!adminOverride || !adminPin) {
          alert("Admin approval required. Please check the approval box and enter your PIN.");
          return;
        }
        // Simple PIN check — replace with your actual PIN logic
        const validPins = ["123456", "000000", "111111"];
        if (!validPins.includes(adminPin)) {
          alert("Invalid PIN. Please try again.");
          return;
        }
      }
    }

    if (editingOrder) {
      updateOrder.mutate({ id: editingOrder.id, ...formData });
    } else {
      createOrder.mutate(formData);
    }
  };

  const formatDate = (d: string) => {
    try { return new Date(d).toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" }); }
    catch { return d; }
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold text-white">Orders</h1>
          <p className="text-sm text-[#8A8B8C] font-body">{orders?.length || 0} total orders</p>
        </div>
        <button onClick={() => { setEditingOrder(null); sampleOverrideRef.current = false; resetForm(); setShowForm(true); }} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> New Order
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Pending", value: stats.byStatus?.pending || 0, color: "#F59E0B" },
            { label: "Picking", value: stats.byStatus?.picking || 0, color: "#6366F1" },
            { label: "Ready", value: stats.byStatus?.ready || 0, color: "#4ADE80" },
            { label: "Delivered", value: stats.byStatus?.delivered || 0, color: "#4ADE80" },
          ].map((s) => (
            <div key={s.label} className="card-surface p-3">
              <div className="text-2xl font-display font-bold" style={{ color: s.color }}>{s.value}</div>
              <div className="text-xs text-[#8A8B8C] font-body">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {statusTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer"
            style={{
              backgroundColor: activeTab === tab.key ? "rgba(212, 168, 67, 0.15)" : "#0A0A0B",
              color: activeTab === tab.key ? "#D4A843" : "#8A8B8C",
              border: activeTab === tab.key ? "1px solid rgba(212, 168, 67, 0.3)" : "1px solid #222324",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#8A8B8C]" />
        <input
          type="text"
          value={orderSearch}
          onChange={(e) => setOrderSearch(e.target.value)}
          placeholder="Search orders..."
          className="input-field w-full pl-10"
        />
      </div>

      {/* Orders List */}
      <div className="space-y-3">
        {filteredOrders.length === 0 && (
          <div className="card-surface p-8 text-center text-[#8A8B8C]">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No orders found</p>
          </div>
        )}
        {filteredOrders.map((order: any) => {
          const customer = (customers || []).find((c: any) => c.id === order.customerId);
          const isExpanded = expandedOrder === order.id;
          const hasInvoice = liveInvoiceOrderIds.has(order.id);

          return (
            <div
              key={order.id}
              className="card-surface overflow-hidden transition-all"
              style={{ borderColor: isExpanded ? "rgba(212, 168, 67, 0.3)" : "#222324" }}
            >
              {/* Order Header Row */}
              <div
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer"
                onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: STATUS_LABELS[order.status]?.color + "15" || "#222324" }}
                  >
                    {order.orderType === "sample" ? (
                      <FlaskConical className="w-5 h-5" style={{ color: STATUS_LABELS[order.status]?.color || "#D4A843" }} />
                    ) : order.orderType === "quote" ? (
                      <FileText className="w-5 h-5" style={{ color: STATUS_LABELS[order.status]?.color || "#6366F1" }} />
                    ) : (
                      <ShoppingBag className="w-5 h-5" style={{ color: STATUS_LABELS[order.status]?.color || "#D4A843" }} />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-display font-semibold text-white">{order.orderNumber}</span>
                      <span
                        className="px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{
                          backgroundColor: (STATUS_LABELS[order.status]?.color || "#8A8B8C") + "15",
                          color: STATUS_LABELS[order.status]?.color || "#8A8B8C",
                        }}
                      >
                        {STATUS_LABELS[order.status]?.label || order.status}
                      </span>
                      {order.orderType === "sample" && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: "rgba(212, 168, 67, 0.12)", color: "#D4A843" }}>
                          Sample
                        </span>
                      )}
                      {order.orderType === "quote" && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: "rgba(99, 102, 241, 0.12)", color: "#6366F1" }}>
                          Quote
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-[#8A8B8C] font-body">
                      {customer?.name || order.customerName || "Unknown"} · {formatDate(order.createdAt)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="font-display font-semibold text-white">
                      R {totalOrderValue(order).toFixed(2)}
                    </div>
                    <div className="text-xs text-[#8A8B8C]">
                      {totalOrderItems(order)} items
                    </div>
                  </div>
                  {isExpanded ? <ChevronUp className="w-5 h-5 text-[#8A8B8C]" /> : <ChevronDown className="w-5 h-5 text-[#8A8B8C]" />}
                </div>
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="border-t px-4 py-4 space-y-4" style={{ borderColor: "#222324" }}>
                  {/* Order Info */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                    <div>
                      <span className="text-[#8A8B8C]">Customer:</span>
                      <div className="text-white font-medium">{customer?.name || order.customerName || "Unknown"}</div>
                      {customer?.contactPerson && <div className="text-xs text-[#8A8B8C]">{customer.contactPerson}</div>}
                    </div>
                    <div>
                      <span className="text-[#8A8B8C]">Delivery:</span>
                      <div className="text-white">{order.deliveryAddress || customer?.deliveryAddress || "N/A"}</div>
                    </div>
                    <div>
                      <span className="text-[#8A8B8C]">Payment Terms:</span>
                      <div className="text-white">{order.paymentTerms || "N/A"}</div>
                    </div>
                    <div>
                      <span className="text-[#8A8B8C]">Price Tier:</span>
                      <div className="text-white capitalize">{order.priceTier || "N/A"}</div>
                    </div>
                    <div>
                      <span className="text-[#8A8B8C]">Route:</span>
                      <div className="text-white">{order.route || "N/A"}</div>
                    </div>
                    {order.notes && (
                      <div className="sm:col-span-2 md:col-span-3">
                        <span className="text-[#8A8B8C]">Notes:</span>
                        <div className="text-white text-xs mt-1 p-2 rounded" style={{ backgroundColor: "#0A0A0B" }}>{order.notes}</div>
                      </div>
                    )}
                  </div>

                  {/* Items */}
                  <div>
                    <h4 className="text-sm font-medium text-[#8A8B8C] mb-2">Items</h4>
                    <div className="space-y-2">
                      {(order.items || []).map((it: any, idx: number) => {
                        const product = (stockItems || []).find((s: any) => s.id === it.stockItemId);
                        return (
                          <div key={idx} className="flex items-center justify-between p-2 rounded" style={{ backgroundColor: "#0A0A0B" }}>
                            <div className="flex items-center gap-2">
                              <Package className="w-4 h-4 text-[#8A8B8C]" />
                              <span className="text-sm text-white">{product?.productName || it.productName || "Unknown"}</span>
                              <span className="text-xs text-[#8A8B8C]">× {it.quantity}</span>
                              {it.unit && it.unit !== "each" && <span className="text-xs text-[#8A8B8C]">({it.unit})</span>}
                            </div>
                            <span className="text-sm font-display text-white">R {((it.unitPrice || 0) * it.quantity).toFixed(2)}</span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex justify-between items-center mt-3 pt-3 border-t" style={{ borderColor: "#222324" }}>
                      <span className="text-sm text-[#8A8B8C]">Subtotal</span>
                      <span className="font-display text-white">R {totalOrderValue(order).toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Invoice Status */}
                  {!hasInvoice && order.status !== "cancelled" && order.orderType !== "quote" && (
                    <div className="p-2 rounded text-xs flex items-center gap-2" style={{ backgroundColor: "rgba(239, 68, 68, 0.08)", color: "#EF4444" }}>
                      <AlertTriangle className="w-3 h-3" /> No invoice generated
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-2">
                    {/* Generate Invoice — admin only, regular orders only */}
                    {(isAdmin || isSuperAdmin) && order.orderType !== "quote" && order.status !== "cancelled" && (
                      <GenerateInvoiceButton orderId={order.id} />
                    )}

                    {order.orderType === "quote" && order.status !== "converted" && (
                      <button onClick={() => handleConvertQuote(order.id)} className="btn-secondary text-xs flex items-center gap-1.5">
                        <CheckCircle className="w-3 h-3" /> Convert to Order
                      </button>
                    )}

                    {/* Status flow buttons */}
                    {order.status === "pending" && (
                      <button onClick={() => handleStatusUpdate(order.id, "picking")} className="btn-secondary text-xs flex items-center gap-1.5" style={{ borderColor: "rgba(99, 102, 241, 0.3)", color: "#6366F1" }}>
                        <Package className="w-3 h-3" /> Start Picking
                      </button>
                    )}
                    {order.status === "picking" && (
                      <button onClick={() => handleStatusUpdate(order.id, "ready")} className="btn-secondary text-xs flex items-center gap-1.5" style={{ borderColor: "rgba(74, 222, 128, 0.3)", color: "#4ADE80" }}>
                        <CheckCircle className="w-3 h-3" /> Mark Ready
                      </button>
                    )}
                    {order.status === "ready" && (
                      <button onClick={() => handleStatusUpdate(order.id, "delivered")} className="btn-secondary text-xs flex items-center gap-1.5" style={{ borderColor: "rgba(74, 222, 128, 0.3)", color: "#4ADE80" }}>
                        <Truck className="w-3 h-3" /> Mark Delivered
                      </button>
                    )}

                    {/* Print buttons */}
                    <button onClick={() => handlePrint(order)} className="btn-secondary text-xs flex items-center gap-1.5">
                      <Printer className="w-3 h-3" /> Print
                    </button>
                    {order.status === "picking" && (
                      <button onClick={() => handlePrintPickingList(order)} className="btn-secondary text-xs flex items-center gap-1.5">
                        <Package className="w-3 h-3" /> Picking List
                      </button>
                    )}
                    {order.status === "ready" && (
                      <button onClick={() => handlePrintDeliveryNote(order)} className="btn-secondary text-xs flex items-center gap-1.5">
                        <Truck className="w-3 h-3" /> Delivery Note
                      </button>
                    )}

                    {/* Email buttons */}
                    <a
                      href={`mailto:${customer?.email || ""}?subject=${encodeURIComponent(getEmailSubject(order, "invoice"))}&body=${encodeURIComponent(getEmailBody(order, "invoice"))}`}
                      className="btn-secondary text-xs flex items-center gap-1.5"
                    >
                      <Mail className="w-3 h-3" /> Email Invoice
                    </a>

                    {/* Edit / Cancel / Delete */}
                    {(isAdmin || isSuperAdmin) && (
                      <button onClick={() => startEditOrder(order)} className="btn-secondary text-xs flex items-center gap-1.5" style={{ borderColor: "rgba(212, 168, 67, 0.3)", color: "#D4A843" }}>
                        <Pencil className="w-3 h-3" /> Edit
                      </button>
                    )}
                    {order.status !== "cancelled" && order.status !== "delivered" && (
                      <button onClick={() => handleCancelOrder(order.id)} className="btn-secondary text-xs flex items-center gap-1.5" style={{ borderColor: "rgba(239, 68, 68, 0.3)", color: "#EF4444" }}>
                        <Ban className="w-3 h-3" /> Cancel
                      </button>
                    )}
                    {(isAdmin || isSuperAdmin) && (
                      <button onClick={() => handleDeleteOrder(order.id)} className="btn-secondary text-xs flex items-center gap-1.5 hover:bg-[#EF444422]" style={{ borderColor: "rgba(239, 68, 68, 0.3)", color: "#EF4444" }}>
                        <X className="w-3 h-3" /> Delete
                      </button>
                    )}

                    {/* Send Quote button */}
                    {order.orderType === "quote" && order.status === "draft" && (
                      <button onClick={() => handleSendQuote(order.id)} className="btn-secondary text-xs flex items-center gap-1.5" style={{ borderColor: "rgba(99, 102, 241, 0.3)", color: "#6366F1" }}>
                        <Mail className="w-3 h-3" /> Send Quote
                      </button>
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
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.8)" }} onClick={() => setShowForm(false)}>
          <div
            className="card-surface w-full sm:max-w-2xl sm:mx-4 max-h-[90vh] overflow-y-auto"
            style={{ borderRadius: "16px 16px 0 0" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b" style={{ backgroundColor: "#18191A", borderColor: "#222324" }}>
              <h2 className="text-lg font-display font-semibold text-white">
                {editingOrder ? "Edit Order" : "New Order"}
              </h2>
              <button onClick={() => setShowForm(false)} className="p-2 rounded-full hover:bg-[#222324] cursor-pointer">
                <X className="w-5 h-5 text-[#8A8B8C]" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              {/* Order Type */}
              <div>
                <label className="label-text block mb-2">Order Type *</label>
                <div className="flex gap-3">
                  {[
                    { key: "regular", label: "Regular", icon: ShoppingBag },
                    { key: "sample", label: "Sample", icon: FlaskConical },
                    { key: "quote", label: "Quote", icon: FileText },
                  ].map((type) => (
                    <button
                      key={type.key}
                      type="button"
                      onClick={() => setFormData({ ...formData, orderType: type.key as any })}
                      className="flex-1 p-3 rounded-xl flex flex-col items-center gap-1 transition-all cursor-pointer"
                      style={{
                        backgroundColor: formData.orderType === type.key ? "rgba(212, 168, 67, 0.12)" : "#0A0A0B",
                        border: formData.orderType === type.key ? "2px solid #D4A843" : "2px solid #222324",
                      }}
                    >
                      <type.icon className="w-5 h-5" style={{ color: formData.orderType === type.key ? "#D4A843" : "#8A8B8C" }} />
                      <span className="text-sm font-medium" style={{ color: formData.orderType === type.key ? "#D4A843" : "#8A8B8C" }}>{type.label}</span>
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
                  placeholder="Search customers..."
                  className="input-field w-full"
                  autoComplete="off"
                />
                {showCustomerDropdown && filteredCustomers.length > 0 && (
                  <div className="absolute z-20 w-full mt-1 max-h-48 overflow-y-auto card-surface" style={{ border: "1px solid #222324" }}>
                    {filteredCustomers.map((c: any) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setFormData({ ...formData, customerId: c.id });
                          setCustomerSearch(c.name || "");
                          setShowCustomerDropdown(false);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-[#222324] text-sm text-white cursor-pointer"
                      >
                        <div className="font-medium">{c.name}</div>
                        <div className="text-xs text-[#8A8B8C]">{c.contactPerson} · {c.email}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Payment Terms */}
              <div>
                <label className="label-text block mb-1.5">Payment Terms</label>
                <select
                  value={formData.paymentTerms}
                  onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value as any })}
                  className="input-field w-full"
                >
                  <option value="cod">Cash on Delivery</option>
                  <option value="7_days">7 Days</option>
                  <option value="14_days">14 Days</option>
                  <option value="30_days">30 Days</option>
                </select>
              </div>

              {/* Price Tier */}
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

              {/* Admin Override — below-corporate pricing detected */}
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
