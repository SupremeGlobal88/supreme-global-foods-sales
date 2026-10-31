// =============================================================================
// ORDER SERVICE — Numbering, Validation, Pricing
// =============================================================================

export function generateOrderNumber(orderType: string = "regular"): string {
  const prefix = orderType === "sample" ? "SMP" : orderType === "quote" ? "QTE" : "ORD";
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.floor(Math.random() * 89999999 + 10000000).toString();
  return `${prefix}-${date}-${random}`;
}

export function validateOrder(order: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!order.customerId) errors.push("Customer is required");
  if (!order.items || order.items.length === 0) errors.push("At least one item is required");
  if (order.items) {
    for (const item of order.items) {
      if (!item.stockItemId) errors.push("Item product is required");
      if (!item.quantity || item.quantity <= 0) errors.push("Item quantity must be greater than 0");
    }
  }
  return { valid: errors.length === 0, errors };
}

export function calculateOrderTotal(items: any[], priceTier: string, customerId: number, isSample: boolean = false): number {
  return items.reduce((total, item) => {
    const price = getEffectivePrice(item.stockItemId, priceTier, customerId, isSample);
    return total + price * item.quantity;
  }, 0);
}

export function getOrderStatusDisplay(status: string): string {
  const displayMap: Record<string, string> = {
    draft: "Draft",
    pending: "Pending",
    confirmed: "Confirmed",
    in_production: "In Production",
    ready: "Ready",
    dispatched: "Dispatched",
    delivered: "Delivered",
    completed: "Completed",
    cancelled: "Cancelled",
    converted: "Converted to Order",
  };
  return displayMap[status] || status;
}

// =============================================================================
// INVOICE SERVICE — Numbering, Validation, PDF Export
// =============================================================================

export function getNextInvoiceNumber(): string {
  const existingNumbers = new Set(invoices.map((i) => i.invoiceNumber));
  let candidate = 1;
  while (existingNumbers.has(`SGF${candidate}`)) {
    candidate++;
  }
  return `SGF${candidate}`;
}

export function validateInvoice(invoice: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!invoice.customerId) errors.push("Customer is required");
  if (!invoice.items || invoice.items.length === 0) errors.push("At least one item is required");
  return { valid: errors.length === 0, errors };
}

export function calculateInvoiceTotal(items: any[], priceTier: string, customerId: number): number {
  return items.reduce((total, item) => {
    const price = getEffectivePrice(item.stockItemId, priceTier, customerId);
    return total + price * item.quantity;
  }, 0);
}

export function calculateTax(amount: number, taxRate: number = 0.15): number {
  return Math.round(amount * taxRate * 100) / 100;
}

export function getInvoiceStatusDisplay(status: string): string {
  const displayMap: Record<string, string> = {
    draft: "Draft",
    sent: "Sent",
    paid: "Paid",
    overdue: "Overdue",
    cancelled: "Cancelled",
    partial: "Partially Paid",
  };
  return displayMap[status] || status;
}

// =============================================================================
// REPORT HELPERS
// =============================================================================

export function getSalesRepName(repId: number): string {
  const rep = SALES_REPS.find((r) => r.id === repId);
  return rep?.name || "";
}

export function getCustomerName(customerId: number): string {
  const customer = customers.find((c) => c.id === customerId);
  return customer?.name || "";
}

export function getProductName(productId: number): string {
  const product = products.find((p) => p.id === productId);
  return product?.productName || "";
}

// =============================================================================
// AUDIT LOG
// =============================================================================

export function logAudit(action: string, entityType: string, entityId: number | string, details: any): void {
  const entry = {
    id: Date.now() + Math.random(),
    action,
    entityType,
    entityId,
    details: JSON.stringify(details),
    timestamp: new Date().toISOString(),
    userId: 0,
    userName: "System",
  };
  auditLog.push(entry);
  saveItem("sgf_auditLog", auditLog);
}

export function logSystemEvent(level: string, source: string, message: string, details?: any): void {
  const entry = {
    id: Date.now() + Math.random(),
    level,
    source,
    message,
    details: details ? JSON.stringify(details) : null,
    timestamp: new Date().toISOString(),
  };
  systemLogs.push(entry);
  saveItem("sgf_systemLogs", systemLogs);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("sgf:systemLog", { detail: entry }));
  }
}

// =============================================================================
// STORAGE HELPERS
// =============================================================================

export function saveItem(key: string, data: any): void {
  try {
    setStorageItem(key, JSON.stringify(data));
  } catch (e) {
    logSystemEvent("ERROR", "storage", `Failed to save ${key}`, { error: String(e) });
  }
}

export function getItem(key: string): any {
  try {
    const raw = getStorageItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    logSystemEvent("ERROR", "storage", `Failed to load ${key}`, { error: String(e) });
    return null;
  }
}

export function reloadFromStorage(keys: string[]): void {
  for (const key of keys) {
    const raw = getStorageItem(key);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        switch (key) {
          case "sgf_customers": customers = parsed; break;
          case "sgf_products": products = parsed; break;
          case "sgf_orders": orders = parsed; break;
          case "sgf_invoices": invoices = parsed; break;
          case "sgf_appointments": appointments = parsed; break;
          case "sgf_checkins": checkins = parsed; break;
          case "sgf_specialPrices": specialPrices = parsed; break;
          case "sgf_auditLog": auditLog = parsed; break;
          case "sgf_systemLogs": systemLogs = parsed; break;
          case "sgf_followUps": followUps = parsed; break;
          case "sgf_followUpActions": followUpActions = parsed; break;
          case "sgf_collectionNotes": collectionNotes = parsed; break;
          case "sgf_collectionPromises": collectionPromises = parsed; break;
          case "sgf_accountHolds": accountHolds = parsed; break;
          case "sgf_receipts": receipts = parsed; break;
          case "sgf_creditNotes": creditNotes = parsed; break;
          case "sgf_users": users = parsed; break;
          case "sgf_corporateCustomers": corporateCustomers = parsed; break;
          case "sgf_purchaseOrders": purchaseOrders = parsed; break;
          case "sgf_barrels": barrels = parsed; break;
          case "sgf_certificatesOfCompliance": certificatesOfCompliance = parsed; break;
          case "sgf_packingListLines": packingListLines = parsed; break;
        }
      } catch { /* ignore */ }
    }
  }
}

// =============================================================================
// MERGE WITH CLOUD DATA — Timestamp-based conflict resolution
// =============================================================================

function getStableKey(item: any): string {
  return item.orderNumber || item.invoiceNumber || String(item.id) || JSON.stringify(item);
}

function isMoreRecent(a: any, b: any): boolean {
  const aTime = a.updatedAt || a.createdAt || a.id || 0;
  const bTime = b.updatedAt || b.createdAt || b.id || 0;
  return String(aTime) > String(bTime);
}

export function mergeWithCloudData(local: any[], cloud: any[]): any[] {
  const merged = new Map<string, any>();
  for (const item of local) {
    const key = getStableKey(item);
    merged.set(key, item);
  }
  for (const item of cloud) {
    const key = getStableKey(item);
    const existing = merged.get(key);
    if (!existing || isMoreRecent(item, existing)) {
      merged.set(key, item);
    }
  }
  return Array.from(merged.values());
}
