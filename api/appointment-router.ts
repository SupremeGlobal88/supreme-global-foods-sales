import { z } from "zod";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { appointments } from "@db/schema";
import { eq, desc, and, gte } from "drizzle-orm";

export const appointmentRouter = createRouter({
  list: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const userId = ctx.user.id;
    return ctx.user.role === "admin"
      ? await db.select().from(appointments).orderBy(desc(appointments.appointmentDate))
      : await db.select().from(appointments).where(eq(appointments.salesRepId, userId)).orderBy(desc(appointments.appointmentDate));
  }),

  listByDate: authedQuery
    .input(z.object({ date: z.string() }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const userId = ctx.user.id;
      const cond = ctx.user.role === "admin"
        ? eq(appointments.appointmentDate, new Date(input.date))
        : and(eq(appointments.salesRepId, userId), eq(appointments.appointmentDate, new Date(input.date)));
      return db.select().from(appointments).where(cond).orderBy(appointments.startTime);
    }),

  getById: authedQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const appt = await db.select().from(appointments).where(eq(appointments.id, input.id)).limit(1);
      return appt[0] || null;
    }),

  create: authedQuery
    .input(z.object({
      customerId: z.number().optional(),
      customerName: z.string().optional(),
      title: z.string().min(1),
      description: z.string().optional(),
      appointmentDate: z.string(),
      startTime: z.string(),
      endTime: z.string().optional(),
      location: z.string().optional(),
      latitude: z.number().optional(),
      longitude: z.number().optional(),
      reminder: z.enum(["none", "15_min", "30_min", "1_hour"]).optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      await db.insert(appointments).values({
        salesRepId: ctx.user.id,
        customerId: input.customerId || null,
        customerName: input.customerName || null,
        title: input.title,
        description: input.description || null,
        appointmentDate: new Date(input.appointmentDate),
        startTime: input.startTime,
        endTime: input.endTime || null,
        location: input.location || null,
        latitude: input.latitude ? input.latitude.toString() : null,
        longitude: input.longitude ? input.longitude.toString() : null,
        reminder: input.reminder || "none",
        notes: input.notes || null,
      });
      return { success: true };
    }),

  update: authedQuery
    .input(z.object({
      id: z.number(),
      customerId: z.number().optional(),
      customerName: z.string().optional(),
      title: z.string().optional(),
      description: z.string().optional(),
      appointmentDate: z.string().optional(),
      startTime: z.string().optional(),
      endTime: z.string().optional(),
      location: z.string().optional(),
      latitude: z.number().optional(),
      longitude: z.number().optional(),
      status: z.enum(["scheduled", "in_progress", "completed", "cancelled"]).optional(),
      reminder: z.enum(["none", "15_min", "30_min", "1_hour"]).optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...data } = input;
      const updateData: Record<string, unknown> = {};
      if (data.customerId !== undefined) updateData.customerId = data.customerId;
      if (data.customerName !== undefined) updateData.customerName = data.customerName;
      if (data.title !== undefined) updateData.title = data.title;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.appointmentDate !== undefined) updateData.appointmentDate = new Date(data.appointmentDate);
      if (data.startTime !== undefined) updateData.startTime = data.startTime;
      if (data.endTime !== undefined) updateData.endTime = data.endTime || null;
      if (data.location !== undefined) updateData.location = data.location;
      if (data.latitude !== undefined) updateData.latitude = data.latitude ? data.latitude.toString() : null;
      if (data.longitude !== undefined) updateData.longitude = data.longitude ? data.longitude.toString() : null;
      if (data.status !== undefined) updateData.status = data.status;
      if (data.reminder !== undefined) updateData.reminder = data.reminder;
      if (data.notes !== undefined) updateData.notes = data.notes;
      await db.update(appointments).set(updateData).where(eq(appointments.id, id));
      const updated = await db.select().from(appointments).where(eq(appointments.id, id)).limit(1);
      return updated[0];
    }),

  delete: authedQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(appointments).where(eq(appointments.id, input.id));
      return { success: true };
    }),

  getToday: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const userId = ctx.user.id;
    const cond = ctx.user.role === "admin"
      ? gte(appointments.appointmentDate, today)
      : and(eq(appointments.salesRepId, userId), gte(appointments.appointmentDate, today));
    return db.select().from(appointments).where(cond).orderBy(appointments.appointmentDate, appointments.startTime).limit(10);
  }),
});
