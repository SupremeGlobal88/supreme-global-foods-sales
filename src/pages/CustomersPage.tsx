import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  X,
  Users,
  MapPin,
  Phone,
  Mail,
  Download,
  FileText,
} from "lucide-react";

export default function CustomersPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const utils = trpc.useUtils();

  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    customerCode: "",
    name: "",
    businessName: "",
    contactPerson: "",
    phone: "",
    email: "",
    physicalAddress: "",
    city: "",
    province: "",
    postalCode: "",
    paymentTerms: "cod" as "cod" | "7_days" | "14_days" | "30_days",
    vatNumber: "",
    notes: "",
  });

  const { data: customers } = trpc.customer.search.useQuery(
    { query: search || " " },
    { enabled: true }
  );
  const { data: stats } = trpc.customer.getStats.useQuery();

  const createCustomer = trpc.customer.create.useMutation({
    onSuccess: () => {
      utils.customer.search.invalidate();
      utils.customer.getStats.invalidate();
      setShowForm(false);
      resetForm();
    },
  });

  const updateCustomer = trpc.customer.update.useMutation({
    onSuccess: () => {
      utils.customer.search.invalidate();
      utils.customer.getStats.invalidate();
      setShowForm(false);
      setEditingId(null);
      resetForm();
    },
  });

  const deleteCustomer = trpc.customer.delete.useMutation({
    onSuccess: () => {
      utils.customer.search.invalidate();
      utils.customer.getStats.invalidate();
    },
  });

  function resetForm() {
    setFormData({
      customerCode: "", name: "", businessName: "", contactPerson: "",
      phone: "", email: "", physicalAddress: "", city: "", province: "",
      postalCode: "", paymentTerms: "cod", vatNumber: "", notes: "",
    });
  }

  function handleEdit(cust: NonNullable<typeof customers>[0]) {
    setFormData({
      customerCode: cust.customerCode,
      name: cust.name,
      businessName: cust.businessName || "",
      contactPerson: cust.contactPerson || "",
      phone: cust.phone || "",
      email: cust.email || "",
      physicalAddress: cust.physicalAddress || "",
      city: cust.city || "",
      province: cust.province || "",
      postalCode: cust.postalCode || "",
      paymentTerms: cust.paymentTerms as "cod" | "7_days" | "14_days" | "30_days",
      vatNumber: cust.vatNumber || "",
      notes: cust.notes || "",
    });
    setEditingId(cust.id);
    setShowForm(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editingId) {
      updateCustomer.mutate({ id: editingId, ...formData });
    } else {
      createCustomer.mutate(formData);
    }
  }

  function handleExport() {
    if (!customers) return;
    const headers = ["Customer Code", "Name", "Business Name", "Contact Person", "Phone", "Email", "Address", "City", "Province", "Payment Terms", "VAT Number"];
    const rows = customers.map((c) => [
      c.customerCode, c.name, c.businessName || "", c.contactPerson || "",
      c.phone || "", c.email || "", c.physicalAddress || "", c.city || "",
      c.province || "", c.paymentTerms, c.vatNumber || "",
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.map((v) => `"${v}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `customers_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  const selected = (customers || []).find((c) => c.id === selectedCustomer);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display font-semibold text-white" style={{ fontSize: "clamp(1.8rem, 3vw, 2.5rem)", letterSpacing: "-0.03em" }}>
            Customers
          </h1>
          <p className="text-[#8A8B8C] font-body text-sm mt-1">
            {stats?.total || 0} customers &middot; {stats?.active || 0} active
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={handleExport} className="btn-secondary">
            <Download className="w-4 h-4" /> Export
          </button>
          <button onClick={() => { setShowForm(true); resetForm(); setEditingId(null); }} className="btn-primary">
            <Plus className="w-4 h-4" /> Add Customer
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card-surface p-4">
          <div className="label-text mb-1">TOTAL</div>
          <div className="stat-number">{stats?.total || 0}</div>
        </div>
        <div className="card-surface p-4">
          <div className="label-text mb-1">ACTIVE</div>
          <div className="stat-number" style={{ color: "#4ADE80" }}>{stats?.active || 0}</div>
        </div>
        <div className="card-surface p-4">
          <div className="label-text mb-1">NEW THIS MONTH</div>
          <div className="stat-number" style={{ color: "#D4A843" }}>{stats?.thisMonth || 0}</div>
        </div>
        <div className="card-surface p-4">
          <div className="label-text mb-1">30-DAY ACCOUNTS</div>
          <div className="stat-number" style={{ color: "#6366F1" }}>
            {(customers || []).filter((c) => c.paymentTerms === "30_days").length}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Customer List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8B8C]" />
            <input
              type="text"
              placeholder="Search customers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field pl-10 w-full"
            />
          </div>

          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
            {(customers || []).map((cust) => (
              <div
                key={cust.id}
                onClick={() => setSelectedCustomer(cust.id)}
                className="card-surface p-4 cursor-pointer transition-all"
                style={{
                  borderLeft: selectedCustomer === cust.id ? "3px solid #D4A843" : "3px solid transparent",
                  backgroundColor: selectedCustomer === cust.id ? "rgba(212, 168, 67, 0.08)" : undefined,
                }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-display font-medium text-white text-sm truncate">{cust.name}</h3>
                    <p className="text-xs text-[#8A8B8C] font-body truncate">{cust.businessName || "No business name"}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="flex items-center gap-1 text-xs text-[#8A8B8C]">
                        <MapPin className="w-3 h-3" /> {cust.city || "N/A"}
                      </span>
                    </div>
                  </div>
                  <span
                    className="status-badge text-xs flex-shrink-0 ml-2"
                    style={{
                      backgroundColor: cust.paymentTerms === "cod" ? "rgba(245, 158, 11, 0.12)" :
                        cust.paymentTerms === "30_days" ? "rgba(99, 102, 241, 0.12)" : "rgba(74, 222, 128, 0.12)",
                      color: cust.paymentTerms === "cod" ? "#F59E0B" :
                        cust.paymentTerms === "30_days" ? "#6366F1" : "#4ADE80",
                    }}
                  >
                    {cust.paymentTerms.replace("_", " ").toUpperCase()}
                  </span>
                </div>
              </div>
            ))}
            {(!customers || customers.length === 0) && (
              <div className="card-surface p-8 text-center text-[#8A8B8C] font-body">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                No customers found
              </div>
            )}
          </div>
        </div>

        {/* Customer Detail */}
        <div className="lg:col-span-3">
          {selected ? (
            <div className="card-surface p-6">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="font-display font-semibold text-white text-xl">{selected.name}</h2>
                  <p className="text-[#8A8B8C] font-body text-sm">{selected.businessName}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleEdit(selected)} className="btn-secondary text-xs">
                    <Pencil className="w-3 h-3" /> Edit
                  </button>
                  {isAdmin && (
                    <button
                      onClick={() => { if (confirm("Delete this customer?")) deleteCustomer.mutate({ id: selected.id }); }}
                      className="btn-secondary text-xs hover:text-[#EF4444]"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div className="p-3 rounded-lg" style={{ backgroundColor: "#0A0A0B" }}>
                  <div className="flex items-center gap-2 text-[#8A8B8C] text-xs mb-1">
                    <Phone className="w-3 h-3" /> Phone
                  </div>
                  <div className="text-white text-sm font-body">{selected.phone || "N/A"}</div>
                </div>
                <div className="p-3 rounded-lg" style={{ backgroundColor: "#0A0A0B" }}>
                  <div className="flex items-center gap-2 text-[#8A8B8C] text-xs mb-1">
                    <Mail className="w-3 h-3" /> Email
                  </div>
                  <div className="text-white text-sm font-body">{selected.email || "N/A"}</div>
                </div>
                <div className="p-3 rounded-lg" style={{ backgroundColor: "#0A0A0B" }}>
                  <div className="flex items-center gap-2 text-[#8A8B8C] text-xs mb-1">
                    <MapPin className="w-3 h-3" /> Address
                  </div>
                  <div className="text-white text-sm font-body">
                    {selected.physicalAddress || "N/A"}<br />
                    {selected.city}, {selected.province} {selected.postalCode}
                  </div>
                </div>
                <div className="p-3 rounded-lg" style={{ backgroundColor: "#0A0A0B" }}>
                  <div className="flex items-center gap-2 text-[#8A8B8C] text-xs mb-1">
                    <FileText className="w-3 h-3" /> Payment Terms
                  </div>
                  <div className="text-white text-sm font-body">{selected.paymentTerms.replace("_", " ").toUpperCase()}</div>
                </div>
              </div>

              {selected.notes && (
                <div className="p-3 rounded-lg" style={{ backgroundColor: "#0A0A0B" }}>
                  <div className="text-[#8A8B8C] text-xs mb-1">Notes</div>
                  <div className="text-white text-sm font-body">{selected.notes}</div>
                </div>
              )}

              {selected.vatNumber && (
                <div className="mt-3 p-3 rounded-lg" style={{ backgroundColor: "rgba(212, 168, 67, 0.08)" }}>
                  <div className="text-[#D4A843] text-xs mb-1">VAT Number</div>
                  <div className="text-white text-sm font-body">{selected.vatNumber}</div>
                </div>
              )}
            </div>
          ) : (
            <div className="card-surface p-12 text-center">
              <Users className="w-16 h-16 mx-auto mb-4 opacity-20" style={{ color: "#D4A843" }} />
              <p className="text-[#8A8B8C] font-body">Select a customer to view details</p>
            </div>
          )}
        </div>
      </div>

      {/* Form Dialog */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.7)" }}>
          <div className="card-surface p-8 max-w-xl w-full mx-4 max-h-[90vh] overflow-y-auto" style={{ borderRadius: 16 }}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display font-semibold text-white text-xl">
                {editingId ? "Edit Customer" : "Add Customer"}
              </h2>
              <button onClick={() => setShowForm(false)} className="cursor-pointer"><X className="w-5 h-5 text-[#8A8B8C]" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label-text block mb-1.5">Customer Code *</label>
                  <input type="text" value={formData.customerCode} onChange={(e) => setFormData({ ...formData, customerCode: e.target.value })} className="input-field" required />
                </div>
                <div>
                  <label className="label-text block mb-1.5">Payment Terms</label>
                  <select value={formData.paymentTerms} onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value as "cod" | "7_days" | "14_days" | "30_days" })} className="input-field">
                    <option value="cod">COD</option>
                    <option value="7_days">7 Days</option>
                    <option value="14_days">14 Days</option>
                    <option value="30_days">30 Days</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="label-text block mb-1.5">Name *</label>
                <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="input-field" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label-text block mb-1.5">Business Name</label>
                  <input type="text" value={formData.businessName} onChange={(e) => setFormData({ ...formData, businessName: e.target.value })} className="input-field" />
                </div>
                <div>
                  <label className="label-text block mb-1.5">Contact Person</label>
                  <input type="text" value={formData.contactPerson} onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })} className="input-field" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label-text block mb-1.5">Phone</label>
                  <input type="text" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="input-field" />
                </div>
                <div>
                  <label className="label-text block mb-1.5">Email</label>
                  <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="input-field" />
                </div>
              </div>
              <div>
                <label className="label-text block mb-1.5">Physical Address</label>
                <textarea value={formData.physicalAddress} onChange={(e) => setFormData({ ...formData, physicalAddress: e.target.value })} className="input-field" rows={2} />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="label-text block mb-1.5">City</label>
                  <input type="text" value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} className="input-field" />
                </div>
                <div>
                  <label className="label-text block mb-1.5">Province</label>
                  <input type="text" value={formData.province} onChange={(e) => setFormData({ ...formData, province: e.target.value })} className="input-field" />
                </div>
                <div>
                  <label className="label-text block mb-1.5">Postal Code</label>
                  <input type="text" value={formData.postalCode} onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })} className="input-field" />
                </div>
              </div>
              <div>
                <label className="label-text block mb-1.5">VAT Number</label>
                <input type="text" value={formData.vatNumber} onChange={(e) => setFormData({ ...formData, vatNumber: e.target.value })} className="input-field" />
              </div>
              <div>
                <label className="label-text block mb-1.5">Notes</label>
                <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} className="input-field" rows={3} />
              </div>
              <button type="submit" className="btn-primary w-full justify-center">
                {editingId ? "Update Customer" : "Add Customer"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
