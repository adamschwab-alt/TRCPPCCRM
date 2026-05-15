import React, { useEffect, useState } from "react";
import { api, setToken } from "../api";
import { useAuth } from "../auth";

export default function Profile() {
  const { user, refresh, logout } = useAuth();
  const [fullName, setFullName] = useState(user?.fullName || "");
  const [email, setEmail] = useState(user?.email || "");
  const [savedProfile, setSavedProfile] = useState("");
  const [profileError, setProfileError] = useState("");
  const [busy, setBusy] = useState(false);

  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [pwError, setPwError] = useState("");
  const [pwSaved, setPwSaved] = useState("");
  const [pwBusy, setPwBusy] = useState(false);

  // 2FA state
  const [enrollStarted, setEnrollStarted] = useState<{ qrDataUrl: string; secret: string } | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [twoFaError, setTwoFaError] = useState("");
  const [twoFaMsg, setTwoFaMsg] = useState("");
  const [twoFaBusy, setTwoFaBusy] = useState(false);
  const [disablePwd, setDisablePwd] = useState("");
  const [disableCode, setDisableCode] = useState("");

  useEffect(() => {
    setFullName(user?.fullName || "");
    setEmail(user?.email || "");
  }, [user]);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setProfileError("");
    setSavedProfile("");
    try {
      await api("/api/auth/profile", {
        method: "PUT",
        body: JSON.stringify({ fullName, email: email || null }),
      });
      await refresh();
      setSavedProfile("Saved.");
      setTimeout(() => setSavedProfile(""), 2000);
    } catch (err: any) {
      setProfileError(err.message || "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function startEnroll() {
    setTwoFaError("");
    setTwoFaBusy(true);
    try {
      const r = await api<{ qrDataUrl: string; secret: string }>("/api/auth/2fa/setup", { method: "POST" });
      setEnrollStarted(r);
    } catch (e: any) {
      setTwoFaError(e.message || "Failed to start 2FA setup");
    } finally {
      setTwoFaBusy(false);
    }
  }

  async function confirmEnroll() {
    setTwoFaError("");
    setTwoFaBusy(true);
    try {
      await api("/api/auth/2fa/verify", { method: "POST", body: JSON.stringify({ code: verifyCode }) });
      setEnrollStarted(null);
      setVerifyCode("");
      await refresh();
      setTwoFaMsg("Two-factor authentication enabled.");
      setTimeout(() => setTwoFaMsg(""), 3000);
    } catch (e: any) {
      setTwoFaError(e.message || "Verification failed");
    } finally {
      setTwoFaBusy(false);
    }
  }

  async function disable2fa() {
    setTwoFaError("");
    setTwoFaBusy(true);
    try {
      await api("/api/auth/2fa/disable", {
        method: "POST",
        body: JSON.stringify({ password: disablePwd, code: disableCode }),
      });
      setDisablePwd("");
      setDisableCode("");
      await refresh();
      setTwoFaMsg("Two-factor authentication disabled.");
      setTimeout(() => setTwoFaMsg(""), 3000);
    } catch (e: any) {
      setTwoFaError(e.message || "Failed");
    } finally {
      setTwoFaBusy(false);
    }
  }

  async function signOutEverywhere() {
    if (!confirm("Sign out of all devices and browsers? You'll need to sign back in here.")) return;
    try {
      await api("/api/auth/logout-all", { method: "POST" });
    } catch {}
    setToken(null);
    logout();
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwError("");
    setPwSaved("");
    if (newPwd.length < 8) return setPwError("Password must be at least 8 characters.");
    if (newPwd !== confirmPwd) return setPwError("Passwords don't match.");
    setPwBusy(true);
    try {
      await api("/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword: currentPwd, newPassword: newPwd }),
      });
      setPwSaved("Password updated.");
      setCurrentPwd("");
      setNewPwd("");
      setConfirmPwd("");
      setTimeout(() => setPwSaved(""), 2500);
    } catch (err: any) {
      setPwError(err.message || "Failed");
    } finally {
      setPwBusy(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-extrabold text-redland-charcoal">My Account</h1>
        <p className="text-sm text-gray-600">Update your profile and password</p>
      </div>

      <form onSubmit={saveProfile} className="card p-5 space-y-4">
        <div className="font-bold text-redland-charcoal">Profile</div>
        <div>
          <label className="label">Full name</label>
          <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div>
          <label className="label">Email</label>
          <input type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          <p className="text-xs text-gray-500 mt-1">Used for password resets. Optional, but strongly recommended.</p>
        </div>
        <div>
          <label className="label">Username</label>
          <input className="input bg-gray-100" value={user?.username || ""} disabled />
          <p className="text-xs text-gray-500 mt-1">Username cannot be changed.</p>
        </div>
        {profileError && (
          <div className="bg-red-50 border border-red-200 text-red-800 text-sm rounded p-2">{profileError}</div>
        )}
        {savedProfile && (
          <div className="bg-green-50 border border-green-200 text-green-800 text-sm rounded p-2">{savedProfile}</div>
        )}
        <button type="submit" disabled={busy} className="btn-primary disabled:opacity-50">
          {busy ? "Saving…" : "Save profile"}
        </button>
      </form>

      <div className="card p-5 space-y-4">
        <div className="font-bold text-redland-charcoal">Two-factor authentication</div>
        <p className="text-sm text-gray-600">
          Adds a second step at sign-in using an authenticator app (Google Authenticator, Authy, 1Password, etc.).
        </p>
        {twoFaMsg && <div className="bg-green-50 border border-green-200 text-green-800 text-sm rounded p-2">{twoFaMsg}</div>}
        {twoFaError && <div className="bg-red-50 border border-red-200 text-red-800 text-sm rounded p-2">{twoFaError}</div>}
        {user?.totpEnabled ? (
          <div className="space-y-3">
            <div className="bg-green-50 border border-green-200 text-green-800 rounded p-3 text-sm font-semibold">
              ✓ Two-factor authentication is enabled.
            </div>
            <details>
              <summary className="text-sm font-semibold text-redland-red cursor-pointer">Disable 2FA</summary>
              <div className="mt-3 space-y-2 max-w-sm">
                <input type="password" className="input" placeholder="Current password" value={disablePwd} onChange={(e) => setDisablePwd(e.target.value)} />
                <input className="input text-center font-mono tracking-widest" placeholder="6-digit code" inputMode="numeric" value={disableCode} onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, "").slice(0, 6))} />
                <button onClick={disable2fa} disabled={twoFaBusy} className="btn-danger disabled:opacity-50">
                  {twoFaBusy ? "Working…" : "Disable two-factor"}
                </button>
              </div>
            </details>
          </div>
        ) : enrollStarted ? (
          <div className="space-y-3">
            <ol className="text-sm space-y-1 list-decimal pl-5">
              <li>Open your authenticator app (Google Authenticator, Authy, 1Password, etc.)</li>
              <li>Scan the QR code below, or paste the secret manually.</li>
              <li>Enter the 6-digit code your app generates.</li>
            </ol>
            <div className="flex flex-col sm:flex-row items-start gap-4">
              <img src={enrollStarted.qrDataUrl} alt="2FA QR" className="border rounded bg-white p-1" />
              <div className="flex-1 space-y-2">
                <div className="text-xs text-gray-500 uppercase font-semibold">Or paste this secret</div>
                <div className="font-mono text-sm bg-gray-50 border rounded p-2 break-all">{enrollStarted.secret}</div>
              </div>
            </div>
            <div className="max-w-sm space-y-2">
              <input
                className="input text-center text-2xl font-mono tracking-widest"
                placeholder="000000"
                inputMode="numeric"
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              />
              <div className="flex gap-2">
                <button onClick={confirmEnroll} disabled={twoFaBusy || verifyCode.length !== 6} className="btn-primary disabled:opacity-50 flex-1">
                  {twoFaBusy ? "Verifying…" : "Verify & enable"}
                </button>
                <button onClick={() => setEnrollStarted(null)} className="btn-ghost">Cancel</button>
              </div>
            </div>
          </div>
        ) : (
          <button onClick={startEnroll} disabled={twoFaBusy} className="btn-gold disabled:opacity-50">
            {twoFaBusy ? "Working…" : "Set up two-factor"}
          </button>
        )}
      </div>

      <div className="card p-5 space-y-3">
        <div className="font-bold text-redland-charcoal">Active sessions</div>
        <p className="text-sm text-gray-600">
          Sign out of every browser and device where you're currently logged in. You'll need to sign back in on this device too.
        </p>
        <button onClick={signOutEverywhere} className="btn-danger">Sign out everywhere</button>
      </div>

      <form onSubmit={changePassword} className="card p-5 space-y-4">
        <div className="font-bold text-redland-charcoal">Change password</div>
        <div>
          <label className="label">Current password</label>
          <input type="password" className="input" value={currentPwd} onChange={(e) => setCurrentPwd(e.target.value)} required />
        </div>
        <div>
          <label className="label">New password</label>
          <input type="password" className="input" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} required />
        </div>
        <div>
          <label className="label">Confirm new password</label>
          <input type="password" className="input" value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} required />
        </div>
        {pwError && (
          <div className="bg-red-50 border border-red-200 text-red-800 text-sm rounded p-2">{pwError}</div>
        )}
        {pwSaved && (
          <div className="bg-green-50 border border-green-200 text-green-800 text-sm rounded p-2">{pwSaved}</div>
        )}
        <button type="submit" disabled={pwBusy} className="btn-primary disabled:opacity-50">
          {pwBusy ? "Saving…" : "Update password"}
        </button>
      </form>
    </div>
  );
}
