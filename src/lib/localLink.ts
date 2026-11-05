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
          await pushUserDelete(input.id);
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
        result = dataService.stock.delete(input);
        if (result?.success) {
          await removeOneStockItem(input);
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
        result = dataService.invoice.delete(input);
        if (result) {
          await removeInvoice(input);
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
        result = dataService.invoice.deleteReceipt(input);
        if (result?.success) {
          await removeReceipt(input);
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
      case "invoice.voidCreditNoteAllocation": {
        result = dataService.invoice.voidCreditNoteAllocation(input);
        if (result && result.success) {
          if (result.creditNote) await pushCreditNote(result.creditNote);
          // Invoice was also updated — find and push it
          const updatedInvoice = (dataService.invoice.list() || []).find((i: any) => i.id == input.invoiceId);
          if (updatedInvoice) await pushInvoice(updatedInvoice);
          reloadFromStorage(["sgf_creditNotes", "sgf_invoices"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "creditNotes", count: 1 } }));
        }
        break;
      }
      case "invoice.refundCreditNote": {
        result = dataService.invoice.refundCreditNote(input);
        if (result && result.success) {
          await pushCreditNote(result.creditNote);
          reloadFromStorage(["sgf_creditNotes"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "creditNotes", count: 1 } }));
        }
        break;
      }
      case "invoice.createOrderFromInvoice": {
        result = dataService.invoice.createFromInvoice(input);
        if (result && !result.error) {
          await pushOrder(result);
          // The invoice was also updated inside createFromInvoice — find and push it
          const linkedInv = dataService.invoice.getById(input);
          if (linkedInv) await pushInvoice(linkedInv);
          reloadFromStorage(["sgf_orders", "sgf_invoices"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "orders", count: 1 } }));
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
      case "appointment.getStats":
        result = dataService.appointment.getStats();
        break;
      case "appointment.listAll":
        result = dataService.appointment.listAll();
        break;
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
      case "checkIn.checkout": {
        result = dataService.checkIn.checkout(input);
        if (result) {
          await pushCheckin(result);
          reloadFromStorage(["sgf_checkins"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "checkins", count: 1 } }));
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
      case "checkIn.getAARate":
        result = dataService.checkIn.getAARate();
        break;
      case "checkIn.getDailyReport":
        result = dataService.checkIn.getDailyReport(input);
        break;
      case "checkIn.getMonthlyReport":
        result = dataService.checkIn.getMonthlyReport(input);
        break;
      case "checkIn.getStats":
        result = dataService.checkIn.getStats();
        break;
      case "checkIn.getWeeklyReport":
        result = dataService.checkIn.getWeeklyReport(input);
        break;
      case "checkIn.setAARate":
        result = dataService.checkIn.setAARate(input);
        break;
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
      case "specialPrice.listByCustomer":
        result = dataService.specialPrice.listByCustomer(input);
        break;
      case "sampleReport.getAll":
        result = dataService.sampleReport.getAll();
        break;
      case "sampleReport.getByCustomer":
        result = dataService.sampleReport.getByCustomer(input);
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
      case "followUp.getStats":
        result = dataService.followUp.getStats();
        break;
      case "followUp.listAll":
        result = dataService.followUp.listAll();
        break;
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
      case "collectionNote.getByInvoice":
        result = dataService.collectionNote.getByInvoice(input);
        break;
      case "collectionNote.getStats":
        result = dataService.collectionNote.getStats();
        break;
      case "collectionNote.search":
        result = dataService.collectionNote.search(input || { query: "" });
        break;
      case "collectionNote.getDailyReport":
        result = dataService.collectionNote.getDailyReport(input);
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
      case "collectionNote.recordVisit": {
        result = dataService.collectionNote.recordVisit(input);
        if (result) {
          await pushCollectionNote(result);
          reloadFromStorage(["sgf_collectionNotes"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "collectionNotes", count: 1 } }));
        }
        break;
      }

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
      case "collectionPromise.getByInvoice":
        result = dataService.collectionPromise.getByInvoice(input);
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
      case "collectionPromise.recordPayment": {
        result = dataService.collectionPromise.recordPayment(input);
        if (result) {
          await pushCollectionPromise(result);
          reloadFromStorage(["sgf_collectionPromises"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "collectionPromises", count: 1 } }));
        }
        break;
      }

      // ================================================================
      //  COC
      // ================================================================
      case "coc.list":
        result = dataService.coc.list();
        break;
      case "coc.getById":
        result = dataService.coc.getById(input);
        break;
      case "coc.getByInvoice":
        result = dataService.coc.getByInvoice(input);
        break;
      case "coc.getStats":
        result = dataService.coc.getStats();
        break;
      case "coc.create": {
        result = dataService.coc.create(input);
        if (result) {
          await pushCOC(result);
          reloadFromStorage(["sgf_cocs"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "cocs", count: 1 } }));
        }
        break;
      }
      case "coc.update": {
        const { id: cocid, data: cocdata } = input;
        result = dataService.coc.update({ id: cocid, data: cocdata });
        if (result) {
          await pushCOC(result);
          reloadFromStorage(["sgf_cocs"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "cocs", count: 1 } }));
        }
        break;
      }
      case "coc.delete": {
        result = dataService.coc.delete(input);
        if (result?.success) {
          await removeCOC(input);
          reloadFromStorage(["sgf_cocs"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "cocs", count: 0 } }));
        }
        break;
      }
      case "coc.generateForInvoice": {
        result = dataService.coc.generateForInvoice(input);
        if (result?.success) {
          for (const coc of result.cocs || []) {
            await pushCOC(coc);
          }
          reloadFromStorage(["sgf_cocs"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "cocs", count: result.cocs?.length || 0 } }));
        }
        break;
      }

      // ================================================================
      //  CREDIT NOTES (standalone namespace)
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
          await removeCreditNote(input);
          reloadFromStorage(["sgf_creditNotes"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "creditNotes", count: 0 } }));
        }
        break;
      }
      case "creditNote.allocate": {
        result = dataService.creditNote.allocate(input);
        if (result?.success && result.invoice) {
          await pushInvoice(result.invoice);
          if (result.creditNote) await pushCreditNote(result.creditNote);
          reloadFromStorage(["sgf_invoices", "sgf_creditNotes"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: 1 } }));
        }
        break;
      }
      case "creditNote.voidAllocation": {
        result = dataService.creditNote.voidAllocation(input);
        if (result?.success && result.invoice) {
          await pushInvoice(result.invoice);
          if (result.creditNote) await pushCreditNote(result.creditNote);
          reloadFromStorage(["sgf_invoices", "sgf_creditNotes"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: 1 } }));
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
      case "corporateCustomer.getByCustomer":
        result = dataService.corporateCustomer.getByCustomer(input);
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
        const { id: corpid, data: corpData } = input;
        result = dataService.corporateCustomer.update({ id: corpid, data: corpData });
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
      case "purchaseOrder.getStats":
        result = dataService.purchaseOrder.getStats();
        break;
      case "purchaseOrder.search":
        result = dataService.purchaseOrder.search(input || { query: "" });
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
      case "purchaseOrder.approve": {
        result = dataService.purchaseOrder.approve(input);
        if (result) {
          await pushPurchaseOrder(result);
          reloadFromStorage(["sgf_purchaseOrders"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "purchaseOrders", count: 1 } }));
        }
        break;
      }
      case "purchaseOrder.reject": {
        result = dataService.purchaseOrder.reject(input);
        if (result) {
          await pushPurchaseOrder(result);
          reloadFromStorage(["sgf_purchaseOrders"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "purchaseOrders", count: 1 } }));
        }
        break;
      }
      case "purchaseOrder.markReceived": {
        result = dataService.purchaseOrder.markReceived(input);
        if (result) {
          await pushPurchaseOrder(result);
          reloadFromStorage(["sgf_purchaseOrders"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "purchaseOrders", count: 1 } }));
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
      case "barrel.getByProduct":
        result = dataService.barrel.getByProduct(input);
        break;
      case "barrel.getStats":
        result = dataService.barrel.getStats();
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
      //  PACKING LISTS
      // ================================================================
      case "packingList.list":
        result = dataService.packingList.list();
        break;
      case "packingList.getById":
        result = dataService.packingList.getById(input);
        break;
      case "packingList.getByInvoice":
        result = dataService.packingList.getByInvoice(input);
        break;
      case "packingList.getStats":
        result = dataService.packingList.getStats();
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
      case "packingList.deleteLine": {
        result = dataService.packingList.deleteLine(input);
        if (result?.success) {
          await removePackingListLine(input);
          reloadFromStorage(["sgf_packingLists"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "packingLists", count: 0 } }));
        }
        break;
      }
      case "packingList.delete": {
        result = dataService.packingList.delete(input);
        if (result?.success) {
          await pushPackingList({ id: input, deleted: true });
          reloadFromStorage(["sgf_packingLists"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "packingLists", count: 0 } }));
        }
        break;
      }

      // ================================================================
      //  AUDIT / REPORTS
      // ================================================================
      case "audit.list":
        result = dataService.audit.list();
        break;
      case "audit.getByEntity":
        result = dataService.audit.getByEntity(input);
        break;
      case "audit.getByDate":
        result = dataService.audit.getByDate(input);
        break;
      case "audit.getByUser":
        result = dataService.audit.getByUser(input);
        break;
      case "audit.search":
        result = dataService.audit.search(input || { query: "" });
        break;
      case "audit.getStats":
        result = dataService.audit.getStats();
        break;
      case "audit.log": {
        result = dataService.audit.log(input);
        if (result) {
          await pushAudit(result);
          reloadFromStorage(["sgf_audit"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "audit", count: 1 } }));
        }
        break;
      }

      // ================================================================
      //  SYSTEM LOG
      // ================================================================
      case "systemLog.create": {
        result = dataService.systemLog.create(input);
        if (result) {
          await pushSystemLog(result);
          reloadFromStorage(["sgf_systemLogs"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "systemLogs", count: 1 } }));
        }
        break;
      }
      case "systemLog.list":
        result = dataService.systemLog.list();
        break;
      case "systemLog.getByLevel":
        result = dataService.systemLog.getByLevel(input);
        break;
      case "systemLog.getByUser":
        result = dataService.systemLog.getByUser(input);
        break;
      case "systemLog.search":
        result = dataService.systemLog.search(input || { query: "" });
        break;
      case "systemLog.getStats":
        result = dataService.systemLog.getStats();
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

      // ================================================================
      //  COLLECTIONS (overdue/follow-up)
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
      case "collections.getFollowUpsDue":
        result = dataService.collections.getFollowUpsDue();
        break;
      case "collections.getWeeklyReport":
        result = dataService.collections.getWeeklyReport();
        break;
      case "collections.getMonthlyReport":
        result = dataService.collections.getMonthlyReport();
        break;
      case "collections.getCustomerAging":
        result = dataService.collections.getCustomerAging();
        break;
      case "collections.getCustomerBalanceReport":
        result = dataService.collections.getCustomerBalanceReport();
        break;
      case "collections.recordFollowUp": {
        result = dataService.collections.recordFollowUp(input);
        if (result && result.success) {
          if (result.invoice) await pushInvoice(result.invoice);
          if (result.collectionNote) await pushCollectionNote(result.collectionNote);
          reloadFromStorage(["sgf_invoices", "sgf_collectionNotes"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: 1 } }));
        }
        break;
      }
      case "collections.recordPromise": {
        result = dataService.collections.recordPromise(input);
        if (result && result.success) {
          if (result.invoice) await pushInvoice(result.invoice);
          if (result.promise) await pushCollectionPromise(result.promise);
          reloadFromStorage(["sgf_invoices", "sgf_collectionPromises"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: 1 } }));
        }
        break;
      }
      case "collections.recordCollectionVisit": {
        result = dataService.collections.recordCollectionVisit(input);
        if (result && result.success) {
          if (result.invoice) await pushInvoice(result.invoice);
          if (result.note) await pushCollectionNote(result.note);
          reloadFromStorage(["sgf_invoices", "sgf_collectionNotes"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: 1 } }));
        }
        break;
      }
      case "collections.allocatePayment": {
        result = dataService.collections.allocatePayment(input);
        if (result && result.success) {
          for (const inv of result.updatedInvoices || []) await pushInvoice(inv);
          reloadFromStorage(["sgf_invoices"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: result.updatedInvoices?.length || 0 } }));
        }
        break;
      }
      case "collections.getCustomerStatement":
        result = dataService.collections.getCustomerStatement(input);
        break;

      // ================================================================
      //  GENERIC
      // ================================================================
      case "utils.ping":
        result = { pong: true, ts: Date.now() };
        break;
      case "utils.healthCheck":
        result = dataService.healthCheck();
        break;

      // ================================================================
      //  DASHBOARD / ANALYTICS
      // ================================================================
      case "dashboard.getSummary":
        result = dataService.dashboard.getSummary();
        break;
      case "dashboard.getStats":
        result = dataService.dashboard.getStats();
        break;
      case "dashboard.getRecentActivity":
        result = dataService.dashboard.getRecentActivity();
        break;
      case "dashboard.getRevenueChart":
        result = dataService.dashboard.getRevenueChart(input || { period: "monthly" });
        break;
      case "dashboard.getProductSales":
        result = dataService.dashboard.getProductSales(input || { limit: 10 });
        break;
      case "dashboard.getCustomerSales":
        result = dataService.dashboard.getCustomerSales(input || { limit: 10 });
        break;
      case "dashboard.getRepPerformance":
        result = dataService.dashboard.getRepPerformance(input || { period: "monthly" });
        break;
      case "dashboard.getSalesFunnel":
        result = dataService.dashboard.getSalesFunnel();
        break;
      case "dashboard.getCollectionMetrics":
        result = dataService.dashboard.getCollectionMetrics();
        break;
      case "dashboard.getAgingAnalysis":
        result = dataService.dashboard.getAgingAnalysis();
        break;
      case "dashboard.getDeliveryPerformance":
        result = dataService.dashboard.getDeliveryPerformance();
        break;
      case "dashboard.getOrderFulfillment":
        result = dataService.dashboard.getOrderFulfillment();
        break;
      case "dashboard.getInventoryAlert":
        result = dataService.dashboard.getInventoryAlert();
        break;
      case "dashboard.getWeeklyComparison":
        result = dataService.dashboard.getWeeklyComparison();
        break;
      case "dashboard.getMonthlyTarget":
        result = dataService.dashboard.getMonthlyTarget(input);
        break;

      // ================================================================
      //  REPORTS
      // ================================================================
      case "report.getInvoiceReport":
        result = dataService.report.getInvoiceReport(input || { period: "monthly" });
        break;
      case "report.getPaymentReport":
        result = dataService.report.getPaymentReport(input || { period: "monthly" });
        break;
      case "report.getSalesReport":
        result = dataService.report.getSalesReport(input || { period: "monthly" });
        break;
      case "report.getProductReport":
        result = dataService.report.getProductReport(input || { period: "monthly" });
        break;
      case "report.getCustomerReport":
        result = dataService.report.getCustomerReport(input || { period: "monthly" });
        break;
      case "report.getRepReport":
        result = dataService.report.getRepReport(input || { period: "monthly" });
        break;
      case "report.getCollectionReport":
        result = dataService.report.getCollectionReport(input || { period: "monthly" });
        break;
      case "report.getDeliveryReport":
        result = dataService.report.getDeliveryReport(input || { period: "monthly" });
        break;
      case "report.getAgingReport":
        result = dataService.report.getAgingReport();
        break;
      case "report.getStockMovement":
        result = dataService.report.getStockMovement(input || { period: "monthly" });
        break;
      case "report.getProfitabilityReport":
        result = dataService.report.getProfitabilityReport(input || { period: "monthly" });
        break;

      // ================================================================
      //  EXTRAS (loaded after dataService)
      // ================================================================
      default: {
        // Try to delegate to dataService extras
        if (DATA_SERVICE_EXTRAS_LOADED) {
          result = await dataServiceExtrasHandler(path, input);
        }
        break;
      }
    }

    return { result };
  } catch (error: any) {
    console.error("[localLink] error:", error);
    return { error: { message: error?.message || String(error) } };
  }
}

