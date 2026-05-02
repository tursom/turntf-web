type UnauthorizedCallback = () => void;
let listeners: UnauthorizedCallback[] = [];

export function onUnauthorized(callback: UnauthorizedCallback): () => void {
  listeners.push(callback);
  return () => {
    listeners = listeners.filter((cb) => cb !== callback);
  };
}

export function triggerUnauthorized(): void {
  listeners.forEach((cb) => cb());
}
