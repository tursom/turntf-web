import { useEffect, useRef } from "react";
import { Typography, Empty } from "antd";
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
}

export function ChatWindow({ messages, target, onSend, connected }: Props) {
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
    !!(user && idToStr(msg.sender.node_id) === user.node_id && idToStr(msg.sender.user_id) === user.user_id);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid #f0f0f0", background: "#fff", fontWeight: 600 }}>
        {idToStr(target.node_id)}:{idToStr(target.user_id)}
        {!connected && <Typography.Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>(离线)</Typography.Text>}
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: "12px 0", background: "#f0f2f5" }}>
        {messages.length === 0 ? (
          <Empty description="暂无消息" style={{ marginTop: 60 }} />
        ) : (
          messages.map((msg) => (
            <MessageBubble key={`${msg.node_id}-${msg.seq}`} message={msg} isOwn={isOwnMessage(msg)} showSender={!isOwnMessage(msg)} />
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
