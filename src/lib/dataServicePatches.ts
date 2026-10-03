/** ═══════════════════════════════════════════════════════════════
 *  DATA SERVICE PATCHES — required by localLink.ts
 *  These properties are added to dataService after initialization
 *  to ensure all tRPC router calls have a valid handler.
 * ═══════════════════════════════════════════════════════════════ */

import { dataService } from "./dataService";

// ─── 1. STOCK (alias for product + extra methods) ───
(dataService as any).stock = {
  list: () => dataService.product.list(),
  getById: (id: number) => dataService.product.getById(id),
  search: (input: any) => dataService.product.search(input || { query: "" }),
  getCategories: () => dataService.product.getCategories(),
  getStats: () => dataService.product.getStats(),
  getLowStock: () => dataService.product.getLowStock(),
  getByCategory: (input: any) => dataService.product.getByCategory(input),
  create: (data: any) => dataService.product.create(data),
  update: (input: any) => dataService.product.update(input),
  delete: (id: number) => dataService.product.delete(id),
  getDailyInvoicedStock: () => ({ items: [], totalQuantity: 0, totalValue: 0 }),
  reconcileStock: () => ({ success: true, adjusted: 0 }),
  bulkCreate: (items: any[]) => {
    let created = 0, updated = 0;
    const products = dataService.product.list();
    for (const item of items) {
      const existing = products.find((p: any) => p.id == item.id || (item.productCode && p.productCode === item.productCode));
      if (existing) {
        Object.assign(existing, item, { updatedAt: new Date().toISOString() });
        updated++;
      } else {
        dataService.product.create(item);
        created++;
      }
    }
    return { created, updated };
  },
};

