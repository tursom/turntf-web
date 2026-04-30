import type { Message } from "@/types";
import { getHTTPClient } from "./client";

export async function listMessages(
  token: string,
  nodeId: string,
  userId: string,
  limit = 50
): Promise<Message[]> {
  return getHTTPClient().listMessages(token, { nodeId, userId }, limit);
}
