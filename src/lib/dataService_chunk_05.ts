// =============================================================================
// PURCHASE ORDER SERVICE
// =============================================================================

export const purchaseOrderService = {
  list: (company?: string) => {
    const comp = company || getCurrentCompany();
    return purchaseOrders.filter((po) => po.company === comp);
  },
  getById: (id: number) => {
    return purchaseOrders.find((po) => po.id === id);
  },
  getByPONumber: (poNumber: string) => {
    return purchaseOrders.find((po) => po.poNumber === poNumber);
  },
  getBySupplier: (supplierId: number) => {
    return purchaseOrders.filter((po) => po.supplierId === supplierId);
  },
  getByStatus: (status: string) => {
    const comp = getCurrentCompany();
    return purchaseOrders.filter((po) => po.company === comp && po.status === status);
  },
  create: (data: Partial<PurchaseOrder>) => {
    const comp = getCurrentCompany();
    const newPO: PurchaseOrder = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      poNumber: data.poNumber || generatePONumber(),
      supplierId: data.supplierId || 0,
      supplierName: data.supplierName || "",
      company: comp,
      orderDate: data.orderDate || new Date().toISOString(),
      status: data.status || "draft",
      items: data.items || [],
      subtotal: data.subtotal || 0,
      tax: data.tax || 0,
      total: data.total || 0,
      currency: data.currency || "ZAR",
      notes: data.notes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    purchaseOrders.push(newPO);
    saveItem("sgf_purchaseOrders", purchaseOrders);
    logAudit("create", "purchaseOrder", newPO.id, data);
    return newPO;
  },
  update: (id: number, data: Partial<PurchaseOrder>) => {
    const index = purchaseOrders.findIndex((po) => po.id === id);
    if (index === -1) return null;
    purchaseOrders[index] = { ...purchaseOrders[index], ...data, updatedAt: new Date().toISOString() };
    saveItem("sgf_purchaseOrders", purchaseOrders);
    logAudit("update", "purchaseOrder", id, data);
    return purchaseOrders[index];
  },
  delete: (id: number) => {
    const index = purchaseOrders.findIndex((po) => po.id === id);
    if (index === -1) return { success: false, error: "Purchase order not found" };
    const po = purchaseOrders[index];
    purchaseOrders.splice(index, 1);
    saveItem("sgf_purchaseOrders", purchaseOrders);
    logAudit("delete", "purchaseOrder", id, { poNumber: po.poNumber });
    return { success: true };
  },
  receiveItems: (id: number, items: { itemId: number; receivedQuantity: number }[]) => {
    const po = purchaseOrders.find((p) => p.id === id);
    if (!po) return { success: false, error: "Purchase order not found" };
    for (const received of items) {
      const item = po.items.find((i) => i.id === received.itemId);
      if (item) {
        item.receivedQuantity = (item.receivedQuantity || 0) + received.receivedQuantity;
        // Update product stock
        const product = products.find((p) => p.id === item.productId);
        if (product) {
          product.stockQuantity = (product.stockQuantity || 0) + received.receivedQuantity;
          product.updatedAt = new Date().toISOString();
        }
        // Record stock movement
        const movement: StockMovement = {
          id: Date.now() + Math.floor(Math.random() * 1000),
          productId: item.productId || 0,
          productName: item.productName,
          company: po.company,
          movementType: "in",
          quantity: received.receivedQuantity,
          referenceType: "purchase_order",
          referenceId: po.id,
          notes: `Received from PO ${po.poNumber}`,
          createdAt: new Date().toISOString(),
        };
        stockMovements.push(movement);
      }
    }
    const allReceived = po.items.every((i) => (i.receivedQuantity || 0) >= i.quantity);
    po.status = allReceived ? "received" : "partial";
    po.updatedAt = new Date().toISOString();
    saveItem("sgf_purchaseOrders", purchaseOrders);
    saveItem("sgf_products", products);
    saveItem("sgf_stockMovements", stockMovements);
    logAudit("receive", "purchaseOrder", id, { items });
    return { success: true, po };
  },
  getStats: () => {
    const comp = getCurrentCompany();
    const companyPOs = purchaseOrders.filter((po) => po.company === comp);
    return {
      total: companyPOs.length,
      draft: companyPOs.filter((po) => po.status === "draft").length,
      sent: companyPOs.filter((po) => po.status === "sent").length,
      confirmed: companyPOs.filter((po) => po.status === "confirmed").length,
      partial: companyPOs.filter((po) => po.status === "partial").length,
      received: companyPOs.filter((po) => po.status === "received").length,
      cancelled: companyPOs.filter((po) => po.status === "cancelled").length,
      totalValue: companyPOs.reduce((sum, po) => sum + po.total, 0),
    };
  },
};

