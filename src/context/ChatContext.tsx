import React, { createContext, useCallback, useMemo, useRef, useState } from "react";
import type { Message } from "@/types";
import { useAuth } from "@/hooks/useAuth";

export interface ChatContextValue {
  connected: boolean;
  messages: Message[];
  clearMessages: () => void;
  addMessage: (msg: Message) => void;
}

export const ChatContext = createContext<ChatContextValue | undefined>(undefined);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesRef = useRef<Message[]>([]);
  const connected = !!token;

  const clearMessages = useCallback(() => {
    messagesRef.current = [];
    setMessages([]);
  }, []);

  const addMessage = useCallback((msg: Message) => {
    messagesRef.current = [...messagesRef.current, msg];
    setMessages([...messagesRef.current]);
  }, []);

  const value = useMemo<ChatContextValue>(
    () => ({ connected, messages, clearMessages, addMessage }),
    [connected, messages, clearMessages, addMessage]
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}
