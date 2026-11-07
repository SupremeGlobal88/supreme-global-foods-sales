import { useState, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import { trpc } from "@/lib/trpc";
import Layout from "@/components/Layout";
import { reloadFromStorage, repairInvoiceCompanies, repairPurchaseOrderCompanies } from "@/lib/dataService";
import { initAutoSync, isFirebaseReady } from "@/lib/firebaseSync";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/lib/AuthContext";
import LoginPage from "@/pages/LoginPage";
import Dashboard from "@/pages/Dashboard";
import InvoicesPage from "@/pages/InvoicesPage";
import InvoiceDetailPage from "@/pages/InvoiceDetailPage";
import CreditNotePage from "@/pages/CreditNotePage";
import OrdersPage from "@/pages/OrdersPage";
import OrderDetailPage from "@/pages/OrderDetailPage";
import ProductsPage from "@/pages/ProductsPage";
import StockPage from "@/pages/StockPage";
import CustomersPage from "@/pages/CustomersPage";
import CustomerDetailPage from "@/pages/CustomerDetailPage";
import CustomerBalanceReportPage from "@/pages/CustomerBalanceReportPage";
import CollectionsPage from "@/pages/CollectionsPage";
import ReportsPage from "@/pages/ReportsPage";
import SalesRepReportPage from "@/pages/SalesRepReportPage";
import SettingsPage from "@/pages/SettingsPage";
import UsersPage from "@/pages/UsersPage";
import CheckInPage from "@/pages/CheckInPage";
import AppointmentsPage from "@/pages/AppointmentsPage";
import FollowUpsPage from "@/pages/FollowUpsPage";
import BarrelManagementPage from "@/pages/BarrelManagementPage";
import ProductionPage from "@/pages/ProductionPage";
import CalendarPage from "@/pages/CalendarPage";
import DocumentTemplatesPage from "@/pages/DocumentTemplatesPage";
import HistoricalImportPage from "@/pages/HistoricalImportPage";
import SalesRepManagementPage from "@/pages/SalesRepManagementPage";
import DeliveryMapPage from "@/pages/DeliveryMapPage";
import RoutePlanningPage from "@/pages/RoutePlanningPage";
import ExpenseTrackerPage from "@/pages/ExpenseTrackerPage";
import CorporateCustomersPage from "@/pages/CorporateCustomersPage";
import PurchaseOrdersPage from "@/pages/PurchaseOrdersPage";
import PurchaseOrderDetailPage from "@/pages/PurchaseOrderDetailPage";
import PackingListPage from "@/pages/PackingListPage";
import AuditLogPage from "@/pages/AuditLogPage";
import ProductEditorPage from "@/pages/ProductEditorPage";
import PriceBookPage from "@/pages/PriceBookPage";
import { registerDataServiceRefresh } from "@/lib/dataService";
import SyncDiagnosticsPage from "@/pages/SyncDiagnosticsPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      retry: 1,
    },
  },
});

const trpcClient = trpc.createClient({
  transformer: superjson,
  links: [
    httpBatchLink({
      url: "/api/trpc",
      async headers() {
        const token = localStorage.getItem("sgf_auth_token");
        return token ? { Authorization: `Bearer ${token}` } : {};
      },
    }),
  ],
});

