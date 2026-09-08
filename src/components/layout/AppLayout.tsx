import { useState } from "react";
import { Grid, Layout } from "antd";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

export function AppLayout() {
  const screens = Grid.useBreakpoint();
  const compact = !screens.lg;
  const [navigationOpen, setNavigationOpen] = useState(false);
  return (
    <Layout style={{ minHeight: "100dvh" }}>
      <Sidebar compact={compact} open={navigationOpen} onClose={() => setNavigationOpen(false)} />
      <Layout style={{ marginLeft: compact ? 0 : 220, minWidth: 0 }}>
        <Header compact={compact} onOpenNavigation={() => setNavigationOpen(true)} />
        <Layout.Content className="app-content">
          <Outlet />
        </Layout.Content>
      </Layout>
    </Layout>
  );
}
