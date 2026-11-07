import { dataService, reloadFromStorage, logAudit } from "./dataService";
import {
  pushInvoice,
  removeInvoice,
  pushOrder,
  removeOrder,
  pushCustomer,
  removeCustomer,
  pushProduct,
  removeProduct,
  pushUser,
  removeUser,
  pushAppointment,
  removeAppointment,
  pushCheckIn,
  removeCheckIn,
  pushFollowUp,
  removeFollowUp,
  pushFollowUpAction,
  removeFollowUpAction,
  pushCreditNote,
  removeCreditNote,
  pushPayment,
  removePayment,
  pushReceipt,
  removeReceipt,
  pushSalesRep,
  removeSalesRep,
  pushBarrel,
  removeBarrel,
  pushExpense,
  removeExpense,
  pushCorporateCustomer,
  removeCorporateCustomer,
  pushPurchaseOrder,
  removePurchaseOrder,
  pushPackingList,
  removePackingListLine,
  pushCOC,
  removeCOC,
  pushDocumentTemplate,
  removeDocumentTemplate,
  pushPriceBook,
  removePriceBook,
} from "./firebaseSync";

export async function localLink({
  path,
  input,
}: {
  path: string;
  input: any;
}): Promise<any> {
  const [cat, act] = path.split(".");
  let result: any;

  switch (path) {
    // ================================================================
    //  INVOICES
    // ================================================================
    case "invoice.list":
      result = dataService.invoice.list();
      break;
    case "invoice.getById":
      result = dataService.invoice.getById(input);
      break;
    case "invoice.getByNumber":
      result = dataService.invoice.getByNumber(input);
      break;
    case "invoice.search":
      result = dataService.invoice.search(input);
      break;
    case "invoice.getStats":
      result = dataService.invoice.getStats();
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
      const { id: invId, data: invData } = input;
      result = dataService.invoice.update({ id: invId, data: invData });
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
    case "invoice.generateForPO": {
      result = dataService.generateInvoiceForPO(input);
      if (result) {
        await pushInvoice(result);
        reloadFromStorage(["sgf_invoices"]);
        window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: 1 } }));
      }
      break;
    }
    case "invoice.addPayment": {
      result = dataService.invoice.addPayment(input);
      if (result && result.invoice) {
        await pushInvoice(result.invoice);
        if (result.payment) await pushPayment(result.payment);
        reloadFromStorage(["sgf_invoices"]);
        window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: 1 } }));
      }
      break;
    }
    case "invoice.deletePayment": {
      result = dataService.invoice.deletePayment(input);
      if (result && result.invoice) {
        await pushInvoice(result.invoice);
        await removePayment(input.paymentId);
        reloadFromStorage(["sgf_invoices"]);
        window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: 1 } }));
      }
      break;
    }
    case "invoice.addReceipt": {
      result = dataService.invoice.addReceipt(input);
      if (result && result.invoice) {
        await pushInvoice(result.invoice);
        if (result.receipt) await pushReceipt(result.receipt);
        reloadFromStorage(["sgf_invoices"]);
        window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: 1 } }));
      }
      break;
    }
    case "invoice.deleteReceipt": {
      result = dataService.invoice.deleteReceipt(input);
      if (result && result.invoice) {
        await pushInvoice(result.invoice);
        await removeReceipt(input.receiptId);
        reloadFromStorage(["sgf_invoices"]);
        window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: 1 } }));
      }
      break;
    }
    case "invoice.allocateCredit": {
      result = dataService.invoice.allocateCredit(input);
      if (result && result.invoice) {
        await pushInvoice(result.invoice);
        reloadFromStorage(["sgf_invoices"]);
        window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: 1 } }));
      }
      break;
    }
    case "invoice.voidCreditNoteAllocation": {
      result = dataService.invoice.voidCreditNoteAllocation(input);
      if (result && result.invoice) {
        await pushInvoice(result.invoice);
        reloadFromStorage(["sgf_invoices"]);
        window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: 1 } }));
      }
      break;
    }
    case "invoice.removeOverpaymentAllocation": {
      result = dataService.invoice.removeOverpaymentAllocation(input);
      if (result && result.invoice) {
        await pushInvoice(result.invoice);
        reloadFromStorage(["sgf_invoices"]);
        window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: 1 } }));
      }
      break;
    }
    case "invoice.applyOverpaymentCredit": {
      result = dataService.invoice.applyOverpaymentCredit(input);
      if (result && result.invoice) {
        await pushInvoice(result.invoice);
        reloadFromStorage(["sgf_invoices"]);
        window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: 1 } }));
      }
      break;
    }
    case "invoice.repairCancelled": {
      result = dataService.invoice.repairCancelledInvoiceBalances();
      if (result && result.repaired > 0) {
        for (const inv of result.invoices) {
          await pushInvoice(inv);
        }
        reloadFromStorage(["sgf_invoices"]);
        window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: result.repaired } }));
      }
      break;
    }

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
      const { id: orderId, data: orderData } = input;
      result = dataService.order.update({ id: orderId, data: orderData });
      if (result) {
        await pushOrder(result);
        reloadFromStorage(["sgf_orders"]);
        window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "orders", count: 1 } }));
      }
      break;
    }
    case "order.delete": {
      result = dataService.order.delete(input);
      if (result?.success) {
        await removeOrder(input);
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
    case "order.findByNumber":
      result = dataService.order.findByNumber(input);
      break;

    // ================================================================
    //  CUSTOMERS
    // ================================================================
    case "customer.list":
      result = dataService.customer.list();
      break;
    case "customer.search":
      result = dataService.customer.search(input);
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
      const { id: custId, data: custData } = input;
      result = dataService.customer.update({ id: custId, data: custData });
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
        await removeCustomer(input);
        reloadFromStorage(["sgf_customers"]);
        window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "customers", count: 0 } }));
      }
      break;
    }
    case "customer.bulkUpload": {
      result = dataService.customer.bulkUpload(input);
      if (result?.success) {
        for (const c of result.created) await pushCustomer(c);
        reloadFromStorage(["sgf_customers"]);
        window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "customers", count: result.created.length } }));
      }
      break;
    }

    // ================================================================
    //  PRODUCTS / STOCK
    // ================================================================
    case "stock.list":
      result = dataService.stock.list();
      break;
    case "stock.search":
      result = dataService.stock.search(input);
      break;
    case "stock.getStats":
      result = dataService.stock.getStats();
      break;
    case "stock.getById":
      result = dataService.stock.getById(input);
      break;
    case "stock.create": {
      result = dataService.stock.create(input);
      if (result) {
        await pushProduct(result);
        reloadFromStorage(["sgf_products"]);
        window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "products", count: 1 } }));
      }
      break;
    }
    case "stock.update": {
      const { id: prodId, data: prodData } = input;
      result = dataService.stock.update({ id: prodId, data: prodData });
      if (result) {
        await pushProduct(result);
        reloadFromStorage(["sgf_products"]);
        window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "products", count: 1 } }));
      }
      break;
    }
    case "stock.delete": {
      result = dataService.stock.delete(input);
      if (result?.success) {
        await removeProduct(input);
        reloadFromStorage(["sgf_products"]);
        window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "products", count: 0 } }));
      }
      break;
    }
    case "stock.bulkUpload": {
      result = dataService.stock.bulkUpload(input);
      if (result) {
        for (const p of result.created) await pushProduct(p);
        for (const p of result.updated) await pushProduct(p);
        reloadFromStorage(["sgf_products"]);
        window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "products", count: (result.created?.length || 0) + (result.updated?.length || 0) } }));
      }
      break;
    }

    // ================================================================
    //  USERS
    // ================================================================
    case "user.list":
      result = dataService.user.list();
      break;
    case "user.getById":
      result = dataService.user.getById(input);
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
      const { id: userId, data: userData } = input;
      result = dataService.user.update({ id: userId, data: userData });
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
        await removeUser(input);
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
    //  APPOINTMENTS
    // ================================================================
    case "appointment.list":
      result = dataService.appointment.list();
      break;
    case "appointment.getById":
      result = dataService.appointment.getById(input);
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
      const { id: apptId, data: apptData } = input;
      result = dataService.appointment.update({ id: apptId, data: apptData });
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
        await removeAppointment(input);
        reloadFromStorage(["sgf_appointments"]);
        window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "appointments", count: 0 } }));
      }
      break;
    }

    // ================================================================
    //  CHECK-INS
    // ================================================================
    case "checkIn.list":
      result = dataService.checkIn.list();
      break;
    case "checkIn.getById":
      result = dataService.checkIn.getById(input);
      break;
    case "checkIn.create": {
      result = dataService.checkIn.create(input);
      if (result) {
        await pushCheckIn(result);
        reloadFromStorage(["sgf_checkIns"]);
        window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "checkIns", count: 1 } }));
      }
      break;
    }
    case "checkIn.update": {
      const { id: checkInId, data: checkInData } = input;
      result = dataService.checkIn.update({ id: checkInId, data: checkInData });
      if (result) {
        await pushCheckIn(result);
        reloadFromStorage(["sgf_checkIns"]);
        window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "checkIns", count: 1 } }));
      }
      break;
    }
    case "checkIn.delete": {
      result = dataService.checkIn.delete(input);
      if (result?.success) {
        await removeCheckIn(input);
        reloadFromStorage(["sgf_checkIns"]);
        window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "checkIns", count: 0 } }));
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
      const { id: fuId, data: fuData } = input;
      result = dataService.followUp.update({ id: fuId, data: fuData });
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
        await removeFollowUp(input);
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
      const { id: fuaId, data: fuaData } = input;
      result = dataService.followUpAction.update({ id: fuaId, data: fuaData });
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
        await removeFollowUpAction(input);
        reloadFromStorage(["sgf_followUpActions"]);
        window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "followUpActions", count: 0 } }));
      }
      break;
    }

    // ================================================================
    //  CREDIT NOTES
    // ================================================================
    case "invoice.getCreditNotes":
      result = dataService.creditNote.list();
      break;
    case "creditNote.list":
      result = dataService.creditNote.list();
      break;
    case "creditNote.getById":
      result = dataService.creditNote.getById(input);
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
      const { id: cnId, data: cnData } = input;
      result = dataService.creditNote.update({ id: cnId, data: cnData });
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
      const { id: srId, data: srData } = input;
      result = dataService.salesRep.update({ id: srId, data: srData });
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
    //  EXPENSES
    // ================================================================
    case "expense.list":
      result = dataService.expense.list();
      break;
    case "expense.getById":
      result = dataService.expense.getById(input);
      break;
    case "expense.create": {
      result = dataService.expense.create(input);
      if (result) {
        await pushExpense(result);
        reloadFromStorage(["sgf_expenses"]);
        window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "expenses", count: 1 } }));
      }
      break;
    }
    case "expense.update": {
      const { id: expId, data: expData } = input;
      result = dataService.expense.update({ id: expId, data: expData });
      if (result) {
        await pushExpense(result);
        reloadFromStorage(["sgf_expenses"]);
        window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "expenses", count: 1 } }));
      }
      break;
    }
    case "expense.delete": {
      result = dataService.expense.delete(input);
      if (result?.success) {
        await removeExpense(input);
        reloadFromStorage(["sgf_expenses"]);
        window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "expenses", count: 0 } }));
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
      const { id: barrelId, data: barrelData } = input;
      result = dataService.barrel.update({ id: barrelId, data: barrelData });
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
    //  DOCUMENT TEMPLATES
    // ================================================================
    case "documentTemplate.list":
      result = dataService.documentTemplate.list();
      break;
    case "documentTemplate.getById":
      result = dataService.documentTemplate.getById(input);
      break;
    case "documentTemplate.create": {
      result = dataService.documentTemplate.create(input);
      if (result) {
        await pushDocumentTemplate(result);
        reloadFromStorage(["sgf_documentTemplates"]);
        window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "documentTemplates", count: 1 } }));
      }
      break;
    }
    case "documentTemplate.update": {
      const { id: dtId, data: dtData } = input;
      result = dataService.documentTemplate.update({ id: dtId, data: dtData });
      if (result) {
        await pushDocumentTemplate(result);
        reloadFromStorage(["sgf_documentTemplates"]);
        window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "documentTemplates", count: 1 } }));
      }
      break;
    }
    case "documentTemplate.delete": {
      result = dataService.documentTemplate.delete(input);
      if (result?.success) {
        await removeDocumentTemplate(input);
        reloadFromStorage(["sgf_documentTemplates"]);
        window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "documentTemplates", count: 0 } }));
      }
      break;
    }

    // ================================================================
    //  PRICE BOOK
    // ================================================================
    case "priceBook.list":
      result = dataService.priceBook.list();
      break;
    case "priceBook.getById":
      result = dataService.priceBook.getById(input);
      break;
    case "priceBook.create": {
      result = dataService.priceBook.create(input);
      if (result) {
        await pushPriceBook(result);
        reloadFromStorage(["sgf_priceBooks"]);
        window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "priceBooks", count: 1 } }));
      }
      break;
    }
    case "priceBook.update": {
      const { id: pbId, data: pbData } = input;
      result = dataService.priceBook.update({ id: pbId, data: pbData });
      if (result) {
        await pushPriceBook(result);
        reloadFromStorage(["sgf_priceBooks"]);
        window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "priceBooks", count: 1 } }));
      }
      break;
    }
    case "priceBook.delete": {
      result = dataService.priceBook.delete(input);
      if (result?.success) {
        await removePriceBook(input);
        reloadFromStorage(["sgf_priceBooks"]);
        window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "priceBooks", count: 0 } }));
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
    case "purchaseOrder.getByNumber":
      result = dataService.purchaseOrder.getByNumber(input);
      break;
    case "purchaseOrder.search":
      result = dataService.purchaseOrder.search(input);
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
    case "purchaseOrder.updateStatus": {
      result = dataService.purchaseOrder.updateStatus(input);
      if (result) {
        await pushPurchaseOrder(result);
        reloadFromStorage(["sgf_purchaseOrders"]);
        window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "purchaseOrders", count: 1 } }));
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
    case "collections.getFollowUpsDue":
      result = dataService.collections.getFollowUpsDue();
      break;

    // ================================================================
    //  REPORTS
    // ================================================================
    case "report.getSalesReport":
      result = dataService.report.getSalesReport(input);
      break;
    case "report.getCustomerReport":
      result = dataService.report.getCustomerReport(input);
      break;
    case "report.getProductReport":
      result = dataService.report.getProductReport(input);
      break;
    case "report.getSalesRepReport":
      result = dataService.report.getSalesRepReport(input);
      break;
    case "report.getCheckInReport":
      result = dataService.report.getCheckInReport(input);
      break;
    case "report.getFollowUpReport":
      result = dataService.report.getFollowUpReport(input);
      break;

    // ================================================================
    //  COC (CERTIFICATES OF COMPLIANCE)
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
    case "coc.bulkGenerateForPO": {
      result = dataService.coc.bulkGenerateForPO(input);
      if (result && Array.isArray(result)) {
        for (const c of result) await pushCOC(c);
        reloadFromStorage(["sgf_certificatesOfCompliance"]);
        window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "certificatesOfCompliance", count: result.length } }));
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
    case "coc.generateForInvoice": {
      result = dataService.coc.generateForInvoice(input);
      if (result && Array.isArray(result)) {
        for (const coc of result) await pushCOC(coc);
        reloadFromStorage(["sgf_certificatesOfCompliance"]);
        window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "certificatesOfCompliance", count: result.length } }));
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
    //  AUTH & SETTINGS
    // ================================================================
    case "auth.login":
      result = dataService.auth.login(input);
      break;
    case "auth.logout":
      result = dataService.auth.logout();
      break;
    case "auth.getMe":
      result = dataService.auth.getMe();
      break;
    case "auth.changePassword":
      result = dataService.auth.changePassword(input);
      break;
    case "settings.get":
      result = dataService.settings.get();
      break;
    case "settings.update":
      result = dataService.settings.update(input);
      break;

    // ================================================================
    //  DIAGNOSTICS
    // ================================================================
    case "diagnostic.checkInvoiceDuplicates":
      result = dataService.diagnostic.checkInvoiceDuplicates();
      break;
    case "diagnostic.repairCreditAllocations":
      result = dataService.diagnostic.repairCreditAllocations();
      break;
    case "diagnostic.getAuditLog":
      result = dataService.diagnostic.getAuditLog(input);
      break;
    case "diagnostic.diagnoseMissingOrders":
      result = dataService.diagnostic.diagnoseMissingOrders(input);
      break;

    // ================================================================
    //  DEFAULT: dynamic dispatch via dataService namespace
    // ================================================================
    default: {
      const svc = (dataService as any)[cat];
      if (svc && typeof svc[act] === "function") {
        result = svc[act](input);
      }
      break;
    }
  }

  return result;
}
