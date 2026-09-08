import { Layout, Dropdown, Button, Space, Tooltip } from "antd";
import {
  MenuOutlined,
  UserOutlined,
  LogoutOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";

export function Header({ compact, onOpenNavigation }: { compact: boolean; onOpenNavigation: () => void }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const items = {
    items: [
      {
        key: "settings",
        icon: <SettingOutlined />,
        label: "设置",
        onClick: () => navigate("/settings"),
      },
      { type: "divider" as const },
      {
        key: "logout",
        icon: <LogoutOutlined />,
        label: "登出",
        onClick: logout,
      },
    ],
  };

  return (
    <Layout.Header
      style={{
        background: "#fff",
        padding: compact ? "0 12px" : "0 24px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        borderBottom: "1px solid #f0f0f0",
        height: 56,
      }}
    >
      <Space>
        {compact && <Tooltip title="打开导航"><Button type="text" icon={<MenuOutlined />} aria-label="打开导航" onClick={onOpenNavigation} /></Tooltip>}
        {compact && <strong>turntf</strong>}
      </Space>
      <Dropdown menu={items} placement="bottomRight" trigger={["click"]}>
        <Button type="text" style={{ maxWidth: compact ? "60%" : 320, overflow: "hidden" }} aria-label="账户菜单">
          <Space>
            <UserOutlined />
            <span style={{ display: "inline-block", maxWidth: compact ? 140 : 240, overflow: "hidden", textOverflow: "ellipsis", verticalAlign: "bottom" }}>{user?.username ?? "用户"}</span>
          </Space>
        </Button>
      </Dropdown>
    </Layout.Header>
  );
}
