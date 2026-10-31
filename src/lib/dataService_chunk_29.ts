      // Include ALL check-ins for the day — even those without GPS coordinates.
      // buildRepReport handles missing coords gracefully (counts visit, skips distance).
      const dayCheckins = checkins.filter((ci) =>
        new Date(ci.createdAt).toDateString() === dateStr
      );
      const dayNotes = notes.filter((n) =>
        n.entityType === "customer" &&
        new Date(n.createdAt).toDateString() === dateStr
      );
      const dayFollowUps = customerFollowUps.filter((f) =>
        new Date(f.createdAt).toDateString() === dateStr
      );

      return {
        date: dateStr,
        customerVisits: dayCheckins.length,
        uniqueCustomersVisited: new Set(dayCheckins.map((ci) => ci.customerId)).size,
        totalDistanceKm: dayCheckins.reduce((sum, ci) => sum + (ci.distance || 0), 0),
        notesTaken: dayNotes.length,
        followUpsScheduled: dayFollowUps.length,
        ordersTaken: repOrders.length,
        orderValue: repOrders.reduce((sum, o) => sum + Number(o.total || 0), 0),
        checkins: dayCheckins,
        notes: dayNotes,
        followUps: dayFollowUps,
      };
    },
    getRepActivity: (repName: string, fromDate: string, toDate: string) => {
      const fromTs = new Date(fromDate + "T00:00:00").getTime();
      const toTs = new Date(toDate + "T23:59:59").getTime();
      const repOrders = orders.filter((o) => {
        const ts = new Date(o.createdAt).getTime();
        return ts >= fromTs && ts <= toTs && o.salesRepName === repName && o.status !== "cancelled";
      });
      const repSamples = orders.filter((o) => {
        const ts = new Date(o.createdAt).getTime();
        return ts >= fromTs && ts <= toTs && o.salesRepName === repName && o.orderType === "sample";
      });
      const repCheckins = checkins.filter((ci) => {
        const ts = new Date(ci.createdAt).getTime();
        return ts >= fromTs && ts <= toTs && ci.salesRepName === repName;
      });
      const repPOs = purchaseOrders.filter((po) => {
        const ts = new Date(po.createdAt).getTime();
        return ts >= fromTs && ts <= toTs && po.salesRepName === repName;
      });
      const repInvoices = invoices.filter((inv) => {
        const ts = new Date(inv.createdAt).getTime();
        return ts >= fromTs && ts <= toTs && inv.salesRepName === repName;
      });

      const totalSales = Math.round((repOrders.reduce((sum, o) => sum + Number(o.total || 0), 0) + poTotal) * 100) / 100;
      const sampleCost = Math.round(repSamples.reduce((sum, o) => sum + Number(o.total || 0), 0) * 100) / 100;
      const totalInvoices = repInvoices.length;
      const totalOrders = repOrders.length;
      const totalSamples = repSamples.length;
      const totalCheckins = repCheckins.length;
      const totalPOs = repPOs.length;
      const uniqueCustomers = new Set(repOrders.map((o) => o.customerId)).size;
      const totalDistance = Math.round(repCheckins.reduce((sum, ci) => sum + (ci.distance || 0), 0) * 100) / 100;

      return {
        repName,
        fromDate,
        toDate,
        totalSales,
        sampleCost,
        totalInvoices,
        totalOrders,
        totalSamples,
        totalCheckins,
        totalPOs,
        uniqueCustomers,
        totalDistance,
        orders: repOrders,
        samples: repSamples,
        checkins: repCheckins,
        purchaseOrders: repPOs,
        invoices: repInvoices,
      };
    },
  };
}

const salesRepService = buildSalesRepService();

// =============================================================================
// ACTIVITY LOG SERVICE
// =============================================================================

export const activityLogService = {
  list: () => activityLogs,
  getById: (id: number) => activityLogs.find((a) => a.id == id) || null,
  getByEntity: (entityType: string, entityId: number) => activityLogs.filter((a) => a.entityType === entityType && a.entityId == entityId),
  getByUser: (userId: number) => activityLogs.filter((a) => a.userId == userId),
  create: (data: any) => {
    const newItem = {
      ...data,
      id: Date.now(),
      createdAt: new Date().toISOString(),
    };
    activityLogs.push(newItem);
    saveItem("sgf_activityLogs", activityLogs);
    return newItem;
  },
};

// =============================================================================
// NOTIFICATION LOG SERVICE
// =============================================================================

export const notificationLogService = {
  list: () => notificationLogs,
  getById: (id: number) => notificationLogs.find((n) => n.id == id) || null,
  getByUser: (userId: number) => notificationLogs.filter((n) => n.userId == userId),
  create: (data: any) => {
    const newItem = {
      ...data,
      id: Date.now(),
      createdAt: new Date().toISOString(),
    };
    notificationLogs.push(newItem);
    saveItem("sgf_notificationLogs", notificationLogs);
    return newItem;
  },
};

// =============================================================================
// CUSTOM FIELD SERVICE
// =============================================================================

