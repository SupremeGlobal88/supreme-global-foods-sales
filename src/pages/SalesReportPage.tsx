import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { trpc } from "@/providers/trpc";
import {
  Download, Search, Building2, Package, DollarSign,
  Calendar, Filter, FileSpreadsheet, Store, ShoppingCart,
  ChevronDown, ChevronUp, X, Loader2, BarChart3, Users
} from "lucide-react";

interface OrderItem {
  stockItemId?: string | number;
  productName?: string;
  productCode?: string;
  quantity?: number;
  unitPrice?: number;
  unit?: string;
  conversion?: number;
  unitLabel?: string;
  lineTotal?: number;
}

interface Order {
  id?: string | number;
  orderNumber?: string;
  customerId?: string | number;
  customerName?: string;
  items?: OrderItem[];
  status?: string;
  createdAt?: string;
  totalAmount?: number;
  orderType?: string;
  salesRepName?: string;
}

interface Customer {
  id?: number;
  name?: string;
  businessName?: string;
  customerCode?: string;
  groupName?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  city?: string;
  province?: string;
}

interface StockItem {
  id?: number;
  productCode?: string;
  productName?: string;
  category?: string;
  species?: string;
}

interface ProdSummary {
  productName: string;
  productCode: string;
  category: string;
  quantity: number;
  value: number;
}

interface StoreSummary {
  customerId: string;
  customerName: string;
  customerCode: string;
  groupName: string;
  contactPerson: string;
  phone: string;
  email: string;
  city: string;
  province: string;
  totalOrders: number;
  totalQuantity: number;
  totalValue: number;
  products: Map<string, ProdSummary>;
}

function safeString(val: unknown): string {
  if (val === null || val === undefined) return "";
  return String(val);
}

