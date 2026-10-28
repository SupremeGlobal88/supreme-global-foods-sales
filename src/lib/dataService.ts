import { STATIC_CUSTOMERS, STATIC_PRODUCTS } from "@/data/staticData";
import { getStorageItem, setStorageItem, removeStorageItem } from "./compressedStorage";

// ═══════════════════════════════════════════════════════════════
//  SUPREME GLOBAL FOODS — UNIFIED DATA SERVICE (v2.1)
//  Single source of truth: localStorage + optional Firebase sync
// ═══════════════════════════════════════════════════════════════

// ─── Types ───

export interface User {
  id: number;
  name: string;
  email?: string;
  pin: string;
  role: "admin" | "sales_rep" | "driver" | "checker" | "viewer";
  isActive: boolean;
  createdAt: string;
  lastLogin?: string;
}

export interface Customer {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  vatNumber?: string;
  regNumber?: string;
  paymentTerms: string;
  creditLimit: number;
  currentBalance: number;
  salesRep?: string;
  priceTier?: string;
  tags?: string[];
  notes?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CorporateCustomer {
  id: number;
  companyName: string;
  tradingName?: string;
  regNumber?: string;
  vatNumber?: string;
  address?: string;
  deliveryAddress?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  paymentTerms: string;
  creditLimit: number;
  currentBalance: number;
  status: string;
  linkedCustomerId?: number;
  vatExempt: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: number;
  code: string;
  name: string;
  description?: string;
  category?: string;
  unit: string;
  price: number;
  costPrice?: number;
  vatRate: number;
  stockQuantity: number;
  minStockLevel: number;
  maxStockLevel: number;
  reorderPoint: number;
  reorderQuantity: number;
  barcode?: string;
  supplier?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OrderLineItem {
  id: number;
  productId: number;
  productName: string;
  productCode: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
  vatRate: number;
  notes?: string;
  deliveredQty?: number;
}

export interface Order {
  id: number;
  orderNumber: string;
  customerId: number;
  customerName: string;
  orderDate: string;
  deliveryDate?: string;
  status: string;
  paymentStatus: string;
  paymentTerms: string;
  subtotal: number;
  vatAmount: number;
  total: number;
  amountPaid: number;
  balanceDue: number;
  lineItems: OrderLineItem[];
  notes?: string;
  salesRep?: string;
  deliveryAddress?: string;
  contactPhone?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: number;
  sageInvoiceNumber?: string;
}

export interface InvoiceLineItem {
  id: number;
  productId: number;
  productName: string;
  productCode: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
  vatRate: number;
}

export interface Invoice {
  id: number;
  invoiceNumber: string;
  orderId?: number;
  orderNumber?: string;
  purchaseOrderId?: number;
  poNumber?: string;
  customerId: number;
  customerName: string;
  invoiceDate: string;
  dueDate: string;
  status: string;
  paymentStatus: string;
  subtotal: number;
  vatAmount: number;
  total: number;
  amountPaid: number;
  balanceDue: number;
  lineItems: InvoiceLineItem[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: number;
  sageInvoiceNumber?: string;
}

export interface Receipt {
  id: number;
  receiptNumber: string;
  invoiceId: number;
  invoiceNumber: string;
  customerId: number;
  customerName: string;
  amount: number;
  paymentMethod: string;
  paymentDate: string;
  reference?: string;
  notes?: string;
  createdAt: string;
  createdBy: number;
}

export interface CreditNote {
  id: number;
  creditNoteNumber: string;
  invoiceId: number;
  invoiceNumber: string;
  customerId: number;
  customerName: string;
  amount: number;
  reason: string;
  status: string;
  createdAt: string;
  createdBy: number;
}

export interface PurchaseOrder {
  id: number;
  poNumber: string;
  corporateCustomerId: number;
  customerName: string;
  orderDate: string;
  deliveryDate?: string;
  status: string;
  paymentStatus: string;
  paymentTerms: string;
  subtotal: number;
  vatAmount: number;
  total: number;
  lineItems: OrderLineItem[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: number;
}

export interface DeliveryNote {
  id: number;
  dnNumber: string;
  purchaseOrderId: number;
  poNumber: string;
  customerId: number;
  customerName: string;
  deliveryDate: string;
  status: string;
  lineItems: OrderLineItem[];
  createdAt: string;
  createdBy: number;
}

export interface StockItem {
  id: number;
  productId: number;
  productName: string;
  productCode: string;
  quantity: number;
  location?: string;
  batchNumber?: string;
  expiryDate?: string;
  movementType: string;
  reference?: string;
  notes?: string;
  createdAt: string;
  createdBy: number;
}

export interface SpecialPrice {
  id: number;
  customerId: number;
  productId: number;
  specialPrice: number;
  startDate?: string;
  endDate?: string;
  isActive: boolean;
  createdAt: string;
}

export interface CollectionNote {
  id: number;
  customerId: number;
  customerName: string;
  invoiceId?: number;
  invoiceNumber?: string;
  amount: number;
  note: string;
  followUpDate?: string;
  status: string;
  createdAt: string;
  createdBy: number;
}

export interface CollectionPromise {
  id: number;
  customerId: number;
  customerName: string;
  invoiceId?: number;
  invoiceNumber?: string;
  promisedAmount: number;
  promisedDate: string;
  status: string;
  createdAt: string;
  createdBy: number;
}

export interface AccountHold {
  id: number;
  customerId: number;
  customerName: string;
  holdType: string;
  reason: string;
  placedBy: number;
  placedAt: string;
  releasedAt?: string;
  releasedBy?: number;
  status: string;
}

export interface AuditLogEntry {
  id: number;
  action: string;
  entityType: string;
  entityId: number;
  details?: string;
  performedBy: number;
  performedByName?: string;
  performedAt: string;
  ipAddress?: string;
}

export interface SalesRep {
  name: string;
  email?: string;
  phone?: string;
  region?: string;
  vehicleReg?: string;
  isActive?: boolean;
}

export interface SampleReport {
  id: number;
  customerId: number;
  customerName: string;
  productId: number;
  productName: string;
  quantity: number;
  givenDate: string;
  feedback?: string;
  convertedToOrder: boolean;
  orderId?: number;
  createdAt: string;
  createdBy: number;
}

export interface Appointment {
  id: number;
  customerId: number;
  customerName: string;
  salesRep: string;
  appointmentDate: string;
  purpose?: string;
  notes?: string;
  status: string;
  createdAt: string;
  createdBy: number;
}

export interface FollowUp {
  id: number;
  customerId: number;
  customerName: string;
  salesRep: string;
  followUpDate: string;
  type: string;
  notes?: string;
  status: string;
  createdAt: string;
  createdBy: number;
}

export interface COCReport {
  id: number;
  customerId: number;
  customerName: string;
  cocNumber: string;
  issueDate: string;
  expiryDate: string;
  status: string;
  createdAt: string;
  createdBy: number;
}

export interface PackingList {
  id: number;
  plNumber: string;
  orderId: number;
  orderNumber: string;
  customerId: number;
  customerName: string;
  packedDate: string;
  status: string;
  lineItems: OrderLineItem[];
  createdAt: string;
  createdBy: number;
}

// ─── In-memory state ───

let users: User[] = [];
let customers: Customer[] = [];
let corporateCustomers: CorporateCustomer[] = [];
let products: Product[] = [];
let orders: Order[] = [];
let invoices: Invoice[] = [];
let receipts: Receipt[] = [];
let creditNotes: CreditNote[] = [];
let purchaseOrders: PurchaseOrder[] = [];
let deliveryNotes: DeliveryNote[] = [];
let stockItems: StockItem[] = [];
let specialPrices: SpecialPrice[] = [];
let collectionNotes: CollectionNote[] = [];
let collectionPromises: CollectionPromise[] = [];
let accountHolds: AccountHold[] = [];
let auditLog: AuditLogEntry[] = [];
let salesReps: SalesRep[] = [];
let sampleReports: SampleReport[] = [];
let appointments: Appointment[] = [];
let followUps: FollowUp[] = [];
let cocReports: COCReport[] = [];
let packingLists: PackingList[] = [];

let currentUser: User | null = null;
let invoiceGenerationLock = false;

// ─── Storage keys ───
const STORAGE_KEYS = {
  users: "sgf_users",
  customers: "sgf_customers",
  corporateCustomers: "sgf_corporateCustomers",
  products: "sgf_products",
  orders: "sgf_orders",
  invoices: "sgf_invoices",
  receipts: "sgf_receipts",
  creditNotes: "sgf_creditNotes",
  purchaseOrders: "sgf_purchaseOrders",
  deliveryNotes: "sgf_deliveryNotes",
  stockItems: "sgf_stockItems",
  specialPrices: "sgf_specialPrices",
  collectionNotes: "sgf_collectionNotes",
  collectionPromises: "sgf_collectionPromises",
  accountHolds: "sgf_accountHolds",
  auditLog: "sgf_auditLog",
  salesReps: "sgf_salesReps",
  sampleReports: "sgf_sampleReports",
  appointments: "sgf_appointments",
  followUps: "sgf_followUps",
  cocReports: "sgf_cocReports",
  packingLists: "sgf_packingLists",
  currentUser: "sgf_currentUser",
};

// ─── Helpers ───

function generateId(): number {
  return Date.now() + Math.floor(Math.random() * 1000);
}

function generateOrderNumber(): string {
  return `ORD-${Date.now().toString(36).toUpperCase()}`;
}

function generateInvoiceNumber(): string {
  return `INV-${Date.now().toString(36).toUpperCase()}`;
}

function generatePONumber(): string {
  return `PO-${Date.now().toString(36).toUpperCase()}`;
}

function generateDNNumber(): string {
  return `DN-${Date.now().toString(36).toUpperCase()}`;
}

function generateReceiptNumber(): string {
  return `RCP-${Date.now().toString(36).toUpperCase()}`;
}

function generateCreditNoteNumber(): string {
  return `CN-${Date.now().toString(36).toUpperCase()}`;
}

function generatePLNumber(): string {
  return `PL-${Date.now().toString(36).toUpperCase()}`;
}

function generateCOCNumber(): string {
  return `COC-${Date.now().toString(36).toUpperCase()}`;
}

function getNextId(items: any[]): number {
  if (items.length === 0) return 1;
  return Math.max(...items.map((i) => i.id || 0)) + 1;
}

function now(): string {
  return new Date().toISOString();
}

// ─── Load / Save ───

export function reloadFromStorage(keys?: string[]): void {
  const loadArray = (key: string, fallback: any[] = []) => {
    try {
      const raw = getStorageItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : fallback;
    } catch {
      return fallback;
    }
  };

  const allKeys = keys || Object.values(STORAGE_KEYS);

  if (allKeys.includes(STORAGE_KEYS.users) || !keys) users = loadArray(STORAGE_KEYS.users);
  if (allKeys.includes(STORAGE_KEYS.customers) || !keys) customers = loadArray(STORAGE_KEYS.customers);
  if (allKeys.includes(STORAGE_KEYS.corporateCustomers) || !keys) corporateCustomers = loadArray(STORAGE_KEYS.corporateCustomers);
  if (allKeys.includes(STORAGE_KEYS.products) || !keys) products = loadArray(STORAGE_KEYS.products);
  if (allKeys.includes(STORAGE_KEYS.orders) || !keys) orders = loadArray(STORAGE_KEYS.orders);
  if (allKeys.includes(STORAGE_KEYS.invoices) || !keys) invoices = loadArray(STORAGE_KEYS.invoices);
  if (allKeys.includes(STORAGE_KEYS.receipts) || !keys) receipts = loadArray(STORAGE_KEYS.receipts);
  if (allKeys.includes(STORAGE_KEYS.creditNotes) || !keys) creditNotes = loadArray(STORAGE_KEYS.creditNotes);
  if (allKeys.includes(STORAGE_KEYS.purchaseOrders) || !keys) purchaseOrders = loadArray(STORAGE_KEYS.purchaseOrders);
  if (allKeys.includes(STORAGE_KEYS.deliveryNotes) || !keys) deliveryNotes = loadArray(STORAGE_KEYS.deliveryNotes);
  if (allKeys.includes(STORAGE_KEYS.stockItems) || !keys) stockItems = loadArray(STORAGE_KEYS.stockItems);
  if (allKeys.includes(STORAGE_KEYS.specialPrices) || !keys) specialPrices = loadArray(STORAGE_KEYS.specialPrices);
  if (allKeys.includes(STORAGE_KEYS.collectionNotes) || !keys) collectionNotes = loadArray(STORAGE_KEYS.collectionNotes);
  if (allKeys.includes(STORAGE_KEYS.collectionPromises) || !keys) collectionPromises = loadArray(STORAGE_KEYS.collectionPromises);
  if (allKeys.includes(STORAGE_KEYS.accountHolds) || !keys) accountHolds = loadArray(STORAGE_KEYS.accountHolds);
  if (allKeys.includes(STORAGE_KEYS.auditLog) || !keys) auditLog = loadArray(STORAGE_KEYS.auditLog);
  if (allKeys.includes(STORAGE_KEYS.salesReps) || !keys) {
    const loaded = loadArray(STORAGE_KEYS.salesReps);
    if (loaded.length > 0) salesReps = loaded;
  }
  if (allKeys.includes(STORAGE_KEYS.sampleReports) || !keys) sampleReports = loadArray(STORAGE_KEYS.sampleReports);
  if (allKeys.includes(STORAGE_KEYS.appointments) || !keys) appointments = loadArray(STORAGE_KEYS.appointments);
  if (allKeys.includes(STORAGE_KEYS.followUps) || !keys) followUps = loadArray(STORAGE_KEYS.followUps);
  if (allKeys.includes(STORAGE_KEYS.cocReports) || !keys) cocReports = loadArray(STORAGE_KEYS.cocReports);
  if (allKeys.includes(STORAGE_KEYS.packingLists) || !keys) packingLists = loadArray(STORAGE_KEYS.packingLists);

  if (allKeys.includes(STORAGE_KEYS.currentUser) || !keys) {
    try {
      const raw = getStorageItem(STORAGE_KEYS.currentUser);
      currentUser = raw ? JSON.parse(raw) : null;
    } catch {
      currentUser = null;
    }
  }
}

function saveToStorage(key: string, data: any): void {
  try {
    setStorageItem(key, JSON.stringify(data));
  } catch (e) {
    console.warn(`[dataService] Failed to save ${key}:`, e);
  }
}

// ─── Initialization ───

function initData(): void {
  reloadFromStorage();

  // Seed default users if none exist
  if (users.length === 0) {
    users = [
      { id: 1, name: "Admin", pin: "1234", role: "admin", isActive: true, createdAt: now() },
      { id: 2, name: "Sales", pin: "0000", role: "sales_rep", isActive: true, createdAt: now() },
    ];
    saveToStorage(STORAGE_KEYS.users, users);
  }

  // Seed static customers if none exist
  if (customers.length === 0) {
    customers = STATIC_CUSTOMERS.map((c, i) => ({ ...c, id: i + 1, createdAt: now(), updatedAt: now() }));
    saveToStorage(STORAGE_KEYS.customers, customers);
  }

  // Seed static products if none exist
  if (products.length === 0) {
    products = STATIC_PRODUCTS.map((p, i) => ({ ...p, id: i + 1, createdAt: now(), updatedAt: now() }));
    saveToStorage(STORAGE_KEYS.products, products);
  }
}

initData();

// ═══════════════════════════════════════════════════════════════
//  DATA SERVICE API
// ═══════════════════════════════════════════════════════════════

export const dataService = {
  // ─── Users ───
  user: {
    list: () => {
      reloadFromStorage([STORAGE_KEYS.users]);
      return users;
    },
    getById: (id: number) => {
      reloadFromStorage([STORAGE_KEYS.users]);
      return users.find((u) => u.id === id) || null;
    },
    getByPin: (pin: string) => {
      reloadFromStorage([STORAGE_KEYS.users]);
      return users.find((u) => u.pin === pin) || null;
    },
    create: (data: Omit<User, "id" | "createdAt">) => {
      reloadFromStorage([STORAGE_KEYS.users]);
      const user: User = { ...data, id: getNextId(users), createdAt: now() };
      users.push(user);
      saveToStorage(STORAGE_KEYS.users, users);
      return user;
    },
    update: (id: number, data: Partial<User>) => {
      reloadFromStorage([STORAGE_KEYS.users]);
      const idx = users.findIndex((u) => u.id === id);
      if (idx === -1) return null;
      users[idx] = { ...users[idx], ...data };
      saveToStorage(STORAGE_KEYS.users, users);
      return users[idx];
    },
    delete: (id: number) => {
      reloadFromStorage([STORAGE_KEYS.users]);
      users = users.filter((u) => u.id !== id);
      saveToStorage(STORAGE_KEYS.users, users);
      return true;
    },
    me: () => {
      reloadFromStorage([STORAGE_KEYS.currentUser]);
      return currentUser;
    },
    resetPin: (id: number, newPin: string) => {
      reloadFromStorage([STORAGE_KEYS.users]);
      const idx = users.findIndex((u) => u.id === id);
      if (idx === -1) return null;
      users[idx].pin = newPin;
      saveToStorage(STORAGE_KEYS.users, users);
      return users[idx];
    },
  },

  // ─── Customers ───
  customer: {
    list: () => {
      reloadFromStorage([STORAGE_KEYS.customers]);
      return customers;
    },
    getById: (id: number) => {
      reloadFromStorage([STORAGE_KEYS.customers]);
      return customers.find((c) => c.id === id) || null;
    },
    create: (data: Omit<Customer, "id" | "createdAt" | "updatedAt">) => {
      reloadFromStorage([STORAGE_KEYS.customers]);
      const customer: Customer = { ...data, id: getNextId(customers), createdAt: now(), updatedAt: now() };
      customers.push(customer);
      saveToStorage(STORAGE_KEYS.customers, customers);
      return customer;
    },
    update: (id: number, data: Partial<Customer>) => {
      reloadFromStorage([STORAGE_KEYS.customers]);
      const idx = customers.findIndex((c) => c.id === id);
      if (idx === -1) return null;
      customers[idx] = { ...customers[idx], ...data, updatedAt: now() };
      saveToStorage(STORAGE_KEYS.customers, customers);
      return customers[idx];
    },
    delete: (id: number) => {
      reloadFromStorage([STORAGE_KEYS.customers]);
      customers = customers.filter((c) => c.id !== id);
      saveToStorage(STORAGE_KEYS.customers, customers);
      return true;
    },
    search: (query: string) => {
      reloadFromStorage([STORAGE_KEYS.customers]);
      const q = query.toLowerCase();
      return customers.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q) ||
          c.phone?.toLowerCase().includes(q) ||
          c.vatNumber?.toLowerCase().includes(q)
      );
    },
    bulkUpload: (items: Omit<Customer, "id" | "createdAt" | "updatedAt">[]) => {
      reloadFromStorage([STORAGE_KEYS.customers]);
      const newCustomers = items.map((item) => ({
        ...item,
        id: getNextId(customers),
        createdAt: now(),
        updatedAt: now(),
      }));
      customers.push(...newCustomers);
      saveToStorage(STORAGE_KEYS.customers, customers);
      return newCustomers;
    },
    bulkCreate: (items: Omit<Customer, "id" | "createdAt" | "updatedAt">[]) => {
      return dataService.customer.bulkUpload(items);
    },
  },

  // ─── Corporate Customers ───
  corporateCustomer: {
    list: () => {
      reloadFromStorage([STORAGE_KEYS.corporateCustomers]);
      return corporateCustomers;
    },
    getById: (id: number) => {
      reloadFromStorage([STORAGE_KEYS.corporateCustomers]);
      return corporateCustomers.find((c) => c.id === id) || null;
    },
    create: (data: Omit<CorporateCustomer, "id" | "createdAt" | "updatedAt">) => {
      reloadFromStorage([STORAGE_KEYS.corporateCustomers]);
      const customer: CorporateCustomer = { ...data, id: getNextId(corporateCustomers), createdAt: now(), updatedAt: now() };
      corporateCustomers.push(customer);
      saveToStorage(STORAGE_KEYS.corporateCustomers, corporateCustomers);
      return customer;
    },
    update: (id: number, data: Partial<CorporateCustomer>) => {
      reloadFromStorage([STORAGE_KEYS.corporateCustomers]);
      const idx = corporateCustomers.findIndex((c) => c.id === id);
      if (idx === -1) return null;
      corporateCustomers[idx] = { ...corporateCustomers[idx], ...data, updatedAt: now() };
      saveToStorage(STORAGE_KEYS.corporateCustomers, corporateCustomers);
      return corporateCustomers[idx];
    },
    delete: (id: number) => {
      reloadFromStorage([STORAGE_KEYS.corporateCustomers]);
      corporateCustomers = corporateCustomers.filter((c) => c.id !== id);
      saveToStorage(STORAGE_KEYS.corporateCustomers, corporateCustomers);
      return true;
    },
    search: (query: string) => {
      reloadFromStorage([STORAGE_KEYS.corporateCustomers]);
      const q = query.toLowerCase();
      return corporateCustomers.filter(
        (c) =>
          c.companyName.toLowerCase().includes(q) ||
          c.tradingName?.toLowerCase().includes(q) ||
          c.contactName?.toLowerCase().includes(q) ||
          c.contactEmail?.toLowerCase().includes(q)
      );
    },
  },

  // ─── Products ───
  product: {
    list: () => {
      reloadFromStorage([STORAGE_KEYS.products]);
      return products;
    },
    getById: (id: number) => {
      reloadFromStorage([STORAGE_KEYS.products]);
      return products.find((p) => p.id === id) || null;
    },
    create: (data: Omit<Product, "id" | "createdAt" | "updatedAt">) => {
      reloadFromStorage([STORAGE_KEYS.products]);
      const product: Product = { ...data, id: getNextId(products), createdAt: now(), updatedAt: now() };
      products.push(product);
      saveToStorage(STORAGE_KEYS.products, products);
      return product;
    },
    update: (id: number, data: Partial<Product>) => {
      reloadFromStorage([STORAGE_KEYS.products]);
      const idx = products.findIndex((p) => p.id === id);
      if (idx === -1) return null;
      products[idx] = { ...products[idx], ...data, updatedAt: now() };
      saveToStorage(STORAGE_KEYS.products, products);
      return products[idx];
    },
    delete: (id: number) => {
      reloadFromStorage([STORAGE_KEYS.products]);
      products = products.filter((p) => p.id !== id);
      saveToStorage(STORAGE_KEYS.products, products);
      return true;
    },
    search: (query: string) => {
      reloadFromStorage([STORAGE_KEYS.products]);
      const q = query.toLowerCase();
      return products.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.code.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q) ||
          p.category?.toLowerCase().includes(q)
      );
    },
    bulkUpload: (items: Omit<Product, "id" | "createdAt" | "updatedAt">[]) => {
      reloadFromStorage([STORAGE_KEYS.products]);
      const newProducts = items.map((item) => ({
        ...item,
        id: getNextId(products),
        createdAt: now(),
        updatedAt: now(),
      }));
      products.push(...newProducts);
      saveToStorage(STORAGE_KEYS.products, products);
      return newProducts;
    },
  },

