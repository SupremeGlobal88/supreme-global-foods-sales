import { Routes, Route, Navigate, useLocation } from "react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { initFirebase, initAutoSync, registerDataServiceRefresh, isFirebaseReady, pullFromCloud } from "@/lib/firebaseSync";
import { reloadFromStorage, repairInvoiceCompanies } from "@/lib/dataService";
import { queryClient } from "@/providers/trpc";
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
  const [isCloudReady, setIsCloudReady] = useState(false);
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    checkUrlForFirebaseConfig();
    registerDataServiceRefresh(reloadFromStorage);
    initFirebase();
    const unsub = initAutoSync();

    // Load local data FIRST so the app renders immediately with cached data
    reloadFromStorage();
    repairInvoiceCompanies();

    // Cloud-first: Pull from cloud in BACKGROUND without blocking UI
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

    // Show loading screen for max 3 seconds
    const safetyTimer = setTimeout(() => {
      setIsCloudReady(true);
    }, 3000);

    return () => { unsub(); clearTimeout(safetyTimer); };
  }, []);

  // POST-LOGIN SYNC
  useEffect(() => {
    if (isAuthenticated && isCloudReady) {
      console.log("[Sync] Post-login sync triggered");
      reloadFromStorage();
      console.log("[Sync] Post-login complete");
    }
  }, [isAuthenticated, isCloudReady]);

  // CRITICAL FIX: Use FLAT query keys (not nested arrays) for tRPC React Query.
  // tRPC stores queries as ["order","list"] not [["order","list"]].
  // Nested arrays were preventing invalidation — queries never refetched.
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
        for (const t of pendingTypes) {
          switch (t) {
            case "invoices":
              queryClient.invalidateQueries({ queryKey: ["invoice","list"], refetchType: "active" });
              queryClient.invalidateQueries({ queryKey: ["invoice","getStats"], refetchType: "active" });
              break;
            case "orders":
              queryClient.invalidateQueries({ queryKey: ["order","list"], refetchType: "active" });
              queryClient.invalidateQueries({ queryKey: ["order","getStats"], refetchType: "active" });
              break;
            case "customers":
              queryClient.invalidateQueries({ queryKey: ["customer","search"], refetchType: "active" });
              queryClient.invalidateQueries({ queryKey: ["customer","list"], refetchType: "active" });
              break;
            case "appointments":
              queryClient.invalidateQueries({ queryKey: ["appointment","list"], refetchType: "active" });
              break;
            case "checkins":
              queryClient.invalidateQueries({ queryKey: ["checkIn","list"], refetchType: "active" });
              break;
            case "stock":
              queryClient.invalidateQueries({ queryKey: ["stock","list"], refetchType: "active" });
              queryClient.invalidateQueries({ queryKey: ["stock","search"], refetchType: "active" });
              queryClient.invalidateQueries({ queryKey: ["stock","getStats"], refetchType: "active" });
              break;
            case "creditNotes":
              queryClient.invalidateQueries({ queryKey: ["invoice","getCreditNotes"], refetchType: "active" });
              queryClient.invalidateQueries({ queryKey: ["invoice","list"], refetchType: "active" });
              break;
            case "followUps":
              queryClient.invalidateQueries({ queryKey: ["followUp","list"], refetchType: "active" });
              break;
            case "followUpActions":
              queryClient.invalidateQueries({ queryKey: ["followUpAction","list"], refetchType: "active" });
              break;
            case "users":
              queryClient.invalidateQueries({ queryKey: ["user","list"], refetchType: "active" });
              break;
            case "salesReps":
              queryClient.invalidateQueries({ queryKey: ["customer","getSalesReps"], refetchType: "active" });
              break;
            case "corporateCustomers":
              queryClient.invalidateQueries({ queryKey: ["corporateCustomer","list"], refetchType: "active" });
              break;
            case "purchaseOrders":
              queryClient.invalidateQueries({ queryKey: ["purchaseOrder","list"], refetchType: "active" });
              break;
            case "barrels":
              queryClient.invalidateQueries({ queryKey: ["barrel","list"], refetchType: "active" });
              break;
            case "certificatesOfCompliance":
              queryClient.invalidateQueries({ queryKey: ["coc","list"], refetchType: "active" });
              break;
            case "packingListLines":
              queryClient.invalidateQueries({ queryKey: ["packingList","listByPurchaseOrder"], refetchType: "active" });
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
