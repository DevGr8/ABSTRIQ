import React, { useState } from "react";
import { motion } from "motion/react";
import { Sparkles, ArrowLeft, RefreshCw, AlertCircle, Key, Cpu, ShieldCheck, User } from "lucide-react";
import type { EvaluationResult, RuntimeConfig, SearchPaper, ProvenanceMetadata } from "../types";
import type { CustomApiConfig } from "../components/common/ApiKeyModal";
import { EvaluationForm } from "../components/evaluation/EvaluationForm";
import { EvaluationResultCard } from "../components/evaluation/EvaluationResultCard";
import { evaluateAbstract } from "../services/evaluation";
import { useAuth } from "../context/AuthContext";

interface EvaluationPageProps {
  config: RuntimeConfig | null;
  customConfig?: CustomApiConfig | null;
  onRefreshConfig: () => void;
  onOpenApiKeyModal?: () => void;
  importedPaper?: SearchPaper | null;
}

export const EvaluationPage: React.FC<EvaluationPageProps> = ({
  config,
  customConfig,
  onRefreshConfig,
  onOpenApiKeyModal,
  importedPaper,
}) => {
  const { user, customKeyInfo } = useAuth();
  const [result, setResult] = useState<EvaluationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const effectiveProvider = customKeyInfo?.provider || customConfig?.provider;
  const effectiveModel = customKeyInfo?.model || customConfig?.model;

  const handleEvaluate = async (payload: {
    abstract: string;
    title: string;
    source: string;
    prompt_version: string;
    provenance?: ProvenanceMetadata | null;
    original_abstract?: string;
  }) => {
    setIsLoading(true);
    setErrorMessage("");
    try {
      const res = await evaluateAbstract({
        ...payload,
        provider: effectiveProvider || undefined,
        model: effectiveModel || undefined,
        api_key: customConfig?.apiKey || undefined,
      });
      setResult(res);
      // Scroll smoothly to results
      window.scrollTo({ top: 400, behavior: "smooth" });
    } catch (err: any) {
      console.error("Evaluation error:", err);
      setErrorMessage(
        err.message || "Evaluation failed. Please check that the backend server is running."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8 py-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="text-xs font-mono uppercase tracking-widest text-emerald-400">
            Computational Evaluation Studio
          </div>
          <h2 className="text-2xl font-extrabold text-white">Abstract Evaluator</h2>
          <p className="text-xs text-slate-400 mt-1">
            20-mark academic rubric scoring, evidence verification, and targeted improvement engine.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {effectiveProvider ? (
            <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-mono">
              <Key className="w-3.5 h-3.5 text-purple-400" />
              <span>
                Active: <span className="font-bold uppercase">{effectiveProvider}</span> ({effectiveModel})
              </span>
              {onOpenApiKeyModal && (
                <button
                  onClick={onOpenApiKeyModal}
                  className="ml-1 text-[11px] underline hover:text-purple-200"
                >
                  Edit
                </button>
              )}
            </div>
          ) : (
            onOpenApiKeyModal && (
              <button
                onClick={onOpenApiKeyModal}
                className="px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-300 hover:text-white text-xs font-mono flex items-center space-x-1.5 transition-colors"
                title="Configure custom LLM API key"
              >
                <Key className="w-3.5 h-3.5 text-emerald-400" />
                <span>Custom API Key</span>
              </button>
            )
          )}

          {result && (
            <button
              onClick={() => setResult(null)}
              className="px-3.5 py-1.5 rounded-lg text-xs font-mono text-slate-300 hover:text-white bg-slate-800 border border-slate-700 flex items-center space-x-1.5 transition-all"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Evaluate Another</span>
            </button>
          )}
        </div>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-200 text-xs font-mono flex items-start space-x-3"
        >
          <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold text-rose-300">Evaluation Error:</span>
            <p>{errorMessage}</p>
          </div>
        </motion.div>
      )}

      {/* Input Form */}
      <EvaluationForm
        onSubmit={handleEvaluate}
        isLoading={isLoading}
        promptVersions={config?.prompt_versions || ["score_v3", "score_v2", "score_v1"]}
        defaultPrompt={config?.default_prompt || "score_v3"}
        initialPaper={importedPaper}
      />

      {/* Loading Progress State */}
      {isLoading && (
        <div className="lab-card rounded-2xl p-12 text-center border border-slate-800 space-y-4">
          <div className="relative w-16 h-16 mx-auto">
            <div className="w-16 h-16 rounded-full border-2 border-emerald-500/20 border-t-emerald-400 animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-emerald-400 animate-pulse" />
            </div>
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-mono font-bold text-white">
              Evaluating Abstract Against 20-Mark Rubric...
            </h4>
            <p className="text-xs text-slate-400 font-mono">
              Running Pre-Check &bull; Inference Scoring &bull; Verifying Verbatim Quotes &bull; Compiling Suggestions
            </p>
          </div>
        </div>
      )}

      {/* Results Display */}
      {result && !isLoading && (
        <div className="pt-4">
          <EvaluationResultCard result={result} />
        </div>
      )}
    </div>
  );
};
