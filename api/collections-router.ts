import { z } from "zod";
import { createRouter, authedQuery, adminQuery } from "./middleware";

export const collectionsRouter = createRouter({
  getOverdueInvoices: adminQuery.query(async () => {
    return [];
  }),
  addNote: adminQuery
    .input(z.object({
      invoiceId: z.number(),
      customerId: z.number(),
      type: z.string(),
      notes: z.string(),
      contactMethod: z.string(),
      contactPerson: z.string().optional(),
      promisedAmount: z.number().optional(),
      followUpDate: z.string().optional(),
      createdBy: z.string().optional(),
    }))
    .mutation(async () => ({ success: true })),
  getNotesByCustomer: adminQuery
    .input(z.number())
    .query(async () => []),
  recordPromise: adminQuery
    .input(z.object({
      invoiceId: z.number(),
      customerId: z.number(),
      promiseDate: z.string(),
      promisedAmount: z.number(),
      notes: z.string().optional(),
      createdBy: z.string().optional(),
    }))
    .mutation(async () => ({ success: true })),
  updatePromiseStatus: adminQuery
    .input(z.object({ promiseId: z.number(), status: z.string() }))
    .mutation(async () => ({ success: true })),
  placeHold: adminQuery
    .input(z.object({ customerId: z.number(), reason: z.string(), createdBy: z.string().optional() }))
    .mutation(async () => ({ success: true })),
  releaseHold: adminQuery
    .input(z.object({ holdId: z.number(), createdBy: z.string().optional() }))
    .mutation(async () => ({ success: true })),
  getDailyReport: adminQuery.query(async () => ({
    generatedAt: new Date().toISOString(),
    today: new Date().toISOString().slice(0, 10),
    summary: { totalOutstanding: 0, totalInvoices: 0, onHold: 0, pendingPromises: 0, todayActivities: 0 },
    byBucket: {},
    todayActivities: [],
  })),
  getCustomerPaymentHistory: adminQuery
    .input(z.number())
    .query(async () => []),
  getStats: adminQuery.query(async () => ({
    totalOutstanding: 0, totalOverdueInvoices: 0, onHold: 0, pendingPromises: 0, totalNotes: 0, buckets: {},
  })),
});