  // ─── Orders ───
  order: {
    list: () => {
      reloadFromStorage([STORAGE_KEYS.orders]);
      return orders;
    },
    getById: (id: number) => {
      reloadFromStorage([STORAGE_KEYS.orders]);
      return orders.find((o) => o.id === id) || null;
    },
    create: (data: Omit<Order, "id" | "orderNumber" | "createdAt" | "updatedAt" | "status" | "paymentStatus" | "amountPaid" | "balanceDue">) => {
      reloadFromStorage([STORAGE_KEYS.orders]);
      const order: Order = {
        ...data,
        id: getNextId(orders),
        orderNumber: generateOrderNumber(),
        status: "pending",
        paymentStatus: "unpaid",
        amountPaid: 0,
        balanceDue: data.total,
        createdAt: now(),
        updatedAt: now(),
      };
      orders.push(order);
      saveToStorage(STORAGE_KEYS.orders, orders);
      return order;
    },
    update: (id: number, data: Partial<Order>) => {
      reloadFromStorage([STORAGE_KEYS.orders]);
      const idx = orders.findIndex((o) => o.id === id);
      if (idx === -1) return null;
      orders[idx] = { ...orders[idx], ...data, updatedAt: now() };
      saveToStorage(STORAGE_KEYS.orders, orders);
      return orders[idx];
    },
    delete: (id: number) => {
      reloadFromStorage([STORAGE_KEYS.orders]);
      orders = orders.filter((o) => o.id !== id);
      saveToStorage(STORAGE_KEYS.orders, orders);
      return true;
    },
    generateInvoiceForOrder: (orderId: number) => {
      reloadFromStorage([STORAGE_KEYS.orders, STORAGE_KEYS.invoices, STORAGE_KEYS.customers, STORAGE_KEYS.products]);
      const order = orders.find((o) => o.id === orderId);
      if (!order) return null;

      const existingInvoice = invoices.find((i) => i.orderId === orderId);
      if (existingInvoice) return existingInvoice.invoiceNumber;

      const customer = customers.find((c) => c.id === order.customerId);
      const vatRate = customer?.vatNumber ? 0.15 : 0;

      const invoice: Invoice = {
        id: getNextId(invoices),
        invoiceNumber: generateInvoiceNumber(),
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerId: order.customerId,
        customerName: order.customerName,
        invoiceDate: now().split("T")[0],
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        status: "draft",
        paymentStatus: "unpaid",
        subtotal: order.subtotal,
        vatAmount: order.vatAmount,
        total: order.total,
        amountPaid: 0,
        balanceDue: order.total,
        lineItems: order.lineItems.map((item) => ({ ...item, id: generateId() })),
        notes: order.notes,
        createdAt: now(),
        updatedAt: now(),
        createdBy: order.createdBy,
      };

      invoices.push(invoice);
      saveToStorage(STORAGE_KEYS.invoices, invoices);

      order.status = "invoiced";
      order.updatedAt = now();
      saveToStorage(STORAGE_KEYS.orders, orders);

      return invoice.invoiceNumber;
    },
    convertQuoteToOrder: (quoteId: number) => {
      reloadFromStorage([STORAGE_KEYS.orders]);
      const quote = orders.find((o) => o.id === quoteId && o.status === "quote");
      if (!quote) return null;
      quote.status = "pending";
      quote.orderNumber = generateOrderNumber();
      quote.updatedAt = now();
      saveToStorage(STORAGE_KEYS.orders, orders);
      return quote;
    },
    checkExistingSample: (customerId: number, productId: number) => {
      reloadFromStorage([STORAGE_KEYS.sampleReports]);
      return sampleReports.find((s) => s.customerId === customerId && s.productId === productId && !s.convertedToOrder);
    },
    repairOrders: () => {
      reloadFromStorage([STORAGE_KEYS.orders]);
      let fixed = 0;
      orders.forEach((order) => {
        if (!order.lineItems) {
          order.lineItems = [];
          fixed++;
        }
        if (!order.amountPaid) order.amountPaid = 0;
        if (!order.balanceDue) order.balanceDue = order.total || 0;
      });
      if (fixed > 0) saveToStorage(STORAGE_KEYS.orders, orders);
      return fixed;
    },
    createFromInvoice: (invoiceId: number) => {
      reloadFromStorage([STORAGE_KEYS.invoices, STORAGE_KEYS.orders]);
      const invoice = invoices.find((i) => i.id === invoiceId);
      if (!invoice) return null;
      const order: Order = {
        id: getNextId(orders),
        orderNumber: generateOrderNumber(),
        customerId: invoice.customerId,
        customerName: invoice.customerName,
        orderDate: now().split("T")[0],
        status: "pending",
        paymentStatus: "unpaid",
        paymentTerms: "30_days",
        subtotal: invoice.subtotal,
        vatAmount: invoice.vatAmount,
        total: invoice.total,
        amountPaid: 0,
        balanceDue: invoice.total,
        lineItems: invoice.lineItems.map((item) => ({ ...item, deliveredQty: 0 })),
        notes: invoice.notes,
        createdAt: now(),
        updatedAt: now(),
        createdBy: invoice.createdBy,
      };
      orders.push(order);
      saveToStorage(STORAGE_KEYS.orders, orders);
      return order;
    },
  },

