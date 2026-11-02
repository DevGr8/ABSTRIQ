import React, { useState } from "react";
import { motion } from "motion/react";
import {
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  FileCheck,
  ChevronDown,
  ChevronUp,
  Code2,
  Clock,
  Sparkles,
} from "lucide-react";
import type { EvaluationResult } from "../../types";
import { ScoreMeter } from "../charts/ScoreMeter";
import { CriteriaBreakdown } from "../charts/CriteriaBreakdown";

interface EvaluationResultCardProps {
  result: EvaluationResult;
}

export const EvaluationResultCard: React.FC<EvaluationResultCardProps> = ({ result }) => {
  const [showJson, setShowJson] = useState(false);
  const [openSuggestions, setOpenSuggestions] = useState<Record<number, boolean>>({ 0: true });

  const toggleSuggestion = (idx: number) => {
    setOpenSuggestions((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const isLowScore = (result.total_score || 0) <= 10;
  const isInjection = result.injection_detected || false;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="space-y-6"
    >
      {/* Prompt Injection Alert */}
      {isInjection && (
        <div className="p-4 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-200 flex items-start space-x-3 shadow-lg">
          <ShieldAlert className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <h4 className="font-mono font-bold text-sm text-rose-300">
              Security Warning: Prompt Injection Attempt Detected
            </h4>
            <p className="leading-relaxed">
              Adversarial directives attempting to override scoring instructions were detected and neutralised. Scores are strictly capped based on standard academic criteria.
            </p>
          </div>
        </div>
      )}

      {/* Low Score Automation Alert */}
      {isLowScore && (
        <div className="p-4 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-200 flex items-start space-x-3 shadow-lg">
          <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <h4 className="font-mono font-bold text-sm text-amber-300">
              Automated Alert: Score &le; 10/20 Threshold Triggered
            </h4>
            <p className="leading-relaxed">
              This abstract has been recorded in the <code className="bg-amber-950/60 px-1 py-0.5 rounded text-amber-300">flagged_low_scores</code> sheet in Excel for revision, and an automated event was dispatched to the system log.
            </p>
          </div>
        </div>
      )}

      {/* Main Score & Diagnostic Card */}
      <div className="lab-card rounded-2xl p-6 border border-slate-800 space-y-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-6 border-b border-slate-800/80">
          {/* Left: Score Gauge */}
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <ScoreMeter score={result.total_score} maxScore={result.max_score || 20} size={150} />

            <div className="text-center sm:text-left space-y-2">
              <div className="text-[10px] font-mono uppercase tracking-widest text-emerald-400">
                Evaluation Report Card
              </div>
              <h3 className="text-lg font-bold text-white leading-tight">
                {result.title || "Untitled Research Abstract"}
              </h3>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 text-xs font-mono text-slate-400">
                <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700">
                  {result.word_count || 0} words
                </span>
                <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700">
                  Prompt: {result.prompt_version || "score_v3"}
                </span>
                {result.llm && (
                  <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    {result.llm.provider.toUpperCase()} ({result.llm.model})
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right: Latency & Meta */}
          <div className="flex flex-col items-end space-y-2 font-mono text-xs text-slate-400">
            <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-900/90 border border-slate-800">
              <Clock className="w-3.5 h-3.5 text-emerald-400" />
              <span>Elapsed: {result.elapsed_seconds?.toFixed(2) || "0.00"}s</span>
            </div>
            {result.run_id && (
              <span className="text-[11px] text-slate-400">
                ID: <span className="text-slate-300">{result.run_id}</span>
              </span>
            )}
            <button
              onClick={() => setShowJson(!showJson)}
              className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center space-x-1 transition-colors pt-1"
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>{showJson ? "Hide Raw JSON" : "View Raw JSON"}</span>
            </button>
          </div>
        </div>

        {/* Criteria Breakdown Visualizer */}
        <div className="space-y-2">
          <h4 className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-300">
            Rubric Criteria Breakdown
          </h4>
          <CriteriaBreakdown scores={result.scores} />
        </div>

        {/* Warnings list if any */}
        {result.warnings && result.warnings.length > 0 && (
          <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 space-y-1 text-xs font-mono">
            <div className="text-amber-400 font-semibold flex items-center space-x-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Validation Notes:</span>
            </div>
            {result.warnings.map((warn, i) => (
              <p key={i} className="text-slate-400 pl-4">
                &bull; {warn}
              </p>
            ))}
          </div>
        )}
      </div>

      {/* Detailed Rubric Cards (5 Criteria) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-mono font-semibold uppercase tracking-wider text-slate-200 flex items-center space-x-2">
            <FileCheck className="w-4 h-4 text-emerald-400" />
            <span>Rubric Details &amp; Evidence Quotes</span>
          </h4>
          <span className="text-xs text-slate-400 font-mono">5 Criteria &times; 4 Marks</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(result.scores).map(([key, data]) => {
            const hasVerbatimEvidence = data.evidence && data.evidence.toLowerCase() !== "not found";
            return (
              <div
                key={key}
                className="lab-card rounded-xl p-4 border border-slate-800/90 space-y-3 flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-slate-100 capitalize">
                      {data.title || key}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${
                        data.score >= 4
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                          : data.score === 3
                          ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                          : data.score === 2
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                          : "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                      }`}
                    >
                      {data.score} / {data.max || 4}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed font-sans">
                    {data.reason}
                  </p>
                </div>

                {/* Evidence Quote Pill */}
                <div className="pt-2 border-t border-slate-800/80 text-[11px] font-mono">
                  <div className="flex items-center justify-between mb-1 text-slate-400">
                    <span>Evidence Quote:</span>
                    {hasVerbatimEvidence && (
                      <span
                        className={`text-[10px] flex items-center space-x-1 ${
                          data.evidence_found ? "text-emerald-400" : "text-amber-400"
                        }`}
                      >
                        {data.evidence_found ? (
                          <>
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Matched in Abstract</span>
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="w-3 h-3" />
                            <span>Unmatched</span>
                          </>
                        )}
                      </span>
                    )}
                  </div>
                  <div className="p-2 rounded bg-slate-900/90 border border-slate-800 text-slate-300 italic">
                    &ldquo;{data.evidence || "Not found in abstract."}&rdquo;
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Targeted Improvement Suggestions (For items <= 2) */}
      {result.suggestions && result.suggestions.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <Lightbulb className="w-4 h-4 text-emerald-400" />
            <h4 className="text-sm font-mono font-semibold uppercase tracking-wider text-slate-200">
              Targeted Improvement Recommendations ({result.suggestions.length})
            </h4>
          </div>

          <div className="space-y-3">
            {result.suggestions.map((sug, idx) => {
              const isOpen = openSuggestions[idx] ?? false;
              return (
                <div
                  key={idx}
                  className="lab-card rounded-xl border border-slate-800 overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => toggleSuggestion(idx)}
                    className="w-full p-4 text-left flex items-center justify-between bg-slate-900/60 hover:bg-slate-900 transition-colors"
                  >
                    <div className="flex items-center space-x-2.5">
                      <span className="w-2 h-2 rounded-full bg-amber-400" />
                      <span className="font-semibold text-xs capitalize text-slate-100 font-mono">
                        {sug.item} Criterion Weakness
                      </span>
                    </div>
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                  </button>

                  {isOpen && (
                    <div className="p-4 pt-2 border-t border-slate-800/80 space-y-2 text-xs">
                      <div>
                        <span className="font-mono text-slate-400 uppercase text-[10px]">
                          Diagnostic Issue:
                        </span>
                        <p className="text-slate-300 mt-0.5 leading-relaxed">{sug.issue}</p>
                      </div>

                      <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
                        <span className="font-mono text-emerald-400 uppercase text-[10px] font-bold block mb-1">
                          Recommended Actionable Fix:
                        </span>
                        <p className="leading-relaxed font-sans">{sug.fix}</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Raw JSON Inspector Modal/Block */}
      {showJson && (
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs overflow-x-auto text-emerald-300 max-h-96">
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </motion.div>
  );
};
