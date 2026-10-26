import { dataService, reloadFromStorage, fixDraftInvoicesForDeliveredOrders, fixSageInvoiceDates, parseBankStatement, matchBankPayments, allocateBankPayments, getAARate, setAARate } from "./dataService";
import { DATA_SERVICE_EXTRAS_LOADED } from "./dataServiceExtras";
if (!DATA_SERVICE_EXTRAS_LOADED) {
  console.error("[localLink] CRITICAL: dataServiceExtras was tree-shaken!");
}
import { getStorageItem, setStorageItem } from "./compressedStorage";
import { observable } from "@trpc/server/observable";
import {
  pushOrder, pushAppointment, pushCheckin, pushInvoice, pushInvoices,
  pushOneCustomer, removeOneCustomer, pushOneStockItem, removeOneStockItem, pushStock,
  pushFollowUpAction, pushFollowUp, pushOneReceipt, pushReceipts,
  pushUser, pushUserDelete, pushAppointmentDelete, pushCheckinDelete,
  pushSalesRep, removeSalesRep, pushCreditNote,
  pushCollectionNote, pushCollectionPromise, pushAccountHold,
  pushSpecialPrice, removeSpecialPrice,
  pushCorporateCustomer, removeCorporateCustomer,
  pushPurchaseOrder, removePurchaseOrder,
  pushBarrel, removeBarrel,
  pushCOC, removeCOC,
  pushPackingListLine, removePackingListLine,
  isFirebaseReady, readFromFirebase, mergeWithCloudData, isAutoSyncInitialized,
} from "./firebaseSync";

/** CLOUD-FIRST SYNC: Read latest data from Firebase, MERGE with local, save, reload.
 *  EVERY query handler awaits this to ensure users see LIVE cloud data FIRST.
 *  This is the golden rule: cloud-first always. */
const lastSyncTimes: Record<string, number> = {};
const SYNC_COOLDOWN_MS = 1000; // 1 second cooldown between explicit syncs

/** Smart sync: ALWAYS await Firebase read. This is cloud-first.
 *  We wait for Firebase data to arrive before returning ANY data to the UI.
 *  If Firebase is not ready, we fall back to localStorage immediately. */
async function smartSync(type: string, storageKey: string): Promise<void> {
  // ALWAYS wait for cloud data. Fire-and-forget was causing empty pages.
  await syncFromCloud(type, storageKey);
}

async function syncFromCloud(type: string, storageKey: string): Promise<void> {
  if (!isFirebaseReady()) {
    console.warn("[syncFromCloud] Firebase not ready for", type, "— using localStorage");
    reloadFromStorage([storageKey]);
    return;
  }

  // Rate limit: don't sync same type more than every 1 second
  const now = Date.now();
  const lastSync = lastSyncTimes[type] || 0;
  if (now - lastSync < SYNC_COOLDOWN_MS) {
    console.log("[syncFromCloud] Skipping", type, "— within cooldown");
    reloadFromStorage([storageKey]);
    return;
  }
  lastSyncTimes[type] = now;

  try {
    console.log("[syncFromCloud] Reading", type, "from Firebase...");
    const cloudData = await readFromFirebase(type);
    console.log("[syncFromCloud] Firebase returned", cloudData.length, type, cloudData.length > 0 ? "ids:"+cloudData.slice(0,3).map((x:any)=>x.id).join(",") : "empty");

    // Re-read localStorage AFTER readFromFirebase returns (subscriptions may have updated it)
    const currentLocal = JSON.parse(getStorageItem(storageKey) || "[]");
    const before = currentLocal.length;

    // SAFETY: If Firebase returned 0 items but localStorage already has data,
    // this is likely a timeout — DON'T overwrite local data.
    if (cloudData.length === 0 && before > 0) {
      console.warn(`[syncFromCloud] SAFETY: Firebase returned 0 ${type} but local has ${before} items. Skipping overwrite.`);
      reloadFromStorage([storageKey]);
      return;
    }

    const merged = mergeWithCloudData(storageKey, cloudData);
    const after = merged.length;

    // SAFETY: Ensure we don't lose recently created OR updated local items during sync.
    // This prevents race conditions where Firebase hasn't received a push yet.
    // Critical for regenerated invoices (old createdAt but new updatedAt).
    const SAFETY_CHECK_KEYS = ["sgf_orders", "sgf_invoices", "sgf_corporateCustomers"];
    if (SAFETY_CHECK_KEYS.includes(storageKey)) {
      const mergedIds = new Set(merged.map((item: any) => item.id));
      const missingLocal = currentLocal.filter((item: any) => {
        if (mergedIds.has(item.id)) return false;
        const createdAt = new Date(item.createdAt || 0).getTime();
        const updatedAt = new Date(item.updatedAt || item.createdAt || 0).getTime();
        return now - createdAt < 60000 || now - updatedAt < 60000; // within last 60 seconds
      });
      if (missingLocal.length > 0) {
        console.warn(`[syncFromCloud] SAFETY: Adding ${missingLocal.length} recently created/updated local ${type} items missing from merged result`);
        merged.push(...missingLocal);
      }
    }

    setStorageItem(storageKey, JSON.stringify(merged));
    reloadFromStorage([storageKey]);

    if (after !== before) {
      console.log(`[syncFromCloud] ${type}: ${before} local → merged ${after} items (${after - before > 0 ? '+' : ''}${after - before} from cloud)`);
    } else {
      console.log(`[syncFromCloud] ${type}: ${after} items (no change)`);
    }
  } catch (e: any) {
    console.error("[syncFromCloud] FAILED for", type, ":", e.message || e);
    // On error, still reload from localStorage so we show cached data
    reloadFromStorage([storageKey]);
  }
}

