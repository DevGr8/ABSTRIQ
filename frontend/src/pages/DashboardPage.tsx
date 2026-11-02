import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import {
  LayoutDashboard,
  FileText,
  CheckCircle,
  AlertTriangle,
  Clock,
  ArrowRight,
  TrendingUp,
  Database,
  Cpu,
  Download,
} from "lucide-react";
import type { ActivePage, HistoryRecord, RuntimeConfig } from "../types";
import { fetchHistory, getDownloadUrl } from "../services/evaluation";

interface DashboardPageProps {
  onNavigate: (page: ActivePage) => void;
  config: RuntimeConfig | null;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate, config }) => {
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory()
      .then((data: HistoryRecord[]) => setHistory(data))
      .catch((err: any) => console.error("History fetch error:", err))
      .finally(() => setLoading(false));
  }, []);

  const totalEvaluations = history.length;
  const avgScore =
    totalEvaluations > 0
      ? (history.reduce((acc, h) => acc + (h.total || 0), 0) / totalEvaluations).toFixed(1)
      : "N/A";
  const lowScoresCount = history.filter((h) => (h.total || 0) <= 10).length;
  const passedCount = totalEvaluations - lowScoresCount;
  const passRate = totalEvaluations > 0 ? `${Math.round((passedCount / totalEvaluations) * 100)}%` : "N/A";

  return (
    <div className="space-y-8 py-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="text-xs font-mono uppercase tracking-widest text-emerald-400">
            System Operations
          </div>
          <h2 className="text-2xl font-extrabold text-white">Evaluation Dashboard</h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time analytics, recent evaluation activity, and platform health.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => onNavigate("evaluation")}
            className="btn-neon-primary px-4 py-2.5 rounded-lg text-xs font-mono font-bold flex items-center space-x-2 shadow-neon-green-sm"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>New Evaluation</span>
          </button>
          <a
            href={getDownloadUrl()}
            download="results.xlsx"
            className="px-4 py-2.5 rounded-lg text-xs font-mono text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center space-x-2 transition-all"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>Download Excel</span>
          </a>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Evaluated */}
        <div className="lab-card rounded-xl p-5 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
            <span>Total Evaluated</span>
            <Database className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-3xl font-extrabold text-white font-mono">{totalEvaluations}</div>
          <div className="text-[11px] text-slate-400">Recorded across Excel sheets</div>
        </div>

        {/* Average Score */}
        <div className="lab-card rounded-xl p-5 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
            <span>Average Score</span>
            <TrendingUp className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-3xl font-extrabold text-cyan-300 font-mono">
            {avgScore} <span className="text-sm font-normal text-slate-500">/ 20</span>
          </div>
          <div className="text-[11px] text-slate-400">Across 5 academic criteria</div>
        </div>

        {/* Pass Rate */}
        <div className="lab-card rounded-xl p-5 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
            <span>Pass Rate (&gt;10)</span>
            <CheckCircle className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-3xl font-extrabold text-emerald-300 font-mono">{passRate}</div>
          <div className="text-[11px] text-slate-400">{passedCount} abstracts cleared threshold</div>
        </div>

        {/* Flagged Low Scores */}
        <div className="lab-card rounded-xl p-5 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
            <span>Flagged (&le;10)</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-3xl font-extrabold text-amber-300 font-mono">{lowScoresCount}</div>
          <div className="text-[11px] text-slate-400">Triggered automated notifications</div>
        </div>
      </div>

      {/* System Status & Inference Details */}
      <div className="lab-card rounded-xl p-6 border border-slate-800 space-y-4">
        <h3 className="text-sm font-mono font-semibold uppercase tracking-wider text-slate-200 flex items-center space-x-2">
          <Cpu className="w-4 h-4 text-emerald-400" />
          <span>Active Inference Pipeline Status</span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
          <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 space-y-1">
            <span className="text-slate-400">Provider &amp; Model</span>
            <div className="font-bold text-white text-sm">
              {config?.provider?.toUpperCase() || "INCEPTION"} &bull; {config?.model || "mercury-3"}
            </div>
            <div className="text-[11px] text-emerald-400">
              {config?.is_mock ? "Offline Rule Engine" : "Live High-Speed Reasoning"}
            </div>
          </div>

          <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 space-y-1">
            <span className="text-slate-400">Low Score Threshold</span>
            <div className="font-bold text-amber-300 text-sm">
              &le; {config?.low_score_threshold || 10} / 20 Marks
            </div>
            <div className="text-[11px] text-slate-400">Appends to flagged_low_scores</div>
          </div>

          <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 space-y-1">
            <span className="text-slate-400">Excel Persistence Engine</span>
            <div className="font-bold text-emerald-400 text-sm">Thread-Locked openpyxl</div>
            <div className="text-[11px] text-slate-400">3 Synchronized Worksheets</div>
          </div>
        </div>
      </div>

      {/* Recent Evaluations Table */}
      <div className="lab-card rounded-xl p-6 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-mono font-semibold uppercase tracking-wider text-slate-200 flex items-center space-x-2">
            <Clock className="w-4 h-4 text-cyan-400" />
            <span>Recent Evaluations</span>
          </h3>
          <button
            onClick={() => onNavigate("history")}
            className="text-xs font-mono text-emerald-400 hover:text-emerald-300 flex items-center space-x-1"
          >
            <span>View All Records</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {loading ? (
          <div className="py-8 text-center text-xs font-mono text-slate-400">
            <div className="w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <span>Loading evaluation records...</span>
          </div>
        ) : history.length === 0 ? (
          <div className="py-12 px-6 text-center space-y-4 rounded-xl bg-slate-900/40 border border-slate-800">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto shadow-neon-green-sm">
              <FileText className="w-6 h-6" />
            </div>
            <div className="max-w-md mx-auto space-y-1.5">
              <h4 className="text-sm font-bold text-white font-mono">
                Welcome to ABSTRIQ. Your research evaluation workspace is ready.
              </h4>
              <p className="text-xs text-slate-400 font-sans">
                You haven&apos;t run any evaluations yet. Submit your first abstract or import a paper from OpenAlex / arXiv to generate your 20-mark score card.
              </p>
            </div>
            <div className="pt-2 flex items-center justify-center space-x-3">
              <button
                onClick={() => onNavigate("evaluation")}
                className="btn-neon-primary px-4 py-2 rounded-xl text-xs font-mono font-bold flex items-center space-x-1.5 shadow-neon-green-sm"
              >
                <span>Start Your First Evaluation</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onNavigate("research")}
                className="px-4 py-2 rounded-xl text-xs font-mono font-medium text-slate-300 hover:text-white bg-slate-800 border border-slate-700 hover:bg-slate-700 transition-colors"
              >
                Explore Literature
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-[11px] uppercase">
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Title / Abstract</th>
                  <th className="py-2.5 px-3">Source</th>
                  <th className="py-2.5 px-3">Scores (P / M / R / C / Cl)</th>
                  <th className="py-2.5 px-3">Total</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {history.slice(0, 8).map((record) => {
                  const isLow = (record.total || 0) <= 10;
                  return (
                    <tr key={record.id} className="hover:bg-slate-900/50 transition-colors">
                      <td className="py-3 px-3 text-slate-400 whitespace-nowrap">
                        {record.timestamp ? record.timestamp.split("T")[0] : "—"}
                      </td>
                      <td className="py-3 px-3 max-w-xs">
                        <div className="font-semibold text-slate-200 truncate">
                          {record.title || "Untitled Abstract"}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">
                          {record.abstract}
                        </div>
                      </td>
                      <td className="py-3 px-3 uppercase text-[11px] text-cyan-400">
                        {record.source || "paste"}
                      </td>
                      <td className="py-3 px-3 text-slate-300">
                        {record.score_purpose} / {record.score_method} / {record.score_results} /{" "}
                        {record.score_conclusion} / {record.score_clarity}
                      </td>
                      <td className="py-3 px-3 font-bold">
                        <span
                          className={`px-2 py-0.5 rounded ${
                            isLow
                              ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                              : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                          }`}
                        >
                          {record.total} / 20
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full uppercase font-bold ${
                            isLow
                              ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                              : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          }`}
                        >
                          {record.status || (isLow ? "FLAGGED" : "PASSED")}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
