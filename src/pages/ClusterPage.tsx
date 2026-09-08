import { Tabs, Table, Tag, Typography, Select, Button, Empty } from "antd";
import { TeamOutlined } from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { listClusterNodes, listNodeLoggedInUsers } from "@/api/cluster";
import { REFETCH_INTERVALS } from "@/utils/constants";
import { idToStr } from "@/utils/format";
import { QueryStatus } from "@/components/common/QueryStatus";
import { useState, useEffect } from "react";
import type { LoggedInUser } from "@/types";

export function ClusterPage() {
  const { token, user } = useAuth();
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("nodes");

  const nodesQuery = useQuery({
    queryKey: ["clusterNodes"],
    queryFn: () => listClusterNodes(token!),
    enabled: !!token,
    refetchInterval: REFETCH_INTERVALS.Cluster,
  });
  const usersQuery = useQuery({
    queryKey: ["loggedInUsers", selectedNodeId],
    queryFn: () => listNodeLoggedInUsers(token!, selectedNodeId!),
    enabled: !!token && !!selectedNodeId,
    refetchInterval: REFETCH_INTERVALS.LoggedInUsers,
  });
  const { data: nodes = [], isLoading: nodesLoading } = nodesQuery;
  const { data: loggedInUsers = [], isLoading: usersLoading } = usersQuery;

  useEffect(() => {
    if (nodesQuery.data === undefined) return;
    if (nodes.length === 0) {
      setSelectedNodeId(null);
      return;
    }
    if (selectedNodeId !== null && nodes.some((node) => idToStr(node.nodeId) === selectedNodeId)) return;
    const preferred = nodes.find((node) => node.isLocal) ?? nodes.find((node) => node.nodeId === user?.nodeId) ?? nodes[0];
    setSelectedNodeId(idToStr(preferred.nodeId));
  }, [selectedNodeId, nodes, nodesQuery.data, user?.nodeId]);

  const isCurrentUser = (record: LoggedInUser): boolean =>
    user !== null && record.nodeId === user.nodeId && record.userId === user.userId;

  return (
    <div>
      <Typography.Title level={4} style={{ marginBottom: 16 }}>集群监控</Typography.Title>
      <Typography.Text type="secondary">集群节点</Typography.Text>
      <QueryStatus {...nodesQuery} hasData={nodesQuery.data !== undefined} onRefresh={() => { void nodesQuery.refetch(); }} disabled={!token} />
      <Tabs activeKey={activeTab} onChange={setActiveTab} items={[
        {
          key: "nodes",
          label: `集群节点 (${nodes.length})`,
          children: (
            <Table dataSource={nodes} rowKey="nodeId" loading={nodesLoading} pagination={false} scroll={{ x: 800 }} columns={[
              { title: "节点 ID", dataIndex: "nodeId", render: idToStr, width: 150 },
              { title: "节点位置", dataIndex: "isLocal", width: 100, render: (value: boolean) => value ? <Tag color="green">本地</Tag> : <Tag>远程</Tag> },
              { title: "配置 URL", dataIndex: "configuredUrl", ellipsis: true },
              { title: "来源", dataIndex: "source", width: 140, render: (source: string) => ({ static: "静态配置", discovered: "动态发现", local: "本地" }[source] ?? (source ? `未知来源（${source}）` : "未提供")) },
              { title: "操作", width: 180, render: (_, record) => (
                <Button type="link" icon={<TeamOutlined />} onClick={() => {
                  setSelectedNodeId(idToStr(record.nodeId));
                  setActiveTab("onlineUsers");
                }}>查看在线用户</Button>
              ) },
            ]} />
          ),
        },
        {
          key: "onlineUsers",
          label: "在线用户",
          children: (
            <div>
              <Select aria-label="选择在线用户所属节点" placeholder="选择节点" style={{ width: 240, maxWidth: "100%", marginBottom: 16 }}
                value={selectedNodeId} onChange={setSelectedNodeId}
                options={nodes.map((node) => ({ label: `节点 ${idToStr(node.nodeId)}${node.isLocal ? " (本地)" : ""}`, value: idToStr(node.nodeId) }))} />
              {selectedNodeId ? (
                <>
                  <QueryStatus {...usersQuery} hasData={usersQuery.data !== undefined} onRefresh={() => { void usersQuery.refetch(); }} disabled={!token} />
                  <Table dataSource={loggedInUsers} rowKey={(record) => `${record.nodeId}:${record.userId}`} loading={usersLoading}
                    pagination={false} scroll={{ x: 600 }}
                    onRow={(record) => ({ style: isCurrentUser(record) ? { backgroundColor: "#e6f4ff" } : undefined })}
                    columns={[
                      { title: "节点 ID", dataIndex: "nodeId", render: idToStr, width: 160 },
                      { title: "用户 ID", dataIndex: "userId", render: idToStr, width: 160 },
                      { title: "用户名", dataIndex: "username", render: (username: string, record: LoggedInUser) => (
                        <span>{username}{isCurrentUser(record) && <Tag color="blue" style={{ marginLeft: 8 }}>我</Tag>}</span>
                      ) },
                    ]} />
                </>
              ) : <Empty description="暂无可查询节点" />}
            </div>
          ),
        },
      ]} />
    </div>
  );
}
