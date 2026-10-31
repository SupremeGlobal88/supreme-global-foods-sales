// =============================================================================
// EVENT / CALENDAR SERVICE
// =============================================================================

export const eventService = {
  list: () => {
    try {
      const raw = getStorageItem("sgf_events");
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return [];
  },
  getById: (id: number) => {
    const events = eventService.list();
    return events.find((e: any) => e.id === id);
  },
  getByDate: (date: string) => {
    const events = eventService.list();
    return events.filter((e: any) => e.date === date);
  },
  getByMonth: (month: string) => {
    const events = eventService.list();
    return events.filter((e: any) => e.date?.startsWith(month));
  },
  create: (data: any) => {
    const events = eventService.list();
    const newEvent = {
      id: Date.now() + Math.random(),
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    events.push(newEvent);
    setStorageItem("sgf_events", JSON.stringify(events));
    logAudit("create", "event", newEvent.id, data);
    return newEvent;
  },
  update: (id: number, data: any) => {
    const events = eventService.list();
    const index = events.findIndex((e: any) => e.id === id);
    if (index === -1) return null;
    events[index] = { ...events[index], ...data, updatedAt: new Date().toISOString() };
    setStorageItem("sgf_events", JSON.stringify(events));
    logAudit("update", "event", id, data);
    return events[index];
  },
  delete: (id: number) => {
    const events = eventService.list();
    const index = events.findIndex((e: any) => e.id === id);
    if (index === -1) return { success: false, error: "Event not found" };
    events.splice(index, 1);
    setStorageItem("sgf_events", JSON.stringify(events));
    logAudit("delete", "event", id, {});
    return { success: true };
  },
};

// =============================================================================
// TASK / TODO SERVICE
// =============================================================================

export const taskService = {
  list: () => {
    try {
      const raw = getStorageItem("sgf_tasks");
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return [];
  },
  getById: (id: number) => {
    const tasks = taskService.list();
    return tasks.find((t: any) => t.id === id);
  },
  getByUser: (userId: number) => {
    const tasks = taskService.list();
    return tasks.filter((t: any) => t.assignedTo === userId);
  },
  getByStatus: (status: string) => {
    const tasks = taskService.list();
    return tasks.filter((t: any) => t.status === status);
  },
  getOverdue: () => {
    const now = new Date().toISOString();
    const tasks = taskService.list();
    return tasks.filter((t: any) => t.dueDate && t.dueDate < now && t.status !== "completed");
  },
  create: (data: any) => {
    const tasks = taskService.list();
    const newTask = {
      id: Date.now() + Math.random(),
      ...data,
      status: data.status || "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    tasks.push(newTask);
    setStorageItem("sgf_tasks", JSON.stringify(tasks));
    logAudit("create", "task", newTask.id, data);
    return newTask;
  },
  update: (id: number, data: any) => {
    const tasks = taskService.list();
    const index = tasks.findIndex((t: any) => t.id === id);
    if (index === -1) return null;
    tasks[index] = { ...tasks[index], ...data, updatedAt: new Date().toISOString() };
    setStorageItem("sgf_tasks", JSON.stringify(tasks));
    logAudit("update", "task", id, data);
    return tasks[index];
  },
  delete: (id: number) => {
    const tasks = taskService.list();
    const index = tasks.findIndex((t: any) => t.id === id);
    if (index === -1) return { success: false, error: "Task not found" };
    tasks.splice(index, 1);
    setStorageItem("sgf_tasks", JSON.stringify(tasks));
    logAudit("delete", "task", id, {});
    return { success: true };
  },
};

// =============================================================================
// NOTE / MEMO SERVICE
// =============================================================================

export const noteService = {
  list: () => {
    try {
      const raw = getStorageItem("sgf_notes");
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return [];
  },
  getById: (id: number) => {
    const notes = noteService.list();
    return notes.find((n: any) => n.id === id);
  },
  getByEntity: (entityType: string, entityId: number) => {
    const notes = noteService.list();
    return notes.filter((n: any) => n.entityType === entityType && n.entityId === entityId);
  },
  getByUser: (userId: number) => {
    const notes = noteService.list();
    return notes.filter((n: any) => n.createdBy === userId);
  },
  create: (data: any) => {
    const notes = noteService.list();
    const newNote = {
      id: Date.now() + Math.random(),
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    notes.push(newNote);
    setStorageItem("sgf_notes", JSON.stringify(notes));
    logAudit("create", "note", newNote.id, data);
    return newNote;
  },
  update: (id: number, data: any) => {
    const notes = noteService.list();
    const index = notes.findIndex((n: any) => n.id === id);
    if (index === -1) return null;
    notes[index] = { ...notes[index], ...data, updatedAt: new Date().toISOString() };
    setStorageItem("sgf_notes", JSON.stringify(notes));
    logAudit("update", "note", id, data);
    return notes[index];
  },
  delete: (id: number) => {
    const notes = noteService.list();
    const index = notes.findIndex((n: any) => n.id === id);
    if (index === -1) return { success: false, error: "Note not found" };
    notes.splice(index, 1);
    setStorageItem("sgf_notes", JSON.stringify(notes));
    logAudit("delete", "note", id, {});
    return { success: true };
  },
};

// =============================================================================
// REMINDER / ALERT SERVICE
// =============================================================================

export const reminderService = {
  list: () => {
    try {
      const raw = getStorageItem("sgf_reminders");
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return [];
  },
  getById: (id: number) => {
    const reminders = reminderService.list();
    return reminders.find((r: any) => r.id === id);
  },
  getByUser: (userId: number) => {
    const reminders = reminderService.list();
    return reminders.filter((r: any) => r.userId === userId);
  },
  getUpcoming: () => {
    const now = new Date().toISOString();
    const reminders = reminderService.list();
    return reminders.filter((r: any) => r.dueDate >= now && r.status !== "completed");
  },
  getOverdue: () => {
    const now = new Date().toISOString();
    const reminders = reminderService.list();
    return reminders.filter((r: any) => r.dueDate < now && r.status !== "completed");
  },
  create: (data: any) => {
    const reminders = reminderService.list();
    const newReminder = {
      id: Date.now() + Math.random(),
      ...data,
      status: data.status || "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    reminders.push(newReminder);
    setStorageItem("sgf_reminders", JSON.stringify(reminders));
    logAudit("create", "reminder", newReminder.id, data);
    return newReminder;
  },
  update: (id: number, data: any) => {
    const reminders = reminderService.list();
    const index = reminders.findIndex((r: any) => r.id === id);
    if (index === -1) return null;
    reminders[index] = { ...reminders[index], ...data, updatedAt: new Date().toISOString() };
    setStorageItem("sgf_reminders", JSON.stringify(reminders));
    logAudit("update", "reminder", id, data);
    return reminders[index];
  },
  delete: (id: number) => {
    const reminders = reminderService.list();
    const index = reminders.findIndex((r: any) => r.id === id);
    if (index === -1) return { success: false, error: "Reminder not found" };
    reminders.splice(index, 1);
    setStorageItem("sgf_reminders", JSON.stringify(reminders));
    logAudit("delete", "reminder", id, {});
    return { success: true };
  },
};
