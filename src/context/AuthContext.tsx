import React, { createContext, useCallback, useEffect, useMemo, useState } from "react";
import { isAdminRole, STORAGE_KEYS } from "@/utils/constants";
import { login as apiLogin, type LoginResponse } from "@/api/auth";

export interface AuthUser {
  node_id: string;
  user_id: string;
  username: string;
  role: string;
}

export interface AuthState {
  token: string | null;
  user: AuthUser | null;
  isAdmin: boolean;
  loading: boolean;
}

export interface AuthContextValue extends AuthState {
  login: (nodeId: string, userId: string, password: string) => Promise<LoginResponse>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
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
        const user: AuthUser = JSON.parse(userStr);
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
    async (nodeId: string, userId: string, password: string): Promise<LoginResponse> => {
      const resp = await apiLogin(nodeId, userId, password);
      const user: AuthUser = {
        node_id: resp.user.node_id,
        user_id: resp.user.user_id,
        username: resp.user.username,
        role: resp.user.role,
      };
      localStorage.setItem(STORAGE_KEYS.Token, resp.token);
      localStorage.setItem(STORAGE_KEYS.User, JSON.stringify(user));
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

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEYS.Token);
    localStorage.removeItem(STORAGE_KEYS.User);
    setState({ token: null, user: null, isAdmin: false, loading: false });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, login, logout }),
    [state, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