  // ─── Invoices ───
  invoice: {
    list: () => {
      reloadFromStorage([STORAGE_KEYS.invoices]);
      return invoices;
    },
    getById: (id: number) => {
      reloadFromStorage([STORAGE_KEYS.invoices]);
      return invoices.find((i) => i.id === id) || null;
    },
    create: (data: Omit<Invoice, "id" | "invoiceNumber" | "createdAt" | "updatedAt" | "status" | "paymentStatus" | "amountPaid" | "balanceDue">) => {
      reloadFromStorage([STORAGE_KEYS.invoices]);
      const invoice: Invoice = {
        ...data,
        id: getNextId(invoices),
        invoiceNumber: generateInvoiceNumber(),
        status: "draft",
        paymentStatus: "unpaid",
        amountPaid: 0,
        balanceDue: data.total,
        createdAt: now(),
        updatedAt: now(),
      };
      invoices.push(invoice);
      saveToStorage(STORAGE_KEYS.invoices, invoices);
      return invoice;
    },
    update: (id: number, data: Partial<Invoice>) => {
      reloadFromStorage([STORAGE_KEYS.invoices]);
      const idx = invoices.findIndex((i) => i.id === id);
      if (idx === -1) return null;
      invoices[idx] = { ...invoices[idx], ...data, updatedAt: now() };
      saveToStorage(STORAGE_KEYS.invoices, invoices);
      return invoices[idx];
    },
    delete: (id: number) => {
      reloadFromStorage([STORAGE_KEYS.invoices]);
      invoices = invoices.filter((i) => i.id !== id);
      saveToStorage(STORAGE_KEYS.invoices, invoices);
      return true;
    },
    generateMissingInvoices: () => {
      reloadFromStorage([STORAGE_KEYS.orders, STORAGE_KEYS.invoices]);
      let generated = 0;
      orders.forEach((order) => {
        if (order.status === "delivered" && !invoices.some((i) => i.orderId === order.id)) {
          dataService.order.generateInvoiceForOrder(order.id);
          generated++;
        }
      });
      return generated;
    },
    createCreditNote: (invoiceId: number, amount: number, reason: string) => {
      reloadFromStorage([STORAGE_KEYS.invoices, STORAGE_KEYS.creditNotes]);
      const invoice = invoices.find((i) => i.id === invoiceId);
      if (!invoice) return null;
      const creditNote: CreditNote = {
        id: getNextId(creditNotes),
        creditNoteNumber: generateCreditNoteNumber(),
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        customerId: invoice.customerId,
        customerName: invoice.customerName,
        amount,
        reason,
        status: "active",
        createdAt: now(),
        createdBy: currentUser?.id || 0,
      };
      creditNotes.push(creditNote);
      saveToStorage(STORAGE_KEYS.creditNotes, creditNotes);
      return creditNote;
    },
    getNextInvoiceNumber: () => {
      reloadFromStorage([STORAGE_KEYS.invoices]);
      return generateInvoiceNumber();
    },
    getNextInvoiceNumberForCompany: (companyCode: string) => {
      reloadFromStorage([STORAGE_KEYS.invoices]);
      const count = invoices.filter((i) => i.invoiceNumber?.startsWith(companyCode)).length + 1;
      return `${companyCode}-${count.toString().padStart(4, "0")}`;
    },
    autoLinkSageInvoices: () => {
      reloadFromStorage([STORAGE_KEYS.invoices]);
      let linked = 0;
      invoices.forEach((inv) => {
        if (!inv.sageInvoiceNumber && inv.invoiceNumber) {
          inv.sageInvoiceNumber = `SAGE-${inv.invoiceNumber}`;
          linked++;
        }
      });
      if (linked > 0) saveToStorage(STORAGE_KEYS.invoices, invoices);
      return linked;
    },
    fixDraftInvoicesForDeliveredOrders: () => {
      reloadFromStorage([STORAGE_KEYS.invoices, STORAGE_KEYS.orders]);
      let fixed = 0;
      invoices.forEach((inv) => {
        if (inv.status === "draft" && inv.orderId) {
          const order = orders.find((o) => o.id === inv.orderId);
          if (order && order.status === "delivered") {
            inv.status = "sent";
            fixed++;
          }
        }
      });
      if (fixed > 0) saveToStorage(STORAGE_KEYS.invoices, invoices);
      return fixed;
    },
    repairCancelledInvoices: () => {
      reloadFromStorage([STORAGE_KEYS.invoices]);
      let fixed = 0;
      invoices.forEach((inv) => {
        if (inv.status === "cancelled" && inv.paymentStatus === "paid") {
          inv.paymentStatus = "unpaid";
          inv.amountPaid = 0;
          inv.balanceDue = inv.total;
          fixed++;
        }
      });
      if (fixed > 0) saveToStorage(STORAGE_KEYS.invoices, invoices);
      return fixed;
    },
  },

