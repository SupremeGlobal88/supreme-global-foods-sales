import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import {
  Search,
  Upload,
  Plus,
  Pencil,
  Trash2,
  X,
  Package,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";

export default function StockPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const utils = trpc.useUtils();

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    productCode: "", productName: "", category: "", strands: "", size: "", grade: "", color: "", species: "", origin: "",
    quantity: 0, corporatePrice: 0, bulkPrice: 0, wholesalePrice: 0, retailPrice: 0, description: "",
  });

  const { data: stockItems } = trpc.stock.search.useQuery({ query: search || " " }, { enabled: true });
  const { data: categories } = trpc.stock.getCategories.useQuery();
  const { data: stats } = trpc.stock.getStats.useQuery();

  const createStock = trpc.stock.create.useMutation({
    onSuccess: () => { utils.stock.search.invalidate(); utils.stock.getStats.invalidate(); setShowForm(false); resetForm(); },
  });
  const updateStock = trpc.stock.update.useMutation({
    onSuccess: () => { utils.stock.search.invalidate(); utils.stock.getStats.invalidate(); setShowForm(false); setEditingId(null); resetForm(); },
  });
  const deleteStock = trpc.stock.delete.useMutation({
    onSuccess: () => { utils.stock.search.invalidate(); utils.stock.getStats.invalidate(); },
  });
  const bulkUpload = trpc.stock.bulkUpload.useMutation({
    onSuccess: () => { utils.stock.search.invalidate(); utils.stock.getStats.invalidate(); setShowUpload(false); },
  });

  function resetForm() {
    setFormData({ productCode: "", productName: "", category: "", strands: "", size: "", grade: "", color: "", species: "", origin: "", quantity: 0, corporatePrice: 0, bulkPrice: 0, wholesalePrice: 0, retailPrice: 0, description: "" });
  }

  function handleEdit(item: NonNullable<typeof stockItems>[0]) {
    setFormData({
      productCode: item.productCode, productName: item.productName, category: item.category,
      strands: item.strands || "", size: item.size || "", grade: item.grade || "", color: item.color || "",
      species: item.species || "", origin: item.origin || "", quantity: item.quantity,
      corporatePrice: Number(item.corporatePrice), bulkPrice: Number(item.bulkPrice),
      wholesalePrice: Number(item.wholesalePrice), retailPrice: Number(item.retailPrice),
      description: item.description || "",
    });
    setEditingId(item.id); setShowForm(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editingId) { updateStock.mutate({ id: editingId, ...formData }); }
    else { createStock.mutate(formData); }
  }

  function handleCSVUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split("\n").filter((l) => l.trim());
      const items = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
        if (cols.length >= 9 && cols[0] && cols[1]) {
          items.push({
            productCode: cols[0], productName: cols[1], category: cols[2] || "General",
            strands: cols[3] || "", size: cols[4] || "", grade: cols[5] || "",
            color: cols[6] || "", species: cols[7] || "", origin: cols[8] || "",
            quantity: parseInt(cols[9]) || 0,
            corporatePrice: parseFloat(cols[10]) || 0, bulkPrice: parseFloat(cols[11]) || 0,
            wholesalePrice: parseFloat(cols[12]) || 0, retailPrice: parseFloat(cols[13]) || 0,
            description: cols[14] || "",
          });
        }
      }
      if (items.length > 0) { bulkUpload.mutate(items); }
      else { alert("No valid products found. Expected format: ProductCode,ProductName,Category,Strands,Size,Grade,Color,Species,Origin,Qty,CorpPrice,BulkPrice,WholesalePrice,RetailPrice,Description"); }
    };
    reader.readAsText(file);
  }

  const filtered = (stockItems || []).filter((item) => !category || item.category === category);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display font-semibold text-white" style={{ fontSize: "clamp(1.8rem, 3vw, 2.5rem)", letterSpacing: "-0.03em" }}>Stock on Hand</h1>
          <p className="text-[#8A8B8C] font-body text-sm mt-1">
            {stats?.totalProducts || 0} products
            {isAdmin && stats?.totalRetailValue ? ` \u00B7 R ${stats.totalRetailValue.toLocaleString("en-ZA", { minimumFractionDigits: 2 })} retail value` : ""}
          </p>
        </div>
        {isAdmin && (
          <div className="flex gap-3">
            <button onClick={() => setShowUpload(true)} className="btn-secondary"><Upload className="w-4 h-4" /> Upload CSV</button>
            <button onClick={() => { setShowForm(true); resetForm(); setEditingId(null); }} className="btn-primary"><Plus className="w-4 h-4" /> Add Product</button>
          </div>
        )}
      </div>

      <div className={`grid grid-cols-2 ${isAdmin ? "sm:grid-cols-4" : "sm:grid-cols-3"} gap-4`}>
        <div className="card-surface p-4"><div className="label-text mb-1">TOTAL PRODUCTS</div><div className="stat-number">{stats?.totalProducts || 0}</div></div>
        {isAdmin && <div className="card-surface p-4"><div className="label-text mb-1">RETAIL VALUE</div><div className="stat-number" style={{ fontSize: "1.3rem" }}>R {(stats?.totalRetailValue || 0).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}</div></div>}
        <div className="card-surface p-4"><div className="label-text mb-1">LOW STOCK</div><div className="stat-number" style={{ color: "#F59E0B" }}>{stats?.lowStock || 0}</div></div>
        <div className="card-surface p-4"><div className="label-text mb-1">OUT OF STOCK</div><div className="stat-number" style={{ color: "#EF4444" }}>{stats?.outOfStock || 0}</div></div>
      </div>

      <div className="card-surface p-4 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8B8C]" /><input type="text" placeholder="Search products..." value={search} onChange={(e) => setSearch(e.target.value)} className="input-field pl-10 w-full" /></div>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="input-field sm:w-48"><option value="">All Categories</option>{(categories || []).map((c) => <option key={c} value={c}>{c}</option>)}</select>
      </div>

      <div className="card-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ backgroundColor: "#131415", borderBottom: "1px solid #222324" }}>
                <th className="text-left p-3 label-text">Product</th>
                <th className="text-left p-3 label-text">Details</th>
                <th className="text-left p-3 label-text">SOH</th>
                <th className="text-right p-3 label-text">Corp</th>
                <th className="text-right p-3 label-text">Bulk</th>
                <th className="text-right p-3 label-text">Wholesale</th>
                {isAdmin && <th className="text-right p-3 label-text">Retail</th>}
                <th className="text-left p-3 label-text">Status</th>
                {isAdmin && <th className="text-right p-3 label-text">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id} className="transition-colors hover:bg-[#131415]" style={{
                  borderLeft: item.status === "low_stock" ? "3px solid #F59E0B" : item.status === "out_of_stock" ? "3px solid #EF4444" : "3px solid transparent",
                }}>
                  <td className="p-3">
                    <div className="text-sm text-white font-body font-medium">{item.productName}</div>
                    <div className="font-mono-data text-xs text-[#D4A843]">{item.productCode}</div>
                  </td>
                  <td className="p-3 text-xs text-[#8A8B8C] font-body">
                    {item.species} &middot; {item.size} &middot; {item.grade} &middot; {item.color}<br />
                    {item.strands} &middot; {item.origin}
                  </td>
                  <td className="p-3 text-white font-display font-semibold">{item.quantity}</td>
                  <td className="p-3 text-right text-sm text-[#E8E8E9] font-display">R {Number(item.corporatePrice).toFixed(2)}</td>
                  <td className="p-3 text-right text-sm text-[#E8E8E9] font-display">R {Number(item.bulkPrice).toFixed(2)}</td>
                  <td className="p-3 text-right text-sm font-display" style={{ color: "#D4A843" }}>R {Number(item.wholesalePrice).toFixed(2)}</td>
                  {isAdmin && <td className="p-3 text-right text-sm text-[#E8E8E9] font-display">R {Number(item.retailPrice).toFixed(2)}</td>}
                  <td className="p-3">
                    <span className="status-badge" style={{
                      backgroundColor: item.status === "in_stock" ? "rgba(74, 222, 128, 0.12)" : item.status === "low_stock" ? "rgba(245, 158, 11, 0.12)" : "rgba(239, 68, 68, 0.12)",
                      color: item.status === "in_stock" ? "#4ADE80" : item.status === "low_stock" ? "#F59E0B" : "#EF4444",
                    }}>
                      {item.status === "in_stock" ? <><CheckCircle className="w-3 h-3" /> IN</> : item.status === "low_stock" ? <><AlertTriangle className="w-3 h-3" /> LOW</> : <><X className="w-3 h-3" /> OUT</>}
                    </span>
                  </td>
                  {isAdmin && (
                    <td className="p-3 text-right">
                      <button onClick={() => handleEdit(item)} className="p-1.5 hover:text-[#D4A843] transition-colors cursor-pointer"><Pencil className="w-4 h-4 text-[#8A8B8C]" /></button>
                      <button onClick={() => { if (confirm("Delete?")) deleteStock.mutate({ id: item.id }); }} className="p-1.5 hover:text-[#EF4444] transition-colors cursor-pointer ml-1"><Trash2 className="w-4 h-4 text-[#8A8B8C]" /></button>
                    </td>
                  )}
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={isAdmin ? 9 : 7} className="p-8 text-center text-[#8A8B8C] font-body"><Package className="w-12 h-12 mx-auto mb-3 opacity-30" />No products found</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Upload Dialog */}
      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.7)" }}>
          <div className="card-surface p-8 max-w-md w-full mx-4" style={{ borderRadius: 16 }}>
            <div className="flex items-center justify-between mb-6"><h2 className="font-display font-semibold text-white text-xl">Upload Stock CSV</h2><button onClick={() => setShowUpload(false)} className="cursor-pointer"><X className="w-5 h-5 text-[#8A8B8C]" /></button></div>
            <div className="border-2 border-dashed rounded-xl p-8 text-center mb-6" style={{ borderColor: "#D4A843", backgroundColor: "rgba(212, 168, 67, 0.05)" }}>
              <Upload className="w-12 h-12 mx-auto mb-4" style={{ color: "#D4A843" }} />
              <p className="text-[#E8E8E9] font-body text-sm mb-2">Drop CSV file here or click to browse</p>
              <p className="text-[#8A8B8C] text-xs font-body mb-4">Format: ProductCode, ProductName, Category, Strands, Size, Grade, Color, Species, Origin, Qty, CorpPrice, BulkPrice, WholesalePrice, RetailPrice, Description</p>
              <input type="file" accept=".csv" onChange={handleCSVUpload} className="hidden" id="csv-upload" />
              <label htmlFor="csv-upload" className="btn-primary inline-flex cursor-pointer">Browse Files</label>
            </div>
          </div>
        </div>
      )}

      {/* Form Dialog */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.7)" }}>
          <div className="card-surface p-8 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto" style={{ borderRadius: 16 }}>
            <div className="flex items-center justify-between mb-6"><h2 className="font-display font-semibold text-white text-xl">{editingId ? "Edit" : "Add"} Product</h2><button onClick={() => setShowForm(false)} className="cursor-pointer"><X className="w-5 h-5 text-[#8A8B8C]" /></button></div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label-text block mb-1.5">Product Code *</label><input type="text" value={formData.productCode} onChange={(e) => setFormData({ ...formData, productCode: e.target.value })} className="input-field" required /></div>
                <div><label className="label-text block mb-1.5">Product Name *</label><input type="text" value={formData.productName} onChange={(e) => setFormData({ ...formData, productName: e.target.value })} className="input-field" required /></div>
              </div>
              <div className="grid grid-cols-4 gap-3">
                <div><label className="label-text block mb-1.5">Category *</label><input type="text" value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} className="input-field" required placeholder="HOG - LONG" /></div>
                <div><label className="label-text block mb-1.5">Species</label><input type="text" value={formData.species} onChange={(e) => setFormData({ ...formData, species: e.target.value })} className="input-field" placeholder="HOG / SHEEP" /></div>
                <div><label className="label-text block mb-1.5">Size</label><input type="text" value={formData.size} onChange={(e) => setFormData({ ...formData, size: e.target.value })} className="input-field" placeholder="26/28" /></div>
                <div><label className="label-text block mb-1.5">Grade</label><input type="text" value={formData.grade} onChange={(e) => setFormData({ ...formData, grade: e.target.value })} className="input-field" placeholder="A / AB" /></div>
              </div>
              <div className="grid grid-cols-4 gap-3">
                <div><label className="label-text block mb-1.5">Color</label><input type="text" value={formData.color} onChange={(e) => setFormData({ ...formData, color: e.target.value })} className="input-field" placeholder="Brown" /></div>
                <div><label className="label-text block mb-1.5">Strands</label><input type="text" value={formData.strands} onChange={(e) => setFormData({ ...formData, strands: e.target.value })} className="input-field" placeholder="3/13/90" /></div>
                <div><label className="label-text block mb-1.5">Origin</label><input type="text" value={formData.origin} onChange={(e) => setFormData({ ...formData, origin: e.target.value })} className="input-field" placeholder="Local / Import" /></div>
                <div><label className="label-text block mb-1.5">Qty *</label><input type="number" value={formData.quantity} onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })} className="input-field" required min={0} /></div>
              </div>
              <div className="grid grid-cols-4 gap-3">
                <div><label className="label-text block mb-1.5">Corporate (R) *</label><input type="number" step="0.01" value={formData.corporatePrice} onChange={(e) => setFormData({ ...formData, corporatePrice: parseFloat(e.target.value) || 0 })} className="input-field" required min={0} /></div>
                <div><label className="label-text block mb-1.5">Bulk (R) *</label><input type="number" step="0.01" value={formData.bulkPrice} onChange={(e) => setFormData({ ...formData, bulkPrice: parseFloat(e.target.value) || 0 })} className="input-field" required min={0} /></div>
                <div><label className="label-text block mb-1.5">Wholesale (R) *</label><input type="number" step="0.01" value={formData.wholesalePrice} onChange={(e) => setFormData({ ...formData, wholesalePrice: parseFloat(e.target.value) || 0 })} className="input-field" required min={0} /></div>
                <div><label className="label-text block mb-1.5">Retail (R) *</label><input type="number" step="0.01" value={formData.retailPrice} onChange={(e) => setFormData({ ...formData, retailPrice: parseFloat(e.target.value) || 0 })} className="input-field" required min={0} /></div>
              </div>
              <div><label className="label-text block mb-1.5">Description</label><textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="input-field" rows={2} /></div>
              <button type="submit" className="btn-primary w-full justify-center">{editingId ? "Update" : "Add"} Product</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
