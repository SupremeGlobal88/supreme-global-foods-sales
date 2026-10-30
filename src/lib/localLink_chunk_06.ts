        result = dataService.coc.getById(input);
        break;
      case "coc.getByCustomer":
        result = dataService.coc.getByCustomer(input);
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

      // ================================================================
      //  PACKING LISTS
      // ================================================================
      case "packingList.list":
        result = dataService.packingList.list();
        break;
      case "packingList.getById":
        result = dataService.packingList.getById(input);
        break;
      case "packingList.getByCustomer":
        result = dataService.packingList.getByCustomer(input);
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
      //  COLLECTION
      // ================================================================
      case "collection.getDashboard":
        result = dataService.collection.getDashboard();
        break;
      case "collection.getCustomersWithOverdueInvoices":
        result = dataService.collection.getCustomersWithOverdueInvoices(input || 30);
        break;
      case "collection.getCustomerCollectionNotes":
        result = dataService.collection.getCustomerCollectionNotes(input);
        break;
      case "collection.getCustomerCollectionPromises":
        result = dataService.collection.getCustomerCollectionPromises(input);
        break;
      case "collection.addCollectionNote": {
        result = dataService.collection.addCollectionNote(input);
        if (result) {
          await pushCollectionNote(result);
          reloadFromStorage(["sgf_collectionNotes"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "collectionNotes", count: 1 } }));
        }
        break;
      }
      case "collection.addCollectionPromise": {
        result = dataService.collection.addCollectionPromise(input);
        if (result) {
          await pushCollectionPromise(result);
          reloadFromStorage(["sgf_collectionPromises"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "collectionPromises", count: 1 } }));
        }
        break;
      }
      case "collection.updatePromiseStatus": {
        result = dataService.collection.updatePromiseStatus(input);
        if (result) {
          await pushCollectionPromise(result);
          reloadFromStorage(["sgf_collectionPromises"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "collectionPromises", count: 1 } }));
        }
        break;
      }

      // ================================================================
      //  FOLLOW UPS
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
      case "followUp.getByStatus":
        result = dataService.followUp.getByStatus(input);
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
      //  CREDIT NOTES
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
      case "creditNote.getByCustomer":
        result = dataService.creditNote.getByCustomer(input);
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
          await pushCreditNote({ id: input, deleted: true });
          reloadFromStorage(["sgf_creditNotes"]);
          window.dispatchEvent(new CustomEvent("firebaseDataReceived", { detail: { type: "creditNotes", count: 0 } }));
        }
        break;
      }

      // ================================================================
      //  REPORTS
      // ================================================================
      case "report.dailySales":
        result = dataService.report.dailySales(input || new Date().toISOString().slice(0, 10));
        break;
      case "report.weeklySales":
        result = dataService.report.weeklySales(input || new Date().toISOString().slice(0, 10));
        break;
      case "report.monthlySales":
        result = dataService.report.monthlySales(input || new Date().toISOString().slice(0, 10));
        break;
      case "report.customerSales":
        result = dataService.report.customerSales(input || "all");
        break;
      case "report.productSales":
        result = dataService.report.productSales(input || "all");
        break;
      case "report.repSales":
        result = dataService.report.repSales(input || "all");
        break;
      case "report.outstandingInvoices":
        result = dataService.report.outstandingInvoices();
        break;
      case "report.paymentHistory":
        result = dataService.report.paymentHistory(input || "all");
        break;
      case "report.collectionDashboard":
        result = dataService.report.collectionDashboard();
        break;
      case "report.stockMovement":
        result = dataService.report.stockMovement(input || 30);
        break;
      case "report.stockValuation":
        result = dataService.report.stockValuation();
        break;
      case "report.lowStockReport":
        result = dataService.report.lowStockReport();
        break;
      case "report.dailyCheckIns":
        result = dataService.report.dailyCheckIns(input || new Date().toISOString().slice(0, 10));
        break;
      case "report.dailyAppointments":
        result = dataService.report.dailyAppointments(input || new Date().toISOString().slice(0, 10));
        break;
      case "report.customerVisitFrequency":
        result = dataService.report.customerVisitFrequency();
        break;
      case "report.customerOrderHistory":
        result = dataService.report.customerOrderHistory(input);
        break;
      case "report.repPerformance":
        result = dataService.report.repPerformance(input || "all");
        break;
      case "report.repActivity":
        result = dataService.report.repActivity(input || "all");
        break;
      case "report.auditTrail":
        result = dataService.report.auditTrail(input || 50);
        break;
      case "report.systemLogSummary":
        result = dataService.report.systemLogSummary();
        break;
      case "report.missedAppointments":
        result = dataService.report.missedAppointments();
        break;
      case "report.checkInReport":
        result = dataService.report.checkInReport();
        break;
      case "report.deliveryRoute":
        result = dataService.report.deliveryRoute(input);
        break;
      case "report.invoiceAging":
        result = dataService.report.invoiceAging();
        break;
      case "report.salesByCategory":
        result = dataService.report.salesByCategory();
        break;
      case "report.topCustomers":
        result = dataService.report.topCustomers(input || 10);
        break;
      case "report.topProducts":
        result = dataService.report.topProducts(input || 10);
        break;
      case "report.dailyInvoicedStock":
        result = dataService.report.dailyInvoicedStock(input || {});
        break;
      case "report.corporateDashboard":
        result = dataService.report.corporateDashboard();
        break;
      case "report.creditNotesReport":
        result = dataService.report.creditNotesReport();
        break;
      case "report.creditNoteAging":
        result = dataService.report.creditNoteAging();
        break;
      case "report.overpaymentReport":
        result = dataService.report.overpaymentReport();
        break;
      case "report.bankStatementParse":
        result = dataService.report.bankStatementParse(input);
        break;
      case "report.bankStatementAllocate":
        result = dataService.report.bankStatementAllocate(input);
        break;
      case "report.fixDuplicateInvoiceNumbers":
        result = dataService.report.fixDuplicateInvoiceNumbers();
        break;
      case "report.fixSageInvoiceDates":
        result = dataService.report.fixSageInvoiceDates();
        break;
      case "report.fixDraftInvoices":
        result = dataService.report.fixDraftInvoices();
        break;
      case "report.autoLinkSageInvoices":
        result = dataService.report.autoLinkSageInvoices();
        break;

      // ================================================================
      //  RECEIPTS
      // ================================================================
      case "receipt.list":
        result = dataService.receipt.list();
        break;
      case "receipt.getById":
        result = dataService.receipt.getById(input);
        break;
      case "receipt.getByInvoice":
        result = dataService.receipt.getByInvoice(input);
        break;
      case "receipt.getByCustomer":
        result = dataService.receipt.getByCustomer(input);
        break;
      case "receipt.getNextNumber":
        result = dataService.receipt.getNextNumber();
        break;

      // ================================================================
      //  OTHER
      // ================================================================
      case "other.getAddressChanges":
        result = dataService.other.getAddressChanges();
        break;
      case "other.getStats":
        result = dataService.other.getStats();
        break;
      case "other.getFullTrail":
        result = dataService.other.getFullTrail();
        break;
      case "other.getMissedAppointments":
        result = dataService.other.getMissedAppointments();
        break;
      case "other.getCheckInReport":
        result = dataService.other.getCheckInReport();
        break;

      // ================================================================
      //  DASHBOARD
      // ================================================================
      case "dashboard.summary":
        result = dataService.dashboard.summary();
        break;
      case "dashboard.salesTrend":
        result = dataService.dashboard.salesTrend(input || 30);
        break;
      case "dashboard.repPerformance":
        result = dataService.dashboard.repPerformance();
        break;
      case "dashboard.collectionMetrics":
        result = dataService.dashboard.collectionMetrics();
        break;
      case "dashboard.stockAlerts":
        result = dataService.dashboard.stockAlerts();
        break;
      case "dashboard.upcomingAppointments":
        result = dataService.dashboard.upcomingAppointments(input || 7);
        break;
      case "dashboard.todayCheckIns":
        result = dataService.dashboard.todayCheckIns();
        break;

      // ================================================================
      //  SUBSCRIPTION
      // ================================================================
      case "subscription.listen":
        result = observable<any>((emit) => {
          const handler = (event: any) => emit.next(event.detail);
          window.addEventListener("firebaseDataReceived", handler);
          return () => window.removeEventListener("firebaseDataReceived", handler);
        });
        break;

      default:
        throw new Error(`Unhandled localLink path: ${path}`);
    }

    return result;
  } catch (error) {
    logSystemEvent("ERROR", "localLink", `Error in localLinkHandler for ${path}`, { error: String(error), input: JSON.stringify(input) });
    throw error;
  }
}

// Cloud-first sync helper
export async function cloudFirstSync(path: string, input: any) {
  return localLinkHandler(path, input);
}

export function createLocalLink() {
  return { localLinkHandler, cloudFirstSync };
}
