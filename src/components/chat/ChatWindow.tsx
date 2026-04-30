import { useEffect, useRef } from "react";
import { Alert, Typography, Empty } from "antd";
import type { Message, UserRef } from "@/types";
import { MessageBubble } from "./MessageBubble";
import { MessageInput } from "./MessageInput";
import { useAuth } from "@/hooks/useAuth";
import { idToStr } from "@/utils/format";

interface Props {
  messages: Message[];
  target: UserRef | null;
  onSend: (text: string) => Promise<void>;
  connected: boolean;
  statusText: string | null;
}

export function ChatWindow({ messages, target, onSend, connected, statusText }: Props) {
  const { user } = useAuth();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  if (!target) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
        <Empty description="选择一个会话开始聊天" />
      </div>
    );
  }

  const isOwnMessage = (msg: Message) =>
    !!(user && idToStr(msg.sender.nodeId) === user.nodeId && idToStr(msg.sender.userId) === user.userId);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid #f0f0f0", background: "#fff", fontWeight: 600 }}>
        {idToStr(target.nodeId)}:{idToStr(target.userId)}
        {!connected && <Typography.Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>(离线)</Typography.Text>}
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: "12px 0", background: "#f0f2f5" }}>
        {statusText && (
          <div style={{ padding: "0 16px 12px" }}>
            <Alert type="warning" showIcon message={statusText} />
          </div>
        )}
        {messages.length === 0 ? (
          <Empty description="暂无消息" style={{ marginTop: 60 }} />
        ) : (
          messages.map((msg) => (
            <MessageBubble key={`${msg.nodeId}-${msg.seq}`} message={msg} isOwn={isOwnMessage(msg)} showSender={!isOwnMessage(msg)} />
          ))
        )}
        <div ref={bottomRef} />
      </div>
      <div style={{ padding: "12px 16px", background: "#fff", borderTop: "1px solid #f0f0f0" }}>
        <MessageInput onSend={onSend} disabled={!connected} />
      </div>
    </div>
  );
}
