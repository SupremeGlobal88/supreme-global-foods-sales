import { dataService, reloadFromStorage, fixDraftInvoicesForDeliveredOrders, fixSageInvoiceDates, parseBankStatement, matchBankPayments, allocateBankPayments, getAARate, setAARate } from "./dataService";
import "./dataServiceExtras"; // Side-effect: adds missing properties (stock, auth, salesRep, dashboard, audit, etc.)
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
  isFirebaseReady, readFromFirebase, mergeWithCloudData, isAutoSyncInitialized,
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

/** Smart sync: ALWAYS fire-and-forget. Never block the UI thread.
 *  The Firebase onValue subscriptions are already streaming data in real-time.
 *  This function is a safety backup that pulls from Firebase on demand.
 *  Blocking the UI for 15 seconds (Firebase read timeout) makes the app
 *  completely unresponsive — especially on first load when ALL list queries
 *  call smartSync simultaneously. */
async function smartSync(type: string, storageKey: string): Promise<void> {
  // ALWAYS fire-and-forget. The subscriptions handle real-time updates.
  // This backup pull runs in the background without blocking the page render.
  syncFromCloud(type, storageKey);
}

async function syncFromCloud(type: string, storageKey: string): Promise<void> {
  // SKIP if auto-sync subscriptions are already active. They handle real-time
  // updates and already merge+save+reload. Calling syncFromCloud redundantly
  // creates extra onValue listeners, does extra merge+save work, and was
  // causing massive UI freeze when combined with refetchInterval: 2000.
  if (isAutoSyncInitialized()) {
    return;
  }
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
      reloadFromStorage([storageKey]);
      return;
    }
    const merged = mergeWithCloudData(storageKey, cloudData);
    const after = merged.length;
    setStorageItem(storageKey, JSON.stringify(merged));
    reloadFromStorage([storageKey]);
    if (after !== before) {
      console.log(`[syncFromCloud] ${type}: ${before} local → merged ${after} items (${after - before > 0 ? '+' : ''}${after - before} from cloud)`);
    }
  } catch (e: any) {
    console.error("[syncFromCloud] FAILED for", type, ":", e.message || e);
    // Even on error, reload from localStorage so subscriptions' data is used
    reloadFromStorage([storageKey]);
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

/** Get current logged-in user from localStorage.
 *  Returns { role: string } | null so we can enforce admin-only mutations. */
function getCurrentUser(): { role: string } | null {
  try {
    const raw = localStorage.getItem("demo_user");
    if (!raw) return null;
    const user = JSON.parse(raw);
    return user ? { role: user.role || "" } : null;
  } catch { return null; }
}

function isAdmin(): boolean {
  const user = getCurrentUser();
  return user?.role === "admin" || user?.role === "super_admin";
}

function isSuperAdmin(): boolean {
  const user = getCurrentUser();
  return user?.role === "super_admin";
}

function requireAdmin(): void {
  if (!isAdmin()) {
    throw new Error("Admin access required. Sales reps cannot edit or cancel orders.");
  }
}

function requireSuperAdmin(): void {
  if (!isSuperAdmin()) {
    throw new Error("Super Admin access required. Only super admins can manage users.");
  }
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
              // USER endpoints — required for login page
              case "user.list": result = dataService.user.list(); break;
              case "user.authenticate": result = dataService.user.authenticate(input); break;
              // STOCK — smart sync: block if empty, fire-and-forget if has data
              case "stock.list": await smartSync("stock", "sgf_products"); result = dataService.stock.list(); break;
              case "stock.search": await smartSync("stock", "sgf_products"); result = dataService.stock.search(input || { query: "" }); break;
              case "stock.getById": await syncFromCloud("stock", "sgf_products"); result = dataService.stock.getById(input); break;
              case "stock.getCategories": result = dataService.stock.getCategories(); break;
              case "stock.getStats": await syncFromCloud("stock", "sgf_products"); result = dataService.stock.getStats(); break;
              case "stock.getDailyInvoicedStock": result = dataService.stock.getDailyInvoicedStock(input || {}); break;
              case "stock.reconcileStock": result = dataService.stock.reconcileStock(input || {}); break;
              case "stock.create": { result = dataService.stock.create(input); await pushOneStockItem(result); reloadFromStorage(["sgf_products"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "stock", count: 1 } })); break; }
              case "stock.update": { const { id, data } = input; result = dataService.stock.update({ id, data }); if (result) { await pushOneStockItem(result); reloadFromStorage(["sgf_products"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "stock", count: 1 } })); } break; }
              case "stock.delete": { result = dataService.stock.delete(input); await removeOneStockItem(input); reloadFromStorage(["sgf_products"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "stock", count: 1 } })); break; }
              case "stock.bulkUpload": {
                const items = input || [];
                const { created, updated } = dataService.stock.bulkCreate(items);
                result = { count: created + updated, created, updated };
                await pushStock(dataService.stock.list());
                reloadFromStorage(["sgf_products"]);
                window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "stock", count: created + updated } }));
                break;
              }
              // CUSTOMERS — smart sync: block if empty, fire-and-forget if has data
              case "customer.list": await smartSync("customers", "sgf_customers"); result = dataService.customer.list(); break;
              case "customer.search": await smartSync("customers", "sgf_customers"); result = dataService.customer.search(input || { query: "" }); break;
              case "customer.getById": await syncFromCloud("customers", "sgf_customers"); result = dataService.customer.getById(input); break;
              case "customer.create": { result = dataService.customer.create(input); await fbPush("customer", result); reloadFromStorage(["sgf_customers"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "customers", count: 1 } })); break; }
              case "customer.update": { const { id, data } = input; result = dataService.customer.update({ id, data }); if (result) { await pushOneCustomer(result); reloadFromStorage(["sgf_customers"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "customers", count: 1 } })); } break; }
              case "customer.delete": { result = dataService.customer.delete(input); await removeOneCustomer(input); reloadFromStorage(["sgf_customers"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "customers", count: 1 } })); break; }
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
                // Push updated stock to Firebase so all devices see deducted quantities.
                // CRITICAL FIX: Only push the stock items that actually changed (the order items),
                // not ALL 4000+ stock items. This was causing the Place Order popup to hang
                // for 10+ seconds while every product was pushed to Firebase one by one.
                const changedStockIds = new Set((result?.items || []).map((it: any) => Number(it.stockItemId)));
                for (const stockId of changedStockIds) {
                  const prod = dataService.stock.getById(stockId);
                  if (prod) {
                    try { await pushOneStockItem(prod); } catch (e) { console.warn("[order.create] pushOneStockItem failed for", stockId, e); }
                  }
                }
                window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "stock", count: changedStockIds.size } }));
                // If sample order: push the follow-up to Firebase so all devices see it
                if (input?.orderType === "sample" && result?.id) {
                  const fu = dataService.followUp.list().find((f: any) => f.orderId == result.id);
                  if (fu) await pushFollowUp(fu);
                  window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "followUps", count: 1 } }));
                }
                break;
              }
              case "order.update": {
                requireAdmin();
                const { id, data } = input;
                result = dataService.order.update({ id, data });
                await fbPush("order", result);
                // Push updated stock to Firebase so all devices see updated quantities.
                // CRITICAL FIX: Only push the stock items that actually changed (the order items),
                // not ALL 4000+ stock items.
                const changedStockIds = new Set((result?.items || []).map((it: any) => Number(it.stockItemId)));
                for (const stockId of changedStockIds) {
                  const prod = dataService.stock.getById(stockId);
                  if (prod) {
                    try { await pushOneStockItem(prod); } catch (e) { console.warn("[order.update] pushOneStockItem failed for", stockId, e); }
                  }
                }
                window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "stock", count: changedStockIds.size } }));
                if (data?.orderType === "sample" && result?.id) {
                  const fu = dataService.followUp.list().find((f: any) => f.orderId == result.id);
                  if (fu) await pushFollowUp(fu);
                  window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "followUps", count: 1 } }));
                }
                break;
              }
              case "order.updateStatus": {
                requireAdmin();
                const updateResult = dataService.order.updateStatus(input);
                result = updateResult?.order || updateResult;
                await fbPush("order", result);
                // Push updated stock to Firebase (cancelled orders restore stock).
                // CRITICAL FIX: Only push the stock items that actually changed,
                // not ALL 4000+ stock items.
                const changedStockIds = new Set((result?.items || []).map((it: any) => Number(it.stockItemId)));
                for (const stockId of changedStockIds) {
                  const prod = dataService.stock.getById(stockId);
                  if (prod) {
                    try { await pushOneStockItem(prod); } catch (e) { console.warn("[order.updateStatus] pushOneStockItem failed for", stockId, e); }
                  }
                }
                window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "stock", count: changedStockIds.size } }));
                // If order was cancelled and a linked invoice was also cancelled, push it
                if (updateResult?.cancelledInvoice) {
                  await pushInvoice(updateResult.cancelledInvoice);
                  window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: 1 } }));
                }
                break;
              }
              case "order.delete": {
                requireAdmin();
                result = dataService.order.delete(input);
                await fbPush("order", result);
                break;
              }
              case "order.getBySalesRep": result = dataService.order.getBySalesRep(input); break;
              case "order.getMonthlySales": result = dataService.order.getMonthlySales(); break;
              case "order.getProductSales": result = dataService.order.getProductSales(); break;
              case "order.getSalesBreakdown": result = dataService.order.getSalesBreakdown(); break;
              case "order.getSalesRepVsOrders": result = dataService.order.getSalesRepVsOrders(); break;
              case "order.getDailyReport": result = dataService.order.getDailyReport(); break;
              case "order.getWeeklyReport": result = dataService.order.getWeeklyReport(); break;
              case "order.getMonthlyReport": result = dataService.order.getMonthlyReport(); break;
              case "order.getRevenueBySalesRep": result = dataService.order.getRevenueBySalesRep(); break;
              case "order.getSalesByMonth": result = dataService.order.getSalesByMonth(); break;
              case "order.cancel": { requireAdmin(); result = dataService.order.cancel(input); await fbPush("order", result); break; }
              case "order.checkExistingSample": result = dataService.order.checkExistingSample(input); break;
              case "order.generateMissingInvoices": { result = dataService.order.generateMissingInvoices(); await pushInvoices(result || []); break; }
              case "order.convertQuoteToOrder": { result = dataService.order.convertQuoteToOrder(input); await fbPush("order", result); break; }
              case "order.createFromInvoice": { result = dataService.order.createFromInvoice(input); await fbPush("order", result); break; }
              case "order.getSalesReport": result = dataService.order.getSalesReport(); break;
              case "order.getRouteVisits": result = dataService.order.getRouteVisits(); break;
              case "order.getOpenOrders": result = dataService.order.getOpenOrders(); break;
              // INVOICES — smart sync: block if empty, fire-and-forget if has data
              case "invoice.list": await smartSync("invoices", "sgf_invoices"); result = dataService.invoice.list(); break;
              case "invoice.getById": await syncFromCloud("invoices", "sgf_invoices"); result = dataService.invoice.getById(input); break;
              case "invoice.create": {
                result = dataService.invoice.create(input);
                await fbPush("invoice", result);
                // Push updated stock to Firebase so all devices see updated quantities.
                const changedStockIds = new Set((result?.items || []).map((it: any) => Number(it.stockItemId)));
                for (const stockId of changedStockIds) {
                  const prod = dataService.stock.getById(stockId);
                  if (prod) {
                    try { await pushOneStockItem(prod); } catch (e) { console.warn("[invoice.create] pushOneStockItem failed for", stockId, e); }
                  }
                }
                window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "stock", count: changedStockIds.size } }));
                break;
              }
              case "invoice.update": { requireAdmin(); const { id, data } = input; result = dataService.invoice.update({ id, data }); if (result) { await pushInvoice(result); reloadFromStorage(["sgf_invoices"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: 1 } })); } break; }
              case "invoice.updateInvoice": { requireAdmin(); const { id, data } = input; result = dataService.invoice.updateInvoice({ id, data }); if (result) { await pushInvoice(result); reloadFromStorage(["sgf_invoices"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: 1 } })); } break; }
              case "invoice.updateStatus": { requireAdmin(); result = dataService.invoice.updateStatus(input); if (result) { await pushInvoice(result); reloadFromStorage(["sgf_invoices"]); } break; }
              case "invoice.delete": { requireAdmin(); result = dataService.invoice.delete(input); await fbPush("invoice", result); break; }
              case "invoice.recordPayment": { requireAdmin(); result = dataService.invoice.recordPayment(input); if (result) { await pushInvoice(result); reloadFromStorage(["sgf_invoices"]); } break; }
              case "invoice.editPayment": { requireAdmin(); result = dataService.invoice.editPayment(input); if (result) { await pushInvoice(result); reloadFromStorage(["sgf_invoices"]); } break; }
              case "invoice.deletePayment": { requireAdmin(); result = dataService.invoice.deletePayment(input); if (result) { await pushInvoice(result); reloadFromStorage(["sgf_invoices"]); } break; }
              case "invoice.getCustomerStatement": result = dataService.invoice.getCustomerStatement(input); break;
              case "invoice.getStats": await syncFromCloud("invoices", "sgf_invoices"); result = dataService.invoice.getStats(); break;
              case "invoice.getReceipts": result = dataService.invoice.getReceipts(); break;
              case "invoice.getReceiptsByInvoice": result = dataService.invoice.getReceiptsByInvoice(input); break;
              case "invoice.getReceiptsByCustomer": result = dataService.invoice.getReceiptsByCustomer(input); break;
              case "invoice.getReceiptById": result = dataService.invoice.getReceiptById(input); break;
              case "invoice.bulkHistoricalImport": result = dataService.invoice.bulkHistoricalImport(input); break;
              case "invoice.relinkSageInvoices": result = dataService.invoice.relinkSageInvoices(); break;
              case "invoice.getCreditNotes": result = dataService.invoice.getCreditNotes(); break;
              case "invoice.getCreditNotesByInvoice": result = dataService.invoice.getCreditNotesByInvoice(input); break;
              case "invoice.getCreditNotesByCustomer": result = dataService.invoice.getCreditNotesByCustomer(input); break;
              case "invoice.getCustomerCreditBalance": result = dataService.invoice.getCustomerCreditBalance(input); break;
              case "invoice.createCreditNote": { requireAdmin(); result = dataService.invoice.createCreditNote(input); await pushCreditNote(result); reloadFromStorage(["sgf_invoices", "sgf_creditNotes"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "creditNotes", count: 1 } })); break; }
              case "invoice.allocateCredit": { requireAdmin(); result = dataService.invoice.allocateCredit(input); await pushCreditNote(result); reloadFromStorage(["sgf_invoices", "sgf_creditNotes"]); break; }
              case "invoice.voidCreditNoteAllocation": { requireAdmin(); result = dataService.invoice.voidCreditNoteAllocation(input); await pushCreditNote(result); reloadFromStorage(["sgf_invoices", "sgf_creditNotes"]); break; }
              case "invoice.voidCreditNote": { requireAdmin(); result = dataService.invoice.voidCreditNote(input); await pushCreditNote(result); reloadFromStorage(["sgf_invoices", "sgf_creditNotes"]); break; }
              case "invoice.sendToSage": { result = dataService.invoice.sendToSage(input); await fbPush("invoice", result); break; }
              case "invoice.getPaymentSchedule": result = dataService.invoice.getPaymentSchedule(); break;
              case "invoice.getMonthlyRevenue": result = dataService.invoice.getMonthlyRevenue(); break;
              case "invoice.getMonthlyPayments": result = dataService.invoice.getMonthlyPayments(); break;
              case "invoice.getMonthlyOutstanding": result = dataService.invoice.getMonthlyOutstanding(); break;
              case "invoice.getWeeklyRevenue": result = dataService.invoice.getWeeklyRevenue(); break;
              case "invoice.getSalesByMonth": result = dataService.invoice.getSalesByMonth(); break;
              case "invoice.getInvoiceStats": result = dataService.invoice.getInvoiceStats(); break;
              case "invoice.generateNextId": result = dataService.invoice.generateNextId(); break;
              case "invoice.fixDraftInvoicesForDeliveredOrders": result = fixDraftInvoicesForDeliveredOrders(); break;
              case "invoice.fixSageInvoiceDates": result = fixSageInvoiceDates(); break;
              case "invoice.parseBankStatement": result = parseBankStatement(input); break;
              case "invoice.matchBankPayments": result = matchBankPayments(input); break;
              case "invoice.allocateBankPayments": result = allocateBankPayments(input); break;
              case "invoice.getPendingBankPayments": result = dataService.invoice.getPendingBankPayments(); break;
              // PRODUCTS — smart sync: block if empty, fire-and-forget if has data
              case "product.list": await smartSync("products", "sgf_products"); result = dataService.product.list(); break;
              case "product.search": await smartSync("products", "sgf_products"); result = dataService.product.search(input || { query: "" }); break;
              case "product.getById": await syncFromCloud("products", "sgf_products"); result = dataService.product.getById(input); break;
              case "product.create": { result = dataService.product.create(input); await pushOneStockItem(result); reloadFromStorage(["sgf_products"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "products", count: 1 } })); break; }
              case "product.update": { const { id, data } = input; result = dataService.product.update({ id, data }); if (result) { await pushOneStockItem(result); reloadFromStorage(["sgf_products"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "products", count: 1 } })); } break; }
              case "product.delete": { result = dataService.product.delete(input); await removeOneStockItem(input); reloadFromStorage(["sgf_products"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "products", count: 1 } })); break; }
              case "product.getStats": await syncFromCloud("products", "sgf_products"); result = dataService.product.getStats(); break;
              case "product.getDailyInvoicedStock": result = dataService.product.getDailyInvoicedStock(input || {}); break;
              case "product.reconcileStock": result = dataService.product.reconcileStock(input || {}); break;
              case "product.bulkUpload": {
                const items = input || [];
                const { created, updated } = dataService.product.bulkCreate(items);
                result = { count: created + updated, created, updated };
                await pushStock(dataService.product.list());
                reloadFromStorage(["sgf_products"]);
                window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "products", count: created + updated } }));
                break;
              }
              case "product.getCategories": result = dataService.product.getCategories(); break;
              // APPOINTMENTS — smart sync: block if empty, fire-and-forget if has data
              case "appointment.list": await smartSync("appointments", "sgf_appointments"); result = dataService.appointment.list(); break;
              case "appointment.search": await smartSync("appointments", "sgf_appointments"); result = dataService.appointment.search(input || { query: "" }); break;
              case "appointment.getById": await syncFromCloud("appointments", "sgf_appointments"); result = dataService.appointment.getById(input); break;
              case "appointment.create": { result = dataService.appointment.create(input); await pushAppointment(result); reloadFromStorage(["sgf_appointments"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "appointments", count: 1 } })); break; }
              case "appointment.update": { const { id, data } = input; result = dataService.appointment.update({ id, data }); if (result) { await pushAppointment(result); reloadFromStorage(["sgf_appointments"]); } window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "appointments", count: 1 } })); break; }
              case "appointment.delete": { result = dataService.appointment.delete(input); await pushAppointmentDelete(input); reloadFromStorage(["sgf_appointments"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "appointments", count: 1 } })); break; }
              case "appointment.getStats": await syncFromCloud("appointments", "sgf_appointments"); result = dataService.appointment.getStats(); break;
              case "appointment.getDailyReport": result = dataService.appointment.getDailyReport(); break;
              case "appointment.getWeeklyReport": result = dataService.appointment.getWeeklyReport(); break;
              case "appointment.getMonthlyReport": result = dataService.appointment.getMonthlyReport(); break;
              case "appointment.getRouteVisits": result = dataService.appointment.getRouteVisits(); break;
              case "appointment.getUpcomingFollowUps": result = dataService.appointment.getUpcomingFollowUps(); break;
              case "appointment.getFollowUpStats": result = dataService.appointment.getFollowUpStats(); break;
              case "appointment.getUnvisitedCustomers": result = dataService.appointment.getUnvisitedCustomers(); break;
              case "appointment.getCustomerVisits": result = dataService.appointment.getCustomerVisits(input); break;
              // CHECK-INS — smart sync: block if empty, fire-and-forget if has data
              case "checkIn.list": await smartSync("checkIns", "sgf_checkIns"); result = dataService.checkIn.list(); break;
              case "checkIn.getById": await syncFromCloud("checkIns", "sgf_checkIns"); result = dataService.checkIn.getById(input); break;
              case "checkIn.create": { result = dataService.checkIn.create(input); await pushCheckin(result); reloadFromStorage(["sgf_checkIns"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "checkIns", count: 1 } })); break; }
              case "checkIn.update": { const { id, data } = input; result = dataService.checkIn.update({ id, data }); if (result) { await pushCheckin(result); reloadFromStorage(["sgf_checkIns"]); } window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "checkIns", count: 1 } })); break; }
              case "checkIn.delete": { result = dataService.checkIn.delete(input); await pushCheckinDelete(input); reloadFromStorage(["sgf_checkIns"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "checkIns", count: 1 } })); break; }
              case "checkIn.checkout": { result = dataService.checkIn.checkout(input); if (result) { await pushCheckin(result); reloadFromStorage(["sgf_checkIns"]); } window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "checkIns", count: 1 } })); break; }
              case "checkIn.getStats": await syncFromCloud("checkIns", "sgf_checkIns"); result = dataService.checkIn.getStats(); break;
              case "checkIn.getDailyReport": result = dataService.checkIn.getDailyReport(); break;
              case "checkIn.getWeeklyReport": result = dataService.checkIn.getWeeklyReport(input?.year, input?.week); break;
              case "checkIn.getMonthlyReport": result = dataService.checkIn.getMonthlyReport(input?.year, input?.month); break;
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
              case "corporateCustomer.create": {
                result = dataService.corporateCustomer.create(input);
                await pushCorporateCustomer(result);
                await pushOneCustomer(dataService.customer.list().find((c: any) => c.id == result.id));
                // Do NOT call reloadFromStorage here — dataService already saved to localStorage.
                // Calling reloadFromStorage can overwrite with stale data from a concurrent Firebase sync,
                // which causes the new corporate customer to disappear from the dropdown.
                window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "corporateCustomers", count: 1 } }));
                window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "customers", count: 1 } }));
                break;
              }
              case "corporateCustomer.update": {
                const { id: updId, data: updData } = input;
                result = dataService.corporateCustomer.update({ id: updId, data: updData });
                if (result) { await pushCorporateCustomer(result); }
                const updCust = dataService.customer.list().find((c: any) => c.id == updId);
                if (updCust) await pushOneCustomer(updCust);
                window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "corporateCustomers", count: 1 } }));
                window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "customers", count: 1 } }));
                break;
              }
              case "corporateCustomer.delete": { result = dataService.corporateCustomer.delete(input); await removeCorporateCustomer(input); await removeOneCustomer(input); reloadFromStorage(["sgf_corporateCustomers", "sgf_customers"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "corporateCustomers", count: 1 } })); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "customers", count: 1 } })); break; }
              case "purchaseOrder.list": await smartSync("purchaseOrders", "sgf_purchaseOrders"); result = dataService.purchaseOrder.list(); break;
              case "purchaseOrder.getById": await syncFromCloud("purchaseOrders", "sgf_purchaseOrders"); result = dataService.purchaseOrder.getById(input); break;
              case "purchaseOrder.create": {
                // Validate the corporate customer exists before creating the PO
                const custExists = dataService.corporateCustomer.getById(input.corporateCustomerId)
                  || dataService.customer.getById(input.corporateCustomerId);
                if (!custExists) {
                  throw new Error(`Corporate customer (ID: ${input.corporateCustomerId}) not found. Please ensure the customer was created successfully and try again.`);
                }
                result = dataService.purchaseOrder.create(input);
                await pushPurchaseOrder(result);
                // Do NOT call reloadFromStorage here — dataService already saved to localStorage.
                // Calling reloadFromStorage can overwrite with stale data from a concurrent Firebase sync.
                window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "purchaseOrders", count: 1 } }));
                break;
              }
              case "purchaseOrder.update": { const { id, data } = input; result = dataService.purchaseOrder.update({ id, data }); if (result) { await pushPurchaseOrder(result); reloadFromStorage(["sgf_purchaseOrders"]); } window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "purchaseOrders", count: 1 } })); break; }
              case "purchaseOrder.updateStatus": { result = dataService.purchaseOrder.updateStatus(input); await pushPurchaseOrder(result); reloadFromStorage(["sgf_purchaseOrders"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "purchaseOrders", count: 1 } })); break; }
              case "purchaseOrder.delete": { result = dataService.purchaseOrder.delete(input); await removePurchaseOrder(input); reloadFromStorage(["sgf_purchaseOrders"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "purchaseOrders", count: 1 } })); break; }
              case "barrel.list": await smartSync("barrels", "sgf_barrels"); result = dataService.barrel.list(); break;
              case "barrel.listByPurchaseOrder": result = dataService.barrel.listByPurchaseOrder(input); break;
              case "barrel.getById": await syncFromCloud("barrels", "sgf_barrels"); result = dataService.barrel.getById(input); break;
              case "barrel.create": { result = dataService.barrel.create(input); await pushBarrel(result); reloadFromStorage(["sgf_barrels"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "barrels", count: 1 } })); break; }
              case "barrel.update": { const { id, data } = input; result = dataService.barrel.update({ id, data }); if (result) { await pushBarrel(result); reloadFromStorage(["sgf_barrels"]); } window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "barrels", count: 1 } })); break; }
              case "barrel.delete": { result = dataService.barrel.delete(input); await removeBarrel(input); reloadFromStorage(["sgf_barrels"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "barrels", count: 1 } })); break; }
              case "coc.list": await smartSync("certificatesOfCompliance", "sgf_cocs"); result = dataService.coc.list(); break;
              case "coc.listByBarrel": result = dataService.coc.listByBarrel(input); break;
              case "coc.listByPurchaseOrder": result = dataService.coc.listByPurchaseOrder(input); break;
              case "coc.getById": await syncFromCloud("certificatesOfCompliance", "sgf_cocs"); result = dataService.coc.getById(input); break;
              case "coc.create": { result = dataService.coc.create(input); await pushCOC(result); reloadFromStorage(["sgf_cocs"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "certificatesOfCompliance", count: 1 } })); break; }
              case "coc.update": { const { id, data } = input; result = dataService.coc.update({ id, data }); if (result) { await pushCOC(result); reloadFromStorage(["sgf_cocs"]); } window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "certificatesOfCompliance", count: 1 } })); break; }
              case "coc.delete": { result = dataService.coc.delete(input); await removeCOC(input); reloadFromStorage(["sgf_cocs"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "certificatesOfCompliance", count: 1 } })); break; }
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
                // Step 4b: Clear the Firebase sync key too — otherwise the subscription
                // will merge stale data with new data and create duplicates
                setStorageItem("sgf_cocs", "[]");
                // Step 5: Now create all new COCs in localStorage with fresh IDs
                const { deleteOrphanIds } = input;
                if (deleteOrphanIds && deleteOrphanIds.length > 0) {
                  for (const oid of deleteOrphanIds) { await removeCOC(oid); }
                }
                const created = dataService.coc.bulkGenerateForPO(poId, cocDataList, deleteOrphanIds || []);
                // Step 5b: Also save to the Firebase sync key so subscription sees correct state
                setStorageItem("sgf_cocs", JSON.stringify(created));
                // Step 6: Push all new COCs to Firebase
                for (const c of created) { await pushCOC(c); }
                reloadFromStorage(["sgf_cocs"]);
                window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "certificatesOfCompliance", count: created.length } }));
                result = created; break; }
              // ═══ PACKING LIST LINES ═══
              case "packingList.listByPurchaseOrder": result = dataService.packingList.listByPurchaseOrder(input); break;
              case "packingList.create": { result = dataService.packingList.create(input); await pushPackingListLine(result); reloadFromStorage(["sgf_packingListLines"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "packingListLines", count: 1 } })); break; }
              case "packingList.update": { const { id, data } = input; result = dataService.packingList.update({ id, data }); if (result) { await pushPackingListLine(result); reloadFromStorage(["sgf_packingListLines"]); } window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "packingListLines", count: 1 } })); break; }
              case "packingList.delete": { result = dataService.packingList.delete(input); await removePackingListLine(input); reloadFromStorage(["sgf_packingListLines"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "packingListLines", count: 1 } })); break; }
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
