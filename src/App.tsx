import { Routes, Route, Navigate } from "react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { initFirebase, initAutoSync, registerDataServiceRefresh } from "@/lib/firebaseSync";
import { reloadFromStorage } from "@/lib/dataService";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import StockPage from "./pages/StockPage";
import CustomersPage from "./pages/CustomersPage";
import OrdersPage from "./pages/OrdersPage";
import InvoicesPage from "./pages/InvoicesPage";
import AppointmentsPage from "./pages/AppointmentsPage";
import SalesRepsPage from "./pages/SalesRepsPage";
import SettingsPage from "./pages/SettingsPage";
import FollowUpsPage from "./pages/FollowUpsPage";
import CollectionsPage from "./pages/CollectionsPage";
import SampleReportsPage from "./pages/SampleReportsPage";

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
  useEffect(() => {
    checkUrlForFirebaseConfig();
    // Register dataService reload so Firebase can refresh in-memory data after cloud download
    registerDataServiceRefresh(reloadFromStorage);
    // Initialize Firebase from saved config (if any), then start auto-sync
    initFirebase();
    const unsub = initAutoSync();
    return () => { unsub(); };
  }, []);

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
        <Route path="invoices" element={<InvoicesPage />} />
        <Route path="appointments" element={<AppointmentsPage />} />
        <Route path="sales-reps" element={<SalesRepsPage />} />
        <Route path="follow-ups" element={<FollowUpsPage />} />
        <Route path="collections" element={<CollectionsPage />} />
        <Route path="sample-reports" element={<SampleReportsPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
