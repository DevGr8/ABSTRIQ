/**
 * context/AuthContext.tsx
 * Global authentication and security state for ABSTRIQ 2.0
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import type { UserProfile, UserCustomKeyInfo } from "../types";
import * as authService from "../services/auth";
import { getAuthToken, setAuthToken } from "../services/api";

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

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
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
      setCustomKeyInfo(null);
    }
  };

  const refreshMe = async () => {
    const currentToken = getAuthToken();
    if (!currentToken) {
      setUser(null);
      setCustomKeyInfo(null);
      setIsLoading(false);
      return;
    }

    try {
      const res = await authService.getMe();
      if (res.success && res.user) {
        setUser(res.user);
        setTokenState(currentToken);
        await refreshCustomKey();
      } else {
        setUser(null);
        setAuthToken(null);
        setTokenState(null);
      }
    } catch {
      setUser(null);
      setAuthToken(null);
      setTokenState(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshMe();
  }, []);

  const login = async (payload: authService.LoginPayload) => {
    const res = await authService.login(payload);
    if (res.user && res.token) {
      setUser(res.user);
      setTokenState(res.token);
      await refreshCustomKey();
      closeAuthModal();
    }
  };

  const signup = async (payload: authService.SignupPayload) => {
    const res = await authService.signup(payload);
    if (res.user && res.token) {
      setUser(res.user);
      setTokenState(res.token);
      await refreshCustomKey();
      closeAuthModal();
    }
  };

  const logout = async () => {
    await authService.logout();
    setUser(null);
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
