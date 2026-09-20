import { getApiUrl } from "./client";
import { wrappedFetch } from "./fetchWrapper";
import { kvJSON } from "@/utils/kvValue";

export interface KVDatabase { name: string; owner: string }
export interface KVEntry { value: string; createRevision: string; modRevision: string }
export interface KVAccess extends KVDatabase { acl: Record<string, number>; permission: number }
export class KVError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export class KVConflictError extends Error {
  constructor() { super("这个键已被修改或已存在。你的编辑已保留，请重新读取后再保存。"); }
}
const segment = encodeURIComponent;

async function request<T>(token: string, path: string, method = "GET", body?: unknown): Promise<T> {
  const response = await wrappedFetch(`${getApiUrl()}/kv${path}`, {
    method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : kvJSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) {
    const hint = response.status === 403 ? "没有此数据库的操作权限" : response.status === 503 ? "Raft 数据库服务不可用，请检查是否启用共识及当前节点是否可写" : "数据库请求失败";
    throw new KVError(`${hint}：${text}`, response.status);
  }
  return kvJSON.parse(text) as T;
}

export async function listKVDatabases(token: string, owner: string): Promise<KVDatabase[]> {
  return (await request<{ items: KVDatabase[] }>(token, `/databases?${new URLSearchParams({ owner })}`)).items;
}
export async function createKVDatabase(token: string, name: string): Promise<void> {
  await request(token, "/databases", "POST", { name });
}
export async function listKVEntries(token: string, database: string, prefix = ""): Promise<{ revision: string; items: Record<string, KVEntry> }> {
  const data = await request<{ revision: string | number | bigint; items: Record<string, { value: string | null; create_revision: string | number | bigint; mod_revision: string | number | bigint }> }>(token, `/${segment(database)}/list?${new URLSearchParams({ prefix })}`);
  return {
    revision: String(data.revision),
    items: Object.fromEntries(Object.entries(data.items).map(([key, entry]) => [key, {
      value: entry.value ?? "", createRevision: String(entry.create_revision), modRevision: String(entry.mod_revision),
    }])),
  };
}
export async function saveKVEntry(token: string, database: string, key: string, value: string, expectedRevision: string | null): Promise<string> {
  const result = await request<{ Succeeded: boolean; Revision: string | number | bigint }>(token, `/${segment(database)}/txn`, "POST", {
    compare: [expectedRevision === null ? { key, exists: false } : { key, exists: true, revision: BigInt(expectedRevision) }],
    puts: [{ key, value }], deletes: [],
  });
  // Raft FSM 的比较失败仍返回 HTTP 200；不能仅凭 response.ok 报告保存成功。
  if (!result.Succeeded) throw new KVConflictError();
  return String(result.Revision);
}
export function normalizeKVPrincipal(value: string): string {
  const text = value.trim();
  if (text === "*") return text;
  if (!/^\d+:\d+$/.test(text)) throw new Error("请输入节点 ID:用户 ID，或 *");
  const ids = text.split(":").map(BigInt);
  if (ids.some(id => id <= 0n || id > 9223372036854775807n)) throw new Error("节点 ID 和用户 ID 必须为正 int64 整数");
  return ids.join(":");
}

export async function getKVAccess(token: string, database: string): Promise<KVAccess> {
  return (await request<{ database: KVAccess }>(token, `/${segment(database)}/acl`)).database;
}
export async function grantKVAccess(token: string, database: string, principal: string, permission: number): Promise<void> {
  await request(token, `/${segment(database)}/acl/${segment(normalizeKVPrincipal(principal))}`, "PUT", { permission });
}
export async function revokeKVAccess(token: string, database: string, principal: string): Promise<void> {
  await request(token, `/${segment(database)}/acl/${segment(principal)}`, "DELETE");
}
