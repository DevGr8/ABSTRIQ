/**
 * components/navigation/Sidebar.tsx
 * Sliding, collapsible sidebar navigation replacing horizontal navbar
 */

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Sparkles,
  LayoutDashboard,
  FileText,
  Search,
  History,
  BarChart3,
  BookOpen,
  Settings,
  Key,
  User,
  LogOut,
  LogIn,
  ChevronLeft,
  ChevronRight,
  Download,
  X,
  Cpu,
  ShieldCheck,
} from "lucide-react";
import type { ActivePage, RuntimeConfig } from "../../types";
import { useAuth } from "../../context/AuthContext";
import type { CustomApiConfig } from "../common/ApiKeyModal";

interface SidebarProps {
  activePage: ActivePage;
  onNavigate: (page: ActivePage) => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  config: RuntimeConfig | null;
  customConfig: CustomApiConfig | null;
  onOpenApiKeyModal: () => void;
  onDownloadExcel: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activePage,
  onNavigate,
  isMobileOpen,
  onCloseMobile,
  isCollapsed,
  onToggleCollapse,
  config,
  customConfig,
  onOpenApiKeyModal,
  onDownloadExcel,
}) => {
  const { user, logout, openAuthModal, customKeyInfo } = useAuth();

  // Keyboard accessibility: Escape closes mobile drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isMobileOpen) {
        onCloseMobile();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMobileOpen, onCloseMobile]);

  const mainItems: { id: ActivePage; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "evaluation", label: "Evaluation Studio", icon: FileText },
    { id: "research", label: "Research Discovery", icon: Search },
    { id: "history", label: "Evaluation History", icon: History },
    { id: "analytics", label: "Analytics", icon: BarChart3 },
  ];

  const workspaceItems: { id: ActivePage; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "settings", label: "Rubric & Docs", icon: BookOpen },
  ];

  const handleItemClick = (page: ActivePage) => {
    onNavigate(page);
    onCloseMobile();
  };

  const isCustomActive = Boolean(customKeyInfo?.has_key || customConfig);
  const providerDisplay = (customKeyInfo?.provider || customConfig?.provider || config?.provider || "INCEPTION").toUpperCase();

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#070b16] border-r border-slate-800 text-slate-300 font-sans select-none">
      {/* Brand Header */}
      <div className={`flex items-center ${isCollapsed ? "justify-center p-3" : "justify-between px-5 py-4"} border-b border-slate-800/80`}>
        <div
          onClick={() => handleItemClick("dashboard")}
          className="flex items-center space-x-3 cursor-pointer group"
        >
          <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/10 border border-emerald-500/40 flex items-center justify-center shadow-neon-green-sm group-hover:border-emerald-400 transition-colors flex-shrink-0">
            <Cpu className="w-5 h-5 text-emerald-400 group-hover:rotate-12 transition-transform duration-300" />
            <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping opacity-75" />
            <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400" />
          </div>

          {!isCollapsed && (
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="font-mono font-extrabold tracking-wider text-base text-white">
                  ABSTRIQ
                </span>
                <span className="text-[10px] font-mono uppercase px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  2.0
                </span>
              </div>
              <p className="text-[10px] font-mono text-slate-400 truncate max-w-[130px]">
                Research Laboratory
              </p>
            </div>
          )}
        </div>

        {/* Mobile close button */}
        <button
          onClick={onCloseMobile}
          className="md:hidden p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
          aria-label="Close navigation"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
        {/* MAIN SECTION */}
        <div>
          {!isCollapsed && (
            <div className="px-3 mb-2 text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">
              Main
            </div>
          )}
          <nav className="space-y-1">
            {mainItems.map((item) => {
              const Icon = item.icon;
              const isActive = activePage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleItemClick(item.id)}
                  title={isCollapsed ? item.label : undefined}
                  className={`w-full flex items-center ${
                    isCollapsed ? "justify-center px-0 h-11" : "space-x-3.5 pl-9 pr-3 py-2.5"
                  } rounded-xl text-xs font-mono font-medium transition-all group relative ${
                    isActive
                      ? "text-emerald-300 bg-emerald-500/15 border border-emerald-500/35 shadow-neon-green-sm"
                      : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 border border-transparent"
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 flex-shrink-0 transition-transform group-hover:scale-110 ${
                      isActive ? "text-emerald-400" : "text-slate-400 group-hover:text-slate-200"
                    }`}
                  />
                  {!isCollapsed && <span className="truncate">{item.label}</span>}

                  {/* Active Indicator Bar with generous gap */}
                  {isActive && (
                    <motion.div
                      layoutId="activeSidebarIndicator"
                      className={
                        isCollapsed
                          ? "absolute -left-3 top-2.5 bottom-2.5 w-1 rounded-r-full bg-emerald-400 shadow-neon-green-sm"
                          : "absolute left-2.5 top-2.5 bottom-2.5 w-1 rounded-full bg-emerald-400 shadow-neon-green-sm"
                      }
                    />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* WORKSPACE SECTION */}
        <div>
          {!isCollapsed && (
            <div className="px-3 mb-2 text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">
              Workspace
            </div>
          )}
          <nav className="space-y-1">
            {workspaceItems.map((item) => {
              const Icon = item.icon;
              const isActive = activePage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleItemClick(item.id)}
                  title={isCollapsed ? item.label : undefined}
                  className={`w-full flex items-center ${
                    isCollapsed ? "justify-center px-0 h-11" : "space-x-3.5 pl-9 pr-3 py-2.5"
                  } rounded-xl text-xs font-mono font-medium transition-all group relative ${
                    isActive
                      ? "text-emerald-300 bg-emerald-500/15 border border-emerald-500/35 shadow-neon-green-sm"
                      : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 border border-transparent"
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 flex-shrink-0 transition-transform group-hover:scale-110 ${
                      isActive ? "text-emerald-400" : "text-slate-400 group-hover:text-slate-200"
                    }`}
                  />
                  {!isCollapsed && <span className="truncate">{item.label}</span>}

                  {/* Active Indicator Bar */}
                  {isActive && (
                    <motion.div
                      layoutId="activeWorkspaceSidebarIndicator"
                      className={
                        isCollapsed
                          ? "absolute -left-3 top-2.5 bottom-2.5 w-1 rounded-r-full bg-emerald-400 shadow-neon-green-sm"
                          : "absolute left-2.5 top-2.5 bottom-2.5 w-1 rounded-full bg-emerald-400 shadow-neon-green-sm"
                      }
                    />
                  )}
                </button>
              );
            })}

            {/* Quick Actions in Workspace */}
            <button
              onClick={onOpenApiKeyModal}
              title={isCollapsed ? "Configure API Key" : undefined}
              className={`w-full flex items-center ${
                isCollapsed ? "justify-center px-0 h-10" : "space-x-3.5 pl-9 pr-3 py-2"
              } rounded-xl text-xs font-mono transition-all text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 border border-transparent`}
            >
              <Key className="w-4 h-4 text-purple-400 flex-shrink-0" />
              {!isCollapsed && (
                <div className="flex items-center justify-between flex-1 truncate">
                  <span>API Credentials</span>
                  {isCustomActive && (
                    <span className="text-[10px] uppercase font-bold text-purple-400 px-1.5 py-0.5 rounded bg-purple-500/10 border border-purple-500/30">
                      Custom
                    </span>
                  )}
                </div>
              )}
            </button>

            <button
              onClick={onDownloadExcel}
              title={isCollapsed ? "Download Excel" : undefined}
              className={`w-full flex items-center ${
                isCollapsed ? "justify-center px-0 h-10" : "space-x-3.5 pl-9 pr-3 py-2"
              } rounded-xl text-xs font-mono transition-all text-slate-400 hover:text-emerald-300 hover:bg-slate-800/60 border border-transparent`}
            >
              <Download className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              {!isCollapsed && <span className="truncate">Download Excel</span>}
            </button>
          </nav>
        </div>

        {/* ACCOUNT SECTION */}
        <div>
          {!isCollapsed && (
            <div className="px-3 mb-2 text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">
              Account
            </div>
          )}
          <div className="space-y-1">
            {user ? (
              <>
                <button
                  onClick={() => handleItemClick("profile")}
                  title={isCollapsed ? "User Profile" : undefined}
                  className={`w-full flex items-center ${
                    isCollapsed ? "justify-center px-0 h-11" : "space-x-3.5 pl-9 pr-3 py-2.5"
                  } rounded-xl text-xs font-mono transition-all group relative ${
                    activePage === "profile"
                      ? "text-emerald-300 bg-emerald-500/15 border border-emerald-500/35 shadow-neon-green-sm"
                      : "text-slate-300 hover:text-white hover:bg-slate-800/60 border border-transparent"
                  }`}
                >
                  <div className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-[11px] font-bold text-emerald-300 flex-shrink-0">
                    {user.username.charAt(0).toUpperCase()}
                  </div>
                  {!isCollapsed && (
                    <div className="text-left truncate">
                      <div className="font-bold text-white text-xs truncate">
                        {user.full_name || user.username}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">
                        {user.institution || user.email}
                      </div>
                    </div>
                  )}

                  {activePage === "profile" && (
                    <motion.div
                      layoutId="activeProfileSidebarIndicator"
                      className={
                        isCollapsed
                          ? "absolute -left-3 top-2.5 bottom-2.5 w-1 rounded-r-full bg-emerald-400 shadow-neon-green-sm"
                          : "absolute left-2.5 top-2.5 bottom-2.5 w-1 rounded-full bg-emerald-400 shadow-neon-green-sm"
                      }
                    />
                  )}
                </button>

                <button
                  onClick={async () => {
                    await logout();
                    onNavigate("landing");
                  }}
                  title={isCollapsed ? "Sign Out" : undefined}
                  className={`w-full flex items-center ${
                    isCollapsed ? "justify-center px-0 h-10" : "space-x-3.5 pl-9 pr-3 py-2"
                  } rounded-xl text-xs font-mono text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent transition-colors`}
                >
                  <LogOut className="w-4 h-4 flex-shrink-0" />
                  {!isCollapsed && <span>Sign Out</span>}
                </button>
              </>
            ) : (
              <button
                onClick={() => openAuthModal("login")}
                title={isCollapsed ? "Sign In" : undefined}
                className={`w-full flex items-center ${
                  isCollapsed ? "justify-center px-0 h-11" : "space-x-3.5 pl-9 pr-3 py-2.5"
                } rounded-xl text-xs font-mono font-bold text-emerald-300 bg-emerald-500/15 border border-emerald-500/40 hover:bg-emerald-500/25 shadow-neon-green-sm transition-all`}
              >
                <LogIn className="w-4 h-4 flex-shrink-0" />
                {!isCollapsed && <span>Sign In / Register</span>}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Collapse / Expand Toggle at Bottom (Desktop only) */}
      <div className="hidden md:flex border-t border-slate-800/80 p-3 items-center justify-between">
        {!isCollapsed && (
          <div className="flex items-center space-x-2 text-[10px] font-mono text-slate-400 px-1 truncate">
            <span
              className={`w-2 h-2 rounded-full ${
                isCustomActive ? "bg-purple-400" : "bg-emerald-400"
              }`}
            />
            <span className="truncate">{providerDisplay}</span>
          </div>
        )}
        <button
          onClick={onToggleCollapse}
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors mx-auto md:mx-0"
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Fixed Sliding Sidebar */}
      <aside
        className={`hidden md:block fixed top-0 left-0 bottom-0 z-40 transition-all duration-300 ease-in-out ${
          isCollapsed ? "w-20" : "w-64"
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Backdrop & Drawer */}
      <AnimatePresence>
        {isMobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={onCloseMobile}
              className="md:hidden fixed inset-0 z-50 bg-black/75 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="md:hidden fixed top-0 left-0 bottom-0 w-72 z-50 shadow-2xl"
            >
              {sidebarContent}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};
