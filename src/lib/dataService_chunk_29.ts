// =============================================================================
// PROMOTION / CAMPAIGN SERVICE
// =============================================================================

export const promotionService = {
  list: () => {
    try {
      const raw = getStorageItem("sgf_promotions");
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return [];
  },
  getById: (id: number) => {
    const promotions = promotionService.list();
    return promotions.find((p: any) => p.id === id);
  },
  getActive: () => {
    const now = new Date().toISOString();
    const promotions = promotionService.list();
    return promotions.filter((p: any) => p.status === "active" && p.startDate <= now && p.endDate >= now);
  },
  create: (data: any) => {
    const promotions = promotionService.list();
    const newPromotion = {
      id: Date.now() + Math.random(),
      ...data,
      status: data.status || "draft",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    promotions.push(newPromotion);
    setStorageItem("sgf_promotions", JSON.stringify(promotions));
    logAudit("create", "promotion", newPromotion.id, data);
    return newPromotion;
  },
  update: (id: number, data: any) => {
    const promotions = promotionService.list();
    const index = promotions.findIndex((p: any) => p.id === id);
    if (index === -1) return null;
    promotions[index] = { ...promotions[index], ...data, updatedAt: new Date().toISOString() };
    setStorageItem("sgf_promotions", JSON.stringify(promotions));
    logAudit("update", "promotion", id, data);
    return promotions[index];
  },
  delete: (id: number) => {
    const promotions = promotionService.list();
    const index = promotions.findIndex((p: any) => p.id === id);
    if (index === -1) return { success: false, error: "Promotion not found" };
    promotions.splice(index, 1);
    setStorageItem("sgf_promotions", JSON.stringify(promotions));
    logAudit("delete", "promotion", id, {});
    return { success: true };
  },
};

// =============================================================================
// MARKETING / LEAD SERVICE
// =============================================================================

export const leadService = {
  list: () => {
    try {
      const raw = getStorageItem("sgf_leads");
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return [];
  },
  getById: (id: number) => {
    const leads = leadService.list();
    return leads.find((l: any) => l.id === id);
  },
  getByStatus: (status: string) => {
    const leads = leadService.list();
    return leads.filter((l: any) => l.status === status);
  },
  getBySource: (source: string) => {
    const leads = leadService.list();
    return leads.filter((l: any) => l.source === source);
  },
  create: (data: any) => {
    const leads = leadService.list();
    const newLead = {
      id: Date.now() + Math.random(),
      ...data,
      status: data.status || "new",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    leads.push(newLead);
    setStorageItem("sgf_leads", JSON.stringify(leads));
    logAudit("create", "lead", newLead.id, data);
    return newLead;
  },
  update: (id: number, data: any) => {
    const leads = leadService.list();
    const index = leads.findIndex((l: any) => l.id === id);
    if (index === -1) return null;
    leads[index] = { ...leads[index], ...data, updatedAt: new Date().toISOString() };
    setStorageItem("sgf_leads", JSON.stringify(leads));
    logAudit("update", "lead", id, data);
    return leads[index];
  },
  delete: (id: number) => {
    const leads = leadService.list();
    const index = leads.findIndex((l: any) => l.id === id);
    if (index === -1) return { success: false, error: "Lead not found" };
    leads.splice(index, 1);
    setStorageItem("sgf_leads", JSON.stringify(leads));
    logAudit("delete", "lead", id, {});
    return { success: true };
  },
  convertToCustomer: (id: number) => {
    const lead = leadService.getById(id);
    if (!lead) return { success: false, error: "Lead not found" };
    const newCustomer = customerService.create({
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      address: lead.address,
      source: lead.source,
    });
    lead.status = "converted";
    lead.customerId = newCustomer.id;
    lead.updatedAt = new Date().toISOString();
    setStorageItem("sgf_leads", JSON.stringify(leadService.list()));
    logAudit("convert", "lead", id, { customerId: newCustomer.id });
    return { success: true, customer: newCustomer };
  },
};

// =============================================================================
// CAMPAIGN / EMAIL MARKETING SERVICE
// =============================================================================

export const campaignService = {
  list: () => {
    try {
      const raw = getStorageItem("sgf_campaigns");
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return [];
  },
  getById: (id: number) => {
    const campaigns = campaignService.list();
    return campaigns.find((c: any) => c.id === id);
  },
  getByStatus: (status: string) => {
    const campaigns = campaignService.list();
    return campaigns.filter((c: any) => c.status === status);
  },
  create: (data: any) => {
    const campaigns = campaignService.list();
    const newCampaign = {
      id: Date.now() + Math.random(),
      ...data,
      status: data.status || "draft",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    campaigns.push(newCampaign);
    setStorageItem("sgf_campaigns", JSON.stringify(campaigns));
    logAudit("create", "campaign", newCampaign.id, data);
    return newCampaign;
  },
  update: (id: number, data: any) => {
    const campaigns = campaignService.list();
    const index = campaigns.findIndex((c: any) => c.id === id);
    if (index === -1) return null;
    campaigns[index] = { ...campaigns[index], ...data, updatedAt: new Date().toISOString() };
    setStorageItem("sgf_campaigns", JSON.stringify(campaigns));
    logAudit("update", "campaign", id, data);
    return campaigns[index];
  },
  delete: (id: number) => {
    const campaigns = campaignService.list();
    const index = campaigns.findIndex((c: any) => c.id === id);
    if (index === -1) return { success: false, error: "Campaign not found" };
    campaigns.splice(index, 1);
    setStorageItem("sgf_campaigns", JSON.stringify(campaigns));
    logAudit("delete", "campaign", id, {});
    return { success: true };
  },
};

// =============================================================================
// SOCIAL MEDIA / INTEGRATION SERVICE
// =============================================================================

export const socialMediaService = {
  getAccounts: () => {
    try {
      const raw = getStorageItem("sgf_socialAccounts");
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return [];
  },
  addAccount: (data: any) => {
    const accounts = socialMediaService.getAccounts();
    const newAccount = {
      id: Date.now() + Math.random(),
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    accounts.push(newAccount);
    setStorageItem("sgf_socialAccounts", JSON.stringify(accounts));
    logAudit("create", "socialAccount", newAccount.id, data);
    return newAccount;
  },
  removeAccount: (id: number) => {
    const accounts = socialMediaService.getAccounts();
    const index = accounts.findIndex((a: any) => a.id === id);
    if (index === -1) return { success: false, error: "Account not found" };
    accounts.splice(index, 1);
    setStorageItem("sgf_socialAccounts", JSON.stringify(accounts));
    logAudit("delete", "socialAccount", id, {});
    return { success: true };
  },
};

// =============================================================================
// REVIEW / TESTIMONIAL SERVICE
// =============================================================================

export const reviewService = {
  list: () => {
    try {
      const raw = getStorageItem("sgf_reviews");
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return [];
  },
  getById: (id: number) => {
    const reviews = reviewService.list();
    return reviews.find((r: any) => r.id === id);
  },
  getByCustomer: (customerId: number) => {
    const reviews = reviewService.list();
    return reviews.filter((r: any) => r.customerId === customerId);
  },
  getByRating: (rating: number) => {
    const reviews = reviewService.list();
    return reviews.filter((r: any) => r.rating === rating);
  },
  create: (data: any) => {
    const reviews = reviewService.list();
    const newReview = {
      id: Date.now() + Math.random(),
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    reviews.push(newReview);
    setStorageItem("sgf_reviews", JSON.stringify(reviews));
    logAudit("create", "review", newReview.id, data);
    return newReview;
  },
  update: (id: number, data: any) => {
    const reviews = reviewService.list();
    const index = reviews.findIndex((r: any) => r.id === id);
    if (index === -1) return null;
    reviews[index] = { ...reviews[index], ...data, updatedAt: new Date().toISOString() };
    setStorageItem("sgf_reviews", JSON.stringify(reviews));
    logAudit("update", "review", id, data);
    return reviews[index];
  },
  delete: (id: number) => {
    const reviews = reviewService.list();
    const index = reviews.findIndex((r: any) => r.id === id);
    if (index === -1) return { success: false, error: "Review not found" };
    reviews.splice(index, 1);
    setStorageItem("sgf_reviews", JSON.stringify(reviews));
    logAudit("delete", "review", id, {});
    return { success: true };
  },
};
