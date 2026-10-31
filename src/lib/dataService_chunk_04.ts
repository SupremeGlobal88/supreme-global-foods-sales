// =============================================================================
// APPOINTMENT SERVICE
// =============================================================================

export const appointmentService = {
  list: () => appointments,
  getById: (id: number) => appointments.find((a) => a.id === id),
  getByCustomer: (customerId: number) => appointments.filter((a) => a.customerId === customerId),
  getBySalesRep: (repName: string) => appointments.filter((a) => a.salesRepName === repName),
  getByDate: (date: string) => appointments.filter((a) => a.date === date),
  getUpcoming: () => appointments.filter((a) => new Date(a.date) >= new Date()),
  getOverdue: () => appointments.filter((a) => new Date(a.date) < new Date() && a.status !== "completed" && a.status !== "cancelled"),
  getByStatus: (status: string) => appointments.filter((a) => a.status === status),
  create: (data: any) => {
    const newAppt = {
      id: Date.now() + Math.random(),
      ...data,
      status: data.status || "scheduled",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    appointments.push(newAppt);
    saveItem("sgf_appointments", appointments);
    logAudit("create", "appointment", newAppt.id, data);
    return newAppt;
  },
  update: (id: number, data: any) => {
    const index = appointments.findIndex((a) => a.id === id);
    if (index === -1) return null;
    appointments[index] = { ...appointments[index], ...data, updatedAt: new Date().toISOString() };
    saveItem("sgf_appointments", appointments);
    logAudit("update", "appointment", id, data);
    return appointments[index];
  },
  delete: (id: number) => {
    const index = appointments.findIndex((a) => a.id === id);
    if (index === -1) return { success: false, error: "Appointment not found" };
    appointments.splice(index, 1);
    saveItem("sgf_appointments", appointments);
    logAudit("delete", "appointment", id, {});
    return { success: true };
  },
};

// =============================================================================
// CHECK-IN SERVICE
// =============================================================================

export const checkinService = {
  list: () => checkins,
  getById: (id: number) => checkins.find((c) => c.id === id),
  getByCustomer: (customerId: number) => checkins.filter((c) => c.customerId === customerId),
  getBySalesRep: (repName: string) => checkins.filter((c) => c.salesRepName === repName),
  getByDate: (date: string) => checkins.filter((c) => c.date === date),
  getToday: () => {
    const today = new Date().toISOString().slice(0, 10);
    return checkins.filter((c) => c.date === today);
  },
  create: (data: any) => {
    const newCheckin = {
      id: Date.now() + Math.random(),
      ...data,
      date: data.date || new Date().toISOString().slice(0, 10),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    checkins.push(newCheckin);
    saveItem("sgf_checkins", checkins);
    logAudit("create", "checkin", newCheckin.id, data);
    return newCheckin;
  },
  update: (id: number, data: any) => {
    const index = checkins.findIndex((c) => c.id === id);
    if (index === -1) return null;
    checkins[index] = { ...checkins[index], ...data, updatedAt: new Date().toISOString() };
    saveItem("sgf_checkins", checkins);
    logAudit("update", "checkin", id, data);
    return checkins[index];
  },
  delete: (id: number) => {
    const index = checkins.findIndex((c) => c.id === id);
    if (index === -1) return { success: false, error: "Check-in not found" };
    checkins.splice(index, 1);
    saveItem("sgf_checkins", checkins);
    logAudit("delete", "checkin", id, {});
    return { success: true };
  },
};

// =============================================================================
// FOLLOW-UP SERVICE
// =============================================================================

export const followUpService = {
  list: () => followUps,
  getById: (id: number) => followUps.find((f) => f.id === id),
  getByCustomer: (customerId: number) => followUps.filter((f) => f.customerId === customerId),
  getBySalesRep: (repName: string) => followUps.filter((f) => f.salesRepName === repName),
  getByStatus: (status: string) => followUps.filter((f) => f.status === status),
  getOverdue: () => followUps.filter((f) => new Date(f.dueDate) < new Date() && f.status !== "completed" && f.status !== "cancelled"),
  getUpcoming: () => followUps.filter((f) => new Date(f.dueDate) >= new Date()),
  create: (data: any) => {
    const newFollowUp = {
      id: Date.now() + Math.random(),
      ...data,
      status: data.status || "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    followUps.push(newFollowUp);
    saveItem("sgf_followUps", followUps);
    logAudit("create", "followUp", newFollowUp.id, data);
    return newFollowUp;
  },
  update: (id: number, data: any) => {
    const index = followUps.findIndex((f) => f.id === id);
    if (index === -1) return null;
    followUps[index] = { ...followUps[index], ...data, updatedAt: new Date().toISOString() };
    saveItem("sgf_followUps", followUps);
    logAudit("update", "followUp", id, data);
    return followUps[index];
  },
  delete: (id: number) => {
    const index = followUps.findIndex((f) => f.id === id);
    if (index === -1) return { success: false, error: "Follow-up not found" };
    followUps.splice(index, 1);
    saveItem("sgf_followUps", followUps);
    logAudit("delete", "followUp", id, {});
    return { success: true };
  },
};

// =============================================================================
// FOLLOW-UP ACTION SERVICE
// =============================================================================

export const followUpActionService = {
  list: () => followUpActions,
  getById: (id: number) => followUpActions.find((f) => f.id === id),
  getByFollowUp: (followUpId: number) => followUpActions.filter((f) => f.followUpId === followUpId),
  getBySalesRep: (repName: string) => followUpActions.filter((f) => f.salesRepName === repName),
  create: (data: any) => {
    const newAction = {
      id: Date.now() + Math.random(),
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    followUpActions.push(newAction);
    saveItem("sgf_followUpActions", followUpActions);
    logAudit("create", "followUpAction", newAction.id, data);
    return newAction;
  },
  update: (id: number, data: any) => {
    const index = followUpActions.findIndex((f) => f.id === id);
    if (index === -1) return null;
    followUpActions[index] = { ...followUpActions[index], ...data, updatedAt: new Date().toISOString() };
    saveItem("sgf_followUpActions", followUpActions);
    logAudit("update", "followUpAction", id, data);
    return followUpActions[index];
  },
  delete: (id: number) => {
    const index = followUpActions.findIndex((f) => f.id === id);
    if (index === -1) return { success: false, error: "Follow-up action not found" };
    followUpActions.splice(index, 1);
    saveItem("sgf_followUpActions", followUpActions);
    logAudit("delete", "followUpAction", id, {});
    return { success: true };
  },
};

// =============================================================================
// COLLECTION NOTE SERVICE
// =============================================================================

export const collectionNoteService = {
  list: () => collectionNotes,
  getById: (id: number) => collectionNotes.find((c) => c.id === id),
  getByCustomer: (customerId: number) => collectionNotes.filter((c) => c.customerId === customerId),
  getByInvoice: (invoiceId: number) => collectionNotes.filter((c) => c.invoiceId === invoiceId),
  getBySalesRep: (repName: string) => collectionNotes.filter((c) => c.salesRepName === repName),
  create: (data: any) => {
    const newNote = {
      id: Date.now() + Math.random(),
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    collectionNotes.push(newNote);
    saveItem("sgf_collectionNotes", collectionNotes);
    logAudit("create", "collectionNote", newNote.id, data);
    return newNote;
  },
  update: (id: number, data: any) => {
    const index = collectionNotes.findIndex((c) => c.id === id);
    if (index === -1) return null;
    collectionNotes[index] = { ...collectionNotes[index], ...data, updatedAt: new Date().toISOString() };
    saveItem("sgf_collectionNotes", collectionNotes);
    logAudit("update", "collectionNote", id, data);
    return collectionNotes[index];
  },
  delete: (id: number) => {
    const index = collectionNotes.findIndex((c) => c.id === id);
    if (index === -1) return { success: false, error: "Collection note not found" };
    collectionNotes.splice(index, 1);
    saveItem("sgf_collectionNotes", collectionNotes);
    logAudit("delete", "collectionNote", id, {});
    return { success: true };
  },
};
