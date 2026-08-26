import { dataService, reloadFromStorage, fixDraftInvoicesForDeliveredOrders, fixSageInvoiceDates, parseBankStatement, matchBankPayments, allocateBankPayments, getAARate, setAARate } from "./dataService";
import { getStorageItem, setStorageItem } from "./compressedStorage";
import { observable } from "@trpc/server/observable";
import {
  pushOrder, pushAppointment, pushCheckin, pushInvoice, pushInvoices,
  pushOneCustomer, removeOneCustomer, pushOneStockItem, removeOneStockItem, pushStock,
  pushFollowUpAction, pushFollowUp, pushOneReceipt, pushReceipts,
  pushUser, pushUserDelete, pushAppointmentDelete, pushCheckinDelete,
  pushSalesRep, removeSalesRep, pushCreditNote,
  pushCorporateCustomer, removeCorporateCustomer,
  pushPurchaseOrder, removePurchaseOrder,
  pushBarrel, removeBarrel,
  pushCOC, removeCOC,
  pushPackingListLine, removePackingListLine,
  isFirebaseReady, readFromFirebase, mergeWithCloudData,
} from "./firebaseSync";

/** SAFE SYNC: Read latest data from Firebase, MERGE with local, save, reload.
 *  Every query handler calls this to ensure users see LIVE cloud data.
 *  CRITICAL: mergeWithCloudData returns merged array but does NOT write to
 *  localStorage. We must save the result before calling reloadFromStorage().
 *  
 *  ERROR LOGGING: Every error is logged to console so we can diagnose sync issues.
 *  Previously errors were silently swallowed, making it impossible to debug. */
// Track last sync time per data type to prevent excessive Firebase reads
const lastSyncTimes: Record<string, number> = {};
const SYNC_COOLDOWN_MS = 5000; // Only sync same type every 5 seconds minimum

/** Smart sync: if localStorage has actual data, return immediately and sync in background.
 *  If localStorage is empty/null, block and download from cloud first.
 *  This ensures first-time visitors get cloud data, while repeat visitors
 *  see instant pages with background updates. */
async function smartSync(type: string, storageKey: string): Promise<void> {
  let hasData = false;
  try {
    const raw = getStorageItem(storageKey);
    const parsed = JSON.parse(raw);
    hasData = Array.isArray(parsed) && parsed.length > 0;
  } catch {
    // Corrupted data — treat as empty and re-download
    hasData = false;
  }
  if (hasData) {
    syncFromCloud(type, storageKey); // fire-and-forget refresh
  } else {
    await syncFromCloud(type, storageKey); // block until downloaded
  }
}

async function syncFromCloud(type: string, storageKey: string): Promise<void> {
  if (!isFirebaseReady()) { console.warn("[syncFromCloud] Firebase not ready for", type); return; }

  // Rate limit: don't sync same type more than every 5 seconds
  const now = Date.now();
  const lastSync = lastSyncTimes[type] || 0;
  if (now - lastSync < SYNC_COOLDOWN_MS) {
    return; // Too soon since last sync
  }
  lastSyncTimes[type] = now;

  try {
    console.log("[syncFromCloud] Reading", type, "from Firebase...");
    const cloudData = await readFromFirebase(type);
    console.log("[syncFromCloud] Firebase returned", cloudData.length, type);

    // CRITICAL FIX: Re-read localStorage AFTER readFromFirebase returns.
    // During the read (which can take 30s), onValue subscriptions may have
    // already populated localStorage with fresh data. We must NOT overwrite
    // that data with an empty array from a timeout.
    const currentLocal = JSON.parse(getStorageItem(storageKey) || "[]");
    const before = currentLocal.length;

    // SAFETY: If Firebase returned 0 items but localStorage already has data,
    // this is likely a timeout or connection issue — DON'T overwrite local data.
    if (cloudData.length === 0 && before > 0) {
      console.warn(`[syncFromCloud] SAFETY: Firebase returned 0 ${type} but local has ${before} items. Skipping overwrite.`);
      reloadFromStorage();
      return;
    }
    const merged = mergeWithCloudData(storageKey, cloudData);
    const after = merged.length;
    setStorageItem(storageKey, JSON.stringify(merged));
    reloadFromStorage();
    if (after !== before) {
      console.log(`[syncFromCloud] ${type}: ${before} local → merged ${after} items (${after - before > 0 ? '+' : ''}${after - before} from cloud)`);
    }
  } catch (e: any) {
    console.error("[syncFromCloud] FAILED for", type, ":", e.message || e);
    // Even on error, reload from localStorage so subscriptions' data is used
    reloadFromStorage();
  }
}

