import { useState } from "react";
import { trpc } from "@/providers/trpc";
import {
  UserCog,
  Plus,
  X,
  Pencil,
  Trash2,
  ToggleRight,
  Mail,
} from "lucide-react";

export default function SalesRepsPage() {
  const utils = trpc.useUtils();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const { data: reps, isLoading } = trpc.salesRep.list.useQuery();

  const createRep = trpc.salesRep.create.useMutation({
    onSuccess: () => { utils.salesRep.list.invalidate(); setShowForm(false); resetForm(); },
  });
  const updateRep = trpc.salesRep.update.useMutation({
    onSuccess: () => { utils.salesRep.list.invalidate(); setShowForm(false); setEditingId(null); },
  });
  const toggleActive = trpc.salesRep.toggleActive.useMutation({
    onSuccess: () => utils.salesRep.list.invalidate(),
  });
  const deleteRep = trpc.salesRep.delete.useMutation({
    onSuccess: () => utils.salesRep.list.invalidate(),
  });

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    region: "",
    vehicleReg: "",
  });

  function resetForm() {
    setFormData({ name: "", email: "", phone: "", region: "", vehicleReg: "" });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display font-semibold text-white" style={{ fontSize: "clamp(1.8rem, 3vw, 2.5rem)", letterSpacing: "-0.03em" }}>Sales Reps</h1>
          <p className="text-[#8A8B8C] font-body text-sm mt-1">{(reps || []).length} sales representatives</p>
        </div>
        <button onClick={() => { setShowForm(true); resetForm(); setEditingId(null); }} className="btn-primary"><Plus className="w-4 h-4" /> Add Sales Rep</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <div key={i} className="card-surface p-6"><div className="shimmer h-32 rounded" /></div>)
        ) : (
          (reps || []).map((rep) => (
            <div key={rep.id} className="card-surface p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(212, 168, 67, 0.12)" }}>
                    <span className="font-display font-semibold text-lg" style={{ color: "#D4A843" }}>{rep.name?.split(" ").map((n) => n[0]).join("").toUpperCase() || "?"}</span>
                  </div>
                  <div>
                    <h3 className="font-display font-medium text-white">{rep.name || "Unnamed"}</h3>
                    <p className="text-xs text-[#8A8B8C] font-body">{rep.email || "No email"}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => { setFormData({ name: rep.name || "", email: rep.email || "", phone: "", region: "", vehicleReg: "" }); setEditingId(rep.id); setShowForm(true); }} className="p-1.5 hover:text-[#D4A843] transition-colors cursor-pointer"><Pencil className="w-4 h-4 text-[#8A8B8C]" /></button>
                  <button onClick={() => { if (confirm("Delete this sales rep?")) deleteRep.mutate({ id: rep.id }); }} className="p-1.5 hover:text-[#EF4444] transition-colors cursor-pointer"><Trash2 className="w-4 h-4 text-[#8A8B8C]" /></button>
                </div>
              </div>

              {rep.email && <div className="flex items-center gap-2 text-sm text-[#8A8B8C]"><Mail className="w-3.5 h-3.5" /> {rep.email}</div>}

              <div className="flex items-center justify-between pt-4 mt-4" style={{ borderTop: "1px solid #222324" }}>
                <span className="status-badge text-xs" style={{ backgroundColor: rep.role === "admin" ? "rgba(212, 168, 67, 0.12)" : "rgba(74, 222, 128, 0.12)", color: rep.role === "admin" ? "#D4A843" : "#4ADE80" }}>{rep.role?.toUpperCase() || "USER"}</span>
                <button onClick={() => toggleActive.mutate({ id: rep.id })} className="cursor-pointer" title="Toggle active status"><ToggleRight className="w-6 h-6 text-[#4ADE80]" /></button>
              </div>
            </div>
          ))
        )}
        {!isLoading && (!reps || reps.length === 0) && (
          <div className="col-span-full card-surface p-12 text-center text-[#8A8B8C] font-body">
            <UserCog className="w-12 h-12 mx-auto mb-3 opacity-30" />
            No sales reps yet. Add your first sales rep to get started.
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.7)" }}>
          <div className="card-surface p-8 max-w-md w-full mx-4" style={{ borderRadius: 16 }}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display font-semibold text-white text-xl">{editingId ? "Edit" : "Add"} Sales Rep</h2>
              <button onClick={() => setShowForm(false)} className="cursor-pointer"><X className="w-5 h-5 text-[#8A8B8C]" /></button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); if (editingId) { updateRep.mutate({ id: editingId, ...formData }); } else { createRep.mutate(formData); } }} className="space-y-4">
              <div><label className="label-text block mb-1.5">Full Name *</label><input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="input-field" required /></div>
              <div><label className="label-text block mb-1.5">Email *</label><input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="input-field" required /></div>
              <div><label className="label-text block mb-1.5">Phone</label><input type="text" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="input-field" placeholder="+27612345678" /></div>
              <div><label className="label-text block mb-1.5">Region</label><input type="text" value={formData.region} onChange={(e) => setFormData({ ...formData, region: e.target.value })} className="input-field" placeholder="e.g., Gauteng North" /></div>
              <div><label className="label-text block mb-1.5">Vehicle Registration</label><input type="text" value={formData.vehicleReg} onChange={(e) => setFormData({ ...formData, vehicleReg: e.target.value })} className="input-field" placeholder="e.g., GP 123 GP" /></div>
              <button type="submit" className="btn-primary w-full justify-center">{editingId ? "Update" : "Add"} Sales Rep</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