  // ─── Receipts ───
  receipt: {
    list: () => {
      reloadFromStorage([STORAGE_KEYS.receipts]);
      return receipts;
    },
    getById: (id: number) => {
      reloadFromStorage([STORAGE_KEYS.receipts]);
      return receipts.find((r) => r.id === id) || null;
    },
    create: (data: Omit<Receipt, "id" | "receiptNumber" | "createdAt">) => {
      reloadFromStorage([STORAGE_KEYS.receipts, STORAGE_KEYS.invoices]);
      const receipt: Receipt = {
        ...data,
        id: getNextId(receipts),
        receiptNumber: generateReceiptNumber(),
        createdAt: now(),
      };
      receipts.push(receipt);
      saveToStorage(STORAGE_KEYS.receipts, receipts);

      // Update invoice payment status
      const invoice = invoices.find((i) => i.id === data.invoiceId);
      if (invoice) {
        invoice.amountPaid = (invoice.amountPaid || 0) + data.amount;
        invoice.balanceDue = Math.max(0, invoice.total - invoice.amountPaid);
        invoice.paymentStatus = invoice.balanceDue <= 0 ? "paid" : "partial";
        invoice.updatedAt = now();
        saveToStorage(STORAGE_KEYS.invoices, invoices);
      }

      return receipt;
    },
    delete: (id: number) => {
      reloadFromStorage([STORAGE_KEYS.receipts]);
      receipts = receipts.filter((r) => r.id !== id);
      saveToStorage(STORAGE_KEYS.receipts, receipts);
      return true;
    },
    recordPayment: (invoiceId: number, amount: number, paymentMethod: string, reference?: string, notes?: string) => {
      reloadFromStorage([STORAGE_KEYS.invoices, STORAGE_KEYS.receipts]);
      const invoice = invoices.find((i) => i.id === invoiceId);
      if (!invoice) return null;

      const receipt: Receipt = {
        id: getNextId(receipts),
        receiptNumber: generateReceiptNumber(),
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        customerId: invoice.customerId,
        customerName: invoice.customerName,
        amount,
        paymentMethod,
        paymentDate: now().split("T")[0],
        reference,
        notes,
        createdAt: now(),
        createdBy: currentUser?.id || 0,
      };
      receipts.push(receipt);
      saveToStorage(STORAGE_KEYS.receipts, receipts);

      invoice.amountPaid = (invoice.amountPaid || 0) + amount;
      invoice.balanceDue = Math.max(0, invoice.total - invoice.amountPaid);
      invoice.paymentStatus = invoice.balanceDue <= 0 ? "paid" : "partial";
      invoice.updatedAt = now();
      saveToStorage(STORAGE_KEYS.invoices, invoices);

      return receipt;
    },
    getReceipts: (invoiceId: number) => {
      reloadFromStorage([STORAGE_KEYS.receipts]);
      return receipts.filter((r) => r.invoiceId === invoiceId);
    },
    getCustomerPaymentHistory: (customerId: number) => {
      reloadFromStorage([STORAGE_KEYS.receipts, STORAGE_KEYS.invoices]);
      const customerReceipts = receipts.filter((r) => r.customerId === customerId);
      const customerInvoices = invoices.filter((i) => i.customerId === customerId);
      return { receipts: customerReceipts, invoices: customerInvoices };
    },
  },

