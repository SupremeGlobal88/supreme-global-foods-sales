}

/** Auto-repair quotes that were incorrectly changed to orders via Edit.
 *  A broken quote has: QTE- prefix, orderType !== "quote", status !== "converted".
 *  Resets them back to proper quotes so the Convert to Order flow works.
 *  Returns count of repaired quotes. */
function repairBrokenQuotes(): number {
  let repaired = 0;
  for (const order of orders) {
    const orderNum = String(order.orderNumber || "");
    const isQuotePrefix = orderNum.toUpperCase().startsWith("QTE-");
    const isQuoteType = order.orderType === "quote";
    const isConverted = order.status === "converted";

    // Broken: QTE- prefix but NOT a quote type AND not already converted
    if (isQuotePrefix && !isQuoteType && !isConverted) {
      order.orderType = "quote";
      order.status = "draft";
      // Restore stock that was incorrectly deducted when changed to "regular"
      // (quotes never deduct stock, so if it was treated as an order, stock was deducted)
      if (order.items && Array.isArray(order.items)) {
        for (const item of order.items) {
          if (item.stockItemId != null && item.quantity != null) {
            const product = products.find((p) => p.id == item.stockItemId);
            if (product) {
              product.quantity = (product.quantity || 0) + item.quantity;
            }
          }
        }
      }
      repaired++;

    }
  }
  if (repaired > 0) {
    saveItem("sgf_products", products);
  }
  return repaired;
}

function load() {
  // Helper: safely load a data array from storage
  function safeLoadArray(key: string): any[] | null {
    try {
      const raw = getStorageItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : null;
    } catch (e) {
      logSystemEvent("ERROR", "load", `Failed to parse ${key}`, { error: String(e) });
      return null;
    }
  }

  try {
    // CUSTOMERS: load from localStorage if it's a valid array.
    // NEVER discard synced data due to length checks or missing keys.
    // Only fall back to static if localStorage is empty or corrupted.
    const c = safeLoadArray("sgf_customers");
    if (c && c.length > 0) customers = c;
    else customers = getStaticCustomers();

    // PRODUCTS: same approach — trust localStorage if it's a valid array
    const p = safeLoadArray("sgf_products");
    if (p && p.length > 0) {
      products = p;
      // PRICE REPAIR: If loaded products have 0 prices, restore from STATIC_PRODUCTS seed
      const priceRepair = repairProductPrices(products);
      if (priceRepair.count > 0) {
        saveItem("sgf_products", products);

        // Notify Firebase sync to push repaired products to cloud
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("sgf:productsRepaired", { detail: { products: priceRepair.repaired, count: priceRepair.count } }));
        }
      }
    } else products = getStaticProducts();

    // TRANSACTION DATA: always load if present (user-generated, never replace with static)
    const o = safeLoadArray("sgf_orders");
    if (o) orders = o;

    // AUTO-REPAIR: Fix quotes that were incorrectly changed to orders via Edit.
    // When someone edits a quote and changes orderType from "quote" to "regular",
    // the record keeps the QTE- prefix and "Draft" status but behaves like an order.
    // This repair resets them back to proper quotes so they can be converted correctly.
    const repairedQuotes = repairBrokenQuotes();
    if (repairedQuotes > 0) {

      saveItem("sgf_orders", orders);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("sgf:quotesRepaired", { detail: { count: repairedQuotes } }));
      }
    }

    const i = safeLoadArray("sgf_invoices");
    if (i) invoices = i;
    const a = safeLoadArray("sgf_appointments");
    if (a) appointments = a;
    const ci = safeLoadArray("sgf_checkins");
    if (ci) checkins = ci;
    const s = safeLoadArray("sgf_specialPrices");
    if (s) specialPrices = s;
    const log = safeLoadArray("sgf_auditLog");
    auditLog = log || [];
    const sysLog = safeLoadArray("sgf_systemLogs");
    systemLogs = sysLog || [];
    const fu = safeLoadArray("sgf_followUps");
    followUps = fu || [];
    const fa = safeLoadArray("sgf_followUpActions");
    followUpActions = fa || [];
    const cn = safeLoadArray("sgf_collectionNotes");
    collectionNotes = cn || [];
    const cp = safeLoadArray("sgf_collectionPromises");
    collectionPromises = cp || [];
    const ah = safeLoadArray("sgf_accountHolds");
    accountHolds = ah || [];
    const rc = safeLoadArray("sgf_receipts");
    receipts = rc || [];
    const crn = safeLoadArray("sgf_creditNotes");
    creditNotes = crn || [];

    // USERS: always load and merge with defaults
    const u = safeLoadArray("sgf_users");
    if (u) users = u;
    const DEFAULT_USERS = [
      { id: 1, name: "Collin", email: "", role: "super_admin", pin: "2580", isActive: true, createdAt: new Date().toISOString() },
      { id: 2, name: "Adeli", email: "", role: "sales_rep", pin: "1111", isActive: true, createdAt: new Date().toISOString() },
      { id: 3, name: "Inhouse", email: "", role: "sales_rep", pin: "2222", isActive: true, createdAt: new Date().toISOString() },
      { id: 4, name: "Michael", email: "", role: "sales_rep", pin: "3333", isActive: true, createdAt: new Date().toISOString() },
      { id: 5, name: "Nkosana", email: "", role: "sales_rep", pin: "4444", isActive: true, createdAt: new Date().toISOString() },
      { id: 6, name: "Tebogo Bila", email: "", role: "sales_rep", pin: "6666", isActive: true, createdAt: new Date().toISOString() },
      { id: 7, name: "Aggie", email: "", role: "admin", pin: "1018", isActive: true, createdAt: new Date().toISOString() },
      { id: 8, name: "Ronald", email: "", role: "super_admin", pin: "2581", isActive: true, createdAt: new Date().toISOString() },
      { id: 9, name: "Jolene", email: "", role: "admin", pin: "7777", isActive: true, createdAt: new Date().toISOString() },
      { id: 10, name: "David", email: "", role: "super_admin", pin: "8888", isActive: true, createdAt: new Date().toISOString() },
    ];
    if (!users || users.length === 0) {
      users = [...DEFAULT_USERS];
      saveItem("sgf_users", users);
    }
    // NOTE: Do NOT re-add default users here. If an admin deleted a user,
    // they must stay deleted. Re-adding causes "jumping back" bug.
    // Defaults are only injected on first load when users array is empty.
  } catch { /* ignore */ }

  // ─── CORPORATE MODULE DATA LOADING ───
  const cc = getStorageItem("sgf_corporateCustomers");
  if (cc) { const d = JSON.parse(cc); if (Array.isArray(d)) corporateCustomers = d; }
  else corporateCustomers = [];
  const po = getStorageItem("sgf_purchaseOrders");
  if (po) { const d = JSON.parse(po); if (Array.isArray(d)) purchaseOrders = d; }
  else purchaseOrders = [];
  const br = getStorageItem("sgf_barrels");
  if (br) { const d = JSON.parse(br); if (Array.isArray(d)) barrels = d; }
  else barrels = [];
  const coc = getStorageItem("sgf_certificatesOfCompliance");
  if (coc) { const d = JSON.parse(coc); if (Array.isArray(d)) certificatesOfCompliance = d; }
  else certificatesOfCompliance = [];
  const pll = getStorageItem("sgf_packingListLines");
