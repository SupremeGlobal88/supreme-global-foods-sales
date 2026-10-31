        sageOutstanding,
      };
    },
  
    generateInvoiceForOrder,
    matchBankPayments,
    parseBankStatement,
    allocateBankPayments,
    fixDraftInvoices: fixDraftInvoicesForDeliveredOrders,
    fixDuplicateInvoiceNumbers,
    repairInvoiceCompanies,
    repairPurchaseOrderCompanies,
    repairCancelledInvoiceBalances,
    repairAllInvoiceStatuses,
    repairAllInvoiceTotals,
    repairAllOrderTotals,
    createCorporateOrder,
    createPurchaseOrderFromOrder,
    updateInvoiceFromOrder,
    createInvoiceFromOrder,
    getCustomerOutstandingBalance,
    getCorporateCustomerOutstandingBalance,
    getNextInvoiceNumberForCompany,
    getAvailableStock,
    getCommittedStock,
    hasExistingSample,
    getEffectivePrice,
    logSystemEvent,
    notifyOrderChange,
    getOrderById,
    getInvoiceForOrder,
    generatePurchaseOrderNumber,
    generateSampleOrderNumber,
    createOrder,
    checkCustomerCanOrder,
    buildInvoiceItemDescription,
  };
}

const dataService = buildDataService();
export default dataService;

/* ═════════════════════════════════════════════════════════════════════════════
   REPORTING & ANALYTICS HELPERS
   ═════════════════════════════════════════════════════════════════════════════ */

export const reportService = {
  /** Daily snapshot: orders created, invoices generated, payments received, new customers */
  getDailyReport: (dateStr?: string) => {
    const targetDate = dateStr ? new Date(dateStr) : new Date();
    const dateKey = targetDate.toDateString();
    const dayOrders = orders.filter((o) => new Date(o.createdAt).toDateString() === dateKey);
    const dayInvoices = invoices.filter((i) => new Date(i.createdAt).toDateString() === dateKey);
    const dayReceipts = receipts.filter((r) => new Date(r.createdAt).toDateString() === dateKey);
    const dayCustomers = customers.filter((c) => new Date(c.createdAt).toDateString() === dateKey);
    return {
      date: dateKey,
      orders: { count: dayOrders.length, value: dayOrders.reduce((s, o) => s + (o.total || 0), 0) },
      invoices: { count: dayInvoices.length, value: dayInvoices.reduce((s, i) => s + (i.total || 0), 0) },
      receipts: { count: dayReceipts.length, value: dayReceipts.reduce((s, r) => s + (r.amount || 0), 0) },
      customers: { count: dayCustomers.length },
    };
  },
  /** Weekly summary: group by day of week */
  getWeeklyReport: (weekStart?: string) => {
    const start = weekStart ? new Date(weekStart) : new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - start.getDay()); // Sunday
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const days: any[] = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dayReport = reportService.getDailyReport(d.toISOString().slice(0, 10));
      days.push(dayReport);
    }
    return { weekStart: start.toISOString().slice(0, 10), weekEnd: end.toISOString().slice(0, 10), days };
  },
  /** Monthly summary: group by week */
  getMonthlyReport: (monthStr?: string) => {
    const [year, month] = (monthStr || new Date().toISOString().slice(0, 7)).split("-").map(Number);
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0);
    const weeks: any[] = [];
    let currentWeek: any[] = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dayReport = reportService.getDailyReport(d.toISOString().slice(0, 10));
      currentWeek.push(dayReport);
      if (d.getDay() === 6 || d.getTime() === end.getTime()) {
        weeks.push({
          weekStart: currentWeek[0]?.date,
          weekEnd: currentWeek[currentWeek.length - 1]?.date,
          days: currentWeek,
        });
        currentWeek = [];
      }
    }
    return { month: monthStr || new Date().toISOString().slice(0, 7), weeks };
  },
  /** Top customers by total orders/value */
  getTopCustomers: (limit: number = 10) => {
    const customerTotals: Record<number, { customer: any; totalOrders: number; totalValue: number }> = {};
    for (const order of orders) {
      if (order.status === "cancelled" || order.orderType === "quote") continue;
      const cid = order.customerId;
      if (!customerTotals[cid]) {
        const customer = customers.find((c) => c.id == cid);
        customerTotals[cid] = { customer, totalOrders: 0, totalValue: 0 };
      }
      customerTotals[cid].totalOrders++;
      customerTotals[cid].totalValue += order.total || 0;
    }
    return Object.values(customerTotals)
      .sort((a, b) => b.totalValue - a.totalValue)
      .slice(0, limit);
  },
  /** Top products by total quantity sold */
  getTopProducts: (limit: number = 10) => {
    const productTotals: Record<number, { product: any; totalQty: number; totalRevenue: number }> = {};
    for (const order of orders) {
      if (order.status === "cancelled" || order.orderType === "quote") continue;
      for (const item of (order.items || [])) {
        const pid = item.stockItemId;
        if (!productTotals[pid]) {
          const product = products.find((p) => p.id == pid);
          productTotals[pid] = { product, totalQty: 0, totalRevenue: 0 };
        }
        productTotals[pid].totalQty += item.quantity || 0;
        productTotals[pid].totalRevenue += item.lineTotal || 0;
      }
    }
    return Object.values(productTotals)
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, limit);
  },
  /** Sales rep performance summary */
  getRepPerformance: (from?: string, to?: string) => {
    const fromTs = from ? new Date(from + "T00:00:00").getTime() : 0;
    const toTs = to ? new Date(to + "T23:59:59").getTime() : Date.now();
    const repStats: Record<string, { repName: string; orders: number; totalValue: number; customers: Set<number> }> = {};
    for (const order of orders) {
      const ts = new Date(order.createdAt).getTime();
      if (ts < fromTs || ts > toTs || order.status === "cancelled" || order.orderType === "quote") continue;
      const customer = customers.find((c) => c.id == order.customerId);
      const repName = customer?.salesRepName || "Unassigned";
      if (!repStats[repName]) {
        repStats[repName] = { repName, orders: 0, totalValue: 0, customers: new Set() };
      }
      repStats[repName].orders++;
      repStats[repName].totalValue += order.total || 0;
      repStats[repName].customers.add(order.customerId);
    }
    return Object.values(repStats)
      .map((s) => ({ ...s, customers: s.customers.size }))
      .sort((a, b) => b.totalValue - a.totalValue);
  },
  /** Customer activity heatmap: orders per day */
  getCustomerActivityHeatmap: (customerId: number) => {
    const customerOrders = orders
      .filter((o) => o.customerId == customerId && o.status !== "cancelled" && o.orderType !== "quote")
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    const activity: Record<string, { date: string; orders: number; totalValue: number }> = {};
    for (const order of customerOrders) {
      const date = order.createdAt.slice(0, 10);
      if (!activity[date]) {
        activity[date] = { date, orders: 0, totalValue: 0 };
      }
      activity[date].orders++;
      activity[date].totalValue += order.total || 0;
    }
    return Object.values(activity);
  },
  /** Stock movement summary: products with most movement */
  getStockMovement: (from?: string, to?: string) => {
    const fromTs = from ? new Date(from + "T00:00:00").getTime() : 0;
    const toTs = to ? new Date(to + "T23:59:59").getTime() : Date.now();
    const movement: Record<number, { product: any; in: number; out: number; net: number }> = {};
    // Outgoing: orders
    for (const order of orders) {
      const ts = new Date(order.createdAt).getTime();
      if (ts < fromTs || ts > toTs || order.status === "cancelled" || order.orderType === "quote") continue;
      for (const item of (order.items || [])) {
        const pid = item.stockItemId;
        if (!movement[pid]) {
          const product = products.find((p) => p.id == pid);
          movement[pid] = { product, in: 0, out: 0, net: 0 };
        }
        movement[pid].out += item.quantity || 0;
        movement[pid].net -= item.quantity || 0;
      }
    }
    // Incoming: stock uploads (we don't track this separately, so we use current SOH + outgoing)
    for (const product of products) {
      const pid = product.id;
      if (!movement[pid]) {
        movement[pid] = { product, in: 0, out: 0, net: 0 };
      }
      // Approximate incoming = current stock + outgoing (assuming starting from 0)
      movement[pid].in = (product.quantity || 0) + movement[pid].out;
      movement[pid].net = (product.quantity || 0);
    }
    return Object.values(movement).sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
  },
};