  // ─── Credit Notes ───
  creditNote: {
    list: () => {
      reloadFromStorage([STORAGE_KEYS.creditNotes]);
      return creditNotes;
    },
    getById: (id: number) => {
      reloadFromStorage([STORAGE_KEYS.creditNotes]);
      return creditNotes.find((c) => c.id === id) || null;
    },
    createCreditNote: (invoiceId: number, amount: number, reason: string) => {
      return dataService.invoice.createCreditNote(invoiceId, amount, reason);
    },
    getCreditNotes: (invoiceId: number) => {
      reloadFromStorage([STORAGE_KEYS.creditNotes]);
      return creditNotes.filter((c) => c.invoiceId === invoiceId);
    },
    refundCreditNote: (id: number) => {
      reloadFromStorage([STORAGE_KEYS.creditNotes]);
      const idx = creditNotes.findIndex((c) => c.id === id);
      if (idx === -1) return null;
      creditNotes[idx].status = "refunded";
      saveToStorage(STORAGE_KEYS.creditNotes, creditNotes);
      return creditNotes[idx];
    },
    voidCreditNote: (id: number) => {
      reloadFromStorage([STORAGE_KEYS.creditNotes]);
      const idx = creditNotes.findIndex((c) => c.id === id);
      if (idx === -1) return null;
      creditNotes[idx].status = "voided";
      saveToStorage(STORAGE_KEYS.creditNotes, creditNotes);
      return creditNotes[idx];
    },
  },

  // ─── Purchase Orders ───
  purchaseOrder: {
    list: () => {
      reloadFromStorage([STORAGE_KEYS.purchaseOrders]);
      return purchaseOrders;
    },
    getById: (id: number) => {
      reloadFromStorage([STORAGE_KEYS.purchaseOrders]);
      return purchaseOrders.find((po) => po.id === id) || null;
    },
    create: (data: Omit<PurchaseOrder, "id" | "poNumber" | "createdAt" | "updatedAt" | "status" | "paymentStatus">) => {
      reloadFromStorage([STORAGE_KEYS.purchaseOrders]);
      const po: PurchaseOrder = {
        ...data,
        id: getNextId(purchaseOrders),
        poNumber: generatePONumber(),
        status: "pending",
        paymentStatus: "unpaid",
        createdAt: now(),
        updatedAt: now(),
      };
      purchaseOrders.push(po);
      saveToStorage(STORAGE_KEYS.purchaseOrders, purchaseOrders);
      return po;
    },
    update: (id: number, data: Partial<PurchaseOrder>) => {
      reloadFromStorage([STORAGE_KEYS.purchaseOrders]);
      const idx = purchaseOrders.findIndex((po) => po.id === id);
      if (idx === -1) return null;
      purchaseOrders[idx] = { ...purchaseOrders[idx], ...data, updatedAt: now() };
      saveToStorage(STORAGE_KEYS.purchaseOrders, purchaseOrders);
      return purchaseOrders[idx];
    },
    delete: (id: number) => {
      reloadFromStorage([STORAGE_KEYS.purchaseOrders]);
      purchaseOrders = purchaseOrders.filter((po) => po.id !== id);
      saveToStorage(STORAGE_KEYS.purchaseOrders, purchaseOrders);
      return true;
    },
  },

