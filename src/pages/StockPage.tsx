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
    productCode: "",
    productName: "",
    category: "",
    quantity: 0,
    unitPrice: 0,
    description: "",
  });

  const { data: stockItems, isLoading } = trpc.stock.search.useQuery(
    { query: search || " " },
    { enabled: true }
  );
  const { data: categories } = trpc.stock.getCategories.useQuery();
  const { data: stats } = trpc.stock.getStats.useQuery();

  const createStock = trpc.stock.create.useMutation({
    onSuccess: () => {
      utils.stock.search.invalidate();
      utils.stock.getStats.invalidate();
      setShowForm(false);
      resetForm();
    },
  });

  const updateStock = trpc.stock.update.useMutation({
    onSuccess: () => {
      utils.stock.search.invalidate();
      utils.stock.getStats.invalidate();
      setShowForm(false);
      setEditingId(null);
      resetForm();
    },
  });

  const deleteStock = trpc.stock.delete.useMutation({
    onSuccess: () => {
      utils.stock.search.invalidate();
      utils.stock.getStats.invalidate();
    },
  });

  const bulkUpload = trpc.stock.bulkUpload.useMutation({
    onSuccess: () => {
      utils.stock.search.invalidate();
      utils.stock.getStats.invalidate();
      setShowUpload(false);
    },
  });

  function resetForm() {
    setFormData({ productCode: "", productName: "", category: "", quantity: 0, unitPrice: 0, description: "" });
  }

  function handleEdit(item: NonNullable<typeof stockItems>[0]) {
    setFormData({
      productCode: item.productCode,
      productName: item.productName,
      category: item.category,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      description: item.description || "",
    });
    setEditingId(item.id);
    setShowForm(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editingId) {
      updateStock.mutate({ id: editingId, ...formData });
    } else {
      createStock.mutate(formData);
    }
  }

  function handleCSVUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split("\n").filter((l) => l.trim());
      const items = [];
      // Support format: ProductCode, ProductName, Category, Quantity, UnitPrice, Description
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
        if (cols.length >= 5 && cols[0] && cols[1]) {
          items.push({
            productCode: cols[0],
            productName: cols[1],
            category: cols[2] || "General",
            quantity: parseInt(cols[3]) || 0,
            unitPrice: parseFloat(cols[4]) || 0,
            description: cols[5] || "",
          });
        }
      }
      if (items.length > 0) {
        bulkUpload.mutate(items);
      } else {
        alert("No valid products found in CSV. Please check the format.");
      }
    };
    reader.readAsText(file);
  }

  const filtered = (stockItems || []).filter((item) => {
    if (category && item.category !== category) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display font-semibold text-white" style={{ fontSize: "clamp(1.8rem, 3vw, 2.5rem)", letterSpacing: "-0.03em" }}>
            Stock on Hand
          </h1>
          <p className="text-[#8A8B8C] font-body text-sm mt-1">
            Manage your inventory &middot; {stats?.totalProducts || 0} products
          </p>
        </div>
        {isAdmin && (
          <div className="flex gap-3">
            <button onClick={() => setShowUpload(true)} className="btn-secondary">
              <Upload className="w-4 h-4" /> Upload CSV
            </button>
            <button onClick={() => { setShowForm(true); resetForm(); setEditingId(null); }} className="btn-primary">
              <Plus className="w-4 h-4" /> Add Product
            </button>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card-surface p-4">
          <div className="label-text mb-1">TOTAL PRODUCTS</div>
          <div className="stat-number">{stats?.totalProducts || 0}</div>
        </div>
        <div className="card-surface p-4">
          <div className="label-text mb-1">STOCK VALUE</div>
          <div className="stat-number" style={{ fontSize: "1.3rem" }}>
            R {(stats?.totalValue || 0).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}
          </div>
        </div>
        <div className="card-surface p-4">
          <div className="label-text mb-1">LOW STOCK</div>
          <div className="stat-number" style={{ color: "#F59E0B" }}>{stats?.lowStock || 0}</div>
        </div>
        <div className="card-surface p-4">
          <div className="label-text mb-1">OUT OF STOCK</div>
          <div className="stat-number" style={{ color: "#EF4444" }}>{stats?.outOfStock || 0}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="card-surface p-4 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A8B8C]" />
          <input
            type="text"
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-10 w-full"
          />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="input-field sm:w-48"
        >
          <option value="">All Categories</option>
          {(categories || []).map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="card-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ backgroundColor: "#131415", borderBottom: "1px solid #222324" }}>
                <th className="text-left p-4 label-text">Product Code</th>
                <th className="text-left p-4 label-text">Product Name</th>
                <th className="text-left p-4 label-text">Category</th>
                <th className="text-right p-4 label-text">Qty</th>
                <th className="text-right p-4 label-text">Unit Price</th>
                <th className="text-left p-4 label-text">Status</th>
                {isAdmin && <th className="text-right p-4 label-text">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={isAdmin ? 7 : 6} className="p-4">
                      <div className="shimmer h-10 rounded" />
                    </td>
                  </tr>
                ))
              ) : (
                filtered.map((item) => (
                  <tr
                    key={item.id}
                    className="transition-colors hover:bg-[#131415]"
                    style={{
                      borderLeft:
                        item.status === "low_stock"
                          ? "3px solid #F59E0B"
                          : item.status === "out_of_stock"
                            ? "3px solid #EF4444"
                            : "3px solid transparent",
                    }}
                  >
                    <td className="p-4 font-mono-data text-xs text-[#D4A843]">{item.productCode}</td>
                    <td className="p-4 text-sm text-[#E8E8E9] font-body">{item.productName}</td>
                    <td className="p-4 text-sm text-[#8A8B8C] font-body">{item.category}</td>
                    <td className="p-4 text-right font-display font-semibold text-white">{item.quantity}</td>
                    <td className="p-4 text-right font-display text-[#E8E8E9]">
                      R {Number(item.unitPrice).toFixed(2)}
                    </td>
                    <td className="p-4">
                      <span
                        className="status-badge"
                        style={{
                          backgroundColor:
                            item.status === "in_stock"
                              ? "rgba(74, 222, 128, 0.12)"
                              : item.status === "low_stock"
                                ? "rgba(245, 158, 11, 0.12)"
                                : "rgba(239, 68, 68, 0.12)",
                          color:
                            item.status === "in_stock"
                              ? "#4ADE80"
                              : item.status === "low_stock"
                                ? "#F59E0B"
                                : "#EF4444",
                        }}
                      >
                        {item.status === "in_stock" ? (
                          <><CheckCircle className="w-3 h-3" /> IN STOCK</>
                        ) : item.status === "low_stock" ? (
                          <><AlertTriangle className="w-3 h-3" /> LOW</>
                        ) : (
                          <><X className="w-3 h-3" /> OUT</>
                        )}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="p-4 text-right">
                        <button onClick={() => handleEdit(item)} className="p-1.5 hover:text-[#D4A843] transition-colors cursor-pointer">
                          <Pencil className="w-4 h-4 text-[#8A8B8C]" />
                        </button>
                        <button
                          onClick={() => { if (confirm("Delete this product?")) deleteStock.mutate({ id: item.id }); }}
                          className="p-1.5 hover:text-[#EF4444] transition-colors cursor-pointer ml-1"
                        >
                          <Trash2 className="w-4 h-4 text-[#8A8B8C]" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 7 : 6} className="p-8 text-center text-[#8A8B8C] font-body">
                    <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    No products found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Upload Dialog */}
      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.7)" }}>
          <div className="card-surface p-8 max-w-md w-full mx-4" style={{ borderRadius: 16 }}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display font-semibold text-white text-xl">Upload Stock CSV</h2>
              <button onClick={() => setShowUpload(false)} className="cursor-pointer"><X className="w-5 h-5 text-[#8A8B8C]" /></button>
            </div>
            <div
              className="border-2 border-dashed rounded-xl p-8 text-center mb-6"
              style={{ borderColor: "#D4A843", backgroundColor: "rgba(212, 168, 67, 0.05)" }}
            >
              <Upload className="w-12 h-12 mx-auto mb-4" style={{ color: "#D4A843" }} />
              <p className="text-[#E8E8E9] font-body text-sm mb-2">Drop CSV file here or click to browse</p>
              <p className="text-[#8A8B8C] text-xs font-body">Format: ProductCode, ProductName, Category, Quantity, UnitPrice</p>
              <input
                type="file"
                accept=".csv"
                onChange={handleCSVUpload}
                className="hidden"
                id="csv-upload"
              />
              <label htmlFor="csv-upload" className="btn-primary mt-4 inline-flex cursor-pointer">
                Browse Files
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Form Dialog */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.7)" }}>
          <div className="card-surface p-8 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto" style={{ borderRadius: 16 }}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display font-semibold text-white text-xl">
                {editingId ? "Edit Product" : "Add Product"}
              </h2>
              <button onClick={() => setShowForm(false)} className="cursor-pointer"><X className="w-5 h-5 text-[#8A8B8C]" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label-text block mb-1.5">Product Code</label>
                <input
                  type="text"
                  value={formData.productCode}
                  onChange={(e) => setFormData({ ...formData, productCode: e.target.value })}
                  className="input-field"
                  required
                />
              </div>
              <div>
                <label className="label-text block mb-1.5">Product Name</label>
                <input
                  type="text"
                  value={formData.productName}
                  onChange={(e) => setFormData({ ...formData, productName: e.target.value })}
                  className="input-field"
                  required
                />
              </div>
              <div>
                <label className="label-text block mb-1.5">Category</label>
                <input
                  type="text"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="input-field"
                  required
                  placeholder="e.g., Hog Casings, Sheep Casings"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label-text block mb-1.5">Quantity</label>
                  <input
                    type="number"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })}
                    className="input-field"
                    required
                    min={0}
                  />
                </div>
                <div>
                  <label className="label-text block mb-1.5">Unit Price (R)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.unitPrice}
                    onChange={(e) => setFormData({ ...formData, unitPrice: parseFloat(e.target.value) || 0 })}
                    className="input-field"
                    required
                    min={0}
                  />
                </div>
              </div>
              <div>
                <label className="label-text block mb-1.5">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="input-field"
                  rows={3}
                />
              </div>
              <button type="submit" className="btn-primary w-full justify-center">
                {editingId ? "Update Product" : "Add Product"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
