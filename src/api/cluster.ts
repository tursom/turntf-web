import type { ClusterNode, LoggedInUser } from "@/types";
import { getHTTPClient } from "./client";

export async function listClusterNodes(token: string): Promise<ClusterNode[]> {
  return getHTTPClient().listClusterNodes(token);
}

export async function listNodeLoggedInUsers(
  token: string,
  nodeId: string
): Promise<LoggedInUser[]> {
  return getHTTPClient().listNodeLoggedInUsers(token, nodeId);
}
