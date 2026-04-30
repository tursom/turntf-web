import type { AuthUser, LoginResult } from "@/types";
import { createRealtimePassword } from "@/utils/realtimeCredentials";
import { getHTTPClient } from "./client";

export interface AuthenticatedSession extends LoginResult {
  wirePasswordEncoded: string;
}

export async function login(
  nodeId: string,
  userId: string,
  password: string
): Promise<AuthenticatedSession> {
  const wirePassword = createRealtimePassword(password);
  const token = await getHTTPClient().loginWithPassword(nodeId, userId, wirePassword);
  const user = await getHTTPClient().getUser(token, { nodeId, userId });
  const authUser: AuthUser = {
    nodeId: user.nodeId,
    userId: user.userId,
    username: user.username,
    role: user.role,
  };
  return {
    token,
    user: authUser,
    wirePasswordEncoded: wirePassword.encoded,
  };
}
