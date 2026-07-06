import { useAuth } from "./useAuth";

/** Three-tier role system:
 *  sales_rep    → own customers, place orders, view stock, appointments, follow-ups
 *  admin        → all data, invoices, collections, payments, settings
 *  super_admin  → everything + user management
 */

export type UserRole = "sales_rep" | "admin" | "super_admin";

/** Route permission map: which roles can access each route */
const ROUTE_PERMISSIONS: Record<string, UserRole[]> = {
  "/dashboard":     ["sales_rep", "admin", "super_admin"],
  "/stock":         ["sales_rep", "admin", "super_admin"],
  "/customers":     ["sales_rep", "admin", "super_admin"],
  "/orders":        ["sales_rep", "admin", "super_admin"],
  "/invoices":      ["admin", "super_admin"],
  "/appointments":  ["sales_rep", "admin", "super_admin"],
  "/sales-reps":    ["admin", "super_admin"],
  "/collections":   ["admin", "super_admin"],
  "/follow-ups":    ["sales_rep", "admin", "super_admin"],
  "/sample-reports":["sales_rep", "admin", "super_admin"],
  "/settings":      ["admin", "super_admin"],
  "/users":         ["super_admin"],
  "/historical-import": ["admin", "super_admin"],
};

/** Page-level action permissions */
const ACTION_PERMISSIONS = {
  // Stock
  stockView:     ["sales_rep", "admin", "super_admin"],
  stockEdit:     ["admin", "super_admin"],
  stockUpload:   ["admin", "super_admin"],

  // Customers
  customerViewOwn: ["sales_rep", "admin", "super_admin"],
  customerViewAll: ["admin", "super_admin"],
  customerEdit:    ["admin", "super_admin"],
  customerDelete:  ["admin", "super_admin"],
  customerImport:  ["admin", "super_admin"],

  // Orders
  orderPlace:     ["sales_rep", "admin", "super_admin"],
  orderEditOwn:   ["sales_rep", "admin", "super_admin"],
  orderEditAll:   ["admin", "super_admin"],
  orderStatusFlow:["admin", "super_admin"], // Mark Picking/Ready/Delivered
  orderCancel:    ["admin", "super_admin"],

  // Invoices
  invoiceView:    ["admin", "super_admin"],
  invoicePrint:   ["admin", "super_admin"],
  invoiceEmail:   ["admin", "super_admin"],
  invoicePayment: ["admin", "super_admin"],
  invoiceEditPay: ["admin", "super_admin"],

  // Collections
  collectionsView:   ["admin", "super_admin"],
  collectionsAction: ["admin", "super_admin"],

  // Settings
  settingsView:      ["admin", "super_admin"],
  settingsCloudSync: ["super_admin"],

  // Users
  userManage:        ["super_admin"],
} as const;

export function useRole() {
  const { user } = useAuth();
  const role = (user?.role as UserRole) || "sales_rep";

  /** Check if current user has a specific role or higher */
  const isRole = (r: UserRole) => {
    if (role === "super_admin") return true; // super_admin can do everything
    if (role === "admin") return r === "admin" || r === "sales_rep";
    return r === "sales_rep";
  };

  const isSalesRep = role === "sales_rep";
  const isAdmin = role === "admin" || role === "super_admin";
  const isSuperAdmin = role === "super_admin";

  /** Check if current user can access a route */
  const canAccess = (path: string) => {
    const allowed = ROUTE_PERMISSIONS[path];
    if (!allowed) return false;
    return allowed.includes(role);
  };

  /** Check if current user has a specific action permission */
  const can = (action: keyof typeof ACTION_PERMISSIONS) => {
    const allowed = ACTION_PERMISSIONS[action];
    if (!allowed) return false;
    return allowed.includes(role);
  };

  /** Filter navigation items by role */
  const filterNav = (items: Array<{ path: string; label: string; icon: any }>) => {
    return items.filter((item) => canAccess(item.path));
  };

  return {
    role,
    isSalesRep,
    isAdmin,
    isSuperAdmin,
    isRole,
    canAccess,
    can,
    filterNav,
  };
}
