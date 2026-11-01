        const cust = customers.find((c) => c.id == newItem.customerId);
        if (cust?.salesRepName) newItem.salesRepName = cust.salesRepName;
      }
      // If notes contains location info, also store it as location
      if (newItem.notes && !newItem.location) {
        newItem.location = newItem.notes;
      }
      checkins.push(newItem);
      saveItem("sgf_checkins", checkins);

      // If this check-in is linked to an appointment, update the appointment status to in_progress
      if (newItem.appointmentId) {
        const apptIdx = appointments.findIndex((a) => a.id == newItem.appointmentId);
        if (apptIdx >= 0) {
          appointments[apptIdx].status = "in_progress";
          appointments[apptIdx].checkedInAt = newItem.createdAt;
          appointments[apptIdx].updatedAt = new Date().toISOString();
          saveItem("sgf_appointments", appointments);
        }
      }

      return newItem;
    },
    checkout: ({ id, notes, outcome, outcomeNotes }: { id: number; notes?: string; outcome?: string; outcomeNotes?: string }) => {
      const idx = checkins.findIndex((ci) => ci.id == id);
      if (idx >= 0) {
        checkins[idx].status = "checked_out";
        checkins[idx].checkedOutAt = new Date().toISOString();
        if (notes) checkins[idx].checkoutNotes = notes;
        if (outcome) checkins[idx].outcome = outcome;
        if (outcomeNotes) checkins[idx].outcomeNotes = outcomeNotes;
        checkins[idx].updatedAt = new Date().toISOString();
        // Calculate duration in minutes
        const checkInTime = new Date(checkins[idx].createdAt).getTime();
        const checkOutTime = new Date(checkins[idx].checkedOutAt).getTime();
        checkins[idx].durationMinutes = Math.round((checkOutTime - checkInTime) / 60000);
        saveItem("sgf_checkins", checkins);

        // If linked to an appointment, update appointment to completed with outcome
        if (checkins[idx].appointmentId) {
          const apptIdx = appointments.findIndex((a) => a.id == checkins[idx].appointmentId);
          if (apptIdx >= 0) {
            appointments[apptIdx].status = "completed";
            appointments[apptIdx].checkedOutAt = checkins[idx].checkedOutAt;
            appointments[apptIdx].durationMinutes = checkins[idx].durationMinutes;
            if (outcome) appointments[apptIdx].outcome = outcome;
            if (outcomeNotes) appointments[apptIdx].outcomeNotes = outcomeNotes;
            appointments[apptIdx].updatedAt = new Date().toISOString();
            saveItem("sgf_appointments", appointments);
          }
        }

        return checkins[idx];
      }
      return null;
    },
    getStats: () => ({
      total: checkins.length,
      today: checkins.filter((ci) => new Date(ci.createdAt).toDateString() === new Date().toDateString()).length,
      checkedIn: checkins.filter((ci) => ci.status === "checked_in").length,
      checkedOut: checkins.filter((ci) => ci.status === "checked_out").length,
    }),

    /** ═══════════════════════════════════════════════════════════════
     *  SALES REP VISIT REPORTS — Daily, Weekly, Monthly
     *  Uses GPS coordinates from check-ins to calculate distance
     *  and applies South African AA rates for cost estimation.
     *  ═══════════════════════════════════════════════════════════════ */
    getDailyReport: (dateStr?: string) => {
      const targetDate = dateStr ? new Date(dateStr) : new Date();
      const dateKey = targetDate.toDateString();
      // Include ALL check-ins for the day — even those without GPS coordinates.
      // buildRepReport handles missing coords gracefully (counts visit, skips distance).
      const dayCheckins = checkins.filter((ci) =>
        new Date(ci.createdAt).toDateString() === dateKey
      );
      return buildRepReport(dayCheckins, "daily", targetDate);
    },

    getWeeklyReport: (year?: number, week?: number) => {
      const now = new Date();
      const targetYear = year || now.getFullYear();
      const targetWeek = week || getWeekNumber(now);
      const weekCheckins = checkins.filter((ci) => {
        const d = new Date(ci.createdAt);
        return d.getFullYear() === targetYear && getWeekNumber(d) === targetWeek;
      });
      return buildRepReport(weekCheckins, "weekly", now, targetYear, targetWeek);
    },

    getMonthlyReport: (year?: number, month?: number) => {
      const now = new Date();
      const targetYear = year || now.getFullYear();
      const targetMonth = month !== undefined ? month : now.getMonth();
      const monthCheckins = checkins.filter((ci) => {
        const d = new Date(ci.createdAt);
        return d.getFullYear() === targetYear && d.getMonth() === targetMonth;
      });
      return buildRepReport(monthCheckins, "monthly", now, targetYear, targetMonth);
    },
  
    getAARate,
    setAARate,},

  followUpAction: {
    list: () => followUpActions.map((fa) => ({
      ...fa,
      customer: customers.find((c) => c.id == fa.customerId) || null,
    })).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    listByCustomer: ({ customerId }: { customerId: number }) =>
      followUpActions
        .filter((fa) => fa.customerId == customerId)
        .map((fa) => ({
          ...fa,
          customer: customers.find((c) => c.id == fa.customerId) || null,
        }))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    create: (data: any) => {
      const newItem = {
        ...data,
        id: Date.now() + Math.random(),
        createdAt: new Date().toISOString(),
      };
      followUpActions.push(newItem);
      saveItem("sgf_followUpActions", followUpActions);
      return newItem;
    },
    getStats: () => ({
      total: followUpActions.length,
      today: followUpActions.filter((fa) => new Date(fa.createdAt).toDateString() === new Date().toDateString()).length,
      byType: followUpActions.reduce((acc: Record<string, number>, fa) => {
        const type = fa.actionType || "other";
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {}),
    }),
  },

  specialPrice: {
    listByCustomer: ({ customerId }: { customerId: number }) =>
      specialPrices
        .filter((sp) => sp.customerId == customerId)
        .map((sp) => ({
          ...sp,
          stockItem: products.find((p) => p.id == sp.stockItemId) || null,
        })),
    set: ({ customerId, stockItemId, specialPrice: price }: { customerId: number; stockItemId: number; specialPrice: number }) => {
      const existing = specialPrices.find((sp) => sp.customerId == customerId && sp.stockItemId == stockItemId);
      const cust = customers.find((c) => c.id == customerId);
      const prod = products.find((p) => p.id == stockItemId);
      if (existing) {
        existing.specialPrice = String(price);
        existing.updatedAt = new Date().toISOString();
        logAudit("UPDATE", "specialPrice", existing.id, `Special price updated for ${cust?.name || "Customer"} on ${prod?.productName || "product"}: R${Number(price).toFixed(2)}`);
      } else {
        const newSp = { id: Date.now(), customerId, stockItemId, specialPrice: String(price), createdAt: new Date().toISOString() };
        specialPrices.push(newSp);
