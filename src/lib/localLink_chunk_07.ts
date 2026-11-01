          await pushCreditNote(result);
          reloadFromStorage(["sgf_creditNotes"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "creditNotes", count: 1 } }));
        }
        break;
      }
      case "creditNote.delete": {
        result = dataService.creditNote.delete(input);
        if (result?.success) {
          await pushCreditNote({ id: input, deleted: true });
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
