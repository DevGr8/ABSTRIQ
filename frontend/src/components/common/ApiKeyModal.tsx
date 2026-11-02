import React, { useState, useEffect } from "react";
import {
  Key,
  X,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Sparkles,
  RotateCcw,
  Shield,
  Zap,
  Lock,
} from "lucide-react";
import { testApiKey } from "../../services/evaluation";
import { useAuth } from "../../context/AuthContext";
import type { RuntimeConfig } from "../../types";

export interface CustomApiConfig {
  provider: string;
  apiKey: string;
  model: string;
}

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  serverConfig: RuntimeConfig | null;
  customConfig: CustomApiConfig | null;
  onSaveCustomConfig: (cfg: CustomApiConfig | null) => void;
}

const PROVIDER_DEFAULTS: Record<string, { label: string; defaultModel: string; hint: string }> = {
  inception: {
    label: "Inception Labs",
    defaultModel: "mercury-3",
    hint: "High-speed reasoning model (sk_...)",
  },
  nvidia: {
    label: "NVIDIA NIM",
    defaultModel: "mistralai/mistral-large-4-1t-a52b",
    hint: "NVIDIA API Key (nvapi-...)",
  },
  openai: {
    label: "OpenAI",
    defaultModel: "gpt-4o-mini",
    hint: "OpenAI Platform Key (sk-...)",
  },
  gemini: {
    label: "Google Gemini",
    defaultModel: "gemini-1.5-flash",
    hint: "Google AI Studio API Key (AIzaSy...)",
  },
  anthropic: {
    label: "Anthropic Claude",
    defaultModel: "claude-3-5-haiku-20241022",
    hint: "Anthropic API Key (sk-ant-...)",
  },
  mock: {
    label: "Offline MOCK Engine",
    defaultModel: "heuristic-rule-engine-v1",
    hint: "Zero-token keyword heuristic (no key required)",
  },
};

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({
  isOpen,
  onClose,
  serverConfig,
  customConfig,
  onSaveCustomConfig,
}) => {
  const { user, customKeyInfo, saveEncryptedKey, removeEncryptedKey, openAuthModal } = useAuth();

  const [provider, setProvider] = useState<string>("inception");
  const [apiKey, setApiKey] = useState<string>("");
  const [model, setModel] = useState<string>("mercury-3");
  const [showKey, setShowKey] = useState<boolean>(false);

  const [testing, setTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  useEffect(() => {
    if (customKeyInfo) {
      setProvider(customKeyInfo.provider);
      setModel(customKeyInfo.model);
      setApiKey(""); // Keep input clear, user already has masked key
    } else if (customConfig) {
      setProvider(customConfig.provider);
      setApiKey(customConfig.apiKey);
      setModel(customConfig.model);
    } else if (serverConfig) {
      setProvider(serverConfig.provider || "inception");
      setApiKey("");
      setModel(serverConfig.model || "mercury-3");
    }
    setTestResult(null);
  }, [customKeyInfo, customConfig, serverConfig, isOpen]);

  const handleProviderChange = (newProvider: string) => {
    setProvider(newProvider);
    const def = PROVIDER_DEFAULTS[newProvider];
    if (def) {
      setModel(def.defaultModel);
    }
    setTestResult(null);
  };

  const handleTestKey = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await testApiKey({
        provider,
        api_key: apiKey.trim(),
        model: model.trim() || undefined,
      });
      if (res.success) {
        setTestResult({
          success: true,
          message: res.message || "Connection verified successfully!",
        });
      } else {
        setTestResult({
          success: false,
          message: res.error || "Connection failed. Please check your credentials.",
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || "Failed to reach server test endpoint.",
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (provider === "mock") {
      if (user) {
        try {
          await saveEncryptedKey("mock", "heuristic-rule-engine-v1", "mock-key");
        } catch {}
      }
      onSaveCustomConfig({
        provider: "mock",
        apiKey: "",
        model: "heuristic-rule-engine-v1",
      });
      onClose();
      return;
    }

    if (!apiKey.trim() && !customKeyInfo?.has_key) {
      setTestResult({
        success: false,
        message: "Please enter an API key or switch to MOCK mode.",
      });
      return;
    }

    const keyToSave = apiKey.trim() || (customConfig?.apiKey || "");

    if (user && keyToSave) {
      try {
        await saveEncryptedKey(
          provider,
          model.trim() || PROVIDER_DEFAULTS[provider]?.defaultModel || "default",
          keyToSave
        );
      } catch (e: any) {
        console.error("Failed to encrypt key on server:", e);
      }
    }

    onSaveCustomConfig({
      provider,
      apiKey: keyToSave,
      model: model.trim() || PROVIDER_DEFAULTS[provider]?.defaultModel || "default",
    });
    onClose();
  };

  const handleReset = async () => {
    if (user) {
      try {
        await removeEncryptedKey();
      } catch {}
    }
    onSaveCustomConfig(null);
    setTestResult({
      success: true,
      message: "Reverted to server-side default configuration.",
    });
    setTimeout(() => {
      onClose();
    }, 600);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="lab-card rounded-2xl max-w-lg w-full p-6 border border-slate-700 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Key className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Custom API Key &amp; Provider</h3>
              <p className="text-[11px] font-mono text-slate-400">
                Configure your personal LLM credentials for evaluation
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Security Notice Pill */}
        {user ? (
          <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-between text-xs font-mono">
            <div className="flex items-center space-x-2 text-purple-300">
              <Lock className="w-4 h-4 text-purple-400" />
              <span>
                Account Security Active: Keys are encrypted at rest with AES-Fernet for{" "}
                <span className="font-bold text-purple-200">{user.username}</span>.
              </span>
            </div>
          </div>
        ) : (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-xs font-mono">
            <div className="flex items-center space-x-2 text-amber-300">
              <Shield className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <span>Guest session: Credentials held in ephemeral memory only.</span>
            </div>
            <button
              onClick={() => {
                onClose();
                openAuthModal("signup");
              }}
              className="text-[11px] underline text-amber-300 hover:text-amber-100 flex-shrink-0 ml-2"
            >
              Sign In to Save
            </button>
          </div>
        )}

        {/* If user already has a saved encrypted key, show masked badge */}
        {customKeyInfo?.has_key && (
          <div className="p-2.5 rounded-lg bg-slate-900 border border-emerald-500/30 flex items-center justify-between text-xs font-mono">
            <div className="flex items-center space-x-2 text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>
                Encrypted Key Active: <code className="text-emerald-400">{customKeyInfo.masked_key}</code> ({customKeyInfo.provider})
              </span>
            </div>
            <span className="text-[10px] text-slate-400">Replace below to update</span>
          </div>
        )}

        {/* Form Controls */}
        <div className="space-y-4 text-xs font-mono">
          {/* Provider Select */}
          <div>
            <label className="block text-slate-300 font-bold mb-1.5">1. Select LLM Provider</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {Object.entries(PROVIDER_DEFAULTS).map(([k, v]) => {
                const isSelected = provider === k;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => handleProviderChange(k)}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      isSelected
                        ? "bg-emerald-500/20 border-emerald-500/60 text-emerald-300 shadow-neon-green-sm"
                        : "bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                    }`}
                  >
                    <div className="font-bold text-xs">{v.label}</div>
                    <div className="text-[10px] opacity-75 truncate">{v.defaultModel}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* API Key Input */}
          {provider !== "mock" && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-slate-300 font-bold">2. API Secret Key</label>
                <span className="text-[10px] text-slate-500">
                  {PROVIDER_DEFAULTS[provider]?.hint}
                </span>
              </div>
              <div className="relative">
                <input
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={customKeyInfo?.has_key ? "Leave blank to keep existing key" : "Paste your API key here"}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-white"
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {/* Model Name Input */}
          <div>
            <label className="block text-slate-300 font-bold mb-1.5">3. Model Identifier</label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="e.g. mercury-3, gpt-4o, claude-3-5-sonnet"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Test Connection Button */}
          {provider !== "mock" && (
            <div className="pt-1">
              <button
                type="button"
                onClick={handleTestKey}
                disabled={testing || (!apiKey.trim() && !customKeyInfo?.has_key)}
                className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white flex items-center justify-center space-x-2 transition-colors disabled:opacity-40"
              >
                {testing ? (
                  <>
                    <Zap className="w-3.5 h-3.5 animate-pulse text-amber-400" />
                    <span>Testing Connection to {provider.toUpperCase()}...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Test Connection &amp; Latency</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Test Result Feedback */}
          {testResult && (
            <div
              className={`p-3 rounded-xl text-xs flex items-start space-x-2 border ${
                testResult.success
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                  : "bg-rose-500/10 border-rose-500/30 text-rose-300"
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5 text-emerald-400" />
              ) : (
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-400" />
              )}
              <div className="leading-relaxed">{testResult.message}</div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="border-t border-slate-800 pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleReset}
            className="text-slate-400 hover:text-rose-400 text-xs font-mono flex items-center space-x-1.5 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset to Server Default</span>
          </button>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs font-mono flex items-center space-x-1.5 shadow-neon-green-sm transition-all"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Save &amp; Apply</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
