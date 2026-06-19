import { relations } from "drizzle-orm";
import {
  users,
  salesRepProfiles,
  customers,
  orders,
  orderItems,
  invoices,
  invoicePayments,
} from "./schema";

export const usersRelations = relations(users, ({ one }) => ({
  salesProfile: one(salesRepProfiles, {
    fields: [users.id],
    references: [salesRepProfiles.userId],
  }),
}));

export const salesRepProfilesRelations = relations(salesRepProfiles, ({ one }) => ({
  user: one(users, {
    fields: [salesRepProfiles.userId],
    references: [users.id],
  }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  customer: one(customers, {
    fields: [orders.customerId],
    references: [customers.id],
  }),
  items: many(orderItems),
  invoice: one(invoices, {
    fields: [orders.id],
    references: [invoices.orderId],
  }),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
}));

export const customersRelations = relations(customers, ({ many }) => ({
  orders: many(orders),
  invoices: many(invoices),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  customer: one(customers, {
    fields: [invoices.customerId],
    references: [customers.id],
  }),
  order: one(orders, {
    fields: [invoices.orderId],
    references: [orders.id],
  }),
  payments: many(invoicePayments),
}));

export const invoicePaymentsRelations = relations(invoicePayments, ({ one }) => ({
  invoice: one(invoices, {
    fields: [invoicePayments.invoiceId],
    references: [invoices.id],
  }),
}));
