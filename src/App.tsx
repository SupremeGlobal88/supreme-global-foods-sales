import { Routes, Route, Navigate, useLocation } from "react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { initFirebase, initAutoSync, registerDataServiceRefresh, isFirebaseReady, pullFromCloud } from "@/lib/firebaseSync";
import { reloadFromStorage, repairInvoiceCompanies } from "@/lib/dataService";
import { trpc, queryClient } from "@/providers/trpc";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import StockPage from "./pages/StockPage";
import CustomersPage from "./pages/CustomersPage";
import OrdersPage from "./pages/OrdersPage";
import InvoicesPage from "./pages/InvoicesPage";
import StatementPage from "./pages/StatementPage";
import AppointmentsPage from "./pages/AppointmentsPage";
import SalesRepsPage from "./pages/SalesRepsPage";
import SettingsPage from "./pages/SettingsPage";
import FollowUpsPage from "./pages/FollowUpsPage";
import CollectionsPage from "./pages/CollectionsPage";
import SampleReportsPage from "./pages/SampleReportsPage";
import UsersPage from "./pages/UsersPage";
import HistoricalImportPage from "./pages/HistoricalImportPage";
import SalesRepInvoicesPage from "./pages/SalesRepInvoicesPage";
import BankImportPage from "./pages/BankImportPage";
import CustomerStatementPage from "./pages/CustomerStatementPage";
import SalesRepReportsPage from "./pages/SalesRepReportsPage";
import CorporateCustomersPage from "./pages/CorporateCustomersPage";
import PurchaseOrdersPage from "./pages/PurchaseOrdersPage";
import PurchaseOrderDetailPage from "./pages/PurchaseOrderDetailPage";
import PackingListPage from "./pages/PackingListPage";
import { ShieldAlert, Cloud } from "lucide-react";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#0C0D0E" }}>
        <div className="shimmer w-12 h-12 rounded-full" />
      </div>
    );
  }
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

/** RoleGuard: redirect to dashboard if user lacks permission for this route */
function RoleGuard({ children }: { children: React.ReactNode }) {
  const { canAccess } = useRole();
  const location = useLocation();
  if (!canAccess(location.pathname)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <ShieldAlert className="w-16 h-16 mb-4" style={{ color: "#EF4444", opacity: 0.4 }} />
        <h2 className="font-display font-semibold text-white text-xl mb-2">Access Denied</h2>
        <p className="text-[#8A8B8C] font-body text-sm">You don&apos;t have permission to view this page.</p>
      </div>
    );
  }
  return <>{children}</>;
}

// Check URL for shared Firebase config (sales rep onboarding)
function checkUrlForFirebaseConfig() {
  try {
    const params = new URLSearchParams(window.location.search);
    const fb64 = params.get("fb");
    if (fb64) {
      const decoded = atob(fb64);
      const config = JSON.parse(decoded);
      if (config.apiKey && config.databaseURL) {
        initFirebase(config);
        const url = new URL(window.location.href);
        url.searchParams.delete("fb");
        window.history.replaceState({}, "", url.toString());
      }
    }
  } catch { /* ignore */ }
}

