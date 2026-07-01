import { memo, useMemo } from "react";

interface Customer {
  id: number;
  name: string;
  priceTier: string;
  salesRepName?: string;
}

interface Props {
  customers: Customer[];
  selectedId: number;
  onSelect: (customerId: number) => void;
}

const CustomerSelect = memo(function CustomerSelect({ customers, selectedId, onSelect }: Props) {
  // Memoize options so the array reference is stable — prevents select re-mounting
  const options = useMemo(() => {
    return customers.map((c) => (
      <option key={c.id} value={c.id}>
        {c.name} ({c.priceTier})
        {c.salesRepName ? ` - ${c.salesRepName}` : ""}
      </option>
    ));
  }, [customers]);

  return (
    <>
      <select
        value={selectedId || 0}
        onChange={(e) => {
          const cid = Number(e.target.value);
          if (cid > 0) onSelect(cid);
        }}
        className="input-field w-full"
        style={{ fontSize: 16, minHeight: 44 }}
        required
      >
        <option value={0}>-- Select a customer --</option>
        {options}
      </select>
      {selectedId > 0 && (
        <div className="mt-1 text-xs" style={{ color: "#4ADE80" }}>
          Selected: {customers.find((c) => c.id === selectedId)?.name || ""}
        </div>
      )}
    </>
  );
});

export default CustomerSelect;
