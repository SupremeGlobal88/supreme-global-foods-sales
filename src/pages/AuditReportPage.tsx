import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { format } from "date-fns";
import {
  Search, FileText, User, Calendar, AlertTriangle, Eye,
  Package, DollarSign, Users, Tag, Truck, ClipboardList, Clock,
} from "lucide-react";

const ENTITY_ICONS: Record<string, any> = {
  order: ClipboardList,
  invoice: FileText,
  stock: Package,
  user: Users,
  customer: User,
  specialPrice: Tag,
  collectionNote: FileText,
  collectionPromise: DollarSign,
  accountHold: AlertTriangle,
  followUp: Truck,
  quote: FileText,
  purchaseOrder: ClipboardList,
  corporateCustomer: User,
  barrel: Package,
  coc: FileText,
  packingList: Package,
  creditNote: FileText,
};

const ACTION_COLORS: Record<string, string> = {
  CREATE: "#10B981",
  UPDATE: "#6366F1",
  DELETE: "#EF4444",
  PAYMENT: "#D4A843",
  TOGGLE_ACTIVE: "#F59E0B",
  RESET_PIN: "#8B5CF6",
  ADDRESS_CHANGE: "#EC4899",
  BULK_UPLOAD: "#06B6D4",
  AUTO_CLEANUP: "#6B7280",
};

const ACTION_LABELS: Record<string, string> = {
  CREATE: "Created",
  UPDATE: "Updated",
  DELETE: "Deleted",
  PAYMENT: "Payment",
  TOGGLE_ACTIVE: "Active Toggled",
  RESET_PIN: "PIN Reset",
  ADDRESS_CHANGE: "Address Changed",
  BULK_UPLOAD: "Bulk Upload",
  AUTO_CLEANUP: "Auto Cleanup",
};

