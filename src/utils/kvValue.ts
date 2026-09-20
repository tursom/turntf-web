import JSONBig from "json-bigint";
import { base64ToBytes, bytesToBase64 } from "@/utils/text";

// KV 的 revision 为 uint64；值也可能含大整数或名为 constructor / __proto__ 的普通键。
// json-bigint 使用无原型对象，保留这些键并在格式化时保留整数类型和精度。
export const kvJSON = JSONBig({ useNativeBigInt: true, protoAction: "preserve", constructorAction: "preserve" });
export type ValueFormat = "text" | "json" | "base64";

export function encodeKVValue(text: string, format: ValueFormat): string {
  if (format === "base64") {
    if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(text)) {
      throw new Error("请输入有效的 Base64，空字符串表示空值");
    }
    return bytesToBase64(base64ToBytes(text));
  }
  if (format === "json") kvJSON.parse(text);
  return bytesToBase64(new TextEncoder().encode(text));
}

export function isKVValueDirty(text: string, format: ValueFormat, originalValue: string | null): boolean {
  if (originalValue === null) return true;
  try { return encodeKVValue(text, format) !== originalValue; }
  catch { return true; }
}

export function decodeKVValue(value: string, format: ValueFormat): string {
  if (format === "base64") return value;
  const text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(base64ToBytes(value));
  if (format === "json") kvJSON.parse(text);
  return text;
}

export function initialKVValue(value: string): { text: string; format: ValueFormat } {
  for (const format of ["json", "text", "base64"] as const) {
    try { return { text: decodeKVValue(value, format), format }; } catch { /* 二进制值回退到 Base64。 */ }
  }
  return { text: value, format: "base64" };
}
