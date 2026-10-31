// =============================================================================
// DUPLICATE INVOICE NUMBER FIXER
// =============================================================================

export function fixDuplicateInvoiceNumbers(): { changes: Array<{ old: string; new: string; id: number; customer: string }> } {
  // NOTE: Do NOT call load() here — load() may call this function, causing infinite recursion.
  // This function is called during startup by load(), and also called standalone.
  // Calling load() here would create a stack overflow that blocks Chrome's main thread.
  const changes: Array<{ old: string; new: string; id: number; customer: string }> = [];

  const seen = new Map<string, number[]>();
  for (const inv of invoices) {
    const num = inv.invoiceNumber;
    if (!seen.has(num)) seen.set(num, []);
    seen.get(num)!.push(inv.id);
  }

  for (const [num, ids] of seen) {
    if (ids.length > 1) {
      for (let i = 1; i < ids.length; i++) {
        const invoice = invoices.find((inv) => inv.id === ids[i]);
        if (invoice) {
          const oldNum = invoice.invoiceNumber;
          const newNum = getNextInvoiceNumber();
          invoice.invoiceNumber = newNum;
          changes.push({
            old: oldNum,
            new: newNum,
            id: invoice.id,
            customer: getCustomerName(invoice.customerId),
          });
        }
      }
    }
  }

  if (changes.length > 0) {
    saveItem("sgf_invoices", invoices);
  }
  return { changes };
}

// =============================================================================
// DUPLICATE ORDER NUMBER FIXER
// =============================================================================

export function fixDuplicateOrderNumbers(): { changes: Array<{ old: string; new: string; id: number; customer: string }> } {
  const changes: Array<{ old: string; new: string; id: number; customer: string }> = [];

  const seen = new Map<string, number[]>();
  for (const order of orders) {
    const num = order.orderNumber;
    if (!seen.has(num)) seen.set(num, []);
    seen.get(num)!.push(order.id);
  }

  for (const [num, ids] of seen) {
    if (ids.length > 1) {
      for (let i = 1; i < ids.length; i++) {
        const order = orders.find((o) => o.id === ids[i]);
        if (order) {
          const oldNum = order.orderNumber;
          const newNum = generateOrderNumber(order.orderType);
          order.orderNumber = newNum;
          changes.push({
            old: oldNum,
            new: newNum,
            id: order.id,
            customer: getCustomerName(order.customerId),
          });
        }
      }
    }
  }

  if (changes.length > 0) {
    saveItem("sgf_orders", orders);
  }
  return { changes };
}

// =============================================================================
// BATCH INVOICE GENERATOR
// =============================================================================

export function generateBatchInvoices(orderIds: number[]): { success: number; failed: number; errors: string[] } {
  let success = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const orderId of orderIds) {
    const order = orders.find((o) => o.id === orderId);
    if (!order) {
      failed++;
      errors.push(`Order ${orderId} not found`);
      continue;
    }
    if (order.status === "cancelled") {
      failed++;
      errors.push(`Order ${order.orderNumber} is cancelled`);
      continue;
    }
    try {
      const invoice = invoiceService.create({
        customerId: order.customerId,
        orderId: order.id,
        items: order.items,
        total: order.total,
        priceTier: order.priceTier,
        salesRepName: order.salesRepName,
        invoiceDate: new Date().toISOString().slice(0, 10),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        status: "draft",
      });
      if (invoice) {
        success++;
      } else {
        failed++;
        errors.push(`Failed to create invoice for order ${order.orderNumber}`);
      }
    } catch (e) {
      failed++;
      errors.push(`Error creating invoice for order ${order.orderNumber}: ${String(e)}`);
    }
  }

  return { success, failed, errors };
}

// =============================================================================
// SALES TARGET / GOAL SERVICE
// =============================================================================

export const salesTargetService = {
  getTargets: () => {
    try {
      const raw = getStorageItem("sgf_salesTargets");
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return [];
  },
  setTarget: (repName: string, month: string, target: number) => {
    const targets = salesTargetService.getTargets();
    const existing = targets.find((t: any) => t.repName === repName && t.month === month);
    if (existing) {
      existing.target = target;
      existing.updatedAt = new Date().toISOString();
    } else {
      targets.push({
        id: Date.now() + Math.random(),
        repName,
        month,
        target,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    setStorageItem("sgf_salesTargets", JSON.stringify(targets));
    return targets;
  },
  getProgress: (repName: string, month: string) => {
    const targets = salesTargetService.getTargets();
    const target = targets.find((t: any) => t.repName === repName && t.month === month);
    if (!target) return { target: 0, actual: 0, percentage: 0 };
    const actual = orders
      .filter((o) => o.salesRepName === repName && o.orderDate?.startsWith(month))
      .reduce((sum, o) => sum + (o.total || 0), 0);
    return {
      target: target.target,
      actual,
      percentage: target.target > 0 ? Math.round((actual / target.target) * 100) : 0,
    };
  },
};

// =============================================================================
// COMMISSION CALCULATOR
// =============================================================================

export function calculateCommission(
  repName: string,
  startDate?: string,
  endDate?: string,
  rate: number = 0.05
): { totalSales: number; commission: number; orders: number } {
  let filtered = orders.filter((o) => o.salesRepName === repName);
  if (startDate) filtered = filtered.filter((o) => o.orderDate >= startDate);
  if (endDate) filtered = filtered.filter((o) => o.orderDate <= endDate);
  const totalSales = filtered.reduce((sum, o) => sum + (o.total || 0), 0);
  return {
    totalSales,
    commission: Math.round(totalSales * rate * 100) / 100,
    orders: filtered.length,
  };
}

// =============================================================================
// AGING REPORT
// =============================================================================

export function getAgingReport(): Array<{
  customerId: number;
  customerName: string;
  current: number;
  days30: number;
  days60: number;
  days90: number;
  days120: number;
  total: number;
}> {
  const now = new Date();
  const report = new Map<number, { current: number; days30: number; days60: number; days90: number; days120: number }>();

  for (const invoice of invoices) {
    if (invoice.status !== "sent" && invoice.status !== "partial") continue;
    const due = new Date(invoice.dueDate || invoice.invoiceDate);
    const daysOverdue = Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
    const balance = invoice.balanceDue || invoice.total || 0;
    if (balance <= 0) continue;

    const entry = report.get(invoice.customerId) || { current: 0, days30: 0, days60: 0, days90: 0, days120: 0 };
    if (daysOverdue <= 0) entry.current += balance;
    else if (daysOverdue <= 30) entry.days30 += balance;
    else if (daysOverdue <= 60) entry.days60 += balance;
    else if (daysOverdue <= 90) entry.days90 += balance;
    else entry.days120 += balance;
    report.set(invoice.customerId, entry);
  }

  return Array.from(report.entries()).map(([customerId, amounts]) => ({
    customerId,
    customerName: getCustomerName(customerId),
    ...amounts,
    total: amounts.current + amounts.days30 + amounts.days60 + amounts.days90 + amounts.days120,
  }));
}
