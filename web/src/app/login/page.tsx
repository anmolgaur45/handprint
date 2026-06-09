"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import { Eye, EyeOff, Leaf, Lock, Mail, ShieldAlert, UserPlus } from "lucide-react";

import { useAuth } from "@/lib/auth-context";
import { auth } from "@/lib/firebase";

export default function LoginPage() {
  const router = useRouter();
  const { user, loading, isAnonymous, upgradeWithEmail, upgradeWithGoogle } = useAuth();

  const [isSignUp, setIsSignUp] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-50">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          <p className="text-sm text-zinc-400">Loading Handprint...</p>
        </div>
      </div>
    );
  }

  // If user is signed in (non-anonymous), redirect to dashboard
  if (user && !isAnonymous) {
    router.push("/");
    return null;
  }

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");

    if (!email || !password) {
      setAuthError("Please fill in all fields.");
      return;
    }

    if (password.length < 6) {
      setAuthError("Password must be at least 6 characters.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (isAnonymous && isSignUp) {
        // Upgrade anonymous account by linking email/password credentials
        if (password !== confirmPassword) {
          setAuthError("Passwords do not match.");
          setIsSubmitting(false);
          return;
        }
        await upgradeWithEmail(email, password);
        router.push("/");
      } else if (isSignUp) {
        // Fresh sign-up (shouldn't happen since we auto-anon, but handle gracefully)
        if (password !== confirmPassword) {
          setAuthError("Passwords do not match.");
          setIsSubmitting(false);
          return;
        }
        await createUserWithEmailAndPassword(auth, email, password);
        router.push("/");
      } else {
        // Sign in to existing account
        await signInWithEmailAndPassword(auth, email, password);
        router.push("/");
      }
    } catch (err: unknown) {
      console.error(err);
      const error = err as { code?: string; message?: string };
      let friendlyMessage = error.message || "An error occurred";
      if (
        error.code === "auth/user-not-found" ||
        error.code === "auth/wrong-password" ||
        error.code === "auth/invalid-credential"
      ) {
        friendlyMessage = "Invalid email or password.";
      } else if (error.code === "auth/email-already-in-use") {
        friendlyMessage = "This email is already registered. Try signing in instead.";
      } else if (error.code === "auth/invalid-email") {
        friendlyMessage = "Please enter a valid email address.";
      } else if (error.code === "auth/credential-already-in-use") {
        friendlyMessage = "This credential is already linked to another account. Try signing in.";
      }
      setAuthError(friendlyMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleAuth = async () => {
    setAuthError("");
    setIsSubmitting(true);
    try {
      if (isAnonymous) {
        await upgradeWithGoogle();
      } else {
        const { signInWithPopup } = await import("firebase/auth");
        const provider = new GoogleAuthProvider();
        await signInWithPopup(auth, provider);
      }
      router.push("/");
    } catch (err: unknown) {
      console.error(err);
      const error = err as { code?: string; message?: string };
      if (error.code !== "auth/popup-closed-by-user") {
        let msg = error.message || "Failed to sign in with Google.";
        if (error.code === "auth/credential-already-in-use") {
          msg = "This Google account is already linked to another user. Try signing in directly.";
        }
        setAuthError(msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-zinc-950 px-4 text-zinc-50">
      {/* Background ambient glows */}
      <div className="absolute top-1/4 left-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/10 pointer-events-none blur-3xl" />
      <div className="absolute bottom-1/4 left-1/3 h-80 w-80 rounded-full bg-teal-500/5 pointer-events-none blur-3xl" />

      <div className="z-10 w-full max-w-md">
        {/* Brand Header */}
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mb-4 shadow-inner">
            <Leaf className="h-6 w-6" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-zinc-50 via-zinc-100 to-emerald-400 bg-clip-text text-transparent">
            Handprint
          </h1>
          {isAnonymous ? (
            <div className="mt-3 space-y-1">
              <div className="inline-flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-3 py-1">
                <UserPlus className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-xs font-semibold text-emerald-400">Save your progress</span>
              </div>
              <p className="text-sm text-zinc-400">
                You are using Handprint as a guest. Create an account to keep your data across devices.
              </p>
            </div>
          ) : (
            <p className="mt-2 text-sm text-zinc-400">
              {isSignUp
                ? "Create an account to start tracking and reducing your footprint"
                : "Sign in to access your dashboard and committed actions"}
            </p>
          )}
        </div>

        {/* Card Body */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 backdrop-blur-xl p-8 shadow-2xl shadow-emerald-950/5">
          <form onSubmit={handleEmailAuth} className="space-y-5">
            {authError && (
              <div role="alert" className="flex items-center gap-3 rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
                <ShieldAlert className="h-5 w-5 shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            {/* Email Input */}
            <div className="space-y-1.5">
              <label htmlFor="login-email" className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <input
                  id="login-email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950/60 py-2.5 pl-11 pr-4 text-sm text-zinc-100 placeholder-zinc-600 transition focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
                  required
                  aria-describedby="login-email-hint"
                />
              </div>
              <p id="login-email-hint" className="text-[10px] text-zinc-600">Your email will not be shared.</p>
            </div>

            {/* Password Input */}
            <div className="space-y-1.5">
              <label htmlFor="login-password" className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950/60 py-2.5 pl-11 pr-11 text-sm text-zinc-100 placeholder-zinc-600 transition focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
                  required
                  aria-describedby="login-password-hint"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute top-1/2 right-3 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 focus:outline-none"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p id="login-password-hint" className="text-[10px] text-zinc-600">Minimum 6 characters.</p>
            </div>

            {/* Confirm Password Input (only on signup) */}
            {isSignUp && (
              <div className="space-y-1.5">
                <label htmlFor="login-confirm-password" className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                  <input
                    id="login-confirm-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950/60 py-2.5 pl-11 pr-4 text-sm text-zinc-100 placeholder-zinc-600 transition focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
                    required={isSignUp}
                  />
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex w-full items-center justify-center rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-zinc-50 transition hover:bg-emerald-500 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-50 cursor-pointer shadow-lg shadow-emerald-700/10"
            >
              {isSubmitting ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-50 border-t-transparent" />
              ) : isAnonymous && isSignUp ? (
                "Save My Account"
              ) : isSignUp ? (
                "Create Account"
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="my-6 flex items-center justify-between">
            <span className="h-px w-[40%] bg-zinc-800" />
            <span className="text-xs text-zinc-500 font-medium uppercase tracking-wider">or</span>
            <span className="h-px w-[40%] bg-zinc-800" />
          </div>

          {/* Google Auth Button */}
          <button
            onClick={handleGoogleAuth}
            type="button"
            disabled={isSubmitting}
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-zinc-800 bg-zinc-950/40 py-3 text-sm font-medium text-zinc-200 transition hover:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-700 disabled:opacity-50 cursor-pointer"
          >
            {/* Google Icon */}
            <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12.24 10.285V13.4h6.887C18.2 15.614 15.645 18 12.24 18c-3.86 0-7-3.14-7-7s3.14-7 7-7c1.706 0 3.257.614 4.471 1.628l2.457-2.457C17.387 1.706 14.996 1 12.24 1 6.643 1 2 5.643 2 11.24s4.643 10.24 10.24 10.24c5.795 0 10.24-4.11 10.24-10.24 0-.685-.062-1.354-.185-1.955H12.24z" />
            </svg>
            <span>{isAnonymous ? "Save with Google" : "Continue with Google"}</span>
          </button>
        </div>

        {/* Toggle Mode + Skip */}
        <div className="mt-6 space-y-3 text-center">
          <p className="text-sm text-zinc-500">
            {isSignUp ? "Already have an account?" : "Need an account?"}{" "}
            <button
              onClick={() => {
                setIsSignUp(!isSignUp);
                setAuthError("");
              }}
              type="button"
              className="font-semibold text-emerald-400 hover:text-emerald-300 transition focus:outline-none"
            >
              {isSignUp ? "Sign In" : "Create one now"}
            </button>
          </p>

          {isAnonymous && (
            <Link
              href="/"
              className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition"
            >
              <span>Continue as guest</span>
              <span aria-hidden="true">&rarr;</span>
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}
