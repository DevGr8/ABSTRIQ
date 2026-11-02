/**
 * services/auth.ts
 * Frontend client for ABSTRIQ 2.0 authentication and user management
 */

import { requestJson, setAuthToken } from "./api";
import type { AuthResponse, UserProfile, UserCustomKeyInfo } from "../types";

export interface SignupPayload {
  email: string;
  username: string;
  password: string;
  full_name?: string;
  institution?: string;
}

export interface LoginPayload {
  identifier: string;
  password: string;
}

export interface UpdateProfilePayload {
  full_name?: string;
  institution?: string;
}

export interface ChangePasswordPayload {
  current_password: string;
  new_password: string;
}

export interface ResetPasswordPayload {
  token: string;
  new_password: string;
}

export interface CustomKeyPayload {
  provider: string;
  model: string;
  api_key: string;
}

export async function signup(payload: SignupPayload): Promise<AuthResponse> {
  const res = await requestJson<AuthResponse>("/api/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (res.token) {
    setAuthToken(res.token);
  }
  return res;
}

export async function login(payload: LoginPayload): Promise<AuthResponse> {
  const res = await requestJson<AuthResponse>("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (res.token) {
    setAuthToken(res.token);
  }
  return res;
}

export async function logout(): Promise<{ success: boolean; message: string }> {
  try {
    const res = await requestJson<{ success: boolean; message: string }>("/api/auth/logout", {
      method: "POST",
    });
    setAuthToken(null);
    return res;
  } catch (err) {
    setAuthToken(null);
    return { success: true, message: "Logged out locally." };
  }
}

export async function getMe(): Promise<{ success: boolean; user: UserProfile }> {
  return await requestJson<{ success: boolean; user: UserProfile }>("/api/auth/me");
}

export async function updateProfile(payload: UpdateProfilePayload): Promise<{ success: boolean; user: UserProfile; message: string }> {
  return await requestJson<{ success: boolean; user: UserProfile; message: string }>("/api/auth/profile", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function changePassword(payload: ChangePasswordPayload): Promise<{ success: boolean; message: string }> {
  return await requestJson<{ success: boolean; message: string }>("/api/auth/password", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function forgotPassword(email: string): Promise<{ success: boolean; message: string; reset_token?: string }> {
  return await requestJson<{ success: boolean; message: string; reset_token?: string }>("/api/auth/forgot-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
}

export async function resetPassword(payload: ResetPasswordPayload): Promise<{ success: boolean; message: string }> {
  return await requestJson<{ success: boolean; message: string }>("/api/auth/reset-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function getUserCustomKey(): Promise<{ success: boolean; has_custom_key: boolean; custom_key: UserCustomKeyInfo | null }> {
  return await requestJson<{ success: boolean; has_custom_key: boolean; custom_key: UserCustomKeyInfo | null }>("/api/user/custom-key");
}

export async function setUserCustomKey(payload: CustomKeyPayload): Promise<{ success: boolean; message: string; custom_key: UserCustomKeyInfo }> {
  return await requestJson<{ success: boolean; message: string; custom_key: UserCustomKeyInfo }>("/api/user/custom-key", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function deleteUserCustomKey(): Promise<{ success: boolean; message: string }> {
  return await requestJson<{ success: boolean; message: string }>("/api/user/custom-key", {
    method: "DELETE",
  });
}
