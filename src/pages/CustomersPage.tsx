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
  Mail,
  Download,
  Upload,
  FileText,
  Tag,
  DollarSign,
  ShieldAlert,
  History,
} from "lucide-react";

const PRICE_TIER_COLORS: Record<string, string> = {
  corporate: "#D4A843",
  bulk: "#6366F1",
  wholesale: "#4ADE80",
  retail: "#F59E0B",
};

export default function CustomersPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const myRepName = user?.name || "";
  const utils = trpc.useUtils();

  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<number | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [showSpecialPriceForm, setShowSpecialPriceForm] = useState(false);
  const [showAuditTrail, setShowAuditTrail] = useState(false);
  const [specialPriceData, setSpecialPriceData] = useState({ stockItemId: 0, specialPrice: 0 });
  const [vatError, setVatError] = useState("");

  const [formData, setFormData] = useState({
    customerCode: "", name: "", businessName: "", contactPerson: "", phone: "", email: "",
    physicalAddress: "", city: "", province: "", postalCode: "", paymentTerms: "cod" as "cod" | "7_days" | "14_days" | "30_days",
    priceTier: "wholesale" as "corporate" | "bulk" | "wholesale" | "retail",
    salesRepName: "", vatNumber: "", notes: "",
  });

  const { data: customers } = trpc.customer.search.useQuery({ query: search || " " });
  const { data: stats } = trpc.customer.getStats.useQuery();
  const { data: stockItems } = trpc.stock.search.useQuery({ query: " " });
  const { data: salesReps } = trpc.customer.getSalesReps.useQuery();
  const { data: auditDeletions } = trpc.audit.getCustomerDeletions.useQuery(undefined, { enabled: showAuditTrail });

  const selected = (customers || []).find((c) => c.id === selectedCustomer);
  const { data: specialPrices } = trpc.specialPrice.listByCustomer.useQuery(
    { customerId: selectedCustomer || 0 },
    { enabled: !!selectedCustomer }
  );

  const createCustomer = trpc.customer.create.useMutation({
    onSuccess: () => { utils.customer.search.invalidate(); utils.customer.getStats.invalidate(); setShowForm(false); resetForm(); },
  });
  const updateCustomer = trpc.customer.update.useMutation({
    onSuccess: () => { utils.customer.search.invalidate(); utils.customer.getStats.invalidate(); setShowForm(false); setEditingId(null); },
  });
  const deleteCustomer = trpc.customer.delete.useMutation({
    onSuccess: () => { utils.customer.search.invalidate(); utils.customer.getStats.invalidate(); setSelectedCustomer(null); },
  });
  const setSpecialPrice = trpc.specialPrice.set.useMutation({
    onSuccess: () => { utils.specialPrice.listByCustomer.invalidate(); setShowSpecialPriceForm(false); setSpecialPriceData({ stockItemId: 0, specialPrice: 0 }); },
  });
  const deleteSpecialPrice = trpc.specialPrice.delete.useMutation({
    onSuccess: () => utils.specialPrice.listByCustomer.invalidate(),
  });

  function resetForm() {
    setFormData({ customerCode: "", name: "", businessName: "", contactPerson: "", phone: "", email: "", physicalAddress: "", city: "", province: "", postalCode: "", paymentTerms: "cod", priceTier: "wholesale", salesRepName: myRepName, vatNumber: "", notes: "" });
    setVatError("");
  }

  function handleEdit(cust: NonNullable<typeof customers>[0]) {
    setFormData({ customerCode: cust.customerCode, name: cust.name, businessName: cust.businessName || "", contactPerson: cust.contactPerson || "", phone: cust.phone || "", email: cust.email || "", physicalAddress: cust.physicalAddress || "", city: cust.city || "", province: cust.province || "", postalCode: cust.postalCode || "", paymentTerms: cust.paymentTerms as "cod" | "7_days" | "14_days" | "30_days", priceTier: (cust.priceTier as "corporate" | "bulk" | "wholesale" | "retail") || "wholesale", salesRepName: cust.salesRepName || "", vatNumber: cust.vatNumber || "", notes: cust.notes || "" });
    setEditingId(cust.id); setShowForm(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // VAT validation: 10 digits only, optional
    if (formData.vatNumber && !/^\d{10}$/.test(formData.vatNumber)) {
      setVatError("VAT number must be exactly 10 digits");
      return;
    }
    setVatError("");
    if (editingId) {
      updateCustomer.mutate({ id: editingId, ...formData });
    } else {
      // Auto-generate customer code for new customers
      const dataToSend = { ...formData };
      if (!dataToSend.customerCode || dataToSend.customerCode.trim() === "") {
        dataToSend.customerCode = "AUTO"; // Will be replaced by backend
      }
      createCustomer.mutate(dataToSend);
    }
  }

  function handleVatChange(value: string) {
    // Only allow digits, max 10
    const digitsOnly = value.replace(/\D/g, "").slice(0, 10);
    setFormData({ ...formData, vatNumber: digitsOnly });
    if (digitsOnly.length === 10 || digitsOnly.length === 0) {
      setVatError("");
    }
  }

  function handleExport() {
    if (!customers) return;
    const headers = ["Customer Code", "Name", "Business Name", "Contact Person", "Phone", "Email", "Address", "City", "Province", "Payment Terms", "Price Tier", "Sales Rep", "VAT Number"];
    const rows = customers.map((c) => [c.customerCode, c.name, c.businessName || "", c.contactPerson || "", c.phone || "", c.email || "", c.physicalAddress || "", c.city || "", c.province || "", c.paymentTerms, c.priceTier || "wholesale", c.salesRepName || "", c.vatNumber || ""]);
    const csv = [headers.join(","), ...rows.map((r) => r.map((v) => `"${v}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `customers_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  function handleCustomerImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split("\n").filter((l) => l.trim());
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
        if (cols.length >= 3 && cols[0] && cols[1]) {
          createCustomer.mutate({
            customerCode: cols[0], name: cols[1], businessName: cols[2] || undefined,
            contactPerson: cols[3] || undefined, phone: cols[4] || undefined,
            email: cols[5] || undefined, physicalAddress: cols[6] || undefined,
            city: cols[7] || undefined, province: cols[8] || undefined,
            postalCode: cols[9] || undefined, paymentTerms: (cols[10] as "cod" | "7_days" | "14_days" | "30_days") || "cod",
            priceTier: (cols[11] as "corporate" | "bulk" | "wholesale" | "retail") || "wholesale",
            salesRepName: cols[12] || myRepName,
            vatNumber: cols[13] || undefined, notes: cols[14] || undefined,
          });
        }
      }
      setShowImport(false);
    };
    reader.readAsText(file);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display font-semibold text-white" style={{ fontSize: "clamp(1.8rem, 3vw, 2.5rem)", letterSpacing: "-0.03em" }}>Customers</h1>
          <p className="text-[#8A8B8C] font-body text-sm mt-1">{stats?.total || 0} customers &middot; {stats?.active || 0} active</p>
        </div>
        <div className="flex gap-3 flex-wrap">
          {isAdmin && <button onClick={() => setShowAuditTrail(true)} className="btn-secondary"><History className="w-4 h-4" /> Audit Trail</button>}
          {isAdmin && <button onClick={() => setShowImport(true)} className="btn-secondary"><Upload className="w-4 h-4" /> Import CSV</button>}
          {isAdmin && <button onClick={handleExport} className="btn-secondary"><Download className="w-4 h-4" /> Export</button>}
          <button onClick={() => { setShowForm(true); resetForm(); setEditingId(null); }} className="btn-primary"><Plus className="w-4 h-4" /> Add Customer</button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card-surface p-4"><div className="label-text mb-1">TOTAL</div><div className="stat-number">{stats?.total || 0}</div></div>
        <div className="card-surface p-4"><div className="label-text mb-1">ACTIVE</div><div className="stat-number" style={{ color: "#4ADE80" }}>{stats?.active || 0}</div></div>
        <div className="card-surface p-4"><div className="label-text mb-1">NEW THIS MONTH</div><div className="stat-number" style={{ color: "#D4A843" }}>{stats?.thisMonth || 0}</div></div>
        <div className="card-surface p-4"><div className="label-text mb-1">30-DAY ACCOUNTS</div><div className="stat-number" style={{ color: "#6366F1" }}>{(customers || []).filter((c) => c.paymentTerms === "30_days").length}</div></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8B8C]" />
            <input type="text" placeholder="Search customers..." value={search} onChange={(e) => setSearch(e.target.value)} className="input-field pl-10 w-full" />
          </div>
          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
            {(customers || []).map((cust) => (
              <div key={cust.id} onClick={() => setSelectedCustomer(cust.id)} className="card-surface p-4 cursor-pointer transition-all" style={{ borderLeft: selectedCustomer === cust.id ? "3px solid #D4A843" : "3px solid transparent", backgroundColor: selectedCustomer === cust.id ? "rgba(212, 168, 67, 0.08)" : undefined }}>
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-display font-medium text-white text-sm truncate">{cust.name}</h3>
                    <p className="text-xs text-[#8A8B8C] font-body truncate">{cust.businessName || "No business name"}</p>
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      <span className="flex items-center gap-1 text-xs text-[#8A8B8C]"><MapPin className="w-3 h-3" /> {cust.city || "N/A"}</span>
                      <span className="text-xs font-mono-data" style={{ color: PRICE_TIER_COLORS[cust.priceTier] || "#8A8B8C" }}>{cust.priceTier?.toUpperCase() || "WHOLESALE"}</span>
                      {cust.salesRepName && <span className="text-xs" style={{ color: "#6366F1" }}>Rep: {cust.salesRepName}</span>}
                    </div>
                  </div>
                  <span className="status-badge text-xs flex-shrink-0 ml-2" style={{ backgroundColor: cust.paymentTerms === "cod" ? "rgba(245, 158, 11, 0.12)" : cust.paymentTerms === "30_days" ? "rgba(99, 102, 241, 0.12)" : "rgba(74, 222, 128, 0.12)", color: cust.paymentTerms === "cod" ? "#F59E0B" : cust.paymentTerms === "30_days" ? "#6366F1" : "#4ADE80" }}>{cust.paymentTerms.replace("_", " ").toUpperCase()}</span>
                </div>
              </div>
            ))}
            {(!customers || customers.length === 0) && <div className="card-surface p-8 text-center text-[#8A8B8C] font-body"><Users className="w-12 h-12 mx-auto mb-3 opacity-30" />No customers found</div>}
          </div>
        </div>

        <div className="lg:col-span-3">
          {selected ? (
            <div className="space-y-4">
              <div className="card-surface p-6">
                <div className="flex items-start justify-between mb-6">
                  <div><h2 className="font-display font-semibold text-white text-xl">{selected.name}</h2><p className="text-[#8A8B8C] font-body text-sm">{selected.businessName}</p></div>
                  <div className="flex gap-2">
                    {isAdmin && <button onClick={() => handleEdit(selected)} className="btn-secondary text-xs"><Pencil className="w-3 h-3" /> Edit</button>}
                    {isAdmin && <button onClick={() => { if (confirm("Delete this customer?")) deleteCustomer.mutate({ id: selected.id }); }} className="btn-secondary text-xs hover:text-[#EF4444]"><Trash2 className="w-3 h-3" /></button>}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                  <div className="p-3 rounded-lg" style={{ backgroundColor: "#0A0A0B" }}><div className="flex items-center gap-2 text-[#8A8B8C] text-xs mb-1"><FileText className="w-3 h-3" /> Customer Code</div><div className="text-white text-sm font-body font-mono-data">{selected.customerCode}</div></div>
                  <div className="p-3 rounded-lg" style={{ backgroundColor: "#0A0A0B" }}><div className="flex items-center gap-2 text-[#8A8B8C] text-xs mb-1"><Mail className="w-3 h-3" /> Email</div><div className="text-white text-sm font-body">{selected.email || "N/A"}</div></div>
                  <div className="p-3 rounded-lg" style={{ backgroundColor: "#0A0A0B" }}><div className="flex items-center gap-2 text-[#8A8B8C] text-xs mb-1"><MapPin className="w-3 h-3" /> Address</div><div className="text-white text-sm font-body">{selected.physicalAddress || "N/A"}<br />{selected.city}, {selected.province} {selected.postalCode}</div></div>
                  <div className="p-3 rounded-lg" style={{ backgroundColor: "#0A0A0B" }}><div className="flex items-center gap-2 text-[#8A8B8C] text-xs mb-1"><DollarSign className="w-3 h-3" /> Price Tier</div><div className="text-sm font-body font-semibold" style={{ color: PRICE_TIER_COLORS[selected.priceTier] || "#E8E8E9" }}>{selected.priceTier?.toUpperCase() || "WHOLESALE"}</div></div>
                  <div className="p-3 rounded-lg" style={{ backgroundColor: "#0A0A0B" }}><div className="flex items-center gap-2 text-[#8A8B8C] text-xs mb-1"><Tag className="w-3 h-3" /> Payment Terms</div><div className="text-white text-sm font-body">{selected.paymentTerms.replace("_", " ").toUpperCase()}</div></div>
                  <div className="p-3 rounded-lg" style={{ backgroundColor: "#0A0A0B" }}><div className="flex items-center gap-2 text-[#8A8B8C] text-xs mb-1"><UserIcon className="w-3 h-3" /> Sales Rep</div><div className="text-white text-sm font-body">{selected.salesRepName || "Unassigned"}</div></div>
                </div>
                {selected.notes && <div className="p-3 rounded-lg" style={{ backgroundColor: "#0A0A0B" }}><div className="text-[#8A8B8C] text-xs mb-1">Notes</div><div className="text-white text-sm font-body">{selected.notes}</div></div>}
                {selected.vatNumber && <div className="mt-3 p-3 rounded-lg" style={{ backgroundColor: "rgba(212, 168, 67, 0.08)" }}><div className="text-[#D4A843] text-xs mb-1">VAT Number</div><div className="text-white text-sm font-body">{selected.vatNumber}</div></div>}
              </div>

              {/* Special Prices */}
              <div className="card-surface p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-display font-semibold text-white flex items-center gap-2"><Tag className="w-4 h-4 text-[#D4A843]" /> Special Prices</h3>
                  <button onClick={() => setShowSpecialPriceForm(true)} className="btn-primary text-xs"><Plus className="w-3 h-3" /> Add Special Price</button>
                </div>
                {(specialPrices || []).length === 0 ? (
                  <div className="text-center py-4 text-[#8A8B8C] font-body text-sm">No special prices set for this customer</div>
                ) : (
                  <div className="space-y-2">
                    {(specialPrices || []).map((sp) => (
                      <div key={sp.id} className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: "#0A0A0B" }}>
                        <div>
                          <div className="text-sm text-white font-body">{sp.stockItem?.productName || "Unknown Product"}</div>
                          <div className="text-xs text-[#8A8B8C] font-mono-data">{sp.stockItem?.productCode}</div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="text-xs text-[#8A8B8C] line-through">R {Number(sp.stockItem?.wholesalePrice).toFixed(2)}</div>
                            <div className="text-sm font-display font-semibold" style={{ color: "#D4A843" }}>R {Number(sp.specialPrice).toFixed(2)}</div>
                          </div>
                          <button onClick={() => { if (confirm("Remove special price?")) deleteSpecialPrice.mutate({ id: sp.id }); }} className="p-1 hover:text-[#EF4444] cursor-pointer"><X className="w-4 h-4 text-[#8A8B8C]" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="card-surface p-12 text-center"><Users className="w-16 h-16 mx-auto mb-4 opacity-20" style={{ color: "#D4A843" }} /><p className="text-[#8A8B8C] font-body">Select a customer to view details and manage special prices</p></div>
          )}
        </div>
      </div>

      {/* Customer Form Dialog */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.7)" }}>
          <div className="card-surface p-8 max-w-xl w-full mx-4 max-h-[90vh] overflow-y-auto" style={{ borderRadius: 16 }}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display font-semibold text-white text-xl">{editingId ? (isAdmin ? "Edit Customer" : "View Customer (Admin Only)") : "Add Customer"}</h2>
              <button onClick={() => setShowForm(false)} className="cursor-pointer"><X className="w-5 h-5 text-[#8A8B8C]" /></button>
            </div>
            {editingId && !isAdmin ? (
              <div className="text-center py-8">
                <ShieldAlert className="w-12 h-12 mx-auto mb-3" style={{ color: "#F59E0B" }} />
                <p className="text-[#E8E8E9] font-body">Only administrators can edit or delete customers.</p>
                <p className="text-[#8A8B8C] font-body text-sm mt-2">Please contact your admin to make changes.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label-text block mb-1.5">Customer Code {editingId ? "" : "(Auto)"}</label>
                    <input type="text" value={formData.customerCode} onChange={(e) => setFormData({ ...formData, customerCode: e.target.value })} className="input-field" required={!!editingId} placeholder={editingId ? "" : "Auto-generated"} readOnly={!editingId} style={{ backgroundColor: editingId ? undefined : "#0A0A0B" }} />
                  </div>
                  <div>
                    <label className="label-text block mb-1.5">Sales Rep *</label>
                    <select value={formData.salesRepName} onChange={(e) => setFormData({ ...formData, salesRepName: e.target.value })} className="input-field" required>
                      <option value="">Select rep...</option>
                      {(salesReps || []).map((rep: string) => <option key={rep} value={rep}>{rep}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="label-text block mb-1.5">Price Tier</label><select value={formData.priceTier} onChange={(e) => setFormData({ ...formData, priceTier: e.target.value as "corporate" | "bulk" | "wholesale" | "retail" })} className="input-field"><option value="corporate">Corporate</option><option value="bulk">Bulk</option><option value="wholesale">Wholesale</option><option value="retail">Retail</option></select></div>
                  <div><label className="label-text block mb-1.5">Payment Terms</label><select value={formData.paymentTerms} onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value as "cod" | "7_days" | "14_days" | "30_days" })} className="input-field"><option value="cod">COD</option><option value="7_days">7 Days</option><option value="14_days">14 Days</option><option value="30_days">30 Days</option></select></div>
                </div>
                <div><label className="label-text block mb-1.5">Name *</label><input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="input-field" required /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="label-text block mb-1.5">Business Name</label><input type="text" value={formData.businessName} onChange={(e) => setFormData({ ...formData, businessName: e.target.value })} className="input-field" /></div>
                  <div><label className="label-text block mb-1.5">Contact Person</label><input type="text" value={formData.contactPerson} onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })} className="input-field" /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="label-text block mb-1.5">Phone</label><input type="text" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="input-field" /></div>
                  <div><label className="label-text block mb-1.5">Email</label><input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="input-field" /></div>
                </div>
                <div><label className="label-text block mb-1.5">Physical Address</label><textarea value={formData.physicalAddress} onChange={(e) => setFormData({ ...formData, physicalAddress: e.target.value })} className="input-field" rows={2} /></div>
                <div className="grid grid-cols-3 gap-4"><div><label className="label-text block mb-1.5">City</label><input type="text" value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} className="input-field" /></div><div><label className="label-text block mb-1.5">Province</label><input type="text" value={formData.province} onChange={(e) => setFormData({ ...formData, province: e.target.value })} className="input-field" /></div><div><label className="label-text block mb-1.5">Postal Code</label><input type="text" value={formData.postalCode} onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })} className="input-field" /></div></div>
                <div>
                  <label className="label-text block mb-1.5">VAT Number <span className="text-[#8A8B8C] font-normal">(10 digits, optional)</span></label>
                  <input type="text" value={formData.vatNumber} onChange={(e) => handleVatChange(e.target.value)} className={`input-field ${vatError ? "border-red-500" : ""}`} maxLength={10} placeholder="0123456789" />
                  {vatError && <p className="text-[#EF4444] text-xs mt-1">{vatError}</p>}
                </div>
                <div><label className="label-text block mb-1.5">Notes</label><textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} className="input-field" rows={3} /></div>
                <button type="submit" className="btn-primary w-full justify-center">{editingId ? "Update" : "Add"} Customer</button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Audit Trail Dialog */}
      {showAuditTrail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.7)" }}>
          <div className="card-surface p-8 max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto" style={{ borderRadius: 16 }}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display font-semibold text-white text-xl flex items-center gap-2"><History className="w-5 h-5 text-[#D4A843]" /> Customer Audit Trail</h2>
              <button onClick={() => setShowAuditTrail(false)} className="cursor-pointer"><X className="w-5 h-5 text-[#8A8B8C]" /></button>
            </div>
            <div className="space-y-3">
              {(auditDeletions || []).length === 0 && <div className="text-center py-8 text-[#8A8B8C] font-body">No audit records found</div>}
              {(auditDeletions || []).map((entry: any) => (
                <div key={entry.id} className="p-4 rounded-lg" style={{ backgroundColor: "#0A0A0B", borderLeft: "3px solid #EF4444" }}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono-data text-[#EF4444]">{entry.action}</span>
                    <span className="text-xs text-[#8A8B8C]">{new Date(entry.createdAt).toLocaleString("en-ZA")}</span>
                  </div>
                  <p className="text-sm text-[#E8E8E9] font-body mt-1">{entry.details}</p>
                  <p className="text-xs text-[#8A8B8C] mt-1">By: {entry.userName}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Import Dialog */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.7)" }}>
          <div className="card-surface p-8 max-w-md w-full mx-4" style={{ borderRadius: 16 }}>
            <div className="flex items-center justify-between mb-6"><h2 className="font-display font-semibold text-white text-xl">Import Customers</h2><button onClick={() => setShowImport(false)} className="cursor-pointer"><X className="w-5 h-5 text-[#8A8B8C]" /></button></div>
            <div className="border-2 border-dashed rounded-xl p-8 text-center mb-6" style={{ borderColor: "#D4A843", backgroundColor: "rgba(212, 168, 67, 0.05)" }}>
              <Upload className="w-12 h-12 mx-auto mb-4" style={{ color: "#D4A843" }} />
              <p className="text-[#E8E8E9] font-body text-sm mb-2">Drop CSV file here or click to browse</p>
              <p className="text-[#8A8B8C] text-xs font-body mb-4">Format: CustomerCode, Name, BusinessName, ContactPerson, Phone, Email, Address, City, Province, PostalCode, PaymentTerms, PriceTier, SalesRep, VATNumber, Notes</p>
              <input type="file" accept=".csv" onChange={handleCustomerImport} className="hidden" id="customer-csv-import" />
              <label htmlFor="customer-csv-import" className="btn-primary inline-flex cursor-pointer">Browse Files</label>
            </div>
          </div>
        </div>
      )}

      {/* Special Price Dialog */}
      {showSpecialPriceForm && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.7)" }}>
          <div className="card-surface p-8 max-w-md w-full mx-4" style={{ borderRadius: 16 }}>
            <div className="flex items-center justify-between mb-6"><h2 className="font-display font-semibold text-white text-xl">Add Special Price for {selected.name}</h2><button onClick={() => setShowSpecialPriceForm(false)} className="cursor-pointer"><X className="w-5 h-5 text-[#8A8B8C]" /></button></div>
            <form onSubmit={(e) => { e.preventDefault(); if (specialPriceData.stockItemId === 0) return; setSpecialPrice.mutate({ customerId: selected.id, stockItemId: specialPriceData.stockItemId, specialPrice: specialPriceData.specialPrice }); }} className="space-y-4">
              <div>
                <label className="label-text block mb-1.5">Product *</label>
                <select value={specialPriceData.stockItemId} onChange={(e) => setSpecialPriceData({ ...specialPriceData, stockItemId: parseInt(e.target.value) })} className="input-field" required>
                  <option value={0}>Select product...</option>
                  {(stockItems || []).map((s) => <option key={s.id} value={s.id}>{s.productName} (Wholesale: R {Number(s.wholesalePrice).toFixed(2)})</option>)}
                </select>
              </div>
              <div>
                <label className="label-text block mb-1.5">Special Price (R) *</label>
                <input type="number" step="0.01" value={specialPriceData.specialPrice} onChange={(e) => setSpecialPriceData({ ...specialPriceData, specialPrice: parseFloat(e.target.value) || 0 })} className="input-field" required min={0} />
              </div>
              <button type="submit" className="btn-primary w-full justify-center">Save Special Price</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Inline icon component for user/sales rep
function UserIcon(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
    </svg>
  );
}
