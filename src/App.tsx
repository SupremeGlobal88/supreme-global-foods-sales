import { Routes, Route, Navigate, useLocation } from "react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { initFirebase, initAutoSync, registerDataServiceRefresh } from "@/lib/firebaseSync";
import { reloadFromStorage } from "@/lib/dataService";
import { trpc } from "@/providers/trpc";
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
    return () => { unsub(); };
  }, []);

  // When Firebase data changes, invalidate tRPC queries so UI refreshes automatically
  useEffect(() => {
    const handler = (e: any) => {
      const type = e.detail?.type;
      // Invoices: orders page GenerateInvoiceButton + invoices page
      if (type === "invoices") {
        utils.invoice.list.invalidate();
        utils.invoice.getStats.invalidate();
        utils.invoice.getCustomerStatement.invalidate();
      }
      // Orders: orders page list + dashboard stats
      if (type === "orders") {
        utils.order.list.invalidate();
        utils.order.getStats.invalidate();
        utils.dashboard.stats.invalidate();
      }
      // Checkins: appointments page
      if (type === "checkins") {
        utils.checkIn.list.invalidate();
        utils.checkIn.getStats.invalidate();
      }
      // Appointments: appointments page
      if (type === "appointments") {
        utils.appointment.list.invalidate();
        utils.appointment.getStats.invalidate();
      }
      // Customers: customers page + orders page
      if (type === "customers") {
        utils.customer.search.invalidate();
        utils.customer.list.invalidate();
        utils.customer.getStats.invalidate();
      }
      // Stock: stock page
      if (type === "stock") {
        utils.stock.list.invalidate();
        utils.stock.search.invalidate();
        utils.stock.getStats.invalidate();
      }
      // Follow-up actions: follow-ups page
      if (type === "followUpActions") {
        utils.followUpAction.list.invalidate();
        utils.followUpAction.getStats.invalidate();
        utils.followUp.list.invalidate();
        utils.followUp.getStats.invalidate();
        utils.sampleReport.getAll.invalidate();
      }
      // Orders: also refresh sample reports since samples create orders
      if (type === "orders") {
        utils.sampleReport.getAll.invalidate();
        utils.followUp.list.invalidate();
        utils.followUp.getStats.invalidate();
      }
      // Follow-ups: follow-ups page + sample reports
      if (type === "followUps") {
        utils.followUp.list.invalidate();
        utils.followUp.getStats.invalidate();
        utils.sampleReport.getAll.invalidate();
      }
      // Receipts: invoices page receipts
      if (type === "receipts") {
        utils.invoice.getReceipts.invalidate();
        utils.invoice.getReceiptsByInvoice.invalidate();
        utils.invoice.getReceiptsByCustomer.invalidate();
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
