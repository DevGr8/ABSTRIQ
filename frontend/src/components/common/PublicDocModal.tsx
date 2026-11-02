/**
 * components/common/PublicDocModal.tsx
 * Public documentation viewer for unauthenticated visitors
 * Explains the 20-mark rubric, Viva presentation script, and research abstract best practices.
 */

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, BookOpen, CheckCircle, Award, ShieldAlert, Cpu, ArrowRight } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

interface PublicDocModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PublicDocModal: React.FC<PublicDocModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<"rubric" | "pipeline" | "viva">("rubric");
  const { openAuthModal } = useAuth();

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-4xl max-h-[85vh] flex flex-col rounded-2xl bg-[#090d1a] border border-emerald-500/30 shadow-2xl overflow-hidden font-sans text-slate-200"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/60">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white font-mono">
                  ABSTRIQ Public Documentation
                </h3>
                <p className="text-xs text-slate-400 font-mono">
                  Academic 20-Mark Rubric Specifications &amp; Defense Methodology
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-800 px-6 bg-slate-950/40">
            <button
              onClick={() => setActiveTab("rubric")}
              className={`py-3 px-4 text-xs font-mono font-medium border-b-2 transition-colors ${
                activeTab === "rubric"
                  ? "border-emerald-400 text-emerald-300"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              20-Mark Rubric Matrix
            </button>
            <button
              onClick={() => setActiveTab("pipeline")}
              className={`py-3 px-4 text-xs font-mono font-medium border-b-2 transition-colors ${
                activeTab === "pipeline"
                  ? "border-emerald-400 text-emerald-300"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              5-Stage Evaluation Pipeline
            </button>
            <button
              onClick={() => setActiveTab("viva")}
              className={`py-3 px-4 text-xs font-mono font-medium border-b-2 transition-colors ${
                activeTab === "viva"
                  ? "border-emerald-400 text-emerald-300"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              Viva Presentation Script
            </button>
          </div>

          {/* Content Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs text-slate-300 leading-relaxed font-sans">
            {activeTab === "rubric" && (
              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-bold text-white font-mono mb-2">
                    Evaluation Matrix (5 Criteria &times; 0–4 Marks = 20 Max Marks)
                  </h4>
                  <p className="text-slate-400">
                    Each abstract submitted to ABSTRIQ is parsed into sentence nodes and measured against five orthogonal criteria grounded in peer review standards:
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white font-mono">1. Purpose (Problem &amp; Aim)</span>
                      <span className="text-emerald-400 font-mono font-bold">4 Marks</span>
                    </div>
                    <p className="text-slate-400 text-[11px]">
                      Measures explicit articulation of the research problem, identification of literature gaps, and stated primary objective.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white font-mono">2. Methodology (Data &amp; Setup)</span>
                      <span className="text-emerald-400 font-mono font-bold">4 Marks</span>
                    </div>
                    <p className="text-slate-400 text-[11px]">
                      Concrete description of proposed algorithm, network architecture, benchmark datasets, and validation framework.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white font-mono">3. Results (Quantitative Metrics)</span>
                      <span className="text-emerald-400 font-mono font-bold">4 Marks</span>
                    </div>
                    <p className="text-slate-400 text-[11px]">
                      Empirical evidence reporting numerical findings, baseline comparisons, speedup ratios, accuracy, or p-values.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white font-mono">4. Conclusion (Significance &amp; Limits)</span>
                      <span className="text-emerald-400 font-mono font-bold">4 Marks</span>
                    </div>
                    <p className="text-slate-400 text-[11px]">
                      Main scholarly contribution, practical or theoretical implications, and future research directions or constraints.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2 md:col-span-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white font-mono">5. Clarity (Flow, Readability &amp; Length)</span>
                      <span className="text-emerald-400 font-mono font-bold">4 Marks</span>
                    </div>
                    <p className="text-slate-400 text-[11px]">
                      Academic flow (Context &rarr; Method &rarr; Result &rarr; Impact), readable tone, and adherence to standard length (~120–250 words).
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "pipeline" && (
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-white font-mono mb-2">
                  5-Stage Deterministic Evaluation Pipeline
                </h4>
                <div className="space-y-3 font-mono text-xs">
                  <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 flex items-start space-x-3">
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold">Stage 1</span>
                    <div>
                      <div className="font-bold text-white">Input Pre-Check &amp; Sanitization</div>
                      <div className="text-slate-400 text-[11px]">Rejects &lt; 40 words, flags prompt injection attacks, checks word count.</div>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 flex items-start space-x-3">
                    <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-400 font-bold">Stage 2</span>
                    <div>
                      <div className="font-bold text-white">Verbatim Evidence Extraction</div>
                      <div className="text-slate-400 text-[11px]">Extracts verbatim sentence quotes and verifies presence in original text to eliminate hallucination.</div>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 flex items-start space-x-3">
                    <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-400 font-bold">Stage 3</span>
                    <div>
                      <div className="font-bold text-white">Rubric Matrix Scoring (0–20 Marks)</div>
                      <div className="text-slate-400 text-[11px]">Computes criteria marks against rubric levels with fallback to deterministic heuristic.</div>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 flex items-start space-x-3">
                    <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 font-bold">Stage 4</span>
                    <div>
                      <div className="font-bold text-white">Targeted Constructive Feedback</div>
                      <div className="text-slate-400 text-[11px]">Generates actionable suggestions to help the author elevate scores to 4/4 marks.</div>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 flex items-start space-x-3">
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold">Stage 5</span>
                    <div>
                      <div className="font-bold text-white">Multi-User Encrypted Storage &amp; Reporting</div>
                      <div className="text-slate-400 text-[11px]">Persists under users/{'{'}uid{'}'}/evaluations in Firestore and dynamic user-isolated Excel.</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "viva" && (
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-white font-mono mb-2">
                  Viva Presentation &amp; Defense Briefing
                </h4>
                <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3 text-xs text-slate-300">
                  <p>
                    <strong className="text-emerald-400 font-mono">Q: Why not use a simple one-shot LLM prompt?</strong><br />
                    A: Standard LLMs hallucinate non-existent empirical findings and offer arbitrary grades. ABSTRIQ decouples evaluation into a deterministic 5-stage pipeline, enforcing sentence-level verbatim quote matching and 100% mathematical rubric consistency.
                  </p>
                  <p>
                    <strong className="text-emerald-400 font-mono">Q: How is user data isolated?</strong><br />
                    A: Evaluations are partitioned in Cloud Firestore under <code className="text-cyan-300">users/{'{'}uid{'}'}/evaluations</code> using cryptographically verified Firebase ID tokens. User A cannot access User B&apos;s records. Custom API keys are encrypted at rest with AES-Fernet.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Footer Call to Action */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-950/80">
            <span className="text-xs text-slate-400 font-mono">
              Ready to evaluate research papers in your private workspace?
            </span>
            <button
              onClick={() => {
                onClose();
                openAuthModal("signup");
              }}
              className="btn-neon-primary px-4 py-2 rounded-xl text-xs font-mono font-bold flex items-center space-x-1.5 shadow-neon-green-sm"
            >
              <span>Create Free Account</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
