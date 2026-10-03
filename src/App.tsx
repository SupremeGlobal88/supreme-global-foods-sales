import { Routes, Route, Navigate, useLocation } from "react-router";
import { useEffect, useState, useRef } from "react";
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
import SalesReportPage from "./pages/SalesReportPage";
import CorporateCustomersPage from "./pages/CorporateCustomersPage";
import PurchaseOrdersPage from "./pages/PurchaseOrdersPage";
import PurchaseOrderDetailPage from "./pages/PurchaseOrderDetailPage";
import PackingListPage from "./pages/PackingListPage";
import AuditReportPage from "./pages/AuditReportPage";
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
    // === CLEANUP: Remove corrupted localStorage data from old compression bugs ===
    const COMPRESSED_KEYS = ["sgf_orders","sgf_products","sgf_invoices","sgf_customers","sgf_stock","sgf_checkins","sgf_appointments","sgf_salesReps","sgf_users","sgf_specialPrices","sgf_auditLog","sgf_followUps","sgf_followUpActions","sgf_collectionNotes","sgf_collectionPromises","sgf_accountHolds","sgf_receipts","sgf_creditNotes","sgf_purchaseOrders","sgf_barrels","sgf_cocs","sgf_packingListLines","sgf_corporateCustomers"];
    for (const key of COMPRESSED_KEYS) {
      try {
        const raw = localStorage.getItem(key);
        if (raw && raw.length > 0) {
          const isJson = raw.trim().startsWith("[") || raw.trim().startsWith("{") || raw.trim().startsWith("\"");
          if (!isJson) {
            console.warn(`[App] Removing corrupted localStorage key: ${key}`);
            localStorage.removeItem(key);
          }
        }
      } catch { /* ignore */ }
    }

    checkUrlForFirebaseConfig();
    registerDataServiceRefresh(reloadFromStorage);
    initFirebase();
    const unsub = initAutoSync();

    // Load local data FIRST so the app renders immediately with cached data
    reloadFromStorage();
    repairInvoiceCompanies();

    // Cloud-first: Pull from cloud in BACKGROUND without blocking UI.
    // Subscriptions (initAutoSync) already handle real-time sync.
    // The initial pull is just a safety net to catch missed data.
    // NEVER block rendering on this — it causes infinite loading screens.
    (async () => {
      try {
        if (isFirebaseReady()) {
          console.log("[Sync] Background cloud pull starting...");
          const counts = await pullFromCloud();
          reloadFromStorage();
          console.log("[Sync] Background cloud pull complete:", counts);
        }
      } catch (e) {
        console.warn("[Sync] Background pull error:", e);
      }
    })();

    // Show loading screen for max 3 seconds to give subscriptions a chance to fire,
    // then render the app. Real-time sync continues in background.
    const safetyTimer = setTimeout(() => {
      setIsCloudReady(true);
    }, 3000);

    return () => { unsub(); clearTimeout(safetyTimer); };
  }, []);

  // POST-LOGIN SYNC: Re-sync after user logs in.
  useEffect(() => {
    if (isAuthenticated && isCloudReady) {
      console.log("[Sync] Post-login sync triggered");
      reloadFromStorage();
      console.log("[Sync] Post-login complete");
    }
  }, [isAuthenticated, isCloudReady]);

  // When Firebase data changes, invalidate affected queries using tRPC utils.
  const utilsRef = useRef(utils);
  utilsRef.current = utils;

  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const pendingTypes = new Set<string>();

    const handler = (e: any) => {
      const type = e.detail?.type;
      if (!type) return;
      pendingTypes.add(type);

      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        console.log("[Sync] firebaseDataReceived batch:", Array.from(pendingTypes));
        const u = utilsRef.current;
        for (const t of pendingTypes) {
          switch (t) {
            case "invoices":
              u.invoice.list.invalidate();
              u.invoice.getStats.invalidate();
              break;
            case "orders":
              u.order.list.invalidate();
              u.order.getStats.invalidate();
              break;
            case "customers":
              u.customer.search.invalidate();
              u.customer.list.invalidate();
              break;
            case "appointments":
              u.appointment.list.invalidate();
              break;
            case "checkins":
              u.checkIn.list.invalidate();
              break;
            case "stock":
              u.stock.list.invalidate();
              u.stock.search.invalidate();
              u.stock.getStats.invalidate();
              break;
            case "creditNotes":
              u.invoice.getCreditNotes.invalidate();
              u.invoice.list.invalidate();
              break;
            case "followUps":
              u.followUp.list.invalidate();
              break;
            case "followUpActions":
              u.followUpAction.list.invalidate();
              break;
            case "users":
              u.user.list.invalidate();
              break;
            case "salesReps":
              u.customer.getSalesReps.invalidate();
              break;
            case "corporateCustomers":
              u.corporateCustomer.list.invalidate();
              break;
            case "purchaseOrders":
              u.purchaseOrder.list.invalidate();
              break;
            case "barrels":
              u.barrel.list.invalidate();
              break;
            case "certificatesOfCompliance":
              u.coc.list.invalidate();
              break;
            case "packingListLines":
              u.packingList.listByPurchaseOrder.invalidate();
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

  // Show loading screen for max 3 seconds, then render app
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
        <Route path="sales-report" element={<SalesReportPage />} />
        <Route path="sales-rep-reports" element={<RoleGuard><SalesRepReportsPage /></RoleGuard>} />
        <Route path="corporate-customers" element={<RoleGuard><CorporateCustomersPage /></RoleGuard>} />
        <Route path="purchase-orders" element={<RoleGuard><PurchaseOrdersPage /></RoleGuard>} />
        <Route path="purchase-order/:id" element={<RoleGuard><PurchaseOrderDetailPage /></RoleGuard>} />
        <Route path="packing-list/:id" element={<RoleGuard><PackingListPage /></RoleGuard>} />
        <Route path="settings" element={<RoleGuard><SettingsPage /></RoleGuard>} />
        <Route path="users" element={<RoleGuard><UsersPage /></RoleGuard>} />
        <Route path="audit" element={<RoleGuard><AuditReportPage /></RoleGuard>} />
        <Route path="historical-import" element={<RoleGuard><HistoricalImportPage /></RoleGuard>} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
