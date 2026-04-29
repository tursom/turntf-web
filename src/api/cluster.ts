import { getApiUrl } from "./client";

function authHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

export interface ClusterNodeItem {
  node_id: number | string;
  is_local: boolean;
  configured_url: string;
  source?: string;
}

export async function listClusterNodes(token: string): Promise<ClusterNodeItem[]> {
  const resp = await fetch(`${getApiUrl()}/cluster/nodes`, {
    headers: authHeaders(token),
  });
  if (!resp.ok) throw new Error(await resp.text());
  const data = await resp.json();
  return data.nodes ?? [];
}

export async function listNodeLoggedInUsers(
  token: string,
  nodeId: string
): Promise<{ node_id: number | string; user_id: number | string; username: string }[]> {
  const resp = await fetch(
    `${getApiUrl()}/cluster/nodes/${nodeId}/logged-in-users`,
    { headers: authHeaders(token) }
  );
  if (!resp.ok) throw new Error(await resp.text());
  const data = await resp.json();
  return data.items ?? [];
}
