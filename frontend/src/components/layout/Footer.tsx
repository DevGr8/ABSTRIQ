import React from "react";
import { Cpu, ShieldCheck, Database, Layers } from "lucide-react";

export const Footer: React.FC = () => {
  return (
    <footer className="w-full border-t border-slate-800/80 bg-[#050811]/90 py-10 relative z-10 text-slate-400 text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Col 1 */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 rounded bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                <Cpu className="w-3.5 h-3.5" />
              </div>
              <span className="font-mono font-bold text-sm text-white tracking-wider">
                ABSTRIQ
              </span>
            </div>
            <p className="text-slate-400 leading-relaxed">
              Automated 20-Mark Academic Research Abstract Evaluation &amp; Improvement System.
            </p>
          </div>

          {/* Col 2 */}
          <div className="space-y-2">
            <div className="font-mono font-semibold text-slate-200 uppercase tracking-wider text-[11px]">
              Rubric Criteria (20 Marks)
            </div>
            <ul className="space-y-1 font-mono text-[11px] text-slate-400">
              <li>• Purpose (Problem, Gap, Aim) — 4m</li>
              <li>• Method (Approach, Data, Setup) — 4m</li>
              <li>• Results (Findings, Metrics, Comp) — 4m</li>
              <li>• Conclusion (Impact, Limits, Scope) — 4m</li>
              <li>• Clarity (Flow, Readability, Length) — 4m</li>
            </ul>
          </div>

          {/* Col 3 */}
          <div className="space-y-2">
            <div className="font-mono font-semibold text-slate-200 uppercase tracking-wider text-[11px]">
              System Pipeline
            </div>
            <ul className="space-y-1 font-mono text-[11px] text-slate-400">
              <li>1. Pre-Check &amp; Injection Defense</li>
              <li>2. LLM / Heuristic Multi-Prompt Scoring</li>
              <li>3. Verbatim Evidence Hallucination Guard</li>
              <li>4. Targeted Improvement Suggestion Engine</li>
              <li>5. Storage &amp; Automation Action Engine</li>
            </ul>
          </div>

          {/* Col 4 */}
          <div className="space-y-3">
            <div className="font-mono font-semibold text-slate-200 uppercase tracking-wider text-[11px]">
              Backend Integrity
            </div>
            <div className="flex items-center space-x-2 text-slate-300">
              <Database className="w-4 h-4 text-emerald-400" />
              <span>Multi-Sheet Excel Persistence</span>
            </div>
            <div className="flex items-center space-x-2 text-slate-300">
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
              <span>Low-Score (&le;10) Trigger Gate</span>
            </div>
            <div className="flex items-center space-x-2 text-slate-300">
              <Layers className="w-4 h-4 text-purple-400" />
              <span>Zero-Hallucination Evidence Matching</span>
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between text-slate-400 text-[11px]">
          <div>&copy; {new Date().getFullYear()} ABSTRIQ Research Platform. All rights reserved.</div>
          <div className="mt-2 sm:mt-0 font-mono text-slate-400">
            Powered by React 19 &bull; Three.js &bull; Flask &bull; OpenAlex &bull; arXiv
          </div>
        </div>
      </div>
    </footer>
  );
};
