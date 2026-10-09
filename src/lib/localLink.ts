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
    console.log("[syncFromCloud] Firebase returned", cloudData.length, type);

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
      case "userDeleted": await pushUserDelete(item); break;
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
              case "user.list": result = dataService.user.list(); break;
              case "user.authenticate": result = dataService.user.authenticate(input); break;
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
              case "stock.bulkUpload": {
                const items = input || [];
                const { created, updated } = dataService.stock.bulkCreate(items);
                result = { count: created + updated, created, updated };
                await pushStock(dataService.stock.list());
                reloadFromStorage(["sgf_products"]);
                window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "stock", count: created + updated } }));
                break;
              }
              case "customer.list": await smartSync("customers", "sgf_customers"); result = dataService.customer.list(); break;
              case "customer.search": await smartSync("customers", "sgf_customers"); result = dataService.customer.search(input || { query: "" }); break;
              case "customer.getById": await smartSync("customers", "sgf_customers"); result = dataService.customer.getById(input); break;
              case "customer.create": { result = dataService.customer.create(input); await fbPush("customer", result); reloadFromStorage(["sgf_customers"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "customers", count: 1 } })); break; }
              case "customer.update": { const { id, data } = input; result = dataService.customer.update({ id, data }); if (result) { await pushOneCustomer(result); reloadFromStorage(["sgf_customers"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "customers", count: 1 } })); } break; }
              case "customer.delete": { result = dataService.customer.delete(input); await removeOneCustomer(input); reloadFromStorage(["sgf_customers"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "customers", count: 1 } })); break; }
              case "customer.getStats": await smartSync("customers", "sgf_customers"); result = dataService.customer.getStats(); break;
              case "customer.getSalesReps": await smartSync("customers", "sgf_customers"); result = dataService.customer.getSalesReps(); break;
              case "customer.bulkUpload": result = dataService.customer.bulkUpload(input || []); break;
              case "customer.getCustomersNeedingFollowUp": await smartSync("customers", "sgf_customers"); result = dataService.customer.getCustomersNeedingFollowUp(input?.days || 10); break;
              case "order.list": await smartSync("orders", "sgf_orders"); result = dataService.order.list(); break;
              case "order.getById": await smartSync("orders", "sgf_orders"); result = dataService.order.getById(input); break;
              case "order.getStats": await smartSync("orders", "sgf_orders"); result = dataService.order.getStats(); break;
              case "order.create": {
                result = dataService.order.create(input);
                await fbPush("order", result);
                const changedStockIds = new Set((result?.items || []).map((it: any) => Number(it.stockItemId)));
                for (const stockId of changedStockIds) {
                  const prod = dataService.stock.getById(stockId);
                  if (prod) { try { await pushOneStockItem(prod); } catch (e) { console.warn("[order.create] pushOneStockItem failed for", stockId, e); } }
                }
                window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "stock", count: changedStockIds.size } }));
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
                const changedStockIds = new Set((result?.items || []).map((it: any) => Number(it.stockItemId)));
                for (const stockId of changedStockIds) {
                  const prod = dataService.stock.getById(stockId);
                  if (prod) { try { await pushOneStockItem(prod); } catch (e) { console.warn("[order.update] pushOneStockItem failed for", stockId, e); } }
                }
                window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "stock", count: changedStockIds.size } }));
                break;
              }
              case "order.updateStatus": {
                requireAdmin();
                const updateResult = dataService.order.updateStatus(input);
                result = updateResult?.order || updateResult;
                await fbPush("order", result);
                const changedStockIds = new Set((result?.items || []).map((it: any) => Number(it.stockItemId)));
                for (const stockId of changedStockIds) {
                  const prod = dataService.stock.getById(stockId);
                  if (prod) { try { await pushOneStockItem(prod); } catch (e) { console.warn("[order.updateStatus] pushOneStockItem failed for", stockId, e); } }
                }
                window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "stock", count: changedStockIds.size } }));
                if (updateResult?.cancelledInvoice) { await pushInvoice(updateResult.cancelledInvoice); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: 1 } })); }
                break;
              }
              case "order.delete": { requireAdmin(); result = dataService.order.delete(input); await fbPush("order", result); break; }
              case "order.getBySalesRep": await smartSync("orders", "sgf_orders"); result = dataService.order.getBySalesRep(input); break;
              case "order.getMonthlySales": await smartSync("orders", "sgf_orders"); result = dataService.order.getMonthlySales(); break;
              case "order.getProductSales": await smartSync("orders", "sgf_orders"); result = dataService.order.getProductSales(); break;
              case "order.getSalesBreakdown": await smartSync("orders", "sgf_orders"); result = dataService.order.getSalesBreakdown(); break;
              case "order.getSalesRepVsOrders": await smartSync("orders", "sgf_orders"); result = dataService.order.getSalesRepVsOrders(); break;
              case "order.getDailyReport": await smartSync("orders", "sgf_orders"); result = dataService.order.getDailyReport(); break;
              case "order.getWeeklyReport": await smartSync("orders", "sgf_orders"); result = dataService.order.getWeeklyReport(); break;
              case "order.getMonthlyReport": await smartSync("orders", "sgf_orders"); result = dataService.order.getMonthlyReport(); break;
              case "order.getRevenueBySalesRep": await smartSync("orders", "sgf_orders"); result = dataService.order.getRevenueBySalesRep(); break;
              case "order.getSalesByMonth": await smartSync("orders", "sgf_orders"); result = dataService.order.getSalesByMonth(); break;
              case "order.cancel": { requireAdmin(); result = dataService.order.cancel(input); await fbPush("order", result); break; }
              case "order.checkExistingSample": await smartSync("orders", "sgf_orders"); result = dataService.order.checkExistingSample(input); break;
              case "order.generateMissingInvoices": { result = dataService.order.generateMissingInvoices(); await pushInvoices(result || []); break; }
              case "order.convertQuoteToOrder": { result = dataService.order.convertQuoteToOrder(input); await fbPush("order", result); break; }
              case "order.createFromInvoice": { result = dataService.order.createFromInvoice(input); await fbPush("order", result); break; }
              case "order.getSalesReport": await smartSync("orders", "sgf_orders"); result = dataService.order.getSalesReport(); break;
              case "order.getRouteVisits": await smartSync("orders", "sgf_orders"); result = dataService.order.getRouteVisits(); break;
              case "order.getOpenOrders": await smartSync("orders", "sgf_orders"); result = dataService.order.getOpenOrders(); break;
              case "invoice.list": await smartSync("invoices", "sgf_invoices"); result = dataService.invoice.list(); break;
              case "invoice.getById": await smartSync("invoices", "sgf_invoices"); result = dataService.invoice.getById(input); break;
              case "invoice.getByOrderId": await smartSync("invoices", "sgf_invoices"); result = dataService.invoice.getByOrderId(input); break;
              case "invoice.getByCustomerId": await smartSync("invoices", "sgf_invoices"); result = dataService.invoice.getByCustomerId(input); break;
              case "invoice.create": { result = dataService.invoice.create(input); await pushInvoice(result); break; }
              case "invoice.update": { const { id, data } = input; result = dataService.invoice.updateInvoice({ id, data }); if (result) { await pushInvoice(result); } break; }
              case "invoice.updateInvoice": { const { id, data } = input; result = dataService.invoice.updateInvoice({ id, data }); if (result) { await pushInvoice(result); } break; }
              case "invoice.updateStatus": { result = dataService.invoice.updateStatus(input); await pushInvoice(result); break; }
              case "invoice.delete": { result = dataService.invoice.delete(input); await pushInvoice(result); break; }
              case "invoice.recordPayment": { result = dataService.invoice.recordPayment(input); if (result) { await pushInvoice(result); } break; }
              case "invoice.editPayment": { result = dataService.invoice.editPayment(input); if (result) { await pushInvoice(result); } break; }
              case "invoice.deletePayment": { result = dataService.invoice.deletePayment(input); if (result) { await pushInvoice(result); } break; }
              case "invoice.getCustomerStatement": await smartSync("invoices", "sgf_invoices"); result = dataService.invoice.getCustomerStatement(input); break;
              case "invoice.getStats": await smartSync("invoices", "sgf_invoices"); result = dataService.invoice.getStats(); break;
              case "invoice.getCustomerInvoiceSummary": await smartSync("invoices", "sgf_invoices"); result = dataService.invoice.getCustomerInvoiceSummary(); break;
              case "invoice.getOverdueInvoices": await smartSync("invoices", "sgf_invoices"); result = dataService.invoice.getOverdueInvoices(); break;
              case "invoice.getDailyReport": await smartSync("invoices", "sgf_invoices"); result = dataService.invoice.getDailyReport(); break;
              case "invoice.getWeeklyReport": await smartSync("invoices", "sgf_invoices"); result = dataService.invoice.getWeeklyReport(); break;
              case "invoice.getMonthlyReport": await smartSync("invoices", "sgf_invoices"); result = dataService.invoice.getMonthlyReport(); break;
              case "invoice.getReceipts": result = dataService.invoice.getReceipts(); break;
              case "invoice.getReceiptsByInvoice": result = dataService.invoice.getReceiptsByInvoice(input); break;
              case "invoice.getReceiptsByCustomer": result = dataService.invoice.getReceiptsByCustomer(input); break;
              case "invoice.getReceiptById": result = dataService.invoice.getReceiptById(input); break;
              case "invoice.bulkHistoricalImport": { result = dataService.invoice.bulkHistoricalImport(input); await pushInvoices(result || []); break; }
              case "invoice.relinkSageInvoices": result = dataService.invoice.relinkSageInvoices(); break;
              case "invoice.getCreditNotes": result = dataService.invoice.getCreditNotes(); break;
              case "invoice.getCreditNotesByInvoice": result = dataService.invoice.getCreditNotesByInvoice(input); break;
              case "invoice.getCreditNotesByCustomer": result = dataService.invoice.getCreditNotesByCustomer(input); break;
              case "invoice.getCustomerCreditBalance": result = dataService.invoice.getCustomerCreditBalance(input); break;
              case "invoice.createCreditNote": { result = dataService.invoice.createCreditNote(input); await pushCreditNote(result); break; }
              case "invoice.allocateCredit": { result = dataService.invoice.allocateCredit(input); await pushCreditNote(result); break; }
              case "invoice.voidCreditNoteAllocation": { result = dataService.invoice.voidCreditNoteAllocation(input); await pushCreditNote(result); break; }
              case "invoice.voidCreditNote": { result = dataService.invoice.voidCreditNote(input); await pushCreditNote(result); break; }
              case "invoice.generateForPO": { result = dataService.generateInvoiceForPO(input); if (result) { const allInv = dataService.invoice.list(); const newInv = allInv.find((i: any) => i.invoiceNumber === result); if (newInv) await pushInvoice(newInv); } reloadFromStorage(["sgf_invoices"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: 1 } })); break; }
              case "invoice.createOrderFromInvoice": { result = dataService.order.createFromInvoice(input); if (result && !result.error) { await pushOrder(result); } reloadFromStorage(["sgf_orders", "sgf_invoices"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "orders", count: 1 } })); break; }
              case "appointment.list": await smartSync("appointments", "sgf_appointments"); result = dataService.appointment.list(); break;
              case "appointment.getById": await smartSync("appointments", "sgf_appointments"); result = dataService.appointment.getById(input); break;
              case "appointment.getByCustomer": await smartSync("appointments", "sgf_appointments"); result = dataService.appointment.getByCustomer(input); break;
              case "appointment.getByUser": await smartSync("appointments", "sgf_appointments"); result = dataService.appointment.getByUser(input); break;
              case "appointment.create": { result = dataService.appointment.create(input); await pushAppointment(result); reloadFromStorage(["sgf_appointments"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "appointments", count: 1 } })); break; }
              case "appointment.update": { const { id, data } = input; result = dataService.appointment.update({ id, data }); if (result) { await pushAppointment(result); } reloadFromStorage(["sgf_appointments"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "appointments", count: 1 } })); break; }
              case "appointment.delete": { result = dataService.appointment.delete(input); await pushAppointmentDelete(input); reloadFromStorage(["sgf_appointments"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "appointments", count: 1 } })); break; }
              case "appointment.updateStatus": { result = dataService.appointment.updateStatus(input); if (result) { await pushAppointment(result); } reloadFromStorage(["sgf_appointments"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "appointments", count: 1 } })); break; }
              case "appointment.getStats": await smartSync("appointments", "sgf_appointments"); result = dataService.appointment.getStats(); break;
              case "checkIn.list": await smartSync("checkIns", "sgf_checkIns"); result = dataService.checkIn.list(); break;
              case "checkIn.getById": await smartSync("checkIns", "sgf_checkIns"); result = dataService.checkIn.getById(input); break;
              case "checkIn.create": { result = dataService.checkIn.create(input); await pushCheckin(result); reloadFromStorage(["sgf_checkIns"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "checkIns", count: 1 } })); break; }
              case "checkIn.update": { const { id, data } = input; result = dataService.checkIn.update({ id, data }); if (result) { await pushCheckin(result); } reloadFromStorage(["sgf_checkIns"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "checkIns", count: 1 } })); break; }
              case "checkIn.delete": { result = dataService.checkIn.delete(input); await pushCheckinDelete(input); reloadFromStorage(["sgf_checkIns"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "checkIns", count: 1 } })); break; }
              case "checkIn.checkout": { result = dataService.checkIn.checkout(input); if (result) { await pushCheckin(result); } reloadFromStorage(["sgf_checkIns"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "checkIns", count: 1 } })); break; }
              case "checkIn.getStats": await smartSync("checkIns", "sgf_checkIns"); result = dataService.checkIn.getStats(); break;
              case "checkIn.getDailyReport": await smartSync("checkIns", "sgf_checkIns"); result = dataService.checkIn.getDailyReport(); break;
              case "checkIn.getWeeklyReport": await smartSync("checkIns", "sgf_checkIns"); result = dataService.checkIn.getWeeklyReport(input?.year, input?.week); break;
              case "checkIn.getMonthlyReport": await smartSync("checkIns", "sgf_checkIns"); result = dataService.checkIn.getMonthlyReport(input?.year, input?.month); break;
              case "checkIn.getAARate": result = getAARate(); break;
              case "checkIn.setAARate": result = setAARate(input); break;
              case "followUpAction.list": await smartSync("followUpActions", "sgf_followUpActions"); result = dataService.followUpAction.list(); break;
              case "followUpAction.listByCustomer": await smartSync("followUpActions", "sgf_followUpActions"); result = dataService.followUpAction.listByCustomer(input); break;
              case "followUpAction.create": result = dataService.followUpAction.create(input); await pushFollowUpAction(result); reloadFromStorage(["sgf_followUpActions"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "followUpActions", count: 1 } })); break;
              case "followUpAction.getStats": await smartSync("followUpActions", "sgf_followUpActions"); result = dataService.followUpAction.getStats(); break;
              case "specialPrice.listByCustomer": await smartSync("specialPrices", "sgf_specialPrices"); result = dataService.specialPrice.listByCustomer(input); break;
              case "specialPrice.set": result = dataService.specialPrice.set(input); break;
              case "specialPrice.delete": result = dataService.specialPrice.delete(input); break;
              case "salesRep.list": await smartSync("salesReps", "sgf_salesReps"); await smartSync("customers", "sgf_customers"); await smartSync("corporateCustomers", "sgf_corporateCustomers"); await smartSync("orders", "sgf_orders"); await smartSync("purchaseOrders", "sgf_purchaseOrders"); await smartSync("invoices", "sgf_invoices"); result = dataService.salesRep.list(); break;
              case "salesRep.search": await smartSync("salesReps", "sgf_salesReps"); await smartSync("customers", "sgf_customers"); await smartSync("corporateCustomers", "sgf_corporateCustomers"); await smartSync("orders", "sgf_orders"); await smartSync("purchaseOrders", "sgf_purchaseOrders"); await smartSync("invoices", "sgf_invoices"); result = dataService.salesRep.search(input || { query: "" }); break;
              case "salesRep.getById": await smartSync("salesReps", "sgf_salesReps"); await smartSync("customers", "sgf_customers"); await smartSync("corporateCustomers", "sgf_corporateCustomers"); await smartSync("orders", "sgf_orders"); await smartSync("purchaseOrders", "sgf_purchaseOrders"); await smartSync("invoices", "sgf_invoices"); result = dataService.salesRep.getById(input); break;
              case "salesRep.getStats": await smartSync("salesReps", "sgf_salesReps"); await smartSync("customers", "sgf_customers"); await smartSync("corporateCustomers", "sgf_corporateCustomers"); await smartSync("orders", "sgf_orders"); await smartSync("purchaseOrders", "sgf_purchaseOrders"); await smartSync("invoices", "sgf_invoices"); result = dataService.salesRep.getStats(); break;
              case "salesRep.getSalesBreakdown": await smartSync("salesReps", "sgf_salesReps"); await smartSync("customers", "sgf_customers"); await smartSync("corporateCustomers", "sgf_corporateCustomers"); await smartSync("orders", "sgf_orders"); await smartSync("purchaseOrders", "sgf_purchaseOrders"); await smartSync("invoices", "sgf_invoices"); result = dataService.salesRep.getSalesBreakdown(); break;
              case "salesRep.create": result = dataService.salesRep.create(input); if (result) await pushSalesRep(result); reloadFromStorage(["sgf_salesReps"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "salesReps", count: 1 } })); break;
              case "salesRep.update": { const { id, data } = input; result = dataService.salesRep.update({ id, data }); if (result) { if (result.oldName && result.oldName !== result.name) await removeSalesRep(result.oldName); await pushSalesRep(result); } reloadFromStorage(["sgf_salesReps"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "salesReps", count: 1 } })); break; }
              case "salesRep.toggleActive": result = dataService.salesRep.toggleActive(input); if (result) await pushSalesRep(result); reloadFromStorage(["sgf_salesReps"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "salesReps", count: 1 } })); break;
              case "salesRep.delete": result = dataService.salesRep.delete(input); if (result) await removeSalesRep(result.deletedName || input.id); reloadFromStorage(["sgf_salesReps"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "salesReps", count: 1 } })); break;
              case "dashboard.stats": await smartSync("orders", "sgf_orders"); await smartSync("purchaseOrders", "sgf_purchaseOrders"); await smartSync("invoices", "sgf_invoices"); await smartSync("customers", "sgf_customers"); await smartSync("corporateCustomers", "sgf_corporateCustomers"); await smartSync("products", "sgf_products"); result = dataService.dashboard.stats(); break;
              case "audit.list": await smartSync("auditLogs", "sgf_auditLogs"); result = dataService.audit.list(); break;
              case "audit.getCustomerDeletions": await smartSync("auditLogs", "sgf_auditLogs"); result = dataService.audit.getCustomerDeletions(); break;
              case "audit.getAddressChanges": await smartSync("auditLogs", "sgf_auditLogs"); result = dataService.audit.getAddressChanges(); break;
              case "followUp.list": await smartSync("followUps", "sgf_followUps"); result = dataService.followUp.list(); break;
              case "followUp.update": result = dataService.followUp.update(input); if (result) { await pushFollowUp(result); reloadFromStorage(["sgf_followUps"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "followUpActions", count: 1 } })); } break;
              case "followUp.getStats": await smartSync("followUps", "sgf_followUps"); result = dataService.followUp.getStats(); break;
              case "sampleReport.getByCustomer": await smartSync("orders", "sgf_orders"); await smartSync("invoices", "sgf_invoices"); result = dataService.sampleReport.getByCustomer(input); break;
              case "sampleReport.getAll": await smartSync("orders", "sgf_orders"); await smartSync("invoices", "sgf_invoices"); result = dataService.sampleReport.getAll(); break;
              case "collections.getOverdueInvoices": await smartSync("invoices", "sgf_invoices"); result = dataService.collections.getOverdueInvoices(); break;
              case "collections.getDailyReport": await smartSync("invoices", "sgf_invoices"); result = dataService.collections.getDailyReport(); break;
              case "collections.getStats": await smartSync("invoices", "sgf_invoices"); result = dataService.collections.getStats(); break;
              case "collections.getCustomerPaymentHistory": await smartSync("invoices", "sgf_invoices"); result = dataService.collections.getCustomerPaymentHistory(input); break;
              case "collections.addNote": result = dataService.collections.addNote(input); break;
              case "collections.recordPromise": result = dataService.collections.recordPromise(input); break;
              case "collections.placeHold": result = dataService.collections.placeHold(input); break;
              case "collections.releaseHold": result = dataService.collections.releaseHold(input); break;
              case "corporateCustomer.list": await smartSync("corporateCustomers", "sgf_corporateCustomers"); result = dataService.corporateCustomer.list(); break;
              case "corporateCustomer.listByCompany": await smartSync("corporateCustomers", "sgf_corporateCustomers"); result = dataService.corporateCustomer.listByCompany(input); break;
              case "corporateCustomer.getById": await smartSync("corporateCustomers", "sgf_corporateCustomers"); result = dataService.corporateCustomer.getById(input); break;
              case "corporateCustomer.create": {
                result = dataService.corporateCustomer.create(input);
                await pushCorporateCustomer(result);
                await pushOneCustomer(dataService.customer.list().find((c: any) => c.id == result.id));
                reloadFromStorage(["sgf_corporateCustomers", "sgf_customers"]);
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
                reloadFromStorage(["sgf_corporateCustomers", "sgf_customers"]);
                window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "corporateCustomers", count: 1 } }));
                window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "customers", count: 1 } }));
                break;
              }
              case "corporateCustomer.delete": { result = dataService.corporateCustomer.delete(input); await removeCorporateCustomer(input); await removeOneCustomer(input); reloadFromStorage(["sgf_corporateCustomers", "sgf_customers"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "corporateCustomers", count: 1 } })); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "customers", count: 1 } })); break; }
              case "purchaseOrder.list": await smartSync("purchaseOrders", "sgf_purchaseOrders"); result = dataService.purchaseOrder.list(); break;
              case "purchaseOrder.getById": await smartSync("purchaseOrders", "sgf_purchaseOrders"); result = dataService.purchaseOrder.getById(input); break;
              case "purchaseOrder.create": {
                const custExists = dataService.corporateCustomer.getById(input.corporateCustomerId) || dataService.customer.getById(input.corporateCustomerId);
                if (!custExists) throw new Error(`Corporate customer (ID: ${input.corporateCustomerId}) not found.`);
                result = dataService.purchaseOrder.create(input);
                await pushPurchaseOrder(result);
                reloadFromStorage(["sgf_purchaseOrders"]);
                window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "purchaseOrders", count: 1 } }));
                break;
              }
              case "purchaseOrder.update": { const { id, data } = input; result = dataService.purchaseOrder.update({ id, data }); if (result) { await pushPurchaseOrder(result); } reloadFromStorage(["sgf_purchaseOrders"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "purchaseOrders", count: 1 } })); break; }
              case "purchaseOrder.updateStatus": { result = dataService.purchaseOrder.updateStatus(input); await pushPurchaseOrder(result); reloadFromStorage(["sgf_purchaseOrders"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "purchaseOrders", count: 1 } })); break; }
              case "purchaseOrder.delete": { result = dataService.purchaseOrder.delete(input); await removePurchaseOrder(input); reloadFromStorage(["sgf_purchaseOrders"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "purchaseOrders", count: 1 } })); break; }
              case "barrel.list": await smartSync("barrels", "sgf_barrels"); result = dataService.barrel.list(); break;
              case "barrel.listByPurchaseOrder": await smartSync("barrels", "sgf_barrels"); result = dataService.barrel.listByPurchaseOrder(input); break;
              case "barrel.getById": await smartSync("barrels", "sgf_barrels"); result = dataService.barrel.getById(input); break;
              case "barrel.create": { result = dataService.barrel.create(input); await pushBarrel(result); reloadFromStorage(["sgf_barrels"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "barrels", count: 1 } })); break; }
              case "barrel.update": { const { id, data } = input; result = dataService.barrel.update({ id, data }); if (result) { await pushBarrel(result); } reloadFromStorage(["sgf_barrels"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "barrels", count: 1 } })); break; }
              case "barrel.delete": { result = dataService.barrel.delete(input); await removeBarrel(input); reloadFromStorage(["sgf_barrels"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "barrels", count: 1 } })); break; }
              case "coc.list": await smartSync("certificatesOfCompliance", "sgf_cocs"); result = dataService.coc.list(); break;
              case "coc.listByBarrel": await smartSync("certificatesOfCompliance", "sgf_cocs"); result = dataService.coc.listByBarrel(input); break;
              case "coc.listByPurchaseOrder": await smartSync("certificatesOfCompliance", "sgf_cocs"); result = dataService.coc.listByPurchaseOrder(input); break;
              case "coc.listByInvoice": await smartSync("certificatesOfCompliance", "sgf_cocs"); result = dataService.coc.listByInvoice(input); break;
              case "coc.generateForInvoice": {
                // 1. Find existing COC IDs for this invoice BEFORE generating (so we can delete from Firebase)
                const existingCOCs = dataService.coc.listByInvoice(input);
                const existingIds = (existingCOCs || []).map((c: any) => c.id);
                // 2. Generate new COCs (this removes old ones from local storage)
                result = dataService.coc.generateForInvoice(input);
                // 3. Remove old COCs from Firebase first
                if (existingIds.length > 0) {
                  for (const oldId of existingIds) { await removeCOC(oldId); }
                }
                // 4. Push new COCs to Firebase
                if (Array.isArray(result) && result.length > 0) {
                  for (const c of result) { await pushCOC(c); }
                }
                reloadFromStorage(["sgf_cocs"]);
                window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "certificatesOfCompliance", count: Array.isArray(result) ? result.length : 0 } }));
                break;
              }
              case "coc.getById": await smartSync("certificatesOfCompliance", "sgf_cocs"); result = dataService.coc.getById(input); break;
              case "coc.create": { result = dataService.coc.create(input); await pushCOC(result); reloadFromStorage(["sgf_cocs"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "certificatesOfCompliance", count: 1 } })); break; }
              case "coc.update": { const { id, data } = input; result = dataService.coc.update({ id, data }); if (result) { await pushCOC(result); } reloadFromStorage(["sgf_cocs"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "certificatesOfCompliance", count: 1 } })); break; }
              case "coc.delete": { result = dataService.coc.delete(input); await removeCOC(input); reloadFromStorage(["sgf_cocs"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "certificatesOfCompliance", count: 1 } })); break; }
              case "coc.bulkGenerateForPO": { const { poId, cocDataList, deleteOrphanIds } = input;
                const allFirebaseCOCs = await readFromFirebase("certificatesOfCompliance");
                const firebasePOCOCs = allFirebaseCOCs.filter((c: any) => c.purchaseOrderId == poId);
                for (const c of firebasePOCOCs) { await removeCOC(c.id); }
                const localCOCs = dataService.coc.listByPurchaseOrder(poId);
                for (const c of localCOCs) { dataService.coc.delete(c.id); }
                setStorageItem("sgf_cocs", "[]");
                if (deleteOrphanIds && deleteOrphanIds.length > 0) { for (const oid of deleteOrphanIds) { await removeCOC(oid); } }
                const created = dataService.coc.bulkGenerateForPO(poId, cocDataList, deleteOrphanIds || []);
                setStorageItem("sgf_cocs", JSON.stringify(created));
                for (const c of created) { await pushCOC(c); }
                reloadFromStorage();
                window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "certificatesOfCompliance", count: created.length } }));
                result = created; break; }
              case "packingList.listByPurchaseOrder": result = dataService.packingList.listByPurchaseOrder(input); break;
              case "packingList.create": { result = dataService.packingList.create(input); await pushPackingListLine(result); reloadFromStorage(["sgf_packingListLines"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "packingListLines", count: 1 } })); break; }
              case "packingList.update": { const { id, data } = input; result = dataService.packingList.update({ id, data }); if (result) { await pushPackingListLine(result); } reloadFromStorage(["sgf_packingListLines"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "packingListLines", count: 1 } })); break; }
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
