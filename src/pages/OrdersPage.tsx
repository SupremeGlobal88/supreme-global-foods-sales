import { useState, useMemo, useRef, useEffect } from "react";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/providers/AuthProvider";
import { useRole } from "@/hooks/useRole";
import { ChevronDown, Search, X, Pencil, Printer, Plus, Trash2, AlertTriangle, Package, Truck, CheckCircle, Clock, FileText, Send, Shield } from "lucide-react";
import { InvoiceModal } from "@/components/InvoiceModal";
import { reloadFromStorage } from "@/utils/reloadFromStorage";
import { generateInvoiceForOrder } from "@/lib/dataService";
import { getBankingDetails, getCompanyConfig } from "@/lib/staticData";

// Safe number formatter for invoice amounts
function safeNum(val: any): string {
  const n = Number(val);
  if (Number.isFinite(n)) return n.toFixed(2);
  return "0.00";
}

// GenerateInvoiceButton — shared between orders and quotes
function GenerateInvoiceButton({ order, orderType = "order", onInvoiceGenerated }: any) {
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [invoiceData, setInvoiceData] = useState<any>(null);
  const [generating, setGenerating] = useState(false);
  const { data: customers = [] } = trpc.customer.list.useQuery();
  const { data: stockItems = [] } = trpc.stockItem.list.useQuery();

  async function handleGenerate() {
    if (!order || generating) return;
    setGenerating(true);
    try {
      const invoice = await generateInvoiceForOrder(order, customers, stockItems, { orderType });
      if (!invoice) { alert("Failed to generate invoice."); return; }
      const banking = getBankingDetails();
      const company = getCompanyConfig();
      const payload = { ...invoice, bankingDetails: banking, companyDetails: company };
      setInvoiceData(payload);
      setInvoiceOpen(true);
      if (onInvoiceGenerated) onInvoiceGenerated();
    } catch (e) {
      console.error("Invoice generation error:", e);
      alert("Invoice generation failed.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <>
      <button onClick={handleGenerate} disabled={generating} className="btn-secondary text-xs" style={{ borderColor: "rgba(212,168,67,0.3)" }}>
        <FileText className="w-3 h-3" /> {generating ? "Generating..." : "Invoice"}
      </button>
      {invoiceData && <InvoiceModal open={invoiceOpen} onOpenChange={setInvoiceOpen} invoiceData={invoiceData} />}
    </>
  );
}

function ProductPickerModal({ open, onClose, onSelect, stockItems, selectedId }: any) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return stockItems || [];
    return (stockItems || []).filter((s: any) => (s.productName || "").toLowerCase().includes(q) || String(s.sku || "").toLowerCase().includes(q));
  }, [query, stockItems]);
  return (
    open && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
        <div className="card max-w-lg w-full mx-4 max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between p-4 border-b border-[#333334]">
            <h3 className="text-lg font-semibold text-white">Select Product</h3>
            <button onClick={onClose} className="p-1 rounded hover:bg-[#333334]/50 text-[#8A8B8C]"><X className="w-5 h-5" /></button>
          </div>
          <div className="p-4 border-b border-[#333334]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8B8C]" />
              <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search products..." className="input-field pl-10 w-full" />
            </div>
          </div>
          <div className="overflow-y-auto p-2 space-y-1">
            {filtered.length === 0 && <div className="text-center text-sm text-[#8A8B8C] py-8">No products found.</div>}
            {filtered.map((item: any) => (
              <button key={item.id} onClick={() => { onSelect(item); setQuery(""); }} className={`w-full text-left p-3 rounded-lg transition-colors ${selectedId === item.id ? "bg-[#D4A843]/20 border border-[#D4A843]/30" : "hover:bg-[#333334]/50 border border-transparent"}`}>
                <div className="text-sm text-white font-medium">{item.productName}</div>
                <div className="text-xs text-[#8A8B8C] mt-1">SKU: {item.sku || "—"} | Stock: {Number(item.currentStock || 0).toFixed(2)} kg</div>
                <div className="text-xs text-[#8A8B8C] mt-0.5">Retail: R{(Number(item.retailPrice) || 0).toFixed(2)} | Wholesale: R{(Number(item.wholesalePrice) || 0).toFixed(2)} | Corporate: R{(Number(item.corporatePrice) || 0).toFixed(2)}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  );
}

const statusTabs = ["all", "pending", "processing", "out_for_delivery", "delivered", "cancelled"] as const;

export default function OrdersPage() {
  const { user } = useAuth();
  const { isAdmin, isSalesRep, isSuperAdmin, role } = useRole();
  const utils = trpc.useUtils();
  const [showForm, setShowForm] = useState(false);
  const [editingOrder, setEditingOrder] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<(typeof statusTabs)[number]>("all");
  const [search, setSearch] = useState("");
  const [showQuoteEmail, setShowQuoteEmail] = useState(false);
  const [quoteEmailOrder, setQuoteEmailOrder] = useState<any>(null);
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [productPickerIndex, setProductPickerIndex] = useState(0);
  const [bankingDetails, setBankingDetails] = useState<any>(null);
  const [companyDetails, setCompanyDetails] = useState<any>(null);
  const [adminOverride, setAdminOverride] = useState(false);
  const [adminPin, setAdminPin] = useState("");
  const sampleOverrideRef = useRef(false);
  const [quoteSort, setQuoteSort] = useState<"newest" | "oldest">("newest");

  const { data: orders = [], isLoading } = trpc.order.list.useQuery(undefined, { refetchInterval: 30000 });
  const { data: customers = [] } = trpc.customer.list.useQuery();
  const { data: stockItems = [] } = trpc.stockItem.list.useQuery();
  const { data: invoices = [] } = trpc.invoice.list.useQuery(undefined, { enabled: isAdmin });

  const createOrder = trpc.order.create.useMutation({ onSuccess: () => { utils.order.list.invalidate(); setShowForm(false); resetForm(); } });
  const updateOrder = trpc.order.update.useMutation({ onSuccess: () => { utils.order.list.invalidate(); setShowForm(false); setEditingOrder(null); resetForm(); } });
  const updateOrderStatus = trpc.order.updateStatus.useMutation({ onSuccess: () => utils.order.list.invalidate() });
  const deleteOrder = trpc.order.delete.useMutation({ onSuccess: () => utils.order.list.invalidate() });

  useEffect(() => {
    setBankingDetails(getBankingDetails());
    setCompanyDetails(getCompanyConfig());
  }, []);

  const allCustomers = useMemo(() => {
    const merged = [...(customers || [])];
    const corpList = (customers || []).filter((c) => c.customerType === "corporate");
    corpList.forEach((c) => {
      if (!merged.find((m) => m.id === c.id)) merged.push(c);
    });
    return merged;
  }, [customers]);

  const filteredCustomers = useMemo(() => {
    return (allCustomers || []).filter((c) => !c.isCorporateSubaccount);
  }, [allCustomers]);

  const [formData, setFormData] = useState({
    customerId: "",
    priceTier: "wholesale" as "retail" | "wholesale" | "corporate",
    orderType: "normal" as "normal" | "sample" | "quote",
    paymentTerms: "cod" as "cod" | "net30" | "eom" | "prepaid",
    deliveryDate: "",
    notes: "",
    items: [{ stockItemId: "", quantity: "", unitPrice: "", unitLabel: "kg", conversion: 1 }],
  });

  const selectedCustomer = useMemo(() => {
    return (allCustomers || []).find((c) => String(c.id) === String(formData.customerId));
  }, [allCustomers, formData.customerId]);

  const [priceTier, setPriceTier] = useState(formData.priceTier);

  useEffect(() => {
    if (selectedCustomer && selectedCustomer.priceTier) {
      const tier = selectedCustomer.priceTier;
      if (["retail", "wholesale", "corporate"].includes(tier)) {
        setFormData((prev) => ({ ...prev, priceTier: tier }));
        setPriceTier(tier);
      }
    }
  }, [selectedCustomer]);

  const subtotal = useMemo(() => {
    return formData.items.reduce((sum, item) => {
      const qty = Number(item.quantity) || 0;
      const price = Number(item.unitPrice) || 0;
      return sum + qty * price;
    }, 0);
  }, [formData.items]);

  const vatRate = 0.15;
  const vatAmount = subtotal * vatRate;
  const totalWithVat = subtotal + vatAmount;

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

  function getUnitPrice(stockItemId: number | string, tier: string, customPrice?: number): number {
    if (customPrice !== undefined && customPrice > 0) return customPrice;
    const item = (stockItems || []).find((s) => Number(s.id) === Number(stockItemId));
    if (!item) return 0;
    switch (tier) {
      case "retail": return Number(item.retailPrice) || 0;
      case "wholesale": return Number(item.wholesalePrice) || 0;
      case "corporate": return Number(item.corporatePrice) || 0;
      default: return Number(item.wholesalePrice) || 0;
    }
  }

  function getPriceBreakdown(stockItemId: number | string, unitPrice: number) {
    const item = (stockItems || []).find((s) => Number(s.id) === Number(stockItemId));
    if (!item) return { unitPrice: 0, vatPerUnit: 0, totalPerUnit: 0 };
    const qty = 1;
    const vat = unitPrice * vatRate;
    return { unitPrice, vatPerUnit: vat, totalPerUnit: unitPrice + vat };
  }

  function getTierPrice(stockItemId: number | string, tier: string): number {
    return getUnitPrice(stockItemId, tier);
  }

  function getEffectivePrice(stockItemId: number | string, customPrice?: number): number {
    return getUnitPrice(stockItemId, formData.priceTier, customPrice);
  }

  function handleAddItem() {
    setFormData((prev) => ({ ...prev, items: [...prev.items, { stockItemId: "", quantity: "", unitPrice: "", unitLabel: "kg", conversion: 1 }] }));
  }

  function handleRemoveItem(index: number) {
    setFormData((prev) => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }));
  }

  function handleCustomerSelect(cid: number | string) {
    setFormData((prev) => ({ ...prev, customerId: String(cid) }));
    const customer = (allCustomers || []).find((c) => String(c.id) === String(cid));
    if (customer && customer.priceTier) {
      const tier = customer.priceTier;
      if (["retail", "wholesale", "corporate"].includes(tier)) {
        setFormData((prev) => ({ ...prev, priceTier: tier }));
        setPriceTier(tier);
      }
    }
  }

  function resetForm() {
    setFormData({ customerId: "", priceTier: "wholesale", orderType: "normal", paymentTerms: "cod", deliveryDate: "", notes: "", items: [{ stockItemId: "", quantity: "", unitPrice: "", unitLabel: "kg", conversion: 1 }] });
    setAdminOverride(false);
    setAdminPin("");
    sampleOverrideRef.current = false;
  }

  function canPlaceOrder(): { ok: boolean; message?: string } {
    const validItems = formData.items.filter((i) => Number(i.stockItemId) > 0 && Number(i.quantity) > 0);
    if (validItems.length === 0) return { ok: false, message: "Add at least one item" };
    if (Number(formData.customerId) === 0) return { ok: false, message: "Select a customer" };
    if (formData.orderType === "quote") return { ok: true };
    for (const item of validItems) {
      const stockId = Number(item.stockItemId);
      const avail = availableStock[stockId] || 0;
      const conversion = item.conversion || 1;
      const requestedQty = Number(item.quantity) * conversion;
      if (avail <= 0) { const s = (stockItems || []).find((x) => Number(x.id) === stockId); return { ok: false, message: `${s?.productName || "Product"} is OUT OF STOCK.` }; }
      if (formData.orderType === "sample") {
        const existing = (orders || []).some((o) =>
          o.id !== editingOrder?.id &&
          Number(o.customerId) === Number(formData.customerId) &&
          o.orderType === "sample" &&
          o.items?.some((it: any) => Number(it.stockItemId) === stockId)
        );
        if (existing) { const s = (stockItems || []).find((x) => Number(x.id) === stockId); return { ok: false, message: `Customer already sampled ${s?.productName || "this product"}.` }; }
        if (Number(item.quantity) > 1 && !sampleOverrideRef.current) return { ok: false, message: "Sample orders: 1 unit per product max. Only Super Admin can override." };
      } else { if (requestedQty > avail) { const s = (stockItems || []).find((x) => Number(x.id) === stockId); return { ok: false, message: `Insufficient stock for ${s?.productName || "product"}. Available: ${avail} kg, Requested: ${requestedQty} kg (${item.quantity} ${item.unitLabel || "units"})` }; } }
    }
    const customer = (customers || []).find((c) => String(c.id) === String(formData.customerId));
    if (customer) {
      // Block inactive customers unless super admin or admin override
      if (customer.isActive === false && !isSuperAdmin && !adminOverride) {
        return { ok: false, message: "This customer is inactive. Please activate the customer before placing an order, or use admin override." };
      }

      // Credit limit check for non-super-admins (unless admin override)
      if (!isSuperAdmin && !adminOverride) {
        const creditLimit = Number(customer.creditLimit) || 0;
        if (creditLimit > 0) {
          const outstanding = (invoices || [])
            .filter((inv: any) => inv.customerId == customer.id && inv.status !== "cancelled" && (inv.balanceDue || 0) > 0.01)
            .reduce((sum: number, inv: any) => sum + (inv.balanceDue || 0), 0);
          if (outstanding >= creditLimit && !isSuperAdmin && !adminOverride) {
            return { ok: false, message: `Credit limit exceeded. Limit: R ${creditLimit.toFixed(2)}, Outstanding: R ${outstanding.toFixed(2)}. Only Super Admin can override.` };
          }
        }
      }

      // COD overdue check for non-super-admins (unless admin override)
      if (!isSuperAdmin && !adminOverride) {
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
          return { ok: false, message: `This customer has ${unpaidCOD.length} unpaid COD invoice(s) older than 2 days (R ${totalUnpaid.toFixed(2)}). Settle in full before placing new orders. Only Super Admin can override.` };
        }
      }
    }
    return { ok: true };
  }

  function startEditOrder(order: any) {
    setEditingOrder(order);
    setFormData({
      customerId: String(order.customerId || ""),
      priceTier: order.priceTier || "wholesale",
      orderType: order.orderType || "normal",
      paymentTerms: order.paymentTerms || "cod",
      deliveryDate: order.deliveryDate ? new Date(order.deliveryDate).toISOString().split("T")[0] : "",
      notes: order.notes || "",
      items: (order.items || []).map((item: any) => ({
        stockItemId: String(item.stockItemId || ""),
        quantity: String(item.quantity || ""),
        unitPrice: String(item.unitPrice || ""),
        unitLabel: item.unitLabel || "kg",
        conversion: item.conversion || 1,
      })),
    });
    setAdminOverride(order.superAdminOverride || false);
    setAdminPin("");
    setShowForm(true);
  }

  function printPickingSlip(order: any) {
    const customer = (allCustomers || []).find((c) => String(c.id) === String(order.customerId));
    const company = getCompanyConfig();
    const items = (order.items || []).map((item: any) => {
      const stock = (stockItems || []).find((s) => Number(s.id) === Number(item.stockItemId));
      return { ...item, productName: stock?.productName || "Unknown", sku: stock?.sku || "—" };
    });
    const html = `
      <html><head><title>Picking Slip #${order.orderNumber}</title><style>
        body { font-family: Arial, sans-serif; margin: 40px; color: #333; }
        .header { text-align: center; margin-bottom: 30px; }
        .header h1 { margin: 0; font-size: 24px; }
        .header p { margin: 5px 0; color: #666; }
        .info { display: flex; justify-content: space-between; margin-bottom: 20px; }
        .info div { flex: 1; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
        th { background: #f5f5f5; font-weight: bold; }
        .totals { margin-top: 20px; text-align: right; }
        .totals div { margin: 5px 0; }
        .footer { margin-top: 40px; text-align: center; color: #666; font-size: 12px; }
      </style></head><body>
        <div class="header">
          <h1>${company?.companyName || "Supreme Global Foods"}</h1>
          <p>${company?.address || ""}</p>
          <p>Tel: ${company?.phone || ""} | Email: ${company?.email || ""}</p>
        </div>
        <div class="info">
          <div><strong>Order #:</strong> ${order.orderNumber || "—"}<br/><strong>Date:</strong> ${order.createdAt ? new Date(order.createdAt).toLocaleDateString() : "—"}</div>
          <div><strong>Customer:</strong> ${customer?.companyName || customer?.name || "—"}<br/><strong>Delivery:</strong> ${order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString() : "—"}</div>
        </div>
        <table><thead><tr><th>Product</th><th>SKU</th><th>Qty</th><th>Unit</th></tr></thead><tbody>
          ${items.map((item: any) => `<tr><td>${item.productName}</td><td>${item.sku}</td><td>${item.quantity}</td><td>${item.unitLabel || "kg"}</td></tr>`).join("")}
        </tbody></table>
        <div class="footer">Picking Slip — For warehouse use only</div>
      </body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); w.print(); }
  }

  function printQuote(order: any) {
    const customer = (allCustomers || []).find((c) => String(c.id) === String(order.customerId));
    const company = getCompanyConfig();
    const items = (order.items || []).map((item: any) => {
      const stock = (stockItems || []).find((s) => Number(s.id) === Number(item.stockItemId));
      return { ...item, productName: stock?.productName || "Unknown", sku: stock?.sku || "—" };
    });
    const subtotal = items.reduce((s: number, item: any) => s + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0), 0);
    const vat = subtotal * 0.15;
    const total = subtotal + vat;
    const html = `
      <html><head><title>Quote #${order.orderNumber}</title><style>
        body { font-family: Arial, sans-serif; margin: 40px; color: #333; }
        .header { text-align: center; margin-bottom: 30px; }
        .header h1 { margin: 0; font-size: 28px; color: #D4A843; }
        .header p { margin: 5px 0; color: #666; }
        .info { display: flex; justify-content: space-between; margin-bottom: 20px; }
        .info div { flex: 1; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
        th { background: #f5f5f5; font-weight: bold; }
        .totals { margin-top: 20px; text-align: right; }
        .totals div { margin: 5px 0; }
        .quote-valid { margin-top: 20px; padding: 10px; background: #f9f9f9; border-left: 4px solid #D4A843; }
      </style></head><body>
        <div class="header">
          <h1>${company?.companyName || "Supreme Global Foods"}</h1>
          <p>${company?.address || ""}</p>
          <p>Tel: ${company?.phone || ""} | Email: ${company?.email || ""}</p>
        </div>
        <div class="info">
          <div><strong>Quote #:</strong> ${order.orderNumber || "—"}<br/><strong>Date:</strong> ${order.createdAt ? new Date(order.createdAt).toLocaleDateString() : "—"}<br/><strong>Valid Until:</strong> ${order.validUntil ? new Date(order.validUntil).toLocaleDateString() : "—"}</div>
          <div><strong>Customer:</strong> ${customer?.companyName || customer?.name || "—"}<br/><strong>Contact:</strong> ${customer?.contactPerson || "—"}<br/><strong>Email:</strong> ${customer?.email || "—"}</div>
        </div>
        <table><thead><tr><th>Product</th><th>SKU</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr></thead><tbody>
          ${items.map((item: any) => `<tr><td>${item.productName}</td><td>${item.sku}</td><td>${item.quantity}</td><td>R ${(Number(item.unitPrice) || 0).toFixed(2)}</td><td>R ${((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0)).toFixed(2)}</td></tr>`).join("")}
        </tbody></table>
        <div class="totals">
          <div><strong>Subtotal:</strong> R ${subtotal.toFixed(2)}</div>
          <div><strong>VAT (15%):</strong> R ${vat.toFixed(2)}</div>
          <div style="font-size: 18px; margin-top: 10px;"><strong>Total:</strong> R ${total.toFixed(2)}</div>
        </div>
        <div class="quote-valid">This quote is valid for 30 days from the date of issue.</div>
      </body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); w.print(); }
  }

  function sendQuoteEmail(order: any) {
    const customer = (allCustomers || []).find((c) => String(c.id) === String(order.customerId));
    if (!customer?.email) { alert("Customer has no email address."); return; }
    const items = (order.items || []).map((item: any) => {
      const stock = (stockItems || []).find((s) => Number(s.id) === Number(item.stockItemId));
      return { ...item, productName: stock?.productName || "Unknown" };
    });
    const subtotal = items.reduce((s: number, item: any) => s + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0), 0);
    const vat = subtotal * 0.15;
    const total = subtotal + vat;
    const subject = `Quote #${order.orderNumber} from Supreme Global Foods`;
    const body = `Dear ${customer.contactPerson || customer.companyName || "Customer"},\n\nPlease find your quote below:\n\nQuote #: ${order.orderNumber}\nDate: ${new Date(order.createdAt).toLocaleDateString()}\nValid Until: ${order.validUntil ? new Date(order.validUntil).toLocaleDateString() : "N/A"}\n\nItems:\n${items.map((item: any) => `- ${item.productName}: ${item.quantity} x R ${(Number(item.unitPrice) || 0).toFixed(2)} = R ${((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0)).toFixed(2)}`).join("\n")}\n\nSubtotal: R ${subtotal.toFixed(2)}\nVAT (15%): R ${vat.toFixed(2)}\nTotal: R ${total.toFixed(2)}\n\nThis quote is valid for 30 days.\n\nBest regards,\nSupreme Global Foods Team`;
    window.location.href = `mailto:${customer.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const check = editingOrder ? canEditOrderBasic() : canPlaceOrder();
    if (!check.ok) { alert(check.message); return; }
    const payload: any = {
      customerId: Number(formData.customerId),
      priceTier: formData.priceTier,
      orderType: formData.orderType,
      paymentTerms: formData.paymentTerms,
      deliveryDate: formData.deliveryDate ? new Date(formData.deliveryDate).toISOString() : undefined,
      notes: formData.notes,
      items: formData.items
        .filter((i) => Number(i.stockItemId) > 0 && Number(i.quantity) > 0)
        .map((i) => ({
          stockItemId: Number(i.stockItemId),
          quantity: Number(i.quantity),
          unitPrice: Number(i.unitPrice),
          unitLabel: i.unitLabel || "kg",
          conversion: i.conversion || 1,
        })),
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

  function canEditOrderBasic(): { ok: boolean; message?: string } {
    if (Number(formData.customerId) === 0) return { ok: false, message: "Select a customer" };
    const validItems = formData.items.filter((i) => Number(i.stockItemId) > 0 && Number(i.quantity) > 0);
    if (validItems.length === 0) return { ok: false, message: "Add at least one item" };
    return { ok: true };
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
    return (allCustomers || []).find((c) => String(c.id) === String(order.customerId));
  }

  const STATUS_LABELS: Record<string, string> = {
    all: "All",
    pending: "Pending",
    processing: "Processing",
    out_for_delivery: "Out for Delivery",
    delivered: "Delivered",
    cancelled: "Cancelled",
  };

  const PRICE_TIERS = [
    { value: "retail", label: "Retail" },
    { value: "wholesale", label: "Wholesale" },
    { value: "corporate", label: "Corporate" },
  ];

  const productOrderStatuses = useMemo(() => {
    const map: Record<string, string> = {};
    (orders || []).forEach((order: any) => {
      if (order.status === "cancelled") return;
      (order.items || []).forEach((item: any) => {
        const stockId = String(item.stockItemId);
        if (!map[stockId] || ["pending", "processing", "out_for_delivery"].includes(order.status)) {
          map[stockId] = order.status;
        }
      });
    });
    return map;
  }, [orders]);

  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = { all: orders.length };
    statusTabs.forEach((tab) => {
      if (tab === "all") return;
      counts[tab] = (orders || []).filter((o: any) => o.status === tab).length;
    });
    return counts;
  }, [orders]);

  const filteredOrders = useMemo(() => {
    let list = [...(orders || [])];
    if (activeTab !== "all") {
      list = list.filter((o: any) => o.status === activeTab);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((o: any) => {
        const c = getCustomer(o);
        return (
          (o.orderNumber || "").toLowerCase().includes(q) ||
          (c?.companyName || "").toLowerCase().includes(q) ||
          (c?.name || "").toLowerCase().includes(q)
        );
      });
    }
    return list.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [orders, activeTab, search]);

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-8 w-48 bg-[#333334]/50 rounded animate-pulse" />
          <div className="h-10 w-32 bg-[#333334]/50 rounded animate-pulse" />
        </div>
        <div className="h-12 bg-[#333334]/50 rounded animate-pulse" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-20 bg-[#333334]/50 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Orders</h1>
          <p className="text-sm text-[#8A8B8C] mt-1">Manage orders, quotes, and sample requests</p>
        </div>
        <button onClick={() => { setEditingOrder(null); resetForm(); setShowForm(true); }} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> New Order
        </button>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {statusTabs.map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === tab ? "bg-[#D4A843] text-black" : "bg-[#18191A] text-[#8A8B8C] hover:text-white border border-[#333334]"}`}>
            {STATUS_LABELS[tab]} {tabCounts[tab] > 0 && <span className="ml-1 text-xs opacity-70">({tabCounts[tab]})</span>}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8B8C]" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search orders..." className="input-field pl-10 w-full" />
      </div>

      {/* Orders List */}
      <div className="space-y-3">
        {filteredOrders.length === 0 && (
          <div className="text-center py-12 text-[#8A8B8C]">
            <Package className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">No orders found</p>
            <p className="text-sm mt-1">{search ? "Try adjusting your search" : "Create your first order to get started"}</p>
          </div>
        )}
        {filteredOrders.map((order: any) => {
          const customer = getCustomer(order);
          const isQuote = order.orderType === "quote";
          const isSample = order.orderType === "sample";
          const statusColors: Record<string, string> = {
            pending: "bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/30",
            processing: "bg-[#3B82F6]/10 text-[#3B82F6] border-[#3B82F6]/30",
            out_for_delivery: "bg-[#8B5CF6]/10 text-[#8B5CF6] border-[#8B5CF6]/30",
            delivered: "bg-[#22C55E]/10 text-[#22C55E] border-[#22C55E]/30",
            cancelled: "bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/30",
          };
          return (
            <div key={order.id} className="card hover:border-[#D4A843]/30 transition-colors">
              <div className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-lg font-semibold text-white">#{order.orderNumber || order.id}</span>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${statusColors[order.status] || statusColors.pending}`}>
                        {order.status?.replace(/_/g, " ")}
                      </span>
                      {isQuote && <span className="px-2 py-1 rounded-full text-xs font-medium bg-[#3B82F6]/10 text-[#3B82F6] border border-[#3B82F6]/30">Quote</span>}
                      {isSample && <span className="px-2 py-1 rounded-full text-xs font-medium bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/30">Sample</span>}
                      {order.superAdminOverride && <span className="px-2 py-1 rounded-full text-xs font-medium bg-[#D4A843]/10 text-[#D4A843] border border-[#D4A843]/30">Admin Override</span>}
                    </div>
                    <div className="mt-2 text-sm text-[#8A8B8C]">
                      <span className="text-white font-medium">{customer?.companyName || customer?.name || "Unknown Customer"}</span>
                      <span className="mx-2">·</span>
                      <span>{new Date(order.createdAt).toLocaleDateString()}</span>
                      <span className="mx-2">·</span>
                      <span className="capitalize">{order.paymentTerms?.replace(/_/g, " ")}</span>
                      <span className="mx-2">·</span>
                      <span className="capitalize">{order.priceTier}</span>
                    </div>
                    <div className="mt-3 space-y-1">
                      {(order.items || []).slice(0, 3).map((item: any, idx: number) => {
                        const stock = (stockItems || []).find((s) => Number(s.id) === Number(item.stockItemId));
                        return (
                          <div key={idx} className="text-sm text-[#8A8B8C]">
                            {stock?.productName || "Unknown"} × {item.quantity} {item.unitLabel || "kg"} @ R {(Number(item.unitPrice) || 0).toFixed(2)}
                          </div>
                        );
                      })}
                      {(order.items || []).length > 3 && (
                        <div className="text-sm text-[#8A8B8C]">+{(order.items || []).length - 3} more items</div>
                      )}
                    </div>
                    <div className="mt-3 text-sm font-medium text-white">
                      Total: R {(Number(order.totalAmount) || 0).toFixed(2)}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {canProgressOrder(order) && (
                      <button onClick={() => { const statuses = ["pending", "processing", "out_for_delivery", "delivered"]; const idx = statuses.indexOf(order.status); if (idx >= 0 && idx < statuses.length - 1) { updateOrderStatus.mutate({ id: order.id, status: statuses[idx + 1] }); } }} className="btn-primary text-xs flex items-center gap-1">
                        <Truck className="w-3 h-3" /> Progress
                      </button>
                    )}
                    <button onClick={() => printPickingSlip(order)} className="btn-secondary text-xs flex items-center gap-1" style={{ borderColor: "rgba(212,168,67,0.3)" }}>
                      <Printer className="w-3 h-3" /> Picking Slip
                    </button>
                    {isQuote && (
                      <>
                        <button onClick={() => printQuote(order)} className="btn-secondary text-xs flex items-center gap-1" style={{ borderColor: "rgba(212,168,67,0.3)" }}>
                          <FileText className="w-3 h-3" /> Print Quote
                        </button>
                        <button onClick={() => sendQuoteEmail(order)} className="btn-secondary text-xs flex items-center gap-1" style={{ borderColor: "rgba(212,168,67,0.3)" }}>
                          <Send className="w-3 h-3" /> Email
                        </button>
                      </>
                    )}
                    <GenerateInvoiceButton order={order} orderType={isQuote ? "quote" : "order"} onInvoiceGenerated={() => utils.order.list.invalidate()} />
                    {canEditOrder(order) && (
                      <button onClick={() => startEditOrder(order)} className="btn-secondary text-xs flex items-center gap-1" style={{ borderColor: "rgba(212,168,67,0.3)" }}>
                        <Pencil className="w-3 h-3" /> Edit {isQuote ? "Quote" : "Order"}
                      </button>
                    )}
                    {canCancelOrder(order) && (
                      <button onClick={() => { if (confirm("Cancel this order?")) deleteOrder.mutate(order.id); }} className="btn-danger text-xs flex items-center gap-1">
                        <X className="w-3 h-3" /> Cancel
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Order Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowForm(false)}>
          <div className="card max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-[#18191A] border-b border-[#333334] p-4 sm:p-6 z-10">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">{editingOrder ? `Edit ${editingOrder.orderType === "quote" ? "Quote" : "Order"}` : "New Order"}</h2>
                <button onClick={() => setShowForm(false)} className="p-2 rounded-lg hover:bg-[#333334]/50 text-[#8A8B8C]"><X className="w-5 h-5" /></button>
              </div>
            </div>
            <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-6">
              {/* Customer */}
              <div className="space-y-2">
                <label className="label-text">Customer *</label>
                <select value={formData.customerId} onChange={(e) => handleCustomerSelect(e.target.value)} className="input-field w-full" required>
                  <option value="">Select customer...</option>
                  {filteredCustomers.map((c) => (
                    <option key={c.id} value={c.id}>{c.companyName || c.name} {c.customerType === "corporate" ? "(Corporate)" : ""}</option>
                  ))}
                </select>
                {selectedCustomer && (
                  <div className="text-sm text-[#8A8B8C] mt-1">
                    Credit Limit: R {(Number(selectedCustomer.creditLimit) || 0).toFixed(2)} | Type: {selectedCustomer.customerType || "regular"} | Status: {selectedCustomer.isActive === false ? <span className="text-[#EF4444]">Inactive</span> : <span className="text-[#22C55E]">Active</span>}
                  </div>
                )}
              </div>

              {/* Order Type & Price Tier */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="label-text">Order Type *</label>
                  <select value={formData.orderType} onChange={(e) => { const type = e.target.value as any; setFormData((prev) => ({ ...prev, orderType: type })); if (type === "sample") { setFormData((prev) => ({ ...prev, paymentTerms: "cod" })); } }} className="input-field w-full">
                    <option value="normal">Normal Order</option>
                    <option value="sample">Sample Order</option>
                    <option value="quote">Quote</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="label-text">Price Tier *</label>
                  <select value={formData.priceTier} onChange={(e) => { const tier = e.target.value as any; setFormData((prev) => ({ ...prev, priceTier: tier })); setPriceTier(tier); }} className="input-field w-full">
                    {PRICE_TIERS.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Payment Terms & Delivery Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="label-text">Payment Terms *</label>
                  <select value={formData.paymentTerms} onChange={(e) => setFormData((prev) => ({ ...prev, paymentTerms: e.target.value as any }))} className="input-field w-full">
                    <option value="cod">Cash on Delivery</option>
                    <option value="net30">Net 30</option>
                    <option value="eom">End of Month</option>
                    <option value="prepaid">Prepaid</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="label-text">Delivery Date</label>
                  <input type="date" value={formData.deliveryDate} onChange={(e) => setFormData((prev) => ({ ...prev, deliveryDate: e.target.value }))} className="input-field w-full" />
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <label className="label-text">Notes</label>
                <textarea value={formData.notes} onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))} rows={3} className="input-field w-full resize-none" placeholder="Add any special instructions..." />
              </div>

              {/* Admin override for all restriction checks */}
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
                    Admin Override
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
                    <span className="text-xs text-[#8A8B8C]">Enter PIN to bypass restrictions</span>
                  </div>
                )}
              </div>

              {/* Items */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="label-text">Items *</label>
                  <button type="button" onClick={handleAddItem} className="text-sm text-[#D4A843] hover:text-[#E8C86A] flex items-center gap-1">
                    <Plus className="w-4 h-4" /> Add Item
                  </button>
                </div>
                {formData.items.map((item, index) => {
                  const stock = (stockItems || []).find((s) => Number(s.id) === Number(item.stockItemId));
                  const avail = availableStock[Number(item.stockItemId)] || 0;
                  const conversion = item.conversion || 1;
                  const price = getEffectivePrice(item.stockItemId, Number(item.unitPrice) || undefined);
                  return (
                    <div key={index} className="card p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-white">Item {index + 1}</span>
                        {formData.items.length > 1 && (
                          <button type="button" onClick={() => handleRemoveItem(index)} className="text-[#EF4444] hover:text-[#DC2626]"><Trash2 className="w-4 h-4" /></button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-xs text-[#8A8B8C]">Product *</label>
                          <button type="button" onClick={() => { setProductPickerIndex(index); setProductPickerOpen(true); }} className="input-field w-full text-left flex items-center justify-between">
                            <span className={stock ? "text-white" : "text-[#8A8B8C]"}>{stock ? stock.productName : "Select product..."}</span>
                            <ChevronDown className="w-4 h-4 text-[#8A8B8C]" />
                          </button>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-[#8A8B8C]">Quantity *</label>
                          <input type="number" min="0.01" step="0.01" value={item.quantity} onChange={(e) => { const qty = e.target.value; setFormData((prev) => { const items = [...prev.items]; items[index] = { ...items[index], quantity: qty }; return { ...prev, items }; }); }} className="input-field w-full" placeholder="0.00" />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-xs text-[#8A8B8C]">Unit Price (R) *</label>
                          <input type="number" min="0" step="0.01" value={item.unitPrice} onChange={(e) => { const price = e.target.value; setFormData((prev) => { const items = [...prev.items]; items[index] = { ...items[index], unitPrice: price }; return { ...prev, items }; }); }} className="input-field w-full" placeholder="0.00" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-[#8A8B8C]">Unit</label>
                          <select value={item.unitLabel} onChange={(e) => setFormData((prev) => { const items = [...prev.items]; items[index] = { ...items[index], unitLabel: e.target.value }; return { ...prev, items }; })} className="input-field w-full">
                            <option value="kg">kg</option>
                            <option value="g">g</option>
                            <option value="unit">unit</option>
                            <option value="box">box</option>
                            <option value="case">case</option>
                          </select>
                        </div>
                      </div>
                      {stock && (
                        <div className="text-xs text-[#8A8B8C]">
                          Available: {avail.toFixed(2)} kg | Suggested: R {price.toFixed(2)} ({formData.priceTier})
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Totals */}
              <div className="card p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-[#8A8B8C]">Subtotal</span>
                  <span className="text-white">R {subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#8A8B8C]">VAT (15%)</span>
                  <span className="text-white">R {vatAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg font-semibold border-t border-[#333334] pt-2">
                  <span className="text-white">Total</span>
                  <span className="text-[#D4A843]">R {totalWithVat.toFixed(2)}</span>
                </div>
              </div>

              {/* Validation */}
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

              {/* Submit */}
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={createOrder.isPending || updateOrder.isPending || !canPlaceOrder().ok} className="btn-primary">
                  {createOrder.isPending || updateOrder.isPending ? "Saving..." : editingOrder ? "Update" : "Place Order"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ProductPickerModal
        open={productPickerOpen}
        onClose={() => setProductPickerOpen(false)}
        onSelect={(item: any) => {
          setFormData((prev) => {
            const items = [...prev.items];
            items[productPickerIndex] = {
              ...items[productPickerIndex],
              stockItemId: String(item.id),
              unitPrice: String(getEffectivePrice(item.id)),
              unitLabel: "kg",
              conversion: 1,
            };
            return { ...prev, items };
          });
          setProductPickerOpen(false);
        }}
        stockItems={stockItems}
        selectedId={formData.items[productPickerIndex]?.stockItemId || 0}
      />
    </div>
  );
}