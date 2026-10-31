// =============================================================================
// BANK / PAYMENT METHOD SERVICE
// =============================================================================

export const bankService = {
  list: () => {
    try {
      const raw = getStorageItem("sgf_banks");
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return [];
  },
  getById: (id: number) => {
    const banks = bankService.list();
    return banks.find((b: any) => b.id === id);
  },
  create: (data: any) => {
    const banks = bankService.list();
    const newBank = {
      id: Date.now() + Math.random(),
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    banks.push(newBank);
    setStorageItem("sgf_banks", JSON.stringify(banks));
    logAudit("create", "bank", newBank.id, data);
    return newBank;
  },
  update: (id: number, data: any) => {
    const banks = bankService.list();
    const index = banks.findIndex((b: any) => b.id === id);
    if (index === -1) return null;
    banks[index] = { ...banks[index], ...data, updatedAt: new Date().toISOString() };
    setStorageItem("sgf_banks", JSON.stringify(banks));
    logAudit("update", "bank", id, data);
    return banks[index];
  },
  delete: (id: number) => {
    const banks = bankService.list();
    const index = banks.findIndex((b: any) => b.id === id);
    if (index === -1) return { success: false, error: "Bank not found" };
    banks.splice(index, 1);
    setStorageItem("sgf_banks", JSON.stringify(banks));
    logAudit("delete", "bank", id, {});
    return { success: true };
  },
};

// =============================================================================
// TAX / VAT SERVICE
// =============================================================================

export const taxService = {
  getTaxRate: () => {
    try {
      const raw = getStorageItem("sgf_taxRate");
      if (raw) return parseFloat(raw);
    } catch { /* ignore */ }
    return 0.15; // Default 15% VAT
  },
  setTaxRate: (rate: number) => {
    setStorageItem("sgf_taxRate", String(rate));
    logAudit("update", "taxRate", 0, { rate });
    return rate;
  },
  calculateTax: (amount: number) => {
    const rate = taxService.getTaxRate();
    return Math.round(amount * rate * 100) / 100;
  },
  calculateTotalWithTax: (amount: number) => {
    const rate = taxService.getTaxRate();
    return Math.round(amount * (1 + rate) * 100) / 100;
  },
  calculateAmountWithoutTax: (total: number) => {
    const rate = taxService.getTaxRate();
    return Math.round(total / (1 + rate) * 100) / 100;
  },
};

// =============================================================================
// DISCOUNT / PROMOTION SERVICE
// =============================================================================

export const discountService = {
  list: () => {
    try {
      const raw = getStorageItem("sgf_discounts");
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return [];
  },
  getById: (id: number) => {
    const discounts = discountService.list();
    return discounts.find((d: any) => d.id === id);
  },
  create: (data: any) => {
    const discounts = discountService.list();
    const newDiscount = {
      id: Date.now() + Math.random(),
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    discounts.push(newDiscount);
    setStorageItem("sgf_discounts", JSON.stringify(discounts));
    logAudit("create", "discount", newDiscount.id, data);
    return newDiscount;
  },
  update: (id: number, data: any) => {
    const discounts = discountService.list();
    const index = discounts.findIndex((d: any) => d.id === id);
    if (index === -1) return null;
    discounts[index] = { ...discounts[index], ...data, updatedAt: new Date().toISOString() };
    setStorageItem("sgf_discounts", JSON.stringify(discounts));
    logAudit("update", "discount", id, data);
    return discounts[index];
  },
  delete: (id: number) => {
    const discounts = discountService.list();
    const index = discounts.findIndex((d: any) => d.id === id);
    if (index === -1) return { success: false, error: "Discount not found" };
    discounts.splice(index, 1);
    setStorageItem("sgf_discounts", JSON.stringify(discounts));
    logAudit("delete", "discount", id, {});
    return { success: true };
  },
  applyDiscount: (amount: number, discountId: number) => {
    const discount = discountService.getById(discountId);
    if (!discount) return amount;
    if (discount.type === "percentage") {
      return amount * (1 - (discount.value || 0) / 100);
    } else if (discount.type === "fixed") {
      return Math.max(0, amount - (discount.value || 0));
    }
    return amount;
  },
};

// =============================================================================
// CURRENCY / EXCHANGE RATE SERVICE
// =============================================================================

export const currencyService = {
  getBaseCurrency: () => {
    try {
      const raw = getStorageItem("sgf_baseCurrency");
      if (raw) return raw;
    } catch { /* ignore */ }
    return "ZAR";
  },
  setBaseCurrency: (currency: string) => {
    setStorageItem("sgf_baseCurrency", currency);
    logAudit("update", "baseCurrency", 0, { currency });
    return currency;
  },
  getExchangeRate: (currency: string) => {
    try {
      const raw = getStorageItem(`sgf_exchangeRate_${currency}`);
      if (raw) return parseFloat(raw);
    } catch { /* ignore */ }
    return 1;
  },
  setExchangeRate: (currency: string, rate: number) => {
    setStorageItem(`sgf_exchangeRate_${currency}`, String(rate));
    logAudit("update", "exchangeRate", 0, { currency, rate });
    return rate;
  },
  convert: (amount: number, from: string, to: string) => {
    if (from === to) return amount;
    const fromRate = currencyService.getExchangeRate(from);
    const toRate = currencyService.getExchangeRate(to);
    return Math.round((amount / fromRate) * toRate * 100) / 100;
  },
};

// =============================================================================
// COMPANY / BRANCH SERVICE
// =============================================================================

export const companyService = {
  getCompanyInfo: () => {
    try {
      const raw = getStorageItem("sgf_companyInfo");
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return {
      name: "Supreme Global Foods",
      registration: "",
      vatNumber: "",
      address: "",
      phone: "",
      email: "",
      website: "",
    };
  },
  setCompanyInfo: (data: any) => {
    const current = companyService.getCompanyInfo();
    const updated = { ...current, ...data };
    setStorageItem("sgf_companyInfo", JSON.stringify(updated));
    logAudit("update", "companyInfo", 0, data);
    return updated;
  },
  getBranches: () => {
    try {
      const raw = getStorageItem("sgf_branches");
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return [];
  },
  createBranch: (data: any) => {
    const branches = companyService.getBranches();
    const newBranch = {
      id: Date.now() + Math.random(),
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    branches.push(newBranch);
    setStorageItem("sgf_branches", JSON.stringify(branches));
    logAudit("create", "branch", newBranch.id, data);
    return newBranch;
  },
  updateBranch: (id: number, data: any) => {
    const branches = companyService.getBranches();
    const index = branches.findIndex((b: any) => b.id === id);
    if (index === -1) return null;
    branches[index] = { ...branches[index], ...data, updatedAt: new Date().toISOString() };
    setStorageItem("sgf_branches", JSON.stringify(branches));
    logAudit("update", "branch", id, data);
    return branches[index];
  },
  deleteBranch: (id: number) => {
    const branches = companyService.getBranches();
    const index = branches.findIndex((b: any) => b.id === id);
    if (index === -1) return { success: false, error: "Branch not found" };
    branches.splice(index, 1);
    setStorageItem("sgf_branches", JSON.stringify(branches));
    logAudit("delete", "branch", id, {});
    return { success: true };
  },
};
