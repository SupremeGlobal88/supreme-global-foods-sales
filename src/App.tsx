import { Routes, Route, Navigate, useLocation } from "react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { initFirebase, initAutoSync, registerDataServiceRefresh, pullFromCloud, isFirebaseReady } from "@/lib/firebaseSync";
import { reloadFromStorage } from "@/lib/dataService";
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
          console.log("[Sync] Local data loaded first");

          const counts = await pullFromCloud();
          reloadFromStorage();
          queryClient.clear();
          console.log("[Sync] Merged with cloud:", counts);
        }
      } catch (e) {
        console.warn("[Sync] Error:", e);
      } finally {
        setIsCloudReady(true);
      }
    }

    loadFromCloud();
    return () => { unsub(); };
  }, []);

  // POST-LOGIN SYNC: Re-sync after user logs in.
  // The mount sync may have run before Firebase was ready or before login.
  // This ensures fresh data is loaded AFTER authentication.
  useEffect(() => {
    if (isAuthenticated && isCloudReady) {
      console.log("[Sync] Post-login sync triggered");
      async function postLoginSync() {
        try {
          if (isFirebaseReady()) {
            reloadFromStorage();
            const counts = await pullFromCloud();
            reloadFromStorage();
            queryClient.clear();
            console.log("[Sync] Post-login merged:", counts);
          }
        } catch (e) {
          console.warn("[Sync] Post-login error:", e);
        }
      }
      postLoginSync();
    }
  }, [isAuthenticated, isCloudReady]);

  // When Firebase data changes, force ALL tRPC queries to refetch immediately.
  // queryClient.invalidateQueries({ refetchType: 'all' }) forces every active
  // query to refetch from dataService — this is the nuclear option that works.
  useEffect(() => {
    const handler = (e: any) => {
      const type = e.detail?.type;
      console.log("[Sync] firebaseDataReceived:", type, "- forcing all queries to refetch");
      // Nuclear option: invalidate ALL queries with forced refetch
      queryClient.invalidateQueries({ refetchType: "all" });
      // Also do targeted refetches for the specific data type
      if (type === "invoices") {
        utils.invoice.list.refetch();
        utils.invoice.getStats.refetch();
      }
      if (type === "orders") {
        utils.order.list.refetch();
        utils.order.getStats.refetch();
        utils.dashboard.stats.refetch();
      }
      if (type === "customers") {
        utils.customer.search.refetch();
        utils.customer.list.refetch();
      }
      if (type === "appointments") {
        utils.appointment.list.refetch();
      }
      if (type === "checkins") {
        utils.checkIn.list.refetch();
      }
      if (type === "stock") {
        utils.stock.list.refetch();
        utils.stock.search.refetch();
        utils.stock.getStats.refetch();
      }
      if (type === "followUps" || type === "followUpActions") {
        utils.followUp.list.refetch();
        utils.followUpAction.list.refetch();
      }
      if (type === "users") {
        utils.user.list.refetch();
        utils.customer.getSalesReps.refetch();
      }
      if (type === "salesReps") {
        // Sales reps don't have a dedicated tRPC query, but customer.getSalesReps
        // reads from localStorage which is updated by subscribeToSalesReps.
        // Invalidate customer search to refresh any dropdowns using sales reps.
        utils.customer.search.invalidate();
      }
    };
    window.addEventListener("firebaseDataReceived", handler);
    return () => window.removeEventListener("firebaseDataReceived", handler);
  }, [utils]);

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
        <Route path="settings" element={<RoleGuard><SettingsPage /></RoleGuard>} />
        <Route path="users" element={<RoleGuard><UsersPage /></RoleGuard>} />
        <Route path="historical-import" element={<RoleGuard><HistoricalImportPage /></RoleGuard>} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
