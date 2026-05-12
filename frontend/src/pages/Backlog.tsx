import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, fmtDate, fmtMoney } from "../api";
import { useAuth } from "../auth";
import { Opportunity } from "../types";

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-800",
  COMPLETE: "bg-gray-100 text-gray-700",
  ON_HOLD: "bg-yellow-100 text-yellow-800",
  CANCELLED: "bg-red-100 text-red-800",
};

export default function Backlog() {
  const { user } = useAuth();
  const [ops, setOps] = useState<Opportunity[]>([]);
  const readOnly = user?.role === "READ_ONLY";

  async function load() {
    const data = await api<Opportunity[]>("/api/opportunities?stage=WON");
    setOps(data);
  }
  useEffect(() => {
    load();
  }, []);

  async function updateStatus(id: number, backlogStatus: string) {
    await api(`/api/opportunities/${id}`, {
      method: "PUT",
      body: JSON.stringify({ backlogStatus }),
    });
    load();
  }

  const totalBacklog = ops
    .filter((o) => o.backlogStatus === "ACTIVE")
    .reduce((a, o) => a + Number(o.actualValueCents ?? o.estimatedValueCents), 0);

  // Group by quarter (estimated start)
  const byQuarter = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of ops) {
      if (o.backlogStatus !== "ACTIVE") continue;
      const d = o.estimatedStartDate ? new Date(o.estimatedStartDate) : null;
      if (!d) continue;
      const q = Math.floor(d.getMonth() / 3) + 1;
      const key = `Q${q} ${d.getFullYear()}`;
      m.set(key, (m.get(key) || 0) + Number(o.actualValueCents ?? o.estimatedValueCents));
    }
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [ops]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold text-redland-charcoal">Backlog Overview</h1>
        <p className="text-sm text-gray-600">Read-only summary of all Won opportunities</p>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <div className="card p-4">
          <div className="text-xs text-gray-500 uppercase font-semibold">Total Active Backlog</div>
          <div className="text-3xl font-extrabold text-redland-red">{fmtMoney(totalBacklog)}</div>
          <div className="text-xs text-gray-500">{ops.filter((o) => o.backlogStatus === "ACTIVE").length} active projects</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-gray-500 uppercase font-semibold">Won (All Time)</div>
          <div className="text-3xl font-extrabold text-redland-charcoal">{ops.length}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-gray-500 uppercase font-semibold">By Quarter</div>
          <div className="space-y-0.5 mt-1">
            {byQuarter.map(([q, v]) => (
              <div key={q} className="flex justify-between text-sm">
                <span className="font-semibold">{q}</span>
                <span>{fmtMoney(v)}</span>
              </div>
            ))}
            {byQuarter.length === 0 && <div className="text-sm text-gray-500">No start dates set.</div>}
          </div>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-redland-charcoal text-white">
            <tr>
              <th className="px-3 py-2 text-left">Project</th>
              <th className="px-3 py-2 text-left">Customer</th>
              <th className="px-3 py-2 text-right">Contract</th>
              <th className="px-3 py-2 text-right">Expected Margin</th>
              <th className="px-3 py-2 text-left">PM</th>
              <th className="px-3 py-2 text-left">Start</th>
              <th className="px-3 py-2 text-left">Duration</th>
              <th className="px-3 py-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {ops.map((o) => (
              <tr key={o.id} className="border-t">
                <td className="px-3 py-2">
                  <Link to={`/opportunities/${o.id}`} className="font-semibold text-redland-red hover:underline">
                    {o.projectName}
                  </Link>
                  <div className="text-xs text-gray-500 font-mono">{o.projectNumber}</div>
                </td>
                <td className="px-3 py-2">{o.customerName}</td>
                <td className="px-3 py-2 text-right font-bold">{fmtMoney(o.actualValueCents ?? o.estimatedValueCents)}</td>
                <td className="px-3 py-2 text-right">{o.expectedMarginPct ? `${o.expectedMarginPct}%` : "—"}</td>
                <td className="px-3 py-2">{o.pm?.fullName || "—"}</td>
                <td className="px-3 py-2">{fmtDate(o.estimatedStartDate)}</td>
                <td className="px-3 py-2">{o.estimatedDurationMonths ? `${o.estimatedDurationMonths} mo` : "—"}</td>
                <td className="px-3 py-2">
                  {readOnly ? (
                    <span className={`badge ${STATUS_COLOR[o.backlogStatus]}`}>{o.backlogStatus}</span>
                  ) : (
                    <select
                      value={o.backlogStatus}
                      onChange={(e) => updateStatus(o.id, e.target.value)}
                      className={`px-2 py-1 rounded text-xs font-semibold border ${STATUS_COLOR[o.backlogStatus]}`}
                    >
                      <option value="ACTIVE">Active</option>
                      <option value="COMPLETE">Complete</option>
                      <option value="ON_HOLD">On Hold</option>
                      <option value="CANCELLED">Cancelled</option>
                    </select>
                  )}
                </td>
              </tr>
            ))}
            {ops.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center text-gray-500 py-6">
                  No won projects yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
