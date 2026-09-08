import { useLayoutEffect, useRef, useState } from "react";
import { Alert, Button, Typography, Empty, Spin, Tooltip } from "antd";
import { ArrowDownOutlined, ArrowLeftOutlined, ReloadOutlined } from "@ant-design/icons";
import type { Message, UserRef } from "@/types";
import { MessageBubble } from "./MessageBubble";
import { MessageInput } from "./MessageInput";
import type { ChatSession } from "./chatSession";
import { addedMessageKeys, isNearBottom, shouldFollowMessages } from "./chatScroll";
import { useAuth } from "@/hooks/useAuth";
import { idToStr, messageKey } from "@/utils/format";
import { useUserDisplayName } from "@/hooks/useUserDisplayName";

interface Props {
  messages: Message[];
  target: UserRef | null;
  onSend: () => Promise<void>;
  connected: boolean;
  statusText: string | null;
  historyStatus: ChatSession["historyStatus"];
  onRetryHistory: () => void;
  draft: string;
  onDraftChange: (text: string) => void;
  sending: boolean;
  sendError: string | null;
  sendVersion: number;
  onBack?: () => void;
}

export function ChatWindow({ messages, target, onSend, connected, statusText, historyStatus, onRetryHistory, draft, onDraftChange, sending, sendError, sendVersion, onBack }: Props) {
  const { user } = useAuth();
  const { getUserDisplayName } = useUserDisplayName();
  const scrollRef = useRef<HTMLDivElement>(null);
  const previousKeys = useRef(new Set<string>());
  const nearBottom = useRef(true);
  const initialized = useRef(false);
  const previousSend = useRef(sendVersion);
  const [unread, setUnread] = useState(0);
  const historyLoading = historyStatus === "loading" || historyStatus === "idle";

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    const element = scrollRef.current;
    element?.scrollTo({ top: element.scrollHeight, behavior });
    nearBottom.current = true;
    setUnread(0);
  };

  useLayoutEffect(() => {
    const keys = messages.map(messageKey);
    const added = addedMessageKeys(previousKeys.current, keys).length;
    const initial = !initialized.current && !historyLoading;
    const sent = previousSend.current !== sendVersion;
    previousSend.current = sendVersion;
    previousKeys.current = new Set(keys);
    if (initial) initialized.current = true;
    // 消息数组每次渲染都会重建；只有新 key、首次历史完成或主动发送才触发跟随。
    if (shouldFollowMessages(initial, sent, nearBottom.current, added)) {
      scrollToBottom(initial ? "auto" : "smooth");
    } else if (added > 0) {
      setUnread((count) => count + added);
    }
  }, [messages, historyLoading, sendVersion]);

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
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", borderBottom: "1px solid #f0f0f0", background: "#fff", fontWeight: 600, flexShrink: 0 }}>
        {onBack && <Tooltip title="返回会话列表"><Button aria-label="返回会话列表" icon={<ArrowLeftOutlined />} onClick={onBack} /></Tooltip>}
        <Typography.Text strong style={{ minWidth: 0, overflowWrap: "anywhere" }}>{getUserDisplayName(target)}</Typography.Text>
        {!connected && <Typography.Text type="secondary" style={{ fontSize: 12, flexShrink: 0 }}>(离线)</Typography.Text>}
      </div>
      {statusText && <Alert type="warning" showIcon message={statusText} style={{ flexShrink: 0 }} />}
      {historyLoading && <div role="status" style={{ padding: 12, textAlign: "center" }}><Spin size="small" /> <Typography.Text type="secondary">正在加载历史消息...</Typography.Text></div>}
      {historyStatus === "error" && (
        <Alert type="error" showIcon message="历史消息加载失败" style={{ flexShrink: 0 }}
          action={<Button size="small" icon={<ReloadOutlined />} onClick={onRetryHistory}>重试</Button>} />
      )}
      <div
        ref={scrollRef}
        role="region"
        aria-label="聊天消息"
        onScroll={() => {
          const element = scrollRef.current;
          if (!element) return;
          nearBottom.current = isNearBottom(element.scrollHeight, element.scrollTop, element.clientHeight);
          if (nearBottom.current) setUnread(0);
        }}
        style={{ flex: 1, minHeight: 0, overflow: "auto", overflowAnchor: "none", padding: "12px 0", background: "#f0f2f5" }}
      >
        {messages.length === 0 && historyStatus === "success" ? (
          <Empty description="暂无消息" style={{ marginTop: 60 }} />
        ) : (
          messages.map((msg) => (
            <MessageBubble key={messageKey(msg)} message={msg} isOwn={isOwnMessage(msg)} showSender={!isOwnMessage(msg)} />
          ))
        )}
      </div>
      {unread > 0 && <div style={{ textAlign: "center", padding: 4, background: "#f0f2f5" }}><Button icon={<ArrowDownOutlined />} onClick={() => scrollToBottom()}>{unread} 条新消息</Button></div>}
      <div style={{ padding: "12px 16px", background: "#fff", borderTop: "1px solid #f0f0f0", flexShrink: 0 }}>
        {sendError && <Alert type="error" showIcon message={`发送失败：${sendError}`} style={{ marginBottom: 8 }} />}
        <MessageInput onSend={onSend} disabled={!connected} text={draft} onTextChange={onDraftChange} sending={sending} />
      </div>
    </div>
  );
}
