import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const ADMIN_ONLY_ROUTES = ["/analytics", "/quotations", "/recovery", "/settings", "/partners"];

export default function ProtectedRoute() {
  const { user } = useAuth();
  const location = useLocation();
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role === "Employee" && ADMIN_ONLY_ROUTES.includes(location.pathname)) {
    return <Navigate to="/" replace />;
  }
  
  return <Outlet />;
}
