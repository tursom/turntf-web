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

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users"], queryFn: () => listUsers(token!),
    enabled: !!token, refetchInterval: REFETCH_INTERVALS.Users,
  });

  const handleCreate = async (v: { username: string; password: string; role: string }) => {
    if (!token) return; setCreating(true);
    try {
      await createUser(token, v);
      message.success("用户创建成功"); setModalOpen(false); form.resetFields();
      queryClient.invalidateQueries({ queryKey: ["users"] });
    } catch (e) { message.error(e instanceof Error ? e.message : "创建失败"); }
    finally { setCreating(false); }
  };

  const handleDelete = async (nid: number, uid: number) => {
    if (!token) return;
    try { await deleteUser(token, idToStr(nid), idToStr(uid)); message.success("已删除"); queryClient.invalidateQueries({ queryKey: ["users"] }); }
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
        <Table dataSource={users} rowKey={(r) => `${r.node_id}:${r.user_id}`} loading={isLoading}
          columns={[
            { title: "节点 ID", dataIndex: "node_id", render: idToStr, width: 120 },
            { title: "用户 ID", dataIndex: "user_id", render: idToStr, width: 120 },
            { title: "用户名", dataIndex: "username" },
            { title: "角色", dataIndex: "role", render: (r: string) => <Tag color={roleColors[r] ?? "default"}>{r}</Tag>, width: 120 },
            { title: "操作", width: 200, render: (_: unknown, r: { node_id: number; user_id: number }) => (
              <Space>
                <Button size="small" icon={<EyeOutlined />} onClick={() => navigate(`/admin/users/${idToStr(r.node_id)}/${idToStr(r.user_id)}`)}>详情</Button>
                <Button size="small" icon={<MessageOutlined />} onClick={() => navigate(`/admin/messages/${idToStr(r.node_id)}/${idToStr(r.user_id)}`)}>消息</Button>
                <Popconfirm title="确认删除此用户？" onConfirm={() => handleDelete(r.node_id, r.user_id)}>
                  <Button size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </Space>
            )},
          ]} />
      </Card>
      <Modal title="新建用户" open={modalOpen} onCancel={() => setModalOpen(false)} onOk={() => form.submit()} confirmLoading={creating}>
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="username" label="用户名" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true, min: 4 }]}><Input.Password /></Form.Item>
          <Form.Item name="role" label="角色" initialValue="user" rules={[{ required: true }]}>
            <Select options={[{ label: "用户 (user)", value: "user" }, { label: "管理员 (admin)", value: "admin" }, { label: "频道 (channel)", value: "channel" }]} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
