import type { Message } from "@/types";
import { messageKey } from "@/utils/format";

export interface ChatSession {
  history: Message[];
  sent: Message[];
  historyStatus: "idle" | "loading" | "success" | "error";
  historyRequest: number;
  draft: string;
  sending: boolean;
  sendError: string | null;
  sendVersion: number;
}

export const emptySession: ChatSession = {
  history: [], sent: [], historyStatus: "idle", historyRequest: 0,
  draft: "", sending: false, sendError: null, sendVersion: 0,
};

export type SessionAction = { key: string } & (
  | { type: "historyStart"; request: number }
  | { type: "historySuccess"; request: number; messages: Message[] }
  | { type: "historyError"; request: number }
  | { type: "draft"; text: string }
  | { type: "sendStart" }
  | { type: "sendSuccess"; message: Message; draft: string }
  | { type: "sendError"; error: string }
);

export function sessionsReducer(state: Record<string, ChatSession>, action: SessionAction): Record<string, ChatSession> {
  const session = state[action.key] ?? emptySession;
  let next: ChatSession;
  switch (action.type) {
    case "historyStart":
      next = { ...session, historyStatus: "loading", historyRequest: action.request };
      break;
    case "historySuccess":
    case "historyError":
      // 重试或切换会话后，旧请求不能覆盖更新的历史状态。
      if (session.historyRequest !== action.request) return state;
      next = action.type === "historySuccess"
        ? { ...session, historyStatus: "success", history: action.messages }
        : { ...session, historyStatus: "error" };
      break;
    case "draft":
      next = { ...session, draft: action.text, sendError: null };
      break;
    case "sendStart":
      next = { ...session, sending: true, sendError: null, sendVersion: session.sendVersion + 1 };
      break;
    case "sendSuccess":
      next = {
        ...session, sending: false, sendError: null,
        draft: session.draft === action.draft ? "" : session.draft,
        sent: mergeMessages(session.sent, [action.message]),
        sendVersion: session.sendVersion + 1,
      };
      break;
    case "sendError":
      next = { ...session, sending: false, sendError: action.error };
      break;
  }
  return { ...state, [action.key]: next };
}

export function mergeMessages(...sources: Message[][]): Message[] {
  const seen = new Map<string, Message>();
  for (const source of sources) {
    for (const message of source) {
      const key = messageKey(message);
      if (!seen.has(key)) seen.set(key, message);
    }
  }
  return [...seen.values()];
}
