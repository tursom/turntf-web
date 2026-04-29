import { Spin } from "antd";

export function LoadingSpinner({ tip = "加载中..." }: { tip?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "60vh" }}>
      <Spin size="large" tip={tip}>
        <div style={{ padding: 50 }} />
      </Spin>
    </div>
  );
}
