import type { OperationsStatus } from "@/types";
import { getApiUrl } from "./client";

function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

export async function getHealth(): Promise<{ status: string }> {
  const resp = await fetch(`${getApiUrl()}/healthz`);
  if (!resp.ok) throw new Error(await resp.text());
  return resp.json();
}

export async function getOpsStatus(token: string): Promise<OperationsStatus> {
  const resp = await fetch(`${getApiUrl()}/ops/status`, { headers: authHeaders(token) });
  if (!resp.ok) throw new Error(await resp.text());
  return resp.json();
}
