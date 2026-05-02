import type { User } from "@/types";
import { hashedPassword } from "@tursom/turntf-web-sdk";
import { jsonToBytes } from "@/utils/text";
import { getApiUrl, getHTTPClient } from "./client";
import { wrappedFetch } from "./fetchWrapper";

function authHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

export async function listUsers(token: string): Promise<User[]> {
  const resp = await wrappedFetch(`${getApiUrl()}/users`, { headers: authHeaders(token) });
  if (!resp.ok) throw new Error(await resp.text());
  const data = await resp.json();
  const items = Array.isArray(data) ? data : (data.items ?? []);
  return items.map(mapUserFromHttp);
}

export async function getUser(token: string, nodeId: string, userId: string): Promise<User> {
  return getHTTPClient().getUser(token, { nodeId, userId });
}

export async function createUser(
  token: string,
  req: { username: string; password: string; role: string; loginName?: string }
): Promise<User> {
  return getHTTPClient().createUser(token, {
    username: req.username,
    password: hashedPassword(req.password),
    role: req.role,
    loginName: req.loginName,
  });
}

export interface UpdateUserInput {
  username?: string;
  password?: string;
  role?: string;
  loginName?: string;
  profileJson?: Uint8Array;
}

export async function updateUser(
  token: string,
  nodeId: string,
  userId: string,
  req: UpdateUserInput
): Promise<User> {
  return getHTTPClient().updateUser(token, { nodeId, userId }, {
    username: req.username,
    password: req.password == null ? undefined : hashedPassword(req.password),
    role: req.role,
    loginName: req.loginName,
    profileJson: req.profileJson,
  });
}

export async function deleteUser(
  token: string,
  nodeId: string,
  userId: string
): Promise<void> {
  await getHTTPClient().deleteUser(token, { nodeId, userId });
}

function mapUserFromHttp(value: Record<string, unknown>): User {
  const profile = value.profile ?? value.profile_json ?? {};
  return {
    nodeId: String(value.node_id ?? ""),
    userId: String(value.user_id ?? ""),
    username: String(value.username ?? ""),
    loginName: String(value.login_name ?? ""),
    role: String(value.role ?? ""),
    profileJson: jsonToBytes(profile),
    systemReserved: Boolean(value.system_reserved),
    createdAt: String(value.created_at ?? ""),
    updatedAt: String(value.updated_at ?? ""),
    originNodeId: String(value.origin_node_id ?? ""),
  };
}
