import { useEffect, useCallback, useReducer, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Grid, Layout } from "antd";
import type { UserRef } from "@/types";
import { ConversationList } from "@/components/chat/ConversationList";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { emptySession, mergeMessages, sessionsReducer } from "@/components/chat/chatSession";
import { useAuth } from "@/hooks/useAuth";
import { useChat } from "@/hooks/useChat";
import { listMessages } from "@/api/messages";
import { encodeText } from "@/utils/text";
import { idToStr, userKeyStr } from "@/utils/format";

export function ChatPage() {
  const { token, user } = useAuth();
  // 认证身份变化时销毁会话状态，旧异步任务只持有旧组件的 dispatch。
  return <ChatWorkspace key={JSON.stringify([token, user?.nodeId, user?.userId])} />;
}

function ChatWorkspace() {
  const { nodeId, userId } = useParams<{ nodeId?: string; userId?: string }>();
  const { token, user } = useAuth();
  const { connected, messages, sendMessage, statusText } = useChat();
  const [sessions, dispatch] = useReducer(sessionsReducer, {});
  const requestRef = useRef(0);
  const pendingSends = useRef(new Set<string>());
  const navigate = useNavigate();
  const screens = Grid.useBreakpoint();
  const narrow = !screens.md;
  const selectedTarget: UserRef | null = nodeId && userId ? { nodeId, userId } : null;
  const key = selectedTarget ? userKeyStr(selectedTarget.nodeId, selectedTarget.userId) : "";
  const session = sessions[key] ?? emptySession;

  const loadHistory = useCallback(() => {
    if (!nodeId || !userId || !token) return;
    const request = ++requestRef.current;
    const key = userKeyStr(nodeId, userId);
    dispatch({ key, type: "historyStart", request });
    void listMessages(token, "0", "0", 50, nodeId, userId).then(
      (messages) => dispatch({ key, type: "historySuccess", request, messages }),
      () => dispatch({ key, type: "historyError", request }),
    );
  }, [nodeId, userId, token]);

  useEffect(loadHistory, [loadHistory]);

  const handleSelect = useCallback((target: UserRef) => {
    navigate(`/chat/${idToStr(target.nodeId)}/${idToStr(target.userId)}`);
  }, [navigate]);

  const handleSend = async () => {
    const draft = session.draft;
    if (!selectedTarget || !draft.trim() || !connected || pendingSends.current.has(key)) return;
    pendingSends.current.add(key);
    dispatch({ key, type: "sendStart" });
    try {
      const message = await sendMessage(selectedTarget, encodeText(draft.trim()));
      dispatch({ key, type: "sendSuccess", message, draft });
    } catch (error) {
      dispatch({ key, type: "sendError", error: error instanceof Error ? error.message : "请稍后重试" });
    } finally {
      pendingSends.current.delete(key);
    }
  };

  const liveMessages = messages.filter((msg) => {
    if (!selectedTarget || !user) return false;
    const sender = userKeyStr(msg.sender.nodeId, msg.sender.userId);
    const recipient = userKeyStr(msg.recipient.nodeId, msg.recipient.userId);
    const own = userKeyStr(user.nodeId, user.userId);
    return sender === key || (sender === own && recipient === key);
  });
  const all = mergeMessages([...session.history].reverse(), liveMessages, session.sent);

  return (
    <Layout style={{ height: narrow ? "calc(100dvh - 56px - 24px)" : "calc(100dvh - 56px - 48px)", minWidth: 0, background: "#fff", borderRadius: 8, overflow: "hidden" }}>
      <Layout.Sider width={narrow ? "100%" : 280} style={{ display: narrow && selectedTarget ? "none" : undefined, background: "#fff", borderRight: "1px solid #f0f0f0" }}>
        <ConversationList onSelect={handleSelect} selectedTarget={selectedTarget} />
      </Layout.Sider>
      <Layout.Content style={{ display: narrow && !selectedTarget ? "none" : undefined, minWidth: 0, minHeight: 0 }}>
        <ChatWindow
          key={key}
          messages={all} target={selectedTarget} onSend={handleSend}
          connected={connected} statusText={statusText}
          historyStatus={session.historyStatus} onRetryHistory={loadHistory}
          draft={session.draft} onDraftChange={(text) => dispatch({ key, type: "draft", text })}
          sending={session.sending} sendError={session.sendError} sendVersion={session.sendVersion}
          onBack={narrow ? () => navigate("/chat") : undefined}
        />
      </Layout.Content>
    </Layout>
  );
}
