import { getApiUrl } from "./client";

function authHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

export async function getMetrics(token: string): Promise<string> {
  const resp = await fetch(`${getApiUrl()}/metrics`, {
    headers: authHeaders(token),
  });
  if (!resp.ok) throw new Error(await resp.text());
  return resp.text();
}
