import React, { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setSent(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-redland-charcoal flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-2xl p-6 space-y-4">
        <div>
          <h1 className="text-xl font-extrabold text-redland-charcoal">Forgot password?</h1>
          <p className="text-sm text-gray-600 mt-1">
            Enter the email on your Redland account and we'll send you a reset link.
          </p>
        </div>
        {sent ? (
          <div className="bg-green-50 border border-green-200 rounded p-3 text-sm text-green-800">
            If an account exists for that email, a password reset link has been sent. The link expires in 1 hour.
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>
            <button type="submit" disabled={busy} className="btn-primary w-full justify-center py-3 disabled:opacity-50">
              {busy ? "Sending…" : "Send reset link"}
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
