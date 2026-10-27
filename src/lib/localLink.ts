import type { AppRouter } from "./appRouter";
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import { setupLocalStorage, getLocalData, storeLocalData } from "./dataService";

type RouterInput = inferRouterInputs<AppRouter>;
type RouterOutput = inferRouterOutputs<AppRouter>;

let dataService: any;
let pendingOps: any[] = [];

// ------------------------------------------------------------------
//  Helpers
// ------------------------------------------------------------------
async function resolveDataService() {
  if (!dataService) {
    dataService = await import("./dataService").then((m) => m.dataService || m);
  }
}

function getCompanyConfig() {
  try {
    const stored = localStorage.getItem("sgf_company_config");
    return stored ? JSON.parse(stored) : { name: "Supreme Global Foods", primaryColor: "#D4A843" };
  } catch {
    return { name: "Supreme Global Foods", primaryColor: "#D4A843" };
  }
}

function getDbPath(type: string) {
  const config = getCompanyConfig();
  const prefix = config.name === "Recircle" ? "recircle" : "sgf";
  return `${prefix}_${type}`;
}

function reloadFromStorage(keys?: string[]) {
  if (keys) {
    keys.forEach((k) => {
      const raw = localStorage.getItem(k);
      if (raw) {
        try {
          dataService[k.replace("sgf_", "").replace("recircle_", "")] = JSON.parse(raw);
        } catch { /* ignore */ }
      }
    });
  } else {
    setupLocalStorage();
  }
}

// ------------------------------------------------------------------
//  Firebase helpers (mirror dataService.ts)
// ------------------------------------------------------------------
async function fbPush(type: string, data: any) {
  try {
    const { pushFirebaseData } = await import("./dataService");
    if (pushFirebaseData) {
      await pushFirebaseData(type, data);
    }
  } catch { /* ignore */ }
}

async function pushInvoice(inv: any) {
  await fbPush("invoice", inv);
}

async function pushCustomer(cust: any) {
  await fbPush("customer", cust);
}

async function pushStock(stock: any) {
  await fbPush("stockItem", stock);
}

async function pushOrder(order: any) {
  await fbPush("order", order);
}

async function pushCOC(coc: any) {
  await fbPush("coc", coc);
}

async function removeCOC(id: number) {
  try {
    const { removeFirebaseData } = await import("./dataService");
    if (removeFirebaseData) {
      await removeFirebaseData("coc", id);
    }
  } catch { /* ignore */ }
}

async function pushCreditNote(cn: any) {
  await fbPush("creditNote", cn);
}

async function pushAppointment(appt: any) {
  await fbPush("appointment", appt);
}

async function pushCheckIn(ci: any) {
  await fbPush("checkIn", ci);
}

async function pushFollowUpAction(fua: any) {
  await fbPush("followUpAction", fua);
}

async function pushFollowUp(fu: any) {
  await fbPush("followUp", fu);
}

async function pushSpecialPrice(sp: any) {
  await fbPush("specialPrice", sp);
}

async function pushCollections(col: any) {
  await fbPush("collections", col);
}

async function pushCorporateCustomer(cc: any) {
  await fbPush("corporateCustomer", cc);
}

async function pushPurchaseOrder(po: any) {
  await fbPush("purchaseOrder", po);
}

async function pushBarrel(barrel: any) {
  await fbPush("barrel", barrel);
}

async function pushPackingList(pl: any) {
  await fbPush("packingList", pl);
}

async function pushSalesRep(sr: any) {
  await fbPush("salesRep", sr);
}

async function pushAudit(audit: any) {
  await fbPush("audit", audit);
}

async function pushUser(user: any) {
  await fbPush("user", user);
}

// ------------------------------------------------------------------
//  Cloud sync helpers
// ------------------------------------------------------------------
async function smartSync(fbType: string, localKey: string) {
  try {
    const { syncWithCloud } = await import("./dataService");
    if (syncWithCloud) {
      await syncWithCloud(fbType, localKey);
    }
  } catch { /* ignore */ }
}

