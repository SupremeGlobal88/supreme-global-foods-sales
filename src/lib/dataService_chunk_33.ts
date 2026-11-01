        logAudit("UPDATE", "user", id, `User updated: ${oldUser.name}${data.role && data.role !== oldUser.role ? ` (role: ${oldUser.role} → ${data.role})` : ""}`);
        return users[idx];
      }
      return null;
    },
    delete: ({ id }: { id: number }) => {
      const target = users.find((u) => u.id == id);
      if (target?.role === "super_admin") {
        const superAdminCount = users.filter((u) => u.role === "super_admin").length;
        if (superAdminCount <= 1) return { success: false, error: "Cannot delete the last super admin" };
      }
      users = users.filter((u) => u.id != id);
      saveItem("sgf_users", users);
      logAudit("DELETE", "user", id, `User deleted: ${target?.name || "Unknown"}`);
      return { success: true };
    },
    toggleActive: ({ id }: { id: number }) => {
      const idx = users.findIndex((u) => u.id == id);
      if (idx >= 0) {
        if (users[idx].role === "super_admin" && users[idx].isActive !== false) {
          const activeSuperAdminCount = users.filter((u) => u.role === "super_admin" && u.isActive !== false).length;
          if (activeSuperAdminCount <= 1) return { success: false, error: "Cannot deactivate the last active super admin" };
        }
        const userName = users[idx].name;
        const wasActive = users[idx].isActive !== false;
        users[idx].isActive = users[idx].isActive === false ? true : false;
        saveItem("sgf_users", users);
        logAudit("TOGGLE_ACTIVE", "user", id, `User ${userName} ${wasActive ? "deactivated" : "activated"}`);
        return { success: true, isActive: users[idx].isActive };
      }
      return { success: false };
    },
    resetPin: ({ id, pin }: { id: number; pin: string }) => {
      const idx = users.findIndex((u) => u.id == id);
      if (idx >= 0) {
        users[idx].pin = pin;
        users[idx].updatedAt = new Date().toISOString();
        saveItem("sgf_users", users);
        logAudit("RESET_PIN", "user", id, `PIN reset for user: ${users[idx].name}`);
        return { success: true };
      }
      return { success: false };
    },
  },

  // ═══════════════════════════════════════════════════════════════
  //  CORPORATE MODULE
  // ═══════════════════════════════════════════════════════════════
  corporateCustomer: {
    list: () => corporateCustomers,
    listByCompany: (company: string) => corporateCustomers.filter((c) => c.company === company || (!c.company && company === "sgf")),
    getById: (id: number) => corporateCustomers.find((c) => c.id == id) || null,
    create: (data: any) => {
      const newItem = {
        ...data,
        company: data.company || "sgf",
        id: Date.now(),
        isActive: data.isActive !== undefined ? data.isActive : true,
        creditLimit: data.creditLimit !== undefined ? Number(data.creditLimit) : 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      corporateCustomers.push(newItem);
      saveItem("sgf_corporateCustomers", corporateCustomers);
      logAudit("CREATE", "corporateCustomer", newItem.id, `Corporate customer created: ${newItem.name}`);
      // Also add to main customers list so invoices and statements resolve correctly
      const mainCust = {
        id: newItem.id,
        name: newItem.name,
        customerCode: newItem.code || `CORP-${newItem.id.toString().slice(-4)}`,
        contactPerson: newItem.contactPerson || "",
        email: newItem.email || "",
        phone: newItem.phone || "",
        physicalAddress: newItem.deliveryAddress || "",
        city: newItem.city || "",
        province: newItem.province || "",
        postalCode: newItem.postalCode || "",
        vatNumber: newItem.vatNumber || "",
        paymentTerms: newItem.paymentTerms || "30_days",
        priceTier: "corporate",
        isCorporate: true,
        company: newItem.company || "sgf",
        notes: newItem.notes || "",
        salesRepName: newItem.salesRepName || "",
        isActive: newItem.isActive,
        creditLimit: newItem.creditLimit,
        createdAt: newItem.createdAt,
        updatedAt: newItem.updatedAt,
      };
      customers.push(mainCust);
      saveItem("sgf_customers", customers);
      return newItem;
    },
    update: ({ id, data }: { id: number; data: any }) => {
      const idx = corporateCustomers.findIndex((c) => c.id == id);
      if (idx >= 0) {
        corporateCustomers[idx] = { ...corporateCustomers[idx], ...data, updatedAt: new Date().toISOString() };
        saveItem("sgf_corporateCustomers", corporateCustomers);
        // Sync updates to main customers list
        const cIdx = customers.findIndex((c) => c.id == id && c.isCorporate);
        if (cIdx >= 0) {
          customers[cIdx] = {
            ...customers[cIdx],
            name: data.name ?? customers[cIdx].name,
            customerCode: data.code ?? customers[cIdx].customerCode,
            contactPerson: data.contactPerson ?? customers[cIdx].contactPerson,
            email: data.email ?? customers[cIdx].email,
            phone: data.phone ?? customers[cIdx].phone,
            physicalAddress: data.deliveryAddress ?? customers[cIdx].physicalAddress,
            city: data.city ?? customers[cIdx].city,
            province: data.province ?? customers[cIdx].province,
            postalCode: data.postalCode ?? customers[cIdx].postalCode,
            vatNumber: data.vatNumber ?? customers[cIdx].vatNumber,
            paymentTerms: data.paymentTerms ?? customers[cIdx].paymentTerms,
            company: data.company ?? customers[cIdx].company,
            notes: data.notes ?? customers[cIdx].notes,
            salesRepName: data.salesRepName ?? customers[cIdx].salesRepName,
            isActive: data.isActive !== undefined ? data.isActive : customers[cIdx].isActive,
            creditLimit: data.creditLimit !== undefined ? Number(data.creditLimit) : customers[cIdx].creditLimit,
            updatedAt: new Date().toISOString(),
          };
          saveItem("sgf_customers", customers);
        }
        logAudit("UPDATE", "corporateCustomer", id, `Corporate customer updated: ${corporateCustomers[idx].name}`);
        return corporateCustomers[idx];
      }
      return null;
    },
    delete: (id: number) => {
      corporateCustomers = corporateCustomers.filter((c) => c.id !== id);
      saveItem("sgf_corporateCustomers", corporateCustomers);
      // Also remove from main customers list
      customers = customers.filter((c) => !(c.id == id && c.isCorporate));
      saveItem("sgf_customers", customers);
      logAudit("DELETE", "corporateCustomer", id, `Corporate customer deleted`);
      return { success: true };
    },
  },

  purchaseOrder: {
    list: () => purchaseOrders,
    listByCompany: (company: string) => purchaseOrders.filter((po) => po.company === company || (!po.company && company === "sgf")),
    getById: (id: number) => purchaseOrders.find((po) => po.id == id) || null,
    create: (data: any) => {
      // CUSTOMER CHECK: validate corporate customer status, credit limit, and COD overdue rules
      const check = checkCorporateCustomerCanOrder(
        data.corporateCustomerId,
        data.superAdminOverride === true
      );
      if (check.blocked) {
        throw new Error(check.reason);
      }

      // Auto-inherit company from linked corporate customer if not explicitly set
      let company = data.company;
