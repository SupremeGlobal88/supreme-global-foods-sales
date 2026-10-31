// =============================================================================
// DEFAULT PRODUCTS
// =============================================================================

const DEFAULT_PRODUCTS: Product[] = [
  { id: 1, name: "Premium Beef Mince", code: "BF-MIN-001", company: "sgf", category: "Beef", unitOfMeasure: "kg", unitPrice: 89.99, costPrice: 65.00, taxRate: 15, stockQuantity: 150, reorderLevel: 50, status: "active", weight: 1, barcode: "6001234567890", sku: "BF-MIN-001", createdAt: "2024-01-01T00:00:00Z", updatedAt: "2024-01-01T00:00:00Z" },
  { id: 2, name: "Beef Steak - Rump", code: "BF-RMP-002", company: "sgf", category: "Beef", unitOfMeasure: "kg", unitPrice: 129.99, costPrice: 95.00, taxRate: 15, stockQuantity: 80, reorderLevel: 30, status: "active", weight: 1, barcode: "6001234567891", sku: "BF-RMP-002", createdAt: "2024-01-01T00:00:00Z", updatedAt: "2024-01-01T00:00:00Z" },
  { id: 3, name: "Beef Steak - Sirloin", code: "BF-SRL-003", company: "sgf", category: "Beef", unitOfMeasure: "kg", unitPrice: 149.99, costPrice: 110.00, taxRate: 15, stockQuantity: 60, reorderLevel: 25, status: "active", weight: 1, barcode: "6001234567892", sku: "BF-SRL-003", createdAt: "2024-01-01T00:00:00Z", updatedAt: "2024-01-01T00:00:00Z" },
  { id: 4, name: "Beef Steak - Fillet", code: "BF-FLT-004", company: "sgf", category: "Beef", unitOfMeasure: "kg", unitPrice: 199.99, costPrice: 150.00, taxRate: 15, stockQuantity: 40, reorderLevel: 20, status: "active", weight: 1, barcode: "6001234567893", sku: "BF-FLT-004", createdAt: "2024-01-01T00:00:00Z", updatedAt: "2024-01-01T00:00:00Z" },
  { id: 5, name: "Beef Burger Patties", code: "BF-BRG-005", company: "sgf", category: "Beef", unitOfMeasure: "pack", unitPrice: 79.99, costPrice: 55.00, taxRate: 15, stockQuantity: 200, reorderLevel: 75, status: "active", weight: 0.5, barcode: "6001234567894", sku: "BF-BRG-005", createdAt: "2024-01-01T00:00:00Z", updatedAt: "2024-01-01T00:00:00Z" },
  { id: 6, name: "Beef Boerewors", code: "BF-BWR-006", company: "sgf", category: "Beef", unitOfMeasure: "kg", unitPrice: 99.99, costPrice: 70.00, taxRate: 15, stockQuantity: 100, reorderLevel: 40, status: "active", weight: 1, barcode: "6001234567895", sku: "BF-BWR-006", createdAt: "2024-01-01T00:00:00Z", updatedAt: "2024-01-01T00:00:00Z" },
  { id: 7, name: "Lamb Chops", code: "LM-CHP-007", company: "sgf", category: "Lamb", unitOfMeasure: "kg", unitPrice: 139.99, costPrice: 100.00, taxRate: 15, stockQuantity: 70, reorderLevel: 30, status: "active", weight: 1, barcode: "6001234567896", sku: "LM-CHP-007", createdAt: "2024-01-01T00:00:00Z", updatedAt: "2024-01-01T00:00:00Z" },
  { id: 8, name: "Lamb Leg", code: "LM-LEG-008", company: "sgf", category: "Lamb", unitOfMeasure: "kg", unitPrice: 159.99, costPrice: 115.00, taxRate: 15, stockQuantity: 50, reorderLevel: 20, status: "active", weight: 1, barcode: "6001234567897", sku: "LM-LEG-008", createdAt: "2024-01-01T00:00:00Z", updatedAt: "2024-01-01T00:00:00Z" },
  { id: 9, name: "Lamb Rack", code: "LM-RCK-009", company: "sgf", category: "Lamb", unitOfMeasure: "kg", unitPrice: 219.99, costPrice: 165.00, taxRate: 15, stockQuantity: 30, reorderLevel: 15, status: "active", weight: 1, barcode: "6001234567898", sku: "LM-RCK-009", createdAt: "2024-01-01T00:00:00Z", updatedAt: "2024-01-01T00:00:00Z" },
  { id: 10, name: "Chicken Breast Fillet", code: "CK-BRS-010", company: "sgf", category: "Chicken", unitOfMeasure: "kg", unitPrice: 69.99, costPrice: 48.00, taxRate: 15, stockQuantity: 250, reorderLevel: 100, status: "active", weight: 1, barcode: "6001234567899", sku: "CK-BRS-010", createdAt: "2024-01-01T00:00:00Z", updatedAt: "2024-01-01T00:00:00Z" },
  { id: 11, name: "Chicken Thighs", code: "CK-THG-011", company: "sgf", category: "Chicken", unitOfMeasure: "kg", unitPrice: 59.99, costPrice: 40.00, taxRate: 15, stockQuantity: 200, reorderLevel: 80, status: "active", weight: 1, barcode: "6001234567900", sku: "CK-THG-011", createdAt: "2024-01-01T00:00:00Z", updatedAt: "2024-01-01T00:00:00Z" },
  { id: 12, name: "Chicken Wings", code: "CK-WNG-012", company: "sgf", category: "Chicken", unitOfMeasure: "kg", unitPrice: 49.99, costPrice: 32.00, taxRate: 15, stockQuantity: 180, reorderLevel: 70, status: "active", weight: 1, barcode: "6001234567901", sku: "CK-WNG-012", createdAt: "2024-01-01T00:00:00Z", updatedAt: "2024-01-01T00:00:00Z" },
  { id: 13, name: "Whole Chicken", code: "CK-WHL-013", company: "sgf", category: "Chicken", unitOfMeasure: "each", unitPrice: 89.99, costPrice: 60.00, taxRate: 15, stockQuantity: 120, reorderLevel: 50, status: "active", weight: 1.5, barcode: "6001234567902", sku: "CK-WHL-013", createdAt: "2024-01-01T00:00:00Z", updatedAt: "2024-01-01T00:00:00Z" },
  { id: 14, name: "Pork Chops", code: "PK-CHP-014", company: "sgf", category: "Pork", unitOfMeasure: "kg", unitPrice: 79.99, costPrice: 55.00, taxRate: 15, stockQuantity: 90, reorderLevel: 35, status: "active", weight: 1, barcode: "6001234567903", sku: "PK-CHP-014", createdAt: "2024-01-01T00:00:00Z", updatedAt: "2024-01-01T00:00:00Z" },
  { id: 15, name: "Pork Ribs", code: "PK-RIB-015", company: "sgf", category: "Pork", unitOfMeasure: "kg", unitPrice: 99.99, costPrice: 70.00, taxRate: 15, stockQuantity: 70, reorderLevel: 30, status: "active", weight: 1, barcode: "6001234567904", sku: "PK-RIB-015", createdAt: "2024-01-01T00:00:00Z", updatedAt: "2024-01-01T00:00:00Z" },
  { id: 16, name: "Pork Sausages", code: "PK-SGS-016", company: "sgf", category: "Pork", unitOfMeasure: "kg", unitPrice: 69.99, costPrice: 45.00, taxRate: 15, stockQuantity: 150, reorderLevel: 60, status: "active", weight: 1, barcode: "6001234567905", sku: "PK-SGS-016", createdAt: "2024-01-01T00:00:00Z", updatedAt: "2024-01-01T00:00:00Z" },
  { id: 17, name: "Bacon - Streaky", code: "PK-BCN-017", company: "sgf", category: "Pork", unitOfMeasure: "kg", unitPrice: 119.99, costPrice: 85.00, taxRate: 15, stockQuantity: 80, reorderLevel: 35, status: "active", weight: 1, barcode: "6001234567906", sku: "PK-BCN-017", createdAt: "2024-01-01T00:00:00Z", updatedAt: "2024-01-01T00:00:00Z" },
  { id: 18, name: "Mixed Mince", code: "MX-MIN-018", company: "sgf", category: "Mixed", unitOfMeasure: "kg", unitPrice: 74.99, costPrice: 52.00, taxRate: 15, stockQuantity: 120, reorderLevel: 50, status: "active", weight: 1, barcode: "6001234567907", sku: "MX-MIN-018", createdAt: "2024-01-01T00:00:00Z", updatedAt: "2024-01-01T00:00:00Z" },
  { id: 19, name: "Mixed Grill Pack", code: "MX-GRP-019", company: "sgf", category: "Mixed", unitOfMeasure: "pack", unitPrice: 199.99, costPrice: 140.00, taxRate: 15, stockQuantity: 60, reorderLevel: 25, status: "active", weight: 2, barcode: "6001234567908", sku: "MX-GRP-019", createdAt: "2024-01-01T00:00:00Z", updatedAt: "2024-01-01T00:00:00Z" },
  { id: 20, name: "Braai Pack", code: "MX-BRA-020", company: "sgf", category: "Mixed", unitOfMeasure: "pack", unitPrice: 249.99, costPrice: 175.00, taxRate: 15, stockQuantity: 50, reorderLevel: 20, status: "active", weight: 2.5, barcode: "6001234567909", sku: "MX-BRA-020", createdAt: "2024-01-01T00:00:00Z", updatedAt: "2024-01-01T00:00:00Z" },
];

