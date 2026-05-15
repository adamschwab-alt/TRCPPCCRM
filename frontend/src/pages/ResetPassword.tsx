import React, { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";

export default function ResetPassword() {
  const { token } = useParams();
  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const nav = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (pwd.length < 8) return setError("Password must be at least 8 characters.");
    if (pwd !== confirm) return setError("Passwords don't match.");
    setBusy(true);
    try {
      await api("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, newPassword: pwd }),
      });
      setDone(true);
      setTimeout(() => nav("/login"), 1500);
    } catch (err: any) {
      setError(err.message || "Reset failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-redland-charcoal flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-2xl p-6 space-y-4">
        <h1 className="text-xl font-extrabold text-redland-charcoal">Set a new password</h1>
        {done ? (
          <div className="bg-green-50 border border-green-200 rounded p-3 text-sm text-green-800">
            Password updated. Redirecting to sign in…
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="label">New password</label>
              <input type="password" className="input" value={pwd} onChange={(e) => setPwd(e.target.value)} required autoFocus />
            </div>
            <div>
              <label className="label">Confirm new password</label>
              <input type="password" className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
            </div>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-800 text-sm rounded p-2">
                {error}
              </div>
            )}
            <button type="submit" disabled={busy} className="btn-primary w-full justify-center py-3 disabled:opacity-50">
              {busy ? "Saving…" : "Update password"}
            </button>
          </form>
        )}
        <div className="text-center text-sm">
          <Link to="/login" className="text-redland-red font-semibold hover:underline">
            ← Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
