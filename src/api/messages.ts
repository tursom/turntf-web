import type { Message } from "@/types";
import { getApiUrl } from "./client";

function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

export async function listMessagesByUser(
  token: string,
  nodeId: string,
  userId: string,
  limit = 50
): Promise<Message[]> {
  const resp = await fetch(
    `${getApiUrl()}/nodes/${nodeId}/users/${userId}/messages?limit=${limit}`,
    { headers: authHeaders(token) }
  );
  if (!resp.ok) throw new Error(await resp.text());
  const data = await resp.json();
  return data.items ?? [];
}

export async function sendMessage(
  token: string,
  nodeId: string,
  userId: string,
  body: Uint8Array
): Promise<Message> {
  const resp = await fetch(`${getApiUrl()}/nodes/${nodeId}/users/${userId}/messages`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ body: Array.from(body) }),
  });
  if (!resp.ok) throw new Error(await resp.text());
  return resp.json();
}
