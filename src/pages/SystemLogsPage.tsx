import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { format } from "date-fns";
import {
  Search, Terminal, AlertTriangle, Info, AlertCircle, Bug,
  Filter, Calendar, User, ChevronDown, ChevronUp,
} from "lucide-react";

const LEVEL_CONFIG: Record<string, { icon: any; color: string; bg: string; label: string }> = {
  INFO: { icon: Info, color: "#3B82F6", bg: "#EFF6FF", label: "Info" },
  WARN: { icon: AlertTriangle, color: "#F59E0B", bg: "#FFFBEB", label: "Warning" },
  ERROR: { icon: AlertCircle, color: "#EF4444", bg: "#FEF2F2", label: "Error" },
};

const CATEGORY_LABELS: Record<string, string> = {
  invoiceGeneration: "Invoice Generation",
  deduplicateAll: "Deduplication",
  fixDuplicateInvoiceNumbers: "Duplicate Fix",
  priceRepair: "Price Repair",
  invoiceCleanup: "Invoice Cleanup",
  sync: "Sync",
  auth: "Auth",
  general: "General",
};

export default function SystemLogsPage() {
  const { user } = useAuth();
  const { isAdmin } = useRole();
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [filterLevel, setFilterLevel] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  const { data: logs = [] } = useQuery({
    queryKey: ["system-logs-list"],
    queryFn: () => utils.client.systemLogs.list.query(),
    enabled: isAdmin,
    refetchInterval: 5000, // Auto-refresh every 5 seconds
  });

  const { data: summary } = useQuery({
    queryKey: ["system-logs-summary"],
    queryFn: () => utils.client.systemLogs.getSummary.query(),
    enabled: isAdmin,
  });

  const allLevels = useMemo(() => {
    const levels = new Set(logs.map((e: any) => e.level).filter(Boolean));
    return Array.from(levels).sort();
  }, [logs]);

  const allCategories = useMemo(() => {
    const cats = new Set(logs.map((e: any) => e.category).filter(Boolean));
    return Array.from(cats).sort();
  }, [logs]);

  const filtered = useMemo(() => {
    return logs.filter((entry: any) => {
      const text = `${entry.level} ${entry.category} ${entry.message} ${entry.userName}`.toLowerCase();
      if (search && !text.includes(search.toLowerCase())) return false;
      if (filterLevel && entry.level !== filterLevel) return false;
      if (filterCategory && entry.category !== filterCategory) return false;
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
  }, [logs, search, filterLevel, filterCategory, dateFrom, dateTo]);

  const toggleRow = (id: number) => {
    const next = new Set(expandedRows);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedRows(next);
  };

  if (!isAdmin) {
    return (
      <div className="page-container">
        <div className="card" style={{ textAlign: "center", padding: "4rem" }}>
          <AlertTriangle size={48} color="#EF4444" style={{ marginBottom: "1rem" }} />
          <h2>Access Denied</h2>
          <p style={{ color: "#6B7280" }}>Only administrators can view system logs.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
          <Terminal size={28} color="#6366F1" />
          System Logs
        </h1>
        <p style={{ color: "#6B7280", fontSize: "0.95rem" }}>
          Diagnostic events from all devices — synced via Firebase in real-time.
        </p>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
          <div className="card" style={{ padding: "1rem", textAlign: "center" }}>
            <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "#111827" }}>{summary.total || 0}</div>
            <div style={{ fontSize: "0.8rem", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Total Logs</div>
          </div>
          {Object.entries(summary.byLevel || {}).map(([level, count]) => {
            const config = LEVEL_CONFIG[level] || LEVEL_CONFIG.INFO;
            const Icon = config.icon;
            return (
              <div key={level} className="card" style={{ padding: "1rem", textAlign: "center", borderLeft: `4px solid ${config.color}` }}>
                <div style={{ fontSize: "1.75rem", fontWeight: 700, color: config.color }}>{count as number}</div>
                <div style={{ fontSize: "0.8rem", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>{config.label}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Filters */}
      <div className="card" style={{ marginBottom: "1.5rem", padding: "1rem" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", alignItems: "center" }}>
          <div style={{ position: "relative", flex: "1 1 240px", minWidth: 200 }}>
            <Search size={16} style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "#9CA3AF" }} />
            <input
              type="text"
              placeholder="Search logs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: "100%", padding: "0.6rem 0.75rem 0.6rem 2.25rem", borderRadius: "0.5rem", border: "1px solid #E5E7EB", fontSize: "0.9rem" }}
            />
          </div>

          <select value={filterLevel} onChange={(e) => setFilterLevel(e.target.value)} style={{ padding: "0.6rem 0.75rem", borderRadius: "0.5rem", border: "1px solid #E5E7EB", fontSize: "0.9rem" }}>
            <option value="">All Levels</option>
            {allLevels.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>

          <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} style={{ padding: "0.6rem 0.75rem", borderRadius: "0.5rem", border: "1px solid #E5E7EB", fontSize: "0.9rem" }}>
            <option value="">All Categories</option>
            {allCategories.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c] || c}</option>)}
          </select>

          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={{ padding: "0.6rem 0.75rem", borderRadius: "0.5rem", border: "1px solid #E5E7EB", fontSize: "0.9rem" }} />
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={{ padding: "0.6rem 0.75rem", borderRadius: "0.5rem", border: "1px solid #E5E7EB", fontSize: "0.9rem" }} />
        </div>
      </div>

      {/* Logs Table */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ maxHeight: "70vh", overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <thead style={{ position: "sticky", top: 0, background: "#F9FAFB", zIndex: 1 }}>
              <tr>
                <th style={{ padding: "0.75rem 1rem", textAlign: "left", borderBottom: "1px solid #E5E7EB", fontWeight: 600, color: "#374151", width: "80px" }}>Level</th>
                <th style={{ padding: "0.75rem 1rem", textAlign: "left", borderBottom: "1px solid #E5E7EB", fontWeight: 600, color: "#374151" }}>Category / Message</th>
                <th style={{ padding: "0.75rem 1rem", textAlign: "left", borderBottom: "1px solid #E5E7EB", fontWeight: 600, color: "#374151", width: "160px" }}>Time</th>
                <th style={{ padding: "0.75rem 1rem", textAlign: "left", borderBottom: "1px solid #E5E7EB", fontWeight: 600, color: "#374151", width: "120px" }}>User</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ padding: "3rem", textAlign: "center", color: "#9CA3AF" }}>
                    <Bug size={32} style={{ marginBottom: "0.5rem" }} />
                    <p>No system logs match your filters.</p>
                  </td>
                </tr>
              )}
              {filtered.map((entry: any) => {
                const config = LEVEL_CONFIG[entry.level] || LEVEL_CONFIG.INFO;
                const Icon = config.icon;
                const isExpanded = expandedRows.has(entry.id);
                return (
                  <>
                    <tr
                      key={entry.id}
                      onClick={() => toggleRow(entry.id)}
                      style={{ cursor: "pointer", borderBottom: "1px solid #F3F4F6", background: isExpanded ? "#F9FAFB" : "transparent" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#F9FAFB")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = isExpanded ? "#F9FAFB" : "transparent")}
                    >
                      <td style={{ padding: "0.6rem 1rem" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", padding: "0.25rem 0.5rem", borderRadius: "0.375rem", background: config.bg, color: config.color, fontWeight: 600, fontSize: "0.75rem", textTransform: "uppercase" }}>
                          <Icon size={12} />
                          {entry.level}
                        </span>
                      </td>
                      <td style={{ padding: "0.6rem 1rem" }}>
                        <div style={{ fontWeight: 500, color: "#111827", marginBottom: "0.15rem" }}>
                          {CATEGORY_LABELS[entry.category] || entry.category}
                        </div>
                        <div style={{ color: "#6B7280", fontSize: "0.8rem" }}>{entry.message}</div>
                      </td>
                      <td style={{ padding: "0.6rem 1rem", color: "#6B7280", fontSize: "0.8rem", whiteSpace: "nowrap" }}>
                        {entry.createdAt ? format(new Date(entry.createdAt), "yyyy-MM-dd HH:mm:ss") : "—"}
                      </td>
                      <td style={{ padding: "0.6rem 1rem", color: "#6B7280", fontSize: "0.8rem" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                          <User size={12} />
                          {entry.userName || "System"}
                        </div>
                      </td>
                    </tr>
                    {isExpanded && entry.meta && Object.keys(entry.meta).length > 0 && (
                      <tr style={{ background: "#F9FAFB" }}>
                        <td colSpan={4} style={{ padding: "0.75rem 1rem 0.75rem 2rem", borderBottom: "1px solid #E5E7EB" }}>
                          <div style={{ fontSize: "0.8rem", color: "#374151", fontWeight: 600, marginBottom: "0.35rem" }}>Metadata:</div>
                          <pre style={{ margin: 0, fontSize: "0.75rem", color: "#6B7280", background: "#F3F4F6", padding: "0.5rem", borderRadius: "0.375rem", overflow: "auto", maxHeight: "200px" }}>
                            {JSON.stringify(entry.meta, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ padding: "0.75rem 1rem", borderTop: "1px solid #E5E7EB", fontSize: "0.8rem", color: "#6B7280", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>Showing {filtered.length} of {logs.length} logs</span>
          <span style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
            <Info size={14} />
            Auto-refreshes every 5 seconds
          </span>
        </div>
      </div>
    </div>
  );
}
