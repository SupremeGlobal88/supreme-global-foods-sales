          notes: `Invoice for PO ${po.poNumber} | Customer: ${po.corporateCustomerName || ""}`,
        };
        saveItem("sgf_invoices", invoices);
        return existing.invoiceNumber;
      }

      // Create new invoice
      const now = new Date();
      const dueDate = new Date(now);
      dueDate.setDate(dueDate.getDate() + days);

      const invCompany = po.company || "sgf";
      let invoiceNumber = getNextInvoiceNumberForCompany(invCompany);
      const existingNumbers = new Set(invoices.map((i) => i.invoiceNumber));
      let safetyCounter = 0;
      while (existingNumbers.has(invoiceNumber) && safetyCounter < 100) {
        const match = invoiceNumber.match(/(SGF|RC)(\d+)/);
        if (match) {
          const prefix = match[1];
          const n = parseInt(match[2]) + 1;
          invoiceNumber = prefix === "RC" ? `RC${String(n).padStart(4, "0")}` : `SGF${n}`;
        }
        safetyCounter++;
      }

      const nextInvId = invoices.length > 0 ? Math.max(...invoices.map((i) => Number(i.id) || 0)) + 1 : 1;
      const poRef = po.poNumber || `PO-${po.id}`;

      const invoice = {
        id: nextInvId,
        purchaseOrderId: po.id,
        poNumber: po.poNumber,
        orderNumber: poRef,
        invoiceNumber,
        deliveryNoteNumber: `DN-${poRef}`,
        company: invCompany,
        customerId: mainCustomerId,
        customerName: richCustomer?.name || po.corporateCustomerName || "",
        customer: richCustomer,
        subtotal,
        vatAmount,
        vatRate,
        total,
        totalAmount: total,
        balanceDue: total,
        amountPaid: 0,
        status: "draft",
        paymentTerms,
        invoiceDate: now.toISOString(),
        dueDate: dueDate.toISOString(),
        notes: `Invoice for PO ${po.poNumber} | Customer: ${po.corporateCustomerName || ""}`,
        items: items.map((item: any) => ({
          description: `${item.customerStockCode || ""} - ${item.customerDescription || ""}`,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          lineTotal: item.quantity * item.unitPrice,
        })),
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };
      invoices.push(invoice);
      saveItem("sgf_invoices", invoices);
      logSystemEvent("INFO", "invoiceGeneration", `generateInvoiceForPO END invoiceNumber=${invoice.invoiceNumber}, poNumber=${po.poNumber}, newInvoiceCount=${invoices.length}`);
      return invoice;
    } finally {
      invoiceGenerationLock = false;
    }
  },
};

/** Reset all transaction data (orders, invoices, receipts, etc.) but keep users, customers, products, settings */
export function resetTransactionData(): void {
  orders = [];
  invoices = [];
  receipts = [];
  creditNotes = [];
  appointments = [];
  checkins = [];
  followUps = [];
  followUpActions = [];
  specialPrices = [];
  collectionNotes = [];
  collectionPromises = [];
  accountHolds = [];
  auditLog = [];
  systemLogs = [];

  const keysToRemove = [
    "sgf_orders", "sgf_invoices", "sgf_receipts", "sgf_creditNotes", "sgf_appointments",
    "sgf_checkins", "sgf_specialPrices", "sgf_auditLog", "sgf_followUps",
    "sgf_followUpActions", "sgf_collectionNotes", "sgf_collectionPromises",
    "sgf_accountHolds",
  ];
  keysToRemove.forEach(k => localStorage.removeItem(k));
}

/** Clear only appointments and check-ins */
export function clearAppointmentsAndCheckins(): void {
  appointments = [];
  checkins = [];
  removeStorageItem("sgf_appointments");
  removeStorageItem("sgf_checkins");
}

