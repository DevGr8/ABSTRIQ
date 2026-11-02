/**
 * App.tsx
 * ABSTRIQ 3.1 — Authentication-First Product Architecture & Private Workspace
 * Splits ABSTRIQ into:
 *   1. Public Website: PublicHeader + Cinematic Landing Page + Static Demo Preview + Public Docs
 *   2. Private Workspace: Sliding Sidebar + TopHeader + Dashboard + Studio + History + Analytics
 */

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { ActivePage, RuntimeConfig, SearchPaper } from "./types";
import { fetchRuntimeConfig, getDownloadUrl } from "./services/evaluation";
import { GenerativeCanvasBackground } from "./components/animations/GenerativeCanvasBackground";
import { Sidebar } from "./components/navigation/Sidebar";
import { TopHeader } from "./components/layout/TopHeader";
import { PublicHeader } from "./components/navigation/PublicHeader";
import { Footer } from "./components/layout/Footer";
import { ApiKeyModal, type CustomApiConfig } from "./components/common/ApiKeyModal";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { AuthModal } from "./components/auth/AuthModal";
import { PublicDocModal } from "./components/common/PublicDocModal";

import { LandingPage } from "./pages/LandingPage";
import { DashboardPage } from "./pages/DashboardPage";
import { EvaluationPage } from "./pages/EvaluationPage";
import { ResearchPage } from "./pages/ResearchPage";
import { HistoryPage } from "./pages/HistoryPage";
import { AnalyticsPage } from "./pages/AnalyticsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { ProfilePage } from "./pages/ProfilePage";

const PROTECTED_PAGES: ActivePage[] = [
  "dashboard",
  "evaluation",
  "research",
  "history",
  "analytics",
  "settings",
  "profile",
];

