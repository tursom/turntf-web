import { useState } from "react";
import { Modal, Input, List, Typography, message } from "antd";
import type { UserRef } from "@/types";
import { listUsers } from "@/api/users";
import { useAuth } from "@/hooks/useAuth";
import { idToStr } from "@/utils/format";

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (target: UserRef) => void;
}

export function ContactPicker({ open, onClose, onSelect }: Props) {
  const { token } = useAuth();
  const [users, setUsers] = useState<UserRef[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const handleSearch = async (value: string) => {
    setSearch(value);
    if (!token || !value.trim()) { setUsers([]); return; }
    setLoading(true);
    try {
      const all = await listUsers(token);
      setUsers(all.filter((u) => u.username.toLowerCase().includes(value.toLowerCase())).map((u) => ({ node_id: u.node_id, user_id: u.user_id })));
    } catch { message.error("搜索用户失败"); }
    finally { setLoading(false); }
  };

  return (
    <Modal title="新建会话" open={open} onCancel={onClose} footer={null} width={480}>
      <Input.Search placeholder="搜索用户名..." onSearch={handleSearch} loading={loading} style={{ marginBottom: 16 }} />
      <List dataSource={users} loading={loading} locale={{ emptyText: search ? "未找到用户" : "输入关键词搜索" }}
        renderItem={(u) => (
          <List.Item style={{ cursor: "pointer" }} onClick={() => { onSelect(u); onClose(); }}>
            <Typography.Text>{idToStr(u.node_id)}:{idToStr(u.user_id)}</Typography.Text>
          </List.Item>
        )} />
    </Modal>
  );
}