  // ─── Delivery Notes ───
  deliveryNote: {
    list: () => {
      reloadFromStorage([STORAGE_KEYS.deliveryNotes]);
      return deliveryNotes;
    },
    getById: (id: number) => {
      reloadFromStorage([STORAGE_KEYS.deliveryNotes]);
      return deliveryNotes.find((dn) => dn.id === id) || null;
    },
    create: (data: Omit<DeliveryNote, "id" | "dnNumber" | "createdAt" | "status">) => {
      reloadFromStorage([STORAGE_KEYS.deliveryNotes]);
      const dn: DeliveryNote = {
        ...data,
        id: getNextId(deliveryNotes),
        dnNumber: generateDNNumber(),
        status: "pending",
        createdAt: now(),
      };
      deliveryNotes.push(dn);
      saveToStorage(STORAGE_KEYS.deliveryNotes, deliveryNotes);
      return dn;
    },
    update: (id: number, data: Partial<DeliveryNote>) => {
      reloadFromStorage([STORAGE_KEYS.deliveryNotes]);
      const idx = deliveryNotes.findIndex((dn) => dn.id === id);
      if (idx === -1) return null;
      deliveryNotes[idx] = { ...deliveryNotes[idx], ...data };
      saveToStorage(STORAGE_KEYS.deliveryNotes, deliveryNotes);
      return deliveryNotes[idx];
    },
    delete: (id: number) => {
      reloadFromStorage([STORAGE_KEYS.deliveryNotes]);
      deliveryNotes = deliveryNotes.filter((dn) => dn.id !== id);
      saveToStorage(STORAGE_KEYS.deliveryNotes, deliveryNotes);
      return true;
    },
  },

  // ─── Stock ───
  stock: {
    list: () => {
      reloadFromStorage([STORAGE_KEYS.stockItems]);
      return stockItems;
    },
    getById: (id: number) => {
      reloadFromStorage([STORAGE_KEYS.stockItems]);
      return stockItems.find((s) => s.id === id) || null;
    },
    create: (data: Omit<StockItem, "id" | "createdAt">) => {
      reloadFromStorage([STORAGE_KEYS.stockItems]);
      const item: StockItem = { ...data, id: getNextId(stockItems), createdAt: now() };
      stockItems.push(item);
      saveToStorage(STORAGE_KEYS.stockItems, stockItems);
      return item;
    },
    update: (id: number, data: Partial<StockItem>) => {
      reloadFromStorage([STORAGE_KEYS.stockItems]);
      const idx = stockItems.findIndex((s) => s.id === id);
      if (idx === -1) return null;
      stockItems[idx] = { ...stockItems[idx], ...data };
      saveToStorage(STORAGE_KEYS.stockItems, stockItems);
      return stockItems[idx];
    },
    delete: (id: number) => {
      reloadFromStorage([STORAGE_KEYS.stockItems]);
      stockItems = stockItems.filter((s) => s.id !== id);
      saveToStorage(STORAGE_KEYS.stockItems, stockItems);
      return true;
    },
    getMovements: (productId: number) => {
      reloadFromStorage([STORAGE_KEYS.stockItems]);
      return stockItems.filter((s) => s.productId === productId);
    },
  },

  // ─── Special Prices ───
  specialPrice: {
    list: () => {
      reloadFromStorage([STORAGE_KEYS.specialPrices]);
      return specialPrices;
    },
    getById: (id: number) => {
      reloadFromStorage([STORAGE_KEYS.specialPrices]);
      return specialPrices.find((s) => s.id === id) || null;
    },
    create: (data: Omit<SpecialPrice, "id" | "createdAt">) => {
      reloadFromStorage([STORAGE_KEYS.specialPrices]);
      const sp: SpecialPrice = { ...data, id: getNextId(specialPrices), createdAt: now() };
      specialPrices.push(sp);
      saveToStorage(STORAGE_KEYS.specialPrices, specialPrices);
      return sp;
    },
    update: (id: number, data: Partial<SpecialPrice>) => {
      reloadFromStorage([STORAGE_KEYS.specialPrices]);
      const idx = specialPrices.findIndex((s) => s.id === id);
      if (idx === -1) return null;
      specialPrices[idx] = { ...specialPrices[idx], ...data };
      saveToStorage(STORAGE_KEYS.specialPrices, specialPrices);
      return specialPrices[idx];
    },
    delete: (id: number) => {
      reloadFromStorage([STORAGE_KEYS.specialPrices]);
      specialPrices = specialPrices.filter((s) => s.id !== id);
      saveToStorage(STORAGE_KEYS.specialPrices, specialPrices);
      return true;
    },
    getForCustomer: (customerId: number) => {
      reloadFromStorage([STORAGE_KEYS.specialPrices]);
      return specialPrices.filter((s) => s.customerId === customerId && s.isActive);
    },
    getForCustomerProduct: (customerId: number, productId: number) => {
      reloadFromStorage([STORAGE_KEYS.specialPrices]);
      return specialPrices.find((s) => s.customerId === customerId && s.productId === productId && s.isActive) || null;
    },
    bulkUpload: (items: Omit<SpecialPrice, "id" | "createdAt">[]) => {
      reloadFromStorage([STORAGE_KEYS.specialPrices]);
      const newItems = items.map((item) => ({
        ...item,
        id: getNextId(specialPrices),
        createdAt: now(),
      }));
      specialPrices.push(...newItems);
      saveToStorage(STORAGE_KEYS.specialPrices, specialPrices);
      return newItems;
    },
  },

  // ─── Collection Notes ───
  collectionNote: {
    list: () => {
      reloadFromStorage([STORAGE_KEYS.collectionNotes]);
      return collectionNotes;
    },
    getById: (id: number) => {
      reloadFromStorage([STORAGE_KEYS.collectionNotes]);
      return collectionNotes.find((c) => c.id === id) || null;
    },
    create: (data: Omit<CollectionNote, "id" | "createdAt" | "status">) => {
      reloadFromStorage([STORAGE_KEYS.collectionNotes]);
      const note: CollectionNote = { ...data, id: getNextId(collectionNotes), status: "open", createdAt: now() };
      collectionNotes.push(note);
      saveToStorage(STORAGE_KEYS.collectionNotes, collectionNotes);
      return note;
    },
    update: (id: number, data: Partial<CollectionNote>) => {
      reloadFromStorage([STORAGE_KEYS.collectionNotes]);
      const idx = collectionNotes.findIndex((c) => c.id === id);
      if (idx === -1) return null;
      collectionNotes[idx] = { ...collectionNotes[idx], ...data };
      saveToStorage(STORAGE_KEYS.collectionNotes, collectionNotes);
      return collectionNotes[idx];
    },
    delete: (id: number) => {
      reloadFromStorage([STORAGE_KEYS.collectionNotes]);
      collectionNotes = collectionNotes.filter((c) => c.id !== id);
      saveToStorage(STORAGE_KEYS.collectionNotes, collectionNotes);
      return true;
    },
    addNote: (data: Omit<CollectionNote, "id" | "createdAt" | "status">) => {
      return dataService.collectionNote.create(data);
    },
  },