// ------------------------------------------------------------------
//  Extras handler
// ------------------------------------------------------------------
async function dataServiceExtrasHandler(path: string, input: any): Promise<any> {
  let result: any;

  switch (path) {
    // ================================================================
    //  STOCK EXTRAS
    // ================================================================
    case "stock.getDailyInvoicedStock":
      result = dataService.stock.getDailyInvoicedStock(input);
      break;
    case "stock.reconcileStock":
      result = dataService.stock.reconcileStock(input);
      break;

    // ================================================================
    //  CUSTOMER EXTRAS
    // ================================================================
    case "customer.getCustomersNeedingFollowUp":
      result = dataService.customer.getCustomersNeedingFollowUp(input?.days || 10);
      break;

    // ================================================================
    //  INVOICE EXTRAS
    // ================================================================
    case "invoice.getCreditNotes":
      result = dataService.invoice.getCreditNotes();
      break;
    case "invoice.getReceipts":
      result = dataService.invoice.getReceipts();
      break;
    case "invoice.allocateBankPayments":
      result = dataService.invoice.allocateBankPayments(input);
      break;
    case "invoice.fixDraftInvoices":
      result = dataService.invoice.fixDraftInvoices();
      break;
    case "invoice.fixSageDates":
      result = dataService.invoice.fixSageDates();
      break;
    case "invoice.matchBankPayments":
      result = dataService.invoice.matchBankPayments(input);
      break;
    case "invoice.parseBankStatement":
      result = dataService.invoice.parseBankStatement(input);
      break;
    case "invoice.relinkSageInvoices":
      result = dataService.invoice.relinkSageInvoices();
      break;
    case "invoice.generateForPO":
      result = dataService.generateInvoiceForPO(input);
      break;

    // ================================================================
    //  DASHBOARD EXTRAS
    // ================================================================
    case "dashboard.getSummary":
      result = dataService.dashboard.getSummary();
      break;
    case "dashboard.getStats":
      result = dataService.dashboard.getStats();
      break;
    case "dashboard.getRecentActivity":
      result = dataService.dashboard.getRecentActivity();
      break;
    case "dashboard.getRevenueChart":
      result = dataService.dashboard.getRevenueChart(input || { period: "monthly" });
      break;
    case "dashboard.getProductSales":
      result = dataService.dashboard.getProductSales(input || { limit: 10 });
      break;
    case "dashboard.getCustomerSales":
      result = dataService.dashboard.getCustomerSales(input || { limit: 10 });
      break;
    case "dashboard.getRepPerformance":
      result = dataService.dashboard.getRepPerformance(input || { period: "monthly" });
      break;
    case "dashboard.getSalesFunnel":
      result = dataService.dashboard.getSalesFunnel();
      break;
    case "dashboard.getCollectionMetrics":
      result = dataService.dashboard.getCollectionMetrics();
      break;
    case "dashboard.getAgingAnalysis":
      result = dataService.dashboard.getAgingAnalysis();
      break;
    case "dashboard.getDeliveryPerformance":
      result = dataService.dashboard.getDeliveryPerformance();
      break;
    case "dashboard.getOrderFulfillment":
      result = dataService.dashboard.getOrderFulfillment();
      break;
    case "dashboard.getInventoryAlert":
      result = dataService.dashboard.getInventoryAlert();
      break;
    case "dashboard.getWeeklyComparison":
      result = dataService.dashboard.getWeeklyComparison();
      break;
    case "dashboard.getMonthlyTarget":
      result = dataService.dashboard.getMonthlyTarget(input);
      break;

    // ================================================================
    //  REPORT EXTRAS
    // ================================================================
    case "report.getInvoiceReport":
      result = dataService.report.getInvoiceReport(input || { period: "monthly" });
      break;
    case "report.getPaymentReport":
      result = dataService.report.getPaymentReport(input || { period: "monthly" });
      break;
    case "report.getSalesReport":
      result = dataService.report.getSalesReport(input || { period: "monthly" });
      break;
    case "report.getProductReport":
      result = dataService.report.getProductReport(input || { period: "monthly" });
      break;
    case "report.getCustomerReport":
      result = dataService.report.getCustomerReport(input || { period: "monthly" });
      break;
    case "report.getRepReport":
      result = dataService.report.getRepReport(input || { period: "monthly" });
      break;
    case "report.getCollectionReport":
      result = dataService.report.getCollectionReport(input || { period: "monthly" });
      break;
    case "report.getDeliveryReport":
      result = dataService.report.getDeliveryReport(input || { period: "monthly" });
      break;
    case "report.getAgingReport":
      result = dataService.report.getAgingReport();
      break;
    case "report.getStockMovement":
      result = dataService.report.getStockMovement(input || { period: "monthly" });
      break;
    case "report.getProfitabilityReport":
      result = dataService.report.getProfitabilityReport(input || { period: "monthly" });
      break;

    // ================================================================
    //  COLLECTIONS EXTRAS
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
    case "collections.getFollowUpsDue":
      result = dataService.collections.getFollowUpsDue();
      break;
    case "collections.getWeeklyReport":
      result = dataService.collections.getWeeklyReport();
      break;
    case "collections.getMonthlyReport":
      result = dataService.collections.getMonthlyReport();
      break;
    case "collections.getCustomerAging":
      result = dataService.collections.getCustomerAging();
      break;
    case "collections.getCustomerBalanceReport":
      result = dataService.collections.getCustomerBalanceReport();
      break;
    case "collections.recordFollowUp":
      result = dataService.collections.recordFollowUp(input);
      break;
    case "collections.recordPromise":
      result = dataService.collections.recordPromise(input);
      break;
    case "collections.recordCollectionVisit":
      result = dataService.collections.recordCollectionVisit(input);
      break;
    case "collections.allocatePayment":
      result = dataService.collections.allocatePayment(input);
      break;
    case "collections.getCustomerStatement":
      result = dataService.collections.getCustomerStatement(input);
      break;

    default:
      result = null;
      break;
  }

  return result;
}

// ------------------------------------------------------------------
//  Subscription helpers
// ------------------------------------------------------------------
export function localLinkSubscribe(path: string, input: any, callback: (data: any) => void) {
  return observable<any>((emit) => {
    const interval = setInterval(async () => {
      try {
        const response = await localLinkHandler(path, input);
        if (response?.result) {
          emit.next(response.result);
        }
      } catch (error) {
        console.error("[localLink] subscription error:", error);
      }
    }, 30000);

    return () => clearInterval(interval);
  }).subscribe(callback);
}

export function localLinkUnsubscribe(subscription: any) {
  if (subscription && typeof subscription.unsubscribe === "function") {
    subscription.unsubscribe();
  }
}
