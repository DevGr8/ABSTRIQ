import { requestJson } from "./api";
import type { SearchPaper } from "../types";

export async function searchPapers(
  query: string,
  source: "openalex" | "arxiv" = "openalex"
): Promise<SearchPaper[]> {
  if (!query.trim()) return [];
  const params = new URLSearchParams({
    query: query.trim(),
    source,
  });
  const res = await requestJson<{ results: SearchPaper[] }>(`/api/search?${params.toString()}`);
  return res.results || [];
}
