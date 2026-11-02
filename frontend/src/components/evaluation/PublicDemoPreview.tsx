/**
 * components/evaluation/PublicDemoPreview.tsx
 * Static, non-sensitive demonstration evaluation preview for public visitors.
 * Lets visitors inspect how ABSTRIQ scores abstracts without requiring login.
 */

import React, { useState } from "react";
import { motion } from "motion/react";
import {
  Sparkles,
  CheckCircle,
  ShieldCheck,
  Award,
  ChevronRight,
  Quote,
  Lightbulb,
  ArrowRight,
  FileText,
  AlertCircle,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";

export const PublicDemoPreview: React.FC = () => {
  const { openAuthModal } = useAuth();
  const [selectedCriterion, setSelectedCriterion] = useState<string>("purpose");

  const sampleTitle = "SparseFlash: Dynamic Block Sparsification for Low-Latency 64k-Context LLM Inference";
  const sampleAbstract =
    "Transformer language models suffer from quadratic computational and memory complexity with respect to sequence length, creating a major performance bottleneck when processing extended documents. In this paper, we propose SparseFlash, an efficient attention mechanism that leverages dynamic block sparsification to retain salient key-value states while discarding redundant tokens during autoregressive inference. We evaluate SparseFlash across 16 tasks in LongBench on sequence lengths up to 64k tokens using Llama-3-8B. Our experiments demonstrate that SparseFlash achieves a 4.2x speedup in attention throughput and reduces peak memory consumption by 68% compared to FlashAttention-2, while retaining 98.4% of full-attention task accuracy. These findings show that dynamic block sparsification provides a scalable and practical solution for deploying 64k-context language models on commodity enterprise hardware.";

  const criteria = [
    {
      id: "purpose",
      name: "Purpose & Problem",
      score: 4,
      max: 4,
      quote:
        "Transformer language models suffer from quadratic computational and memory complexity with respect to sequence length, creating a major performance bottleneck when processing extended documents.",
      explanation:
        "Explicitly articulates the quadratic complexity limitation and states the clear objective of dynamic block sparsification.",
    },
    {
      id: "method",
      name: "Methodology & Setup",
      score: 4,
      max: 4,
      quote:
        "We evaluate SparseFlash across 16 tasks in LongBench on sequence lengths up to 64k tokens using Llama-3-8B.",
      explanation:
        "Concrete architectural framework (SparseFlash) and benchmark validation dataset (LongBench, Llama-3-8B, 64k sequence length).",
    },
    {
      id: "results",
      name: "Results & Baselines",
      score: 4,
      max: 4,
      quote:
        "Our experiments demonstrate that SparseFlash achieves a 4.2x speedup in attention throughput and reduces peak memory consumption by 68% compared to FlashAttention-2, while retaining 98.4% of full-attention task accuracy.",
      explanation:
        "Rigorous empirical quantitative findings: 4.2x speedup, 68% memory reduction, and 98.4% accuracy retention versus baseline.",
    },
    {
      id: "conclusion",
      name: "Conclusion & Scope",
      score: 3,
      max: 4,
      quote:
        "These findings show that dynamic block sparsification provides a scalable and practical solution for deploying 64k-context language models on commodity enterprise hardware.",
      explanation:
        "Clear practical significance for commodity deployment; future work and edge-case limits are omitted.",
    },
    {
      id: "clarity",
      name: "Clarity & Academic Flow",
      score: 3,
      max: 4,
      quote:
        "In this paper, we propose SparseFlash, an efficient attention mechanism that leverages dynamic block sparsification to retain salient key-value states while discarding redundant tokens during autoregressive inference.",
      explanation:
        "Excellent academic flow following Context -> Method -> Benchmark -> Contribution; ideal length of 128 words.",
    },
  ];

  const activeData = criteria.find((c) => c.id === selectedCriterion) || criteria[0];

  return (
    <div className="space-y-6">
      {/* Disclaimer Banner */}
      <div className="p-4 rounded-xl bg-cyan-950/30 border border-cyan-500/30 flex items-start sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <Sparkles className="w-5 h-5 text-cyan-400 flex-shrink-0" />
          <div className="text-xs">
            <span className="font-bold text-white font-mono">Interactive Public Demonstration</span>
            <p className="text-slate-400 text-[11px] mt-0.5">
              Explore how ABSTRIQ parses and evaluates a real computer science research abstract using static demonstration data.
            </p>
          </div>
        </div>
        <button
          onClick={() => openAuthModal("signup")}
          className="btn-neon-primary px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center space-x-1 flex-shrink-0 shadow-neon-green-sm"
        >
          <span>Evaluate Your Own</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Main Demo Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Abstract & Verbatim Highlighter (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="lab-card rounded-2xl p-6 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-mono font-bold text-slate-300">
                  Sample Abstract (128 words)
                </span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                CS &bull; Artificial Intelligence
              </span>
            </div>

            <h4 className="text-base font-bold text-white font-mono leading-snug">
              {sampleTitle}
            </h4>

            {/* Abstract with highlight */}
            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/80 text-xs text-slate-300 leading-relaxed font-sans">
              <p>
                {sampleAbstract.split(activeData.quote).map((part, i, arr) => (
                  <React.Fragment key={i}>
                    <span>{part}</span>
                    {i < arr.length - 1 && (
                      <span className="bg-emerald-500/25 text-emerald-200 border-b-2 border-emerald-400 font-medium px-0.5 rounded">
                        {activeData.quote}
                      </span>
                    )}
                  </React.Fragment>
                ))}
              </p>
            </div>

            {/* Quote Legend */}
            <div className="p-3 rounded-lg bg-emerald-950/20 border border-emerald-500/20 flex items-start space-x-2 text-[11px] text-emerald-300">
              <Quote className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
              <div>
                <strong>Verbatim Evidence Quote for {activeData.name}:</strong>
                <p className="text-slate-300 italic mt-0.5">&ldquo;{activeData.quote}&rdquo;</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Score Breakdown & Explanations (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="lab-card rounded-2xl p-6 border border-slate-800 space-y-5">
            {/* Header with Total Score */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-400 font-bold">
                  Evaluation Benchmark
                </span>
                <div className="flex items-baseline space-x-2 mt-1">
                  <span className="text-3xl font-extrabold font-mono text-white">18</span>
                  <span className="text-xs font-mono text-slate-400">/ 20 Marks</span>
                  <span className="text-xs font-mono font-bold text-emerald-400 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30">
                    Exemplary (90%)
                  </span>
                </div>
              </div>
              <Award className="w-8 h-8 text-emerald-400" />
            </div>

            {/* Criteria List */}
            <div className="space-y-2">
              <div className="text-[11px] font-mono text-slate-400">Select criterion to inspect evidence:</div>
              {criteria.map((c) => {
                const isSelected = selectedCriterion === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCriterion(c.id)}
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-mono transition-all text-left ${
                      isSelected
                        ? "bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 shadow-neon-green-sm"
                        : "bg-slate-900/60 border border-slate-800 text-slate-300 hover:border-slate-700"
                    }`}
                  >
                    <span className="truncate">{c.name}</span>
                    <span className="font-bold ml-2">
                      {c.score}/{c.max}m
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Explanation of selected criterion */}
            <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1.5 text-xs">
              <div className="font-mono text-slate-300 font-bold flex items-center space-x-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                <span>Rubric Explanation:</span>
              </div>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                {activeData.explanation}
              </p>
            </div>

            {/* Actionable Suggestion */}
            <div className="p-3.5 rounded-xl bg-purple-950/20 border border-purple-500/30 space-y-1.5 text-xs">
              <div className="font-mono text-purple-300 font-bold flex items-center space-x-1.5">
                <Lightbulb className="w-3.5 h-3.5 text-purple-400" />
                <span>Targeted Improvement:</span>
              </div>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                Include explicit boundary cases (e.g. attention degradation on needle-in-a-haystack tasks) in the conclusion to achieve the maximum 4/4 marks.
              </p>
            </div>

            {/* Sign in button inside card */}
            <button
              onClick={() => openAuthModal("signup")}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-mono font-bold flex items-center justify-center space-x-2 transition-all"
            >
              <span>Unlock Private Evaluation Studio</span>
              <ArrowRight className="w-3.5 h-3.5 text-emerald-400" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
