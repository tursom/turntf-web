import type { User } from "@/types";
import { getApiUrl } from "./client";

function authHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

export async function listUsers(token: string): Promise<User[]> {
  const resp = await fetch(`${getApiUrl()}/users`, { headers: authHeaders(token) });
  if (!resp.ok) throw new Error(await resp.text());
  return resp.json();
}

export async function getUser(token: string, nodeId: string, userId: string): Promise<User> {
  const resp = await fetch(`${getApiUrl()}/nodes/${nodeId}/users/${userId}`, {
    headers: authHeaders(token),
  });
  if (!resp.ok) throw new Error(await resp.text());
  return resp.json();
}

export async function createUser(
  token: string,
  req: { username: string; password: string; role: string }
): Promise<User> {
  const resp = await fetch(`${getApiUrl()}/users`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(req),
  });
  if (!resp.ok) throw new Error(await resp.text());
  return resp.json();
}

export interface UpdateUserInput {
  username?: string;
  password?: string;
  role?: string;
  profileJson?: Uint8Array;
}

export async function updateUser(
  token: string,
  nodeId: string,
  userId: string,
  req: UpdateUserInput
): Promise<User> {
  const body: Record<string, unknown> = {};
  if (req.username !== undefined) body.username = req.username;
  if (req.password !== undefined) body.password = req.password;
  if (req.role !== undefined) body.role = req.role;
  if (req.profileJson !== undefined) body.profile_json = Array.from(req.profileJson);
  const resp = await fetch(`${getApiUrl()}/nodes/${nodeId}/users/${userId}`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(await resp.text());
  return resp.json();
}

export async function deleteUser(
  token: string,
  nodeId: string,
  userId: string
): Promise<void> {
  const resp = await fetch(`${getApiUrl()}/nodes/${nodeId}/users/${userId}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  if (!resp.ok) throw new Error(await resp.text());
}
