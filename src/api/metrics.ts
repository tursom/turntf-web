import { getHTTPClient } from "./client";

export async function getMetrics(token: string): Promise<string> {
  return getHTTPClient().metrics(token);
}
