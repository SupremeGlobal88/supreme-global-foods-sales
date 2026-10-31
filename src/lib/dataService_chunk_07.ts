// =============================================================================
// BACKUP / RESTORE SERVICE
// =============================================================================

export function createBackup(): string {
  const backup = {
    timestamp: new Date().toISOString(),
    version: "2.0",
    data: {
      customers: deepClone(customers),
      products: deepClone(products),
      orders: deepClone(orders),
      invoices: deepClone(invoices),
      appointments: deepClone(appointments),
      checkins: deepClone(checkins),
      specialPrices: deepClone(specialPrices),
      auditLog: deepClone(auditLog),
      systemLogs: deepClone(systemLogs),
      followUps: deepClone(followUps),
      followUpActions: deepClone(followUpActions),
      collectionNotes: deepClone(collectionNotes),
      collectionPromises: deepClone(collectionPromises),
      accountHolds: deepClone(accountHolds),
      receipts: deepClone(receipts),
      creditNotes: deepClone(creditNotes),
      users: deepClone(users),
      corporateCustomers: deepClone(corporateCustomers),
      purchaseOrders: deepClone(purchaseOrders),
      barrels: deepClone(barrels),
      certificatesOfCompliance: deepClone(certificatesOfCompliance),
      packingListLines: deepClone(packingListLines),
    },
  };
  return JSON.stringify(backup);
}

