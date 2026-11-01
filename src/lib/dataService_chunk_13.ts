    item.name?.toLowerCase().includes(q) ||
    item.productCode?.toLowerCase().includes(q) ||
    item.category?.toLowerCase().includes(q) ||
    item.customerCode?.toLowerCase().includes(q) ||
    item.city?.toLowerCase().includes(q)
  );
}

export { SALES_REPS, getCommittedStock, getAvailableStock };

/* ─── CUSTOMER CREDIT & ACTIVITY HELPERS ─── */

/** Sum outstanding balanceDue for all non-cancelled invoices linked to a regular customer */
function getCustomerOutstandingBalance(customerId: number): number {
  return invoices
    .filter((inv) => inv.customerId == customerId && inv.status !== "cancelled" && (inv.balanceDue || 0) > 0.01)
    .reduce((sum, inv) => sum + (inv.balanceDue || 0), 0);
}

/** Sum outstanding balanceDue for all non-cancelled invoices linked to a corporate customer via purchaseOrderId */
function getCorporateCustomerOutstandingBalance(corporateCustomerId: number): number {
  const poIds = purchaseOrders
    .filter((po) => po.corporateCustomerId == corporateCustomerId)
    .map((po) => po.id);
  return invoices
    .filter((inv) => inv.purchaseOrderId != null && poIds.includes(inv.purchaseOrderId) && inv.status !== "cancelled" && (inv.balanceDue || 0) > 0.01)
    .reduce((sum, inv) => sum + (inv.balanceDue || 0), 0);
}

/** Check if a regular customer is allowed to place an order.
 *  Returns { blocked: false } if OK, or { blocked: true, reason: string } if blocked.
 *  overrideBySuperAdmin bypasses all checks. */
function checkCustomerCanOrder(
  customerId: number,
  paymentTerms: string,
  overrideBySuperAdmin = false
): { blocked: boolean; reason?: string } {
  if (overrideBySuperAdmin) return { blocked: false };

  const customer = customers.find((c) => c.id == customerId);
  if (!customer) return { blocked: true, reason: "Customer not found." };

  // 1. Customer deactivated
  if (customer.isActive === false) {
    return { blocked: true, reason: `Customer account is inactive. Contact admin to reactivate.` };
  }

  // 2. Credit limit exceeded (only for 7/14/30 day terms)
  const creditLimit = Number(customer.creditLimit || 0);
  if (creditLimit > 0 && paymentTerms !== "cod") {
    const outstanding = getCustomerOutstandingBalance(customerId);
    if (outstanding >= creditLimit) {
      return { blocked: true, reason: `Credit limit exceeded. Limit: R ${creditLimit.toFixed(2)}, Outstanding: R ${outstanding.toFixed(2)}. Super admin PIN required.` };
    }
  }

  // 3. COD: unpaid delivered orders older than 2 days
  if (paymentTerms === "cod") {
    const twoDaysAgo = new Date(Date.now() - 2 * 86400000);
    const unpaidCODInvoices = invoices.filter((inv) => {
      if (inv.customerId != customerId) return false;
      if (inv.status === "cancelled") return false;
      if ((inv.balanceDue || 0) <= 0.01) return false;
      const invDate = new Date(inv.invoiceDate || inv.createdAt);
      return invDate < twoDaysAgo;
    });
    if (unpaidCODInvoices.length > 0) {
      const totalUnpaid = unpaidCODInvoices.reduce((s, inv) => s + (inv.balanceDue || 0), 0);
      return { blocked: true, reason: `COD account has unpaid invoices older than 2 days (R ${totalUnpaid.toFixed(2)}). Settle in full before placing new orders. Super admin PIN required.` };
    }
  }

  return { blocked: false };
}

/** Check if a corporate customer is allowed to place a purchase order.
 *  Same logic as regular customers but uses corporate customer data. */
