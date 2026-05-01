import { useEffect, useState, useCallback, useRef } from "react";
import { List, Typography, Badge, Button, Space, Segmented, Spin, Empty } from "antd";
import { PlusOutlined, TeamOutlined, UserOutlined } from "@ant-design/icons";
import type { UserRef } from "@/types";
import { useAuth } from "@/hooks/useAuth";
import { useChat } from "@/hooks/useChat";
import { listSubscriptions } from "@/api/subscriptions";
import { getHTTPClient } from "@/api/client";
import { formatBytes, idToStr, formatRelativeTime } from "@/utils/format";
import { encodeText, decodeText } from "@/utils/text";
import { ContactPicker } from "./ContactPicker";
import { useUserDisplayName } from "@/hooks/useUserDisplayName";

interface Conversation {
  target: UserRef;
  isChannel: boolean;
  lastTime?: string;
  lastPreview?: string;
}

interface Props {
  onSelect: (target: UserRef) => void;
  selectedTarget: UserRef | null;
}

export function ConversationList({ onSelect, selectedTarget }: Props) {
  const { token, user } = useAuth();
  const { messages, connected } = useChat();
  const { getUserDisplayName } = useUserDisplayName();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loadingSubs, setLoadingSubs] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "users" | "channels">("all");
  const loadedRef = useRef(false);

  useEffect(() => {
    if (!token || !user) return;
    const client = getHTTPClient();
    client.getUserMetadata(token, user, "conversations")
      .then((meta) => {
        const list = JSON.parse(decodeText(meta.value));
        if (Array.isArray(list) && list.length > 0) {
          setConversations(list);
          setLoadingSubs(false);
        }
      })
      .catch(() => {})
      .finally(() => { loadedRef.current = true; });
  }, [token, user]);

  useEffect(() => {
    if (!token || !user || !loadedRef.current || conversations.length === 0) return;
    const client = getHTTPClient();
    const value = encodeText(JSON.stringify(conversations));
    client.upsertUserMetadata(token, user, "conversations", { value }).catch(() => {});
  }, [conversations, token, user]);

  useEffect(() => {
    if (!token || !user) return;
    setLoadingSubs(true);
    listSubscriptions(token, user.nodeId, user.userId)
      .then((subs) => {
        const chs: Conversation[] = subs.map((s) => ({
          target: s.channel,
          isChannel: true,
        }));
        setConversations((prev) => {
          const keys = new Set(prev.map((c) => `${c.target.nodeId}:${c.target.userId}`));
          return [...prev, ...chs.filter((c) => !keys.has(`${c.target.nodeId}:${c.target.userId}`))];
        });
      })
      .catch(() => {})
      .finally(() => setLoadingSubs(false));
  }, [token, user]);

  useEffect(() => {
    if (messages.length === 0 || !user) return;
    const newKeys = new Map<string, { time: string; preview: string }>();
    for (const msg of messages) {
      const isFromMe = idToStr(msg.sender.nodeId) === user.nodeId && idToStr(msg.sender.userId) === user.userId;
      const peer = isFromMe ? msg.recipient : msg.sender;
      const key = `${peer.nodeId}:${peer.userId}`;
      const preview = formatBytes(msg.body);
      newKeys.set(key, { time: msg.createdAtHlc, preview: preview.slice(0, 50) });
    }
    setConversations((prev) => {
      const copy = [...prev];
      for (const [key, info] of newKeys) {
        const [nid, uid] = key.split(":");
        const existing = copy.find((c) => `${c.target.nodeId}` === nid && `${c.target.userId}` === uid);
        if (existing) { existing.lastTime = info.time; existing.lastPreview = info.preview; }
        else copy.push({ target: { nodeId: nid, userId: uid }, isChannel: false, lastTime: info.time, lastPreview: info.preview });
      }
      copy.sort((a, b) => { if (!a.lastTime) return 1; if (!b.lastTime) return -1; return b.lastTime.localeCompare(a.lastTime); });
      return copy;
    });
  }, [messages, user]);

  const handleNew = useCallback((target: UserRef) => {
    onSelect(target);
    setConversations((prev) => {
      const exists = prev.find((c) => `${c.target.nodeId}` === `${target.nodeId}` && `${c.target.userId}` === `${target.userId}`);
      if (exists) return prev;
      return [{ target, isChannel: false }, ...prev];
    });
  }, [onSelect]);

  const filtered = conversations.filter((c) => {
    if (filter === "users") return !c.isChannel;
    if (filter === "channels") return c.isChannel;
    return true;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ padding: "12px", borderBottom: "1px solid #f0f0f0" }}>
        <Space style={{ width: "100%", justifyContent: "space-between" }}>
          <Typography.Text strong style={{ fontSize: 16 }}>会话</Typography.Text>
          <Badge status={connected ? "success" : "error"} text={connected ? "在线" : "离线"} />
        </Space>
        <Segmented block size="small" style={{ marginTop: 8 }} value={filter}
          onChange={(v) => setFilter(v as typeof filter)}
          options={[{ label: "全部", value: "all" }, { label: "用户", value: "users" }, { label: "频道", value: "channels" }]} />
      </div>
      <div style={{ flex: 1, overflow: "auto" }}>
        {loadingSubs ? (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}>
            <Spin tip="加载会话..." />
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}>
            <Empty description="暂无会话，点击下方「新会话」开始聊天" />
          </div>
        ) : (
        <List dataSource={filtered} split={false} renderItem={(c) => {
          const key = `${c.target.nodeId}:${c.target.userId}`;
          const selected = selectedTarget ? `${selectedTarget.nodeId}:${selectedTarget.userId}` === key : false;
          return (
            <div onClick={() => onSelect(c.target)} style={{ padding: "10px 12px", cursor: "pointer", background: selected ? "#e6f4ff" : "transparent", borderBottom: "1px solid #f5f5f5" }}>
              <Space>
                {c.isChannel ? <TeamOutlined /> : <UserOutlined />}
                <div>
                  <Typography.Text strong={selected} style={{ fontSize: 14 }}>{c.isChannel ? "# " : ""}{getUserDisplayName(c.target)}</Typography.Text>
                  {c.lastPreview && <Typography.Paragraph type="secondary" style={{ margin: 0, fontSize: 12 }} ellipsis={{ rows: 1 }}>{c.lastPreview}</Typography.Paragraph>}
                </div>
              </Space>
              {c.lastTime && <Typography.Text type="secondary" style={{ fontSize: 11, float: "right" }}>{formatRelativeTime(c.lastTime)}</Typography.Text>}
            </div>
          );
        }} />
      )}
      </div>
      <div style={{ padding: "8px 12px", borderTop: "1px solid #f0f0f0" }}>
        <Button type="dashed" icon={<PlusOutlined />} block onClick={() => setPickerOpen(true)}>新会话</Button>
      </div>
      <ContactPicker open={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={handleNew} />
    </div>
  );
}
