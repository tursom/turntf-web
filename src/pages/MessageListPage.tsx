import { Card, Table, Typography, Button } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { listMessagesByUser } from "@/api/messages";
import { formatTime, formatBytes, idToStr } from "@/utils/format";
import { REFETCH_INTERVALS } from "@/utils/constants";

export function MessageListPage() {
  const { nodeId, userId } = useParams<{ nodeId: string; userId: string }>();
  const { token } = useAuth();
  const navigate = useNavigate();

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["messages", nodeId, userId],
    queryFn: () => listMessagesByUser(token!, nodeId!, userId!),
    enabled: !!token && !!nodeId && !!userId,
    refetchInterval: REFETCH_INTERVALS.Messages,
  });

  return (
    <div>
      <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} style={{ marginBottom: 16 }}>返回</Button>
      <Card title={`消息列表 (${idToStr(nodeId ?? "")}:${idToStr(userId ?? "")})`}>
        <Table dataSource={messages} rowKey={(r) => `${r.node_id}-${r.seq}`} loading={isLoading}
          columns={[
            { title: "序号", dataIndex: "seq", render: idToStr, width: 80 },
            { title: "发送者", key: "sender", render: (_: any, r: any) => `${idToStr(r.sender.node_id)}:${idToStr(r.sender.user_id)}`, width: 160 },
            { title: "内容", dataIndex: "body", render: (b: number[]) => {
              const t = formatBytes(b);
              if (t.startsWith("[二进制")) return <Typography.Text code>{t}</Typography.Text>;
              return <Typography.Paragraph ellipsis={{ rows: 2, expandable: true, symbol: "展开" }} style={{ margin: 0 }}>{t}</Typography.Paragraph>;
            }},
            { title: "时间", dataIndex: "created_at", render: formatTime, width: 180 },
          ]}
          pagination={{ pageSize: 20, showTotal: (t) => `共 ${t} 条消息` }} />
      </Card>
    </div>
  );
}
