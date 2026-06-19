import { z } from "zod";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { customerSpecialPrices, stockItems } from "@db/schema";
import { eq, and } from "drizzle-orm";

export const specialPriceRouter = createRouter({
  listByCustomer: authedQuery
    .input(z.object({ customerId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const prices = await db
        .select()
        .from(customerSpecialPrices)
        .where(eq(customerSpecialPrices.customerId, input.customerId));

      const result = [];
      for (const price of prices) {
        const stock = await db
          .select()
          .from(stockItems)
          .where(eq(stockItems.id, price.stockItemId))
          .limit(1);
        result.push({ ...price, stockItem: stock[0] || null });
      }
      return result;
    }),

  getByCustomerAndProduct: authedQuery
    .input(z.object({ customerId: z.number(), stockItemId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const price = await db
        .select()
        .from(customerSpecialPrices)
        .where(
          and(
            eq(customerSpecialPrices.customerId, input.customerId),
            eq(customerSpecialPrices.stockItemId, input.stockItemId)
          )
        )
        .limit(1);
      return price[0] || null;
    }),

  set: authedQuery
    .input(
      z.object({
        customerId: z.number(),
        stockItemId: z.number(),
        specialPrice: z.number().min(0),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const existing = await db
        .select()
        .from(customerSpecialPrices)
        .where(
          and(
            eq(customerSpecialPrices.customerId, input.customerId),
            eq(customerSpecialPrices.stockItemId, input.stockItemId)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(customerSpecialPrices)
          .set({ specialPrice: input.specialPrice.toFixed(2) })
          .where(eq(customerSpecialPrices.id, existing[0].id));
        return { id: existing[0].id, updated: true };
      } else {
        await db.insert(customerSpecialPrices).values({
          customerId: input.customerId,
          stockItemId: input.stockItemId,
          specialPrice: input.specialPrice.toFixed(2),
          createdBy: ctx.user.id,
        });
        return { updated: false };
      }
    }),

  delete: authedQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(customerSpecialPrices).where(eq(customerSpecialPrices.id, input.id));
      return { success: true };
    }),
});
