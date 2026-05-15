import React, { createContext, useContext, useEffect, useState } from "react";
import { api, ApiError, setToken } from "./api";
import { User } from "./types";

interface LoginResult {
  user?: User;
  needsTotp?: boolean;
}

interface AuthCtx {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string, totpCode?: string) => Promise<LoginResult>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>(null as any);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      const me = await api<User>("/api/auth/me");
      setUser(me);
    } catch {
      setUser(null);
    }
  }

  useEffect(() => {
    const tok = localStorage.getItem("redland_token");
    if (!tok) {
      setLoading(false);
      return;
    }
    refresh().finally(() => setLoading(false));
  }, []);

  async function login(username: string, password: string, totpCode?: string): Promise<LoginResult> {
    try {
      const res = await api<{ token: string; user: User } | { needsTotp: true }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password, totpCode }),
      });
      if ((res as any).needsTotp) {
        return { needsTotp: true };
      }
      const ok = res as { token: string; user: User };
      setToken(ok.token);
      setUser(ok.user);
      return { user: ok.user };
    } catch (e: any) {
      // 206 (needs TOTP) comes through API client as success, but if the host
      // returns it as an error, surface the flag here too.
      if (e instanceof ApiError && e.body?.needsTotp) return { needsTotp: true };
      throw e;
    }
  }

  function logout() {
    setToken(null);
    setUser(null);
    window.location.href = "/login";
  }

  return (
    <Ctx.Provider value={{ user, loading, login, logout, refresh }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
