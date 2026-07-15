import { Routes, Route, Navigate, useLocation } from "react-router";
import { useEffect } from "react";
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
import CustomerStatementPage from "./pages/CustomerStatementPage";
import { ShieldAlert } from "lucide-react";

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

  useEffect(() => {
    checkUrlForFirebaseConfig();
    // Register dataService reload so Firebase can refresh in-memory data after cloud download
    registerDataServiceRefresh(reloadFromStorage);
    // Initialize Firebase from saved config (if any), then start auto-sync
    initFirebase();
    const unsub = initAutoSync();
    // CLOUD-FIRST: Clear stale localStorage and pull ALL data from Firebase.
    // This ensures NO stale device data — every load starts with pure cloud data.
    try {
      if (isFirebaseReady()) {
        // Keep only Firebase config and user auth — clear ALL app data
        const fbConfig = localStorage.getItem("sgf_firebase_config");
        const user = localStorage.getItem("sgf_current_user");
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith("sgf_") && key !== "sgf_firebase_config" && key !== "sgf_current_user") {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach((k) => localStorage.removeItem(k));
        console.log("[CloudFirst] Cleared", keysToRemove.length, "stale localStorage keys");

        // Pull ALL fresh data from Firebase
        setTimeout(() => {
          pullFromCloud().then((counts) => {
            reloadFromStorage();
            queryClient.invalidateQueries({ refetchType: "all" });
            console.log("[CloudFirst] Fresh cloud data loaded:", counts);
          }).catch((e) => console.warn("[CloudFirst] Pull failed:", e));
        }, 2000);
      }
    } catch (e) { console.warn("[CloudFirst] Setup error:", e); }
    return () => { unsub(); };
  }, []);

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
      }
      if (type === "followUps" || type === "followUpActions") {
        utils.followUp.list.refetch();
        utils.followUpAction.list.refetch();
      }
    };
    window.addEventListener("firebaseDataReceived", handler);
    return () => window.removeEventListener("firebaseDataReceived", handler);
  }, [utils]);

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
