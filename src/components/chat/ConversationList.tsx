import { useEffect, useState, useCallback } from "react";
import { List, Typography, Badge, Button, Space, Segmented } from "antd";
import { PlusOutlined, TeamOutlined, UserOutlined } from "@ant-design/icons";
import { decodeBytes } from "@tursom/turntf-web-sdk";
import type { UserRef } from "@/types";
import { AttachmentType } from "@/types";
import { useAuth } from "@/hooks/useAuth";
import { useChat } from "@/hooks/useChat";
import { listAttachments } from "@/api/attachments";
import { idToStr, formatRelativeTime } from "@/utils/format";
import { ContactPicker } from "./ContactPicker";

interface Conversation {
  target: UserRef;
  name: string;
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
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "users" | "channels">("all");

  useEffect(() => {
    if (!token || !user) return;
    listAttachments(token, user.node_id, user.user_id, AttachmentType.ChannelSubscription)
      .then((subs) => {
        const chs: Conversation[] = subs.map((s) => ({
          target: s.subject,
          name: `${idToStr(s.subject.node_id)}:${idToStr(s.subject.user_id)}`,
          isChannel: true,
        }));
        setConversations((prev) => {
          const keys = new Set(prev.map((c) => `${c.target.node_id}:${c.target.user_id}`));
          return [...prev, ...chs.filter((c) => !keys.has(`${c.target.node_id}:${c.target.user_id}`))];
        });
      })
      .catch(() => {});
  }, [token, user]);

  useEffect(() => {
    if (messages.length === 0 || !user) return;
    const newKeys = new Map<string, { time: string; preview: string }>();
    for (const msg of messages) {
      const isFromMe = idToStr(msg.sender.node_id) === user.node_id && idToStr(msg.sender.user_id) === user.user_id;
      const peer = isFromMe ? msg.recipient : msg.sender;
      const key = `${peer.node_id}:${peer.user_id}`;
      const preview = decodeBytes(msg.body);
      newKeys.set(key, { time: msg.created_at, preview: preview.slice(0, 50) });
    }
    setConversations((prev) => {
      const copy = [...prev];
      for (const [key, info] of newKeys) {
        const [nid, uid] = key.split(":");
        const existing = copy.find((c) => `${c.target.node_id}` === nid && `${c.target.user_id}` === uid);
        if (existing) { existing.lastTime = info.time; existing.lastPreview = info.preview; }
        else copy.push({ target: { node_id: Number(nid), user_id: Number(uid) }, name: key, isChannel: false, lastTime: info.time, lastPreview: info.preview });
      }
      copy.sort((a, b) => { if (!a.lastTime) return 1; if (!b.lastTime) return -1; return b.lastTime.localeCompare(a.lastTime); });
      return copy;
    });
  }, [messages, user]);

  const handleNew = useCallback((target: UserRef) => {
    onSelect(target);
    setConversations((prev) => {
      const exists = prev.find((c) => `${c.target.node_id}` === `${target.node_id}` && `${c.target.user_id}` === `${target.user_id}`);
      if (exists) return prev;
      return [{ target, name: `${idToStr(target.node_id)}:${idToStr(target.user_id)}`, isChannel: false }, ...prev];
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
        <List dataSource={filtered} split={false} renderItem={(c) => {
          const key = `${c.target.node_id}:${c.target.user_id}`;
          const selected = selectedTarget ? `${selectedTarget.node_id}:${selectedTarget.user_id}` === key : false;
          return (
            <div onClick={() => onSelect(c.target)} style={{ padding: "10px 12px", cursor: "pointer", background: selected ? "#e6f4ff" : "transparent", borderBottom: "1px solid #f5f5f5" }}>
              <Space>
                {c.isChannel ? <TeamOutlined /> : <UserOutlined />}
                <div>
                  <Typography.Text strong={selected} style={{ fontSize: 14 }}>{c.isChannel ? "# " : ""}{c.name}</Typography.Text>
                  {c.lastPreview && <Typography.Paragraph type="secondary" style={{ margin: 0, fontSize: 12 }} ellipsis={{ rows: 1 }}>{c.lastPreview}</Typography.Paragraph>}
                </div>
              </Space>
              {c.lastTime && <Typography.Text type="secondary" style={{ fontSize: 11, float: "right" }}>{formatRelativeTime(c.lastTime)}</Typography.Text>}
            </div>
          );
        }} />
      </div>
      <div style={{ padding: "8px 12px", borderTop: "1px solid #f0f0f0" }}>
        <Button type="dashed" icon={<PlusOutlined />} block onClick={() => setPickerOpen(true)}>新会话</Button>
      </div>
      <ContactPicker open={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={handleNew} />
    </div>
  );
}
