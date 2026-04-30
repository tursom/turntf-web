import { Typography } from "antd";
import type { Message } from "@/types";
import { formatBytes, formatRelativeTime } from "@/utils/format";
import { useUserDisplayName } from "@/hooks/useUserDisplayName";

interface Props {
  message: Message;
  isOwn: boolean;
  showSender?: boolean;
}

export function MessageBubble({ message, isOwn, showSender }: Props) {
  const { getUserDisplayName } = useUserDisplayName();
  const bodyText = formatBytes(message.body);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: isOwn ? "flex-end" : "flex-start", marginBottom: 12, padding: "0 16px" }}>
      {showSender && !isOwn && (
        <Typography.Text type="secondary" style={{ fontSize: 12, marginBottom: 2 }}>
          {message.sender ? getUserDisplayName(message.sender) : "系统"}
        </Typography.Text>
      )}
      <div style={{
        maxWidth: "70%", padding: "8px 14px", borderRadius: 12,
        background: isOwn ? "#1677ff" : "#fff", color: isOwn ? "#fff" : "#000",
        boxShadow: "0 1px 2px rgba(0,0,0,0.08)", wordBreak: "break-word", whiteSpace: "pre-wrap",
      }}>
        {bodyText}
      </div>
      <Typography.Text type="secondary" style={{ fontSize: 11, marginTop: 2 }}>
        {formatRelativeTime(message.createdAtHlc)}
      </Typography.Text>
    </div>
  );
}
