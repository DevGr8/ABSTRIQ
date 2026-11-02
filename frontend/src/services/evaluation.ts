import { requestJson, resolveApiUrl, ApiError, getAuthToken } from "./api";
import type {
  RuntimeConfig,
  EvaluationResult,
  UploadResponse,
  HistoryRecord,
  ProvenanceMetadata,
} from "../types";

export interface EvaluatePayload {
  abstract: string;
  title?: string;
  source?: string;
  prompt_version?: string;
  provider?: string;
  model?: string;
  api_key?: string;
  provenance?: ProvenanceMetadata | null;
  original_abstract?: string;
}

export interface TestKeyPayload {
  provider: string;
  api_key: string;
  model?: string;
}

export interface TestKeyResponse {
  success: boolean;
  message?: string;
  error?: string;
  provider?: string;
  model?: string;
  latency_s?: number;
}

export async function testApiKey(payload: TestKeyPayload): Promise<TestKeyResponse> {
  return requestJson<TestKeyResponse>("/api/test-key", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    timeoutMs: 25000,
  });
}

export async function fetchRuntimeConfig(): Promise<RuntimeConfig> {
  return requestJson<RuntimeConfig>("/api/config");
}

export async function evaluateAbstract(payload: EvaluatePayload): Promise<EvaluationResult> {
  return requestJson<EvaluationResult>("/api/evaluate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    timeoutMs: 90000,
  });
}

export async function uploadDocument(file: File): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const authHeaders: Record<string, string> = {};
  const token = getAuthToken();
  if (token) {
    authHeaders["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(resolveApiUrl("/api/upload"), {
    method: "POST",
    headers: authHeaders,
    body: formData,
  });

  const isJson = (response.headers.get("content-type") || "").includes("application/json");
  const data = isJson ? await response.json() : {};

  if (!response.ok) {
    throw new ApiError(data.error || "File upload failed", response.status, data);
  }

  return data as UploadResponse;
}

export async function fetchHistory(): Promise<HistoryRecord[]> {
  const res = await requestJson<{ history: HistoryRecord[] }>("/api/history");
  return res.history || [];
}

export function getDownloadUrl(): string {
  return resolveApiUrl("/download");
}
