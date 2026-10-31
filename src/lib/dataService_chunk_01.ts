// Supreme Global Foods - Data Service
// Chunk 1 of 40 - Core exports, types, and storage helpers

export interface Order {
  id: number;
  orderNumber: string;
  customerId: number;
  customerName: string;
  customerCode?: string;
  company: string;
  orderDate: string;
  deliveryDate?: string;
  status: "pending" | "confirmed" | "processing" | "shipped" | "delivered" | "cancelled" | "on_hold";
  priority: "low" | "normal" | "high" | "urgent";
  items: OrderItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  currency: string;
  notes?: string;
  internalNotes?: string;
  shippingAddress?: string;
  billingAddress?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  paymentTerms?: string;
  paymentStatus?: "unpaid" | "partial" | "paid";
  assignedTo?: number;
  source?: string;
  createdBy?: number;
  createdAt: string;
  updatedAt: string;
  synced?: boolean;
  firebaseId?: string;
  sampleOrder?: boolean;
  isRecurring?: boolean;
  recurringFrequency?: string;
  parentOrderId?: number;
  deliveryInstructions?: string;
  poNumber?: string;
}

export interface OrderItem {
  id: number;
  productId: number;
  productName: string;
  productCode?: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  tax: number;
  total: number;
  notes?: string;
  variant?: string;
  unitOfMeasure?: string;
}

export interface Customer {
  id: number;
  name: string;
  code?: string;
  company: string;
  email?: string;
  phone?: string;
  mobile?: string;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  taxNumber?: string;
  registrationNumber?: string;
  paymentTerms?: string;
  creditLimit?: number;
  balance?: number;
  status: "active" | "inactive" | "suspended";
  category?: string;
  industry?: string;
  website?: string;
  contacts?: CustomerContact[];
  notes?: string;
  assignedTo?: number;
  createdAt: string;
  updatedAt: string;
  synced?: boolean;
  firebaseId?: string;
  isSupplier?: boolean;
}

export interface CustomerContact {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  role?: string;
  isPrimary?: boolean;
}

export interface Product {
  id: number;
  name: string;
  code: string;
  company: string;
  description?: string;
  category?: string;
  subcategory?: string;
  unitOfMeasure?: string;
  unitPrice: number;
  costPrice?: number;
  taxRate?: number;
  stockQuantity?: number;
  reorderLevel?: number;
  status: "active" | "inactive" | "discontinued";
  weight?: number;
  dimensions?: string;
  barcode?: string;
  sku?: string;
  supplierId?: number;
  images?: string[];
  variants?: ProductVariant[];
  createdAt: string;
  updatedAt: string;
  synced?: boolean;
  firebaseId?: string;
}

export interface ProductVariant {
  id: number;
  name: string;
  sku: string;
  unitPrice: number;
  stockQuantity?: number;
}

export interface Invoice {
  id: number;
  invoiceNumber: string;
  orderId?: number;
  orderNumber?: string;
  customerId: number;
  customerName: string;
  customerCode?: string;
  company: string;
  invoiceDate: string;
  dueDate?: string;
  status: "draft" | "sent" | "paid" | "overdue" | "cancelled" | "partial";
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  amountPaid: number;
  balanceDue: number;
  currency: string;
  notes?: string;
  paymentTerms?: string;
  poNumber?: string;
  createdBy?: number;
  createdAt: string;
  updatedAt: string;
  synced?: boolean;
  firebaseId?: string;
  isProforma?: boolean;
  isCreditNote?: boolean;
  parentInvoiceId?: number;
}

export interface InvoiceItem {
  id: number;
  productId?: number;
  productName: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  tax: number;
  total: number;
}

export interface Receipt {
  id: number;
  receiptNumber: string;
  invoiceId?: number;
  invoiceNumber?: string;
  customerId: number;
  customerName: string;
  company: string;
  amount: number;
  currency: string;
  paymentDate: string;
  paymentMethod: string;
  reference?: string;
  notes?: string;
  status: "pending" | "completed" | "failed" | "refunded";
  createdBy?: number;
  createdAt: string;
  updatedAt: string;
  synced?: boolean;
  firebaseId?: string;
}

export interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  company: string;
  pin?: string;
  phone?: string;
  avatar?: string;
  status: "active" | "inactive" | "suspended";
  lastLogin?: string;
  permissions?: string[];
  createdAt: string;
  updatedAt: string;
  synced?: boolean;
  firebaseId?: string;
}

export interface ActivityLog {
  id: number;
  userId?: number;
  userName?: string;
  action: string;
  entityType: string;
  entityId?: number;
  details?: any;
  company?: string;
  timestamp: string;
  synced?: boolean;
}

export interface AuditLog {
  id: number;
  action: string;
  entityType: string;
  entityId: number;
  oldValue?: any;
  newValue?: any;
  userId?: number;
  userName?: string;
  timestamp: string;
  company?: string;
  synced?: boolean;
}

export interface CompanySettings {
  id: number;
  name: string;
  code: string;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  phone?: string;
  email?: string;
  website?: string;
  taxNumber?: string;
  registrationNumber?: string;
  logo?: string;
  currency: string;
  timezone?: string;
  dateFormat?: string;
  invoicePrefix?: string;
  receiptPrefix?: string;
  orderPrefix?: string;
  quotePrefix?: string;
  nextInvoiceNumber?: number;
  nextReceiptNumber?: number;
  nextOrderNumber?: number;
  nextQuoteNumber?: number;
  paymentTerms?: string;
  bankName?: string;
  bankAccount?: string;
  bankBranch?: string;
  bankSwift?: string;
  createdAt: string;
  updatedAt: string;
  synced?: boolean;
}

export interface PurchaseOrder {
  id: number;
  poNumber: string;
  supplierId: number;
  supplierName: string;
  company: string;
  orderDate: string;
  expectedDate?: string;
  status: "draft" | "sent" | "confirmed" | "partial" | "received" | "cancelled";
  items: PurchaseOrderItem[];
  subtotal: number;
  tax: number;
  total: number;
  currency: string;
  notes?: string;
  createdBy?: number;
  createdAt: string;
  updatedAt: string;
  synced?: boolean;
  firebaseId?: string;
}

export interface PurchaseOrderItem {
  id: number;
  productId?: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
  receivedQuantity?: number;
}

export interface Quote {
  id: number;
  quoteNumber: string;
  customerId: number;
  customerName: string;
  company: string;
  quoteDate: string;
  expiryDate?: string;
  status: "draft" | "sent" | "accepted" | "rejected" | "expired";
  items: QuoteItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  currency: string;
  notes?: string;
  createdBy?: number;
  createdAt: string;
  updatedAt: string;
  synced?: boolean;
}

export interface QuoteItem {
  id: number;
  productId?: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  tax: number;
  total: number;
}

