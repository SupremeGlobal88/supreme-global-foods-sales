import { z } from "zod";
import { createRouter, authedQuery, adminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { customers } from "@db/schema";
import { eq, like, or, desc } from "drizzle-orm";

export const customerRouter = createRouter({
  list: authedQuery.query(async () => {
    const db = getDb();
    return db.select().from(customers).orderBy(desc(customers.createdAt));
  }),

  search: authedQuery
    .input(z.object({ query: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      return db
        .select()
        .from(customers)
        .where(
          or(
            like(customers.name, `%${input.query}%`),
            like(customers.businessName, `%${input.query}%`),
            like(customers.customerCode, `%${input.query}%`),
            like(customers.phone, `%${input.query}%`),
            like(customers.city, `%${input.query}%`)
          )
        )
        .orderBy(desc(customers.createdAt));
    }),

  getById: authedQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const c = await db
        .select()
        .from(customers)
        .where(eq(customers.id, input.id))
        .limit(1);
      return c[0] || null;
    }),

  create: authedQuery
    .input(
      z.object({
        customerCode: z.string().min(1),
        name: z.string().min(1),
        businessName: z.string().optional(),
        contactPerson: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().email().optional(),
        physicalAddress: z.string().optional(),
        city: z.string().optional(),
        province: z.string().optional(),
        postalCode: z.string().optional(),
        paymentTerms: z.enum(["cod", "7_days", "14_days", "30_days"]).default("cod"),
        priceTier: z.enum(["corporate", "bulk", "wholesale", "retail"]).default("wholesale"),
        vatNumber: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      await db.insert(customers).values({
        ...input,
        createdBy: ctx.user.id,
      });
      return { success: true };
    }),

  update: authedQuery
    .input(
      z.object({
        id: z.number(),
        customerCode: z.string().optional(),
        name: z.string().optional(),
        businessName: z.string().optional(),
        contactPerson: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().email().optional(),
        physicalAddress: z.string().optional(),
        city: z.string().optional(),
        province: z.string().optional(),
        postalCode: z.string().optional(),
        paymentTerms: z.enum(["cod", "7_days", "14_days", "30_days"]).optional(),
        priceTier: z.enum(["corporate", "bulk", "wholesale", "retail"]).optional(),
        vatNumber: z.string().optional(),
        notes: z.string().optional(),
        isActive: z.enum(["active", "inactive"]).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...data } = input;
      await db.update(customers).set(data).where(eq(customers.id, id));
      const updated = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
      return updated[0];
    }),

  delete: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(customers).where(eq(customers.id, input.id));
      return { success: true };
    }),

  getStats: adminQuery.query(async () => {
    const db = getDb();
    const all = await db.select().from(customers);
    const total = all.length;
    const active = all.filter((c) => c.isActive === "active").length;
    const thisMonth = all.filter((c) => {
      const d = new Date(c.createdAt);
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
    return { total, active, inactive: total - active, thisMonth };
  }),
});