import { z } from "zod";
import { createRouter, authedQuery, adminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { stockItems } from "@db/schema";
import { eq, like, or, desc } from "drizzle-orm";

export const stockRouter = createRouter({
  list: authedQuery.query(async () => {
    const db = getDb();
    return db.select().from(stockItems).orderBy(desc(stockItems.updatedAt));
  }),

  search: authedQuery
    .input(z.object({ query: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      return db.select().from(stockItems).where(
        or(
          like(stockItems.productCode, `%${input.query}%`),
          like(stockItems.productName, `%${input.query}%`),
          like(stockItems.category, `%${input.query}%`),
          like(stockItems.color, `%${input.query}%`),
          like(stockItems.species, `%${input.query}%`),
          like(stockItems.size, `%${input.query}%`),
        )
      ).orderBy(desc(stockItems.updatedAt));
    }),

  getById: authedQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const item = await db.select().from(stockItems).where(eq(stockItems.id, input.id)).limit(1);
      return item[0] || null;
    }),

  create: adminQuery
    .input(z.object({
      productCode: z.string().min(1),
      productName: z.string().min(1),
      category: z.string().min(1),
      strands: z.string().optional(),
      size: z.string().optional(),
      grade: z.string().optional(),
      color: z.string().optional(),
      species: z.string().optional(),
      origin: z.string().optional(),
      quantity: z.number().int().min(0),
      corporatePrice: z.number().min(0),
      bulkPrice: z.number().min(0),
      wholesalePrice: z.number().min(0),
      retailPrice: z.number().min(0),
      description: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const status = input.quantity === 0 ? "out_of_stock" : input.quantity < 20 ? "low_stock" : "in_stock";
      await db.insert(stockItems).values({
        ...input,
        corporatePrice: input.corporatePrice.toFixed(2),
        bulkPrice: input.bulkPrice.toFixed(2),
        wholesalePrice: input.wholesalePrice.toFixed(2),
        retailPrice: input.retailPrice.toFixed(2),
        status: status as "in_stock" | "low_stock" | "out_of_stock",
        uploadedBy: ctx.user.id,
      });
      return { success: true };
    }),

  update: adminQuery
    .input(z.object({
      id: z.number(),
      productCode: z.string().optional(),
      productName: z.string().optional(),
      category: z.string().optional(),
      strands: z.string().optional(),
      size: z.string().optional(),
      grade: z.string().optional(),
      color: z.string().optional(),
      species: z.string().optional(),
      origin: z.string().optional(),
      quantity: z.number().int().min(0).optional(),
      corporatePrice: z.number().min(0).optional(),
      bulkPrice: z.number().min(0).optional(),
      wholesalePrice: z.number().min(0).optional(),
      retailPrice: z.number().min(0).optional(),
      description: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...data } = input;
      const updateData: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(data)) {
        if (val !== undefined) {
          if (key === "quantity") {
            updateData[key] = val;
            updateData.status = val === 0 ? "out_of_stock" : (val as number) < 20 ? "low_stock" : "in_stock";
          } else if (["corporatePrice", "bulkPrice", "wholesalePrice", "retailPrice"].includes(key)) {
            updateData[key] = (val as number).toFixed(2);
          } else {
            updateData[key] = val;
          }
        }
      }
      await db.update(stockItems).set(updateData).where(eq(stockItems.id, id));
      const updated = await db.select().from(stockItems).where(eq(stockItems.id, id)).limit(1);
      return updated[0];
    }),

  bulkUpload: adminQuery
    .input(z.array(z.object({
      productCode: z.string().min(1),
      productName: z.string().min(1),
      category: z.string().min(1),
      strands: z.string().optional(),
      size: z.string().optional(),
      grade: z.string().optional(),
      color: z.string().optional(),
      species: z.string().optional(),
      origin: z.string().optional(),
      quantity: z.number().int().min(0),
      corporatePrice: z.number().min(0),
      bulkPrice: z.number().min(0),
      wholesalePrice: z.number().min(0),
      retailPrice: z.number().min(0),
      description: z.string().optional(),
    })))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const values = input.map((item) => {
        const status = item.quantity === 0 ? "out_of_stock" : item.quantity < 20 ? "low_stock" : "in_stock";
        return {
          ...item,
          corporatePrice: item.corporatePrice.toFixed(2),
          bulkPrice: item.bulkPrice.toFixed(2),
          wholesalePrice: item.wholesalePrice.toFixed(2),
          retailPrice: item.retailPrice.toFixed(2),
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
    const results = await db.selectDistinct({ category: stockItems.category }).from(stockItems);
    return results.map((r) => r.category);
  }),

  getStats: adminQuery.query(async () => {
    const db = getDb();
    const allItems = await db.select().from(stockItems);
    const totalProducts = allItems.length;
    const totalRetailValue = allItems.reduce((sum, item) => sum + Number(item.retailPrice) * item.quantity, 0);
    const lowStock = allItems.filter((i) => i.status === "low_stock").length;
    const outOfStock = allItems.filter((i) => i.status === "out_of_stock").length;
    return { totalProducts, totalRetailValue, lowStock, outOfStock };
  }),
});
