import React, { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { api, setToken } from "../api";
import { useAuth } from "../auth";

export default function Signup() {
  const { user, refresh } = useAuth();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();

  useEffect(() => {
    api<{ allowSelfSignup: boolean }>("/api/auth/public-config")
      .then((c) => setAllowed(c.allowSelfSignup))
      .catch(() => setAllowed(false));
  }, []);

  if (user) return <Navigate to="/" replace />;
  if (allowed === false) {
    return (
      <div className="min-h-screen bg-redland-charcoal flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-lg shadow-2xl p-6 space-y-4 text-center">
          <h1 className="text-xl font-extrabold text-redland-charcoal">Signup disabled</h1>
          <p className="text-sm text-gray-600">
            Public signup is turned off. Ask an admin to invite you, then check your email for the invitation link.
          </p>
          <Link to="/login" className="btn-primary inline-flex">Back to sign in</Link>
        </div>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (pwd.length < 8) return setError("Password must be at least 8 characters.");
    if (pwd !== confirm) return setError("Passwords don't match.");
    setBusy(true);
    try {
      const res = await api<{ token: string }>("/api/auth/signup", {
        method: "POST",
        body: JSON.stringify({ fullName, email, password: pwd }),
      });
      setToken(res.token);
      await refresh();
      nav("/");
    } catch (err: any) {
      setError(err.message || "Signup failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-redland-charcoal flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-2xl p-6 space-y-4">
        <h1 className="text-xl font-extrabold text-redland-charcoal">Create your account</h1>
        <p className="text-sm text-gray-600">
          New accounts start as Read-Only and need an admin to assign a role.
        </p>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">Full name</label>
            <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} required autoFocus />
          </div>
          <div>
            <label className="label">Email</label>
            <input type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="label">Password</label>
            <input type="password" className="input" value={pwd} onChange={(e) => setPwd(e.target.value)} required />
          </div>
          <div>
            <label className="label">Confirm password</label>
            <input type="password" className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          </div>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 text-sm rounded p-2">{error}</div>
          )}
          <button type="submit" disabled={busy} className="btn-primary w-full justify-center py-3 disabled:opacity-50">
            {busy ? "Creating…" : "Create account"}
          </button>
        </form>
        <div className="text-center text-sm">
          Already have an account?{" "}
          <Link to="/login" className="text-redland-red font-semibold hover:underline">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
