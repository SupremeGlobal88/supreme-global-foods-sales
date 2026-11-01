function repairInvoiceCompany(inv: any): any {
  if (!inv || !inv.invoiceNumber) return inv;
  const num = inv.invoiceNumber;
  if (num.startsWith("SGF")) return { ...inv, company: "sgf" };
  if (num.startsWith("RC")) return { ...inv, company: "recircle" };
  return inv;
}

/** Repair ALL invoices on startup — fixes historical data mismatches
 *  where company field doesn't match invoice number prefix. */
export function repairInvoiceCompanies(): { repaired: number } {
  let repaired = 0;
  for (let i = 0; i < invoices.length; i++) {
    const fixed = repairInvoiceCompany(invoices[i]);
    if (fixed.company !== invoices[i].company) {
      invoices[i] = fixed;
      repaired++;
    }
  }
  if (repaired > 0) {
    saveItem("sgf_invoices", invoices);

  }
  return { repaired };
}

/** Repair purchase order company based on linked corporate customer.
 *  Corporate customers have company="recircle"; others default to "sgf".
 *  ALWAYS derives from corporate customer — the customer is source of truth. */
function repairPurchaseOrderCompany(po: any): any {
  if (!po) return po;
  // Derive from linked corporate customer (source of truth)
  if (po.corporateCustomerId) {
    const cust = corporateCustomers.find((c) => c.id == po.corporateCustomerId);
    if (cust?.company) {
      return po.company === cust.company ? po : { ...po, company: cust.company };
    }
  }
  // No corporate customer linked — ensure fallback is "sgf"
  return po.company === "sgf" ? po : { ...po, company: "sgf" };
}

/** Repair ALL purchase orders on startup. */
export function repairPurchaseOrderCompanies(): { repaired: number } {
  let repaired = 0;
  for (let i = 0; i < purchaseOrders.length; i++) {
    const fixed = repairPurchaseOrderCompany(purchaseOrders[i]);
    if (fixed.company !== purchaseOrders[i].company) {
      purchaseOrders[i] = fixed;
      repaired++;
    }
  }
  if (repaired > 0) {
    saveItem("sgf_purchaseOrders", purchaseOrders);

  }
  return { repaired };
}

/** Generate an invoice for an existing order that doesn't have one.
 *  Caller MUST call reloadFromStorage() before this to ensure fresh data. */
