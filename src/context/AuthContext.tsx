import React, { createContext, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { hashedPassword } from "@tursom/turntf-web-sdk";
import { isAdminRole, STORAGE_KEYS } from "@/utils/constants";
import { clearAuthSession, readAuthSession, storeAuthSession } from "@/utils/authStorage";
import { onUnauthorized } from "@/utils/authEvents";
import { login as apiLogin, loginByLoginName as apiLoginByLoginName } from "@/api/auth";
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
  discardLegacyRedirect?: boolean;
}

export interface AuthContextValue extends AuthState {
  login: (nodeId: string, userId: string, password: string) => Promise<LoginResult>;
  loginByLoginName: (loginName: string, password: string) => Promise<LoginResult>;
  logout: () => void;
  refreshRealtimePassword: (password: string) => void;
  realtimeCredentialAvailable: boolean;
  realtimeCredentialVersion: number;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const locationRef = useRef(location);
  locationRef.current = location;

  const [realtimeCredentialVersion, setRealtimeCredentialVersion] = useState(0);
  const [state, setState] = useState<AuthState>({
    token: null,
    user: null,
    isAdmin: false,
    loading: true,
  });

  const logout = useCallback(() => {
    clearAuthSession();
    clearRealtimePassword();
    setRealtimeCredentialVersion((value) => value + 1);
    setState({ token: null, user: null, isAdmin: false, loading: false });
  }, []);

  useEffect(() => {
    const unsubscribe = onUnauthorized(() => {
      logout();
      navigate(`/login?redirect=${encodeURIComponent(locationRef.current.pathname)}`, { replace: true });
    });
    return unsubscribe;
  }, [logout, navigate]);

  useEffect(() => {
    const hadCachedSession = localStorage.getItem(STORAGE_KEYS.Token) != null;
    const session = readAuthSession();
    if (session) {
      setState({ ...session, isAdmin: isAdminRole(session.user.role), loading: false });
      return;
    }
    clearRealtimePassword();
    setState({ token: null, user: null, isAdmin: false, loading: false, discardLegacyRedirect: hadCachedSession });
  }, []);

  const login = useCallback(
    async (nodeId: string, userId: string, password: string): Promise<LoginResult> => {
      const resp = await apiLogin(nodeId, userId, password);
      const user: AuthUser = resp.user;
      storeAuthSession(resp.token, user);
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

  const loginByLoginName = useCallback(
    async (loginName: string, password: string): Promise<LoginResult> => {
      const resp = await apiLoginByLoginName(loginName, password);
      const user: AuthUser = resp.user;
      storeAuthSession(resp.token, user);
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

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      login,
      loginByLoginName,
      logout,
      refreshRealtimePassword,
      realtimeCredentialAvailable: hasRealtimePassword(),
      realtimeCredentialVersion,
    }),
    [state, login, loginByLoginName, logout, refreshRealtimePassword, realtimeCredentialVersion]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
