import { Table, Typography, Button } from "antd";
import { QueryStatus } from "@/components/common/QueryStatus";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { listMessages } from "@/api/messages";
import type { Message } from "@/types";
import { formatTime, formatBytes, idToStr } from "@/utils/format";
import { REFETCH_INTERVALS } from "@/utils/constants";

export function MessageListPage() {
  const { nodeId, userId } = useParams<{ nodeId: string; userId: string }>();
  const { token } = useAuth();
  const navigate = useNavigate();

  const messagesQuery = useQuery({
    queryKey: ["messages", nodeId, userId],
    queryFn: () => listMessages(token!, nodeId!, userId!),
    enabled: !!token && !!nodeId && !!userId,
    refetchInterval: REFETCH_INTERVALS.Messages,
  });

  const { data: messages = [], isLoading } = messagesQuery;

  return (
    <div>
      <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} style={{ marginBottom: 16 }}>返回</Button>
      <Typography.Title level={4} style={{ marginTop: 0, overflowWrap: "anywhere" }}>消息列表 ({idToStr(nodeId ?? "")}:{idToStr(userId ?? "")})</Typography.Title>
      <QueryStatus {...messagesQuery} hasData={messagesQuery.data !== undefined} onRefresh={() => { void messagesQuery.refetch(); }} disabled={!token || !nodeId || !userId} />
        <Table<Message> scroll={{ x: 760 }} dataSource={messages} rowKey={(record) => `${record.nodeId}-${record.seq}`} loading={isLoading}
          columns={[
            { title: "序号", dataIndex: "seq", render: idToStr, width: 80 },
            { title: "发送者", key: "sender", render: (_: unknown, record: Message) => `${idToStr(record.sender.nodeId)}:${idToStr(record.sender.userId)}`, width: 160 },
            { title: "内容", dataIndex: "body", render: (b: Uint8Array) => {
              const t = formatBytes(b);
              if (t.startsWith("[二进制")) return <Typography.Text code>{t}</Typography.Text>;
              return <Typography.Paragraph ellipsis={{ rows: 2, expandable: true, symbol: "展开" }} style={{ margin: 0, overflowWrap: "anywhere" }}>{t}</Typography.Paragraph>;
            }},
            { title: "时间", dataIndex: "createdAtHlc", render: formatTime, width: 180 },
          ]}
          pagination={{ pageSize: 20, showTotal: (t) => `共 ${t} 条消息` }} />
    </div>
  );
}