function CloudSyncInit() {
  const [isCloudReady, setIsCloudReady] = useState(false);
  const utils = trpc.useUtils();

  useEffect(() => {
    let mounted = true;
    (async () => {
      await initAutoSync();
      if (!mounted) return;
      setIsCloudReady(true);
      registerDataServiceRefresh(reloadFromStorage);

      if (!isFirebaseReady()) {
        console.warn("Firebase not initialized — working in offline mode");
      }

      // Run company repairs once on startup
      setTimeout(() => {
        repairInvoiceCompanies();
        repairPurchaseOrderCompanies();
      }, 2000);

      reloadFromStorage();
    })();
    return () => { mounted = false; };
  }, []);

  // Debounced invalidate on firebaseDataReceived
  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const pendingTypes = new Set<string>();

    const handler = (e: any) => {
      const type = e.detail?.type;
      if (!type) return;
      pendingTypes.add(type);

      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {

        for (const t of pendingTypes) {
          switch (t) {
            case "invoices":
              utils.invoice.list.invalidate();
              utils.invoice.getStats.invalidate();
              utils.collections.getOverdueInvoices.invalidate();
              utils.collections.getDailyReport.invalidate();
              utils.collections.getStats.invalidate();
              utils.collections.getFollowUpsDue.invalidate();
              break;
            case "orders":
              utils.order.list.invalidate();
              utils.order.getStats.invalidate();
              break;
            case "customers":
              utils.customer.search.invalidate();
              utils.customer.list.invalidate();
              utils.customer.getStats.invalidate();
              break;
            case "appointments":
              utils.appointment.list.invalidate();
              break;
            case "checkIns":
              utils.checkIn.list.invalidate();
              break;
            case "stock":
            case "products":
              reloadFromStorage(["sgf_products"]);
              utils.stock.list.invalidate();
              utils.stock.search.invalidate();
              utils.stock.getStats.invalidate();
              break;
            case "creditNotes":
              utils.invoice.getCreditNotes.invalidate();
              utils.invoice.list.invalidate();
              break;
            case "followUps":
              utils.followUp.list.invalidate();
              break;
            case "followUpActions":
              utils.followUpAction.list.invalidate();
              break;
            case "users":
              reloadFromStorage(["sgf_users"]);
              utils.user.list.invalidate();
              break;
            case "salesReps":
              utils.customer.getSalesReps.invalidate();
              break;
            case "corporateCustomers":
              reloadFromStorage(["sgf_corporateCustomers"]);
              utils.corporateCustomer.list.invalidate();
              break;
            case "purchaseOrders":
              reloadFromStorage(["sgf_purchaseOrders"]);
              utils.purchaseOrder.list.invalidate();
              break;
            case "barrels":
              reloadFromStorage(["sgf_barrels"]);
              utils.barrel.list.invalidate();
              break;
            case "certificatesOfCompliance":
              reloadFromStorage(["sgf_certificatesOfCompliance"]);
              utils.coc.list.invalidate();
              break;
            case "packingListLines":
              reloadFromStorage(["sgf_packingListLines"]);
              utils.packingList.listByPurchaseOrder.invalidate();
              break;
            default:

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
  }, [utils]);

  if (!isCloudReady) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#0C0D0E" }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: "#38BDF8" }} />
          <p className="text-white/60 text-sm">Loading…</p>
        </div>
      </div>
    );
  }
  return null;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#0C0D0E" }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: "#38BDF8" }} />
          <p className="text-white/60 text-sm">Authenticating…</p>
        </div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<Layout />}>
        <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/invoices" element={<ProtectedRoute><InvoicesPage /></ProtectedRoute>} />
        <Route path="/invoices/:id" element={<ProtectedRoute><InvoiceDetailPage /></ProtectedRoute>} />
        <Route path="/credit-notes" element={<ProtectedRoute><CreditNotePage /></ProtectedRoute>} />
        <Route path="/orders" element={<ProtectedRoute><OrdersPage /></ProtectedRoute>} />
        <Route path="/orders/:id" element={<ProtectedRoute><OrderDetailPage /></ProtectedRoute>} />
        <Route path="/products" element={<ProtectedRoute><ProductsPage /></ProtectedRoute>} />
        <Route path="/stock" element={<ProtectedRoute><StockPage /></ProtectedRoute>} />
        <Route path="/customers" element={<ProtectedRoute><CustomersPage /></ProtectedRoute>} />
        <Route path="/customers/:id" element={<ProtectedRoute><CustomerDetailPage /></ProtectedRoute>} />
        <Route path="/customer-balance-report" element={<ProtectedRoute><CustomerBalanceReportPage /></ProtectedRoute>} />
        <Route path="/collections" element={<ProtectedRoute><CollectionsPage /></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute><ReportsPage /></ProtectedRoute>} />
        <Route path="/sales-rep-report" element={<ProtectedRoute><SalesRepReportPage /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
        <Route path="/users" element={<ProtectedRoute><UsersPage /></ProtectedRoute>} />
        <Route path="/check-in" element={<ProtectedRoute><CheckInPage /></ProtectedRoute>} />
        <Route path="/appointments" element={<ProtectedRoute><AppointmentsPage /></ProtectedRoute>} />
        <Route path="/follow-ups" element={<ProtectedRoute><FollowUpsPage /></ProtectedRoute>} />
        <Route path="/barrels" element={<ProtectedRoute><BarrelManagementPage /></ProtectedRoute>} />
        <Route path="/production" element={<ProtectedRoute><ProductionPage /></ProtectedRoute>} />
        <Route path="/calendar" element={<ProtectedRoute><CalendarPage /></ProtectedRoute>} />
        <Route path="/documents" element={<ProtectedRoute><DocumentTemplatesPage /></ProtectedRoute>} />
        <Route path="/historical-import" element={<ProtectedRoute><HistoricalImportPage /></ProtectedRoute>} />
        <Route path="/sales-reps" element={<ProtectedRoute><SalesRepManagementPage /></ProtectedRoute>} />
        <Route path="/delivery-map" element={<ProtectedRoute><DeliveryMapPage /></ProtectedRoute>} />
        <Route path="/route-planning" element={<ProtectedRoute><RoutePlanningPage /></ProtectedRoute>} />
        <Route path="/expenses" element={<ProtectedRoute><ExpenseTrackerPage /></ProtectedRoute>} />
        <Route path="/corporate-customers" element={<ProtectedRoute><CorporateCustomersPage /></ProtectedRoute>} />
        <Route path="/purchase-orders" element={<ProtectedRoute><PurchaseOrdersPage /></ProtectedRoute>} />
        <Route path="/purchase-orders/:id" element={<ProtectedRoute><PurchaseOrderDetailPage /></ProtectedRoute>} />
        <Route path="/packing-list/:poId" element={<ProtectedRoute><PackingListPage /></ProtectedRoute>} />
        <Route path="/audit-log" element={<ProtectedRoute><AuditLogPage /></ProtectedRoute>} />
        <Route path="/product-editor" element={<ProtectedRoute><ProductEditorPage /></ProtectedRoute>} />
        <Route path="/price-book" element={<ProtectedRoute><PriceBookPage /></ProtectedRoute>} />
        <Route path="/sync-diagnostics" element={<ProtectedRoute><SyncDiagnosticsPage /></ProtectedRoute>} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <CloudSyncInit />
          <AppRoutes />
          <Toaster />
        </AuthProvider>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
