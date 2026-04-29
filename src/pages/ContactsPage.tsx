import { Card, Tabs, Table, Button, Tag, message, Popconfirm, Space } from "antd";
import { PlusOutlined, DeleteOutlined, MessageOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AttachmentType } from "@/types";
import { useAuth } from "@/hooks/useAuth";
import { listUsers } from "@/api/users";
import { listAttachments, upsertAttachment, deleteAttachment } from "@/api/attachments";
import { idToStr } from "@/utils/format";

export function ContactsPage() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: users = [] } = useQuery({
    queryKey: ["users"], queryFn: () => listUsers(token!), enabled: !!token,
  });
  const { data: subs = [] } = useQuery({
    queryKey: ["attachments", "channel_subscription"],
    queryFn: () => listAttachments(token!, user!.node_id, user!.user_id, AttachmentType.ChannelSubscription),
    enabled: !!token && !!user,
  });

  const handleSub = async (cnid: number, cuid: number) => {
    if (!token || !user) return;
    try { await upsertAttachment(token, user.node_id, user.user_id, AttachmentType.ChannelSubscription, cnid, cuid); message.success("订阅成功"); queryClient.invalidateQueries({ queryKey: ["attachments", "channel_subscription"] }); }
    catch (e) { message.error(e instanceof Error ? e.message : "订阅失败"); }
  };
  const handleUnsub = async (cnid: number, cuid: number) => {
    if (!token || !user) return;
    try { await deleteAttachment(token, user.node_id, user.user_id, AttachmentType.ChannelSubscription, cnid, cuid); message.success("取消订阅"); queryClient.invalidateQueries({ queryKey: ["attachments", "channel_subscription"] }); }
    catch (e) { message.error(e instanceof Error ? e.message : "取消订阅失败"); }
  };

  const subKeys = new Set(subs.map((s) => `${s.subject.node_id}:${s.subject.user_id}`));
  const chs = users.filter((u) => u.role === "channel");
  const reg = users.filter((u) => u.role !== "channel" && `${u.node_id}:${u.user_id}` !== `${user?.node_id}:${user?.user_id}`);

  const userCols = [
    { title: "节点 ID", dataIndex: "node_id", render: idToStr },
    { title: "用户 ID", dataIndex: "user_id", render: idToStr },
    { title: "用户名", dataIndex: "username" },
    { title: "角色", dataIndex: "role", render: (r: string) => <Tag color={r === "admin" || r === "super_admin" ? "red" : "blue"}>{r}</Tag> },
    { title: "操作", render: (_: unknown, r: { node_id: number; user_id: number }) => (
      <Space>
        <Button size="small" type="primary" icon={<MessageOutlined />} onClick={() => navigate(`/chat/${idToStr(r.node_id)}/${idToStr(r.user_id)}`)}>聊天</Button>
        <Button size="small" onClick={() => handleSub(r.node_id, r.user_id)}>订阅</Button>
      </Space>
    )},
  ];
  const chCols = [
    { title: "节点 ID", dataIndex: "node_id", render: idToStr },
    { title: "频道 ID", dataIndex: "user_id", render: idToStr },
    { title: "频道名", dataIndex: "username" },
    { title: "操作", render: (_: unknown, r: { node_id: number; user_id: number }) => {
      const k = `${r.node_id}:${r.user_id}`; const isSub = subKeys.has(k);
      return (<Space>
        <Button size="small" type={isSub ? "default" : "primary"} icon={isSub ? <DeleteOutlined /> : <PlusOutlined />}
          onClick={() => isSub ? handleUnsub(r.node_id, r.user_id) : handleSub(r.node_id, r.user_id)}>{isSub ? "取消订阅" : "订阅"}</Button>
        <Button size="small" icon={<MessageOutlined />} onClick={() => navigate(`/chat/${idToStr(r.node_id)}/${idToStr(r.user_id)}`)}>聊天</Button>
      </Space>);
    }},
  ];
  const subCols = [
    { title: "节点 ID", dataIndex: ["subject", "node_id"], render: idToStr },
    { title: "频道 ID", dataIndex: ["subject", "user_id"], render: idToStr },
    { title: "订阅时间", dataIndex: "attached_at" },
    { title: "操作", render: (_: unknown, r: { subject: { node_id: number; user_id: number } }) => (
      <Space>
        <Button size="small" type="primary" icon={<MessageOutlined />} onClick={() => navigate(`/chat/${idToStr(r.subject.node_id)}/${idToStr(r.subject.user_id)}`)}>聊天</Button>
        <Popconfirm title="确认取消订阅？" onConfirm={() => handleUnsub(r.subject.node_id, r.subject.user_id)}>
          <Button size="small" danger icon={<DeleteOutlined />}>取消订阅</Button>
        </Popconfirm>
      </Space>
    )},
  ];

  return (
    <Card title="联系人">
      <Tabs items={[
        { key: "users", label: "用户", children: <Table dataSource={reg} rowKey={(r) => `${r.node_id}:${r.user_id}`} columns={userCols} /> },
        { key: "channels", label: "频道", children: <Table dataSource={chs} rowKey={(r) => `${r.node_id}:${r.user_id}`} columns={chCols} /> },
        { key: "subscriptions", label: "我的订阅", children: <Table dataSource={subs} rowKey={(r) => `${r.subject.node_id}:${r.subject.user_id}`} columns={subCols} /> },
      ]} />
    </Card>
  );
}
