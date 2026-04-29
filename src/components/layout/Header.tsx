import { Layout, Dropdown, Button, Space } from "antd";
import {
  UserOutlined,
  LogoutOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";

export function Header() {
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
        padding: "0 24px",
        display: "flex",
        justifyContent: "flex-end",
        alignItems: "center",
        borderBottom: "1px solid #f0f0f0",
        height: 56,
      }}
    >
      <Dropdown menu={items} placement="bottomRight">
        <Button type="text">
          <Space>
            <UserOutlined />
            {user?.username ?? "用户"}
          </Space>
        </Button>
      </Dropdown>
    </Layout.Header>
  );
}
