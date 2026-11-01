          actionType: actionType !== undefined ? actionType : followUps[idx].actionType,
          title: title !== undefined ? title : followUps[idx].title,
          scheduledAppointmentId: scheduledAppointmentId !== undefined ? scheduledAppointmentId : followUps[idx].scheduledAppointmentId,
          updatedAt: new Date().toISOString(),
        };
        saveItem("sgf_followUps", followUps);
        logAudit("UPDATE", "followUp", id, `Follow-up updated: status ${oldStatus} → ${status}${reason ? `, reason: ${reason}` : ""}`);
        return followUps[idx];
      }
      return null;
    },
    getStats: () => ({
      pending: followUps.filter((fu) => fu.status === "pending").length,
      completed: followUps.filter((fu) => fu.status === "completed").length,
      overdue: followUps.filter((fu) => fu.followUpDate < new Date().toISOString() && fu.status === "pending").length,
    }),
  },
  customerFollowUp: {
    getAllFollowUps: () => followUps,
  },

  collections: {
    getOverdueInvoices: () => {
      const now = new Date();
      return invoices
        .filter((inv) => inv.status !== "paid" && inv.status !== "cancelled")
        .map((inv) => {
          const customer = customers.find((c) => c.id == inv.customerId);
          // Use invoiceDate (actual invoice date) not createdAt (import date)
          const invoiceDate = new Date(inv.invoiceDate || inv.createdAt);
          // Calculate due date from payment terms
          const terms = inv.paymentTerms || "30_days";
          const termDays = terms === "30_days" ? 30 : terms === "14_days" ? 14 : terms === "7_days" ? 7 : terms === "cod" ? 0 : 30;
          const dueDate = new Date(invoiceDate);
          dueDate.setDate(dueDate.getDate() + termDays);
          const daysOverdue = Math.max(0, Math.floor((now.getTime() - dueDate.getTime()) / 86400000));
          let bucket = "pre_due";
          if (daysOverdue >= 21) bucket = "days_21_plus";
          else if (daysOverdue >= 11) bucket = "days_11_20";
          else if (daysOverdue >= 6) bucket = "days_6_10";
          else if (daysOverdue >= 3) bucket = "days_3_5";
          else if (daysOverdue >= 1) bucket = "days_1_2";
          else if (daysOverdue === 0) bucket = "due_today";
          const notes = collectionNotes.filter((n) => n.invoiceId == inv.id);
          const latestPromise = collectionPromises
            .filter((p) => p.invoiceId == inv.id)
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] || null;
          const accountHold = accountHolds.find((h) => h.customerId == inv.customerId && h.status === "active") || null;
          return {
            ...inv,
            customer: customer || null,
            daysOverdue,
            bucket,
            balanceDue: typeof inv.balanceDue === "number" ? inv.balanceDue : (Number(inv.total || inv.totalAmount || 0) - Number(inv.amountPaid || 0)),
            collectionNotes: notes,
            latestPromise,
            accountHold,
            salesRepName: customer?.salesRepName || "",
          };
        })
        .filter((inv) => inv.balanceDue > 0)
        .sort((a, b) => b.daysOverdue - a.daysOverdue);
    },
    getDailyReport: () => {
      const today = new Date().toISOString().slice(0, 10);
      const todayActivities = collectionNotes
        .filter((n) => n.createdAt?.startsWith(today))
        .map((n) => ({ ...n, type: n.type || "note" }));
      const byBucket: Record<string, any[]> = {};
      const overdueInvoices = dataService.collections.getOverdueInvoices();
      for (const inv of overdueInvoices) {
        if (!byBucket[inv.bucket]) byBucket[inv.bucket] = [];
        byBucket[inv.bucket].push(inv);
      }
      return { today, generatedAt: new Date().toISOString(), byBucket, todayActivities, summary: { totalOverdue: overdueInvoices.length, totalOutstanding: overdueInvoices.reduce((s, i) => s + i.balanceDue, 0), todayActivities: todayActivities.length } };
    },
    getStats: () => {
      const overdueInvoices = dataService.collections.getOverdueInvoices();
      const totalOutstanding = overdueInvoices.reduce((s, i) => s + i.balanceDue, 0);
      return { totalOutstanding, totalOverdueInvoices: overdueInvoices.length, onHold: accountHolds.filter((h) => h.status === "active").length, pendingPromises: collectionPromises.filter((p) => p.status === "pending").length, totalCollectedToday: 0 };
    },
    getCustomerPaymentHistory: (customerId: number) => {
      return invoices
        .filter((inv) => inv.customerId == customerId)
        .map((inv) => ({
          ...inv,
          notes: collectionNotes.filter((n) => n.invoiceId == inv.id),
        }))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    },
    addNote: ({ invoiceId, customerId, type, notes, contactMethod, contactPerson, followUpDate }: any) => {
      // Auto-set follow-up date to 3 days from now if not provided (for call, email, sms, whatsapp, note)
      const autoFollowUpTypes = ["call", "email", "sms", "whatsapp", "note"];
      let finalFollowUpDate = followUpDate || null;
      if (!finalFollowUpDate && autoFollowUpTypes.includes(type)) {
        const d = new Date();
        d.setDate(d.getDate() + 3);
        finalFollowUpDate = d.toISOString().slice(0, 10);
      }
      const note = { id: Date.now() + Math.random(), invoiceId, customerId, type: type || "note", notes, contactMethod: contactMethod || "manual", contactPerson: contactPerson || "", followUpDate: finalFollowUpDate, createdAt: new Date().toISOString() };
      collectionNotes.push(note);
      saveItem("sgf_collectionNotes", collectionNotes);
      logAudit("CREATE", "collectionNote", note.id, `Collection note added for customer #${customerId}${invoiceId ? ` (invoice #${invoiceId})` : ""}: ${notes?.slice(0, 50) || ""}`);
      return note;
    },
    recordPromise: ({ invoiceId, customerId, promiseDate, promisedAmount, notes }: any) => {
      const promise = { id: Date.now() + Math.random(), invoiceId, customerId, promiseDate, promisedAmount: promisedAmount || 0, notes: notes || "", status: "pending", createdAt: new Date().toISOString() };
      collectionPromises.push(promise);
      saveItem("sgf_collectionPromises", collectionPromises);
      logAudit("CREATE", "collectionPromise", promise.id, `Payment promise recorded for customer #${customerId}: R${Number(promisedAmount || 0).toFixed(2)} by ${promiseDate}`);
      return promise;
    },
    placeHold: ({ customerId, reason, notes }: any) => {
      // Remove any existing active hold first
      accountHolds = accountHolds.map((h) => h.customerId == customerId && h.status === "active" ? { ...h, status: "released", releasedAt: new Date().toISOString() } : h);
      const hold = { id: Date.now() + Math.random(), customerId, reason: reason || "Non-payment", notes: notes || "", status: "active", createdAt: new Date().toISOString() };
      accountHolds.push(hold);
      // Also add a collection note
      collectionNotes.push({ id: Date.now() + Math.random(), invoiceId: null, customerId, type: "hold", notes: `Account hold placed: ${reason || "Non-payment"}`, contactMethod: "manual", contactPerson: "", followUpDate: null, createdAt: new Date().toISOString() });
      saveItem("sgf_accountHolds", accountHolds);
      saveItem("sgf_collectionNotes", collectionNotes);
