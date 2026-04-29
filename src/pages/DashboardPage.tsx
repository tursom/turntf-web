import { Card, Row, Col, Statistic, Table, Tag, Typography } from "antd";
import { CheckCircleOutlined, ClusterOutlined, FileTextOutlined, SyncOutlined } from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { getHealth, getOpsStatus } from "@/api/ops";
import { listClusterNodes } from "@/api/cluster";
import { REFETCH_INTERVALS } from "@/utils/constants";
import { idToStr } from "@/utils/format";

const { Title } = Typography;

export function DashboardPage() {
  const { token } = useAuth();
  const { data: health } = useQuery({
    queryKey: ["health"], queryFn: getHealth,
    refetchInterval: REFETCH_INTERVALS.Health,
  });
  const { data: ops } = useQuery({
    queryKey: ["ops"], queryFn: () => getOpsStatus(token!),
    enabled: !!token, refetchInterval: REFETCH_INTERVALS.Dashboard,
  });
  const { data: nodes = [] } = useQuery({
    queryKey: ["clusterNodes"], queryFn: () => listClusterNodes(token!),
    enabled: !!token, refetchInterval: REFETCH_INTERVALS.Cluster,
  });

  return (
    <div>
      <Title level={4} style={{ marginBottom: 16 }}>仪表盘</Title>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={6}>
          <Card><Statistic title="服务状态" value={health?.status ?? "未知"}
            valueStyle={{ color: health?.status === "ok" ? "#52c41a" : "#ff4d4f" }}
            prefix={<CheckCircleOutlined />} /></Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card><Statistic title="集群节点数" value={nodes.length} prefix={<ClusterOutlined />} /></Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card><Statistic title="最新事件序号" value={ops?.last_event_sequence ?? "-"}
            prefix={<FileTextOutlined />} /></Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card><Statistic title="冲突总数" value={ops?.conflict_total ?? 0} prefix={<SyncOutlined />} /></Card>
        </Col>
      </Row>
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} sm={8}>
          <Card><Statistic title="写入门控" value={ops?.write_gate_ready ? "就绪" : "关闭"}
            valueStyle={{ color: ops?.write_gate_ready ? "#52c41a" : "#ff4d4f" }} /></Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card><Statistic title="消息窗口" value={ops?.message_window_size ?? "-"} /></Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card><Statistic title="消息修剪总数" value={ops?.message_trim?.trimmed_total ?? 0} /></Card>
        </Col>
      </Row>
      <Card title="对端状态" style={{ marginTop: 16 }}>
        <Table dataSource={ops?.peers ?? []} rowKey="peer_node_id" pagination={false}
          columns={[
            { title: "节点 ID", dataIndex: "peer_node_id", render: idToStr },
            { title: "状态", dataIndex: "status", render: (s: string) => <Tag color={s === "connected" ? "success" : "error"}>{s}</Tag> },
            { title: "URL", dataIndex: "configured_url", ellipsis: true },
            { title: "来源", dataIndex: "source" },
          ]} />
      </Card>
    </div>
  );
}