// =============================================================================
// DEFAULT CUSTOMERS
// =============================================================================

const DEFAULT_CUSTOMERS: Customer[] = [
  {
    id: 1, name: "ABC Restaurant", code: "ABC001", company: "sgf", email: "orders@abcrestaurant.co.za", phone: "+27 21 555 1001",
    address: "15 Long Street", city: "Cape Town", state: "Western Cape", postalCode: "8001", country: "South Africa",
    taxNumber: "1234567890", paymentTerms: "Net 30", creditLimit: 50000, balance: 0, status: "active",
    category: "Restaurant", industry: "Hospitality", createdAt: "2024-01-01T00:00:00Z", updatedAt: "2024-01-01T00:00:00Z",
    contacts: [{ id: 1, name: "John Smith", email: "john@abcrestaurant.co.za", phone: "+27 21 555 1002", role: "Manager", isPrimary: true }],
  },
  {
    id: 2, name: "Sunrise Hotel", code: "SUN002", company: "sgf", email: "procurement@sunrisehotel.co.za", phone: "+27 21 555 2001",
    address: "25 Beach Road", city: "Cape Town", state: "Western Cape", postalCode: "8002", country: "South Africa",
    taxNumber: "2345678901", paymentTerms: "Net 30", creditLimit: 100000, balance: 0, status: "active",
    category: "Hotel", industry: "Hospitality", createdAt: "2024-01-01T00:00:00Z", updatedAt: "2024-01-01T00:00:00Z",
    contacts: [{ id: 1, name: "Sarah Jones", email: "sarah@sunrisehotel.co.za", phone: "+27 21 555 2002", role: "Procurement", isPrimary: true }],
  },
  {
    id: 3, name: "Metro Supermarket", code: "MET003", company: "sgf", email: "buying@metrosuper.co.za", phone: "+27 21 555 3001",
    address: "50 Main Road", city: "Cape Town", state: "Western Cape", postalCode: "8003", country: "South Africa",
    taxNumber: "3456789012", paymentTerms: "Net 15", creditLimit: 200000, balance: 0, status: "active",
    category: "Supermarket", industry: "Retail", createdAt: "2024-01-01T00:00:00Z", updatedAt: "2024-01-01T00:00:00Z",
    contacts: [{ id: 1, name: "Mike Brown", email: "mike@metrosuper.co.za", phone: "+27 21 555 3002", role: "Buyer", isPrimary: true }],
  },
  {
    id: 4, name: "Green Valley Butchery", code: "GRN004", company: "sgf", email: "orders@greenvalley.co.za", phone: "+27 21 555 4001",
    address: "75 Kloof Street", city: "Cape Town", state: "Western Cape", postalCode: "8004", country: "South Africa",
    taxNumber: "4567890123", paymentTerms: "Cash on Delivery", creditLimit: 25000, balance: 0, status: "active",
    category: "Butchery", industry: "Retail", createdAt: "2024-01-01T00:00:00Z", updatedAt: "2024-01-01T00:00:00Z",
    contacts: [{ id: 1, name: "David Wilson", email: "david@greenvalley.co.za", phone: "+27 21 555 4002", role: "Owner", isPrimary: true }],
  },
  {
    id: 5, name: "Ocean View Catering", code: "OCN005", company: "sgf", email: "info@oceanviewcatering.co.za", phone: "+27 21 555 5001",
    address: "90 Victoria Road", city: "Cape Town", state: "Western Cape", postalCode: "8005", country: "South Africa",
    taxNumber: "5678901234", paymentTerms: "Net 30", creditLimit: 35000, balance: 0, status: "active",
    category: "Catering", industry: "Hospitality", createdAt: "2024-01-01T00:00:00Z", updatedAt: "2024-01-01T00:00:00Z",
    contacts: [{ id: 1, name: "Lisa Taylor", email: "lisa@oceanviewcatering.co.za", phone: "+27 21 555 5002", role: "Director", isPrimary: true }],
  },
];

