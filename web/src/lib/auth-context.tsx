"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  EmailAuthProvider,
  GoogleAuthProvider,
  linkWithCredential,
  linkWithPopup,
  onAuthStateChanged,
  signInAnonymously,
  signOut,
  User,
} from "firebase/auth";

import { auth } from "./firebase";

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  isAnonymous: boolean;
  logout: () => Promise<void>;
  upgradeWithEmail: (email: string, password: string) => Promise<void>;
  upgradeWithGoogle: () => Promise<void>;
  apiFetch: <T = unknown>(path: string, options?: RequestInit) => Promise<T>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Set up auth state listener; auto-sign-in anonymously if no user
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        const idToken = await currentUser.getIdToken(true);
        setToken(idToken);
        setLoading(false);
      } else {
        // No user: automatically sign in anonymously so the core flow is never gated behind login
        try {
          await signInAnonymously(auth);
          // onAuthStateChanged will fire again with the anonymous user
        } catch (err) {
          console.error("Anonymous sign-in failed:", err);
          setUser(null);
          setToken(null);
          setLoading(false);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const isAnonymous = user?.isAnonymous ?? true;

  const logout = useCallback(async () => {
    await signOut(auth);
    // After sign-out, onAuthStateChanged fires with null, which triggers anonymous sign-in again
  }, []);

  const upgradeWithEmail = useCallback(async (email: string, password: string) => {
    if (!user) throw new Error("No user to upgrade");
    const credential = EmailAuthProvider.credential(email, password);
    const result = await linkWithCredential(user, credential);
    setUser(result.user);
    const newToken = await result.user.getIdToken(true);
    setToken(newToken);
  }, [user]);

  const upgradeWithGoogle = useCallback(async () => {
    if (!user) throw new Error("No user to upgrade");
    const provider = new GoogleAuthProvider();
    const result = await linkWithPopup(user, provider);
    setUser(result.user);
    const newToken = await result.user.getIdToken(true);
    setToken(newToken);
  }, [user]);

  const apiFetch = useCallback(async <T = unknown>(path: string, options: RequestInit = {}): Promise<T> => {
    const headers = new Headers(options.headers || {});
    headers.set("Content-Type", "application/json");

    // Retrieve active token
    let activeToken = token;
    if (user) {
      activeToken = await user.getIdToken();
      setToken(activeToken);
    }

    if (activeToken) {
      headers.set("Authorization", `Bearer ${activeToken}`);
    }

    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;

    const response = await fetch(`${baseUrl}${normalizedPath}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({ detail: "API Request Failed" }));
      throw new Error(errBody.detail || `HTTP error! status: ${response.status}`);
    }

    // Handle empty responses
    if (response.status === 204) {
      return {} as T;
    }

    return response.json() as Promise<T>;
  }, [user, token]);

  const value = useMemo(() => ({
    user,
    token,
    loading,
    isAnonymous,
    logout,
    upgradeWithEmail,
    upgradeWithGoogle,
    apiFetch,
  }), [user, token, loading, isAnonymous, logout, upgradeWithEmail, upgradeWithGoogle, apiFetch]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
