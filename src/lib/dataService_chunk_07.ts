      // Try old format: "CUST0001"
      const match = code.match(/^CUST(\d+)$/);
      if (match) return parseInt(match[1]);
      return 0;
    })
    .filter((n) => n > 0);
  const max = numericCodes.length > 0 ? Math.max(...numericCodes) : 10000;
  return String(max + 1);
}

load();

/** Re-read all data from localStorage — call after cloud sync writes new data */
/** Reload ALL data from localStorage into memory — NO validation.
 *  Called after Firebase sync to ensure synced data is loaded.
 *  The isValidArray checks in load() can discard legitimately deduplicated data,
 *  so this function bypasses them and loads directly. */
/** Repair stale credit allocations on invoices.
 *  Removes allocations for voided/non-existent credit notes and recalculates balances.
 *  Returns the number of invoices that were fixed. */
function repairCreditAllocations(): number {
  let fixed = 0;
  if (!invoices || invoices.length === 0) return 0;
  for (let i = 0; i < invoices.length; i++) {
    const inv = invoices[i];
    // Skip cancelled invoices — their balance should remain 0
    if (inv.status === "cancelled") continue;
    const existingCredits = inv.creditAllocations || [];

    // Reconstruct expected creditAllocations from credit note data
    const expectedCredits: any[] = [];
    for (const cn of creditNotes) {
      for (const alloc of (cn.allocations || [])) {
        if (alloc.invoiceId == inv.id) {
          expectedCredits.push({
            creditNoteId: cn.id,
            amount: alloc.amount,
            allocatedAt: alloc.allocatedAt,
          });
        }
      }
    }

    // Clean up existing: remove voided credits and deduplicate
    const validExisting = existingCredits.filter((ca: any) => {
      const cn = creditNotes.find((c) => c.id == ca.creditNoteId);
      return cn && !cn.voided;
    });
    const seen = new Set();
    const dedupedExisting = validExisting.filter((ca: any) => {
      if (seen.has(ca.creditNoteId)) return false;
      seen.add(ca.creditNoteId);
      return true;
    });

    // ALWAYS recalculate the correct balance from current data
    const totalAlloc = expectedCredits.reduce((sum: number, ca: any) => sum + (ca.amount || 0), 0);
    const invTotal = typeof inv.total === "number" ? inv.total : (inv.totalAmount || 0);
    const amountPaid = typeof inv.amountPaid === "number" ? inv.amountPaid : 0;
    let correctBalance = invTotal - amountPaid - totalAlloc;
    correctBalance = Math.round(correctBalance * 100) / 100;

    // Check if invoice needs fixing:
    // 1. Allocations don't match expected (missing or extra)
    // 2. Balance is mathematically wrong
    // 3. PHANTOM allocations exist (credit notes deleted but still in invoice array)
    const allocationsMismatch =
      dedupedExisting.length !== expectedCredits.length ||
      !expectedCredits.every((ec: any) =>
        dedupedExisting.some((ic: any) =>
          ic.creditNoteId == ec.creditNoteId && Math.abs((ic.amount || 0) - (ec.amount || 0)) < 0.01
        )
      );

    const balanceMismatch = Math.abs((inv.balanceDue || 0) - correctBalance) > 0.01;

    // PHANTOM: original array has items that validExisting filtered out (deleted credit notes)
    const phantomAllocations = existingCredits.length !== validExisting.length;

    if (allocationsMismatch || balanceMismatch || phantomAllocations) {
      // Also clean up creditedLines — remove entries for deleted/voided credit notes
      const validCreditedLines = (inv.creditedLines || []).filter((cl: any) => {
        const cn = creditNotes.find((c) => c.id == cl.creditNoteId);
        return cn && !cn.voided;
      });

      invoices[i] = {
        ...inv,
        balanceDue: correctBalance,
        creditAllocations: expectedCredits,
        creditedLines: validCreditedLines,
        status: correctBalance <= 0.01
          ? "paid"
          : amountPaid > 0.01
            ? "partially_paid"
            : inv.status === "paid"
              ? "sent"
              : inv.status,
        updatedAt: new Date().toISOString(),
      };
      fixed++;
    }
  }
  if (fixed > 0) {
    saveItem("sgf_invoices", invoices);
  }
  return fixed;
}

// Debounce reloadFromStorage to prevent UI freeze when multiple Firebase
// subscriptions fire simultaneously at startup. Each subscription's onValue
// callback calls reloadFromStorage(), which reads ALL data keys from
// localStorage and JSON.parses them. With 15+ subscriptions and 4276 invoices,
// calling this 15+ times in a row blocks the main thread for seconds.
let reloadDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let pendingReload = false;

/** Reload specific in-memory arrays from localStorage.
 *  If `keys` is provided, ONLY those keys are reloaded (much faster when
 *  a single subscription updates one data type). If omitted, ALL keys are
 *  reloaded (legacy behavior, used on initial load). */
export function reloadFromStorage(keys?: string[]): void {
  // If a reload is already scheduled, just mark it as pending
  if (reloadDebounceTimer) {
    pendingReload = true;
    return;
  }

  // Run immediately the first time, then debounce subsequent calls
  _doReloadFromStorage(keys);

  // Set a cooldown period: any calls within 150ms are coalesced into one
  reloadDebounceTimer = setTimeout(() => {
    reloadDebounceTimer = null;
    if (pendingReload) {
      pendingReload = false;
      _doReloadFromStorage(keys);
    }
  }, 150);
}

/** The actual reload logic — separated so debounce wrapper can call it. */
function _doReloadFromStorage(keys?: string[]): void {
  const reloadAll = !keys || keys.length === 0;

  if (reloadAll || keys?.includes("sgf_customers")) {
    try {
      const c = getStorageItem("sgf_customers");
      if (c) { const d = JSON.parse(c); if (Array.isArray(d) && d.length > 0) customers = d; }
    } catch { /* keep current */ }
  }
  if (reloadAll || keys?.includes("sgf_products")) {
    try {
      const p = getStorageItem("sgf_products");
      if (p) { const d = JSON.parse(p); if (Array.isArray(d) && d.length > 0) products = d; }
      // PRICE REPAIR after every cloud sync: Firebase may have 0-price products
      const priceRepair = repairProductPrices(products);
      if (priceRepair.count > 0) {
        saveItem("sgf_products", products);
        logSystemEvent("WARN", "priceRepair", `Reload repaired ${priceRepair.count} products after cloud sync`, { repaired: priceRepair.repaired.map((p: any) => p.productCode) });
        // Notify app that products were repaired so Firebase can be updated
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("sgf:productsRepaired", { detail: { products: priceRepair.repaired, count: priceRepair.count } }));
        }
      }
    } catch { /* keep current */ }
  }
  if (reloadAll || keys?.includes("sgf_orders")) {
    try {
      const o = getStorageItem("sgf_orders");
      if (o) { const d = JSON.parse(o); if (Array.isArray(d)) orders = d; }
    } catch { /* keep current */ }
  }
  if (reloadAll || keys?.includes("sgf_invoices")) {
    try {
      const i = getStorageItem("sgf_invoices");
      if (i) {
        const d = JSON.parse(i);
        if (Array.isArray(d)) {
          // Ensure all invoices have updatedAt for timestamp-based merge
          const now = new Date().toISOString();
          for (const inv of d) {
