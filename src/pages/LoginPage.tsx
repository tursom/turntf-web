import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Form, Input, Button, Card, Typography, Segmented, message } from "antd";
import { UserOutlined, LockOutlined, NumberOutlined, IdcardOutlined } from "@ant-design/icons";
import { useAuth } from "@/hooks/useAuth";
import type { LoginResult } from "@/types";

const { Title, Text } = Typography;

export function LoginPage() {
  const { login, loginByLoginName } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [form] = Form.useForm();
  const [loginMode, setLoginMode] = useState<"id" | "loginName">("id");

  const onFinish = async (values: {
    nodeId?: string;
    userId?: string;
    loginName?: string;
    password: string;
  }) => {
    try {
      let resp: LoginResult;
      if (loginMode === "loginName") {
        resp = await loginByLoginName(values.loginName!, values.password);
      } else {
        resp = await login(values.nodeId!, values.userId!, values.password);
      }
      const redirect = searchParams.get("redirect");
      if (redirect) {
        navigate(redirect, { replace: true });
      } else if (resp.user.role === "admin" || resp.user.role === "super_admin") {
        navigate("/admin", { replace: true });
      } else {
        navigate("/chat", { replace: true });
      }
    } catch (err) {
      message.error(err instanceof Error ? err.message : "登录失败");
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      }}
    >
      <Card style={{ width: 400, boxShadow: "0 8px 32px rgba(0,0,0,0.2)" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <Title level={2} style={{ marginBottom: 4 }}>
            turntf
          </Title>
          <Text type="secondary">分布式通知服务管理平台</Text>
        </div>

        <Segmented
          block
          options={[
            { label: "ID 登录", value: "id" },
            { label: "登录名登录", value: "loginName" },
          ]}
          value={loginMode}
          onChange={(value) => {
            setLoginMode(value as "id" | "loginName");
            form.resetFields();
          }}
          style={{ marginBottom: 24 }}
        />

        <Form form={form} layout="vertical" onFinish={onFinish} size="large">
          {loginMode === "id" ? (
            <>
              <Form.Item name="nodeId" initialValue="1" rules={[{ required: true, message: "请输入节点 ID" }]}>
                <Input prefix={<NumberOutlined />} placeholder="节点 ID (默认 1)" />
              </Form.Item>
              <Form.Item name="userId" initialValue="1" rules={[{ required: true, message: "请输入用户 ID" }]}>
                <Input prefix={<UserOutlined />} placeholder="用户 ID (默认 1)" />
              </Form.Item>
            </>
          ) : (
            <Form.Item name="loginName" rules={[{ required: true, message: "请输入登录名" }]}>
              <Input prefix={<IdcardOutlined />} placeholder="登录名" />
            </Form.Item>
          )}
          <Form.Item name="password" rules={[{ required: true, message: "请输入密码" }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="密码" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              登录
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
