import React, { createContext, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Client, MemoryCursorStore, NopHandler, type UserRef } from "@tursom/turntf-web-sdk";
import { getRealtimeUrl } from "@/api/client";
import { loadRealtimePassword } from "@/utils/realtimeCredentials";
import { messageKey } from "@/utils/format";
import type { Message } from "@/types";
import { useAuth } from "@/hooks/useAuth";

export interface ChatContextValue {
  connected: boolean;
  messages: Message[];
  clearMessages: () => void;
  sendMessage: (target: UserRef, body: Uint8Array) => Promise<Message>;
  statusText: string | null;
}

export const ChatContext = createContext<ChatContextValue | undefined>(undefined);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const {
    token,
    user,
    realtimeCredentialAvailable,
    realtimeCredentialVersion,
  } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [connected, setConnected] = useState(false);
  const [statusText, setStatusText] = useState<string | null>(null);
  const clientRef = useRef<Client | null>(null);
  const activeUserRef = useRef<string | null>(null);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  const pushMessage = useCallback((message: Message) => {
    setMessages((current) => {
      const nextKey = messageKey(message);
      if (current.some((item) => messageKey(item) === nextKey)) {
        return current;
      }
      return [...current, message];
    });
  }, []);

  useEffect(() => {
    const currentUserKey = user == null ? null : `${user.nodeId}:${user.userId}`;
    if (activeUserRef.current !== currentUserKey) {
      activeUserRef.current = currentUserKey;
      setMessages([]);
    }
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    const password = loadRealtimePassword();

    void clientRef.current?.close();
    clientRef.current = null;
    setConnected(false);

    if (!token || !user) {
      setStatusText(null);
      return () => {
        cancelled = true;
      };
    }

    if (password == null || !realtimeCredentialAvailable) {
      setStatusText("未建立实时连接，需要重新登录以恢复聊天");
      return () => {
        cancelled = true;
      };
    }

    class Handler extends NopHandler {
      override onLogin(): void {
        if (cancelled) {
          return;
        }
        setConnected(true);
        setStatusText(null);
      }

      override onMessage(message: Message): void {
        if (cancelled) {
          return;
        }
        pushMessage(message);
      }

      override onDisconnect(): void {
        if (cancelled) {
          return;
        }
        setConnected(false);
        setStatusText("实时连接已断开，正在尝试重连");
      }

      override onError(error: unknown): void {
        if (cancelled) {
          return;
        }
        setStatusText(error instanceof Error ? error.message : "实时连接异常");
      }
    }

    const client = new Client({
      baseUrl: getRealtimeUrl(),
      credentials: user.loginName
        ? {
            loginName: user.loginName,
            password,
          }
        : {
            nodeId: user.nodeId,
            userId: user.userId,
            password,
          },
      cursorStore: new MemoryCursorStore(),
      handler: new Handler(),
    });

    clientRef.current = client;
    setStatusText("正在建立实时连接");
    void client.connect().catch((error) => {
      if (cancelled) {
        return;
      }
      setConnected(false);
      setStatusText(error instanceof Error ? error.message : "实时连接失败");
    });

    return () => {
      cancelled = true;
      if (clientRef.current === client) {
        clientRef.current = null;
      }
      setConnected(false);
      void client.close();
    };
  }, [token, user, realtimeCredentialAvailable, realtimeCredentialVersion, pushMessage]);

  const sendMessage = useCallback(async (target: UserRef, body: Uint8Array): Promise<Message> => {
    const client = clientRef.current;
    if (client == null) {
      throw new Error(statusText ?? "实时连接未建立");
    }
    const msg = await client.sendMessage(target, body);
    pushMessage(msg);
    return msg;
  }, [statusText, pushMessage]);

  const value = useMemo<ChatContextValue>(
    () => ({ connected, messages, clearMessages, sendMessage, statusText }),
    [connected, messages, clearMessages, sendMessage, statusText]
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}
