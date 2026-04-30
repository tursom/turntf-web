// 始终通过管理服务器中转，API 和 WebSocket 都走同源 /api 路径
export function getApiBaseUrl(): string {
  return import.meta.env.VITE_API_BASE_URL ?? "/api";
}

export function getRealtimeBaseUrl(): string {
  return new URL(getApiBaseUrl(), window.location.origin).toString();
}
