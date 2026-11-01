    // Fallback: match by customer name in notes or items
    const customerName = (inv as any).customerName || (inv.notes || "").replace(/Historical import from Sage/g, "").trim();
    if (customerName) {
      const fuzzyMatch = customers.find((c) =>
        c.name && c.name.toLowerCase().includes(customerName.toLowerCase().slice(0, 8))
      );
      if (fuzzyMatch) {
        inv.customerId = fuzzyMatch.id;
        inv.customer = fuzzyMatch;
        inv.customerCode = fuzzyMatch.customerCode;
        changed = true;
      }
    }
  }
  if (changed) saveItem("sgf_invoices", invoices);
}

/** Deduplicate orders by orderNumber and invoices by invoiceNumber.
 *  Keeps the most recent record (by updatedAt > createdAt > id).
 *  This fixes duplicates created when Firebase sync treated number/string IDs as different keys. */
function deduplicateAll(): { ordersRemoved: number; invoicesRemoved: number; customersRemoved: number } {
  const beforeOrders = orders.length;
  const beforeInvoices = invoices.length;
  const beforeCustomers = customers.length;

  // Deduplicate orders: group by orderNumber, keep most recent
  const orderMap = new Map<string, any>();
  for (const o of orders) {
    if (!o) continue; // null-guard
    const key = o.orderNumber || o.id;
    const existing = orderMap.get(key);
    if (!existing || isMoreRecent(o, existing)) {
      orderMap.set(key, o);
    }
  }
  orders = Array.from(orderMap.values());

  // Deduplicate invoices: group by invoiceNumber (for SGF), keep most recent
  const invMap = new Map<string, any>();
  for (const inv of invoices) {
    if (!inv) continue; // null-guard
    const key = inv.invoiceNumber || inv.id;
    const existing = invMap.get(key);
    if (!existing || isMoreRecent(inv, existing)) {
      invMap.set(key, inv);
    }
  }
  invoices = Array.from(invMap.values());

  // Deduplicate customers: group by normalized name, keep most recent
  const custMap = new Map<string, any>();
  for (const c of customers) {
    const key = ((c.name || "") + "|" + (c.phone || "")).toString().trim().replace(/\s+/g, " ").toLowerCase();
    if (!key) continue; // skip customers with no name
    const existing = custMap.get(key);
    if (!existing || isMoreRecent(c, existing)) {
      custMap.set(key, c);
    }
  }
  customers = Array.from(custMap.values());

  const result = {
    ordersRemoved: beforeOrders - orders.length,
    invoicesRemoved: beforeInvoices - invoices.length,
    customersRemoved: beforeCustomers - customers.length,
  };

  if (result.ordersRemoved > 0 || result.invoicesRemoved > 0 || result.customersRemoved > 0) {
    logSystemEvent("WARN", "deduplicateAll", `Removed ${result.ordersRemoved} duplicate orders, ${result.invoicesRemoved} duplicate invoices, ${result.customersRemoved} duplicate customers`, { ordersRemoved: result.ordersRemoved, invoicesRemoved: result.invoicesRemoved, customersRemoved: result.customersRemoved, ordersRemaining: orders.length, invoicesRemaining: invoices.length, customersRemaining: customers.length });
    if (result.ordersRemoved > 0) logAudit("DELETE", "order", 0, `deduplicateAll removed ${result.ordersRemoved} duplicate orders. Remaining: ${orders.length}`);
    if (result.invoicesRemoved > 0) logAudit("DELETE", "invoice", 0, `deduplicateAll removed ${result.invoicesRemoved} duplicate invoices. Remaining: ${invoices.length}`);
    if (result.customersRemoved > 0) logAudit("DELETE", "customer", 0, `deduplicateAll removed ${result.customersRemoved} duplicate customers. Remaining: ${customers.length}`);
    saveItem("sgf_orders", orders);
    saveItem("sgf_invoices", invoices);
    saveItem("sgf_customers", customers);
  }

  return result;
}

/** Check if item a is more recent than item b */
function isMoreRecent(a: any, b: any): boolean {
  const aTime = a.updatedAt || a.createdAt || a.id || 0;
  const bTime = b.updatedAt || b.createdAt || b.id || 0;
  return String(aTime) > String(bTime);
}

function saveItem(key: string, value: any) {
  try {
    setStorageItem(key, JSON.stringify(value));
  } catch (e: any) {
    // Quota exceeded - clear non-essential data and retry
    if (e.name === 'QuotaExceededError' || e.code === 22) {
      const itemsToClear = ["sgf_audit_log", "sgf_activity_log", "sgf_receipts", "sgf_creditNotes", "fix-invoice-backup", "sgf_invoice_backups"];
      for (const itemKey of itemsToClear) {
        try { removeStorageItem(itemKey); } catch { /* ignore */ }
      }
      try { setStorageItem(key, JSON.stringify(value)); } catch { /* ignore */ }
    }
  }
}

function getCurrentUserName(): string {
  try {
    const raw = localStorage.getItem("demo_user");
    if (!raw) return "Unknown";
    const user = JSON.parse(raw);
    return user?.name || user?.email || "Unknown";
  } catch { return "Unknown"; }
}

function logAudit(action: string, entityType: string, entityId: number | string, details: string, userName?: string) {
  const entry = {
    id: Date.now() + Math.random(),
    action,
    entityType,
    entityId: String(entityId),
    details,
    userName: userName || getCurrentUserName(),
    createdAt: new Date().toISOString(),
  };
  auditLog.unshift(entry);
  saveItem("sgf_auditLog", auditLog);
  pushAudit(entry).catch(() => {});
}

/** System event logger — writes to Firebase so logs are visible across all devices */
function logSystemEvent(level: "INFO" | "WARN" | "ERROR", category: string, message: string, meta?: Record<string, any>) {
  const entry = {
    id: Date.now() + Math.random(),
    level,
    category,
    message,
    meta: meta || {},
    userName: getCurrentUserName(),
    createdAt: new Date().toISOString(),
  };
  systemLogs.unshift(entry);
  // Keep only last 500 system logs to prevent bloat
  if (systemLogs.length > 500) systemLogs = systemLogs.slice(0, 500);
  saveItem("sgf_systemLogs", systemLogs);
  pushSystemLog(entry).catch(() => {});
}

// getAvailableStock: returns the live product.quantity which is already
// deducted when orders are created and restored when delivered/cancelled
function getAvailableStock(productId: number): number {
  const product = products.find((p) => p.id == productId);
  return product ? Math.max(0, product.quantity || 0) : 0;
}

// getCommittedStock: kept for reference, counts items from active non-sample/non-quote orders
function getCommittedStock(productId: number): number {
  return orders
    .filter((o) => o.orderType !== "quote" && o.status !== "delivered" && o.status !== "cancelled" && o.status !== "sample_delivered")
    .flatMap((o) => o.items || [])
    .filter((item: any) => item.stockItemId == productId)
    .reduce((sum: number, item: any) => sum + (item.quantity || 0), 0);
}

// Check if customer already has a sample of this product
function hasExistingSample(customerId: number, stockItemId: number): boolean {
  return orders.some((o) =>
    o.customerId == customerId &&
    o.orderType === "sample" &&
    o.items?.some((item: any) => item.stockItemId == stockItemId)
  );
}

function generateNextCustomerCode(): string {
  // Collect all numeric customer codes (both new format "10001" and old "CUST0001")
  const numericCodes = customers
    .map((c) => c.customerCode)
    .filter((code): code is string => !!code && code !== "AUTO")
    .map((code) => {
      // Try new format: plain number like "10001"
      if (/^\d+$/.test(code)) return parseInt(code);
