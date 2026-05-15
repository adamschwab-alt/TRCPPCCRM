import React, { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import { api, fmtMoney } from "../api";

const COLORS = ["#8B1A1A", "#C9A84C", "#2D2D2D", "#6e1414", "#dcc16f", "#a52424", "#888"];

export default function BidAnalytics() {
  const [s, setS] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    api("/api/analytics/summary").then(setS);
    api("/api/users").then(setUsers).catch(() => {});
  }, []);

  if (!s) return <div className="text-gray-500">Loading…</div>;

  const lossPie = Object.entries(s.lossReasons || {}).map(([k, v]) => ({ name: k, value: v as number }));
  const noBidPie = Object.entries(s.noBidReasons || {}).map(([k, v]) => ({ name: k, value: v as number }));

  function weightedHitRateTable(title: string, groups: any, opts?: { topN?: number; nameMap?: Record<string, string> }) {
    const rows = Object.entries(groups || {})
      .map(([k, v]: any) => {
        const won = Number(v.wonCents);
        const pursued = Number(v.pursuedCents);
        return {
          name: opts?.nameMap?.[k] ?? k,
          wonCents: won,
          pursuedCents: pursued,
          wonCount: v.wonCount,
          pursuedCount: v.pursuedCount,
          hitRate: pursued > 0 ? won / pursued : 0,
        };
      })
      .sort((a, b) => b.pursuedCents - a.pursuedCents);
    const top = opts?.topN ? rows.slice(0, opts.topN) : rows;
    return (
      <div className="card p-4">
        <div className="font-bold text-redland-charcoal mb-2">{title}</div>
        <table className="w-full text-sm">
          <thead className="text-xs text-gray-500 uppercase">
            <tr>
              <th className="text-left py-1">Group</th>
              <th className="text-right">Bid $</th>
              <th className="text-right">Won $</th>
              <th className="text-right">Hit $</th>
              <th className="text-right">Hit #</th>
            </tr>
          </thead>
          <tbody>
            {top.map((r) => (
              <tr key={r.name} className="border-t">
                <td className="py-1.5 font-semibold truncate max-w-[200px]">{r.name}</td>
                <td className="text-right">{fmtMoney(r.pursuedCents)}</td>
                <td className="text-right">{fmtMoney(r.wonCents)}</td>
                <td className="text-right">
                  <span className={`font-bold ${r.hitRate >= 0.5 ? "text-green-700" : r.hitRate >= 0.25 ? "text-yellow-700" : "text-red-700"}`}>
                    {Math.round(r.hitRate * 100)}%
                  </span>
                </td>
                <td className="text-right text-xs text-gray-500">{r.wonCount} / {r.pursuedCount}</td>
              </tr>
            ))}
            {top.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-gray-500 py-4">No decided bids yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  }

  const estimatorNames: Record<string, string> = {};
  for (const u of users) estimatorNames[String(u.id)] = u.fullName;
  const tierLabels: Record<string, string> = {
    PLATINUM: "Platinum",
    GOLD: "Gold",
    SILVER: "Silver",
    NEW: "New",
    UNTIERED: "Untiered",
  };

  function rateTable(title: string, groups: any) {
    return (
      <div className="card p-4">
        <div className="font-bold text-redland-charcoal mb-2">{title}</div>
        <table className="w-full text-sm">
          <thead className="text-xs text-gray-500 uppercase">
            <tr>
              <th className="text-left py-1">Group</th>
              <th className="text-right">Bids</th>
              <th className="text-right">Wins</th>
              <th className="text-right">Win %</th>
              <th className="text-right">Value</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(groups).map(([k, v]: any) => (
              <tr key={k} className="border-t">
                <td className="py-1.5 font-semibold">{k || "Unknown"}</td>
                <td className="text-right">{v.total}</td>
                <td className="text-right">{v.won}</td>
                <td className="text-right">{v.won + v.lost ? Math.round((v.won / (v.won + v.lost)) * 100) : 0}%</td>
                <td className="text-right">{fmtMoney(Number(v.valueCents))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold text-redland-charcoal">Bid Tracking &amp; Analytics</h1>
        <p className="text-sm text-gray-600">Win/loss performance, trends, and bid behavior</p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Overall Win Rate" value={`${Math.round(s.counts.winRate * 100)}%`} />
        <Kpi label="Total Bids" value={s.counts.total} />
        <Kpi label="Wins" value={s.counts.won} />
        <Kpi label="Losses" value={s.counts.lost} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card p-4">
          <div className="font-bold text-redland-charcoal mb-2">Bid Volume (12-mo)</div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={s.monthly}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: "0.75rem" }} />
              <Bar dataKey="bids" fill="#2D2D2D" name="Submitted" />
              <Bar dataKey="wins" fill="#8B1A1A" name="Won" />
              <Bar dataKey="losses" fill="#C9A84C" name="Lost" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card p-4">
          <div className="font-bold text-redland-charcoal mb-2">Win Rate Trend</div>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={s.monthly}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey={(d) => (d.wins + d.losses ? Math.round((d.wins / (d.wins + d.losses)) * 100) : null)}
                stroke="#8B1A1A"
                strokeWidth={2}
                name="Win %"
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-xs uppercase font-bold text-gray-500 tracking-wide">Weighted hit rate ($ won / $ bid) — Vantagepoint-style, the metric that matters most</div>
        <div className="grid lg:grid-cols-2 gap-4">
          {weightedHitRateTable("Top customers", s.hitRateByCustomer, { topN: 12 })}
          {weightedHitRateTable("By customer tier", s.hitRateByTier, { nameMap: tierLabels })}
          {weightedHitRateTable("By estimator", s.hitRateByEstimator, { nameMap: estimatorNames })}
          {weightedHitRateTable("By customer type", s.hitRateByCustomerType, { nameMap: { GC: "GC", DEVELOPER: "Developer", GOVERNMENT: "Government", OWNER_DIRECT: "Owner-Direct" } })}
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-xs uppercase font-bold text-gray-500 tracking-wide">Count-based win rate (legacy view)</div>
        <div className="grid lg:grid-cols-3 gap-4">
          {rateTable("By Region", s.rateByRegion)}
          {rateTable("By Project Type", s.rateByProjectType)}
          {rateTable("By Customer Type", s.rateByCustomerType)}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card p-4">
          <div className="font-bold text-redland-charcoal mb-2">Loss Reasons</div>
          {lossPie.length === 0 ? (
            <div className="text-sm text-gray-500">No losses logged yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={lossPie} dataKey="value" outerRadius={90} label={(e) => `${e.name}: ${e.value}`}>
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
          <div className="font-bold text-redland-charcoal mb-2">No-Bid Reasons</div>
          {noBidPie.length === 0 ? (
            <div className="text-sm text-gray-500">No no-bid decisions logged yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={noBidPie} dataKey="value" outerRadius={90} label={(e) => `${e.name}: ${e.value}`}>
                  {noBidPie.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card p-4">
      <div className="text-xs text-gray-500 uppercase font-semibold">{label}</div>
      <div className="text-3xl font-extrabold text-redland-red">{value}</div>
    </div>
  );
}
