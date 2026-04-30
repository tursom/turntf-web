import React, { createContext, useCallback, useEffect, useMemo, useState } from "react";
import { hashedPassword } from "@tursom/turntf-web-sdk";
import { isAdminRole, STORAGE_KEYS } from "@/utils/constants";
import { login as apiLogin } from "@/api/auth";
import {
  clearRealtimePassword,
  createRealtimePassword,
  hasRealtimePassword,
  storeRealtimePassword
} from "@/utils/realtimeCredentials";
import type { AuthUser, LoginResult } from "@/types";

export interface AuthState {
  token: string | null;
  user: AuthUser | null;
  isAdmin: boolean;
  loading: boolean;
}

export interface AuthContextValue extends AuthState {
  login: (nodeId: string, userId: string, password: string) => Promise<LoginResult>;
  logout: () => void;
  refreshRealtimePassword: (password: string) => void;
  realtimeCredentialAvailable: boolean;
  realtimeCredentialVersion: number;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [realtimeCredentialVersion, setRealtimeCredentialVersion] = useState(0);
  const [state, setState] = useState<AuthState>({
    token: null,
    user: null,
    isAdmin: false,
    loading: true,
  });

  useEffect(() => {
    const token = localStorage.getItem(STORAGE_KEYS.Token);
    const userStr = localStorage.getItem(STORAGE_KEYS.User);
    if (token && userStr) {
      try {
        const user = normalizeStoredUser(JSON.parse(userStr));
        setState({
          token,
          user,
          isAdmin: isAdminRole(user.role),
          loading: false,
        });
        return;
      } catch {
        localStorage.removeItem(STORAGE_KEYS.Token);
        localStorage.removeItem(STORAGE_KEYS.User);
      }
    }
    setState((s) => ({ ...s, loading: false }));
  }, []);

  const login = useCallback(
    async (nodeId: string, userId: string, password: string): Promise<LoginResult> => {
      const resp = await apiLogin(nodeId, userId, password);
      const user: AuthUser = resp.user;
      localStorage.setItem(STORAGE_KEYS.Token, resp.token);
      localStorage.setItem(STORAGE_KEYS.User, JSON.stringify(user));
      storeRealtimePassword(hashedPassword(resp.wirePasswordEncoded));
      setRealtimeCredentialVersion((value) => value + 1);
      setState({
        token: resp.token,
        user,
        isAdmin: isAdminRole(user.role),
        loading: false,
      });
      return resp;
    },
    []
  );

  const refreshRealtimePassword = useCallback((password: string) => {
    storeRealtimePassword(createRealtimePassword(password));
    setRealtimeCredentialVersion((value) => value + 1);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEYS.Token);
    localStorage.removeItem(STORAGE_KEYS.User);
    clearRealtimePassword();
    setRealtimeCredentialVersion((value) => value + 1);
    setState({ token: null, user: null, isAdmin: false, loading: false });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      login,
      logout,
      refreshRealtimePassword,
      realtimeCredentialAvailable: hasRealtimePassword(),
      realtimeCredentialVersion,
    }),
    [state, login, logout, refreshRealtimePassword, realtimeCredentialVersion]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function normalizeStoredUser(value: unknown): AuthUser {
  const object = (value ?? {}) as Record<string, unknown>;
  return {
    nodeId: String(object.nodeId ?? object.node_id ?? ""),
    userId: String(object.userId ?? object.user_id ?? ""),
    username: String(object.username ?? ""),
    role: String(object.role ?? ""),
  };
}
