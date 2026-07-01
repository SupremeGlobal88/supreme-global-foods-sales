import { useState, useEffect } from "react";
import { Outlet } from "react-router";
import { RefreshCw } from "lucide-react";
import Sidebar from "./Sidebar";
import SyncStatus from "./SyncStatus";

export default function Layout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showRefreshPrompt, setShowRefreshPrompt] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setSidebarCollapsed(true);
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);

    // Listen for new Firebase data from sales reps
    const handleFirebaseData = () => {
      setShowRefreshPrompt(true);
    };
    window.addEventListener("firebaseDataReceived", handleFirebaseData);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("firebaseDataReceived", handleFirebaseData);
    };
  }, []);

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0C0D0E" }}>
      {showRefreshPrompt && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 100,
            background: "rgba(212, 168, 67, 0.15)",
            borderBottom: "1px solid rgba(212, 168, 67, 0.4)",
            padding: "8px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            fontSize: 13,
            color: "#D4A843",
          }}
        >
          <RefreshCw className="w-4 h-4" />
          <span>New data received from sales rep. Refresh to see updates.</span>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: "#D4A843",
              border: "none",
              borderRadius: 6,
              padding: "4px 12px",
              color: "#000",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Refresh
          </button>
          <button
            onClick={() => setShowRefreshPrompt(false)}
            style={{
              background: "none",
              border: "none",
              color: "#8A8B8C",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            Dismiss
          </button>
        </div>
      )}
      <Sidebar />
      <main
        className="min-h-screen transition-all duration-300"
        style={{
          marginLeft: sidebarCollapsed ? 72 : 280,
          padding: 32,
          paddingTop: showRefreshPrompt ? 56 : 32,
        }}
      >
        <Outlet />
      </main>
      <SyncStatus />
    </div>
  );
}