// ------------------------------------------------------------------
//  FIX: Invoice activation from PO
// ------------------------------------------------------------------
function fixDraftInvoicesForDeliveredOrders() {
  try {
    const invoices = dataService.invoice.list();
    const orders = dataService.order.list();
    const purchaseOrders = dataService.purchaseOrder?.list?.() || [];
    let fixedInvoices: any[] = [];

    for (const order of orders) {
      if ((order.status || "").toLowerCase() === "delivered" || (order.status || "").toLowerCase() === "fulfilled") {
        const draftInv = invoices.find((i: any) => i.orderId === order.id && i.status === "draft");
        if (draftInv) {
          draftInv.status = "sent";
          draftInv.updatedAt = new Date().toISOString();
          fixedInvoices.push(draftInv);
        }
      }
    }

    for (const po of purchaseOrders) {
      if ((po.status || "").toLowerCase() === "fulfilled" || (po.status || "").toLowerCase() === "delivered") {
        const draftInv = invoices.find((i: any) => i.purchaseOrderId == po.id && i.status === "draft");
        if (draftInv) {
          draftInv.status = "sent";
          draftInv.updatedAt = new Date().toISOString();
          fixedInvoices.push(draftInv);
        }
      }
    }

    return { fixedInvoices };
  } catch (e) {
    return { fixedInvoices: [] };
  }
}

function fixSageInvoiceDates() {
  try {
    const invoices = dataService.invoice.list();
    for (const inv of invoices) {
      if (inv.date && typeof inv.date === "string" && inv.date.includes("T")) {
        const d = new Date(inv.date);
        if (!isNaN(d.getTime())) {
          inv.date = d.toISOString().split("T")[0];
          inv.updatedAt = new Date().toISOString();
        }
      }
    }
    return { success: true };
  } catch (e) {
    return { success: false };
  }
}