/* ═════════════════════════════════════════════════════════════════════════════
   UTILITY EXPORTS
   ═════════════════════════════════════════════════════════════════════════════ */

export {
  customers,
  products,
  orders,
  invoices,
  receipts,
  creditNotes,
  purchaseOrders,
  corporateCustomers,
  priceTiers,
  specialPrices,
  deliveryRoutes,
  geoCheckins,
  accountHolds,
  sageCustomers,
  sageInvoices,
  sagePayments,
  users,
  roles,
  permissions,
  systemLogs,
  auditLogs,
  activityLogs,
  notificationLogs,
  customFields,
  fieldValues,
  workflows,
  workflowInstances,
  approvalWorkflows,
  approvalRequests,
  notificationTemplates,
  reminders,
  calendarEvents,
  notes,
  comments,
  attachments,
  tags,
  tagAssignments,
  logRecords,
  printTemplates,
  emailTemplates,
  smsTemplates,
};

export const dataServiceExport = {
  customers,
  products,
  orders,
  invoices,
  receipts,
  creditNotes,
  purchaseOrders,
  corporateCustomers,
  priceTiers,
  specialPrices,
  deliveryRoutes,
  geoCheckins,
  accountHolds,
  sageCustomers,
  sageInvoices,
  sagePayments,
  users,
  roles,
  permissions,
  systemLogs,
  auditLogs,
  activityLogs,
  notificationLogs,
  customFields,
  fieldValues,
  workflows,
  workflowInstances,
  approvalWorkflows,
  approvalRequests,
  notificationTemplates,
  reminders,
  calendarEvents,
  notes,
  comments,
  attachments,
  tags,
  tagAssignments,
  logRecords,
  printTemplates,
  emailTemplates,
  smsTemplates,
};
