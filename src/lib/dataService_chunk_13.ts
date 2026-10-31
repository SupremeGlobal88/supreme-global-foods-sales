// =============================================================================
// CONTRACT SERVICE
// =============================================================================

export const contractService = {
  list: () => {
    const comp = getCurrentCompany();
    return contracts.filter((c) => c.company === comp);
  },
  getById: (id: number) => {
    return contracts.find((c) => c.id === id);
  },
  getByType: (type: string) => {
    const comp = getCurrentCompany();
    return contracts.filter((c) => c.company === comp && c.type === type);
  },
  getExpiring: () => {
    const comp = getCurrentCompany();
    const thirtyDays = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    return contracts.filter((c) => c.company === comp && c.endDate && c.endDate <= thirtyDays);
  },
  create: (data: any) => {
    const comp = getCurrentCompany();
    const newItem = {
      ...data,
      company: data.company || comp,
      id: Date.now(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    contracts.push(newItem);
    saveItem("sgf_contracts", contracts);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = contracts.findIndex((c) => c.id === id);
    if (idx >= 0) {
      contracts[idx] = { ...contracts[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_contracts", contracts);
    }
    return contracts[idx];
  },
  delete: (id: number) => {
    const idx = contracts.findIndex((c) => c.id === id);
    if (idx >= 0) {
      contracts.splice(idx, 1);
      saveItem("sgf_contracts", contracts);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// PROJECT SERVICE
// =============================================================================

export const projectService = {
  list: () => {
    const comp = getCurrentCompany();
    return projects.filter((p) => p.company === comp);
  },
  getById: (id: number) => {
    return projects.find((p) => p.id === id);
  },
  getByStatus: (status: string) => {
    const comp = getCurrentCompany();
    return projects.filter((p) => p.company === comp && p.status === status);
  },
  create: (data: any) => {
    const comp = getCurrentCompany();
    const newItem = {
      ...data,
      company: data.company || comp,
      id: Date.now(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    projects.push(newItem);
    saveItem("sgf_projects", projects);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = projects.findIndex((p) => p.id === id);
    if (idx >= 0) {
      projects[idx] = { ...projects[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_projects", projects);
    }
    return projects[idx];
  },
  delete: (id: number) => {
    const idx = projects.findIndex((p) => p.id === id);
    if (idx >= 0) {
      projects.splice(idx, 1);
      saveItem("sgf_projects", projects);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// TASK SERVICE
// =============================================================================

export const taskService = {
  list: () => {
    const comp = getCurrentCompany();
    return tasks.filter((t) => t.company === comp);
  },
  getById: (id: number) => {
    return tasks.find((t) => t.id === id);
  },
  getByProject: (projectId: number) => {
    return tasks.filter((t) => t.projectId === projectId);
  },
  getByAssignee: (assigneeId: number) => {
    return tasks.filter((t) => t.assigneeId === assigneeId);
  },
  getByStatus: (status: string) => {
    const comp = getCurrentCompany();
    return tasks.filter((t) => t.company === comp && t.status === status);
  },
  create: (data: any) => {
    const comp = getCurrentCompany();
    const newItem = {
      ...data,
      company: data.company || comp,
      id: Date.now(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    tasks.push(newItem);
    saveItem("sgf_tasks", tasks);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = tasks.findIndex((t) => t.id === id);
    if (idx >= 0) {
      tasks[idx] = { ...tasks[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_tasks", tasks);
    }
    return tasks[idx];
  },
  delete: (id: number) => {
    const idx = tasks.findIndex((t) => t.id === id);
    if (idx >= 0) {
      tasks.splice(idx, 1);
      saveItem("sgf_tasks", tasks);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// TIME TRACKING SERVICE
// =============================================================================

export const timeTrackingService = {
  list: () => {
    const comp = getCurrentCompany();
    return timeTrackingRecords.filter((t) => t.company === comp);
  },
  getById: (id: number) => {
    return timeTrackingRecords.find((t) => t.id === id);
  },
  getByTask: (taskId: number) => {
    return timeTrackingRecords.filter((t) => t.taskId === taskId);
  },
  getByEmployee: (employeeId: number) => {
    return timeTrackingRecords.filter((t) => t.employeeId === employeeId);
  },
  create: (data: any) => {
    const comp = getCurrentCompany();
    const newItem = {
      ...data,
      company: data.company || comp,
      id: Date.now(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    timeTrackingRecords.push(newItem);
    saveItem("sgf_timeTrackingRecords", timeTrackingRecords);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = timeTrackingRecords.findIndex((t) => t.id === id);
    if (idx >= 0) {
      timeTrackingRecords[idx] = { ...timeTrackingRecords[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_timeTrackingRecords", timeTrackingRecords);
    }
    return timeTrackingRecords[idx];
  },
  delete: (id: number) => {
    const idx = timeTrackingRecords.findIndex((t) => t.id === id);
    if (idx >= 0) {
      timeTrackingRecords.splice(idx, 1);
      saveItem("sgf_timeTrackingRecords", timeTrackingRecords);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// MILESTONE SERVICE
// =============================================================================

export const milestoneService = {
  list: () => {
    const comp = getCurrentCompany();
    return milestones.filter((m) => m.company === comp);
  },
  getById: (id: number) => {
    return milestones.find((m) => m.id === id);
  },
  getByProject: (projectId: number) => {
    return milestones.filter((m) => m.projectId === projectId);
  },
  create: (data: any) => {
    const comp = getCurrentCompany();
    const newItem = {
      ...data,
      company: data.company || comp,
      id: Date.now(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    milestones.push(newItem);
    saveItem("sgf_milestones", milestones);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = milestones.findIndex((m) => m.id === id);
    if (idx >= 0) {
      milestones[idx] = { ...milestones[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_milestones", milestones);
    }
    return milestones[idx];
  },
  delete: (id: number) => {
    const idx = milestones.findIndex((m) => m.id === id);
    if (idx >= 0) {
      milestones.splice(idx, 1);
      saveItem("sgf_milestones", milestones);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// RESOURCE ALLOCATION SERVICE
// =============================================================================

export const resourceAllocationService = {
  list: () => {
    const comp = getCurrentCompany();
    return resourceAllocations.filter((r) => r.company === comp);
  },
  getById: (id: number) => {
    return resourceAllocations.find((r) => r.id === id);
  },
  getByProject: (projectId: number) => {
    return resourceAllocations.filter((r) => r.projectId === projectId);
  },
  getByResource: (resourceId: number) => {
    return resourceAllocations.filter((r) => r.resourceId === resourceId);
  },
  create: (data: any) => {
    const comp = getCurrentCompany();
    const newItem = {
      ...data,
      company: data.company || comp,
      id: Date.now(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    resourceAllocations.push(newItem);
    saveItem("sgf_resourceAllocations", resourceAllocations);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = resourceAllocations.findIndex((r) => r.id === id);
    if (idx >= 0) {
      resourceAllocations[idx] = { ...resourceAllocations[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_resourceAllocations", resourceAllocations);
    }
    return resourceAllocations[idx];
  },
  delete: (id: number) => {
    const idx = resourceAllocations.findIndex((r) => r.id === id);
    if (idx >= 0) {
      resourceAllocations.splice(idx, 1);
      saveItem("sgf_resourceAllocations", resourceAllocations);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// SKILL SERVICE
// =============================================================================

export const skillService = {
  list: () => {
    const comp = getCurrentCompany();
    return skills.filter((s) => s.company === comp);
  },
  getById: (id: number) => {
    return skills.find((s) => s.id === id);
  },
  getByEmployee: (employeeId: number) => {
    return skills.filter((s) => s.employeeId === employeeId);
  },
  create: (data: any) => {
    const comp = getCurrentCompany();
    const newItem = {
      ...data,
      company: data.company || comp,
      id: Date.now(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    skills.push(newItem);
    saveItem("sgf_skills", skills);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = skills.findIndex((s) => s.id === id);
    if (idx >= 0) {
      skills[idx] = { ...skills[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_skills", skills);
    }
    return skills[idx];
  },
  delete: (id: number) => {
    const idx = skills.findIndex((s) => s.id === id);
    if (idx >= 0) {
      skills.splice(idx, 1);
      saveItem("sgf_skills", skills);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// RECRUITMENT SERVICE
// =============================================================================

export const recruitmentService = {
  list: () => {
    const comp = getCurrentCompany();
    return recruitments.filter((r) => r.company === comp);
  },
  getById: (id: number) => {
    return recruitments.find((r) => r.id === id);
  },
  getByPosition: (position: string) => {
    const comp = getCurrentCompany();
    return recruitments.filter((r) => r.company === comp && r.position === position);
  },
  getByStatus: (status: string) => {
    const comp = getCurrentCompany();
    return recruitments.filter((r) => r.company === comp && r.status === status);
  },
  create: (data: any) => {
    const comp = getCurrentCompany();
    const newItem = {
      ...data,
      company: data.company || comp,
      id: Date.now(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    recruitments.push(newItem);
    saveItem("sgf_recruitments", recruitments);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = recruitments.findIndex((r) => r.id === id);
    if (idx >= 0) {
      recruitments[idx] = { ...recruitments[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_recruitments", recruitments);
    }
    return recruitments[idx];
  },
  delete: (id: number) => {
    const idx = recruitments.findIndex((r) => r.id === id);
    if (idx >= 0) {
      recruitments.splice(idx, 1);
      saveItem("sgf_recruitments", recruitments);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// APPRAISAL SERVICE
// =============================================================================

export const appraisalService = {
  list: () => {
    const comp = getCurrentCompany();
    return appraisals.filter((a) => a.company === comp);
  },
  getById: (id: number) => {
    return appraisals.find((a) => a.id === id);
  },
  getByEmployee: (employeeId: number) => {
    return appraisals.filter((a) => a.employeeId === employeeId);
  },
  getByPeriod: (period: string) => {
    const comp = getCurrentCompany();
    return appraisals.filter((a) => a.company === comp && a.period === period);
  },
  create: (data: any) => {
    const comp = getCurrentCompany();
    const newItem = {
      ...data,
      company: data.company || comp,
      id: Date.now(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    appraisals.push(newItem);
    saveItem("sgf_appraisals", appraisals);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = appraisals.findIndex((a) => a.id === id);
    if (idx >= 0) {
      appraisals[idx] = { ...appraisals[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_appraisals", appraisals);
    }
    return appraisals[idx];
  },
  delete: (id: number) => {
    const idx = appraisals.findIndex((a) => a.id === id);
    if (idx >= 0) {
      appraisals.splice(idx, 1);
      saveItem("sgf_appraisals", appraisals);
    }
    return { success: idx >= 0 };
  },
};
