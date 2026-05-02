import type { AuthUser, LoginResult } from "@/types";
import { createRealtimePassword } from "@/utils/realtimeCredentials";
import { getApiUrl, getHTTPClient } from "./client";

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
    loginName: user.loginName,
    role: user.role,
  };
  return {
    token,
    user: authUser,
    wirePasswordEncoded: wirePassword.encoded,
  };
}

export async function loginByLoginName(
  loginName: string,
  password: string
): Promise<AuthenticatedSession> {
  const trimmed = loginName.trim();
  if (trimmed === "") {
    throw new Error("登录名不能为空");
  }

  const wirePassword = createRealtimePassword(password);

  const response = await fetch(`${getApiUrl()}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      login_name: trimmed,
      password: wirePassword.encoded,
    }),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(text || "登录失败");
  }

  const data: Record<string, unknown> = JSON.parse(text);
  const token = data.token;
  if (typeof token !== "string" || token === "") {
    throw new Error("登录响应中缺少 token");
  }

  const rawUser = data.user as Record<string, unknown> | undefined;
  if (rawUser == null) {
    throw new Error("登录响应中缺少用户信息");
  }

  const authUser: AuthUser = {
    nodeId: String(rawUser.node_id ?? ""),
    userId: String(rawUser.user_id ?? ""),
    username: String(rawUser.username ?? ""),
    loginName: String(rawUser.login_name ?? ""),
    role: String(rawUser.role ?? ""),
  };

  return {
    token,
    user: authUser,
    wirePasswordEncoded: wirePassword.encoded,
  };
}