/** Push data to Firebase after local write. All pushes are awaited with error logging.
 *  If Firebase is not ready, the individual push functions will queue items for later sync.
 */
async function fbPush(type: "order" | "appointment" | "checkin" | "invoice" | "customer" | "user" | "userDeleted", item: any) {
  try {
    switch (type) {
      case "order": {
        await pushOrder(item);
        // Also push the associated invoice so admin sees it
        const invoices = dataService.invoice.list();
        const inv = invoices.find((i: any) => i.orderId == item.id);
        if (inv) await pushInvoice(inv);
        break;
      }
      case "appointment": await pushAppointment(item); break;
      case "checkin": await pushCheckin(item); break;
      case "invoice": await pushInvoice(item); break;
      case "customer": {
        // SAFE: push only the individual customer, not the entire list.
        // This prevents overwriting other users' customers that were created
        // on other devices between our last pull and this push.
        await pushOneCustomer(item);
        break;
      }
      case "user": await pushUser(item); break;
      case "userDeleted": await pushUserDelete(item); break;
    }
  } catch (e: any) { console.error("[fbPush] FAILED:", type, item?.id, e?.message || e); }
}

export function createLocalLink() {
  return () =>
    ({ op }: any) =>
      observable((observer) => {
        (async () => {
          try {
            const path = op.path;
            const input = op.input;
            let result: any = null;

            switch (path) {
              case "auth.me": result = dataService.auth.me(); break;
              // STOCK — smart sync: block if empty, fire-and-forget if has data
              case "stock.list": await smartSync("stock", "sgf_products"); result = dataService.stock.list(); break;
              case "stock.search": await smartSync("stock", "sgf_products"); result = dataService.stock.search(input || { query: "" }); break;
              case "stock.getById": await syncFromCloud("stock", "sgf_products"); result = dataService.stock.getById(input); break;
              case "stock.getCategories": result = dataService.stock.getCategories(); break;
              case "stock.getStats": await syncFromCloud("stock", "sgf_products"); result = dataService.stock.getStats(); break;
              case "stock.getDailyInvoicedStock": result = dataService.stock.getDailyInvoicedStock(input || {}); break;
              case "stock.reconcileStock": result = dataService.stock.reconcileStock(input || {}); break;
              case "stock.create": { result = dataService.stock.create(input); await pushOneStockItem(result); reloadFromStorage(); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "stock", count: 1 } })); break; }
              case "stock.update": { const { id, data } = input; result = dataService.stock.update({ id, data }); if (result) { await pushOneStockItem(result); reloadFromStorage(); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "stock", count: 1 } })); } break; }
              case "stock.delete": { result = dataService.stock.delete(input); await removeOneStockItem(input); reloadFromStorage(); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "stock", count: 1 } })); break; }
              case "stock.bulkUpload": {
                const items = input || [];
                const { created, updated } = dataService.stock.bulkCreate(items);
                result = { count: created + updated, created, updated };
                await pushStock(dataService.stock.list());
                reloadFromStorage();
                window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "stock", count: created + updated } }));
                break;
              }
              // CUSTOMERS — smart sync: block if empty, fire-and-forget if has data
              case "customer.list": await smartSync("customers", "sgf_customers"); result = dataService.customer.list(); break;
              case "customer.search": await smartSync("customers", "sgf_customers"); result = dataService.customer.search(input || { query: "" }); break;
              case "customer.getById": await syncFromCloud("customers", "sgf_customers"); result = dataService.customer.getById(input); break;
              case "customer.create": { result = dataService.customer.create(input); await fbPush("customer", result); reloadFromStorage(); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "customers", count: 1 } })); break; }
              case "customer.update": { const { id, data } = input; result = dataService.customer.update({ id, data }); if (result) { await pushOneCustomer(result); reloadFromStorage(); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "customers", count: 1 } })); } break; }
              case "customer.delete": { result = dataService.customer.delete(input); await removeOneCustomer(input); reloadFromStorage(); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "customers", count: 1 } })); break; }
              case "customer.getStats": await syncFromCloud("customers", "sgf_customers"); result = dataService.customer.getStats(); break;
              case "customer.getSalesReps": result = dataService.customer.getSalesReps(); break;
              case "customer.bulkUpload": result = dataService.customer.bulkUpload(input || []); break;
              case "customer.getCustomersNeedingFollowUp": await syncFromCloud("customers", "sgf_customers"); result = dataService.customer.getCustomersNeedingFollowUp(input?.days || 10); break;
              // ORDERS — smart sync: block if empty, fire-and-forget if has data
              case "order.list": await smartSync("orders", "sgf_orders"); result = dataService.order.list(); break;
              case "order.getById": await syncFromCloud("orders", "sgf_orders"); result = dataService.order.getById(input); break;
              case "order.create": {
                result = dataService.order.create(input);
                await fbPush("order", result);
                // Push updated stock to Firebase so all devices see deducted quantities
                await pushStock(dataService.stock.list());
                window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "stock", count: 1 } }));
                // If sample order: push the follow-up to Firebase so all devices see it
                if (input?.orderType === "sample" && result?.id) {
                  const fu = dataService.followUp.list().find((f: any) => f.orderId == result.id);
                  if (fu) await pushFollowUp(fu);
                  window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "followUps", count: 1 } }));
                }
                break;
              }
              case "order.update": {
                const { id, data } = input;
                result = dataService.order.update({ id, data });
                await fbPush("order", result);
                // Push updated stock to Firebase so all devices see updated quantities
                await pushStock(dataService.stock.list());
                window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "stock", count: 1 } }));
                if (data?.orderType === "sample" && result?.id) {
                  const fu = dataService.followUp.list().find((f: any) => f.orderId == result.id);
                  if (fu) await pushFollowUp(fu);
                  window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "followUps", count: 1 } }));
                }
                break;
              }
              case "order.updateStatus": {
                const updateResult = dataService.order.updateStatus(input);
                result = updateResult?.order || updateResult;
                await fbPush("order", result);
                // Push updated stock to Firebase (cancelled orders restore stock)
                await pushStock(dataService.stock.list());
                window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "stock", count: 1 } }));
                // If order was cancelled and a linked invoice was also cancelled, push it
                if (updateResult?.cancelledInvoice) {
                  await pushInvoice(updateResult.cancelledInvoice);
                  window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: 1 } }));
                }
                break;
              }
              case "order.generateInvoice": {
                // CRITICAL FIX: generateInvoiceForOrder creates the invoice locally
                // but does NOT push to Firebase. We must find the created invoice
                // and push it so all users can see it.
                result = dataService.generateInvoiceForOrder(input?.orderId);
                if (result && input?.orderId) {
                  const inv = dataService.invoice.list().find((i: any) => i.orderId == input.orderId);
                  if (inv) {
                    const pushResult = await pushInvoice(inv);
                    if (pushResult.success) {
                      console.log("[generateInvoice] Pushed invoice", inv.invoiceNumber, "to Firebase");
                    } else {
                      console.error("[generateInvoice] PUSH FAILED:", inv.invoiceNumber, pushResult.error);
                      alert("Warning: Invoice " + inv.invoiceNumber + " created but could not sync to cloud. Please go to Settings and click 'Replace All Invoices in Cloud'.");
                    }
                    window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: 1 } }));
                  } else {
                    console.error("[generateInvoice] Could not find invoice for order", input.orderId);
                  }
                }
                break;
              }
              case "order.getStats": await syncFromCloud("orders", "sgf_orders"); result = dataService.order.getStats(); break;
              case "order.checkExistingSample": result = dataService.order.checkExistingSample(input); break;
              case "order.generateMissingInvoices": result = dataService.generateMissingInvoices(); for (const inv of dataService.invoice.list()) { await pushInvoice(inv); } break;
              // INVOICES — smart sync: block if empty, fire-and-forget if has data
              case "invoice.list": await smartSync("invoices", "sgf_invoices"); result = dataService.invoice.list(); break;
              case "invoice.generateForPO": result = dataService.generateInvoiceForPO(input); if (result) { const inv = dataService.invoice.list().find((i: any) => i.invoiceNumber === result); if (inv) await pushInvoice(inv); } window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: 1 } })); break;
              case "invoice.getById": await syncFromCloud("invoices", "sgf_invoices"); result = dataService.invoice.getById(input); break;
              case "invoice.create": result = dataService.invoice.create(input); await fbPush("invoice", result); break;
              case "invoice.updateStatus": result = dataService.invoice.updateStatus(input); await fbPush("invoice", result); break;
              case "invoice.update": result = dataService.invoice.updateInvoice(input); if (result) await fbPush("invoice", result); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: 1 } })); break;
              case "invoice.recordPayment": result = dataService.invoice.recordPayment(input); if (input?.invoiceId) { const inv = dataService.invoice.list().find((i: any) => i.id == input.invoiceId); if (inv) await pushInvoice(inv); if (result?.receipt) await pushOneReceipt(result.receipt); } window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: 1 } })); break;
              case "invoice.editPayment": result = dataService.invoice.editPayment(input); if (input?.invoiceId) { const inv = dataService.invoice.list().find((i: any) => i.id == input.invoiceId); if (inv) await pushInvoice(inv); } window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: 1 } })); break;
              case "invoice.deletePayment": result = dataService.invoice.deletePayment(input); if (input?.invoiceId) { const inv = dataService.invoice.list().find((i: any) => i.id == input.invoiceId); if (inv) await pushInvoice(inv); } window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: 1 } })); break;
              case "invoice.getCustomerStatement": await syncFromCloud("invoices", "sgf_invoices"); result = dataService.invoice.getCustomerStatement(input); break;
              case "invoice.getStats": await syncFromCloud("invoices", "sgf_invoices"); result = dataService.invoice.getStats(); break;
              case "invoice.getReceipts": await syncFromCloud("receipts", "sgf_receipts"); result = dataService.invoice.getReceipts(); break;
              case "invoice.getReceiptsByInvoice": await syncFromCloud("receipts", "sgf_receipts"); result = dataService.invoice.getReceiptsByInvoice(input); break;
              case "invoice.getReceiptsByCustomer": await syncFromCloud("receipts", "sgf_receipts"); result = dataService.invoice.getReceiptsByCustomer(input); break;
              case "invoice.getReceiptById": await syncFromCloud("receipts", "sgf_receipts"); result = dataService.invoice.getReceiptById(input); break;
              case "invoice.bulkHistoricalImport": result = dataService.invoice.bulkHistoricalImport(input); await pushInvoices(dataService.invoice.list()); break;
              case "invoice.relinkSageInvoices": {
                result = dataService.invoice.relinkSageInvoices();
                if (result?.changedInvoices && result.changedInvoices.length > 0) {
                  for (const inv of result.changedInvoices) {
                    try { await pushInvoice(inv); } catch (e) { console.warn("[relink] push failed for", inv.invoiceNumber, e); }
                  }
                }
                break;
              }
              case "invoice.fixDraftInvoices": {
                result = fixDraftInvoicesForDeliveredOrders();
                if (result?.invoices && result.invoices.length > 0) {
                  // Push all fixes concurrently — much faster than sequential await
                  await Promise.all(result.invoices.map((inv) =>
                    pushInvoice(inv).catch((e: any) => console.warn("[fixDraft] push failed for", inv.invoiceNumber, e))
                  ));
                  window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: result.invoices.length } }));
                }
                break;
              }
              case "invoice.fixSageDates": {
                result = fixSageInvoiceDates();
                if (result?.invoices && result.invoices.length > 0) {
                  // Push all fixes concurrently — much faster than sequential await
                  await Promise.all(result.invoices.map((inv) =>
                    pushInvoice(inv).catch((e: any) => console.warn("[fixSageDate] push failed for", inv.invoiceNumber, e))
                  ));
                  window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: result.invoices.length } }));
                }
                break;
              }
              case "invoice.parseBankStatement": {
                result = parseBankStatement(input || []);
                break;
              }
              case "invoice.matchBankPayments": {
                result = matchBankPayments(input || []);
                break;
              }
              case "invoice.allocateBankPayments": {
                result = allocateBankPayments(input || []);
                if (result?.processed > 0) {
                  const allInvs = dataService.invoice.list();
                  const changedInvs = allInvs.filter((i: any) => (input || []).some((a: any) => a.invoiceId == i.id));
                  await Promise.all(changedInvs.map((inv: any) =>
                    pushInvoice(inv).catch((e: any) => console.warn("[bankAlloc] push failed for", inv.invoiceNumber, e))
                  ));
                  window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: changedInvs.length } }));
                }
                break;
              }
              case "invoice.getCreditNotes": await syncFromCloud("creditNotes", "sgf_creditNotes"); result = dataService.invoice.getCreditNotes(); break;
              case "invoice.getCreditNotesByInvoice": await syncFromCloud("creditNotes", "sgf_creditNotes"); result = dataService.invoice.getCreditNotesByInvoice(input); break;
              case "invoice.getCreditNotesByCustomer": await syncFromCloud("creditNotes", "sgf_creditNotes"); result = dataService.invoice.getCreditNotesByCustomer(input); break;
              case "invoice.getCustomerCreditBalance": await syncFromCloud("creditNotes", "sgf_creditNotes"); result = dataService.invoice.getCustomerCreditBalance(input); break;
              case "invoice.createCreditNote": {
                result = dataService.invoice.createCreditNote(input);
                if (result?.creditNote) {
                  await pushCreditNote(result.creditNote);
                  // Use the returned updated invoice directly — don't re-find,
                  // as reloadFromStorage or syncFromCloud may have replaced the array
                  if (result.updatedInvoice) {
                    await pushInvoice(result.updatedInvoice);
                  }
                  // Push updated stock quantities back to Firebase (stock returned to inventory)
                  for (const li of (result.creditNote.lineItems || [])) {
                    if (li.stockItemId) {
                      const prod = dataService.stock.getById(li.stockItemId);
                      if (prod) await pushOneStockItem(prod);
                    }
                  }
                }
                window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: 1 } }));
                break;
              }
              case "invoice.allocateCredit": {
                result = dataService.invoice.allocateCredit(input);
                if (result && result.success) {
                  await pushCreditNote(result.creditNote);
                  await pushInvoice(result.invoice);
                  // Push updated stock quantities back to Firebase
                  for (const li of (result.creditNote.lineItems || [])) {
                    if (li.stockItemId) {
                      const prod = dataService.stock.getById(li.stockItemId);
                      if (prod) await pushOneStockItem(prod);
                    }
                  }
                }
                window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: 1 } }));
                break;
              }
              case "invoice.voidCreditNoteAllocation": {
                result = dataService.invoice.voidCreditNoteAllocation(input);
                if (result && result.success) {
                  await pushCreditNote(result.creditNote);
                  // Push all affected invoices back
                  const inv = dataService.invoice.list().find((i: any) => i.id == input.invoiceId);
                  if (inv) await pushInvoice(inv);
                }
                window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: 1 } }));
                break;
              }
              case "invoice.voidCreditNote": {
                result = dataService.invoice.voidCreditNote(input);
                if (result) {
                  await pushCreditNote(result);
                  // Push all affected invoices (original + any allocated)
                  if (result.invoiceId) {
                    const inv = dataService.invoice.list().find((i: any) => i.id == result.invoiceId);
                    if (inv) await pushInvoice(inv);
                  }
                  // Also push invoices that had allocations from this credit note
                  if (result.allocations && result.allocations.length > 0) {
                    for (const alloc of result.allocations) {
                      const inv = dataService.invoice.list().find((i: any) => i.id == alloc.invoiceId);
                      if (inv) await pushInvoice(inv);
                    }
                  }
                  // Push updated stock quantities back to Firebase (stock restored from void)
                  for (const li of (result.lineItems || [])) {
                    if (li.stockItemId) {
                      const prod = dataService.stock.getById(li.stockItemId);
                      if (prod) await pushOneStockItem(prod);
                    }
                  }
                }
                window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: 1 } }));
                break;
              }
              case "invoice.createOrderFromInvoice": {
                result = dataService.order.createFromInvoice(input);
                if (result) {
                  await fbPush("order", result);
                  window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "orders", count: 1 } }));
                }
                break;
              }
              // USERS — smart sync: block if empty, fire-and-forget if has data
              case "user.list": await smartSync("users", "sgf_users"); result = dataService.user.list(); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "users", count: result.length } })); break;
              case "user.getById": result = dataService.user.getById(input); break;
              case "user.authenticate": result = dataService.user.authenticate(input); break;
              case "user.create": result = dataService.user.create(input); await fbPush("user", result); break;
              case "user.update": { const { id, data } = input; result = dataService.user.update({ id, data }); await fbPush("user", result); break; }
              case "user.delete": result = dataService.user.delete(input); await fbPush("userDeleted", input); break;
              case "user.toggleActive": result = dataService.user.toggleActive(input); await fbPush("user", result); break;
              case "user.resetPin": result = dataService.user.resetPin(input); await fbPush("user", result); break;
              // APPOINTMENTS — smart sync: block if empty, fire-and-forget if has data
              case "appointment.list": await smartSync("appointments", "sgf_appointments"); result = dataService.appointment.list(); break;
              case "appointment.create": result = dataService.appointment.create(input); await fbPush("appointment", result); break;
              case "appointment.update": { const { id, data } = input; result = dataService.appointment.update({ id, data }); await fbPush("appointment", result); break; }
              case "appointment.delete": result = dataService.appointment.delete(input); await pushAppointmentDelete(input); break;
              case "appointment.updateStatus": result = dataService.appointment.updateStatus(input); await fbPush("appointment", result); break;
              case "appointment.getStats": await syncFromCloud("appointments", "sgf_appointments"); result = dataService.appointment.getStats(); break;
              // CHECKINS — smart sync: block if empty, fire-and-forget if has data
              case "checkIn.list": await smartSync("checkins", "sgf_checkins"); result = dataService.checkin.list(); break;
              case "checkIn.create": result = dataService.checkin.create(input); await fbPush("checkin", result); break;
              case "checkIn.update": { const { id, data } = input; result = dataService.checkin.update({ id, data }); await fbPush("checkin", result); break; }
              case "checkIn.delete": result = dataService.checkin.delete(input); await pushCheckinDelete(input); break;
              case "checkIn.checkout": result = dataService.checkin.checkout(input); await fbPush("checkin", result); break;
              case "checkIn.getStats": await syncFromCloud("checkins", "sgf_checkins"); result = dataService.checkin.getStats(); break;
              case "checkIn.getDailyReport": result = dataService.checkin.getDailyReport(input?.date); break;
              case "checkIn.getWeeklyReport": result = dataService.checkin.getWeeklyReport(input?.year, input?.week); break;
              case "checkIn.getMonthlyReport": result = dataService.checkin.getMonthlyReport(input?.year, input?.month); break;
              case "checkIn.getAARate": result = getAARate(); break;
              case "checkIn.setAARate": result = setAARate(input); break;
              // FOLLOW-UPS — smart sync: block if empty, fire-and-forget if has data
              case "followUpAction.list": await smartSync("followUpActions", "sgf_followUpActions"); result = dataService.followUpAction.list(); break;
              case "followUpAction.listByCustomer": result = dataService.followUpAction.listByCustomer(input); break;
              case "followUpAction.create": result = dataService.followUpAction.create(input); await pushFollowUpAction(result); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "followUpActions", count: 1 } })); break;
              case "followUpAction.getStats": await syncFromCloud("followUpActions", "sgf_followUpActions"); result = dataService.followUpAction.getStats(); break;
              case "specialPrice.listByCustomer": result = dataService.specialPrice.listByCustomer(input); break;
              case "specialPrice.set": result = dataService.specialPrice.set(input); break;
              case "specialPrice.delete": result = dataService.specialPrice.delete(input); break;
              case "salesRep.list": await smartSync("salesReps", "sgf_salesReps"); result = dataService.salesRep.list(); break;
              case "salesRep.getStats": result = dataService.salesRep.getStats(); break;
              case "salesRep.getSalesBreakdown": result = dataService.salesRep.getSalesBreakdown(); break;
              case "salesRep.create": result = dataService.salesRep.create(input); if (result) await pushSalesRep(result); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "salesReps", count: 1 } })); break;
              case "salesRep.update": { const { id, data } = input; result = dataService.salesRep.update({ id, data }); if (result) { if (result.oldName && result.oldName !== result.name) await removeSalesRep(result.oldName); await pushSalesRep(result); } window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "salesReps", count: 1 } })); break; }
              case "salesRep.toggleActive": result = dataService.salesRep.toggleActive(input); if (result) await pushSalesRep(result); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "salesReps", count: 1 } })); break;
              case "salesRep.delete": result = dataService.salesRep.delete(input); if (result) await removeSalesRep(result.deletedName || input.id); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "salesReps", count: 1 } })); break;
              // DASHBOARD — cloud first (orders + invoices)
              case "dashboard.stats": result = dataService.dashboard.stats(); break;
              case "audit.list": result = dataService.audit.list(); break;
              case "audit.getCustomerDeletions": result = dataService.audit.getCustomerDeletions(); break;
              case "audit.getAddressChanges": result = dataService.audit.getAddressChanges(); break;
              case "followUp.list": await smartSync("followUps", "sgf_followUps"); result = dataService.followUp.list(); break;
              case "followUp.update": result = dataService.followUp.update(input); if (result) { await pushFollowUp(result); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "followUpActions", count: 1 } })); } break;
              case "followUp.getStats": result = dataService.followUp.getStats(); break;
              case "sampleReport.getByCustomer": result = dataService.sampleReport.getByCustomer(input); break;
              case "sampleReport.getAll": result = dataService.sampleReport.getAll(); break;
              // COLLECTIONS — cloud first
              case "collections.getOverdueInvoices": result = dataService.collections.getOverdueInvoices(); break;
              case "collections.getDailyReport": result = dataService.collections.getDailyReport(); break;
              case "collections.getStats": result = dataService.collections.getStats(); break;
              case "collections.getCustomerPaymentHistory": result = dataService.collections.getCustomerPaymentHistory(input); break;
              case "collections.addNote": result = dataService.collections.addNote(input); break;
              case "collections.recordPromise": result = dataService.collections.recordPromise(input); break;
              case "collections.placeHold": result = dataService.collections.placeHold(input); break;
              case "collections.releaseHold": result = dataService.collections.releaseHold(input); break;
              // ═══ CORPORATE MODULE ═══
              case "corporateCustomer.list": await smartSync("corporateCustomers", "sgf_corporateCustomers"); result = dataService.corporateCustomer.list(); break;
              case "corporateCustomer.listByCompany": result = dataService.corporateCustomer.listByCompany(input); break;
              case "corporateCustomer.getById": await syncFromCloud("corporateCustomers", "sgf_corporateCustomers"); result = dataService.corporateCustomer.getById(input); break;
              case "corporateCustomer.create": { result = dataService.corporateCustomer.create(input); await pushCorporateCustomer(result); await pushOneCustomer(dataService.customer.list().find((c: any) => c.id == result.id)); reloadFromStorage(); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "corporateCustomers", count: 1 } })); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "customers", count: 1 } })); break; }
              case "corporateCustomer.update": { const { id, data } = input; result = dataService.corporateCustomer.update({ id, data }); if (result) { await pushCorporateCustomer(result); } const updCust = dataService.customer.list().find((c: any) => c.id == id); if (updCust) await pushOneCustomer(updCust); reloadFromStorage(); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "corporateCustomers", count: 1 } })); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "customers", count: 1 } })); break; }
              case "corporateCustomer.delete": { result = dataService.corporateCustomer.delete(input); await removeCorporateCustomer(input); await removeOneCustomer(input); reloadFromStorage(); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "corporateCustomers", count: 1 } })); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "customers", count: 1 } })); break; }
              case "purchaseOrder.list": await smartSync("purchaseOrders", "sgf_purchaseOrders"); result = dataService.purchaseOrder.list(); break;
              case "purchaseOrder.getById": await syncFromCloud("purchaseOrders", "sgf_purchaseOrders"); result = dataService.purchaseOrder.getById(input); break;
              case "purchaseOrder.create": { result = dataService.purchaseOrder.create(input); await pushPurchaseOrder(result); reloadFromStorage(); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "purchaseOrders", count: 1 } })); break; }
              case "purchaseOrder.update": { const { id, data } = input; result = dataService.purchaseOrder.update({ id, data }); if (result) { await pushPurchaseOrder(result); reloadFromStorage(); } window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "purchaseOrders", count: 1 } })); break; }
              case "purchaseOrder.updateStatus": { result = dataService.purchaseOrder.updateStatus(input); await pushPurchaseOrder(result); reloadFromStorage(); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "purchaseOrders", count: 1 } })); break; }
              case "purchaseOrder.delete": { result = dataService.purchaseOrder.delete(input); await removePurchaseOrder(input); reloadFromStorage(); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "purchaseOrders", count: 1 } })); break; }
              case "barrel.list": await smartSync("barrels", "sgf_barrels"); result = dataService.barrel.list(); break;
              case "barrel.listByPurchaseOrder": result = dataService.barrel.listByPurchaseOrder(input); break;
              case "barrel.getById": await syncFromCloud("barrels", "sgf_barrels"); result = dataService.barrel.getById(input); break;
              case "barrel.create": { result = dataService.barrel.create(input); await pushBarrel(result); reloadFromStorage(); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "barrels", count: 1 } })); break; }
              case "barrel.update": { const { id, data } = input; result = dataService.barrel.update({ id, data }); if (result) { await pushBarrel(result); reloadFromStorage(); } window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "barrels", count: 1 } })); break; }
              case "barrel.delete": { result = dataService.barrel.delete(input); await removeBarrel(input); reloadFromStorage(); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "barrels", count: 1 } })); break; }
              case "coc.list": await smartSync("certificatesOfCompliance", "sgf_cocs"); result = dataService.coc.list(); break;
              case "coc.listByBarrel": result = dataService.coc.listByBarrel(input); break;
              case "coc.listByPurchaseOrder": result = dataService.coc.listByPurchaseOrder(input); break;
              case "coc.getById": await syncFromCloud("certificatesOfCompliance", "sgf_cocs"); result = dataService.coc.getById(input); break;
              case "coc.create": { result = dataService.coc.create(input); await pushCOC(result); reloadFromStorage(); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "certificatesOfCompliance", count: 1 } })); break; }
              case "coc.update": { const { id, data } = input; result = dataService.coc.update({ id, data }); if (result) { await pushCOC(result); reloadFromStorage(); } window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "certificatesOfCompliance", count: 1 } })); break; }
              case "coc.delete": { result = dataService.coc.delete(input); await removeCOC(input); reloadFromStorage(); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "certificatesOfCompliance", count: 1 } })); break; }
              case "coc.bulkGenerateForPO": { const { poId, cocDataList } = input;
                // Step 1: Read ALL COCs directly from Firebase (bypasses syncFromCloud cooldown)
                const allFirebaseCOCs = await readFromFirebase("certificatesOfCompliance");
                // Step 2: Find ALL COCs for this PO in Firebase (including stale ones localStorage doesn't know about)
                const firebasePOCOCs = allFirebaseCOCs.filter((c: any) => c.purchaseOrderId == poId);
                // Step 3: Delete EVERY COC for this PO from Firebase
                for (const c of firebasePOCOCs) { await removeCOC(c.id); }
                // Step 4: Also read localStorage COCs for this PO and clear them
                const localCOCs = dataService.coc.listByPurchaseOrder(poId);
                for (const c of localCOCs) { dataService.coc.delete(c.id); }
                // Step 5: Now create all new COCs in localStorage with fresh IDs
                const { deleteOrphanIds } = input;
                if (deleteOrphanIds && deleteOrphanIds.length > 0) {
                  for (const oid of deleteOrphanIds) { await removeCOC(oid); }
                }
                const created = dataService.coc.bulkGenerateForPO(poId, cocDataList, deleteOrphanIds || []);
                // Step 6: Push all new COCs to Firebase
                for (const c of created) { await pushCOC(c); }
                reloadFromStorage();
                window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "certificatesOfCompliance", count: created.length } }));
                result = created; break; }
              // ═══ PACKING LIST LINES ═══
              case "packingList.listByPurchaseOrder": result = dataService.packingList.listByPurchaseOrder(input); break;
              case "packingList.create": { result = dataService.packingList.create(input); await pushPackingListLine(result); reloadFromStorage(); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "packingListLines", count: 1 } })); break; }
              case "packingList.update": { const { id, data } = input; result = dataService.packingList.update({ id, data }); if (result) { await pushPackingListLine(result); reloadFromStorage(); } window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "packingListLines", count: 1 } })); break; }
              case "packingList.delete": { result = dataService.packingList.delete(input); await removePackingListLine(input); reloadFromStorage(); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "packingListLines", count: 1 } })); break; }
              default: console.warn("[localLink] Unhandled:", path, input); result = null;
            }

            observer.next({ result: { type: "data", data: result } });
            observer.complete();
          } catch (err: any) {
            console.error("[localLink] Error:", op.path, err);
            observer.error(err);
          }
        })();

        return () => {};
      });
}
