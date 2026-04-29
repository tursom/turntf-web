import { Layout } from "antd";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

export function AppLayout() {
  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sidebar />
      <Layout style={{ marginLeft: 220 }}>
        <Header />
        <Layout.Content
          style={{
            margin: 0,
            padding: 24,
            background: "#f5f5f5",
            minHeight: "calc(100vh - 56px)",
          }}
        >
          <Outlet />
        </Layout.Content>
      </Layout>
    </Layout>
  );
}
