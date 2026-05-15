import React, { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";

export default function Login() {
  const { user, login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [needsTotp, setNeedsTotp] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [allowSignup, setAllowSignup] = useState(false);

  useEffect(() => {
    api<{ allowSelfSignup: boolean }>("/api/auth/public-config")
      .then((c) => setAllowSignup(c.allowSelfSignup))
      .catch(() => {});
  }, []);

  if (user && !user.mustChangePwd) return <Navigate to="/" replace />;
  if (user?.mustChangePwd) return <Navigate to="/change-password" replace />;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await login(username, password, needsTotp ? totpCode : undefined);
      if (res.needsTotp) {
        setNeedsTotp(true);
      }
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-redland-charcoal flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-block w-16 h-16 bg-redland-red rounded-lg mb-3 flex items-center justify-center text-white text-3xl font-extrabold">
            R
          </div>
          <h1 className="text-white text-2xl font-extrabold tracking-wide">REDLAND</h1>
          <p className="text-redland-gold font-semibold text-sm tracking-widest">
            CRM &amp; PIPELINE TRACKER
          </p>
        </div>
        <form onSubmit={submit} className="bg-white rounded-lg shadow-2xl p-6 space-y-4">
          {!needsTotp ? (
            <>
              <div>
                <label className="label">Email or username</label>
                <input
                  className="input"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoFocus
                  autoComplete="username"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="label !mb-0">Password</label>
                  <Link to="/forgot-password" className="text-xs font-semibold text-redland-red hover:underline">
                    Forgot password?
                  </Link>
                </div>
                <input
                  type="password"
                  className="input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>
            </>
          ) : (
            <div>
              <label className="label">6-digit code from your authenticator app</label>
              <input
                className="input text-center text-2xl font-mono tracking-widest"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                autoFocus
                autoComplete="one-time-code"
                placeholder="000000"
              />
              <button
                type="button"
                onClick={() => { setNeedsTotp(false); setTotpCode(""); setError(""); }}
                className="text-xs text-gray-500 mt-2 hover:underline"
              >
                ← Use a different account
              </button>
            </div>
          )}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 text-sm rounded p-2">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={busy}
            className="btn-primary w-full justify-center py-3 disabled:opacity-50"
          >
            {busy ? "Signing in…" : needsTotp ? "Verify code" : "Sign in"}
          </button>
          {allowSignup && (
            <div className="text-center text-sm text-gray-600 pt-2 border-t">
              New to Redland CRM?{" "}
              <Link to="/signup" className="font-semibold text-redland-red hover:underline">
                Create an account
              </Link>
            </div>
          )}
        </form>
        <p className="text-center text-white/60 text-xs mt-4">
          Need access? Ask an admin to send you an invite.
        </p>
      </div>
    </div>
  );
}
