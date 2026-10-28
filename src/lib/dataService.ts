export const dataService = {
  auth: {
    me: () => {
      const demoStr = localStorage.getItem("demo_user");
      return demoStr ? JSON.parse(demoStr) : null;
    },
  },

  stock: {
    list: () => products,
    getById: (id: number) => products.find((p) => p.id == id),
    create: (data: any) => {
      const id = Math.max(0, ...products.map((p) => p.id || 0)) + 1;
      const item = { id, ...data, createdAt: new Date().toISOString() };
      products.push(item);
      saveItem("sgf_products", products);
      return item;
    },
    update: (id: number, data: any) => {
      const idx = products.findIndex((p) => p.id == id);
      if (idx >= 0) {
        products[idx] = { ...products[idx], ...data, updatedAt: new Date().toISOString() };
        saveItem("sgf_products", products);
      }
      return products[idx];
    },
    delete: (id: number) => {
      products = products.filter((p) => p.id != id);
      saveItem("sgf_products", products);
      return { success: true };
    },
    bulkCreate: (items: any[]) => {
      const created = [];
      for (const item of items) {
        const id = Math.max(0, ...products.map((p) => p.id || 0)) + 1;
        const newItem = { id, ...item, createdAt: new Date().toISOString() };
        products.push(newItem);
        created.push(newItem);
      }
      saveItem("sgf_products", products);
      return created;
    },
    search: (query: string) => {
      const q = query.toLowerCase();
      return products.filter(
        (p) =>
          p.productName?.toLowerCase().includes(q) ||
          p.productCode?.toLowerCase().includes(q)
      );
    },
    getByCode: (code: string) => products.find((p) => p.productCode === code),
    adjustStock: (id: number, quantity: number, reason: string) => {
      const idx = products.findIndex((p) => p.id == id);
      if (idx >= 0) {
        const current = Number(products[idx].stockQuantity || 0);
        products[idx].stockQuantity = current + quantity;
        products[idx].updatedAt = new Date().toISOString();
        saveItem("sgf_products", products);
        logAudit("STOCK_ADJUST", "product", id, `Adjusted by ${quantity}: ${reason}`);
      }
      return products[idx];
    },
    getLowStock: () => products.filter((p) => (p.stockQuantity || 0) < (p.reorderLevel || 10)),
    getTopSelling: (limit = 10) => {
      const results = products
        .map((p) => {
          const totalOrdered = orders
            .flatMap((o) => o.items || [])
            .filter((it: any) => it.productId == p.id)
            .reduce((sum: number, it: any) => sum + (it.quantity || 0), 0);
          return { ...p, totalOrdered };
        })
        .filter((p) => p.totalOrdered > 0);
      return {
        items: results.sort((a, b) => b.totalOrdered - a.totalOrdered),
      };
    },
  },

  customer: {
    list: () => customers,
    getById: (id: number) => customers.find((c) => c.id == id),
    create: (data: any) => {
      const id = Math.max(0, ...customers.map((c) => c.id || 0)) + 1;
      const customer = { id, ...data, createdAt: new Date().toISOString() };
      customers.push(customer);
      saveItem("sgf_customers", customers);
      return customer;
    },
    update: (id: number, data: any) => {
      const idx = customers.findIndex((c) => c.id == id);
      if (idx >= 0) {
        customers[idx] = { ...customers[idx], ...data, updatedAt: new Date().toISOString() };
        saveItem("sgf_customers", customers);
      }
      return customers[idx];
    },
    delete: (id: number) => {
      customers = customers.filter((c) => c.id != id);
      saveItem("sgf_customers", customers);
      return { success: true };
    },
    search: (query: string) => {
      const q = query.toLowerCase();
      return customers.filter(
        (c) =>
          c.name?.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q) ||
          c.phone?.toLowerCase().includes(q) ||
          c.customerCode?.toLowerCase().includes(q)
      );
    },
    getByCode: (code: string) => customers.find((c) => c.customerCode === code),
    getStats: () => {
      const now = new Date();
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const regular = customers.filter((c) => !c.isCorporate);
      return {
        total: customers.length,
        active: regular.filter((c) => c.isActive !== false).length,
        inactive: regular.filter((c) => c.isActive === false).length,
        newThisMonth: regular.filter((c) => (c.createdAt || "") >= thisMonthStart).length,
        corporate: customers.filter((c) => c.isCorporate).length,
      };
    },
    getCustomersNeedingFollowUp: () => {
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      return customers.filter(
        (c) =>
          c.isActive !== false &&
          (!c.lastOrderDate || c.lastOrderDate < sevenDaysAgo)
      );
    },
    recordInteraction: (id: number, interaction: any) => {
      const idx = customers.findIndex((c) => c.id == id);
      if (idx >= 0) {
        if (!customers[idx].interactions) customers[idx].interactions = [];
        customers[idx].interactions.push({
          ...interaction,
          id: Date.now(),
          createdAt: new Date().toISOString(),
        });
        saveItem("sgf_customers", customers);
      }
      return customers[idx];
    },
    getInteractions: (id: number) => {
      const customer = customers.find((c) => c.id == id);
      return customer?.interactions || [];
    },
    setPriceTier: (id: number, tier: string) => {
      const idx = customers.findIndex((c) => c.id == id);
      if (idx >= 0) {
        customers[idx].priceTier = tier;
        customers[idx].updatedAt = new Date().toISOString();
        saveItem("sgf_customers", customers);
      }
      return customers[idx];
    },
    getPriceTier: (id: number) => customers.find((c) => c.id == id)?.priceTier || "wholesale",
    bulkUpload: (items: any[]) => {
      // Normalize name: trim, collapse multiple spaces, lowercase
      const normalize = (s: string) => (s || "").toString().trim().replace(/\s+/g, " ").toLowerCase();
      let created = 0;
      let updated = 0;
      for (const item of items) {
        const code = (item.customerCode || "").toString().trim();
        const name = (item.name || "").toString().trim();
        if (!name) continue;
        const normName = normalize(name);
        const incomingCode = code.toLowerCase();
        // Match ONLY if BOTH name AND customerCode match (prevents overwriting different customers with same name)
        const existingIdx = customers.findIndex((c) => {
          const nameMatch = normalize(c.name) === normName;
          const existingCode = (c.customerCode || "").toString().trim().toLowerCase();
          const codeMatch = incomingCode && existingCode ? incomingCode === existingCode : true;
          return nameMatch && codeMatch;
        });
        if (existingIdx >= 0) {
          // Update existing — same id, orders/invoices unaffected
          const existing = customers[existingIdx];
          customers[existingIdx] = {
            ...existing,
            name: name || existing.name,
            customerCode: code || existing.customerCode,
            businessName: item.businessName !== undefined ? item.businessName : existing.businessName,
            contactPerson: item.contactPerson !== undefined ? item.contactPerson : existing.contactPerson,
            phone: item.phone !== undefined ? item.phone : existing.phone,
            email: item.email !== undefined ? item.email : existing.email,
            physicalAddress: item.physicalAddress !== undefined ? item.physicalAddress : existing.physicalAddress,
            city: item.city !== undefined ? item.city : existing.city,
            province: item.province !== undefined ? item.province : existing.province,
            postalCode: item.postalCode !== undefined ? item.postalCode : existing.postalCode,
            paymentTerms: item.paymentTerms || existing.paymentTerms || "cod",
            priceTier: item.priceTier || existing.priceTier || "wholesale",
            salesRepName: item.salesRepName !== undefined ? item.salesRepName : existing.salesRepName,
            vatNumber: item.vatNumber !== undefined ? item.vatNumber : existing.vatNumber,
            notes: item.notes !== undefined ? item.notes : existing.notes,
            isActive: "active",
            updatedAt: new Date().toISOString(),
          };
          updated++;
        } else {
          // New customer
          const id = Math.max(0, ...customers.map((c) => c.id || 0)) + 1;
          customers.push({
            id,
            name,
            customerCode: code,
            businessName: item.businessName || "",
            contactPerson: item.contactPerson || "",
            phone: item.phone || "",
            email: item.email || "",
            physicalAddress: item.physicalAddress || "",
            city: item.city || "",
            province: item.province || "",
            postalCode: item.postalCode || "",
            paymentTerms: item.paymentTerms || "cod",
            priceTier: item.priceTier || "wholesale",
            salesRepName: item.salesRepName || "",
            vatNumber: item.vatNumber || "",
            notes: item.notes || "",
            isActive: "active",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          created++;
        }
      }
      saveItem("sgf_customers", customers);
      return { created, updated, total: customers.length };
    },
    getSalesReps: () => {
      const fromUsers = users.map((u) => u.name).filter(Boolean);
      const fromLegacy = customers.map((c) => c.salesRepName).filter(Boolean);
      // Deduplicate and sort
      const allReps = Array.from(new Set([...fromUsers, ...fromLegacy]))
        .sort((a: string, b: string) => a.localeCompare(b));
      return allReps;
    },
  },

  order: {
    list: () => orders,
    getById: (id: number) => orders.find((o) => o.id == id),
    create: (data: any) => {
      const id = Math.max(0, ...orders.map((o) => o.id || 0)) + 1;
      const order = { id, ...data, createdAt: new Date().toISOString() };
      orders.push(order);
      saveItem("sgf_orders", orders);
      return order;
    },
    update: (id: number, data: any) => {
      const idx = orders.findIndex((o) => o.id == id);
      if (idx >= 0) {
        orders[idx] = { ...orders[idx], ...data, updatedAt: new Date().toISOString() };
        saveItem("sgf_orders", orders);
      }
      return orders[idx];
    },
    delete: (id: number) => {
      orders = orders.filter((o) => o.id != id);
      saveItem("sgf_orders", orders);
      return { success: true };
    },
    getByCustomer: (customerId: number) => orders.filter((o) => o.customerId == customerId),
    getByStatus: (status: string) => orders.filter((o) => o.status === status),
    getPending: () => orders.filter((o) => o.status === "pending"),
    getOverdue: () => {
      const now = new Date().toISOString();
      return orders.filter((o) => o.status === "pending" && o.dueDate && o.dueDate < now);
    },
    getStats: () => {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const thisWeekStart = new Date(now.getTime() - now.getDay() * 24 * 60 * 60 * 1000).toISOString();
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      return {
        total: orders.length,
        pending: orders.filter((o) => o.status === "pending").length,
        completed: orders.filter((o) => o.status === "completed").length,
        cancelled: orders.filter((o) => o.status === "cancelled").length,
        today: orders.filter((o) => (o.createdAt || "") >= todayStart).length,
        thisWeek: orders.filter((o) => (o.createdAt || "") >= thisWeekStart).length,
        thisMonth: orders.filter((o) => (o.createdAt || "") >= thisMonthStart).length,
      };
    },
    getCustomerOrders: (customerId: number) => orders.filter((o) => o.customerId == customerId),
    getCustomerOrderHistory: (customerId: number) => {
      return orders
        .filter((o) => o.customerId == customerId)
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    },
    getRecentOrders: (limit = 10) => {
      return orders
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
        .slice(0, limit);
    },
    search: (query: string) => {
      const q = query.toLowerCase();
      return orders.filter(
        (o) =>
          o.invoiceNumber?.toLowerCase().includes(q) ||
          o.customerName?.toLowerCase().includes(q)
      );
    },
    cancel: (id: number) => {
      const idx = orders.findIndex((o) => o.id == id);
      if (idx >= 0) {
        orders[idx].status = "cancelled";
        orders[idx].updatedAt = new Date().toISOString();
        saveItem("sgf_orders", orders);
      }
      return orders[idx];
    },
    repairOrders: () => {
      let repaired = 0;
      for (const order of orders) {
        if (!order.items) {
          order.items = [];
          repaired++;
        }
      }
      if (repaired > 0) {
        saveItem("sgf_orders", orders);
      }
      return { repaired, total: orders.length };
    },
    delete: ({ id }: { id: number }) => {
      const ord = orders.find((o) => o.id == id);
      if (ord) {
        orders = orders.map((o) => o.id == id ? { ...o, status: "cancelled", updatedAt: new Date().toISOString() } : o);
        saveItem("sgf_orders", orders);
        logAudit("DELETE", "order", id, `Order cancelled: ${ord.invoiceNumber || ord.id}`);
      }
      return { success: true };
    },
    generateInvoice: (orderId: number) => generateInvoiceForOrder(orderId),
    generateMissingInvoices: () => repairOrders(),
    createFromInvoice: (invoiceId: number) => {
      const inv = invoices.find((i) => i.id == invoiceId);
      if (!inv) return null;
      const id = Math.max(0, ...orders.map((o) => o.id || 0)) + 1;
      const order = {
        id,
        customerId: inv.customerId,
        customerName: inv.customerName,
        items: inv.items || [],
        subtotal: inv.subtotal,
        vatAmount: inv.vatAmount,
        total: inv.total,
        status: "pending",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      orders.push(order);
      saveItem("sgf_orders", orders);
      return order;
    },
  },

  invoice: {
    list: () => invoices,
    getById: (id: number) => invoices.find((i) => i.id == id),
    create: (data: any) => {
      const id = Math.max(0, ...invoices.map((i) => i.id || 0)) + 1;
      const invoice = { id, ...data, createdAt: new Date().toISOString() };
      invoices.push(invoice);
      saveItem("sgf_invoices", invoices);
      return invoice;
    },
    update: (id: number, data: any) => {
      const idx = invoices.findIndex((i) => i.id == id);
      if (idx >= 0) {
        invoices[idx] = { ...invoices[idx], ...data, updatedAt: new Date().toISOString() };
        saveItem("sgf_invoices", invoices);
      }
      return invoices[idx];
    },
    updateStatus: (id: number, status: string) => {
      const idx = invoices.findIndex((i) => i.id == id);
      if (idx >= 0) {
        invoices[idx].status = status;
        invoices[idx].updatedAt = new Date().toISOString();
        saveItem("sgf_invoices", invoices);
      }
      return invoices[idx];
    },
    delete: (id: number) => {
      invoices = invoices.filter((i) => i.id != id);
      saveItem("sgf_invoices", invoices);
      return { success: true };
    },
    getByCustomer: (customerId: number) => invoices.filter((i) => i.customerId == customerId),
    getByStatus: (status: string) => invoices.filter((i) => i.status === status),
    getOverdue: () => {
      const now = new Date().toISOString();
      return invoices.filter((i) => i.status === "sent" && i.dueDate && i.dueDate < now);
    },
    getStats: () => {
      const totalValue = invoices.reduce((sum, i) => sum + (i.total || 0), 0);
      const totalPaid = invoices.reduce((sum, i) => sum + (i.amountPaid || 0), 0);
      const outstanding = totalValue - totalPaid;
      return {
        total: invoices.length,
        draft: invoices.filter((i) => i.status === "draft").length,
        sent: invoices.filter((i) => i.status === "sent").length,
        partiallyPaid: invoices.filter((i) => i.status === "partially_paid").length,
        paid: invoices.filter((i) => i.status === "paid").length,
        overdue: invoices.filter((i) => i.status === "overdue").length,
        cancelled: invoices.filter((i) => i.status === "cancelled").length,
        totalValue,
        totalPaid,
        outstanding,
      };
    },
    getCustomerInvoices: (customerId: number) => invoices.filter((i) => i.customerId == customerId),
    getCustomerInvoiceHistory: (customerId: number) => {
      return invoices
        .filter((i) => i.customerId == customerId)
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    },
    getRecentInvoices: (limit = 10) => {
      return invoices
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
        .slice(0, limit);
    },
    search: (query: string) => {
      const q = query.toLowerCase();
      return invoices.filter(
        (i) =>
          i.invoiceNumber?.toLowerCase().includes(q) ||
          i.customerName?.toLowerCase().includes(q)
      );
    },
    recordPayment: (id: number, payment: any) => {
      const idx = invoices.findIndex((i) => i.id == id);
      if (idx >= 0) {
        if (!invoices[idx].payments) invoices[idx].payments = [];
        invoices[idx].payments.push({
          ...payment,
          id: Date.now(),
          createdAt: new Date().toISOString(),
        });
        invoices[idx].amountPaid = (invoices[idx].amountPaid || 0) + (payment.amount || 0);
        invoices[idx].balanceDue = (invoices[idx].total || 0) - invoices[idx].amountPaid;
        if (invoices[idx].balanceDue <= 0) {
          invoices[idx].status = "paid";
        } else if (invoices[idx].amountPaid > 0) {
          invoices[idx].status = "partially_paid";
        }
        invoices[idx].updatedAt = new Date().toISOString();
        saveItem("sgf_invoices", invoices);
      }
      return invoices[idx];
    },
    getPayments: (id: number) => {
      const invoice = invoices.find((i) => i.id == id);
      return invoice?.payments || [];
    },
    getReceipts: () => receipts,
    getReceiptsByInvoice: (invoiceId: number) => receipts.filter((r) => r.invoiceId == invoiceId),
    getReceiptsByCustomer: (customerId: number) => receipts.filter((r) => r.customerId == customerId),
    getReceiptById: (id: number) => receipts.find((r) => r.id == id),
    getCustomerStatement: (input: { customerId: number; fromDate?: string; toDate?: string }) => {
      const { customerId, fromDate, toDate } = input;
      return invoices
        .filter((i) => {
          if (i.customerId != customerId) return false;
          if (fromDate && (i.invoiceDate || "") < fromDate) return false;
          if (toDate && (i.invoiceDate || "") > toDate) return false;
          return true;
        })
        .sort((a, b) => new Date(a.invoiceDate || 0).getTime() - new Date(b.invoiceDate || 0).getTime());
    },
    getCreditNotes: () => creditNotes,
    getCreditNotesByInvoice: (invoiceId: number) => creditNotes.filter((cn) => cn.invoiceId == invoiceId),
    getCreditNotesByCustomer: (customerId: number) => creditNotes.filter((cn) => cn.customerId == customerId),
    createCreditNote: (data: any) => {
      const id = Math.max(0, ...creditNotes.map((cn) => cn.id || 0)) + 1;
      const creditNote = { id, ...data, createdAt: new Date().toISOString() };
      creditNotes.push(creditNote);
      saveItem("sgf_creditNotes", creditNotes);
      return creditNote;
    },
    allocateCredit: (data: any) => {
      const { creditNoteId, invoiceId, amount } = data;
      const cnIdx = creditNotes.findIndex((cn) => cn.id == creditNoteId);
      const invIdx = invoices.findIndex((i) => i.id == invoiceId);
      if (cnIdx >= 0 && invIdx >= 0) {
        const cn = creditNotes[cnIdx];
        const inv = invoices[invIdx];
        const allocAmount = Math.min(amount, cn.remainingAmount || 0, inv.balanceDue || 0);
        if (!cn.allocations) cn.allocations = [];
        cn.allocations.push({
          invoiceId,
          amount: allocAmount,
          allocatedAt: new Date().toISOString(),
        });
        cn.remainingAmount = (cn.remainingAmount || 0) - allocAmount;
        inv.amountPaid = (inv.amountPaid || 0) + allocAmount;
        inv.balanceDue = (inv.total || 0) - inv.amountPaid;
        if (inv.balanceDue <= 0) inv.status = "paid";
        else if (inv.amountPaid > 0) inv.status = "partially_paid";
        inv.updatedAt = new Date().toISOString();
        saveItem("sgf_creditNotes", creditNotes);
        saveItem("sgf_invoices", invoices);
      }
      return { success: true };
    },
    voidCreditNoteAllocation: (data: any) => {
      const { creditNoteId, invoiceId } = data;
      const cnIdx = creditNotes.findIndex((cn) => cn.id == creditNoteId);
      if (cnIdx >= 0) {
        const cn = creditNotes[cnIdx];
        const alloc = cn.allocations?.find((a: any) => a.invoiceId == invoiceId);
        if (alloc) {
          cn.remainingAmount = (cn.remainingAmount || 0) + alloc.amount;
          cn.allocations = cn.allocations.filter((a: any) => a.invoiceId != invoiceId);
          const invIdx = invoices.findIndex((i) => i.id == invoiceId);
          if (invIdx >= 0) {
            const inv = invoices[invIdx];
            inv.amountPaid = (inv.amountPaid || 0) - alloc.amount;
            inv.balanceDue = (inv.total || 0) - inv.amountPaid;
            if (inv.amountPaid <= 0) inv.status = "sent";
            else if (inv.balanceDue > 0) inv.status = "partially_paid";
            inv.updatedAt = new Date().toISOString();
            saveItem("sgf_invoices", invoices);
          }
          saveItem("sgf_creditNotes", creditNotes);
        }
      }
      return { success: true };
    },
    voidCreditNote: (id: number) => {
      const idx = creditNotes.findIndex((cn) => cn.id == id);
      if (idx >= 0) {
        creditNotes[idx].status = "voided";
        creditNotes[idx].updatedAt = new Date().toISOString();
        saveItem("sgf_creditNotes", creditNotes);
      }
      return creditNotes[idx];
    },
    refundCreditNote: (data: any) => {
      const { creditNoteId, amount, method } = data;
      const idx = creditNotes.findIndex((cn) => cn.id == creditNoteId);
      if (idx >= 0) {
        const cn = creditNotes[idx];
        const refundAmount = Math.min(amount, cn.remainingAmount || 0);
        cn.remainingAmount = (cn.remainingAmount || 0) - refundAmount;
        cn.refunded = true;
        cn.refundMethod = method;
        cn.refundedAt = new Date().toISOString();
        cn.updatedAt = new Date().toISOString();
        saveItem("sgf_creditNotes", creditNotes);
      }
      return { success: true };
    },
    applyOverpaymentCredit: (data: any) => {
      const { invoiceId, amount } = data;
      const idx = invoices.findIndex((i) => i.id == invoiceId);
      if (idx >= 0) {
        const inv = invoices[idx];
        inv.amountPaid = (inv.amountPaid || 0) + amount;
        inv.balanceDue = (inv.total || 0) - inv.amountPaid;
        if (inv.balanceDue <= 0) inv.status = "paid";
        else if (inv.amountPaid > 0) inv.status = "partially_paid";
        inv.updatedAt = new Date().toISOString();
        saveItem("sgf_invoices", invoices);
      }
      return { success: true };
    },
    getCustomerCreditBalance: (customerId: number) => {
      return creditNotes
        .filter((cn) => cn.customerId == customerId && cn.status !== "voided")
        .reduce((sum, cn) => sum + (cn.remainingAmount || 0), 0);
    },
    bulkHistoricalImport: (items: any[]) => {
      const created = [];
      for (const item of items) {
        const id = Math.max(0, ...invoices.map((i) => i.id || 0)) + 1;
        const invoice = { id, ...item, createdAt: new Date().toISOString() };
        invoices.push(invoice);
        created.push(invoice);
      }
      saveItem("sgf_invoices", invoices);
      return created;
    },
    relinkSageInvoices: () => {
      let relinked = 0;
      for (const inv of invoices) {
        if (inv.source === "sage" && !inv.customerId) {
          const customer = customers.find((c) => c.name?.toLowerCase() === (inv.customerName || "").toLowerCase());
          if (customer) {
            inv.customerId = customer.id;
            relinked++;
          }
        }
      }
      if (relinked > 0) {
        saveItem("sgf_invoices", invoices);
      }
      return { relinked };
    },
    generateInvoiceForOrder,
    matchBankPayments,
    parseBankStatement,
    allocateBankPayments,
    fixDraftInvoices: fixDraftInvoicesForDeliveredOrders,
    fixSageDates: fixSageInvoiceDates,
    generateForPO: activateInvoiceFromPO,
    update: updateInvoice,
  },

  appointment: {
    list: () => appointments,
    getById: (id: number) => appointments.find((a) => a.id == id),
    create: (data: any) => {
      const id = Math.max(0, ...appointments.map((a) => a.id || 0)) + 1;
      const appointment = { id, ...data, createdAt: new Date().toISOString() };
      appointments.push(appointment);
      saveItem("sgf_appointments", appointments);
      return appointment;
    },
    update: (id: number, data: any) => {
      const idx = appointments.findIndex((a) => a.id == id);
      if (idx >= 0) {
        appointments[idx] = { ...appointments[idx], ...data, updatedAt: new Date().toISOString() };
        saveItem("sgf_appointments", appointments);
      }
      return appointments[idx];
    },
    delete: (id: number) => {
      appointments = appointments.filter((a) => a.id != id);
      saveItem("sgf_appointments", appointments);
      return { success: true };
    },
    getByCustomer: (customerId: number) => appointments.filter((a) => a.customerId == customerId),
    getByDate: (date: string) => appointments.filter((a) => a.date === date),
    getUpcoming: () => {
      const now = new Date().toISOString();
      return appointments
        .filter((a) => (a.date || "") >= now)
        .sort((a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime());
    },
    getStats: () => {
      return {
        total: appointments.length,
        upcoming: appointments.filter((a) => (a.date || "") >= new Date().toISOString()).length,
        completed: appointments.filter((a) => a.status === "completed").length,
        cancelled: appointments.filter((a) => a.status === "cancelled").length,
      };
    },
  },

  checkin: {
    list: () => checkins,
    getById: (id: number) => checkins.find((c) => c.id == id),
    create: (data: any) => {
      const id = Math.max(0, ...checkins.map((c) => c.id || 0)) + 1;
      const checkin = { id, ...data, createdAt: new Date().toISOString() };
      checkins.push(checkin);
      saveItem("sgf_checkins", checkins);
      return checkin;
    },
    update: (id: number, data: any) => {
      const idx = checkins.findIndex((c) => c.id == id);
      if (idx >= 0) {
        checkins[idx] = { ...checkins[idx], ...data, updatedAt: new Date().toISOString() };
        saveItem("sgf_checkins", checkins);
      }
      return checkins[idx];
    },
    delete: (id: number) => {
      checkins = checkins.filter((c) => c.id != id);
      saveItem("sgf_checkins", checkins);
      return { success: true };
    },
    getByEmployee: (employeeId: number) => checkins.filter((c) => c.employeeId == employeeId),
    getByDate: (date: string) => checkins.filter((c) => c.date === date),
    getToday: () => {
      const today = new Date().toISOString().split("T")[0];
      return checkins.filter((c) => c.date === today);
    },
    getStats: () => {
      const today = new Date().toISOString().split("T")[0];
      return {
        total: checkins.length,
        today: checkins.filter((c) => c.date === today).length,
        onTime: checkins.filter((c) => c.status === "on_time").length,
        late: checkins.filter((c) => c.status === "late").length,
        absent: checkins.filter((c) => c.status === "absent").length,
      };
    },
    getAARate: () => getAARate(),
    setAARate: (rate: number) => setAARate(rate),
  },

  followUpAction: {
    list: () => followUpActions,
    getById: (id: number) => followUpActions.find((f) => f.id == id),
    create: (data: any) => {
      const id = Math.max(0, ...followUpActions.map((f) => f.id || 0)) + 1;
      const action = { id, ...data, createdAt: new Date().toISOString() };
      followUpActions.push(action);
      saveItem("sgf_followUpActions", followUpActions);
      return action;
    },
    update: (id: number, data: any) => {
      const idx = followUpActions.findIndex((f) => f.id == id);
      if (idx >= 0) {
        followUpActions[idx] = { ...followUpActions[idx], ...data, updatedAt: new Date().toISOString() };
        saveItem("sgf_followUpActions", followUpActions);
      }
      return followUpActions[idx];
    },
    delete: (id: number) => {
      followUpActions = followUpActions.filter((f) => f.id != id);
      saveItem("sgf_followUpActions", followUpActions);
      return { success: true };
    },
  },

  specialPrice: {
    list: () => specialPrices,
    getById: (id: number) => specialPrices.find((sp) => sp.id == id),
    create: (data: any) => {
      const id = Math.max(0, ...specialPrices.map((sp) => sp.id || 0)) + 1;
      const price = { id, ...data, createdAt: new Date().toISOString() };
      specialPrices.push(price);
      saveItem("sgf_specialPrices", specialPrices);
      return price;
    },
    update: (id: number, data: any) => {
      const idx = specialPrices.findIndex((sp) => sp.id == id);
      if (idx >= 0) {
        specialPrices[idx] = { ...specialPrices[idx], ...data, updatedAt: new Date().toISOString() };
        saveItem("sgf_specialPrices", specialPrices);
      }
      return specialPrices[idx];
    },
    delete: (id: number) => {
      specialPrices = specialPrices.filter((sp) => sp.id != id);
      saveItem("sgf_specialPrices", specialPrices);
      return { success: true };
    },
    getByCustomer: (customerId: number) => specialPrices.filter((sp) => sp.customerId == customerId),
    getByProduct: (productId: number) => specialPrices.filter((sp) => sp.productId == productId),
    getByCustomerAndProduct: (customerId: number, productId: number) =>
      specialPrices.find((sp) => sp.customerId == customerId && sp.productId == productId),
  },

  salesRep: {
    list: () => salesReps,
    getById: (id: number) => salesReps.find((sr) => sr.id == id),
    create: (data: any) => {
      const id = Math.max(0, ...salesReps.map((sr) => sr.id || 0)) + 1;
      const rep = { id, ...data, createdAt: new Date().toISOString() };
      salesReps.push(rep);
      saveItem("sgf_salesReps", salesReps);
      return rep;
    },
    update: (id: number, data: any) => {
      const idx = salesReps.findIndex((sr) => sr.id == id);
      if (idx >= 0) {
        salesReps[idx] = { ...salesReps[idx], ...data, updatedAt: new Date().toISOString() };
        saveItem("sgf_salesReps", salesReps);
      }
      return salesReps[idx];
    },
    delete: (id: number) => {
      salesReps = salesReps.filter((sr) => sr.id != id);
      saveItem("sgf_salesReps", salesReps);
      return { success: true };
    },
    getStats: () => {
      return {
        total: salesReps.length,
        active: salesReps.filter((sr) => sr.isActive !== false).length,
        inactive: salesReps.filter((sr) => sr.isActive === false).length,
      };
    },
  },

  dashboard: {
    getStats: () => {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const thisWeekStart = new Date(now.getTime() - now.getDay() * 24 * 60 * 60 * 1000).toISOString();
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      return {
        totalCustomers: customers.length,
        totalOrders: orders.length,
        totalInvoices: invoices.length,
        totalRevenue: invoices.reduce((sum, i) => sum + (i.total || 0), 0),
        todayRevenue: invoices
          .filter((i) => (i.createdAt || "") >= todayStart)
          .reduce((sum, i) => sum + (i.total || 0), 0),
        thisWeekRevenue: invoices
          .filter((i) => (i.createdAt || "") >= thisWeekStart)
          .reduce((sum, i) => sum + (i.total || 0), 0),
        thisMonthRevenue: invoices
          .filter((i) => (i.createdAt || "") >= thisMonthStart)
          .reduce((sum, i) => sum + (i.total || 0), 0),
        outstandingInvoices: invoices.filter((i) => i.status === "sent" || i.status === "partially_paid").length,
        overdueInvoices: invoices.filter((i) => i.status === "overdue").length,
      };
    },
  },

  audit: {
    list: () => auditLogs,
    getById: (id: number) => auditLogs.find((a) => a.id == id),
    create: (data: any) => {
      const id = Math.max(0, ...auditLogs.map((a) => a.id || 0)) + 1;
      const log = { id, ...data, createdAt: new Date().toISOString() };
      auditLogs.push(log);
      saveItem("sgf_auditLogs", auditLogs);
      return log;
    },
    getByEntity: (entityType: string, entityId: number) =>
      auditLogs.filter((a) => a.entityType === entityType && a.entityId == entityId),
    getByUser: (userId: number) => auditLogs.filter((a) => a.userId == userId),
    getByDateRange: (fromDate: string, toDate: string) =>
      auditLogs.filter((a) => (a.createdAt || "") >= fromDate && (a.createdAt || "") <= toDate),
  },

  followUp: {
    list: () => followUps,
    getById: (id: number) => followUps.find((f) => f.id == id),
    create: (data: any) => {
      const id = Math.max(0, ...followUps.map((f) => f.id || 0)) + 1;
      const followUp = { id, ...data, createdAt: new Date().toISOString() };
      followUps.push(followUp);
      saveItem("sgf_followUps", followUps);
      return followUp;
    },
    update: (id: number, data: any) => {
      const idx = followUps.findIndex((f) => f.id == id);
      if (idx >= 0) {
        followUps[idx] = { ...followUps[idx], ...data, updatedAt: new Date().toISOString() };
        saveItem("sgf_followUps", followUps);
      }
      return followUps[idx];
    },
    delete: (id: number) => {
      followUps = followUps.filter((f) => f.id != id);
      saveItem("sgf_followUps", followUps);
      return { success: true };
    },
    getByCustomer: (customerId: number) => followUps.filter((f) => f.customerId == customerId),
    getByStatus: (status: string) => followUps.filter((f) => f.status === status),
    getPending: () => followUps.filter((f) => f.status === "pending"),
    getOverdue: () => {
      const now = new Date().toISOString();
      return followUps.filter((f) => f.status === "pending" && f.dueDate && f.dueDate < now);
    },
    getStats: () => {
      return {
        total: followUps.length,
        pending: followUps.filter((f) => f.status === "pending").length,
        completed: followUps.filter((f) => f.status === "completed").length,
        overdue: followUps.filter((f) => f.status === "pending" && f.dueDate && f.dueDate < new Date().toISOString()).length,
      };
    },
  },

  sampleReport: {
    getStats: () => {
      const samples = orders.filter((o) => o.orderType === "sample");
      return {
        total: samples.length,
        thisMonth: samples.filter((o) => {
          const now = new Date();
          const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
          return (o.createdAt || "") >= thisMonthStart;
        }).length,
        thisWeek: samples.filter((o) => {
          const now = new Date();
          const thisWeekStart = new Date(now.getTime() - now.getDay() * 24 * 60 * 60 * 1000).toISOString();
          return (o.createdAt || "") >= thisWeekStart;
        }).length,
        today: samples.filter((o) => {
          const today = new Date().toISOString().split("T")[0];
          return (o.createdAt || "").startsWith(today);
        }).length,
      };
    },
    getBySalesRep: (salesRepName: string) =>
      orders.filter((o) => o.orderType === "sample" && o.salesRepName === salesRepName),
    getByCustomer: (customerId: number) =>
      orders.filter((o) => o.orderType === "sample" && o.customerId == customerId),
    getByDateRange: (fromDate: string, toDate: string) =>
      orders.filter((o) => o.orderType === "sample" && (o.createdAt || "") >= fromDate && (o.createdAt || "") <= toDate),
  },

  collections: {
    getOverdueInvoices: () => {
      const now = new Date();
      return invoices
        .filter((inv) => inv.status === "sent" || inv.status === "partially_paid" || inv.status === "overdue")
        .filter((inv) => {
          const dueDate = new Date(inv.dueDate || inv.invoiceDate || 0);
          return dueDate < now;
        })
        .sort((a, b) => new Date(a.dueDate || 0).getTime() - new Date(b.dueDate || 0).getTime());
    },
    getCollectionNotes: () => collectionNotes,
    addCollectionNote: (data: any) => {
      const id = Math.max(0, ...collectionNotes.map((cn) => cn.id || 0)) + 1;
      const note = { id, ...data, createdAt: new Date().toISOString() };
      collectionNotes.push(note);
      saveItem("sgf_collectionNotes", collectionNotes);
      return note;
    },
    getCollectionPromises: () => collectionPromises,
    addCollectionPromise: (data: any) => {
      const id = Math.max(0, ...collectionPromises.map((cp) => cp.id || 0)) + 1;
      const promise = { id, ...data, createdAt: new Date().toISOString() };
      collectionPromises.push(promise);
      saveItem("sgf_collectionPromises", collectionPromises);
      return promise;
    },
    getAccountHolds: () => accountHolds,
    addAccountHold: (data: any) => {
      const id = Math.max(0, ...accountHolds.map((ah) => ah.id || 0)) + 1;
      const hold = { id, ...data, createdAt: new Date().toISOString() };
      accountHolds.push(hold);
      saveItem("sgf_accountHolds", accountHolds);
      return hold;
    },
    removeAccountHold: (id: number) => {
      accountHolds = accountHolds.filter((ah) => ah.id != id);
      saveItem("sgf_accountHolds", accountHolds);
      return { success: true };
    },
  },

  corporateCustomer: {
    list: () => corporateCustomers,
    getById: (id: number) => corporateCustomers.find((c) => c.id == id),
    create: (data: any) => {
      const id = Math.max(0, ...corporateCustomers.map((c) => c.id || 0)) + 1;
      const customer = { id, ...data, createdAt: new Date().toISOString() };
      corporateCustomers.push(customer);
      saveItem("sgf_corporateCustomers", corporateCustomers);
      return customer;
    },
    update: (id: number, data: any) => {
      const idx = corporateCustomers.findIndex((c) => c.id == id);
      if (idx >= 0) {
        corporateCustomers[idx] = { ...corporateCustomers[idx], ...data, updatedAt: new Date().toISOString() };
        saveItem("sgf_corporateCustomers", corporateCustomers);
      }
      return corporateCustomers[idx];
    },
    delete: (id: number) => {
      corporateCustomers = corporateCustomers.filter((c) => c.id != id);
      saveItem("sgf_corporateCustomers", corporateCustomers);
      return { success: true };
    },
    search: (query: string) => {
      const q = query.toLowerCase();
      return corporateCustomers.filter(
        (c) =>
          c.name?.toLowerCase().includes(q) ||
          c.companyName?.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q)
      );
    },
    getByCompanyName: (name: string) => corporateCustomers.find((c) => c.companyName === name),
    getStats: () => {
      return {
        total: corporateCustomers.length,
        active: corporateCustomers.filter((c) => c.isActive !== false).length,
        inactive: corporateCustomers.filter((c) => c.isActive === false).length,
      };
    },
  },

  purchaseOrder: {
    list: () => purchaseOrders,
    getById: (id: number) => purchaseOrders.find((po) => po.id == id),
    create: (data: any) => {
      const id = Math.max(0, ...purchaseOrders.map((po) => po.id || 0)) + 1;
      const po = { id, ...data, createdAt: new Date().toISOString() };
      purchaseOrders.push(po);
      saveItem("sgf_purchaseOrders", purchaseOrders);
      return po;
    },
    update: (id: number, data: any) => {
      const idx = purchaseOrders.findIndex((po) => po.id == id);
      if (idx >= 0) {
        purchaseOrders[idx] = { ...purchaseOrders[idx], ...data, updatedAt: new Date().toISOString() };
        saveItem("sgf_purchaseOrders", purchaseOrders);
      }
      return purchaseOrders[idx];
    },
    delete: (id: number) => {
      purchaseOrders = purchaseOrders.filter((po) => po.id != id);
      saveItem("sgf_purchaseOrders", purchaseOrders);
      return { success: true };
    },
    getByCustomer: (customerId: number) => purchaseOrders.filter((po) => po.corporateCustomerId == customerId),
    getByStatus: (status: string) => purchaseOrders.filter((po) => po.status === status),
    getPending: () => purchaseOrders.filter((po) => po.status === "pending"),
    getOverdue: () => {
      const now = new Date().toISOString();
      return purchaseOrders.filter((po) => po.status === "pending" && po.dueDate && po.dueDate < now);
    },
    getStats: () => {
      return {
        total: purchaseOrders.length,
        pending: purchaseOrders.filter((po) => po.status === "pending").length,
        completed: purchaseOrders.filter((po) => po.status === "completed").length,
        cancelled: purchaseOrders.filter((po) => po.status === "cancelled").length,
      };
    },
    generateInvoiceForPO: (poId: number) => {
      // ACQUIRE LOCK: prevent concurrent generation
      if (invoiceGenerationLock) {
        console.warn("[generateInvoiceForPO] LOCKED — another invoice is being generated.");
        return null;
      }
      invoiceGenerationLock = true;

      try {
        load();
        const po = purchaseOrders.find((p) => p.id == poId);
        if (!po) {
          console.warn("[generateInvoiceForPO] PO not found:", poId);
          return null;
        }

        // Check if draft invoice already exists for this PO
        const existingDraft = invoices.find(
          (i) => i.purchaseOrderId == poId && i.status === "draft"
        );
        if (existingDraft) {
          console.log("[generateInvoiceForPO] Reusing existing draft invoice:", existingDraft.id);
          return existingDraft;
        }

        // Find customer
        const customer = corporateCustomers.find((c) => c.id == po.corporateCustomerId);
        if (!customer) {
          console.warn("[generateInvoiceForPO] Customer not found for PO:", poId);
          return null;
        }

        // Build items
        const items = (po.items || []).map((it: any) => {
          const product = products.find((p) => p.id == it.productId);
          return {
            productId: it.productId,
            productName: product?.productName || it.productName || "Unknown",
            productCode: product?.productCode || it.productCode || "",
            quantity: it.quantity || 0,
            unitPrice: it.unitPrice || 0,
            lineTotal: (it.quantity || 0) * (it.unitPrice || 0),
          };
        });

        const subtotal = items.reduce((sum: number, it: any) => sum + (it.lineTotal || 0), 0);
        const vatRate = 0.15;
        const vatAmount = Math.round(subtotal * vatRate * 100) / 100;
        const total = Math.round((subtotal + vatAmount) * 100) / 100;

        const invoiceId = Math.max(0, ...invoices.map((i) => i.id || 0)) + 1;
        const now = new Date();
        const invoiceDate = now.toISOString().split("T")[0];
        const dueDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

        const invoice = {
          id: invoiceId,
          invoiceNumber: `PO-INV-${poId}-${Date.now()}`,
          orderNumber: po.poNumber || `PO-${poId}`,
          customerId: customer.id,
          customerName: customer.name || customer.companyName || "Corporate Customer",
          customerCode: customer.customerCode || "",
          items,
          subtotal,
          vatAmount,
          total,
          totalAmount: total,
          balanceDue: total,
          amountPaid: 0,
          status: "draft",
          paymentTerms: customer.paymentTerms || "30 days",
          invoiceDate,
          dueDate,
          deliveryNoteNumber: "",
          purchaseOrderId: poId,
          notes: `Generated from Purchase Order #${po.poNumber || poId}`,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        };

        invoices.push(invoice);
        saveItem("sgf_invoices", invoices);
        logAudit("CREATE", "invoice", invoiceId, `Draft invoice created from PO ${poId}`);
        return invoice;
      } finally {
        invoiceGenerationLock = false;
      }
    },
  },

  barrel: {
    list: () => barrels,
    getById: (id: number) => barrels.find((b) => b.id == id),
    create: (data: any) => {
      const id = Math.max(0, ...barrels.map((b) => b.id || 0)) + 1;
      const barrel = { id, ...data, createdAt: new Date().toISOString() };
      barrels.push(barrel);
      saveItem("sgf_barrels", barrels);
      return barrel;
    },
    update: (id: number, data: any) => {
      const idx = barrels.findIndex((b) => b.id == id);
      if (idx >= 0) {
        barrels[idx] = { ...barrels[idx], ...data, updatedAt: new Date().toISOString() };
        saveItem("sgf_barrels", barrels);
      }
      return barrels[idx];
    },
    delete: (id: number) => {
      barrels = barrels.filter((b) => b.id != id);
      saveItem("sgf_barrels", barrels);
      return { success: true };
    },
    getByCustomer: (customerId: number) => barrels.filter((b) => b.customerId == customerId),
    getByStatus: (status: string) => barrels.filter((b) => b.status === status),
    getStats: () => {
      return {
        total: barrels.length,
        inUse: barrels.filter((b) => b.status === "in_use").length,
        returned: barrels.filter((b) => b.status === "returned").length,
        lost: barrels.filter((b) => b.status === "lost").length,
      };
    },
  },

  coc: {
    list: () => cocs,
    getById: (id: number) => cocs.find((c) => c.id == id),
    create: (data: any) => {
      const id = Math.max(0, ...cocs.map((c) => c.id || 0)) + 1;
      const coc = { id, ...data, createdAt: new Date().toISOString() };
      cocs.push(coc);
      saveItem("sgf_cocs", cocs);
      return coc;
    },
    update: (id: number, data: any) => {
      const idx = cocs.findIndex((c) => c.id == id);
      if (idx >= 0) {
        cocs[idx] = { ...cocs[idx], ...data, updatedAt: new Date().toISOString() };
        saveItem("sgf_cocs", cocs);
      }
      return cocs[idx];
    },
    delete: (id: number) => {
      cocs = cocs.filter((c) => c.id != id);
      saveItem("sgf_cocs", cocs);
      return { success: true };
    },
    getByPurchaseOrder: (poId: number) => cocs.filter((c) => c.purchaseOrderId == poId),
    getByStatus: (status: string) => cocs.filter((c) => c.status === status),
    bulkGenerateForPO: (poId: number, cocDataList: any[], deleteOrphanIds?: number[]) => {
      const generated = [];
      for (const cocData of cocDataList) {
        const id = Math.max(0, ...cocs.map((c) => c.id || 0)) + 1;
        const coc = {
          id,
          purchaseOrderId: poId,
          ...cocData,
          status: "generated",
          createdAt: new Date().toISOString(),
        };
        cocs.push(coc);
        generated.push(coc);
      }
      if (deleteOrphanIds && deleteOrphanIds.length > 0) {
        cocs = cocs.filter((c) => !deleteOrphanIds.includes(c.id));
      }
      saveItem("sgf_cocs", cocs);
      return generated;
    },
  },

  packingList: {
    list: () => packingLists,
    getById: (id: number) => packingLists.find((pl) => pl.id == id),
    create: (data: any) => {
      const id = Math.max(0, ...packingLists.map((pl) => pl.id || 0)) + 1;
      const pl = { id, ...data, createdAt: new Date().toISOString() };
      packingLists.push(pl);
      saveItem("sgf_packingLists", packingLists);
      return pl;
    },
    update: (id: number, data: any) => {
      const idx = packingLists.findIndex((pl) => pl.id == id);
      if (idx >= 0) {
        packingLists[idx] = { ...packingLists[idx], ...data, updatedAt: new Date().toISOString() };
        saveItem("sgf_packingLists", packingLists);
      }
      return packingLists[idx];
    },
    delete: (id: number) => {
      packingLists = packingLists.filter((pl) => pl.id != id);
      saveItem("sgf_packingLists", packingLists);
      return { success: true };
    },
    getByPurchaseOrder: (poId: number) => packingLists.filter((pl) => pl.purchaseOrderId == poId),
  },

  customerFollowUp: {
    getAllFollowUps: () => followUps,
  },
};
