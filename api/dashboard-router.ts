import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { orders, invoices, stockItems, customers } from "@db/schema";
import { count } from "drizzle-orm";

export const dashboardRouter = createRouter({
  stats: authedQuery.query(async () => {
    const db = getDb();
    const [orderCount] = await db.select({ value: count() }).from(orders);
    const [invoiceCount] = await db.select({ value: count() }).from(invoices);
    const [stockCount] = await db.select({ value: count() }).from(stockItems);
    const [customerCount] = await db.select({ value: count() }).from(customers);
    return {
      totalOrders: orderCount?.value || 0,
      totalInvoices: invoiceCount?.value || 0,
      totalProducts: stockCount?.value || 0,
      totalCustomers: customerCount?.value || 0,
    };
  }),
});
