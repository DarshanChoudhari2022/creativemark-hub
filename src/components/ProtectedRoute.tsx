import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const ADMIN_ONLY_ROUTES = ["/analytics", "/quotations", "/recovery", "/settings", "/partners", "/financials", "/live-tracking", "/cash-custody"];

export default function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();
  
  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }


  if (user.role === "Employee" && ADMIN_ONLY_ROUTES.includes(location.pathname)) {
    return <Navigate to="/" replace />;
  }
  
  return <Outlet />;
}