function checkCorporateCustomerCanOrder(
  corporateCustomerId: number,
  overrideBySuperAdmin = false
): { blocked: boolean; reason?: string } {
  if (overrideBySuperAdmin) return { blocked: false };

  const corpCustomer = corporateCustomers.find((c) => c.id == corporateCustomerId);
  if (!corpCustomer) return { blocked: true, reason: "Corporate customer not found." };

  // 1. Customer deactivated
  if (corpCustomer.isActive === false) {
    return { blocked: true, reason: `Corporate customer account is inactive. Contact admin to reactivate.` };
  }

  // 2. Credit limit exceeded
  const creditLimit = Number(corpCustomer.creditLimit || 0);
  if (creditLimit > 0) {
    const outstanding = getCorporateCustomerOutstandingBalance(corporateCustomerId);
    if (outstanding >= creditLimit) {
      return { blocked: true, reason: `Credit limit exceeded. Limit: R ${creditLimit.toFixed(2)}, Outstanding: R ${outstanding.toFixed(2)}. Super admin PIN required.` };
    }
  }

  // 3. COD: unpaid invoices older than 2 days
  const paymentTerms = corpCustomer.paymentTerms || "30_days";
  if (paymentTerms === "cod") {
    const twoDaysAgo = new Date(Date.now() - 2 * 86400000);
    const poIds = purchaseOrders
      .filter((po) => po.corporateCustomerId == corporateCustomerId)
      .map((po) => po.id);
    const unpaidCODInvoices = invoices.filter((inv) => {
      if (inv.purchaseOrderId == null || !poIds.includes(inv.purchaseOrderId)) return false;
      if (inv.status === "cancelled") return false;
      if ((inv.balanceDue || 0) <= 0.01) return false;
      const invDate = new Date(inv.invoiceDate || inv.createdAt);
      return invDate < twoDaysAgo;
    });
    if (unpaidCODInvoices.length > 0) {
      const totalUnpaid = unpaidCODInvoices.reduce((s, inv) => s + (inv.balanceDue || 0), 0);
      return { blocked: true, reason: `COD account has unpaid invoices older than 2 days (R ${totalUnpaid.toFixed(2)}). Settle in full before placing new orders. Super admin PIN required.` };
    }
  }

  return { blocked: false };
}

const dataService = {
  auth: {
    me: () => {
      const demoStr = localStorage.getItem("demo_user");
      return demoStr ? JSON.parse(demoStr) : null;
    },
  },

  stock: {
    list: () => products,
    search: ({ query }: { query: string }) => searchItems(products, query),
    getById: (id: number) => products.find((p) => p.id == id) || null,
    getCategories: () => [...new Set(products.map((p) => p.category).filter(Boolean))].sort(),
    getStats: () => ({
      totalProducts: products.length,
      totalRetailValue: products.reduce((sum, p) => sum + Number(p.retailPrice || 0) * (p.quantity || 0), 0),
      lowStock: products.filter((p) => p.status === "low_stock").length,
      outOfStock: products.filter((p) => p.status === "out_of_stock").length,
    }),
    create: (data: any) => {
      const newItem = { ...data, id: Date.now(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      products.push(newItem);
      saveItem("sgf_products", products);
      logAudit("CREATE", "stock", newItem.id, `Stock item created: ${newItem.productName || newItem.productCode || "Unnamed"}`);
      return newItem;
    },
    update: ({ id, data }: { id: number; data: any }) => {
      const idx = products.findIndex((p) => p.id == id);
      if (idx >= 0) { 
        const oldProd = products[idx];
        products[idx] = { ...products[idx], ...data, updatedAt: new Date().toISOString() }; 
        saveItem("sgf_products", products); 
        logAudit("UPDATE", "stock", id, `Stock item updated: ${oldProd.productName || oldProd.productCode || "Unnamed"}`);
        return products[idx]; 
      }
      return null;
    },
    delete: (id: number) => {
      const prod = products.find((p) => p.id == id);
      products = products.filter((p) => p.id != id);
      saveItem("sgf_products", products);
