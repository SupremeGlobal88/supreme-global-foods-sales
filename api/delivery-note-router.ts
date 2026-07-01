import { z } from "zod";
import { createRouter, authedQuery, adminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { deliveryNotes, deliveryNoteItems, customers, invoices } from "@db/schema";
import { eq, desc } from "drizzle-orm";

export const deliveryNoteRouter = createRouter({
  list: authedQuery.query(async () => {
    const db = getDb();
    const allDNs = await db.select().from(deliveryNotes).orderBy(desc(deliveryNotes.createdAt));
    const result = [];
    for (const dn of allDNs) {
      const customer = await db.select().from(customers).where(eq(customers.id, dn.customerId)).limit(1);
      const items = await db.select().from(deliveryNoteItems).where(eq(deliveryNoteItems.deliveryNoteId, dn.id));
      result.push({ ...dn, customer: customer[0] || null, items });
    }
    return result;
  }),

  getById: authedQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const dn = await db.select().from(deliveryNotes).where(eq(deliveryNotes.id, input.id)).limit(1);
      if (dn.length === 0) return null;
      const customer = await db.select().from(customers).where(eq(customers.id, dn[0].customerId)).limit(1);
      const items = await db.select().from(deliveryNoteItems).where(eq(deliveryNoteItems.deliveryNoteId, dn[0].id));
      const inv = dn[0].invoiceId ? await db.select().from(invoices).where(eq(invoices.id, dn[0].invoiceId)).limit(1) : [];
      return { ...dn[0], customer: customer[0] || null, items, invoice: inv[0] || null };
    }),

  getByOrderId: authedQuery
    .input(z.object({ orderId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const dn = await db.select().from(deliveryNotes).where(eq(deliveryNotes.orderId, input.orderId)).limit(1);
      if (dn.length === 0) return null;
      const customer = await db.select().from(customers).where(eq(customers.id, dn[0].customerId)).limit(1);
      const items = await db.select().from(deliveryNoteItems).where(eq(deliveryNoteItems.deliveryNoteId, dn[0].id));
      return { ...dn[0], customer: customer[0] || null, items };
    }),

  // Create delivery note from order (called by order create)
  create: adminQuery
    .input(z.object({
      orderId: z.number(),
      customerId: z.number(),
      invoiceId: z.number().optional(),
      items: z.array(z.object({
        stockItemId: z.number(),
        productCode: z.string(),
        productName: z.string(),
        quantity: z.number(),
      })),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
      const randomStr = Math.floor(1000 + Math.random() * 9000);
      const deliveryNoteNumber = `DN-${dateStr}-${randomStr}`;

      await db.insert(deliveryNotes).values({
        deliveryNoteNumber,
        orderId: input.orderId,
        invoiceId: input.invoiceId || null,
        customerId: input.customerId,
        status: "draft",
      });

      const created = await db.select().from(deliveryNotes).where(eq(deliveryNotes.deliveryNoteNumber, deliveryNoteNumber)).limit(1);
      const dnId = created[0]?.id || 0;

      for (const item of input.items) {
        await db.insert(deliveryNoteItems).values({
          deliveryNoteId: dnId,
          stockItemId: item.stockItemId,
          productCode: item.productCode,
          productName: item.productName,
          quantity: item.quantity,
        });
      }

      return { success: true, deliveryNoteId: dnId, deliveryNoteNumber };
    }),

  // Update items when order is edited
  updateItems: adminQuery
    .input(z.object({
      orderId: z.number(),
      items: z.array(z.object({
        stockItemId: z.number(),
        productCode: z.string(),
        productName: z.string(),
        quantity: z.number(),
      })),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const dn = await db.select().from(deliveryNotes).where(eq(deliveryNotes.orderId, input.orderId)).limit(1);
      if (dn.length === 0) return { success: false, error: "Delivery note not found" };

      const dnId = dn[0].id;
      await db.delete(deliveryNoteItems).where(eq(deliveryNoteItems.deliveryNoteId, dnId));

      for (const item of input.items) {
        await db.insert(deliveryNoteItems).values({
          deliveryNoteId: dnId,
          stockItemId: item.stockItemId,
          productCode: item.productCode,
          productName: item.productName,
          quantity: item.quantity,
        });
      }

      return { success: true };
    }),

  updateStatus: adminQuery
    .input(z.object({ id: z.number(), status: z.enum(["draft", "picking", "ready", "in_transit", "delivered", "returned"]) }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.update(deliveryNotes).set({ status: input.status }).where(eq(deliveryNotes.id, input.id));

      // If status is "in_transit", also update linked invoice to "sent"
      if (input.status === "in_transit") {
        const dn = await db.select().from(deliveryNotes).where(eq(deliveryNotes.id, input.id)).limit(1);
        if (dn.length > 0 && dn[0].invoiceId) {
          await db.update(invoices).set({ status: "sent" }).where(eq(invoices.id, dn[0].invoiceId));
        }
      }

      return { success: true };
    }),

  // Assign driver and vehicle
  assignDriver: adminQuery
    .input(z.object({
      id: z.number(),
      driverName: z.string(),
      vehicleReg: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.update(deliveryNotes).set({
        driverName: input.driverName,
        vehicleReg: input.vehicleReg,
        status: "in_transit",
        deliveryDate: new Date(),
      }).where(eq(deliveryNotes.id, input.id));

      // Also mark invoice as sent
      const dn = await db.select().from(deliveryNotes).where(eq(deliveryNotes.id, input.id)).limit(1);
      if (dn.length > 0 && dn[0].invoiceId) {
        await db.update(invoices).set({ status: "sent" }).where(eq(invoices.id, dn[0].invoiceId));
      }

      return { success: true };
    }),

  // Record customer signature on delivery
  recordSignature: adminQuery
    .input(z.object({
      id: z.number(),
      signature: z.string(), // base64 image or text
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.update(deliveryNotes).set({
        status: "delivered",
        customerSignedAt: new Date(),
        customerSignature: input.signature,
        notes: input.notes || null,
      }).where(eq(deliveryNotes.id, input.id));
      return { success: true };
    }),

  // Record damaged/missing goods
  recordDiscrepancy: adminQuery
    .input(z.object({
      itemId: z.number(),
      quantityDamaged: z.number().min(0).default(0),
      quantityMissing: z.number().min(0).default(0),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.update(deliveryNoteItems).set({
        quantityDamaged: input.quantityDamaged,
        quantityMissing: input.quantityMissing,
      }).where(eq(deliveryNoteItems.id, input.itemId));
      return { success: true };
    }),

  getStats: adminQuery.query(async () => {
    const db = getDb();
    const all = await db.select().from(deliveryNotes);
    const total = all.length;
    const draft = all.filter((d) => d.status === "draft").length;
    const ready = all.filter((d) => d.status === "ready").length;
    const inTransit = all.filter((d) => d.status === "in_transit").length;
    const delivered = all.filter((d) => d.status === "delivered").length;
    const returned = all.filter((d) => d.status === "returned").length;
    return { total, draft, ready, inTransit, delivered, returned };
  }),
});
