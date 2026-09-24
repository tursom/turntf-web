import { Alert, Empty, Table, Tag, Typography } from "antd";
import type { MessageTrace, TraceEvent } from "@/api/traces";
import { eventIdentity, stageLabels } from "./traceModel";

export function TracePanel({ trace }: { trace: MessageTrace }) {
  const unavailable = trace.nodes.filter((node) => node.error);
  return <section className="trace-panel" aria-label="本次探测实际轨迹">
    <div className="trace-panel-heading">
      <Typography.Title level={5} style={{ margin: 0 }}>实际轨迹观测</Typography.Title>
      <Typography.Text type="secondary">{trace.events.length} 条事件 · {trace.nodes.filter((node) => node.events.length).length} 个节点有记录</Typography.Text>
    </div>
    {unavailable.length > 0 && <Alert type="warning" showIcon message={`${unavailable.length} 个节点未能查询：${unavailable.map((node) => node.nodeId).join("、")}`} />}
    <Typography.Paragraph type="secondary" className="trace-caveat">
      各节点只保留约 10 分钟；缺失不代表探测包未经过。不同节点时钟可能有偏差，下面按节点内顺序排列。
      本次探测只反映瞬时交互类流量在此时的一次转发尝试，不保证未来消息的路径；线上的路由成本是当前估算，不是本次实际费用。
    </Typography.Paragraph>
    {!trace.events.length ? <Empty description="保留窗口内暂无可用轨迹记录" /> :
      trace.nodes.filter((node) => node.events.length).map((node) => <div key={node.nodeId} className="trace-node-section">
        <Typography.Text strong>节点 {node.nodeId}</Typography.Text>
        <Table<TraceEvent> size="small" dataSource={[...node.events].sort((a, b) => {
          const left = BigInt(a.sequence || 0);
          const right = BigInt(b.sequence || 0);
          return left < right ? -1 : left > right ? 1 : 0;
        })}
          rowKey={(event) => `${event.nodeId}:${event.sequence}`} scroll={{ x: 900 }} pagination={{ pageSize: 10, hideOnSinglePage: true }}
          columns={[
            { title: "本地时间", width: 180, render: (_, event) => event.at ? new Date(event.at).toLocaleString("zh-CN") : "-" },
            { title: "阶段", width: 195, render: (_, event) => <Tag color={event.stage.includes("failed") || event.stage === "dropped" || event.stage === "retry_expired" ? "error" : event.stage === "forwarded" ? "processing" : "default"}>{stageLabels[event.stage] ?? event.stage}</Tag> },
            { title: "关联对象", width: 250, render: (_, event) => eventIdentity(event) },
            { title: "邻接 / 分支", render: (_, event) => [event.peerNodeId && event.peerNodeId !== "0" ? `对端 ${event.peerNodeId}` : "", event.path ? `路径 ${event.path}` : "", event.reason ? `原因 ${event.reason}` : ""].filter(Boolean).join(" · ") || "-" },
          ]} />
      </div>)}
  </section>;
}