export interface Supplier {
  id: number;
  name: string;
  code?: string;
  company: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  taxNumber?: string;
  paymentTerms?: string;
  status: "active" | "inactive";
  products?: number[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
  synced?: boolean;
}

export interface DeliveryNote {
  id: number;
  dnNumber: string;
  orderId: number;
  orderNumber: string;
  customerId: number;
  customerName: string;
  company: string;
  deliveryDate: string;
  status: "pending" | "in_transit" | "delivered" | "returned";
  items: DeliveryItem[];
  driverName?: string;
  vehicle?: string;
  notes?: string;
  createdBy?: number;
  createdAt: string;
  updatedAt: string;
  synced?: boolean;
}

export interface DeliveryItem {
  id: number;
  productId?: number;
  productName: string;
  quantity: number;
  deliveredQuantity?: number;
}

export interface StockAdjustment {
  id: number;
  productId: number;
  productName: string;
  company: string;
  adjustmentType: "in" | "out" | "correction";
  quantity: number;
  reason?: string;
  reference?: string;
  notes?: string;
  createdBy?: number;
  createdAt: string;
  synced?: boolean;
}

export interface Warehouse {
  id: number;
  name: string;
  code?: string;
  company: string;
  address?: string;
  city?: string;
  managerId?: number;
  status: "active" | "inactive";
  createdAt: string;
  updatedAt: string;
  synced?: boolean;
}

export interface StockMovement {
  id: number;
  productId: number;
  productName: string;
  warehouseId?: number;
  company: string;
  movementType: "in" | "out" | "transfer";
  quantity: number;
  referenceType?: string;
  referenceId?: number;
  notes?: string;
  createdBy?: number;
  createdAt: string;
  synced?: boolean;
}

export interface PaymentTerm {
  id: number;
  name: string;
  days: number;
  description?: string;
  company: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaxRate {
  id: number;
  name: string;
  rate: number;
  company: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PriceList {
  id: number;
  name: string;
  customerId?: number;
  customerName?: string;
  company: string;
  items: PriceListItem[];
  effectiveDate?: string;
  expiryDate?: string;
  status: "active" | "inactive";
  createdAt: string;
  updatedAt: string;
}

export interface PriceListItem {
  id: number;
  productId: number;
  productName: string;
  unitPrice: number;
  minimumQuantity?: number;
}

export interface Notification {
  id: number;
  userId?: number;
  type: string;
  title: string;
  message: string;
  read: boolean;
  entityType?: string;
  entityId?: number;
  company?: string;
  createdAt: string;
  synced?: boolean;
}

export interface Report {
  id: number;
  name: string;
  type: string;
  company: string;
  filters?: any;
  data?: any;
  createdBy?: number;
  createdAt: string;
  updatedAt: string;
}

export interface SyncRecord {
  id: number;
  entityType: string;
  entityId: number;
  action: string;
  timestamp: string;
  status: "pending" | "synced" | "failed";
  error?: string;
  retryCount?: number;
}

// =============================================================================
// IN-MEMORY DATA ARRAYS
// =============================================================================

let orders: Order[] = [];
let customers: Customer[] = [];
let products: Product[] = [];
let invoices: Invoice[] = [];
let receipts: Receipt[] = [];
let users: User[] = [];
let activityLogs: ActivityLog[] = [];
let auditLog: AuditLog[] = [];
let companySettings: CompanySettings[] = [];
let purchaseOrders: PurchaseOrder[] = [];
let quotes: Quote[] = [];
let suppliers: Supplier[] = [];
let deliveryNotes: DeliveryNote[] = [];
let stockAdjustments: StockAdjustment[] = [];
let warehouses: Warehouse[] = [];
let stockMovements: StockMovement[] = [];
let paymentTerms: PaymentTerm[] = [];
let taxRates: TaxRate[] = [];
let priceLists: PriceList[] = [];
let notifications: Notification[] = [];
let reports: Report[] = [];
let syncRecords: SyncRecord[] = [];

// =============================================================================
// STORAGE HELPERS (localStorage wrapper with compression awareness)
// =============================================================================

function getStorageItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function setStorageItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage full or unavailable
  }
}

function removeStorageItem(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore
  }
}

function saveItem<T>(key: string, data: T[]): void {
  try {
    setStorageItem(key, JSON.stringify(data));
  } catch {
    // Storage full
  }
}

function loadItem<T>(key: string): T[] {
  try {
    const raw = getStorageItem(key);
    if (raw) return JSON.parse(raw);
  } catch {
    // Ignore parse errors
  }
  return [];
}

// =============================================================================
// LOGGING HELPERS
// =============================================================================

function logAudit(action: string, entityType: string, entityId: number, details: any): void {
  try {
    const entry: AuditLog = {
      id: Date.now() + Math.random(),
      action,
      entityType,
      entityId,
      newValue: details,
      timestamp: new Date().toISOString(),
      company: getCurrentCompany(),
    };
    auditLog.push(entry);
    saveItem("sgf_auditLog", auditLog);
  } catch {
    // Ignore logging errors
  }
}

