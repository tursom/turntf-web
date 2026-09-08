import { Input, Button, Space, Tooltip } from "antd";
import { SendOutlined } from "@ant-design/icons";

interface Props {
  onSend: () => Promise<void>;
  disabled?: boolean;
  text: string;
  onTextChange: (text: string) => void;
  sending: boolean;
}

export function MessageInput({ onSend, disabled, text, onTextChange, sending }: Props) {
  const handleSend = () => {
    if (!disabled && !sending && text.trim()) void onSend();
  };

  return (
    <Space.Compact style={{ width: "100%" }}>
      <Input
        aria-label="消息草稿"
        value={text}
        onChange={(e) => onTextChange(e.target.value)}
        onPressEnter={(e) => {
          if (!e.nativeEvent.isComposing && e.keyCode !== 229) {
            e.preventDefault();
            handleSend();
          }
        }}
        placeholder={disabled ? "未连接" : "输入消息..."}
        style={{ flex: 1, minWidth: 0 }}
      />
      <Tooltip title="发送消息">
        <Button
          aria-label="发送消息"
          type="primary"
          icon={<SendOutlined />}
          onClick={handleSend}
          disabled={disabled || sending || !text.trim()}
          loading={sending}
          style={{ flexShrink: 0 }}
        />
      </Tooltip>
    </Space.Compact>
  );
}
