import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, fmtMoney } from "../api";
import { useSettings } from "../settings";
import { Opportunity, STAGE_COLOR, STAGE_LABEL } from "../types";

export default function EstimatorWorkload() {
  const { settings } = useSettings();
  const [users, setUsers] = useState<any[]>([]);
  const [ops, setOps] = useState<Opportunity[]>([]);
  const capacity = parseInt(settings.estimator_capacity_threshold || "5", 10);

  useEffect(() => {
    Promise.all([api("/api/users"), api("/api/opportunities")]).then(([u, o]: any) => {
      setUsers(u);
      setOps(o);
    });
  }, []);

  const estimators = users.filter((u) => u.role === "ESTIMATOR" || u.role === "ADMIN");

  function statsFor(uid: number) {
    const mine = ops.filter((o) => o.estimatorId === uid && !["WON", "LOST", "NO_BID", "WITHDRAWN"].includes(o.stage));
    const active = mine.filter((o) =>
      ["GO_NO_GO", "ESTIMATING", "BID_SUBMITTED", "AWAITING_DECISION"].includes(o.stage)
    );
    const queued = mine.filter((o) => ["LEAD", "REVIEWING_ITB"].includes(o.stage));
    const won = ops.filter((o) => o.estimatorId === uid && o.stage === "WON").length;
    const lost = ops.filter((o) => o.estimatorId === uid && o.stage === "LOST").length;
    const totalValue = mine.reduce((a, o) => a + Number(o.estimatedValueCents), 0);
    return {
      active,
      queued,
      activeCount: active.length,
      queuedCount: queued.length,
      totalValue,
      winRate: won + lost ? won / (won + lost) : 0,
    };
  }

  const overThreshold = estimators.filter((u) => statsFor(u.id).activeCount >= capacity);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold text-redland-charcoal">Estimator Workload</h1>
        <p className="text-sm text-gray-600">
          Capacity threshold: <strong>{capacity}</strong> active bids per estimator
        </p>
      </div>

      {overThreshold.length > 0 && (
        <div className="card p-3 bg-red-50 border-red-200">
          <div className="font-bold text-red-800">
            ⚠ {overThreshold.length} estimator{overThreshold.length > 1 ? "s" : ""} at or over capacity:
          </div>
          <div className="text-sm text-red-700">
            {overThreshold.map((u) => u.fullName).join(", ")}
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {estimators.map((u) => {
          const s = statsFor(u.id);
          const pct = Math.min(100, (s.activeCount / capacity) * 100);
          const color =
            s.activeCount >= capacity
              ? "bg-red-500"
              : s.activeCount >= capacity * 0.8
              ? "bg-yellow-500"
              : "bg-green-500";
          return (
            <div key={u.id} className="card p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="font-bold text-redland-charcoal">{u.fullName}</div>
                <div className="text-xs text-gray-500">{u.username}</div>
              </div>
              <div className="flex items-center gap-3 mb-3">
                <div className="text-3xl font-extrabold text-redland-red">{s.activeCount}</div>
                <div className="flex-1">
                  <div className="bg-gray-100 h-2 rounded overflow-hidden">
                    <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {s.activeCount} / {capacity} active · {s.queuedCount} queued
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
                <div className="bg-gray-50 rounded p-2">
                  <div className="text-gray-500">Active Value</div>
                  <div className="font-bold">{fmtMoney(s.totalValue)}</div>
                </div>
                <div className="bg-gray-50 rounded p-2">
                  <div className="text-gray-500">Win Rate</div>
                  <div className="font-bold">{Math.round(s.winRate * 100)}%</div>
                </div>
              </div>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {[...s.active, ...s.queued].map((o) => (
                  <Link
                    key={o.id}
                    to={`/opportunities/${o.id}`}
                    className="flex items-center justify-between text-xs hover:bg-gray-50 p-1 rounded"
                  >
                    <div className="truncate flex-1">{o.projectName}</div>
                    <span className={`badge ${STAGE_COLOR[o.stage]} ml-1`}>{STAGE_LABEL[o.stage]}</span>
                  </Link>
                ))}
                {s.active.length === 0 && s.queued.length === 0 && (
                  <div className="text-xs text-gray-500">No active or queued bids.</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
