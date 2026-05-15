import React, { useState } from "react";
import { api } from "../api";
import { useSettings } from "../settings";

type Axis = "client" | "project" | "competition";

const CRITERIA: { key: string; label: string; weightKey: string; help: string; axis: Axis }[] = [
  // Client axis
  { key: "customerScore", label: "Customer Relationship", weightKey: "weight_customer", help: "repeat / strategic vs. new", axis: "client" },
  { key: "geoScore", label: "Geographic Fit", weightKey: "weight_geo", help: "core SE FL vs. expansion market", axis: "client" },
  { key: "strategicScore", label: "Strategic Value", weightKey: "weight_strategic", help: "new market, reference, etc.", axis: "client" },
  // Project axis
  { key: "marginScore", label: "Margin Attractiveness", weightKey: "weight_margin", help: "estimated margin vs. company average", axis: "project" },
  { key: "scopeRiskScore", label: "Scope Complexity / Risk", weightKey: "weight_scope_risk", help: "standard vs. specialty / high-risk", axis: "project" },
  { key: "bondRiskScore", label: "Bond / Insurance Risk", weightKey: "weight_bond_risk", help: "size vs. bonding capacity", axis: "project" },
  // Competition axis
  { key: "resourceScore", label: "Resource Availability", weightKey: "weight_resource", help: "estimator + PM capacity right now", axis: "competition" },
];

const AXIS_LABEL: Record<Axis, string> = { client: "Client", project: "Project", competition: "Competition" };

export default function GoNoGoForm({
  opportunityId,
  onSaved,
  onCancel,
}: {
  opportunityId: number;
  onSaved: (rec: any) => void;
  onCancel: () => void;
}) {
  const { settings } = useSettings();
  const [scores, setScores] = useState<Record<string, number>>(
    Object.fromEntries(CRITERIA.map((c) => [c.key, 3]))
  );
  const [decision, setDecision] = useState<"GO" | "NO_GO" | "DEFER">("GO");
  const [conditions, setConditions] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function composite() {
    let s = 0;
    for (const c of CRITERIA) {
      const w = parseFloat(settings[c.weightKey] || "0");
      s += (scores[c.key] / 5) * w;
    }
    return s;
  }

  function axisScore(axis: Axis): number {
    const crits = CRITERIA.filter((c) => c.axis === axis);
    const totalWeight = crits.reduce((a, c) => a + parseFloat(settings[c.weightKey] || "0"), 0);
    if (totalWeight === 0) return 0;
    let s = 0;
    for (const c of crits) {
      const w = parseFloat(settings[c.weightKey] || "0");
      s += (scores[c.key] / 5) * 100 * w;
    }
    return s / totalWeight;
  }

  const compositeVal = composite();
  const color =
    compositeVal > 70 ? "bg-green-100 text-green-800" :
    compositeVal >= 50 ? "bg-yellow-100 text-yellow-800" :
    "bg-red-100 text-red-800";

  const axisScores: Record<Axis, number> = {
    client: axisScore("client"),
    project: axisScore("project"),
    competition: axisScore("competition"),
  };

  async function submit() {
    setBusy(true);
    setError("");
    try {
      const res = await api(`/api/opportunities/${opportunityId}/go-no-go`, {
        method: "POST",
        body: JSON.stringify({ ...scores, decision, conditions: conditions || null }),
      });
      onSaved(res);
    } catch (e: any) {
      setError(e.message || "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 text-sm rounded p-2">
          {error}
        </div>
      )}
      {(["client", "project", "competition"] as const).map((axis) => {
        const s = axisScores[axis];
        const axisColor = s >= 70 ? "bg-green-500" : s >= 50 ? "bg-yellow-500" : "bg-red-500";
        return (
          <div key={axis} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold uppercase text-redland-charcoal">{AXIS_LABEL[axis]}</div>
              <div className="flex items-center gap-2 text-xs">
                <div className="w-32 h-2 bg-gray-100 rounded overflow-hidden">
                  <div className={`h-full ${axisColor}`} style={{ width: `${s}%` }} />
                </div>
                <span className="font-bold w-10 text-right">{s.toFixed(0)}</span>
              </div>
            </div>
            {CRITERIA.filter((c) => c.axis === axis).map((c) => (
              <div key={c.key} className="card p-3">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="font-semibold text-sm">{c.label}</div>
                    <div className="text-xs text-gray-500">{c.help} · weight {settings[c.weightKey]}%</div>
                  </div>
                  <div className="text-lg font-extrabold text-redland-red">{scores[c.key]}</div>
                </div>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setScores({ ...scores, [c.key]: n })}
                      className={`flex-1 py-2 rounded text-sm font-bold border ${
                        scores[c.key] === n
                          ? "bg-redland-red text-white border-redland-red"
                          : "bg-white border-gray-300 hover:border-redland-red"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        );
      })}

      <div className={`card p-3 flex items-center justify-between ${color}`}>
        <div className="font-bold">Composite Score</div>
        <div className="text-2xl font-extrabold">{compositeVal.toFixed(1)} / 100</div>
      </div>

      <div className="grid sm:grid-cols-3 gap-2">
        {(["GO", "NO_GO", "DEFER"] as const).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDecision(d)}
            className={`py-3 rounded font-bold ${
              decision === d
                ? d === "GO"
                  ? "bg-green-600 text-white"
                  : d === "NO_GO"
                  ? "bg-red-600 text-white"
                  : "bg-yellow-500 text-white"
                : "bg-white border border-gray-300 text-redland-charcoal"
            }`}
          >
            {d === "NO_GO" ? "NO GO" : d}
          </button>
        ))}
      </div>

      <div>
        <label className="label">Conditions / Notes (optional)</label>
        <textarea
          className="input"
          rows={3}
          value={conditions}
          onChange={(e) => setConditions(e.target.value)}
        />
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t">
        <button onClick={onCancel} className="btn-ghost" disabled={busy}>Cancel</button>
        <button onClick={submit} disabled={busy} className="btn-primary disabled:opacity-50">
          {busy ? "Saving…" : "Submit decision"}
        </button>
      </div>
    </div>
  );
}
