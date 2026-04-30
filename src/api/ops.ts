import type { HealthStatus, OperationsStatus } from "@/types";
import { getApiUrl, getHTTPClient } from "./client";

export async function getHealth(): Promise<HealthStatus> {
  const resp = await fetch(`${getApiUrl()}/healthz`);
  if (!resp.ok) throw new Error(await resp.text());
  return resp.json();
}

export async function getOpsStatus(token: string): Promise<OperationsStatus> {
  return getHTTPClient().operationsStatus(token);
}
