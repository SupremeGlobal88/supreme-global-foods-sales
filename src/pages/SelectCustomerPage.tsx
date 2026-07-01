import { useState } from "react";
import { useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import { Search, ArrowLeft, MapPin, User } from "lucide-react";

export default function SelectCustomerPage() {
  const navigate = useNavigate();
  const { data: customers } = trpc.customer.search.useQuery({ query: " " });
  const [search, setSearch] = useState("");

  const filtered = (customers || []).filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      c.name?.toLowerCase().includes(q) ||
      c.businessName?.toLowerCase().includes(q) ||
      c.customerCode?.toLowerCase().includes(q)
    );
  });

  function selectCustomer(customerId: number) {
    // Navigate back to orders page with customer pre-selected
    navigate("/orders", { state: { preselectedCustomerId: customerId } });
  }

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "#0C0D0E",
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "16px",
          borderBottom: "1px solid #222324",
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexShrink: 0,
        }}
      >
        <button
          onClick={() => navigate("/orders")}
          style={{
            background: "none",
            border: "none",
            color: "#8A8B8C",
            cursor: "pointer",
            padding: 8,
          }}
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1
          style={{
            color: "#fff",
            fontSize: 18,
            fontWeight: 600,
            margin: 0,
          }}
        >
          Select Customer
        </h1>
      </div>

      {/* Search */}
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid #222324",
          flexShrink: 0,
        }}
      >
        <div style={{ position: "relative" }}>
          <Search
            className="w-4 h-4"
            style={{
              position: "absolute",
              left: 12,
              top: "50%",
              transform: "translateY(-50%)",
              color: "#8A8B8C",
            }}
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customers..."
            autoFocus
            style={{
              width: "100%",
              background: "#141415",
              border: "1px solid #222324",
              borderRadius: 12,
              padding: "10px 12px 10px 36px",
              color: "#fff",
              fontSize: 16,
              outline: "none",
            }}
          />
        </div>
      </div>

      {/* Customer List */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "8px 16px",
          overscrollBehavior: "contain",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {filtered.map((c) => (
          <button
            key={c.id}
            onClick={() => selectCustomer(c.id)}
            style={{
              display: "block",
              width: "100%",
              textAlign: "left",
              padding: "14px 16px",
              marginBottom: 8,
              borderRadius: 12,
              border: "1px solid #222324",
              background: "#141415",
              color: "#fff",
              cursor: "pointer",
              touchAction: "manipulation",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  background: "rgba(212,168,67,0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <User className="w-5 h-5" style={{ color: "#D4A843" }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: 15,
                    marginBottom: 2,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {c.name}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "#8A8B8C",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    flexWrap: "wrap",
                  }}
                >
                  <span
                    style={{
                      color:
                        c.priceTier === "corporate"
                          ? "#D4A843"
                          : c.priceTier === "bulk"
                          ? "#6366F1"
                          : c.priceTier === "wholesale"
                          ? "#4ADE80"
                          : "#F59E0B",
                      fontWeight: 600,
                      textTransform: "capitalize",
                    }}
                  >
                    {c.priceTier}
                  </span>
                  {c.businessName && <span>{c.businessName}</span>}
                  {c.salesRepName && (
                    <span style={{ color: "#6366F1" }}>{c.salesRepName}</span>
                  )}
                </div>
                {c.physicalAddress && (
                  <div
                    style={{
                      fontSize: 11,
                      color: "#8A8B8C",
                      marginTop: 2,
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <MapPin className="w-3 h-3" />
                    {c.physicalAddress}
                    {c.city ? `, ${c.city}` : ""}
                  </div>
                )}
              </div>
            </div>
          </button>
        ))}

        {filtered.length === 0 && (
          <div
            style={{
              textAlign: "center",
              color: "#8A8B8C",
              padding: 40,
              fontSize: 14,
            }}
          >
            No customers found
          </div>
        )}
      </div>

      {/* Footer count */}
      <div
        style={{
          padding: "10px 16px",
          borderTop: "1px solid #222324",
          fontSize: 12,
          color: "#8A8B8C",
          textAlign: "center",
          flexShrink: 0,
        }}
      >
        {filtered.length} of {(customers || []).length} customers
      </div>
    </div>
  );
}
