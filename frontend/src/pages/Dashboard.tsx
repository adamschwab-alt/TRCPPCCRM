import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api, fmtMoney } from "../api";
import { useSettings } from "../settings";
import { STAGE_COLOR, STAGE_LABEL, STAGES, Stage } from "../types";

const COLORS = ["#8B1A1A", "#C9A84C", "#2D2D2D", "#6e1414", "#dcc16f", "#888", "#a52424"];

export default function Dashboard() {
  const { settings, enabled } = useSettings();
  const [summary, setSummary] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    api("/api/analytics/summary").then(setSummary).catch(() => {});
    api("/api/users").then(setUsers).catch(() => {});
  }, []);

  if (!summary) return <div className="text-gray-500">Loading dashboard…</div>;

  const capacity = parseInt(settings.estimator_capacity_threshold || "5", 10);

  const totalWonValue = summary.byStage?.WON
    ? Number(summary.byStage.WON.valueCents)
    : 0;
  const pipelineValue = STAGES.filter(
    (s) => !["WON", "LOST", "NO_BID", "WITHDRAWN"].includes(s)
  ).reduce((a, s) => a + (summary.byStage?.[s] ? Number(summary.byStage[s].valueCents) : 0), 0);

  const last3 = summary.monthly.slice(-3);
  const last6 = summary.monthly.slice(-6);
  const last12 = summary.monthly;
  const winRateFor = (arr: any[]) => {
    const w = arr.reduce((a, b) => a + b.wins, 0);
    const l = arr.reduce((a, b) => a + b.losses, 0);
    return w + l === 0 ? 0 : w / (w + l);
  };
  const winRate3 = winRateFor(last3);
  const winRate6 = winRateFor(last6);
  const winRate12 = winRateFor(last12);

  const lossPie = Object.entries(summary.lossReasons || {}).map(([k, v]) => ({
    name: k,
    value: v as number,
  }));

  const topCust = (summary.topCustomers || []).slice(0, 5);
  const totalRevenue = topCust.reduce((a: number, c: any) => a + Number(c.revenueCents), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-redland-charcoal">Dashboard</h1>
        <p className="text-sm text-gray-600">Pipeline at a glance</p>
      </div>

      {/* Priority widgets */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="card p-4">
          <div className="font-bold text-redland-charcoal mb-3">Pipeline by Stage</div>
          <div className="space-y-1">
            {STAGES.map((s) => {
              const v = summary.byStage?.[s];
              const count = v?.count || 0;
              const val = v ? Number(v.valueCents) : 0;
              const totalCount = STAGES.reduce((a, x) => a + (summary.byStage?.[x]?.count || 0), 0);
              const pct = totalCount ? (count / totalCount) * 100 : 0;
              return (
                <div key={s} className="flex items-center gap-2">
                  <div className="w-28 text-xs"><span className={`badge ${STAGE_COLOR[s]}`}>{STAGE_LABEL[s]}</span></div>
                  <div className="flex-1 bg-gray-100 h-5 rounded overflow-hidden">
                    <div className="h-full bg-redland-red" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="w-10 text-right font-bold text-sm">{count}</div>
                  <div className="w-20 text-right text-xs text-gray-600">{fmtMoney(val)}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card p-4">
          <div className="font-bold text-redland-charcoal mb-3">Win Rate</div>
          <div className="grid grid-cols-3 text-center mb-3">
            <Stat label="3-mo" value={`${(winRate3 * 100).toFixed(0)}%`} />
            <Stat label="6-mo" value={`${(winRate6 * 100).toFixed(0)}%`} />
            <Stat label="12-mo" value={`${(winRate12 * 100).toFixed(0)}%`} />
          </div>
          <ResponsiveContainer width="100%" height={120}>
            <LineChart data={summary.monthly}>
              <Line
                type="monotone"
                dataKey={(d) => (d.wins + d.losses ? (d.wins / (d.wins + d.losses)) * 100 : null)}
                stroke="#8B1A1A"
                strokeWidth={2}
                dot={false}
                name="Win %"
                connectNulls
              />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} />
              <Tooltip />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {enabled("estimator_workload") && (
          <div className="card p-4">
            <div className="font-bold text-redland-charcoal mb-3">Estimator Capacity</div>
            <div className="space-y-2">
              {users
                .filter((u) => u.role === "ESTIMATOR" || u.role === "ADMIN")
                .map((u) => {
                  const s = summary.estimatorStats?.[u.id] || { active: 0 };
                  const pct = Math.min(100, (s.active / capacity) * 100);
                  const color =
                    s.active >= capacity ? "bg-red-500" :
                    s.active >= capacity * 0.8 ? "bg-yellow-500" :
                    "bg-green-500";
                  return (
                    <div key={u.id} className="text-sm">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="font-semibold">{u.fullName}</span>
                        <span className="text-xs text-gray-600">{s.active} / {capacity}</span>
                      </div>
                      <div className="bg-gray-100 h-2 rounded overflow-hidden">
                        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </div>

      {/* Secondary widgets */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="card p-4">
          <div className="font-bold text-redland-charcoal mb-1">Total Backlog</div>
          <div className="text-3xl font-extrabold text-redland-red">{fmtMoney(summary.backlogCents)}</div>
          <div className="text-xs text-gray-600 mt-1">All Won opportunities · {summary.byStage?.WON?.count || 0} projects</div>
          <div className="mt-2 text-sm">
            <div className="text-xs text-gray-500 uppercase">Active Pipeline</div>
            <div className="font-bold">{fmtMoney(pipelineValue)}</div>
          </div>
        </div>

        <div className="card p-4">
          <div className="font-bold text-redland-charcoal mb-3">Bid Activity (12-mo)</div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={summary.monthly}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: "0.75rem" }} />
              <Bar dataKey="bids" name="Bids" fill="#2D2D2D" />
              <Bar dataKey="wins" name="Wins" fill="#8B1A1A" />
              <Bar dataKey="losses" name="Losses" fill="#C9A84C" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-4">
          <div className="font-bold text-redland-charcoal mb-2">Top 5 Customers (won $)</div>
          {topCust.length === 0 && <div className="text-sm text-gray-500">No data yet.</div>}
          <div className="space-y-1">
            {topCust.map((c: any, i: number) => {
              const pct = totalRevenue ? (Number(c.revenueCents) / totalRevenue) * 100 : 0;
              const concentration = totalWonValue ? (Number(c.revenueCents) / totalWonValue) * 100 : 0;
              return (
                <div key={c.name} className="text-sm">
                  <div className="flex justify-between">
                    <span className="font-semibold truncate">{c.name}</span>
                    <span className="text-xs">{fmtMoney(c.revenueCents)}</span>
                  </div>
                  <div className="bg-gray-100 h-1.5 rounded overflow-hidden">
                    <div className={`h-full ${concentration > 15 ? "bg-red-500" : "bg-redland-red"}`} style={{ width: `${pct}%` }} />
                  </div>
                  {concentration > 15 && (
                    <div className="text-[0.65rem] text-red-700 font-semibold">⚠ {concentration.toFixed(0)}% of total won</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="card p-4">
          <div className="font-bold text-redland-charcoal mb-3">Geographic Mix (Pipeline)</div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={Object.entries(summary.rateByRegion).map(([k, v]: any) => ({
                  name: k || "Unknown",
                  value: v.total,
                }))}
                dataKey="value"
                outerRadius={70}
                label={(e) => e.name}
              >
                {Object.keys(summary.rateByRegion).map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-4">
          <div className="font-bold text-redland-charcoal mb-3">Loss Reasons</div>
          {lossPie.length === 0 ? (
            <div className="text-sm text-gray-500">No losses recorded.</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={lossPie} dataKey="value" outerRadius={70} label={(e) => e.name}>
                  {lossPie.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card p-4">
          <div className="font-bold text-redland-charcoal mb-3">Alerts</div>
          <div className="space-y-2 text-sm">
            {summary.overdueCount > 0 && (
              <Link to="/pipeline" className="block bg-red-50 border border-red-200 rounded p-2 hover:bg-red-100">
                <span className="font-bold text-red-800">{summary.overdueCount}</span>
                <span className="text-red-800"> overdue bid{summary.overdueCount === 1 ? "" : "s"} (past due, not decided)</span>
              </Link>
            )}
            {users
              .filter((u) => u.role === "ESTIMATOR" || u.role === "ADMIN")
              .filter((u) => (summary.estimatorStats?.[u.id]?.active || 0) >= capacity)
              .map((u) => (
                <div key={u.id} className="bg-yellow-50 border border-yellow-200 rounded p-2">
                  <span className="font-bold">{u.fullName}</span> over capacity
                </div>
              ))}
            {summary.overdueCount === 0 && (
              <div className="text-gray-500">No alerts. All clear.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-gray-500 uppercase">{label}</div>
      <div className="text-xl font-extrabold text-redland-red">{value}</div>
    </div>
  );
}