// =============================================================================
// NUMBER GENERATION HELPERS
// =============================================================================

export function generateOrderNumber(): string {
  const settings = companySettings.find((s) => s.code === getCurrentCompany());
  const prefix = settings?.orderPrefix || "ORD";
  const nextNum = settings?.nextOrderNumber || 1001;
  const date = new Date();
  const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  const random = Math.floor(Math.random() * 90000000) + 10000000;
  const orderNumber = `${prefix}-${dateStr}-${random}`;
  if (settings) {
    settings.nextOrderNumber = nextNum + 1;
    settings.updatedAt = new Date().toISOString();
    saveItem("sgf_companySettings", companySettings);
  }
  return orderNumber;
}

export function generateInvoiceNumber(): string {
  const settings = companySettings.find((s) => s.code === getCurrentCompany());
  const prefix = settings?.invoicePrefix || "INV";
  const nextNum = settings?.nextInvoiceNumber || 1001;
  const date = new Date();
  const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  const random = Math.floor(Math.random() * 90000000) + 10000000;
  const invoiceNumber = `${prefix}-${dateStr}-${random}`;
  if (settings) {
    settings.nextInvoiceNumber = nextNum + 1;
    settings.updatedAt = new Date().toISOString();
    saveItem("sgf_companySettings", companySettings);
  }
  return invoiceNumber;
}

