import type { AppRouter } from "./appRouter";
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import { observable } from "@trpc/server/observable";
import {
  dataService,
  reloadFromStorage,
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
  pushProducts,
  deleteProducts,
  pushCOC,
  removeCOC,
  pushCreditNote,
  removeCreditNote,
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
  removeReceipt,
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

// Normalize delete input — frontend sometimes sends a scalar id,
// sometimes an object { id }. Always extract the numeric id.
function normalizeId(input: any): number {
  return typeof input === "object" && input !== null && "id" in input ? input.id : input;
}

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
        const id = normalizeId(input);
        result = dataService.user.delete({ id });
        if (result?.success) {
          await pushUserDelete(id);
          reloadFromStorage(["sgf_users"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "users", count: 0 } }));
        }
        break;
      }
      case "user.toggleActive": {
        result = dataService.user.toggleActive(input);
        if (result?.success) {
          const updatedUser = dataService.user.getById(input.id);
          if (updatedUser) await pushUser(updatedUser);
          reloadFromStorage(["sgf_users"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "users", count: 1 } }));
        }
        break;
      }
      case "user.resetPin": {
        result = dataService.user.resetPin(input);
        if (result?.success) {
          const updatedUser = dataService.user.getById(input.id);
          if (updatedUser) await pushUser(updatedUser);
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
        const id = normalizeId(input);
        result = dataService.stock.delete(id);
        if (result?.success) {
          await removeOneStockItem(id);
          reloadFromStorage(["sgf_products"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "products", count: 0 } }));
        }
        break;
      }
      case "stock.bulkUpload": {
        // Support both array (legacy) and { items, uploadBatch } (new) formats
        result = dataService.stock.bulkCreate(input);
        if (result) {
          const items = dataService.stock.list();
          await pushProducts(items);
          reloadFromStorage(["sgf_products"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "products", count: items.length } }));
        }
        break;
      }
      case "stock.getOrphans": {
        result = dataService.stock.getOrphans(input);
        break;
      }
      case "stock.deleteOrphans": {
        result = dataService.stock.deleteOrphans(input);
        if (result?.success) {
          await deleteProducts(input.ids);
          reloadFromStorage(["sgf_products"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "products", count: 0 } }));
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
        const id = normalizeId(input);
        result = dataService.customer.delete({ id });
        if (result?.success) {
          await removeOneCustomer(id);
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
          // If order was cancelled via edit, also push the cancelled invoice
          if (odata?.status === "cancelled") {
            const cancelledInvoice = dataService.invoice.cancelInvoiceFromOrder(oid);
            if (cancelledInvoice) {
              await pushInvoice(cancelledInvoice);
              reloadFromStorage(["sgf_invoices"]);
              window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: 1 } }));
            }
          }
          reloadFromStorage(["sgf_orders"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "orders", count: 1 } }));
        }
        break;
      }
      case "order.delete": {
        const id = normalizeId(input);
        result = dataService.order.update({ id, data: { status: "cancelled", updatedAt: new Date().toISOString() } });
        if (result) {
          // Also cancel and push the linked invoice before removing the order
          const cancelledInvoice = dataService.invoice.cancelInvoiceFromOrder(id);
          if (cancelledInvoice) {
            await pushInvoice(cancelledInvoice);
            reloadFromStorage(["sgf_invoices"]);
            window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: 1 } }));
          }
          await removeOrder(id);
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
          // Also cancel the linked invoice
          const cancelledInvoice = dataService.invoice.cancelInvoiceFromOrder(cancelId);
          if (cancelledInvoice) {
            await pushInvoice(cancelledInvoice);
            reloadFromStorage(["sgf_invoices"]);
            window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: 1 } }));
          }
          reloadFromStorage(["sgf_orders"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "orders", count: 1 } }));
        }
        break;
      }
      case "order.updateStatus": {
        result = dataService.order.updateStatus(input);
        if (result) {
          await pushOrder(result.order);
          // If the order was cancelled, also push the cancelled invoice to Firebase
          if (result.cancelledInvoice) {
            await pushInvoice(result.cancelledInvoice);
            reloadFromStorage(["sgf_invoices"]);
            window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: 1 } }));
          }
          reloadFromStorage(["sgf_orders"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "orders", count: 1 } }));
        }
        break;
      }
      case "order.generateMissingInvoices": {
        result = dataService.order.generateMissingInvoices();
        if (result && result.success) {
          for (const inv of result.invoices || []) await pushInvoice(inv);
          reloadFromStorage(["sgf_invoices"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: result.invoices?.length || 0 } }));
        }
        break;
      }
      case "order.convertQuoteToOrder": {
        result = dataService.order.convertQuoteToOrder(input);
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
      case "order.findByNumber":
        result = dataService.order.findByNumber(input);
        break;
      case "order.diagnoseMissing":
        result = dataService.diagnoseMissingOrders ? dataService.diagnoseMissingOrders(input) : null;
        break;

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
        result = dataService.invoice.updateInvoice({ id: iid, data: idata });
        if (result) {
          await pushInvoice(result);
          reloadFromStorage(["sgf_invoices"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: 1 } }));
        }
        break;
      }
      case "invoice.delete": {
        const id = normalizeId(input);
        result = dataService.invoice.delete(id);
        if (result) {
          await removeInvoice(id);
          reloadFromStorage(["sgf_invoices"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: 0 } }));
        }
        break;
      }
      case "invoice.recordPayment": {
        result = dataService.invoice.recordPayment(input);
        if (result && result.invoice) {
          await pushInvoice(result.invoice);
          reloadFromStorage(["sgf_invoices"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: 1 } }));
        }
        break;
      }
      case "invoice.getReceipts":
        result = dataService.invoice.getReceipts();
        break;
      case "invoice.editPayment": {
        result = dataService.invoice.editPayment(input);
        if (result) {
          await pushInvoice(result);
          reloadFromStorage(["sgf_invoices"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: 1 } }));
        }
        break;
      }
      case "invoice.deletePayment": {
        result = dataService.invoice.deletePayment(input);
        if (result) {
          await pushInvoice(result);
          reloadFromStorage(["sgf_invoices"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: 1 } }));
        }
        break;
      }
      case "invoice.deleteReceipt": {
        const id = normalizeId(input);
        result = dataService.invoice.deleteReceipt(id);
        if (result?.success) {
          await removeReceipt(id);
          reloadFromStorage(["sgf_receipts"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "receipts", count: 0 } }));
        }
        break;
      }
      case "invoice.createCreditNote": {
        result = dataService.invoice.createCreditNote(input);
        if (result) {
          await pushCreditNote(result.creditNote);
          if (result.updatedInvoice) await pushInvoice(result.updatedInvoice);
          reloadFromStorage(["sgf_creditNotes", "sgf_invoices"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "creditNotes", count: 1 } }));
        }
        break;
      }
      case "invoice.voidCreditNote": {
        result = dataService.invoice.voidCreditNote(input);
        if (result) {
          await pushCreditNote(result);
          // Push all affected invoices so restored balances & removed allocations stick
          const affectedIds = new Set<number>();
          if (result.invoiceId) affectedIds.add(result.invoiceId);
          if (result.allocations) {
            for (const alloc of result.allocations) {
              if (alloc.invoiceId) affectedIds.add(alloc.invoiceId);
            }
          }
          if (affectedIds.size > 0) {
            const rawInvoices = JSON.parse(getStorageItem("sgf_invoices", "[]"));
            for (const invId of affectedIds) {
              const inv = rawInvoices.find((i: any) => i.id == invId);
              if (inv) await pushInvoice(inv);
            }
          }
          reloadFromStorage(["sgf_creditNotes", "sgf_invoices"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "creditNotes", count: 1 } }));
        }
        break;
      }
      case "invoice.allocateBankPayments": {
        result = dataService.invoice.allocateBankPayments(input);
        if (result && result.success) {
          for (const inv of result.updatedInvoices || []) await pushInvoice(inv);
          reloadFromStorage(["sgf_invoices"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: result.updatedInvoices?.length || 0 } }));
        }
        break;
      }
      case "invoice.fixDraftInvoices": {
        result = dataService.invoice.fixDraftInvoices();
        if (result && result.success) {
          for (const inv of result.fixed || []) await pushInvoice(inv);
          reloadFromStorage(["sgf_invoices"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: result.fixed?.length || 0 } }));
        }
        break;
      }
      case "invoice.fixSageDates": {
        result = dataService.invoice.fixSageDates();
        if (result && result.success) {
          for (const inv of result.fixed || []) await pushInvoice(inv);
          reloadFromStorage(["sgf_invoices"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: result.fixed?.length || 0 } }));
        }
        break;
      }
      case "invoice.repairCancelled": {
        result = dataService.invoice.repairCancelled();
        if (result && result.changed > 0) {
          for (const inv of result.invoices || []) await pushInvoice(inv);
          reloadFromStorage(["sgf_invoices"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: result.changed } }));
        }
        break;
      }
      case "invoice.generateForPO": {
        // Call the REAL invoice generator (not activateInvoiceFromPO which only changes draft status)
        result = dataService.generateInvoiceForPO(input);
        if (result) {
          // result is either an invoice object (new) or invoiceNumber string (existing updated)
          let invoiceObj = result;
          if (typeof result === "string") {
            // Find the existing invoice by invoiceNumber
            const allInvoices = dataService.invoice.list();
            invoiceObj = allInvoices.find((i: any) => i.invoiceNumber === result);
          }
          if (invoiceObj && invoiceObj.id) {
            await pushInvoice(invoiceObj);
            reloadFromStorage(["sgf_invoices"]);
            window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: 1 } }));
          }
        }
        break;
      }
      case "invoice.matchBankPayments": {
        result = dataService.invoice.matchBankPayments(input);
        if (result && result.success) {
          for (const inv of result.updatedInvoices || []) await pushInvoice(inv);
          reloadFromStorage(["sgf_invoices"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: result.updatedInvoices?.length || 0 } }));
        }
        break;
      }
      case "invoice.parseBankStatement":
        result = dataService.invoice.parseBankStatement(input);
        break;
      case "invoice.relinkSageInvoices": {
        result = dataService.invoice.relinkSageInvoices();
        if (result && result.success) {
          for (const inv of result.updated || []) await pushInvoice(inv);
          reloadFromStorage(["sgf_invoices"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: result.updated?.length || 0 } }));
        }
        break;
      }
      case "invoice.allocateCredit": {
        result = dataService.invoice.allocateCredit(input);
        if (result && result.success && result.invoice) {
          await pushInvoice(result.invoice);
          if (result.creditNote) await pushCreditNote(result.creditNote);
          reloadFromStorage(["sgf_invoices", "sgf_creditNotes"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: 1 } }));
        }
        break;
      }
      case "invoice.applyOverpaymentCredit": {
        result = dataService.invoice.applyOverpaymentCredit(input);
        if (result && result.success) {
          if (result.fromInvoice) await pushInvoice(result.fromInvoice);
          if (result.toInvoice) await pushInvoice(result.toInvoice);
          reloadFromStorage(["sgf_invoices"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: 2 } }));
        }
        break;
      }
      case "invoice.removeOverpaymentAllocation": {
        result = dataService.invoice.removeOverpaymentAllocation(input);
        if (result && result.success) {
          if (result.fromInvoice) await pushInvoice(result.fromInvoice);
          if (result.toInvoice) await pushInvoice(result.toInvoice);
          reloadFromStorage(["sgf_invoices"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: 2 } }));
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
      case "appointment.getByDateRange":
        result = dataService.appointment.getByDateRange(input || { startDate: "", endDate: "" });
        break;
      case "appointment.getByCustomer":
        result = dataService.appointment.getByCustomer(input);
        break;
      case "appointment.getBySalesRep":
        result = dataService.appointment.getBySalesRep(input);
        break;
      case "appointment.getByStatus":
        result = dataService.appointment.getByStatus(input);
        break;
      case "appointment.getByProduct":
        result = dataService.appointment.getByProduct(input);
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
        const { id: apid, data: apdata } = input;
        result = dataService.appointment.update({ id: apid, data: apdata });
        if (result) {
          await pushAppointment(result);
          reloadFromStorage(["sgf_appointments"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "appointments", count: 1 } }));
        }
        break;
      }
      case "appointment.delete": {
        const id = normalizeId(input);
        result = dataService.appointment.delete(id);
        if (result?.success) {
          await pushAppointmentDelete(id);
          reloadFromStorage(["sgf_appointments"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "appointments", count: 0 } }));
        }
        break;
      }
      case "appointment.updateStatus": {
        const { id: apid, data: apdata } = input;
        result = dataService.appointment.update({ id: apid, data: apdata });
        if (result) {
          await pushAppointment(result);
          reloadFromStorage(["sgf_appointments"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "appointments", count: 1 } }));
        }
        break;
      }
      case "appointment.sendReminder": {
        result = dataService.appointment.sendReminder(input);
        break;
      }
      case "appointment.bulkCreate": {
        result = dataService.appointment.bulkCreate(input);
        if (result && result.length > 0) {
          for (const ap of result) await pushAppointment(ap);
          reloadFromStorage(["sgf_appointments"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "appointments", count: result.length } }));
        }
        break;
      }
      case "appointment.getUpcoming":
        result = dataService.appointment.getUpcoming(input || 7);
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
      case "checkIn.getByDate":
        result = dataService.checkIn.getByDate(input);
        break;
      case "checkIn.getByDateRange":
        result = dataService.checkIn.getByDateRange(input || { startDate: "", endDate: "" });
        break;
      case "checkIn.getByCustomer":
        result = dataService.checkIn.getByCustomer(input);
        break;
      case "checkIn.getBySalesRep":
        result = dataService.checkIn.getBySalesRep(input);
        break;
      case "checkIn.create": {
        result = dataService.checkIn.create(input);
        if (result) {
          await pushCheckin(result);
          reloadFromStorage(["sgf_checkIns"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "checkIns", count: 1 } }));
        }
        break;
      }
      case "checkIn.update": {
        const { id: cchkId, data: cchkData } = input;
        result = dataService.checkIn.update({ id: cchkId, data: cchkData });
        if (result) {
          await pushCheckin(result);
          reloadFromStorage(["sgf_checkIns"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "checkIns", count: 1 } }));
        }
        break;
      }
      case "checkIn.delete": {
        const id = normalizeId(input);
        result = dataService.checkIn.delete(id);
        if (result?.success) {
          await pushCheckinDelete(id);
          reloadFromStorage(["sgf_checkIns"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "checkIns", count: 0 } }));
        }
        break;
      }
      case "checkIn.getStats":
        result = dataService.checkIn.getStats();
        break;
      case "checkIn.getCustomerVisitHistory":
        result = dataService.checkIn.getCustomerVisitHistory(input);
        break;
      case "checkIn.getCustomerCheckInStats":
        result = dataService.checkIn.getCustomerCheckInStats(input);
        break;
      case "checkIn.getRecentByCustomer":
        result = dataService.checkIn.getRecentByCustomer(input);
        break;

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
      case "specialPrice.getByProduct":
        result = dataService.specialPrice.getByProduct(input);
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
        const { id: spId, data: spData } = input;
        result = dataService.specialPrice.update({ id: spId, data: spData });
        if (result) {
          await pushSpecialPrice(result);
          reloadFromStorage(["sgf_specialPrices"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "specialPrices", count: 1 } }));
        }
        break;
      }
      case "specialPrice.delete": {
        const id = normalizeId(input);
        result = dataService.specialPrice.delete({ id });
        if (result?.success) {
          await removeSpecialPrice(id);
          reloadFromStorage(["sgf_specialPrices"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "specialPrices", count: 0 } }));
        }
        break;
      }
      case "specialPrice.bulkUpload": {
        result = dataService.specialPrice.bulkUpload(input);
        if (result?.success) {
          const items = dataService.specialPrice.list();
          for (const item of items) {
            try { await pushSpecialPrice(item); } catch { /* ignore */ }
          }
          reloadFromStorage(["sgf_specialPrices"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "specialPrices", count: items.length } }));
        }
        break;
      }
      case "specialPrice.getByCustomerAndProduct":
        result = dataService.specialPrice.getByCustomerAndProduct(input);
        break;
      case "specialPrice.getByCustomerAndProductId":
        result = dataService.specialPrice.getByCustomerAndProductId(input);
        break;
      case "specialPrice.getCustomerProductPrices":
        result = dataService.specialPrice.getCustomerProductPrices(input);
        break;
      case "specialPrice.getProductCustomerPrices":
        result = dataService.specialPrice.getProductCustomerPrices(input);
        break;
      case "specialPrice.getEffectivePrice":
        result = dataService.specialPrice.getEffectivePrice(input);
        break;
      case "specialPrice.getPriceHistory":
        result = dataService.specialPrice.getPriceHistory(input);
        break;
      case "specialPrice.getStats":
        result = dataService.specialPrice.getStats();
        break;
      case "specialPrice.getActiveSpecialPrices":
        result = dataService.specialPrice.getActiveSpecialPrices();
        break;

      // ================================================================
      //  FOLLOW UPS
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
      case "followUp.getBySalesRep":
        result = dataService.followUp.getBySalesRep(input);
        break;
      case "followUp.getByStatus":
        result = dataService.followUp.getByStatus(input);
        break;
      case "followUp.getByDate":
        result = dataService.followUp.getByDate(input);
        break;
      case "followUp.getByDateRange":
        result = dataService.followUp.getByDateRange(input || { startDate: "", endDate: "" });
        break;
      case "followUp.getOverdue":
        result = dataService.followUp.getOverdue();
        break;
      case "followUp.getToday":
        result = dataService.followUp.getToday();
        break;
      case "followUp.getUpcoming":
        result = dataService.followUp.getUpcoming(input || 7);
        break;
      case "followUp.getStats":
        result = dataService.followUp.getStats();
        break;
      case "followUp.getRecentActivity":
        result = dataService.followUp.getRecentActivity(input || 5);
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
        const id = normalizeId(input);
        result = dataService.followUp.delete(id);
        if (result?.success) {
          await pushFollowUp({ id, deleted: true });
          reloadFromStorage(["sgf_followUps"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "followUps", count: 0 } }));
        }
        break;
      }
      case "followUp.bulkCreate": {
        result = dataService.followUp.bulkCreate(input);
        if (result && result.length > 0) {
          for (const fu of result) await pushFollowUp(fu);
          reloadFromStorage(["sgf_followUps"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "followUps", count: result.length } }));
        }
        break;
      }
      case "followUp.getByInvoice":
        result = dataService.followUp.getByInvoice(input);
        break;

      // ================================================================
      //  FOLLOW UP ACTIONS
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
      case "followUpAction.getByType":
        result = dataService.followUpAction.getByType(input);
        break;
      case "followUpAction.getByDate":
        result = dataService.followUpAction.getByDate(input);
        break;
      case "followUpAction.getByDateRange":
        result = dataService.followUpAction.getByDateRange(input || { startDate: "", endDate: "" });
        break;
      case "followUpAction.getByStatus":
        result = dataService.followUpAction.getByStatus(input);
        break;
      case "followUpAction.getStats":
        result = dataService.followUpAction.getStats();
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
        const id = normalizeId(input);
        result = dataService.followUpAction.delete(id);
        if (result?.success) {
          await pushFollowUpAction({ id, deleted: true });
          reloadFromStorage(["sgf_followUpActions"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "followUpActions", count: 0 } }));
        }
        break;
      }
      case "followUpAction.bulkCreate": {
        result = dataService.followUpAction.bulkCreate(input);
        if (result && result.length > 0) {
          for (const fa of result) await pushFollowUpAction(fa);
          reloadFromStorage(["sgf_followUpActions"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "followUpActions", count: result.length } }));
        }
        break;
      }

      // ================================================================
      //  COLLECTION NOTES
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
      case "collectionNote.getByInvoice":
        result = dataService.collectionNote.getByInvoice(input);
        break;
      case "collectionNote.getByDate":
        result = dataService.collectionNote.getByDate(input);
        break;
      case "collectionNote.getByDateRange":
        result = dataService.collectionNote.getByDateRange(input || { startDate: "", endDate: "" });
        break;
      case "collectionNote.getByStatus":
        result = dataService.collectionNote.getByStatus(input);
        break;
      case "collectionNote.getStats":
        result = dataService.collectionNote.getStats();
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
        const { id: cnId, data: cnData } = input;
        result = dataService.collectionNote.update({ id: cnId, data: cnData });
        if (result) {
          await pushCollectionNote(result);
          reloadFromStorage(["sgf_collectionNotes"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "collectionNotes", count: 1 } }));
        }
        break;
      }
      case "collectionNote.delete": {
        const id = normalizeId(input);
        result = dataService.collectionNote.delete(id);
        if (result?.success) {
          await pushCollectionNote({ id, deleted: true });
          reloadFromStorage(["sgf_collectionNotes"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "collectionNotes", count: 0 } }));
        }
        break;
      }
      case "collectionNote.bulkCreate": {
        result = dataService.collectionNote.bulkCreate(input);
        if (result && result.length > 0) {
          for (const cn of result) await pushCollectionNote(cn);
          reloadFromStorage(["sgf_collectionNotes"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "collectionNotes", count: result.length } }));
        }
        break;
      }
      case "collectionNote.getRecentByCustomer":
        result = dataService.collectionNote.getRecentByCustomer(input);
        break;
      case "collectionNote.getOverdue":
        result = dataService.collectionNote.getOverdue();
        break;
      case "collectionNote.getToday":
        result = dataService.collectionNote.getToday();
        break;
      case "collectionNote.getUpcoming":
        result = dataService.collectionNote.getUpcoming(input || 7);
        break;

      // ================================================================
      //  COLLECTION PROMISES
      // ================================================================
      case "collectionPromise.list":
        result = dataService.collectionPromise.list();
        break;
      case "collectionPromise.getById":
        result = dataService.collectionPromise.getById(input);
        break;
      case "collectionPromise.getByCustomer":
        result = dataService.collectionPromise.getByCustomer(input);
        break;
      case "collectionPromise.getByInvoice":
        result = dataService.collectionPromise.getByInvoice(input);
        break;
      case "collectionPromise.getByDate":
        result = dataService.collectionPromise.getByDate(input);
        break;
      case "collectionPromise.getByDateRange":
        result = dataService.collectionPromise.getByDateRange(input || { startDate: "", endDate: "" });
        break;
      case "collectionPromise.getByStatus":
        result = dataService.collectionPromise.getByStatus(input);
        break;
      case "collectionPromise.getStats":
        result = dataService.collectionPromise.getStats();
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
        const { id: cpId, data: cpData } = input;
        result = dataService.collectionPromise.update({ id: cpId, data: cpData });
        if (result) {
          await pushCollectionPromise(result);
          reloadFromStorage(["sgf_collectionPromises"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "collectionPromises", count: 1 } }));
        }
        break;
      }
      case "collectionPromise.delete": {
        const id = normalizeId(input);
        result = dataService.collectionPromise.delete(id);
        if (result?.success) {
          await pushCollectionPromise({ id, deleted: true });
          reloadFromStorage(["sgf_collectionPromises"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "collectionPromises", count: 0 } }));
        }
        break;
      }
      case "collectionPromise.bulkCreate": {
        result = dataService.collectionPromise.bulkCreate(input);
        if (result && result.length > 0) {
          for (const cp of result) await pushCollectionPromise(cp);
          reloadFromStorage(["sgf_collectionPromises"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "collectionPromises", count: result.length } }));
        }
        break;
      }
      case "collectionPromise.getRecentByCustomer":
        result = dataService.collectionPromise.getRecentByCustomer(input);
        break;
      case "collectionPromise.getOverdue":
        result = dataService.collectionPromise.getOverdue();
        break;
      case "collectionPromise.getToday":
        result = dataService.collectionPromise.getToday();
        break;
      case "collectionPromise.getUpcoming":
        result = dataService.collectionPromise.getUpcoming(input || 7);
        break;

      // ================================================================
      //  CORPORATE CUSTOMERS
      // ================================================================
      case "corporateCustomer.list":
        result = dataService.corporateCustomer.list();
        break;
      case "corporateCustomer.getById":
        result = dataService.corporateCustomer.getById(input);
        break;
      case "corporateCustomer.search":
        result = dataService.corporateCustomer.search(input || { query: "" });
        break;
      case "corporateCustomer.getStats":
        result = dataService.corporateCustomer.getStats();
        break;
      case "corporateCustomer.getPurchaseOrders":
        result = dataService.corporateCustomer.getPurchaseOrders(input);
        break;
      case "corporateCustomer.getInvoices":
        result = dataService.corporateCustomer.getInvoices(input);
        break;
      case "corporateCustomer.create": {
        result = dataService.corporateCustomer.create(input);
        if (result) {
          await pushCorporateCustomer(result);
          // Also push the linked normal customer if it exists
          const linkedCustomer = dataService.customer.getById(result.linkedCustomerId);
          if (linkedCustomer) await pushCustomer(linkedCustomer);
          reloadFromStorage(["sgf_corporateCustomers", "sgf_customers"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "corporateCustomers", count: 1 } }));
        }
        break;
      }
      case "corporateCustomer.update": {
        const { id: ccid, data: ccdata } = input;
        result = dataService.corporateCustomer.update({ id: ccid, data: ccdata });
        if (result) {
          await pushCorporateCustomer(result);
          // Also push the linked normal customer if it was updated
          const linkedCustomer = dataService.customer.getById(result.linkedCustomerId);
          if (linkedCustomer) await pushCustomer(linkedCustomer);
          reloadFromStorage(["sgf_corporateCustomers", "sgf_customers"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "corporateCustomers", count: 1 } }));
        }
        break;
      }
      case "corporateCustomer.delete": {
        const id = normalizeId(input);
        result = dataService.corporateCustomer.delete(id);
        if (result?.success) {
          await removeCorporateCustomer(id);
          // Also remove the linked normal customer
          const corporate = dataService.corporateCustomer.getById(id);
          if (corporate?.linkedCustomerId) {
            const linked = dataService.customer.getById(corporate.linkedCustomerId);
            if (linked) {
              await removeOneCustomer(linked.id);
              reloadFromStorage(["sgf_customers"]);
            }
          }
          reloadFromStorage(["sgf_corporateCustomers"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "corporateCustomers", count: 0 } }));
        }
        break;
      }
      case "corporateCustomer.bulkUpload": {
        result = dataService.corporateCustomer.bulkUpload(input);
        if (result?.success) {
          const corporateCustomers = dataService.corporateCustomer.list();
          for (const cc of corporateCustomers) {
            try { await pushCorporateCustomer(cc); } catch { /* ignore */ }
          }
          const customers = dataService.customer.list();
          for (const cust of customers) {
            try { await pushCustomer(cust); } catch { /* ignore */ }
          }
          reloadFromStorage(["sgf_corporateCustomers", "sgf_customers"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "corporateCustomers", count: corporateCustomers.length } }));
        }
        break;
      }
      case "corporateCustomer.getInvoicesByStatus":
        result = dataService.corporateCustomer.getInvoicesByStatus(input);
        break;
      case "corporateCustomer.getSalesRepInvoices":
        result = dataService.corporateCustomer.getSalesRepInvoices(input);
        break;
      case "corporateCustomer.getBySalesRep":
        result = dataService.corporateCustomer.getBySalesRep(input);
        break;
      case "corporateCustomer.getBySalesRep2":
        result = dataService.corporateCustomer.getBySalesRep2(input);
        break;
      case "corporateCustomer.getAgedDebtors":
        result = dataService.corporateCustomer.getAgedDebtors();
        break;
      case "corporateCustomer.getMonthlyRevenue":
        result = dataService.corporateCustomer.getMonthlyRevenue(input || { year: new Date().getFullYear() });
        break;
      case "corporateCustomer.getStatement":
        result = dataService.corporateCustomer.getStatement(input);
        break;
      case "corporateCustomer.getCustomerTransactions":
        result = dataService.corporateCustomer.getCustomerTransactions(input);
        break;
      case "corporateCustomer.getOverdueInvoices":
        result = dataService.corporateCustomer.getOverdueInvoices();
        break;
      case "corporateCustomer.getUnpaidInvoices":
        result = dataService.corporateCustomer.getUnpaidInvoices();
        break;
      case "corporateCustomer.getPaidInvoices":
        result = dataService.corporateCustomer.getPaidInvoices();
        break;
      case "corporateCustomer.getPartiallyPaidInvoices":
        result = dataService.corporateCustomer.getPartiallyPaidInvoices();
        break;
      case "corporateCustomer.getCancelledInvoices":
        result = dataService.corporateCustomer.getCancelledInvoices();
        break;
      case "corporateCustomer.getDraftInvoices":
        result = dataService.corporateCustomer.getDraftInvoices();
        break;
      case "corporateCustomer.getInvoiceSummary":
        result = dataService.corporateCustomer.getInvoiceSummary();
        break;
      case "corporateCustomer.getPaymentSummary":
        result = dataService.corporateCustomer.getPaymentSummary();
        break;
      case "corporateCustomer.getCreditNoteSummary":
        result = dataService.corporateCustomer.getCreditNoteSummary();
        break;
      case "corporateCustomer.getBalanceSummary":
        result = dataService.corporateCustomer.getBalanceSummary();
        break;
      case "corporateCustomer.getSalesRepPerformance":
        result = dataService.corporateCustomer.getSalesRepPerformance(input);
        break;
      case "corporateCustomer.getSalesRepRevenue":
        result = dataService.corporateCustomer.getSalesRepRevenue(input);
        break;
      case "corporateCustomer.getSalesRepCustomers":
        result = dataService.corporateCustomer.getSalesRepCustomers(input);
        break;
      case "corporateCustomer.getSalesRepInvoices2":
        result = dataService.corporateCustomer.getSalesRepInvoices2(input);
        break;
      case "corporateCustomer.getSalesRepAgedDebtors":
        result = dataService.corporateCustomer.getSalesRepAgedDebtors();
        break;
      case "corporateCustomer.getSalesRepMonthlyRevenue":
        result = dataService.corporateCustomer.getSalesRepMonthlyRevenue(input || { year: new Date().getFullYear() });
        break;
      case "corporateCustomer.getSalesRepStatement":
        result = dataService.corporateCustomer.getSalesRepStatement(input);
        break;
      case "corporateCustomer.getSalesRepCustomerTransactions":
        result = dataService.corporateCustomer.getSalesRepCustomerTransactions(input);
        break;
      case "corporateCustomer.getSalesRepOverdueInvoices":
        result = dataService.corporateCustomer.getSalesRepOverdueInvoices();
        break;
      case "corporateCustomer.getSalesRepUnpaidInvoices":
        result = dataService.corporateCustomer.getSalesRepUnpaidInvoices();
        break;
      case "corporateCustomer.getSalesRepPaidInvoices":
        result = dataService.corporateCustomer.getSalesRepPaidInvoices();
        break;
      case "corporateCustomer.getSalesRepPartiallyPaidInvoices":
        result = dataService.corporateCustomer.getSalesRepPartiallyPaidInvoices();
        break;
      case "corporateCustomer.getSalesRepCancelledInvoices":
        result = dataService.corporateCustomer.getSalesRepCancelledInvoices();
        break;
      case "corporateCustomer.getSalesRepDraftInvoices":
        result = dataService.corporateCustomer.getSalesRepDraftInvoices();
        break;
      case "corporateCustomer.getSalesRepInvoiceSummary":
        result = dataService.corporateCustomer.getSalesRepInvoiceSummary();
        break;
      case "corporateCustomer.getSalesRepPaymentSummary":
        result = dataService.corporateCustomer.getSalesRepPaymentSummary();
        break;
      case "corporateCustomer.getSalesRepCreditNoteSummary":
        result = dataService.corporateCustomer.getSalesRepCreditNoteSummary();
        break;
      case "corporateCustomer.getSalesRepBalanceSummary":
        result = dataService.corporateCustomer.getSalesRepBalanceSummary();
        break;
      case "corporateCustomer.getByCustomerId":
        result = dataService.corporateCustomer.getByCustomerId(input);
        break;
      case "corporateCustomer.linkToCustomer": {
        result = dataService.corporateCustomer.linkToCustomer(input);
        if (result) {
          await pushCorporateCustomer(result.corporateCustomer);
          await pushCustomer(result.linkedCustomer);
          reloadFromStorage(["sgf_corporateCustomers", "sgf_customers"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "corporateCustomers", count: 1 } }));
        }
        break;
      }
      case "corporateCustomer.unlinkFromCustomer": {
        result = dataService.corporateCustomer.unlinkFromCustomer(input);
        if (result) {
          await pushCorporateCustomer(result.corporateCustomer);
          await pushCustomer(result.linkedCustomer);
          reloadFromStorage(["sgf_corporateCustomers", "sgf_customers"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "corporateCustomers", count: 1 } }));
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
      case "purchaseOrder.getByCorporateCustomer":
        result = dataService.purchaseOrder.getByCorporateCustomer(input);
        break;
      case "purchaseOrder.getByDate":
        result = dataService.purchaseOrder.getByDate(input);
        break;
      case "purchaseOrder.getByDateRange":
        result = dataService.purchaseOrder.getByDateRange(input || { startDate: "", endDate: "" });
        break;
      case "purchaseOrder.getByStatus":
        result = dataService.purchaseOrder.getByStatus(input);
        break;
      case "purchaseOrder.getByProduct":
        result = dataService.purchaseOrder.getByProduct(input);
        break;
      case "purchaseOrder.getStats":
        result = dataService.purchaseOrder.getStats();
        break;
      case "purchaseOrder.getRecent":
        result = dataService.purchaseOrder.getRecent(input || 5);
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
        const id = normalizeId(input);
        result = dataService.purchaseOrder.delete(id);
        if (result?.success) {
          await removePurchaseOrder(id);
          reloadFromStorage(["sgf_purchaseOrders"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "purchaseOrders", count: 0 } }));
        }
        break;
      }
      case "purchaseOrder.updateStatus": {
        const { id: poid, data: podata } = input;
        result = dataService.purchaseOrder.update({ id: poid, data: podata });
        if (result) {
          await pushPurchaseOrder(result);
          reloadFromStorage(["sgf_purchaseOrders"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "purchaseOrders", count: 1 } }));
        }
        break;
      }
      case "purchaseOrder.bulkCreate": {
        result = dataService.purchaseOrder.bulkCreate(input);
        if (result && result.length > 0) {
          for (const po of result) await pushPurchaseOrder(po);
          reloadFromStorage(["sgf_purchaseOrders"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "purchaseOrders", count: result.length } }));
        }
        break;
      }
      case "purchaseOrder.convertToInvoice": {
        result = dataService.purchaseOrder.convertToInvoice(input);
        if (result) {
          await pushInvoice(result);
          reloadFromStorage(["sgf_invoices"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: 1 } }));
        }
        break;
      }
      case "purchaseOrder.generateInvoice": {
        result = dataService.purchaseOrder.generateInvoice(input);
        if (result) {
          await pushInvoice(result);
          reloadFromStorage(["sgf_invoices"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: 1 } }));
        }
        break;
      }
      case "purchaseOrder.cancel": {
        result = dataService.purchaseOrder.cancel(input);
        if (result?.success) {
          const cancelled = dataService.purchaseOrder.getById(input);
          if (cancelled) await pushPurchaseOrder(cancelled);
          reloadFromStorage(["sgf_purchaseOrders"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "purchaseOrders", count: 1 } }));
        }
        break;
      }
      case "purchaseOrder.getPending":
        result = dataService.purchaseOrder.getPending();
        break;
      case "purchaseOrder.getPendingInvoices":
        result = dataService.purchaseOrder.getPendingInvoices();
        break;
      case "purchaseOrder.getBySalesRep":
        result = dataService.purchaseOrder.getBySalesRep(input);
        break;
      case "purchaseOrder.getByCustomer":
        result = dataService.purchaseOrder.getByCustomer(input);
        break;
      case "purchaseOrder.getByInvoice":
        result = dataService.purchaseOrder.getByInvoice(input);
        break;
      case "purchaseOrder.getInvoiceSummary":
        result = dataService.purchaseOrder.getInvoiceSummary();
        break;
      case "purchaseOrder.getPaymentSummary":
        result = dataService.purchaseOrder.getPaymentSummary();
        break;
      case "purchaseOrder.getCreditNoteSummary":
        result = dataService.purchaseOrder.getCreditNoteSummary();
        break;
      case "purchaseOrder.getBalanceSummary":
        result = dataService.purchaseOrder.getBalanceSummary();
        break;
      case "purchaseOrder.getStatement":
        result = dataService.purchaseOrder.getStatement(input);
        break;
      case "purchaseOrder.getCustomerTransactions":
        result = dataService.purchaseOrder.getCustomerTransactions(input);
        break;
      case "purchaseOrder.getOverdue":
        result = dataService.purchaseOrder.getOverdue();
        break;
      case "purchaseOrder.getUnpaid":
        result = dataService.purchaseOrder.getUnpaid();
        break;
      case "purchaseOrder.getPaid":
        result = dataService.purchaseOrder.getPaid();
        break;
      case "purchaseOrder.getPartiallyPaid":
        result = dataService.purchaseOrder.getPartiallyPaid();
        break;
      case "purchaseOrder.getCancelled":
        result = dataService.purchaseOrder.getCancelled();
        break;
      case "purchaseOrder.getDraft":
        result = dataService.purchaseOrder.getDraft();
        break;
      case "purchaseOrder.getByNumber":
        result = dataService.purchaseOrder.getByNumber(input);
        break;
      case "purchaseOrder.findByNumber":
        result = dataService.purchaseOrder.findByNumber(input);
        break;
      case "purchaseOrder.getByOrderOrNumber":
        result = dataService.purchaseOrder.getByOrderOrNumber(input);
        break;
      case "purchaseOrder.getMonthlyRevenue":
        result = dataService.purchaseOrder.getMonthlyRevenue(input || { year: new Date().getFullYear() });
        break;
      case "purchaseOrder.getSalesRepPerformance":
        result = dataService.purchaseOrder.getSalesRepPerformance(input);
        break;
      case "purchaseOrder.getSalesRepRevenue":
        result = dataService.purchaseOrder.getSalesRepRevenue(input);
        break;
      case "purchaseOrder.getSalesRepCustomers":
        result = dataService.purchaseOrder.getSalesRepCustomers(input);
        break;
      case "purchaseOrder.getSalesRepInvoices":
        result = dataService.purchaseOrder.getSalesRepInvoices(input);
        break;
      case "purchaseOrder.getSalesRepAgedDebtors":
        result = dataService.purchaseOrder.getSalesRepAgedDebtors();
        break;
      case "purchaseOrder.getSalesRepMonthlyRevenue":
        result = dataService.purchaseOrder.getSalesRepMonthlyRevenue(input || { year: new Date().getFullYear() });
        break;
      case "purchaseOrder.getSalesRepStatement":
        result = dataService.purchaseOrder.getSalesRepStatement(input);
        break;
      case "purchaseOrder.getSalesRepCustomerTransactions":
        result = dataService.purchaseOrder.getSalesRepCustomerTransactions(input);
        break;
      case "purchaseOrder.getSalesRepOverdue":
        result = dataService.purchaseOrder.getSalesRepOverdue();
        break;
      case "purchaseOrder.getSalesRepUnpaid":
        result = dataService.purchaseOrder.getSalesRepUnpaid();
        break;
      case "purchaseOrder.getSalesRepPaid":
        result = dataService.purchaseOrder.getSalesRepPaid();
        break;
      case "purchaseOrder.getSalesRepPartiallyPaid":
        result = dataService.purchaseOrder.getSalesRepPartiallyPaid();
        break;
      case "purchaseOrder.getSalesRepCancelled":
        result = dataService.purchaseOrder.getSalesRepCancelled();
        break;
      case "purchaseOrder.getSalesRepDraft":
        result = dataService.purchaseOrder.getSalesRepDraft();
        break;
      case "purchaseOrder.getSalesRepInvoiceSummary":
        result = dataService.purchaseOrder.getSalesRepInvoiceSummary();
        break;
      case "purchaseOrder.getSalesRepPaymentSummary":
        result = dataService.purchaseOrder.getSalesRepPaymentSummary();
        break;
      case "purchaseOrder.getSalesRepCreditNoteSummary":
        result = dataService.purchaseOrder.getSalesRepCreditNoteSummary();
        break;
      case "purchaseOrder.getSalesRepBalanceSummary":
        result = dataService.purchaseOrder.getSalesRepBalanceSummary();
        break;

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
      case "barrel.getByDate":
        result = dataService.barrel.getByDate(input);
        break;
      case "barrel.getByDateRange":
        result = dataService.barrel.getByDateRange(input || { startDate: "", endDate: "" });
        break;
      case "barrel.getByStatus":
        result = dataService.barrel.getByStatus(input);
        break;
      case "barrel.getByProduct":
        result = dataService.barrel.getByProduct(input);
        break;
      case "barrel.getStats":
        result = dataService.barrel.getStats();
        break;
      case "barrel.getRecent":
        result = dataService.barrel.getRecent(input || 5);
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
        const id = normalizeId(input);
        result = dataService.barrel.delete(id);
        if (result?.success) {
          await removeBarrel(id);
          reloadFromStorage(["sgf_barrels"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "barrels", count: 0 } }));
        }
        break;
      }
      case "barrel.bulkCreate": {
        result = dataService.barrel.bulkCreate(input);
        if (result && result.length > 0) {
          for (const b of result) await pushBarrel(b);
          reloadFromStorage(["sgf_barrels"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "barrels", count: result.length } }));
        }
        break;
      }
      case "barrel.updateStatus": {
        const { id: bid, data: bdata } = input;
        result = dataService.barrel.update({ id: bid, data: bdata });
        if (result) {
          await pushBarrel(result);
          reloadFromStorage(["sgf_barrels"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "barrels", count: 1 } }));
        }
        break;
      }
      case "barrel.getBySalesRep":
        result = dataService.barrel.getBySalesRep(input);
        break;
      case "barrel.getByCustomerAndProduct":
        result = dataService.barrel.getByCustomerAndProduct(input);
        break;
      case "barrel.getCustomerBarrelHistory":
        result = dataService.barrel.getCustomerBarrelHistory(input);
        break;
      case "barrel.getCustomerBarrelStats":
        result = dataService.barrel.getCustomerBarrelStats(input);
        break;
      case "barrel.getRecentByCustomer":
        result = dataService.barrel.getRecentByCustomer(input);
        break;

      // ================================================================
      //  COC
      // ================================================================
      case "coc.list":
        result = dataService.coc.list();
        break;
      case "coc.getById":
        result = dataService.coc.getById(input);
        break;
      case "coc.getByCustomer":
        result = dataService.coc.getByCustomer(input);
        break;
      case "coc.getByDate":
        result = dataService.coc.getByDate(input);
        break;
      case "coc.getByDateRange":
        result = dataService.coc.getByDateRange(input || { startDate: "", endDate: "" });
        break;
      case "coc.getByStatus":
        result = dataService.coc.getByStatus(input);
        break;
      case "coc.getByProduct":
        result = dataService.coc.getByProduct(input);
        break;
      case "coc.getStats":
        result = dataService.coc.getStats();
        break;
      case "coc.getRecent":
        result = dataService.coc.getRecent(input || 5);
        break;
      case "coc.create": {
        result = dataService.coc.create(input);
        if (result) {
          await pushCOC(result);
          reloadFromStorage(["sgf_coc"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "coc", count: 1 } }));
        }
        break;
      }
      case "coc.update": {
        const { id: cocid, data: cocdata } = input;
        result = dataService.coc.update({ id: cocid, data: cocdata });
        if (result) {
          await pushCOC(result);
          reloadFromStorage(["sgf_coc"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "coc", count: 1 } }));
        }
        break;
      }
      case "coc.delete": {
        const id = normalizeId(input);
        result = dataService.coc.delete(id);
        if (result?.success) {
          await removeCOC(id);
          reloadFromStorage(["sgf_coc"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "coc", count: 0 } }));
        }
        break;
      }
      case "coc.bulkCreate": {
        result = dataService.coc.bulkCreate(input);
        if (result && result.length > 0) {
          for (const coc of result) await pushCOC(coc);
          reloadFromStorage(["sgf_coc"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "coc", count: result.length } }));
        }
        break;
      }
      case "coc.updateStatus": {
        const { id: cocid, data: cocdata } = input;
        result = dataService.coc.update({ id: cocid, data: cocdata });
        if (result) {
          await pushCOC(result);
          reloadFromStorage(["sgf_coc"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "coc", count: 1 } }));
        }
        break;
      }
      case "coc.getBySalesRep":
        result = dataService.coc.getBySalesRep(input);
        break;
      case "coc.getByCustomerAndProduct":
        result = dataService.coc.getByCustomerAndProduct(input);
        break;
      case "coc.getCustomerCOCHistory":
        result = dataService.coc.getCustomerCOCHistory(input);
        break;
      case "coc.getCustomerCOCStats":
        result = dataService.coc.getCustomerCOCStats(input);
        break;
      case "coc.getRecentByCustomer":
        result = dataService.coc.getRecentByCustomer(input);
        break;

      // ================================================================
      //  PACKING LISTS
      // ================================================================
      case "packingList.list":
        result = dataService.packingList.list();
        break;
      case "packingList.getById":
        result = dataService.packingList.getById(input);
        break;
      case "packingList.getByCustomer":
        result = dataService.packingList.getByCustomer(input);
        break;
      case "packingList.getByDate":
        result = dataService.packingList.getByDate(input);
        break;
      case "packingList.getByDateRange":
        result = dataService.packingList.getByDateRange(input || { startDate: "", endDate: "" });
        break;
      case "packingList.getByStatus":
        result = dataService.packingList.getByStatus(input);
        break;
      case "packingList.getByProduct":
        result = dataService.packingList.getByProduct(input);
        break;
      case "packingList.getStats":
        result = dataService.packingList.getStats();
        break;
      case "packingList.getRecent":
        result = dataService.packingList.getRecent(input || 5);
        break;
      case "packingList.create": {
        result = dataService.packingList.create(input);
        if (result) {
          await pushPackingList(result);
          reloadFromStorage(["sgf_packingLists"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "packingLists", count: 1 } }));
        }
        break;
      }
      case "packingList.update": {
        const { id: plid, data: pldata } = input;
        result = dataService.packingList.update({ id: plid, data: pldata });
        if (result) {
          await pushPackingList(result);
          reloadFromStorage(["sgf_packingLists"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "packingLists", count: 1 } }));
        }
        break;
      }
      case "packingList.delete": {
        const id = normalizeId(input);
        result = dataService.packingList.delete(id);
        if (result?.success) {
          await removePackingListLine(id);
          reloadFromStorage(["sgf_packingLists"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "packingLists", count: 0 } }));
        }
        break;
      }
      case "packingList.bulkCreate": {
        result = dataService.packingList.bulkCreate(input);
        if (result && result.length > 0) {
          for (const pl of result) await pushPackingList(pl);
          reloadFromStorage(["sgf_packingLists"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "packingLists", count: result.length } }));
        }
        break;
      }
      case "packingList.updateStatus": {
        const { id: plid, data: pldata } = input;
        result = dataService.packingList.update({ id: plid, data: pldata });
        if (result) {
          await pushPackingList(result);
          reloadFromStorage(["sgf_packingLists"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "packingLists", count: 1 } }));
        }
        break;
      }
      case "packingList.getBySalesRep":
        result = dataService.packingList.getBySalesRep(input);
        break;
      case "packingList.getByCustomerAndProduct":
        result = dataService.packingList.getByCustomerAndProduct(input);
        break;
      case "packingList.getCustomerPackingListHistory":
        result = dataService.packingList.getCustomerPackingListHistory(input);
        break;
      case "packingList.getCustomerPackingListStats":
        result = dataService.packingList.getCustomerPackingListStats(input);
        break;
      case "packingList.getRecentByCustomer":
        result = dataService.packingList.getRecentByCustomer(input);
        break;

      // ================================================================
      //  SALES REPS
      // ================================================================
      case "salesRep.list":
        result = dataService.salesRep.list();
        break;
      case "salesRep.getById":
        result = dataService.salesRep.getById(input);
        break;
      case "salesRep.getByName":
        result = dataService.salesRep.getByName(input);
        break;
      case "salesRep.getByEmail":
        result = dataService.salesRep.getByEmail(input);
        break;
      case "salesRep.getByPhone":
        result = dataService.salesRep.getByPhone(input);
        break;
      case "salesRep.getByRegion":
        result = dataService.salesRep.getByRegion(input);
        break;
      case "salesRep.getByStatus":
        result = dataService.salesRep.getByStatus(input);
        break;
      case "salesRep.getByManager":
        result = dataService.salesRep.getByManager(input);
        break;
      case "salesRep.getByProduct":
        result = dataService.salesRep.getByProduct(input);
        break;
      case "salesRep.getByCustomer":
        result = dataService.salesRep.getByCustomer(input);
        break;
      case "salesRep.getByInvoice":
        result = dataService.salesRep.getByInvoice(input);
        break;
      case "salesRep.getByOrder":
        result = dataService.salesRep.getByOrder(input);
        break;
      case "salesRep.getByPurchaseOrder":
        result = dataService.salesRep.getByPurchaseOrder(input);
        break;
      case "salesRep.getByFollowUp":
        result = dataService.salesRep.getByFollowUp(input);
        break;
      case "salesRep.getByFollowUpAction":
        result = dataService.salesRep.getByFollowUpAction(input);
        break;
      case "salesRep.getByCollectionNote":
        result = dataService.salesRep.getByCollectionNote(input);
        break;
      case "salesRep.getByCollectionPromise":
        result = dataService.salesRep.getByCollectionPromise(input);
        break;
      case "salesRep.getByAppointment":
        result = dataService.salesRep.getByAppointment(input);
        break;
      case "salesRep.getByCheckIn":
        result = dataService.salesRep.getByCheckIn(input);
        break;
      case "salesRep.getBySpecialPrice":
        result = dataService.salesRep.getBySpecialPrice(input);
        break;
      case "salesRep.getByBarrel":
        result = dataService.salesRep.getByBarrel(input);
        break;
      case "salesRep.getByCoc":
        result = dataService.salesRep.getByCoc(input);
        break;
      case "salesRep.getByPackingList":
        result = dataService.salesRep.getByPackingList(input);
        break;
      case "salesRep.getByCreditNote":
        result = dataService.salesRep.getByCreditNote(input);
        break;
      case "salesRep.getByReceipt":
        result = dataService.salesRep.getByReceipt(input);
        break;
      case "salesRep.getByAccountHold":
        result = dataService.salesRep.getByAccountHold(input);
        break;
      case "salesRep.getByStatement":
        result = dataService.salesRep.getByStatement(input);
        break;
      case "salesRep.getByReport":
        result = dataService.salesRep.getByReport(input);
        break;
      case "salesRep.getBySettings":
        result = dataService.salesRep.getBySettings(input);
        break;
      case "salesRep.getBySystemLog":
        result = dataService.salesRep.getBySystemLog(input);
        break;
      case "salesRep.getByAuditLog":
        result = dataService.salesRep.getByAuditLog(input);
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
        const id = normalizeId(input);
        result = dataService.salesRep.delete({ id });
        if (result?.success) {
          await removeSalesRep(id);
          reloadFromStorage(["sgf_salesReps"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "salesReps", count: 0 } }));
        }
        break;
      }
      case "salesRep.getStats":
        result = dataService.salesRep.getStats();
        break;
      case "salesRep.getSalesBreakdown":
        result = dataService.salesRep.getSalesBreakdown();
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
        const id = normalizeId(input);
        result = dataService.invoice.deleteReceipt(id);
        if (result?.success) {
          await removeReceipt(id);
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
        const id = normalizeId(input);
        result = dataService.creditNote.delete(id);
        if (result?.success) {
          await removeCreditNote(id);
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
      case "settings.getSystemLogSettings":
        result = dataService.settings.getSystemLogSettings();
        break;
      case "settings.getAuditLogSettings":
        result = dataService.settings.getAuditLogSettings();
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
