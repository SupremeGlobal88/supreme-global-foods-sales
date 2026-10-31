// =============================================================================
// ROUTE / DELIVERY SERVICE
// =============================================================================

export const routeService = {
  getRoutes: () => {
    try {
      const raw = getStorageItem("sgf_routes");
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return [];
  },
  createRoute: (data: any) => {
    const routes = routeService.getRoutes();
    const newRoute = {
      id: Date.now() + Math.random(),
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    routes.push(newRoute);
    setStorageItem("sgf_routes", JSON.stringify(routes));
    logAudit("create", "route", newRoute.id, data);
    return newRoute;
  },
  updateRoute: (id: number, data: any) => {
    const routes = routeService.getRoutes();
    const index = routes.findIndex((r: any) => r.id === id);
    if (index === -1) return null;
    routes[index] = { ...routes[index], ...data, updatedAt: new Date().toISOString() };
    setStorageItem("sgf_routes", JSON.stringify(routes));
    logAudit("update", "route", id, data);
    return routes[index];
  },
  deleteRoute: (id: number) => {
    const routes = routeService.getRoutes();
    const index = routes.findIndex((r: any) => r.id === id);
    if (index === -1) return { success: false, error: "Route not found" };
    routes.splice(index, 1);
    setStorageItem("sgf_routes", JSON.stringify(routes));
    logAudit("delete", "route", id, {});
    return { success: true };
  },
  getCustomerRoute: (customerId: number) => {
    const routes = routeService.getRoutes();
    return routes.find((r: any) => r.customerIds?.includes(customerId));
  },
  getRouteCustomers: (routeId: number) => {
    const routes = routeService.getRoutes();
    const route = routes.find((r: any) => r.id === routeId);
    if (!route) return [];
    return customers.filter((c) => route.customerIds?.includes(c.id));
  },
};

// =============================================================================
// DELIVERY NOTE SERVICE
// =============================================================================

export const deliveryNoteService = {
  list: () => {
    try {
      const raw = getStorageItem("sgf_deliveryNotes");
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return [];
  },
  getById: (id: number) => {
    const notes = deliveryNoteService.list();
    return notes.find((n: any) => n.id === id);
  },
  getByOrder: (orderId: number) => {
    const notes = deliveryNoteService.list();
    return notes.filter((n: any) => n.orderId === orderId);
  },
  create: (data: any) => {
    const notes = deliveryNoteService.list();
    const newNote = {
      id: Date.now() + Math.random(),
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    notes.push(newNote);
    setStorageItem("sgf_deliveryNotes", JSON.stringify(notes));
    logAudit("create", "deliveryNote", newNote.id, data);
    return newNote;
  },
  update: (id: number, data: any) => {
    const notes = deliveryNoteService.list();
    const index = notes.findIndex((n: any) => n.id === id);
    if (index === -1) return null;
    notes[index] = { ...notes[index], ...data, updatedAt: new Date().toISOString() };
    setStorageItem("sgf_deliveryNotes", JSON.stringify(notes));
    logAudit("update", "deliveryNote", id, data);
    return notes[index];
  },
  delete: (id: number) => {
    const notes = deliveryNoteService.list();
    const index = notes.findIndex((n: any) => n.id === id);
    if (index === -1) return { success: false, error: "Delivery note not found" };
    notes.splice(index, 1);
    setStorageItem("sgf_deliveryNotes", JSON.stringify(notes));
    logAudit("delete", "deliveryNote", id, {});
    return { success: true };
  },
};

// =============================================================================
// VEHICLE / TRANSPORT SERVICE
// =============================================================================

export const vehicleService = {
  list: () => {
    try {
      const raw = getStorageItem("sgf_vehicles");
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return [];
  },
  getById: (id: number) => {
    const vehicles = vehicleService.list();
    return vehicles.find((v: any) => v.id === id);
  },
  getByReg: (reg: string) => {
    const vehicles = vehicleService.list();
    return vehicles.find((v: any) => v.registration?.toLowerCase() === reg.toLowerCase());
  },
  create: (data: any) => {
    const vehicles = vehicleService.list();
    const newVehicle = {
      id: Date.now() + Math.random(),
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    vehicles.push(newVehicle);
    setStorageItem("sgf_vehicles", JSON.stringify(vehicles));
    logAudit("create", "vehicle", newVehicle.id, data);
    return newVehicle;
  },
  update: (id: number, data: any) => {
    const vehicles = vehicleService.list();
    const index = vehicles.findIndex((v: any) => v.id === id);
    if (index === -1) return null;
    vehicles[index] = { ...vehicles[index], ...data, updatedAt: new Date().toISOString() };
    setStorageItem("sgf_vehicles", JSON.stringify(vehicles));
    logAudit("update", "vehicle", id, data);
    return vehicles[index];
  },
  delete: (id: number) => {
    const vehicles = vehicleService.list();
    const index = vehicles.findIndex((v: any) => v.id === id);
    if (index === -1) return { success: false, error: "Vehicle not found" };
    vehicles.splice(index, 1);
    setStorageItem("sgf_vehicles", JSON.stringify(vehicles));
    logAudit("delete", "vehicle", id, {});
    return { success: true };
  },
};

// =============================================================================
// DRIVER / TRANSPORTER SERVICE
// =============================================================================

export const driverService = {
  list: () => {
    try {
      const raw = getStorageItem("sgf_drivers");
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return [];
  },
  getById: (id: number) => {
    const drivers = driverService.list();
    return drivers.find((d: any) => d.id === id);
  },
  create: (data: any) => {
    const drivers = driverService.list();
    const newDriver = {
      id: Date.now() + Math.random(),
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    drivers.push(newDriver);
    setStorageItem("sgf_drivers", JSON.stringify(drivers));
    logAudit("create", "driver", newDriver.id, data);
    return newDriver;
  },
  update: (id: number, data: any) => {
    const drivers = driverService.list();
    const index = drivers.findIndex((d: any) => d.id === id);
    if (index === -1) return null;
    drivers[index] = { ...drivers[index], ...data, updatedAt: new Date().toISOString() };
    setStorageItem("sgf_drivers", JSON.stringify(drivers));
    logAudit("update", "driver", id, data);
    return drivers[index];
  },
  delete: (id: number) => {
    const drivers = driverService.list();
    const index = drivers.findIndex((d: any) => d.id === id);
    if (index === -1) return { success: false, error: "Driver not found" };
    drivers.splice(index, 1);
    setStorageItem("sgf_drivers", JSON.stringify(drivers));
    logAudit("delete", "driver", id, {});
    return { success: true };
  },
};

// =============================================================================
// WAREHOUSE / LOCATION SERVICE
// =============================================================================

export const warehouseService = {
  list: () => {
    try {
      const raw = getStorageItem("sgf_warehouses");
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return [];
  },
  getById: (id: number) => {
    const warehouses = warehouseService.list();
    return warehouses.find((w: any) => w.id === id);
  },
  create: (data: any) => {
    const warehouses = warehouseService.list();
    const newWarehouse = {
      id: Date.now() + Math.random(),
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    warehouses.push(newWarehouse);
    setStorageItem("sgf_warehouses", JSON.stringify(warehouses));
    logAudit("create", "warehouse", newWarehouse.id, data);
    return newWarehouse;
  },
  update: (id: number, data: any) => {
    const warehouses = warehouseService.list();
    const index = warehouses.findIndex((w: any) => w.id === id);
    if (index === -1) return null;
    warehouses[index] = { ...warehouses[index], ...data, updatedAt: new Date().toISOString() };
    setStorageItem("sgf_warehouses", JSON.stringify(warehouses));
    logAudit("update", "warehouse", id, data);
    return warehouses[index];
  },
  delete: (id: number) => {
    const warehouses = warehouseService.list();
    const index = warehouses.findIndex((w: any) => w.id === id);
    if (index === -1) return { success: false, error: "Warehouse not found" };
    warehouses.splice(index, 1);
    setStorageItem("sgf_warehouses", JSON.stringify(warehouses));
    logAudit("delete", "warehouse", id, {});
    return { success: true };
  },
};
