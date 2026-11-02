import React, { useState } from "react";
import { motion } from "motion/react";
import { Search, BookOpen, ExternalLink, ArrowRight, Check, Sparkles, Filter } from "lucide-react";
import { searchPapers } from "../services/research";
import type { ActivePage, SearchPaper } from "../types";

interface ResearchPageProps {
  onImportToStudio: (paper: SearchPaper) => void;
}

export const ResearchPage: React.FC<ResearchPageProps> = ({ onImportToStudio }) => {
  const [query, setQuery] = useState("");
  const [source, setSource] = useState<"openalex" | "arxiv">("openalex");
  const [results, setSearchResults] = useState<SearchPaper[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const sampleQueries = [
    "Transformer attention mechanisms",
    "Reinforcement learning from human feedback",
    "Graph neural networks for drug discovery",
    "Diffusion models image synthesis",
    "Quantum error correction surface codes",
  ];

  const handleSearch = async (searchTerm?: string) => {
    const q = (searchTerm ?? query).trim();
    if (!q) return;
    setIsLoading(true);
    setHasSearched(true);
    try {
      const data = await searchPapers(q, source);
      setSearchResults(data);
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8 py-6">
      {/* Header */}
      <div className="border-b border-slate-800 pb-5">
        <div className="text-xs font-mono uppercase tracking-widest text-cyan-400">
          Literature Discovery
        </div>
        <h2 className="text-2xl font-extrabold text-white">Academic Research Explorer</h2>
        <p className="text-xs text-slate-400 mt-1">
          Search millions of peer-reviewed papers on OpenAlex and preprints on arXiv, then directly evaluate abstracts in Studio.
        </p>
      </div>

      {/* Search Input Box */}
      <div className="lab-card rounded-2xl p-6 border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-500" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Search research topics, keywords, or paper titles..."
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-900 border border-slate-700/80 text-sm text-slate-100 placeholder-slate-400 outline-none focus:border-cyan-500 transition-all"
            />
          </div>

          <div className="flex items-center space-x-2">
            <select
              value={source}
              onChange={(e) => setSource(e.target.value as any)}
              className="px-3 py-3 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono text-slate-200 outline-none focus:border-cyan-500"
            >
              <option value="openalex">OpenAlex Corpus</option>
              <option value="arxiv">arXiv Preprints</option>
            </select>

            <button
              onClick={() => handleSearch()}
              disabled={isLoading || !query.trim()}
              className="px-5 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-mono text-xs font-bold flex items-center space-x-2 transition-all disabled:opacity-50 shadow-neon-cyan"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              <span>Query</span>
            </button>
          </div>
        </div>

        {/* Suggested Queries */}
        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
          <span className="text-slate-400 font-mono text-[11px]">Trending topics:</span>
          {sampleQueries.map((sq, i) => (
            <button
              key={i}
              onClick={() => {
                setQuery(sq);
                handleSearch(sq);
              }}
              className="px-2.5 py-1 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-cyan-300 text-[11px] font-mono border border-slate-700/60 transition-colors"
            >
              {sq}
            </button>
          ))}
        </div>
      </div>

      {/* Results Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-mono font-semibold uppercase tracking-wider text-slate-200 flex items-center space-x-2">
            <BookOpen className="w-4 h-4 text-cyan-400" />
            <span>Search Results ({results.length})</span>
          </h3>
          <span className="text-xs text-slate-400 font-mono uppercase">Source: {source}</span>
        </div>

        {isLoading ? (
          <div className="lab-card rounded-xl p-12 text-center text-xs font-mono text-slate-400">
            <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <span>Connecting to {source} repository API...</span>
          </div>
        ) : results.length === 0 ? (
          <div className="lab-card rounded-xl p-12 text-center text-xs font-mono text-slate-400 space-y-2">
            <Search className="w-8 h-8 text-slate-600 mx-auto" />
            <p>
              {hasSearched
                ? "No matching papers found. Try adjusting your search keywords."
                : "Enter a search query above to fetch research papers."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {results.map((paper) => (
              <div
                key={paper.id}
                className="lab-card rounded-xl p-5 border border-slate-800 space-y-3 hover:border-cyan-500/40 transition-all flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-4">
                    <h4 className="text-base font-bold text-white leading-snug">
                      {paper.title}
                    </h4>
                    {paper.url && (
                      <a
                        href={paper.url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-cyan-300 flex-shrink-0 transition-colors"
                        title="Open paper link"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-slate-400">
                    {paper.authors && (
                      <span className="text-slate-300">
                        {Array.isArray(paper.authors)
                          ? paper.authors.slice(0, 3).join(", ") + (paper.authors.length > 3 ? " et al." : "")
                          : paper.authors}
                      </span>
                    )}
                    {paper.year && <span>&bull; {paper.year}</span>}
                    {paper.venue && <span>&bull; {paper.venue}</span>}
                    {paper.citation_count !== undefined && paper.citation_count > 0 && (
                      <span className="text-emerald-400">
                        &bull; {paper.citation_count} citations
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 uppercase text-[10px]">
                      {paper.source}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed font-sans line-clamp-4 pt-1">
                    {paper.abstract}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                  <span className="text-[11px] font-mono text-slate-400">
                    {paper.abstract ? `${paper.abstract.split(/\s+/).length} words` : "No abstract"}
                  </span>

                  <button
                    onClick={() => onImportToStudio(paper)}
                    className="btn-neon-primary px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center space-x-1.5 shadow-neon-green-sm"
                  >
                    <span>Evaluate in Studio</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