// ─── 2. AUTH ───
(dataService as any).auth = {
  me: () => {
    try {
      const raw = localStorage.getItem("demo_user");
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  },
};

// ─── 3. SALES REP ───
(dataService as any).salesRep = {
  list: () => {
    try {
      const raw = localStorage.getItem("sgf_salesReps");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch { /* ignore */ }
    return [
      { name: "Adeli", isActive: true },
      { name: "Inhouse", isActive: true },
      { name: "Michael", isActive: true },
      { name: "Nkosana", isActive: true },
      { name: "Tebogo Bila", isActive: true },
    ];
  },
  getStats: () => {
    const reps = (dataService as any).salesRep.list();
    return { total: reps.length, active: reps.filter((r: any) => r.isActive !== false).length };
  },
  getSalesBreakdown: () => {
    const reps = (dataService as any).salesRep.list();
    const orders = dataService.order.list();
    return reps.map((rep: any) => {
      const repOrders = orders.filter((o: any) => o.salesRepName === rep.name);
      return { name: rep.name, orderCount: repOrders.length, totalSales: repOrders.reduce((s: number, o: any) => s + (o.total || 0), 0) };
    });
  },
  create: (data: any) => {
    const reps = (dataService as any).salesRep.list();
    reps.push({ ...data, isActive: true });
    localStorage.setItem("sgf_salesReps", JSON.stringify(reps));
    return data;
  },
  update: (input: any) => {
    const { id, data } = input;
    const reps = (dataService as any).salesRep.list();
    const idx = reps.findIndex((r: any) => r.name === id || r.name === data?.oldName);
    if (idx >= 0) {
      reps[idx] = { ...reps[idx], ...data };
      localStorage.setItem("sgf_salesReps", JSON.stringify(reps));
      return reps[idx];
    }
    return null;
  },
  toggleActive: (name: string) => {
    const reps = (dataService as any).salesRep.list();
    const rep = reps.find((r: any) => r.name === name);
    if (rep) {
      rep.isActive = !rep.isActive;
      localStorage.setItem("sgf_salesReps", JSON.stringify(reps));
      return rep;
    }
    return null;
  },
  delete: (name: string) => {
    const reps = (dataService as any).salesRep.list();
    const idx = reps.findIndex((r: any) => r.name === name);
    if (idx >= 0) {
      reps.splice(idx, 1);
      localStorage.setItem("sgf_salesReps", JSON.stringify(reps));
      return { success: true };
    }
    return { success: false };
  },
};

// ─── 4. DASHBOARD ───
(dataService as any).dashboard = {
  stats: () => {
    const orders = dataService.order.list();
    const invoices = dataService.invoice.list();
    const customers = dataService.customer.list();
    const products = dataService.product.list();
    return {
      totalOrders: orders.length,
      totalInvoices: invoices.length,
      totalCustomers: customers.length,
      totalProducts: products.length,
      totalRevenue: invoices.reduce((sum: number, i: any) => sum + (i.total || 0), 0),
      outstandingDebt: invoices.filter((i: any) => (i.balanceDue || 0) > 0).reduce((sum: number, i: any) => sum + (i.balanceDue || 0), 0),
    };
  },
};

// ─── 5. AUDIT (alias for auditLog + extras) ───
(dataService as any).audit = {
  list: () => dataService.auditLog.list(),
  create: (data: any) => dataService.auditLog.create(data),
  getByEntity: (input: any) => dataService.auditLog.getByEntity(input),
  getCustomerDeletions: () => dataService.auditLog.list().filter((a: any) => a.action === "delete" && a.entityType === "customer"),
  getAddressChanges: () => dataService.auditLog.list().filter((a: any) => a.action === "update" && a.changes && (a.changes.physicalAddress || a.changes.deliveryAddress)),
  getStats: () => {
    const entries = dataService.auditLog.list();
    return {
      totalAuditEntries: entries.length,
      appointmentsCreated: entries.filter((a: any) => a.action === "CREATE" && a.entityType === "appointment").length,
    };
  },
  getFullTrail: (input: any) => {
    let entries = dataService.auditLog.list();
    if (input?.salesRep) entries = entries.filter((a: any) => a.userName === input.salesRep);
    if (input?.dateFrom) entries = entries.filter((a: any) => new Date(a.timestamp) >= new Date(input.dateFrom));
    if (input?.dateTo) entries = entries.filter((a: any) => new Date(a.timestamp) <= new Date(input.dateTo));
    return entries.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  },
  getCheckInReport: (input: any) => {
    let checkins = dataService.checkIn.list();
    if (input?.salesRep) checkins = checkins.filter((c: any) => c.salesRepName === input.salesRep);
    if (input?.dateFrom) checkins = checkins.filter((c: any) => new Date(c.createdAt) >= new Date(input.dateFrom));
    if (input?.dateTo) checkins = checkins.filter((c: any) => new Date(c.createdAt) <= new Date(input.dateTo));
    return checkins.map((c: any) => ({ ...c, isGPS: typeof c.latitude === "number" && typeof c.longitude === "number" }));
  },
  getMissedAppointments: () => {
    const appointments = dataService.appointment.list();
    const checkins = dataService.checkIn.list();
    const now = new Date();
    return appointments
      .filter((a: any) => a.status === "scheduled" && new Date(a.appointmentDate) < now)
      .filter((a: any) => !checkins.some((c: any) => c.appointmentId == a.id))
      .map((a: any) => {
        const customer = dataService.customer.list().find((c: any) => c.id == a.customerId);
        return { ...a, customerName: customer?.name || "Unknown" };
      });
  },
};

// ─── 6. COC (alias for certificateOfCompliance + extras) ───
(dataService as any).coc = {
  list: () => dataService.certificateOfCompliance.list(),
  getById: (id: number) => dataService.certificateOfCompliance.getById(id),
  create: (data: any) => dataService.certificateOfCompliance.create(data),
  update: (input: any) => dataService.certificateOfCompliance.update(input),
  delete: (id: number) => dataService.certificateOfCompliance.delete(id),
  listByBarrel: (barrelId: number) => {
    const items = dataService.certificateOfCompliance.list();
    return items.filter((c: any) => c.barrelId == barrelId);
  },
  listByPurchaseOrder: (poId: number) => {
    const items = dataService.certificateOfCompliance.list();
    return items.filter((c: any) => c.purchaseOrderId == poId);
  },
  bulkGenerateForPO: (poId: number, cocDataList: any[]) => {
    const items = dataService.certificateOfCompliance.list();
    // Remove existing for this PO
    for (let i = items.length - 1; i >= 0; i--) {
      if (items[i].purchaseOrderId == poId) items.splice(i, 1);
    }
    // Add new
    const created: any[] = [];
    for (const data of cocDataList) {
      created.push(dataService.certificateOfCompliance.create({ ...data, purchaseOrderId: poId }));
    }
    return created;
  },
};

// ─── 7. COLLECTIONS ───
(dataService as any).collections = {
  getOverdueInvoices: () => {
    const now = new Date();
    return dataService.invoice.list().filter((inv: any) => {
      const dueDate = inv.dueDate ? new Date(inv.dueDate) : null;
      return dueDate && dueDate < now && (inv.balanceDue || 0) > 0;
    }).map((inv: any) => ({
      ...inv,
      daysOverdue: Math.floor((now.getTime() - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24)),
    }));
  },
  getDailyReport: () => ({ date: new Date().toISOString(), totalCollected: 0, totalPromises: 0 }),
  getStats: () => {
    const receipts = dataService.receipt.list();
    const promises = dataService.collectionPromise.list();
    return {
      totalOverdue: (dataService as any).collections.getOverdueInvoices().length,
      totalCollected: receipts.reduce((sum: number, r: any) => sum + (r.amount || 0), 0),
      totalPromises: promises.length,
    };
  },
  getCustomerPaymentHistory: (customerId: number) => {
    return dataService.receipt.list().filter((r: any) => r.customerId == customerId);
  },
  addNote: (input: any) => dataService.collectionNote.create(input),
  recordPromise: (input: any) => dataService.collectionPromise.create(input),
  placeHold: (input: any) => dataService.accountHold.create({ ...input, status: "active" }),
  releaseHold: (input: any) => {
    const holds = dataService.accountHold.list().filter((a: any) => a.customerId == input.customerId && a.status === "active");
    for (const hold of holds) {
      dataService.accountHold.update({ id: hold.id, data: { status: "released" } });
    }
    return { success: true };
  },
};

// ─── 8. SAMPLE REPORT ───
(dataService as any).sampleReport = {
  getByCustomer: (customerId: number) => {
    return dataService.order.list()
      .filter((o: any) => o.customerId == customerId && o.orderType === "sample")
      .map((o: any) => ({ orderId: o.id, orderNumber: o.orderNumber, date: o.createdAt, total: o.total }));
  },
  getAll: () => {
    return dataService.order.list()
      .filter((o: any) => o.orderType === "sample")
      .map((o: any) => ({ orderId: o.id, orderNumber: o.orderNumber, customerId: o.customerId, date: o.createdAt, total: o.total }));
  },
};

// ─── 9. CUSTOMER FOLLOW-UP ───
(dataService as any).customerFollowUp = {
  getAllFollowUps: (input: any) => {
    const followUps = dataService.followUp.list();
    const customers = dataService.customer.list();
    return followUps.map((f: any) => {
      const customer = customers.find((c: any) => c.id == f.customerId);
      const daysSinceLastOrder = f.daysSinceLastOrder || Math.floor((Date.now() - new Date(f.createdAt || Date.now()).getTime()) / 86400000);
      return {
        ...f,
        customerName: customer?.name || "Unknown",
        customerCode: customer?.customerCode || "",
        salesRepName: customer?.salesRepName || f.salesRepName || "",
        daysSinceLastOrder,
      };
    });
  },
};

// ─── 10. MISSING METHODS ON EXISTING PROPERTIES ───

// Order methods
(dataService as any).order.updateStatus = (input: any) => {
  const { id, status } = input;
  const orders = dataService.order.list();
  const idx = orders.findIndex((o: any) => o.id == id);
  if (idx >= 0) {
    orders[idx].status = status;
    orders[idx].updatedAt = new Date().toISOString();
    localStorage.setItem("sgf_orders", JSON.stringify(orders));
    return { order: orders[idx], cancelledInvoice: null };
  }
  return null;
};

(dataService as any).order.checkExistingSample = (customerId: number) => {
  return dataService.order.list().find((o: any) => o.customerId == customerId && o.orderType === "sample" && o.status !== "cancelled");
};

(dataService as any).order.generateMissingInvoices = () => {
  let generated = 0;
  const orders = dataService.order.list();
  const invoices = dataService.invoice.list();
  for (const order of orders) {
    if (order.status !== "cancelled" && !invoices.find((i: any) => i.orderId == order.id)) {
      dataService.generateInvoiceForOrder(order.id);
      generated++;
    }
  }
  return { generated };
};

(dataService as any).order.convertQuoteToOrder = (quoteId: number) => {
  const orders = dataService.order.list();
  const idx = orders.findIndex((o: any) => o.id == quoteId && o.orderType === "quote");
  if (idx >= 0) {
    orders[idx].orderType = "regular";
    orders[idx].status = "pending";
    orders[idx].updatedAt = new Date().toISOString();
    localStorage.setItem("sgf_orders", JSON.stringify(orders));
    const invoiceNumber = dataService.generateInvoiceForOrder(quoteId);
    return { order: orders[idx], invoiceNumber };
  }
  return null;
};

(dataService as any).order.createFromInvoice = (invoiceId: number) => {
  const inv = dataService.invoice.list().find((i: any) => i.id == invoiceId);
  if (!inv) return null;
  return dataService.order.create({
    customerId: inv.customerId,
    items: inv.items || [],
    total: inv.total || 0,
    status: "pending",
    orderType: "regular",
  });
};

// Invoice methods
(dataService as any).invoice.updateInvoice = (input: any) => {
  return dataService.invoice.update(input);
};

(dataService as any).invoice.updateStatus = (input: any) => {
  const { id, status } = input;
  const invoices = dataService.invoice.list();
  const idx = invoices.findIndex((i: any) => i.id == id);
  if (idx >= 0) {
    invoices[idx].status = status;
    invoices[idx].updatedAt = new Date().toISOString();
    localStorage.setItem("sgf_invoices", JSON.stringify(invoices));
    return invoices[idx];
  }
  return null;
};

(dataService as any).invoice.recordPayment = (input: any) => {
  const { invoiceId, amount, date, method, reference } = input;
  const invoices = dataService.invoice.list();
  const idx = invoices.findIndex((i: any) => i.id == invoiceId);
  if (idx >= 0) {
    const currentPaid = Number(invoices[idx].amountPaid || 0);
    const newPaid = currentPaid + Number(amount);
    const total = Number(invoices[idx].totalAmount || invoices[idx].total || 0);
    const balanceDue = Math.max(0, total - newPaid);
    invoices[idx].amountPaid = newPaid;
    invoices[idx].balanceDue = balanceDue;
    invoices[idx].status = balanceDue <= 0 ? "paid" : "partial";
    invoices[idx].updatedAt = new Date().toISOString();
    localStorage.setItem("sgf_invoices", JSON.stringify(invoices));
    dataService.receipt.create({ invoiceId, amount, date, method, reference });
    return { invoice: invoices[idx] };
  }
  return null;
};

(dataService as any).invoice.editPayment = (input: any) => {
  const { receiptId, amount } = input;
  const receipts = dataService.receipt.list();
  const idx = receipts.findIndex((r: any) => r.id == receiptId);
  if (idx >= 0) {
    receipts[idx].amount = amount;
    receipts[idx].updatedAt = new Date().toISOString();
    localStorage.setItem("sgf_receipts", JSON.stringify(receipts));
    return { receipt: receipts[idx] };
  }
  return null;
};

(dataService as any).invoice.deletePayment = (input: any) => {
  const { receiptId } = input;
  const receipts = dataService.receipt.list();
  const idx = receipts.findIndex((r: any) => r.id == receiptId);
  if (idx >= 0) {
    const amount = receipts[idx].amount;
    receipts.splice(idx, 1);
    localStorage.setItem("sgf_receipts", JSON.stringify(receipts));
    return { success: true, amount };
  }
  return { success: false };
};

(dataService as any).invoice.getCustomerStatement = (customerId: number) => {
  return dataService.invoice.list()
    .filter((i: any) => i.customerId == customerId)
    .sort((a: any, b: any) => new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime());
};

(dataService as any).invoice.getReceipts = () => dataService.receipt.list();
(dataService as any).invoice.getReceiptsByInvoice = (invoiceId: number) => dataService.receipt.list().filter((r: any) => r.invoiceId == invoiceId);
(dataService as any).invoice.getReceiptsByCustomer = (customerId: number) => dataService.receipt.list().filter((r: any) => r.customerId == customerId);
(dataService as any).invoice.getReceiptById = (id: number) => dataService.receipt.list().find((r: any) => r.id == id) || null;

(dataService as any).invoice.bulkHistoricalImport = (input: any[]) => {
  let count = 0;
  for (const inv of input) {
    dataService.invoice.create(inv);
    count++;
  }
  return { count };
};

(dataService as any).invoice.relinkSageInvoices = () => {
  const invoices = dataService.invoice.list();
  const customers = dataService.customer.list();
  let changed = 0;
  for (const inv of invoices) {
    if ((inv.source === "sage" || inv.isSageInvoice) && !inv.customerId && inv.customerCode) {
      const matched = customers.find((c: any) => c.customerCode === inv.customerCode);
      if (matched) {
        inv.customerId = matched.id;
        inv.customer = { name: matched.name };
        changed++;
      }
    }
  }
  if (changed > 0) localStorage.setItem("sgf_invoices", JSON.stringify(invoices));
  return { changed };
};

(dataService as any).invoice.getCreditNotes = () => {
  try {
    const raw = localStorage.getItem("sgf_creditNotes");
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
};

(dataService as any).invoice.getCreditNotesByInvoice = (invoiceId: number) => {
  const notes = (dataService as any).invoice.getCreditNotes();
  return notes.filter((c: any) => c.invoiceId == invoiceId);
};

(dataService as any).invoice.getCreditNotesByCustomer = (customerId: number) => {
  const notes = (dataService as any).invoice.getCreditNotes();
  return notes.filter((c: any) => c.customerId == customerId);
};

(dataService as any).invoice.getCustomerCreditBalance = (customerId: number) => {
  const notes = (dataService as any).invoice.getCreditNotesByCustomer(customerId);
  return notes.filter((c: any) => c.status !== "voided").reduce((sum: number, c: any) => sum + (c.amount || 0), 0);
};

(dataService as any).invoice.createCreditNote = (input: any) => {
  const notes = (dataService as any).invoice.getCreditNotes();
  const newId = notes.length > 0 ? Math.max(...notes.map((c: any) => c.id || 0)) + 1 : 1;
  const note = { ...input, id: newId, status: "open", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  notes.push(note);
  localStorage.setItem("sgf_creditNotes", JSON.stringify(notes));
  return { creditNote: note };
};

(dataService as any).invoice.allocateCredit = (input: any) => {
  const { creditNoteId, invoiceId, amount } = input;
  const invoices = dataService.invoice.list();
  const idx = invoices.findIndex((i: any) => i.id == invoiceId);
  if (idx >= 0) {
    const currentPaid = (invoices[idx].amountPaid || 0) + amount;
    const total = Number(invoices[idx].totalAmount || invoices[idx].total || 0);
    invoices[idx].amountPaid = currentPaid;
    invoices[idx].balanceDue = Math.max(0, total - currentPaid);
    invoices[idx].status = invoices[idx].balanceDue <= 0 ? "paid" : "partial";
    invoices[idx].updatedAt = new Date().toISOString();
    localStorage.setItem("sgf_invoices", JSON.stringify(invoices));
    return { success: true };
  }
  return { success: false };
};

(dataService as any).invoice.voidCreditNoteAllocation = (input: any) => {
  const notes = (dataService as any).invoice.getCreditNotes();
  const idx = notes.findIndex((c: any) => c.id == input.creditNoteId);
  if (idx >= 0) {
    notes[idx].status = "voided";
    notes[idx].updatedAt = new Date().toISOString();
    localStorage.setItem("sgf_creditNotes", JSON.stringify(notes));
    return { success: true };
  }
  return { success: false };
};

(dataService as any).invoice.voidCreditNote = (id: number) => {
  const notes = (dataService as any).invoice.getCreditNotes();
  const idx = notes.findIndex((c: any) => c.id == id);
  if (idx >= 0) {
    notes[idx].status = "voided";
    notes[idx].updatedAt = new Date().toISOString();
    localStorage.setItem("sgf_creditNotes", JSON.stringify(notes));
    return notes[idx];
  }
  return null;
};

// User methods
(dataService as any).user.toggleActive = (id: number) => {
  const users = dataService.user.list();
  const idx = users.findIndex((u: any) => u.id == id);
  if (idx >= 0) {
    users[idx].isActive = !users[idx].isActive;
    users[idx].updatedAt = new Date().toISOString();
    localStorage.setItem("sgf_users", JSON.stringify(users));
    return users[idx];
  }
  return null;
};

(dataService as any).user.resetPin = (input: any) => {
  const { id, pin } = input;
  const users = dataService.user.list();
  const idx = users.findIndex((u: any) => u.id == id);
  if (idx >= 0) {
    users[idx].pin = pin;
    users[idx].updatedAt = new Date().toISOString();
    localStorage.setItem("sgf_users", JSON.stringify(users));
    return users[idx];
  }
  return null;
};

// Check-in methods
(dataService as any).checkin = dataService.checkIn; // Alias
(dataService as any).checkin.getDailyReport = (date: string) => {
  const target = date ? new Date(date).toDateString() : new Date().toDateString();
  return dataService.checkIn.list().filter((c: any) => new Date(c.createdAt).toDateString() === target);
};

(dataService as any).checkin.getWeeklyReport = (year: number, week: number) => {
  return dataService.checkIn.list().filter((c: any) => {
    const d = new Date(c.createdAt);
    return d.getFullYear() === year && getWeekNumber(d) === week;
  });
};

(dataService as any).checkin.getMonthlyReport = (year: number, month: number) => {
  return dataService.checkIn.list().filter((c: any) => {
    const d = new Date(c.createdAt);
    return d.getFullYear() === year && d.getMonth() === month - 1;
  });
};

function getWeekNumber(d: Date) {
  const date = new Date(d.getTime());
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 4 - (date.getDay() || 7));
  const yearStart = new Date(date.getFullYear(), 0, 1);
  return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

// Follow-up action methods
(dataService as any).followUpAction.listByCustomer = (customerId: number) => {
  return dataService.followUpAction.list().filter((f: any) => f.customerId == customerId);
};

(dataService as any).followUpAction.getStats = () => {
  const actions = dataService.followUpAction.list();
  return { total: actions.length, pending: actions.filter((f: any) => f.status === "pending").length };
};

// Special price methods
(dataService as any).specialPrice.listByCustomer = (customerId: number) => {
  return dataService.specialPrice.list().filter((s: any) => s.customerId == customerId);
};

(dataService as any).specialPrice.set = (input: any) => {
  const { customerId, stockItemId, specialPrice: price } = input;
  const existing = dataService.specialPrice.list().find((s: any) => s.customerId == customerId && s.stockItemId == stockItemId);
  if (existing) {
    return dataService.specialPrice.update({ id: existing.id, data: { specialPrice: price } });
  }
  return dataService.specialPrice.create({ customerId, stockItemId, specialPrice: price });
};

// Corporate customer methods
(dataService as any).corporateCustomer.listByCompany = (company: string) => {
  return dataService.corporateCustomer.list().filter((c: any) => (c.company || "").toLowerCase() === (company || "").toLowerCase());
};

// Purchase order methods
(dataService as any).purchaseOrder.updateStatus = (input: any) => {
  const { id, status } = input;
  const pos = dataService.purchaseOrder.list();
  const idx = pos.findIndex((po: any) => po.id == id);
  if (idx >= 0) {
    pos[idx].status = status;
    pos[idx].updatedAt = new Date().toISOString();
    localStorage.setItem("sgf_purchaseOrders", JSON.stringify(pos));
    return pos[idx];
  }
  return null;
};

// Barrel methods
(dataService as any).barrel.listByPurchaseOrder = (poId: number) => {
  return dataService.barrel.list().filter((b: any) => b.purchaseOrderId == poId);
};

// Follow-up stats
(dataService as any).followUp.getStats = () => {
  const items = dataService.followUp.list();
  return { total: items.length, pending: items.filter((f: any) => f.status === "pending").length, completed: items.filter((f: any) => f.status === "completed").length };
};

console.log("[dataServicePatches] All missing properties added successfully");
