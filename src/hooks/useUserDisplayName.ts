import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { User, UserRef } from "@/types";
import { listUsers } from "@/api/users";
import { useAuth } from "@/hooks/useAuth";
import { tryParseJsonBytes } from "@/utils/text";

export function resolveDisplayName(user: User): string {
  if (user.profileJson && user.profileJson.length > 0) {
    const profile = tryParseJsonBytes(user.profileJson);
    if (profile && typeof profile === "object") {
      const raw = profile as Record<string, unknown>;
      const dn = raw.display_name ?? raw.displayName;
      if (typeof dn === "string" && dn.trim().length > 0) {
        return dn.trim();
      }
    }
  }

  if (user.username && user.username.length > 0) {
    return user.username;
  }

  return `${user.nodeId}:${user.userId}`;
}

export function useUserDisplayName() {
  const { token } = useAuth();

  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: () => listUsers(token!),
    enabled: !!token,
    staleTime: 30_000,
  });

  const getUserDisplayName = useMemo(
    () => (ref: UserRef): string => {
      const user = users.find(
        (u) =>
          String(u.nodeId) === String(ref.nodeId) &&
          String(u.userId) === String(ref.userId)
      );
      if (user) return resolveDisplayName(user);
      return `${ref.nodeId}:${ref.userId}`;
    },
    [users]
  );

  return { getUserDisplayName, users };
}