export const customFieldService = {
  list: () => customFields,
  getById: (id: number) => customFields.find((cf) => cf.id == id) || null,
  getByEntity: (entityType: string) => customFields.filter((cf) => cf.entityType === entityType),
  create: (data: any) => {
    const newItem = {
      ...data,
      id: Date.now(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    customFields.push(newItem);
    saveItem("sgf_customFields", customFields);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = customFields.findIndex((cf) => cf.id == id);
    if (idx >= 0) {
      customFields[idx] = { ...customFields[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_customFields", customFields);
    }
    return customFields[idx];
  },
  delete: (id: number) => {
    const idx = customFields.findIndex((cf) => cf.id == id);
    if (idx >= 0) {
      customFields.splice(idx, 1);
      saveItem("sgf_customFields", customFields);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// FIELD VALUE SERVICE
// =============================================================================

export const fieldValueService = {
  list: () => fieldValues,
  getById: (id: number) => fieldValues.find((fv) => fv.id == id) || null,
  getByEntity: (entityType: string, entityId: number) => fieldValues.filter((fv) => fv.entityType === entityType && fv.entityId == entityId),
  getByField: (fieldId: number) => fieldValues.filter((fv) => fv.fieldId == fieldId),
  create: (data: any) => {
    const newItem = {
      ...data,
      id: Date.now(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    fieldValues.push(newItem);
    saveItem("sgf_fieldValues", fieldValues);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = fieldValues.findIndex((fv) => fv.id == id);
    if (idx >= 0) {
      fieldValues[idx] = { ...fieldValues[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_fieldValues", fieldValues);
    }
    return fieldValues[idx];
  },
  delete: (id: number) => {
    const idx = fieldValues.findIndex((fv) => fv.id == id);
    if (idx >= 0) {
      fieldValues.splice(idx, 1);
      saveItem("sgf_fieldValues", fieldValues);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// WORKFLOW SERVICE
// =============================================================================

export const workflowService = {
  list: () => workflows,
  getById: (id: number) => workflows.find((w) => w.id == id) || null,
  create: (data: any) => {
    const newItem = {
      ...data,
      id: Date.now(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    workflows.push(newItem);
    saveItem("sgf_workflows", workflows);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = workflows.findIndex((w) => w.id == id);
    if (idx >= 0) {
      workflows[idx] = { ...workflows[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_workflows", workflows);
    }
    return workflows[idx];
  },
  delete: (id: number) => {
    const idx = workflows.findIndex((w) => w.id == id);
    if (idx >= 0) {
      workflows.splice(idx, 1);
      saveItem("sgf_workflows", workflows);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// WORKFLOW INSTANCE SERVICE
// =============================================================================

export const workflowInstanceService = {
  list: () => workflowInstances,
  getById: (id: number) => workflowInstances.find((wi) => wi.id == id) || null,
  getByWorkflow: (workflowId: number) => workflowInstances.filter((wi) => wi.workflowId == workflowId),
  getByEntity: (entityType: string, entityId: number) => workflowInstances.filter((wi) => wi.entityType === entityType && wi.entityId == entityId),
  create: (data: any) => {
    const newItem = {
      ...data,
      id: Date.now(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    workflowInstances.push(newItem);
    saveItem("sgf_workflowInstances", workflowInstances);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = workflowInstances.findIndex((wi) => wi.id == id);
    if (idx >= 0) {
      workflowInstances[idx] = { ...workflowInstances[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_workflowInstances", workflowInstances);
    }
    return workflowInstances[idx];
  },
  delete: (id: number) => {
    const idx = workflowInstances.findIndex((wi) => wi.id == id);
    if (idx >= 0) {
      workflowInstances.splice(idx, 1);
      saveItem("sgf_workflowInstances", workflowInstances);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// APPROVAL WORKFLOW SERVICE
// =============================================================================

export const approvalWorkflowService = {
  list: () => approvalWorkflows,
  getById: (id: number) => approvalWorkflows.find((aw) => aw.id == id) || null,
  getByType: (type: string) => approvalWorkflows.filter((aw) => aw.type === type),
  create: (data: any) => {
    const newItem = {
      ...data,
      id: Date.now(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    approvalWorkflows.push(newItem);
    saveItem("sgf_approvalWorkflows", approvalWorkflows);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = approvalWorkflows.findIndex((aw) => aw.id == id);
    if (idx >= 0) {
      approvalWorkflows[idx] = { ...approvalWorkflows[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_approvalWorkflows", approvalWorkflows);
    }
    return approvalWorkflows[idx];
  },
  delete: (id: number) => {
    const idx = approvalWorkflows.findIndex((aw) => aw.id == id);
    if (idx >= 0) {
      approvalWorkflows.splice(idx, 1);
      saveItem("sgf_approvalWorkflows", approvalWorkflows);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// APPROVAL REQUEST SERVICE
// =============================================================================

export const approvalRequestService = {
  list: () => approvalRequests,
  getById: (id: number) => approvalRequests.find((ar) => ar.id == id) || null,
  getByRequester: (requesterId: number) => approvalRequests.filter((ar) => ar.requesterId == requesterId),
  getByApprover: (approverId: number) => approvalRequests.filter((ar) => ar.approverId == approverId),
  getByStatus: (status: string) => approvalRequests.filter((ar) => ar.status === status),
  create: (data: any) => {
    const newItem = {
      ...data,
      id: Date.now(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    approvalRequests.push(newItem);
    saveItem("sgf_approvalRequests", approvalRequests);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = approvalRequests.findIndex((ar) => ar.id == id);
    if (idx >= 0) {
      approvalRequests[idx] = { ...approvalRequests[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_approvalRequests", approvalRequests);
    }
    return approvalRequests[idx];
  },
  delete: (id: number) => {
    const idx = approvalRequests.findIndex((ar) => ar.id == id);
    if (idx >= 0) {
      approvalRequests.splice(idx, 1);
      saveItem("sgf_approvalRequests", approvalRequests);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// NOTIFICATION TEMPLATE SERVICE
// =============================================================================

export const notificationTemplateService = {
  list: () => notificationTemplates,
  getById: (id: number) => notificationTemplates.find((nt) => nt.id == id) || null,
  getByType: (type: string) => notificationTemplates.filter((nt) => nt.type === type),
  create: (data: any) => {
    const newItem = {
      ...data,
      id: Date.now(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    notificationTemplates.push(newItem);
    saveItem("sgf_notificationTemplates", notificationTemplates);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = notificationTemplates.findIndex((nt) => nt.id == id);
    if (idx >= 0) {
      notificationTemplates[idx] = { ...notificationTemplates[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_notificationTemplates", notificationTemplates);
    }
    return notificationTemplates[idx];
  },
  delete: (id: number) => {
    const idx = notificationTemplates.findIndex((nt) => nt.id == id);
    if (idx >= 0) {
      notificationTemplates.splice(idx, 1);
      saveItem("sgf_notificationTemplates", notificationTemplates);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// REMINDER SERVICE
// =============================================================================

export const reminderService = {
  list: () => reminders,
  getById: (id: number) => reminders.find((r) => r.id == id) || null,
  getByUser: (userId: number) => reminders.filter((r) => r.userId == userId),
  getDue: () => {
    const now = new Date().toISOString();
    return reminders.filter((r) => r.dueDate && r.dueDate <= now && !r.completed);
  },
  create: (data: any) => {
    const newItem = {
      ...data,
      id: Date.now(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    reminders.push(newItem);
    saveItem("sgf_reminders", reminders);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = reminders.findIndex((r) => r.id == id);
    if (idx >= 0) {
      reminders[idx] = { ...reminders[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_reminders", reminders);
    }
    return reminders[idx];
  },
  delete: (id: number) => {
    const idx = reminders.findIndex((r) => r.id == id);
    if (idx >= 0) {
      reminders.splice(idx, 1);
      saveItem("sgf_reminders", reminders);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// CALENDAR EVENT SERVICE
// =============================================================================

export const calendarEventService = {
  list: () => calendarEvents,
  getById: (id: number) => calendarEvents.find((ce) => ce.id == id) || null,
  getByDate: (date: string) => calendarEvents.filter((ce) => ce.date === date),
  getByUser: (userId: number) => calendarEvents.filter((ce) => ce.userId == userId),
  create: (data: any) => {
    const newItem = {
      ...data,
      id: Date.now(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    calendarEvents.push(newItem);
    saveItem("sgf_calendarEvents", calendarEvents);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = calendarEvents.findIndex((ce) => ce.id == id);
    if (idx >= 0) {
      calendarEvents[idx] = { ...calendarEvents[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_calendarEvents", calendarEvents);
    }
    return calendarEvents[idx];
  },
  delete: (id: number) => {
    const idx = calendarEvents.findIndex((ce) => ce.id == id);
    if (idx >= 0) {
      calendarEvents.splice(idx, 1);
      saveItem("sgf_calendarEvents", calendarEvents);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// NOTE SERVICE
// =============================================================================

export const noteService = {
  list: () => notes,
  getById: (id: number) => notes.find((n) => n.id == id) || null,
  getByEntity: (entityType: string, entityId: number) => notes.filter((n) => n.entityType === entityType && n.entityId == entityId),
  getByUser: (userId: number) => notes.filter((n) => n.userId == userId),
  create: (data: any) => {
    const newItem = {
      ...data,
      id: Date.now(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    notes.push(newItem);
    saveItem("sgf_notes", notes);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = notes.findIndex((n) => n.id == id);
    if (idx >= 0) {
      notes[idx] = { ...notes[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_notes", notes);
    }
    return notes[idx];
  },
  delete: (id: number) => {
    const idx = notes.findIndex((n) => n.id == id);
    if (idx >= 0) {
      notes.splice(idx, 1);
      saveItem("sgf_notes", notes);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// COMMENT SERVICE
// =============================================================================

export const commentService = {
  list: () => comments,
  getById: (id: number) => comments.find((c) => c.id == id) || null,
  getByEntity: (entityType: string, entityId: number) => comments.filter((c) => c.entityType === entityType && c.entityId == entityId),
  getByUser: (userId: number) => comments.filter((c) => c.userId == userId),
  create: (data: any) => {
    const newItem = {
      ...data,
      id: Date.now(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    comments.push(newItem);
    saveItem("sgf_comments", comments);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = comments.findIndex((c) => c.id == id);
    if (idx >= 0) {
      comments[idx] = { ...comments[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_comments", comments);
    }
    return comments[idx];
  },
  delete: (id: number) => {
    const idx = comments.findIndex((c) => c.id == id);
    if (idx >= 0) {
      comments.splice(idx, 1);
      saveItem("sgf_comments", comments);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// ATTACHMENT SERVICE
// =============================================================================

export const attachmentService = {
  list: () => attachments,
  getById: (id: number) => attachments.find((a) => a.id == id) || null,
  getByEntity: (entityType: string, entityId: number) => attachments.filter((a) => a.entityType === entityType && a.entityId == entityId),
  create: (data: any) => {
    const newItem = {
      ...data,
      id: Date.now(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    attachments.push(newItem);
    saveItem("sgf_attachments", attachments);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = attachments.findIndex((a) => a.id == id);
    if (idx >= 0) {
      attachments[idx] = { ...attachments[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_attachments", attachments);
    }
    return attachments[idx];
  },
  delete: (id: number) => {
    const idx = attachments.findIndex((a) => a.id == id);
    if (idx >= 0) {
      attachments.splice(idx, 1);
      saveItem("sgf_attachments", attachments);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// TAG SERVICE
// =============================================================================

export const tagService = {
  list: () => tags,
  getById: (id: number) => tags.find((t) => t.id == id) || null,
  getByName: (name: string) => tags.find((t) => t.name === name),
  create: (data: any) => {
    const newItem = {
      ...data,
      id: Date.now(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    tags.push(newItem);
    saveItem("sgf_tags", tags);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = tags.findIndex((t) => t.id == id);
    if (idx >= 0) {
      tags[idx] = { ...tags[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_tags", tags);
    }
    return tags[idx];
  },
  delete: (id: number) => {
    const idx = tags.findIndex((t) => t.id == id);
    if (idx >= 0) {
      tags.splice(idx, 1);
      saveItem("sgf_tags", tags);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// TAG ASSIGNMENT SERVICE
// =============================================================================

export const tagAssignmentService = {
  list: () => tagAssignments,
  getById: (id: number) => tagAssignments.find((ta) => ta.id == id) || null,
  getByEntity: (entityType: string, entityId: number) => tagAssignments.filter((ta) => ta.entityType === entityType && ta.entityId == entityId),
  getByTag: (tagId: number) => tagAssignments.filter((ta) => ta.tagId == tagId),
  create: (data: any) => {
    const newItem = {
      ...data,
      id: Date.now(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    tagAssignments.push(newItem);
    saveItem("sgf_tagAssignments", tagAssignments);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = tagAssignments.findIndex((ta) => ta.id == id);
    if (idx >= 0) {
      tagAssignments[idx] = { ...tagAssignments[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_tagAssignments", tagAssignments);
    }
    return tagAssignments[idx];
  },
  delete: (id: number) => {
    const idx = tagAssignments.findIndex((ta) => ta.id == id);
    if (idx >= 0) {
      tagAssignments.splice(idx, 1);
      saveItem("sgf_tagAssignments", tagAssignments);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// LOG SERVICE
// =============================================================================

export const logService = {
  list: () => logRecords,
  getById: (id: number) => logRecords.find((l) => l.id == id) || null,
  getByType: (type: string) => logRecords.filter((l) => l.type === type),
  getByEntity: (entityType: string, entityId: number) => logRecords.filter((l) => l.entityType === entityType && l.entityId == entityId),
  create: (data: any) => {
    const newItem = {
      ...data,
      id: Date.now(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    logRecords.push(newItem);
    saveItem("sgf_logRecords", logRecords);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = logRecords.findIndex((l) => l.id == id);
    if (idx >= 0) {
      logRecords[idx] = { ...logRecords[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_logRecords", logRecords);
    }
    return logRecords[idx];
  },
  delete: (id: number) => {
    const idx = logRecords.findIndex((l) => l.id == id);
    if (idx >= 0) {
      logRecords.splice(idx, 1);
      saveItem("sgf_logRecords", logRecords);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// PRINT TEMPLATE SERVICE
// =============================================================================

export const printTemplateService = {
  list: () => printTemplates,
  getById: (id: number) => printTemplates.find((pt) => pt.id == id) || null,
  getByType: (type: string) => printTemplates.filter((pt) => pt.type === type),
  create: (data: any) => {
    const newItem = {
      ...data,
      id: Date.now(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    printTemplates.push(newItem);
    saveItem("sgf_printTemplates", printTemplates);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = printTemplates.findIndex((pt) => pt.id == id);
    if (idx >= 0) {
      printTemplates[idx] = { ...printTemplates[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_printTemplates", printTemplates);
    }
    return printTemplates[idx];
  },
  delete: (id: number) => {
    const idx = printTemplates.findIndex((pt) => pt.id == id);
    if (idx >= 0) {
      printTemplates.splice(idx, 1);
      saveItem("sgf_printTemplates", printTemplates);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// EMAIL TEMPLATE SERVICE
// =============================================================================

export const emailTemplateService = {
  list: () => emailTemplates,
  getById: (id: number) => emailTemplates.find((et) => et.id == id) || null,
  getByType: (type: string) => emailTemplates.filter((et) => et.type === type),
  create: (data: any) => {
    const newItem = {
      ...data,
      id: Date.now(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    emailTemplates.push(newItem);
    saveItem("sgf_emailTemplates", emailTemplates);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = emailTemplates.findIndex((et) => et.id == id);
    if (idx >= 0) {
      emailTemplates[idx] = { ...emailTemplates[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_emailTemplates", emailTemplates);
    }
    return emailTemplates[idx];
  },
  delete: (id: number) => {
    const idx = emailTemplates.findIndex((et) => et.id == id);
    if (idx >= 0) {
      emailTemplates.splice(idx, 1);
      saveItem("sgf_emailTemplates", emailTemplates);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// SMS TEMPLATE SERVICE
// =============================================================================

export const smsTemplateService = {
  list: () => smsTemplates,
  getById: (id: number) => smsTemplates.find((st) => st.id == id) || null,
  getByType: (type: string) => smsTemplates.filter((st) => st.type === type),
  create: (data: any) => {
    const newItem = {
      ...data,
      id: Date.now(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    smsTemplates.push(newItem);
    saveItem("sgf_smsTemplates", smsTemplates);
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = smsTemplates.findIndex((st) => st.id == id);
    if (idx >= 0) {
      smsTemplates[idx] = { ...smsTemplates[idx], ...data, updatedAt: new Date().toISOString() };
      saveItem("sgf_smsTemplates", smsTemplates);
    }
    return smsTemplates[idx];
  },
  delete: (id: number) => {
    const idx = smsTemplates.findIndex((st) => st.id == id);
    if (idx >= 0) {
      smsTemplates.splice(idx, 1);
      saveItem("sgf_smsTemplates", smsTemplates);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// SYSTEM LOG SERVICE
// =============================================================================

export const systemLogService = {
  list: () => systemLogs,
  getById: (id: number) => systemLogs.find((sl) => sl.id == id) || null,
  getByCategory: (category: string) => systemLogs.filter((sl) => sl.category === category),
  getByLevel: (level: string) => systemLogs.filter((sl) => sl.level === level),
  getSummary: () => ({
    total: systemLogs.length,
    errors: systemLogs.filter((sl) => sl.level === "error").length,
    warnings: systemLogs.filter((sl) => sl.level === "warning").length,
    info: systemLogs.filter((sl) => sl.level === "info").length,
  }),
  create: (data: any) => {
    const newItem = {
      ...data,
      id: Date.now(),
      createdAt: new Date().toISOString(),
    };
    systemLogs.push(newItem);
    saveItem("sgf_systemLogs", systemLogs);
    return newItem;
  },
};

// =============================================================================
// AUDIT LOG SERVICE
// =============================================================================

export const auditLogService = {
  list: () => auditLogs,
  getById: (id: number) => auditLogs.find((al) => al.id == id) || null,
  getByEntity: (entityType: string, entityId: number) => auditLogs.filter((al) => al.entityType === entityType && al.entityId == entityId),
  getByUser: (userId: number) => auditLogs.filter((al) => al.userId == userId),
  getSummary: () => ({
    total: auditLogs.length,
    creates: auditLogs.filter((al) => al.action === "CREATE").length,
    updates: auditLogs.filter((al) => al.action === "UPDATE").length,
    deletes: auditLogs.filter((al) => al.action === "DELETE").length,
  }),
  create: (data: any) => {
    const newItem = {
      ...data,
      id: Date.now(),
      createdAt: new Date().toISOString(),
    };
    auditLogs.push(newItem);
    saveItem("sgf_auditLogs", auditLogs);
    return newItem;
  },
};

// =============================================================================
// SALES REP MANAGEMENT SERVICE
// =============================================================================

export const salesRepManagementService = {
  list: () => [...SALES_REPS],
  getById: (id: number) => SALES_REPS.find((r) => r.id === id) || null,
  getByName: (name: string) => SALES_REPS.find((r) => r.name === name) || null,
  create: (data: any) => {
    const newId = SALES_REPS.length > 0 ? Math.max(...SALES_REPS.map((r) => r.id)) + 1 : 1;
    const newItem = { ...data, id: newId, isActive: true, createdAt: new Date().toISOString() };
    SALES_REPS.push(newItem);
    saveSalesReps();
    return newItem;
  },
  update: ({ id, data }: { id: number; data: any }) => {
    const idx = SALES_REPS.findIndex((r) => r.id === id);
    if (idx >= 0) {
      const oldName = SALES_REPS[idx].name;
      SALES_REPS[idx] = { ...SALES_REPS[idx], ...data, updatedAt: new Date().toISOString() };
      saveSalesReps();
      // Update all customers with old rep name
      if (data.name && data.name !== oldName) {
        customers.forEach((c) => {
          if (c.salesRepName === oldName) {
            c.salesRepName = data.name;
          }
        });
        saveItem("sgf_customers", customers);
      }
      return SALES_REPS[idx];
    }
    return null;
  },
  delete: (id: number) => {
    const idx = SALES_REPS.findIndex((r) => r.id === id);
    if (idx >= 0) {
      const name = SALES_REPS[idx].name;
      // Unassign from all customers
      customers.forEach((c) => {
        if (c.salesRepName === name) {
          c.salesRepName = "";
        }
      });
      saveItem("sgf_customers", customers);
      SALES_REPS.splice(idx, 1);
      saveSalesReps();
      return { success: true };
    }
    return { success: false };
  },
  toggleActive: (id: number) => {
    const idx = SALES_REPS.findIndex((r) => r.id === id);
    if (idx >= 0) {
      SALES_REPS[idx].isActive = SALES_REPS[idx].isActive === false ? true : false;
      saveSalesReps();
      return SALES_REPS[idx];
    }
    return null;
  },
};

// =============================================================================
// AUTH SERVICE
// =============================================================================

export const authService = {
  login: ({ email, password }: { email: string; password: string }) => {
    const user = users.find((u) => u.email === email && u.password === password);
    if (!user) return { success: false, error: "Invalid credentials" };
    if (user.isActive === false) return { success: false, error: "Account deactivated" };
    return { success: true, user };
  },
  register: (data: any) => {
    const existing = users.find((u) => u.email === data.email);
    if (existing) return { success: false, error: "Email already exists" };
    const newItem = {
      ...data,
      id: Date.now(),
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    users.push(newItem);
    saveItem("sgf_users", users);
    return { success: true, user: newItem };
  },
  changePassword: ({ id, oldPassword, newPassword }: { id: number; oldPassword: string; newPassword: string }) => {
    const idx = users.findIndex((u) => u.id == id);
    if (idx < 0) return { success: false, error: "User not found" };
    if (users[idx].password !== oldPassword) return { success: false, error: "Incorrect old password" };
    users[idx].password = newPassword;
    users[idx].updatedAt = new Date().toISOString();
    saveItem("sgf_users", users);
    return { success: true };
  },
  resetPassword: ({ email, newPassword }: { email: string; newPassword: string }) => {
    const idx = users.findIndex((u) => u.email === email);
    if (idx < 0) return { success: false, error: "User not found" };
    users[idx].password = newPassword;
    users[idx].updatedAt = new Date().toISOString();
    saveItem("sgf_users", users);
    return { success: true };
  },
};

// =============================================================================
// SETTING SERVICE
// =============================================================================

export const settingService = {
  list: () => settings,
  getByKey: (key: string) => settings.find((s) => s.key === key)?.value || null,
  getByCategory: (category: string) => settings.filter((s) => s.category === category),
  set: (key: string, value: any, category?: string) => {
    const idx = settings.findIndex((s) => s.key === key);
    if (idx >= 0) {
      settings[idx] = { ...settings[idx], value, updatedAt: new Date().toISOString() };
    } else {
      settings.push({ key, value, category: category || "general", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    }
    saveItem("sgf_settings", settings);
    return { success: true };
  },
  delete: (key: string) => {
    const idx = settings.findIndex((s) => s.key === key);
    if (idx >= 0) {
      settings.splice(idx, 1);
      saveItem("sgf_settings", settings);
    }
    return { success: idx >= 0 };
  },
};

// =============================================================================
// BACKUP SERVICE
// =============================================================================

export const backupService = {
  create: () => {
    const backup = {
      timestamp: new Date().toISOString(),
      data: {
        customers,
        products,
        orders,
        invoices,
        receipts,
        creditNotes,
        purchaseOrders,
        corporateCustomers,
        priceTiers,
        specialPrices,
        deliveryRoutes,
        geoCheckins,
        accountHolds,
        sageCustomers,
        sageInvoices,
        sagePayments,
        users,
        roles,
        permissions,
        systemLogs,
        auditLogs,
        activityLogs,
        notificationLogs,
        customFields,
        fieldValues,
        workflows,
        workflowInstances,
        approvalWorkflows,
        approvalRequests,
        notificationTemplates,
        reminders,
        calendarEvents,
        notes,
        comments,
        attachments,
        tags,
        tagAssignments,
        logRecords,
        printTemplates,
        emailTemplates,
        smsTemplates,
        settings,
      },
    };
    const backups = JSON.parse(getStorageItem("sgf_backups") || "[]");
    backups.push(backup);
    setStorageItem("sgf_backups", JSON.stringify(backups.slice(-10))); // Keep last 10
    return backup;
  },
  list: () => JSON.parse(getStorageItem("sgf_backups") || "[]"),
  restore: (timestamp: string) => {
    const backups = JSON.parse(getStorageItem("sgf_backups") || "[]");
    const backup = backups.find((b: any) => b.timestamp === timestamp);
    if (!backup) return { success: false, error: "Backup not found" };
    const d = backup.data;
    customers = d.customers || [];
    products = d.products || [];
    orders = d.orders || [];
    invoices = d.invoices || [];
    receipts = d.receipts || [];
    creditNotes = d.creditNotes || [];
    purchaseOrders = d.purchaseOrders || [];
    corporateCustomers = d.corporateCustomers || [];
    priceTiers = d.priceTiers || [];
    specialPrices = d.specialPrices || [];
    deliveryRoutes = d.deliveryRoutes || [];
    geoCheckins = d.geoCheckins || [];
    accountHolds = d.accountHolds || [];
    sageCustomers = d.sageCustomers || [];
    sageInvoices = d.sageInvoices || [];
    sagePayments = d.sagePayments || [];
    users = d.users || [];
    roles = d.roles || [];
    permissions = d.permissions || [];
    systemLogs = d.systemLogs || [];
    auditLogs = d.auditLogs || [];
    activityLogs = d.activityLogs || [];
    notificationLogs = d.notificationLogs || [];
    customFields = d.customFields || [];
    fieldValues = d.fieldValues || [];
    workflows = d.workflows || [];
    workflowInstances = d.workflowInstances || [];
    approvalWorkflows = d.approvalWorkflows || [];
    approvalRequests = d.approvalRequests || [];
    notificationTemplates = d.notificationTemplates || [];
    reminders = d.reminders || [];
    calendarEvents = d.calendarEvents || [];
    notes = d.notes || [];
    comments = d.comments || [];
    attachments = d.attachments || [];
    tags = d.tags || [];
    tagAssignments = d.tagAssignments || [];
    logRecords = d.logRecords || [];
    printTemplates = d.printTemplates || [];
    emailTemplates = d.emailTemplates || [];
    smsTemplates = d.smsTemplates || [];
    settings = d.settings || [];
    saveAll();
    return { success: true };
  },
};

// =============================================================================
// EXPORT SERVICE
// =============================================================================

export const exportService = {
  exportCustomers: () => JSON.stringify(customers, null, 2),
  exportProducts: () => JSON.stringify(products, null, 2),
  exportOrders: () => JSON.stringify(orders, null, 2),
  exportInvoices: () => JSON.stringify(invoices, null, 2),
  exportAll: () => JSON.stringify({
    customers,
    products,
    orders,
    invoices,
    receipts,
    creditNotes,
    purchaseOrders,
    corporateCustomers,
    priceTiers,
    specialPrices,
    deliveryRoutes,
    geoCheckins,
    accountHolds,
    sageCustomers,
    sageInvoices,
    sagePayments,
    users,
    roles,
    permissions,
    systemLogs,
    auditLogs,
    activityLogs,
    notificationLogs,
    customFields,
    fieldValues,
    workflows,
    workflowInstances,
    approvalWorkflows,
    approvalRequests,
    notificationTemplates,
    reminders,
    calendarEvents,
    notes,
    comments,
    attachments,
    tags,
    tagAssignments,
    logRecords,
    printTemplates,
    emailTemplates,
    smsTemplates,
    settings,
  }, null, 2),
};

// =============================================================================
// IMPORT SERVICE
// =============================================================================

export const importService = {
  importCustomers: (json: string) => {
    const data = JSON.parse(json);
    customers = Array.isArray(data) ? data : data.customers || [];
    saveItem("sgf_customers", customers);
    return { success: true, count: customers.length };
  },
  importProducts: (json: string) => {
    const data = JSON.parse(json);
    products = Array.isArray(data) ? data : data.products || [];
    saveItem("sgf_products", products);
    return { success: true, count: products.length };
  },
  importOrders: (json: string) => {
    const data = JSON.parse(json);
    orders = Array.isArray(data) ? data : data.orders || [];
    saveItem("sgf_orders", orders);
    return { success: true, count: orders.length };
  },
  importInvoices: (json: string) => {
    const data = JSON.parse(json);
    invoices = Array.isArray(data) ? data : data.invoices || [];
    saveItem("sgf_invoices", invoices);
    return { success: true, count: invoices.length };
  },
  importAll: (json: string) => {
    const data = JSON.parse(json);
    customers = data.customers || [];
    products = data.products || [];
    orders = data.orders || [];
    invoices = data.invoices || [];
    receipts = data.receipts || [];
    creditNotes = data.creditNotes || [];
    purchaseOrders = data.purchaseOrders || [];
    corporateCustomers = data.corporateCustomers || [];
    priceTiers = data.priceTiers || [];
    specialPrices = data.specialPrices || [];
    deliveryRoutes = data.deliveryRoutes || [];
    geoCheckins = data.geoCheckins || [];
    accountHolds = data.accountHolds || [];
    sageCustomers = data.sageCustomers || [];
    sageInvoices = data.sageInvoices || [];
    sagePayments = data.sagePayments || [];
    users = data.users || [];
    roles = data.roles || [];
    permissions = data.permissions || [];
    systemLogs = data.systemLogs || [];
    auditLogs = data.auditLogs || [];
    activityLogs = data.activityLogs || [];
    notificationLogs = data.notificationLogs || [];
    customFields = data.customFields || [];
    fieldValues = data.fieldValues || [];
    workflows = data.workflows || [];
    workflowInstances = data.workflowInstances || [];
    approvalWorkflows = data.approvalWorkflows || [];
    approvalRequests = data.approvalRequests || [];
    notificationTemplates = data.notificationTemplates || [];
    reminders = data.reminders || [];
    calendarEvents = data.calendarEvents || [];
    notes = data.notes || [];
    comments = data.comments || [];
    attachments = data.attachments || [];
    tags = data.tags || [];
    tagAssignments = data.tagAssignments || [];
    logRecords = data.logRecords || [];
    printTemplates = data.printTemplates || [];
    emailTemplates = data.emailTemplates || [];
    smsTemplates = data.smsTemplates || [];
    settings = data.settings || [];
    saveAll();
    return { success: true };
  },
};

// =============================================================================
// SEARCH SERVICE
// =============================================================================

export const searchService = {
  search: (query: string) => {
    const q = query.toLowerCase().trim();
    if (!q) return { customers: [], products: [], orders: [], invoices: [] };
    return {
      customers: customers.filter((c) =>
        c.name?.toLowerCase().includes(q) ||
        c.customerCode?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.phone?.toLowerCase().includes(q)
      ),
      products: products.filter((p) =>
        p.name?.toLowerCase().includes(q) ||
        p.productCode?.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q)
      ),
      orders: orders.filter((o) =>
        o.orderNumber?.toLowerCase().includes(q) ||
        o.customerName?.toLowerCase().includes(q)
      ),
      invoices: invoices.filter((i) =>
        i.invoiceNumber?.toLowerCase().includes(q) ||
        i.customerName?.toLowerCase().includes(q)
      ),
    };
  },
};

// =============================================================================
// DASHBOARD SERVICE
// =============================================================================

export const dashboardService = {
  getStats: () => ({
    customers: customers.length,
    products: products.length,
    orders: orders.length,
    invoices: invoices.length,
    receipts: receipts.length,
    creditNotes: creditNotes.length,
    purchaseOrders: purchaseOrders.length,
    corporateCustomers: corporateCustomers.length,
    users: users.length,
    totalSales: Math.round(orders.filter((o) => o.status !== "cancelled" && o.orderType !== "quote").reduce((sum, o) => sum + (o.total || 0), 0) * 100) / 100,
    totalOutstanding: Math.round(invoices.filter((i) => i.status !== "cancelled" && (i.balanceDue || 0) > 0.01).reduce((sum, i) => sum + (i.balanceDue || 0), 0) * 100) / 100,
    totalPaid: Math.round(invoices.filter((i) => i.status !== "cancelled").reduce((sum, i) => sum + (i.amountPaid || 0), 0) * 100) / 100,
  }),
  getRecentActivity: (limit: number = 10) => {
    const allActivity = [
      ...orders.map((o) => ({ type: "order", data: o, date: o.createdAt })),
      ...invoices.map((i) => ({ type: "invoice", data: i, date: i.createdAt })),
      ...receipts.map((r) => ({ type: "receipt", data: r, date: r.createdAt })),
      ...customers.map((c) => ({ type: "customer", data: c, date: c.createdAt })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return allActivity.slice(0, limit);
  },
  getSalesChart: (from: string, to: string) => {
    const fromTs = new Date(from + "T00:00:00").getTime();
    const toTs = new Date(to + "T23:59:59").getTime();
    const days: Record<string, number> = {};
    for (const order of orders) {
      const ts = new Date(order.createdAt).getTime();
      if (ts < fromTs || ts > toTs || order.status === "cancelled" || order.orderType === "quote") continue;
      const day = order.createdAt.slice(0, 10);
      days[day] = (days[day] || 0) + (order.total || 0);
    }
    return Object.entries(days).map(([date, total]) => ({ date, total })).sort((a, b) => a.date.localeCompare(b.date));
  },
  getCustomerChart: (from: string, to: string) => {
    const fromTs = new Date(from + "T00:00:00").getTime();
    const toTs = new Date(to + "T23:59:59").getTime();
    const days: Record<string, number> = {};
    for (const customer of customers) {
      const ts = new Date(customer.createdAt).getTime();
      if (ts < fromTs || ts > toTs) continue;
      const day = customer.createdAt.slice(0, 10);
      days[day] = (days[day] || 0) + 1;
    }
    return Object.entries(days).map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date));
  },
};

// =============================================================================
// INITIALIZATION
// =============================================================================

/** Initialize all data from storage. Called on app startup. */
export function initializeData() {
  load();
}

/** Reset all data to empty arrays. USE WITH CAUTION. */
export function resetAllData() {
  customers = [];
  products = [];
  orders = [];
  invoices = [];
  receipts = [];
  creditNotes = [];
  purchaseOrders = [];
  corporateCustomers = [];
  priceTiers = [];
  specialPrices = [];
  deliveryRoutes = [];
  geoCheckins = [];
  accountHolds = [];
  sageCustomers = [];
  sageInvoices = [];
  sagePayments = [];
  users = [];
  roles = [];
  permissions = [];
  systemLogs = [];
  auditLogs = [];
  activityLogs = [];
  notificationLogs = [];
  customFields = [];
  fieldValues = [];
  workflows = [];
  workflowInstances = [];
  approvalWorkflows = [];
  approvalRequests = [];
  notificationTemplates = [];
  reminders = [];
  calendarEvents = [];
  notes = [];
  comments = [];
  attachments = [];
  tags = [];
  tagAssignments = [];
  logRecords = [];
  printTemplates = [];
  emailTemplates = [];
  smsTemplates = [];
  settings = [];
  saveAll();
}

// Auto-initialize on module load
initializeData();
