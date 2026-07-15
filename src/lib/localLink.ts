import { dataService, reloadFromStorage } from "./dataService";
import { observable } from "@trpc/server/observable";
import { pushOrder, pushAppointment, pushCheckin, pushInvoice, pushInvoices, pushCustomers, pushStock, pushFollowUpAction, pushFollowUp, pushReceipts, pushUser, pushUserDelete, pushAppointmentDelete, pushCheckinDelete, isFirebaseReady, readFromFirebase, mergeWithCloudData } from "./firebaseSync";

/** CLOUD FIRST: Read latest data from Firebase, merge with local, reload dataService.
 *  Every query handler calls this to ensure users see LIVE cloud data. */
async function syncFromCloud(type: string, storageKey: string): Promise<void> {
  if (!isFirebaseReady()) return;
  try {
    const cloudData = await readFromFirebase(type);
    if (cloudData.length > 0) {
      mergeWithCloudData(storageKey, cloudData);
      reloadFromStorage();
    }
  } catch (e) { /* ignore — fall back to local data */ }
}

/** Push data to Firebase after local write. All pushes are awaited with error logging. */
async function fbPush(type: "order" | "appointment" | "checkin" | "invoice" | "customer" | "user" | "userDeleted", item: any) {
  if (!isFirebaseReady()) return;
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
        const customers = dataService.customer.list();
        await pushCustomers(customers);
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
              // STOCK — cloud first
              case "stock.list": await syncFromCloud("stock", "sgf_products"); result = dataService.stock.list(); break;
              case "stock.search": await syncFromCloud("stock", "sgf_products"); result = dataService.stock.search(input || { query: "" }); break;
              case "stock.getById": await syncFromCloud("stock", "sgf_products"); result = dataService.stock.getById(input); break;
              case "stock.getCategories": result = dataService.stock.getCategories(); break;
              case "stock.getStats": await syncFromCloud("stock", "sgf_products"); result = dataService.stock.getStats(); break;
              case "stock.getDailyInvoicedStock": result = dataService.stock.getDailyInvoicedStock(input || {}); break;
              case "stock.create": result = dataService.stock.create(input); pushStock(dataService.stock.list()); break;
              case "stock.update": { const { id, ...data } = input; result = dataService.stock.update({ id, data }); pushStock(dataService.stock.list()); break; }
              case "stock.delete": result = dataService.stock.delete(input); pushStock(dataService.stock.list()); break;
              case "stock.bulkUpload": { const items = input || []; const { created, updated } = dataService.stock.bulkCreate(items); result = { count: created + updated, created, updated }; pushStock(dataService.stock.list()); break; }
              // CUSTOMERS — cloud first
              case "customer.list": await syncFromCloud("customers", "sgf_customers"); result = dataService.customer.list(); break;
              case "customer.search": await syncFromCloud("customers", "sgf_customers"); result = dataService.customer.search(input || { query: "" }); break;
              case "customer.getById": await syncFromCloud("customers", "sgf_customers"); result = dataService.customer.getById(input); break;
              case "customer.create": result = dataService.customer.create(input); await fbPush("customer", result); break;
              case "customer.update": { const { id, ...data } = input; result = dataService.customer.update({ id, data }); await fbPush("customer", result); await pushCustomers(dataService.customer.list()); break; }
              case "customer.delete": result = dataService.customer.delete(input); await pushCustomers(dataService.customer.list()); break;
              case "customer.getStats": await syncFromCloud("customers", "sgf_customers"); result = dataService.customer.getStats(); break;
              case "customer.getSalesReps": result = dataService.customer.getSalesReps(); break;
              case "customer.bulkUpload": result = dataService.customer.bulkUpload(input || []); break;
              case "customer.getCustomersNeedingFollowUp": await syncFromCloud("customers", "sgf_customers"); result = dataService.customer.getCustomersNeedingFollowUp(input?.days || 10); break;
              // ORDERS — cloud first
              case "order.list": await syncFromCloud("orders", "sgf_orders"); result = dataService.order.list(); break;
              case "order.getById": await syncFromCloud("orders", "sgf_orders"); result = dataService.order.getById(input); break;
              case "order.create": result = dataService.order.create(input); await fbPush("order", result); if (input?.orderType === "sample") { window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "followUpActions", count: 1 } })); } break;
              case "order.update": { const { id, ...data } = input; result = dataService.order.update({ id, data }); await fbPush("order", result); if (data?.orderType === "sample") { window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "followUpActions", count: 1 } })); } break; }
              case "order.updateStatus": result = dataService.order.updateStatus(input); await fbPush("order", result); break;
              case "order.generateInvoice": result = dataService.generateInvoiceForOrder(input?.orderId); break;
              case "order.getStats": await syncFromCloud("orders", "sgf_orders"); result = dataService.order.getStats(); break;
              case "order.checkExistingSample": result = dataService.order.checkExistingSample(input); break;
              case "order.generateMissingInvoices": result = dataService.generateMissingInvoices(); for (const inv of dataService.invoice.list()) { await pushInvoice(inv); } break;
              // INVOICES — cloud first
              case "invoice.list": await syncFromCloud("invoices", "sgf_invoices"); result = dataService.invoice.list(); break;
              case "invoice.getById": await syncFromCloud("invoices", "sgf_invoices"); result = dataService.invoice.getById(input); break;
              case "invoice.create": result = dataService.invoice.create(input); await fbPush("invoice", result); break;
              case "invoice.updateStatus": result = dataService.invoice.updateStatus(input); await fbPush("invoice", result); break;
              case "invoice.update": result = dataService.invoice.updateInvoice(input); await fbPush("invoice", result); break;
              case "invoice.recordPayment": result = dataService.invoice.recordPayment(input); if (input?.invoiceId) { const inv = dataService.invoice.list().find((i: any) => i.id == input.invoiceId); if (inv) await pushInvoice(inv); await pushReceipts(dataService.invoice.getReceipts()); } window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: 1 } })); break;
              case "invoice.editPayment": result = dataService.invoice.editPayment(input); if (input?.invoiceId) { const inv = dataService.invoice.list().find((i: any) => i.id == input.invoiceId); if (inv) await pushInvoice(inv); await pushReceipts(dataService.invoice.getReceipts()); } window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: 1 } })); break;
              case "invoice.deletePayment": result = dataService.invoice.deletePayment(input); if (input?.invoiceId) { const inv = dataService.invoice.list().find((i: any) => i.id == input.invoiceId); if (inv) await pushInvoice(inv); await pushReceipts(dataService.invoice.getReceipts()); } window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: 1 } })); break;
              case "invoice.getCustomerStatement": await syncFromCloud("invoices", "sgf_invoices"); result = dataService.invoice.getCustomerStatement(input); break;
              case "invoice.getStats": await syncFromCloud("invoices", "sgf_invoices"); result = dataService.invoice.getStats(); break;
              case "invoice.getReceipts": result = dataService.invoice.getReceipts(); break;
              case "invoice.getReceiptsByInvoice": result = dataService.invoice.getReceiptsByInvoice(input); break;
              case "invoice.getReceiptsByCustomer": result = dataService.invoice.getReceiptsByCustomer(input); break;
              case "invoice.getReceiptById": result = dataService.invoice.getReceiptById(input); break;
              case "invoice.bulkHistoricalImport": result = dataService.invoice.bulkHistoricalImport(input); pushInvoices(dataService.invoice.list()); break;
              case "invoice.relinkSageInvoices": {
                result = dataService.invoice.relinkSageInvoices();
                if (result?.changedInvoices && result.changedInvoices.length > 0) {
                  for (const inv of result.changedInvoices) {
                    try { await pushInvoice(inv); } catch (e) { console.warn("[relink] push failed for", inv.invoiceNumber, e); }
                  }
                }
                break;
              }
              case "invoice.getCreditNotes": result = dataService.invoice.getCreditNotes(); break;
              case "invoice.getCreditNotesByInvoice": result = dataService.invoice.getCreditNotesByInvoice(input); break;
              case "invoice.getCreditNotesByCustomer": result = dataService.invoice.getCreditNotesByCustomer(input); break;
              case "invoice.createCreditNote": result = dataService.invoice.createCreditNote(input); if (input?.invoiceId) { const inv = dataService.invoice.list().find((i: any) => i.id == input.invoiceId); if (inv) await pushInvoice(inv); } break;
              case "invoice.voidCreditNote": result = dataService.invoice.voidCreditNote(input); if (input?.invoiceId) { const inv = dataService.invoice.list().find((i: any) => i.id == input.invoiceId); if (inv) await pushInvoice(inv); } break;
              // USERS
              case "user.list": result = dataService.user.list(); break;
              case "user.getById": result = dataService.user.getById(input); break;
              case "user.authenticate": result = dataService.user.authenticate(input); break;
              case "user.create": result = dataService.user.create(input); await fbPush("user", result); break;
              case "user.update": { const { id, ...data } = input; result = dataService.user.update({ id, data }); await fbPush("user", result); break; }
              case "user.delete": result = dataService.user.delete(input); await fbPush("userDeleted", input); break;
              case "user.toggleActive": result = dataService.user.toggleActive(input); await fbPush("user", result); break;
              case "user.resetPin": result = dataService.user.resetPin(input); await fbPush("user", result); break;
              // APPOINTMENTS — cloud first
              case "appointment.list": await syncFromCloud("appointments", "sgf_appointments"); result = dataService.appointment.list(); break;
              case "appointment.create": result = dataService.appointment.create(input); await fbPush("appointment", result); break;
              case "appointment.update": { const { id, data } = input; result = dataService.appointment.update({ id, data }); await fbPush("appointment", result); break; }
              case "appointment.delete": result = dataService.appointment.delete(input); await pushAppointmentDelete(input); break;
              case "appointment.updateStatus": result = dataService.appointment.updateStatus(input); await fbPush("appointment", result); break;
              case "appointment.getStats": await syncFromCloud("appointments", "sgf_appointments"); result = dataService.appointment.getStats(); break;
              // CHECKINS — cloud first
              case "checkIn.list": await syncFromCloud("checkins", "sgf_checkins"); result = dataService.checkin.list(); break;
              case "checkIn.create": result = dataService.checkin.create(input); await fbPush("checkin", result); break;
              case "checkIn.update": { const { id, data } = input; result = dataService.checkin.update({ id, data }); await fbPush("checkin", result); break; }
              case "checkIn.delete": result = dataService.checkin.delete(input); await pushCheckinDelete(input); break;
              case "checkIn.checkout": result = dataService.checkin.checkout(input); await fbPush("checkin", result); break;
              case "checkIn.getStats": await syncFromCloud("checkins", "sgf_checkins"); result = dataService.checkin.getStats(); break;
              // FOLLOW-UPS — cloud first
              case "followUpAction.list": await syncFromCloud("followUpActions", "sgf_followUpActions"); result = dataService.followUpAction.list(); break;
              case "followUpAction.listByCustomer": await syncFromCloud("followUpActions", "sgf_followUpActions"); result = dataService.followUpAction.listByCustomer(input); break;
              case "followUpAction.create": result = dataService.followUpAction.create(input); pushFollowUpAction(result); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "followUpActions", count: 1 } })); break;
              case "followUpAction.getStats": await syncFromCloud("followUpActions", "sgf_followUpActions"); result = dataService.followUpAction.getStats(); break;
              case "specialPrice.listByCustomer": result = dataService.specialPrice.listByCustomer(input); break;
              case "specialPrice.set": result = dataService.specialPrice.set(input); break;
              case "specialPrice.delete": result = dataService.specialPrice.delete(input); break;
              case "salesRep.list": result = dataService.salesRep.list(); break;
              case "salesRep.getStats": result = dataService.salesRep.getStats(); break;
              case "salesRep.getSalesBreakdown": result = dataService.salesRep.getSalesBreakdown(); break;
              // DASHBOARD — cloud first (orders + invoices)
              case "dashboard.stats": await syncFromCloud("orders", "sgf_orders"); await syncFromCloud("invoices", "sgf_invoices"); result = dataService.dashboard.stats(); break;
              case "audit.list": result = dataService.audit.list(); break;
              case "audit.getCustomerDeletions": result = dataService.audit.getCustomerDeletions(); break;
              case "audit.getAddressChanges": result = dataService.audit.getAddressChanges(); break;
              case "followUp.list": await syncFromCloud("followUps", "sgf_followUps"); result = dataService.followUp.list(); break;
              case "followUp.update": result = dataService.followUp.update(input); if (result) { await pushFollowUp(result); window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "followUpActions", count: 1 } })); } break;
              case "followUp.getStats": await syncFromCloud("followUps", "sgf_followUps"); result = dataService.followUp.getStats(); break;
              case "sampleReport.getByCustomer": await syncFromCloud("orders", "sgf_orders"); result = dataService.sampleReport.getByCustomer(input); break;
              case "sampleReport.getAll": await syncFromCloud("orders", "sgf_orders"); result = dataService.sampleReport.getAll(); break;
              // COLLECTIONS — cloud first
              case "collections.getOverdueInvoices": await syncFromCloud("invoices", "sgf_invoices"); result = dataService.collections.getOverdueInvoices(); break;
              case "collections.getDailyReport": await syncFromCloud("invoices", "sgf_invoices"); result = dataService.collections.getDailyReport(); break;
              case "collections.getStats": await syncFromCloud("invoices", "sgf_invoices"); result = dataService.collections.getStats(); break;
              case "collections.getCustomerPaymentHistory": await syncFromCloud("invoices", "sgf_invoices"); result = dataService.collections.getCustomerPaymentHistory(input); break;
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