export function generateInvoiceForOrder(orderId: number): string | null {
  reloadFromStorage(["sgf_invoices", "sgf_orders"]);
  logSystemEvent("INFO", "invoiceGeneration", `generateInvoiceForOrder START orderId=${orderId}, invoiceCount=${invoices.length}`);
  // Use loose equality (==) because Firebase may convert number IDs to strings
  const order = orders.find((o) => o.id == orderId);
  if (!order) return null;
  // Detect sample orders
  const isSample = order.orderType === "sample" || (order.orderNumber || "").startsWith("SMP-");
  // Check if customer is VAT exempt (look up from BOTH arrays)
  const customer = customers.find((c) => c.id == order.customerId) || corporateCustomers.find((c) => c.id == order.customerId);
  const vatRate = customer?.vatExempt ? 0 : 0.15;
  // Calculate totals
  const items = order.items || [];
  const subtotal = items.reduce((sum: number, item: any) => sum + (item.lineTotal || 0), 0);
  const vatAmount = subtotal * vatRate;
  const total = subtotal + vatAmount;
  // Check if invoice already exists — UPDATE it with new order data
  const existingIdx = invoices.findIndex((i) => i.orderId == orderId);
  if (existingIdx >= 0) {
    const existing = invoices[existingIdx];
    // PRESERVE payments and credit notes when updating invoice from order.
    // Only recalculate balance if total changed — subtract existing payments.
    const oldTotal = Number(existing.total || existing.totalAmount || 0);
    const newTotal = total;
    const amountPaid = Number(existing.amountPaid || 0);
    let newBalanceDue = Math.abs(newTotal - oldTotal) > 0.01
      ? newTotal - amountPaid
      : (existing.balanceDue !== undefined ? existing.balanceDue : newTotal - amountPaid);
    // Sample orders always have R 0 balance due (no charge)
    if (isSample) newBalanceDue = 0;
    // CANCELLED orders: invoice must also be cancelled with zero balance
    const isCancelledOrder = order.status === "cancelled";
    if (isCancelledOrder) {
      newBalanceDue = 0;
    }
    invoices[existingIdx] = {
      ...existing,
      customerId: order.customerId,
      customer: customer || existing.customer || null,
      items: items.map((item: any) => ({
        stockItemId: item.stockItemId,
        productName: item.productName,
        description: buildInvoiceItemDescription(item),
        quantity: item.quantity,
        unitPrice: item.unitPrice || 0,
        lineTotal: item.lineTotal || 0,
      })),
      subtotal,
      vatAmount,
      vatRate,
      total: newTotal,
      totalAmount: newTotal,
      balanceDue: newBalanceDue,
      status: isCancelledOrder ? "cancelled" : existing.status,
      cancelledAt: isCancelledOrder ? (existing.cancelledAt || new Date().toISOString()) : existing.cancelledAt,
      cancellationReason: isCancelledOrder ? (existing.cancellationReason || "Order cancelled") : existing.cancellationReason,
      paymentTerms: order.paymentTerms || "cod",
      updatedAt: new Date().toISOString(),
      notes: isSample ? `Sample order ${order.orderNumber || ""}` : isCancelledOrder ? `Invoice cancelled — order ${order.orderNumber || ""} was cancelled` : `Invoice for ${order.orderNumber || ""}`,
    };
    saveItem("sgf_invoices", invoices);
    // Ensure order has invoiceNumber link (critical for OrdersPage display)
    const orderIdx = orders.findIndex((o) => o.id == orderId);
    if (orderIdx >= 0) {
      orders[orderIdx].invoiceNumber = existing.invoiceNumber;
      orders[orderIdx].updatedAt = new Date().toISOString();
      saveItem("sgf_orders", orders);
    }
    logSystemEvent("INFO", "invoiceGeneration", `generateInvoiceForOrder UPDATED existing invoice ${existing.invoiceNumber} for order ${order.orderNumber || orderId}, newBalance=${newBalanceDue.toFixed(2)}`);
    logAudit("UPDATE", "invoice", existing.id, `Updated invoice ${existing.invoiceNumber} for order ${order.orderNumber || orderId} balance=${newBalanceDue.toFixed(2)}`, order.salesRepName);
    return existing.invoiceNumber;
  }
  // SAMPLE ORDERS ARE ALWAYS SGF — force company to "sgf" regardless of order.company
  const invoiceCompany = isSample ? "sgf" : (order.company || "sgf");
  const newInvNum = createInvoiceFromOrder(order, subtotal, vatAmount, total, isSample, invoiceCompany, vatRate);
  return newInvNum;
}

/** Generate invoices for all orders that don't have one. Returns count created. */
export function generateMissingInvoices(): { created: number; details: string[] } {
  load();
  let created = 0;
  const details: string[] = [];

  for (const order of orders) {
    // Use loose equality (==) because Firebase may convert number IDs to strings
    const existing = invoices.find((i) => i.orderId == order.id && i.invoiceNumber && i.invoiceNumber.startsWith("SGF"));
    if (!existing) {
      const customer = customers.find((c) => c.id == order.customerId);
      const vatRate = customer?.vatExempt ? 0 : 0.15;
      const items = order.items || [];
      const subtotal = items.reduce((sum: number, item: any) => sum + (item.lineTotal || 0), 0);
      const vatAmount = subtotal * vatRate;
      const total = subtotal + vatAmount;
      const isSample = order.orderType === "sample" || (order.orderNumber || "").startsWith("SMP-");
      // Sample orders are always SGF
