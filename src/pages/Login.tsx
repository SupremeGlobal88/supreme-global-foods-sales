import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "@/hooks/useAuth";
import { Globe, Mail, Lock, Eye, EyeOff, User } from "lucide-react";
import gsap from "gsap";

const SALES_REPS = ["Adeli", "Inhouse", "Michael", "Nkosana", "Shanelle", "Tebogo Bila"];

export default function Login() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<"sales" | "admin">("sales");
  const [selectedRep, setSelectedRep] = useState(SALES_REPS[0]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const bgImageRef = useRef<HTMLDivElement>(null);
  const circleRef = useRef<HTMLDivElement>(null);
  const ring1Ref = useRef<HTMLDivElement>(null);
  const ring2Ref = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/dashboard");
      return;
    }

    const tl = gsap.timeline();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const targetDiameter = Math.sqrt(vw ** 2 + vh ** 2) * 2;
    const initialSize = vw * 0.2;
    const finalScale = targetDiameter / initialSize;

    tl.to(circleRef.current, { scale: finalScale, duration: 2.8, ease: "power3.out", transformOrigin: "center center" }, 0);
    tl.to(bgImageRef.current, { clipPath: `circle(${targetDiameter / 2}px at 50% 12.5vh)`, opacity: 1, duration: 2.8, ease: "power3.out" }, 0);
    tl.to(ring1Ref.current, { scale: finalScale * 1.02, opacity: 0.6, duration: 2.8, ease: "power3.out", transformOrigin: "center center" }, 0);
    tl.to(ring2Ref.current, { scale: finalScale * 1.05, opacity: 0.3, duration: 2.8, ease: "power3.out", transformOrigin: "center center" }, 0.1);
    tl.to(textRef.current, { opacity: 1, y: 0, duration: 1, ease: "power3.out" }, 1.6);
    tl.to(circleRef.current, { opacity: 0, duration: 0.5, ease: "power2.out" }, 2.2);
    tl.to([ring1Ref.current, ring2Ref.current], { opacity: 0, duration: 0.5, ease: "power2.out" }, 2.2);

    tl.eventCallback("onComplete", () => {
      if (circleRef.current) circleRef.current.style.display = "none";
      if (ring1Ref.current) ring1Ref.current.style.display = "none";
      if (ring2Ref.current) ring2Ref.current.style.display = "none";
    });

    return () => { tl.kill(); };
  }, [isAuthenticated, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      localStorage.setItem("demo_user", JSON.stringify({
        id: 1,
        name: role === "admin" ? "Admin User" : selectedRep,
        email: email || "user@supreme.co.za",
        role: role === "admin" ? "admin" : "user",
      }));
      navigate("/dashboard");
    } catch {
      setError("Login failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: "#0C0D0E" }}>
      {/* Left Panel - Login Form */}
      <div className="w-full lg:w-[55%] flex flex-col justify-center items-center px-8 py-12 relative z-10">
        <div className="absolute top-8 left-12 flex items-center gap-3">
          <Globe className="w-6 h-6" style={{ color: "#D4A843" }} />
          <div>
            <span className="font-display font-semibold text-white text-lg">Supreme</span>
            <span className="block text-xs text-[#8A8B8C] font-body">Sales Command</span>
          </div>
        </div>

        <div className="w-full max-w-[380px]">
          <h1 className="font-display font-bold text-white mb-2" style={{ fontSize: "clamp(1.8rem, 3vw, 2.5rem)", letterSpacing: "-0.03em", lineHeight: 1.1 }}>
            Welcome Back
          </h1>
          <p className="text-[#8A8B8C] font-body mb-12" style={{ fontSize: "0.9rem" }}>
            Sign in to access your sales dashboard
          </p>

          <div className="flex p-1 rounded-full mb-6" style={{ backgroundColor: "#18191A", border: "1px solid #222324" }}>
            <button
              onClick={() => setRole("sales")}
              className="flex-1 py-2 rounded-full text-sm font-body font-medium transition-all duration-200 cursor-pointer"
              style={{ backgroundColor: role === "sales" ? "#D4A843" : "transparent", color: role === "sales" ? "#0A0A0B" : "#8A8B8C" }}
            >Sales Rep</button>
            <button
              onClick={() => setRole("admin")}
              className="flex-1 py-2 rounded-full text-sm font-body font-medium transition-all duration-200 cursor-pointer"
              style={{ backgroundColor: role === "admin" ? "#D4A843" : "transparent", color: role === "admin" ? "#0A0A0B" : "#8A8B8C" }}
            >Admin</button>
          </div>

          {/* Sales Rep Selector */}
          {role === "sales" && (
            <div className="mb-4">
              <label className="label-text block mb-1.5">Select Your Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#8A8B8C]" />
                <select
                  value={selectedRep}
                  onChange={(e) => setSelectedRep(e.target.value)}
                  className="input-field pl-11"
                >
                  {SALES_REPS.map((rep) => (
                    <option key={rep} value={rep}>{rep}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 rounded-lg text-sm" style={{ backgroundColor: "rgba(239, 68, 68, 0.12)", color: "#EF4444" }}>
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#8A8B8C]" />
              <input type="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} className="input-field pl-11" required />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#8A8B8C]" />
              <input type={showPassword ? "text" : "password"} placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="input-field pl-11 pr-11" required />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer">
                {showPassword ? <EyeOff className="w-5 h-5 text-[#8A8B8C]" /> : <Eye className="w-5 h-5 text-[#8A8B8C]" />}
              </button>
            </div>
            <div className="flex justify-end">
              <span className="text-sm text-[#8A8B8C] font-body cursor-pointer hover:text-[#D4A843] transition-colors">Forgot password?</span>
            </div>
            <button type="submit" disabled={isLoading} className="btn-primary w-full justify-center" style={{ opacity: isLoading ? 0.7 : 1 }}>
              {isLoading ? <div className="w-5 h-5 border-2 border-[#0A0A0B] border-t-transparent rounded-full animate-spin" /> : "Sign In"}
            </button>
          </form>
        </div>

        <div className="absolute bottom-8 left-12">
          <p className="text-sm text-[#8A8B8C] font-body">
            Need help? Contact <a href="mailto:admin@supremeglobalfoods.co.za" className="text-[#D4A843] hover:underline">admin@supremeglobalfoods.co.za</a>
          </p>
        </div>
      </div>

      {/* Right Panel - Hero */}
      <div className="hidden lg:block lg:w-[45%] relative overflow-hidden">
        <div ref={bgImageRef} className="absolute inset-0" style={{ backgroundImage: "url(/hero-bg.jpg)", backgroundSize: "cover", backgroundPosition: "center", clipPath: "circle(10vw at 50% 12.5vh)", opacity: 0, willChange: "clip-path, opacity" }}>
          <div className="absolute inset-0" style={{ background: "radial-gradient(circle at 50% 30%, rgba(212, 168, 67, 0.08) 0%, transparent 70%)" }} />
        </div>
        <div ref={circleRef} className="absolute rounded-full" style={{ width: "20vw", height: "20vw", top: "12.5vh", left: "50%", transform: "translateX(-50%) scale(1)", backgroundColor: "#D4A843", transformOrigin: "center center", willChange: "transform, opacity", zIndex: 5 }} />
        <div ref={ring1Ref} className="absolute rounded-full" style={{ width: "20vw", height: "20vw", top: "12.5vh", left: "50%", transform: "translate(-50%, -50%) scale(0.2)", border: "3px solid #C9963A", transformOrigin: "center center", opacity: 0, willChange: "transform, opacity", zIndex: 4 }} />
        <div ref={ring2Ref} className="absolute rounded-full" style={{ width: "20vw", height: "20vw", top: "12.5vh", left: "50%", transform: "translate(-50%, -50%) scale(0.2)", border: "2px solid #B8923A", transformOrigin: "center center", opacity: 0, willChange: "transform, opacity", zIndex: 3 }} />
        <div ref={textRef} className="absolute text-center" style={{ top: "30vh", left: "50%", transform: "translateX(-50%)", opacity: 0, willChange: "opacity, transform", zIndex: 10 }}>
          <h2 className="font-display font-bold text-white mb-2" style={{ fontSize: "2rem", textShadow: "0 2px 20px rgba(0,0,0,0.8)" }}>Exquisite Casings for</h2>
          <h2 className="font-display font-bold mb-4" style={{ fontSize: "2rem", color: "#D4A843", textShadow: "0 2px 20px rgba(0,0,0,0.8)" }}>Culinary Masters</h2>
          <p className="text-[#E8E8E9] font-body" style={{ fontSize: "1rem", textShadow: "0 1px 10px rgba(0,0,0,0.8)" }}>Your Gourmet Adventure Awaits</p>
        </div>
      </div>
    </div>
  );
}
