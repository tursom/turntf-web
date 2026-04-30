import type { Subscription } from "@/types";
import { getHTTPClient } from "./client";

export async function listSubscriptions(
  token: string,
  nodeId: string,
  userId: string
): Promise<Subscription[]> {
  return getHTTPClient().listSubscriptions(token, { nodeId, userId });
}

export async function subscribeChannel(
  token: string,
  subscriberNodeId: string,
  subscriberUserId: string,
  channelNodeId: string,
  channelUserId: string
): Promise<Subscription> {
  return getHTTPClient().subscribeChannel(
    token,
    { nodeId: subscriberNodeId, userId: subscriberUserId },
    { nodeId: channelNodeId, userId: channelUserId }
  );
}

export async function unsubscribeChannel(
  token: string,
  subscriberNodeId: string,
  subscriberUserId: string,
  channelNodeId: string,
  channelUserId: string
): Promise<Subscription> {
  return getHTTPClient().unsubscribeChannel(
    token,
    { nodeId: subscriberNodeId, userId: subscriberUserId },
    { nodeId: channelNodeId, userId: channelUserId }
  );
}
