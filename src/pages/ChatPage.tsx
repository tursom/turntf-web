import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Layout } from "antd";
import type { UserRef, Message } from "@/types";
import { ConversationList } from "@/components/chat/ConversationList";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { useAuth } from "@/hooks/useAuth";
import { useChat } from "@/hooks/useChat";
import { sendMessage, watchMessagesByUser } from "@/api/messages";
import { encodeText } from "@/utils/text";
import { idToStr } from "@/utils/format";

export function ChatPage() {
  const { nodeId, userId } = useParams<{ nodeId?: string; userId?: string }>();
  const { token, user } = useAuth();
  const { connected, messages, addMessage } = useChat();
  const [selectedTarget, setSelectedTarget] = useState<UserRef | null>(null);
  const [history, setHistory] = useState<Message[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (nodeId && userId) setSelectedTarget({ node_id: Number(nodeId), user_id: Number(userId) });
  }, [nodeId, userId]);

  useEffect(() => {
    setHistory([]);
    if (!selectedTarget || !token) return;
    const watcher = watchMessagesByUser(
      token,
      idToStr(selectedTarget.node_id),
      idToStr(selectedTarget.user_id),
      {
        intervalMs: 3000,
        onSnapshot: (msgs) => {
          setHistory(msgs);
        },
        onMessages: (msgs) => {
          for (const msg of msgs) {
            addMessage(msg);
          }
        },
      }
    );
    return () => watcher.stop();
  }, [selectedTarget, token, addMessage]);

  const handleSelect = useCallback((target: UserRef) => {
    navigate(`/chat/${idToStr(target.node_id)}/${idToStr(target.user_id)}`);
  }, [navigate]);

  const handleSend = useCallback(async (text: string) => {
    if (!selectedTarget || !token) return;
    const msg = await sendMessage(token, idToStr(selectedTarget.node_id), idToStr(selectedTarget.user_id), encodeText(text));
    setHistory((prev) => [...prev, msg]);
  }, [selectedTarget, token]);

  const liveMessages = messages.filter((msg) => {
    if (!selectedTarget || !user) return false;
    const tk = `${idToStr(selectedTarget.node_id)}:${idToStr(selectedTarget.user_id)}`;
    const sk = `${idToStr(msg.sender.node_id)}:${idToStr(msg.sender.user_id)}`;
    const rk = `${idToStr(msg.recipient.node_id)}:${idToStr(msg.recipient.user_id)}`;
    const mk = `${user.node_id}:${user.user_id}`;
    return sk === tk || (rk === mk && sk === tk);
  });

  const all = [...history, ...liveMessages.filter((lm) => !history.some((hm) => hm.node_id === lm.node_id && hm.seq === lm.seq))];

  return (
    <Layout style={{ height: "calc(100vh - 56px - 48px)", background: "#fff", borderRadius: 8, overflow: "hidden" }}>
      <Layout.Sider width={280} style={{ background: "#fff", borderRight: "1px solid #f0f0f0" }}>
        <ConversationList onSelect={handleSelect} selectedTarget={selectedTarget} />
      </Layout.Sider>
      <Layout.Content>
        <ChatWindow messages={all} target={selectedTarget} onSend={handleSend} connected={connected} />
      </Layout.Content>
    </Layout>
  );
}
