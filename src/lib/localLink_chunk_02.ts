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
