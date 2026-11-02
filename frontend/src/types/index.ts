export interface RubricCriterion {
  title: string;
  weight: number;
  description: string;
  levels: Record<string, string>;
}

export interface RuntimeConfig {
  provider: string;
  model: string;
  is_mock: boolean;
  prompt_versions: string[];
  default_prompt: string;
  low_score_threshold: number;
  max_upload_mb: number;
  rubric: Record<string, RubricCriterion>;
}

export interface CriterionScore {
  score: number;
  max: number;
  title: string;
  reason: string;
  evidence: string;
  evidence_found: boolean;
}

export interface Suggestion {
  item: string;
  issue: string;
  fix: string;
}

export interface AutomationAction {
  action: string;
  status: string;
  details: string;
}

export interface AutomationResult {
  triggered: boolean;
  threshold: number;
  total_score: number;
  summary: string;
  actions: AutomationAction[];
}

export interface LLMMetadata {
  provider: string;
  model: string;
  latency_s: number;
  is_mock: boolean;
}

export interface ProvenanceMetadata {
  provenance_version: string;
  source_provider: string;
  source_url: string | null;
  doi: string | null;
  paper_title: string | null;
  authors: string[] | string | null;
  venue: string | null;
  year: number | string | null;
  external_id: string | null;
  retrieval_timestamp_utc: string;
  retrieval_method: string;
  source_api: string | null;
  original_record_id: string | null;
  import_operation_id: string;
  extraction_method: string;
  extraction_source: string;
  extraction_timestamp: string;
  extraction_status: string;
  extraction_warnings: string[];
  original_text_hash: string;
  normalized_text_hash: string;
  document_hash?: string | null;
  manually_edited: boolean;
  modification_timestamp?: string | null;
}

export interface EvaluationResult {
  success: boolean;
  run_id?: string;
  title?: string;
  source?: string;
  prompt_version?: string;
  timestamp?: string;
  word_count?: number;
  total_score: number;
  max_score: number;
  percentage: number;
  scores: Record<string, CriterionScore>;
  suggestions: Suggestion[];
  warnings: string[];
  automation?: AutomationResult;
  llm?: LLMMetadata;
  elapsed_seconds?: number;
  injection_detected?: boolean;
  error?: string;
  provenance?: ProvenanceMetadata | null;
  original_abstract?: string;
}

export interface SearchPaper {
  id: string;
  title: string;
  abstract: string;
  authors?: string | string[];
  year?: string | number | null;
  venue?: string;
  doi?: string;
  url?: string;
  citation_count?: number;
  word_count?: number;
  source: string;
  provenance?: ProvenanceMetadata;
}

export interface UploadResponse {
  success: boolean;
  title?: string;
  abstract?: string;
  original_abstract?: string;
  word_count?: number;
  filename?: string;
  provenance?: ProvenanceMetadata;
  error?: string;
}

export interface HistoryRecord {
  timestamp: string;
  id: string;
  source: string;
  title: string;
  prompt_version: string;
  model: string;
  status: string;
  word_count: number;
  score_purpose: number;
  score_method: number;
  score_results: number;
  score_conclusion: number;
  score_clarity: number;
  total: number;
  warnings: string;
  suggestions_json: string;
  seconds: number;
  abstract: string;
  provenance?: ProvenanceMetadata | null;
  original_abstract?: string;
}

export type ActivePage =
  | "landing"
  | "dashboard"
  | "evaluation"
  | "research"
  | "history"
  | "analytics"
  | "settings"
  | "profile";

export interface UserProfile {
  id: number;
  email: string;
  username: string;
  full_name?: string;
  institution?: string;
  role: string;
  created_at: string;
}

export interface UserCustomKeyInfo {
  provider: string;
  model: string;
  has_key: boolean;
  masked_key: string;
  updated_at?: string;
}

export interface AuthResponse {
  success: boolean;
  token?: string;
  user?: UserProfile;
  message?: string;
  error?: string;
  reset_token?: string;
}

