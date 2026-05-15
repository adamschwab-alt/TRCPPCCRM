import React, { useEffect, useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import { useSettings } from "../settings";

const MODULES: { key: string; label: string; alwaysOn?: boolean }[] = [
  { key: "module_pipeline_enabled", label: "Module 1 · Pipeline (always on)", alwaysOn: true },
  { key: "module_go_no_go_enabled", label: "Module 2 · Go/No-Go Decision Framework" },
  { key: "module_bid_analytics_enabled", label: "Module 3 · Bid Tracking & Analytics" },
  { key: "module_estimator_workload_enabled", label: "Module 4 · Estimator Workload" },
  { key: "module_customer_mgmt_enabled", label: "Module 5 · Customer Management" },
  { key: "module_backlog_enabled", label: "Module 6 · Backlog Overview" },
  { key: "module_dashboard_enabled", label: "Module 7 · Reporting Dashboard" },
];

const WEIGHTS = [
  { key: "weight_margin", label: "Margin Attractiveness" },
  { key: "weight_customer", label: "Customer Relationship" },
  { key: "weight_geo", label: "Geographic Fit" },
  { key: "weight_scope_risk", label: "Scope Complexity / Risk" },
  { key: "weight_resource", label: "Resource Availability" },
  { key: "weight_bond_risk", label: "Bond / Insurance Risk" },
  { key: "weight_strategic", label: "Strategic Value" },
];

const DROPDOWN_CATS = [
  { key: "region", label: "Geographic Regions" },
  { key: "project_type", label: "Project Types" },
  { key: "scope_of_work", label: "Scope Categories" },
  { key: "loss_reason", label: "Loss Reasons" },
  { key: "no_bid_reason", label: "No-Bid Reasons" },
  { key: "source", label: "Sources" },
];

export default function AdminSettings() {
  const { user } = useAuth();
  const { settings, dropdowns, reload } = useSettings();
  const [local, setLocal] = useState<Record<string, string>>({});
  const [users, setUsers] = useState<any[]>([]);
  const [savedMsg, setSavedMsg] = useState("");
  const [tab, setTab] = useState<"modules" | "config" | "users" | "dropdowns">("modules");
  const [newUser, setNewUser] = useState({ username: "", fullName: "", email: "", role: "ESTIMATOR" });
  const [newDropdown, setNewDropdown] = useState<Record<string, string>>({});
  const [invitations, setInvitations] = useState<any[]>([]);
  const [newInvite, setNewInvite] = useState({ email: "", fullName: "", role: "ESTIMATOR" });
  const [inviteMsg, setInviteMsg] = useState("");

  useEffect(() => {
    setLocal({ ...settings });
  }, [settings]);

  async function loadUsers() {
    setUsers(await api("/api/users"));
  }
  async function loadInvitations() {
    if (user?.role !== "ADMIN") return;
    try {
      setInvitations(await api("/api/invitations"));
    } catch {}
  }
  useEffect(() => {
    loadUsers();
    loadInvitations();
  }, [user?.role]);

  if (user?.role !== "ADMIN" && user?.role !== "LEADERSHIP") {
    return <div className="card p-6">You don't have access to this page.</div>;
  }

  function set(k: string, v: string) {
    setLocal({ ...local, [k]: v });
  }

  async function saveSettings() {
    await api("/api/settings", { method: "PUT", body: JSON.stringify(local) });
    await reload();
    setSavedMsg("Settings saved.");
    setTimeout(() => setSavedMsg(""), 2500);
  }

  async function createUser() {
    if (!newUser.username || !newUser.fullName) return;
    await api("/api/users", {
      method: "POST",
      body: JSON.stringify({ ...newUser, email: newUser.email || null }),
    });
    setNewUser({ username: "", fullName: "", email: "", role: "ESTIMATOR" });
    loadUsers();
  }

  async function sendInvite() {
    setInviteMsg("");
    if (!newInvite.email || !newInvite.fullName) return;
    try {
      const r = await api<{ sentTo: string }>("/api/invitations", {
        method: "POST",
        body: JSON.stringify(newInvite),
      });
      setInviteMsg(`Invitation sent to ${r.sentTo}.`);
      setNewInvite({ email: "", fullName: "", role: "ESTIMATOR" });
      loadInvitations();
      setTimeout(() => setInviteMsg(""), 4000);
    } catch (e: any) {
      setInviteMsg(`Error: ${e.message}`);
    }
  }

  async function revokeInvite(id: number) {
    if (!confirm("Revoke this invitation?")) return;
    await api(`/api/invitations/${id}`, { method: "DELETE" });
    loadInvitations();
  }

  async function deactivateUser(id: number) {
    if (!confirm("Deactivate this user?")) return;
    await api(`/api/users/${id}`, { method: "DELETE" });
    loadUsers();
  }

  async function resetPwd(id: number) {
    if (!confirm("Reset this user's password to the default (Redland2026!)?")) return;
    await api(`/api/users/${id}`, {
      method: "PUT",
      body: JSON.stringify({ password: "Redland2026!" }),
    });
    alert("Password reset. User will be prompted to change on next login.");
  }

  async function addDropdown(cat: string) {
    const value = (newDropdown[cat] || "").trim();
    if (!value) return;
    await api("/api/dropdowns", { method: "POST", body: JSON.stringify({ category: cat, value }) });
    setNewDropdown({ ...newDropdown, [cat]: "" });
    await reload();
  }

  const weightTotal = WEIGHTS.reduce((a, w) => a + parseFloat(local[w.key] || "0"), 0);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold text-redland-charcoal">Admin Settings</h1>

      <div className="border-b flex flex-wrap gap-1">
        {(["modules", "config", "users", "dropdowns"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-semibold rounded-t ${
              tab === t ? "bg-redland-charcoal text-white" : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            {t === "modules" ? "Modules" : t === "config" ? "Configuration" : t === "users" ? "Users" : "Dropdowns"}
          </button>
        ))}
      </div>

      {savedMsg && <div className="bg-green-50 text-green-800 border border-green-200 rounded p-2 text-sm">{savedMsg}</div>}

      {tab === "modules" && (
        <div className="card p-4 space-y-2">
          <p className="text-sm text-gray-600 mb-2">
            Toggle modules on/off. Module 1 (Pipeline) is always on.
          </p>
          {MODULES.map((m) => {
            const v = local[m.key] !== "false";
            return (
              <div key={m.key} className="flex items-center justify-between py-2 border-b last:border-0">
                <span className="font-semibold">{m.label}</span>
                <button
                  disabled={m.alwaysOn}
                  onClick={() => set(m.key, (!v).toString())}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    v ? "bg-redland-red" : "bg-gray-300"
                  } ${m.alwaysOn ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                      v ? "translate-x-6" : ""
                    }`}
                  />
                </button>
              </div>
            );
          })}
          <button onClick={saveSettings} className="btn-primary mt-2">Save</button>
        </div>
      )}

      {tab === "config" && (
        <div className="space-y-4">
          <div className="card p-4 space-y-3">
            <div className="font-bold text-redland-charcoal">Operational Thresholds</div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Estimator capacity threshold</label>
                <input type="number" className="input" value={local.estimator_capacity_threshold || ""} onChange={(e) => set("estimator_capacity_threshold", e.target.value)} />
              </div>
              <div>
                <label className="label">Default bid margin %</label>
                <input type="number" step="0.1" className="input" value={local.default_bid_margin_pct || ""} onChange={(e) => set("default_bid_margin_pct", e.target.value)} />
              </div>
              <div>
                <label className="label">Go/No-Go: David approval limit ($)</label>
                <input type="number" className="input" value={local.go_no_go_threshold_david || ""} onChange={(e) => set("go_no_go_threshold_david", e.target.value)} />
              </div>
              <div>
                <label className="label">Go/No-Go: Chad approval limit ($)</label>
                <input type="number" className="input" value={local.go_no_go_threshold_chad || ""} onChange={(e) => set("go_no_go_threshold_chad", e.target.value)} />
              </div>
            </div>
          </div>

          <div className="card p-4 space-y-3">
            <div className="font-bold text-redland-charcoal">Authentication</div>
            <div className="flex items-center justify-between py-2 border-b">
              <div>
                <div className="font-semibold">Allow public self-signup</div>
                <div className="text-xs text-gray-500">When OFF, only invited users can create accounts. Recommended OFF for a single-company CRM.</div>
              </div>
              <button
                onClick={() => set("allow_self_signup", local.allow_self_signup === "true" ? "false" : "true")}
                className={`relative w-12 h-6 rounded-full transition-colors ${local.allow_self_signup === "true" ? "bg-redland-red" : "bg-gray-300"}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${local.allow_self_signup === "true" ? "translate-x-6" : ""}`} />
              </button>
            </div>
            <div>
              <label className="label">App base URL (used in password reset / invite emails)</label>
              <input
                className="input"
                placeholder="https://your-app.up.railway.app"
                value={local.app_base_url || ""}
                onChange={(e) => set("app_base_url", e.target.value)}
              />
              <p className="text-xs text-gray-500 mt-1">Leave blank to auto-detect from request headers (works for most hosts).</p>
            </div>
          </div>

          <div className="card p-4 space-y-3">
            <div className="font-bold text-redland-charcoal">Go/No-Go Scoring Weights</div>
            <p className="text-xs text-gray-600">Recommended total: 100. Current total: <strong>{weightTotal}</strong></p>
            <div className="grid sm:grid-cols-2 gap-3">
              {WEIGHTS.map((w) => (
                <div key={w.key}>
                  <label className="label">{w.label} (%)</label>
                  <input type="number" className="input" value={local[w.key] || ""} onChange={(e) => set(w.key, e.target.value)} />
                </div>
              ))}
            </div>
          </div>

          <button onClick={saveSettings} className="btn-primary">Save all changes</button>
        </div>
      )}

      {tab === "users" && (
        <div className="space-y-4">
          {user?.role === "ADMIN" && (
            <>
              <div className="card p-4 space-y-3">
                <div className="font-bold text-redland-charcoal">Invite by email (recommended)</div>
                <p className="text-xs text-gray-600">
                  The invitee receives an email with a one-time link to set their own password.
                </p>
                <div className="grid sm:grid-cols-4 gap-3">
                  <input className="input" placeholder="Email" type="email" value={newInvite.email} onChange={(e) => setNewInvite({ ...newInvite, email: e.target.value })} />
                  <input className="input" placeholder="Full name" value={newInvite.fullName} onChange={(e) => setNewInvite({ ...newInvite, fullName: e.target.value })} />
                  <select className="input" value={newInvite.role} onChange={(e) => setNewInvite({ ...newInvite, role: e.target.value })}>
                    <option value="ADMIN">Admin</option>
                    <option value="LEADERSHIP">Leadership</option>
                    <option value="ESTIMATOR">Estimator</option>
                    <option value="PM">PM</option>
                    <option value="READ_ONLY">Read-Only</option>
                  </select>
                  <button onClick={sendInvite} className="btn-gold">Send Invite</button>
                </div>
                {inviteMsg && (
                  <div className={`text-sm rounded p-2 ${inviteMsg.startsWith("Error") ? "bg-red-50 text-red-800 border border-red-200" : "bg-green-50 text-green-800 border border-green-200"}`}>
                    {inviteMsg}
                  </div>
                )}
                {invitations.length > 0 && (
                  <div className="mt-2">
                    <div className="text-xs uppercase font-semibold text-gray-500 mb-1">Pending invitations</div>
                    <div className="space-y-1">
                      {invitations.map((i) => (
                        <div key={i.id} className="flex items-center justify-between text-sm bg-gray-50 rounded px-2 py-1">
                          <div>
                            <strong>{i.fullName}</strong> &lt;{i.email}&gt; — {i.role}
                            <span className="text-xs text-gray-500 ml-2">expires {new Date(i.expiresAt).toLocaleDateString()}</span>
                          </div>
                          <button onClick={() => revokeInvite(i.id)} className="text-xs text-red-700 font-semibold hover:underline">Revoke</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <details className="card p-4">
                <summary className="font-bold text-redland-charcoal cursor-pointer">Add user directly (default password)</summary>
                <div className="mt-3 space-y-3">
                  <div className="grid sm:grid-cols-5 gap-3">
                    <input className="input" placeholder="Username" value={newUser.username} onChange={(e) => setNewUser({ ...newUser, username: e.target.value })} />
                    <input className="input" placeholder="Full name" value={newUser.fullName} onChange={(e) => setNewUser({ ...newUser, fullName: e.target.value })} />
                    <input className="input" placeholder="Email (optional)" type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} />
                    <select className="input" value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}>
                      <option value="ADMIN">Admin</option>
                      <option value="LEADERSHIP">Leadership</option>
                      <option value="ESTIMATOR">Estimator</option>
                      <option value="PM">PM</option>
                      <option value="READ_ONLY">Read-Only</option>
                    </select>
                    <button onClick={createUser} className="btn-primary">Add</button>
                  </div>
                  <p className="text-xs text-gray-500">User starts with the default password Redland2026! and must change it on first login.</p>
                </div>
              </details>
            </>
          )}

          <div className="card overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-redland-charcoal text-white">
                <tr>
                  <th className="px-3 py-2 text-left">Username</th>
                  <th className="px-3 py-2 text-left">Name</th>
                  <th className="px-3 py-2 text-left">Email</th>
                  <th className="px-3 py-2 text-left">Role</th>
                  <th className="px-3 py-2 text-left">Active</th>
                  {user?.role === "ADMIN" && <th className="px-3 py-2 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-t">
                    <td className="px-3 py-2 font-mono">{u.username}</td>
                    <td className="px-3 py-2 font-semibold">{u.fullName}</td>
                    <td className="px-3 py-2 text-gray-700">{u.email || <span className="text-gray-400">—</span>}</td>
                    <td className="px-3 py-2">{u.role}</td>
                    <td className="px-3 py-2">{u.isActive ? "Yes" : "No"}</td>
                    {user?.role === "ADMIN" && (
                      <td className="px-3 py-2 text-right space-x-2">
                        <button onClick={() => resetPwd(u.id)} className="text-xs text-redland-red font-semibold hover:underline">Reset PW</button>
                        <button onClick={() => deactivateUser(u.id)} className="text-xs text-red-700 font-semibold hover:underline">Deactivate</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "dropdowns" && (
        <div className="grid lg:grid-cols-2 gap-4">
          {DROPDOWN_CATS.map((c) => (
            <div key={c.key} className="card p-4">
              <div className="font-bold text-redland-charcoal mb-2">{c.label}</div>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {(dropdowns[c.key] || []).map((v) => (
                  <span key={v} className="badge bg-gray-100 text-gray-800">
                    {v}
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  className="input flex-1"
                  placeholder="Add new value…"
                  value={newDropdown[c.key] || ""}
                  onChange={(e) => setNewDropdown({ ...newDropdown, [c.key]: e.target.value })}
                />
                <button onClick={() => addDropdown(c.key)} className="btn-primary">Add</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
