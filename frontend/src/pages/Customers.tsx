import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, fmtDate, fmtDateTime, fmtMoney } from "../api";
import { useAuth } from "../auth";
import Modal from "../components/Modal";
import ExportButton from "../components/ExportButton";
import { Customer } from "../types";

const TIERS = ["PLATINUM", "GOLD", "SILVER", "NEW"] as const;
const TIER_COLOR: Record<string, string> = {
  PLATINUM: "bg-purple-100 text-purple-800",
  GOLD: "bg-yellow-100 text-yellow-800",
  SILVER: "bg-gray-200 text-gray-800",
  NEW: "bg-blue-100 text-blue-800",
};

export default function Customers() {
  const { user } = useAuth();
  const [list, setList] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState("");
  const [adding, setAdding] = useState<Customer | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [detailCustomer, setDetailCustomer] = useState<Customer | null>(null);
  const readOnly = user?.role === "READ_ONLY";

  async function load() {
    const data = await api<Customer[]>("/api/customers");
    setList(data);
  }
  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    return list.filter((c) => {
      if (search && !c.companyName.toLowerCase().includes(search.toLowerCase())) return false;
      if (tierFilter && c.tier !== tierFilter) return false;
      return true;
    });
  }, [list, search, tierFilter]);

  const totalRevenue = list.reduce((a, c) => a + Number(c.totalRevenueCents), 0);
  const top10 = [...list]
    .sort((a, b) => Number(b.totalRevenueCents) - Number(a.totalRevenueCents))
    .slice(0, 10);
  const top10Total = top10.reduce((a, c) => a + Number(c.totalRevenueCents), 0);
  const repeatRate = list.length
    ? list.filter((c) => c.totalProjects >= 2).length / list.length
    : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-extrabold text-redland-charcoal">Customers</h1>
          <p className="text-sm text-gray-600">Relationship tiers and customer-level analytics</p>
        </div>
        <div className="flex gap-2">
          <ExportButton path="/api/exports/customers.xlsx" />
          {!readOnly && (
            <button onClick={() => setShowAdd(true)} className="btn-gold">
              + New Customer
            </button>
          )}
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <div className="card p-4">
          <div className="text-xs text-gray-500 uppercase font-semibold">Total Customers</div>
          <div className="text-3xl font-extrabold text-redland-red">{list.length}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-gray-500 uppercase font-semibold">Repeat Rate</div>
          <div className="text-3xl font-extrabold text-redland-red">{Math.round(repeatRate * 100)}%</div>
          <div className="text-xs text-gray-500">Customers with 2+ projects</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-gray-500 uppercase font-semibold">Top 10 Concentration</div>
          <div className="text-3xl font-extrabold text-redland-red">
            {totalRevenue ? Math.round((top10Total / totalRevenue) * 100) : 0}%
          </div>
          <div className="text-xs text-gray-500">of total won revenue</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          className="input max-w-xs"
          placeholder="Search customers…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="input max-w-xs" value={tierFilter} onChange={(e) => setTierFilter(e.target.value)}>
          <option value="">All tiers</option>
          {TIERS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <div className="card overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-redland-charcoal text-white">
            <tr>
              <th className="px-3 py-2 text-left">Cust #</th>
              <th className="px-3 py-2 text-left">Company</th>
              <th className="px-3 py-2 text-left">Aliases</th>
              <th className="px-3 py-2 text-left">Type</th>
              <th className="px-3 py-2 text-left">Tier</th>
              <th className="px-3 py-2 text-right">Projects</th>
              <th className="px-3 py-2 text-right">Won</th>
              <th className="px-3 py-2 text-right">Win Rate</th>
              <th className="px-3 py-2 text-right">Revenue</th>
              <th className="px-3 py-2 text-right">Concentration</th>
              <th className="px-3 py-2 text-left">Last Bid</th>
              {!readOnly && <th className="px-3 py-2 text-right"></th>}
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => {
              const concentration = totalRevenue ? (Number(c.totalRevenueCents) / totalRevenue) * 100 : 0;
              return (
                <tr key={c.id} className="border-t hover:bg-gray-50">
                  <td className="px-3 py-2 font-mono text-xs text-gray-600">{c.customerNumber || "—"}</td>
                  <td className="px-3 py-2 font-semibold">
                    <button onClick={() => setDetailCustomer(c)} className="text-redland-red hover:underline text-left">
                      {c.companyName}
                    </button>
                    {c.lastLook && <span className="ml-2 badge bg-redland-gold text-redland-charcoal">Last Look</span>}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-600 max-w-[180px]">
                    {(c.aliases && c.aliases.length > 0) ? (
                      <span title={c.aliases.map((a: any) => a.alias).join(", ")}>
                        {c.aliases.slice(0, 2).map((a: any) => a.alias).join(", ")}
                        {c.aliases.length > 2 && <span className="text-gray-400"> +{c.aliases.length - 2}</span>}
                      </span>
                    ) : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-3 py-2">{c.customerType.replace("_", " ")}</td>
                  <td className="px-3 py-2"><span className={`badge ${TIER_COLOR[c.tier]}`}>{c.tier}</span></td>
                  <td className="px-3 py-2 text-right">{c.totalProjects}</td>
                  <td className="px-3 py-2 text-right">{c.wonProjects}</td>
                  <td className="px-3 py-2 text-right">{Math.round(c.winRate * 100)}%</td>
                  <td className="px-3 py-2 text-right font-bold text-redland-red">{fmtMoney(c.totalRevenueCents)}</td>
                  <td className="px-3 py-2 text-right">
                    <span className={concentration > 15 ? "text-red-700 font-bold" : ""}>
                      {concentration.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-3 py-2">{fmtDate(c.lastBidDate)}</td>
                  {!readOnly && (
                    <td className="px-3 py-2 text-right">
                      <button onClick={() => setAdding(c)} className="text-redland-red text-xs font-semibold hover:underline">
                        Edit
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={readOnly ? 11 : 12} className="text-center text-gray-500 py-6">
                  No customers yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={!!detailCustomer} onClose={() => setDetailCustomer(null)} title={detailCustomer?.companyName || ""} size="lg">
        {detailCustomer && <CustomerDetail customer={detailCustomer} onChanged={load} />}
      </Modal>

      <Modal open={showAdd || !!adding} onClose={() => { setShowAdd(false); setAdding(null); }} title={adding ? "Edit Customer" : "New Customer"} size="md">
        <CustomerForm
          initial={adding}
          onSaved={() => {
            setShowAdd(false);
            setAdding(null);
            load();
          }}
          onCancel={() => {
            setShowAdd(false);
            setAdding(null);
          }}
        />
      </Modal>
    </div>
  );
}

function CustomerForm({
  initial,
  onSaved,
  onCancel,
}: {
  initial: Customer | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [f, setF] = useState({
    companyName: initial?.companyName || "",
    primaryContact: initial?.primaryContact || "",
    phone: initial?.phone || "",
    email: initial?.email || "",
    customerType: initial?.customerType || "GC",
    tier: initial?.tier || "NEW",
    lastLook: initial?.lastLook || false,
    notes: initial?.notes || "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const url = initial ? `/api/customers/${initial.id}` : "/api/customers";
      await api(url, { method: initial ? "PUT" : "POST", body: JSON.stringify(f) });
      onSaved();
    } catch (err: any) {
      setError(err.message || "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {error && <div className="bg-red-50 border border-red-200 text-red-800 text-sm rounded p-2">{error}</div>}
      <div>
        <label className="label">Company Name *</label>
        <input className="input" value={f.companyName} onChange={(e) => setF({ ...f, companyName: e.target.value })} autoFocus />
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="label">Primary Contact</label>
          <input className="input" value={f.primaryContact} onChange={(e) => setF({ ...f, primaryContact: e.target.value })} />
        </div>
        <div>
          <label className="label">Phone</label>
          <input className="input" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
        </div>
        <div>
          <label className="label">Email</label>
          <input className="input" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        </div>
        <div>
          <label className="label">Customer Type</label>
          <select className="input" value={f.customerType} onChange={(e) => setF({ ...f, customerType: e.target.value as any })}>
            <option value="GC">GC</option>
            <option value="DEVELOPER">Developer</option>
            <option value="GOVERNMENT">Government</option>
            <option value="OWNER_DIRECT">Owner-Direct</option>
          </select>
        </div>
        <div>
          <label className="label">Relationship Tier</label>
          <select className="input" value={f.tier} onChange={(e) => setF({ ...f, tier: e.target.value as any })}>
            <option value="PLATINUM">Platinum</option>
            <option value="GOLD">Gold</option>
            <option value="SILVER">Silver</option>
            <option value="NEW">New</option>
          </select>
        </div>
        <div className="flex items-center gap-2 pt-6">
          <input type="checkbox" id="lastLook" checked={f.lastLook} onChange={(e) => setF({ ...f, lastLook: e.target.checked })} className="w-4 h-4 accent-redland-red" />
          <label htmlFor="lastLook" className="text-sm font-semibold">Last Look customer</label>
        </div>
      </div>
      <div>
        <label className="label">Notes</label>
        <textarea className="input" rows={3} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
      </div>
      <div className="flex justify-end gap-2 pt-2 border-t">
        <button type="button" onClick={onCancel} className="btn-ghost">Cancel</button>
        <button type="submit" disabled={busy} className="btn-primary disabled:opacity-50">{busy ? "Saving…" : "Save"}</button>
      </div>
    </form>
  );
}

function CustomerDetail({ customer, onChanged }: { customer: Customer; onChanged?: () => void }) {
  const { user } = useAuth();
  const [summary, setSummary] = useState<any>(null);
  const [touchpoints, setTouchpoints] = useState<any>(null);
  const [aliases, setAliases] = useState<any[]>(customer.aliases || []);
  const [newAlias, setNewAlias] = useState("");
  const [otherCustomers, setOtherCustomers] = useState<any[]>([]);
  const [mergeTarget, setMergeTarget] = useState<string>("");
  const isAdmin = user?.role === "ADMIN" || user?.role === "LEADERSHIP";

  useEffect(() => {
    api(`/api/customers/${customer.id}/summary`).then(setSummary).catch(() => {});
    api(`/api/customers/${customer.id}/touchpoints`).then(setTouchpoints).catch(() => {});
    api(`/api/customers/${customer.id}/aliases`).then(setAliases).catch(() => {});
    if (isAdmin) {
      api<any[]>("/api/customers").then((rows) => setOtherCustomers(rows.filter((c) => c.id !== customer.id))).catch(() => {});
    }
  }, [customer.id, isAdmin]);

  async function addAlias() {
    if (!newAlias.trim()) return;
    try {
      await api(`/api/customers/${customer.id}/aliases`, { method: "POST", body: JSON.stringify({ alias: newAlias.trim() }) });
      setNewAlias("");
      setAliases(await api(`/api/customers/${customer.id}/aliases`));
      onChanged?.();
    } catch (e: any) {
      alert(e.message || "Failed");
    }
  }
  async function removeAlias(id: number) {
    await api(`/api/customers/aliases/${id}`, { method: "DELETE" });
    setAliases(await api(`/api/customers/${customer.id}/aliases`));
    onChanged?.();
  }
  async function doMerge() {
    if (!mergeTarget) return;
    const target = otherCustomers.find((c) => String(c.id) === mergeTarget);
    if (!target) return;
    if (!confirm(`Merge "${customer.companyName}" INTO "${target.companyName}"?\n\nAll opportunities, contacts, and compliance docs will move to ${target.companyName}.\n${customer.companyName} will be archived.\nThis is reversible only by an admin restoring the archived record.`)) return;
    const r = await api<{ opportunitiesRepointed: number; contactsRepointed: number }>(`/api/customers/${customer.id}/merge-into/${mergeTarget}`, { method: "POST" });
    alert(`Merge complete. ${r.opportunitiesRepointed} opportunities, ${r.contactsRepointed} contacts repointed.`);
    onChanged?.();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 text-sm">
        <span className="font-mono text-gray-500">{customer.customerNumber || "—"}</span>
        <span className="font-semibold">{customer.companyName}</span>
      </div>

      <div className="card p-3 bg-redland-gold/10 border-redland-gold/40">
        <div className="text-xs uppercase font-semibold text-gray-500 mb-1">Smart summary</div>
        <div className="text-sm">{summary?.summary || "Loading…"}</div>
      </div>

      <div className="card p-3">
        <div className="font-bold text-redland-charcoal mb-2 flex items-center justify-between">
          <span>Aliases / alternate names <span className="text-xs font-normal text-gray-500">({aliases.length})</span></span>
        </div>
        <p className="text-xs text-gray-600 mb-2">Add every variant you've seen this customer's name written as — "Suffolk", "Suffolk Inc", typos. Future imports will route them all here automatically.</p>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {aliases.map((a) => (
            <span key={a.id} className="badge bg-gray-100 text-gray-800 inline-flex items-center gap-1">
              {a.alias}
              <button onClick={() => removeAlias(a.id)} className="text-gray-400 hover:text-red-700 text-xs">×</button>
            </span>
          ))}
          {aliases.length === 0 && <span className="text-xs text-gray-500">No aliases yet.</span>}
        </div>
        <div className="flex gap-2">
          <input className="input flex-1 text-sm" placeholder="Add an alias…" value={newAlias} onChange={(e) => setNewAlias(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addAlias())} />
          <button onClick={addAlias} className="btn-ghost text-xs">Add</button>
        </div>
      </div>

      {isAdmin && (
        <div className="card p-3 bg-red-50/30 border-red-200">
          <div className="font-bold text-redland-charcoal mb-2">Merge into another customer</div>
          <p className="text-xs text-gray-600 mb-2">If this is a duplicate, pick the canonical record and merge — all opportunities, contacts, and compliance move to the keeper, and this name becomes an alias.</p>
          <div className="flex gap-2">
            <select className="input flex-1 text-sm" value={mergeTarget} onChange={(e) => setMergeTarget(e.target.value)}>
              <option value="">Pick the canonical customer to keep…</option>
              {otherCustomers.map((c) => (
                <option key={c.id} value={c.id}>{c.customerNumber ? `${c.customerNumber} — ` : ""}{c.companyName}</option>
              ))}
            </select>
            <button onClick={doMerge} disabled={!mergeTarget} className="btn-danger text-xs disabled:opacity-50">Merge</button>
          </div>
        </div>
      )}

      {summary && (
        <div className="grid sm:grid-cols-4 gap-2 text-center">
          <Box label="Total bids" value={String(summary.counts.total)} />
          <Box label="Won / Decided" value={`${summary.counts.won} / ${summary.counts.won + summary.counts.lost}`} />
          <Box label="Open pursuits" value={`${summary.counts.open}`} sub={fmtMoney(summary.openPipelineCents)} />
          <Box label="Lifetime won" value={fmtMoney(summary.wonRevenueCents)} />
        </div>
      )}

      {touchpoints && touchpoints.summary.length > 0 && (
        <div>
          <div className="font-bold text-redland-charcoal mb-2">Who knows who (last 24 mo)</div>
          <div className="space-y-1">
            {touchpoints.summary.map((a: any) => (
              <div key={a.id} className="flex items-center justify-between text-sm bg-gray-50 rounded p-2">
                <div>
                  <span className="font-semibold">{a.fullName}</span>
                  <span className="ml-2 text-xs text-gray-500">{a.role}</span>
                </div>
                <div className="text-xs text-gray-600">
                  {a.count} touchpoint{a.count === 1 ? "" : "s"} · last {fmtDate(a.lastAt)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {touchpoints && touchpoints.recentNotes.length > 0 && (
        <div>
          <div className="font-bold text-redland-charcoal mb-2">Recent notes</div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {touchpoints.recentNotes.map((n: any) => (
              <div key={n.id} className="border-l-2 border-redland-red pl-2 text-sm">
                <div>{n.body}</div>
                <div className="text-xs text-gray-500">
                  {n.author?.fullName} · {fmtDateTime(n.createdAt)} · <Link to={`/opportunities/${n.opportunityId}`} className="text-redland-red hover:underline">{n.opportunityName}</Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Box({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-gray-50 rounded p-2">
      <div className="text-[0.65rem] text-gray-500 uppercase font-semibold">{label}</div>
      <div className="text-lg font-extrabold text-redland-red">{value}</div>
      {sub && <div className="text-xs text-gray-500">{sub}</div>}
    </div>
  );
}
