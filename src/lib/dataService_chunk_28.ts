// =============================================================================
// SALES COMMISSION / INCENTIVE SERVICE
// =============================================================================

export const commissionService = {
  getRules: () => {
    try {
      const raw = getStorageItem("sgf_commissionRules");
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return [];
  },
  createRule: (data: any) => {
    const rules = commissionService.getRules();
    const newRule = {
      id: Date.now() + Math.random(),
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    rules.push(newRule);
    setStorageItem("sgf_commissionRules", JSON.stringify(rules));
    logAudit("create", "commissionRule", newRule.id, data);
    return newRule;
  },
  updateRule: (id: number, data: any) => {
    const rules = commissionService.getRules();
    const index = rules.findIndex((r: any) => r.id === id);
    if (index === -1) return null;
    rules[index] = { ...rules[index], ...data, updatedAt: new Date().toISOString() };
    setStorageItem("sgf_commissionRules", JSON.stringify(rules));
    logAudit("update", "commissionRule", id, data);
    return rules[index];
  },
  deleteRule: (id: number) => {
    const rules = commissionService.getRules();
    const index = rules.findIndex((r: any) => r.id === id);
    if (index === -1) return { success: false, error: "Rule not found" };
    rules.splice(index, 1);
    setStorageItem("sgf_commissionRules", JSON.stringify(rules));
    logAudit("delete", "commissionRule", id, {});
    return { success: true };
  },
  calculateCommission: (repName: string, startDate?: string, endDate?: string) => {
    const rules = commissionService.getRules();
    let filtered = orders.filter((o) => o.salesRepName === repName);
    if (startDate) filtered = filtered.filter((o) => o.orderDate >= startDate);
    if (endDate) filtered = filtered.filter((o) => o.orderDate <= endDate);
    const totalSales = filtered.reduce((sum, o) => sum + (o.total || 0), 0);
    let commission = 0;
    for (const rule of rules) {
      if (rule.type === "percentage") {
        commission += totalSales * (rule.value / 100);
      } else if (rule.type === "fixed") {
        commission += rule.value * filtered.length;
      } else if (rule.type === "tiered") {
        for (const tier of rule.tiers || []) {
          if (totalSales >= tier.min && totalSales <= tier.max) {
            commission += totalSales * (tier.rate / 100);
            break;
          }
        }
      }
    }
    return { totalSales, commission: Math.round(commission * 100) / 100, orders: filtered.length };
  },
};

// =============================================================================
// PRICE LIST / CATALOG SERVICE
// =============================================================================

export const priceListService = {
  list: () => {
    try {
      const raw = getStorageItem("sgf_priceLists");
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return [];
  },
  getById: (id: number) => {
    const priceLists = priceListService.list();
    return priceLists.find((p: any) => p.id === id);
  },
  getByCustomer: (customerId: number) => {
    const priceLists = priceListService.list();
    return priceLists.filter((p: any) => p.customerId === customerId);
  },
  create: (data: any) => {
    const priceLists = priceListService.list();
    const newPriceList = {
      id: Date.now() + Math.random(),
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    priceLists.push(newPriceList);
    setStorageItem("sgf_priceLists", JSON.stringify(priceLists));
    logAudit("create", "priceList", newPriceList.id, data);
    return newPriceList;
  },
  update: (id: number, data: any) => {
    const priceLists = priceListService.list();
    const index = priceLists.findIndex((p: any) => p.id === id);
    if (index === -1) return null;
    priceLists[index] = { ...priceLists[index], ...data, updatedAt: new Date().toISOString() };
    setStorageItem("sgf_priceLists", JSON.stringify(priceLists));
    logAudit("update", "priceList", id, data);
    return priceLists[index];
  },
  delete: (id: number) => {
    const priceLists = priceListService.list();
    const index = priceLists.findIndex((p: any) => p.id === id);
    if (index === -1) return { success: false, error: "Price list not found" };
    priceLists.splice(index, 1);
    setStorageItem("sgf_priceLists", JSON.stringify(priceLists));
    logAudit("delete", "priceList", id, {});
    return { success: true };
  },
};

// =============================================================================
// TENDER / BID SERVICE
// =============================================================================

export const tenderService = {
  list: () => {
    try {
      const raw = getStorageItem("sgf_tenders");
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return [];
  },
  getById: (id: number) => {
    const tenders = tenderService.list();
    return tenders.find((t: any) => t.id === id);
  },
  getByStatus: (status: string) => {
    const tenders = tenderService.list();
    return tenders.filter((t: any) => t.status === status);
  },
  create: (data: any) => {
    const tenders = tenderService.list();
    const newTender = {
      id: Date.now() + Math.random(),
      ...data,
      status: data.status || "draft",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    tenders.push(newTender);
    setStorageItem("sgf_tenders", JSON.stringify(tenders));
    logAudit("create", "tender", newTender.id, data);
    return newTender;
  },
  update: (id: number, data: any) => {
    const tenders = tenderService.list();
    const index = tenders.findIndex((t: any) => t.id === id);
    if (index === -1) return null;
    tenders[index] = { ...tenders[index], ...data, updatedAt: new Date().toISOString() };
    setStorageItem("sgf_tenders", JSON.stringify(tenders));
    logAudit("update", "tender", id, data);
    return tenders[index];
  },
  delete: (id: number) => {
    const tenders = tenderService.list();
    const index = tenders.findIndex((t: any) => t.id === id);
    if (index === -1) return { success: false, error: "Tender not found" };
    tenders.splice(index, 1);
    setStorageItem("sgf_tenders", JSON.stringify(tenders));
    logAudit("delete", "tender", id, {});
    return { success: true };
  },
};

// =============================================================================
// LOYALTY / REWARD SERVICE
// =============================================================================

export const loyaltyService = {
  getPoints: (customerId: number) => {
    try {
      const raw = getStorageItem(`sgf_loyalty_${customerId}`);
      if (raw) return parseInt(raw, 10);
    } catch { /* ignore */ }
    return 0;
  },
  addPoints: (customerId: number, points: number) => {
    const current = loyaltyService.getPoints(customerId);
    const newTotal = current + points;
    setStorageItem(`sgf_loyalty_${customerId}`, String(newTotal));
    logAudit("update", "loyaltyPoints", customerId, { points, newTotal });
    return newTotal;
  },
  redeemPoints: (customerId: number, points: number) => {
    const current = loyaltyService.getPoints(customerId);
    if (current < points) return { success: false, error: "Insufficient points" };
    const newTotal = current - points;
    setStorageItem(`sgf_loyalty_${customerId}`, String(newTotal));
    logAudit("update", "loyaltyPoints", customerId, { redeemed: points, newTotal });
    return { success: true, newTotal };
  },
  getRules: () => {
    try {
      const raw = getStorageItem("sgf_loyaltyRules");
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return { earnRate: 1, redeemRate: 0.01 };
  },
};

// =============================================================================
// GIFT VOUCHER / CERTIFICATE SERVICE
// =============================================================================

export const voucherService = {
  list: () => {
    try {
      const raw = getStorageItem("sgf_vouchers");
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return [];
  },
  getById: (id: number) => {
    const vouchers = voucherService.list();
    return vouchers.find((v: any) => v.id === id);
  },
  getByCode: (code: string) => {
    const vouchers = voucherService.list();
    return vouchers.find((v: any) => v.code === code);
  },
  create: (data: any) => {
    const vouchers = voucherService.list();
    const newVoucher = {
      id: Date.now() + Math.random(),
      code: `VC${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      ...data,
      status: data.status || "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    vouchers.push(newVoucher);
    setStorageItem("sgf_vouchers", JSON.stringify(vouchers));
    logAudit("create", "voucher", newVoucher.id, data);
    return newVoucher;
  },
  update: (id: number, data: any) => {
    const vouchers = voucherService.list();
    const index = vouchers.findIndex((v: any) => v.id === id);
    if (index === -1) return null;
    vouchers[index] = { ...vouchers[index], ...data, updatedAt: new Date().toISOString() };
    setStorageItem("sgf_vouchers", JSON.stringify(vouchers));
    logAudit("update", "voucher", id, data);
    return vouchers[index];
  },
  delete: (id: number) => {
    const vouchers = voucherService.list();
    const index = vouchers.findIndex((v: any) => v.id === id);
    if (index === -1) return { success: false, error: "Voucher not found" };
    vouchers.splice(index, 1);
    setStorageItem("sgf_vouchers", JSON.stringify(vouchers));
    logAudit("delete", "voucher", id, {});
    return { success: true };
  },
  redeem: (code: string, amount: number) => {
    const voucher = voucherService.getByCode(code);
    if (!voucher) return { success: false, error: "Voucher not found" };
    if (voucher.status !== "active") return { success: false, error: "Voucher is not active" };
    if (voucher.balance < amount) return { success: false, error: "Insufficient voucher balance" };
    voucher.balance -= amount;
    if (voucher.balance <= 0) voucher.status = "redeemed";
    voucher.updatedAt = new Date().toISOString();
    setStorageItem("sgf_vouchers", JSON.stringify(voucherService.list()));
    logAudit("update", "voucher", voucher.id, { redeemed: amount, balance: voucher.balance });
    return { success: true, voucher };
  },
};
