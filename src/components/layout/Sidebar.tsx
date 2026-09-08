import { Drawer, Layout, Menu } from "antd";
import {
  DashboardOutlined,
  UserOutlined,
  FileTextOutlined,
  ClusterOutlined,
  BarChartOutlined,
  CommentOutlined,
  ContactsOutlined,
} from "@ant-design/icons";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import type { MenuProps } from "antd";

type MenuItem = Required<MenuProps>["items"][number];

export function Sidebar({ compact, open, onClose }: { compact: boolean; open: boolean; onClose: () => void }) {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const adminItems: MenuItem[] = [
    {
      key: "/admin",
      icon: <DashboardOutlined />,
      label: "仪表盘",
    },
    {
      key: "/admin/users",
      icon: <UserOutlined />,
      label: "用户管理",
    },
    {
      key: "/admin/events",
      icon: <FileTextOutlined />,
      label: "事件日志",
    },
    {
      key: "/admin/cluster",
      icon: <ClusterOutlined />,
      label: "集群监控",
    },
    {
      key: "/admin/metrics",
      icon: <BarChartOutlined />,
      label: "指标",
    },
  ];

  const chatItems: MenuItem[] = [
    {
      key: "/chat",
      icon: <CommentOutlined />,
      label: "聊天",
    },
    {
      key: "/contacts",
      icon: <ContactsOutlined />,
      label: "联系人",
    },
  ];

  const allItems: MenuItem[] = isAdmin
    ? [...chatItems, { type: "divider" }, ...adminItems]
    : chatItems;

  const selectedKey = location.pathname.startsWith("/admin/users") || location.pathname.startsWith("/admin/messages")
    ? "/admin/users"
    : location.pathname.startsWith("/chat") ? "/chat" : location.pathname;

  const menu = (
    <Menu theme="light" mode="inline" selectedKeys={[selectedKey]} items={allItems}
      onClick={({ key }) => { navigate(key); onClose(); }} style={{ borderRight: 0 }} />
  );

  if (compact) {
    return <Drawer title="turntf" placement="left" width={240} open={open} onClose={onClose} styles={{ body: { padding: "12px 0" } }}>{menu}</Drawer>;
  }

  return (
    <Layout.Sider
      width={220}
      style={{
        background: "#fff",
        borderRight: "1px solid #e8e8e8",
        overflow: "auto",
        height: "100vh",
        position: "fixed",
        left: 0,
        top: 0,
        bottom: 0,
        zIndex: 10,
      }}
    >
      <div
        style={{
          height: 56,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#202124",
          fontSize: 20,
          fontWeight: 700,
          letterSpacing: 0,
          borderBottom: "1px solid #e8e8e8",
        }}
      >
        turntf
      </div>
      {menu}
    </Layout.Sider>
  );
}
