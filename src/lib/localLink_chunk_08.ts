        break;
      case "settings.getBankDetails":
        result = dataService.settings.getBankDetails();
        break;
      case "settings.getPaymentTerms":
        result = dataService.settings.getPaymentTerms();
        break;
      case "settings.getEmailTemplates":
        result = dataService.settings.getEmailTemplates();
        break;
      case "settings.getSmsTemplates":
        result = dataService.settings.getSmsTemplates();
        break;
      case "settings.getNotificationSettings":
        result = dataService.settings.getNotificationSettings();
        break;
      case "settings.getIntegrationSettings":
        result = dataService.settings.getIntegrationSettings();
        break;
      case "settings.getBackupSettings":
        result = dataService.settings.getBackupSettings();
        break;
      case "settings.getSecuritySettings":
        result = dataService.settings.getSecuritySettings();
        break;
      case "settings.getAuditSettings":
        result = dataService.settings.getAuditSettings();
        break;
      case "settings.getSystemSettings":
        result = dataService.settings.getSystemSettings();
        break;
      case "settings.getDisplaySettings":
        result = dataService.settings.getDisplaySettings();
        break;
      case "settings.getReportSettings":
        result = dataService.settings.getReportSettings();
        break;
      case "settings.getDashboardSettings":
        result = dataService.settings.getDashboardSettings();
        break;
      case "settings.getSalesRepSettings":
        result = dataService.settings.getSalesRepSettings();
        break;
      case "settings.getCustomerSettings":
        result = dataService.settings.getCustomerSettings();
        break;
      case "settings.getInvoiceSettings":
        result = dataService.settings.getInvoiceSettings();
        break;
      case "settings.getOrderSettings":
        result = dataService.settings.getOrderSettings();
        break;
      case "settings.getStockSettings":
        result = dataService.settings.getStockSettings();
        break;
      case "settings.getCorporateSettings":
        result = dataService.settings.getCorporateSettings();
        break;
      case "settings.getPurchaseOrderSettings":
        result = dataService.settings.getPurchaseOrderSettings();
        break;
      case "settings.getBarrelSettings":
        result = dataService.settings.getBarrelSettings();
        break;
      case "settings.getCocSettings":
        result = dataService.settings.getCocSettings();
        break;
      case "settings.getPackingListSettings":
        result = dataService.settings.getPackingListSettings();
        break;
      case "settings.getCollectionSettings":
        result = dataService.settings.getCollectionSettings();
        break;
      case "settings.getFollowUpSettings":
        result = dataService.settings.getFollowUpSettings();
        break;
      case "settings.getFollowUpActionSettings":
        result = dataService.settings.getFollowUpActionSettings();
        break;
      case "settings.getAccountHoldSettings":
        result = dataService.settings.getAccountHoldSettings();
        break;
      case "settings.getReceiptSettings":
        result = dataService.settings.getReceiptSettings();
        break;
      case "settings.getCreditNoteSettings":
        result = dataService.settings.getCreditNoteSettings();
        break;
      case "settings.getStatementSettings":
        result = dataService.settings.getStatementSettings();
        break;
      case "settings.getReportSettings":
        result = dataService.settings.getReportSettings();
        break;
      case "settings.getSystemLogSettings":
        result = dataService.settings.getSystemLogSettings();
        break;
      case "settings.getAuditLogSettings":
        result = dataService.settings.getAuditLogSettings();
        break;
      case "settings.getSalesRepSettings":
        result = dataService.settings.getSalesRepSettings();
        break;

      // ================================================================
      //  FALLBACK: Dynamic dispatch
      // ================================================================
      default: {
        const [cat, act] = path.split(".");
        const svc = (dataService as any)[cat];
        if (svc && typeof svc[act] === "function") {
          result = svc[act](input);
        } else {
          // unhandled path - silently return null
          result = null;
        }
        break;
      }
    }

    return result;
  } catch (err: any) {
    // error silently handled
    throw err;
  }
}

export function createLocalLink() {
  return () =>
    ({ op }: any) =>
      observable((observer) => {
        (async () => {
          try {
            const result = await localLinkHandler(op.path, op.input);
            observer.next({ result: { type: "data", data: result } });
            observer.complete();
          } catch (err: any) {
            observer.error(err);
          }
        })();
      });
}