export function restoreFromBackup(backupJson: string): { success: boolean; error?: string } {
  try {
    const backup = JSON.parse(backupJson);
    if (!backup.data) return { success: false, error: "Invalid backup format" };
    if (backup.data.customers) customers = backup.data.customers;
    if (backup.data.products) products = backup.data.products;
    if (backup.data.orders) orders = backup.data.orders;
    if (backup.data.invoices) invoices = backup.data.invoices;
    if (backup.data.appointments) appointments = backup.data.appointments;
    if (backup.data.checkins) checkins = backup.data.checkins;
    if (backup.data.specialPrices) specialPrices = backup.data.specialPrices;
    if (backup.data.auditLog) auditLog = backup.data.auditLog;
    if (backup.data.systemLogs) systemLogs = backup.data.systemLogs;
    if (backup.data.followUps) followUps = backup.data.followUps;
    if (backup.data.followUpActions) followUpActions = backup.data.followUpActions;
    if (backup.data.collectionNotes) collectionNotes = backup.data.collectionNotes;
    if (backup.data.collectionPromises) collectionPromises = backup.data.collectionPromises;
    if (backup.data.accountHolds) accountHolds = backup.data.accountHolds;
    if (backup.data.receipts) receipts = backup.data.receipts;
    if (backup.data.creditNotes) creditNotes = backup.data.creditNotes;
    if (backup.data.users) users = backup.data.users;
    if (backup.data.corporateCustomers) corporateCustomers = backup.data.corporateCustomers;
    if (backup.data.purchaseOrders) purchaseOrders = backup.data.purchaseOrders;
    if (backup.data.barrels) barrels = backup.data.barrels;
    if (backup.data.certificatesOfCompliance) certificatesOfCompliance = backup.data.certificatesOfCompliance;
    if (backup.data.packingListLines) packingListLines = backup.data.packingListLines;
    // Save all to localStorage
    saveItem("sgf_customers", customers);
    saveItem("sgf_products", products);
    saveItem("sgf_orders", orders);
    saveItem("sgf_invoices", invoices);
    saveItem("sgf_appointments", appointments);
    saveItem("sgf_checkins", checkins);
    saveItem("sgf_specialPrices", specialPrices);
    saveItem("sgf_auditLog", auditLog);
    saveItem("sgf_systemLogs", systemLogs);
    saveItem("sgf_followUps", followUps);
    saveItem("sgf_followUpActions", followUpActions);
    saveItem("sgf_collectionNotes", collectionNotes);
    saveItem("sgf_collectionPromises", collectionPromises);
    saveItem("sgf_accountHolds", accountHolds);
    saveItem("sgf_receipts", receipts);
    saveItem("sgf_creditNotes", creditNotes);
    saveItem("sgf_users", users);
    saveItem("sgf_corporateCustomers", corporateCustomers);
    saveItem("sgf_purchaseOrders", purchaseOrders);
    saveItem("sgf_barrels", barrels);
    saveItem("sgf_certificatesOfCompliance", certificatesOfCompliance);
    saveItem("sgf_packingListLines", packingListLines);
    logAudit("restore", "system", 0, { timestamp: backup.timestamp });
    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

// =============================================================================
// DATA INTEGRITY / VALIDATION
// =============================================================================

export function validateDataIntegrity(): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  // Check for orphaned orders (customer doesn't exist)
  for (const order of orders) {
    if (!customers.find((c) => c.id === order.customerId)) {
      issues.push(`Order ${order.orderNumber} has invalid customer ${order.customerId}`);
    }
  }
  // Check for orphaned invoices (customer doesn't exist)
  for (const invoice of invoices) {
    if (!customers.find((c) => c.id === invoice.customerId)) {
      issues.push(`Invoice ${invoice.invoiceNumber} has invalid customer ${invoice.customerId}`);
    }
  }
  // Check for orphaned order items (product doesn't exist)
  for (const order of orders) {
    if (order.items) {
      for (const item of order.items) {
        if (!products.find((p) => p.id === item.stockItemId)) {
          issues.push(`Order ${order.orderNumber} has invalid product ${item.stockItemId}`);
        }
      }
    }
  }
  // Check for negative stock
  for (const product of products) {
    if ((product.quantity || 0) < 0) {
      issues.push(`Product ${product.productName} has negative stock: ${product.quantity}`);
    }
  }
  // Check for duplicate invoice numbers
  const invoiceNumbers = new Map<string, number[]>();
  for (const invoice of invoices) {
    const num = invoice.invoiceNumber;
    if (!invoiceNumbers.has(num)) invoiceNumbers.set(num, []);
    invoiceNumbers.get(num)!.push(invoice.id);
  }
  for (const [num, ids] of invoiceNumbers) {
    if (ids.length > 1) {
      issues.push(`Duplicate invoice number ${num} on invoices: ${ids.join(", ")}`);
    }
  }
  // Check for duplicate order numbers
  const orderNumbers = new Map<string, number[]>();
  for (const order of orders) {
    const num = order.orderNumber;
    if (!orderNumbers.has(num)) orderNumbers.set(num, []);
    orderNumbers.get(num)!.push(order.id);
  }
  for (const [num, ids] of orderNumbers) {
    if (ids.length > 1) {
      issues.push(`Duplicate order number ${num} on orders: ${ids.join(", ")}`);
    }
  }
  return { valid: issues.length === 0, issues };
}

/** Repair broken data references and duplicate numbers.
 *  Returns report of all repairs made. */
export function repairData(): { repairs: string[] } {
  const repairs: string[] = [];
  const integrity = validateDataIntegrity();
  if (integrity.valid) return { repairs: ["No issues found"] };
  for (const issue of integrity.issues) {
    if (issue.includes("invalid customer")) {
      // Remove orphaned orders/invoices
      const orderMatch = issue.match(/Order (\S+) has invalid customer/);
      if (orderMatch) {
        const orderNum = orderMatch[1];
        const idx = orders.findIndex((o) => o.orderNumber === orderNum);
        if (idx !== -1) {
          orders.splice(idx, 1);
          repairs.push(`Removed orphaned order ${orderNum}`);
        }
      }
      const invoiceMatch = issue.match(/Invoice (\S+) has invalid customer/);
      if (invoiceMatch) {
        const invNum = invoiceMatch[1];
        const idx = invoices.findIndex((i) => i.invoiceNumber === invNum);
        if (idx !== -1) {
          invoices.splice(idx, 1);
          repairs.push(`Removed orphaned invoice ${invNum}`);
        }
      }
    }
    if (issue.includes("invalid product")) {
      // Remove invalid items from orders
      const orderMatch = issue.match(/Order (\S+) has invalid product (\d+)/);
      if (orderMatch) {
        const orderNum = orderMatch[1];
        const productId = parseInt(orderMatch[2]);
        const order = orders.find((o) => o.orderNumber === orderNum);
        if (order && order.items) {
          order.items = order.items.filter((item: any) => item.stockItemId !== productId);
          repairs.push(`Removed invalid product ${productId} from order ${orderNum}`);
        }
      }
    }
    if (issue.includes("negative stock")) {
      const productMatch = issue.match(/Product (.+) has negative stock: ([-\d.]+)/);
      if (productMatch) {
        const productName = productMatch[1];
        const product = products.find((p) => p.productName === productName);
        if (product) {
          product.quantity = 0;
          repairs.push(`Reset negative stock for ${productName} to 0`);
        }
      }
    }
    if (issue.includes("Duplicate invoice number")) {
      const dupMatch = issue.match(/Duplicate invoice number (\S+) on invoices: ([\d, ]+)/);
      if (dupMatch) {
        const invNum = dupMatch[1];
        const ids = dupMatch[2].split(", ").map((id) => parseInt(id.trim()));
        // Keep the first, renumber the rest
        for (let i = 1; i < ids.length; i++) {
          const invoice = invoices.find((inv) => inv.id === ids[i]);
          if (invoice) {
            const newNum = getNextInvoiceNumber();
            invoice.invoiceNumber = newNum;
            repairs.push(`Renamed duplicate invoice ${invNum} -> ${newNum}`);
          }
        }
      }
    }
    if (issue.includes("Duplicate order number")) {
      const dupMatch = issue.match(/Duplicate order number (\S+) on orders: ([\d, ]+)/);
      if (dupMatch) {
        const ordNum = dupMatch[1];
        const ids = dupMatch[2].split(", ").map((id) => parseInt(id.trim()));
        for (let i = 1; i < ids.length; i++) {
          const order = orders.find((o) => o.id === ids[i]);
          if (order) {
            const newNum = generateOrderNumber(order.orderType);
            order.orderNumber = newNum;
            repairs.push(`Renamed duplicate order ${ordNum} -> ${newNum}`);
          }
        }
      }
    }
  }
  saveItem("sgf_orders", orders);
  saveItem("sgf_invoices", invoices);
  saveItem("sgf_products", products);
  return { repairs };
}