/** Push data to Firebase after local write. */
async function fbPush(type: "order" | "appointment" | "checkin" | "invoice" | "customer" | "user" | "userDeleted", item: any) {
  try {
    switch (type) {
      case "order": {
        await pushOrder(item);
        const invoices = dataService.invoice.list();
        const inv = invoices.find((i: any) => i.orderId == item.id);
        if (inv) await pushInvoice(inv);
        break;
      }
      case "appointment": await pushAppointment(item); break;
      case "checkin": await pushCheckin(item); break;
      case "invoice": await pushInvoice(item); break;
      case "customer": await pushOneCustomer(item); break;
      case "user": await pushUser(item); break;
      case "userDeleted": await pushUserDelete(item.id); break;
    }
  } catch (e: any) { console.error("[fbPush] FAILED:", type, item?.id, e?.message || e); }
}

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
  if (!isAdmin()) throw new Error("Admin access required.");
}

function requireSuperAdmin(): void {
  if (!isSuperAdmin()) throw new Error("Super Admin access required.");
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
              case "user.list": await smartSync("users", "sgf_users"); result = dataService.user.list(); break;
              case "user.authenticate": result = dataService.user.authenticate(input); break;
              case "user.getById": await smartSync("users", "sgf_users"); result = dataService.user.getById(input); break;
              case "user.create": { result = dataService.user.create(input); await pushUser(result); reloadFromStorage(["sgf_users"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "users", count: 1 } })); break; }
              case "user.update": { const { id, data } = input; result = dataService.user.update({ id, data }); if (result) { await pushUser(result); reloadFromStorage(["sgf_users"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "users", count: 1 } })); } break; }
              case "user.delete": { result = dataService.user.delete(input); if (result?.success) { await pushUserDelete(input.id); reloadFromStorage(["sgf_users"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "users", count: 1 } })); } break; }
              case "user.toggleActive": { result = dataService.user.toggleActive(input); if (result?.success) { const updatedUser = dataService.user.getById(input); if (updatedUser) await pushUser(updatedUser); reloadFromStorage(["sgf_users"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "users", count: 1 } })); } break; }
              case "user.resetPin": { result = dataService.user.resetPin(input); if (result?.success) { const updatedUser = dataService.user.getById(input.id); if (updatedUser) await pushUser(updatedUser); reloadFromStorage(["sgf_users"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "users", count: 1 } })); } break; }
              case "stock.list": await smartSync("stock", "sgf_products"); result = dataService.stock.list(); break;
              case "stock.search": await smartSync("stock", "sgf_products"); result = dataService.stock.search(input || { query: "" }); break;
              case "stock.getById": await smartSync("stock", "sgf_products"); result = dataService.stock.getById(input); break;
              case "stock.getCategories": await smartSync("stock", "sgf_products"); result = dataService.stock.getCategories(); break;
              case "stock.getStats": await smartSync("stock", "sgf_products"); result = dataService.stock.getStats(); break;
              case "stock.getDailyInvoicedStock": await smartSync("stock", "sgf_products"); result = dataService.stock.getDailyInvoicedStock(input || {}); break;
              case "stock.reconcileStock": await smartSync("stock", "sgf_products"); result = dataService.stock.reconcileStock(input || {}); break;
              case "stock.create": { result = dataService.stock.create(input); await pushOneStockItem(result); reloadFromStorage(["sgf_products"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "stock", count: 1 } })); break; }
              case "stock.update": { const { id, data } = input; result = dataService.stock.update({ id, data }); if (result) { await pushOneStockItem(result); reloadFromStorage(["sgf_products"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "stock", count: 1 } })); } break; }
              case "stock.delete": { result = dataService.stock.delete(input); await removeOneStockItem(input); reloadFromStorage(["sgf_products"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "stock", count: 1 } })); break; }
              case "stock.setStock": { result = dataService.stock.setStock(input); if (result?.success) { await pushStock(dataService.stock.list()); reloadFromStorage(["sgf_products"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "stock", count: 1 } })); } break; }
              case "stock.bulkUpdate": { result = dataService.stock.bulkUpdate(input); if (result?.success) { await pushStock(dataService.stock.list()); reloadFromStorage(["sgf_products"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "stock", count: 1 } })); } break; }
              case "stock.bulkUpdateLocation": { result = dataService.stock.bulkUpdateLocation(input); if (result?.success) { await pushStock(dataService.stock.list()); reloadFromStorage(["sgf_products"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "stock", count: 1 } })); } break; }
              case "stock.syncStock": { await pushStock(dataService.stock.list()); result = { success: true }; break; }
              case "stock.addCategory": { result = dataService.stock.addCategory(input); reloadFromStorage(["sgf_products"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "stock", count: 1 } })); break; }
              case "stock.getLocations": await smartSync("stock", "sgf_products"); result = dataService.stock.getLocations(); break;
              case "stock.updateLocations": { result = dataService.stock.updateLocations(input); if (result?.success) { await pushStock(dataService.stock.list()); reloadFromStorage(["sgf_products"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "stock", count: 1 } })); } break; }
              case "stock.setReorderPoint": { result = dataService.stock.setReorderPoint(input); if (result?.success) { await pushStock(dataService.stock.list()); reloadFromStorage(["sgf_products"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "stock", count: 1 } })); } break; }
              case "customer.list": await smartSync("customers", "sgf_customers"); result = dataService.customer.list(); break;
              case "customer.search": await smartSync("customers", "sgf_customers"); result = dataService.customer.search(input || { query: "" }); break;
              case "customer.getById": await smartSync("customers", "sgf_customers"); result = dataService.customer.getById(input); break;
              case "customer.getStats": await smartSync("customers", "sgf_customers"); result = dataService.customer.getStats(); break;
              case "customer.getSalesReps": await smartSync("customers", "sgf_customers"); result = dataService.customer.getSalesReps(); break;
              case "customer.create": { result = dataService.customer.create(input); await pushOneCustomer(result); reloadFromStorage(["sgf_customers"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "customers", count: 1 } })); break; }
              case "customer.update": { const { id, data } = input; result = dataService.customer.update({ id, data }); if (result) { await pushOneCustomer(result); reloadFromStorage(["sgf_customers"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "customers", count: 1 } })); } break; }
              case "customer.delete": { result = dataService.customer.delete(input); await removeOneCustomer(input.id); reloadFromStorage(["sgf_customers"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "customers", count: 1 } })); break; }
              case "customer.bulkUpload": { result = dataService.customer.bulkUpload(input); if (result?.success) { const allCustomers = dataService.customer.list(); for (const c of allCustomers) { try { await pushOneCustomer(c); } catch { /* ignore */ } } reloadFromStorage(["sgf_customers"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "customers", count: result?.created || 0 } })); } break; }
              case "customer.getNextCode": result = dataService.customer.getNextCode(); break;
              case "customer.removeDuplicates": { result = dataService.customer.removeDuplicates(); reloadFromStorage(["sgf_customers"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "customers", count: 1 } })); break; }
              case "order.list": await smartSync("orders", "sgf_orders"); result = dataService.order.list(input || {}); break;
              case "order.search": await smartSync("orders", "sgf_orders"); result = dataService.order.search(input || { query: "" }); break;
              case "order.getById": await smartSync("orders", "sgf_orders"); result = dataService.order.getById(input); break;
              case "order.getStats": await smartSync("orders", "sgf_orders"); result = dataService.order.getStats(input || {}); break;
              case "order.getByCustomerId": await smartSync("orders", "sgf_orders"); result = dataService.order.getByCustomerId(input); break;
              case "order.getByDate": await smartSync("orders", "sgf_orders"); result = dataService.order.getByDate(input || {}); break;
              case "order.getMonthlySales": await smartSync("orders", "sgf_orders"); result = dataService.order.getMonthlySales(input || {}); break;
              case "order.getSalesReps": await smartSync("orders", "sgf_orders"); result = dataService.order.getSalesReps(); break;
              case "order.create": { result = dataService.order.create(input); await fbPush("order", result); reloadFromStorage(["sgf_orders", "sgf_invoices", "sgf_products"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "orders", count: 1 } })); break; }
              case "order.update": { const { id, data } = input; result = dataService.order.update({ id, data }); if (result) { await fbPush("order", result); reloadFromStorage(["sgf_orders", "sgf_invoices"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "orders", count: 1 } })); } break; }
              case "order.delete": { result = dataService.order.delete(input); if (result?.success) { await fbPush("order", result); reloadFromStorage(["sgf_orders", "sgf_invoices"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "orders", count: 1 } })); } break; }
              case "order.updateStatus": { result = dataService.order.updateStatus(input); if (result) { await fbPush("order", result); reloadFromStorage(["sgf_orders", "sgf_invoices"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "orders", count: 1 } })); } break; }
              case "order.convertQuoteToOrder": { result = dataService.order.convertQuoteToOrder(input); if (result) { await fbPush("order", result); reloadFromStorage(["sgf_orders", "sgf_invoices", "sgf_products"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "orders", count: 1 } })); } break; }
              case "order.regenerateInvoice": { result = dataService.order.regenerateInvoice(input); if (result) { await fbPush("order", result); reloadFromStorage(["sgf_orders", "sgf_invoices"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "orders", count: 1 } })); } break; }
              case "order.bulkUpdate": { result = dataService.order.bulkUpdate(input); if (result?.success) { const orders = dataService.order.list(); for (const o of orders) { try { await pushOrder(o); } catch { /* ignore */ } } reloadFromStorage(["sgf_orders"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "orders", count: 1 } })); } break; }
              case "order.bulkUpdateStatus": { result = dataService.order.bulkUpdateStatus(input); if (result?.success) { const orders = dataService.order.list(); for (const o of orders) { try { await pushOrder(o); } catch { /* ignore */ } } reloadFromStorage(["sgf_orders"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "orders", count: 1 } })); } break; }
              case "invoice.list": await smartSync("invoices", "sgf_invoices"); result = dataService.invoice.list(input || {}); break;
              case "invoice.search": await smartSync("invoices", "sgf_invoices"); result = dataService.invoice.search(input || { query: "" }); break;
              case "invoice.getById": await smartSync("invoices", "sgf_invoices"); result = dataService.invoice.getById(input); break;
              case "invoice.getStats": await smartSync("invoices", "sgf_invoices"); result = dataService.invoice.getStats(input || {}); break;
              case "invoice.getByCustomerId": await smartSync("invoices", "sgf_invoices"); result = dataService.invoice.getByCustomerId(input); break;
              case "invoice.getByDate": await smartSync("invoices", "sgf_invoices"); result = dataService.invoice.getByDate(input || {}); break;
              case "invoice.getByStatus": await smartSync("invoices", "sgf_invoices"); result = dataService.invoice.getByStatus(input || { status: "" }); break;
              case "invoice.getMonthlyRevenue": await smartSync("invoices", "sgf_invoices"); result = dataService.invoice.getMonthlyRevenue(input || {}); break;
              case "invoice.getAgingReport": await smartSync("invoices", "sgf_invoices"); result = dataService.invoice.getAgingReport(input || {}); break;
              case "invoice.create": { result = dataService.invoice.create(input); if (result) { await pushInvoice(result); reloadFromStorage(["sgf_invoices"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: 1 } })); } break; }
              case "invoice.update": { const { id, data } = input; result = dataService.invoice.updateInvoice({ id, data }); if (result) { await pushInvoice(result); reloadFromStorage(["sgf_invoices"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: 1 } })); } break; }
              case "invoice.delete": { result = dataService.invoice.delete(input); if (result?.success) { await pushInvoice(result); reloadFromStorage(["sgf_invoices"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: 1 } })); } break; }
              case "invoice.markAsPaid": { result = dataService.invoice.markAsPaid(input); if (result) { await pushInvoice(result); reloadFromStorage(["sgf_invoices"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: 1 } })); } break; }
              case "invoice.send": { result = dataService.invoice.send(input); if (result) { await pushInvoice(result); reloadFromStorage(["sgf_invoices"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: 1 } })); } break; }
              case "invoice.generatePDF": result = dataService.invoice.generatePDF(input); break;
              case "invoice.applyCreditNote": { result = dataService.invoice.applyCreditNote(input); if (result) { await pushInvoice(result); reloadFromStorage(["sgf_invoices"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: 1 } })); } break; }
              case "invoice.getCreditNotes": await smartSync("invoices", "sgf_invoices"); result = dataService.invoice.getCreditNotes(input); break;
              case "invoice.recordPayment": { result = dataService.invoice.recordPayment(input); if (result) { await pushInvoice(result); reloadFromStorage(["sgf_invoices"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: 1 } })); } break; }
              case "invoice.updatePaymentStatus": { result = dataService.invoice.updatePaymentStatus(input); if (result) { await pushInvoice(result); reloadFromStorage(["sgf_invoices"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: 1 } })); } break; }
              case "invoice.fixDraftInvoices": { result = fixDraftInvoicesForDeliveredOrders(); if (result) { for (const inv of result.fixedInvoices) { try { await pushInvoice(inv); } catch { /* ignore */ } } reloadFromStorage(); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: result.fixedInvoices?.length || 0 } })); } break; }
              case "invoice.fixSageDates": { result = fixSageInvoiceDates(); if (result) { reloadFromStorage(); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: 0 } })); } break; }
              case "invoice.bulkUpdate": { result = dataService.invoice.bulkUpdate(input); if (result?.success) { const invoices = dataService.invoice.list(); for (const inv of invoices) { try { await pushInvoice(inv); } catch { /* ignore */ } } reloadFromStorage(["sgf_invoices"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: 1 } })); } break; }
              case "invoice.addCreditNote": { result = dataService.invoice.addCreditNote(input); if (result) { await pushCreditNote(result); reloadFromStorage(["sgf_invoices"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: 1 } })); } break; }
              case "quote.list": await smartSync("orders", "sgf_orders"); result = dataService.quote.list(input || {}); break;
              case "quote.search": await smartSync("orders", "sgf_orders"); result = dataService.quote.search(input || { query: "" }); break;
              case "quote.getById": await smartSync("orders", "sgf_orders"); result = dataService.quote.getById(input); break;
              case "quote.getStats": await smartSync("orders", "sgf_orders"); result = dataService.quote.getStats(input || {}); break;
              case "quote.getByCustomerId": await smartSync("orders", "sgf_orders"); result = dataService.quote.getByCustomerId(input); break;
              case "quote.create": { result = dataService.quote.create(input); await fbPush("order", result); reloadFromStorage(["sgf_orders"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "orders", count: 1 } })); break; }
              case "quote.update": { const { id, data } = input; result = dataService.quote.update({ id, data }); if (result) { await fbPush("order", result); reloadFromStorage(["sgf_orders"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "orders", count: 1 } })); } break; }
              case "quote.delete": { result = dataService.quote.delete(input); if (result?.success) { await fbPush("order", result); reloadFromStorage(["sgf_orders"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "orders", count: 1 } })); } break; }
              case "quote.convertToOrder": { result = dataService.quote.convertToOrder(input); if (result) { await fbPush("order", result); reloadFromStorage(["sgf_orders", "sgf_invoices", "sgf_products"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "orders", count: 1 } })); } break; }
              case "appointment.list": await smartSync("appointments", "sgf_appointments"); result = dataService.appointment.list(input || {}); break;
              case "appointment.search": await smartSync("appointments", "sgf_appointments"); result = dataService.appointment.search(input || { query: "" }); break;
              case "appointment.getById": await smartSync("appointments", "sgf_appointments"); result = dataService.appointment.getById(input); break;
              case "appointment.getByDate": await smartSync("appointments", "sgf_appointments"); result = dataService.appointment.getByDate(input || {}); break;
              case "appointment.getByCustomerId": await smartSync("appointments", "sgf_appointments"); result = dataService.appointment.getByCustomerId(input); break;
              case "appointment.create": { result = dataService.appointment.create(input); await pushAppointment(result); reloadFromStorage(["sgf_appointments"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "appointments", count: 1 } })); break; }
              case "appointment.update": { const { id, data } = input; result = dataService.appointment.update({ id, data }); if (result) { await pushAppointment(result); reloadFromStorage(["sgf_appointments"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "appointments", count: 1 } })); } break; }
              case "appointment.delete": { result = dataService.appointment.delete(input); if (result?.success) { await pushAppointmentDelete(input.id); reloadFromStorage(["sgf_appointments"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "appointments", count: 1 } })); } break; }
              case "checkin.list": await smartSync("checkins", "sgf_checkins"); result = dataService.checkin.list(input || {}); break;
              case "checkin.search": await smartSync("checkins", "sgf_checkins"); result = dataService.checkin.search(input || { query: "" }); break;
              case "checkin.getById": await smartSync("checkins", "sgf_checkins"); result = dataService.checkin.getById(input); break;
              case "checkin.getByDate": await smartSync("checkins", "sgf_checkins"); result = dataService.checkin.getByDate(input || {}); break;
              case "checkin.create": { result = dataService.checkin.create(input); await pushCheckin(result); reloadFromStorage(["sgf_checkins"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "checkins", count: 1 } })); break; }
              case "checkin.update": { const { id, data } = input; result = dataService.checkin.update({ id, data }); if (result) { await pushCheckin(result); reloadFromStorage(["sgf_checkins"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "checkins", count: 1 } })); } break; }
              case "checkin.delete": { result = dataService.checkin.delete(input); if (result?.success) { await pushCheckinDelete(input.id); reloadFromStorage(["sgf_checkins"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "checkins", count: 1 } })); } break; }
              case "audit.getCustomerDeletions": result = dataService.audit.getCustomerDeletions(); break;
              case "receipt.list": await smartSync("receipts", "sgf_receipts"); result = dataService.receipt.list(); break;
              case "receipt.getById": await smartSync("receipts", "sgf_receipts"); result = dataService.receipt.getById(input); break;
              case "receipt.create": { result = dataService.receipt.create(input); await pushOneReceipt(result); reloadFromStorage(["sgf_receipts"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "receipts", count: 1 } })); break; }
              case "receipt.update": { const { id, data } = input; result = dataService.receipt.update({ id, data }); if (result) { await pushOneReceipt(result); reloadFromStorage(["sgf_receipts"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "receipts", count: 1 } })); } break; }
              case "followUp.list": await smartSync("followUps", "sgf_followUps"); result = dataService.followUp.list(); break;
              case "followUp.search": await smartSync("followUps", "sgf_followUps"); result = dataService.followUp.search(input || { query: "" }); break;
              case "followUp.getById": await smartSync("followUps", "sgf_followUps"); result = dataService.followUp.getById(input); break;
              case "followUp.create": { result = dataService.followUp.create(input); await pushFollowUp(result); reloadFromStorage(["sgf_followUps"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "followUps", count: 1 } })); break; }
              case "followUp.update": { const { id, data } = input; result = dataService.followUp.update({ id, data }); if (result) { await pushFollowUp(result); reloadFromStorage(["sgf_followUps"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "followUps", count: 1 } })); } break; }
              case "followUp.delete": { result = dataService.followUp.delete(input); if (result?.success) { await pushFollowUpAction({ type: "delete", id: input }); reloadFromStorage(["sgf_followUps"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "followUps", count: 1 } })); } break; }
              case "salesRep.list": await smartSync("salesReps", "sgf_salesReps"); result = dataService.salesRep.list(); break;
              case "salesRep.create": { result = dataService.salesRep.create(input); await pushSalesRep(result); reloadFromStorage(["sgf_salesReps"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "salesReps", count: 1 } })); break; }
              case "salesRep.update": { const { id, data } = input; result = dataService.salesRep.update({ id, data }); if (result) { await pushSalesRep(result); reloadFromStorage(["sgf_salesReps"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "salesReps", count: 1 } })); } break; }
              case "salesRep.delete": { result = dataService.salesRep.delete(input); if (result?.success) { await removeSalesRep(result.deletedName || input.id); reloadFromStorage(["sgf_salesReps"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "salesReps", count: 1 } })); } break; }
              case "salesRep.getStats": { await smartSync("salesReps", "sgf_salesReps"); result = dataService.salesRep.getStats(); break; }
              case "salesRep.getSalesBreakdown": { await smartSync("salesReps", "sgf_salesReps"); result = dataService.salesRep.getSalesBreakdown(); break; }
              case "specialPrice.set": { result = dataService.specialPrice.set(input); if (result) { await pushSpecialPrice(result); reloadFromStorage(["sgf_specialPrices"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "specialPrices", count: 1 } })); } break; }
              case "specialPrice.listByCustomer": await smartSync("specialPrices", "sgf_specialPrices"); result = dataService.specialPrice.listByCustomer(input); break;
              case "specialPrice.delete": { result = dataService.specialPrice.delete(input); if (result?.success) { await removeSpecialPrice(input); reloadFromStorage(["sgf_specialPrices"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "specialPrices", count: 1 } })); } break; }
              case "corporateCustomer.list": await smartSync("corporateCustomers", "sgf_corporateCustomers"); result = dataService.corporateCustomer.list(); break;
              case "corporateCustomer.search": await smartSync("corporateCustomers", "sgf_corporateCustomers"); result = dataService.corporateCustomer.search(input || { query: "" }); break;
              case "corporateCustomer.getById": await smartSync("corporateCustomers", "sgf_corporateCustomers"); result = dataService.corporateCustomer.getById(input); break;
              case "corporateCustomer.getStats": await smartSync("corporateCustomers", "sgf_corporateCustomers"); result = dataService.corporateCustomer.getStats(); break;
              case "corporateCustomer.getSalesReps": await smartSync("corporateCustomers", "sgf_corporateCustomers"); result = dataService.corporateCustomer.getSalesReps(); break;
              case "corporateCustomer.create": { result = dataService.corporateCustomer.create(input); await pushCorporateCustomer(result); reloadFromStorage(["sgf_corporateCustomers"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "corporateCustomers", count: 1 } })); break; }
              case "corporateCustomer.update": { const { id, data } = input; result = dataService.corporateCustomer.update({ id, data }); if (result) { await pushCorporateCustomer(result); reloadFromStorage(["sgf_corporateCustomers"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "corporateCustomers", count: 1 } })); } break; }
              case "corporateCustomer.delete": { result = dataService.corporateCustomer.delete(input.id); await removeCorporateCustomer(input.id); await removeOneCustomer(input.id); reloadFromStorage(["sgf_corporateCustomers", "sgf_customers"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "corporateCustomers", count: 1 } })); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "customers", count: 1 } })); break; }
              case "purchaseOrder.list": await smartSync("purchaseOrders", "sgf_purchaseOrders"); result = dataService.purchaseOrder.list(); break;
              case "purchaseOrder.search": await smartSync("purchaseOrders", "sgf_purchaseOrders"); result = dataService.purchaseOrder.search(input || { query: "" }); break;
              case "purchaseOrder.getById": await smartSync("purchaseOrders", "sgf_purchaseOrders"); result = dataService.purchaseOrder.getById(input); break;
              case "purchaseOrder.getByCustomerId": await smartSync("purchaseOrders", "sgf_purchaseOrders"); result = dataService.purchaseOrder.getByCustomerId(input); break;
              case "purchaseOrder.create": { result = dataService.purchaseOrder.create(input); await pushPurchaseOrder(result); reloadFromStorage(["sgf_purchaseOrders"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "purchaseOrders", count: 1 } })); break; }
              case "purchaseOrder.update": { const { id, data } = input; result = dataService.purchaseOrder.update({ id, data }); if (result) { await pushPurchaseOrder(result); reloadFromStorage(["sgf_purchaseOrders"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "purchaseOrders", count: 1 } })); } break; }
              case "purchaseOrder.updateStatus": { result = dataService.purchaseOrder.updateStatus(input); if (result) { await pushPurchaseOrder(result); reloadFromStorage(["sgf_purchaseOrders", "sgf_invoices"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "purchaseOrders", count: 1 } })); } break; }
              case "purchaseOrder.delete": { result = dataService.purchaseOrder.delete(input); if (result?.success) { await removePurchaseOrder(input); reloadFromStorage(["sgf_purchaseOrders"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "purchaseOrders", count: 1 } })); } break; }
              case "packingList.list": await smartSync("packingLists", "sgf_packingLists"); result = dataService.packingList.list(); break;
              case "packingList.getById": await smartSync("packingLists", "sgf_packingLists"); result = dataService.packingList.getById(input); break;
              case "packingList.create": { result = dataService.packingList.create(input); await pushPackingListLine(result); reloadFromStorage(["sgf_packingLists"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "packingLists", count: 1 } })); break; }
              case "packingList.update": { const { id, data } = input; result = dataService.packingList.update({ id, data }); if (result) { await pushPackingListLine(result); reloadFromStorage(["sgf_packingLists"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "packingLists", count: 1 } })); } break; }
              case "packingList.delete": { result = dataService.packingList.delete(input); if (result?.success) { await removePackingListLine(input); reloadFromStorage(["sgf_packingLists"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "packingLists", count: 1 } })); } break; }
              case "barrel.list": await smartSync("barrels", "sgf_barrels"); result = dataService.barrel.list(); break;
              case "barrel.getById": await smartSync("barrels", "sgf_barrels"); result = dataService.barrel.getById(input); break;
              case "barrel.create": { result = dataService.barrel.create(input); await pushBarrel(result); reloadFromStorage(["sgf_barrels"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "barrels", count: 1 } })); break; }
              case "barrel.update": { const { id, data } = input; result = dataService.barrel.update({ id, data }); if (result) { await pushBarrel(result); reloadFromStorage(["sgf_barrels"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "barrels", count: 1 } })); } break; }
              case "barrel.delete": { result = dataService.barrel.delete(input); if (result?.success) { await removeBarrel(input); reloadFromStorage(["sgf_barrels"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "barrels", count: 1 } })); } break; }
              case "coc.list": await smartSync("cocs", "sgf_cocs"); result = dataService.coc.list(); break;
              case "coc.getById": await smartSync("cocs", "sgf_cocs"); result = dataService.coc.getById(input); break;
              case "coc.create": { result = dataService.coc.create(input); await pushCOC(result); reloadFromStorage(["sgf_cocs"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "cocs", count: 1 } })); break; }
              case "coc.update": { const { id, data } = input; result = dataService.coc.update({ id, data }); if (result) { await pushCOC(result); reloadFromStorage(["sgf_cocs"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "cocs", count: 1 } })); } break; }
              case "coc.delete": { result = dataService.coc.delete(input); if (result?.success) { await removeCOC(input); reloadFromStorage(["sgf_cocs"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "cocs", count: 1 } })); } break; }
              case "collectionNote.list": await smartSync("collectionNotes", "sgf_collectionNotes"); result = dataService.collectionNote.list(); break;
              case "collectionNote.getById": await smartSync("collectionNotes", "sgf_collectionNotes"); result = dataService.collectionNote.getById(input); break;
              case "collectionNote.create": { result = dataService.collectionNote.create(input); await pushCollectionNote(result); reloadFromStorage(["sgf_collectionNotes"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "collectionNotes", count: 1 } })); break; }
              case "collectionNote.update": { const { id, data } = input; result = dataService.collectionNote.update({ id, data }); if (result) { await pushCollectionNote(result); reloadFromStorage(["sgf_collectionNotes"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "collectionNotes", count: 1 } })); } break; }
              case "collectionNote.delete": { result = dataService.collectionNote.delete(input); if (result?.success) { await pushCollectionNote(result); reloadFromStorage(["sgf_collectionNotes"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "collectionNotes", count: 1 } })); } break; }
              case "collectionPromise.list": await smartSync("collectionPromises", "sgf_collectionPromises"); result = dataService.collectionPromise.list(); break;
              case "collectionPromise.getById": await smartSync("collectionPromises", "sgf_collectionPromises"); result = dataService.collectionPromise.getById(input); break;
              case "collectionPromise.create": { result = dataService.collectionPromise.create(input); result = dataService.collectionPromise.getById(result.id); await pushCollectionPromise(result); reloadFromStorage(["sgf_collectionPromises"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "collectionPromises", count: 1 } })); break; }
              case "collectionPromise.update": { const { id, data } = input; result = dataService.collectionPromise.update({ id, data }); if (result) { await pushCollectionPromise(result); reloadFromStorage(["sgf_collectionPromises"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "collectionPromises", count: 1 } })); } break; }
              case "collectionPromise.delete": { result = dataService.collectionPromise.delete(input); if (result?.success) { await pushCollectionPromise(result); reloadFromStorage(["sgf_collectionPromises"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "collectionPromises", count: 1 } })); } break; }
              case "accountHold.list": await smartSync("accountHolds", "sgf_accountHolds"); result = dataService.accountHold.list(); break;
              case "accountHold.getById": await smartSync("accountHolds", "sgf_accountHolds"); result = dataService.accountHold.getById(input); break;
              case "accountHold.create": { result = dataService.accountHold.create(input); await pushAccountHold(result); reloadFromStorage(["sgf_accountHolds"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "accountHolds", count: 1 } })); break; }
              case "accountHold.update": { const { id, data } = input; result = dataService.accountHold.update({ id, data }); if (result) { await pushAccountHold(result); reloadFromStorage(["sgf_accountHolds"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "accountHolds", count: 1 } })); } break; }
              case "accountHold.delete": { result = dataService.accountHold.delete(input); if (result?.success) { await pushAccountHold(result); reloadFromStorage(["sgf_accountHolds"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "accountHolds", count: 1 } })); } break; }
              case "bankStatement.list": await smartSync("bankStatements", "sgf_bankStatements"); result = dataService.bankStatement.list(); break;
              case "bankStatement.getById": await smartSync("bankStatements", "sgf_bankStatements"); result = dataService.bankStatement.getById(input); break;
              case "bankStatement.create": { result = dataService.bankStatement.create(input); reloadFromStorage(["sgf_bankStatements"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "bankStatements", count: 1 } })); break; }
              case "bankStatement.update": { const { id, data } = input; result = dataService.bankStatement.update({ id, data }); if (result) { reloadFromStorage(["sgf_bankStatements"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "bankStatements", count: 1 } })); } break; }
              case "bankStatement.delete": { result = dataService.bankStatement.delete(input); if (result?.success) { reloadFromStorage(["sgf_bankStatements"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "bankStatements", count: 1 } })); } break; }
              case "bankStatement.parse": { result = parseBankStatement(input); reloadFromStorage(["sgf_bankStatements"]); break; }
              case "bankStatement.matchPayments": { result = matchBankPayments(input); reloadFromStorage(["sgf_bankStatements"]); break; }
              case "bankStatement.allocatePayments": { result = allocateBankPayments(input); reloadFromStorage(["sgf_bankStatements"]); break; }
              case "aaRate.get": result = getAARate(); break;
              case "aaRate.set": { result = setAARate(input); break; }
              default: throw new Error(`Unknown path: ${path}`);
            }

            observer.next({ result: { type: "data", data: result } });
            observer.complete();
          } catch (e: any) {
            console.error("[localLink] ERROR:", op.path, e?.message || e);
            observer.error(new Error(e?.message || "Unknown error"));
          }
        })();
      });
}
