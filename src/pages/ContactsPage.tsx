import { Card, Tabs, Table, Button, Tag, message, Popconfirm, Space } from "antd";
import { PlusOutlined, DeleteOutlined, MessageOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { listUsers } from "@/api/users";
import { listSubscriptions, subscribeChannel, unsubscribeChannel } from "@/api/subscriptions";
import { idToStr } from "@/utils/format";

export function ContactsPage() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: users = [] } = useQuery({
    queryKey: ["users"], queryFn: () => listUsers(token!), enabled: !!token,
  });
  const { data: subs = [] } = useQuery({
    queryKey: ["subscriptions"],
    queryFn: () => listSubscriptions(token!, user!.nodeId, user!.userId),
    enabled: !!token && !!user,
  });

  const handleSub = async (channelNodeId: string, channelUserId: string) => {
    if (!token || !user) return;
    try { await subscribeChannel(token, user.nodeId, user.userId, channelNodeId, channelUserId); message.success("订阅成功"); queryClient.invalidateQueries({ queryKey: ["subscriptions"] }); }
    catch (e) { message.error(e instanceof Error ? e.message : "订阅失败"); }
  };
  const handleUnsub = async (channelNodeId: string, channelUserId: string) => {
    if (!token || !user) return;
    try { await unsubscribeChannel(token, user.nodeId, user.userId, channelNodeId, channelUserId); message.success("取消订阅"); queryClient.invalidateQueries({ queryKey: ["subscriptions"] }); }
    catch (e) { message.error(e instanceof Error ? e.message : "取消订阅失败"); }
  };

  const subKeys = new Set(subs.map((s) => `${s.channel.nodeId}:${s.channel.userId}`));
  const chs = users.filter((u) => u.role === "channel");
  const reg = users.filter((candidate) => candidate.role !== "channel" && `${candidate.nodeId}:${candidate.userId}` !== `${user?.nodeId}:${user?.userId}`);

  const userCols = [
    { title: "节点 ID", dataIndex: "nodeId", render: idToStr },
    { title: "用户 ID", dataIndex: "userId", render: idToStr },
    { title: "用户名", dataIndex: "username" },
    { title: "角色", dataIndex: "role", render: (r: string) => <Tag color={r === "admin" || r === "super_admin" ? "red" : "blue"}>{r}</Tag> },
    { title: "操作", render: (_: unknown, record: { nodeId: string; userId: string }) => (
      <Space>
        <Button size="small" type="primary" icon={<MessageOutlined />} onClick={() => navigate(`/chat/${idToStr(record.nodeId)}/${idToStr(record.userId)}`)}>聊天</Button>
        <Button size="small" onClick={() => handleSub(record.nodeId, record.userId)}>订阅</Button>
      </Space>
    )},
  ];
  const chCols = [
    { title: "节点 ID", dataIndex: "nodeId", render: idToStr },
    { title: "频道 ID", dataIndex: "userId", render: idToStr },
    { title: "频道名", dataIndex: "username" },
    { title: "操作", render: (_: unknown, record: { nodeId: string; userId: string }) => {
      const key = `${record.nodeId}:${record.userId}`; const isSub = subKeys.has(key);
      return (<Space>
        <Button size="small" type={isSub ? "default" : "primary"} icon={isSub ? <DeleteOutlined /> : <PlusOutlined />}
          onClick={() => isSub ? handleUnsub(record.nodeId, record.userId) : handleSub(record.nodeId, record.userId)}>{isSub ? "取消订阅" : "订阅"}</Button>
        <Button size="small" icon={<MessageOutlined />} onClick={() => navigate(`/chat/${idToStr(record.nodeId)}/${idToStr(record.userId)}`)}>聊天</Button>
      </Space>);
    }},
  ];
  const subCols = [
    { title: "节点 ID", dataIndex: ["channel", "nodeId"], render: idToStr },
    { title: "频道 ID", dataIndex: ["channel", "userId"], render: idToStr },
    { title: "订阅时间", dataIndex: "subscribedAt" },
    { title: "操作", render: (_: unknown, record: { channel: { nodeId: string; userId: string } }) => (
      <Space>
        <Button size="small" type="primary" icon={<MessageOutlined />} onClick={() => navigate(`/chat/${idToStr(record.channel.nodeId)}/${idToStr(record.channel.userId)}`)}>聊天</Button>
        <Popconfirm title="确认取消订阅？" onConfirm={() => handleUnsub(record.channel.nodeId, record.channel.userId)}>
          <Button size="small" danger icon={<DeleteOutlined />}>取消订阅</Button>
        </Popconfirm>
      </Space>
    )},
  ];

  return (
    <Card title="联系人">
      <Tabs items={[
        { key: "users", label: "用户", children: <Table dataSource={reg} rowKey={(record) => `${record.nodeId}:${record.userId}`} columns={userCols} /> },
        { key: "channels", label: "频道", children: <Table dataSource={chs} rowKey={(record) => `${record.nodeId}:${record.userId}`} columns={chCols} /> },
        { key: "subscriptions", label: "我的订阅", children: <Table dataSource={subs} rowKey={(record) => `${record.channel.nodeId}:${record.channel.userId}`} columns={subCols} /> },
      ]} />
    </Card>
  );
}
