import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, fmtDate, fmtMoney } from "../api";
import { useAuth } from "../auth";
import { STAGE_COLOR, STAGE_LABEL, Stage, Opportunity } from "../types";

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
  const [allOps, setAllOps] = useState<Opportunity[]>([]);
  const [queueIdx, setQueueIdx] = useState<number | null>(null);
  const nav = useNavigate();

  async function load() {
    const [d, o] = await Promise.all([
      api<TodayData>(`/api/dashboard/today?scope=${scope}`),
      api<Opportunity[]>("/api/opportunities"),
    ]);
    setData(d);
    setAllOps(o);
  }
  useEffect(() => {
    load();
  }, [scope]);

  // PWIN-weighted pipeline ($ × p_win) — Vantagepoint pattern
  const weightedPipeline = useMemo(() => {
    let raw = 0;
    let weighted = 0;
    for (const o of allOps) {
      if (["WON", "LOST", "NO_BID", "WITHDRAWN"].includes(o.stage)) continue;
      const v = Number(o.estimatedValueCents);
      raw += v;
      const pwin = o.pwin != null ? o.pwin : defaultStagePwin(o.stage);
      weighted += v * pwin;
    }
    return { raw, weighted };
  }, [allOps]);

  // Task queue — flatten suggestions + tasks into an ordered work list
  const queue = useMemo(() => {
    if (!data) return [] as { id: number; projectName: string; reason: string }[];
    const ids = new Set<number>();
    const items: { id: number; projectName: string; reason: string }[] = [];
    function push(id: number, projectName: string, reason: string) {
      if (ids.has(id)) return;
      ids.add(id);
      items.push({ id, projectName, reason });
    }
    for (const t of data.tasksOverdue) push(t.id, t.projectName, `Overdue: ${t.nextActionNote || "next action"}`);
    for (const t of data.tasksDueToday) push(t.id, t.projectName, `Due today: ${t.nextActionNote || "next action"}`);
    for (const s of data.suggestions) push(s.opportunityId, s.projectName, s.message);
    return items;
  }, [data]);

  function startQueue() {
    if (queue.length === 0) return;
    setQueueIdx(0);
    nav(`/opportunities/${queue[0].id}`);
  }
  function nextInQueue() {
    if (queueIdx === null) return;
    const next = queueIdx + 1;
    if (next >= queue.length) { setQueueIdx(null); nav("/"); return; }
    setQueueIdx(next);
    nav(`/opportunities/${queue[next].id}`);
  }

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

      {(user?.role === "LEADERSHIP" || user?.role === "ADMIN") && (
        <div className="card p-4 grid sm:grid-cols-3 gap-4 items-center">
          <div>
            <div className="text-xs text-gray-500 uppercase font-semibold">Raw pipeline</div>
            <div className="text-2xl font-extrabold text-redland-charcoal">{fmtMoney(weightedPipeline.raw)}</div>
            <div className="text-xs text-gray-500">all open bids · estimated value</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 uppercase font-semibold">PWIN-weighted</div>
            <div className="text-2xl font-extrabold text-redland-red">{fmtMoney(weightedPipeline.weighted)}</div>
            <div className="text-xs text-gray-500">$ × probability of win</div>
          </div>
          <div className="text-xs text-gray-600">
            Weighted pipeline applies each bid's Go/No-Go probability (or stage default when unscored). Use it instead of raw pipeline for forecasting.
          </div>
        </div>
      )}

      {queue.length > 0 && (
        <div className="card p-3 flex flex-wrap items-center gap-2 bg-redland-gold/10 border-redland-gold/40">
          <div className="flex-1">
            <div className="font-bold text-redland-charcoal text-sm">Follow-up queue</div>
            <div className="text-xs text-gray-600">Walk through all {queue.length} item{queue.length === 1 ? "" : "s"} that need your attention, one at a time.</div>
          </div>
          {queueIdx !== null ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-600">{queueIdx + 1} / {queue.length}</span>
              <button onClick={nextInQueue} className="btn-primary text-xs">Next →</button>
              <button onClick={() => { setQueueIdx(null); nav("/"); }} className="btn-ghost text-xs">Exit queue</button>
            </div>
          ) : (
            <button onClick={startQueue} className="btn-gold">Start follow-up queue →</button>
          )}
        </div>
      )}

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

// Stage-based PWIN fallback when no Go/No-Go has been scored yet — rough
// industry priors. Used only when opportunity.pwin is null.
function defaultStagePwin(stage: Stage): number {
  switch (stage) {
    case "LEAD": return 0.10;
    case "REVIEWING_ITB": return 0.20;
    case "GO_NO_GO": return 0.30;
    case "ESTIMATING": return 0.40;
    case "BID_SUBMITTED": return 0.45;
    case "AWAITING_DECISION": return 0.50;
    case "WON": return 1.0;
    default: return 0;
  }
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
