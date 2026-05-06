import { useState } from "react";
import { Card, Table, Button, Modal, Form, Input, Select, Tag, Space, Popconfirm, message, Typography } from "antd";
import { PlusOutlined, DeleteOutlined, MessageOutlined, EyeOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { listUsers, createUser, deleteUser } from "@/api/users";
import { REFETCH_INTERVALS } from "@/utils/constants";
import { idToStr } from "@/utils/format";

const { Title } = Typography;

export function UserListPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [creating, setCreating] = useState(false);
  const selectedRole: string = Form.useWatch("role", form) ?? "user";

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users"], queryFn: () => listUsers(token!),
    enabled: !!token, refetchInterval: REFETCH_INTERVALS.Users,
  });

  const handleCreate = async (v: { username: string; password?: string; role: string; loginName?: string }) => {
    if (!token) return; setCreating(true);
    try {
      await createUser(token, v);
      message.success("用户创建成功"); setModalOpen(false); form.resetFields();
      queryClient.invalidateQueries({ queryKey: ["users"] });
    } catch (e) { message.error(e instanceof Error ? e.message : "创建失败"); }
    finally { setCreating(false); }
  };

  const handleDelete = async (nodeId: string, userId: string) => {
    if (!token) return;
    try { await deleteUser(token, nodeId, userId); message.success("已删除"); queryClient.invalidateQueries({ queryKey: ["users"] }); }
    catch (e) { message.error(e instanceof Error ? e.message : "删除失败"); }
  };

  const roleColors: Record<string, string> = { admin: "red", super_admin: "purple", user: "blue", channel: "green" };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>用户管理</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>新建用户</Button>
      </div>
      <Card>
        <Table dataSource={users} rowKey={(record) => `${record.nodeId}:${record.userId}`} loading={isLoading}
          columns={[
            { title: "节点 ID", dataIndex: "nodeId", render: idToStr, width: 120 },
            { title: "用户 ID", dataIndex: "userId", render: idToStr, width: 120 },
            { title: "用户名", dataIndex: "username" },
            { title: "角色", dataIndex: "role", render: (r: string) => <Tag color={roleColors[r] ?? "default"}>{r}</Tag>, width: 120 },
            { title: "操作", width: 200, render: (_: unknown, record: { nodeId: string; userId: string }) => (
              <Space>
                <Button size="small" icon={<EyeOutlined />} onClick={() => navigate(`/admin/users/${idToStr(record.nodeId)}/${idToStr(record.userId)}`)}>详情</Button>
                <Button size="small" icon={<MessageOutlined />} onClick={() => navigate(`/admin/messages/${idToStr(record.nodeId)}/${idToStr(record.userId)}`)}>消息</Button>
                <Popconfirm title="确认删除此用户？" onConfirm={() => handleDelete(record.nodeId, record.userId)}>
                  <Button size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </Space>
            )},
          ]} />
      </Card>
      <Modal title="新建用户" open={modalOpen} onCancel={() => setModalOpen(false)} onOk={() => form.submit()} confirmLoading={creating}>
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="username" label="用户名" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="loginName" label="登录名"><Input placeholder="留空则仅可通过 ID 登录" /></Form.Item>
          <Form.Item name="password" label="密码" rules={selectedRole === "channel" ? [] : [{ required: true, min: 4 }]}>
            <Input.Password disabled={selectedRole === "channel"} placeholder={selectedRole === "channel" ? "频道无需密码" : undefined} />
          </Form.Item>
          <Form.Item name="role" label="角色" initialValue="user" rules={[{ required: true }]}>
            <Select options={[{ label: "用户 (user)", value: "user" }, { label: "管理员 (admin)", value: "admin" }, { label: "频道 (channel)", value: "channel" }]} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
