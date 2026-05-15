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
  { key: "module_contacts_enabled", label: "Module 8 · Contacts" },
  { key: "module_compliance_enabled", label: "Module 9 · Compliance Vault" },
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
  const [tab, setTab] = useState<"modules" | "config" | "users" | "dropdowns" | "audit" | "automation" | "boards">("modules");
  const [auditRows, setAuditRows] = useState<any[]>([]);
  const [auditFilter, setAuditFilter] = useState<string>("");
  const [rules, setRules] = useState<any[]>([]);
  const [adminBoards, setAdminBoards] = useState<any[]>([]);
  const [newRule, setNewRule] = useState<{ name: string; trigger: "STAGE_CHANGED_TO" | "OPPORTUNITY_CREATED"; triggerArg: string; action: "CREATE_NOTE" | "SET_NEXT_ACTION"; body: string; daysFromNow: number; note: string }>({ name: "", trigger: "STAGE_CHANGED_TO", triggerArg: "BID_SUBMITTED", action: "CREATE_NOTE", body: "", daysFromNow: 3, note: "" });
  const [newBoard, setNewBoard] = useState({ slug: "", name: "", color: "#8B1A1A" });
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
  async function loadAudit() {
    const qs = auditFilter ? `?event=${encodeURIComponent(auditFilter)}` : "";
    setAuditRows(await api(`/api/audit-log${qs}`));
  }

  useEffect(() => {
    loadUsers();
    loadInvitations();
  }, [user?.role]);

  useEffect(() => {
    if (tab === "audit") loadAudit().catch(() => {});
    if (tab === "automation") api("/api/automation-rules").then(setRules).catch(() => {});
    if (tab === "boards") api("/api/boards").then(setAdminBoards).catch(() => {});
  }, [tab, auditFilter]);

  async function addRule() {
    if (!newRule.name) return;
    const actionArgs: any = {};
    if (newRule.action === "CREATE_NOTE") actionArgs.body = newRule.body;
    if (newRule.action === "SET_NEXT_ACTION") { actionArgs.daysFromNow = newRule.daysFromNow; actionArgs.note = newRule.note; }
    await api("/api/automation-rules", {
      method: "POST",
      body: JSON.stringify({
        name: newRule.name,
        trigger: newRule.trigger,
        triggerArg: newRule.triggerArg,
        action: newRule.action,
        actionArgs,
        enabled: true,
      }),
    });
    setNewRule({ name: "", trigger: "STAGE_CHANGED_TO", triggerArg: "BID_SUBMITTED", action: "CREATE_NOTE", body: "", daysFromNow: 3, note: "" });
    setRules(await api("/api/automation-rules"));
  }
  async function toggleRule(id: number, enabled: boolean) {
    await api(`/api/automation-rules/${id}`, { method: "PUT", body: JSON.stringify({ enabled }) });
    setRules(await api("/api/automation-rules"));
  }
  async function deleteRule(id: number) {
    if (!confirm("Delete this rule?")) return;
    await api(`/api/automation-rules/${id}`, { method: "DELETE" });
    setRules(await api("/api/automation-rules"));
  }
  async function addBoard() {
    if (!newBoard.slug || !newBoard.name) return;
    await api("/api/boards", { method: "POST", body: JSON.stringify(newBoard) });
    setNewBoard({ slug: "", name: "", color: "#8B1A1A" });
    setAdminBoards(await api("/api/boards"));
  }
  async function deleteBoard(id: number) {
    if (!confirm("Archive this board? Opportunities on it will remain.")) return;
    await api(`/api/boards/${id}`, { method: "DELETE" });
    setAdminBoards(await api("/api/boards"));
  }

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
        {(["modules", "config", "boards", "automation", "users", "dropdowns", "audit"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-semibold rounded-t ${
              tab === t ? "bg-redland-charcoal text-white" : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            {t === "modules" ? "Modules" : t === "config" ? "Configuration" : t === "users" ? "Users" : t === "dropdowns" ? "Dropdowns" : t === "audit" ? "Audit Log" : t === "automation" ? "Automation" : "Boards"}
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
            <div className="flex items-center justify-between py-2 border-t">
              <div>
                <div className="font-semibold">Require 2FA for Admin accounts</div>
                <div className="text-xs text-gray-500">When on, every admin must enroll in two-factor authentication before they can access the app.</div>
              </div>
              <button
                onClick={() => set("require_2fa_admin", local.require_2fa_admin === "true" ? "false" : "true")}
                className={`relative w-12 h-6 rounded-full transition-colors ${local.require_2fa_admin === "true" ? "bg-redland-red" : "bg-gray-300"}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${local.require_2fa_admin === "true" ? "translate-x-6" : ""}`} />
              </button>
            </div>
            <div className="grid sm:grid-cols-2 gap-3 pt-2 border-t">
              <div>
                <label className="label">Minimum password length</label>
                <input type="number" min={8} className="input" value={local.password_min_length || ""} onChange={(e) => set("password_min_length", e.target.value)} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-sm">Require mixed characters</div>
                  <div className="text-xs text-gray-500">Need 3 of: lowercase, uppercase, digit, symbol.</div>
                </div>
                <button
                  onClick={() => set("password_require_mixed", local.password_require_mixed === "true" ? "false" : "true")}
                  className={`relative w-12 h-6 rounded-full transition-colors ${local.password_require_mixed === "true" ? "bg-redland-red" : "bg-gray-300"}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${local.password_require_mixed === "true" ? "translate-x-6" : ""}`} />
                </button>
              </div>
            </div>
          </div>

          <div className="card p-4 space-y-3">
            <div className="font-bold text-redland-charcoal">Polite-loss follow-up</div>
            <p className="text-xs text-gray-600">When a bid is marked Lost, this templated note is auto-added to the opportunity timeline so an estimator can copy/paste it to the GC — preserves the relationship for next time.</p>
            <div className="flex items-center justify-between py-1">
              <div className="font-semibold text-sm">Enabled</div>
              <button
                onClick={() => set("polite_loss_enabled", local.polite_loss_enabled === "false" ? "true" : "false")}
                className={`relative w-12 h-6 rounded-full transition-colors ${local.polite_loss_enabled !== "false" ? "bg-redland-red" : "bg-gray-300"}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${local.polite_loss_enabled !== "false" ? "translate-x-6" : ""}`} />
              </button>
            </div>
            <div>
              <label className="label">Template</label>
              <textarea
                className="input"
                rows={5}
                value={local.polite_loss_template || ""}
                onChange={(e) => set("polite_loss_template", e.target.value)}
              />
            </div>
          </div>

          <div className="card p-4 space-y-3">
            <div className="font-bold text-redland-charcoal">Pipeline rotting thresholds (days)</div>
            <p className="text-xs text-gray-600">Deals with no activity (notes, stage changes, edits) for this many days show up as <strong>Stale</strong> on the pipeline. Set to 0 to disable for a stage.</p>
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
              {["LEAD", "REVIEWING_ITB", "GO_NO_GO", "ESTIMATING", "BID_SUBMITTED", "AWAITING_DECISION", "WON"].map((st) => (
                <div key={st}>
                  <label className="label text-xs">{st.replace(/_/g, " ")}</label>
                  <input type="number" min={0} className="input" value={local[`rot_${st}`] || ""} onChange={(e) => set(`rot_${st}`, e.target.value)} />
                </div>
              ))}
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

      {tab === "audit" && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <select className="input max-w-xs" value={auditFilter} onChange={(e) => setAuditFilter(e.target.value)}>
              <option value="">All events</option>
              <option value="login.success">Successful logins</option>
              <option value="login.failed">Failed logins</option>
              <option value="login.locked">Account lockouts</option>
              <option value="password.changed">Password changes</option>
              <option value="password.reset.requested">Password reset requested</option>
              <option value="password.reset.completed">Password reset completed</option>
              <option value="2fa.enrolled">2FA enrolled</option>
              <option value="2fa.disabled">2FA disabled</option>
              <option value="user.created">User created</option>
              <option value="user.role_changed">Role changed</option>
              <option value="user.deactivated">User deactivated</option>
              <option value="user.password_reset_by_admin">Admin reset password</option>
              <option value="invitation.sent">Invitation sent</option>
              <option value="invitation.accepted">Invitation accepted</option>
              <option value="invitation.revoked">Invitation revoked</option>
              <option value="logout.all">Logout-all</option>
              <option value="settings.updated">Settings updated</option>
              <option value="profile.updated">Profile updated</option>
            </select>
            <button onClick={loadAudit} className="btn-ghost">Refresh</button>
          </div>
          <div className="card overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-redland-charcoal text-white">
                <tr>
                  <th className="px-3 py-2 text-left">When</th>
                  <th className="px-3 py-2 text-left">Event</th>
                  <th className="px-3 py-2 text-left">Actor</th>
                  <th className="px-3 py-2 text-left">Target</th>
                  <th className="px-3 py-2 text-left">IP</th>
                  <th className="px-3 py-2 text-left">Detail</th>
                </tr>
              </thead>
              <tbody>
                {auditRows.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-600">{new Date(r.createdAt).toLocaleString()}</td>
                    <td className="px-3 py-2 font-mono text-xs">{r.event}</td>
                    <td className="px-3 py-2">{r.user?.fullName || r.actorLabel || "—"}</td>
                    <td className="px-3 py-2 text-xs">
                      {r.targetType ? `${r.targetType}#${r.targetId}` : "—"}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500">{r.ip || "—"}</td>
                    <td className="px-3 py-2 text-xs text-gray-500">
                      {r.meta ? <code className="text-[0.65rem]">{JSON.stringify(r.meta)}</code> : "—"}
                    </td>
                  </tr>
                ))}
                {auditRows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center text-gray-500 py-6">No audit events match.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "boards" && (
        <div className="space-y-3">
          <div className="card p-4 space-y-3">
            <div className="font-bold text-redland-charcoal">Pipeline boards</div>
            <p className="text-xs text-gray-600">Create separate pipeline boards for different sales motions (Public/DOT, Private Repeat, Negotiated/Last-Look). Bids can be moved between boards from the Pipeline → Bulk-edit bar.</p>
            <div className="grid sm:grid-cols-4 gap-2">
              <input className="input" placeholder="slug (a-z, _, -)" value={newBoard.slug} onChange={(e) => setNewBoard({ ...newBoard, slug: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "") })} />
              <input className="input" placeholder="Display name" value={newBoard.name} onChange={(e) => setNewBoard({ ...newBoard, name: e.target.value })} />
              <input className="input" type="color" value={newBoard.color} onChange={(e) => setNewBoard({ ...newBoard, color: e.target.value })} />
              <button onClick={addBoard} className="btn-primary">Add board</button>
            </div>
          </div>
          <div className="card overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-redland-charcoal text-white">
                <tr><th className="px-3 py-2 text-left">Slug</th><th className="px-3 py-2 text-left">Name</th><th className="px-3 py-2 text-left">Color</th><th className="px-3 py-2 text-right"></th></tr>
              </thead>
              <tbody>
                {adminBoards.map((b) => (
                  <tr key={b.id} className="border-t">
                    <td className="px-3 py-2 font-mono">{b.slug}</td>
                    <td className="px-3 py-2 font-semibold">{b.name}</td>
                    <td className="px-3 py-2"><span className="inline-block w-6 h-4 rounded" style={{ background: b.color }} /> {b.color}</td>
                    <td className="px-3 py-2 text-right">
                      {b.slug !== "main" && <button onClick={() => deleteBoard(b.id)} className="text-red-700 text-xs font-semibold hover:underline">Archive</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "automation" && (
        <div className="space-y-3">
          <div className="card p-4 space-y-3">
            <div className="font-bold text-redland-charcoal">New automation rule</div>
            <p className="text-xs text-gray-600">When a trigger fires, run the chosen action. Use <code className="bg-gray-100 px-1">{"{customer}"}</code> in templates to substitute the customer name.</p>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Rule name</label>
                <input className="input" value={newRule.name} onChange={(e) => setNewRule({ ...newRule, name: e.target.value })} placeholder="e.g. Day 7 follow-up reminder" />
              </div>
              <div>
                <label className="label">Trigger</label>
                <select className="input" value={newRule.trigger} onChange={(e) => setNewRule({ ...newRule, trigger: e.target.value as any })}>
                  <option value="STAGE_CHANGED_TO">Stage changed to…</option>
                  <option value="OPPORTUNITY_CREATED">Opportunity created</option>
                </select>
              </div>
              {newRule.trigger === "STAGE_CHANGED_TO" && (
                <div>
                  <label className="label">Stage</label>
                  <select className="input" value={newRule.triggerArg} onChange={(e) => setNewRule({ ...newRule, triggerArg: e.target.value })}>
                    {["LEAD", "REVIEWING_ITB", "GO_NO_GO", "ESTIMATING", "BID_SUBMITTED", "AWAITING_DECISION", "WON", "LOST", "NO_BID", "WITHDRAWN"].map((s) => (
                      <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="label">Action</label>
                <select className="input" value={newRule.action} onChange={(e) => setNewRule({ ...newRule, action: e.target.value as any })}>
                  <option value="CREATE_NOTE">Create a note</option>
                  <option value="SET_NEXT_ACTION">Set next action</option>
                </select>
              </div>
              {newRule.action === "CREATE_NOTE" && (
                <div className="sm:col-span-2">
                  <label className="label">Note body</label>
                  <textarea className="input" rows={2} value={newRule.body} onChange={(e) => setNewRule({ ...newRule, body: e.target.value })} placeholder="e.g. Reminder: follow up with {customer} on bid status." />
                </div>
              )}
              {newRule.action === "SET_NEXT_ACTION" && (
                <>
                  <div>
                    <label className="label">Days from now</label>
                    <input type="number" min={0} className="input" value={newRule.daysFromNow} onChange={(e) => setNewRule({ ...newRule, daysFromNow: Number(e.target.value) })} />
                  </div>
                  <div>
                    <label className="label">Action note</label>
                    <input className="input" value={newRule.note} onChange={(e) => setNewRule({ ...newRule, note: e.target.value })} placeholder="e.g. Call to check status" />
                  </div>
                </>
              )}
            </div>
            <button onClick={addRule} className="btn-primary">Add rule</button>
          </div>
          <div className="card overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-redland-charcoal text-white">
                <tr>
                  <th className="px-3 py-2 text-left">Rule</th>
                  <th className="px-3 py-2 text-left">When</th>
                  <th className="px-3 py-2 text-left">Then</th>
                  <th className="px-3 py-2 text-center">Enabled</th>
                  <th className="px-3 py-2 text-right"></th>
                </tr>
              </thead>
              <tbody>
                {rules.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="px-3 py-2 font-semibold">{r.name}</td>
                    <td className="px-3 py-2 text-xs">{r.trigger}{r.triggerArg ? `: ${r.triggerArg.replace(/_/g, " ")}` : ""}</td>
                    <td className="px-3 py-2 text-xs">{r.action} <span className="text-gray-500">{r.actionArgs}</span></td>
                    <td className="px-3 py-2 text-center">
                      <input type="checkbox" className="accent-redland-red" checked={r.enabled} onChange={(e) => toggleRule(r.id, e.target.checked)} />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button onClick={() => deleteRule(r.id)} className="text-red-700 text-xs font-semibold hover:underline">Delete</button>
                    </td>
                  </tr>
                ))}
                {rules.length === 0 && <tr><td colSpan={5} className="text-center text-gray-500 py-6">No automation rules yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
