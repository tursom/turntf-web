import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import { AuthProvider } from "@/context/AuthContext";
import { ChatProvider } from "@/context/ChatContext";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { AppLayout } from "@/components/layout/AppLayout";
import { ProtectedRoute } from "@/components/common/ProtectedRoute";
import { AdminRoute } from "@/components/common/AdminRoute";
import { LoginPage } from "@/pages/LoginPage";
import { ChatPage } from "@/pages/ChatPage";
import { ContactsPage } from "@/pages/ContactsPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { UserListPage } from "@/pages/UserListPage";
import { UserDetailPage } from "@/pages/UserDetailPage";
import { MessageListPage } from "@/pages/MessageListPage";
import { EventLogPage } from "@/pages/EventLogPage";
import { ClusterPage } from "@/pages/ClusterPage";
import { MetricsPage } from "@/pages/MetricsPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5000,
    },
  },
});

export default function App() {
  return (
    <ErrorBoundary>
      <ConfigProvider locale={zhCN}>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <AuthProvider>
              <ChatProvider>
                <Routes>
                  <Route path="/login" element={<LoginPage />} />
                  <Route element={<ProtectedRoute />}>
                    <Route element={<AppLayout />}>
                      <Route path="/chat" element={<ChatPage />} />
                      <Route path="/chat/:nodeId/:userId" element={<ChatPage />} />
                      <Route path="/contacts" element={<ContactsPage />} />
                      <Route path="/settings" element={<SettingsPage />} />
                      <Route path="/admin/cluster" element={<ClusterPage />} />
                    </Route>
                    <Route element={<AdminRoute />}>
                      <Route element={<AppLayout />}>
                        <Route path="/admin" element={<DashboardPage />} />
                        <Route path="/admin/users" element={<UserListPage />} />
                        <Route path="/admin/users/:nodeId/:userId" element={<UserDetailPage />} />
                        <Route path="/admin/messages/:nodeId/:userId" element={<MessageListPage />} />
                        <Route path="/admin/events" element={<EventLogPage />} />
                        <Route path="/admin/metrics" element={<MetricsPage />} />
                      </Route>
                    </Route>
                    <Route path="/admin/messages/:nodeId/:userId" element={<MessageListPage />} />
                  </Route>
                  <Route path="*" element={<Navigate to="/chat" replace />} />
                </Routes>
              </ChatProvider>
            </AuthProvider>
          </BrowserRouter>
        </QueryClientProvider>
      </ConfigProvider>
    </ErrorBoundary>
  );
}
