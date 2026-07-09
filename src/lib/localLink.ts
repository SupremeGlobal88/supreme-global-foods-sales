import { dataService } from "./dataService";
import { observable } from "@trpc/server/observable";
import { pushOrder, pushAppointment, pushCheckin, pushInvoice, pushInvoices, pushCustomers, pushFollowUpAction, isFirebaseReady } from "./firebaseSync";

/** Push data to Firebase after local write. Static import ensures reliability. */
function fbPush(type: "order" | "appointment" | "checkin" | "invoice" | "customer", item: any) {
  if (!isFirebaseReady()) return;
  try {
    switch (type) {
      case "order": {
        pushOrder(item);
        // Also push the associated invoice so admin sees it
        // Use setTimeout to ensure invoice is fully saved before push
        setTimeout(() => {
          try {
            const invoices = dataService.invoice.list();
            const inv = invoices.find((i: any) => i.orderId == item.id);
            if (inv) pushInvoice(inv);
          } catch { /* ignore */ }
        }, 100);
        break;
      }
      case "appointment": pushAppointment(item); break;
      case "checkin": pushCheckin(item); break;
      case "invoice": pushInvoice(item); break;
      case "customer": {
        const customers = dataService.customer.list();
        pushCustomers(customers);
        break;
      }
    }
  } catch { /* Firebase not configured, ignore */ }
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
              case "stock.list": result = dataService.stock.list(); break;
              case "stock.search": result = dataService.stock.search(input || { query: "" }); break;
              case "stock.getById": result = dataService.stock.getById(input); break;
              case "stock.getCategories": result = dataService.stock.getCategories(); break;
              case "stock.getStats": result = dataService.stock.getStats(); break;
              case "stock.getDailyInvoicedStock": result = dataService.stock.getDailyInvoicedStock(input || {}); break;
              case "stock.create": result = dataService.stock.create(input); break;
              case "stock.update": { const { id, ...data } = input; result = dataService.stock.update({ id, data }); break; }
              case "stock.delete": result = dataService.stock.delete(input); break;
              case "stock.bulkUpload": { const items = input || []; const { created, updated } = dataService.stock.bulkCreate(items); result = { count: created + updated, created, updated }; break; }
              case "customer.list": result = dataService.customer.list(); break;
              case "customer.search": result = dataService.customer.search(input || { query: "" }); break;
              case "customer.getById": result = dataService.customer.getById(input); break;
              case "customer.create": result = dataService.customer.create(input); fbPush("customer", result); break;
              case "customer.update": { const { id, ...data } = input; result = dataService.customer.update({ id, data }); fbPush("customer", result); pushCustomers(dataService.customer.list()); break; }
              case "customer.delete": result = dataService.customer.delete(input); pushCustomers(dataService.customer.list()); break;
              case "customer.getStats": result = dataService.customer.getStats(); break;
              case "customer.getSalesReps": result = dataService.customer.getSalesReps(); break;
              case "customer.bulkUpload": result = dataService.customer.bulkUpload(input || []); break;
              case "customer.getCustomersNeedingFollowUp": result = dataService.customer.getCustomersNeedingFollowUp(input?.days || 10); break;
              case "order.list": result = dataService.order.list(); break;
              case "order.getById": result = dataService.order.getById(input); break;
              case "order.create": result = dataService.order.create(input); fbPush("order", result); { const inv = dataService.invoice.list().find((i: any) => i.orderId == result.id); if (inv) pushInvoice(inv); } break;
              case "order.update": { const { id, ...data } = input; result = dataService.order.update({ id, data }); fbPush("order", result); break; }
              case "order.updateStatus": result = dataService.order.updateStatus(input); fbPush("order", result); { const inv = dataService.invoice.list().find((i: any) => i.orderId == result.id); if (inv) pushInvoice(inv); } break;
              case "order.generateInvoice": result = dataService.generateInvoiceForOrder(input?.orderId); break;
              case "order.getStats": result = dataService.order.getStats(); break;
              case "order.checkExistingSample": result = dataService.order.checkExistingSample(input); break;
              case "order.generateMissingInvoices": result = dataService.generateMissingInvoices(); for (const inv of dataService.invoice.list()) { pushInvoice(inv); } break;
              case "invoice.list": result = dataService.invoice.list(); break;
              case "invoice.getById": result = dataService.invoice.getById(input); break;
              case "invoice.create": result = dataService.invoice.create(input); fbPush("invoice", result); break;
              case "invoice.updateStatus": result = dataService.invoice.updateStatus(input); fbPush("invoice", result); break;
              case "invoice.update": result = dataService.invoice.updateInvoice(input); fbPush("invoice", result); break;
              case "invoice.recordPayment": result = dataService.invoice.recordPayment(input); break;
              case "invoice.editPayment": result = dataService.invoice.editPayment(input); break;
              case "invoice.deletePayment": result = dataService.invoice.deletePayment(input); break;
              case "invoice.getCustomerStatement": result = dataService.invoice.getCustomerStatement(input); break;
              case "invoice.getStats": result = dataService.invoice.getStats(); break;
              case "invoice.getReceipts": result = dataService.invoice.getReceipts(); break;
              case "invoice.getReceiptsByInvoice": result = dataService.invoice.getReceiptsByInvoice(input); break;
              case "invoice.getReceiptsByCustomer": result = dataService.invoice.getReceiptsByCustomer(input); break;
              case "invoice.getReceiptById": result = dataService.invoice.getReceiptById(input); break;
              case "invoice.bulkHistoricalImport": result = dataService.invoice.bulkHistoricalImport(input); pushInvoices(dataService.invoice.list()); break;
              case "invoice.getCreditNotes": result = dataService.invoice.getCreditNotes(); break;
              case "invoice.getCreditNotesByInvoice": result = dataService.invoice.getCreditNotesByInvoice(input); break;
              case "invoice.getCreditNotesByCustomer": result = dataService.invoice.getCreditNotesByCustomer(input); break;
              case "invoice.createCreditNote": result = dataService.invoice.createCreditNote(input); break;
              case "invoice.voidCreditNote": result = dataService.invoice.voidCreditNote(input); break;
              case "user.list": result = dataService.user.list(); break;
              case "user.getById": result = dataService.user.getById(input); break;
              case "user.authenticate": result = dataService.user.authenticate(input); break;
              case "user.create": result = dataService.user.create(input); break;
              case "user.update": { const { id, ...data } = input; result = dataService.user.update({ id, data }); break; }
              case "user.delete": result = dataService.user.delete(input); break;
              case "user.toggleActive": result = dataService.user.toggleActive(input); break;
              case "user.resetPin": result = dataService.user.resetPin(input); break;
              case "appointment.list": result = dataService.appointment.list(); break;
              case "appointment.create": result = dataService.appointment.create(input); fbPush("appointment", result); break;
              case "appointment.updateStatus": result = dataService.appointment.updateStatus(input); fbPush("appointment", result); break;
              case "appointment.getStats": result = dataService.appointment.getStats(); break;
              case "checkIn.list": result = dataService.checkin.list(); break;
              case "checkIn.create": result = dataService.checkin.create(input); fbPush("checkin", result); break;
              case "checkIn.checkout": result = dataService.checkin.checkout(input); fbPush("checkin", result); break;
              case "checkIn.getStats": result = dataService.checkin.getStats(); break;
      case "followUpAction.list": result = dataService.followUpAction.list(); break;
      case "followUpAction.listByCustomer": result = dataService.followUpAction.listByCustomer(input); break;
      case "followUpAction.create": result = dataService.followUpAction.create(input); fbPush("followUpAction", result); break;
      case "followUpAction.getStats": result = dataService.followUpAction.getStats(); break;
              case "specialPrice.listByCustomer": result = dataService.specialPrice.listByCustomer(input); break;
              case "specialPrice.set": result = dataService.specialPrice.set(input); break;
              case "specialPrice.delete": result = dataService.specialPrice.delete(input); break;
              case "salesRep.list": result = dataService.salesRep.list(); break;
              case "salesRep.getStats": result = dataService.salesRep.getStats(); break;
              case "salesRep.getSalesBreakdown": result = dataService.salesRep.getSalesBreakdown(); break;
              case "dashboard.stats": result = dataService.dashboard.stats(); break;
              case "audit.list": result = dataService.audit.list(); break;
              case "audit.getCustomerDeletions": result = dataService.audit.getCustomerDeletions(); break;
              case "audit.getAddressChanges": result = dataService.audit.getAddressChanges(); break;
              case "followUp.list": result = dataService.followUp.list(); break;
              case "followUp.update": result = dataService.followUp.update(input); break;
              case "followUp.getStats": result = dataService.followUp.getStats(); break;
              case "sampleReport.getByCustomer": result = dataService.sampleReport.getByCustomer(input); break;
              case "sampleReport.getAll": result = dataService.sampleReport.getAll(); break;
              case "collections.getOverdueInvoices": result = dataService.collections.getOverdueInvoices(); break;
              case "collections.getDailyReport": result = dataService.collections.getDailyReport(); break;
              case "collections.getStats": result = dataService.collections.getStats(); break;
              case "collections.getCustomerPaymentHistory": result = dataService.collections.getCustomerPaymentHistory(input); break;
              case "collections.addNote": result = dataService.collections.addNote(input); break;
              case "collections.recordPromise": result = dataService.collections.recordPromise(input); break;
              case "collections.placeHold": result = dataService.collections.placeHold(input); break;
              case "collections.releaseHold": result = dataService.collections.releaseHold(input); break;
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
