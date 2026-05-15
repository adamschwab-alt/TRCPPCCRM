import React, { useEffect, useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth";

export default function Profile() {
  const { user, refresh } = useAuth();
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
