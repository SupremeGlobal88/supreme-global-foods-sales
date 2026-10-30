          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "collectionPromises", count: 0 } }));
        }
        break;
      }

      // ================================================================
      //  AUDIT LOG
      // ================================================================
      case "auditLog.list":
        result = dataService.auditLog.list();
        break;
      case "auditLog.getRecent":
        result = dataService.auditLog.getRecent(input || 50);
        break;
      case "auditLog.create": {
        result = dataService.auditLog.create(input);
        if (result) {
          await pushAudit(result);
          reloadFromStorage(["sgf_auditLog"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "auditLog", count: 1 } }));
        }
        break;
      }

      // ================================================================
      //  SYSTEM LOGS
      // ================================================================
      case "systemLog.list":
        result = dataService.systemLog.list();
        break;
      case "systemLog.getRecent":
        result = dataService.systemLog.getRecent(input || 50);
        break;
      case "systemLog.getByCategory":
        result = dataService.systemLog.getByCategory(input);
        break;
      case "systemLog.getByLevel":
        result = dataService.systemLog.getByLevel(input);
        break;
      case "systemLog.create": {
        result = dataService.systemLog.create(input);
        if (result) {
          await pushSystemLog(result);
          reloadFromStorage(["sgf_systemLogs"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "systemLogs", count: 1 } }));
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
      case "purchaseOrder.getByCustomer":
        result = dataService.purchaseOrder.getByCustomer(input);
        break;
      case "purchaseOrder.getByCorporateCustomer":
        result = dataService.purchaseOrder.getByCorporateCustomer(input);
        break;
      case "purchaseOrder.getStats":
        result = dataService.purchaseOrder.getStats();
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
      //  CERTIFICATES OF COMPLIANCE
      // ================================================================
      case "coc.list":
        result = dataService.coc.list();
        break;
      case "coc.getById":
