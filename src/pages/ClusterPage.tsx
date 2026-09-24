import { Tabs, Table, Tag, Typography, Select, Button, Empty, Spin, Alert } from "antd";
import { ExperimentOutlined, TeamOutlined } from "@ant-design/icons";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { listClusterNodes, listNodeLoggedInUsers } from "@/api/cluster";
import { getTopologyStatus } from "@/api/topology";
import { getMessageTrace, startMessageProbe, type ProbeResult } from "@/api/traces";
import { TopologyView } from "@/components/cluster/TopologyView";
import { TracePanel } from "@/components/cluster/TracePanel";
import { REFETCH_INTERVALS } from "@/utils/constants";
import { idToStr } from "@/utils/format";
import { QueryStatus } from "@/components/common/QueryStatus";
import { useState, useEffect } from "react";
import type { LoggedInUser } from "@/types";

export function ClusterPage() {
  const { token, user, isAdmin } = useAuth();
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("nodes");
  const [perspectiveId, setPerspectiveId] = useState<string | null>(null);
  const [probeTarget, setProbeTarget] = useState<string | null>(null);
  const [probe, setProbe] = useState<(ProbeResult & { startedAt: number }) | null>(null);

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
  const localTopologyQuery = useQuery({
    queryKey: ["topology", "local", token],
    queryFn: () => getTopologyStatus(token!),
    enabled: !!token && isAdmin && activeTab === "topology",
    refetchInterval: REFETCH_INTERVALS.Cluster,
  });
  const localId = localTopologyQuery.data?.nodeId;
  const viewingRemote = perspectiveId !== null && localId !== undefined && perspectiveId !== localId;
  const remoteTopologyQuery = useQuery({
    queryKey: ["topology", "remote", token, perspectiveId],
    queryFn: () => getTopologyStatus(token!, perspectiveId!),
    enabled: !!token && isAdmin && activeTab === "topology" && viewingRemote,
    refetchInterval: REFETCH_INTERVALS.Cluster,
  });
  const topologyQuery = viewingRemote ? remoteTopologyQuery : localTopologyQuery;
  const probeMutation = useMutation({
    mutationFn: ({ source, target }: { source: string; target: string }) => startMessageProbe(token!, source, target),
    onSuccess: (result) => setProbe({ ...result, startedAt: Date.now() }),
    onError: () => setProbe(null),
  });
  const traceQuery = useQuery({
    queryKey: ["messageTrace", probe?.traceId, token],
    queryFn: () => getMessageTrace(token!, probe!.traceId),
    enabled: !!token && isAdmin && activeTab === "topology" && !!probe,
    refetchInterval: (query) => !probe || probe.status === "failed" ||
      query.state.data?.events.some((event) => event.stage === "probe_reached" && event.nodeId === probe.targetNodeId) ||
      Date.now() - probe.startedAt >= 12000 ? false : 1500,
  });
  const probeReached = !!probe && !!traceQuery.data?.events.some((event) => event.stage === "probe_reached" && event.nodeId === probe.targetNodeId);
  const probeExpired = !!probe && !probeReached && !traceQuery.isFetching && Date.now() - probe.startedAt >= 12000;
  const perspectiveOptions = [...new Set([
    ...(localId ? [localId] : []),
    ...nodesQuery.data?.map((node) => idToStr(node.nodeId)) ?? [],
    ...localTopologyQuery.data?.routes.map((route) => route.destinationNodeId) ?? [],
  ])].filter(Boolean).sort((a, b) => a.localeCompare(b, "en", { numeric: true }))
    .map((id) => ({ label: `节点 ${id}${id === localId ? "（当前入口）" : ""}`, value: id }));
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
        ...(isAdmin ? [{
          key: "topology",
          label: "拓扑与成本",
          children: <div>
            <div className="topology-perspective">
              <Typography.Text>节点视角</Typography.Text>
              <Select aria-label="选择节点视角" value={viewingRemote ? perspectiveId : localId} placeholder="选择节点"
                loading={localTopologyQuery.isLoading} disabled={probeMutation.isPending}
                style={{ minWidth: 240, maxWidth: "100%" }}
                options={perspectiveOptions} onChange={(value) => {
                  setPerspectiveId(value === localId ? null : value);
                  setProbe(null);
                  probeMutation.reset();
                }} />
            </div>
            <QueryStatus {...topologyQuery} hasData={topologyQuery.data !== undefined}
              onRefresh={() => { void topologyQuery.refetch(); }} disabled={!token} />
            <div className="trace-search">
              <Typography.Text>瞬时消息路由探测</Typography.Text>
              <Select aria-label="探测目标节点" placeholder="目标节点" value={probeTarget} onChange={setProbeTarget}
                disabled={probeMutation.isPending}
                options={perspectiveOptions.filter((option) => option.value !== topologyQuery.data?.nodeId)}
                style={{ minWidth: 220, maxWidth: "100%" }} />
              <Button type="primary" icon={<ExperimentOutlined />} loading={probeMutation.isPending}
                disabled={!topologyQuery.data || !probeTarget || probeTarget === topologyQuery.data.nodeId}
                onClick={() => {
                  if (!topologyQuery.data || !probeTarget || probeMutation.isPending) return;
                  setProbe(null);
                  probeMutation.mutate({ source: topologyQuery.data.nodeId, target: probeTarget });
                }}>发起探测</Button>
            </div>
            {probeMutation.isError && <Alert type="error" showIcon message={probeMutation.error instanceof Error ? probeMutation.error.message : "探测发起失败"} />}
            {probe && <div className="trace-run-status">
              <Typography.Text>探测 ID：<code>{probe.traceId}</code></Typography.Text>
              <Tag color={probeReached ? "success" : probe.status === "failed" ? "error" : probeExpired ? "warning" : "processing"}>
                {probeReached ? "目标已观测到达" : probe.status === "failed" ? "发起失败" : probeExpired ? "未确认到达" : "探测中"}
              </Tag>
            </div>}
            {probe && traceQuery.isError && <Alert type="error" showIcon message={traceQuery.error instanceof Error ? traceQuery.error.message : "轨迹查询失败"} />}
            {probe && traceQuery.isLoading && <Spin />}
            {topologyQuery.data && <TopologyView status={topologyQuery.data} trace={probe?.traceId === traceQuery.data?.traceId ? traceQuery.data : undefined} />}
            {probe && traceQuery.data && <TracePanel trace={traceQuery.data} />}
            {topologyQuery.isLoading && <Spin />}
            {!topologyQuery.data && !topologyQuery.isLoading && !topologyQuery.isError && <Empty description="暂无拓扑数据" />}
          </div>,
        }] : []),
      ]} />
    </div>
  );
}
