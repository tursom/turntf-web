import { Card, Table, Typography, Button, Modal } from "antd";
import { EyeOutlined } from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { listEvents } from "@/api/events";
import { formatTime, idToStr } from "@/utils/format";
import { REFETCH_INTERVALS } from "@/utils/constants";
import { useState } from "react";
import type { Event } from "@/types";

const { Title, Paragraph } = Typography;

export function EventLogPage() {
  const { token } = useAuth();
  const [detailEvent, setDetailEvent] = useState<Event | null>(null);

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["events"],
    queryFn: () => listEvents(token!),
    enabled: !!token,
    refetchInterval: REFETCH_INTERVALS.Events,
  });

  return (
    <div>
      <Title level={4} style={{ marginBottom: 16 }}>事件日志</Title>
      <Card>
        <Table
          dataSource={events}
          rowKey="event_id"
          loading={isLoading}
          columns={[
            { title: "序号", dataIndex: "sequence", render: (v: number) => idToStr(v), width: 100 },
            { title: "事件类型", dataIndex: "event_type", width: 160 },
            { title: "聚合类型", dataIndex: "aggregate", width: 120 },
            {
              title: "聚合 ID",
              key: "aggId",
              render: (_: unknown, r: Event) =>
                `${idToStr(r.aggregate_node_id)}:${idToStr(r.aggregate_id)}`,
              width: 160,
            },
            { title: "HLC", dataIndex: "hlc", render: formatTime, width: 180 },
            { title: "来源节点", dataIndex: "origin_node_id", render: idToStr, width: 100 },
            {
              title: "详情", width: 80,
              render: (_: unknown, record: Event) => (
                <Button size="small" icon={<EyeOutlined />} onClick={() => setDetailEvent(record)} />
              ),
            },
          ]}
          pagination={{ pageSize: 20, showTotal: (t) => `共 ${t} 条事件` }}
        />
      </Card>
      <Modal title="事件详情" open={!!detailEvent} onCancel={() => setDetailEvent(null)} footer={null} width={700}>
        {detailEvent && (
          <Paragraph>
            <pre style={{ maxHeight: 400, overflow: "auto", background: "#f5f5f5", padding: 12, borderRadius: 4 }}>
              {JSON.stringify({
                event_id: detailEvent.event_id,
                event_type: detailEvent.event_type,
                aggregate: detailEvent.aggregate,
                aggregate_node_id: idToStr(detailEvent.aggregate_node_id),
                aggregate_id: idToStr(detailEvent.aggregate_id),
                sequence: idToStr(detailEvent.sequence),
                hlc: detailEvent.hlc,
                origin_node_id: idToStr(detailEvent.origin_node_id),
                event: detailEvent.event,
              }, null, 2)}
            </pre>
          </Paragraph>
        )}
      </Modal>
    </div>
  );
}
