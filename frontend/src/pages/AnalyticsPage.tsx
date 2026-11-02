import React, { useState, useEffect } from "react";
import { BarChart3, TrendingUp, PieChart, Award, AlertTriangle, Layers } from "lucide-react";
import type { HistoryRecord } from "../types";
import { fetchHistory } from "../services/evaluation";

export const AnalyticsPage: React.FC = () => {
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory()
      .then((data: HistoryRecord[]) => setHistory(data))
      .catch((err: any) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const total = history.length;

  // Score tiers
  const tierExemplary = history.filter((h) => (h.total || 0) >= 16).length;
  const tierCompetent = history.filter((h) => (h.total || 0) >= 11 && (h.total || 0) <= 15).length;
  const tierFlagged = history.filter((h) => (h.total || 0) >= 6 && (h.total || 0) <= 10).length;
  const tierCritical = history.filter((h) => (h.total || 0) < 6).length;

  // Criteria averages
  const avgPurpose =
    total > 0
      ? (history.reduce((acc, h) => acc + (h.score_purpose || 0), 0) / total).toFixed(2)
      : "0.0";
  const avgMethod =
    total > 0
      ? (history.reduce((acc, h) => acc + (h.score_method || 0), 0) / total).toFixed(2)
      : "0.0";
  const avgResults =
    total > 0
      ? (history.reduce((acc, h) => acc + (h.score_results || 0), 0) / total).toFixed(2)
      : "0.0";
  const avgConclusion =
    total > 0
      ? (history.reduce((acc, h) => acc + (h.score_conclusion || 0), 0) / total).toFixed(2)
      : "0.0";
  const avgClarity =
    total > 0
      ? (history.reduce((acc, h) => acc + (h.score_clarity || 0), 0) / total).toFixed(2)
      : "0.0";

  return (
    <div className="space-y-8 py-6">
      {/* Header */}
      <div className="border-b border-slate-800 pb-5">
        <div className="text-xs font-mono uppercase tracking-widest text-purple-400">
          Empirical Insights
        </div>
        <h2 className="text-2xl font-extrabold text-white">Evaluation Analytics</h2>
        <p className="text-xs text-slate-400 mt-1">
          Statistical distribution, criteria performance patterns, and benchmark analytics.
        </p>
      </div>

      {loading ? (
        <div className="py-16 text-center text-xs font-mono text-slate-400">
          <div className="w-6 h-6 border-2 border-purple-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <span>Aggregating analytics data...</span>
        </div>
      ) : total === 0 ? (
        <div className="lab-card rounded-xl p-12 text-center text-xs font-mono text-slate-400">
          No historical evaluation data available to chart. Run evaluations in Studio to populate analytics!
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Chart 1: Score Distribution */}
          <div className="lab-card rounded-xl p-6 border border-slate-800 space-y-5">
            <h3 className="text-sm font-mono font-semibold uppercase tracking-wider text-slate-200 flex items-center space-x-2">
              <BarChart3 className="w-4 h-4 text-emerald-400" />
              <span>Score Tier Distribution ({total} Records)</span>
            </h3>

            <div className="space-y-3 font-mono text-xs">
              {/* 16-20 */}
              <div className="space-y-1">
                <div className="flex justify-between text-slate-300">
                  <span>16–20: Exemplary</span>
                  <span>
                    {tierExemplary} ({Math.round((tierExemplary / total) * 100)}%)
                  </span>
                </div>
                <div className="w-full h-3 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-emerald-400 transition-all duration-700"
                    style={{ width: `${(tierExemplary / total) * 100}%` }}
                  />
                </div>
              </div>

              {/* 11-15 */}
              <div className="space-y-1">
                <div className="flex justify-between text-slate-300">
                  <span>11–15: Competent</span>
                  <span>
                    {tierCompetent} ({Math.round((tierCompetent / total) * 100)}%)
                  </span>
                </div>
                <div className="w-full h-3 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-cyan-400 transition-all duration-700"
                    style={{ width: `${(tierCompetent / total) * 100}%` }}
                  />
                </div>
              </div>

              {/* 6-10 */}
              <div className="space-y-1">
                <div className="flex justify-between text-slate-300">
                  <span>6–10: Flagged Low Score</span>
                  <span>
                    {tierFlagged} ({Math.round((tierFlagged / total) * 100)}%)
                  </span>
                </div>
                <div className="w-full h-3 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-amber-400 transition-all duration-700"
                    style={{ width: `${(tierFlagged / total) * 100}%` }}
                  />
                </div>
              </div>

              {/* 0-5 */}
              <div className="space-y-1">
                <div className="flex justify-between text-slate-300">
                  <span>0–5: Critical Deficit</span>
                  <span>
                    {tierCritical} ({Math.round((tierCritical / total) * 100)}%)
                  </span>
                </div>
                <div className="w-full h-3 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-rose-500 transition-all duration-700"
                    style={{ width: `${(tierCritical / total) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Chart 2: Average Marks by Rubric Criterion */}
          <div className="lab-card rounded-xl p-6 border border-slate-800 space-y-5">
            <h3 className="text-sm font-mono font-semibold uppercase tracking-wider text-slate-200 flex items-center space-x-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              <span>Criteria Means (Max 4.0 Marks Each)</span>
            </h3>

            <div className="space-y-3 font-mono text-xs">
              {[
                { name: "Purpose", avg: avgPurpose, col: "bg-emerald-400" },
                { name: "Method", avg: avgMethod, col: "bg-teal-400" },
                { name: "Results", avg: avgResults, col: "bg-cyan-400" },
                { name: "Conclusion", avg: avgConclusion, col: "bg-sky-400" },
                { name: "Clarity", avg: avgClarity, col: "bg-purple-400" },
              ].map((c) => {
                const pct = (parseFloat(c.avg) / 4) * 100;
                return (
                  <div key={c.name} className="space-y-1">
                    <div className="flex justify-between text-slate-300">
                      <span>{c.name}</span>
                      <span className="font-bold text-white">
                        {c.avg} <span className="text-slate-500 font-normal">/ 4.0</span>
                      </span>
                    </div>
                    <div className="w-full h-3 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full ${c.col} transition-all duration-700`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
