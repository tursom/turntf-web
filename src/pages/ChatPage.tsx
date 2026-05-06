import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Layout } from "antd";
import type { UserRef, Message } from "@/types";
import { ConversationList } from "@/components/chat/ConversationList";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { useAuth } from "@/hooks/useAuth";
import { useChat } from "@/hooks/useChat";
import { listMessages } from "@/api/messages";
import { encodeText } from "@/utils/text";
import { idToStr, messageKey } from "@/utils/format";

export function ChatPage() {
  const { nodeId, userId } = useParams<{ nodeId?: string; userId?: string }>();
  const { token, user } = useAuth();
  const { connected, messages, sendMessage, statusText } = useChat();
  const [selectedTarget, setSelectedTarget] = useState<UserRef | null>(null);
  const [history, setHistory] = useState<Message[]>([]);
  const [sentMessages, setSentMessages] = useState<Message[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (nodeId && userId) setSelectedTarget({ nodeId, userId });
  }, [nodeId, userId]);

  useEffect(() => {
    setHistory([]);
    setSentMessages([]);
    if (!selectedTarget || !token) return;
    void listMessages(
      token,
      "0",
      "0",
      50,
      idToStr(selectedTarget.nodeId),
      idToStr(selectedTarget.userId),
    ).then(setHistory).catch(() => setHistory([]));
  }, [selectedTarget, token]);

  const handleSelect = useCallback((target: UserRef) => {
    navigate(`/chat/${idToStr(target.nodeId)}/${idToStr(target.userId)}`);
  }, [navigate]);

  const handleSend = useCallback(async (text: string) => {
    if (!selectedTarget) return;
    const msg = await sendMessage(selectedTarget, encodeText(text));
    setSentMessages((prev) => {
      if (prev.some((m) => messageKey(m) === messageKey(msg))) return prev;
      return [...prev, msg];
    });
  }, [selectedTarget, sendMessage]);

  const liveMessages = messages.filter((msg) => {
    if (!selectedTarget || !user) return false;
    const tk = `${idToStr(selectedTarget.nodeId)}:${idToStr(selectedTarget.userId)}`;
    const sk = `${idToStr(msg.sender.nodeId)}:${idToStr(msg.sender.userId)}`;
    const rk = `${idToStr(msg.recipient.nodeId)}:${idToStr(msg.recipient.userId)}`;
    const mk = `${user.nodeId}:${user.userId}`;
    return sk === tk || (sk === mk && rk === tk);
  });

  const histKeys = new Set(history.map((m) => messageKey(m)));
  const dedupedLive = liveMessages.filter((live) => !histKeys.has(messageKey(live)));
  const liveKeys = new Set(dedupedLive.map((m) => messageKey(m)));
  const all = [
    ...[...history].reverse(),
    ...dedupedLive,
    ...sentMessages.filter((s) => !histKeys.has(messageKey(s)) && !liveKeys.has(messageKey(s))),
  ];

  return (
    <Layout style={{ height: "calc(100vh - 56px - 48px)", background: "#fff", borderRadius: 8, overflow: "hidden" }}>
      <Layout.Sider width={280} style={{ background: "#fff", borderRight: "1px solid #f0f0f0" }}>
        <ConversationList onSelect={handleSelect} selectedTarget={selectedTarget} />
      </Layout.Sider>
      <Layout.Content>
        <ChatWindow messages={all} target={selectedTarget} onSend={handleSend} connected={connected} statusText={statusText} />
      </Layout.Content>
    </Layout>
  );
}