export function generateReceiptNumber(): string {
  const settings = companySettings.find((s) => s.code === getCurrentCompany());
  const prefix = settings?.receiptPrefix || "RCP";
  const nextNum = settings?.nextReceiptNumber || 1001;
  const date = new Date();
  const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  const random = Math.floor(Math.random() * 90000000) + 10000000;
  const receiptNumber = `${prefix}-${dateStr}-${random}`;
  if (settings) {
    settings.nextReceiptNumber = nextNum + 1;
    settings.updatedAt = new Date().toISOString();
    saveItem("sgf_companySettings", companySettings);
  }
  return receiptNumber;
}

export function generateQuoteNumber(): string {
  const settings = companySettings.find((s) => s.code === getCurrentCompany());
  const prefix = settings?.quotePrefix || "QTE";
  const nextNum = settings?.nextQuoteNumber || 1001;
  const date = new Date();
  const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  const random = Math.floor(Math.random() * 90000000) + 10000000;
  const quoteNumber = `${prefix}-${dateStr}-${random}`;
  if (settings) {
    settings.nextQuoteNumber = nextNum + 1;
    settings.updatedAt = new Date().toISOString();
    saveItem("sgf_companySettings", companySettings);
  }
  return quoteNumber;
}

export function generatePONumber(): string {
  const date = new Date();
  const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  const random = Math.floor(Math.random() * 90000000) + 10000000;
  return `PO-${dateStr}-${random}`;
}

export function generateDeliveryNoteNumber(): string {
  const date = new Date();
  const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  const random = Math.floor(Math.random() * 90000000) + 10000000;
  return `DN-${dateStr}-${random}`;
}

export function generateSampleOrderNumber(): string {
  const date = new Date();
  const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  const random = Math.floor(Math.random() * 90000000) + 10000000;
  return `SMP-${dateStr}-${random}`;
}

// =============================================================================
// LOG SYSTEM EVENT (replacement for console.log)
// =============================================================================

export function logSystemEvent(level: "info" | "warn" | "error", message: string, details?: any): void {
  const event = {
    id: Date.now() + Math.random(),
    level,
    message,
    details,
    timestamp: new Date().toISOString(),
    company: getCurrentCompany(),
  };
  try {
    const existing = loadItem<any>("sgf_systemEvents");
    existing.push(event);
    saveItem("sgf_systemEvents", existing.slice(-500));
  } catch {
    // Ignore
  }
}

