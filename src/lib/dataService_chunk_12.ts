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
      notes: isSample ? `Sample order ${order.orderNumber || ""}` : isCancelledOrder ? `Invoice cancelled — order ${order.orderNumber || ""} was cancelled` : `Invoice for ${orde<response clipped><NOTE>Result is longer than **10000 characters**, will be **truncated**.</NOTE>