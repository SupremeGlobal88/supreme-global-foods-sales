import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import * as staticData from "@/data/staticData";
import {
  Download, Search, Building2, Package, DollarSign,
  Calendar, Filter, FileSpreadsheet, Store, ShoppingCart,
  TrendingUp, ChevronDown, ChevronUp, X
} from "lucide-react";

interface OrderItem {
  stockItemId: string;
  quantity: number;
  unitPrice: number;
  unit: string;
  conversion?: number;
  unitLabel?: string;
}

interface Order {
  id?: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  items: OrderItem[];
  status: string;
  createdAt: string;
  totalAmount: number;
  orderType?: string;
  paymentTerms?: string;
  priceTier?: string;
  deliveryAddress?: string;
  notes?: string;
  salesRepName?: string;
}

interface Customer {
  id: number;
  name: string;
  code: string;
  address?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  contact?: string;
  phone?: string;
  email?: string;
  businessReg?: string;
  vatNumber?: string;
  vatStatus?: string;
  isCorporate?: boolean;
  creditLimit?: number;
  paymentTerms?: string;
  priceTier?: string;
}

interface Product {
  id?: number;
  productCode: string;
  productName: string;
  category?: string;
  species?: string;
  corporatePrice?: number;
  bulkPrice?: number;
  wholesalePrice?: number;
  retailPrice?: number;
}

interface StoreSummary {
  customer: Customer;
  totalOrders: number;
  totalQuantity: number;
  totalValue: number;
  products: Map<string, { product: Product; quantity: number; value: number }>;
}