function safeNum(val: unknown): number {
  if (val === null || val === undefined) return 0;
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

export default function SalesReportPage() {
  const { user } = useAuth();

  const [groupFilter, setGroupFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedStore, setExpandedStore] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Cloud-first: load ALL data via tRPC so it syncs from Firebase first
  const { data: ordersData, isLoading: ordersLoading } = trpc.order.list.useQuery();
  const { data: customersData, isLoading: customersLoading } = trpc.customer.list.useQuery();
  const { data: stockItemsData, isLoading: stockLoading } = trpc.stock.search.useQuery({ query: " " });

  const orders: Order[] = ordersData || [];
  const customers: Customer[] = customersData || [];
  const stockItems: StockItem[] = stockItemsData || [];

  // Build lookup maps
  const customerMap = useMemo(() => {
    const map = new Map<string, Customer>();
    customers.forEach((c) => {
      if (c?.id !== undefined) map.set(String(c.id), c);
    });
    return map;
  }, [customers]);

  const stockMap = useMemo(() => {
    const map = new Map<string, StockItem>();
    stockItems.forEach((s) => {
      if (s?.id !== undefined) map.set(String(s.id), s);
    });
    return map;
  }, [stockItems]);

  // Resolve customer from order
  const resolveCustomer = (order: Order): { name: string; code: string; group: string; contact: string; phone: string; email: string; city: string; province: string } => {
    const storedName = safeString(order?.customerName).trim();
    const customer = customerMap.get(String(order?.customerId));
    const name = storedName || safeString(customer?.name || customer?.businessName).trim() || "Unknown";
    return {
      name,
      code: safeString(customer?.customerCode),
      group: safeString(customer?.groupName),
      contact: safeString(customer?.contactPerson),
      phone: safeString(customer?.phone),
      email: safeString(customer?.email),
      city: safeString(customer?.city),
      province: safeString(customer?.province),
    };
  };

  // Resolve product from order item
  const resolveProduct = (item: OrderItem): { name: string; code: string; category: string } => {
    const storedName = safeString(item?.productName).trim();
    const storedCode = safeString(item?.productCode).trim();
    if (storedName && storedName !== "Unknown") {
      return { name: storedName, code: storedCode || storedName, category: "" };
    }
    const stock = stockMap.get(String(item?.stockItemId));
    if (stock) {
      return {
        name: safeString(stock.productName || stock.productCode),
        code: safeString(stock.productCode),
        category: safeString(stock.category),
      };
    }
    const idStr = safeString(item?.stockItemId);
    return { name: idStr || "Unknown Product", code: idStr, category: "" };
  };

  // Extract unique group options
  const groupOptions = useMemo(() => {
    const groups = new Set<string>();
    customers.forEach((c) => {
      const group = safeString(c?.groupName).trim();
      if (group) groups.add(group);
    });
    return Array.from(groups).sort();
  }, [customers]);

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const cust = resolveCustomer(order);
      if (groupFilter) {
        const gf = groupFilter.toLowerCase();
        const nameMatch = cust.name.toLowerCase().startsWith(gf);
        const groupMatch = cust.group.toLowerCase().startsWith(gf);
        if (!nameMatch && !groupMatch) return false;
      }
      if (statusFilter !== "all" && safeString(order?.status) !== statusFilter) return false;
      const orderDate = order?.createdAt ? new Date(order.createdAt) : null;
      if (orderDate && !isNaN(orderDate.getTime())) {
        if (dateFrom) { const from = new Date(dateFrom); if (orderDate < from) return false; }
        if (dateTo) { const to = new Date(dateTo); to.setHours(23, 59, 59, 999); if (orderDate > to) return false; }
      }
      return true;
    });
  }, [orders, groupFilter, statusFilter, dateFrom, dateTo, customerMap]);

  // Build store summaries
  const storeSummaries = useMemo(() => {
    const map = new Map<string, StoreSummary>();
    filteredOrders.forEach((order) => {
      const cust = resolveCustomer(order);
      const key = String(order?.customerId || "unknown");
      if (!map.has(key)) {
        map.set(key, {
          customerId: key,
          customerName: cust.name,
          customerCode: cust.code,
          groupName: cust.group,
          contactPerson: cust.contact,
          phone: cust.phone,
          email: cust.email,
          city: cust.city,
          province: cust.province,
          totalOrders: 0,
          totalQuantity: 0,
          totalValue: 0,
          products: new Map(),
        });
      }
      const summary = map.get(key)!;
      summary.totalOrders += 1;
      order?.items?.forEach((item) => {
        const prod = resolveProduct(item);
        const qty = safeNum(item?.quantity);
        const price = safeNum(item?.unitPrice);
        const value = safeNum(item?.lineTotal) || qty * price;
        summary.totalQuantity += qty;
        summary.totalValue += value;
        const prodKey = prod.code || prod.name;
        if (!summary.products.has(prodKey)) {
          summary.products.set(prodKey, { productName: prod.name, productCode: prod.code, category: prod.category, quantity: 0, value: 0 });
        }
        const ps = summary.products.get(prodKey)!;
        ps.quantity += qty;
        ps.value += value;
      });
    });
    return Array.from(map.values()).sort((a, b) => b.totalValue - a.totalValue);
  }, [filteredOrders, customerMap, stockMap]);

  // Totals
  const totals = useMemo(() => {
    return storeSummaries.reduce((acc, s) => ({
      stores: acc.stores + 1,
      orders: acc.orders + s.totalOrders,
      quantity: acc.quantity + s.totalQuantity,
      value: acc.value + s.totalValue,
    }), { stores: 0, orders: 0, quantity: 0, value: 0 });
  }, [storeSummaries]);

  // All products
  const allProducts = useMemo(() => {
    const prodMap = new Map<string, ProdSummary>();
    storeSummaries.forEach((s) => {
      s.products.forEach((p, key) => {
        if (!prodMap.has(key)) prodMap.set(key, { ...p, quantity: 0, value: 0 });
        const existing = prodMap.get(key)!;
        existing.quantity += p.quantity;
        existing.value += p.value;
      });
    });
    return Array.from(prodMap.values()).sort((a, b) => b.value - a.value);
  }, [storeSummaries]);

  const toggleStore = (code: string) => {
    setExpandedStore((prev) => prev === code ? null : code);
  };

  const formatCurrency = (val: number): string => {
    try { return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", minimumFractionDigits: 2 }).format(safeNum(val)); }
    catch { return `R ${safeNum(val).toFixed(2)}`; }
  };

  const formatNumber = (val: number): string => {
    try { return new Intl.NumberFormat("en-ZA", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(safeNum(val)); }
    catch { return safeNum(val).toFixed(2); }
  };

  const formatDate = (val: string | undefined): string => {
    if (!val) return "";
    const d = new Date(val);
    if (isNaN(d.getTime())) return safeString(val);
    try { return d.toLocaleDateString("en-ZA"); } catch { return safeString(val); }
  };

  const isLoading = ordersLoading || customersLoading || stockLoading;

  // Top products for side panel
  const topProducts = useMemo(() => allProducts.slice(0, 8), [allProducts]);
  const maxProductValue = useMemo(() => topProducts.length > 0 ? topProducts[0].value : 1, [topProducts]);

  // ─── EXPORT TO EXCEL ───
  const handleExport = async () => {
    if (!filteredOrders.length) return;
    setIsExporting(true);
    try {
      const XLSX = await import("xlsx");
      const reportDate = new Date().toLocaleDateString("en-ZA");
      const groupLabel = groupFilter || "All Customers";

      // Cover
      const coverWs = XLSX.utils.aoa_to_sheet([
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
        ["Product by Store", "Quantities and values per product per store"],
        ["All Orders", "Raw order line items"],
      ]);
      coverWs["!cols"] = [{ wch: 30 }, { wch: 40 }];
      coverWs["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];
      XLSX.utils.book_append_sheet(wb, coverWs, "Cover");

      // Store Summary
      const storeRows = [["Store Code", "Store Name", "Group", "Contact", "Phone", "Email", "City", "Province", "Total Orders", "Total Quantity", "Total Value (R)"]];
      storeSummaries.forEach((s) => {
        storeRows.push([s.customerCode, s.customerName, s.groupName, s.contactPerson, s.phone, s.email, s.city, s.province, s.totalOrders, s.totalQuantity, s.totalValue]);
      });
      const storeWs = XLSX.utils.aoa_to_sheet(storeRows);
      storeWs["!cols"] = [{ wch: 14 }, { wch: 30 }, { wch: 16 }, { wch: 20 }, { wch: 16 }, { wch: 28 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 16 }];
      XLSX.utils.book_append_sheet(wb, storeWs, "Store Summary");

      // Product by Store
      const prodRows: (string | number)[][] = [["Store Name", "Product Code", "Product Name", "Category", "Quantity", "Unit Price (R)", "Total Value (R)"]];
      storeSummaries.forEach((s) => {
        Array.from(s.products.entries()).sort((a, b) => b[1].value - a[1].value).forEach(([, p]) => {
          const qty = safeNum(p.quantity);
          prodRows.push([s.customerName, p.productCode, p.productName, p.category, qty, qty > 0 ? p.value / qty : 0, p.value]);
        });
      });
      const prodWs = XLSX.utils.aoa_to_sheet(prodRows);
      prodWs["!cols"] = [{ wch: 30 }, { wch: 16 }, { wch: 35 }, { wch: 16 }, { wch: 12 }, { wch: 14 }, { wch: 16 }];
      XLSX.utils.book_append_sheet(wb, prodWs, "Product by Store");

      // All Orders
      const orderRows: (string | number)[][] = [["Order Number", "Order Date", "Store Code", "Store Name", "Group", "Product Code", "Product Name", "Category", "Quantity", "Unit", "Unit Price (R)", "Line Total (R)", "Order Total (R)", "Status", "Sales Rep"]];
      filteredOrders.forEach((order) => {
        const cust = resolveCustomer(order);
        order?.items?.forEach((item) => {
          const prod = resolveProduct(item);
          const qty = safeNum(item?.quantity);
          const price = safeNum(item?.unitPrice);
          orderRows.push([
            safeString(order?.orderNumber), formatDate(order?.createdAt), cust.code, cust.name, cust.group,
            prod.code, prod.name, prod.category, qty, safeString(item?.unit || item?.unitLabel), price,
            safeNum(item?.lineTotal) || qty * price, safeNum(order?.totalAmount), safeString(order?.status), safeString(order?.salesRepName),
          ]);
        });
      });
      const orderWs = XLSX.utils.aoa_to_sheet(orderRows);
      orderWs["!cols"] = [{ wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 30 }, { wch: 14 }, { wch: 16 }, { wch: 35 }, { wch: 16 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 18 }];
      XLSX.utils.book_append_sheet(wb, orderWs, "All Orders");

      const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([wbout], { type: "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Sales_Report_${groupLabel.replace(/\s+/g, "_").replace(/[^a-zA-Z0_\-]/g, "")}_${new Date().toISOString().slice(0, 10)}.xlsx`;
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
    <div className="min-h-screen p-4 lg:p-6 space-y-5">

      {/* ─── HEADER ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-semibold text-white flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 sm:w-7 sm:h-7" style={{ color: "#D4A843" }} />
            Sales Report
          </h1>
          <p className="text-[#8A8B8C] text-xs sm:text-sm mt-0.5">
            Export detailed sales data by customer group, store, and product.
          </p>
        </div>
        <button
          onClick={handleExport}
          disabled={!filteredOrders.length || isExporting || isLoading}
          className="btn-primary inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed self-start sm:self-auto"
        >
          {isExporting ? (
            <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Exporting...</>
          ) : (
            <><Download className="w-4 h-4" /> Export to Excel</>
          )}
        </button>
      </div>

      {/* ─── FILTERS ─── */}
      <div className="card p-3 lg:p-4">
        <div className="flex flex-wrap items-center gap-2 lg:gap-3">
          <Filter className="w-4 h-4 text-[#8A8B8C] flex-shrink-0" />

          {/* Group Filter */}
          <div className="relative flex-1 min-w-[180px] max-w-[240px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8A8B8C]" />
            <input
              type="text"
              list="group-options"
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value)}
              placeholder="Group e.g. OBC, Spar"
              className="input-field w-full pl-8 pr-7 py-2 text-xs"
            />
            <datalist id="group-options">{groupOptions.map((g) => (<option key={g} value={g} />))}</datalist>
            {groupFilter && (
              <button onClick={() => setGroupFilter("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#8A8B8C] hover:text-white">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Date From */}
          <div className="relative min-w-[140px]">
            <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8A8B8C]" />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="input-field w-full pl-8 py-2 text-xs"
            />
          </div>

          {/* Date To */}
          <div className="relative min-w-[140px]">
            <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8A8B8C]" />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="input-field w-full pl-8 py-2 text-xs"
            />
          </div>

          {/* Status */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input-field py-2 px-3 text-xs min-w-[120px]"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* ─── LOADING ─── */}
      {isLoading && (
        <div className="card p-10 text-center text-[#8A8B8C]">
          <Loader2 className="w-8 h-8 mx-auto mb-3 animate-spin" style={{ color: "#D4A843" }} />
          <p className="text-sm">Loading data from cloud...</p>
        </div>
      )}

      {!isLoading && (
        <>
          {/* ─── KPI CARDS ─── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
            <div className="card p-4 flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "rgba(212,168,67,0.12)" }}>
                <Store className="w-5 h-5" style={{ color: "#D4A843" }} />
              </div>
              <div>
                <div className="text-2xl font-display font-semibold text-white leading-none">{totals.stores}</div>
                <div className="text-xs text-[#8A8B8C] mt-1">Stores</div>
              </div>
            </div>
            <div className="card p-4 flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "rgba(74,144,217,0.12)" }}>
                <ShoppingCart className="w-5 h-5" style={{ color: "#4A90D9" }} />
              </div>
              <div>
                <div className="text-2xl font-display font-semibold text-white leading-none">{totals.orders}</div>
                <div className="text-xs text-[#8A8B8C] mt-1">Orders</div>
              </div>
            </div>
            <div className="card p-4 flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "rgba(99,190,123,0.12)" }}>
                <Package className="w-5 h-5" style={{ color: "#63BE7B" }} />
              </div>
              <div>
                <div className="text-2xl font-display font-semibold text-white leading-none">{formatNumber(totals.quantity)}</div>
                <div className="text-xs text-[#8A8B8C] mt-1">Total Qty</div>
              </div>
            </div>
            <div className="card p-4 flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "rgba(168,117,237,0.12)" }}>
                <DollarSign className="w-5 h-5" style={{ color: "#A875ED" }} />
              </div>
              <div>
                <div className="text-2xl font-display font-semibold text-white leading-none">{formatCurrency(totals.value)}</div>
                <div className="text-xs text-[#8A8B8C] mt-1">Total Value</div>
              </div>
            </div>
          </div>

          {/* ─── MAIN CONTENT GRID ─── */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 lg:gap-5">

            {/* LEFT: Store Table (2/3 width on xl) */}
            <div className="xl:col-span-2 space-y-4">
              <div className="card overflow-hidden">
                <div className="px-4 py-3 border-b border-[#222324] flex items-center justify-between">
                  <h2 className="font-display font-semibold text-white flex items-center gap-2 text-sm">
                    <Building2 className="w-4 h-4" style={{ color: "#D4A843" }} />
                    Store Breakdown
                    <span className="text-xs font-normal text-[#8A8B8C]">({storeSummaries.length} stores)</span>
                  </h2>
                </div>

                {storeSummaries.length === 0 ? (
                  <div className="p-8 text-center text-[#8A8B8C]">
                    <Store className="w-10 h-10 mx-auto mb-2 opacity-20" />
                    <p className="text-sm">No orders match the selected filters.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[#222324] text-[#8A8B8C] text-xs uppercase tracking-wider">
                          <th className="text-left px-4 py-2.5 w-10">#</th>
                          <th className="text-left px-4 py-2.5">Store</th>
                          <th className="text-left px-4 py-2.5 hidden lg:table-cell">Group</th>
                          <th className="text-center px-4 py-2.5">Orders</th>
                          <th className="text-right px-4 py-2.5">Qty</th>
                          <th className="text-right px-4 py-2.5">Value</th>
                          <th className="text-center px-4 py-2.5 w-10"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {storeSummaries.map((summary, idx) => {
                          const isExpanded = expandedStore === summary.customerId;
                          return (
                            <>
                              <tr
                                key={summary.customerId}
                                className="border-b border-[#222324]/40 hover:bg-[#131415]/60 transition-colors cursor-pointer"
                                onClick={() => toggleStore(summary.customerId)}
                              >
                                <td className="px-4 py-3 text-[#8A8B8C] text-xs">{idx + 1}</td>
                                <td className="px-4 py-3">
                                  <div className="font-medium text-white text-sm">{summary.customerName}</div>
                                  <div className="text-xs text-[#8A8B8C]">{summary.customerCode || summary.customerId}</div>
                                </td>
                                <td className="px-4 py-3 text-[#8A8B8C] text-sm hidden lg:table-cell">{summary.groupName || "—"}</td>
                                <td className="px-4 py-3 text-center">
                                  <span className="px-2 py-0.5 rounded-md text-xs font-medium" style={{ backgroundColor: "rgba(74,144,217,0.12)", color: "#4A90D9" }}>
                                    {summary.totalOrders}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-right text-white font-medium text-sm">{formatNumber(summary.totalQuantity)}</td>
                                <td className="px-4 py-3 text-right text-white font-medium text-sm">{formatCurrency(summary.totalValue)}</td>
                                <td className="px-4 py-3 text-center">
                                  {isExpanded ? <ChevronUp className="w-4 h-4 text-[#8A8B8C]" /> : <ChevronDown className="w-4 h-4 text-[#8A8B8C]" />}
                                </td>
                              </tr>
                              {isExpanded && (
                                <tr>
                                  <td colSpan={7} className="p-0">
                                    <div className="px-4 py-4 space-y-3" style={{ backgroundColor: "#0D0D0E" }}>
                                      <div className="flex items-center justify-between">
                                        <span className="text-xs font-medium text-[#8A8B8C] uppercase tracking-wider">Products Purchased</span>
                                        <span className="text-xs text-[#8A8B8C]">{summary.products.size} products</span>
                                      </div>
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {Array.from(summary.products.entries())
                                          .sort((a, b) => b[1].value - a[1].value)
                                          .map(([key, p]) => (
                                            <div key={key} className="flex items-center justify-between p-2.5 rounded-lg border border-[#222324] bg-[#131415]">
                                              <div className="min-w-0">
                                                <div className="text-sm text-white truncate">{p.productName}</div>
                                                <div className="text-xs text-[#8A8B8C]">{p.productCode} · {formatNumber(p.quantity)} units</div>
                                              </div>
                                              <div className="text-sm font-medium text-white ml-3 flex-shrink-0">{formatCurrency(p.value)}</div>
                                            </div>
                                          ))}
                                      </div>
                                      <div className="flex justify-end pt-1">
                                        <span className="text-xs text-[#8A8B8C]">
                                          Contact: {summary.contactPerson || "—"} · {summary.phone || "—"}
                                        </span>
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
                          <td className="px-4 py-3 font-semibold text-white text-sm" colSpan={3}>TOTAL</td>
                          <td className="px-4 py-3 text-center font-semibold text-sm" style={{ color: "#4A90D9" }}>{totals.orders}</td>
                          <td className="px-4 py-3 text-right font-semibold text-white text-sm">{formatNumber(totals.quantity)}</td>
                          <td className="px-4 py-3 text-right font-semibold text-white text-sm">{formatCurrency(totals.value)}</td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT: Product Summary (1/3 width on xl) */}
            <div className="space-y-4">
              <div className="card overflow-hidden">
                <div className="px-4 py-3 border-b border-[#222324] flex items-center justify-between">
                  <h2 className="font-display font-semibold text-white flex items-center gap-2 text-sm">
                    <BarChart3 className="w-4 h-4" style={{ color: "#D4A843" }} />
                    Top Products
                    <span className="text-xs font-normal text-[#8A8B8C]">({allProducts.length} total)</span>
                  </h2>
                </div>

                {allProducts.length === 0 ? (
                  <div className="p-6 text-center text-[#8A8B8C]">
                    <Package className="w-8 h-8 mx-auto mb-2 opacity-20" />
                    <p className="text-xs">No product data.</p>
                  </div>
                ) : (
                  <div className="p-3 space-y-2 max-h-[600px] overflow-y-auto">
                    {topProducts.map((p, idx) => {
                      const barWidth = maxProductValue > 0 ? (p.value / maxProductValue) * 100 : 0;
                      return (
                        <div key={p.productCode || p.productName} className="p-2.5 rounded-lg border border-[#222324] bg-[#131415]/50 hover:bg-[#131415] transition-colors">
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-xs text-[#8A8B8C] w-5 text-center">{idx + 1}</span>
                              <span className="text-sm text-white truncate">{p.productName}</span>
                            </div>
                            <span className="text-sm font-medium text-white flex-shrink-0 ml-2">{formatCurrency(p.value)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 rounded-full bg-[#222324] overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{ width: `${barWidth}%`, backgroundColor: "#D4A843" }}
                              />
                            </div>
                            <span className="text-xs text-[#8A8B8C] w-14 text-right">{formatNumber(p.quantity)} qty</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Group Summary Card */}
              <div className="card overflow-hidden">
                <div className="px-4 py-3 border-b border-[#222324]">
                  <h2 className="font-display font-semibold text-white flex items-center gap-2 text-sm">
                    <Users className="w-4 h-4" style={{ color: "#4A90D9" }} />
                    Group Summary
                  </h2>
                </div>
                <div className="p-3 space-y-2">
                  {Array.from(
                    storeSummaries.reduce((map, s) => {
                      const group = s.groupName || "Ungrouped";
                      if (!map.has(group)) map.set(group, { count: 0, value: 0, orders: 0 });
                      const g = map.get(group)!;
                      g.count += 1;
                      g.value += s.totalValue;
                      g.orders += s.totalOrders;
                      return map;
                    }, new Map<string, { count: number; value: number; orders: number }>())
                  )
                    .sort((a, b) => b[1].value - a[1].value)
                    .map(([group, data]) => (
                      <div key={group} className="flex items-center justify-between p-2.5 rounded-lg border border-[#222324] bg-[#131415]/50">
                        <div>
                          <div className="text-sm text-white">{group}</div>
                          <div className="text-xs text-[#8A8B8C]">{data.count} stores · {data.orders} orders</div>
                        </div>
                        <div className="text-sm font-medium text-white">{formatCurrency(data.value)}</div>
                      </div>
                    ))}
                  {storeSummaries.length === 0 && (
                    <div className="p-4 text-center text-[#8A8B8C] text-xs">No group data available.</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
