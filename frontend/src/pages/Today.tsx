import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, fmtDate, fmtMoney } from "../api";
import { useAuth } from "../auth";
import { STAGE_COLOR, STAGE_LABEL, Stage } from "../types";

interface TodayData {
  tasksDueToday: any[];
  tasksOverdue: any[];
  needsActionCount: number;
  staleCount: number;
  overdueBidCount: number;
  suggestions: { kind: string; opportunityId: number; projectName: string; message: string; severity: "high" | "medium" | "low" }[];
  recentDecisions: any[];
}

const SEVERITY_COLOR: Record<string, string> = {
  high: "border-red-300 bg-red-50",
  medium: "border-yellow-300 bg-yellow-50",
  low: "border-gray-200 bg-gray-50",
};
const SEVERITY_DOT: Record<string, string> = {
  high: "bg-red-500",
  medium: "bg-yellow-500",
  low: "bg-gray-400",
};

export default function Today() {
  const { user } = useAuth();
  const [data, setData] = useState<TodayData | null>(null);
  const [scope, setScope] = useState<"mine" | "all">("mine");

  async function load() {
    const d = await api<TodayData>(`/api/dashboard/today?scope=${scope}`);
    setData(d);
  }
  useEffect(() => {
    load();
  }, [scope]);

  if (!data) return <div className="text-gray-500">Loading…</div>;

  const totalSuggestions = data.suggestions.length;
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  })();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-redland-charcoal">
            {greeting}, {user?.fullName.split(" ")[0]}
          </h1>
          <p className="text-sm text-gray-600">Here's what needs attention today.</p>
        </div>
        <div className="inline-flex rounded-md border border-gray-300 bg-white overflow-hidden">
          <button
            onClick={() => setScope("mine")}
            className={`px-3 py-2 text-sm font-semibold ${scope === "mine" ? "bg-redland-charcoal text-white" : "text-redland-charcoal"}`}
          >
            My bids
          </button>
          <button
            onClick={() => setScope("all")}
            className={`px-3 py-2 text-sm font-semibold ${scope === "all" ? "bg-redland-charcoal text-white" : "text-redland-charcoal"}`}
          >
            All bids
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Tasks due today" value={data.tasksDueToday.length} accent="bg-redland-red text-white" />
        <Stat label="Overdue tasks" value={data.tasksOverdue.length} accent={data.tasksOverdue.length > 0 ? "bg-red-100 text-red-800" : "bg-gray-100 text-gray-700"} />
        <Stat label="Stale deals" value={data.staleCount} accent={data.staleCount > 0 ? "bg-yellow-100 text-yellow-800" : "bg-gray-100 text-gray-700"} />
        <Stat label="Overdue bids" value={data.overdueBidCount} accent={data.overdueBidCount > 0 ? "bg-red-100 text-red-800" : "bg-gray-100 text-gray-700"} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="font-bold text-redland-charcoal">Suggested actions</div>
            <span className="text-xs text-gray-500">{totalSuggestions} item{totalSuggestions === 1 ? "" : "s"}</span>
          </div>
          {totalSuggestions === 0 ? (
            <div className="text-sm text-gray-500 py-6 text-center">All clear — nothing needs your attention. 🎯</div>
          ) : (
            <div className="space-y-2">
              {data.suggestions.map((s, i) => (
                <Link
                  key={`${s.opportunityId}-${i}`}
                  to={`/opportunities/${s.opportunityId}`}
                  className={`block rounded border p-3 hover:shadow-sm ${SEVERITY_COLOR[s.severity]}`}
                >
                  <div className="flex items-start gap-2">
                    <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${SEVERITY_DOT[s.severity]}`} />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm text-redland-charcoal truncate">{s.projectName}</div>
                      <div className="text-xs text-gray-700">{s.message}</div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="card p-4">
          <div className="font-bold text-redland-charcoal mb-3">Due today &amp; overdue</div>
          {data.tasksDueToday.length === 0 && data.tasksOverdue.length === 0 ? (
            <div className="text-sm text-gray-500 py-6 text-center">No scheduled tasks today.</div>
          ) : (
            <div className="space-y-2">
              {data.tasksOverdue.map((o) => <TaskRow key={o.id} o={o} overdue />)}
              {data.tasksDueToday.map((o) => <TaskRow key={o.id} o={o} />)}
            </div>
          )}
          {data.needsActionCount > 0 && (
            <Link to="/pipeline?filter=needs_action" className="block mt-3 text-xs font-semibold text-redland-red hover:underline">
              {data.needsActionCount} open bid{data.needsActionCount === 1 ? "" : "s"} have no next action set →
            </Link>
          )}
        </div>
      </div>

      <div className="card p-4">
        <div className="font-bold text-redland-charcoal mb-3">Recent decisions (last 14 days)</div>
        {data.recentDecisions.length === 0 ? (
          <div className="text-sm text-gray-500">No bids decided yet.</div>
        ) : (
          <div className="space-y-1">
            {data.recentDecisions.map((d) => (
              <Link
                key={d.id}
                to={`/opportunities/${d.id}`}
                className="flex items-center justify-between text-sm hover:bg-gray-50 rounded p-1.5"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`badge ${STAGE_COLOR[d.stage as Stage]}`}>{STAGE_LABEL[d.stage as Stage]}</span>
                  <span className="font-semibold truncate">{d.projectName}</span>
                  <span className="text-xs text-gray-500 hidden sm:inline">· {d.customerName}</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-bold text-redland-red">{fmtMoney(d.actualValueCents ?? d.estimatedValueCents)}</span>
                  <span className="text-gray-500">{fmtDate(d.decidedAt)}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="card p-3">
      <div className="text-xs text-gray-500 uppercase font-semibold">{label}</div>
      <div className={`mt-1 inline-block text-2xl font-extrabold px-3 py-1 rounded ${accent}`}>{value}</div>
    </div>
  );
}

function TaskRow({ o, overdue }: { o: any; overdue?: boolean }) {
  return (
    <Link
      to={`/opportunities/${o.id}`}
      className={`flex items-start justify-between gap-2 rounded p-2 border ${overdue ? "border-red-200 bg-red-50" : "border-gray-200"}`}
    >
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-sm truncate">{o.projectName}</div>
        <div className="text-xs text-gray-600 truncate">{o.nextActionNote || "(no description)"}</div>
      </div>
      <div className={`text-xs font-semibold whitespace-nowrap ${overdue ? "text-red-700" : "text-redland-charcoal"}`}>
        {overdue ? "Overdue" : fmtDate(o.nextActionDate)}
      </div>
    </Link>
  );
}
