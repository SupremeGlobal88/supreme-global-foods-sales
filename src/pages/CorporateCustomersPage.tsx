import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { reloadFromStorage } from "@/lib/dataService";
import {
  Search, Plus, Pencil, Trash2, X, Building2, MapPin, Mail, Phone, Tag, Package,
} from "lucide-react";

export default function CorporateCustomersPage() {
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    code: "",
    vatNumber: "",
    contactPerson: "",
    email: "",
    phone: "",
    deliveryAddress: "",
    city: "",
    province: "",
    postalCode: "",
    notes: "",
    isActive: true,
  });

  const { data: customers } = trpc.corporateCustomer.list.useQuery();
  const createCustomer = trpc.corporateCustomer.create.useMutation({
    onSuccess: async () => { reloadFromStorage(); await utils.corporateCustomer.list.invalidate(); setShowForm(false); resetForm(); },
  });
  const updateCustomer = trpc.corporateCustomer.update.useMutation({
    onSuccess: async () => { reloadFromStorage(); await utils.corporateCustomer.list.invalidate(); setShowForm(false); setEditingId(null); },
  });
  const deleteCustomer = trpc.corporateCustomer.delete.useMutation({
    onSuccess: async () => { reloadFromStorage(); await utils.corporateCustomer.list.invalidate(); setSelectedCustomer(null); },
  });

  const filtered = (customers || []).filter((c: any) => {
    const q = search.toLowerCase();
    return !search || (c.name?.toLowerCase().includes(q) || c.code?.toLowerCase().includes(q) || c.contactPerson?.toLowerCase().includes(q));
  });

  const selected = filtered.find((c: any) => c.id === selectedCustomer);

  function resetForm() {
    setFormData({ name: "", code: "", vatNumber: "", contactPerson: "", email: "", phone: "", deliveryAddress: "", city: "", province: "", postalCode: "", notes: "", isActive: true });
  }

  function handleEdit(c: any) {
    setFormData({
      name: c.name || "", code: c.code || "", vatNumber: c.vatNumber || "",
      contactPerson: c.contactPerson || "", email: c.email || "", phone: c.phone || "",
      deliveryAddress: c.deliveryAddress || "", city: c.city || "", province: c.province || "",
      postalCode: c.postalCode || "", notes: c.notes || "", isActive: c.isActive !== false,
    });
    setEditingId(c.id);
    setShowForm(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.name.trim()) return;
    if (editingId) {
      updateCustomer.mutate({ id: editingId, data: { ...formData } });
    } else {
      createCustomer.mutate({ ...formData, productMappings: [] });
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white flex items-center gap-2">
            <Building2 className="w-5 h-5" style={{ color: "#D4A843" }} />
            Corporate Customers
          </h1>
          <p className="text-sm text-[#8A8B8C] mt-1">Manage corporate clients who send purchase orders (e.g., Deli-Spices)</p>
        </div>
        <button onClick={() => { resetForm(); setEditingId(null); setShowForm(true); }} className="btn-gold flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Corporate Customer
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8B8C]" />
        <input
          type="text"
          placeholder="Search by name, code, or contact person..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-field pl-10 w-full"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* List */}
        <div className="lg:col-span-2 space-y-3">
          {filtered.length === 0 && (
            <div className="card-glass text-center py-12">
              <Building2 className="w-12 h-12 mx-auto mb-3 text-[#8A8B8C] opacity-30" />
              <p className="text-[#8A8B8C]">{search ? "No matching customers found" : "No corporate customers yet"}</p>
              {!search && <p className="text-xs text-[#8A8B8C] mt-1">Click &quot;Add Corporate Customer&quot; to create one</p>}
            </div>
          )}
          {filtered.map((c: any) => (
            <div
              key={c.id}
              onClick={() => setSelectedCustomer(c.id === selectedCustomer ? null : c.id)}
              className={`card-glass cursor-pointer transition-all ${selectedCustomer === c.id ? "ring-1" : "hover:border-[#333334]"}`}
              style={selectedCustomer === c.id ? { ringColor: "#D4A843" } : {}}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#1A8C3F1A" }}>
                    <Building2 className="w-5 h-5" style={{ color: "#D4A843" }} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-white">{c.name}</h3>
                      {c.code && <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: "#1A8C3F1A", color: "#4ADE80" }}>{c.code}</span>}
                      {c.isActive === false && <span className="text-xs px-2 py-0.5 rounded-full bg-red-900/30 text-red-400">Inactive</span>}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-[#8A8B8C]">
                      {c.contactPerson && <span className="flex items-center gap-1"><Tag className="w-3 h-3" />{c.contactPerson}</span>}
                      {c.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{c.email}</span>}
                      {c.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{c.phone}</span>}
                      {c.city && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{c.city}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={(e) => { e.stopPropagation(); handleEdit(c); }} className="p-1.5 rounded hover:bg-[#222324]" title="Edit"><Pencil className="w-3.5 h-3.5 text-[#8A8B8C]" /></button>
                  <button onClick={(e) => { e.stopPropagation(); if (confirm("Delete this corporate customer?")) deleteCustomer.mutate(c.id); }} className="p-1.5 rounded hover:bg-[#222324]" title="Delete"><Trash2 className="w-3.5 h-3.5 text-[#EF4444]" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Detail Panel */}
        <div className="lg:col-span-1">
          {selected ? (
            <div className="card-glass space-y-4 sticky top-4">
              <div className="flex items-center gap-3 pb-3 border-b border-[#222324]">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#1A8C3F1A" }}>
                  <Building2 className="w-5 h-5" style={{ color: "#D4A843" }} />
                </div>
                <div>
                  <h3 className="font-medium text-white">{selected.name}</h3>
                  {selected.code && <p className="text-xs text-[#8A8B8C]">Code: {selected.code}</p>}
                </div>
              </div>
              <div className="space-y-3 text-sm">
                {selected.vatNumber && <div className="flex justify-between"><span className="text-[#8A8B8C]">VAT No</span><span className="text-white">{selected.vatNumber}</span></div>}
                {selected.contactPerson && <div className="flex justify-between"><span className="text-[#8A8B8C]">Contact</span><span className="text-white">{selected.contactPerson}</span></div>}
                {selected.email && <div className="flex justify-between"><span className="text-[#8A8B8C]">Email</span><span className="text-white">{selected.email}</span></div>}
                {selected.phone && <div className="flex justify-between"><span className="text-[#8A8B8C]">Phone</span><span className="text-white">{selected.phone}</span></div>}
                {selected.deliveryAddress && (
                  <div>
                    <span className="text-[#8A8B8C]">Delivery Address</span>
                    <p className="text-white mt-1">{selected.deliveryAddress}</p>
                    {(selected.city || selected.province || selected.postalCode) && (
                      <p className="text-[#8A8B8C] text-xs mt-0.5">{[selected.city, selected.province, selected.postalCode].filter(Boolean).join(", ")}</p>
                    )}
                  </div>
                )}
                {selected.notes && (
                  <div className="pt-2 border-t border-[#222324]">
                    <span className="text-[#8A8B8C]">Notes</span>
                    <p className="text-white text-xs mt-1 whitespace-pre-wrap">{selected.notes}</p>
                  </div>
                )}
              </div>
              <div className="pt-3 border-t border-[#222324] flex gap-2">
                <button onClick={() => handleEdit(selected)} className="btn-secondary flex-1 text-xs flex items-center justify-center gap-1"><Pencil className="w-3 h-3" /> Edit</button>
                <a href={`#/purchase-orders?customer=${selected.id}`} className="btn-gold flex-1 text-xs flex items-center justify-center gap-1"><Package className="w-3 h-3" /> View POs</a>
              </div>
            </div>
          ) : (
            <div className="card-glass text-center py-12 sticky top-4">
              <Building2 className="w-12 h-12 mx-auto mb-3 text-[#8A8B8C] opacity-20" />
              <p className="text-[#8A8B8C] text-sm">Select a corporate customer to view details</p>
            </div>
          )}
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.7)" }}>
          <div className="modal-content w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">{editingId ? "Edit" : "Add"} Corporate Customer</h2>
              <button onClick={() => setShowForm(false)} className="p-1 rounded hover:bg-[#222324]"><X className="w-5 h-5 text-[#8A8B8C]" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><label className="label-text">Company Name *</label><input required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="input-field w-full" /></div>
                <div><label className="label-text">Customer Code</label><input value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value })} className="input-field w-full" placeholder="e.g., DELI001" /></div>
                <div><label className="label-text">VAT Number</label><input value={formData.vatNumber} onChange={(e) => setFormData({ ...formData, vatNumber: e.target.value })} className="input-field w-full" /></div>
                <div><label className="label-text">Contact Person</label><input value={formData.contactPerson} onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })} className="input-field w-full" /></div>
                <div><label className="label-text">Email</label><input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="input-field w-full" /></div>
                <div><label className="label-text">Phone</label><input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="input-field w-full" /></div>
                <div className="col-span-2"><label className="label-text">Delivery Address</label><input value={formData.deliveryAddress} onChange={(e) => setFormData({ ...formData, deliveryAddress: e.target.value })} className="input-field w-full" /></div>
                <div><label className="label-text">City</label><input value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} className="input-field w-full" /></div>
                <div><label className="label-text">Province</label><input value={formData.province} onChange={(e) => setFormData({ ...formData, province: e.target.value })} className="input-field w-full" /></div>
                <div><label className="label-text">Postal Code</label><input value={formData.postalCode} onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })} className="input-field w-full" /></div>
                <div className="col-span-2"><label className="label-text">Notes</label><textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} className="input-field w-full" rows={3} /></div>
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-gold">{editingId ? "Update" : "Create"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
