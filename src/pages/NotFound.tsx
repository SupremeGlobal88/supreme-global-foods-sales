import { Link } from "react-router";
import { ArrowLeft, Globe } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#0C0D0E" }}>
      <div className="text-center">
        <Globe className="w-16 h-16 mx-auto mb-6" style={{ color: "#D4A843" }} />
        <h1 className="font-display font-bold text-white text-6xl mb-4">404</h1>
        <p className="text-[#8A8B8C] font-body text-lg mb-8">
          The page you're looking for doesn't exist.
        </p>
        <Link to="/dashboard" className="btn-primary inline-flex">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