const AppContent: React.FC = () => {
  const { user, isLoading, openAuthModal } = useAuth();
  const [activePage, setActivePage] = useState<ActivePage>("landing");
  const [redirectTarget, setRedirectTarget] = useState<ActivePage | null>(null);
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);

  const [config, setConfig] = useState<RuntimeConfig | null>(null);
  const [importedPaper, setImportedPaper] = useState<SearchPaper | null>(null);
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Remember sidebar collapsed preference
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem("abstriq_sidebar_collapsed") === "true";
    } catch {
      return false;
    }
  });

  const [customConfig, setCustomConfig] = useState<CustomApiConfig | null>(() => {
    try {
      const saved = sessionStorage.getItem("abstriq_session_api_config");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const loadConfig = () => {
    fetchRuntimeConfig()
      .then((cfg) => setConfig(cfg))
      .catch((err) => console.error("Failed to load runtime config:", err));
  };

  useEffect(() => {
    loadConfig();
  }, []);

  // Sync initial URL path
  useEffect(() => {
    const path = window.location.pathname.toLowerCase();
    if (path === "/login") {
      if (user) {
        setActivePage("dashboard");
      } else {
        openAuthModal("login");
      }
    } else if (path === "/signup") {
      if (user) {
        setActivePage("dashboard");
      } else {
        openAuthModal("signup");
      }
    } else if (path === "/forgot-password") {
      openAuthModal("forgot");
    } else if (path === "/documentation" || path === "/methodology") {
      setIsDocModalOpen(true);
    } else if (path.startsWith("/app/")) {
      const pageKey = path.replace("/app/", "") as ActivePage;
      if (pageKey === "landing") {
        setActivePage("dashboard");
      } else if (PROTECTED_PAGES.includes(pageKey)) {
        if (!user && !isLoading) {
          setRedirectTarget(pageKey);
          openAuthModal("login");
        } else if (user) {
          setActivePage(pageKey);
        }
      }
    } else if (path === "/" && user && !isLoading) {
      setActivePage("dashboard");
    }
  }, [user, isLoading]);

  // URL synchronization for authenticated routes
  useEffect(() => {
    if (user && activePage !== "landing") {
      if (window.location.pathname !== `/app/${activePage}`) {
        window.history.replaceState(null, "", `/app/${activePage}`);
      }
    } else if (!user && activePage === "landing") {
      if (window.location.pathname.startsWith("/app/")) {
        window.history.replaceState(null, "", "/");
      }
    }
  }, [user, activePage]);

  // Transition to dashboard upon login if on landing or target exists
  useEffect(() => {
    if (user && !isLoading) {
      if (redirectTarget) {
        setActivePage(redirectTarget);
        setRedirectTarget(null);
      } else if (activePage === "landing") {
        setActivePage("dashboard");
      }
    }
  }, [user, isLoading]);

  // If user logs out while on a protected page, return to public landing
  useEffect(() => {
    if (!user && !isLoading && PROTECTED_PAGES.includes(activePage)) {
      setActivePage("landing");
    }
  }, [user, isLoading, activePage]);

  // Central Navigation Guard
  const handleNavigate = (page: ActivePage) => {
    if (user && page === "landing") {
      setActivePage("dashboard");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (PROTECTED_PAGES.includes(page) && !user) {
      setRedirectTarget(page);
      openAuthModal("login");
      return;
    }
    setActivePage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleToggleSidebar = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("abstriq_sidebar_collapsed", String(next));
      } catch {}
      return next;
    });
  };

  const handleSaveCustomConfig = (cfg: CustomApiConfig | null) => {
    setCustomConfig(cfg);
    if (cfg) {
      sessionStorage.setItem("abstriq_session_api_config", JSON.stringify(cfg));
    } else {
      sessionStorage.removeItem("abstriq_session_api_config");
    }
  };

  const handleDownloadExcel = () => {
    if (!user) {
      openAuthModal("login");
      return;
    }
    window.location.href = getDownloadUrl();
  };

  const handleImportToStudio = (paper: SearchPaper) => {
    setImportedPaper(paper);
    handleNavigate("evaluation");
  };

  // Determine whether to display private workspace layout
  const isPrivateWorkspace = Boolean(user && activePage !== "landing");

  // Initial Auth Loading State
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#050811] flex items-center justify-center text-slate-100 font-mono">
        <GenerativeCanvasBackground />
        <div className="text-center space-y-3 z-10">
          <div className="w-10 h-10 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto shadow-neon-green-sm" />
          <p className="text-xs text-emerald-400 tracking-wider uppercase font-bold">
            Initializing Secure Workspace...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[#050811] text-slate-100 overflow-x-hidden font-sans">
      {/* Layer 1: Generative Laboratory Canvas Background */}
      <GenerativeCanvasBackground />

      {/* Layer 2: Ambient Glowing Emerald & Cyan Light Fields */}
      <div className="fixed top-1/4 -left-32 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none animate-pulse" />
      <div className="fixed bottom-1/4 -right-32 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* RENDER PUBLIC WEBSITE OR PRIVATE WORKSPACE */}
      {isPrivateWorkspace ? (
        <>
          {/* Private Workspace Sliding Sidebar (Shown only to logged-in users) */}
          <Sidebar
            activePage={activePage}
            onNavigate={handleNavigate}
            isMobileOpen={isMobileSidebarOpen}
            onCloseMobile={() => setIsMobileSidebarOpen(false)}
            isCollapsed={isSidebarCollapsed}
            onToggleCollapse={handleToggleSidebar}
            config={config}
            customConfig={customConfig}
            onOpenApiKeyModal={() => setIsApiKeyModalOpen(true)}
            onDownloadExcel={handleDownloadExcel}
          />

          {/* Private Workspace Content Container */}
          <div
            className={`min-h-screen flex flex-col transition-all duration-300 ease-in-out ${
              isSidebarCollapsed ? "md:pl-20" : "md:pl-64"
            }`}
          >
            {/* Top Header for Private Workspace */}
            <TopHeader
              activePage={activePage}
              onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
              config={config}
              customConfig={customConfig}
              onOpenApiKeyModal={() => setIsApiKeyModalOpen(true)}
              onDownloadExcel={handleDownloadExcel}
              onNavigate={handleNavigate}
              isCollapsed={isSidebarCollapsed}
            />

            {/* Protected Workspace Content Area */}
            <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 relative z-10">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activePage}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                >
                  {activePage === "dashboard" && (
                    <DashboardPage onNavigate={handleNavigate} config={config} />
                  )}
                  {activePage === "evaluation" && (
                    <EvaluationPage
                      config={config}
                      customConfig={customConfig}
                      onRefreshConfig={loadConfig}
                      onOpenApiKeyModal={() => setIsApiKeyModalOpen(true)}
                      importedPaper={importedPaper}
                    />
                  )}
                  {activePage === "research" && (
                    <ResearchPage onImportToStudio={handleImportToStudio} />
                  )}
                  {activePage === "history" && <HistoryPage />}
                  {activePage === "analytics" && <AnalyticsPage />}
                  {activePage === "settings" && (
                    <SettingsPage
                      config={config}
                      customConfig={customConfig}
                      onOpenApiKeyModal={() => setIsApiKeyModalOpen(true)}
                    />
                  )}
                  {activePage === "profile" && (
                    <ProfilePage
                      onOpenApiKeyModal={() => setIsApiKeyModalOpen(true)}
                      onNavigateHome={() => handleNavigate("dashboard")}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            </main>

            <Footer />
          </div>
        </>
      ) : (
        /* PUBLIC WEBSITE VIEW (Landing / Public Intro / Interactive Demo) */
        <div className="min-h-screen flex flex-col w-full">
          {/* Public Header (No sidebar) */}
          <PublicHeader
            onOpenDocumentation={() => setIsDocModalOpen(true)}
            onNavigateApp={handleNavigate}
          />

          {/* Full-width Cinematic Public Landing Page */}
          <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 relative z-10">
            <LandingPage
              onNavigate={handleNavigate}
              config={config}
              onOpenDocumentation={() => setIsDocModalOpen(true)}
            />
          </main>

          <Footer />
        </div>
      )}

      {/* Custom LLM Key Configuration Modal */}
      <ApiKeyModal
        isOpen={isApiKeyModalOpen}
        onClose={() => setIsApiKeyModalOpen(false)}
        serverConfig={config}
        customConfig={customConfig}
        onSaveCustomConfig={handleSaveCustomConfig}
      />

      {/* Global Authentication Modal (Login / Signup / Forgot Password / Reset) */}
      <AuthModal />

      {/* Public Documentation Modal */}
      <PublicDocModal
        isOpen={isDocModalOpen}
        onClose={() => setIsDocModalOpen(false)}
      />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;
