import { dataService } from "./dataService";
import { observable } from "@trpc/server/observable";

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
              case "stock.bulkUpload": { const items = input || []; for (const item of items) dataService.stock.create(item); result = { count: items.length }; break; }
              case "customer.list": result = dataService.customer.list(); break;
              case "customer.search": result = dataService.customer.search(input || { query: "" }); break;
              case "customer.getById": result = dataService.customer.getById(input); break;
              case "customer.create": result = dataService.customer.create(input); break;
              case "customer.update": { const { id, ...data } = input; result = dataService.customer.update({ id, data }); break; }
              case "customer.delete": result = dataService.customer.delete(input); break;
              case "customer.getStats": result = dataService.customer.getStats(); break;
              case "customer.getSalesReps": result = dataService.customer.getSalesReps(); break;
              case "order.list": result = dataService.order.list(); break;
              case "order.getById": result = dataService.order.getById(input); break;
              case "order.create": result = dataService.order.create(input); break;
              case "order.update": { const { id, ...data } = input; result = dataService.order.update({ id, data }); break; }
              case "order.updateStatus": result = dataService.order.updateStatus(input); break;
              case "order.getStats": result = dataService.order.getStats(); break;
              case "order.checkExistingSample": result = dataService.order.checkExistingSample(input); break;
              case "invoice.list": result = dataService.invoice.list(); break;
              case "invoice.getById": result = dataService.invoice.getById(input); break;
              case "invoice.create": result = dataService.invoice.create(input); break;
              case "invoice.updateStatus": result = dataService.invoice.updateStatus(input); break;
              case "invoice.getStats": result = dataService.invoice.getStats(); break;
              case "appointment.list": result = dataService.appointment.list(); break;
              case "appointment.create": result = dataService.appointment.create(input); break;
              case "appointment.updateStatus": result = dataService.appointment.updateStatus(input); break;
              case "appointment.getStats": result = dataService.appointment.getStats(); break;
              case "checkIn.list": result = dataService.checkin.list(); break;
              case "checkIn.create": result = dataService.checkin.create(input); break;
              case "checkIn.checkout": result = dataService.checkin.checkout(input); break;
              case "checkIn.getStats": result = dataService.checkin.getStats(); break;
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
