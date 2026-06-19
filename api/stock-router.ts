import { z } from "zod";
import { createRouter, authedQuery, adminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { stockItems } from "@db/schema";
import { eq, like, or, desc } from "drizzle-orm";

export const stockRouter = createRouter({
  list: authedQuery.query(async () => {
    const db = getDb();
    const items = await db.select().from(stockItems).orderBy(desc(stockItems.updatedAt));
    return items;
  }),

  listByCategory: authedQuery
    .input(z.object({ category: z.string() }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      if (input?.category) {
        return db
          .select()
          .from(stockItems)
          .where(eq(stockItems.category, input.category))
          .orderBy(desc(stockItems.updatedAt));
      }
      return db.select().from(stockItems).orderBy(desc(stockItems.updatedAt));
    }),

  search: authedQuery
    .input(z.object({ query: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      return db
        .select()
        .from(stockItems)
        .where(
          or(
            like(stockItems.productCode, `%${input.query}%`),
            like(stockItems.productName, `%${input.query}%`),
            like(stockItems.category, `%${input.query}%`)
          )
        )
        .orderBy(desc(stockItems.updatedAt));
    }),

  getById: authedQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const item = await db
        .select()
        .from(stockItems)
        .where(eq(stockItems.id, input.id))
        .limit(1);
      return item[0] || null;
    }),

  create: adminQuery
    .input(
      z.object({
        productCode: z.string().min(1),
        productName: z.string().min(1),
        category: z.string().min(1),
        quantity: z.number().int().min(0),
        unitPrice: z.number().min(0),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const status =
        input.quantity === 0
          ? "out_of_stock"
          : input.quantity < 20
            ? "low_stock"
            : "in_stock";

      await db.insert(stockItems).values({
        productCode: input.productCode,
        productName: input.productName,
        category: input.category,
        quantity: input.quantity,
        unitPrice: input.unitPrice.toFixed(2),
        description: input.description || null,
        status: status as "in_stock" | "low_stock" | "out_of_stock",
        uploadedBy: ctx.user.id,
      });
      return { success: true };
    }),

  update: adminQuery
    .input(
      z.object({
        id: z.number(),
        productCode: z.string().optional(),
        productName: z.string().optional(),
        category: z.string().optional(),
        quantity: z.number().int().min(0).optional(),
        unitPrice: z.number().min(0).optional(),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...data } = input;

      const updateData: Record<string, unknown> = {};
      if (data.productCode !== undefined) updateData.productCode = data.productCode;
      if (data.productName !== undefined) updateData.productName = data.productName;
      if (data.category !== undefined) updateData.category = data.category;
      if (data.quantity !== undefined) {
        updateData.quantity = data.quantity;
        updateData.status = data.quantity === 0 ? "out_of_stock" : data.quantity < 20 ? "low_stock" : "in_stock";
      }
      if (data.unitPrice !== undefined) updateData.unitPrice = data.unitPrice.toFixed(2);
      if (data.description !== undefined) updateData.description = data.description || null;

      await db.update(stockItems).set(updateData).where(eq(stockItems.id, id));
      const updated = await db.select().from(stockItems).where(eq(stockItems.id, id)).limit(1);
      return updated[0];
    }),

  bulkUpload: adminQuery
    .input(
      z.array(
        z.object({
          productCode: z.string().min(1),
          productName: z.string().min(1),
          category: z.string().min(1),
          quantity: z.number().int().min(0),
          unitPrice: z.number().min(0),
          description: z.string().optional(),
        })
      )
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const values = input.map((item) => {
        const status = item.quantity === 0 ? "out_of_stock" : item.quantity < 20 ? "low_stock" : "in_stock";
        return {
          productCode: item.productCode,
          productName: item.productName,
          category: item.category,
          quantity: item.quantity,
          unitPrice: item.unitPrice.toFixed(2),
          description: item.description || null,
          status: status as "in_stock" | "low_stock" | "out_of_stock",
          uploadedBy: ctx.user.id,
        };
      });

      await db.insert(stockItems).values(values);
      return { count: input.length };
    }),

  delete: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(stockItems).where(eq(stockItems.id, input.id));
      return { success: true };
    }),

  getCategories: authedQuery.query(async () => {
    const db = getDb();
    const results = await db
      .selectDistinct({ category: stockItems.category })
      .from(stockItems);
    return results.map((r) => r.category);
  }),

  getStats: adminQuery.query(async () => {
    const db = getDb();
    const allItems = await db.select().from(stockItems);
    const totalProducts = allItems.length;
    const totalValue = allItems.reduce(
      (sum, item) => sum + Number(item.unitPrice) * item.quantity,
      0
    );
    const lowStock = allItems.filter((i) => i.status === "low_stock").length;
    const outOfStock = allItems.filter((i) => i.status === "out_of_stock").length;
    return { totalProducts, totalValue, lowStock, outOfStock };
  }),
});