  // ─── Collection Promises ───
  collectionPromise: {
    list: () => {
      reloadFromStorage([STORAGE_KEYS.collectionPromises]);
      return collectionPromises;
    },
    getById: (id: number) => {
      reloadFromStorage([STORAGE_KEYS.collectionPromises]);
      return collectionPromises.find((c) => c.id === id) || null;
    },
    create: (data: Omit<CollectionPromise, "id" | "createdAt" | "status">) => {
      reloadFromStorage([STORAGE_KEYS.collectionPromises]);
      const promise: CollectionPromise = { ...data, id: getNextId(collectionPromises), status: "pending", createdAt: now() };
      collectionPromises.push(promise);
      saveToStorage(STORAGE_KEYS.collectionPromises, collectionPromises);
      return promise;
    },
    update: (id: number, data: Partial<CollectionPromise>) => {
      reloadFromStorage([STORAGE_KEYS.collectionPromises]);
      const idx = collectionPromises.findIndex((c) => c.id === id);
      if (idx === -1) return null;
      collectionPromises[idx] = { ...collectionPromises[idx], ...data };
      saveToStorage(STORAGE_KEYS.collectionPromises, collectionPromises);
      return collectionPromises[idx];
    },
    delete: (id: number) => {
      reloadFromStorage([STORAGE_KEYS.collectionPromises]);
      collectionPromises = collectionPromises.filter((c) => c.id !== id);
      saveToStorage(STORAGE_KEYS.collectionPromises, collectionPromises);
      return true;
    },
    recordPromise: (data: Omit<CollectionPromise, "id" | "createdAt" | "status">) => {
      return dataService.collectionPromise.create(data);
    },
  },

  // ─── Account Holds ───
  accountHold: {
    list: () => {
      reloadFromStorage([STORAGE_KEYS.accountHolds]);
      return accountHolds;
    },
    getById: (id: number) => {
      reloadFromStorage([STORAGE_KEYS.accountHolds]);
      return accountHolds.find((a) => a.id === id) || null;
    },
    create: (data: Omit<AccountHold, "id" | "placedAt" | "status">) => {
      reloadFromStorage([STORAGE_KEYS.accountHolds]);
      const hold: AccountHold = { ...data, id: getNextId(accountHolds), status: "active", placedAt: now() };
      accountHolds.push(hold);
      saveToStorage(STORAGE_KEYS.accountHolds, accountHolds);
      return hold;
    },
    update: (id: number, data: Partial<AccountHold>) => {
      reloadFromStorage([STORAGE_KEYS.accountHolds]);
      const idx = accountHolds.findIndex((a) => a.id === id);
      if (idx === -1) return null;
      accountHolds[idx] = { ...accountHolds[idx], ...data };
      saveToStorage(STORAGE_KEYS.accountHolds, accountHolds);
      return accountHolds[idx];
    },
    delete: (id: number) => {
      reloadFromStorage([STORAGE_KEYS.accountHolds]);
      accountHolds = accountHolds.filter((a) => a.id !== id);
      saveToStorage(STORAGE_KEYS.accountHolds, accountHolds);
      return true;
    },
    placeHold: (data: Omit<AccountHold, "id" | "placedAt" | "status">) => {
      return dataService.accountHold.create(data);
    },
    releaseHold: (id: number, releasedBy: number) => {
      reloadFromStorage([STORAGE_KEYS.accountHolds]);
      const idx = accountHolds.findIndex((a) => a.id === id);
      if (idx === -1) return null;
      accountHolds[idx].status = "released";
      accountHolds[idx].releasedAt = now();
      accountHolds[idx].releasedBy = releasedBy;
      saveToStorage(STORAGE_KEYS.accountHolds, accountHolds);
      return accountHolds[idx];
    },
  },

  // ─── Audit Log ───
  auditLog: {
    list: () => {
      reloadFromStorage([STORAGE_KEYS.auditLog]);
      return auditLog;
    },
    create: (data: Omit<AuditLogEntry, "id" | "performedAt">) => {
      reloadFromStorage([STORAGE_KEYS.auditLog]);
      const entry: AuditLogEntry = { ...data, id: getNextId(auditLog), performedAt: now() };
      auditLog.push(entry);
      saveToStorage(STORAGE_KEYS.auditLog, auditLog);
      return entry;
    },
    getByEntity: (entityType: string, entityId: number) => {
      reloadFromStorage([STORAGE_KEYS.auditLog]);
      return auditLog.filter((a) => a.entityType === entityType && a.entityId === entityId);
    },
  },

  // ─── Dashboard ───
  dashboard: {
    getStats: () => {
      reloadFromStorage();
      const today = new Date().toISOString().split("T")[0];
      const todayOrders = orders.filter((o) => o.orderDate === today);
      const todayInvoices = invoices.filter((i) => i.invoiceDate === today);
      const todayReceipts = receipts.filter((r) => r.paymentDate === today);

      return {
        totalCustomers: customers.length,
        totalProducts: products.length,
        totalOrders: orders.length,
        totalInvoices: invoices.length,
        totalReceipts: receipts.length,
        pendingOrders: orders.filter((o) => o.status === "pending").length,
        overdueInvoices: invoices.filter((i) => i.paymentStatus === "unpaid" && i.dueDate < today).length,
        todayOrders: todayOrders.length,
        todayRevenue: todayReceipts.reduce((sum, r) => sum + r.amount, 0),
        outstandingBalance: invoices.reduce((sum, i) => sum + (i.balanceDue || 0), 0),
        lowStockProducts: products.filter((p) => p.stockQuantity <= p.reorderPoint).length,
      };
    },
  },

  // ─── Sales Rep ───
  salesRep: {
    getStats: (salesRepName: string) => {
      reloadFromStorage([STORAGE_KEYS.orders, STORAGE_KEYS.invoices, STORAGE_KEYS.customers]);
      const repOrders = orders.filter((o) => o.salesRep === salesRepName);
      const repInvoices = invoices.filter((i) => i.customerName && orders.some((o) => o.customerName === i.customerName && o.salesRep === salesRepName));
      return {
        totalOrders: repOrders.length,
        totalRevenue: repInvoices.reduce((sum, i) => sum + i.total, 0),
        totalCustomers: customers.filter((c) => c.salesRep === salesRepName).length,
        pendingOrders: repOrders.filter((o) => o.status === "pending").length,
      };
    },
    list: () => {
      reloadFromStorage([STORAGE_KEYS.salesReps]);
      return salesReps;
    },
  },

  // ─── Collections ───
  collections: {
    getStats: () => {
      reloadFromStorage([STORAGE_KEYS.invoices, STORAGE_KEYS.receipts, STORAGE_KEYS.collectionNotes, STORAGE_KEYS.collectionPromises]);
      const today = new Date().toISOString().split("T")[0];
      return {
        totalOutstanding: invoices.reduce((sum, i) => sum + (i.balanceDue || 0), 0),
        overdueAmount: invoices.filter((i) => i.paymentStatus === "unpaid" && i.dueDate < today).reduce((sum, i) => sum + (i.balanceDue || 0), 0),
        todayCollections: receipts.filter((r) => r.paymentDate === today).reduce((sum, r) => sum + r.amount, 0),
        openCollectionNotes: collectionNotes.filter((c) => c.status === "open").length,
        pendingPromises: collectionPromises.filter((c) => c.status === "pending" && c.promisedDate >= today).length,
      };
    },
  },

  // ─── COC ───
  coc: {
    getStats: () => {
      reloadFromStorage([STORAGE_KEYS.cocReports]);
      return {
        totalCOCs: cocReports.length,
        activeCOCs: cocReports.filter((c) => c.status === "active").length,
        expiredCOCs: cocReports.filter((c) => c.status === "expired").length,
      };
    },
  },

