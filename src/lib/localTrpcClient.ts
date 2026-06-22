import { localApi } from "./localApi";

localApi.init();

export async function localTrpcCall(path: string, input?: any): Promise<any> {
  const parts = path.split(".");
  const endpoint = parts.slice(1).join("."); // Remove "app." prefix

  switch (endpoint) {
    // ===== AUTH =====
    case "auth.me": {
      const demoStr = localStorage.getItem("demo_user");
      return demoStr ? JSON.parse(demoStr) : null;
    }

    // ===== STOCK =====
    case "stock.list":
      return localApi.stock.list();
    case "stock.getById":
      return localApi.stock.getById(input);
    case "stock.update":
      return localApi.stock.update(input.id, input.data);
    case "stock.getStats": {
      const items = localApi.stock.list();
      const totalProducts = items.length;
      const totalRetailValue = items.reduce((sum: number, item: any) => sum + Number(item.retailPrice || 0) * (item.quantity || 0), 0);
      const lowStock = items.filter((i: any) => i.status === "low_stock").length;
      return { totalProducts, totalRetailValue, lowStock };
    }

    // ===== CUSTOMERS =====
    case "customer.list":
      return localApi.customers.list();
    case "customer.getById":
      return localApi.customers.getById(input);
    case "customer.search":
      return localApi.customers.search(input || "");
    case "customer.create":
      return localApi.customers.create(input);
    case "customer.update":
      return localApi.customers.update(input.id, input.data);
    case "customer.delete":
      return localApi.customers.delete(input);
    case "customer.getStats": {
      const items = localApi.customers.list();
      const total = items.length;
      const active = items.filter((c: any) => c.isActive === "active").length;
      return { total, active, inactive: total - active, thisMonth: total };
    }

    // ===== ORDERS =====
    case "order.list":
      return localApi.orders.list();
    case "order.getById":
      return localApi.orders.getById(input);
    case "order.create":
      return localApi.orders.create(input);
    case "order.updateStatus":
      return localApi.orders.updateStatus(input.id, input.status);
    case "order.getStats": {
      const items = localApi.orders.list();
      const total = items.length;
      const pending = items.filter((o: any) => o.status === "pending").length;
      const picking = items.filter((o: any) => o.status === "picking").length;
      const ready = items.filter((o: any) => o.status === "ready").length;
      const delivered = items.filter((o: any) => o.status === "delivered").length;
      const totalValue = items.reduce((sum: number, o: any) => sum + Number(o.totalAmount || 0), 0);
      return { total, pending, picking, ready, delivered, totalValue };
    }

    // ===== INVOICES =====
    case "invoice.list":
      return localApi.invoices.list();
    case "invoice.getById":
      return localApi.invoices.list().find((i: any) => i.id === input) || null;
    case "invoice.create":
      return localApi.invoices.create(input);
    case "invoice.updateStatus":
      return localApi.invoices.updateStatus(input.id, input.status, input.amountPaid);
    case "invoice.getStats": {
      const items = localApi.invoices.list();
      const total = items.length;
      const paid = items.filter((i: any) => i.status === "paid").length;
      const overdue = items.filter((i: any) => i.status === "overdue").length;
      const totalValue = items.reduce((sum: number, i: any) => sum + Number(i.totalAmount || 0), 0);
      return { total, paid, overdue, totalValue };
    }

    // ===== APPOINTMENTS =====
    case "appointment.list":
      return localApi.appointments.list();
    case "appointment.create":
      return localApi.appointments.create(input);
    case "appointment.updateStatus":
      return localApi.appointments.updateStatus(input.id, input.status);

    // ===== CHECKINS =====
    case "checkin.list":
      return localApi.checkins.list();
    case "checkin.create":
      return localApi.checkins.create(input);

    // ===== SALES REPS =====
    case "salesRep.list":
      return [];
    case "salesRep.getStats":
      return { total: 0, active: 0, inactive: 0 };

    default:
      console.warn("[localTrpc] Unhandled endpoint:", endpoint, "input:", input);
      return null;
  }
}
