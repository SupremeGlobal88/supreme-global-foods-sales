  const currentProduct = products.find((p) => p.id == item.stockItemId);
  return currentProduct?.productName || item.productName || "";
}

/** Get next SGF invoice number. Starts at SGF1801 (last was SGF1800).
 *  Loops to ensure the number is truly unique — prevents duplicates
 *  when rapid clicks or save failures occur. */
function getNextInvoiceNumber(): string {
  // Find the highest existing SGF number
  let maxNum = 1800; // Last known invoice
  for (const inv of invoices) {
    const match = (inv.invoiceNumber || "").match(/SGF(\d+)/);
    if (match) {
      const n = parseInt(match[1]);
      if (n > maxNum) maxNum = n;
    }
  }
  // Safety loop: ensure the number doesn't already exist
  let candidate = maxNum + 1;
  const existingNumbers = new Set(invoices.map((i) => i.invoiceNumber));
  while (existingNumbers.has(`SGF${candidate}`)) {
    candidate++;
  }
  return `SGF${String(candidate)}`;
}

/** Get next Recircle SA invoice number. Starts at RC0412.
 *  Separate series from SGF invoices — RC prefix for Recircle SA. */
function getNextRecircleInvoiceNumber(): string {
  let maxNum = 411; // Last known Recircle invoice (RC0411)
  for (const inv of invoices) {
    const match = (inv.invoiceNumber || "").match(/RC(\d+)/);
    if (match) {
      const n = parseInt(match[1]);
      if (n > maxNum) maxNum = n;
    }
  }
  let candidate = maxNum + 1;
  const existingNumbers = new Set(invoices.map((i) => i.invoiceNumber));
  while (existingNumbers.has(`RC${String(candidate).padStart(4, "0")}`)) {
    candidate++;
  }
  return `RC${String(candidate).padStart(4, "0")}`;
}

/** Get the correct next invoice number based on company */
function getNextInvoiceNumberForCompany(company?: string): string {
  if (company === "recircle") return getNextRecircleInvoiceNumber();
  return getNextInvoiceNumber();
}

/** Get next sample invoice number */
function getNextSampleInvoiceNumber(): string {
  const smpCount = invoices.filter((i) => (i.invoiceNumber || "").startsWith("SGF-SMP")).length;
  return `SGF-SMP-${String(smpCount + 1).padStart(3, "0")}`;
}

/** Get next receipt number: REC-001, REC-002 etc */
function getNextReceiptNumber(): string {
  const nums = receipts
    .map((r) => (r.receiptNumber || "").match(/REC-(\d+)/))
    .filter(Boolean)
    .map((m) => parseInt(m[1]));
  const max = nums.length > 0 ? Math.max(...nums) : 0;
  return `REC-${String(max + 1).padStart(3, "0")}`;
}

function createInvoiceFromOrder(order: any, subtotal: number, vatAmount: number, total: number, isSample: boolean, company?: string, vatRate?: number): string | null {
  // ACQUIRE LOCK: prevent concurrent generation that causes duplicate numbers
  if (invoiceGenerationLock) {

    return null;
  }
  invoiceGenerationLock = true;

  try {
    reloadFromStorage(["sgf_invoices", "sgf_orders"]);
    logSystemEvent("INFO", "invoiceGeneration", `createInvoiceFromOrder START orderId=${order.id}, orderNumber=${order.orderNumber}, invoiceCount=${invoices.length}`);
    const now = new Date();
    // Look up customer from BOTH arrays — corporate customers have the full record
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