// =============================================================================
// QUOTE SERVICE
// =============================================================================

export const quoteService = {
  list: (company?: string) => {
    const comp = company || getCurrentCompany();
    return quotes.filter((q) => q.company === comp);
  },
  getById: (id: number) => {
    return quotes.find((q) => q.id === id);
  },
  getByQuoteNumber: (quoteNumber: string) => {
    return quotes.find((q) => q.quoteNumber === quoteNumber);
  },
  getByCustomer: (customerId: number) => {
    return quotes.filter((q) => q.customerId === customerId);
  },
  getByStatus: (status: string) => {
    const comp = getCurrentCompany();
    return quotes.filter((q) => q.company === comp && q.status === status);
  },
  create: (data: Partial<Quote>) => {
    const comp = getCurrentCompany();
    const newQuote: Quote = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      quoteNumber: data.quoteNumber || generateQuoteNumber(),
      customerId: data.customerId || 0,
      customerName: data.customerName || "",
      company: comp,
      quoteDate: data.quoteDate || new Date().toISOString(),
      status: data.status || "draft",
      items: data.items || [],
      subtotal: data.subtotal || 0,
      discount: data.discount || 0,
      tax: data.tax || 0,
      total: data.total || 0,
      currency: data.currency || "ZAR",
      notes: data.notes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    quotes.push(newQuote);
    saveItem("sgf_quotes", quotes);
    logAudit("create", "quote", newQuote.id, data);
    return newQuote;
  },
  update: (id: number, data: Partial<Quote>) => {
    const index = quotes.findIndex((q) => q.id === id);
    if (index === -1) return null;
    quotes[index] = { ...quotes[index], ...data, updatedAt: new Date().toISOString() };
    saveItem("sgf_quotes", quotes);
    logAudit("update", "quote", id, data);
    return quotes[index];
  },
  delete: (id: number) => {
    const index = quotes.findIndex((q) => q.id === id);
    if (index === -1) return { success: false, error: "Quote not found" };
    const quote = quotes[index];
    quotes.splice(index, 1);
    saveItem("sgf_quotes", quotes);
    logAudit("delete", "quote", id, { quoteNumber: quote.quoteNumber });
    return { success: true };
  },
  convertToOrder: (id: number) => {
    const quote = quotes.find((q) => q.id === id);
    if (!quote) return { success: false, error: "Quote not found" };
    const orderItems: OrderItem[] = quote.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discount: item.discount,
      tax: item.tax,
      total: item.total,
    }));
    const order: Order = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      orderNumber: generateOrderNumber(),
      customerId: quote.customerId,
      customerName: quote.customerName,
      company: quote.company,
      orderDate: new Date().toISOString(),
      status: "pending",
      priority: "normal",
      items: orderItems,
      subtotal: quote.subtotal,
      discount: quote.discount,
      tax: quote.tax,
      total: quote.total,
      currency: quote.currency,
      notes: quote.notes,
      paymentStatus: "unpaid",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    orders.push(order);
    saveItem("sgf_orders", orders);
    quoteService.update(id, { status: "accepted" });
    logAudit("convert", "quote_to_order", order.id, { quoteId: id });
    return { success: true, order };
  },
  getStats: () => {
    const comp = getCurrentCompany();
    const companyQuotes = quotes.filter((q) => q.company === comp);
    return {
      total: companyQuotes.length,
      draft: companyQuotes.filter((q) => q.status === "draft").length,
      sent: companyQuotes.filter((q) => q.status === "sent").length,
      accepted: companyQuotes.filter((q) => q.status === "accepted").length,
      rejected: companyQuotes.filter((q) => q.status === "rejected").length,
      expired: companyQuotes.filter((q) => q.status === "expired").length,
      totalValue: companyQuotes.reduce((sum, q) => sum + q.total, 0),
    };
  },
};

// =============================================================================
// SUPPLIER SERVICE
// =============================================================================

