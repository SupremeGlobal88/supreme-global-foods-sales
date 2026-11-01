            if (!inv.updatedAt) inv.updatedAt = inv.createdAt || inv.invoiceDate || now;
          }
          invoices = d;
          // AUTO-CLEANUP: Remove invoices linked to quotes after every cloud sync
          const beforeCleanup = invoices.length;
          const toRemove: number[] = [];
          for (let idx = 0; idx < invoices.length; idx++) {
            const inv = invoices[idx];
            const linkedOrderNum = String(inv.orderNumber || "");
            if (linkedOrderNum.toUpperCase().startsWith("QTE-")) {
              toRemove.push(idx);
              logSystemEvent("INFO", "invoiceCleanup", `Removing invoice ${inv.invoiceNumber} linked to quote ${linkedOrderNum}`, { invoiceId: inv.id, invoiceNumber: inv.invoiceNumber, quoteNumber: linkedOrderNum });
            }
          }
          for (let i = toRemove.length - 1; i >= 0; i--) {
            invoices.splice(toRemove[i], 1);
          }
          if (toRemove.length > 0) {
            saveItem("sgf_invoices", invoices);
            logSystemEvent("WARN", "invoiceCleanup", `Reload removed ${toRemove.length} invoice(s) linked to quotes`, { removedCount: toRemove.length });
            if (typeof window !== "undefined") {
              window.dispatchEvent(new CustomEvent("sgf:invoicesCleaned", { detail: { removed: toRemove.length } }));
            }
          }
        }
      }
    } catch { /* keep current */ }
  }
  if (reloadAll || keys?.includes("sgf_appointments")) {
    try {
      const a = getStorageItem("sgf_appointments");
      if (a) { const d = JSON.parse(a); if (Array.isArray(d)) appointments = d; }
    } catch { /* keep current */ }
  }
  if (reloadAll || keys?.includes("sgf_checkins")) {
    try {
      const ci = getStorageItem("sgf_checkins");
      if (ci) { const d = JSON.parse(ci); if (Array.isArray(d)) checkins = d; }
    } catch { /* keep current */ }
  }
  if (reloadAll || keys?.includes("sgf_specialPrices")) {
    try {
      const s = getStorageItem("sgf_specialPrices");
      if (s) { const d = JSON.parse(s); if (Array.isArray(d)) specialPrices = d; }
    } catch { /* keep current */ }
  }
  if (reloadAll || keys?.includes("sgf_auditLog")) {
    try {
      const log = getStorageItem("sgf_auditLog");
      if (log) { const d = JSON.parse(log); if (Array.isArray(d)) auditLog = d; }
    } catch { /* keep current */ }
  }
  if (reloadAll || keys?.includes("sgf_systemLogs")) {
    try {
      const sysLog = getStorageItem("sgf_systemLogs");
      if (sysLog) { const d = JSON.parse(sysLog); if (Array.isArray(d)) systemLogs = d; }
    } catch { /* keep current */ }
  }
  if (reloadAll || keys?.includes("sgf_followUps")) {
    try {
      const fu = getStorageItem("sgf_followUps");
      if (fu) { const d = JSON.parse(fu); if (Array.isArray(d)) followUps = d; }
    } catch { /* keep current */ }
  }
  if (reloadAll || keys?.includes("sgf_followUpActions")) {
    try {
      const fa = getStorageItem("sgf_followUpActions");
      if (fa) { const d = JSON.parse(fa); if (Array.isArray(d)) followUpActions = d; }
    } catch { /* keep current */ }
  }
  if (reloadAll || keys?.includes("sgf_collectionNotes")) {
    try {
      const cn = getStorageItem("sgf_collectionNotes");
      if (cn) { const d = JSON.parse(cn); if (Array.isArray(d)) collectionNotes = d; }
    } catch { /* keep current */ }
  }
  if (reloadAll || keys?.includes("sgf_collectionPromises")) {
    try {
      const cp = getStorageItem("sgf_collectionPromises");
      if (cp) { const d = JSON.parse(cp); if (Array.isArray(d)) collectionPromises = d; }
    } catch { /* keep current */ }
  }
  if (reloadAll || keys?.includes("sgf_accountHolds")) {
    try {
      const ah = getStorageItem("sgf_accountHolds");
      if (ah) { const d = JSON.parse(ah); if (Array.isArray(d)) accountHolds = d; }
    } catch { /* keep current */ }
  }
  if (reloadAll || keys?.includes("sgf_receipts")) {
    try {
      const rc = getStorageItem("sgf_receipts");
      if (rc) { const d = JSON.parse(rc); if (Array.isArray(d)) receipts = d; }
    } catch { /* keep current */ }
  }
  if (reloadAll || keys?.includes("sgf_creditNotes")) {
    try {
      const crn = getStorageItem("sgf_creditNotes");
      if (crn) { const d = JSON.parse(crn); if (Array.isArray(d)) creditNotes = d; }
    } catch { /* keep current */ }
  }
  if (reloadAll || keys?.includes("sgf_users")) {
    try {
      const u = getStorageItem("sgf_users");
      if (u) { const d = JSON.parse(u); if (Array.isArray(d) && d.length > 0) users = d; }
    } catch { /* keep current */ }
  }
  if (reloadAll || keys?.includes("sgf_salesReps")) {
    try {
      const sr = getStorageItem("sgf_salesReps");
      if (sr) {
        const d = JSON.parse(sr);
        if (Array.isArray(d) && d.length > 0) {
          // Backward compat: migrate legacy string arrays to objects
          SALES_REPS.length = 0;
          SALES_REPS.push(...d.map((r: any): SalesRep => {
            if (typeof r === "string") return { name: r, isActive: true };
            return {
              name: r?.name || String(r || ""),
              email: r?.email || "",
              phone: r?.phone || "",
              region: r?.region || "",
              vehicleReg: r?.vehicleReg || "",
              isActive: r?.isActive !== false,
            };
          }).filter((r: SalesRep) => r.name));
        }
      }
    } catch { /* keep current */ }
  }
  if (reloadAll || keys?.includes("sgf_corporateCustomers")) {
    try {
      const cc = getStorageItem("sgf_corporateCustomers");
      if (cc) { const d = JSON.parse(cc); if (Array.isArray(d)) corporateCustomers = d; }
    } catch { /* keep current */ }
  }
  if (reloadAll || keys?.includes("sgf_purchaseOrders")) {
    try {
      const po = getStorageItem("sgf_purchaseOrders");
      if (po) { const d = JSON.parse(po); if (Array.isArray(d)) purchaseOrders = d; }
    } catch { /* keep current */ }
  }
  if (reloadAll || keys?.includes("sgf_barrels")) {
    try {
      const br = getStorageItem("sgf_barrels");
      if (br) { const d = JSON.parse(br); if (Array.isArray(d)) barrels = d; }
    } catch { /* keep current */ }
  }
  if (reloadAll || keys?.includes("sgf_certificatesOfCompliance") || keys?.includes("sgf_cocs")) {
    try {
      // Support both keys: sgf_cocs (used by subscriptions) and sgf_certificatesOfCompliance
      const coc = getStorageItem("sgf_cocs") || getStorageItem("sgf_certificatesOfCompliance");
      if (coc) { const d = JSON.parse(coc); if (Array.isArray(d)) certificatesOfCompliance = d; }
    } catch { /* keep current */ }
  }
  if (reloadAll || keys?.includes("sgf_packingListLines")) {
    try {
      const pll = getStorageItem("sgf_packingListLines");
      if (pll) { const d = JSON.parse(pll); if (Array.isArray(d)) packingListLines = d; }
    } catch { /* keep current */ }
  }
}

/** Fix duplicate SGF invoice numbers. Renames duplicates to next available number.
 *  Returns list of changes made for audit trail.
 */
export function fixDuplicateInvoiceNumbers(): { changes: Array<{ old: string; new: string; id: number; customer: string }> } {
  load(); // Ensure fresh data
  const changes: Array<{ old: string; new: string; id: number; customer: string }> = [];
  const seenNumbers = new Map<string, number>(); // invoiceNumber -> first invoice index

  // Sort by createdAt ascending so the oldest keeps the original number