/** Full factory reset — clears EVERYTHING and reloads defaults */
export function factoryReset(): void {
  // Step 1: Disconnect Firebase to prevent re-download
  try {
    const { disconnectFirebase } = require("./firebaseSync");
    if (disconnectFirebase) disconnectFirebase();
  } catch { /* ignore if firebaseSync not loaded */ }
  localStorage.setItem("sgf_firebase_disconnected", "true");
  // Step 2: Clear all localStorage
  const allKeys = Object.keys(localStorage).filter(k => k.startsWith("sgf_"));
  allKeys.forEach(k => localStorage.removeItem(k));
  // Step 3: Keep disconnect flag set (re-add after clearing)
  localStorage.setItem("sgf_firebase_disconnected", "true");
  // Step 4: Reset ALL in-memory arrays including users
  orders = []; invoices = []; receipts = []; creditNotes = []; appointments = []; checkins = [];
  followUps = []; followUpActions = []; specialPrices = [];
  collectionNotes = []; collectionPromises = []; accountHolds = []; auditLog = []; systemLogs = []; users = [];
  // Step 5: Reset customers and products back to original static defaults
  customers = getStaticCustomers();
  products = getStaticProducts();
  // Step 6: Re-create default users
  load();
}

/**
 * DIRECT LOGIN — bypasses tRPC/localLink entirely.
 * Called directly from Login.tsx. Checks hardcoded defaults first.
 */
export function directAuthenticate(name: string, pin: string): { id: number; name: string; email: string; role: string; pin?: string } | null {
  const DEFAULT_USERS = [
    { id: 1, name: "Collin", email: "", role: "super_admin", pin: "2580" },
    { id: 2, name: "Adeli", email: "", role: "sales_rep", pin: "1111" },
    { id: 3, name: "Inhouse", email: "", role: "sales_rep", pin: "2222" },
    { id: 4, name: "Michael", email: "", role: "sales_rep", pin: "3333" },
    { id: 5, name: "Nkosana", email: "", role: "sales_rep", pin: "4444" },
    { id: 6, name: "Tebogo Bila", email: "", role: "sales_rep", pin: "6666" },
    { id: 7, name: "Aggie", email: "", role: "admin", pin: "1018" },
    { id: 8, name: "Ronald", email: "", role: "super_admin", pin: "2581" },
    { id: 9, name: "Jolene", email: "", role: "admin", pin: "7777" },
    { id: 10, name: "David", email: "", role: "super_admin", pin: "8888" },
  ];

  const ADMIN_ALIASES = ["admin", "administrator", "superadmin"];
  const typedName = name.toLowerCase().trim();
  const typedPin = String(pin); // Normalize: Firebase may store PIN as number

  // 1. Check stored users FIRST (so User Management additions work without code changes)
  try {
    const raw = getStorageItem("sgf_users");
    if (raw) {
      const stored = JSON.parse(raw);
      // Exact name match
      const found = stored.find(
        (x: any) => x.name?.toLowerCase() === typedName && String(x.pin) === typedPin && x.isActive !== false
      );
      if (found) {
        const hardcoded = DEFAULT_USERS.find((u) => u.id == found.id || u.name.toLowerCase() === found.name?.toLowerCase());
        const resolvedPin = found.pin != null ? found.pin : hardcoded?.pin;
        return { id: found.id, name: found.name, email: found.email, role: found.role, pin: resolvedPin };
      }
      // Admin alias match — check if any stored user has this PIN and is admin
      if (ADMIN_ALIASES.includes(typedName)) {
        const adminFound = stored.find(
          (x: any) => (x.role === "admin" || x.role === "super_admin") && String(x.pin) === typedPin && x.isActive !== false
        );
        if (adminFound) {
          const hardcoded = DEFAULT_USERS.find((u) => u.id == adminFound.id || u.name.toLowerCase() === adminFound.name?.toLowerCase());
          const resolvedPin = adminFound.pin != null ? adminFound.pin : hardcoded?.pin;
          return { id: adminFound.id, name: adminFound.name, email: adminFound.email, role: adminFound.role, pin: resolvedPin };
