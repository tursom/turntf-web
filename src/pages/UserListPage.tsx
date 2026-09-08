import { useRef, useState } from "react";
import { Table, Button, Modal, Form, Input, Select, Tag, Space, Popconfirm, message, Typography, Tooltip } from "antd";
import { QueryStatus } from "@/components/common/QueryStatus";
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
  const pendingCreate = useRef(false);
  const selectedRole: string = Form.useWatch("role", form) ?? "user";

  const [search, setSearch] = useState("");
  const [role, setRole] = useState<string>();
  const [page, setPage] = useState(1);
  const usersQuery = useQuery({
    queryKey: ["users"], queryFn: () => listUsers(token!),
    enabled: !!token, refetchInterval: REFETCH_INTERVALS.Users,
  });

  const { data: users = [], isLoading } = usersQuery;
  const term = search.trim().toLowerCase();
  const filteredUsers = users.filter((item) =>
    (!role || item.role === role) &&
    (!term || item.username.toLowerCase().includes(term) || idToStr(item.userId).includes(term) ||
      `${idToStr(item.nodeId)}:${idToStr(item.userId)}`.includes(term)),
  );

  const handleCreate = async (v: { username: string; password?: string; role: string; loginName?: string }) => {
    if (!token || pendingCreate.current) return;
    pendingCreate.current = true;
    setCreating(true);
    try {
      await createUser(token, v);
      message.success("用户创建成功"); setModalOpen(false); form.resetFields();
      queryClient.invalidateQueries({ queryKey: ["users"] });
    } catch (e) { message.error(e instanceof Error ? e.message : "创建失败"); }
    finally { pendingCreate.current = false; setCreating(false); }
  };

  const handleDelete = async (nodeId: string, userId: string) => {
    if (!token) return;
    try { await deleteUser(token, nodeId, userId); message.success("已删除"); queryClient.invalidateQueries({ queryKey: ["users"] }); }
    catch (e) { message.error(e instanceof Error ? e.message : "删除失败"); }
  };

  const roleLabels: Record<string, string> = { admin: "管理员", super_admin: "超级管理员", user: "用户", channel: "频道" };
  const roleColors: Record<string, string> = { admin: "red", super_admin: "purple", user: "blue", channel: "green" };

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>用户管理</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>新建用户</Button>
      </div>
      <QueryStatus {...usersQuery} hasData={usersQuery.data !== undefined} onRefresh={() => { void usersQuery.refetch(); }} disabled={!token} />
      <Space wrap style={{ marginBottom: 16 }}>
        <Input allowClear aria-label="搜索已加载用户的用户名或 ID" placeholder="搜索已加载用户：用户名 / ID" value={search}
          onChange={(event) => { setSearch(event.target.value); setPage(1); }} style={{ width: 260, maxWidth: "100%" }} />
        <Select allowClear aria-label="筛选已加载用户角色" placeholder="已加载用户角色" value={role} style={{ width: 180 }}
          onChange={(value) => { setRole(value); setPage(1); }}
          options={Object.entries(roleLabels).map(([value, label]) => ({ value, label }))} />
        <Typography.Text type="secondary">已加载 {users.length} 位用户，筛选后 {filteredUsers.length} 位</Typography.Text>
      </Space>
        <Table dataSource={filteredUsers} scroll={{ x: 800 }} pagination={{ current: page, onChange: setPage, showTotal: (total) => `共 ${total} 位已加载用户` }} rowKey={(record) => `${record.nodeId}:${record.userId}`} loading={isLoading}
          columns={[
            { title: "节点 ID", dataIndex: "nodeId", render: idToStr, width: 120 },
            { title: "用户 ID", dataIndex: "userId", render: idToStr, width: 120 },
            { title: "用户名", dataIndex: "username" },
            { title: "角色", dataIndex: "role", render: (r: string) => <Tag color={roleColors[r] ?? "default"}>{roleLabels[r] ?? `未知角色（${r}）`}</Tag>, width: 120 },
            { title: "操作", width: 200, render: (_: unknown, record: { nodeId: string; userId: string }) => (
              <Space>
                <Button size="small" icon={<EyeOutlined />} onClick={() => navigate(`/admin/users/${idToStr(record.nodeId)}/${idToStr(record.userId)}`)}>详情</Button>
                <Button size="small" icon={<MessageOutlined />} onClick={() => navigate(`/admin/messages/${idToStr(record.nodeId)}/${idToStr(record.userId)}`)}>消息</Button>
                <Popconfirm title="确认删除此用户？" onConfirm={() => handleDelete(record.nodeId, record.userId)}>
                  <Tooltip title="删除用户"><Button size="small" danger icon={<DeleteOutlined />} aria-label="删除用户" /></Tooltip>
                </Popconfirm>
              </Space>
            )},
          ]} />
      <Modal title="新建用户" open={modalOpen} onCancel={() => { if (!creating) { setModalOpen(false); form.resetFields(); } }} onOk={() => form.submit()} confirmLoading={creating} closable={!creating} maskClosable={!creating} keyboard={!creating} cancelButtonProps={{ disabled: creating }}>
        <Form form={form} layout="vertical" onFinish={handleCreate} disabled={creating}>
          <Form.Item name="username" label="用户名" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="loginName" label="登录名"><Input placeholder="留空则仅可通过 ID 登录" /></Form.Item>
          <Form.Item name="password" label="密码" rules={selectedRole === "channel" ? [] : [{ required: true, min: 4 }]}>
            <Input.Password disabled={creating || selectedRole === "channel"} placeholder={selectedRole === "channel" ? "频道无需密码" : undefined} />
          </Form.Item>
          <Form.Item name="role" label="角色" initialValue="user" rules={[{ required: true }]}>
            <Select options={[{ label: "用户", value: "user" }, { label: "管理员", value: "admin" }, { label: "频道", value: "channel" }]} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
