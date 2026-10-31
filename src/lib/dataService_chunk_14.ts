    return { blocked: true, reason: `Customer account is inactive. Contact admin to reactivate.` };
  }

  // 2. Account on hold
  const hold = accountHolds.find(
    (h) => h.customerId == customerId && h.status === "active"
  );
  if (hold) {
    return { blocked: true, reason: `Account on hold: ${hold.reason || "Unspecified"}. Contact admin.` };
  }

  // 3. COD order - calculate total of this NEW order, check credit limit
  // COD means customer must have enough credit limit to cover total order value
  if (paymentTerms === "cod") {
    const totalOutstanding = getCustomerOutstandingBalance(customerId);
    // We don't have the current order total here, but we check if they already exceeded limit
    const limit = typeof customer.creditLimit === "number" ? customer.creditLimit : 0;
    if (limit > 0 && totalOutstanding >= limit) {
      return { blocked: true, reason: `Credit limit exceeded (outstanding: R ${totalOutstanding.toFixed(2)} / limit: R ${limit.toFixed(2)}). Reduce outstanding balance or contact admin.` };
    }
  }

  return { blocked: false };
}

/* ─── ORDER CREATION / UPDATE ─── */

// Avoid circular import: the order page already imports from dataService.
// Just check if window.dispatchEvent is available and fire a generic refresh.
function notifyOrderChange() {
  try {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("sgf_data_changed", { detail: { type: "orders" } }));
    }
  } catch { /* ignore */ }
}

export function getOrderById(orderId: number) {
  // Use loose equality (==) because Firebase may convert number IDs to strings
  return orders.find((o) => o.id == orderId) || null;
}

export function getInvoiceForOrder(orderId: number) {
  // Use loose equality (==) because Firebase may convert number IDs to strings
  return invoices.find((inv) => inv.orderId == orderId) || null;
}

/** Generate a purchase order number that avoids duplicates.
 *  Format: PO-YYYY-MM-DD-XXXXXXXX (date + 8 random hex chars)
 *  Ensures uniqueness by checking existing purchase orders. */
export function generatePurchaseOrderNumber(): string {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  let attempts = 0;
  while (attempts < 100) {
    const randomPart = Math.random().toString(36).substring(2, 10).toUpperCase();
    const poNumber = `PO-${datePart}-${randomPart}`;
    if (!purchaseOrders.some((po) => po.poNumber === poNumber)) {
      return poNumber;
    }
    attempts++;
  }
  // Fallback with timestamp
  return `PO-${datePart}-${Date.now().toString(36).toUpperCase()}`;
}

/** Generate a sample order number that avoids duplicates.
 *  Format: SMP-YYYY-MM-DD-XXXXXXXX (date + 8 random hex chars)
 *  Ensures uniqueness by checking existing orders. */
export function generateSampleOrderNumber(): string {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  let attempts = 0;
  while (attempts < 100) {
    const randomPart = Math.random().toString(36).substring(2, 10).toUpperCase();
    const orderNumber = `SMP-${datePart}-${randomPart}`;
    if (!orders.some((o) => o.orderNumber === orderNumber)) {
      return orderNumber;
    }
    attempts++;
  }
  // Fallback with timestamp
  return `SMP-${datePart}-${Date.now().toString(36).toUpperCase()}`;
}

function createOrder(data: any) {
  const comp = getCurrentCompany();
  // CRITICAL: Reload customer + product data from storage to ensure latest
  // prices/credit limits are in memory before validation
  reloadFromStorage(["sgf_customers", "sgf_corporateCustomers", "sgf_products", "sgf_accountHolds"]);

  // ─── Corporate Customer Order ───
  if (data.orderType === "corporate" && data.corporateCustomerId) {
    return createCorporateOrder(data);
  }

  // ─── Normal Customer Order (regular + sample) ───
  const customerId = data.customerId;
  const customer = customers.find((c) => c.id == customerId);
  if (!customer && !data.corporateCustomerId) {
    throw new Error("Customer not found");
  }

  // Check account holds
  const hold = accountHolds.find((h) => h.customerId == customerId && h.status === "active");
  if (hold) {
    throw new Error(`Account on hold: ${hold.reason || "Unspecified"}. Contact admin.`);
  }

  const isSample = data.orderType === "sample";
  const orderNumber = isSample ? generateSampleOrderNumber() : generateOrderNumber();

  // ─── Stock check (skip for sample orders) ───
  if (!isSample && data.items?.length) {
    for (const it of data.items) {
      if (it.stockItemId) {
        const available = getAvailableStock(it.stockItemId);
        if (available < (it.quantity || 0)) {
          throw new Error(`Insufficient stock for ${it.productName || it.description || "item"}. Available: ${available}, Requested: ${it.quantity}`);
        }
      }
    }
  }

  const items = (data.items || []).map((item: any) => {
    const prod = products.find((p) => p.id == item.stockItemId);
    const price = isSample ? 0 : (item.unitPrice ?? prod?.price ?? 0);
    const qty = Number(item.quantity) || 0;
    const conv = Number(item.conversion) || 1;
    return {
      ...item,
      stockItemId: item.stockItemId ?? null,
      productCode: item.productCode ?? prod?.productCode ?? "",
      productName: item.productName ?? prod?.name ?? "",
      species: item.species ?? prod?.species ?? "",
      strands: item.strands ?? prod?.strands ?? "",
      description: item.description || item.productName || prod?.name || "",
      quantity: qty,
      conversion: conv,
      unitPrice: price,
      lineTotal: qty * price,
      unitLabel: item.unitLabel || (conv === 1 ? "Each" : `${conv} units`),
    };
  });

  const subtotal = isSample ? 0 : items.reduce((sum: number, item: any) => sum + item.lineTotal, 0);
  const vatAmount = isSample ? 0 : subtotal * 0.15;
  const total = subtotal + vatAmount;

  const order = {
    ...data,
    company: comp,
    id: Date.now() + Math.floor(Math.random() * 1000),
    orderNumber,
    items,
    subtotal,
    vatAmount,
    total,
    status: data.status || "pending",
    paymentTerms: data.paymentTerms || "cod",
    deliveryDate: data.deliveryDate || null,
    notes: data.notes || "",
    isPaid: isSample ? true : false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  orders.push(order);
  saveItem("sgf_orders", orders);

  // For corporate orders, create purchase order as well
  if (data.orderType === "corporate" && data.corporateCustomerId) {
    createPurchaseOrderFromOrder(order);
  }

  // Generate invoice for the order (unless it's a sample or draft)
  if (!isSample && order.status !== "draft") {
    const invNum = createInvoiceFromOrder(order.id, order.company);
    if (invNum) order.invoiceNumber = invNum;
  }

  notifyOrderChange();
  logAudit("CREATE", "order", order.id, `Order created: ${orderNumber} (${order.status})`);
  return order;
}
