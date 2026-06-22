import { z } from "zod";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { checkIns } from "@db/schema";
import { eq, desc } from "drizzle-orm";

export const checkInRouter = createRouter({
  list: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const userId = ctx.user.id;
    return ctx.user.role === "admin"
      ? await db.select().from(checkIns).orderBy(desc(checkIns.checkInTime)).limit(100)
      : await db.select().from(checkIns).where(eq(checkIns.salesRepId, userId)).orderBy(desc(checkIns.checkInTime)).limit(50);
  }),

  create: authedQuery
    .input(z.object({
      customerId: z.number().optional(),
      customerName: z.string().optional(),
      latitude: z.number(),
      longitude: z.number(),
      accuracy: z.number().optional(),
      address: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      await db.insert(checkIns).values({
        salesRepId: ctx.user.id,
        customerId: input.customerId || null,
        customerName: input.customerName || null,
        latitude: input.latitude.toString(),
        longitude: input.longitude.toString(),
        accuracy: input.accuracy || null,
        address: input.address || null,
        notes: input.notes || null,
      });
      return { success: true };
    }),

  delete: authedQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(checkIns).where(eq(checkIns.id, input.id));
      return { success: true };
    }),

  getToday: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const userId = ctx.user.id;
    const allCheckIns = ctx.user.role === "admin"
      ? await db.select().from(checkIns).orderBy(desc(checkIns.checkInTime))
      : await db.select().from(checkIns).where(eq(checkIns.salesRepId, userId)).orderBy(desc(checkIns.checkInTime));
    return allCheckIns.filter((ci) => new Date(ci.checkInTime) >= today);
  }),

  getStats: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const allCheckIns = ctx.user.role === "admin"
      ? await db.select().from(checkIns)
      : await db.select().from(checkIns).where(eq(checkIns.salesRepId, ctx.user.id));
    const today = new Date().toDateString();
    return {
      total: allCheckIns.length,
      today: allCheckIns.filter((ci) => new Date(ci.checkInTime).toDateString() === today).length,
    };
  }),
});
