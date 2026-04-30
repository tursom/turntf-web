import type { Event } from "@/types";
import { getHTTPClient } from "./client";

export async function listEvents(
  token: string,
  afterSequence?: string,
  limit = 100
): Promise<Event[]> {
  return getHTTPClient().listEvents(token, afterSequence ?? "0", limit);
}