// =============================================================================
// DATA LOADING
// =============================================================================

export function load(): void {
  try {
    orders = loadItem<Order>("sgf_orders");
    customers = loadItem<Customer>("sgf_customers");
    products = loadItem<Product>("sgf_products");
    invoices = loadItem<Invoice>("sgf_invoices");
    receipts = loadItem<Receipt>("sgf_receipts");
    users = loadItem<User>("sgf_users");
    activityLogs = loadItem<ActivityLog>("sgf_activityLogs");
    auditLog = loadItem<AuditLog>("sgf_auditLog");
    companySettings = loadItem<CompanySettings>("sgf_companySettings");
    purchaseOrders = loadItem<PurchaseOrder>("sgf_purchaseOrders");
    quotes = loadItem<Quote>("sgf_quotes");
    suppliers = loadItem<Supplier>("sgf_suppliers");
    deliveryNotes = loadItem<DeliveryNote>("sgf_deliveryNotes");
    stockAdjustments = loadItem<StockAdjustment>("sgf_stockAdjustments");
    warehouses = loadItem<Warehouse>("sgf_warehouses");
    stockMovements = loadItem<StockMovement>("sgf_stockMovements");
    paymentTerms = loadItem<PaymentTerm>("sgf_paymentTerms");
    taxRates = loadItem<TaxRate>("sgf_taxRates");
    priceLists = loadItem<PriceList>("sgf_priceLists");
    notifications = loadItem<Notification>("sgf_notifications");
    reports = loadItem<Report>("sgf_reports");
    syncRecords = loadItem<SyncRecord>("sgf_syncRecords");

    // Initialize defaults if empty
    if (users.length === 0) {
      users = [...DEFAULT_USERS];
      saveItem("sgf_users", users);
    }
    if (companySettings.length === 0) {
      companySettings = [{ ...DEFAULT_COMPANY_SETTINGS }];
      saveItem("sgf_companySettings", companySettings);
    }
    if (products.length === 0) {
      products = [...DEFAULT_PRODUCTS];
      saveItem("sgf_products", products);
    }
    if (customers.length === 0) {
      customers = [...DEFAULT_CUSTOMERS];
      saveItem("sgf_customers", customers);
    }
    if (paymentTerms.length === 0) {
      paymentTerms = [...DEFAULT_PAYMENT_TERMS];
      saveItem("sgf_paymentTerms", paymentTerms);
    }
    if (taxRates.length === 0) {
      taxRates = [...DEFAULT_TAX_RATES];
      saveItem("sgf_taxRates", taxRates);
    }

    // Fix duplicate invoice numbers
    fixDuplicateInvoiceNumbers();

    logSystemEvent("info", "Data loaded successfully");
  } catch (error) {
    logSystemEvent("error", "Failed to load data", { error: String(error) });
  }
}

// =============================================================================
// FIX DUPLICATE INVOICE NUMBERS
// =============================================================================

export function fixDuplicateInvoiceNumbers(): { changes: Array<{ old: string; new: string; id: number; customer: string }> } {
  // NOTE: Do NOT call load() here — load() may call this function, causing infinite recursion.
  // This function is called during startup by load(), and also called standalone.
  // Calling load() here would create a stack overflow that blocks Chrome's main thread.
  const changes: Array<{ old: string; new: string; id: number; customer: string }> = [];

  try {
    const seen = new Map<string, number>();
    for (const invoice of invoices) {
      if (seen.has(invoice.invoiceNumber)) {
        const oldNumber = invoice.invoiceNumber;
        const newNumber = generateInvoiceNumber();
        invoice.invoiceNumber = newNumber;
        invoice.updatedAt = new Date().toISOString();
        changes.push({ old: oldNumber, new: newNumber, id: invoice.id, customer: invoice.customerName });
        logSystemEvent("warn", "Fixed duplicate invoice number", { old: oldNumber, new: newNumber, invoiceId: invoice.id });
      } else {
        seen.set(invoice.invoiceNumber, invoice.id);
      }
    }
    if (changes.length > 0) {
      saveItem("sgf_invoices", invoices);
      logSystemEvent("info", `Fixed ${changes.length} duplicate invoice numbers`);
    }
  } catch (error) {
    logSystemEvent("error", "Error fixing duplicate invoice numbers", { error: String(error) });
  }

  return { changes };
}