function logActivity(action: string, entityType: string, entityId?: number, details?: any): void {
  try {
    const entry: ActivityLog = {
      id: Date.now() + Math.random(),
      action,
      entityType,
      entityId,
      details,
      company: getCurrentCompany(),
      timestamp: new Date().toISOString(),
    };
    activityLogs.push(entry);
    saveItem("sgf_activityLogs", activityLogs);
  } catch {
    // Ignore logging errors
  }
}

// =============================================================================
// CURRENT COMPANY HELPER
// =============================================================================

let _currentCompany: string = "sgf";

export function setCurrentCompany(company: string): void {
  _currentCompany = company;
  setStorageItem("sgf_currentCompany", company);
}

export function getCurrentCompany(): string {
  try {
    const stored = getStorageItem("sgf_currentCompany");
    if (stored) return stored;
  } catch {
    // Ignore
  }
  return _currentCompany;
}

// =============================================================================
// DEFAULT DATA
// =============================================================================

const DEFAULT_USERS: User[] = [
  {
    id: 1,
    name: "System Administrator",
    email: "admin@supremeglobal.co.za",
    role: "admin",
    company: "sgf",
    pin: "1234",
    status: "active",
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  },
  {
    id: 2,
    name: "Sales Manager",
    email: "sales@supremeglobal.co.za",
    role: "manager",
    company: "sgf",
    pin: "5678",
    status: "active",
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  },
  {
    id: 3,
    name: "Warehouse Staff",
    email: "warehouse@supremeglobal.co.za",
    role: "warehouse",
    company: "sgf",
    pin: "9012",
    status: "active",
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  },
];

const DEFAULT_COMPANY_SETTINGS: CompanySettings = {
  id: 1,
  name: "Supreme Global Foods",
  code: "sgf",
  address: "123 Main Street",
  city: "Cape Town",
  state: "Western Cape",
  postalCode: "8001",
  country: "South Africa",
  phone: "+27 21 123 4567",
  email: "info@supremeglobal.co.za",
  website: "www.supremeglobal.co.za",
  taxNumber: "1234567890",
  registrationNumber: "2010/123456/07",
  logo: "",
  currency: "ZAR",
  timezone: "Africa/Johannesburg",
  dateFormat: "DD/MM/YYYY",
  invoicePrefix: "INV",
  receiptPrefix: "RCP",
  orderPrefix: "ORD",
  quotePrefix: "QTE",
  nextInvoiceNumber: 1001,
  nextReceiptNumber: 1001,
  nextOrderNumber: 1001,
  nextQuoteNumber: 1001,
  paymentTerms: "Net 30",
  bankName: "First National Bank",
  bankAccount: "12345678901",
  bankBranch: "Cape Town Main",
  bankSwift: "FIRNZAJJ",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

const DEFAULT_PAYMENT_TERMS: PaymentTerm[] = [
  { id: 1, name: "Cash on Delivery", days: 0, company: "sgf", createdAt: "2024-01-01", updatedAt: "2024-01-01" },
  { id: 2, name: "Net 15", days: 15, company: "sgf", createdAt: "2024-01-01", updatedAt: "2024-01-01" },
  { id: 3, name: "Net 30", days: 30, company: "sgf", createdAt: "2024-01-01", updatedAt: "2024-01-01" },
  { id: 4, name: "Net 60", days: 60, company: "sgf", createdAt: "2024-01-01", updatedAt: "2024-01-01" },
  { id: 5, name: "Net 90", days: 90, company: "sgf", createdAt: "2024-01-01", updatedAt: "2024-01-01" },
];

const DEFAULT_TAX_RATES: TaxRate[] = [
  { id: 1, name: "VAT Standard", rate: 15, company: "sgf", description: "Standard VAT rate", createdAt: "2024-01-01", updatedAt: "2024-01-01" },
  { id: 2, name: "VAT Zero", rate: 0, company: "sgf", description: "Zero-rated VAT", createdAt: "2024-01-01", updatedAt: "2024-01-01" },
  { id: 3, name: "VAT Exempt", rate: 0, company: "sgf", description: "VAT exempt", createdAt: "2024-01-01", updatedAt: "2024-01-01" },
];
