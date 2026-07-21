import { useState, useMemo } from "react";

interface Customer {
  id: number;
  name: string;
  businessName?: string | null;
}

interface Props {
  customers: Customer[];
  value: number;
  onChange: (customerId: number) => void;
  placeholder?: string;
  required?: boolean;
}

export default function CustomerSearchDropdown({ customers, value, onChange, placeholder = "Select customer...", required = false }: Props) {
  const [filter, setFilter] = useState("");

  const selected = customers.find((c) => c.id === value);

  const list = useMemo(() => {
    const sorted = [...customers].sort((a, b) => a.name?.localeCompare(b.name || "") || 0);
    const q = filter.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((c) => c.name?.toLowerCase().includes(q) || c.businessName?.toLowerCase().includes(q));
  }, [customers, filter]);

  return (
    <div>
      {selected && (
        <div className="mb-2 px-3 py-2 rounded-lg text-sm font-body" style={{ background: "rgba(212,168,67,0.12)", color: "#D4A843" }}>
          Selected: <strong>{selected.name}</strong>
        </div>
      )}

      <input
        type="text"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Type to filter..."
        className="input-field w-full mb-2 text-sm font-body"
        style={{ fontSize: 16, minHeight: 40 }}
      />

      {/* PURE NATIVE SELECT - zero custom CSS that could break mobile */}
      <select
        value={value || ""}
        onChange={(e) => {
          const id = parseInt(e.currentTarget.value, 10);
          if (id > 0) onChange(id);
        }}
        style={{ display: "block", width: "100%", fontSize: 16, minHeight: 44 }}
      >
        <option value="" disabled>{placeholder}{required ? " *" : ""}</option>
        {list.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>

      <div className="text-xs text-[#8A8B8C] font-body mt-1">{list.length} customers</div>
    </div>
  );
}
