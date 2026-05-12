import React, { useEffect, useState } from "react";
import { api } from "../api";
import { useSettings } from "../settings";
import { Opportunity, STAGES, STAGE_LABEL } from "../types";

interface Props {
  initial?: Partial<Opportunity>;
  onSaved: (o: Opportunity) => void;
  onCancel: () => void;
  quickAdd?: boolean;
}

export default function OpportunityForm({ initial, onSaved, onCancel, quickAdd }: Props) {
  const { dropdowns, settings } = useSettings();
  const [users, setUsers] = useState<any[]>([]);
  const [advanced, setAdvanced] = useState(!quickAdd);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const defaultMargin = parseFloat(settings.default_bid_margin_pct || "6");

  const [f, setF] = useState({
    projectName: initial?.projectName || "",
    customerName: initial?.customerName || "",
    customerType: initial?.customerType || "GC",
    projectType: initial?.projectType || "",
    region: initial?.region || "",
    scopeOfWork: initial?.scopeOfWork || [],
    estimatedValue:
      initial?.estimatedValueCents != null
        ? String(Number(initial.estimatedValueCents) / 100)
        : "",
    bidMarginPct: initial?.bidMarginPct ?? defaultMargin,
    expectedMarginPct: initial?.expectedMarginPct ?? "",
    bidDueDate: initial?.bidDueDate ? initial.bidDueDate.substring(0, 10) : "",
    estimatedStartDate: initial?.estimatedStartDate ? initial.estimatedStartDate.substring(0, 10) : "",
    estimatedDurationMonths: initial?.estimatedDurationMonths ?? "",
    stage: initial?.stage || "LEAD",
    bondingRequired: initial?.bondingRequired || false,
    bondAmount:
      initial?.bondAmountCents != null ? String(Number(initial.bondAmountCents) / 100) : "",
    estimatorId: initial?.estimatorId ?? "",
    pmId: initial?.pmId ?? "",
    source: initial?.source || "",
    competitive: initial?.competitive ?? true,
    lastLook: initial?.lastLook || false,
  });

  useEffect(() => {
    api("/api/users").then(setUsers).catch(() => {});
  }, []);

  function set<K extends keyof typeof f>(k: K, v: (typeof f)[K]) {
    setF({ ...f, [k]: v });
  }

  function toggleScope(s: string) {
    const exists = f.scopeOfWork.includes(s);
    set("scopeOfWork", exists ? f.scopeOfWork.filter((x) => x !== s) : [...f.scopeOfWork, s]);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!f.projectName.trim() || !f.customerName.trim()) {
      setError("Project Name and Customer Name are required.");
      return;
    }
    if (!f.estimatedValue) {
      setError("Estimated Contract Value is required.");
      return;
    }
    if (!f.bidDueDate) {
      setError("Bid Due Date is required.");
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        projectName: f.projectName,
        customerName: f.customerName,
        customerType: f.customerType,
        projectType: f.projectType,
        region: f.region,
        scopeOfWork: f.scopeOfWork,
        estimatedValue: parseFloat(f.estimatedValue) || 0,
        bidMarginPct: Number(f.bidMarginPct) || 0,
        expectedMarginPct: f.expectedMarginPct === "" ? null : Number(f.expectedMarginPct),
        bidDueDate: f.bidDueDate,
        estimatedStartDate: f.estimatedStartDate || null,
        estimatedDurationMonths:
          f.estimatedDurationMonths === "" ? null : Number(f.estimatedDurationMonths),
        stage: f.stage,
        bondingRequired: f.bondingRequired,
        bondAmount: f.bondingRequired && f.bondAmount ? parseFloat(f.bondAmount) : null,
        estimatorId: f.estimatorId === "" ? null : Number(f.estimatorId),
        pmId: f.pmId === "" ? null : Number(f.pmId),
        source: f.source || null,
        competitive: f.competitive,
        lastLook: f.lastLook,
      };
      const isEdit = !!initial?.id;
      const res = await api<Opportunity>(
        isEdit ? `/api/opportunities/${initial!.id}` : "/api/opportunities",
        {
          method: isEdit ? "PUT" : "POST",
          body: JSON.stringify(payload),
        }
      );
      onSaved(res);
    } catch (err: any) {
      setError(err.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 text-sm rounded p-2">
          {error}
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Project Name *</label>
          <input
            className="input"
            value={f.projectName}
            onChange={(e) => set("projectName", e.target.value)}
            autoFocus
          />
        </div>
        <div>
          <label className="label">Customer *</label>
          <input
            className="input"
            value={f.customerName}
            onChange={(e) => set("customerName", e.target.value)}
          />
        </div>
        <div>
          <label className="label">Estimated Value ($) *</label>
          <input
            type="number"
            min="0"
            step="0.01"
            className="input"
            value={f.estimatedValue}
            onChange={(e) => set("estimatedValue", e.target.value)}
          />
        </div>
        <div>
          <label className="label">Bid Due Date *</label>
          <input
            type="date"
            className="input"
            value={f.bidDueDate}
            onChange={(e) => set("bidDueDate", e.target.value)}
          />
        </div>
        <div>
          <label className="label">Stage</label>
          <select
            className="input"
            value={f.stage}
            onChange={(e) => set("stage", e.target.value as any)}
          >
            {STAGES.map((s) => (
              <option key={s} value={s}>
                {STAGE_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Customer Type</label>
          <select
            className="input"
            value={f.customerType}
            onChange={(e) => set("customerType", e.target.value as any)}
          >
            <option value="GC">GC</option>
            <option value="DEVELOPER">Developer</option>
            <option value="GOVERNMENT">Government</option>
            <option value="OWNER_DIRECT">Owner-Direct</option>
          </select>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setAdvanced((v) => !v)}
        className="text-sm font-semibold text-redland-red hover:text-redland-red-dark"
      >
        {advanced ? "▾ Hide details" : "▸ Show all fields"}
      </button>

      {advanced && (
        <div className="grid sm:grid-cols-2 gap-4 border-t pt-4">
          <div>
            <label className="label">Project Type</label>
            <select
              className="input"
              value={f.projectType}
              onChange={(e) => set("projectType", e.target.value)}
            >
              <option value="">— Select —</option>
              {(dropdowns.project_type || []).map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Region</label>
            <select
              className="input"
              value={f.region}
              onChange={(e) => set("region", e.target.value)}
            >
              <option value="">— Select —</option>
              {(dropdowns.region || []).map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Bid Margin %</label>
            <input
              type="number"
              step="0.1"
              className="input"
              value={f.bidMarginPct}
              onChange={(e) => set("bidMarginPct", Number(e.target.value))}
            />
          </div>
          <div>
            <label className="label">Expected Gross Margin %</label>
            <input
              type="number"
              step="0.1"
              className="input"
              value={f.expectedMarginPct as any}
              onChange={(e) => set("expectedMarginPct", e.target.value as any)}
            />
          </div>
          <div>
            <label className="label">Estimated Start Date</label>
            <input
              type="date"
              className="input"
              value={f.estimatedStartDate}
              onChange={(e) => set("estimatedStartDate", e.target.value)}
            />
          </div>
          <div>
            <label className="label">Estimated Duration (months)</label>
            <input
              type="number"
              className="input"
              value={f.estimatedDurationMonths as any}
              onChange={(e) => set("estimatedDurationMonths", e.target.value as any)}
            />
          </div>
          <div>
            <label className="label">Assigned Estimator</label>
            <select
              className="input"
              value={f.estimatorId as any}
              onChange={(e) => set("estimatorId", e.target.value as any)}
            >
              <option value="">— Unassigned —</option>
              {users
                .filter((u) => u.role === "ESTIMATOR" || u.role === "ADMIN")
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullName}
                  </option>
                ))}
            </select>
          </div>
          {f.stage === "WON" && (
            <div>
              <label className="label">Assigned PM</label>
              <select
                className="input"
                value={f.pmId as any}
                onChange={(e) => set("pmId", e.target.value as any)}
              >
                <option value="">— Unassigned —</option>
                {users
                  .filter((u) => u.role === "PM" || u.role === "ADMIN")
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.fullName}
                    </option>
                  ))}
              </select>
            </div>
          )}
          <div>
            <label className="label">Source</label>
            <select
              className="input"
              value={f.source}
              onChange={(e) => set("source", e.target.value)}
            >
              <option value="">— Select —</option>
              {(dropdowns.source || []).map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label">Scope of Work</label>
            <div className="flex flex-wrap gap-2">
              {(dropdowns.scope_of_work || []).map((s) => {
                const on = f.scopeOfWork.includes(s);
                return (
                  <button
                    type="button"
                    key={s}
                    onClick={() => toggleScope(s)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                      on
                        ? "bg-redland-red text-white border-redland-red"
                        : "bg-white border-gray-300 hover:border-redland-red"
                    }`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex items-center gap-3 pt-1">
            <input
              id="bonding"
              type="checkbox"
              checked={f.bondingRequired}
              onChange={(e) => set("bondingRequired", e.target.checked)}
              className="w-4 h-4 accent-redland-red"
            />
            <label htmlFor="bonding" className="text-sm font-semibold">
              Bonding Required
            </label>
          </div>
          {f.bondingRequired && (
            <div>
              <label className="label">Bond Amount ($)</label>
              <input
                type="number"
                className="input"
                value={f.bondAmount}
                onChange={(e) => set("bondAmount", e.target.value)}
              />
            </div>
          )}
          <div className="flex items-center gap-3 pt-1">
            <input
              id="competitive"
              type="checkbox"
              checked={f.competitive}
              onChange={(e) => set("competitive", e.target.checked)}
              className="w-4 h-4 accent-redland-red"
            />
            <label htmlFor="competitive" className="text-sm font-semibold">
              Competitive (un-check for negotiated)
            </label>
          </div>
          <div className="flex items-center gap-3 pt-1">
            <input
              id="lastlook"
              type="checkbox"
              checked={f.lastLook}
              onChange={(e) => set("lastLook", e.target.checked)}
              className="w-4 h-4 accent-redland-red"
            />
            <label htmlFor="lastlook" className="text-sm font-semibold">
              Last Look opportunity
            </label>
          </div>
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pt-2 border-t">
        <button type="button" onClick={onCancel} className="btn-ghost">
          Cancel
        </button>
        <button type="submit" disabled={saving} className="btn-primary disabled:opacity-50">
          {saving ? "Saving…" : initial?.id ? "Save changes" : "Create opportunity"}
        </button>
      </div>
    </form>
  );
}