// ------------------------------------------------------------------
//  Main handler
// ------------------------------------------------------------------
export async function localLinkHandler(path: string, input: any) {
  await resolveDataService();
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
          reloadFromStorage(["sgf_products"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "products", count: 0 } }));
        }
        break;
      }
      case "stock.bulkUpload": {
        result = dataService.stock.bulkUpload(input);
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
        result = dataService.customer.getCustomersNeedingFollowUp(input);
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
        result = dataService.order.delete(input);
        if (result?.success) {
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
        result = dataService.order.generateInvoice(input);
        if (result) {
          await pushInvoice(result);
          reloadFromStorage(["sgf_invoices"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: 1 } }));
        }
        break;
      }
      case "order.generateMissingInvoices": {
        result = dataService.order.generateMissingInvoices();
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
      case "invoice.list":
        result = dataService.invoice.list();
        break;
      case "invoice.getById":
        result = dataService.invoice.getById(input);
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
        result = dataService.invoice.update(input);
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
      case "invoice.recordPayment": {
        result = dataService.invoice.recordPayment(input);
        if (result) {
          await pushInvoice(result);
          reloadFromStorage(["sgf_invoices"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: 1 } }));
        }
        break;
      }
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
      case "invoice.allocateBankPayments": {
        result = dataService.invoice.allocateBankPayments(input);
        if (result?.success) {
          const invoices = dataService.invoice.list();
          for (const inv of invoices) {
            try { await pushInvoice(inv); } catch { /* ignore */ }
          }
          reloadFromStorage(["sgf_invoices"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: 1 } }));
        }
        break;
      }
      case "invoice.delete": {
        result = dataService.invoice.delete(input);
        if (result?.success) {
          reloadFromStorage(["sgf_invoices"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: 0 } }));
        }
        break;
      }
      case "invoice.getCustomerStatement":
        result = dataService.invoice.getCustomerStatement(input);
        break;
      case "invoice.getReceipts":
        result = dataService.invoice.getReceipts();
        break;
      case "invoice.getReceiptsByInvoice":
        result = dataService.invoice.getReceiptsByInvoice(input);
        break;
      case "invoice.getReceiptsByCustomer":
        result = dataService.invoice.getReceiptsByCustomer(input);
        break;
      case "invoice.getReceiptById":
        result = dataService.invoice.getReceiptById(input);
        break;
      case "invoice.bulkHistoricalImport": {
        result = dataService.invoice.bulkHistoricalImport(input);
        if (result?.success) {
          const invoices = dataService.invoice.list();
          for (const inv of invoices) {
            try { await pushInvoice(inv); } catch { /* ignore */ }
          }
          reloadFromStorage(["sgf_invoices"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: 1 } }));
        }
        break;
      }
      case "invoice.relinkSageInvoices": {
        result = dataService.invoice.relinkSageInvoices();
        if (result?.success) {
          reloadFromStorage(["sgf_invoices"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: 0 } }));
        }
        break;
      }
      case "invoice.getCreditNotes":
        result = dataService.invoice.getCreditNotes();
        break;
      case "invoice.getCreditNotesByInvoice":
        result = dataService.invoice.getCreditNotesByInvoice(input);
        break;
      case "invoice.getCreditNotesByCustomer":
        result = dataService.invoice.getCreditNotesByCustomer(input);
        break;
      case "invoice.createCreditNote": {
        result = dataService.invoice.createCreditNote(input);
        if (result) {
          await pushCreditNote(result);
          reloadFromStorage(["sgf_invoices"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: 1 } }));
        }
        break;
      }
      case "invoice.allocateCredit": {
        result = dataService.invoice.allocateCredit(input);
        if (result) {
          await pushInvoice(result);
          reloadFromStorage(["sgf_invoices"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: 1 } }));
        }
        break;
      }
      case "invoice.voidCreditNoteAllocation": {
        result = dataService.invoice.voidCreditNoteAllocation(input);
        if (result) {
          await pushInvoice(result);
          reloadFromStorage(["sgf_invoices"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: 1 } }));
        }
        break;
      }
      case "invoice.voidCreditNote": {
        result = dataService.invoice.voidCreditNote(input);
        if (result) {
          await pushCreditNote(result);
          reloadFromStorage(["sgf_invoices"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: 1 } }));
        }
        break;
      }
      case "invoice.refundCreditNote": {
        result = dataService.invoice.refundCreditNote(input);
        if (result) {
          await pushCreditNote(result);
          reloadFromStorage(["sgf_invoices"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: 1 } }));
        }
        break;
      }
      case "invoice.applyOverpaymentCredit": {
        result = dataService.invoice.applyOverpaymentCredit(input);
        if (result) {
          await pushInvoice(result);
          reloadFromStorage(["sgf_invoices"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: 1 } }));
        }
        break;
      }
      case "invoice.getCustomerCreditBalance":
        result = dataService.invoice.getCustomerCreditBalance(input);
        break;
      case "invoice.updatePaymentStatus": {
        result = dataService.invoice.updatePaymentStatus(input);
        if (result) {
          await pushInvoice(result);
          reloadFromStorage(["sgf_invoices"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: 1 } }));
        }
        break;
      }
      case "invoice.fixDraftInvoices": {
        result = fixDraftInvoicesForDeliveredOrders();
        if (result) {
          for (const inv of result.fixedInvoices) {
            try { await pushInvoice(inv); } catch { /* ignore */ }
          }
          reloadFromStorage();
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: result.fixedInvoices?.length || 0 } }));
        }
        break;
      }
      case "invoice.fixSageDates": {
        result = fixSageInvoiceDates();
        if (result) {
          reloadFromStorage();
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: 0 } }));
        }
        break;
      }
      case "invoice.bulkUpdate": {
        result = dataService.invoice.bulkUpdate(input);
        if (result?.success) {
          const invoices = dataService.invoice.list();
          for (const inv of invoices) {
            try { await pushInvoice(inv); } catch { /* ignore */ }
          }
          reloadFromStorage(["sgf_invoices"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: 1 } }));
        }
        break;
      }
      case "invoice.addCreditNote": {
        result = dataService.invoice.addCreditNote(input);
        if (result) {
          await pushCreditNote(result);
          reloadFromStorage(["sgf_invoices"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: 1 } }));
        }
        break;
      }
      case "invoice.generateForPO": {
        result = dataService.invoice.generateInvoiceForPO(input);
        if (result) {
          await pushInvoice(result);
          reloadFromStorage(["sgf_invoices"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "invoices", count: 1 } }));
        }
        break;
      }

      // ================================================================
      //  QUOTES
      // ================================================================
      case "quote.list":
        await smartSync("orders", "sgf_orders");
        result = dataService.quote.list(input || {});
        break;
      case "quote.search":
        await smartSync("orders", "sgf_orders");
        result = dataService.quote.search(input || { query: "" });
        break;
      case "quote.getById":
        await smartSync("orders", "sgf_orders");
        result = dataService.quote.getById(input);
        break;
      case "quote.getStats":
        await smartSync("orders", "sgf_orders");
        result = dataService.quote.getStats(input || {});
        break;
      case "quote.getByCustomerId":
        await smartSync("orders", "sgf_orders");
        result = dataService.quote.getByCustomerId(input);
        break;
      case "quote.create": {
        result = dataService.quote.create(input);
        await fbPush("order", result);
        reloadFromStorage(["sgf_orders"]);
        window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "orders", count: 1 } }));
        break;
      }
      case "quote.update": {
        const { id: qid, data: qdata } = input;
        result = dataService.quote.update({ id: qid, data: qdata });
        if (result) {
          await fbPush("order", result);
          reloadFromStorage(["sgf_orders"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "orders", count: 1 } }));
        }
        break;
      }
      case "quote.delete": {
        result = dataService.quote.delete(input);
        if (result?.success) {
          await fbPush("order", result);
          reloadFromStorage(["sgf_orders"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "orders", count: 1 } }));
        }
        break;
      }
      case "quote.convertToOrder": {
        result = dataService.quote.convertToOrder(input);
        if (result) {
          await fbPush("order", result);
          reloadFromStorage(["sgf_orders", "sgf_invoices", "sgf_products"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "orders", count: 1 } }));
        }
        break;
      }

      // ================================================================
      //  APPOINTMENTS
      // ================================================================
      case "appointment.list":
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
        result = dataService.checkIn.list();
        break;
      case "checkIn.getStats":
        result = dataService.checkIn.getStats();
        break;
      case "checkIn.create": {
        result = dataService.checkIn.create(input);
        if (result) {
          await pushCheckIn(result);
          reloadFromStorage(["sgf_checkins"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "checkins", count: 1 } }));
        }
        break;
      }
      case "checkIn.update": {
        const { id: ciid, data: cidata } = input;
        result = dataService.checkIn.update({ id: ciid, data: cidata });
        if (result) {
          await pushCheckIn(result);
          reloadFromStorage(["sgf_checkins"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "checkins", count: 1 } }));
        }
        break;
      }
      case "checkIn.delete": {
        result = dataService.checkIn.delete(input);
        if (result?.success) {
          reloadFromStorage(["sgf_checkins"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "checkins", count: 0 } }));
        }
        break;
      }
      case "checkIn.checkout": {
        result = dataService.checkIn.checkout(input);
        if (result) {
          await pushCheckIn(result);
          reloadFromStorage(["sgf_checkins"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "checkins", count: 1 } }));
        }
        break;
      }
      case "checkIn.getDailyReport":
        result = dataService.checkIn.getDailyReport(input);
        break;
      case "checkIn.getWeeklyReport":
        result = dataService.checkIn.getWeeklyReport(input);
        break;
      case "checkIn.getMonthlyReport":
        result = dataService.checkIn.getMonthlyReport(input);
        break;
      case "checkIn.getAARate":
        result = dataService.checkIn.getAARate();
        break;
      case "checkIn.setAARate": {
        result = dataService.checkIn.setAARate(input);
        if (result) {
          await pushCheckIn(result);
          reloadFromStorage(["sgf_checkins"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "checkins", count: 1 } }));
        }
        break;
      }

      // ================================================================
      //  FOLLOW-UP ACTIONS
      // ================================================================
      case "followUpAction.list":
        result = dataService.followUpAction.list();
        break;
      case "followUpAction.listByCustomer":
        result = dataService.followUpAction.listByCustomer(input);
        break;
      case "followUpAction.create": {
        result = dataService.followUpAction.create(input);
        if (result) {
          await pushFollowUpAction(result);
          reloadFromStorage(["sgf_followups"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "followups", count: 1 } }));
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
          reloadFromStorage(["sgf_specialPrices"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "specialPrices", count: 0 } }));
        }
        break;
      }

      // ================================================================
      //  SALES REPS
      // ================================================================
      case "salesRep.list":
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
        result = dataService.followUp.list();
        break;
      case "followUp.listAll":
        result = dataService.followUp.listAll(input || { days: 7 });
        break;
      case "followUp.getStats":
        result = dataService.followUp.getStats();
        break;
      case "followUp.update": {
        result = dataService.followUp.update(input);
        if (result) {
          await pushFollowUp(result);
          reloadFromStorage(["sgf_followups"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "followups", count: 1 } }));
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
        result = dataService.collections.getCustomerPaymentHistory(input);
        break;
      case "collections.getFollowUpsDue":
        result = dataService.collections.getFollowUpsDue();
        break;
      case "collections.addNote": {
        result = dataService.collections.addNote(input);
        if (result) {
          await pushCollections(result);
          reloadFromStorage(["sgf_collections"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "collections", count: 1 } }));
        }
        break;
      }
      case "collections.recordPromise": {
        result = dataService.collections.recordPromise(input);
        if (result) {
          await pushCollections(result);
          reloadFromStorage(["sgf_collections"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "collections", count: 1 } }));
        }
        break;
      }
      case "collections.placeHold": {
        result = dataService.collections.placeHold(input);
        if (result) {
          await pushCollections(result);
          reloadFromStorage(["sgf_collections"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "collections", count: 1 } }));
        }
        break;
      }
      case "collections.releaseHold": {
        result = dataService.collections.releaseHold(input);
        if (result) {
          await pushCollections(result);
          reloadFromStorage(["sgf_collections"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "collections", count: 1 } }));
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
      case "barrel.listByPurchaseOrder":
        result = dataService.barrel.listByPurchaseOrder(input);
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
          reloadFromStorage(["sgf_barrels"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "barrels", count: 0 } }));
        }
        break;
      }

      // ================================================================
      //  COC
      // ================================================================
      case "coc.list":
        result = dataService.coc.list();
        break;
      case "coc.listByBarrel":
        result = dataService.coc.listByBarrel(input);
        break;
      case "coc.listByPurchaseOrder":
        result = dataService.coc.listByPurchaseOrder(input);
        break;
      case "coc.listByInvoice":
        result = dataService.coc.listByInvoice(input);
        break;
      case "coc.getById":
        result = dataService.coc.getById(input);
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
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "cocs", count: 1 } }));
        }
        break;
      }
      case "coc.generateForInvoice": {
        result = dataService.coc.generateForInvoice(input);
        if (result) {
          await pushCOC(result);
          reloadFromStorage(["sgf_cocs"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "cocs", count: 1 } }));
        }
        break;
      }
      case "coc.bulkGenerateForPO": {
        result = dataService.coc.bulkGenerateForPO(input.poId, input.cocDataList, input.deleteOrphanIds);
        if (result) {
          for (const coc of result.cocs || []) {
            try { await pushCOC(coc); } catch { /* ignore */ }
          }
          reloadFromStorage(["sgf_cocs"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "cocs", count: result?.cocs?.length || 0 } }));
        }
        break;
      }

      // ================================================================
      //  PACKING LISTS
      // ================================================================
      case "packingList.listByPurchaseOrder":
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
          reloadFromStorage(["sgf_packingLists"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "packingLists", count: 0 } }));
        }
        break;
      }

      // ================================================================
      //  FALLBACK
      // ================================================================
      default:
        console.warn(`[localLink] Unhandled: ${path}`);
        result = null;
    }

    return result;
  } catch (err: any) {
    console.error(`[localLink] Error handling ${path}:`, err);
    throw err;
  }
}