export default function SalesReportPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  const [orders, setOrders] = useState<Order[]>([]);
  const [groupFilter, setGroupFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedStores, setExpandedStores] = useState<Set<string>>(new Set());
  const [isExporting, setIsExporting] = useState(false);

  // Load orders from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem("sgf_orders");
      if (raw) {
        const parsed = JSON.parse(raw);
        setOrders(Array.isArray(parsed) ? parsed : []);
      }
    } catch {
      setOrders([]);
    }
  }, []);

  const customers = (staticData.STATIC_CUSTOMERS || []) as Customer[];
  const products = (staticData.STATIC_PRODUCTS || []) as Product[];

  const getProductById = (id: string): Product | undefined => {
    return products.find(
      (p) =>
        String(p.id) === String(id) ||
        p.productCode === id ||
        String(p.productName).toLowerCase().trim() === String(id).toLowerCase().trim()
    );
  };

  const getCustomerByCode = (code: string): Customer | undefined => {
    return customers.find((c) => c.code === code || String(c.id) === String(code));
  };

  // Extract unique customer group prefixes (first word of business name)
  const groupOptions = useMemo(() => {
    const groups = new Set<string>();
    customers.forEach((c) => {
      if (c.name) {
        const firstWord = c.name.split(/\s+/)[0];
        if (firstWord && firstWord.length > 1) groups.add(firstWord);
      }
    });
    return Array.from(groups).sort();
  }, [customers]);

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const customer = getCustomerByCode(order.customerId);
      const custName = customer?.name || order.customerName || "";

      // Group filter
      if (groupFilter && !custName.toLowerCase().startsWith(groupFilter.toLowerCase())) {
        return false;
      }

      // Status filter
      if (statusFilter !== "all" && order.status !== statusFilter) {
        return false;
      }

      // Date filter
      const orderDate = new Date(order.createdAt);
      if (dateFrom && orderDate < new Date(dateFrom)) return false;
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        if (orderDate > to) return false;
      }

      return true;
    });
  }, [orders, groupFilter, statusFilter, dateFrom, dateTo]);

  // Build store summaries
  const storeSummaries = useMemo(() => {
    const map = new Map<string, StoreSummary>();

    filteredOrders.forEach((order) => {
      const customer = getCustomerByCode(order.customerId);
      const key = customer?.code || order.customerId;

      if (!map.has(key)) {
        map.set(key, {
          customer: customer || ({
            id: 0,
            name: order.customerName || "Unknown",
            code: order.customerId,
          } as Customer),
          totalOrders: 0,
          totalQuantity: 0,
          totalValue: 0,
          products: new Map(),
        });
      }

      const summary = map.get(key)!;
      summary.totalOrders += 1;

      order.items?.forEach((item) => {
        const product = getProductById(item.stockItemId);
        const qty = Number(item.quantity) || 0;
        const price = Number(item.unitPrice) || 0;
        const value = qty * price;

        summary.totalQuantity += qty;
        summary.totalValue += value;

        const prodKey = product?.productCode || item.stockItemId;
        if (!summary.products.has(prodKey)) {
          summary.products.set(prodKey, {
            product: product || ({
              productCode: item.stockItemId,
              productName: item.stockItemId,
            } as Product),
            quantity: 0,
            value: 0,
          });
        }
        const prodSummary = summary.products.get(prodKey)!;
        prodSummary.quantity += qty;
        prodSummary.value += value;
      });
    });

    return Array.from(map.values()).sort((a, b) => b.totalValue - a.totalValue);
  }, [filteredOrders]);

  // Overall totals
  const totals = useMemo(() => {
    return storeSummaries.reduce(
      (acc, s) => ({
        stores: acc.stores + 1,
        orders: acc.orders + s.totalOrders,
        quantity: acc.quantity + s.totalQuantity,
        value: acc.value + s.totalValue,
      }),
      { stores: 0, orders: 0, quantity: 0, value: 0 }
    );
  }, [storeSummaries]);

  // All unique products across filtered orders
  const allProducts = useMemo(() => {
    const prodMap = new Map<string, Product>();
    storeSummaries.forEach((s) => {
      s.products.forEach((p, key) => {
        if (!prodMap.has(key)) prodMap.set(key, p.product);
      });
    });
    return Array.from(prodMap.values()).sort((a, b) =>
      a.productName.localeCompare(b.productName)
    );
  }, [storeSummaries]);

  const toggleStore = (code: string) => {
    setExpandedStores((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-ZA", {
      style: "currency",
      currency: "ZAR",
      minimumFractionDigits: 2,
    }).format(val);

  const formatNumber = (val: number) =>
    new Intl.NumberFormat("en-ZA", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(val);

  // ─── EXPORT TO EXCEL ───
  const handleExport = async () => {
    if (!filteredOrders.length) return;
    setIsExporting(true);
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();
      const reportDate = new Date().toLocaleDateString("en-ZA");
      const groupLabel = groupFilter || "All Customers";

      // ── Sheet 1: Cover ──
      const coverData = [
        ["SUPREME GLOBAL FOODS — SALES REPORT"],
        [],
        ["Report Date:", reportDate],
        ["Customer Group:", groupLabel],
        ["Date Range:", dateFrom && dateTo ? `${dateFrom} to ${dateTo}` : dateFrom ? `From ${dateFrom}` : dateTo ? `To ${dateTo}` : "All Dates"],
        ["Status Filter:", statusFilter === "all" ? "All Statuses" : statusFilter],
        [],
        ["KEY METRICS"],
        ["Total Stores:", totals.stores],
        ["Total Orders:", totals.orders],
        ["Total Quantity:", formatNumber(totals.quantity)],
        ["Total Value:", formatCurrency(totals.value)],
        [],
        ["SHEET INDEX"],
        ["Cover", "This summary page"],
        ["Store Summary", "List of all stores with totals"],
        ["Product by Store", "Quantities & values per product per store"],
        ["All Orders", "Raw order line items"],
      ];
      const coverWs = XLSX.utils.aoa_to_sheet(coverData);
      // Style cover sheet
      coverWs["!cols"] = [{ wch: 30 }, { wch: 40 }];
      coverWs["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];
      XLSX.utils.book_append_sheet(wb, coverWs, "Cover");

      // ── Sheet 2: Store Summary ──
      const storeRows = [
        [
          "Store Code", "Store Name", "Contact", "Phone", "Email",
          "City", "Province", "Total Orders", "Total Quantity", "Total Value (R)"
        ],
      ];
      storeSummaries.forEach((s) => {
        storeRows.push([
          s.customer.code || "",
          s.customer.name || "",
          s.customer.contact || "",
          s.customer.phone || "",
          s.customer.email || "",
          s.customer.city || "",
          s.customer.province || "",
          s.totalOrders,
          s.totalQuantity,
          s.totalValue,
        ]);
      });
      const storeWs = XLSX.utils.aoa_to_sheet(storeRows);
      storeWs["!cols"] = [
        { wch: 14 }, { wch: 30 }, { wch: 20 }, { wch: 16 }, { wch: 28 },
        { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 16 }
      ];
      XLSX.utils.book_append_sheet(wb, storeWs, "Store Summary");

      // ── Sheet 3: Product by Store ──
      const prodRows: (string | number)[][] = [
        ["Store Name", "Product Code", "Product Name", "Category", "Quantity", "Unit Price (R)", "Total Value (R)"],
      ];
      storeSummaries.forEach((s) => {
        const sortedProds = Array.from(s.products.entries()).sort(
          (a, b) => b[1].value - a[1].value
        );
        sortedProds.forEach(([, p]) => {
          prodRows.push([
            s.customer.name || "",
            p.product.productCode || "",
            p.product.productName || "",
            p.product.category || "",
            p.quantity,
            p.quantity > 0 ? p.value / p.quantity : 0,
            p.value,
          ]);
        });
      });
      const prodWs = XLSX.utils.aoa_to_sheet(prodRows);
      prodWs["!cols"] = [
        { wch: 30 }, { wch: 16 }, { wch: 35 }, { wch: 16 }, { wch: 12 }, { wch: 14 }, { wch: 16 }
      ];
      XLSX.utils.book_append_sheet(wb, prodWs, "Product by Store");

      // ── Sheet 4: All Orders ──
      const orderRows: (string | number)[][] = [
        [
          "Order Number", "Order Date", "Store Code", "Store Name",
          "Product Code", "Product Name", "Quantity", "Unit", "Unit Price (R)",
          "Line Total (R)", "Order Total (R)", "Status", "Sales Rep"
        ],
      ];
      filteredOrders.forEach((order) => {
        const customer = getCustomerByCode(order.customerId);
        order.items?.forEach((item) => {
          const product = getProductById(item.stockItemId);
          const qty = Number(item.quantity) || 0;
          const price = Number(item.unitPrice) || 0;
          orderRows.push([
            order.orderNumber || "",
            new Date(order.createdAt).toLocaleDateString("en-ZA"),
            customer?.code || order.customerId || "",
            customer?.name || order.customerName || "",
            product?.productCode || item.stockItemId || "",
            product?.productName || item.stockItemId || "",
            qty,
            item.unit || item.unitLabel || "",
            price,
            qty * price,
            order.totalAmount || 0,
            order.status || "",
            order.salesRepName || "",
          ]);
        });
      });
      const orderWs = XLSX.utils.aoa_to_sheet(orderRows);
      orderWs["!cols"] = [
        { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 30 }, { wch: 16 },
        { wch: 35 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 14 },
        { wch: 14 }, { wch: 12 }, { wch: 18 }
      ];
      XLSX.utils.book_append_sheet(wb, orderWs, "All Orders");

      // Download
      const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([wbout], { type: "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Sales_Report_${groupLabel.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed:", err);
      alert("Export failed. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-white flex items-center gap-2">
            <FileSpreadsheet className="w-7 h-7" style={{ color: "#D4A843" }} />
            Sales Report
          </h1>
          <p className="text-[#8A8B8C] text-sm mt-1">
            Export detailed sales data by customer group, store, and product.
          </p>
        </div>
        <button
          onClick={handleExport}
          disabled={!filteredOrders.length || isExporting}
          className="btn-primary inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isExporting ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Exporting...
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              Export to Excel
            </>
          )}
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4 space-y-4">
        <div className="flex items-center gap-2 text-[#8A8B8C] text-sm mb-2">
          <Filter className="w-4 h-4" />
          <span className="font-medium">Filters</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Customer Group */}
          <div>
            <label className="block text-xs text-[#8A8B8C] mb-1.5">Customer Group</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8B8C]" />
              <input
                type="text"
                list="group-options"
                value={groupFilter}
                onChange={(e) => setGroupFilter(e.target.value)}
                placeholder="e.g. OBC, Spar, Superspar"
                className="input-field w-full pl-9 text-sm"
              />
              <datalist id="group-options">
                {groupOptions.map((g) => (
                  <option key={g} value={g} />
                ))}
              </datalist>
              {groupFilter && (
                <button
                  onClick={() => setGroupFilter("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8A8B8C] hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Date From */}
          <div>
            <label className="block text-xs text-[#8A8B8C] mb-1.5">Date From</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8B8C]" />
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="input-field w-full pl-9 text-sm"
              />
            </div>
          </div>

          {/* Date To */}
          <div>
            <label className="block text-xs text-[#8A8B8C] mb-1.5">Date To</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8B8C]" />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="input-field w-full pl-9 text-sm"
              />
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs text-[#8A8B8C] mb-1.5">Order Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input-field w-full text-sm"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: "rgba(212,168,67,0.15)" }}>
              <Store className="w-5 h-5" style={{ color: "#D4A843" }} />
            </div>
            <div>
              <div className="text-2xl font-display font-semibold text-white">{totals.stores}</div>
              <div className="text-xs text-[#8A8B8C]">Stores</div>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: "rgba(74,144,217,0.15)" }}>
              <ShoppingCart className="w-5 h-5" style={{ color: "#4A90D9" }} />
            </div>
            <div>
              <div className="text-2xl font-display font-semibold text-white">{totals.orders}</div>
              <div className="text-xs text-[#8A8B8C]">Orders</div>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: "rgba(99,190,123,0.15)" }}>
              <Package className="w-5 h-5" style={{ color: "#63BE7B" }} />
            </div>
            <div>
              <div className="text-2xl font-display font-semibold text-white">{formatNumber(totals.quantity)}</div>
              <div className="text-xs text-[#8A8B8C]">Total Quantity</div>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: "rgba(168,117,237,0.15)" }}>
              <DollarSign className="w-5 h-5" style={{ color: "#A875ED" }} />
            </div>
            <div>
              <div className="text-2xl font-display font-semibold text-white">{formatCurrency(totals.value)}</div>
              <div className="text-xs text-[#8A8B8C]">Total Value</div>
            </div>
          </div>
        </div>
      </div>

      {/* Store List Table */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-[#222324] flex items-center justify-between">
          <h2 className="font-display font-semibold text-white flex items-center gap-2">
            <Building2 className="w-5 h-5" style={{ color: "#D4A843" }} />
            Store Breakdown
            <span className="text-sm font-normal text-[#8A8B8C]">({storeSummaries.length} stores)</span>
          </h2>
        </div>

        {storeSummaries.length === 0 ? (
          <div className="p-8 text-center text-[#8A8B8C]">
            <Store className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No orders match the selected filters.</p>
            <p className="text-sm mt-1">Try adjusting your filters or create some orders first.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#222324] text-[#8A8B8C] text-xs uppercase tracking-wider">
                  <th className="text-left p-3">Store</th>
                  <th className="text-left p-3">Contact</th>
                  <th className="text-center p-3">Orders</th>
                  <th className="text-right p-3">Quantity</th>
                  <th className="text-right p-3">Total Value</th>
                  <th className="text-center p-3 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {storeSummaries.map((summary) => {
                  const isExpanded = expandedStores.has(summary.customer.code || "");
                  return (
                    <>
                      <tr
                        key={summary.customer.code}
                        className="border-b border-[#222324]/50 hover:bg-[#131415] transition-colors cursor-pointer"
                        onClick={() => toggleStore(summary.customer.code || "")}
                      >
                        <td className="p-3">
                          <div className="font-medium text-white">{summary.customer.name}</div>
                          <div className="text-xs text-[#8A8B8C]">{summary.customer.code}</div>
                        </td>
                        <td className="p-3 text-[#8A8B8C]">
                          <div>{summary.customer.contact || "—"}</div>
                          <div className="text-xs">{summary.customer.phone || "—"}</div>
                        </td>
                        <td className="p-3 text-center">
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: "rgba(74,144,217,0.15)", color: "#4A90D9" }}>
                            {summary.totalOrders}
                          </span>
                        </td>
                        <td className="p-3 text-right text-white font-medium">
                          {formatNumber(summary.totalQuantity)}
                        </td>
                        <td className="p-3 text-right text-white font-medium">
                          {formatCurrency(summary.totalValue)}
                        </td>
                        <td className="p-3 text-center">
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-[#8A8B8C]" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-[#8A8B8C]" />
                          )}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={6} className="p-0">
                            <div className="p-4 space-y-3" style={{ backgroundColor: "#0D0D0E" }}>
                              <div className="text-xs font-medium text-[#8A8B8C] uppercase tracking-wider mb-2">
                                Products Purchased
                              </div>
                              <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="border-b border-[#222324] text-[#8A8B8C]">
                                      <th className="text-left p-2">Product</th>
                                      <th className="text-left p-2">Code</th>
                                      <th className="text-right p-2">Qty</th>
                                      <th className="text-right p-2">Value</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {Array.from(summary.products.entries())
                                      .sort((a, b) => b[1].value - a[1].value)
                                      .map(([key, p]) => (
                                        <tr key={key} className="border-b border-[#222324]/30">
                                          <td className="p-2 text-white">{p.product.productName}</td>
                                          <td className="p-2 text-[#8A8B8C]">{p.product.productCode}</td>
                                          <td className="p-2 text-right text-white">{formatNumber(p.quantity)}</td>
                                          <td className="p-2 text-right text-white">{formatCurrency(p.value)}</td>
                                        </tr>
                                      ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-[#222324]" style={{ backgroundColor: "#131415" }}>
                  <td className="p-3 font-semibold text-white" colSpan={2}>TOTAL</td>
                  <td className="p-3 text-center font-semibold" style={{ color: "#4A90D9" }}>{totals.orders}</td>
                  <td className="p-3 text-right font-semibold text-white">{formatNumber(totals.quantity)}</td>
                  <td className="p-3 text-right font-semibold text-white">{formatCurrency(totals.value)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Product Summary Table */}
      {allProducts.length > 0 && (
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-[#222324]">
            <h2 className="font-display font-semibold text-white flex items-center gap-2">
              <Package className="w-5 h-5" style={{ color: "#D4A843" }} />
              Product Summary
              <span className="text-sm font-normal text-[#8A8B8C]">({allProducts.length} products)</span>
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#222324] text-[#8A8B8C] text-xs uppercase tracking-wider">
                  <th className="text-left p-3">Product</th>
                  <th className="text-left p-3">Code</th>
                  <th className="text-left p-3">Category</th>
                  <th className="text-right p-3">Total Qty</th>
                  <th className="text-right p-3">Total Value</th>
                  <th className="text-right p-3"># Stores</th>
                </tr>
              </thead>
              <tbody>
                {allProducts.map((product) => {
                  let totalQty = 0;
                  let totalValue = 0;
                  let storeCount = 0;
                  storeSummaries.forEach((s) => {
                    const match = Array.from(s.products.values()).find(
                      (p) => p.product.productCode === product.productCode
                    );
                    if (match) {
                      totalQty += match.quantity;
                      totalValue += match.value;
                      storeCount++;
                    }
                  });
                  return (
                    <tr key={product.productCode} className="border-b border-[#222324]/50 hover:bg-[#131415]">
                      <td className="p-3 text-white">{product.productName}</td>
                      <td className="p-3 text-[#8A8B8C]">{product.productCode}</td>
                      <td className="p-3 text-[#8A8B8C]">{product.category || "—"}</td>
                      <td className="p-3 text-right text-white font-medium">{formatNumber(totalQty)}</td>
                      <td className="p-3 text-right text-white font-medium">{formatCurrency(totalValue)}</td>
                      <td className="p-3 text-right">
                        <span className="px-2 py-0.5 rounded-full text-xs" style={{ backgroundColor: "rgba(212,168,67,0.15)", color: "#D4A843" }}>
                          {storeCount}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Info banner */}
      <div className="card p-4 flex items-start gap-3" style={{ backgroundColor: "rgba(212,168,67,0.05)" }}>
        <TrendingUp className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: "#D4A843" }} />
        <div className="text-sm text-[#8A8B8C]">
          <p className="text-white font-medium mb-1">About this report</p>
          <p>This report reads from your local order data and shows sales grouped by customer group (e.g., OBC, Spar, Superspar). Use the filters above to narrow down results, then click <strong className="text-white">Export to Excel</strong> to download a multi-sheet workbook with Store Summary, Product by Store, and All Orders.</p>
        </div>
      </div>
    </div>
  );
}
