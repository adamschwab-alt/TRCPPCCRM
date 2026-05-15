import React, { useEffect, useMemo, useState } from "react";
import { api, fmtDate } from "../api";
import { useAuth } from "../auth";
import Modal from "../components/Modal";
import ExportButton from "../components/ExportButton";

export default function Contacts() {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<any | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const readOnly = user?.role === "READ_ONLY";

  async function load() {
    const [c, cu] = await Promise.all([
      api<any[]>(`/api/contacts${search ? `?search=${encodeURIComponent(search)}` : ""}`),
      api<any[]>("/api/customers"),
    ]);
    setContacts(c);
    setCustomers(cu);
  }
  useEffect(() => { load(); }, [search]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-extrabold text-redland-charcoal">Contacts</h1>
          <p className="text-sm text-gray-600">People we deal with. Employment history is preserved when contacts move between companies.</p>
        </div>
        <div className="flex gap-2">
          <ExportButton path="/api/exports/contacts.xlsx" />
          {!readOnly && <button onClick={() => setShowAdd(true)} className="btn-gold">+ New Contact</button>}
        </div>
      </div>

      <input
        className="input max-w-xs"
        placeholder="Search by name or email…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="card overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-redland-charcoal text-white">
            <tr>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">Title</th>
              <th className="px-3 py-2 text-left">Current employer</th>
              <th className="px-3 py-2 text-left">Email</th>
              <th className="px-3 py-2 text-left">Phone</th>
              <th className="px-3 py-2 text-left">History</th>
              {!readOnly && <th className="px-3 py-2 text-right"></th>}
            </tr>
          </thead>
          <tbody>
            {contacts.map((c) => (
              <tr key={c.id} className="border-t hover:bg-gray-50">
                <td className="px-3 py-2 font-semibold">{c.fullName}</td>
                <td className="px-3 py-2">{c.title || "—"}</td>
                <td className="px-3 py-2">{c.currentCustomer?.companyName || "—"}</td>
                <td className="px-3 py-2 text-xs">{c.email || "—"}</td>
                <td className="px-3 py-2 text-xs">{c.phone || "—"}</td>
                <td className="px-3 py-2 text-xs text-gray-600">
                  {(c.employmentHistory || []).slice(0, 3).map((e: any) => (
                    <div key={e.id}>{e.customerName} <span className="text-gray-400">({fmtDate(e.startedAt)} — {e.endedAt ? fmtDate(e.endedAt) : "now"})</span></div>
                  ))}
                </td>
                {!readOnly && (
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => setEditing(c)} className="text-redland-red text-xs font-semibold hover:underline">Edit</button>
                  </td>
                )}
              </tr>
            ))}
            {contacts.length === 0 && (
              <tr><td colSpan={readOnly ? 6 : 7} className="text-center text-gray-500 py-6">No contacts yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={showAdd || !!editing} onClose={() => { setShowAdd(false); setEditing(null); }} title={editing ? "Edit Contact" : "New Contact"} size="md">
        <ContactForm
          customers={customers}
          initial={editing}
          onSaved={() => { setShowAdd(false); setEditing(null); load(); }}
          onCancel={() => { setShowAdd(false); setEditing(null); }}
        />
      </Modal>
    </div>
  );
}

function ContactForm({ customers, initial, onSaved, onCancel }: { customers: any[]; initial: any | null; onSaved: () => void; onCancel: () => void }) {
  const [f, setF] = useState({
    fullName: initial?.fullName || "",
    title: initial?.title || "",
    email: initial?.email || "",
    phone: initial?.phone || "",
    currentCustomerId: initial?.currentCustomerId || "",
    notes: initial?.notes || "",
  });
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const payload: any = {
        fullName: f.fullName,
        title: f.title || null,
        email: f.email || null,
        phone: f.phone || null,
        currentCustomerId: f.currentCustomerId ? Number(f.currentCustomerId) : null,
        notes: f.notes || null,
      };
      const url = initial ? `/api/contacts/${initial.id}` : "/api/contacts";
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
          <label className="label">Full name *</label>
          <input className="input" value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} required autoFocus />
        </div>
        <div>
          <label className="label">Title</label>
          <input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        </div>
        <div>
          <label className="label">Email</label>
          <input className="input" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        </div>
        <div>
          <label className="label">Phone</label>
          <input className="input" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Current employer</label>
          <select className="input" value={f.currentCustomerId} onChange={(e) => setF({ ...f, currentCustomerId: e.target.value })}>
            <option value="">— Not assigned —</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.companyName}</option>)}
          </select>
          {initial?.employmentHistory?.length > 0 && (
            <p className="text-xs text-gray-500 mt-1">Changing this preserves history — the previous employment is closed and a new one is opened.</p>
          )}
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
