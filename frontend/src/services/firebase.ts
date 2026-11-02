/**
 * services/firebase.ts
 * Firebase Client SDK Initialization & Authentication Helper
 * Adheres to ABSTRIQ 3.0 specification: Email/Password only.
 */

import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  onAuthStateChanged,
  updateProfile,
  User as FirebaseUser,
  Auth,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDummyDevKeyForAbstriqTesting001",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "abstriq-evaluator.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "abstriq-evaluator",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "abstriq-evaluator.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "1029384756",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:1029384756:web:abstriq123",
};

export const app: FirebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth: Auth = getAuth(app);

/**
 * Register with email and password
 */
export async function registerWithFirebase(email: string, password: string,displayName?: string): Promise<FirebaseUser> {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  if (displayName && cred.user) {
    try {
      await updateProfile(cred.user, { displayName });
    } catch {
      // ignore non-fatal profile update failure
    }
  }
  // Send email verification
  try {
    await sendEmailVerification(cred.user);
  } catch (e) {
    console.warn("Email verification send note:", e);
  }
  return cred.user;
}

/**
 * Login with email and password
 */
export async function loginWithFirebase(email: string, password: string): Promise<FirebaseUser> {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

/**
 * Logout
 */
export async function logoutFromFirebase(): Promise<void> {
  await fbSignOut(auth);
}

/**
 * Send password reset email
 */
export async function requestPasswordReset(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email);
}

/**
 * Trigger email verification
 */
export async function triggerEmailVerification(): Promise<void> {
  if (auth.currentUser) {
    await sendEmailVerification(auth.currentUser);
  }
}

/**
 * Get current ID token (cryptographically fresh)
 */
export async function getFreshFirebaseToken(): Promise<string | null> {
  if (!auth.currentUser) return null;
  return await auth.currentUser.getIdToken(true);
}
