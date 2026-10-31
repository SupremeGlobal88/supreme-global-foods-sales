// =============================================================================
// CUSTOMER PORTAL / SELF-SERVICE SERVICE
// =============================================================================

export const customerPortalService = {
  getCustomerDashboard: (customerId: number) => {
    const customer = customers.find((c) => c.id === customerId);
    if (!customer) return null;
    const customerOrders = orders.filter((o) => o.customerId === customerId);
    const customerInvoices = invoices.filter((i) => i.customerId === customerId);
    const customerReceipts = receipts.filter((r) => r.customerId === customerId);
    return {
      customer,
      orders: {
        total: customerOrders.length,
        pending: customerOrders.filter((o) => o.status === "pending" || o.status === "confirmed").length,
        completed: customerOrders.filter((o) => o.status === "completed" || o.status === "delivered").length,
        totalValue: customerOrders.reduce((sum, o) => sum + (o.total || 0), 0),
      },
      invoices: {
        total: customerInvoices.length,
        paid: customerInvoices.filter((i) => i.status === "paid").length,
        overdue: customerInvoices.filter((i) => i.status === "sent" && i.dueDate && new Date(i.dueDate) < new Date()).length,
        totalValue: customerInvoices.reduce((sum, i) => sum + (i.total || 0), 0),
        balanceDue: customerInvoices.reduce((sum, i) => sum + (i.balanceDue || 0), 0),
      },
      receipts: {
        total: customerReceipts.length,
        totalValue: customerReceipts.reduce((sum, r) => sum + (r.amount || 0), 0),
      },
    };
  },
  getCustomerOrderHistory: (customerId: number) => {
    return orders
      .filter((o) => o.customerId === customerId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },
  getCustomerInvoiceHistory: (customerId: number) => {
    return invoices
      .filter((i) => i.customerId === customerId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },
};

// =============================================================================
// SALES PIPELINE / FUNNEL SERVICE
// =============================================================================

export const salesPipelineService = {
  getPipeline: () => {
    const stages = ["lead", "qualified", "proposal", "negotiation", "closed_won", "closed_lost"];
    return stages.map((stage) => ({
      stage,
      count: orders.filter((o) => o.pipelineStage === stage).length,
      value: orders.filter((o) => o.pipelineStage === stage).reduce((sum, o) => sum + (o.total || 0), 0),
    }));
  },
  moveToStage: (orderId: number, stage: string) => {
    const order = orders.find((o) => o.id === orderId);
    if (!order) return { success: false, error: "Order not found" };
    order.pipelineStage = stage;
    order.updatedAt = new Date().toISOString();
    saveItem("sgf_orders", orders);
    logAudit("update", "orderPipeline", orderId, { stage });
    return { success: true, order };
  },
};

// =============================================================================
// COMPETITOR / MARKET SERVICE
// =============================================================================

export const competitorService = {
  list: () => {
    try {
      const raw = getStorageItem("sgf_competitors");
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return [];
  },
  getById: (id: number) => {
    const competitors = competitorService.list();
    return competitors.find((c: any) => c.id === id);
  },
  create: (data: any) => {
    const competitors = competitorService.list();
    const newCompetitor = {
      id: Date.now() + Math.random(),
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    competitors.push(newCompetitor);
    setStorageItem("sgf_competitors", JSON.stringify(competitors));
    logAudit("create", "competitor", newCompetitor.id, data);
    return newCompetitor;
  },
  update: (id: number, data: any) => {
    const competitors = competitorService.list();
    const index = competitors.findIndex((c: any) => c.id === id);
    if (index === -1) return null;
    competitors[index] = { ...competitors[index], ...data, updatedAt: new Date().toISOString() };
    setStorageItem("sgf_competitors", JSON.stringify(competitors));
    logAudit("update", "competitor", id, data);
    return competitors[index];
  },
  delete: (id: number) => {
    const competitors = competitorService.list();
    const index = competitors.findIndex((c: any) => c.id === id);
    if (index === -1) return { success: false, error: "Competitor not found" };
    competitors.splice(index, 1);
    setStorageItem("sgf_competitors", JSON.stringify(competitors));
    logAudit("delete", "competitor", id, {});
    return { success: true };
  },
};

// =============================================================================
// SURVEY / FEEDBACK SERVICE
// =============================================================================

export const surveyService = {
  list: () => {
    try {
      const raw = getStorageItem("sgf_surveys");
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return [];
  },
  getById: (id: number) => {
    const surveys = surveyService.list();
    return surveys.find((s: any) => s.id === id);
  },
  create: (data: any) => {
    const surveys = surveyService.list();
    const newSurvey = {
      id: Date.now() + Math.random(),
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    surveys.push(newSurvey);
    setStorageItem("sgf_surveys", JSON.stringify(surveys));
    logAudit("create", "survey", newSurvey.id, data);
    return newSurvey;
  },
  update: (id: number, data: any) => {
    const surveys = surveyService.list();
    const index = surveys.findIndex((s: any) => s.id === id);
    if (index === -1) return null;
    surveys[index] = { ...surveys[index], ...data, updatedAt: new Date().toISOString() };
    setStorageItem("sgf_surveys", JSON.stringify(surveys));
    logAudit("update", "survey", id, data);
    return surveys[index];
  },
  delete: (id: number) => {
    const surveys = surveyService.list();
    const index = surveys.findIndex((s: any) => s.id === id);
    if (index === -1) return { success: false, error: "Survey not found" };
    surveys.splice(index, 1);
    setStorageItem("sgf_surveys", JSON.stringify(surveys));
    logAudit("delete", "survey", id, {});
    return { success: true };
  },
};

// =============================================================================
// TICKET / SUPPORT SERVICE
// =============================================================================

export const ticketService = {
  list: () => {
    try {
      const raw = getStorageItem("sgf_tickets");
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return [];
  },
  getById: (id: number) => {
    const tickets = ticketService.list();
    return tickets.find((t: any) => t.id === id);
  },
  getByCustomer: (customerId: number) => {
    const tickets = ticketService.list();
    return tickets.filter((t: any) => t.customerId === customerId);
  },
  getByStatus: (status: string) => {
    const tickets = ticketService.list();
    return tickets.filter((t: any) => t.status === status);
  },
  create: (data: any) => {
    const tickets = ticketService.list();
    const newTicket = {
      id: Date.now() + Math.random(),
      ...data,
      status: data.status || "open",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    tickets.push(newTicket);
    setStorageItem("sgf_tickets", JSON.stringify(tickets));
    logAudit("create", "ticket", newTicket.id, data);
    return newTicket;
  },
  update: (id: number, data: any) => {
    const tickets = ticketService.list();
    const index = tickets.findIndex((t: any) => t.id === id);
    if (index === -1) return null;
    tickets[index] = { ...tickets[index], ...data, updatedAt: new Date().toISOString() };
    setStorageItem("sgf_tickets", JSON.stringify(tickets));
    logAudit("update", "ticket", id, data);
    return tickets[index];
  },
  delete: (id: number) => {
    const tickets = ticketService.list();
    const index = tickets.findIndex((t: any) => t.id === id);
    if (index === -1) return { success: false, error: "Ticket not found" };
    tickets.splice(index, 1);
    setStorageItem("sgf_tickets", JSON.stringify(tickets));
    logAudit("delete", "ticket", id, {});
    return { success: true };
  },
};

// =============================================================================
// KNOWLEDGE BASE / FAQ SERVICE
// =============================================================================

export const knowledgeBaseService = {
  list: () => {
    try {
      const raw = getStorageItem("sgf_knowledgeBase");
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return [];
  },
  getById: (id: number) => {
    const articles = knowledgeBaseService.list();
    return articles.find((a: any) => a.id === id);
  },
  search: (query: string) => {
    const articles = knowledgeBaseService.list();
    const q = query.toLowerCase();
    return articles.filter((a: any) =>
      a.title?.toLowerCase().includes(q) || a.content?.toLowerCase().includes(q)
    );
  },
  create: (data: any) => {
    const articles = knowledgeBaseService.list();
    const newArticle = {
      id: Date.now() + Math.random(),
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    articles.push(newArticle);
    setStorageItem("sgf_knowledgeBase", JSON.stringify(articles));
    logAudit("create", "knowledgeBase", newArticle.id, data);
    return newArticle;
  },
  update: (id: number, data: any) => {
    const articles = knowledgeBaseService.list();
    const index = articles.findIndex((a: any) => a.id === id);
    if (index === -1) return null;
    articles[index] = { ...articles[index], ...data, updatedAt: new Date().toISOString() };
    setStorageItem("sgf_knowledgeBase", JSON.stringify(articles));
    logAudit("update", "knowledgeBase", id, data);
    return articles[index];
  },
  delete: (id: number) => {
    const articles = knowledgeBaseService.list();
    const index = articles.findIndex((a: any) => a.id === id);
    if (index === -1) return { success: false, error: "Article not found" };
    articles.splice(index, 1);
    setStorageItem("sgf_knowledgeBase", JSON.stringify(articles));
    logAudit("delete", "knowledgeBase", id, {});
    return { success: true };
  },
};
