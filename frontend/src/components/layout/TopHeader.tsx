/**
 * components/layout/TopHeader.tsx
 * Minimalist top header displaying section breadcrumbs, quick actions, and user status
 */

import React, { useState, useRef, useEffect } from "react";
import { Menu, Key, Download, User, LogIn, LogOut, Settings as SettingsIcon, ShieldCheck, ChevronDown } from "lucide-react";
import type { ActivePage, RuntimeConfig } from "../../types";
import { useAuth } from "../../context/AuthContext";
import type { CustomApiConfig } from "../common/ApiKeyModal";

interface TopHeaderProps {
  activePage: ActivePage;
  onOpenMobileSidebar: () => void;
  config: RuntimeConfig | null;
  customConfig: CustomApiConfig | null;
  onOpenApiKeyModal: () => void;
  onDownloadExcel: () => void;
  onNavigate: (page: ActivePage) => void;
  isCollapsed: boolean;
}

const PAGE_TITLES: Record<ActivePage, { title: string; subtitle: string }> = {
  landing: { title: "Overview", subtitle: "Computational Lab & Rubric Engine" },
  dashboard: { title: "Executive Dashboard", subtitle: "Abstract Metrics & Evaluation Statistics" },
  evaluation: { title: "Evaluation Studio", subtitle: "20-Mark Rubric Scoring & Evidence Engine" },
  research: { title: "Research Discovery", subtitle: "OpenAlex & arXiv Literature Corpus" },
  history: { title: "Evaluation History", subtitle: "Persisted Excel & SQLite Evaluation Logs" },
  analytics: { title: "Score Analytics", subtitle: "Criterion Breakdown & Distribution Graphs" },
  settings: { title: "Rubric & Docs", subtitle: "Viva Presentation Script & Guidelines" },
  profile: { title: "Researcher Profile", subtitle: "Account Settings & Encrypted Credentials" },
};

export const TopHeader: React.FC<TopHeaderProps> = ({
  activePage,
  onOpenMobileSidebar,
  config,
  customConfig,
  onOpenApiKeyModal,
  onDownloadExcel,
  onNavigate,
  isCollapsed,
}) => {
  const { user, logout, openAuthModal, customKeyInfo } = useAuth();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isCustomActive = Boolean(customKeyInfo?.has_key || customConfig);
  const activeProvider = (customKeyInfo?.provider || customConfig?.provider || config?.provider || "INCEPTION").toUpperCase();
  const activeModel = customKeyInfo?.model || customConfig?.model || config?.model || "";

  const pageInfo = PAGE_TITLES[activePage] || { title: "ABSTRIQ", subtitle: "Research Abstract Evaluator" };

  return (
    <header className="sticky top-0 z-30 w-full border-b border-slate-800/80 bg-[#050811]/85 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Left: Mobile hamburger & Breadcrumb */}
        <div className="flex items-center space-x-3">
          <button
            onClick={onOpenMobileSidebar}
            className="md:hidden p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            aria-label="Open sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-bold hidden sm:inline">
                Computational Lab /
              </span>
              <h1 className="text-sm sm:text-base font-extrabold text-white font-mono tracking-tight">
                {pageInfo.title}
              </h1>
            </div>
            <p className="text-[10px] font-mono text-slate-400 hidden md:block">
              {pageInfo.subtitle}
            </p>
          </div>
        </div>

        {/* Right: Quick Actions */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* Active LLM Provider Pill */}
          <button
            onClick={onOpenApiKeyModal}
            className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-mono border flex items-center space-x-1.5 transition-all ${
              isCustomActive
                ? "bg-purple-500/10 border-purple-500/35 text-purple-300 hover:bg-purple-500/20 shadow-sm"
                : "bg-slate-800/80 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700/80"
            }`}
            title="Configure LLM API Provider & Key"
          >
            <Key className={`w-3.5 h-3.5 ${isCustomActive ? "text-purple-400" : "text-emerald-400"}`} />
            <span className="hidden sm:inline font-bold">
              {isCustomActive ? `CUSTOM: ${activeProvider}` : activeProvider}
            </span>
            <span className="sm:hidden font-bold">{activeProvider}</span>
          </button>

          {/* Download Excel Button */}
          <button
            onClick={onDownloadExcel}
            className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-mono transition-all shadow-neon-green-sm"
            title="Download live Excel workbook (results.xlsx)"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Excel</span>
          </button>

          {/* User Account Dropdown */}
          {user ? (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-xs font-mono text-slate-200 transition-colors"
              >
                <div className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-[10px] font-bold text-emerald-300">
                  {user.username.charAt(0).toUpperCase()}
                </div>
                <span className="hidden sm:inline font-bold">{user.username}</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {/* Dropdown Menu */}
              {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-xl bg-slate-900 border border-slate-800 shadow-2xl py-2 z-50 text-xs font-mono space-y-1 animate-in fade-in slide-in-from-top-2">
                  <div className="px-3 py-2 border-b border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase tracking-wider">Signed In As</div>
                    <div className="font-bold text-white truncate">{user.email || user.username}</div>
                  </div>

                  <button
                    onClick={() => {
                      setIsDropdownOpen(false);
                      onNavigate("profile");
                    }}
                    className="w-full px-3 py-2 text-left text-slate-300 hover:text-white hover:bg-slate-800/70 flex items-center space-x-2 transition-colors"
                  >
                    <User className="w-3.5 h-3.5 text-emerald-400" />
                    <span>My Profile</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsDropdownOpen(false);
                      onNavigate("settings");
                    }}
                    className="w-full px-3 py-2 text-left text-slate-300 hover:text-white hover:bg-slate-800/70 flex items-center space-x-2 transition-colors"
                  >
                    <SettingsIcon className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Rubric &amp; Documentation</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsDropdownOpen(false);
                      onOpenApiKeyModal();
                    }}
                    className="w-full px-3 py-2 text-left text-slate-300 hover:text-white hover:bg-slate-800/70 flex items-center space-x-2 transition-colors"
                  >
                    <Key className="w-3.5 h-3.5 text-purple-400" />
                    <span>API Credentials</span>
                  </button>

                  <div className="border-t border-slate-800 pt-1">
                    <button
                      onClick={() => {
                        setIsDropdownOpen(false);
                        logout();
                      }}
                      className="w-full px-3 py-2 text-left text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 flex items-center space-x-2 transition-colors"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => openAuthModal("login")}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-mono font-bold transition-all shadow-neon-green-sm"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
