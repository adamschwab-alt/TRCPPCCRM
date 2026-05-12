import React, { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth";

export default function Login() {
  const { user, login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (user && !user.mustChangePwd) return <Navigate to="/" replace />;
  if (user?.mustChangePwd) return <Navigate to="/change-password" replace />;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(username, password);
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
          <div>
            <label className="label">Username</label>
            <input
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              autoComplete="username"
            />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
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
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="text-center text-white/60 text-xs mt-4">
          Forgot your password? Contact the admin.
        </p>
      </div>
    </div>
  );
}
