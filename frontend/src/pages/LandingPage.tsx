/**
 * pages/LandingPage.tsx
 * Public Landing Page & Product Overview
 * Adheres to ABSTRIQ 3.1 specification:
 * - Public cinematic hero with generative 3D research visualization
 * - Key product capabilities & 5-criteria rubric framework
 * - 5-Stage deterministic evaluation pipeline
 * - Interactive static sample demonstration preview (no login required)
 * - Final call to action
 */

import React from "react";
import { motion } from "motion/react";
import {
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Cpu,
  FileCheck2,
  Database,
  Search,
  CheckCircle,
  BarChart,
  Lightbulb,
  Layers,
  Lock,
  FileSpreadsheet,
  Award,
} from "lucide-react";
import { HeroResearchScene } from "../components/animations/HeroResearchScene";
import { PublicDemoPreview } from "../components/evaluation/PublicDemoPreview";
import type { ActivePage, RuntimeConfig } from "../types";
import { useAuth } from "../context/AuthContext";

interface LandingPageProps {
  onNavigate: (page: ActivePage) => void;
  config: RuntimeConfig | null;
  onOpenDocumentation?: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onNavigate,
  config,
  onOpenDocumentation,
}) => {
  const { user, openAuthModal } = useAuth();
  const providerLabel = config?.provider?.toUpperCase() || "INCEPTION";
  const modelLabel = config?.model || "mercury-3";

  return (
    <div className="space-y-28 py-6 select-none font-sans">
      {/* 1. HERO SECTION */}
      <section id="hero" className="relative min-h-[78vh] flex flex-col lg:flex-row items-center justify-between gap-12 pt-4">
        {/* Left Column: Headlines & Primary CTA */}
        <div className="w-full lg:w-1/2 space-y-6 z-10 text-center lg:text-left">
          {/* Status Badge */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono shadow-neon-green-sm"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Academic Rubric Engine:</span>
            <span className="font-bold text-white">20-Mark Scale</span>
            <span className="text-slate-400">(v3.0 Strict)</span>
          </motion.div>

          {/* Main Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight leading-[1.12]"
          >
            Computational{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400">
              Research Abstract
            </span>{" "}
            Evaluator
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-slate-300 text-base sm:text-lg max-w-xl mx-auto lg:mx-0 leading-relaxed font-sans"
          >
            Rigorous automated peer-review evaluation for Computer Science &amp; AI research abstracts. Enforces a 20-mark rubric, binds sentence-level verbatim evidence, protects against model hallucination, and maintains private encrypted research workspaces.
          </motion.p>

          {/* Call to Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-wrap items-center justify-center lg:justify-start gap-4 pt-2"
          >
            {user ? (
              <button
                onClick={() => onNavigate("dashboard")}
                className="btn-neon-primary px-6 py-3.5 rounded-xl font-mono text-sm tracking-wide font-bold flex items-center space-x-2 shadow-neon-green"
              >
                <span>Enter Your Private Workspace</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <>
                <button
                  onClick={() => openAuthModal("signup")}
                  className="btn-neon-primary px-6 py-3.5 rounded-xl font-mono text-sm tracking-wide font-bold flex items-center space-x-2 shadow-neon-green"
                >
                  <span>Get Started — Free Account</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  onClick={() => {
                    const el = document.getElementById("demo");
                    if (el) el.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="px-6 py-3.5 rounded-xl font-mono text-sm font-semibold text-slate-300 hover:text-white bg-slate-900/80 hover:bg-slate-800 border border-slate-700 hover:border-slate-500 transition-all flex items-center space-x-2 shadow-sm"
                >
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  <span>View Sample Demo</span>
                </button>
              </>
            )}
          </motion.div>

          {/* Micro Trust Stats */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.4 }}
            className="pt-6 grid grid-cols-3 gap-4 border-t border-slate-800/80 text-left max-w-lg mx-auto lg:mx-0"
          >
            <div>
              <div className="font-mono text-xl font-bold text-white">20 Marks</div>
              <div className="text-[11px] font-mono text-slate-400">5 Rubric Criteria</div>
            </div>
            <div>
              <div className="font-mono text-xl font-bold text-emerald-400">Verbatim Quotes</div>
              <div className="text-[11px] font-mono text-slate-400">0% Hallucination</div>
            </div>
            <div>
              <div className="font-mono text-xl font-bold text-cyan-400">Multi-User</div>
              <div className="text-[11px] font-mono text-slate-400">Encrypted Isolation</div>
            </div>
          </motion.div>
        </div>

        {/* Right Column: 3D Animated Generative Research Scene */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.9, ease: "easeOut" }}
          className="w-full lg:w-1/2 h-[420px] sm:h-[480px] relative flex items-center justify-center"
        >
          <HeroResearchScene className="w-full h-full" />
        </motion.div>
      </section>

      {/* 2. PRODUCT & CAPABILITIES SECTION */}
      <section id="product" className="space-y-12">
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <h2 className="text-xs font-mono uppercase tracking-widest text-emerald-400 font-semibold">
            Product Architecture
          </h2>
          <h3 className="text-3xl font-extrabold text-white">
            Transforming Abstract Evaluation with Computational Rigor
          </h3>
          <p className="text-xs text-slate-400 font-mono">
            Traditional AI evaluation relies on loose prompts that hallucinate non-existent empirical claims. ABSTRIQ replaces subjective scoring with a deterministic 5-stage benchmark.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="lab-card lab-card-interactive rounded-2xl p-6 border border-slate-800 space-y-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-neon-green-sm">
              <FileCheck2 className="w-6 h-6" />
            </div>
            <h4 className="text-base font-bold text-white font-mono">20-Mark Rubric Standard</h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              Every abstract is graded against 5 academic criteria (Purpose, Method, Results, Conclusion, Clarity) across 4 qualitative levels (0 to 4 marks), yielding an objective score out of 20.
            </p>
          </div>

          <div className="lab-card lab-card-interactive rounded-2xl p-6 border border-slate-800 space-y-4">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h4 className="text-base font-bold text-white font-mono">Verbatim Evidence Matching</h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              Every awarded mark is backed by an exact verbatim sentence quote extracted from the paper. The system programmatically checks sentence presence to ensure zero hallucination.
            </p>
          </div>

          <div className="lab-card lab-card-interactive rounded-2xl p-6 border border-slate-800 space-y-4">
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Lock className="w-6 h-6" />
            </div>
            <h4 className="text-base font-bold text-white font-mono">Multi-User Private Workspaces</h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              Evaluations, history, dashboard analytics, and custom API credentials are authenticated through Firebase and encrypted with AES-Fernet. User A can never see User B records.
            </p>
          </div>
        </div>
      </section>

      {/* 3. EVALUATION METHODOLOGY (5-STAGE PIPELINE) */}
      <section id="methodology" className="lab-card rounded-2xl p-8 border border-slate-800 space-y-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-mono uppercase tracking-widest text-emerald-400 font-semibold">
              Evaluation Methodology
            </span>
            <h3 className="text-2xl font-bold text-white mt-1">
              5-Stage Evaluation &amp; Verification Pipeline
            </h3>
            <p className="text-xs text-slate-400 font-mono mt-1">
              Deterministic academic processing workflow ensuring reproducible scores
            </p>
          </div>
          <button
            onClick={onOpenDocumentation}
            className="px-4 py-2 rounded-lg text-xs font-mono font-medium text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 transition-all flex items-center space-x-1.5"
          >
            <span>Read Rubric Specs</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            {
              stage: "01",
              name: "Input Pre-Check",
              desc: "Rejects text < 40 words, flags adversarial prompt injections, and verifies academic structure.",
            },
            {
              stage: "02",
              name: "Evidence Extraction",
              desc: "Extracts sentence-level verbatim quotes for each rubric dimension and validates presence in source text.",
            },
            {
              stage: "03",
              name: "Rubric Scoring",
              desc: "Applies 0–4 scoring levels across Purpose, Method, Results, Conclusion, and Clarity to compute total /20.",
            },
            {
              stage: "04",
              name: "Targeted Feedback",
              desc: "Generates constructive recommendations to guide the researcher toward maximum score achievement.",
            },
            {
              stage: "05",
              name: "Encrypted Storage",
              desc: "Stores in Cloud Firestore users/{uid}/evaluations and generates dynamic user-isolated Excel reports.",
            },
          ].map((item, idx) => (
            <div key={idx} className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2 relative group hover:border-emerald-500/40 transition-colors">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-emerald-400">
                  STAGE {item.stage}
                </span>
                <span className="w-2 h-2 rounded-full bg-slate-700 group-hover:bg-emerald-400 transition-colors" />
              </div>
              <h5 className="font-bold text-sm text-white font-mono">{item.name}</h5>
              <p className="text-[11px] text-slate-400 leading-relaxed font-sans">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 4. RUBRIC MATRIX BREAKDOWN */}
      <section id="features" className="space-y-6">
        <div className="text-center space-y-2 max-w-xl mx-auto">
          <h3 className="text-2xl font-bold text-white">Standard 20-Mark Rubric Matrix</h3>
          <p className="text-xs text-slate-400 font-mono">
            5 Criteria &bull; 0–4 Scale Levels &bull; 20 Maximum Points
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            { name: "Purpose", max: 4, desc: "Problem articulation, literature gap, explicit research aim." },
            { name: "Method", max: 4, desc: "Algorithm, architecture, dataset, and experimental setup." },
            { name: "Results", max: 4, desc: "Quantitative metrics, baseline comparisons, speedup/accuracy." },
            { name: "Conclusion", max: 4, desc: "Main contribution, practical implications, future scope." },
            { name: "Clarity", max: 4, desc: "Academic flow (Context -> Method -> Result -> Impact), 120-250w." },
          ].map((item, idx) => (
            <div key={idx} className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm text-slate-200">{item.name}</span>
                <span className="font-mono text-xs font-bold text-emerald-400">/{item.max}m</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 5. INTERACTIVE SAMPLE EVALUATION DEMONSTRATION */}
      <section id="demo" className="space-y-6 pt-4">
        <div className="text-center space-y-2 max-w-2xl mx-auto">
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-mono">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Interactive Demonstration</span>
          </div>
          <h3 className="text-3xl font-extrabold text-white">
            Inspect a Live Abstract Evaluation
          </h3>
          <p className="text-xs text-slate-400 font-mono">
            Experience the ABSTRIQ rubric evaluation interface on a peer-reviewed CS abstract using static demonstration data.
          </p>
        </div>

        {/* Interactive Demo Preview Widget */}
        <PublicDemoPreview />
      </section>

      {/* 6. FINAL SIGNUP CALL TO ACTION BANNER */}
      <section className="lab-card rounded-3xl p-10 sm:p-14 border border-emerald-500/40 bg-gradient-to-br from-emerald-950/40 via-slate-950/80 to-[#050811] text-center space-y-6 relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-2xl mx-auto space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto shadow-neon-green-sm">
            <Award className="w-7 h-7" />
          </div>
          <h3 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Elevate Your Academic Research Abstracts
          </h3>
          <p className="text-sm text-slate-300 font-sans leading-relaxed">
            Create your free account today to access the full Evaluation Studio, OpenAlex &amp; arXiv literature corpus, personal evaluation history, and dynamic Excel audit reports.
          </p>
          <div className="pt-2 flex flex-wrap items-center justify-center gap-4">
            <button
              onClick={() => openAuthModal("signup")}
              className="btn-neon-primary px-8 py-4 rounded-xl font-mono text-sm tracking-wide font-bold flex items-center space-x-2 shadow-neon-green"
            >
              <span>Create Your Free Workspace</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => openAuthModal("login")}
              className="px-6 py-4 rounded-xl font-mono text-sm font-semibold text-slate-300 hover:text-white bg-slate-900/80 hover:bg-slate-800 border border-slate-700 transition-all"
            >
              Sign In to Existing Account
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
