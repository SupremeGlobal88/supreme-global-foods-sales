import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { useRole } from "@/hooks/useRole";
import { reloadFromStorage } from "@/lib/dataService";
import {
  ShieldAlert, Plus, X, Pencil, Trash2, UserCheck, UserX,
  Lock, Save, Users, Eye, EyeOff,
} from "lucide-react";

const ROLE_OPTIONS = [
  { key: "sales_rep", label: "Sales Rep", color: "#4ADE80" },
  { key: "admin", label: "Admin", color: "#6366F1" },
  { key: "super_admin", label: "Super Admin", color: "#D4A843" },
];

export default function UsersPage() {
  const { isSuperAdmin } = useRole();
  const utils = trpc.useUtils();

  const { data: userList, isLoading } = trpc.user.list.useQuery();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [showPin, setShowPin] = useState(false);

  const [form, setForm] = useState({
    name: "", email: "", role: "sales_rep" as "sales_rep" | "admin" | "super_admin",
    pin: "",
  });

  const createUser = trpc.user.create.useMutation({
    onSuccess: async () => { reloadFromStorage(); await utils.user.list.invalidate(); closeForm(); },
    onError: (err: any) => setError(err.message || "Failed to create user"),
  });
  const updateUser = trpc.user.update.useMutation({
    onSuccess: async () => { reloadFromStorage(); await utils.user.list.invalidate(); closeForm(); },
    onError: (err: any) => setError(err.message || "Failed to update user"),
  });
  const deleteUser = trpc.user.delete.useMutation({
    onSuccess: async () => { reloadFromStorage(); await utils.user.list.invalidate(); },
    onError: (err: any) => setError(err.message || "Failed to delete user"),
  });
  const toggleActive = trpc.user.toggleActive.useMutation({
    onSuccess: async () => { reloadFromStorage(); await utils.user.list.invalidate(); },
  });
  const resetPin = trpc.user.resetPin.useMutation({
    onSuccess: async () => { reloadFromStorage(); await utils.user.list.invalidate(); setShowPin(false); },
  });

  function closeForm() {
    setShowForm(false); setEditingId(null); setError("");
    setForm({ name: "", email: "", role: "sales_rep", pin: "" });
  }

  function openEdit(u: any) {
    setEditingId(u.id);
    setForm({ name: u.name || "", email: u.email || "", role: u.role || "sales_rep", pin: "" });
    setShowForm(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError("");
    if (!form.name.trim()) { setError("Name is required"); return; }
    if (!form.pin.trim() && !editingId) { setError("PIN is required for new users"); return; }
    if (editingId) {
      const data: any = { name: form.name.trim(), email: form.email.trim(), role: form.role };
      if (form.pin.trim()) data.pin = form.pin.trim();
      updateUser.mutate({ id: editingId, ...data });
    } else {
      createUser.mutate({ name: form.name.trim(), email: form.email.trim(), role: form.role, pin: form.pin.trim() });
    }
  }

  if (!isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <ShieldAlert className="w-16 h-16 mb-4" style={{ color: "#EF4444", opacity: 0.4 }} />
        <h2 className="font-display font-semibold text-white text-xl mb-2">Access Denied</h2>
        <p className="text-[#8A8B8C] font-body text-sm">Only Super Admin can access User Management.</p>
      </div>
    );
  }

  const activeUsers = (userList || []).filter((u: any) => u.isActive !== false);
  const inactiveUsers = (userList || []).filter((u: any) => u.isActive === false);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display font-semibold text-white" style={{ fontSize: "clamp(1.8rem,3vw,2.5rem)", letterSpacing: "-0.03em" }}>User Management</h1>
          <p className="text-[#8A8B8C] font-body text-sm mt-1">{activeUsers.length} active users &middot; Super Admin only</p>
        </div>
        <button onClick={() => { setShowForm(true); setEditingId(null); setForm({ name: "", email: "", role: "sales_rep", pin: "" }); }} className="btn-primary">
          <Plus className="w-4 h-4" /> Add User
        </button>
      </div>

      {/* Role Legend */}
      <div className="flex flex-wrap gap-3">
        {ROLE_OPTIONS.map((r) => (
          <div key={r.key} className="flex items-center gap-1.5 text-xs">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: r.color }} />
            <span className="text-[#8A8B8C]">{r.label}</span>
          </div>
        ))}
      </div>

      {/* Users Table */}
      <div className="card-surface overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-[#8A8B8C]">Loading users...</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr style={{ backgroundColor: "#131415", borderBottom: "1px solid #222324" }}>
                <th className="text-left p-3 label-text">Name</th>
                <th className="text-left p-3 label-text">Email</th>
                <th className="text-left p-3 label-text">Role</th>
                <th className="text-left p-3 label-text">PIN</th>
                <th className="text-center p-3 label-text">Status</th>
                <th className="text-right p-3 label-text">Actions</th>
              </tr>
            </thead>
            <tbody>
              {[...activeUsers, ...inactiveUsers].length === 0 && (
                <tr><td colSpan={6} className="text-center py-8 text-[#8A8B8C]">No users found.</td></tr>
              )}
              {[...activeUsers, ...inactiveUsers].map((u: any) => {
                const roleOpt = ROLE_OPTIONS.find((r) => r.key === u.role) || ROLE_OPTIONS[0];
                return (
                  <tr key={u.id} className="transition-colors hover:bg-[#131415]" style={{ borderBottom: "1px solid #18191A", opacity: u.isActive === false ? 0.5 : 1 }}>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${roleOpt.color}20` }}>
                          <span className="font-display font-semibold text-xs" style={{ color: roleOpt.color }}>
                            {u.name?.split(" ").map((n: string) => n[0]).join("").toUpperCase()}
                          </span>
                        </div>
                        <span className="text-sm text-white font-body">{u.name}</span>
                      </div>
                    </td>
                    <td className="p-3 text-xs text-[#8A8B8C]">{u.email || "-"}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: `${roleOpt.color}20`, color: roleOpt.color }}>
                        {roleOpt.label}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[#8A8B8C] font-mono-data">{showPin ? u.pin : "****"}</span>
                        <button onClick={() => setShowPin(!showPin)} className="p-0.5 rounded hover:bg-[#222324]">
                          {showPin ? <EyeOff className="w-3 h-3 text-[#8A8B8C]" /> : <Eye className="w-3 h-3 text-[#8A8B8C]" />}
                        </button>
                      </div>
                    </td>
                    <td className="p-3 text-center">
                      {u.isActive === false ? (
                        <span className="flex items-center justify-center gap-1 text-xs text-[#EF4444]"><UserX className="w-3.5 h-3.5" /> Inactive</span>
                      ) : (
                        <span className="flex items-center justify-center gap-1 text-xs text-[#4ADE80]"><UserCheck className="w-3.5 h-3.5" /> Active</span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(u)} className="p-1.5 rounded hover:bg-[#222324]" title="Edit"><Pencil className="w-3.5 h-3.5 text-[#D4A843]" /></button>
                        <button onClick={() => { if (confirm(`Reset PIN for ${u.name}?`)) { const newPin = prompt("Enter new PIN:"); if (newPin) resetPin.mutate({ id: u.id, pin: newPin }); } }} className="p-1.5 rounded hover:bg-[#222324]" title="Reset PIN"><Lock className="w-3.5 h-3.5 text-[#8A8B8C]" /></button>
                        <button onClick={() => toggleActive.mutate({ id: u.id })} className="p-1.5 rounded hover:bg-[#222324]" title={u.isActive === false ? "Activate" : "Deactivate"}>
                          {u.isActive === false ? <UserCheck className="w-3.5 h-3.5 text-[#4ADE80]" /> : <UserX className="w-3.5 h-3.5 text-[#F59E0B]" />}
                        </button>
                        <button onClick={() => { if (confirm(`Delete user ${u.name}?`)) deleteUser.mutate({ id: u.id }); }} className="p-1.5 rounded hover:bg-[#222324]" title="Delete"><Trash2 className="w-3.5 h-3.5 text-[#EF4444]" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* User Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.7)" }}>
          <div className="card-surface p-6 max-w-md w-full mx-4" style={{ borderRadius: 16 }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-semibold text-white text-lg">{editingId ? "Edit User" : "Add User"}</h2>
              <button onClick={closeForm} className="cursor-pointer"><X className="w-5 h-5 text-[#8A8B8C]" /></button>
            </div>
            {error && <div className="mb-4 p-3 rounded-lg text-sm" style={{ backgroundColor: "rgba(239,68,68,0.12)", color: "#EF4444" }}>{error}</div>}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label-text block mb-1.5">Full Name *</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-field" placeholder="e.g. John Smith" required />
              </div>
              <div>
                <label className="label-text block mb-1.5">Email</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input-field" placeholder="john@company.co.za" />
              </div>
              <div>
                <label className="label-text block mb-1.5">Role *</label>
                <div className="grid grid-cols-3 gap-2">
                  {ROLE_OPTIONS.map((r) => (
                    <button key={r.key} type="button" onClick={() => setForm({ ...form, role: r.key as any })} className="p-2.5 rounded-xl text-center transition-all cursor-pointer text-xs" style={{ backgroundColor: form.role === r.key ? `${r.color}20` : "#0A0A0B", border: form.role === r.key ? `2px solid ${r.color}` : "2px solid #222324", color: form.role === r.key ? r.color : "#8A8B8C" }}>
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="label-text block mb-1.5">{editingId ? "New PIN (leave blank to keep current)" : "PIN *"}</label>
                <input type="text" value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value })} className="input-field" placeholder={editingId ? "••••" : "4-digit PIN"} maxLength={10} required={!editingId} />
              </div>
              <button type="submit" className="btn-primary w-full justify-center"><Save className="w-4 h-4" /> {editingId ? "Update User" : "Create User"}</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
