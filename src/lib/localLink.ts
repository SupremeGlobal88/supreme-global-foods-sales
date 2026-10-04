import { dataService, reloadFromStorage, fixDraftInvoicesForDeliveredOrders, fixSageInvoiceDates, parseBankStatement, matchBankPayments, allocateBankPayments, getAARate, setAARate } from "./dataService";
import { DATA_SERVICE_EXTRAS_LOADED } from "./dataServiceExtras";
if (!DATA_SERVICE_EXTRAS_LOADED) {
  console.error("[localLink] CRITICAL: dataServiceExtras was tree-shaken!");
}
import { getStorageItem, setStorageItem } from "./compressedStorage";