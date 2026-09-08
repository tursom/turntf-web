import { Alert, Button, Space, Typography } from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import dayjs from "dayjs";

export interface QueryStatusProps {
  isFetching: boolean;
  isError: boolean;
  error: unknown;
  dataUpdatedAt: number;
  hasData: boolean;
  onRefresh: () => void;
  disabled?: boolean;
}

export function QueryStatus({ isFetching, isError, error, dataUpdatedAt, hasData, onRefresh, disabled = false }: QueryStatusProps) {
  return (
    <div style={{ marginBottom: 16 }}>
      <Space wrap>
        <Button icon={<ReloadOutlined />} loading={isFetching} disabled={disabled} onClick={onRefresh}>
          {isError ? "重试" : "刷新"}
        </Button>
        <Typography.Text type="secondary">
          最后成功更新时间：{dataUpdatedAt ? dayjs(dataUpdatedAt).format("YYYY-MM-DD HH:mm:ss") : "尚未成功加载"}
        </Typography.Text>
      </Space>
      {isError && (
        <Alert
          style={{ marginTop: 12 }}
          type={hasData ? "warning" : "error"}
          showIcon
          message={hasData ? "刷新失败，当前保留上次成功加载的数据" : "数据加载失败，请重试"}
          description={error instanceof Error ? error.message : "请求未成功，请稍后重试"}
        />
      )}
    </div>
  );
}
