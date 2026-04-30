import type { LoginResponse } from "@tursom/turntf-web-sdk";
import { getTurntfWebClient } from "./client";

export type { LoginResponse } from "@tursom/turntf-web-sdk";

export async function login(
  nodeId: string,
  userId: string,
  password: string
): Promise<LoginResponse> {
  return getTurntfWebClient().loginWithPassword(nodeId, userId, password);
}