export default function App() {
  const utils = trpc.useUtils();
  const [isCloudReady, setIsCloudReady] = useState(false);
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    checkUrlForFirebaseConfig();
    registerDataServiceRefresh(reloadFromStorage);
    initFirebase();
    const unsub = initAutoSync();

    async function loadFromCloud() {
      try {
        if (isFirebaseReady()) {
          // SAFE SYNC: One-way pull FROM cloud only. NEVER push local data at startup.
          // Individual mutations push via fbPush() — that's the only way data goes TO cloud.
          // This prevents a major data-loss bug: if we pushed local data here, a device
          // with stale data could overwrite fresh data created by another user.
          reloadFromStorage();
          // Fix any invoices where company field doesn't match invoice number prefix
          repairInvoiceCompanies();
          console.log("[Sync] Local data loaded first");

          // CRITICAL: Pull from cloud at startup to ensure all devices start with fresh data.
          // Subscriptions handle ongoing real-time sync, but the initial pull ensures
          // we catch any data that was missed while the app was closed.
          const counts = await pullFromCloud();
          reloadFromStorage();
          // CRITICAL FIX: Removed queryClient.clear() which was wiping the entire
          // React Query cache and forcing ALL queries to refetch from scratch.
          // This was causing massive UI freeze on startup with 4000+ invoices.
          // Instead, we let the targeted invalidation handler above refresh
          // queries lazily as components need them.
          console.log("[Sync] Cloud data pulled successfully:", counts);
        } else {
          console.warn("[Sync] Firebase not ready — skipping initial pull. Will retry via subscriptions.");
        }
      } catch (e) {
        console.warn("[Sync] Error:", e);
      } finally {
        // ALWAYS set cloud ready so the app renders — even if Firebase is down or slow.
        // The previous bug: moving setIsCloudReady(true) inside the if() block meant
        // if Firebase init was slow or pullFromCloud hung, the app stayed on the
        // loading screen forever. finally guarantees the app ALWAYS renders.
        setIsCloudReady(true);
      }
    }

    // CRITICAL SAFETY NET: If loadFromCloud() hangs for any reason (Firebase get() can
    // hang indefinitely on slow networks), force the app to render after 15 seconds.
    // The finally block above should catch most cases, but this is a second line of defense.
    const safetyTimer = setTimeout(() => {
      if (!isCloudReady) {
        console.warn("[Sync] SAFETY TIMEOUT: loadFromCloud took too long, forcing app render");
        setIsCloudReady(true);
      }
    }, 15000);

    loadFromCloud();
    return () => { unsub(); clearTimeout(safetyTimer); };
  }, []);

  // POST-LOGIN SYNC: Re-sync after user logs in.
  // The mount sync may have run before Firebase was ready or before login.
  // This ensures fresh data is loaded AFTER authentication.
  useEffect(() => {
    if (isAuthenticated && isCloudReady) {
      console.log("[Sync] Post-login sync triggered");
      reloadFromStorage();
      // CRITICAL FIX: Removed queryClient.clear() which wipes the entire cache
      // and forces all queries to refetch simultaneously, freezing the UI.
      console.log("[Sync] Post-login complete");
    }
  }, [isAuthenticated, isCloudReady]);

  // When Firebase data changes, invalidate ONLY the affected queries.
  // CRITICAL FIX: Removed the nuclear `invalidateQueries({ refetchType: "all" })`
  // which was freezing the UI by forcing ALL queries to refetch simultaneously.
  // Now we use targeted invalidation with a debounce to batch rapid events.
  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const pendingTypes = new Set<string>();

    const handler = (e: any) => {
      const type = e.detail?.type;
      if (!type) return;
      pendingTypes.add(type);

      // Debounce: wait 300ms after the last event before invalidating
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        console.log("[Sync] firebaseDataReceived batch:", Array.from(pendingTypes));
        for (const t of pendingTypes) {
          switch (t) {
            case "invoices":
              queryClient.invalidateQueries({ queryKey: [["invoice", "list"]] });
              queryClient.invalidateQueries({ queryKey: [["invoice", "getStats"]] });
              break;
            case "orders":
              queryClient.invalidateQueries({ queryKey: [["order", "list"]] });
              queryClient.invalidateQueries({ queryKey: [["order", "getStats"]] });
              break;
            case "customers":
              queryClient.invalidateQueries({ queryKey: [["customer", "search"]] });
              queryClient.invalidateQueries({ queryKey: [["customer", "list"]] });
              break;
            case "appointments":
              queryClient.invalidateQueries({ queryKey: [["appointment", "list"]] });
              break;
            case "checkins":
              queryClient.invalidateQueries({ queryKey: [["checkIn", "list"]] });
              break;
            case "stock":
              queryClient.invalidateQueries({ queryKey: [["stock", "list"]] });
              queryClient.invalidateQueries({ queryKey: [["stock", "search"]] });
              queryClient.invalidateQueries({ queryKey: [["stock", "getStats"]] });
              break;
            case "creditNotes":
              queryClient.invalidateQueries({ queryKey: [["invoice", "getCreditNotes"]] });
              queryClient.invalidateQueries({ queryKey: [["invoice", "list"]] });
              break;
            case "followUps":
              queryClient.invalidateQueries({ queryKey: [["followUp", "list"]] });
              break;
            case "followUpActions":
              queryClient.invalidateQueries({ queryKey: [["followUpAction", "list"]] });
              break;
            case "users":
              queryClient.invalidateQueries({ queryKey: [["user", "list"]] });
              break;
            case "salesReps":
              queryClient.invalidateQueries({ queryKey: [["customer", "getSalesReps"]] });
              break;
            case "corporateCustomers":
              queryClient.invalidateQueries({ queryKey: [["corporateCustomer", "list"]] });
              break;
            case "purchaseOrders":
              queryClient.invalidateQueries({ queryKey: [["purchaseOrder", "list"]] });
              break;
            case "barrels":
              queryClient.invalidateQueries({ queryKey: [["barrel", "list"]] });
              break;
            case "certificatesOfCompliance":
              queryClient.invalidateQueries({ queryKey: [["coc", "list"]] });
              break;
            case "packingListLines":
              queryClient.invalidateQueries({ queryKey: [["packingList", "listByPurchaseOrder"]] });
              break;
            default:
              console.warn("[Sync] Unknown data type in firebaseDataReceived:", t);
          }
        }
        pendingTypes.clear();
      }, 300);
    };
    window.addEventListener("firebaseDataReceived", handler);
    return () => {
      window.removeEventListener("firebaseDataReceived", handler);
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, []);

  // Show loading screen until fresh cloud data is loaded
  if (!isCloudReady) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center" style={{ backgroundColor: "#0C0D0E" }}>
        <Cloud className="w-16 h-16 mb-4 animate-pulse" style={{ color: "#D4A843" }} />
        <p className="text-white font-display text-lg">Loading from cloud...</p>
        <p className="text-[#8A8B8C] text-sm mt-2">Please wait while we fetch the latest data</p>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="stock" element={<StockPage />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="invoices" element={<RoleGuard><InvoicesPage /></RoleGuard>} />
        <Route path="statement/:customerId" element={<RoleGuard><StatementPage /></RoleGuard>} />
        <Route path="appointments" element={<AppointmentsPage />} />
        <Route path="sales-reps" element={<RoleGuard><SalesRepsPage /></RoleGuard>} />
        <Route path="follow-ups" element={<FollowUpsPage />} />
        <Route path="collections" element={<RoleGuard><CollectionsPage /></RoleGuard>} />
        <Route path="my-invoices" element={<RoleGuard><SalesRepInvoicesPage /></RoleGuard>} />
        <Route path="bank-import" element={<RoleGuard><BankImportPage /></RoleGuard>} />
        <Route path="customer-statement" element={<RoleGuard><CustomerStatementPage /></RoleGuard>} />
        <Route path="sample-reports" element={<SampleReportsPage />} />
        <Route path="sales-rep-reports" element={<RoleGuard><SalesRepReportsPage /></RoleGuard>} />
        <Route path="corporate-customers" element={<RoleGuard><CorporateCustomersPage /></RoleGuard>} />
        <Route path="purchase-orders" element={<RoleGuard><PurchaseOrdersPage /></RoleGuard>} />
        <Route path="purchase-order/:id" element={<RoleGuard><PurchaseOrderDetailPage /></RoleGuard>} />
        <Route path="packing-list/:id" element={<RoleGuard><PackingListPage /></RoleGuard>} />
        <Route path="settings" element={<RoleGuard><SettingsPage /></RoleGuard>} />
        <Route path="users" element={<RoleGuard><UsersPage /></RoleGuard>} />
        <Route path="historical-import" element={<RoleGuard><HistoricalImportPage /></RoleGuard>} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
