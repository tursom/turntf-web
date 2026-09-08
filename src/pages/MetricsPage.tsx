import { useRef, useState } from "react";
import { Alert, Typography, Button, Empty, Skeleton, Space, message } from "antd";
import { CopyOutlined, ReloadOutlined } from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { getMetrics } from "@/api/metrics";
import { REFETCH_INTERVALS } from "@/utils/constants";

const { Title, Text } = Typography;

export function MetricsPage() {
  const { token } = useAuth();
  const copyingRef = useRef(false);
  const [copying, setCopying] = useState(false);
  const query = useQuery({
    queryKey: ["metrics"],
    queryFn: () => getMetrics(token!),
    enabled: !!token,
    refetchInterval: REFETCH_INTERVALS.Metrics,
  });
  const metrics = query.data;

  const handleCopy = async () => {
    if (!metrics?.trim() || copyingRef.current) return;
    copyingRef.current = true;
    setCopying(true);
    try {
      if (!navigator.clipboard?.writeText) throw new Error("剪贴板不可用");
      await navigator.clipboard.writeText(metrics);
      message.success("已复制");
    } catch {
      message.error("复制失败，请检查浏览器剪贴板权限，或手动选择指标文本复制");
    } finally {
      copyingRef.current = false;
      setCopying(false);
    }
  };

  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>指标 (Prometheus)</Title>
        <Space wrap>
          <Button icon={<ReloadOutlined />} loading={query.isFetching} disabled={!token} onClick={() => void query.refetch()}>刷新</Button>
          <Button icon={<CopyOutlined />} onClick={() => void handleCopy()} loading={copying} disabled={!metrics?.trim()}>复制</Button>
        </Space>
      </div>
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <Text type="secondary">最后成功更新时间：{query.dataUpdatedAt ? new Date(query.dataUpdatedAt).toLocaleString("zh-CN") : "尚无成功记录"}</Text>
        {query.isError && <Alert type="error" showIcon message="指标加载失败"
          description={metrics !== undefined ? "当前显示上次成功加载的指标。" : "暂时无法获取指标。"}
          action={<Button icon={<ReloadOutlined />} disabled={!token} loading={query.isFetching} onClick={() => void query.refetch()}>重试</Button>} />}
        {!token && <Alert type="warning" showIcon message="指标尚未加载，请重新登录" />}
        {query.fetchStatus === "paused" && <Alert type="warning" showIcon message="指标更新已暂停，请检查网络连接" />}
        {query.isLoading ? <Skeleton active paragraph={{ rows: 10 }} /> : metrics?.trim() ? (
          <pre style={{
            margin: 0,
            maxHeight: "calc(100vh - 280px)",
            minHeight: 120,
            overflow: "auto",
            background: "#1e1e1e",
            color: "#d4d4d4",
            padding: 16,
            borderRadius: 6,
            fontSize: 13,
            lineHeight: 1.6,
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
          }}>{metrics}</pre>
        ) : query.isSuccess ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无指标" /> : null}
      </Space>
    </div>
  );
}
