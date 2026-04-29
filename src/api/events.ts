import type { Event } from "@/types";
import { getApiUrl } from "./client";

function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

export async function listEvents(
  token: string,
  afterSequence?: string,
  limit = 100
): Promise<Event[]> {
  const params = new URLSearchParams();
  if (afterSequence) params.set("after", afterSequence);
  params.set("limit", String(limit));
  const resp = await fetch(`${getApiUrl()}/events?${params}`, {
    headers: authHeaders(token),
  });
  if (!resp.ok) throw new Error(await resp.text());
  const data = await resp.json();
  return data.items ?? [];
}
