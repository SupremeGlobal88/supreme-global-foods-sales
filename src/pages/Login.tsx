import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "@/hooks/useAuth";
import { trpc } from "@/providers/trpc";
import { directAuthenticate } from "@/lib/dataService";
import { Globe, Lock, Eye, EyeOff, User, Shield, Loader2 } from "lucide-react";
import gsap from "gsap";

/** Emergency Access — PIN protected, Collin only. */
function EmergencyAccess() {
  const [showPinInput, setShowPinInput] = useState(false);
  const [emergencyPin, setEmergencyPin] = useState("");
  const [pinError, setPinError] = useState("");
  const attemptsRef = useRef(0);

  function verifyPin() {
    if (emergencyPin === "2580") {
      localStorage.setItem("demo_user", JSON.stringify({
        id: 1,
        name: "Collin",
        email: "collin@supremeglobalfoods.co.za",
        role: "super_admin",
      }));
      window.location.href = "/#/dashboard";
    } else {
      attemptsRef.current += 1;
      setPinError(`Invalid PIN. ${3 - attemptsRef.current} attempts remaining.`);
      setEmergencyPin("");
      if (attemptsRef.current >= 3) {
        setShowPinInput(false);
        setPinError("");
        attemptsRef.current = 0;
      }
    }
  }

  if (showPinInput) {
    return (
      <div className="mt-4 space-y-2">
        <div className="relative">
          <input
            type="password"
            placeholder="Enter emergency PIN"
            value={emergencyPin}
            onChange={(e) => { setEmergencyPin(e.target.value); setPinError(""); }}
            onKeyDown={(e) => { if (e.key === "Enter") verifyPin(); }}
            className="input-field text-xs py-2"
            maxLength={10}
            autoFocus
          />
        </div>
        {pinError && <p className="text-[10px] text-[#EF4444] text-center">{pinError}</p>}
        <div className="flex gap-2 justify-center">
          <button onClick={verifyPin} className="btn-primary text-[10px] py-1.5 px-3">Unlock</button>
          <button onClick={() => { setShowPinInput(false); setEmergencyPin(""); setPinError(""); attemptsRef.current = 0; }} className="btn-secondary text-[10px] py-1.5 px-3">Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setShowPinInput(true)}
      className="text-[9px] text-[#9CA3AF] hover:text-[#D4AF37] underline mt-1"
    >
      Emergency Access
    </button>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [role, setRole] = useState<"admin" | "sales_rep">("admin");
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  /* ── Cloud-first: fetch users via tRPC so smartSync blocks if local empty ── */
  const usersQuery = trpc.user.list.useQuery(undefined, {
    refetchOnWindowFocus: false,
    staleTime: 60000,
  });

  const allUsers = usersQuery.data || [];
  const isLoadingUsers = usersQuery.isPending;

  const adminUsers = allUsers
    .filter((u: any) => u.role === "admin" || u.role === "super_admin")
    .map((u: any) => u.name);

  const salesReps = allUsers
    .filter((u: any) => u.role === "sales_rep")
    .map((u: any) => u.name);

  const [selectedAdmin, setSelectedAdmin] = useState("");
  const [selectedRep, setSelectedRep] = useState("");
  const [pin, setPin] = useState("");

  /* Set defaults once data arrives */
  useEffect(() => {
    if (adminUsers.length > 0 && !selectedAdmin) {
      setSelectedAdmin(adminUsers[0]);
    }
  }, [adminUsers, selectedAdmin]);

  useEffect(() => {
    if (salesReps.length > 0 && !selectedRep) {
      setSelectedRep(salesReps[0]);
    }
  }, [salesReps, selectedRep]);

  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!containerRef.current) return;
    gsap.fromTo(
      containerRef.current,
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.8, ease: "power3.out" }
    );
  }, []);

  const authenticate = trpc.user.authenticate.useMutation();

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError("");
      const name = role === "admin" ? selectedAdmin : selectedRep;
      if (!name || !pin) {
        setError("Please select a user and enter your PIN.");
        return;
      }
      setIsSubmitting(true);

      try {
        // Try 1: directAuthenticate FIRST (always works for hardcoded defaults + localStorage users)
        let result = directAuthenticate(name, pin);

        // Try 2: tRPC fallback (for any edge cases)
        if (!result) {
          try {
            result = await authenticate.mutateAsync({ name, pin });
          } catch { /* tRPC failed too */ }
        }

        if (result && result.name) {
          login(result);
          navigate("/dashboard", { replace: true });
        } else {
          setError("Invalid credentials. Please try again.");
        }
      } catch (err: any) {
        console.error("[Login] Unexpected error:", err);
        setError("An unexpected error occurred. Please try again.");
      } finally {
        setIsSubmitting(false);
      }
    },
    [role, selectedAdmin, selectedRep, pin, authenticate, login, navigate]
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0a0a0a] via-[#111111] to-[#0a0a0a] px-4">
      <div
        ref={containerRef}
        className="w-full max-w-md bg-[#111111] border border-[#1F1F1F] rounded-2xl shadow-2xl p-8 relative overflow-hidden"
      >
        {/* Ambient glow */}
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-[#D4AF37]/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-[#D4AF37]/3 rounded-full blur-3xl pointer-events-none" />

        <div className="relative text-center mb-8">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[#D4AF37]/10 flex items-center justify-center">
            <Globe className="w-6 h-6 text-[#D4AF37]" />
          </div>
          <h1 className="text-2xl font-light tracking-tight text-[#F5F5F5]">
            Supreme
          </h1>
          <p className="text-xs text-[#9CA3AF] mt-1">Sales Command</p>
        </div>

        <div className="relative mb-8">
          <h2 className="text-3xl font-light text-[#F5F5F5] text-center tracking-tight">
            Welcome Back
          </h2>
          <p className="text-xs text-[#9CA3AF] text-center mt-2">
            Sign in with your name and PIN
          </p>
        </div>

        {/* Role toggle */}
        <div className="flex gap-1 bg-[#1A1A1A] rounded-full p-1 mb-6 relative">
          <button
            onClick={() => setRole("sales_rep")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-full text-xs font-medium transition-all duration-200 ${
              role === "sales_rep"
                ? "bg-[#D4AF37] text-[#0a0a0a] shadow-lg"
                : "text-[#9CA3AF] hover:text-[#F5F5F5]"
            }`}
          >
            <User className="w-3.5 h-3.5" />
            Sales Rep
          </button>
          <button
            onClick={() => setRole("admin")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-full text-xs font-medium transition-all duration-200 ${
              role === "admin"
                ? "bg-[#D4AF37] text-[#0a0a0a] shadow-lg"
                : "text-[#9CA3AF] hover:text-[#F5F5F5]"
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            Admin
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 relative">
          <div>
            <label className="block text-[10px] font-medium text-[#9CA3AF] uppercase tracking-widest mb-2">
              Select Your Name
            </label>
            <div className="relative">
              {role === "admin" ? (
                <select
                  value={selectedAdmin}
                  onChange={(e) => { setSelectedAdmin(e.target.value); setError(""); }}
                  className="input-field appearance-none cursor-pointer pr-10"
                  disabled={isLoadingUsers}
                >
                  {isLoadingUsers ? (
                    <option>Loading users from cloud...</option>
                  ) : adminUsers.length === 0 ? (
                    <option>No admin users found</option>
                  ) : (
                    adminUsers.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))
                  )}
                </select>
              ) : (
                <select
                  value={selectedRep}
                  onChange={(e) => { setSelectedRep(e.target.value); setError(""); }}
                  className="input-field appearance-none cursor-pointer pr-10"
                  disabled={isLoadingUsers}
                >
                  {isLoadingUsers ? (
                    <option>Loading users from cloud...</option>
                  ) : salesReps.length === 0 ? (
                    <option>No sales reps found</option>
                  ) : (
                    salesReps.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))
                  )}
                </select>
              )}
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                {isLoadingUsers ? (
                  <Loader2 className="w-4 h-4 text-[#D4AF37] animate-spin" />
                ) : (
                  <svg className="w-4 h-4 text-[#9CA3AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                )}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-medium text-[#9CA3AF] uppercase tracking-widest mb-2">
              PIN
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
              <input
                type={showPin ? "text" : "password"}
                value={pin}
                onChange={(e) => { setPin(e.target.value); setError(""); }}
                placeholder="Enter your 4-digit PIN"
                className="input-field pl-10 pr-10"
                maxLength={10}
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#F5F5F5] transition-colors"
              >
                {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-[#EF4444]/10 border border-[#EF4444]/20 rounded-lg p-3">
              <p className="text-xs text-[#EF4444] text-center">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={authenticate.isPending || isSubmitting || isLoadingUsers}
            className="btn-primary w-full justify-center disabled:opacity-50"
          >
            {authenticate.isPending || isSubmitting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Verifying...
              </span>
            ) : isLoadingUsers ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading users...
              </span>
            ) : (
              "Sign In"
            )}
          </button>

          <EmergencyAccess />

          <p className="text-[10px] text-[#9CA3AF] text-center mt-4">
            Having trouble? Contact IT support.
          </p>
        </form>
      </div>
    </div>
  );
}
