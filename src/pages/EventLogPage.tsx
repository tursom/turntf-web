import { Table, Typography, Button, Modal, Select, Space, Tooltip } from "antd";
import { QueryStatus } from "@/components/common/QueryStatus";
import { EyeOutlined } from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { listEvents } from "@/api/events";
import { formatTime, idToStr } from "@/utils/format";
import { REFETCH_INTERVALS } from "@/utils/constants";
import { tryParseJsonBytes } from "@/utils/text";
import { useState } from "react";
import type { Event } from "@/types";

const { Title, Paragraph } = Typography;

export function EventLogPage() {
  const { token } = useAuth();
  const [detailEvent, setDetailEvent] = useState<Event | null>(null);

  const [eventType, setEventType] = useState<string>();
  const [originNode, setOriginNode] = useState<string>();
  const [page, setPage] = useState(1);
  const eventsQuery = useQuery({
    queryKey: ["events"],
    queryFn: () => listEvents(token!),
    enabled: !!token,
    refetchInterval: REFETCH_INTERVALS.Events,
  });

  const { data: events = [], isLoading } = eventsQuery;
  const filteredEvents = events.filter((event) =>
    (!eventType || event.eventType === eventType) &&
    (!originNode || idToStr(event.originNodeId) === originNode),
  );
  const eventTypes = [...new Set(events.map((event) => event.eventType))].sort();
  const originNodes = [...new Set(events.map((event) => idToStr(event.originNodeId)))].sort();

  return (
    <div>
      <Title level={4} style={{ marginBottom: 16 }}>事件日志</Title>
      <QueryStatus {...eventsQuery} hasData={eventsQuery.data !== undefined} onRefresh={() => { void eventsQuery.refetch(); }} disabled={!token} />
      <Space wrap style={{ marginBottom: 16 }}>
        <Select allowClear showSearch aria-label="筛选已加载事件类型" placeholder="已加载事件类型" value={eventType} style={{ width: 220 }}
          onChange={(value) => { setEventType(value); setPage(1); }} options={eventTypes.map((value) => ({ value, label: value }))} />
        <Select allowClear showSearch aria-label="筛选已加载事件来源节点" placeholder="已加载事件来源节点" value={originNode} style={{ width: 220 }}
          onChange={(value) => { setOriginNode(value); setPage(1); }} options={originNodes.map((value) => ({ value, label: value }))} />
        <Typography.Text type="secondary">已加载 {events.length} 条事件，筛选后 {filteredEvents.length} 条</Typography.Text>
      </Space>
        <Table
          scroll={{ x: 1000 }}
          dataSource={filteredEvents}
          rowKey="eventId"
          loading={isLoading}
          columns={[
            { title: "序号", dataIndex: "sequence", render: (v: string) => idToStr(v), width: 100 },
            { title: "事件类型", dataIndex: "eventType", width: 160 },
            { title: "聚合类型", dataIndex: "aggregate", width: 120 },
            {
              title: "聚合 ID",
              key: "aggId",
              render: (_: unknown, r: Event) =>
                `${idToStr(r.aggregateNodeId)}:${idToStr(r.aggregateId)}`,
              width: 160,
            },
            { title: "HLC", dataIndex: "hlc", render: formatTime, width: 180 },
            { title: "来源节点", dataIndex: "originNodeId", render: idToStr, width: 100 },
            {
              title: "详情", width: 80,
              render: (_: unknown, record: Event) => (
                <Tooltip title="查看事件详情"><Button size="small" icon={<EyeOutlined />} aria-label="查看事件详情" onClick={() => setDetailEvent(record)} /></Tooltip>
              ),
            },
          ]}
          pagination={{ current: page, onChange: setPage, pageSize: 20, showTotal: (t) => `共 ${t} 条已加载事件` }}
        />
      <Modal title="事件详情" open={!!detailEvent} onCancel={() => setDetailEvent(null)} footer={null} width={700}>
        {detailEvent && (
          <Paragraph>
            <pre style={{ maxHeight: 400, overflow: "auto", background: "#f5f5f5", padding: 12, borderRadius: 4 }}>
              {JSON.stringify({
                eventId: detailEvent.eventId,
                eventType: detailEvent.eventType,
                aggregate: detailEvent.aggregate,
                aggregateNodeId: idToStr(detailEvent.aggregateNodeId),
                aggregateId: idToStr(detailEvent.aggregateId),
                sequence: idToStr(detailEvent.sequence),
                hlc: detailEvent.hlc,
                originNodeId: idToStr(detailEvent.originNodeId),
                event: tryParseJsonBytes(detailEvent.eventJson) ?? "[二进制数据]",
              }, null, 2)}
            </pre>
          </Paragraph>
        )}
      </Modal>
    </div>
  );
}
