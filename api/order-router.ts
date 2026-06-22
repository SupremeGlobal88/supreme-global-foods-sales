import { z } from "zod";
import { createRouter, authedQuery, adminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { orders, orderItems, customers, users, stockItems, customerSpecialPrices } from "@db/schema";
import { eq, desc, and } from "drizzle-orm";

function getPriceByTier(item: typeof stockItems.$inferSelect, tier: string): number {
  switch (tier) {
    case "corporate": return Number(item.corporatePrice);
    case "bulk": return Number(item.bulkPrice);
    case "wholesale": return Number(item.wholesalePrice);
    case "retail": return Number(item.retailPrice);
    default: return Number(item.wholesalePrice);
  }
}

export const orderRouter = createRouter({
  list: authedQuery.query(async () => {
    const db = getDb();
    const allOrders = await db.select().from(orders).orderBy(desc(orders.createdAt));
    const result = [];
    for (const order of allOrders) {
      const customer = await db.select().from(customers).where(eq(customers.id, order.customerId)).limit(1);
      const rep = await db.select().from(users).where(eq(users.id, order.salesRepId)).limit(1);
      const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
      result.push({ ...order, customer: customer[0] || null, salesRep: rep[0] || null, items });
    }
    return result;
  }),

  getById: authedQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const order = await db.select().from(orders).where(eq(orders.id, input.id)).limit(1);
      if (order.length === 0) return null;
      const customer = await db.select().from(customers).where(eq(customers.id, order[0].customerId)).limit(1);
      const rep = await db.select().from(users).where(eq(users.id, order[0].salesRepId)).limit(1);
      const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order[0].id));
      return { ...order[0], customer: customer[0] || null, salesRep: rep[0] || null, items };
    }),

  create: authedQuery
    .input(z.object({
      customerId: z.number(),
      orderType: z.enum(["regular", "sample"]).optional(),
      paymentTerms: z.enum(["cod", "7_days", "14_days", "30_days"]),
      priceTier: z.enum(["corporate", "bulk", "wholesale", "retail"]).optional(),
      deliveryAddress: z.string().optional(),
      notes: z.string().optional(),
      items: z.array(z.object({
        stockItemId: z.number(),
        quantity: z.number().int().min(1),
        unitPrice: z.number().optional(),
      })),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
      const randomStr = Math.floor(1000 + Math.random() * 9000);
      const orderNumber = `ORD-${dateStr}-${randomStr}`;
      const tier = input.priceTier || "wholesale";

      let subtotal = 0;
      const orderItemsData = [];

      for (const item of input.items) {
        const stock = await db.select().from(stockItems).where(eq(stockItems.id, item.stockItemId)).limit(1);
        if (stock.length === 0) throw new Error(`Stock item ${item.stockItemId} not found`);
        const stockItem = stock[0];

        // Determine price: custom > special price > tier price
        let unitPrice: number;
        if (item.unitPrice && item.unitPrice > 0) {
          unitPrice = item.unitPrice; // Custom price entered by sales rep
        } else {
          // Check for customer special price first
          const specialPrice = await db
            .select()
            .from(customerSpecialPrices)
            .where(and(
              eq(customerSpecialPrices.customerId, input.customerId),
              eq(customerSpecialPrices.stockItemId, item.stockItemId)
            ))
            .limit(1);
          if (specialPrice.length > 0) {
            unitPrice = Number(specialPrice[0].specialPrice);
          } else {
            unitPrice = getPriceByTier(stockItem, tier);
          }
        }

        const lineTotal = unitPrice * item.quantity;
        subtotal += lineTotal;
        orderItemsData.push({
          orderId: 0,
          stockItemId: item.stockItemId,
          productCode: stockItem.productCode,
          productName: stockItem.productName,
          quantity: item.quantity,
          unitPrice: unitPrice.toFixed(2),
          lineTotal: lineTotal.toFixed(2),
        });
      }

      const vatRate = 0.15;
      const vatAmount = subtotal * vatRate;
      const total = subtotal + vatAmount;

      await db.insert(orders).values({
        orderNumber,
        customerId: input.customerId,
        salesRepId: ctx.user.id,
        status: "pending",
        paymentTerms: input.paymentTerms,
        priceTier: tier,
        subtotal: subtotal.toFixed(2),
        vatAmount: vatAmount.toFixed(2),
        total: total.toFixed(2),
        deliveryAddress: input.deliveryAddress || null,
        notes: input.notes || null,
      });

      const created = await db.select().from(orders).where(eq(orders.orderNumber, orderNumber)).limit(1);
      const orderId = created[0]?.id || 0;

      for (const item of orderItemsData) {
        await db.insert(orderItems).values({ ...item, orderId });
      }

      return { id: orderId, orderNumber, total: total.toFixed(2) };
    }),

  updateStatus: adminQuery
    .input(z.object({ id: z.number(), status: z.enum(["pending", "picking", "ready", "delivered", "cancelled"]) }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.update(orders).set({ status: input.status }).where(eq(orders.id, input.id));
      return { success: true };
    }),

  delete: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(orderItems).where(eq(orderItems.orderId, input.id));
      await db.delete(orders).where(eq(orders.id, input.id));
      return { success: true };
    }),

  getStats: adminQuery.query(async () => {
    const db = getDb();
    const allOrders = await db.select().from(orders);
    const total = allOrders.length;
    const pending = allOrders.filter((o) => o.status === "pending").length;
    const picking = allOrders.filter((o) => o.status === "picking").length;
    const ready = allOrders.filter((o) => o.status === "ready").length;
    const delivered = allOrders.filter((o) => o.status === "delivered").length;
    const totalValue = allOrders.reduce((sum, o) => sum + Number(o.total), 0);
    return { total, pending, picking, ready, delivered, totalValue };
  }),
});
