import { useState } from "react";
import { Link, useLocation } from "react-router";
import { useAuth } from "@/hooks/useAuth";
import {
  LayoutDashboard,
  Package,
  Users,
  ShoppingCart,
  FileText,
  Calendar,
  UserCog,
  CreditCard,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Globe,
  Bell,
  FlaskConical,
} from "lucide-react";

const navItems = [
  { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { path: "/stock", label: "Stock on Hand", icon: Package },
  { path: "/customers", label: "Customers", icon: Users },
  { path: "/orders", label: "Orders", icon: ShoppingCart },
  { path: "/invoices", label: "Invoices", icon: FileText },
  { path: "/appointments", label: "Appointments", icon: Calendar },
  { path: "/sales-reps", label: "Sales Reps", icon: UserCog },
  { path: "/collections", label: "Collections", icon: CreditCard },
  { path: "/follow-ups", label: "Follow-ups", icon: Bell },
  { path: "/sample-reports", label: "Sample Reports", icon: FlaskConical },
  { path: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const { user, logout } = useAuth();

  return (
    <aside
      className="fixed left-0 top-0 h-screen flex flex-col border-r border-[#222324] z-40 transition-all duration-300 no-print"
      style={{
        width: collapsed ? 72 : 280,
        backgroundColor: "#0A0A0B",
      }}
    >
      {/* Brand */}
      <div
        className="flex items-center gap-3 px-4 border-b border-[#222324] transition-all duration-300"
        style={{ height: 72 }}
      >
        <Globe className="w-7 h-7 flex-shrink-0" style={{ color: "#D4A843" }} />
        {!collapsed && (
          <div className="overflow-hidden">
            <div className="font-display font-semibold text-white text-base tracking-tight">
              Supreme
            </div>
            <div className="text-xs text-[#8A8B8C] font-body">Sales Command</div>
          </div>
        )}
      </div>

      {/* Toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 w-6 h-6 rounded-full flex items-center justify-center cursor-pointer z-50"
        style={{ backgroundColor: "#D4A843", border: "2px solid #0A0A0B" }}
      >
        {collapsed ? (
          <ChevronRight className="w-3 h-3 text-[#0A0A0B]" />
        ) : (
          <ChevronLeft className="w-3 h-3 text-[#0A0A0B]" />
        )}
      </button>

      {/* Nav */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-item ${isActive ? "active" : ""}`}
              title={collapsed ? item.label : undefined}
              style={collapsed ? { justifyContent: "center", padding: "0 12px" } : {}}
            >
              <Icon className="nav-icon" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="p-3 border-t border-[#222324]">
        <div
          className="flex items-center gap-3 rounded-lg p-2"
          style={{ backgroundColor: "#131415" }}
        >
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: "#18191A" }}
          >
            <span className="font-display font-semibold text-sm" style={{ color: "#D4A843" }}>
              {user?.name
                ?.split(" ")
                .map((n: string) => n[0])
                .join("")
                .toUpperCase() || "U"}
            </span>
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <div className="text-sm text-white truncate font-body">
                {user?.name || "User"}
              </div>
              <div className="label-text" style={{ color: "#D4A843" }}>
                {user?.role?.toUpperCase() || "USER"}
              </div>
            </div>
          )}
          {!collapsed && (
            <button
              onClick={logout}
              className="p-1.5 rounded-md hover:bg-[#222324] transition-colors cursor-pointer"
              title="Logout"
            >
              <LogOut className="w-4 h-4 text-[#8A8B8C] hover:text-[#EF4444] transition-colors" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
