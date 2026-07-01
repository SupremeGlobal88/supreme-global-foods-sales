import { dataService } from "./dataService";
import { observable } from "@trpc/server/observable";
import { pushOrder, pushAppointment, pushCheckin, pushInvoice, pushCustomers, pushFollowUpAction, isFirebaseReady } from "./firebaseSync";

/** Push data to Firebase after local write. Static import ensures reliability. */
function fbPush(type: "order" | "appointment" | "checkin" | "invoice" | "customer", item: any) {
  if (!isFirebaseReady()) return;
  try {
    switch (type) {
      case "order": pushOrder(item); break;
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
              case "stock.create": result = dataService.stock.create(input); break;
              case "stock.update": { const { id, ...data } = input; result = dataService.stock.update({ id, data }); break; }
              case "stock.delete": result = dataService.stock.delete(input); break;
              case "stock.bulkUpload": { const items = input || []; const { created, updated } = dataService.stock.bulkCreate(items); result = { count: created + updated, created, updated }; break; }
              case "customer.list": result = dataService.customer.list(); break;
              case "customer.search": result = dataService.customer.search(input || { query: "" }); break;
              case "customer.getById": result = dataService.customer.getById(input); break;
              case "customer.create": result = dataService.customer.create(input); fbPush("customer", result); break;
              case "customer.update": { const { id, ...data } = input; result = dataService.customer.update({ id, data }); break; }
              case "customer.delete": result = dataService.customer.delete(input); break;
              case "customer.getStats": result = dataService.customer.getStats(); break;
              case "customer.getSalesReps": result = dataService.customer.getSalesReps(); break;
              case "customer.bulkUpload": result = dataService.customer.bulkUpload(input || []); break;
              case "customer.getCustomersNeedingFollowUp": result = dataService.customer.getCustomersNeedingFollowUp(input?.days || 10); break;
              case "order.list": result = dataService.order.list(); break;
              case "order.getById": result = dataService.order.getById(input); break;
              case "order.create": result = dataService.order.create(input); fbPush("order", result); break;
              case "order.update": { const { id, ...data } = input; result = dataService.order.update({ id, data }); fbPush("order", result); break; }
              case "order.updateStatus": result = dataService.order.updateStatus(input); fbPush("order", result); break;
              case "order.getStats": result = dataService.order.getStats(); break;
              case "order.checkExistingSample": result = dataService.order.checkExistingSample(input); break;
              case "invoice.list": result = dataService.invoice.list(); break;
              case "invoice.getById": result = dataService.invoice.getById(input); break;
              case "invoice.create": result = dataService.invoice.create(input); fbPush("invoice", result); break;
              case "invoice.updateStatus": result = dataService.invoice.updateStatus(input); fbPush("invoice", result); break;
              case "invoice.recordPayment": result = dataService.invoice.recordPayment(input); break;
              case "invoice.editPayment": result = dataService.invoice.editPayment(input); break;
              case "invoice.deletePayment": result = dataService.invoice.deletePayment(input); break;
              case "invoice.getCustomerStatement": result = dataService.invoice.getCustomerStatement(input); break;
              case "invoice.getStats": result = dataService.invoice.getStats(); break;
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
