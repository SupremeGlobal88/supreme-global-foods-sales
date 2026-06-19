import { z } from "zod";
import { createRouter, authedQuery, adminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { invoices, invoicePayments, customers } from "@db/schema";
import { eq, desc, gte } from "drizzle-orm";

function calculateDueDate(invoiceDate: Date, terms: string): Date {
  const due = new Date(invoiceDate);
  switch (terms) {
    case "cod": return due;
    case "7_days": due.setDate(due.getDate() + 7); return due;
    case "14_days": due.setDate(due.getDate() + 14); return due;
    case "30_days": due.setDate(due.getDate() + 30); return due;
    default: return due;
  }
}

export const invoiceRouter = createRouter({
  list: authedQuery.query(async () => {
    const db = getDb();
    const allInvoices = await db.select().from(invoices).orderBy(desc(invoices.createdAt));
    const result = [];
    for (const inv of allInvoices) {
      const customer = await db.select().from(customers).where(eq(customers.id, inv.customerId)).limit(1);
      const payments = await db.select().from(invoicePayments).where(eq(invoicePayments.invoiceId, inv.id));
      result.push({ ...inv, customer: customer[0] || null, payments });
    }
    return result;
  }),

  getById: authedQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const inv = await db.select().from(invoices).where(eq(invoices.id, input.id)).limit(1);
      if (inv.length === 0) return null;
      const customer = await db.select().from(customers).where(eq(customers.id, inv[0].customerId)).limit(1);
      const payments = await db.select().from(invoicePayments).where(eq(invoicePayments.invoiceId, inv[0].id));
      return { ...inv[0], customer: customer[0] || null, payments };
    }),

  create: adminQuery
    .input(
      z.object({
        orderId: z.number().optional(),
        customerId: z.number(),
        paymentTerms: z.enum(["cod", "7_days", "14_days", "30_days"]),
        subtotal: z.number(),
        vatAmount: z.number(),
        total: z.number(),
        invoiceDate: z.string(),
        notes: z.string().optional(),
        items: z.array(z.object({ description: z.string(), quantity: z.number(), unitPrice: z.number(), lineTotal: z.number() })),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const dateStr = input.invoiceDate.replace(/-/g, "");
      const randomStr = Math.floor(1000 + Math.random() * 9000);
      const invoiceNumber = `INV-${dateStr}-${randomStr}`;
      const deliveryNoteNumber = `DN-${dateStr}-${randomStr}`;
      const invoiceDate = new Date(input.invoiceDate);
      const dueDate = calculateDueDate(invoiceDate, input.paymentTerms);

      await db.insert(invoices).values({
        orderId: input.orderId || null,
        customerId: input.customerId,
        invoiceNumber,
        deliveryNoteNumber,
        status: "draft",
        paymentTerms: input.paymentTerms,
        subtotal: input.subtotal.toFixed(2),
        vatAmount: input.vatAmount.toFixed(2),
        total: input.total.toFixed(2),
        amountPaid: "0.00",
        balanceDue: input.total.toFixed(2),
        dueDate,
        invoiceDate,
        notes: input.notes || null,
        createdBy: ctx.user.id,
      });
      return { invoiceNumber, deliveryNoteNumber };
    }),

  updateStatus: adminQuery
    .input(z.object({ id: z.number(), status: z.enum(["draft", "sent", "paid", "overdue", "partially_paid", "cancelled"]) }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.update(invoices).set({ status: input.status }).where(eq(invoices.id, input.id));
      return { success: true };
    }),

  recordPayment: adminQuery
    .input(z.object({
      invoiceId: z.number(),
      amount: z.number().min(0),
      paymentMethod: z.enum(["cash", "eft", "card", "cheque"]),
      paymentDate: z.string(),
      referenceNumber: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      await db.insert(invoicePayments).values({
        invoiceId: input.invoiceId,
        amount: input.amount.toFixed(2),
        paymentMethod: input.paymentMethod,
        paymentDate: new Date(input.paymentDate),
        referenceNumber: input.referenceNumber || null,
        notes: input.notes || null,
        createdBy: ctx.user.id,
      });

      const inv = await db.select().from(invoices).where(eq(invoices.id, input.invoiceId)).limit(1);
      if (inv.length === 0) throw new Error("Invoice not found");

      const currentPaid = Number(inv[0].amountPaid) + input.amount;
      const balance = Number(inv[0].total) - currentPaid;
      let newStatus: "draft" | "sent" | "paid" | "overdue" | "partially_paid" | "cancelled" = "partially_paid";
      if (balance <= 0) newStatus = "paid";
      else if (currentPaid === 0) newStatus = inv[0].status === "overdue" ? "overdue" : "sent";

      await db.update(invoices).set({
        amountPaid: currentPaid.toFixed(2),
        balanceDue: Math.max(0, balance).toFixed(2),
        status: newStatus,
      }).where(eq(invoices.id, input.invoiceId));

      return { success: true, newStatus, balanceDue: Math.max(0, balance) };
    }),

  getStats: adminQuery.query(async () => {
    const db = getDb();
    const all = await db.select().from(invoices);
    const total = all.length;
    const paid = all.filter((i) => i.status === "paid").length;
    const overdue = all.filter((i) => i.status === "overdue").length;
    const pending = all.filter((i) => i.status === "draft" || i.status === "sent").length;
    const totalValue = all.reduce((sum, i) => sum + Number(i.total), 0);
    const totalPaid = all.reduce((sum, i) => sum + Number(i.amountPaid), 0);
    const outstanding = totalValue - totalPaid;
    return { total, paid, overdue, pending, totalValue, totalPaid, outstanding };
  }),

  getCustomerStatement: adminQuery
    .input(z.object({ customerId: z.number(), fromDate: z.string(), toDate: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const customer = await db.select().from(customers).where(eq(customers.id, input.customerId)).limit(1);
      const allInvoices = await db.select().from(invoices).where(eq(invoices.customerId, input.customerId)).orderBy(invoices.invoiceDate);
      const allPayments = await db.select().from(invoicePayments).where(gte(invoicePayments.paymentDate, new Date(input.fromDate))).orderBy(invoicePayments.paymentDate);

      const lines: Array<{ date: Date; description: string; debit: number; credit: number; balance: number }> = [];
      let balance = 0;

      const prePeriodInvoices = allInvoices.filter((i) => i.invoiceDate && new Date(i.invoiceDate) < new Date(input.fromDate));
      const prePeriodPayments = allPayments.filter((p) => p.paymentDate && new Date(p.paymentDate) < new Date(input.fromDate));
      const openingDebit = prePeriodInvoices.reduce((s, i) => s + Number(i.total), 0);
      const openingCredit = prePeriodPayments.reduce((s, p) => s + Number(p.amount), 0);
      balance = openingDebit - openingCredit;

      const periodInvoices = allInvoices.filter((i) => i.invoiceDate && new Date(i.invoiceDate) >= new Date(input.fromDate) && new Date(i.invoiceDate) <= new Date(input.toDate));
      for (const inv of periodInvoices) {
        const amt = Number(inv.total);
        balance += amt;
        lines.push({ date: new Date(inv.invoiceDate!), description: `Invoice ${inv.invoiceNumber}`, debit: amt, credit: 0, balance });
      }

      const periodPayments = allPayments.filter((p) => p.paymentDate && new Date(p.paymentDate) >= new Date(input.fromDate) && new Date(p.paymentDate) <= new Date(input.toDate));
      for (const payment of periodPayments) {
        const amt = Number(payment.amount);
        balance -= amt;
        lines.push({ date: new Date(payment.paymentDate!), description: `Payment - ${payment.paymentMethod}${payment.referenceNumber ? ` (${payment.referenceNumber})` : ""}`, debit: 0, credit: amt, balance });
      }

      return { customer: customer[0] || null, fromDate: input.fromDate, toDate: input.toDate, openingBalance: openingDebit - openingCredit, lines, closingBalance: balance };
    }),
});
