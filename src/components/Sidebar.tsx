import { Link, useLocation } from "react-router";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import {
  LayoutDashboard, Package, Users, ShoppingCart, FileText,
  Calendar, UserCog, CreditCard, Settings, LogOut, Globe,
  Bell, FlaskConical, ShieldAlert, Archive, X, Wallet,
} from "lucide-react";

const allNavItems = [
  { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { path: "/stock", label: "Stock", icon: Package },
  { path: "/customers", label: "Customers", icon: Users },
  { path: "/orders", label: "Orders", icon: ShoppingCart },
  { path: "/invoices", label: "Invoices", icon: FileText },
  { path: "/my-invoices", label: "My Invoices", icon: Wallet },
  { path: "/appointments", label: "Appointments", icon: Calendar },
  { path: "/sales-reps", label: "Sales Reps", icon: UserCog },
  { path: "/collections", label: "Collections", icon: CreditCard },
  { path: "/follow-ups", label: "Follow-ups", icon: Bell },
  { path: "/sample-reports", label: "Samples", icon: FlaskConical },
  { path: "/settings", label: "Settings", icon: Settings },
  { path: "/users", label: "Users", icon: ShieldAlert },
  { path: "/historical-import", label: "Import", icon: Archive },
];

function roleColor(role?: string) {
  switch (role) {
    case "super_admin": return "#D4A843";
    case "admin": return "#6366F1";
    default: return "#4ADE80";
  }
}

function roleLabel(role?: string) {
  switch (role) {
    case "super_admin": return "SUPER ADMIN";
    case "admin": return "ADMIN";
    case "sales_rep": return "SALES REP";
    default: return "USER";
  }
}

interface SidebarProps {
  isMobile: boolean;
  isOpen: boolean;
  onClose: () => void;
  onToggle: () => void;
}

export default function Sidebar({ isMobile, isOpen, onClose }: SidebarProps) {
  const location = useLocation();
  const { user, logout } = useAuth();
  const { filterNav } = useRole();
  const navItems = filterNav(allNavItems);

  // Desktop: always show collapsed sidebar
  if (!isMobile) {
    return (
      <aside
        className="fixed left-0 top-0 h-screen flex flex-col border-r border-[#222324] z-40 no-print"
        style={{ width: 72, backgroundColor: "#0A0A0B" }}
      >
        <div className="flex items-center justify-center border-b border-[#222324]" style={{ height: 72 }}>
          <Globe className="w-7 h-7" style={{ color: "#D4A843" }} />
        </div>
        <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`nav-item ${isActive ? "active" : ""}`}
                title={item.label}
                style={{ justifyContent: "center", padding: "0 8px" }}
              >
                <Icon className="nav-icon" />
              </Link>
            );
          })}
        </nav>
        <div className="p-2 border-t border-[#222324]">
          <div className="flex flex-col items-center gap-2 py-2">
            <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: "#18191A" }}>
              <span className="font-display font-semibold text-sm" style={{ color: roleColor(user?.role) }}>
                {user?.name?.split(" ").map((n: string) => n[0]).join("").toUpperCase() || "U"}
              </span>
            </div>
            <button onClick={logout} className="p-1.5 rounded-md hover:bg-[#222324] cursor-pointer" title="Logout">
              <LogOut className="w-4 h-4 text-[#8A8B8C] hover:text-[#EF4444]" />
            </button>
          </div>
        </div>
      </aside>
    );
  }

  // Mobile: slide-out drawer
  return (
    <aside
      className="fixed top-0 h-screen flex flex-col z-50 no-print transition-transform duration-300"
      style={{
        width: 260,
        backgroundColor: "#0A0A0B",
        borderRight: "1px solid #222324",
        left: 0,
        transform: isOpen ? "translateX(0)" : "translateX(-100%)",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 border-b border-[#222324]" style={{ height: 56 }}>
        <div className="flex items-center gap-2">
          <Globe className="w-6 h-6" style={{ color: "#D4A843" }} />
          <div>
            <div className="font-display font-semibold text-white text-sm">Supreme</div>
            <div className="text-[10px] text-[#8A8B8C]">Sales Command</div>
          </div>
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-[#222324]">
          <X className="w-5 h-5 text-[#8A8B8C]" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-2 px-2 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={onClose}
              className={`nav-item ${isActive ? "active" : ""}`}
              style={{ padding: "10px 12px" }}
            >
              <Icon className="nav-icon w-5 h-5" />
              <span className="text-sm">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* User + Logout */}
      <div className="p-3 border-t border-[#222324]">
        <div className="flex items-center gap-3 rounded-lg p-2" style={{ backgroundColor: "#131415" }}>
          <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#18191A" }}>
            <span className="font-display font-semibold text-sm" style={{ color: roleColor(user?.role) }}>
              {user?.name?.split(" ").map((n: string) => n[0]).join("").toUpperCase() || "U"}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm text-white truncate">{user?.name || "User"}</div>
            <div className="label-text" style={{ color: roleColor(user?.role), fontSize: 9 }}>
              {roleLabel(user?.role)}
            </div>
          </div>
          <button onClick={() => { logout(); onClose(); }} className="p-1.5 rounded-md hover:bg-[#222324] cursor-pointer">
            <LogOut className="w-4 h-4 text-[#8A8B8C] hover:text-[#EF4444]" />
          </button>
        </div>
      </div>
    </aside>
  );
}
