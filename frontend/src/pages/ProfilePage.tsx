/**
 * pages/ProfilePage.tsx
 * User profile management, password updates, and encrypted API key controls
 */

import React, { useState } from "react";
import { motion } from "motion/react";
import {
  User,
  Mail,
  Building,
  Key,
  Lock,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  LogOut,
  Save,
  RotateCcw,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import * as authService from "../services/auth";

interface ProfilePageProps {
  onOpenApiKeyModal: () => void;
  onNavigateHome: () => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({
  onOpenApiKeyModal,
  onNavigateHome,
}) => {
  const { user, customKeyInfo, logout, refreshMe, removeEncryptedKey, openAuthModal } = useAuth();

  const [fullName, setFullName] = useState(user?.full_name || "");
  const [institution, setInstitution] = useState(user?.institution || "");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState("");
  const [profileError, setProfileError] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdSuccess, setPwdSuccess] = useState("");
  const [pwdError, setPwdError] = useState("");

  if (!user) {
    return (
      <div className="py-16 text-center space-y-4 lab-card rounded-2xl p-8 border border-slate-800">
        <User className="w-12 h-12 text-slate-500 mx-auto" />
        <h3 className="text-lg font-bold text-white font-mono">Sign In to View Profile</h3>
        <p className="text-xs text-slate-400 font-mono max-w-md mx-auto">
          Sign in to manage your researcher profile, view your isolated evaluation history, and configure encrypted API credentials.
        </p>
        <button
          onClick={() => openAuthModal("login")}
          className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold font-mono text-xs shadow-neon-green-sm"
        >
          Sign In / Create Account
        </button>
      </div>
    );
  }

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileSuccess("");
    setProfileError("");
    try {
      const res = await authService.updateProfile({
        full_name: fullName,
        institution,
      });
      setProfileSuccess(res.message || "Profile updated successfully!");
      await refreshMe();
    } catch (err: any) {
      setProfileError(err.message || "Failed to update profile.");
    } finally {
      setProfileSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdSuccess("");
    setPwdError("");

    if (newPassword !== confirmPassword) {
      setPwdError("New password and confirmation do not match.");
      return;
    }

    setPwdSaving(true);
    try {
      const res = await authService.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      setPwdSuccess(res.message || "Password updated successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setPwdError(err.message || "Failed to change password.");
    } finally {
      setPwdSaving(false);
    }
  };

  return (
    <div className="space-y-8 py-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="text-xs font-mono uppercase tracking-widest text-emerald-400">
            Account &amp; Security Management
          </div>
          <h2 className="text-2xl font-extrabold text-white">Researcher Profile</h2>
          <p className="text-xs text-slate-400 mt-1">
            Personal identity, account settings, and encrypted LLM credentials.
          </p>
        </div>

        <button
          onClick={async () => {
            await logout();
            onNavigateHome();
          }}
          className="self-start sm:self-auto px-4 py-2 rounded-xl text-xs font-mono text-rose-300 hover:text-white bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 flex items-center space-x-2 transition-all"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Profile Card */}
        <div className="space-y-6">
          <div className="lab-card rounded-2xl p-6 border border-slate-800 space-y-4">
            <div className="flex items-center space-x-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/10 border border-emerald-500/40 flex items-center justify-center text-xl font-bold text-emerald-300 font-mono shadow-neon-green-sm">
                {user.username.charAt(0).toUpperCase()}
              </div>
              <div>
                <h3 className="text-lg font-bold text-white font-mono">{user.username}</h3>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {user.role}
                </span>
              </div>
            </div>

            <div className="border-t border-slate-800 pt-3 space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between text-slate-400">
                <span>Email:</span>
                <span className="text-slate-200">{user.email}</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Account ID:</span>
                <span className="text-slate-200">#USR-{user.id}</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Registered:</span>
                <span className="text-slate-200">
                  {new Date(user.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          {/* Encrypted API Key Card */}
          <div className="lab-card rounded-2xl p-6 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-white flex items-center space-x-2">
                <Key className="w-4 h-4 text-purple-400" />
                <span>Custom API Key</span>
              </h4>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/30">
                AES-Fernet
              </span>
            </div>

            <p className="text-xs text-slate-400 font-mono">
              Your credentials are encrypted at rest with user-derived salts and never shared with other users.
            </p>

            {customKeyInfo?.has_key ? (
              <div className="p-3.5 rounded-xl bg-slate-900 border border-purple-500/30 space-y-2 text-xs font-mono">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Provider:</span>
                  <span className="text-purple-300 font-bold uppercase">{customKeyInfo.provider}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Model:</span>
                  <span className="text-white">{customKeyInfo.model}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Key:</span>
                  <code className="text-emerald-400">{customKeyInfo.masked_key}</code>
                </div>
              </div>
            ) : (
              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 text-xs font-mono text-slate-400">
                Using default server Inception Labs credentials.
              </div>
            )}

            <div className="flex items-center space-x-2 pt-1">
              <button
                onClick={onOpenApiKeyModal}
                className="flex-1 py-2 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/40 text-purple-200 text-xs font-mono font-bold transition-colors"
              >
                {customKeyInfo?.has_key ? "Update Credentials" : "Configure Custom Key"}
              </button>

              {customKeyInfo?.has_key && (
                <button
                  onClick={async () => {
                    await removeEncryptedKey();
                  }}
                  title="Remove custom key and revert to server default"
                  className="p-2 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 border border-slate-700 transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right Columns: Edit Profile & Password */}
        <div className="lg:col-span-2 space-y-6">
          {/* Edit Profile Form */}
          <div className="lab-card rounded-2xl p-6 border border-slate-800 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center space-x-2">
              <User className="w-5 h-5 text-emerald-400" />
              <span>Personal &amp; Academic Information</span>
            </h3>

            {profileSuccess && (
              <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-200 text-xs font-mono flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>{profileSuccess}</span>
              </div>
            )}

            {profileError && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-200 text-xs font-mono flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                <span>{profileError}</span>
              </div>
            )}

            <form onSubmit={handleUpdateProfile} className="space-y-4 text-xs font-mono">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-slate-300 block">Full Name</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Dr. Jane Doe"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 focus:border-emerald-500 text-white placeholder-slate-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-300 block">Institution / Affiliation</label>
                  <input
                    type="text"
                    value={institution}
                    onChange={(e) => setInstitution(e.target.value)}
                    placeholder="e.g. Department of AI, Tech University"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 focus:border-emerald-500 text-white placeholder-slate-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={profileSaving}
                  className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold font-mono text-xs flex items-center space-x-1.5 shadow-neon-green-sm transition-all disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{profileSaving ? "Saving..." : "Save Profile"}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Change Password Form */}
          <div className="lab-card rounded-2xl p-6 border border-slate-800 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center space-x-2">
              <Lock className="w-5 h-5 text-cyan-400" />
              <span>Change Account Password</span>
            </h3>

            {pwdSuccess && (
              <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-200 text-xs font-mono flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>{pwdSuccess}</span>
              </div>
            )}

            {pwdError && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-200 text-xs font-mono flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                <span>{pwdError}</span>
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-4 text-xs font-mono">
              <div className="space-y-1.5">
                <label className="text-slate-300 block">Current Password</label>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 focus:border-emerald-500 text-white placeholder-slate-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-slate-300 block">New Password (min 6 chars)</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 focus:border-emerald-500 text-white placeholder-slate-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-300 block">Confirm New Password</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 focus:border-emerald-500 text-white placeholder-slate-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={pwdSaving}
                  className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold font-mono text-xs flex items-center space-x-1.5 transition-all disabled:opacity-50"
                >
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>{pwdSaving ? "Updating..." : "Update Password"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
