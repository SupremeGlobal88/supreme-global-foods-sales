import { useState, useEffect } from "react";
import { Outlet } from "react-router";
import Sidebar from "./Sidebar";

export default function Layout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setSidebarCollapsed(true);
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0C0D0E" }}>
      <Sidebar />
      <main
        className="min-h-screen transition-all duration-300"
        style={{
          marginLeft: sidebarCollapsed ? 72 : 280,
          padding: 32,
        }}
      >
        <Outlet />
      </main>
    </div>
  );
}
