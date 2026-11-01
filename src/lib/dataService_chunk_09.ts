  const sorted = [...invoices].sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());

  for (const inv of sorted) {
    const num = inv.invoiceNumber;
    if (!num || !num.startsWith("SGF")) continue;
    if (seenNumbers.has(num)) {
      // Duplicate found — assign next available SGF number
      const nextNum = getNextInvoiceNumber();
      const oldNum = inv.invoiceNumber;
      inv.invoiceNumber = nextNum;
      inv.updatedAt = new Date().toISOString();
      changes.push({ old: oldNum, new: nextNum, id: inv.id, customer: inv.customer?.name || "Unknown" });
      logAudit("UPDATE", "invoice", inv.id, `Auto-renumbered duplicate invoice: ${oldNum} → ${nextNum} (${inv.customer?.name || "Unknown"})`);
    } else {
      seenNumbers.set(num, inv.id);
    }
  }

  if (changes.length > 0) {
    logSystemEvent("WARN", "fixDuplicateInvoiceNumbers", `Renumbered ${changes.length} duplicate invoices`, { changes: changes.map((c) => ({ oldNumber: c.old, newNumber: c.new, invoiceId: c.id, customer: c.customer })) });
    saveItem("sgf_invoices", invoices);
  }
  return { changes };
}

/** Migrate old sample orders to use normal status flow and SGF invoice numbers.
 *  PRESERVES real invoice totals — sample invoices show actual values with balanceDue=0.
 *  The invoice document shows what was sampled; the balanceDue=0 means no charge. */
export function migrateSampleOrders(): { migrated: number; invoicesCreated: number; followUpsCreated: number; details: string[] } {
  load();
  const details: string[] = [];
  let migrated = 0;
  let invoicesCreated = 0;
  let followUpsCreated = 0;

  for (const order of orders) {
    if (order.orderType !== "sample") continue;

    // Fix 1: Change sample_delivered status to delivered
    if (order.status === "sample_delivered") {
      order.status = "delivered";
      migrated++;
      details.push(`Order ${order.orderNumber}: status changed from sample_delivered → delivered`);
    }

    // Calculate REAL totals from order items (never zero these out)
    const items = order.items || [];
    const subtotal = items.reduce((sum: number, item: any) => sum + (item.lineTotal || 0), 0);
    // Check if customer is VAT exempt
    const customer = customers.find((c) => c.id == order.customerId);
    const vatRate = customer?.vatExempt ? 0 : 0.15;
    const vatAmount = subtotal * vatRate;
    const total = subtotal + vatAmount;

    // Fix 2: Ensure a proper SGF invoice exists
    const existingInvoice = invoices.find((i) => i.orderId == order.id);
    if (!existingInvoice) {
      // Create a new SGF invoice for this sample order WITH REAL TOTALS
      const invoiceNumber = getNextInvoiceNumber();
      const nextInvId = invoices.length > 0 ? Math.max(...invoices.map((i) => Number(i.id) || 0)) + 1 : 1;
      const now = new Date();

      invoices.push({
        id: nextInvId,
        orderId: order.id,
        orderNumber: order.orderNumber,
        invoiceNumber,
        deliveryNoteNumber: `DN-${order.orderNumber}`,
        customerId: order.customerId,
        customerName: order.customerName || (customers.find((c) => c.id == order.customerId)?.name) || "",
        customer: customers.find((c) => c.id == order.customerId) || null,
        subtotal,
        vatAmount,
        total,
        totalAmount: total,
        balanceDue: 0, // Sample = no charge, but totals show real values
        amountPaid: 0,
        status: "paid",
        paymentTerms: order.paymentTerms || "cod",
        invoiceDate: order.createdAt || now.toISOString(),
        dueDate: now.toISOString(),
        notes: `Sample order - ${order.orderNumber} (No Charge) | Subtotal: R ${subtotal.toFixed(2)} + VAT: R ${vatAmount.toFixed(2)} = Total: R ${total.toFixed(2)}`,
        items: (order.items || []).map((item: any) => ({
          description: buildInvoiceItemDescription(item),
          quantity: item.quantity,
          unitPrice: item.unitPrice || 0,
          lineTotal: item.lineTotal || 0,
          stockItemId: item.stockItemId || null,
          productCode: item.productCode || "",
          productName: item.productName || "",
        })),
        createdAt: order.createdAt || now.toISOString(),
        updatedAt: now.toISOString(),
      });
      invoicesCreated++;
      details.push(`Order ${order.orderNumber}: created invoice ${invoiceNumber} with REAL totals R ${total.toFixed(2)}`);
    } else if (existingInvoice && !existingInvoice.invoiceNumber?.startsWith("SGF")) {
      // Fix existing non-SGF invoice number — PRESERVE real totals
      const oldNum = existingInvoice.invoiceNumber;
      existingInvoice.invoiceNumber = getNextInvoiceNumber();
      existingInvoice.subtotal = subtotal;
      existingInvoice.vatAmount = vatAmount;
      existingInvoice.total = total;
      existingInvoice.totalAmount = total;
      existingInvoice.balanceDue = 0;
      existingInvoice.status = "paid";
      existingInvoice.notes = `Sample order - ${order.orderNumber} (No Charge) | Subtotal: R ${subtotal.toFixed(2)} + VAT: R ${vatAmount.toFixed(2)} = Total: R ${total.toFixed(2)}`;
      existingInvoice.items = (order.items || []).map((item: any) => ({
        description: buildInvoiceItemDescription(item),
        quantity: item.quantity,
        unitPrice: item.unitPrice || 0,
        lineTotal: item.lineTotal || 0,
        stockItemId: item.stockItemId || null,
        productCode: item.productCode || "",
        productName: item.productName || "",
      }));
      details.push(`Order ${order.orderNumber}: invoice renumbered ${oldNum} → ${existingInvoice.invoiceNumber} with REAL totals R ${total.toFixed(2)}`);
    }

    // Fix 3: Ensure a follow-up exists for this sample order
    const existingFollowUp = followUps.find((fu) => fu.orderId == order.id);
    if (!existingFollowUp) {
      const followUpDate = new Date(order.createdAt || Date.now());
      followUpDate.setDate(followUpDate.getDate() + 4);
      const followUp = {
        id: Date.now() + Math.random(),
        orderId: order.id,
        customerId: order.customerId,
        orderNumber: order.orderNumber,
        followUpDate: followUpDate.toISOString(),
        status: "pending",
        reason: null,
        expectedOrderDate: null,
        salesRepName: order.salesRepName || "",
        actionType: null,
        title: null,
        scheduledAppointmentId: null,
        createdAt: new Date().toISOString(),
      };
      followUps.push(followUp);
      followUpsCreated++;
      details.push(`Order ${order.orderNumber}: created follow-up for ${followUpDate.toLocaleDateString("en-ZA")}`);
    }
  }

  if (migrated > 0 || invoicesCreated > 0 || followUpsCreated > 0) {
    saveItem("sgf_orders", orders);
    saveItem("sgf_invoices", invoices);
    saveItem("sgf_followUps", followUps);
  }

  return { migrated, invoicesCreated, followUpsCreated, details };
}

// Helper: create an invoice from an order
/** Build a clean invoice item description.
 *  Looks up the current product by stockItemId to get the latest productName.
 *  Falls back to item.productName. Does NOT concatenate productCode because
 *  productCode often contains old long descriptive names (e.g. "34/36 MEDIUM LONG LUX")
 *  which creates ugly duplicate descriptions like "34/36 MEDIUM LONG LUX - MEDIUM LONG LUX White".
 */
function buildInvoiceItemDescription(item: any): string {
