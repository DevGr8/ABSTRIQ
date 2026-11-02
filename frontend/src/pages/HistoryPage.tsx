import React, { useState, useEffect } from "react";
import {
  History,
  Download,
  Search,
  Filter,
  CheckCircle,
  AlertTriangle,
  FileText,
  Clock,
  X,
  User,
  ShieldCheck,
} from "lucide-react";
import type { HistoryRecord } from "../types";
import { fetchHistory, getDownloadUrl } from "../services/evaluation";
import { useAuth } from "../context/AuthContext";

export const HistoryPage: React.FC = () => {
  const { user, openAuthModal } = useAuth();
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchFilter, setSearchFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "passed" | "flagged">("all");
  const [selectedRecord, setSelectedRecord] = useState<HistoryRecord | null>(null);

  useEffect(() => {
    fetchHistory()
      .then((data: HistoryRecord[]) => setHistory(data))
      .catch((err: any) => console.error("History fetch error:", err))
      .finally(() => setLoading(false));
  }, [user]);

  const filtered = history.filter((h) => {
    const matchesSearch =
      (h.title || "").toLowerCase().includes(searchFilter.toLowerCase()) ||
      (h.abstract || "").toLowerCase().includes(searchFilter.toLowerCase()) ||
      (h.id || "").toLowerCase().includes(searchFilter.toLowerCase());

    const isFlagged = (h.total || 0) <= 10;
    if (statusFilter === "passed") return matchesSearch && !isFlagged;
    if (statusFilter === "flagged") return matchesSearch && isFlagged;
    return matchesSearch;
  });

  return (
    <div className="space-y-8 py-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="text-xs font-mono uppercase tracking-widest text-emerald-400">
            Audit Trails &amp; Workbook
          </div>
          <h2 className="text-2xl font-extrabold text-white">Evaluation History</h2>
          <p className="text-xs text-slate-400 mt-1">
            Persisted records synchronized across multi-sheet Excel (<code className="text-emerald-400">results.xlsx</code>) and SQLite.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <a
            href={getDownloadUrl()}
            download="results.xlsx"
            className="btn-neon-primary px-4 py-2 rounded-lg text-xs font-mono font-bold flex items-center space-x-2 shadow-neon-green-sm self-start sm:self-auto"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Excel</span>
          </a>
        </div>
      </div>

      {/* Auth Status Notice */}
      {user ? (
        <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-between text-xs font-mono">
          <div className="flex items-center space-x-2 text-purple-300">
            <ShieldCheck className="w-4 h-4 text-purple-400" />
            <span>
              Isolated Research Profile: Displaying personal evaluation runs for{" "}
              <strong className="text-white">@{user.username}</strong>.
            </span>
          </div>
        </div>
      ) : (
        <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs font-mono">
          <span className="text-slate-400">
            Viewing benchmark evaluations. Sign in to isolate and preserve your personal evaluation logs.
          </span>
          <button
            onClick={() => openAuthModal("login")}
            className="text-emerald-400 hover:text-emerald-300 underline font-bold"
          >
            Sign In
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="lab-card rounded-xl p-4 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="w-full sm:w-80 relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Filter by title, ID, or text..."
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-900 border border-slate-700/80 text-xs text-slate-100 placeholder-slate-400 outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex items-center space-x-2 self-end sm:self-auto">
          <span className="text-xs font-mono text-slate-400">Status:</span>
          {(["all", "passed", "flagged"] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono capitalize transition-all ${
                statusFilter === st
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                  : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800"
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* History Table */}
      <div className="lab-card rounded-xl border border-slate-800 overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-xs font-mono text-slate-400">
            <div className="w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <span>Loading Excel records...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-xs font-mono text-slate-400">
            No matching evaluation records found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-[11px] uppercase bg-slate-900/80">
                  <th className="py-3 px-4">ID</th>
                  <th className="py-3 px-4">Date / Time</th>
                  <th className="py-3 px-4">Paper Title</th>
                  <th className="py-3 px-4">Model</th>
                  <th className="py-3 px-4">Scores (P/M/R/C/Cl)</th>
                  <th className="py-3 px-4">Total</th>
                  <th className="py-3 px-4">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filtered.map((rec) => {
                  const isFlagged = (rec.total || 0) <= 10;
                  return (
                    <tr
                      key={rec.id}
                      onClick={() => setSelectedRecord(rec)}
                      className="hover:bg-slate-900/60 transition-colors cursor-pointer"
                    >
                      <td className="py-3.5 px-4 text-emerald-400 font-bold whitespace-nowrap">
                        {rec.id}
                      </td>
                      <td className="py-3.5 px-4 text-slate-400 whitespace-nowrap">
                        {rec.timestamp ? rec.timestamp.replace("T", " ").substring(0, 16) : "—"}
                      </td>
                      <td className="py-3.5 px-4 max-w-xs truncate text-slate-200 font-semibold">
                        {rec.title || "Untitled"}
                      </td>
                      <td className="py-3.5 px-4 text-slate-400 whitespace-nowrap">
                        {rec.model || "default"}
                      </td>
                      <td className="py-3.5 px-4 text-slate-300 whitespace-nowrap">
                        {rec.score_purpose}/{rec.score_method}/{rec.score_results}/
                        {rec.score_conclusion}/{rec.score_clarity}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded font-bold ${
                            isFlagged
                              ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                              : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                          }`}
                        >
                          {rec.total} / 20
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-emerald-400 hover:text-emerald-300 whitespace-nowrap">
                        View Details &rarr;
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Record Inspection Modal */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="lab-card rounded-2xl max-w-2xl w-full p-6 border border-slate-700 max-h-[85vh] overflow-y-auto space-y-5">
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-mono uppercase text-emerald-400">
                  Record ID: {selectedRecord.id}
                </span>
                <h3 className="text-lg font-bold text-white mt-0.5">
                  {selectedRecord.title || "Untitled"}
                </h3>
              </div>
              <button
                onClick={() => setSelectedRecord(null)}
                className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-slate-400 text-[10px]">Total Score</span>
                <div className="text-lg font-bold text-emerald-400">{selectedRecord.total} / 20</div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-slate-400 text-[10px]">Word Count</span>
                <div className="text-lg font-bold text-white">{selectedRecord.word_count || 0}</div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-slate-400 text-[10px]">Latency</span>
                <div className="text-lg font-bold text-cyan-400">{selectedRecord.seconds || 0}s</div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-slate-400 text-[10px]">Status</span>
                <div className="text-lg font-bold uppercase text-slate-200">
                  {selectedRecord.status || "PASSED"}
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-xs font-mono font-semibold text-slate-300">
                Abstract Content:
              </span>
              <p className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 text-xs text-slate-300 leading-relaxed max-h-48 overflow-y-auto">
                {selectedRecord.abstract}
              </p>
            </div>

            {selectedRecord.warnings && (
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-amber-300">
                <span>Warnings: {selectedRecord.warnings}</span>
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                onClick={() => setSelectedRecord(null)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-mono text-white"
              >
                Close Record
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
