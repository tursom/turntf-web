import type { ListMessagesByUserOptions, Message, MessageWatcher, WatchMessagesByUserOptions } from "@tursom/turntf-web-sdk";
import { getTurntfWebClient } from "./client";

export async function listMessagesByUser(
  token: string,
  nodeId: string,
  userId: string,
  limit = 50
): Promise<Message[]> {
  const options: ListMessagesByUserOptions = { limit };
  return getTurntfWebClient().listMessagesByUser(token, nodeId, userId, options);
}

export async function sendMessage(
  token: string,
  nodeId: string,
  userId: string,
  body: Uint8Array
): Promise<Message> {
  return getTurntfWebClient().sendMessage(token, nodeId, userId, body);
}

export function watchMessagesByUser(
  token: string,
  nodeId: string,
  userId: string,
  options: WatchMessagesByUserOptions
): MessageWatcher {
  return getTurntfWebClient().watchMessagesByUser(token, nodeId, userId, options);
}
