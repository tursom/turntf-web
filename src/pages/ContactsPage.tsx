import { useRef, useState } from "react";
import { Alert, Tabs, Table, Button, Tag, message, Popconfirm, Space, Typography, Empty, Skeleton } from "antd";
import { PlusOutlined, DeleteOutlined, MessageOutlined, ReloadOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { listUsers } from "@/api/users";
import { listSubscriptions, subscribeChannel, unsubscribeChannel } from "@/api/subscriptions";
import { idToStr } from "@/utils/format";

const roleLabels: Record<string, string> = { admin: "管理员", super_admin: "超级管理员", user: "用户", channel: "频道", guest: "访客" };

export function ContactsPage() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const submitting = useRef(false);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const usersQuery = useQuery({
    queryKey: ["users"], queryFn: () => listUsers(token!), enabled: !!token,
  });
  const subsQuery = useQuery({
    queryKey: ["subscriptions"],
    queryFn: () => listSubscriptions(token!, user!.nodeId, user!.userId),
    enabled: !!token && !!user,
  });
  const canChangeSubs = !!token && !!user && subsQuery.isSuccess && !subsQuery.isFetching;
  const subs = subsQuery.data ?? [];
  const subKeys = new Set(subs.map((s) => `${s.channel.nodeId}:${s.channel.userId}`));

  const changeSubscription = async (nodeId: string, userId: string, remove: boolean) => {
    if (!token || !user || !canChangeSubs || submitting.current) return;
    const key = `${nodeId}:${userId}`;
    if (subKeys.has(key) !== remove) return;
    submitting.current = true;
    setPendingKey(key);
    try {
      const action = remove ? unsubscribeChannel : subscribeChannel;
      await action(token, user.nodeId, user.userId, nodeId, userId);
      message.success(remove ? "已取消订阅" : "订阅成功");
    } catch (e) {
      message.error(e instanceof Error ? e.message : "订阅操作失败");
    } finally {
      // 即使写请求失败，也刷新可能已经在服务端改变的订阅状态。
      try {
        await queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
      } finally {
        submitting.current = false;
        setPendingKey(null);
      }
    }
  };

  const chatButton = (record: { nodeId: string; userId: string }) => (
    <Button size="small" icon={<MessageOutlined />} onClick={() => navigate(`/chat/${idToStr(record.nodeId)}/${idToStr(record.userId)}`)}>聊天</Button>
  );
  const subscriptionButton = (record: { nodeId: string; userId: string }) => {
    const key = `${record.nodeId}:${record.userId}`;
    const known = subsQuery.isSuccess;
    const isSub = known && subKeys.has(key);
    const disabled = !canChangeSubs || pendingKey !== null;
    const button = <Button size="small" danger={isSub} icon={isSub ? <DeleteOutlined /> : <PlusOutlined />}
      loading={pendingKey === key} disabled={disabled}
      onClick={isSub ? undefined : () => void changeSubscription(record.nodeId, record.userId, false)}>
      {!known ? "订阅状态未知" : isSub ? "取消订阅" : "订阅"}
    </Button>;
    return isSub ? <Popconfirm title="确认取消订阅？" disabled={disabled}
      okButtonProps={{ disabled, loading: pendingKey === key }}
      onConfirm={() => changeSubscription(record.nodeId, record.userId, true)}>{button}</Popconfirm> : button;
  };
  const users = usersQuery.data ?? [];
  const chs = users.filter((u) => u.role === "channel");
  const reg = users.filter((candidate) => candidate.role !== "channel" && `${candidate.nodeId}:${candidate.userId}` !== `${user?.nodeId}:${user?.userId}`);
  const userCols = [
    { title: "节点 ID", dataIndex: "nodeId", render: idToStr },
    { title: "用户 ID", dataIndex: "userId", render: idToStr },
    { title: "用户名", dataIndex: "username", ellipsis: true },
    { title: "角色", dataIndex: "role", render: (r: string) => <Tag>{roleLabels[r] ?? "未知"}</Tag> },
    { title: "操作", width: 240, render: (_: unknown, record: { nodeId: string; userId: string }) => <Space wrap>{chatButton(record)}{subscriptionButton(record)}</Space> },
  ];
  const chCols = [
    { title: "节点 ID", dataIndex: "nodeId", render: idToStr },
    { title: "频道 ID", dataIndex: "userId", render: idToStr },
    { title: "频道名", dataIndex: "username", ellipsis: true },
    { title: "操作", width: 240, render: (_: unknown, record: { nodeId: string; userId: string }) => <Space wrap>{subscriptionButton(record)}{chatButton(record)}</Space> },
  ];
  const subCols = [
    { title: "节点 ID", dataIndex: ["channel", "nodeId"], render: idToStr },
    { title: "频道 ID", dataIndex: ["channel", "userId"], render: idToStr },
    { title: "订阅时间", dataIndex: "subscribedAt" },
    { title: "操作", width: 240, render: (_: unknown, record: { channel: { nodeId: string; userId: string } }) => <Space wrap>{chatButton(record.channel)}{subscriptionButton(record.channel)}</Space> },
  ];
  const feedback = (query: typeof usersQuery | typeof subsQuery, label: string) => {
    if (query.isError) return <Alert type="error" showIcon message={`${label}加载失败`}
      description={query.data ? "当前显示上次成功加载的数据。" : "暂时无法获取数据。"}
      action={<Button icon={<ReloadOutlined />} loading={query.isFetching} onClick={() => void query.refetch()}>重试</Button>} />;
    if (query.isPending) return query.fetchStatus === "fetching" ? <Skeleton active paragraph={{ rows: 2 }} /> : <Alert type="warning" showIcon message={`${label}尚未加载，请检查登录或网络状态`} action={<Button disabled={!token || (label === "订阅列表" && !user)} onClick={() => void query.refetch()}>重试</Button>} />;
    return null;
  };
  const empty = (query: typeof usersQuery | typeof subsQuery, description: string) => <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={query.isError ? "数据暂不可用" : query.isPending ? "数据尚未就绪" : description} />;

  return (
    <div style={{ minWidth: 0 }}>
      <Typography.Title level={4}>联系人</Typography.Title>
      <Space direction="vertical" size="middle" style={{ width: "100%", marginBottom: 16 }}>
        {feedback(usersQuery, "用户和频道列表")}
        {feedback(subsQuery, "订阅列表")}
      </Space>
      <Tabs items={[
        { key: "users", label: "用户", children: <Table dataSource={reg} loading={usersQuery.isFetching} scroll={{ x: 720 }} locale={{ emptyText: empty(usersQuery, "暂无其他用户") }} rowKey={(record) => `${record.nodeId}:${record.userId}`} columns={userCols} /> },
        { key: "channels", label: "频道", children: <Table dataSource={chs} loading={usersQuery.isFetching} scroll={{ x: 640 }} locale={{ emptyText: empty(usersQuery, "暂无频道") }} rowKey={(record) => `${record.nodeId}:${record.userId}`} columns={chCols} /> },
        { key: "subscriptions", label: "我的订阅", children: <Table dataSource={subs} loading={subsQuery.isFetching} scroll={{ x: 720 }} locale={{ emptyText: empty(subsQuery, "暂无订阅") }} rowKey={(record) => `${record.channel.nodeId}:${record.channel.userId}`} columns={subCols} /> },
      ]} />
    </div>
  );
}
