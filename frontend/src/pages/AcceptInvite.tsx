import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, setToken } from "../api";
import { useAuth } from "../auth";

export default function AcceptInvite() {
  const { token } = useParams();
  const { refresh } = useAuth();
  const [info, setInfo] = useState<{ email: string; fullName: string; role: string } | null>(null);
  const [username, setUsername] = useState("");
  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const nav = useNavigate();

  useEffect(() => {
    api<{ email: string; fullName: string; role: string }>(`/api/invitations/lookup/${token}`)
      .then((d) => {
        setInfo(d);
        setUsername(d.email);
      })
      .catch((e) => setError(e.message || "Invitation invalid"))
      .finally(() => setLoading(false));
  }, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (pwd.length < 8) return setError("Password must be at least 8 characters.");
    if (pwd !== confirm) return setError("Passwords don't match.");
    setBusy(true);
    try {
      const res = await api<{ token: string }>("/api/invitations/accept", {
        method: "POST",
        body: JSON.stringify({ token, password: pwd, username }),
      });
      setToken(res.token);
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
      <div className="w-full max-w-md bg-white rounded-lg shadow-2xl p-6 space-y-4">
        <h1 className="text-xl font-extrabold text-redland-charcoal">Accept invitation</h1>
        {loading ? (
          <div className="text-gray-500">Loading…</div>
        ) : !info ? (
          <>
            <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-800">
              {error || "This invitation link is invalid or has expired."}
            </div>
            <Link to="/login" className="text-redland-red font-semibold hover:underline text-sm">
              ← Back to sign in
            </Link>
          </>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div className="bg-gray-50 rounded p-3 text-sm">
              <div><span className="text-gray-500">Name:</span> <strong>{info.fullName}</strong></div>
              <div><span className="text-gray-500">Email:</span> <strong>{info.email}</strong></div>
              <div><span className="text-gray-500">Role:</span> <strong>{info.role}</strong></div>
            </div>
            <div>
              <label className="label">Username</label>
              <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} required />
            </div>
            <div>
              <label className="label">Create a password</label>
              <input type="password" className="input" value={pwd} onChange={(e) => setPwd(e.target.value)} required />
            </div>
            <div>
              <label className="label">Confirm password</label>
              <input type="password" className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
            </div>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-800 text-sm rounded p-2">
                {error}
              </div>
            )}
            <button type="submit" disabled={busy} className="btn-primary w-full justify-center py-3 disabled:opacity-50">
              {busy ? "Creating account…" : "Create account & sign in"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
