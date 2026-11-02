/**
 * components/auth/AuthModal.tsx
 * Multi-tab authentication dialog for Signup, Login, Forgot Password, and Reset Password
 */

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Lock,
  Mail,
  User,
  Building,
  KeyRound,
  Eye,
  EyeOff,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { useAuth, type AuthModalTab } from "../../context/AuthContext";
import * as authService from "../../services/auth";

export const AuthModal: React.FC = () => {
  const { isAuthModalOpen, authModalTab, closeAuthModal, setAuthModalTab, login, signup } = useAuth();

  // Form states
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [institution, setInstitution] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    setErrorMessage("");
    setSuccessMessage("");
    setShowPassword(false);
  }, [authModalTab, isAuthModalOpen]);

  if (!isAuthModalOpen) return null;

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage("");
    try {
      await login({ identifier: username || email, password });
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to log in. Please check your credentials.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage("");
    try {
      await signup({
        email,
        username,
        password,
        full_name: fullName,
        institution,
      });
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to create account.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const res = await authService.forgotPassword(email);
      setSuccessMessage(res.message);
      if (res.reset_token) {
        // Pre-fill reset token and switch tab for user convenience
        setResetToken(res.reset_token);
        setSuccessMessage("Password reset token generated! Please enter your new password below.");
        setAuthModalTab("reset");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to request password reset.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage("");
    try {
      const res = await authService.resetPassword({ token: resetToken, new_password: newPassword });
      setSuccessMessage(res.message);
      setTimeout(() => {
        setAuthModalTab("login");
        setSuccessMessage("Password reset complete. Please log in with your new password.");
      }, 1500);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to reset password.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2 }}
        className="relative w-full max-w-md rounded-2xl bg-[#090d1a] border border-slate-700/80 shadow-2xl overflow-hidden p-6 sm:p-8"
      >
        {/* Glow accent */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={closeAuthModal}
          className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/10 border border-emerald-500/40 flex items-center justify-center shadow-neon-green-sm">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-white font-mono tracking-tight">
              {authModalTab === "login" && "Sign In to ABSTRIQ"}
              {authModalTab === "signup" && "Create Researcher Account"}
              {authModalTab === "forgot" && "Reset Password"}
              {authModalTab === "reset" && "Set New Password"}
            </h2>
            <p className="text-xs text-slate-400 font-mono">
              Academic Computational Evaluation System
            </p>
          </div>
        </div>

        {/* Tab Switcher (Login / Signup) */}
        {(authModalTab === "login" || authModalTab === "signup") && (
          <div className="flex rounded-lg bg-slate-900/90 p-1 border border-slate-800 mb-6">
            <button
              type="button"
              onClick={() => setAuthModalTab("login")}
              className={`flex-1 py-1.5 text-xs font-mono font-medium rounded-md transition-all ${
                authModalTab === "login"
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setAuthModalTab("signup")}
              className={`flex-1 py-1.5 text-xs font-mono font-medium rounded-md transition-all ${
                authModalTab === "signup"
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Register
            </button>
          </div>
        )}

        {/* Feedback Banners */}
        {errorMessage && (
          <div className="mb-5 p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-200 text-xs font-mono flex items-start space-x-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
            <p>{errorMessage}</p>
          </div>
        )}

        {successMessage && (
          <div className="mb-5 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-200 text-xs font-mono flex items-start space-x-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            <p>{successMessage}</p>
          </div>
        )}

        {/* TAB: LOGIN */}
        {authModalTab === "login" && (
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-mono text-slate-300 block">Email or Username</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="researcher@university.edu"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 focus:border-emerald-500 text-xs font-mono text-white placeholder-slate-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-mono text-slate-300 block">Password</label>
                <button
                  type="button"
                  onClick={() => setAuthModalTab("forgot")}
                  className="text-[11px] font-mono text-emerald-400 hover:underline"
                >
                  Forgot?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;"
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-900 border border-slate-700 focus:border-emerald-500 text-xs font-mono text-white placeholder-slate-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-2 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold font-mono text-xs flex items-center justify-center space-x-2 transition-all shadow-neon-green-sm disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>Authenticating...</span>
              ) : (
                <>
                  <span>Sign In to Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        {/* TAB: SIGNUP */}
        {authModalTab === "signup" && (
          <form onSubmit={handleSignupSubmit} className="space-y-3.5">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-mono text-slate-300 block">Username *</label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="dr_alice"
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 focus:border-emerald-500 text-xs font-mono text-white placeholder-slate-500 focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-mono text-slate-300 block">Full Name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Dr. Alice Smith"
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 focus:border-emerald-500 text-xs font-mono text-white placeholder-slate-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-mono text-slate-300 block">Academic Email *</label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="alice@stanford.edu"
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-700 focus:border-emerald-500 text-xs font-mono text-white placeholder-slate-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-mono text-slate-300 block">Institution / Department</label>
              <div className="relative">
                <Building className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={institution}
                  onChange={(e) => setInstitution(e.target.value)}
                  placeholder="Computer Science Dept."
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-700 focus:border-emerald-500 text-xs font-mono text-white placeholder-slate-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-mono text-slate-300 block">Password (min 6 chars) *</label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;"
                  className="w-full pl-9 pr-10 py-2 rounded-xl bg-slate-900 border border-slate-700 focus:border-emerald-500 text-xs font-mono text-white placeholder-slate-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-3 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:opacity-90 text-slate-950 font-bold font-mono text-xs flex items-center justify-center space-x-2 transition-all shadow-neon-green-sm disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>Registering Account...</span>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-slate-950" />
                  <span>Create Account</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* TAB: FORGOT PASSWORD */}
        {authModalTab === "forgot" && (
          <form onSubmit={handleForgotSubmit} className="space-y-4">
            <p className="text-xs text-slate-400 font-mono">
              Enter your registered academic email address. We will generate a secure reset token for your account.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-mono text-slate-300 block">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="researcher@lab.edu"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 focus:border-emerald-500 text-xs font-mono text-white placeholder-slate-500 focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold font-mono text-xs flex items-center justify-center space-x-2 transition-all shadow-neon-green-sm disabled:opacity-50"
            >
              {isSubmitting ? <span>Generating Token...</span> : <span>Send Reset Token</span>}
            </button>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setAuthModalTab("login")}
                className="text-xs font-mono text-slate-400 hover:text-white underline"
              >
                Back to Sign In
              </button>
              <button
                type="button"
                onClick={() => setAuthModalTab("reset")}
                className="text-xs font-mono text-cyan-400 hover:underline"
              >
                Have a reset token?
              </button>
            </div>
          </form>
        )}

        {/* TAB: RESET PASSWORD */}
        {authModalTab === "reset" && (
          <form onSubmit={handleResetSubmit} className="space-y-4">
            <p className="text-xs text-slate-400 font-mono">
              Provide your single-use reset token and choose a new password.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-mono text-slate-300 block">Reset Token</label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  required
                  value={resetToken}
                  onChange={(e) => setResetToken(e.target.value)}
                  placeholder="Paste reset token here"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 focus:border-emerald-500 text-xs font-mono text-white placeholder-slate-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono text-slate-300 block">New Password (min 6 chars)</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;"
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-900 border border-slate-700 focus:border-emerald-500 text-xs font-mono text-white placeholder-slate-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold font-mono text-xs flex items-center justify-center space-x-2 transition-all shadow-neon-green-sm disabled:opacity-50"
            >
              {isSubmitting ? <span>Updating Password...</span> : <span>Confirm New Password</span>}
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => setAuthModalTab("login")}
                className="text-xs font-mono text-slate-400 hover:text-white underline"
              >
                Back to Sign In
              </button>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  );
};
