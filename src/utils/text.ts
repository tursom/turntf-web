export function encodeText(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

export function decodeText(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

export function jsonToBytes(value: unknown): Uint8Array {
  return encodeText(JSON.stringify(value ?? {}));
}

export function tryParseJsonBytes(bytes: Uint8Array): unknown | null {
  if (bytes.length === 0) {
    return null;
  }
  try {
    return JSON.parse(decodeText(bytes));
  } catch {
    return null;
  }
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
