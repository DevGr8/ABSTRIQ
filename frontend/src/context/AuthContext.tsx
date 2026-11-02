/**
 * context/AuthContext.tsx
 * Global authentication and security state for ABSTRIQ 3.2
 * Resilient session management: preserves user state across network interruptions,
 * page reloads, and Render backend spin-up latencies.
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import type { UserProfile, UserCustomKeyInfo } from "../types";
import * as authService from "../services/auth";
import { getAuthToken, setAuthToken, ApiError } from "../services/api";
import { auth } from "../services/firebase";
import { onAuthStateChanged } from "firebase/auth";

export type AuthModalTab = "login" | "signup" | "forgot" | "reset";

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  customKeyInfo: UserCustomKeyInfo | null;
  isLoading: boolean;
  isAuthModalOpen: boolean;
  authModalTab: AuthModalTab;
  openAuthModal: (tab?: AuthModalTab) => void;
  closeAuthModal: () => void;
  setAuthModalTab: (tab: AuthModalTab) => void;
  login: (payload: authService.LoginPayload) => Promise<void>;
  signup: (payload: authService.SignupPayload) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
  refreshCustomKey: () => Promise<void>;
  saveEncryptedKey: (provider: string, model: string, apiKey: string) => Promise<void>;
  removeEncryptedKey: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function getCachedUser(): UserProfile | null {
  try {
    const raw = localStorage.getItem("abstriq_cached_user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setCachedUser(u: UserProfile | null): void {
  try {
    if (u) {
      localStorage.setItem("abstriq_cached_user", JSON.stringify(u));
    } else {
      localStorage.removeItem("abstriq_cached_user");
    }
  } catch {
    // ignore
  }
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(() => getCachedUser());
  const [token, setTokenState] = useState<string | null>(() => getAuthToken() || null);
  const [customKeyInfo, setCustomKeyInfo] = useState<UserCustomKeyInfo | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authModalTab, setAuthModalTab] = useState<AuthModalTab>("login");

  const openAuthModal = (tab: AuthModalTab = "login") => {
    setAuthModalTab(tab);
    setIsAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setIsAuthModalOpen(false);
  };

  const refreshCustomKey = async () => {
    try {
      const res = await authService.getUserCustomKey();
      if (res.has_custom_key && res.custom_key) {
        setCustomKeyInfo(res.custom_key);
      } else {
        setCustomKeyInfo(null);
      }
    } catch {
      // Retain existing key info on transient network errors
    }
  };

  const refreshMe = async () => {
    const currentToken = getAuthToken();
    if (!currentToken) {
      setUser(null);
      setCachedUser(null);
      setCustomKeyInfo(null);
      setIsLoading(false);
      return;
    }

    try {
      const res = await authService.getMe();
      if (res.success && res.user) {
        setUser(res.user);
        setCachedUser(res.user);
        setTokenState(currentToken);
        await refreshCustomKey();
      } else {
        // Explicitly rejected by backend
        setUser(null);
        setCachedUser(null);
        setAuthToken(null);
        setTokenState(null);
      }
    } catch (err: any) {
      // CRITICAL RESILIENCE FIX:
      // Only clear credentials if backend explicitly returned HTTP 401 Unauthorized.
      // Do NOT clear user or token on transient network errors, cold start delays, or offline state.
      if (err instanceof ApiError && err.status === 401) {
        setUser(null);
        setCachedUser(null);
        setAuthToken(null);
        setTokenState(null);
      } else {
        console.warn("Backend refreshMe note (session maintained via cache):", err?.message || err);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Listen to Firebase client auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        try {
          const freshToken = await fbUser.getIdToken();
          setAuthToken(freshToken);
          setTokenState(freshToken);
        } catch (e) {
          console.warn("Firebase token refresh note:", e);
        }
      }
    });

    refreshMe();

    return () => unsubscribe();
  }, []);

  const login = async (payload: authService.LoginPayload) => {
    const res = await authService.login(payload);
    if (res.user && res.token) {
      setUser(res.user);
      setCachedUser(res.user);
      setTokenState(res.token);
      await refreshCustomKey();
      closeAuthModal();
    }
  };

  const signup = async (payload: authService.SignupPayload) => {
    const res = await authService.signup(payload);
    if (res.user && res.token) {
      setUser(res.user);
      setCachedUser(res.user);
      setTokenState(res.token);
      await refreshCustomKey();
      closeAuthModal();
    }
  };

  const logout = async () => {
    try {
      await authService.logout();
    } catch {
      // ignore
    }
    setUser(null);
    setCachedUser(null);
    setAuthToken(null);
    setTokenState(null);
    setCustomKeyInfo(null);
  };

  const saveEncryptedKey = async (provider: string, model: string, apiKey: string) => {
    const res = await authService.setUserCustomKey({ provider, model, api_key: apiKey });
    if (res.success && res.custom_key) {
      setCustomKeyInfo(res.custom_key);
    }
  };

  const removeEncryptedKey = async () => {
    await authService.deleteUserCustomKey();
    setCustomKeyInfo(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        customKeyInfo,
        isLoading,
        isAuthModalOpen,
        authModalTab,
        openAuthModal,
        closeAuthModal,
        setAuthModalTab,
        login,
        signup,
        logout,
        refreshMe,
        refreshCustomKey,
        saveEncryptedKey,
        removeEncryptedKey,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
