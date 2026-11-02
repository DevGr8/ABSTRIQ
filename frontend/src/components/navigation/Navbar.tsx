import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Cpu,
  FileText,
  Search,
  History,
  BarChart3,
  BookOpen,
  Download,
  Menu,
  X,
  Sparkles,
  LayoutDashboard,
  CheckCircle2,
  AlertTriangle,
  Key,
} from "lucide-react";
import type { ActivePage, RuntimeConfig } from "../../types";
import type { CustomApiConfig } from "../common/ApiKeyModal";

interface NavbarProps {
  activePage: ActivePage;
  onNavigate: (page: ActivePage) => void;
  config: RuntimeConfig | null;
  customConfig: CustomApiConfig | null;
  onDownloadExcel: () => void;
  onOpenApiKeyModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activePage,
  onNavigate,
  config,
  customConfig,
  onDownloadExcel,
  onOpenApiKeyModal,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems: { id: ActivePage; label: string; icon: React.ReactNode }[] = [
    { id: "landing", label: "Overview", icon: <Sparkles className="w-4 h-4" /> },
    { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: "evaluation", label: "Studio", icon: <FileText className="w-4 h-4" /> },
    { id: "research", label: "Research", icon: <Search className="w-4 h-4" /> },
    { id: "history", label: "History", icon: <History className="w-4 h-4" /> },
    { id: "analytics", label: "Analytics", icon: <BarChart3 className="w-4 h-4" /> },
    { id: "settings", label: "Rubric & Docs", icon: <BookOpen className="w-4 h-4" /> },
  ];

  const isCustom = !!customConfig;
  const isMock = customConfig ? customConfig.provider === "mock" : (config?.is_mock ?? true);
  const providerLabel = (customConfig ? customConfig.provider : (config?.provider || "INCEPTION")).toUpperCase();
  const modelLabel = customConfig ? customConfig.model : (config?.model || "");

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-800/80 bg-[#050811]/85 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand / Logo */}
        <div
          onClick={() => onNavigate("landing")}
          className="flex items-center space-x-3 cursor-pointer group select-none"
        >
          <div className="relative w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500/20 to-cyan-500/10 border border-emerald-500/40 flex items-center justify-center shadow-neon-green-sm group-hover:border-emerald-400 transition-colors">
            <Cpu className="w-5 h-5 text-emerald-400 group-hover:rotate-12 transition-transform duration-300" />
            <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping opacity-75" />
            <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="font-mono font-bold tracking-wider text-lg text-white">
                ABSTRIQ
              </span>
              <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                v2.0
              </span>
            </div>
            <p className="text-[10px] font-mono text-slate-400 hidden sm:block">
              Computational Abstract Evaluator
            </p>
          </div>
        </div>

        {/* Desktop Nav Items */}
        <nav className="hidden md:flex items-center space-x-1">
          {navItems.map((item) => {
            const isActive = activePage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`relative px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center space-x-2 ${
                  isActive
                    ? "text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 shadow-neon-green-sm"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent"
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
                {isActive && (
                  <motion.div
                    layoutId="activeNavIndicator"
                    className="absolute inset-0 rounded-lg border border-emerald-400/40 -z-10"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Right Actions: Provider Status + Download */}
        <div className="hidden lg:flex items-center space-x-3">
          {/* Active Provider Pill (Click to open API config modal) */}
          <button
            type="button"
            onClick={onOpenApiKeyModal}
            className={`px-2.5 py-1 rounded-full text-xs font-mono flex items-center space-x-1.5 border transition-all hover:scale-105 cursor-pointer ${
              isMock
                ? "bg-amber-500/10 text-amber-300 border-amber-500/30 hover:border-amber-400"
                : isCustom
                ? "bg-purple-500/15 text-purple-300 border-purple-500/40 shadow-sm hover:border-purple-300"
                : "bg-emerald-500/10 text-emerald-300 border-emerald-500/30 shadow-neon-green-sm hover:border-emerald-400"
            }`}
            title="Click to configure custom LLM API key & model"
          >
            {isMock ? (
              <>
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                <span>MOCK ({modelLabel || "engine"})</span>
              </>
            ) : (
              <>
                <span className={`w-2 h-2 rounded-full ${isCustom ? "bg-purple-400" : "bg-emerald-400"} animate-pulse`} />
                <span className="font-semibold">{isCustom ? "CUSTOM: " : ""}{providerLabel}</span>
                <span className="text-slate-400 text-[11px]">({modelLabel})</span>
              </>
            )}
          </button>

          {/* Custom Key Button */}
          <button
            onClick={onOpenApiKeyModal}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium border transition-all ${
              isCustom
                ? "bg-purple-500/20 text-purple-200 border-purple-500/40 shadow-sm"
                : "text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 border-slate-700 hover:border-slate-500"
            }`}
            title="Configure your own API key"
          >
            <Key className="w-3.5 h-3.5 text-emerald-400" />
            <span>{isCustom ? "Key Set ✓" : "API Key"}</span>
          </button>

          {/* Download Excel Button */}
          <button
            onClick={onDownloadExcel}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 hover:border-slate-500 transition-all shadow-sm"
            title="Download results.xlsx workbook with all sheets"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>Excel</span>
          </button>
        </div>

        {/* Mobile menu toggle */}
        <div className="flex md:hidden items-center space-x-2">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg bg-slate-800/80 border border-slate-700 text-slate-300 hover:text-white"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-b border-slate-800 bg-[#070b16] px-4 pt-2 pb-4 space-y-1"
          >
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  onNavigate(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium ${
                  activePage === item.id
                    ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/30"
                    : "text-slate-300 hover:bg-slate-800"
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}

            <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
              <div className="text-xs font-mono text-emerald-400 flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>{providerLabel}</span>
              </div>
              <button
                onClick={() => {
                  onDownloadExcel();
                  setMobileMenuOpen(false);
                }}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs bg-slate-800 border border-slate-700 text-slate-200"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span>Download Excel</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};
