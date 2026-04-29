import dayjs from "dayjs";

export function formatTime(hlcTimestamp: string): string {
  if (!hlcTimestamp) return "-";
  const parts = hlcTimestamp.split("-");
  const ms = Number(parts[0]) / 1_000_000;
  return dayjs(ms).format("YYYY-MM-DD HH:mm:ss");
}

export function formatRelativeTime(hlcTimestamp: string): string {
  if (!hlcTimestamp) return "-";
  const parts = hlcTimestamp.split("-");
  const ms = Number(parts[0]) / 1_000_000;
  const d = dayjs(ms);
  const now = dayjs();
  const diffMinutes = now.diff(d, "minute");
  if (diffMinutes < 1) return "刚刚";
  if (diffMinutes < 60) return `${diffMinutes} 分钟前`;
  const diffHours = now.diff(d, "hour");
  if (diffHours < 24) return `${diffHours} 小时前`;
  return d.format("MM-DD HH:mm");
}

export function formatBytes(bytes: Uint8Array | number[] | null | undefined): string {
  if (!bytes || bytes.length === 0) return "";
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(arr);
  } catch {
    return `[二进制数据: ${arr.length} bytes]`;
  }
}

export function idToStr(id: number | string): string {
  if (typeof id === "string") return id;
  return String(id);
}

export function userKeyStr(nodeId: number | string, userId: number | string): string {
  return `${idToStr(nodeId)}:${idToStr(userId)}`;
}
