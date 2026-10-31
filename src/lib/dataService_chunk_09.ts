// =============================================================================
// INITIALIZE — load all data on module import
// =============================================================================

load();

// =============================================================================
// EXPORT ALL SERVICES
// =============================================================================

export {
  customers,
  products,
  orders,
  invoices,
  appointments,
  checkins,
  specialPrices,
  auditLog,
  systemLogs,
  followUps,
  followUpActions,
  collectionNotes,
  collectionPromises,
  accountHolds,
  receipts,
  creditNotes,
  users,
  corporateCustomers,
  purchaseOrders,
  barrels,
  certificatesOfCompliance,
  packingListLines,
  SALES_REPS,
  getEffectivePrice,
  getCustomerName,
  getProductName,
  getSalesRepName,
};
