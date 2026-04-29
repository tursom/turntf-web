import { Card, Typography, Button, message } from "antd";
import { CopyOutlined } from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { getMetrics } from "@/api/metrics";
import { REFETCH_INTERVALS } from "@/utils/constants";

const { Title } = Typography;

export function MetricsPage() {
  const { token } = useAuth();

  const { data: metrics, isLoading } = useQuery({
    queryKey: ["metrics"],
    queryFn: () => getMetrics(token!),
    enabled: !!token,
    refetchInterval: REFETCH_INTERVALS.Metrics,
  });

  const handleCopy = () => {
    if (metrics) {
      navigator.clipboard.writeText(metrics).then(() => {
        message.success("已复制");
      });
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>指标 (Prometheus)</Title>
        <Button icon={<CopyOutlined />} onClick={handleCopy} disabled={!metrics}>
          复制
        </Button>
      </div>
      <Card loading={isLoading}>
        <pre
          style={{
            maxHeight: "calc(100vh - 280px)",
            overflow: "auto",
            background: "#1e1e1e",
            color: "#d4d4d4",
            padding: 16,
            borderRadius: 8,
            fontSize: 13,
            lineHeight: 1.6,
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
          }}
        >
          {metrics ?? "加载中..."}
        </pre>
      </Card>
    </div>
  );
}
