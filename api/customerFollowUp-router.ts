import { z } from "zod";
import { createRouter, authedQuery, adminQuery } from "./middleware";

export const customerFollowUpRouter = createRouter({
  getPendingReminders: authedQuery
    .input(z.object({ salesRepName: z.string().optional(), isAdmin: z.boolean().optional() }).optional())
    .query(async () => []),
  completeFollowUp: authedQuery
    .input(z.object({
      id: z.number(),
      reason: z.string(),
      outcome: z.string(),
      notes: z.string().optional(),
      completedBy: z.string().optional(),
    }))
    .mutation(async () => ({ success: true })),
  snoozeReminder: authedQuery
    .input(z.object({ id: z.number(), snoozeDays: z.number() }))
    .mutation(async () => ({ success: true })),
  getAllFollowUps: adminQuery
    .input(z.object({ status: z.string().optional(), salesRep: z.string().optional() }).optional())
    .query(async () => []),
  getStats: authedQuery
    .input(z.object({ salesRepName: z.string().optional(), isAdmin: z.boolean().optional() }).optional())
    .query(async () => ({
      totalPending: 0,
      totalCompleted: 0,
      overdueCustomers: 0,
      followUpsToday: 0,
    })),
});
