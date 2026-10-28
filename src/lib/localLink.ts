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
  syncFromCloud,
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
async function smartSync(type: string, storageKey: string): Promise<void> {
  await syncFromCloud(type, storageKey);
}

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
        await smartSync("users", "sgf_users");
        result = dataService.user.list();
        break;
      case "user.getById":
        await smartSync("users", "sgf_users");
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
        await smartSync("products", "sgf_products");
        result = dataService.stock.list();
        break;
      case "stock.search":
        await smartSync("products", "sgf_products");
        result = dataService.stock.search(input || { query: "" });
        break;
      case "stock.getById":
        await smartSync("products", "sgf_products");
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
        await smartSync("customers", "sgf_customers");
        result = dataService.customer.list();
        break;
      case "customer.search":
        await smartSync("customers", "sgf_customers");
        result = dataService.customer.search(input || { query: "" });
        break;
      case "customer.getById":
        await smartSync("customers", "sgf_customers");
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
        await smartSync("orders", "sgf_orders");
        result = dataService.order.list();
        break;
      case "order.getById":
        await smartSync("orders", "sgf_orders");
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
        result = dataService.order.update({ id: input, data: { deleted: true, deletedAt: new Date().toISOString() } });
        if (result?.success) {
          await pushOrder(result);
          reloadFromStorage(["sgf_orders"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "orders", count: 0 } }));
        }
        break;
      }
      case "order.updateStatus": {
        result = dataService.order.updateStatus(input);
        if (result) {
          await pushOrder(result);
          reloadFromStorage(["sgf_orders"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "orders", count: 1 } }));
        }
        break;
      }
      case "order.checkExistingSample":
        result = dataService.order.checkExistingSample(input);
        break;
      case "order.generateInvoice": {
        result = dataService.invoice.generateInvoiceForOrder(input);
        if (result) {
          await pushInvoice(result);
          reloadFromStorage(["sgf_invoices"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: 1 } }));
        }
        break;
      }
      case "order.generateMissingInvoices": {
        result = dataService.order.repairOrders();
        if (result?.invoices) {
          for (const inv of result.invoices) {
            try { await pushInvoice(inv); } catch { /* ignore */ }
          }
          reloadFromStorage(["sgf_invoices"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: result.invoices.length } }));
        }
        break;
      }
      case "order.convertQuoteToOrder": {
        result = dataService.order.convertQuoteToOrder(input);
        if (result) {
          await pushOrder(result);
          reloadFromStorage(["sgf_orders", "sgf_invoices", "sgf_products"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "orders", count: 1 } }));
        }
        break;
      }

      // ================================================================
      //  INVOICES
      // ================================================================
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
      case "invoice.delete": { result = dataService.invoice.delete(input); if (result?.success) { await removeInvoice(input); reloadFromStorage(["sgf_invoices"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: 1 } })); } break; }
      case "invoice.markAsPaid": { result = dataService.invoice.updateStatus({ id: input, status: "paid" }); if (result) { await pushInvoice(result); reloadFromStorage(["sgf_invoices"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: 1 } })); } break; }
      case "invoice.send": { result = dataService.invoice.updateStatus({ id: input, status: "sent" }); if (result) { await pushInvoice(result); reloadFromStorage(["sgf_invoices"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: 1 } })); } break; }
      case "invoice.generatePDF": result = dataService.invoice.getById(input); break;
      case "invoice.applyCreditNote": { result = dataService.invoice.allocateCredit(input); if (result) { await pushInvoice(result); reloadFromStorage(["sgf_invoices"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: 1 } })); } break; }
      case "invoice.getCreditNotes": await smartSync("invoices", "sgf_invoices"); result = dataService.invoice.getCreditNotes(input); break;
      case "invoice.recordPayment": { result = dataService.invoice.recordPayment(input); if (result) { await pushInvoice(result); reloadFromStorage(["sgf_invoices"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: 1 } })); } break; }
      case "invoice.updatePaymentStatus": { result = dataService.invoice.updateStatus(input); if (result) { await pushInvoice(result); reloadFromStorage(["sgf_invoices"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: 1 } })); } break; }
      case "invoice.fixDraftInvoices": { result = fixDraftInvoicesForDeliveredOrders(); if (result) { for (const inv of result.fixedInvoices) { try { await pushInvoice(inv); } catch { /* ignore */ } } reloadFromStorage(); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: result.fixedInvoices?.length || 0 } })); } break; }
      case "invoice.fixSageDates": { result = fixSageInvoiceDates(); if (result) { reloadFromStorage(); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: 0 } })); } break; }
      case "invoice.bulkUpdate": { result = dataService.invoice.bulkHistoricalImport(input); if (result?.success) { const invoices = dataService.invoice.list(); for (const inv of invoices) { try { await pushInvoice(inv); } catch { /* ignore */ } } reloadFromStorage(["sgf_invoices"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: 1 } })); } break; }
      case "invoice.addCreditNote": { result = dataService.invoice.createCreditNote(input); if (result) { await pushCreditNote(result); reloadFromStorage(["sgf_invoices"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: 1 } })); } break; }
      case "invoice.generateForPO": { result = dataService.generateInvoiceForPO(input?.poId || input); if (result) { const inv = dataService.invoice.list().find((i: any) => i.invoiceNumber === result); if (inv) await pushInvoice(inv); reloadFromStorage(["sgf_invoices"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: 1 } })); } break; }

      // ================================================================
      //  QUOTES
      // ================================================================
      case "quote.list": await smartSync("orders", "sgf_orders"); result = dataService.quote.list(input || {}); break;
      case "quote.search": await smartSync("orders", "sgf_orders"); result = dataService.quote.search(input || { query: "" }); break;
      case "quote.getById": await smartSync("orders", "sgf_orders"); result = dataService.quote.getById(input); break;
      case "quote.getStats": await smartSync("orders", "sgf_orders"); result = dataService.quote.getStats(input || {}); break;
      case "quote.getByCustomerId": await smartSync("orders", "sgf_orders"); result = dataService.quote.getByCustomerId(input); break;
      case "quote.create": { result = dataService.order.create({ ...input, type: "quote" }); await pushOrder(result); reloadFromStorage(["sgf_orders"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "orders", count: 1 } })); break; }
      case "quote.update": { const { id: qid, data: qdata } = input; result = dataService.quote.update({ id: qid, data: qdata }); if (result) { await pushOrder(result); reloadFromStorage(["sgf_orders"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "orders", count: 1 } })); } break; }
      case "quote.delete": { result = dataService.order.update({ id: input, data: { deleted: true } }); if (result?.success) { await pushOrder(result); reloadFromStorage(["sgf_orders"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "orders", count: 1 } })); } break; }
      case "quote.convertToOrder": { result = dataService.order.convertQuoteToOrder(input); if (result) { await pushOrder(result); reloadFromStorage(["sgf_orders", "sgf_invoices", "sgf_products"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "orders", count: 1 } })); } break; }

      // ================================================================
      //  APPOINTMENTS
      // ================================================================
      case "appointment.list":
        await smartSync("appointments", "sgf_appointments");
        result = dataService.appointment.list();
        break;
      case "appointment.getStats":
        result = dataService.appointment.getStats();
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
      case "appointment.updateStatus": {
        result = dataService.appointment.updateStatus(input);
        if (result) {
          await pushAppointment(result);
          reloadFromStorage(["sgf_appointments"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "appointments", count: 1 } }));
        }
        break;
      }

      // ================================================================
      //  CHECK-INS
      // ================================================================
      case "checkIn.list":
        await smartSync("checkins", "sgf_checkins");
        result = dataService.checkin.list();
        break;
      case "checkIn.getStats":
        result = dataService.checkin.getStats();
        break;
      case "checkIn.create": {
        result = dataService.checkin.create(input);
        if (result) {
          await pushCheckin(result);
          reloadFromStorage(["sgf_checkins"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "checkins", count: 1 } }));
        }
        break;
      }
      case "checkIn.update": {
        const { id: ciid, data: cidata } = input;
        result = dataService.checkin.update({ id: ciid, data: cidata });
        if (result) {
          await pushCheckin(result);
          reloadFromStorage(["sgf_checkins"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "checkins", count: 1 } }));
        }
        break;
      }
      case "checkIn.delete": {
        result = dataService.checkin.delete(input);
        if (result?.success) {
          await pushCheckinDelete(input);
          reloadFromStorage(["sgf_checkins"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "checkins", count: 0 } }));
        }
        break;
      }
      case "checkIn.checkout": {
        result = dataService.checkin.checkout(input);
        if (result) {
          await pushCheckin(result);
          reloadFromStorage(["sgf_checkins"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "checkins", count: 1 } }));
        }
        break;
      }
      case "checkIn.getDailyReport":
        result = dataService.checkin.getDailyReport(input?.date);
        break;
      case "checkIn.getWeeklyReport":
        result = dataService.checkin.getWeeklyReport(input?.year, input?.week);
        break;
      case "checkIn.getMonthlyReport":
        result = dataService.checkin.getMonthlyReport(input?.year, input?.month);
        break;
      case "checkIn.getAARate":
        result = dataService.checkin.getAARate();
        break;
      case "checkIn.setAARate": {
        result = dataService.checkin.setAARate(input);
        if (result) {
          await pushCheckin(result);
          reloadFromStorage(["sgf_checkins"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "checkins", count: 1 } }));
        }
        break;
      }

      // ================================================================
      //  FOLLOW-UP ACTIONS
      // ================================================================
      case "followUpAction.list":
        await smartSync("followUpActions", "sgf_followUpActions");
        result = dataService.followUpAction.list();
        break;
      case "followUpAction.listByCustomer":
        await smartSync("followUpActions", "sgf_followUpActions");
        result = dataService.followUpAction.listByCustomer(input);
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
      case "followUpAction.getStats":
        result = dataService.followUpAction.getStats();
        break;

      // ================================================================
      //  SPECIAL PRICES
      // ================================================================
      case "specialPrice.listByCustomer":
        await smartSync("specialPrices", "sgf_specialPrices");
        result = dataService.specialPrice.listByCustomer(input);
        break;
      case "specialPrice.set": {
        result = dataService.specialPrice.set(input);
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
      //  SALES REPS
      // ================================================================
      case "salesRep.list":
        await smartSync("salesReps", "sgf_salesReps");
        result = dataService.salesRep.list();
        break;
      case "salesRep.getStats":
        result = dataService.salesRep.getStats();
        break;
      case "salesRep.getSalesBreakdown":
        result = dataService.salesRep.getSalesBreakdown();
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
        result = dataService.salesRep.update(input);
        if (result) {
          await pushSalesRep(result);
          reloadFromStorage(["sgf_salesReps"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "salesReps", count: 1 } }));
        }
        break;
      }
      case "salesRep.toggleActive": {
        result = dataService.salesRep.toggleActive(input);
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

      // ================================================================
      //  DASHBOARD
      // ================================================================
      case "dashboard.stats":
        result = dataService.dashboard.stats();
        break;

      // ================================================================
      //  AUDIT
      // ================================================================
      case "audit.list":
        await smartSync("audits", "sgf_audits");
        result = dataService.audit.list();
        break;
      case "audit.getCustomerDeletions":
        result = dataService.audit.getCustomerDeletions();
        break;
      case "audit.getAddressChanges":
        result = dataService.audit.getAddressChanges();
        break;

      // ================================================================
      //  FOLLOW-UPS
      // ================================================================
      case "followUp.list":
        await smartSync("followUps", "sgf_followUps");
        result = dataService.followUp.list();
        break;
      case "followUp.listAll":
        await smartSync("followUps", "sgf_followUps");
        result = dataService.followUp.listAll(input?.days || 7);
        break;
      case "followUp.getStats":
        result = dataService.followUp.getStats();
        break;
      case "followUp.update": {
        result = dataService.followUp.update(input);
        if (result) {
          await pushFollowUp(result);
          reloadFromStorage(["sgf_followUps"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "followUps", count: 1 } }));
        }
        break;
      }

      // ================================================================
      //  SAMPLE REPORTS
      // ================================================================
      case "sampleReport.getByCustomer":
        result = dataService.sampleReport.getByCustomer(input);
        break;
      case "sampleReport.getAll":
        result = dataService.sampleReport.getAll();
        break;

      // ================================================================
      //  COLLECTIONS
      // ================================================================
      case "collections.getOverdueInvoices":
        result = dataService.collections.getOverdueInvoices();
        break;
      case "collections.getDailyReport":
        result = dataService.collections.getDailyReport();
        break;
      case "collections.getStats":
        result = dataService.collections.getStats();
        break;
      case "collections.getCustomerPaymentHistory":
        result = dataService.collections.getCustomerPaymentHistory(input?.customerId || input);
        break;
      case "collections.getFollowUpsDue":
        result = dataService.collections.getFollowUpsDue();
        break;
      case "collections.addNote": {
        result = dataService.collections.addNote(input);
        if (result) {
          await pushCollectionNote(result);
          reloadFromStorage(["sgf_collectionNotes"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "collectionNotes", count: 1 } }));
        }
        break;
      }
      case "collections.recordPromise": {
        result = dataService.collections.recordPromise(input);
        if (result) {
          await pushCollectionPromise(result);
          reloadFromStorage(["sgf_collectionPromises"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "collectionPromises", count: 1 } }));
        }
        break;
      }
      case "collections.placeHold": {
        result = dataService.collections.placeHold(input);
        if (result) {
          await pushCollectionNote(result);
          reloadFromStorage(["sgf_collectionNotes"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "collectionNotes", count: 1 } }));
        }
        break;
      }
      case "collections.releaseHold": {
        result = dataService.collections.releaseHold(input);
        if (result) {
          await pushCollectionNote(result);
          reloadFromStorage(["sgf_collectionNotes"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "collectionNotes", count: 1 } }));
        }
        break;
      }

      // ================================================================
      //  CORPORATE CUSTOMERS
      // ================================================================
      case "corporateCustomer.list":
        await smartSync("corporateCustomers", "sgf_corporateCustomers");
        result = dataService.corporateCustomer.list();
        break;
      case "corporateCustomer.getById":
        await smartSync("corporateCustomers", "sgf_corporateCustomers");
        result = dataService.corporateCustomer.getById(input);
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
        await smartSync("purchaseOrders", "sgf_purchaseOrders");
        result = dataService.purchaseOrder.list();
        break;
      case "purchaseOrder.getById":
        await smartSync("purchaseOrders", "sgf_purchaseOrders");
        result = dataService.purchaseOrder.getById(input);
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
      case "purchaseOrder.updateStatus": {
        result = dataService.purchaseOrder.updateStatus(input);
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
        await smartSync("barrels", "sgf_barrels");
        result = dataService.barrel.list();
        break;
      case "barrel.listByPurchaseOrder":
        await smartSync("barrels", "sgf_barrels");
        result = dataService.barrel.listByPurchaseOrder(input);
        break;
      case "barrel.getById":
        await smartSync("barrels", "sgf_barrels");
        result = dataService.barrel.getById(input);
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
      //  COC
      // ================================================================
      case "coc.list": await smartSync("cocs", "sgf_cocs"); result = dataService.coc.list(); break;
      case "coc.getById": await smartSync("cocs", "sgf_cocs"); result = dataService.coc.getById(input); break;
      case "coc.create": { result = dataService.coc.create(input); await pushCOC(result); reloadFromStorage(["sgf_cocs"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "cocs", count: 1 } })); break; }
      case "coc.update": { const { id, data } = input; result = dataService.coc.update({ id, data }); if (result) { await pushCOC(result); reloadFromStorage(["sgf_cocs"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "cocs", count: 1 } })); } break; }
      case "coc.delete": { result = dataService.coc.delete(input); if (result?.success) { await removeCOC(input); reloadFromStorage(["sgf_cocs"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "cocs", count: 1 } })); } break; }
      case "coc.bulkGenerateForPO": { result = dataService.coc.bulkGenerateForPO(input.poId, input.cocDataList, input.deleteOrphanIds); if (result) { for (const coc of result.cocs || []) { try { await pushCOC(coc); } catch { /* ignore */ } } reloadFromStorage(["sgf_cocs"]); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "cocs", count: result?.cocs?.length || 0 } })); } break; }

      // ================================================================
      //  PACKING LISTS
      // ================================================================
      case "packingList.listByPurchaseOrder":
        await smartSync("packingLists", "sgf_packingLists");
        result = dataService.packingList?.listByPurchaseOrder?.(input) || [];
        break;
      case "packingList.create": {
        result = dataService.packingList?.create?.(input);
        if (result) {
          await pushPackingList(result);
          reloadFromStorage(["sgf_packingLists"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "packingLists", count: 1 } }));
        }
        break;
      }
      case "packingList.update": {
        const { id: plid, data: pldata } = input;
        result = dataService.packingList?.update?.({ id: plid, data: pldata });
        if (result) {
          await pushPackingList(result);
          reloadFromStorage(["sgf_packingLists"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "packingLists", count: 1 } }));
        }
        break;
      }
      case "packingList.delete": {
        result = dataService.packingList?.delete?.(input);
        if (result?.success) {
          await removePackingListLine(input);
          reloadFromStorage(["sgf_packingLists"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "packingLists", count: 0 } }));
        }
        break;
      }

      // ================================================================
      //  GENERIC FALLBACK — handles any dataService method not explicitly cased above
      // ================================================================
      default: {
        const [cat, act] = path.split(".");
        const svc = (dataService as any)[cat];
        if (svc && typeof svc[act] === "function") {
          result = svc[act](input);
        } else {
          console.warn(`[localLink] Unhandled: ${path}`);
          result = null;
        }
        break;
      }
    }

    return result;
  } catch (err: any) {
    console.error(`[localLink] Error handling ${path}:`, err);
    throw err;
  }
}

export function createLocalLink() {
  return () =>
    ({ op }: any) =>
      observable((observer) => {
        (async () => {
          try {
            const result = await localLinkHandler(op.path, op.input);
            observer.next({ result: { type: "data", data: result } });
            observer.complete();
          } catch (err: any) {
            observer.error(err);
          }
        })();
      });
}