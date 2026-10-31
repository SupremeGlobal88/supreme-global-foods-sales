    balanceDue: newBalanceDue,
    status: newStatus,
    cancelledAt: isCancelledOrder ? (inv.cancelledAt || new Date().toISOString()) : inv.cancelledAt,
    cancellationReason: isCancelledOrder ? (inv.cancellationReason || "Order cancelled") : inv.cancellationReason,
    paymentTerms: order.paymentTerms || inv.paymentTerms,
    items: (order.items || []).map((item: any) => ({
      description: buildInvoiceItemDescription(item),
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
      stockItemId: item.stockItemId || null,
      productCode: item.productCode || "",
      productName: item.productName || "",
    })),
    updatedAt: new Date().toISOString(),
  };
  saveItem("sgf_invoices", invoices);
  return invoices[idx];
}

/** When order status changes to ready/delivered, upgrade invoice from draft to sent */
function activateInvoiceFromOrder(orderId: number) {
  // Use loose equality (==) because Firebase may convert number IDs to strings
  const idx = invoices.findIndex((i) => i.orderId == orderId);
  if (idx >= 0 && invoices[idx].status === "draft") {
    invoices[idx].status = "sent";
    invoices[idx].updatedAt = new Date().toISOString();
    saveItem("sgf_invoices", invoices);

  }
}

/** When purchase order status changes to fulfilled, upgrade invoice from draft to sent */
function activateInvoiceFromPO(poId: number) {
  // Use loose equality (==) because Firebase may convert number IDs to strings
  const idx = invoices.findIndex((i) => i.purchaseOrderId == poId);
  if (idx >= 0 && invoices[idx].status === "draft") {
    invoices[idx].status = "sent";
    invoices[idx].updatedAt = new Date().toISOString();
    saveItem("sgf_invoices", invoices);

  }
}

/** When order is cancelled, also cancel its linked invoice (if any).
 *  Returns the cancelled invoice so caller can push to Firebase (cloud-first). */
function cancelInvoiceFromOrder(orderId: number): any | null {
  // Use loose equality (==) because Firebase may convert number IDs to strings
  const idx = invoices.findIndex((i) => i.orderId == orderId);
  if (idx >= 0) {
    const oldInvStatus = invoices[idx].status;
    const hadBalance = invoices[idx].balanceDue;
    invoices[idx].status = "cancelled";
    invoices[idx].balanceDue = 0;
    invoices[idx].updatedAt = new Date().toISOString();
    invoices[idx].cancelledAt = invoices[idx].cancelledAt || new Date().toISOString();
    invoices[idx].cancellationReason = invoices[idx].cancellationReason || "Order cancelled";
    saveItem("sgf_invoices", invoices);

    return invoices[idx];
  }
  return null;
}

/** Fix invoices stuck in "draft" whose orders are already delivered/ready or whose
 *  purchase orders are already fulfilled.
 *  This repairs data corrupted by the old === bug in activateInvoiceFromOrder.
 *  Returns changed invoices so caller can push to Firebase (cloud-first). */
export function fixDraftInvoicesForDeliveredOrders(): { changed: number; invoices: any[] } {
  let changed = 0;
  const changedInvs: any[] = [];
  for (const inv of invoices) {
    if (inv.status !== "draft") continue;
    // Use loose equality (==) because Firebase may convert number IDs to strings
    const order = orders.find((o) => o.id == inv.orderId);
    if (order && (order.status === "delivered" || order.status === "ready")) {
      inv.status = "sent";
      inv.updatedAt = new Date().toISOString();
      changed++;
      changedInvs.push(inv);
      continue;
    }
    // Also check purchase orders (corporate orders)
    const po = purchaseOrders.find((p) => p.id == inv.purchaseOrderId);
    if (po && po.status === "fulfilled") {
      inv.status = "sent";
      inv.updatedAt = new Date().toISOString();
      changed++;
      changedInvs.push(inv);
    }
  }
  if (changed > 0) {
    saveItem("sgf_invoices", invoices);

  }
  return { changed, invoices: changedInvs };
}

/** Repair cancelled invoices that still have a non-zero balanceDue.
 *  This fixes data corrupted before the balanceDue=0 fix was added to cancelInvoiceFromOrder.
 *  Returns changed invoices so caller can push to Firebase (cloud-first). */
export function repairCancelledInvoiceBalances(): { changed: number; invoices: any[] } {
  let changed = 0;
  const changedInvs: any[] = [];
  for (const inv of invoices) {
    const isCancelled = String(inv.status || "").toLowerCase().trim() === "cancelled";
    const balanceDue = typeof inv.balanceDue === "number" ? inv.balanceDue : (inv.total || 0) - (inv.amountPaid || 0);
    if (isCancelled && balanceDue !== 0) {
      inv.balanceDue = 0;
      inv.cancelledAt = inv.cancelledAt || new Date().toISOString();
      inv.cancellationReason = inv.cancellationReason || "Order cancelled";
      inv.updatedAt = new Date().toISOString();
      changed++;
      changedInvs.push(inv);
    }
  }
  if (changed > 0) {
    saveItem("sgf_invoices", invoices);

  }
  return { changed, invoices: changedInvs };
}

function searchItems(items: any[], query: string) {
  if (!query || query.trim() === "") return items;
  const q = query.toLowerCase().trim();
  return items.filter((item) =>
    item.name?.toLowerCase().includes(q) ||
    item.productCode?.toLowerCase().includes(q) ||
    item.category?.toLowerCase().includes(q) ||
    item.customerCode?.toLowerCase().includes(q) ||
    item.city?.toLowerCase().includes(q)
  );
}

export { SALES_REPS, getCommittedStock, getAvailableStock };

/* ─── CUSTOMER CREDIT & ACTIVITY HELPERS ─── */

/** Sum outstanding balanceDue for all non-cancelled invoices linked to a regular customer */
function getCustomerOutstandingBalance(customerId: number): number {
  return invoices
    .filter((inv) => inv.customerId == customerId && inv.status !== "cancelled" && (inv.balanceDue || 0) > 0.01)
    .reduce((sum, inv) => sum + (inv.balanceDue || 0), 0);
}

/** Sum outstanding balanceDue for all non-cancelled invoices linked to a corporate customer via purchaseOrderId */
function getCorporateCustomerOutstandingBalance(corporateCustomerId: number): number {
  const poIds = purchaseOrders
    .filter((po) => po.corporateCustomerId == corporateCustomerId)
    .map((po) => po.id);
  return invoices
    .filter((inv) => inv.purchaseOrderId != null && poIds.includes(inv.purchaseOrderId) && inv.status !== "cancelled" && (inv.balanceDue || 0) > 0.01)
    .reduce((sum, inv) => sum + (inv.balanceDue || 0), 0);
}

/** Check if a regular customer is allowed to place an order.
 *  Returns { blocked: false } if OK, or { blocked: true, reason: string } if blocked.
 *  overrideBySuperAdmin bypasses all checks. */
function checkCustomerCanOrder(
  customerId: number,
  paymentTerms: string,
  overrideBySuperAdmin = false
): { blocked: boolean; reason?: string } {
  if (overrideBySuperAdmin) return { blocked: false };

  const customer = customers.find((c) => c.id == customerId);
  if (!customer) return { blocked: true, reason: "Customer not found." };

  // 1. Customer deactivated
  if (customer.isActive === false) {
    return { blocked: true, reason: `Customer account is inactive. Contact admin to reactivate.` };
  }
