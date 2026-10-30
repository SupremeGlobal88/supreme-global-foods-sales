import type { AppRouter } from "./appRouter";
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import { observable } from "@trpc/server/observable";
import {
  dataService,
  reloadFromStorage,
  fixDraftInvoicesForDeliveredOrders,
  fixSageInvoiceDates,
} from "./dataService";
import { DATA_SERVICE_EXTRAS_LOADED } from "./dataServiceExtras";
import { getStorageItem, setStorageItem } from "./compressedStorage";
import {
  pushOrder,
  pushAppointment,
  pushCheckin,
  pushInvoice,
  pushCustomer,
  pushStock,
  pushCOC,
  removeCOC,
  pushCreditNote,
  pushUser,
  pushUserDelete,
  pushSalesRep,
  pushSpecialPrice,
  pushFollowUp,
  pushFollowUpAction,
  pushCorporateCustomer,
  pushPurchaseOrder,
  pushBarrel,
  pushPackingList,
  pushCollectionNote,
  pushCollectionPromise,
  pushAudit,
  pushSystemLog,
  removeOneCustomer,
  removeOneStockItem,
  removeOrder,
  removeInvoice,
  pushAppointmentDelete,
  pushCheckinDelete,
  removeSpecialPrice,
  removeSalesRep,
  removeCorporateCustomer,
  removePurchaseOrder,
  removeBarrel,
  removePackingListLine,
} from "./firebaseSync";

type RouterInput = inferRouterInputs<AppRouter>;
type RouterOutput = inferRouterOutputs<AppRouter>;

// Cloud-first sync helper