export const supplierService = {
  list: (company?: string) => {
    const comp = company || getCurrentCompany();
    return suppliers.filter((s) => s.company === comp);
  },
  getById: (id: number) => {
    return suppliers.find((s) => s.id === id);
  },
  getByName: (name: string) => {
    return suppliers.find((s) => s.name.toLowerCase() === name.toLowerCase());
  },
  create: (data: Partial<Supplier>) => {
    const comp = getCurrentCompany();
    const newSupplier: Supplier = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      name: data.name || "",
      company: comp,
      status: data.status || "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...data,
    };
    suppliers.push(newSupplier);
    saveItem("sgf_suppliers", suppliers);
    logAudit("create", "supplier", newSupplier.id, data);
    return newSupplier;
  },
  update: (id: number, data: Partial<Supplier>) => {
    const index = suppliers.findIndex((s) => s.id === id);
    if (index === -1) return null;
    suppliers[index] = { ...suppliers[index], ...data, updatedAt: new Date().toISOString() };
    saveItem("sgf_suppliers", suppliers);
    logAudit("update", "supplier", id, data);
    return suppliers[index];
  },
  delete: (id: number) => {
    const index = suppliers.findIndex((s) => s.id === id);
    if (index === -1) return { success: false, error: "Supplier not found" };
    const supplier = suppliers[index];
    suppliers.splice(index, 1);
    saveItem("sgf_suppliers", suppliers);
    logAudit("delete", "supplier", id, { name: supplier.name });
    return { success: true };
  },
  getStats: () => {
    const comp = getCurrentCompany();
    const companySuppliers = suppliers.filter((s) => s.company === comp);
    return {
      total: companySuppliers.length,
      active: companySuppliers.filter((s) => s.status === "active").length,
      inactive: companySuppliers.filter((s) => s.status === "inactive").length,
    };
  },
};

// =============================================================================
// DELIVERY NOTE SERVICE
// =============================================================================

export const deliveryNoteService = {
  list: (company?: string) => {
    const comp = company || getCurrentCompany();
    return deliveryNotes.filter((d) => d.company === comp);
  },
  getById: (id: number) => {
    return deliveryNotes.find((d) => d.id === id);
  },
  getByDNNumber: (dnNumber: string) => {
    return deliveryNotes.find((d) => d.dnNumber === dnNumber);
  },
  getByOrder: (orderId: number) => {
    return deliveryNotes.filter((d) => d.orderId === orderId);
  },
  getByStatus: (status: string) => {
    const comp = getCurrentCompany();
    return deliveryNotes.filter((d) => d.company === comp && d.status === status);
  },
  create: (data: Partial<DeliveryNote>) => {
    const comp = getCurrentCompany();
    const newDN: DeliveryNote = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      dnNumber: data.dnNumber || generateDeliveryNoteNumber(),
      orderId: data.orderId || 0,
      orderNumber: data.orderNumber || "",
      customerId: data.customerId || 0,
      customerName: data.customerName || "",
      company: comp,
      deliveryDate: data.deliveryDate || new Date().toISOString(),
      status: data.status || "pending",
      items: data.items || [],
      driverName: data.driverName,
      vehicle: data.vehicle,
      notes: data.notes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    deliveryNotes.push(newDN);
    saveItem("sgf_deliveryNotes", deliveryNotes);
    logAudit("create", "deliveryNote", newDN.id, data);
    return newDN;
  },
  update: (id: number, data: Partial<DeliveryNote>) => {
    const index = deliveryNotes.findIndex((d) => d.id === id);
    if (index === -1) return null;
    deliveryNotes[index] = { ...deliveryNotes[index], ...data, updatedAt: new Date().toISOString() };
    saveItem("sgf_deliveryNotes", deliveryNotes);
    logAudit("update", "deliveryNote", id, data);
    return deliveryNotes[index];
  },
  delete: (id: number) => {
    const index = deliveryNotes.findIndex((d) => d.id === id);
    if (index === -1) return { success: false, error: "Delivery note not found" };
    const dn = deliveryNotes[index];
    deliveryNotes.splice(index, 1);
    saveItem("sgf_deliveryNotes", deliveryNotes);
    logAudit("delete", "deliveryNote", id, { dnNumber: dn.dnNumber });
    return { success: true };
  },
  markAsDelivered: (id: number) => {
    const dn = deliveryNotes.find((d) => d.id === id);
    if (!dn) return null;
    dn.status = "delivered";
    dn.updatedAt = new Date().toISOString();
    // Update order status
    const order = orders.find((o) => o.id === dn.orderId);
    if (order) {
      order.status = "delivered";
      order.updatedAt = new Date().toISOString();
      saveItem("sgf_orders", orders);
    }
    saveItem("sgf_deliveryNotes", deliveryNotes);
    logAudit("deliver", "deliveryNote", id, {});
    return dn;
  },
  getStats: () => {
    const comp = getCurrentCompany();
    const companyDNs = deliveryNotes.filter((d) => d.company === comp);
    return {
      total: companyDNs.length,
      pending: companyDNs.filter((d) => d.status === "pending").length,
      inTransit: companyDNs.filter((d) => d.status === "in_transit").length,
      delivered: companyDNs.filter((d) => d.status === "delivered").length,
      returned: companyDNs.filter((d) => d.status === "returned").length,
    };
  },
};
