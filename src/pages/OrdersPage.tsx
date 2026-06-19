import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import {
  Plus,
  X,
  Printer,
  ChevronDown,
  ChevronUp,
  Package,
  CheckCircle,
  Truck,
  Ban,
  Tag,
} from "lucide-react";

const statusTabs = [
  { key: "all", label: "All Orders", color: "#8A8B8C" },
  { key: "pending", label: "Pending", color: "#F59E0B" },
  { key: "picking", label: "Picking", color: "#6366F1" },
  { key: "ready", label: "Ready", color: "#4ADE80" },
  { key: "delivered", label: "Delivered", color: "#4ADE80" },
  { key: "cancelled", label: "Cancelled", color: "#EF4444" },
];

export default function OrdersPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const utils = trpc.useUtils();

  const [activeTab, setActiveTab] = useState("all");
  const [expandedOrder, setExpandedOrder] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [formData, setFormData] = useState({
    customerId: 0,
    paymentTerms: "cod" as "cod" | "7_days" | "14_days" | "30_days",
    deliveryAddress: "",
    notes: "",
    items: [] as { stockItemId: number; quantity: number; unitPrice?: number }[],
  });

  const { data: orders } = trpc.order.list.useQuery();
  const { data: customers } = trpc.customer.search.useQuery({ query: " " });
  const { data: stockItems } = trpc.stock.search.useQuery({ query: " " });
  const { data: stats } = trpc.order.getStats.useQuery();

  const { data: customerSpecialPrices } = trpc.specialPrice.listByCustomer.useQuery(
    { customerId: formData.customerId },
    { enabled: formData.customerId > 0 }
  );

  const updateStatus = trpc.order.updateStatus.useMutation({
    onSuccess: () => { utils.order.list.invalidate(); utils.order.getStats.invalidate(); },
  });

  const createOrder = trpc.order.create.useMutation({
    onSuccess: () => { utils.order.list.invalidate(); utils.order.getStats.invalidate(); setShowForm(false); resetForm(); },
  });

  function resetForm() {
    setFormData({ customerId: 0, paymentTerms: "cod", deliveryAddress: "", notes: "", items: [] });
  }

  function getItemPrice(stockItemId: number): number {
    const item = formData.items.find((i) => i.stockItemId === stockItemId);
    if (item?.unitPrice && item.unitPrice > 0) return item.unitPrice;
    const sp = (customerSpecialPrices || []).find((sp) => sp.stockItemId === stockItemId);
    if (sp) return Number(sp.specialPrice);
    const stock = (stockItems || []).find((s) => s.id === stockItemId);
    return stock ? Number(stock.unitPrice) : 0;
  }

  function handleAddItem() {
    setFormData({ ...formData, items: [...formData.items, { stockItemId: 0, quantity: 1 }] });
  }

  function handleUpdateItem(index: number, field: string, value: number) {
    const updated = [...formData.items];
    updated[index] = { ...updated[index], [field]: value };
    setFormData({ ...formData, items: updated });
  }

  function handleRemoveItem(index: number) {
    setFormData({ ...formData, items: formData.items.filter((_, i) => i !== index) });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validItems = formData.items.filter((i) => i.stockItemId > 0 && i.quantity > 0);
    if (validItems.length === 0) return;
    createOrder.mutate({
      customerId: formData.customerId,
      paymentTerms: formData.paymentTerms,
      deliveryAddress: formData.deliveryAddress,
      notes: formData.notes,
      items: validItems.map((item) => ({
        stockItemId: item.stockItemId,
        quantity: item.quantity,
        unitPrice: item.unitPrice && item.unitPrice > 0 ? item.unitPrice : undefined,
      })),
    });
  }

  function printPickingSlip(order: NonNullable<typeof orders>[0]) {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <html><head><title>Picking Slip - ${order.orderNumber}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
        .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #D4A843; padding-bottom: 20px; }
        .logo { font-size: 24px; font-weight: bold; color: #D4A843; }
        .subtitle { color: #666; font-size: 14px; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
        .label { font-size: 11px; color: #999; text-transform: uppercase; letter-spacing: 0.5px; }
        .value { font-size: 14px; font-weight: 600; margin-top: 4px; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th { background: #f5f5f5; padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; }
        td { padding: 12px; border-bottom: 1px solid #eee; font-size: 13px; }
        .total { text-align: right; margin-top: 20px; font-size: 18px; font-weight: bold; }
        .special-badge { background: #D4A843; color: white; padding: 2px 8px; border-radius: 10px; font-size: 10px; }
        @media print { body { padding: 20px; } }
      </style></head><body>
      <div class="header">
        <div class="logo">Supreme Global Foods</div>
        <div class="subtitle">Germiston, 1422, South Africa</div>
        <div class="subtitle">+27614788888 | sales@supremeglobalfoods.co.za</div>
      </div>
      <h2 style="text-align:center; color:#D4A843;">PICKING SLIP</h2>
      <div class="info-grid">
        <div><div class="label">Order Number</div><div class="value">${order.orderNumber}</div></div>
        <div><div class="label">Date</div><div class="value">${new Date(order.createdAt).toLocaleDateString("en-ZA")}</div></div>
        <div><div class="label">Customer</div><div class="value">${order.customer?.name || "N/A"}</div></div>
        <div><div class="label">Status</div><div class="value">${order.status.toUpperCase()}</div></div>
      </div>
      <table>
        <thead><tr><th>Product Code</th><th>Product Name</th><th>Qty</th><th>Unit Price</th><th>Line Total</th></tr></thead>
        <tbody>
          ${order.items?.map((item) => `
            <tr><td>${item.productCode}</td><td>${item.productName}</td><td>${item.quantity}</td><td>R ${Number(item.unitPrice).toFixed(2)}</td><td>R ${Number(item.lineTotal).toFixed(2)}</td></tr>
          `).join("") || "<tr><td colspan='5'>No items</td></tr>"}
        </tbody>
      </table>
      <div class="total">Total: R ${Number(order.total).toFixed(2)}</div>
      </body></html>
    `);
    printWindow.document.close();
    printWindow.print();
  }

  const filteredOrders = (orders || []).filter((o) => activeTab === "all" || o.status === activeTab);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display font-semibold text-white" style={{ fontSize: "clamp(1.8rem, 3vw, 2.5rem)", letterSpacing: "-0.03em" }}>Orders</h1>
          <p className="text-[#8A8B8C] font-body text-sm mt-1">{stats?.total || 0} orders &middot; R {(stats?.totalValue || 0).toLocaleString("en-ZA", { minimumFractionDigits: 2 })} total value</p>
        </div>
        <button onClick={() => { setShowForm(true); resetForm(); }} className="btn-primary"><Plus className="w-4 h-4" /> New Order</button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {statusTabs.slice(1).map((tab) => (
          <div key={tab.key} className="card-surface p-3 text-center">
            <div className="label-text mb-1">{tab.label.toUpperCase()}</div>
            <div className="stat-number" style={{ fontSize: "1.5rem", color: tab.color }}>
              {tab.key === "pending" ? stats?.pending : tab.key === "picking" ? stats?.picking : tab.key === "ready" ? stats?.ready : tab.key === "delivered" ? stats?.delivered : 0}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {statusTabs.map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} className="px-4 py-2 rounded-full text-sm font-body font-medium transition-all cursor-pointer" style={{ backgroundColor: activeTab === tab.key ? "#D4A843" : "#18191A", color: activeTab === tab.key ? "#0A0A0B" : "#8A8B8C", border: activeTab === tab.key ? "none" : "1px solid #2A2B2C" }}>{tab.label}</button>
        ))}
      </div>

      <div className="card-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ backgroundColor: "#131415", borderBottom: "1px solid #222324" }}>
                <th className="text-left p-4 label-text">Order #</th>
                <th className="text-left p-4 label-text">Customer</th>
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
                  <tr key={order.id} className="transition-colors hover:bg-[#131415] cursor-pointer" onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}>
                    <td className="p-4 font-mono-data text-xs text-[#D4A843]">{order.orderNumber}</td>
                    <td className="p-4 text-sm text-[#E8E8E9] font-body">{order.customer?.name || "N/A"}</td>
                    <td className="p-4 text-sm text-[#8A8B8C] font-body">{new Date(order.createdAt).toLocaleDateString("en-ZA")}</td>
                    <td className="p-4 text-right text-sm text-white font-display">{order.items?.length || 0}</td>
                    <td className="p-4 text-right font-display font-semibold text-white">R {Number(order.total).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</td>
                    <td className="p-4">
                      <span className="status-badge" style={{ backgroundColor: order.status === "delivered" ? "rgba(74,222,128,0.12)" : order.status === "pending" ? "rgba(245,158,11,0.12)" : order.status === "cancelled" ? "rgba(239,68,68,0.12)" : order.status === "ready" ? "rgba(74,222,128,0.12)" : "rgba(99,102,241,0.12)", color: order.status === "delivered" ? "#4ADE80" : order.status === "pending" ? "#F59E0B" : order.status === "cancelled" ? "#EF4444" : order.status === "ready" ? "#4ADE80" : "#6366F1" }}>{order.status}</span>
                    </td>
                    <td className="p-4 text-right">{expandedOrder === order.id ? <ChevronUp className="w-4 h-4 text-[#8A8B8C] inline" /> : <ChevronDown className="w-4 h-4 text-[#8A8B8C] inline" />}</td>
                  </tr>
                  {expandedOrder === order.id && (
                    <tr><td colSpan={7} className="p-0">
                      <div className="p-6" style={{ backgroundColor: "#0A0A0B" }}>
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="font-display font-semibold text-white">Order Details</h3>
                          <div className="flex gap-2">
                            <button onClick={() => printPickingSlip(order)} className="btn-secondary text-xs"><Printer className="w-3 h-3" /> Print Picking Slip</button>
                            {isAdmin && order.status === "pending" && <button onClick={() => updateStatus.mutate({ id: order.id, status: "picking" })} className="btn-primary text-xs"><Package className="w-3 h-3" /> Mark Picking</button>}
                            {isAdmin && order.status === "picking" && <button onClick={() => updateStatus.mutate({ id: order.id, status: "ready" })} className="btn-primary text-xs"><CheckCircle className="w-3 h-3" /> Mark Ready</button>}
                            {isAdmin && order.status === "ready" && <button onClick={() => updateStatus.mutate({ id: order.id, status: "delivered" })} className="btn-primary text-xs"><Truck className="w-3 h-3" /> Mark Delivered</button>}
                            {isAdmin && order.status !== "cancelled" && order.status !== "delivered" && <button onClick={() => updateStatus.mutate({ id: order.id, status: "cancelled" })} className="btn-secondary text-xs hover:text-[#EF4444]"><Ban className="w-3 h-3" /> Cancel</button>}
                          </div>
                        </div>
                        <table className="w-full mb-4">
                          <thead><tr style={{ borderBottom: "1px solid #222324" }}><th className="text-left p-2 label-text">Product</th><th className="text-right p-2 label-text">Qty</th><th className="text-right p-2 label-text">Unit Price</th><th className="text-right p-2 label-text">Line Total</th></tr></thead>
                          <tbody>
                            {order.items?.map((item) => (
                              <tr key={item.id} style={{ borderBottom: "1px solid #18191A" }}>
                                <td className="p-2 text-sm text-[#E8E8E9]">{item.productName}</td>
                                <td className="p-2 text-right text-sm text-white">{item.quantity}</td>
                                <td className="p-2 text-right text-sm text-[#8A8B8C]">R {Number(item.unitPrice).toFixed(2)}</td>
                                <td className="p-2 text-right text-sm text-white font-display">R {Number(item.lineTotal).toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <div className="flex justify-end gap-6 text-sm">
                          <div className="text-[#8A8B8C]">Subtotal: <span className="text-white">R {Number(order.subtotal).toFixed(2)}</span></div>
                          <div className="text-[#8A8B8C]">VAT (15%): <span className="text-white">R {Number(order.vatAmount).toFixed(2)}</span></div>
                          <div className="font-display font-semibold text-[#D4A843]">Total: R {Number(order.total).toFixed(2)}</div>
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

      {/* New Order Dialog */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.7)" }}>
          <div className="card-surface p-8 max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto" style={{ borderRadius: 16 }}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display font-semibold text-white text-xl">New Order</h2>
              <button onClick={() => setShowForm(false)} className="cursor-pointer"><X className="w-5 h-5 text-[#8A8B8C]" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label-text block mb-1.5">Customer *</label>
                  <select value={formData.customerId} onChange={(e) => setFormData({ ...formData, customerId: parseInt(e.target.value), items: [] })} className="input-field" required>
                    <option value={0}>Select customer...</option>
                    {(customers || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label-text block mb-1.5">Payment Terms</label>
                  <select value={formData.paymentTerms} onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value as "cod" | "7_days" | "14_days" | "30_days" })} className="input-field">
                    <option value="cod">COD</option><option value="7_days">7 Days</option><option value="14_days">14 Days</option><option value="30_days">30 Days</option>
                  </select>
                </div>
              </div>

              {formData.customerId > 0 && (customerSpecialPrices || []).length > 0 && (
                <div className="p-3 rounded-lg flex items-center gap-2" style={{ backgroundColor: "rgba(212, 168, 67, 0.08)", border: "1px solid rgba(212, 168, 67, 0.15)" }}>
                  <Tag className="w-4 h-4 text-[#D4A843]" />
                  <span className="text-sm text-[#D4A843] font-body">This customer has {(customerSpecialPrices || []).length} special price(s) that will be applied automatically</span>
                </div>
              )}

              <div>
                <label className="label-text block mb-1.5">Items</label>
                {formData.items.map((item, index) => {
                  const effectivePrice = getItemPrice(item.stockItemId);
                  const stockItem = (stockItems || []).find((s) => s.id === item.stockItemId);
                  const hasSpecialPrice = item.stockItemId > 0 && effectivePrice < Number(stockItem?.unitPrice || 0);
                  return (
                    <div key={index} className="flex gap-3 mb-2 items-end">
                      <select value={item.stockItemId} onChange={(e) => handleUpdateItem(index, "stockItemId", parseInt(e.target.value))} className="input-field flex-1">
                        <option value={0}>Select product...</option>
                        {(stockItems || []).map((s) => <option key={s.id} value={s.id}>{s.productName} (Std: R {Number(s.unitPrice).toFixed(2)})</option>)}
                      </select>
                      <input type="number" value={item.quantity} onChange={(e) => handleUpdateItem(index, "quantity", parseInt(e.target.value) || 1)} className="input-field w-20" min={1} />
                      <div className="relative">
                        <input
                          type="number"
                          step="0.01"
                          value={item.unitPrice || effectivePrice || ""}
                          onChange={(e) => handleUpdateItem(index, "unitPrice", parseFloat(e.target.value) || 0)}
                          className="input-field w-28"
                          placeholder="Price"
                          min={0}
                        />
                        {hasSpecialPrice && !item.unitPrice && (
                          <span className="absolute -top-2 -right-2 text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: "#D4A843", color: "#0A0A0B" }}>SP</span>
                        )}
                      </div>
                      <button type="button" onClick={() => handleRemoveItem(index)} className="p-2 hover:text-[#EF4444] cursor-pointer"><X className="w-4 h-4 text-[#8A8B8C]" /></button>
                    </div>
                  );
                })}
                <button type="button" onClick={handleAddItem} className="btn-secondary text-xs mt-2"><Plus className="w-3 h-3" /> Add Item</button>
              </div>

              <div><label className="label-text block mb-1.5">Delivery Address</label><textarea value={formData.deliveryAddress} onChange={(e) => setFormData({ ...formData, deliveryAddress: e.target.value })} className="input-field" rows={2} /></div>
              <div><label className="label-text block mb-1.5">Notes</label><textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} className="input-field" rows={2} /></div>
              <button type="submit" className="btn-primary w-full justify-center">Place Order</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