// ------------------------------------------------------------------
//  Main handler
// ------------------------------------------------------------------
export async function localLinkHandler(path: string, input: any) {
  let result: any;

  try {
    const [category, action] = path.split(".");

    switch (path) {
      // ================================================================
      //  AUTH / USERS
      // ================================================================
      case "auth.me":
        result = { id: 1, name: "Admin", role: "admin", isActive: true };
        break;

      case "user.list":
        result = dataService.user.list();
        break;
      case "user.getById":
        result = dataService.user.getById(input);
        break;
      case "user.authenticate":
        result = dataService.user.authenticate(input);
        break;
      case "user.create": {
        result = dataService.user.create(input);
        if (result) {
          await pushUser(result);
          reloadFromStorage(["sgf_users"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "users", count: 1 } }));
        }
        break;
      }
      case "user.update": {
        const { id: uid, data: udata } = input;
        result = dataService.user.update({ id: uid, data: udata });
        if (result) {
          await pushUser(result);
          reloadFromStorage(["sgf_users"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "users", count: 1 } }));
        }
        break;
      }
      case "user.delete": {
        result = dataService.user.delete(input);
        if (result?.success) {
          await pushUserDelete(input);
          reloadFromStorage(["sgf_users"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "users", count: 0 } }));
        }
        break;
      }
      case "user.toggleActive": {
        result = dataService.user.toggleActive(input);
        if (result) {
          await pushUser(result);
          reloadFromStorage(["sgf_users"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "users", count: 1 } }));
        }
        break;
      }
      case "user.resetPin": {
        result = dataService.user.resetPin(input);
        if (result) {
          await pushUser(result);
          reloadFromStorage(["sgf_users"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "users", count: 1 } }));
        }
        break;
      }

      // ================================================================
      //  STOCK
      // ================================================================
      case "stock.list":
        result = dataService.stock.list();
        break;
      case "stock.search":
        result = dataService.stock.search(input || { query: "" });
        break;
      case "stock.getById":
        result = dataService.stock.getById(input);
        break;
      case "stock.getCategories":
        result = dataService.stock.getCategories();
        break;
      case "stock.getStats":
        result = dataService.stock.getStats();
        break;
      case "stock.getDailyInvoicedStock":
        result = dataService.stock.getDailyInvoicedStock(input);
        break;
      case "stock.reconcileStock":
        result = dataService.stock.reconcileStock(input);
        break;
      case "stock.create": {
        result = dataService.stock.create(input);
        if (result) {
          await pushStock(result);
          reloadFromStorage(["sgf_products"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "products", count: 1 } }));
        }
        break;
      }
      case "stock.update": {
        const { id: sid, data: sdata } = input;
        result = dataService.stock.update({ id: sid, data: sdata });
        if (result) {
          await pushStock(result);
          reloadFromStorage(["sgf_products"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "products", count: 1 } }));
        }
        break;
      }
      case "stock.delete": {
        result = dataService.stock.delete(input);
        if (result?.success) {
          await removeOneStockItem(input);
          reloadFromStorage(["sgf_products"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "products", count: 0 } }));
        }
        break;
      }
      case "stock.bulkUpload": {
        result = dataService.stock.bulkCreate(input);
        if (result?.success) {
          const items = dataService.stock.list();
          for (const item of items) {
            try { await pushStock(item); } catch { /* ignore */ }
          }
          reloadFromStorage(["sgf_products"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "products", count: items.length } }));
        }
        break;
      }

      // ================================================================
      //  CUSTOMERS
      // ================================================================
      case "customer.list":
        result = dataService.customer.list();
        break;
      case "customer.search":
        result = dataService.customer.search(input || { query: "" });
        break;
      case "customer.getById":
        result = dataService.customer.getById(input);
        break;
      case "customer.getStats":
        result = dataService.customer.getStats();
        break;
      case "customer.getSalesReps":
        result = dataService.customer.getSalesReps();
        break;
      case "customer.create": {
        result = dataService.customer.create(input);
        if (result) {
          await pushCustomer(result);
          reloadFromStorage(["sgf_customers"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "customers", count: 1 } }));
        }
        break;
      }
      case "customer.update": {
        const { id: cid, data: cdata } = input;
        result = dataService.customer.update({ id: cid, data: cdata });
        if (result) {
          await pushCustomer(result);
          reloadFromStorage(["sgf_customers"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "customers", count: 1 } }));
        }
        break;
      }
      case "customer.delete": {
        result = dataService.customer.delete(input);
        if (result?.success) {
          await removeOneCustomer(input);
          reloadFromStorage(["sgf_customers"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "customers", count: 0 } }));
        }
        break;
      }
      case "customer.bulkUpload": {
        result = dataService.customer.bulkUpload(input);
        if (result?.success) {
          const customers = dataService.customer.list();
          for (const cust of customers) {
            try { await pushCustomer(cust); } catch { /* ignore */ }
          }
          reloadFromStorage(["sgf_customers"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "customers", count: customers.length } }));
        }
        break;
      }
      case "customer.getCustomersNeedingFollowUp":
        result = dataService.customer.getCustomersNeedingFollowUp(input?.days || 10);
        break;

      // ================================================================
      //  ORDERS
      // ================================================================
      case "order.list":
        result = dataService.order.list();
        break;
      case "order.getById":
        result = dataService.order.getById(input);
        break;
      case "order.getStats":
        result = dataService.order.getStats();
        break;
      case "order.create": {
        result = dataService.order.create(input);
        if (result) {
          await pushOrder(result);
          reloadFromStorage(["sgf_orders"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "orders", count: 1 } }));
        }
        break;
      }
      case "order.update": {
        const { id: oid, data: odata } = input;
        result = dataService.order.update({ id: oid, data: odata });
        if (result) {
          await pushOrder(result);
          reloadFromStorage(["sgf_orders"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "orders", count: 1 } }));
        }
        break;
      }
      case "order.delete": {
        result = dataService.order.update({ id: input, data: { status: "cancelled", updatedAt: new Date().toISOString() } });
        if (result) {
          await removeOrder(input);
          reloadFromStorage(["sgf_orders"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "orders", count: 0 } }));
        }
        break;
      }
      case "order.cancel": {
        const { id: cancelId, reason } = input;
        result = dataService.order.update({ id: cancelId, data: { status: "cancelled", cancellationReason: reason, updatedAt: new Date().toISOString() } });
        if (result) {
          await pushOrder(result);
          reloadFromStorage(["sgf_orders"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "orders", count: 1 } }));
        }
        break;
      }
      case "order.convertQuote": {
        result = dataService.order.convertQuote(input);
        if (result) {
          await pushOrder(result);
          reloadFromStorage(["sgf_orders"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "orders", count: 1 } }));
        }
        break;
      }
      case "order.search":
        result = dataService.order.search(input || { query: "" });
        break;
      case "order.getByCustomer":
        result = dataService.order.getByCustomer(input);
        break;
      case "order.getBySalesRep":
        result = dataService.order.getBySalesRep(input);
        break;
      case "order.getPendingDelivery":
        result = dataService.order.getPendingDelivery();
        break;
      case "order.getPendingInvoices":
        result = dataService.order.getPendingInvoices();
        break;
      case "order.getRecent":
        result = dataService.order.getRecent(input || 5);
        break;

      // ================================================================
      //  INVOICES
      // ================================================================
      case "invoice.list":
        result = dataService.invoice.list();
        break;
      case "invoice.getById":
        result = dataService.invoice.getById(input);
        break;
      case "invoice.getByOrder":
        result = dataService.invoice.getByOrder(input);
        break;
      case "invoice.getByCustomer":
        result = dataService.invoice.getByCustomer(input);
        break;
      case "invoice.getStats":
        result = dataService.invoice.getStats();
        break;
      case "invoice.getAgedDebtors":
        result = dataService.invoice.getAgedDebtors();
        break;
      case "invoice.getOverdue":
        result = dataService.invoice.getOverdue();
        break;
      case "invoice.getMonthlyRevenue":
        result = dataService.invoice.getMonthlyRevenue(input || { year: new Date().getFullYear() });
        break;
      case "invoice.getBySalesRep":
        result = dataService.invoice.getBySalesRep(input);
        break;
      case "invoice.getRecent":
        result = dataService.invoice.getRecent(input || 5);
        break;
      case "invoice.getCreditNotes":
        result = dataService.invoice.getCreditNotes();
        break;
      case "invoice.search":
        result = dataService.invoice.search(input || { query: "" });
        break;
      case "invoice.getByNumber":
        result = dataService.invoice.getByNumber(input);
        break;
      case "invoice.create": {
        result = dataService.invoice.create(input);
        if (result) {
          await pushInvoice(result);
          reloadFromStorage(["sgf_invoices"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: 1 } }));
        }
        break;
      }
      case "invoice.update": {
        const { id: iid, data: idata } = input;
        result = dataService.invoice.update({ id: iid, data: idata });
        if (result) {
          await pushInvoice(result);
          reloadFromStorage(["sgf_invoices"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: 1 } }));
        }
        break;
      }
      case "invoice.delete": {
        result = dataService.invoice.delete(input);
        if (result?.success) {
          await removeInvoice(input);
          reloadFromStorage(["sgf_invoices"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: 0 } }));
        }
        break;
      }
      case "invoice.recordPayment": {
        result = dataService.invoice.recordPayment(input);
        if (result) {
          await pushInvoice(result);
          reloadFromStorage(["sgf_invoices"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: 1 } }));
        }
        break;
      }
      case "invoice.applyCreditNote": {
        result = dataService.invoice.applyCreditNote(input);
        if (result) {
          await pushInvoice(result);
          reloadFromStorage(["sgf_invoices"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: 1 } }));
        }
        break;
      }
      case "invoice.generateFromOrder": {
        result = dataService.invoice.generateFromOrder(input);
        if (result) {
          await pushInvoice(result);
          reloadFromStorage(["sgf_invoices"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: 1 } }));
        }
        break;
      }
      case "invoice.generateFromPO": {
        result = dataService.generateInvoiceForPO?.(input);
        if (result) {
          await pushInvoice(result);
          reloadFromStorage(["sgf_invoices"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: 1 } }));
        }
        break;
      }
      case "invoice.activateFromOrder": {
        result = dataService.invoice.activateFromOrder(input);
        if (result) {
          await pushInvoice(result);
          reloadFromStorage(["sgf_invoices"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: 1 } }));
        }
        break;
      }
      case "invoice.activateFromPO": {
        result = dataService.invoice.activateFromPO(input);
        if (result) {
          await pushInvoice(result);
          reloadFromStorage(["sgf_invoices"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: 1 } }));
        }
        break;
      }
      case "invoice.cancel": {
        const { id: invCancelId, reason: invReason } = input;
        result = dataService.invoice.cancel(invCancelId, invReason);
        if (result) {
          await pushInvoice(result);
          reloadFromStorage(["sgf_invoices"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: 1 } }));
        }
        break;
      }
      case "invoice.updateStatus": {
        result = dataService.invoice.updateStatus(input);
        if (result) {
          await pushInvoice(result);
          reloadFromStorage(["sgf_invoices"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: 1 } }));
        }
        break;
      }

      // ================================================================
      //  APPOINTMENTS
      // ================================================================
      case "appointment.list":
        result = dataService.appointment.list();
        break;
      case "appointment.getById":
        result = dataService.appointment.getById(input);
        break;
      case "appointment.getByDate":
        result = dataService.appointment.getByDate(input);
        break;
      case "appointment.getByRep":
        result = dataService.appointment.getByRep(input);
        break;
      case "appointment.getByCustomer":
        result = dataService.appointment.getByCustomer(input);
        break;
      case "appointment.create": {
        result = dataService.appointment.create(input);
        if (result) {
          await pushAppointment(result);
          reloadFromStorage(["sgf_appointments"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "appointments", count: 1 } }));
        }
        break;
      }
      case "appointment.update": {
        const { id: aid, data: adata } = input;
        result = dataService.appointment.update({ id: aid, data: adata });
        if (result) {
          await pushAppointment(result);
          reloadFromStorage(["sgf_appointments"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "appointments", count: 1 } }));
        }
        break;
      }
      case "appointment.delete": {
        result = dataService.appointment.delete(input);
        if (result?.success) {
          await pushAppointmentDelete(input);
          reloadFromStorage(["sgf_appointments"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "appointments", count: 0 } }));
        }
        break;
      }
      case "appointment.getUpcoming":
        result = dataService.appointment.getUpcoming(input || 7);
        break;
      case "appointment.getRecentCheckIns":
        result = dataService.appointment.getRecentCheckIns(input || 7);
        break;

      // ================================================================
      //  CHECK-INS
      // ================================================================
      case "checkIn.list":
        result = dataService.checkIn.list();
        break;
      case "checkIn.getById":
        result = dataService.checkIn.getById(input);
        break;
      case "checkIn.getByRep":
        result = dataService.checkIn.getByRep(input);
        break;
      case "checkIn.getByDate":
        result = dataService.checkIn.getByDate(input);
        break;
      case "checkIn.getRecent":
        result = dataService.checkIn.getRecent(input || 7);
        break;
      case "checkIn.create": {
        result = dataService.checkIn.create(input);
        if (result) {
          await pushCheckin(result);
          reloadFromStorage(["sgf_checkins"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "checkIns", count: 1 } }));
        }
        break;
      }
      case "checkIn.update": {
        const { id: cid, data: cdata } = input;
        result = dataService.checkIn.update({ id: cid, data: cdata });
        if (result) {
          await pushCheckin(result);
          reloadFromStorage(["sgf_checkins"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "checkIns", count: 1 } }));
        }
        break;
      }
      case "checkIn.delete": {
        result = dataService.checkIn.delete(input);
        if (result?.success) {
          await pushCheckinDelete(input);
          reloadFromStorage(["sgf_checkins"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "checkIns", count: 0 } }));
        }
        break;
      }

      // ================================================================
      //  SPECIAL PRICES
      // ================================================================
      case "specialPrice.list":
        result = dataService.specialPrice.list();
        break;
      case "specialPrice.getById":
        result = dataService.specialPrice.getById(input);
        break;
      case "specialPrice.getByCustomer":
        result = dataService.specialPrice.getByCustomer(input);
        break;
      case "specialPrice.create": {
        result = dataService.specialPrice.create(input);
        if (result) {
          await pushSpecialPrice(result);
          reloadFromStorage(["sgf_specialPrices"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "specialPrices", count: 1 } }));
        }
        break;
      }
      case "specialPrice.update": {
        const { id: spid, data: spdata } = input;
        result = dataService.specialPrice.update({ id: spid, data: spdata });
        if (result) {
          await pushSpecialPrice(result);
          reloadFromStorage(["sgf_specialPrices"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "specialPrices", count: 1 } }));
        }
        break;
      }
      case "specialPrice.delete": {
        result = dataService.specialPrice.delete(input);
        if (result?.success) {
          await removeSpecialPrice(input);
          reloadFromStorage(["sgf_specialPrices"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "specialPrices", count: 0 } }));
        }
        break;
      }

      // ================================================================
      //  FOLLOW-UPS
      // ================================================================
      case "followUp.list":
        result = dataService.followUp.list();
        break;
      case "followUp.getById":
        result = dataService.followUp.getById(input);
        break;
      case "followUp.getByCustomer":
        result = dataService.followUp.getByCustomer(input);
        break;
      case "followUp.getByRep":
        result = dataService.followUp.getByRep(input);
        break;
      case "followUp.create": {
        result = dataService.followUp.create(input);
        if (result) {
          await pushFollowUp(result);
          reloadFromStorage(["sgf_followUps"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "followUps", count: 1 } }));
        }
        break;
      }
      case "followUp.update": {
        const { id: fuid, data: fudata } = input;
        result = dataService.followUp.update({ id: fuid, data: fudata });
        if (result) {
          await pushFollowUp(result);
          reloadFromStorage(["sgf_followUps"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "followUps", count: 1 } }));
        }
        break;
      }
      case "followUp.delete": {
        result = dataService.followUp.delete(input);
        if (result?.success) {
          await pushFollowUp({ id: input, deleted: true });
          reloadFromStorage(["sgf_followUps"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "followUps", count: 0 } }));
        }
        break;
      }

      // ================================================================
      //  FOLLOW-UP ACTIONS
      // ================================================================
      case "followUpAction.list":
        result = dataService.followUpAction.list();
        break;
      case "followUpAction.getById":
        result = dataService.followUpAction.getById(input);
        break;
      case "followUpAction.getByFollowUp":
        result = dataService.followUpAction.getByFollowUp(input);
        break;
      case "followUpAction.create": {
        result = dataService.followUpAction.create(input);
        if (result) {
          await pushFollowUpAction(result);
          reloadFromStorage(["sgf_followUpActions"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "followUpActions", count: 1 } }));
        }
        break;
      }
      case "followUpAction.update": {
        const { id: faid, data: fadata } = input;
        result = dataService.followUpAction.update({ id: faid, data: fadata });
        if (result) {
          await pushFollowUpAction(result);
          reloadFromStorage(["sgf_followUpActions"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "followUpActions", count: 1 } }));
        }
        break;
      }
      case "followUpAction.delete": {
        result = dataService.followUpAction.delete(input);
        if (result?.success) {
          await pushFollowUpAction({ id: input, deleted: true });
          reloadFromStorage(["sgf_followUpActions"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "followUpActions", count: 0 } }));
        }
        break;
      }

      // ================================================================
      //  COLLECTIONS
      // ================================================================
      case "collectionNote.list":
        result = dataService.collectionNote.list();
        break;
      case "collectionNote.getById":
        result = dataService.collectionNote.getById(input);
        break;
      case "collectionNote.getByCustomer":
        result = dataService.collectionNote.getByCustomer(input);
        break;
      case "collectionNote.create": {
        result = dataService.collectionNote.create(input);
        if (result) {
          await pushCollectionNote(result);
          reloadFromStorage(["sgf_collectionNotes"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "collectionNotes", count: 1 } }));
        }
        break;
      }
      case "collectionNote.update": {
        const { id: cnid, data: cndata } = input;
        result = dataService.collectionNote.update({ id: cnid, data: cndata });
        if (result) {
          await pushCollectionNote(result);
          reloadFromStorage(["sgf_collectionNotes"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "collectionNotes", count: 1 } }));
        }
        break;
      }
      case "collectionNote.delete": {
        result = dataService.collectionNote.delete(input);
        if (result?.success) {
          await pushCollectionNote({ id: input, deleted: true });
          reloadFromStorage(["sgf_collectionNotes"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "collectionNotes", count: 0 } }));
        }
        break;
      }
      case "collectionPromise.list":
        result = dataService.collectionPromise.list();
        break;
      case "collectionPromise.getById":
        result = dataService.collectionPromise.getById(input);
        break;
      case "collectionPromise.getByCustomer":
        result = dataService.collectionPromise.getByCustomer(input);
        break;
      case "collectionPromise.create": {
        result = dataService.collectionPromise.create(input);
        if (result) {
          await pushCollectionPromise(result);
          reloadFromStorage(["sgf_collectionPromises"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "collectionPromises", count: 1 } }));
        }
        break;
      }
      case "collectionPromise.update": {
        const { id: cpid, data: cpdata } = input;
        result = dataService.collectionPromise.update({ id: cpid, data: cpdata });
        if (result) {
          await pushCollectionPromise(result);
          reloadFromStorage(["sgf_collectionPromises"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "collectionPromises", count: 1 } }));
        }
        break;
      }
      case "collectionPromise.delete": {
        result = dataService.collectionPromise.delete(input);
        if (result?.success) {
          await pushCollectionPromise({ id: input, deleted: true });
          reloadFromStorage(["sgf_collectionPromises"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "collectionPromises", count: 0 } }));
        }
        break;
      }

      // ================================================================
      //  AUDIT LOG
      // ================================================================
      case "auditLog.list":
        result = dataService.auditLog.list();
        break;
      case "auditLog.getRecent":
        result = dataService.auditLog.getRecent(input || 50);
        break;
      case "auditLog.create": {
        result = dataService.auditLog.create(input);
        if (result) {
          await pushAudit(result);
          reloadFromStorage(["sgf_auditLog"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "auditLog", count: 1 } }));
        }
        break;
      }

      // ================================================================
      //  SYSTEM LOGS
      // ================================================================
      case "systemLog.list":
        result = dataService.systemLog.list();
        break;
      case "systemLog.getRecent":
        result = dataService.systemLog.getRecent(input || 50);
        break;
      case "systemLog.getByCategory":
        result = dataService.systemLog.getByCategory(input);
        break;
      case "systemLog.getByLevel":
        result = dataService.systemLog.getByLevel(input);
        break;
      case "systemLog.create": {
        result = dataService.systemLog.create(input);
        if (result) {
          await pushSystemLog(result);
          reloadFromStorage(["sgf_systemLogs"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "systemLogs", count: 1 } }));
        }
        break;
      }

      // ================================================================
      //  CORPORATE CUSTOMERS
      // ================================================================
      case "corporateCustomer.list":
        result = dataService.corporateCustomer.list();
        break;
      case "corporateCustomer.getById":
        result = dataService.corporateCustomer.getById(input);
        break;
      case "corporateCustomer.getByCustomerId":
        result = dataService.corporateCustomer.getByCustomerId(input);
        break;
      case "corporateCustomer.create": {
        result = dataService.corporateCustomer.create(input);
        if (result) {
          await pushCorporateCustomer(result);
          reloadFromStorage(["sgf_corporateCustomers"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "corporateCustomers", count: 1 } }));
        }
        break;
      }
      case "corporateCustomer.update": {
        const { id: ccid, data: ccdata } = input;
        result = dataService.corporateCustomer.update({ id: ccid, data: ccdata });
        if (result) {
          await pushCorporateCustomer(result);
          reloadFromStorage(["sgf_corporateCustomers"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "corporateCustomers", count: 1 } }));
        }
        break;
      }
      case "corporateCustomer.delete": {
        result = dataService.corporateCustomer.delete(input);
        if (result?.success) {
          await removeCorporateCustomer(input);
          reloadFromStorage(["sgf_corporateCustomers"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "corporateCustomers", count: 0 } }));
        }
        break;
      }

      // ================================================================
      //  PURCHASE ORDERS
      // ================================================================
      case "purchaseOrder.list":
        result = dataService.purchaseOrder.list();
        break;
      case "purchaseOrder.getById":
        result = dataService.purchaseOrder.getById(input);
        break;
      case "purchaseOrder.getByCustomer":
        result = dataService.purchaseOrder.getByCustomer(input);
        break;
      case "purchaseOrder.getByCorporateCustomer":
        result = dataService.purchaseOrder.getByCorporateCustomer(input);
        break;
      case "purchaseOrder.getStats":
        result = dataService.purchaseOrder.getStats();
        break;
      case "purchaseOrder.create": {
        result = dataService.purchaseOrder.create(input);
        if (result) {
          await pushPurchaseOrder(result);
          reloadFromStorage(["sgf_purchaseOrders"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "purchaseOrders", count: 1 } }));
        }
        break;
      }
      case "purchaseOrder.update": {
        const { id: poid, data: podata } = input;
        result = dataService.purchaseOrder.update({ id: poid, data: podata });
        if (result) {
          await pushPurchaseOrder(result);
          reloadFromStorage(["sgf_purchaseOrders"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "purchaseOrders", count: 1 } }));
        }
        break;
      }
      case "purchaseOrder.delete": {
        result = dataService.purchaseOrder.delete(input);
        if (result?.success) {
          await removePurchaseOrder(input);
          reloadFromStorage(["sgf_purchaseOrders"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "purchaseOrders", count: 0 } }));
        }
        break;
      }

      // ================================================================
      //  BARRELS
      // ================================================================
      case "barrel.list":
        result = dataService.barrel.list();
        break;
      case "barrel.getById":
        result = dataService.barrel.getById(input);
        break;
      case "barrel.getByCustomer":
        result = dataService.barrel.getByCustomer(input);
        break;
      case "barrel.create": {
        result = dataService.barrel.create(input);
        if (result) {
          await pushBarrel(result);
          reloadFromStorage(["sgf_barrels"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "barrels", count: 1 } }));
        }
        break;
      }
      case "barrel.update": {
        const { id: bid, data: bdata } = input;
        result = dataService.barrel.update({ id: bid, data: bdata });
        if (result) {
          await pushBarrel(result);
          reloadFromStorage(["sgf_barrels"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "barrels", count: 1 } }));
        }
        break;
      }
      case "barrel.delete": {
        result = dataService.barrel.delete(input);
        if (result?.success) {
          await removeBarrel(input);
          reloadFromStorage(["sgf_barrels"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "barrels", count: 0 } }));
        }
        break;
      }

      // ================================================================
      //  CERTIFICATES OF COMPLIANCE
      // ================================================================
      case "coc.list":
        result = dataService.coc.list();
        break;
      case "coc.getById":
        result = dataService.coc.getById(input);
        break;
      case "coc.getByPurchaseOrder":
        result = dataService.coc.getByPurchaseOrder(input);
        break;
      case "coc.create": {
        result = dataService.coc.create(input);
        if (result) {
          await pushCOC(result);
          reloadFromStorage(["sgf_certificatesOfCompliance"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "certificatesOfCompliance", count: 1 } }));
        }
        break;
      }
      case "coc.update": {
        const { id: cocid, data: cocdata } = input;
        result = dataService.coc.update({ id: cocid, data: cocdata });
        if (result) {
          await pushCOC(result);
          reloadFromStorage(["sgf_certificatesOfCompliance"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "certificatesOfCompliance", count: 1 } }));
        }
        break;
      }
      case "coc.delete": {
        result = dataService.coc.delete(input);
        if (result?.success) {
          await removeCOC(input);
          reloadFromStorage(["sgf_certificatesOfCompliance"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "certificatesOfCompliance", count: 0 } }));
        }
        break;
      }

      // ================================================================
      //  PACKING LIST
      // ================================================================
      case "packingList.listByPurchaseOrder":
        result = dataService.packingList.listByPurchaseOrder(input);
        break;
      case "packingList.getById":
        result = dataService.packingList.getById(input);
        break;
      case "packingList.create": {
        result = dataService.packingList.create(input);
        if (result) {
          await pushPackingList(result);
          reloadFromStorage(["sgf_packingListLines"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "packingListLines", count: 1 } }));
        }
        break;
      }
      case "packingList.update": {
        const { id: plid, data: pldata } = input;
        result = dataService.packingList.update({ id: plid, data: pldata });
        if (result) {
          await pushPackingList(result);
          reloadFromStorage(["sgf_packingListLines"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "packingListLines", count: 1 } }));
        }
        break;
      }
      case "packingList.delete": {
        result = dataService.packingList.delete(input);
        if (result?.success) {
          await removePackingListLine(input);
          reloadFromStorage(["sgf_packingListLines"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "packingListLines", count: 0 } }));
        }
        break;
      }

      // ================================================================
      //  SALES REPS
      // ================================================================
      case "salesRep.list":
        result = dataService.salesRep.list();
        break;
      case "salesRep.getById":
        result = dataService.salesRep.getById(input);
        break;
      case "salesRep.create": {
        result = dataService.salesRep.create(input);
        if (result) {
          await pushSalesRep(result);
          reloadFromStorage(["sgf_salesReps"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "salesReps", count: 1 } }));
        }
        break;
      }
      case "salesRep.update": {
        const { id: srid, data: srdata } = input;
        result = dataService.salesRep.update({ id: srid, data: srdata });
        if (result) {
          await pushSalesRep(result);
          reloadFromStorage(["sgf_salesReps"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "salesReps", count: 1 } }));
        }
        break;
      }
      case "salesRep.delete": {
        result = dataService.salesRep.delete(input);
        if (result?.success) {
          await removeSalesRep(input);
          reloadFromStorage(["sgf_salesReps"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "salesReps", count: 0 } }));
        }
        break;
      }
      case "salesRep.getStats":
        result = dataService.salesRep.getStats();
        break;
      case "salesRep.getRepCustomers":
        result = dataService.salesRep.getRepCustomers(input);
        break;
      case "salesRep.getRepInvoices":
        result = dataService.salesRep.getRepInvoices(input);
        break;
      case "salesRep.getRepRevenue":
        result = dataService.salesRep.getRepRevenue(input);
        break;

      // ================================================================
      //  RECEIPTS
      // ================================================================
      case "receipt.list":
        result = dataService.receipt.list();
        break;
      case "receipt.getById":
        result = dataService.receipt.getById(input);
        break;
      case "receipt.getByInvoice":
        result = dataService.receipt.getByInvoice(input);
        break;
      case "receipt.create": {
        result = dataService.receipt.create(input);
        if (result) {
          // Receipts don't have a direct push function — they are part of invoice payment
          reloadFromStorage(["sgf_receipts"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "receipts", count: 1 } }));
        }
        break;
      }
      case "receipt.update": {
        const { id: rid, data: rdata } = input;
        result = dataService.receipt.update({ id: rid, data: rdata });
        if (result) {
          reloadFromStorage(["sgf_receipts"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "receipts", count: 1 } }));
        }
        break;
      }
      case "receipt.delete": {
        result = dataService.receipt.delete(input);
        if (result?.success) {
          reloadFromStorage(["sgf_receipts"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "receipts", count: 0 } }));
        }
        break;
      }

      // ================================================================
      //  CREDIT NOTES
      // ================================================================
      case "creditNote.list":
        result = dataService.creditNote.list();
        break;
      case "creditNote.getById":
        result = dataService.creditNote.getById(input);
        break;
      case "creditNote.getByInvoice":
        result = dataService.creditNote.getByInvoice(input);
        break;
      case "creditNote.create": {
        result = dataService.creditNote.create(input);
        if (result) {
          await pushCreditNote(result);
          reloadFromStorage(["sgf_creditNotes"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "creditNotes", count: 1 } }));
        }
        break;
      }
      case "creditNote.update": {
        const { id: cnid, data: cndata } = input;
        result = dataService.creditNote.update({ id: cnid, data: cndata });
        if (result) {
          await pushCreditNote(result);
          reloadFromStorage(["sgf_creditNotes"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "creditNotes", count: 1 } }));
        }
        break;
      }
      case "creditNote.delete": {
        result = dataService.creditNote.delete(input);
        if (result?.success) {
          await pushCreditNote({ id: input, deleted: true });
          reloadFromStorage(["sgf_creditNotes"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "creditNotes", count: 0 } }));
        }
        break;
      }

      // ================================================================
      //  ACCOUNT HOLDS
      // ================================================================
      case "accountHold.list":
        result = dataService.accountHold.list();
        break;
      case "accountHold.getById":
        result = dataService.accountHold.getById(input);
        break;
      case "accountHold.getByCustomer":
        result = dataService.accountHold.getByCustomer(input);
        break;
      case "accountHold.create": {
        result = dataService.accountHold.create(input);
        if (result) {
          reloadFromStorage(["sgf_accountHolds"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "accountHolds", count: 1 } }));
        }
        break;
      }
      case "accountHold.update": {
        const { id: ahid, data: ahdata } = input;
        result = dataService.accountHold.update({ id: ahid, data: ahdata });
        if (result) {
          reloadFromStorage(["sgf_accountHolds"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "accountHolds", count: 1 } }));
        }
        break;
      }
      case "accountHold.delete": {
        result = dataService.accountHold.delete(input);
        if (result?.success) {
          reloadFromStorage(["sgf_accountHolds"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "accountHolds", count: 0 } }));
        }
        break;
      }

      // ================================================================
      //  STATEMENTS
      // ================================================================
      case "statement.getByCustomer":
        result = dataService.statement.getByCustomer(input);
        break;
      case "statement.getAgedDebtors":
        result = dataService.statement.getAgedDebtors();
        break;
      case "statement.getBankReconciliation":
        result = dataService.statement.getBankReconciliation(input);
        break;
      case "statement.getCustomerTransactions":
        result = dataService.statement.getCustomerTransactions(input);
        break;
      case "statement.getSalesRepStatement":
        result = dataService.statement.getSalesRepStatement(input);
        break;

      // ================================================================
      //  REPORTS
      // ================================================================
      case "report.getSalesRepPerformance":
        result = dataService.report.getSalesRepPerformance(input || {});
        break;
      case "report.getDailySales":
        result = dataService.report.getDailySales(input || new Date().toISOString().split("T")[0]);
        break;
      case "report.getSalesByProduct":
        result = dataService.report.getSalesByProduct(input || { startDate: "", endDate: "" });
        break;
      case "report.getSalesByCustomer":
        result = dataService.report.getSalesByCustomer(input || { startDate: "", endDate: "" });
        break;
      case "report.getSalesByRegion":
        result = dataService.report.getSalesByRegion(input || { startDate: "", endDate: "" });
        break;
      case "report.getMonthlyRevenue":
        result = dataService.report.getMonthlyRevenue(input || { year: new Date().getFullYear() });
        break;
      case "report.getProductPerformance":
        result = dataService.report.getProductPerformance(input || {});
        break;
      case "report.getSampleOrders":
        result = dataService.report.getSampleOrders(input || {});
        break;
      case "report.getRepDailyActivity":
        result = dataService.report.getRepDailyActivity(input || { repName: "", date: "" });
        break;
      case "report.getCustomerStatement":
        result = dataService.report.getCustomerStatement(input);
        break;
      case "report.getCustomerInvoices":
        result = dataService.report.getCustomerInvoices(input);
        break;
      case "report.getSalesRepInvoices":
        result = dataService.report.getSalesRepInvoices(input);
        break;
      case "report.getSalesRepCustomers":
        result = dataService.report.getSalesRepCustomers(input);
        break;
      case "report.getSalesRepRevenue":
        result = dataService.report.getSalesRepRevenue(input);
        break;
      case "report.getCollectionReport":
        result = dataService.report.getCollectionReport(input || {});
        break;
      case "report.getOrderStatusReport":
        result = dataService.report.getOrderStatusReport(input || {});
        break;
      case "report.getStockReport":
        result = dataService.report.getStockReport();
        break;
      case "report.getStockMovement":
        result = dataService.report.getStockMovement(input || {});
        break;
      case "report.getCorporateReport":
        result = dataService.report.getCorporateReport(input || {});
        break;
      case "report.getPurchaseOrderReport":
        result = dataService.report.getPurchaseOrderReport(input || {});
        break;
      case "report.getDailyInvoicedStock":
        result = dataService.report.getDailyInvoicedStock(input || new Date().toISOString().split("T")[0]);
        break;
      case "report.getWeeklySales":
        result = dataService.report.getWeeklySales(input || { year: new Date().getFullYear(), week: 1 });
        break;
      case "report.getMonthlySales":
        result = dataService.report.getMonthlySales(input || { year: new Date().getFullYear(), month: 1 });
        break;
      case "report.getYearlySales":
        result = dataService.report.getYearlySales(input || { year: new Date().getFullYear() });
        break;

      // ================================================================
      //  SETTINGS
      // ================================================================
      case "settings.get":
        result = dataService.settings.get();
        break;
      case "settings.update": {
        result = dataService.settings.update(input);
        break;
      }
      case "settings.getFirebaseConfig":
        result = dataService.settings.getFirebaseConfig();
        break;
      case "settings.saveFirebaseConfig":
        result = dataService.settings.saveFirebaseConfig(input);
        break;
      case "settings.clearFirebaseConfig":
        result = dataService.settings.clearFirebaseConfig();
        break;
      case "settings.disconnectFirebase":
        result = dataService.settings.disconnectFirebase();
        break;
      case "settings.getTaxRate":
        result = dataService.settings.getTaxRate();
        break;
      case "settings.getCompanyInfo":
        result = dataService.settings.getCompanyInfo();
        break;
      case "settings.getBankDetails":
        result = dataService.settings.getBankDetails();
        break;
      case "settings.getPaymentTerms":
        result = dataService.settings.getPaymentTerms();
        break;
      case "settings.getEmailTemplates":
        result = dataService.settings.getEmailTemplates();
        break;
      case "settings.getSmsTemplates":
        result = dataService.settings.getSmsTemplates();
        break;
      case "settings.getNotificationSettings":
        result = dataService.settings.getNotificationSettings();
        break;
      case "settings.getIntegrationSettings":
        result = dataService.settings.getIntegrationSettings();
        break;
      case "settings.getBackupSettings":
        result = dataService.settings.getBackupSettings();
        break;
      case "settings.getSecuritySettings":
        result = dataService.settings.getSecuritySettings();
        break;
      case "settings.getAuditSettings":
        result = dataService.settings.getAuditSettings();
        break;
      case "settings.getSystemSettings":
        result = dataService.settings.getSystemSettings();
        break;
      case "settings.getDisplaySettings":
        result = dataService.settings.getDisplaySettings();
        break;
      case "settings.getReportSettings":
        result = dataService.settings.getReportSettings();
        break;
      case "settings.getDashboardSettings":
        result = dataService.settings.getDashboardSettings();
        break;
      case "settings.getSalesRepSettings":
        result = dataService.settings.getSalesRepSettings();
        break;
      case "settings.getCustomerSettings":
        result = dataService.settings.getCustomerSettings();
        break;
      case "settings.getInvoiceSettings":
        result = dataService.settings.getInvoiceSettings();
        break;
      case "settings.getOrderSettings":
        result = dataService.settings.getOrderSettings();
        break;
      case "settings.getStockSettings":
        result = dataService.settings.getStockSettings();
        break;
      case "settings.getCorporateSettings":
        result = dataService.settings.getCorporateSettings();
        break;
      case "settings.getPurchaseOrderSettings":
        result = dataService.settings.getPurchaseOrderSettings();
        break;
      case "settings.getBarrelSettings":
        result = dataService.settings.getBarrelSettings();
        break;
      case "settings.getCocSettings":
        result = dataService.settings.getCocSettings();
        break;
      case "settings.getPackingListSettings":
        result = dataService.settings.getPackingListSettings();
        break;
      case "settings.getCollectionSettings":
        result = dataService.settings.getCollectionSettings();
        break;
      case "settings.getFollowUpSettings":
        result = dataService.settings.getFollowUpSettings();
        break;
      case "settings.getFollowUpActionSettings":
        result = dataService.settings.getFollowUpActionSettings();
        break;
      case "settings.getAccountHoldSettings":
        result = dataService.settings.getAccountHoldSettings();
        break;
      case "settings.getReceiptSettings":
        result = dataService.settings.getReceiptSettings();
        break;
      case "settings.getCreditNoteSettings":
        result = dataService.settings.getCreditNoteSettings();
        break;
      case "settings.getStatementSettings":
        result = dataService.settings.getStatementSettings();
        break;
      case "settings.getReportSettings":
        result = dataService.settings.getReportSettings();
        break;
      case "settings.getSystemLogSettings":
        result = dataService.settings.getSystemLogSettings();
        break;
      case "settings.getAuditLogSettings":
        result = dataService.settings.getAuditLogSettings();
        break;
      case "settings.getSalesRepSettings":
        result = dataService.settings.getSalesRepSettings();
        break;

      // ================================================================
      //  FALLBACK: Dynamic dispatch
      // ================================================================
      default: {
        const [cat, act] = path.split(".");
        const svc = (dataService as any)[cat];
        if (svc && typeof svc[act] === "function") {
          result = svc[act](input);
        } else {
          // unhandled path - silently return null
          result = null;
        }
        break;
      }
    }

    return result;
  } catch (err: any) {
    // error silently handled
    throw err;
  }
}
