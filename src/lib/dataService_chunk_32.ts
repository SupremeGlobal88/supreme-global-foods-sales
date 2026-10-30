    getAddressChanges: () => auditLog.filter((entry) => entry.action === "UPDATE_ADDRESS"),
    getStats: () => ({
      totalEntries: auditLog.length,
      byAction: auditLog.reduce((acc: Record<string, number>, entry: any) => {
        acc[entry.action] = (acc[entry.action] || 0) + 1;
        return acc;
      }, {}),
      byEntityType: auditLog.reduce((acc: Record<string, number>, entry: any) => {
        acc[entry.entityType] = (acc[entry.entityType] || 0) + 1;
        return acc;
      }, {}),
      last7Days: auditLog.filter((e: any) => e.timestamp && new Date(e.timestamp) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length,
    }),
    getFullTrail: () => auditLog,
    getMissedAppointments: () => {
      const now = new Date();
      return appointments.filter((a: any) => {
        const apptDate = a.date ? new Date(a.date) : null;
        const isPast = apptDate && apptDate < now;
        const status = a.status?.toLowerCase() || "";
        return isPast && (status === "no_show" || status === "cancelled" || status === "missed" || status === "pending");
      });
    },
    getCheckInReport: () => {
      const today = new Date().toISOString().split("T")[0];
      return {
        today: checkins.filter((c: any) => c.date?.startsWith(today)).length,
        total: checkins.length,
        byUser: checkins.reduce((acc: Record<string, number>, c: any) => {
          const user = c.userName || c.userId || "Unknown";
          acc[user] = (acc[user] || 0) + 1;
          return acc;
        }, {}),
      };
    },
  },
  systemLogs: {
    list: () => systemLogs,
    getByCategory: (cat: string) => systemLogs.filter((e) => e.category === cat),
    getByLevel: (level: string) => systemLogs.filter((e) => e.level === level),
    getSummary: () => ({
      total: systemLogs.length,
      byLevel: systemLogs.reduce((acc: Record<string, number>, e: any) => {
        acc[e.level] = (acc[e.level] || 0) + 1;
        return acc;
      }, {}),
      byCategory: systemLogs.reduce((acc: Record<string, number>, e: any) => {
        acc[e.category] = (acc[e.category] || 0) + 1;
        return acc;
      }, {}),
    }),
  },

  /* ─── User Management with Roles ─── */
  user: {
    list: () => users,
    getById: (id: number) => users.find((u) => u.id == id) || null,
    getByName: (name: string) => users.find((u) => u.name?.toLowerCase() === name.toLowerCase() && u.isActive !== false) || null,
    authenticate: ({ name, pin }: { name: string; pin: string }) => {
      const DEFAULT_USERS = [
        { id: 1, name: "Collin", email: "", role: "super_admin", pin: "2580", isActive: true },
        { id: 2, name: "Adeli", email: "", role: "sales_rep", pin: "1111", isActive: true },
        { id: 3, name: "Inhouse", email: "", role: "sales_rep", pin: "2222", isActive: true },
        { id: 4, name: "Michael", email: "", role: "sales_rep", pin: "3333", isActive: true },
        { id: 5, name: "Nkosana", email: "", role: "sales_rep", pin: "4444", isActive: true },
        { id: 6, name: "Tebogo Bila", email: "", role: "sales_rep", pin: "6666", isActive: true },
        { id: 7, name: "Aggie", email: "", role: "admin", pin: "1018", isActive: true },
        { id: 8, name: "Ronald", email: "", role: "super_admin", pin: "2581", isActive: true },
        { id: 9, name: "Jolene", email: "", role: "admin", pin: "7777", isActive: true },
        { id: 10, name: "David", email: "", role: "super_admin", pin: "8888", isActive: true },
      ];

      // Firebase RTDB auto-converts numeric strings to numbers (e.g. "2580" → 2580).
      // After sync/merge the PIN may be a number, but the login form sends a string.
      // Use String() on both sides so 2580 (number) matches "2580" (string).
      const typedPin = String(pin);

      // Try 1: in-memory users array
      let found = users.find((x: any) => x.name?.toLowerCase() === name.toLowerCase() && String(x.pin) === typedPin && x.isActive !== false);

      // Try 2: localStorage direct read (this now includes users synced from Firebase via syncFromCloud)
      if (!found) {
        try {
          const raw = getStorageItem("sgf_users");
          if (raw) {
            const stored = JSON.parse(raw);
            found = stored.find((x: any) => x.name?.toLowerCase() === name.toLowerCase() && String(x.pin) === typedPin && x.isActive !== false);
          }
        } catch { /* ignore */ }
      }

      // Try 3: hardcoded defaults — BUT only if the user does NOT exist in stored
      // data with a different PIN. This prevents old hardcoded PINs from working
      // after a PIN has been changed via User Management.
      if (!found) {
        // Check if this user exists in stored data with a DIFFERENT PIN.
        // If so, the old hardcoded PIN must NOT be allowed.
        let storedUserWithDifferentPin: any = null;
        try {
          const raw = getStorageItem("sgf_users");
          if (raw) {
            const stored = JSON.parse(raw);
            storedUserWithDifferentPin = stored.find(
              (x: any) => x.name?.toLowerCase() === name.toLowerCase() && String(x.pin) !== typedPin && x.isActive !== false
            );
          }
        } catch { /* ignore */ }

        // Also check in-memory users for same-name-different-PIN
        const memUserWithDifferentPin = users.find(
          (x: any) => x.name?.toLowerCase() === name.toLowerCase() && String(x.pin) !== typedPin && x.isActive !== false
        );

        if (!storedUserWithDifferentPin && !memUserWithDifferentPin) {
          found = DEFAULT_USERS.find((x: any) => x.name?.toLowerCase() === name.toLowerCase() && String(x.pin) === typedPin && x.isActive !== false);
          // Do NOT re-add missing default users here — if an admin deleted a user,
          // they must stay deleted. Re-adding causes "jumping back" bug.
          // Defaults are only injected on first app load when users array is empty.
        }
      }

      if (!found) return null;
      const hardcoded = DEFAULT_USERS.find((u) => u.id == found.id || u.name.toLowerCase() === found.name?.toLowerCase());
      const resolvedPin = found.pin != null ? found.pin : hardcoded?.pin;
      return { id: found.id, name: found.name, email: found.email, role: found.role, pin: resolvedPin };
    },
    create: (data: any) => {
      const newUser = { ...data, id: Date.now(), isActive: true, createdAt: new Date().toISOString() };
      users.push(newUser);
      saveItem("sgf_users", users);
      logAudit("CREATE", "user", newUser.id, `Created user: ${newUser.name} (${newUser.role})`);
      return newUser;
    },
    update: ({ id, data }: { id: number; data: any }) => {
      const idx = users.findIndex((u) => u.id == id);
      if (idx >= 0) {
        const oldUser = users[idx];
        // Never allow changing a super_admin's role away from super_admin via update
        if (users[idx].role === "super_admin" && data.role && data.role !== "super_admin") {
          const superAdminCount = users.filter((u) => u.role === "super_admin").length;
          if (superAdminCount <= 1) {
            delete data.role;
          }
        }
        users[idx] = { ...users[idx], ...data, updatedAt: new Date().toISOString() };
        saveItem("sgf_users", users);
