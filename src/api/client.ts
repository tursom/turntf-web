import { TurntfWebClient } from "@tursom/turntf-web-sdk";
import { getApiBaseUrl } from "@/config";

let client: TurntfWebClient | null = null;

export function getApiUrl(): string {
  return getApiBaseUrl();
}

export function getTurntfWebClient(): TurntfWebClient {
  if (client) {
    return client;
  }
  client = new TurntfWebClient({ baseUrl: getApiUrl() });
  return client;
}
