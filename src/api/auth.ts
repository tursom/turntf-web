import { getApiUrl } from "./client";

export interface LoginResponse {
  token: string;
  expires_at: string;
  user: {
    node_id: string;
    user_id: string;
    username: string;
    role: string;
  };
}

export async function login(
  nodeId: string,
  userId: string,
  password: string
): Promise<LoginResponse> {
  const resp = await fetch(`${getApiUrl()}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      node_id: parseInt(nodeId, 10),
      user_id: parseInt(userId, 10),
      password,
    }),
  });
  if (!resp.ok) {
    throw new Error(await resp.text());
  }
  return resp.json();
}
