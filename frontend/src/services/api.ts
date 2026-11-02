/**
 * Base API client with uniform error handling and JSON parsing
 */

import { auth } from "./firebase";

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

export function getAuthToken(): string {
  try {
    return localStorage.getItem("abstriq_token") || "";
  } catch {
    return "";
  }
}

export function setAuthToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem("abstriq_token", token);
    } else {
      localStorage.removeItem("abstriq_token");
    }
  } catch {
    // ignore
  }
}

export function resolveApiUrl(path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  const base = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return base ? `${base}${cleanPath}` : cleanPath;
}

export async function requestJson<T>(
  url: string,
  options?: RequestInit & { timeoutMs?: number }
): Promise<T> {
  const timeoutMs = options?.timeoutMs ?? 70000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let token = getAuthToken();
  if (auth.currentUser) {
    try {
      token = await auth.currentUser.getIdToken();
      setAuthToken(token);
    } catch {
      // retain stored token
    }
  }

  const authHeaders: Record<string, string> = {};
  if (token) {
    authHeaders["Authorization"] = `Bearer ${token}`;
  }

  try {
    const fullUrl = resolveApiUrl(url);
    const response = await fetch(fullUrl, {
      ...options,
      signal: options?.signal || controller.signal,
      headers: {
        "Accept": "application/json",
        ...authHeaders,
        ...(options?.headers || {}),
      },
    });

    clearTimeout(timeoutId);

    const contentType = response.headers.get("content-type") || "";
    const isJson = contentType.includes("application/json");

    if (!response.ok) {
      let errorData: any = null;
      if (isJson) {
        try {
          errorData = await response.json();
        } catch {
          // ignore
        }
      }
      const msg =
        errorData?.error ||
        errorData?.message ||
        `HTTP Error ${response.status}: ${response.statusText}`;
      throw new ApiError(msg, response.status, errorData);
    }

    if (isJson) {
      return (await response.json()) as T;
    }

    return (await response.text()) as unknown as T;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError") {
      throw new ApiError("Request timed out after 70 seconds. Please try again.", 408);
    }
    if (err instanceof ApiError) {
      throw err;
    }
    throw new ApiError(err?.message || "Network error. Is the backend server running?", 0);
  }
}
