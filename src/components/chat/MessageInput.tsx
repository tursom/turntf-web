import { useState } from "react";
import { Input, Button, Space } from "antd";
import { SendOutlined } from "@ant-design/icons";

interface Props {
  onSend: (text: string) => Promise<void>;
  disabled?: boolean;
}

export function MessageInput({ onSend, disabled }: Props) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      await onSend(trimmed);
      setText("");
    } finally {
      setSending(false);
    }
  };

  return (
    <Space.Compact style={{ width: "100%" }}>
      <Input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onPressEnter={handleSend}
        placeholder={disabled ? "未连接" : "输入消息..."}
        disabled={disabled || sending}
        style={{ flex: 1 }}
      />
      <Button
        type="primary"
        icon={<SendOutlined />}
        onClick={handleSend}
        disabled={disabled || sending || !text.trim()}
        loading={sending}
      />
    </Space.Compact>
  );
}