export default function AuditReportPage() {
  const { user } = useAuth();
  const { isAdmin } = useRole();
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [filterUser, setFilterUser] = useState("");
  const [filterEntity, setFilterEntity] = useState("");
  const [filterAction, setFilterAction] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data: auditLog = [] } = useQuery({
    queryKey: ["audit-list"],
    queryFn: () => utils.client.audit.list.query(),
    enabled: isAdmin,
  });

  const allUsers = useMemo(() => {
    const names = new Set(auditLog.map((e: any) => e.userName).filter(Boolean));
    return Array.from(names).sort();
  }, [auditLog]);

  const allEntities = useMemo(() => {
    const types = new Set(auditLog.map((e: any) => e.entityType).filter(Boolean));
    return Array.from(types).sort();
  }, [auditLog]);

  const allActions = useMemo(() => {
    const actions = new Set(auditLog.map((e: any) => e.action).filter(Boolean));
    return Array.from(actions).sort();
  }, [auditLog]);

  const filtered = useMemo(() => {
    return auditLog.filter((entry: any) => {
      const text = `${entry.action} ${entry.entityType} ${entry.entityId} ${entry.details} ${entry.userName}`.toLowerCase();
      if (search && !text.includes(search.toLowerCase())) return false;
      if (filterUser && entry.userName !== filterUser) return false;
      if (filterEntity && entry.entityType !== filterEntity) return false;
      if (filterAction && entry.action !== filterAction) return false;
      if (dateFrom) {
        const d = new Date(entry.createdAt);
        if (d < new Date(dateFrom)) return false;
      }
      if (dateTo) {
        const d = new Date(entry.createdAt);
        if (d > new Date(dateTo + "T23:59:59")) return false;
      }
      return true;
    });
  }, [auditLog, search, filterUser, filterEntity, filterAction, dateFrom, dateTo]);

  const groupedByDate = useMemo(() => {
    const groups: Record<string, any[]> = {};
    for (const entry of filtered) {
      const date = entry.createdAt ? format(new Date(entry.createdAt), "yyyy-MM-dd") : "Unknown";
      if (!groups[date]) groups[date] = [];
      groups[date].push(entry);
    }
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  if (!isAdmin) {
    return (
      <div className="page-container">
        <div className="card" style={{ textAlign: "center", padding: "4rem" }}>
          <AlertTriangle className="w-12 h-12" style={{ color: "#EF4444", margin: "0 auto 1rem" }} />
          <h2 className="text-xl font-display font-semibold text-white mb-2">Access Denied</h2>
          <p className="text-[#8A8B8C]">Only administrators can view the audit report.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="flex items-center justify-between mb-6">
        <h1 className="page-title flex items-center gap-3">
          <Eye className="w-6 h-6" style={{ color: "#D4A843" }} />
          Audit Report
        </h1>
        <div className="text-sm text-[#8A8B8C]">{filtered.length} entries</div>
      </div>

      {/* Filters */}
      <div className="card mb-6" style={{ padding: "1rem" }}>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8B8C]" />
            <input
              type="text"
              placeholder="Search audit entries..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field w-full pl-10 text-sm"
            />
          </div>
          <select value={filterUser} onChange={(e) => setFilterUser(e.target.value)} className="input-field text-sm">
            <option value="">All Users</option>
            {allUsers.map((u: string) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
          <select value={filterEntity} onChange={(e) => setFilterEntity(e.target.value)} className="input-field text-sm">
            <option value="">All Entity Types</option>
            {allEntities.map((t: string) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <select value={filterAction} onChange={(e) => setFilterAction(e.target.value)} className="input-field text-sm">
            <option value="">All Actions</option>
            {allActions.map((a: string) => (
              <option key={a} value={a}>{ACTION_LABELS[a] || a}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#8A8B8C]" />
            <span className="text-xs text-[#8A8B8C]">From:</span>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="input-field text-sm flex-1" />
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#8A8B8C]" />
            <span className="text-xs text-[#8A8B8C]">To:</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="input-field text-sm flex-1" />
          </div>
        </div>
        {(filterUser || filterEntity || filterAction || dateFrom || dateTo || search) && (
          <button
            onClick={() => {
              setSearch(""); setFilterUser(""); setFilterEntity("");
              setFilterAction(""); setDateFrom(""); setDateTo("");
            }}
            className="text-xs text-[#D4A843] mt-3 hover:underline"
          >
            Clear all filters
          </button>
        )}
      </div>

      {/* Results */}
      {groupedByDate.length === 0 ? (
        <div className="card text-center py-12">
          <Eye className="w-10 h-10 mx-auto mb-3 text-[#8A8B8C]" />
          <p className="text-[#8A8B8C]">No audit entries match your filters.</p>
        </div>
      ) : (
        groupedByDate.map(([date, entries]) => (
          <div key={date} className="mb-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "rgba(212, 168, 67, 0.12)" }}>
                <Calendar className="w-4 h-4" style={{ color: "#D4A843" }} />
              </div>
              <h3 className="text-sm font-semibold text-white">{format(new Date(date), "EEEE, d MMMM yyyy")}</h3>
              <span className="text-xs text-[#8A8B8C]">({entries.length} entries)</span>
            </div>
            <div className="space-y-2">
              {entries.map((entry: any) => {
                const Icon = ENTITY_ICONS[entry.entityType] || FileText;
                const color = ACTION_COLORS[entry.action] || "#8A8B8C";
                const time = entry.createdAt ? format(new Date(entry.createdAt), "HH:mm") : "--:--";
                return (
                  <div key={entry.id} className="card flex items-start gap-4" style={{ padding: "0.875rem 1rem" }}>
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${color}20` }}>
                      <Icon className="w-4 h-4" style={{ color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${color}20`, color }}>
                          {ACTION_LABELS[entry.action] || entry.action}
                        </span>
                        <span className="text-xs text-[#8A8B8C] capitalize">{entry.entityType}</span>
                        <span className="text-xs text-[#555]" style={{ fontFamily: "monospace" }}>#{entry.entityId}</span>
                      </div>
                      <p className="text-sm text-white mt-1">{entry.details}</p>
                      <div className="flex items-center gap-3 mt-1.5">
                        <div className="flex items-center gap-1 text-xs text-[#8A8B8C]">
                          <User className="w-3 h-3" />
                          {entry.userName || "Unknown"}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-[#8A8B8C]">
                          <Clock className="w-3 h-3" />
                          {time}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
