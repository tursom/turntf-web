export const BOTTOM_THRESHOLD = 80;

export function isNearBottom(scrollHeight: number, scrollTop: number, clientHeight: number): boolean {
  return scrollHeight - scrollTop - clientHeight <= BOTTOM_THRESHOLD;
}

export function addedMessageKeys(previous: Set<string>, current: string[]): string[] {
  return current.filter((key) => !previous.has(key));
}

export function shouldFollowMessages(initial: boolean, sent: boolean, nearBottom: boolean, added: number): boolean {
  return initial || sent || (nearBottom && added > 0);
}
