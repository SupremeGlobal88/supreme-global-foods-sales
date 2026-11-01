      const invoiceCompany = isSample ? "sgf" : (order.company || "sgf");
      const invNum = createInvoiceFromOrder(order, subtotal, vatAmount, total, isSample, invoiceCompany, vatRate);
      if (invNum) {
        created++;
        details.push(`${order.orderNumber} -> ${invNum}`);
      }
    }
  }

  if (created > 0) {
    saveItem("sgf_invoices", invoices);
  }

  return { created, details };
}

/** Generate an invoice from a Purchase Order (corporate customer).
 *  Creates an invoice with PO items as line items.
 *  Uses SGFXXXX for SGF or RC0412+ for Recircle SA based on PO company.
 *  Returns the invoice number or null. */
/** Remove duplicate orders, invoices, and customers. Call after Firebase sync or on demand. */
export function deduplicateData(): { ordersRemoved: number; invoicesRemoved: number; customersRemoved: number } {
  // Do NOT call load() here — it has isValidArray() checks that can discard
  // legitimately deduplicated data and load static defaults instead.
  // The arrays are already in memory from reloadFromStorage().
  const result = deduplicateAll();
  return result;
}

/** Update an existing invoice when its order is edited */
function updateInvoiceFromOrder(order: any) {
  const idx = invoices.findIndex((i) => i.orderId == order.id);
  if (idx < 0) return; // No invoice exists for this order

  const inv = invoices[idx];
  const customer = customers.find((c) => c.id == order.customerId);

  // Recalculate totals
  const subtotal = Number(order.subtotal || 0);
  const vatAmount = Number(order.vatAmount || 0);
  const total = Number(order.total || 0);

  // If order is cancelled, invoice must also be cancelled
  const isCancelledOrder = order.status === "cancelled";
  const allocC3 = (inv.creditAllocations || []).reduce((sum: number, a: any) => sum + (a.amount || 0), 0);
  const lineC3 = (inv.creditedLines || []).reduce((sum: number, cl: any) => sum + (cl.creditAmount || 0), 0);
  const newBalanceDue = isCancelledOrder ? 0 : total - (inv.amountPaid || 0) - allocC3 - lineC3;
  const newStatus = isCancelledOrder ? "cancelled" : inv.status;

  invoices[idx] = {
    ...inv,
    customerId: order.customerId,
    customer: customer || inv.customer,
    subtotal,
    vatAmount,
    total,
    totalAmount: total,
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
