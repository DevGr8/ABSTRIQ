/**
 * components/navigation/PublicHeader.tsx
 * Public website header for unauthenticated visitors
 * Adheres to ABSTRIQ 3.1 specification:
 * Logo, Product, Features, Evaluation Methodology, Documentation, Sign In, Get Started.
 */

import React from "react";
import { Cpu, ArrowRight, BookOpen, Sparkles, FileCheck, Layers } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import type { ActivePage } from "../../types";

interface PublicHeaderProps {
  onNavigateSection?: (sectionId: string) => void;
  onOpenDocumentation?: () => void;
  onNavigateApp?: (page: ActivePage) => void;
}

export const PublicHeader: React.FC<PublicHeaderProps> = ({
  onNavigateSection,
  onOpenDocumentation,
  onNavigateApp,
}) => {
  const { openAuthModal } = useAuth();

  const handleNavClick = (sectionId: string) => {
    if (onNavigateSection) {
      onNavigateSection(sectionId);
    } else {
      const el = document.getElementById(sectionId);
      if (el) {
        el.scrollIntoView({ behavior: "smooth" });
      }
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-[#050811]/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
        {/* Brand Logo */}
        <div
          onClick={() => handleNavClick("hero")}
          className="flex items-center space-x-3 cursor-pointer group select-none"
        >
          <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/10 border border-emerald-500/40 flex items-center justify-center shadow-neon-green-sm group-hover:border-emerald-400 transition-colors flex-shrink-0">
            <Cpu className="w-5 h-5 text-emerald-400 group-hover:rotate-12 transition-transform duration-300" />
            <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping opacity-75" />
            <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-mono font-extrabold tracking-wider text-base text-white">
                ABSTRIQ
              </span>
              <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                LABS
              </span>
            </div>
            <p className="text-[10px] font-mono text-slate-400 hidden sm:block">
              Academic Abstract Evaluator
            </p>
          </div>
        </div>

        {/* Public Navigation Links */}
        <nav className="hidden md:flex items-center space-x-6 text-xs font-mono font-medium text-slate-300">
          <button
            onClick={() => handleNavClick("product")}
            className="hover:text-emerald-400 transition-colors"
          >
            Product
          </button>
          <button
            onClick={() => handleNavClick("features")}
            className="hover:text-emerald-400 transition-colors"
          >
            Features
          </button>
          <button
            onClick={() => handleNavClick("methodology")}
            className="hover:text-emerald-400 transition-colors"
          >
            Evaluation Methodology
          </button>
          <button
            onClick={() => handleNavClick("demo")}
            className="hover:text-emerald-400 transition-colors text-cyan-300 flex items-center space-x-1"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>Interactive Demo</span>
          </button>
          <button
            onClick={onOpenDocumentation}
            className="hover:text-emerald-400 transition-colors flex items-center space-x-1"
          >
            <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
            <span>Documentation</span>
          </button>
        </nav>

        {/* Action Buttons: Sign In & Get Started */}
        <div className="flex items-center space-x-3">
          <button
            onClick={() => openAuthModal("login")}
            className="px-4 py-2 rounded-xl text-xs font-mono font-medium text-slate-300 hover:text-white hover:bg-slate-800/80 border border-slate-700/80 transition-all"
          >
            Sign In
          </button>
          <button
            onClick={() => openAuthModal("signup")}
            className="btn-neon-primary px-4 py-2 rounded-xl text-xs font-mono font-bold flex items-center space-x-1.5 shadow-neon-green-sm"
          >
            <span>Get Started</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
};
