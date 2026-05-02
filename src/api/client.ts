import { HTTPClient } from "@tursom/turntf-web-sdk";
import { getApiBaseUrl, getRealtimeBaseUrl } from "@/config";
import { wrappedFetch } from "./fetchWrapper";

let client: HTTPClient | null = null;

export function getApiUrl(): string {
  return getApiBaseUrl();
}

export function getRealtimeUrl(): string {
  return getRealtimeBaseUrl();
}

export function getHTTPClient(): HTTPClient {
  if (client) {
    return client;
  }
  client = new HTTPClient(getApiUrl(), { fetch: wrappedFetch });
  return client;
}
