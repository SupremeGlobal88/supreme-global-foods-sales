import { useState, useMemo, useRef, useEffect } from "react";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Package,
  CheckCircle,
  Truck,
  RotateCcw,
  Plus,
  ChevronDown,
  ChevronUp,
  Search,
  X,
  Filter,
  FileText,
  Printer,
  Download,
  RefreshCw,
  AlertCircle,
  Copy,
  Trash2,
  Loader2,
  MessageSquare,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { OrderForm } from "@/components/OrderForm";
import { EditOrderForm } from "@/components/EditOrderForm";
import { InvoiceView } from "@/components/InvoiceView";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// ─── helpers ───
function formatDate(date: string) {
  if (!date) return "N/A";
  return new Date(date).toLocaleDateString("en-ZA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
function formatDateTime(date: string) {
  if (!date) return "N/A";
  return new Date(date).toLocaleString("en-ZA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
function formatCurrency(amount: number) {
  return `R ${Number(amount || 0).toFixed(2)}`;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: "Pending", color: "#f59e0b" },
  picking: { label: "Picking", color: "#3b82f6" },
  ready: { label: "Ready", color: "#8b5cf6" },
  delivered: { label: "Delivered", color: "#10b981" },
  cancelled: { label: "Cancelled", color: "#ef4444" },
  draft: { label: "Draft", color: "#6b7280" },
  sent: { label: "Sent", color: "#06b6d4" },
  accepted: { label: "Accepted", color: "#10b981" },
  rejected: { label: "Rejected", color: "#ef4444" },
  converted: { label: "Converted", color: "#10b981" },
  sample_delivered: { label: "Sample Delivered", color: "#10b981" },
};

const ORDER_TYPE_LABELS: Record<string, string> = {
  normal: "Sales Order",
  sample: "Sample",
  quote: "Quote",
};

const statusTabs = [
  { key: "pending", label: "Pending" },
  { key: "picking", label: "Picking" },
  { key: "ready", label: "Ready" },
  { key: "delivered", label: "Delivered" },
  { key: "cancelled", label: "Cancelled" },
];

// ─── component ───
export default function OrdersPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  const isSalesRep = user?.role === "sales_rep";

  const [showForm, setShowForm] = useState(false);
  const [editingOrder, setEditingOrder] = useState<any>(null);
  const [viewingInvoice, setViewingInvoice] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedOrder, setExpandedOrder] = useState<number | null>(null);
  const [cancelDialog, setCancelDialog] = useState<any>(null);
  const [deleteDialog, setDeleteDialog] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("pending");
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [salesRepFilter, setSalesRepFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [repairing, setRepairing] = useState(false);
  const [showQuoteForm, setShowQuoteForm] = useState(false);
  const [showMobileFilter, setShowMobileFilter] = useState(false);

  // Scroll-to-top state
  const [showScrollTop, setShowScrollTop] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      const el = listRef.current;
      if (!el) return;
      setShowScrollTop(el.scrollTop > 300);
    };
    const el = listRef.current;
    if (el) el.addEventListener("scroll", handleScroll);
    return () => {
      if (el) el.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const { data: orders, isLoading } = trpc.order.list.useQuery();
  const { data: stats } = trpc.order.getStats.useQuery();
  const { data: salesReps } = trpc.customer.getSalesReps.useQuery();

  const utils = trpc.useContext();
  const updateStatus = trpc.order.updateStatus.useMutation({
    onSuccess: () => {
      utils.order.list.invalidate();
      utils.order.getStats.invalidate();
      utils.invoice.list.invalidate();
      utils.dashboard.stats.invalidate();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update status");
    },
  });

  const cancelOrder = trpc.order.updateStatus.useMutation({
    onSuccess: () => {
      utils.order.list.invalidate();
      utils.order.getStats.invalidate();
      utils.invoice.list.invalidate();
      utils.dashboard.stats.invalidate();
      toast.success("Order cancelled");
    },
  });

  const deleteOrder = trpc.order.delete.useMutation({
    onSuccess: () => {
      utils.order.list.invalidate();
      utils.order.getStats.invalidate();
      utils.dashboard.stats.invalidate();
      toast.success("Order deleted");
    },
  });

  const generateInvoice = trpc.invoice.generateForOrder.useMutation({
    onSuccess: (data) => {
      utils.order.list.invalidate();
      utils.invoice.list.invalidate();
      toast.success(`Invoice ${data} generated`);
    },
  });

  const repairOrders = trpc.order.repairOrders.useMutation({
    onSuccess: (data: any) => {
      utils.order.list.invalidate();
      utils.order.getStats.invalidate();
      toast.success(`Repaired ${data.repaired} of ${data.total} orders`);
      setRepairing(false);
    },
    onError: () => setRepairing(false),
  });

  const convertQuote = trpc.order.convertQuoteToOrder.useMutation({
    onSuccess: (data: any) => {
      if (data.error) {
        toast.error(data.error);
      } else {
        utils.order.list.invalidate();
        utils.order.getStats.invalidate();
        utils.invoice.list.invalidate();
        toast.success(`Quote converted to order ${data.order?.orderNumber}`);
      }
    },
  });

  // Scroll to top helper
  const scrollToTop = () => {
    listRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    let result = orders.filter((o: any) => {
      // Apply status tab filter
      if (activeTab === "all") return true;
      return (o.status || "pending") === activeTab;
    });

    // Apply search filter
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(
        (o: any) =>
          o.orderNumber?.toLowerCase().includes(q) ||
          o.customerName?.toLowerCase().includes(q) ||
          o.customer?.name?.toLowerCase().includes(q) ||
          o.items?.some((it: any) =>
            it.productName?.toLowerCase().includes(q)
          )
      );
    }

    // Apply company filter
    if (companyFilter !== "all") {
      result = result.filter((o: any) => (o.company || "sgf") === companyFilter);
    }

    // Apply sales rep filter
    if (salesRepFilter !== "all") {
      result = result.filter(
        (o: any) =>
          o.salesRepName === salesRepFilter ||
          o.customer?.salesRepName === salesRepFilter
      );
    }

    return result;
  }, [orders, activeTab, searchTerm, companyFilter, salesRepFilter]);

  const pendingCount = stats?.pending || 0;
  const pickingCount = stats?.picking || 0;
  const readyCount = stats?.ready || 0;
  const deliveredCount = stats?.delivered || 0;
  const cancelledCount =
    orders?.filter((o: any) => o.status === "cancelled").length || 0;

  // Print helpers
  const printOrder = (order: any) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const itemsHtml = (order.items || [])
      .map(
        (item: any) => `
      <tr>
        <td>${item.productName || item.productCode || "N/A"}</td>
        <td>${item.quantity}</td>
        <td>R ${(item.unitPrice || 0).toFixed(2)}</td>
        <td>R ${(item.lineTotal || 0).toFixed(2)}</td>
      </tr>
    `
      )
      .join("");

    printWindow.document.write(`
      <html>
        <head>
          <title>Order ${order.orderNumber}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { font-size: 24px; margin-bottom: 10px; }
            .info { margin-bottom: 20px; }
            .info p { margin: 5px 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
            th { background-color: #f5f5f5; font-weight: bold; }
            .total { margin-top: 20px; text-align: right; font-size: 18px; font-weight: bold; }
          </style>
        </head>
        <body>
          <h1>Order ${order.orderNumber}</h1>
          <div class="info">
            <p><strong>Customer:</strong> ${order.customerName || order.customer?.name || "N/A"}</p>
            <p><strong>Date:</strong> ${formatDate(order.createdAt)}</p>
            <p><strong>Status:</strong> ${order.status}</p>
            <p><strong>Delivery Address:</strong> ${order.deliveryAddress || "N/A"}</p>
          </div>
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Qty</th>
                <th>Unit Price</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
          <div class="total">
            Subtotal: R ${(order.subtotal || 0).toFixed(2)}<br/>
            VAT (15%): R ${(order.vatAmount || 0).toFixed(2)}<br/>
            <strong>Total: R ${(order.total || 0).toFixed(2)}</strong>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const exportToCSV = (order: any) => {
    const headers = ["Product", "Quantity", "Unit Price", "Line Total"];
    const rows = (order.items || []).map((item: any) => [
      item.productName || item.productCode || "N/A",
      item.quantity,
      (item.unitPrice || 0).toFixed(2),
      (item.lineTotal || 0).toFixed(2),
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `order-${order.orderNumber}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  function canCancelOrder(order: any): boolean {
    if (order.orderType === "quote") return false;
    return order.status !== "cancelled";
  }

  function canProgressOrder(order: any): boolean {
    if (order.orderType === "quote") return false;
    if (order.status === "converted" || order.status === "rejected") return false;
    if (order.status === "delivered" || order.status === "cancelled") return false;
    return true;
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {showForm && (
        <OrderForm
          onClose={() => setShowForm(false)}
          onSuccess={() => {
            setShowForm(false);
            utils.order.list.invalidate();
            utils.order.getStats.invalidate();
          }}
        />
      )}

      {showQuoteForm && (
        <OrderForm
          quoteMode
          onClose={() => setShowQuoteForm(false)}
          onSuccess={() => {
            setShowQuoteForm(false);
            utils.order.list.invalidate();
            utils.order.getStats.invalidate();
          }}
        />
      )}

      {editingOrder && (
        <EditOrderForm
          order={editingOrder}
          onClose={() => setEditingOrder(null)}
          onSuccess={() => {
            setEditingOrder(null);
            utils.order.list.invalidate();
            utils.order.getStats.invalidate();
          }}
        />
      )}

      {viewingInvoice && (
        <InvoiceView
          order={viewingInvoice}
          onClose={() => setViewingInvoice(null)}
        />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Orders</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage orders, track delivery status, and generate invoices.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRepairing(true)}
            disabled={repairing}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${repairing ? "animate-spin" : ""}`} />
            Repair
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowQuoteForm(true)}>
            <FileText className="w-4 h-4 mr-2" />
            New Quote
          </Button>
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4 mr-2" />
            New Order
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="p-4">
            <div className="text-sm text-muted-foreground">Pending</div>
            <div className="text-2xl font-bold">{pendingCount}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-muted-foreground">Picking</div>
            <div className="text-2xl font-bold">{pickingCount}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-muted-foreground">Ready</div>
            <div className="text-2xl font-bold">{readyCount}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-muted-foreground">Delivered</div>
            <div className="text-2xl font-bold">{deliveredCount}</div>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {statusTabs.map((tab) => (
            <Button
              key={tab.key}
              variant={activeTab === tab.key ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
              {tab.key === "pending" && pendingCount > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {pendingCount}
                </Badge>
              )}
              {tab.key === "picking" && pickingCount > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {pickingCount}
                </Badge>
              )}
              {tab.key === "ready" && readyCount > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {readyCount}
                </Badge>
              )}
              {tab.key === "delivered" && deliveredCount > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {deliveredCount}
                </Badge>
              )}
              {tab.key === "cancelled" && cancelledCount > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {cancelledCount}
                </Badge>
              )}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search orders..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 w-full sm:w-64"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-2.5 top-2.5"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowMobileFilter(!showMobileFilter)}
            className="sm:hidden"
          >
            <Filter className="w-4 h-4" />
          </Button>
          <select
            value={companyFilter}
            onChange={(e) => setCompanyFilter(e.target.value)}
            className="border rounded-md px-3 py-2 text-sm hidden sm:block"
          >
            <option value="all">All Companies</option>
            <option value="sgf">SGF</option>
            <option value="recircle">Recircle SA</option>
          </select>
          <select
            value={salesRepFilter}
            onChange={(e) => setSalesRepFilter(e.target.value)}
            className="border rounded-md px-3 py-2 text-sm hidden sm:block"
          >
            <option value="all">All Sales Reps</option>
            {(salesReps || []).map((rep: string) => (
              <option key={rep} value={rep}>
                {rep}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Mobile filter panel */}
      {showMobileFilter && (
        <div className="sm:hidden flex flex-col gap-2 p-3 border rounded-lg bg-muted/30">
          <select
            value={companyFilter}
            onChange={(e) => setCompanyFilter(e.target.value)}
            className="border rounded-md px-3 py-2 text-sm"
          >
            <option value="all">All Companies</option>
            <option value="sgf">SGF</option>
            <option value="recircle">Recircle SA</option>
          </select>
          <select
            value={salesRepFilter}
            onChange={(e) => setSalesRepFilter(e.target.value)}
            className="border rounded-md px-3 py-2 text-sm"
          >
            <option value="all">All Sales Reps</option>
            {(salesReps || []).map((rep: string) => (
              <option key={rep} value={rep}>
                {rep}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Repair dialog */}
      <AlertDialog open={repairing} onOpenChange={setRepairing}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Repair Orders</AlertDialogTitle>
            <AlertDialogDescription>
              This will recalculate totals and fix missing product names for all
              orders. Continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRepairing(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => repairOrders.mutate()}
              disabled={repairOrders.isLoading}
            >
              {repairOrders.isLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : null}
              Repair
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel dialog */}
      <AlertDialog open={!!cancelDialog} onOpenChange={() => setCancelDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Order</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel order{" "}
              <strong>{cancelDialog?.orderNumber}</strong>? This will restore
              stock quantities.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                cancelOrder.mutate({
                  id: cancelDialog.id,
                  status: "cancelled",
                });
                setCancelDialog(null);
              }}
            >
              Confirm Cancel
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete dialog */}
      <AlertDialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Order</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete order{" "}
              <strong>{deleteDialog?.orderNumber}</strong>? This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                deleteOrder.mutate({ id: deleteDialog.id });
                setDeleteDialog(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Orders list */}
      <div ref={listRef} className="relative space-y-3 max-h-[70vh] overflow-y-auto pr-1">
        {filteredOrders.length === 0 ? (
          <Card className="p-8 text-center">
            <Package className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <h3 className="text-lg font-medium">No orders found</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {searchTerm
                ? "Try adjusting your search or filters"
                : activeTab === "pending"
                ? "No pending orders. Create a new order to get started."
                : `No ${activeTab} orders.`}
            </p>
            {activeTab === "pending" && !searchTerm && (
              <Button className="mt-4" onClick={() => setShowForm(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Order
              </Button>
            )}
          </Card>
        ) : (
          filteredOrders.map((order: any) => {
            const isExpanded = expandedOrder === order.id;
            const statusLabel =
              STATUS_LABELS[order.status || "pending"] || {
                label: order.status || "Pending",
                color: "#6b7280",
              };

            return (
              <Card
                key={order.id}
                className={`overflow-hidden transition-all duration-200 ${
                  isExpanded ? "ring-2 ring-primary/20" : ""
                }`}
              >
                {/* Order header — always visible */}
                <div
                  className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() =>
                    setExpandedOrder(isExpanded ? null : order.id)
                  }
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-2 h-12 rounded-full"
                        style={{ backgroundColor: statusLabel.color }}
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-lg">
                            {order.orderNumber}
                          </h3>
                          <Badge
                            variant="outline"
                            style={{
                              borderColor: statusLabel.color,
                              color: statusLabel.color,
                            }}
                          >
                            {statusLabel.label}
                          </Badge>
                          {order.orderType && (
                            <Badge variant="secondary">
                              {ORDER_TYPE_LABELS[order.orderType] ||
                                order.orderType}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {order.customerName || order.customer?.name || "N/A"} ·{" "}
                          {formatDate(order.createdAt)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="font-semibold">
                          {formatCurrency(order.total)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {order.items?.length || 0} items
                        </div>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="border-t px-4 py-4 space-y-4">
                    {/* Status workflow */}
                    {canProgressOrder(order) && (
                      <div className="flex flex-wrap gap-2">
                        {canProgressOrder(order) && (order.status || "pending") === "pending" && (
                          <button
                            onClick={() =>
                              updateStatus.mutate({
                                id: order.id,
                                status: "picking",
                              })
                            }
                            className="btn-primary text-sm"
                          >
                            <Package className="w-4 h-4 mr-2" />
                            Mark Picking
                          </button>
                        )}
                        {canProgressOrder(order) && (order.status || "pending") === "picking" && (
                          <button
                            onClick={() =>
                              updateStatus.mutate({
                                id: order.id,
                                status: "ready",
                              })
                            }
                            className="btn-primary text-sm"
                          >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Mark Ready
                          </button>
                        )}
                        {canProgressOrder(order) && (order.status || "pending") === "ready" && (
                          <button
                            onClick={() =>
                              updateStatus.mutate({
                                id: order.id,
                                status: "delivered",
                              })
                            }
                            className="btn-primary text-sm"
                          >
                            <Truck className="w-4 h-4 mr-2" />
                            Mark Delivered
                          </button>
                        )}
                        {order.orderType === "quote" && order.status === "draft" && (
                          <>
                            <button
                              onClick={() =>
                                updateStatus.mutate({
                                  id: order.id,
                                  status: "sent",
                                })
                              }
                              className="btn-primary text-sm"
                            >
                              <CheckCircle className="w-4 h-4 mr-2" />
                              Mark Sent
                            </button>
                            <button
                              onClick={() =>
                                convertQuote.mutate(order.id)
                              }
                              className="btn-primary text-sm"
                            >
                              <FileText className="w-4 h-4 mr-2" />
                              Convert to Order
                            </button>
                          </>
                        )}
                        {order.orderType === "quote" && order.status === "sent" && (
                          <>
                            <button
                              onClick={() =>
                                updateStatus.mutate({
                                  id: order.id,
                                  status: "accepted",
                                })
                              }
                              className="btn-primary text-sm"
                            >
                              <CheckCircle className="w-4 h-4 mr-2" />
                              Mark Accepted
                            </button>
                            <button
                              onClick={() =>
                                updateStatus.mutate({
                                  id: order.id,
                                  status: "rejected",
                                })
                              }
                              className="btn-outline text-sm"
                            >
                              <X className="w-4 h-4 mr-2" />
                              Mark Rejected
                            </button>
                          </>
                        )}
                        {order.orderType === "quote" &&
                          order.status === "accepted" && (
                            <button
                              onClick={() => convertQuote.mutate(order.id)}
                              className="btn-primary text-sm"
                            >
                              <FileText className="w-4 h-4 mr-2" />
                              Convert to Order
                            </button>
                          )}
                        {canCancelOrder(order) && (
                          <button
                            onClick={() => setCancelDialog(order)}
                            className="btn-destructive text-sm"
                          >
                            <RotateCcw className="w-4 h-4 mr-2" />
                            Cancel Order
                          </button>
                        )}
                      </div>
                    )}

                    {/* Status flow visualization */}
                    <div className="flex items-center gap-1 text-xs">
                      {["pending", "picking", "ready", "delivered"].map(
                        (s, idx, arr) => {
                          const isCurrent = (order.status || "pending") === s;
                          const isPast =
                            arr.indexOf((order.status || "pending")) > arr.indexOf(s);
                          return (
                            <div key={s} className="flex items-center gap-1">
                              <span
                                className={`px-2 py-1 rounded-full ${
                                  isCurrent
                                    ? "bg-primary text-primary-foreground font-medium"
                                    : isPast
                                    ? "bg-green-100 text-green-700"
                                    : "bg-gray-100 text-gray-500"
                                }`}
                              >
                                {s.charAt(0).toUpperCase() + s.slice(1)}
                              </span>
                              {idx < arr.length - 1 && (
                                <span
                                  className={
                                    isPast ? "text-green-500" : "text-gray-300"
                                  }
                                >
                                  →
                                </span>
                              )}
                            </div>
                          );
                        }
                      )}
                    </div>

                    {/* Order items */}
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-muted">
                          <tr>
                            <th className="text-left px-3 py-2">Product</th>
                            <th className="text-right px-3 py-2">Qty</th>
                            <th className="text-right px-3 py-2">Unit</th>
                            <th className="text-right px-3 py-2">Unit Price</th>
                            <th className="text-right px-3 py-2">Line Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(order.items || []).map((item: any, idx: number) => (
                            <tr key={idx} className="border-t">
                              <td className="px-3 py-2">
                                <div className="font-medium">
                                  {item.productName || item.productCode || "N/A"}
                                </div>
                                {item.productCode && (
                                  <div className="text-xs text-muted-foreground">
                                    {item.productCode}
                                  </div>
                                )}
                              </td>
                              <td className="text-right px-3 py-2">
                                {item.quantity}
                              </td>
                              <td className="text-right px-3 py-2">
                                {item.unit || "each"}
                              </td>
                              <td className="text-right px-3 py-2">
                                {formatCurrency(item.unitPrice)}
                              </td>
                              <td className="text-right px-3 py-2 font-medium">
                                {formatCurrency(item.lineTotal)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-muted/50 font-medium">
                          <tr>
                            <td colSpan={4} className="text-right px-3 py-2">
                              Subtotal
                            </td>
                            <td className="text-right px-3 py-2">
                              {formatCurrency(order.subtotal)}
                            </td>
                          </tr>
                          <tr>
                            <td colSpan={4} className="text-right px-3 py-2">
                              VAT (15%)
                            </td>
                            <td className="text-right px-3 py-2">
                              {formatCurrency(order.vatAmount)}
                            </td>
                          </tr>
                          <tr className="text-base">
                            <td colSpan={4} className="text-right px-3 py-2">
                              Total
                            </td>
                            <td className="text-right px-3 py-2 font-bold">
                              {formatCurrency(order.total)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    {/* Order meta */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div>
                        <div className="text-muted-foreground">Customer</div>
                        <div className="font-medium">
                          {order.customerName || order.customer?.name || "N/A"}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Sales Rep</div>
                        <div className="font-medium">
                          {order.salesRepName ||
                            order.customer?.salesRepName ||
                            "N/A"}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">
                          Payment Terms
                        </div>
                        <div className="font-medium capitalize">
                          {order.paymentTerms || "COD"}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Company</div>
                        <div className="font-medium uppercase">
                          {order.company || "SGF"}
                        </div>
                      </div>
                      {order.deliveryDate && (
                        <div>
                          <div className="text-muted-foreground">
                            Delivery Date
                          </div>
                          <div className="font-medium">
                            {formatDate(order.deliveryDate)}
                          </div>
                        </div>
                      )}
                      {order.deliveryAddress && (
                        <div className="col-span-2 md:col-span-4">
                          <div className="text-muted-foreground">
                            Delivery Address
                          </div>
                          <div className="font-medium">
                            {order.deliveryAddress}
                          </div>
                        </div>
                      )}
                      {order.notes && (
                        <div className="col-span-2 md:col-span-4">
                          <div className="text-muted-foreground">Notes</div>
                          <div className="font-medium">{order.notes}</div>
                        </div>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-wrap gap-2 pt-2 border-t">
                      {canProgressOrder(order) && (order.status || "pending") === "pending" && <button onClick={() => updateStatus.mutate({ id: order.id, status: "picking" })} className="btn-primary text-xs"><Package className="w-3 h-3" /> Mark Picking</button>}
                      {canProgressOrder(order) && (order.status || "pending") === "picking" && <button onClick={() => updateStatus.mutate({ id: order.id, status: "ready" })} className="btn-primary text-xs"><CheckCircle className="w-3 h-3" /> Mark Ready</button>}
                      {canProgressOrder(order) && (order.status || "pending") === "ready" && <button onClick={() => updateStatus.mutate({ id: order.id, status: "delivered" })} className="btn-primary text-xs"><Truck className="w-3 h-3" /> Mark Delivered</button>}
                      {order.status === "delivered" && !order.invoiceNumber && (
                        <button
                          onClick={() => generateInvoice.mutate(order.id)}
                          className="btn-primary text-xs"
                          disabled={generateInvoice.isLoading}
                        >
                          {generateInvoice.isLoading ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <FileText className="w-3 h-3" />
                          )}
                          Generate Invoice
                        </button>
                      )}
                      {order.invoiceNumber && (
                        <button
                          onClick={() => setViewingInvoice(order)}
                          className="btn-outline text-xs"
                        >
                          <FileText className="w-3 h-3" /> View Invoice{" "}
                          {order.invoiceNumber}
                        </button>
                      )}
                      {order.status === "delivered" && (
                        <button
                          onClick={() => printOrder(order)}
                          className="btn-outline text-xs"
                        >
                          <Printer className="w-3 h-3" /> Print
                        </button>
                      )}
                      <button
                        onClick={() => exportToCSV(order)}
                        className="btn-outline text-xs"
                      >
                        <Download className="w-3 h-3" /> Export CSV
                      </button>
                      {isAdmin && (
                        <button
                          onClick={() => setEditingOrder(order)}
                          className="btn-outline text-xs"
                        >
                          Edit
                        </button>
                      )}
                      {isAdmin && (
                        <button
                          onClick={() => setDeleteDialog(order)}
                          className="btn-destructive text-xs"
                        >
                          <Trash2 className="w-3 h-3" /> Delete
                        </button>
                      )}
                      {isAdmin && order.status === "cancelled" && <button onClick={() => updateStatus.mutate({ id: order.id, status: "pending" })} className="btn-primary text-xs"><RotateCcw className="w-3 h-3" /> Re-activate</button>}
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(order.orderNumber);
                          toast.success("Order number copied");
                        }}
                        className="btn-outline text-xs"
                      >
                        <Copy className="w-3 h-3" /> Copy #
                      </button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })
        )}

        {/* Scroll to top button */}
        {showScrollTop && (
          <button
            onClick={scrollToTop}
            className="fixed bottom-6 right-6 z-50 bg-primary text-primary-foreground rounded-full p-3 shadow-lg hover:bg-primary/90 transition-colors"
          >
            <ChevronUp className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
}
