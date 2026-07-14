import { useState, useEffect } from "react";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { reloadFromStorage, dataService } from "@/lib/dataService";
import { Bell, CheckCircle, Clock, AlertTriangle, MessageSquare, Calendar } from "lucide-react";

export default function FollowUpsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  const myRepName = user?.name || "";
  const utils = trpc.useUtils();

  const { data: followUpsRpc } = trpc.followUp.list.useQuery(undefined, { refetchInterval: 5000 });
  const { data: statsRpc } = trpc.followUp.getStats.useQuery(undefined, { refetchInterval: 5000 });

  // Direct dataService check — bypasses tRPC cache
  const [liveFollowUps, setLiveFollowUps] = useState<any[]>([]);
  useEffect(() => {
    function refresh() {
      setLiveFollowUps(dataService.followUp.list() || []);
    }
    refresh();
    const interval = setInterval(refresh, 3000);
    window.addEventListener("firebaseDataReceived", refresh);
    return () => { clearInterval(interval); window.removeEventListener("firebaseDataReceived", refresh); };
  }, []);

  // Use live data if available, fall back to tRPC
  const followUps = liveFollowUps.length > 0 ? liveFollowUps : (followUpsRpc || []);
  const stats = statsRpc;

  const [showForm, setShowForm] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [expectedDate, setExpectedDate] = useState("");

  const updateFollowUp = trpc.followUp.update.useMutation({
    onSuccess: async () => { reloadFromStorage(); await utils.followUp.list.invalidate(); await utils.followUp.getStats.invalidate(); setShowForm(null); setReason(""); setExpectedDate(""); },
  });

  const handleSubmit = (id: number) => {
    updateFollowUp.mutate({
      id,
      status: "completed",
      reason: reason || undefined,
      expectedOrderDate: expectedDate || undefined,
    });
  };

  const myFollowUps = isAdmin
    ? (followUps || [])
    : (followUps || []).filter((fu: any) => {
        const cust = fu.customer;
        return cust?.salesRepName === myRepName;
      });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display font-semibold text-white" style={{ fontSize: "clamp(1.8rem, 3vw, 2.5rem)", letterSpacing: "-0.03em" }}>Follow-ups</h1>
          <p className="text-[#8A8B8C] font-body text-sm mt-1">
            {stats?.pending || 0} pending &middot; {stats?.completed || 0} completed &middot; {stats?.overdue || 0} overdue
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="card-surface p-4">
          <div className="label-text mb-1">PENDING</div>
          <div className="stat-number" style={{ color: "#F59E0B" }}>{stats?.pending || 0}</div>
        </div>
        <div className="card-surface p-4">
          <div className="label-text mb-1">COMPLETED</div>
          <div className="stat-number" style={{ color: "#4ADE80" }}>{stats?.completed || 0}</div>
        </div>
        <div className="card-surface p-4">
          <div className="label-text mb-1">OVERDUE</div>
          <div className="stat-number" style={{ color: "#EF4444" }}>{stats?.overdue || 0}</div>
        </div>
      </div>

      {myFollowUps.length === 0 ? (
        <div className="card-surface p-12 text-center">
          <Bell className="w-16 h-16 mx-auto mb-4 opacity-20" style={{ color: "#D4A843" }} />
          <p className="text-[#8A8B8C] font-body">No follow-ups required at this time</p>
          <p className="text-[#8A8B8C] text-sm mt-1">Follow-ups appear 4 days after a sample is sent to a customer</p>
        </div>
      ) : (
        <div className="space-y-4">
          {myFollowUps.map((fu: any) => {
            const isOverdue = new Date(fu.followUpDate) < new Date();
            return (
              <div key={fu.id} className="card-surface p-6" style={{ borderLeft: isOverdue ? "3px solid #EF4444" : "3px solid #F59E0B" }}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      {isOverdue ? (
                        <AlertTriangle className="w-5 h-5 text-[#EF4444]" />
                      ) : (
                        <Clock className="w-5 h-5 text-[#F59E0B]" />
                      )}
                      <span className="font-mono-data text-xs" style={{ color: isOverdue ? "#EF4444" : "#F59E0B" }}>
                        {isOverdue ? "OVERDUE" : "DUE"} — {new Date(fu.followUpDate).toLocaleDateString("en-ZA")}
                      </span>
                    </div>
                    <h3 className="font-display font-semibold text-white text-lg">{fu.customer?.name || "Unknown Customer"}</h3>
                    <p className="text-[#8A8B8C] text-sm font-body">
                      Sample order: {fu.orderNumber} &middot; Sent: {new Date(fu.createdAt).toLocaleDateString("en-ZA")}
                    </p>
                    {fu.order?.items && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {fu.order.items.map((item: any, idx: number) => (
                          <span key={idx} className="status-badge text-xs" style={{ backgroundColor: "rgba(212, 168, 67, 0.12)", color: "#D4A843" }}>
                            {item.productName} ({item.quantity})
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => setShowForm(showForm === fu.id ? null : fu.id)}
                    className="btn-primary text-sm"
                  >
                    <MessageSquare className="w-4 h-4" /> Follow Up
                  </button>
                </div>

                {showForm === fu.id && (
                  <div className="mt-4 p-4 rounded-lg" style={{ backgroundColor: "#0A0A0B" }}>
                    <h4 className="text-white font-body font-medium mb-3">Record Follow-up Result</h4>
                    <div className="space-y-3">
                      <div>
                        <label className="label-text block mb-1.5">Why is the customer not placing an order? *</label>
                        <textarea
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          className="input-field"
                          rows={3}
                          placeholder="e.g. Customer evaluating quality, will decide next week..."
                          required
                        />
                      </div>
                      <div>
                        <label className="label-text block mb-1.5">When will the customer place an order? (Optional)</label>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-[#8A8B8C]" />
                          <input
                            type="date"
                            value={expectedDate}
                            onChange={(e) => setExpectedDate(e.target.value)}
                            className="input-field"
                          />
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <button onClick={() => handleSubmit(fu.id)} className="btn-primary">
                          <CheckCircle className="w-4 h-4" /> Complete Follow-up
                        </button>
                        <button onClick={() => setShowForm(null)} className="btn-secondary">Cancel</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
