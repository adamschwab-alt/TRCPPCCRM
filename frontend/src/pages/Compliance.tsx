import React, { useEffect, useMemo, useState } from "react";
import { api, fmtDate } from "../api";
import { useAuth } from "../auth";
import Modal from "../components/Modal";

const TYPES = ["COI", "W9", "LICENSE", "MBE", "WBE", "DBE", "OTHER"] as const;
const TYPE_LABEL: Record<string, string> = {
  COI: "Certificate of Insurance",
  W9: "W-9",
  LICENSE: "License",
  MBE: "MBE certification",
  WBE: "WBE certification",
  DBE: "DBE certification",
  OTHER: "Other",
};

export default function Compliance() {
  const { user } = useAuth();
  const [docs, setDocs] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [filter, setFilter] = useState<"all" | "expiring" | "expired">("all");
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const readOnly = user?.role === "READ_ONLY";

  async function load() {
    const [d, c] = await Promise.all([
      api<any[]>("/api/compliance-docs"),
      api<any[]>("/api/customers"),
    ]);
    setDocs(d);
    setCustomers(c);
  }
  useEffect(() => { load(); }, []);

  const now = new Date();
  const in30 = new Date(Date.now() + 30 * 86_400_000);
  const filtered = useMemo(() => {
    return docs.filter((d) => {
      if (filter === "all") return true;
      if (!d.expiresAt) return false;
      const exp = new Date(d.expiresAt);
      if (filter === "expired") return exp < now;
      if (filter === "expiring") return exp >= now && exp <= in30;
      return true;
    });
  }, [docs, filter]);

  const stats = useMemo(() => {
    let expired = 0, expiring = 0;
    for (const d of docs) {
      if (!d.expiresAt) continue;
      const e = new Date(d.expiresAt);
      if (e < now) expired++;
      else if (e <= in30) expiring++;
    }
    return { expired, expiring };
  }, [docs]);

  async function remove(id: number) {
    if (!confirm("Archive this document?")) return;
    await api(`/api/compliance-docs/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-extrabold text-redland-charcoal">Compliance Vault</h1>
          <p className="text-sm text-gray-600">COIs, W-9s, licenses, MBE/WBE/DBE certifications — track expirations.</p>
        </div>
        {!readOnly && (
          <button onClick={() => setShowAdd(true)} className="btn-gold">+ New Document</button>
        )}
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <Stat label="Total docs" value={docs.length} />
        <Stat label="Expiring (30 days)" value={stats.expiring} highlight={stats.expiring > 0 ? "yellow" : undefined} />
        <Stat label="Expired" value={stats.expired} highlight={stats.expired > 0 ? "red" : undefined} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(["all", "expiring", "expired"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${filter === f ? "bg-redland-charcoal text-white border-redland-charcoal" : "bg-white border-gray-300"}`}
          >
            {f === "all" ? "All" : f === "expiring" ? "Expiring soon" : "Expired"}
          </button>
        ))}
      </div>

      <div className="card overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-redland-charcoal text-white">
            <tr>
              <th className="px-3 py-2 text-left">Type</th>
              <th className="px-3 py-2 text-left">Label</th>
              <th className="px-3 py-2 text-left">Customer</th>
              <th className="px-3 py-2 text-left">Expires</th>
              <th className="px-3 py-2 text-left">Notes</th>
              {!readOnly && <th className="px-3 py-2 text-right"></th>}
            </tr>
          </thead>
          <tbody>
            {filtered.map((d) => {
              const exp = d.expiresAt ? new Date(d.expiresAt) : null;
              const cls = !exp ? "" : exp < now ? "text-red-700 font-bold" : exp <= in30 ? "text-yellow-700 font-bold" : "";
              return (
                <tr key={d.id} className="border-t">
                  <td className="px-3 py-2 font-semibold"><span className="badge bg-gray-100 text-gray-800">{d.docType}</span></td>
                  <td className="px-3 py-2">{d.label || TYPE_LABEL[d.docType]}</td>
                  <td className="px-3 py-2">{d.customer?.companyName || "—"}</td>
                  <td className={`px-3 py-2 ${cls}`}>{exp ? fmtDate(exp) : "—"}</td>
                  <td className="px-3 py-2 text-xs text-gray-600 max-w-[200px] truncate" title={d.notes}>{d.notes || ""}</td>
                  {!readOnly && (
                    <td className="px-3 py-2 text-right space-x-2 whitespace-nowrap">
                      <button onClick={() => setEditing(d)} className="text-redland-red text-xs font-semibold hover:underline">Edit</button>
                      <button onClick={() => remove(d.id)} className="text-red-700 text-xs font-semibold hover:underline">Archive</button>
                    </td>
                  )}
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={readOnly ? 5 : 6} className="text-center text-gray-500 py-6">No documents tracked yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={showAdd || !!editing} onClose={() => { setShowAdd(false); setEditing(null); }} title={editing ? "Edit Document" : "New Document"} size="md">
        <DocForm
          customers={customers}
          initial={editing}
          onSaved={() => { setShowAdd(false); setEditing(null); load(); }}
          onCancel={() => { setShowAdd(false); setEditing(null); }}
        />
      </Modal>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: number; highlight?: "red" | "yellow" }) {
  const color = highlight === "red" ? "text-red-700" : highlight === "yellow" ? "text-yellow-700" : "text-redland-red";
  return (
    <div className="card p-4">
      <div className="text-xs text-gray-500 uppercase font-semibold">{label}</div>
      <div className={`text-3xl font-extrabold ${color}`}>{value}</div>
    </div>
  );
}

function DocForm({ customers, initial, onSaved, onCancel }: { customers: any[]; initial: any | null; onSaved: () => void; onCancel: () => void }) {
  const [f, setF] = useState({
    docType: initial?.docType || "COI",
    label: initial?.label || "",
    customerId: initial?.customerId || "",
    expiresAt: initial?.expiresAt ? initial.expiresAt.substring(0, 10) : "",
    notes: initial?.notes || "",
  });
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const payload: any = {
        docType: f.docType,
        label: f.label || null,
        customerId: f.customerId ? Number(f.customerId) : null,
        expiresAt: f.expiresAt || null,
        notes: f.notes || null,
      };
      const url = initial ? `/api/compliance-docs/${initial.id}` : "/api/compliance-docs";
      await api(url, { method: initial ? "PUT" : "POST", body: JSON.stringify(payload) });
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="label">Type</label>
          <select className="input" value={f.docType} onChange={(e) => setF({ ...f, docType: e.target.value })}>
            {TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Label (optional)</label>
          <input className="input" value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} placeholder="e.g. General Liability 2026" />
        </div>
        <div>
          <label className="label">Customer (optional)</label>
          <select className="input" value={f.customerId} onChange={(e) => setF({ ...f, customerId: e.target.value })}>
            <option value="">— Not tied to a customer —</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.companyName}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Expires</label>
          <input type="date" className="input" value={f.expiresAt} onChange={(e) => setF({ ...f, expiresAt: e.target.value })} />
        </div>
      </div>
      <div>
        <label className="label">Notes</label>
        <textarea className="input" rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
      </div>
      <div className="flex justify-end gap-2 pt-2 border-t">
        <button type="button" onClick={onCancel} className="btn-ghost">Cancel</button>
        <button type="submit" disabled={busy} className="btn-primary disabled:opacity-50">{busy ? "Saving…" : "Save"}</button>
      </div>
    </form>
  );
}
