import {
  mysqlTable,
  mysqlEnum,
  serial,
  varchar,
  text,
  timestamp,
  int,
  decimal,
  bigint,
  date,
  time,
} from "drizzle-orm/mysql-core";

// ─── Users ──────────────────────────────────────────────
export const users = mysqlTable("users", {
  id: serial("id").primaryKey(),
  unionId: varchar("unionId", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 320 }),
  avatar: text("avatar"),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
  lastSignInAt: timestamp("lastSignInAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Sales Rep Profiles ─────────────────────────────────
export const salesRepProfiles = mysqlTable("sales_rep_profiles", {
  id: serial("id").primaryKey(),
  userId: bigint("userId", { mode: "number", unsigned: true }).notNull().unique(),
  phone: varchar("phone", { length: 50 }),
  region: varchar("region", { length: 100 }),
  vehicleReg: varchar("vehicleReg", { length: 50 }),
  isActive: mysqlEnum("isActive", ["active", "inactive"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

// ─── Stock Items (4-tier pricing) ───────────────────────
export const stockItems = mysqlTable("stock_items", {
  id: serial("id").primaryKey(),
  productCode: varchar("productCode", { length: 50 }).notNull(),
  productName: varchar("productName", { length: 255 }).notNull(),
  category: varchar("category", { length: 100 }).notNull(),
  strands: varchar("strands", { length: 50 }),
  size: varchar("size", { length: 20 }),
  grade: varchar("grade", { length: 10 }),
  color: varchar("color", { length: 50 }),
  species: varchar("species", { length: 20 }),
  origin: varchar("origin", { length: 20 }),
  quantity: int("quantity").notNull().default(0),
  corporatePrice: decimal("corporatePrice", { precision: 10, scale: 2 }).notNull(),
  bulkPrice: decimal("bulkPrice", { precision: 10, scale: 2 }).notNull(),
  wholesalePrice: decimal("wholesalePrice", { precision: 10, scale: 2 }).notNull(),
  retailPrice: decimal("retailPrice", { precision: 10, scale: 2 }).notNull(),
  description: text("description"),
  status: mysqlEnum("status", ["in_stock", "low_stock", "out_of_stock"]).default("in_stock").notNull(),
  uploadedBy: bigint("uploadedBy", { mode: "number", unsigned: true }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export type StockItem = typeof stockItems.$inferSelect;

// ─── Customers ──────────────────────────────────────────
export const customers = mysqlTable("customers", {
  id: serial("id").primaryKey(),
  customerCode: varchar("customerCode", { length: 50 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  businessName: varchar("businessName", { length: 255 }),
  contactPerson: varchar("contactPerson", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  email: varchar("email", { length: 320 }),
  physicalAddress: text("physicalAddress"),
  city: varchar("city", { length: 100 }),
  province: varchar("province", { length: 100 }),
  postalCode: varchar("postalCode", { length: 20 }),
  paymentTerms: mysqlEnum("paymentTerms", ["cod", "7_days", "14_days", "30_days"]).default("cod").notNull(),
  vatNumber: varchar("vatNumber", { length: 50 }),
  notes: text("notes"),
  isActive: mysqlEnum("isActive", ["active", "inactive"]).default("active").notNull(),
  createdBy: bigint("createdBy", { mode: "number", unsigned: true }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export type Customer = typeof customers.$inferSelect;

// ─── Orders ─────────────────────────────────────────────
export const orders = mysqlTable("orders", {
  id: serial("id").primaryKey(),
  orderNumber: varchar("orderNumber", { length: 50 }).notNull(),
  customerId: bigint("customerId", { mode: "number", unsigned: true }).notNull(),
  salesRepId: bigint("salesRepId", { mode: "number", unsigned: true }).notNull(),
  status: mysqlEnum("status", ["pending", "picking", "ready", "delivered", "cancelled"]).default("pending").notNull(),
  paymentTerms: mysqlEnum("paymentTerms", ["cod", "7_days", "14_days", "30_days"]).default("cod").notNull(),
  priceTier: mysqlEnum("priceTier", ["corporate", "bulk", "wholesale", "retail"]).default("wholesale").notNull(),
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }).notNull(),
  vatAmount: decimal("vatAmount", { precision: 12, scale: 2 }).notNull(),
  total: decimal("total", { precision: 12, scale: 2 }).notNull(),
  deliveryAddress: text("deliveryAddress"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export type Order = typeof orders.$inferSelect;

// ─── Order Items ────────────────────────────────────────
export const orderItems = mysqlTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: bigint("orderId", { mode: "number", unsigned: true }).notNull(),
  stockItemId: bigint("stockItemId", { mode: "number", unsigned: true }).notNull(),
  productCode: varchar("productCode", { length: 50 }).notNull(),
  productName: varchar("productName", { length: 255 }).notNull(),
  quantity: int("quantity").notNull(),
  unitPrice: decimal("unitPrice", { precision: 10, scale: 2 }).notNull(),
  lineTotal: decimal("lineTotal", { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type OrderItem = typeof orderItems.$inferSelect;

// ─── Invoices ───────────────────────────────────────────
export const invoices = mysqlTable("invoices", {
  id: serial("id").primaryKey(),
  invoiceNumber: varchar("invoiceNumber", { length: 50 }).notNull(),
  orderId: bigint("orderId", { mode: "number", unsigned: true }),
  customerId: bigint("customerId", { mode: "number", unsigned: true }).notNull(),
  status: mysqlEnum("status", ["draft", "sent", "paid", "overdue", "partially_paid", "cancelled"]).default("draft").notNull(),
  paymentTerms: mysqlEnum("paymentTerms", ["cod", "7_days", "14_days", "30_days"]).default("cod").notNull(),
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }).notNull(),
  vatAmount: decimal("vatAmount", { precision: 12, scale: 2 }).notNull(),
  total: decimal("total", { precision: 12, scale: 2 }).notNull(),
  amountPaid: decimal("amountPaid", { precision: 12, scale: 2 }).default("0.00").notNull(),
  balanceDue: decimal("balanceDue", { precision: 12, scale: 2 }).notNull(),
  dueDate: date("dueDate"),
  invoiceDate: date("invoiceDate").notNull(),
  deliveryNoteNumber: varchar("deliveryNoteNumber", { length: 50 }),
  notes: text("notes"),
  createdBy: bigint("createdBy", { mode: "number", unsigned: true }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export type Invoice = typeof invoices.$inferSelect;

// ─── Invoice Payments ───────────────────────────────────
export const invoicePayments = mysqlTable("invoice_payments", {
  id: serial("id").primaryKey(),
  invoiceId: bigint("invoiceId", { mode: "number", unsigned: true }).notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  paymentMethod: mysqlEnum("paymentMethod", ["cash", "eft", "card", "cheque"]).notNull(),
  paymentDate: date("paymentDate").notNull(),
  referenceNumber: varchar("referenceNumber", { length: 100 }),
  notes: text("notes"),
  createdBy: bigint("createdBy", { mode: "number", unsigned: true }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type InvoicePayment = typeof invoicePayments.$inferSelect;

// ─── Appointments ───────────────────────────────────────
export const appointments = mysqlTable("appointments", {
  id: serial("id").primaryKey(),
  salesRepId: bigint("salesRepId", { mode: "number", unsigned: true }).notNull(),
  customerId: bigint("customerId", { mode: "number", unsigned: true }),
  customerName: varchar("customerName", { length: 255 }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  appointmentDate: date("appointmentDate").notNull(),
  startTime: time("startTime").notNull(),
  endTime: time("endTime"),
  location: varchar("location", { length: 255 }),
  latitude: decimal("latitude", { precision: 10, scale: 8 }),
  longitude: decimal("longitude", { precision: 11, scale: 8 }),
  status: mysqlEnum("status", ["scheduled", "in_progress", "completed", "cancelled"]).default("scheduled").notNull(),
  reminder: mysqlEnum("reminder", ["none", "15_min", "30_min", "1_hour"]).default("none"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export type Appointment = typeof appointments.$inferSelect;

// ─── Check Ins ──────────────────────────────────────────
export const checkIns = mysqlTable("check_ins", {
  id: serial("id").primaryKey(),
  salesRepId: bigint("salesRepId", { mode: "number", unsigned: true }).notNull(),
  customerId: bigint("customerId", { mode: "number", unsigned: true }),
  customerName: varchar("customerName", { length: 255 }),
  checkInTime: timestamp("checkInTime").defaultNow().notNull(),
  latitude: decimal("latitude", { precision: 10, scale: 8 }).notNull(),
  longitude: decimal("longitude", { precision: 11, scale: 8 }).notNull(),
  accuracy: int("accuracy"),
  address: text("address"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CheckIn = typeof checkIns.$inferSelect;

// ─── Customer Special Prices ────────────────────────────
export const customerSpecialPrices = mysqlTable("customer_special_prices", {
  id: serial("id").primaryKey(),
  customerId: bigint("customerId", { mode: "number", unsigned: true }).notNull(),
  stockItemId: bigint("stockItemId", { mode: "number", unsigned: true }).notNull(),
  specialPrice: decimal("specialPrice", { precision: 10, scale: 2 }).notNull(),
  createdBy: bigint("createdBy", { mode: "number", unsigned: true }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export type CustomerSpecialPrice = typeof customerSpecialPrices.$inferSelect;
