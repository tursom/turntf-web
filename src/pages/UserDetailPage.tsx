import { Card, Descriptions, Button, Tag, Space, message, Modal, Form, Input, Select } from "antd";
import { EditOutlined, MessageOutlined, ArrowLeftOutlined } from "@ant-design/icons";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { getUser, updateUser } from "@/api/users";
import { idToStr, formatTime } from "@/utils/format";
import { useState } from "react";

export function UserDetailPage() {
  const { nodeId, userId } = useParams<{ nodeId: string; userId: string }>();
  const { token } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form] = Form.useForm();

  const { data: user, isLoading } = useQuery({
    queryKey: ["user", nodeId, userId],
    queryFn: () => getUser(token!, nodeId!, userId!),
    enabled: !!token && !!nodeId && !!userId,
  });

  if (!nodeId || !userId) return null;

  const handleUpdate = async (v: { username?: string; password?: string; role?: string }) => {
    if (!token) return;
    try { await updateUser(token, nodeId, userId, v); message.success("更新成功"); setEditing(false); queryClient.invalidateQueries({ queryKey: ["user", nodeId, userId] }); }
    catch (e) { message.error(e instanceof Error ? e.message : "更新失败"); }
  };

  const rc: Record<string, string> = { admin: "red", super_admin: "purple", user: "blue", channel: "green" };

  return (
    <div>
      <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/admin/users")} style={{ marginBottom: 16 }}>返回列表</Button>
      <Card title={`用户详情: ${user?.username ?? "..."}`} loading={isLoading}
        extra={<Space>
          <Button type="primary" icon={<MessageOutlined />} onClick={() => navigate(`/admin/messages/${nodeId}/${userId}`)}>查看消息</Button>
          <Button icon={<EditOutlined />} onClick={() => setEditing(true)}>编辑</Button>
        </Space>}>
        {user && (
          <Descriptions column={2} bordered>
            <Descriptions.Item label="节点 ID">{idToStr(user.nodeId)}</Descriptions.Item>
            <Descriptions.Item label="用户 ID">{idToStr(user.userId)}</Descriptions.Item>
            <Descriptions.Item label="用户名">{user.username}</Descriptions.Item>
            <Descriptions.Item label="角色"><Tag color={rc[user.role] ?? "default"}>{user.role}</Tag></Descriptions.Item>
            <Descriptions.Item label="系统保留">{user.systemReserved ? "是" : "否"}</Descriptions.Item>
            <Descriptions.Item label="来源节点">{idToStr(user.originNodeId)}</Descriptions.Item>
            <Descriptions.Item label="创建时间">{formatTime(user.createdAt)}</Descriptions.Item>
            <Descriptions.Item label="更新时间">{formatTime(user.updatedAt)}</Descriptions.Item>
          </Descriptions>
        )}
      </Card>
      <Modal title="编辑用户" open={editing} onCancel={() => setEditing(false)} onOk={() => form.submit()}>
        <Form form={form} layout="vertical" onFinish={handleUpdate}>
          <Form.Item name="username" label="用户名"><Input placeholder={user?.username} /></Form.Item>
          <Form.Item name="password" label="新密码"><Input.Password placeholder="留空则不修改" /></Form.Item>
          <Form.Item name="role" label="角色">
            <Select allowClear placeholder={user?.role}
              options={[{ label: "用户 (user)", value: "user" }, { label: "管理员 (admin)", value: "admin" }, { label: "频道 (channel)", value: "channel" }]} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