  // ─── Sample Reports ───
  sampleReport: {
    getReport: () => {
      reloadFromStorage([STORAGE_KEYS.sampleReports]);
      return sampleReports;
    },
    create: (data: Omit<SampleReport, "id" | "createdAt">) => {
      reloadFromStorage([STORAGE_KEYS.sampleReports]);
      const report: SampleReport = { ...data, id: getNextId(sampleReports), createdAt: now() };
      sampleReports.push(report);
      saveToStorage(STORAGE_KEYS.sampleReports, sampleReports);
      return report;
    },
    update: (id: number, data: Partial<SampleReport>) => {
      reloadFromStorage([STORAGE_KEYS.sampleReports]);
      const idx = sampleReports.findIndex((s) => s.id === id);
      if (idx === -1) return null;
      sampleReports[idx] = { ...sampleReports[idx], ...data };
      saveToStorage(STORAGE_KEYS.sampleReports, sampleReports);
      return sampleReports[idx];
    },
  },

  // ─── Checkin ───
  checkin: {
    getAARate: () => {
      try {
        const rate = getStorageItem("sgf_aa_rate");
        return rate ? parseFloat(rate) : 0.15;
      } catch {
        return 0.15;
      }
    },
    setAARate: (rate: number) => {
      setStorageItem("sgf_aa_rate", String(rate));
      return rate;
    },
  },

  // ─── Utilities ───
  deduplicateAll: () => {
    const dedupe = <T extends { id?: number }>(items: T[]): T[] => {
      const seen = new Set<number>();
      return items.filter((item) => {
        if (!item.id || seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      });
    };

    reloadFromStorage();
    users = dedupe(users);
    customers = dedupe(customers);
    corporateCustomers = dedupe(corporateCustomers);
    products = dedupe(products);
    orders = dedupe(orders);
    invoices = dedupe(invoices);
    receipts = dedupe(receipts);
    creditNotes = dedupe(creditNotes);
    purchaseOrders = dedupe(purchaseOrders);
    deliveryNotes = dedupe(deliveryNotes);
    stockItems = dedupe(stockItems);
    specialPrices = dedupe(specialPrices);
    collectionNotes = dedupe(collectionNotes);
    collectionPromises = dedupe(collectionPromises);
    accountHolds = dedupe(accountHolds);
    auditLog = dedupe(auditLog);
    sampleReports = dedupe(sampleReports);
    appointments = dedupe(appointments);
    followUps = dedupe(followUps);
    cocReports = dedupe(cocReports);
    packingLists = dedupe(packingLists);

    Object.values(STORAGE_KEYS).forEach((key) => {
      if (key === STORAGE_KEYS.currentUser) return;
      saveToStorage(key, eval(key.replace("sgf_", "")));
    });

    return true;
  },

  // ─── generateInvoiceForPO (standalone method) ───
  generateInvoiceForPO: (poId: number) => {
    // ACQUIRE LOCK: prevent concurrent generation
    if (invoiceGenerationLock) {
      console.warn("[generateInvoiceForPO] LOCKED — another invoice is being generated.");
      return null;
    }
    invoiceGenerationLock = true;

    try {
      reloadFromStorage([STORAGE_KEYS.purchaseOrders, STORAGE_KEYS.invoices, STORAGE_KEYS.corporateCustomers, STORAGE_KEYS.customers]);
      const po = purchaseOrders.find((p) => p.id == poId);
      if (!po) {
        console.warn("[generateInvoiceForPO] PO not found:", poId);
        return null;
      }

      const poRef = po.poNumber || `PO-${po.id}`;

      // Check if invoice already exists for this PO
      const existingIdx = invoices.findIndex((i) => i.purchaseOrderId == poId);
      if (existingIdx >= 0) {
        console.warn("[generateInvoiceForPO] Invoice already exists for", poRef);
        return invoices[existingIdx].invoiceNumber;
      }

      // Calculate totals from PO line items
      const items = po.lineItems || [];
      const subtotal = items.reduce((sum: number, item: any) => sum + (item.quantity * item.unitPrice || 0), 0);
      // Check if corporate customer is VAT exempt
      const corpCustomer = corporateCustomers.find((c) => c.id == po.corporateCustomerId);
      const vatRate = corpCustomer?.vatExempt ? 0 : 0.15;
      const vatAmount = subtotal * vatRate;
      const total = subtotal + vatAmount;

      // Resolve the main customer ID from the linked corporate customer
      const mainCustomerId = corpCustomer?.linkedCustomerId || po.corporateCustomerId;
      const mainCustomer = customers.find((c) => c.id == mainCustomerId);

      // Get corporate customer for payment terms
      const paymentTerms = corpCustomer?.paymentTerms || po.paymentTerms || "30_days";
      const days = parseInt(paymentTerms.replace(/\D/g, "")) || 30;
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + days);

      const invoice: Invoice = {
        id: getNextId(invoices),
        invoiceNumber: generateInvoiceNumber(),
        purchaseOrderId: po.id,
        poNumber: po.poNumber,
        customerId: mainCustomerId,
        customerName: mainCustomer?.name || corpCustomer?.companyName || po.customerName,
        invoiceDate: new Date().toISOString().split("T")[0],
        dueDate: dueDate.toISOString().split("T")[0],
        status: "draft",
        paymentStatus: "unpaid",
        subtotal,
        vatAmount,
        total,
        amountPaid: 0,
        balanceDue: total,
        lineItems: items.map((item: any) => ({
          id: generateId(),
          productId: item.productId,
          productName: item.productName,
          productCode: item.productCode,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount || 0,
          total: (item.quantity * item.unitPrice) * (1 - (item.discount || 0) / 100),
          vatRate,
        })),
        notes: `Generated from ${poRef}`,
        createdAt: now(),
        updatedAt: now(),
        createdBy: currentUser?.id || 0,
      };

      invoices.push(invoice);
      saveToStorage(STORAGE_KEYS.invoices, invoices);

      // Update PO status
      po.status = "invoiced";
      po.updatedAt = now();
      saveToStorage(STORAGE_KEYS.purchaseOrders, purchaseOrders);

      console.log("[generateInvoiceForPO] Invoice created:", invoice.invoiceNumber, "for", poRef);
      return invoice.invoiceNumber;
    } catch (err) {
      console.error("[generateInvoiceForPO] CRASH:", err);
      return null;
    } finally {
      invoiceGenerationLock = false;
    }
  },
};

// ─── Standalone exports for backward compatibility ───

export { reloadFromStorage, generateId, getNextId, now };

// Export getter functions for internal use
export function getCustomers() { reloadFromStorage([STORAGE_KEYS.customers]); return customers; }
export function getProducts() { reloadFromStorage([STORAGE_KEYS.products]); return products; }
export function getOrders() { reloadFromStorage([STORAGE_KEYS.orders]); return orders; }
export function getInvoices() { reloadFromStorage([STORAGE_KEYS.invoices]); return invoices; }
export function getPurchaseOrders() { reloadFromStorage([STORAGE_KEYS.purchaseOrders]); return purchaseOrders; }
export function getUsers() { reloadFromStorage([STORAGE_KEYS.users]); return users; }
export function getCurrentUser() { reloadFromStorage([STORAGE_KEYS.currentUser]); return currentUser; }
export function setCurrentUser(user: User | null) {
  currentUser = user;
  if (user) {
    setStorageItem(STORAGE_KEYS.currentUser, JSON.stringify(user));
  } else {
    removeStorageItem(STORAGE_KEYS.currentUser);
  }
}

// Export for localLink.ts
export { users, customers, corporateCustomers, products, orders, invoices, receipts, creditNotes, purchaseOrders, deliveryNotes, stockItems, specialPrices, collectionNotes, collectionPromises, accountHolds, auditLog, salesReps, sampleReports, appointments, followUps, cocReports, packingLists, currentUser, invoiceGenerationLock };

// ═══════════════════════════════════════════════════════════════
//  BACKWARD COMPATIBILITY EXPORTS
// ═══════════════════════════════════════════════════════════════

export default dataService;
