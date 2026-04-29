import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { LoadingSpinner } from "./LoadingSpinner";
import { Result } from "antd";

export function AdminRoute() {
  const { token, isAdmin, loading } = useAuth();

  if (loading) return <LoadingSpinner />;
  if (!token) return <Navigate to="/login" replace />;
  if (!isAdmin) {
    return (
      <Result
        status="403"
        title="无权限"
        subTitle="仅管理员可访问此页面"
      />
    );
  }
  return <Outlet />;
}
