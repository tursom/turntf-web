import { Card, Descriptions, Button, Form, Input, message, Tag, Space, Modal } from "antd";
import { LockOutlined } from "@ant-design/icons";
import { useAuth } from "@/hooks/useAuth";
import { updateUser } from "@/api/users";
import { useState } from "react";

export function SettingsPage() {
  const { user, token, logout, refreshRealtimePassword } = useAuth();
  const [changingPwd, setChangingPwd] = useState(false);
  const [form] = Form.useForm();

  if (!user) return null;

  const handleChangePassword = async (values: { newPassword: string }) => {
    if (!token) return;
    try {
      await updateUser(token, user.nodeId, user.userId, { password: values.newPassword });
      refreshRealtimePassword(values.newPassword);
      message.success("密码修改成功");
      setChangingPwd(false);
      form.resetFields();
    }
    catch (e) { message.error(e instanceof Error ? e.message : "修改密码失败"); }
  };

  return (
    <Card title="个人设置" style={{ maxWidth: 600 }}>
      <Descriptions column={1} bordered style={{ marginBottom: 24 }}>
        <Descriptions.Item label="节点 ID">{user.nodeId}</Descriptions.Item>
        <Descriptions.Item label="用户 ID">{user.userId}</Descriptions.Item>
        <Descriptions.Item label="用户名">{user.username}</Descriptions.Item>
        <Descriptions.Item label="角色">
          <Tag color={user.role === "admin" || user.role === "super_admin" ? "red" : "blue"}>{user.role}</Tag>
        </Descriptions.Item>
      </Descriptions>
      <Space>
        <Button icon={<LockOutlined />} onClick={() => setChangingPwd(true)}>修改密码</Button>
        <Button danger onClick={logout}>登出</Button>
      </Space>
      <Modal title="修改密码" open={changingPwd} onCancel={() => setChangingPwd(false)} onOk={() => form.submit()}>
        <Form form={form} layout="vertical" onFinish={handleChangePassword}>
          <Form.Item name="newPassword" label="新密码" rules={[{ required: true, message: "请输入新密码" }, { min: 4, message: "密码至少4位" }]}>
            <Input.Password />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
