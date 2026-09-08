import { Alert, Button, Card, Row, Col, Statistic, Skeleton, Space, Table, Tag, Typography, Empty } from "antd";
import { CheckCircleOutlined, ClusterOutlined, FileTextOutlined, SyncOutlined, ReloadOutlined } from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { getHealth, getOpsStatus } from "@/api/ops";
import { listClusterNodes } from "@/api/cluster";
import { REFETCH_INTERVALS } from "@/utils/constants";
import { idToStr } from "@/utils/format";

const { Title, Text } = Typography;
const sourceLabels: Record<string, string> = { static: "静态配置", discovered: "自动发现", local: "本地" };

export function DashboardPage() {
  const { token } = useAuth();
  const healthQuery = useQuery({
    queryKey: ["health"], queryFn: getHealth,
    refetchInterval: REFETCH_INTERVALS.Health,
  });
  const opsQuery = useQuery({
    queryKey: ["ops"], queryFn: () => getOpsStatus(token!),
    enabled: !!token, refetchInterval: REFETCH_INTERVALS.Dashboard,
  });
  const nodesQuery = useQuery({
    queryKey: ["clusterNodes"], queryFn: () => listClusterNodes(token!),
    enabled: !!token, refetchInterval: REFETCH_INTERVALS.Cluster,
  });
  // 刷新失败后的缓存不能作为当前服务状态，时间戳仍保留最后成功的时间。
  const health = healthQuery.isSuccess ? healthQuery.data : undefined;
  const ops = opsQuery.isSuccess ? opsQuery.data : undefined;
  const nodes = nodesQuery.isSuccess ? nodesQuery.data : undefined;
  const queries = [
    { label: "健康检查", query: healthQuery, enabled: true },
    { label: "运行状态", query: opsQuery, enabled: !!token },
    { label: "集群节点", query: nodesQuery, enabled: !!token },
  ];

  return (
    <div style={{ minWidth: 0 }}>
      <Title level={4} style={{ marginBottom: 16 }}>仪表盘</Title>
      <Space direction="vertical" size="small" style={{ width: "100%", marginBottom: 16 }}>
        {queries.map(({ label, query, enabled }) => <div key={label}>
          <Text type="secondary">{label} · 最后成功更新时间：{query.dataUpdatedAt ? new Date(query.dataUpdatedAt).toLocaleString("zh-CN") : "尚无成功记录"}{query.isFetching ? " · 正在更新" : ""}</Text>
          {query.isError && <Alert type="error" showIcon message={`${label}加载失败，当前状态未知`}
            action={<Button icon={<ReloadOutlined />} loading={query.isFetching} disabled={!enabled} onClick={() => void query.refetch()}>重试</Button>} />}
          {query.fetchStatus === "paused" && <Alert type="warning" showIcon message={`${label}更新已暂停，请检查网络连接`} />}
          {!enabled && <Alert type="warning" showIcon message={`${label}未知，请重新登录`} />}
        </div>)}
      </Space>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={6}>
          <Card>{healthQuery.isLoading ? <Skeleton active paragraph={{ rows: 1 }} /> : <Statistic title="服务状态" value={!health ? "未知" : health.status === "ok" ? "正常" : "异常"}
            valueStyle={health ? { color: health.status === "ok" ? "#389e0d" : "#cf1322" } : undefined}
            prefix={<CheckCircleOutlined />} />}</Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>{nodesQuery.isLoading ? <Skeleton active paragraph={{ rows: 1 }} /> : <Statistic title="集群节点数" value={nodes?.length ?? "未知"} prefix={<ClusterOutlined />} />}</Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>{opsQuery.isLoading ? <Skeleton active paragraph={{ rows: 1 }} /> : <Statistic title="最新事件序号" value={ops?.lastEventSequence ?? "未知"}
            prefix={<FileTextOutlined />} />}</Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>{opsQuery.isLoading ? <Skeleton active paragraph={{ rows: 1 }} /> : <Statistic title="冲突总数" value={ops?.conflictTotal ?? "未知"} prefix={<SyncOutlined />} />}</Card>
        </Col>
      </Row>
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} sm={8}>
          <Card>{opsQuery.isLoading ? <Skeleton active paragraph={{ rows: 1 }} /> : <Statistic title="写入门控" value={ops?.writeGateReady == null ? "未知" : ops.writeGateReady ? "就绪" : "关闭"}
            valueStyle={ops?.writeGateReady == null ? undefined : { color: ops.writeGateReady ? "#389e0d" : "#cf1322" }} />}</Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>{opsQuery.isLoading ? <Skeleton active paragraph={{ rows: 1 }} /> : <Statistic title="消息窗口" value={ops?.messageWindowSize ?? "未知"} />}</Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>{opsQuery.isLoading ? <Skeleton active paragraph={{ rows: 1 }} /> : <Statistic title="消息修剪总数" value={ops?.messageTrim?.trimmedTotal ?? "未知"} />}</Card>
        </Col>
      </Row>
      <section style={{ marginTop: 24 }}>
        <Title level={5}>对端状态</Title>
        <Table dataSource={ops?.peers ?? []} rowKey="nodeId" pagination={false} scroll={{ x: 640 }} loading={opsQuery.isLoading}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={opsQuery.isSuccess ? "暂无对端" : "对端状态未知"} /> }}
          columns={[
            { title: "节点 ID", dataIndex: "nodeId", render: idToStr },
            { title: "状态", dataIndex: "connected", render: (connected?: boolean) => <Tag color={connected == null ? "default" : connected ? "success" : "error"}>{connected == null ? "未知" : connected ? "已连接" : "未连接"}</Tag> },
            { title: "地址", dataIndex: "configuredUrl", ellipsis: true },
            { title: "来源", dataIndex: "source", render: (source: string) => sourceLabels[source] ?? (source ? `未知来源（${source}）` : "未提供") },
          ]} />
      </section>
    </div>
  );
}
