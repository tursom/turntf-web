import { useState } from "react";
import { Modal, Input, List, Typography, message } from "antd";
import type { UserRef, User } from "@/types";
import { listUsers } from "@/api/users";
import { useAuth } from "@/hooks/useAuth";
import { resolveDisplayName } from "@/hooks/useUserDisplayName";

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (target: UserRef) => void;
}

export function ContactPicker({ open, onClose, onSelect }: Props) {
  const { token } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const handleSearch = async (value: string) => {
    setSearch(value);
    if (!token || !value.trim()) { setUsers([]); return; }
    setLoading(true);
    try {
      const all = await listUsers(token);
      setUsers(
        all.filter((candidate) => candidate.username.toLowerCase().includes(value.toLowerCase()))
      );
    } catch { message.error("搜索用户失败"); }
    finally { setLoading(false); }
  };

  return (
    <Modal title="新建会话" open={open} onCancel={onClose} footer={null} width={480}>
      <Input.Search placeholder="搜索用户名..." onSearch={handleSearch} loading={loading} style={{ marginBottom: 16 }} />
      <List dataSource={users} loading={loading} locale={{ emptyText: search ? "未找到用户" : "输入关键词搜索" }}
        renderItem={(u) => (
          <List.Item style={{ cursor: "pointer" }} onClick={() => { onSelect({ nodeId: u.nodeId, userId: u.userId }); onClose(); }}>
            <Typography.Text>{resolveDisplayName(u)}</Typography.Text>
          </List.Item>
        )} />
    </Modal>
  );
}
