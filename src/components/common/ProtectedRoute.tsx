import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { LoadingSpinner } from "./LoadingSpinner";

export function ProtectedRoute() {
  const { token, loading, discardLegacyRedirect } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingSpinner />;
  if (!token) {
    // A legacy detail URL may contain a rounded ID; do not replay it after migration.
    const target = discardLegacyRedirect ? "/login" : `/login?redirect=${encodeURIComponent(location.pathname)}`;
    return <Navigate to={target} replace />;
  }
  return <Outlet />;
}
