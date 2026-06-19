import { z } from "zod";
import { createRouter, adminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { users, salesRepProfiles } from "@db/schema";
import { eq, desc } from "drizzle-orm";

export const salesRepRouter = createRouter({
  list: adminQuery.query(async () => {
    const db = getDb();
    const reps = await db.select().from(users).where(eq(users.role, "user")).orderBy(desc(users.createdAt));
    return reps;
  }),

  getById: adminQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const rep = await db.select().from(users).where(eq(users.id, input.id)).limit(1);
      if (rep.length === 0) return null;
      const profile = await db.select().from(salesRepProfiles).where(eq(salesRepProfiles.userId, input.id)).limit(1);
      return { ...rep[0], profile: profile[0] || null };
    }),

  create: adminQuery
    .input(z.object({
      name: z.string().min(1),
      email: z.string().email(),
      phone: z.string().optional(),
      region: z.string().optional(),
      vehicleReg: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.insert(users).values({
        unionId: `temp_${Date.now()}`,
        name: input.name,
        email: input.email,
        role: "user",
      });
      return { success: true, ...input };
    }),

  update: adminQuery
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      region: z.string().optional(),
      vehicleReg: z.string().optional(),
      isActive: z.enum(["active", "inactive"]).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, phone, region, vehicleReg, isActive, ...userData } = input;
      if (Object.keys(userData).length > 0) {
        await db.update(users).set(userData).where(eq(users.id, id));
      }
      if (phone !== undefined || region !== undefined || vehicleReg !== undefined || isActive !== undefined) {
        const profileData: Record<string, unknown> = {};
        if (phone !== undefined) profileData.phone = phone || null;
        if (region !== undefined) profileData.region = region || null;
        if (vehicleReg !== undefined) profileData.vehicleReg = vehicleReg || null;
        if (isActive !== undefined) profileData.isActive = isActive;
        const existing = await db.select().from(salesRepProfiles).where(eq(salesRepProfiles.userId, id)).limit(1);
        if (existing.length > 0) {
          await db.update(salesRepProfiles).set(profileData).where(eq(salesRepProfiles.userId, id));
        } else {
          await db.insert(salesRepProfiles).values({ userId: id, ...profileData });
        }
      }
      return { success: true };
    }),

  toggleActive: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const rep = await db.select().from(salesRepProfiles).where(eq(salesRepProfiles.userId, input.id)).limit(1);
      if (rep.length === 0) return { success: false };
      const newStatus = rep[0].isActive === "active" ? "inactive" : "active";
      await db.update(salesRepProfiles).set({ isActive: newStatus }).where(eq(salesRepProfiles.userId, input.id));
      return { success: true, isActive: newStatus };
    }),

  delete: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(salesRepProfiles).where(eq(salesRepProfiles.userId, input.id));
      await db.delete(users).where(eq(users.id, input.id));
      return { success: true };
    }),
});
