"use client";

import { useCallback, useEffect, useState } from "react";
import type { SessionUser } from "./types";

const SESSION_KEY = "cnt_session";

function store(): Storage | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage;
}

export function getCurrentUser(): SessionUser | null {
  const raw = store()?.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionUser;
  } catch {
    return null;
  }
}

export function logout() {
  store()?.removeItem(SESSION_KEY);
}

function writeUser(user: SessionUser) {
  store()?.setItem(SESSION_KEY, JSON.stringify(user));
}

export function setCurrentUser(user: SessionUser) {
  writeUser(user);
}

type LoginResult = { ok: true; user: SessionUser } | { ok: false; message: string };

async function postLogin(payload: Record<string, string>): Promise<LoginResult> {
  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = (await response.json()) as { ok?: boolean; user?: SessionUser; message?: string };
    if (!response.ok || !body.ok || !body.user) {
      return { ok: false, message: body.message ?? "Credenciales inválidas." };
    }
    writeUser(body.user);
    return { ok: true, user: body.user };
  } catch {
    return { ok: false, message: "No se pudo contactar al servidor." };
  }
}

export function loginAdmin(email: string, password: string) {
  return postLogin({ mode: "admin", email, password });
}

export function loginSucursal(sucursalId: string, password: string) {
  return postLogin({ mode: "tienda", sucursalId, password });
}

export function useAuth(): { user: SessionUser | null; loading: boolean } {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setUser(getCurrentUser());
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { user, loading };
}
