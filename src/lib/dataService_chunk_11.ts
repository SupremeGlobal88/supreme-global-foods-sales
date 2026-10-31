    const customer = customers.find((c) => c.id == order.customerId) || corporateCustomers.find((c) => c.id == order.customerId);

    // Calculate due date from payment terms
    const paymentTerms = order.paymentTerms || "cod";
    const days = paymentTerms === "30_days" ? 30 : paymentTerms === "14_days" ? 14 : paymentTerms === "7_days" ? 7 : 0;
    const dueDate = new Date(now);
    dueDate.setDate(dueDate.getDate() + days);

    // Invoice numbering: SGF or RC prefix based on company
    const invCompany = company || order.company || "sgf";
    let invoiceNumber = getNextInvoiceNumberForCompany(invCompany);
    const deliveryNoteNumber = `DN-${order.orderNumber}`;

    // FINAL SAFETY CHECK: re-read the array right before pushing.
    // If another invoice was created between getNextInvoiceNumber() and now,
    // this loop finds a truly unique number.
    const existingNumbers = new Set(invoices.map((i) => i.invoiceNumber));
    let safetyCounter = 0;
    while (existingNumbers.has(invoiceNumber) && safetyCounter < 100) {
      const match = invoiceNumber.match(/SGF(\d+)/);
      const n = match ? parseInt(match[1]) + 1 : 1853;
      invoiceNumber = `SGF${n}`;
      safetyCounter++;
    }

    // Status: draft until order is ready for delivery, then sent. Cancelled orders = cancelled invoice.
    const status = order.status === "cancelled" ? "cancelled" : (order.status === "ready" || order.status === "delivered") ? "sent" : "draft";

    // Use sequential integer ID to avoid decimal/float issues
    const nextInvId = invoices.length > 0 ? Math.max(...invoices.map((i) => Number(i.id) || 0)) + 1 : 1;

    const isCancelledOrder = order.status === "cancelled";
    invoices.push({
      id: nextInvId,
      orderId: order.id,
      orderNumber: order.orderNumber,
      invoiceNumber,
      deliveryNoteNumber,
      company: invCompany,
      customerId: order.customerId,
      customerName: customer?.name || order.customerName || "",
      customer: customer || null,
      subtotal: isSample ? subtotal : subtotal,
      vatAmount: isSample ? vatAmount : vatAmount,
      vatRate: vatRate !== undefined ? vatRate : 0.15,
      total: isSample ? total : total,
      totalAmount: isSample ? total : total,
      balanceDue: isSample || isCancelledOrder ? 0 : total,
      amountPaid: isSample ? 0 : 0,
      status: isSample ? "paid" : status,
      paymentTerms: order.paymentTerms || "cod",
      invoiceDate: now.toISOString(),
      dueDate: dueDate.toISOString(),
      cancelledAt: isCancelledOrder ? now.toISOString() : undefined,
      cancellationReason: isCancelledOrder ? "Order cancelled" : undefined,
      notes: isSample ? `Sample order - ${order.orderNumber} (No Charge) | Subtotal: R ${subtotal.toFixed(2)} + VAT: R ${vatAmount.toFixed(2)} = Total: R ${total.toFixed(2)}` : isCancelledOrder ? `Invoice cancelled — order ${order.orderNumber} was cancelled` : `Invoice for ${order.orderNumber}`,
      items: (order.items || []).map((item: any) => ({
        description: buildInvoiceItemDescription(item),
        quantity: item.quantity,
        unitPrice: item.unitPrice || 0,
        lineTotal: item.lineTotal || 0,
        stockItemId: item.stockItemId || null,
        productCode: item.productCode || "",
        productName: item.productName || "",
      })),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });
    saveItem("sgf_invoices", invoices);

    // CRITICAL: Link the order to the newly created invoice so the Orders page shows "Invoice Generated"
    order.invoiceNumber = invoiceNumber;
    const orderIdx = orders.findIndex((o) => o.id == order.id);
    if (orderIdx >= 0) {
      orders[orderIdx].invoiceNumber = invoiceNumber;
      orders[orderIdx].updatedAt = now.toISOString();
      saveItem("sgf_orders", orders);
    }

    logSystemEvent("INFO", "invoiceGeneration", `createInvoiceFromOrder END invoiceNumber=${invoiceNumber}, orderNumber=${order.orderNumber}, newInvoiceCount=${invoices.length}`);
    return invoiceNumber;
  } finally {
    // RELEASE LOCK: always release even if an error occurred
    invoiceGenerationLock = false;
  }
}

/** Force-correct invoice company based on invoice number prefix.
 *  SGF* -> "sgf", RC* -> "recircle". Prevents badge/number mismatches. */
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
