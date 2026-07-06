import { useState, useEffect } from "react";
import { Outlet } from "react-router";
import { RefreshCw } from "lucide-react";
import Sidebar from "./Sidebar";
import SyncStatus from "./SyncStatus";

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showRefreshPrompt, setShowRefreshPrompt] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) setSidebarOpen(false);
    };
    handleResize();
    window.addEventListener("resize", handleResize);

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
      {/* Mobile: hamburger overlay backdrop */}
      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 z-40"
          style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <Sidebar
        isMobile={isMobile}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
      />

      {/* Main content */}
      <main
        className="min-h-screen transition-all duration-300"
        style={{
          marginLeft: isMobile ? 0 : 72,
          padding: isMobile ? "56px 12px 80px" : "32px 32px 80px",
        }}
      >
        {/* Mobile hamburger button */}
        {isMobile && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="fixed top-2 left-2 z-30 w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: "#1A1A1B", border: "1px solid #222324" }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D4A843" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        )}

        {/* Refresh notification */}
        {showRefreshPrompt && (
          <div
            className="fixed left-0 right-0 z-30 flex items-center justify-center gap-2"
            style={{
              top: isMobile ? 0 : 0,
              background: "rgba(212, 168, 67, 0.15)",
              borderBottom: "1px solid rgba(212, 168, 67, 0.4)",
              padding: isMobile ? "6px 8px" : "8px 16px",
              fontSize: isMobile ? 11 : 13,
              color: "#D4A843",
              flexWrap: "wrap",
            }}
          >
            <RefreshCw className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">New data received.</span>
            <button
              onClick={() => window.location.reload()}
              className="flex-shrink-0"
              style={{
                background: "#D4A843",
                border: "none",
                borderRadius: 6,
                padding: isMobile ? "3px 8px" : "4px 12px",
                color: "#000",
                fontSize: isMobile ? 11 : 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Refresh
            </button>
            <button
              onClick={() => setShowRefreshPrompt(false)}
              className="flex-shrink-0"
              style={{
                background: "none",
                border: "none",
                color: "#8A8B8C",
                fontSize: isMobile ? 11 : 12,
                cursor: "pointer",
              }}
            >
              Dismiss
            </button>
          </div>
        )}

        <Outlet />
      </main>

      <SyncStatus isMobile={isMobile} />
    </div>
  );
}
