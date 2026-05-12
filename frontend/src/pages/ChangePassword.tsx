import React, { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";

export default function ChangePassword() {
  const { user, refresh } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();

  if (!user) return <Navigate to="/login" replace />;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (next.length < 8) return setError("New password must be at least 8 characters.");
    if (next !== confirm) return setError("Passwords do not match.");
    setBusy(true);
    try {
      await api("/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      await refresh();
      nav("/");
    } catch (err: any) {
      setError(err.message || "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-redland-charcoal flex items-center justify-center p-4">
      <form onSubmit={submit} className="w-full max-w-md bg-white rounded-lg shadow-xl p-6 space-y-4">
        <h1 className="text-xl font-bold text-redland-charcoal">Change your password</h1>
        <p className="text-sm text-gray-600">
          You must set a new password before continuing.
        </p>
        <div>
          <label className="label">Current password</label>
          <input
            type="password"
            className="input"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            autoFocus
          />
        </div>
        <div>
          <label className="label">New password</label>
          <input
            type="password"
            className="input"
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Confirm new password</label>
          <input
            type="password"
            className="input"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 text-sm rounded p-2">
            {error}
          </div>
        )}
        <button disabled={busy} className="btn-primary w-full justify-center py-3 disabled:opacity-50">
          {busy ? "Saving…" : "Update password"}
        </button>
      </form>
    </div>
  );
}
