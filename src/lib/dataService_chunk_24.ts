// =============================================================================
// SUBSCRIPTION / RECURRING SERVICE
// =============================================================================

export const subscriptionService = {
  list: () => {
    try {
      const raw = getStorageItem("sgf_subscriptions");
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return [];
  },
  getById: (id: number) => {
    const subscriptions = subscriptionService.list();
    return subscriptions.find((s: any) => s.id === id);
  },
  getByCustomer: (customerId: number) => {
    const subscriptions = subscriptionService.list();
    return subscriptions.filter((s: any) => s.customerId === customerId);
  },
  getActive: () => {
    const subscriptions = subscriptionService.list();
    return subscriptions.filter((s: any) => s.status === "active");
  },
  create: (data: any) => {
    const subscriptions = subscriptionService.list();
    const newSubscription = {
      id: Date.now() + Math.random(),
      ...data,
      status: data.status || "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    subscriptions.push(newSubscription);
    setStorageItem("sgf_subscriptions", JSON.stringify(subscriptions));
    logAudit("create", "subscription", newSubscription.id, data);
    return newSubscription;
  },
  update: (id: number, data: any) => {
    const subscriptions = subscriptionService.list();
    const index = subscriptions.findIndex((s: any) => s.id === id);
    if (index === -1) return null;
    subscriptions[index] = { ...subscriptions[index], ...data, updatedAt: new Date().toISOString() };
    setStorageItem("sgf_subscriptions", JSON.stringify(subscriptions));
    logAudit("update", "subscription", id, data);
    return subscriptions[index];
  },
  delete: (id: number) => {
    const subscriptions = subscriptionService.list();
    const index = subscriptions.findIndex((s: any) => s.id === id);
    if (index === -1) return { success: false, error: "Subscription not found" };
    subscriptions.splice(index, 1);
    setStorageItem("sgf_subscriptions", JSON.stringify(subscriptions));
    logAudit("delete", "subscription", id, {});
    return { success: true };
  },
};

// =============================================================================
// CONTRACT / AGREEMENT SERVICE
// =============================================================================

export const contractService = {
  list: () => {
    try {
      const raw = getStorageItem("sgf_contracts");
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return [];
  },
  getById: (id: number) => {
    const contracts = contractService.list();
    return contracts.find((c: any) => c.id === id);
  },
  getByCustomer: (customerId: number) => {
    const contracts = contractService.list();
    return contracts.filter((c: any) => c.customerId === customerId);
  },
  getActive: () => {
    const contracts = contractService.list();
    return contracts.filter((c: any) => c.status === "active");
  },
  create: (data: any) => {
    const contracts = contractService.list();
    const newContract = {
      id: Date.now() + Math.random(),
      ...data,
      status: data.status || "draft",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    contracts.push(newContract);
    setStorageItem("sgf_contracts", JSON.stringify(contracts));
    logAudit("create", "contract", newContract.id, data);
    return newContract;
  },
  update: (id: number, data: any) => {
    const contracts = contractService.list();
    const index = contracts.findIndex((c: any) => c.id === id);
    if (index === -1) return null;
    contracts[index] = { ...contracts[index], ...data, updatedAt: new Date().toISOString() };
    setStorageItem("sgf_contracts", JSON.stringify(contracts));
    logAudit("update", "contract", id, data);
    return contracts[index];
  },
  delete: (id: number) => {
    const contracts = contractService.list();
    const index = contracts.findIndex((c: any) => c.id === id);
    if (index === -1) return { success: false, error: "Contract not found" };
    contracts.splice(index, 1);
    setStorageItem("sgf_contracts", JSON.stringify(contracts));
    logAudit("delete", "contract", id, {});
    return { success: true };
  },
};

// =============================================================================
// PROJECT / JOB SERVICE
// =============================================================================

export const projectService = {
  list: () => {
    try {
      const raw = getStorageItem("sgf_projects");
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return [];
  },
  getById: (id: number) => {
    const projects = projectService.list();
    return projects.find((p: any) => p.id === id);
  },
  getByCustomer: (customerId: number) => {
    const projects = projectService.list();
    return projects.filter((p: any) => p.customerId === customerId);
  },
  getByStatus: (status: string) => {
    const projects = projectService.list();
    return projects.filter((p: any) => p.status === status);
  },
  create: (data: any) => {
    const projects = projectService.list();
    const newProject = {
      id: Date.now() + Math.random(),
      ...data,
      status: data.status || "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    projects.push(newProject);
    setStorageItem("sgf_projects", JSON.stringify(projects));
    logAudit("create", "project", newProject.id, data);
    return newProject;
  },
  update: (id: number, data: any) => {
    const projects = projectService.list();
    const index = projects.findIndex((p: any) => p.id === id);
    if (index === -1) return null;
    projects[index] = { ...projects[index], ...data, updatedAt: new Date().toISOString() };
    setStorageItem("sgf_projects", JSON.stringify(projects));
    logAudit("update", "project", id, data);
    return projects[index];
  },
  delete: (id: number) => {
    const projects = projectService.list();
    const index = projects.findIndex((p: any) => p.id === id);
    if (index === -1) return { success: false, error: "Project not found" };
    projects.splice(index, 1);
    setStorageItem("sgf_projects", JSON.stringify(projects));
    logAudit("delete", "project", id, {});
    return { success: true };
  },
};

// =============================================================================
// TIME TRACKING / TIMESHEET SERVICE
// =============================================================================

export const timesheetService = {
  list: () => {
    try {
      const raw = getStorageItem("sgf_timesheets");
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return [];
  },
  getById: (id: number) => {
    const timesheets = timesheetService.list();
    return timesheets.find((t: any) => t.id === id);
  },
  getByUser: (userId: number) => {
    const timesheets = timesheetService.list();
    return timesheets.filter((t: any) => t.userId === userId);
  },
  getByDate: (date: string) => {
    const timesheets = timesheetService.list();
    return timesheets.filter((t: any) => t.date === date);
  },
  create: (data: any) => {
    const timesheets = timesheetService.list();
    const newTimesheet = {
      id: Date.now() + Math.random(),
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    timesheets.push(newTimesheet);
    setStorageItem("sgf_timesheets", JSON.stringify(timesheets));
    logAudit("create", "timesheet", newTimesheet.id, data);
    return newTimesheet;
  },
  update: (id: number, data: any) => {
    const timesheets = timesheetService.list();
    const index = timesheets.findIndex((t: any) => t.id === id);
    if (index === -1) return null;
    timesheets[index] = { ...timesheets[index], ...data, updatedAt: new Date().toISOString() };
    setStorageItem("sgf_timesheets", JSON.stringify(timesheets));
    logAudit("update", "timesheet", id, data);
    return timesheets[index];
  },
  delete: (id: number) => {
    const timesheets = timesheetService.list();
    const index = timesheets.findIndex((t: any) => t.id === id);
    if (index === -1) return { success: false, error: "Timesheet not found" };
    timesheets.splice(index, 1);
    setStorageItem("sgf_timesheets", JSON.stringify(timesheets));
    logAudit("delete", "timesheet", id, {});
    return { success: true };
  },
};

// =============================================================================
// LEAVE / ABSENCE SERVICE
// =============================================================================

export const leaveService = {
  list: () => {
    try {
      const raw = getStorageItem("sgf_leaves");
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return [];
  },
  getById: (id: number) => {
    const leaves = leaveService.list();
    return leaves.find((l: any) => l.id === id);
  },
  getByUser: (userId: number) => {
    const leaves = leaveService.list();
    return leaves.filter((l: any) => l.userId === userId);
  },
  getByStatus: (status: string) => {
    const leaves = leaveService.list();
    return leaves.filter((l: any) => l.status === status);
  },
  create: (data: any) => {
    const leaves = leaveService.list();
    const newLeave = {
      id: Date.now() + Math.random(),
      ...data,
      status: data.status || "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    leaves.push(newLeave);
    setStorageItem("sgf_leaves", JSON.stringify(leaves));
    logAudit("create", "leave", newLeave.id, data);
    return newLeave;
  },
  update: (id: number, data: any) => {
    const leaves = leaveService.list();
    const index = leaves.findIndex((l: any) => l.id === id);
    if (index === -1) return null;
    leaves[index] = { ...leaves[index], ...data, updatedAt: new Date().toISOString() };
    setStorageItem("sgf_leaves", JSON.stringify(leaves));
    logAudit("update", "leave", id, data);
    return leaves[index];
  },
  delete: (id: number) => {
    const leaves = leaveService.list();
    const index = leaves.findIndex((l: any) => l.id === id);
    if (index === -1) return { success: false, error: "Leave not found" };
    leaves.splice(index, 1);
    setStorageItem("sgf_leaves", JSON.stringify(leaves));
    logAudit("delete", "leave", id, {});
    return { success: true };
  },
};
