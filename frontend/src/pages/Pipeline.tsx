import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, fmtMoney, fmtDate } from "../api";
import { useSettings } from "../settings";
import { Opportunity, STAGES, STAGE_COLOR, STAGE_LABEL, Stage } from "../types";
import Modal from "../components/Modal";
import OpportunityForm from "../components/OpportunityForm";
import StageChangePrompt from "../components/StageChangePrompt";

type View = "kanban" | "list";

export default function Pipeline() {
  const { dropdowns } = useSettings();
  const [view, setView] = useState<View>("kanban");
  const [ops, setOps] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("");
  const [regionFilter, setRegionFilter] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);
  const [estimatorFilter, setEstimatorFilter] = useState<string>("");
  const [projectTypeFilter, setProjectTypeFilter] = useState("");
  const [customerTypeFilter, setCustomerTypeFilter] = useState("");
  const [bondingFilter, setBondingFilter] = useState("");
  const [users, setUsers] = useState<any[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [stagePrompt, setStagePrompt] = useState<{ op: Opportunity; stage: Stage } | null>(null);
  const [drag, setDrag] = useState<number | null>(null);
  const nav = useNavigate();

  async function load() {
    setLoading(true);
    try {
      const data = await api<Opportunity[]>("/api/opportunities");
      setOps(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    api("/api/users").then(setUsers).catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    return ops.filter((o) => {
      if (search) {
        const s = search.toLowerCase();
        if (
          !o.projectName.toLowerCase().includes(s) &&
          !o.customerName.toLowerCase().includes(s) &&
          !o.projectNumber.toLowerCase().includes(s)
        )
          return false;
      }
      if (stageFilter && o.stage !== stageFilter) return false;
      if (regionFilter && o.region !== regionFilter) return false;
      if (estimatorFilter && String(o.estimatorId || "") !== estimatorFilter) return false;
      if (projectTypeFilter && o.projectType !== projectTypeFilter) return false;
      if (customerTypeFilter && o.customerType !== customerTypeFilter) return false;
      if (bondingFilter && String(o.bondingRequired) !== bondingFilter) return false;
      return true;
    });
  }, [ops, search, stageFilter, regionFilter, estimatorFilter, projectTypeFilter, customerTypeFilter, bondingFilter]);

  const byStage = useMemo(() => {
    const m: Record<string, Opportunity[]> = {};
    for (const s of STAGES) m[s] = [];
    for (const o of filtered) m[o.stage]?.push(o);
    return m;
  }, [filtered]);

  const stageTotals = useMemo(() => {
    const t: Record<string, { count: number; value: number }> = {};
    for (const s of STAGES) t[s] = { count: 0, value: 0 };
    for (const o of ops) {
      t[o.stage].count++;
      t[o.stage].value += Number(o.estimatedValueCents) / 100;
    }
    return t;
  }, [ops]);

  async function changeStage(o: Opportunity, stage: Stage) {
    if (stage === o.stage) return;
    if (stage === "WON" || stage === "LOST" || stage === "NO_BID") {
      setStagePrompt({ op: o, stage });
      return;
    }
    try {
      const updated = await api<Opportunity>(`/api/opportunities/${o.id}`, {
        method: "PUT",
        body: JSON.stringify({ stage }),
      });
      setOps((prev) => prev.map((p) => (p.id === o.id ? { ...p, ...updated } : p)));
    } catch (e: any) {
      alert(e.message || "Failed to update");
    }
  }

  function exportCSV() {
    const rows = [
      [
        "Project #",
        "Project Name",
        "Customer",
        "Stage",
        "Estimated Value",
        "Bid Due",
        "Region",
        "Project Type",
        "Estimator",
        "Source",
      ],
    ];
    for (const o of filtered) {
      rows.push([
        o.projectNumber,
        o.projectName,
        o.customerName,
        STAGE_LABEL[o.stage],
        String(Number(o.estimatedValueCents) / 100),
        o.bidDueDate ? new Date(o.bidDueDate).toISOString().slice(0, 10) : "",
        o.region,
        o.projectType,
        o.estimator?.fullName || "",
        o.source || "",
      ]);
    }
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pipeline-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-extrabold text-redland-charcoal">Pipeline</h1>
          <p className="text-sm text-gray-600">Opportunity tracking & bid management</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-md border border-gray-300 bg-white overflow-hidden">
            <button
              onClick={() => setView("kanban")}
              className={`px-3 py-2 text-sm font-semibold ${
                view === "kanban" ? "bg-redland-charcoal text-white" : "text-redland-charcoal"
              }`}
            >
              Kanban
            </button>
            <button
              onClick={() => setView("list")}
              className={`px-3 py-2 text-sm font-semibold ${
                view === "list" ? "bg-redland-charcoal text-white" : "text-redland-charcoal"
              }`}
            >
              List
            </button>
          </div>
          <button onClick={exportCSV} className="btn-ghost">
            Export CSV
          </button>
          <button onClick={() => setShowAdd(true)} className="btn-gold text-base py-2.5 px-5 shadow-sm">
            + New Opportunity
          </button>
        </div>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-10 gap-2">
        {STAGES.map((s) => {
          const t = stageTotals[s];
          const active = stageFilter === s;
          return (
            <button
              key={s}
              onClick={() => setStageFilter(active ? "" : s)}
              className={`card p-2 text-left transition-all ${
                active ? "ring-2 ring-redland-red" : "hover:border-redland-red"
              }`}
            >
              <div className={`badge ${STAGE_COLOR[s]} mb-1`}>{STAGE_LABEL[s]}</div>
              <div className="text-lg font-extrabold text-redland-charcoal leading-tight">
                {t.count}
              </div>
              <div className="text-xs text-gray-600">
                {fmtMoney(t.value * 100)}
              </div>
            </button>
          );
        })}
      </div>

      {/* Search + filter row */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="input max-w-xs"
          placeholder="Search project, customer, project #"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button onClick={() => setShowFilters((v) => !v)} className="btn-ghost">
          {showFilters ? "▾ Filters" : "▸ Filters"}
        </button>
        {(stageFilter || regionFilter || estimatorFilter || projectTypeFilter || customerTypeFilter || bondingFilter) && (
          <button
            onClick={() => {
              setStageFilter("");
              setRegionFilter("");
              setEstimatorFilter("");
              setProjectTypeFilter("");
              setCustomerTypeFilter("");
              setBondingFilter("");
            }}
            className="text-xs text-redland-red font-semibold"
          >
            Clear filters
          </button>
        )}
      </div>

      {showFilters && (
        <div className="card p-3 grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
          <select className="input" value={regionFilter} onChange={(e) => setRegionFilter(e.target.value)}>
            <option value="">All regions</option>
            {(dropdowns.region || []).map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
          <select className="input" value={projectTypeFilter} onChange={(e) => setProjectTypeFilter(e.target.value)}>
            <option value="">All project types</option>
            {(dropdowns.project_type || []).map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
          <select className="input" value={customerTypeFilter} onChange={(e) => setCustomerTypeFilter(e.target.value)}>
            <option value="">All customer types</option>
            <option value="GC">GC</option>
            <option value="DEVELOPER">Developer</option>
            <option value="GOVERNMENT">Government</option>
            <option value="OWNER_DIRECT">Owner-Direct</option>
          </select>
          <select className="input" value={estimatorFilter} onChange={(e) => setEstimatorFilter(e.target.value)}>
            <option value="">All estimators</option>
            {users.filter((u) => u.role === "ESTIMATOR" || u.role === "ADMIN").map((u) => (
              <option key={u.id} value={u.id}>
                {u.fullName}
              </option>
            ))}
          </select>
          <select className="input" value={bondingFilter} onChange={(e) => setBondingFilter(e.target.value)}>
            <option value="">Bonding: any</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
          <select className="input" value={stageFilter} onChange={(e) => setStageFilter(e.target.value)}>
            <option value="">All stages</option>
            {STAGES.map((s) => (
              <option key={s} value={s}>
                {STAGE_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
      )}

      {loading ? (
        <div className="text-gray-500">Loading pipeline…</div>
      ) : view === "kanban" ? (
        <div className="grid grid-flow-col auto-cols-[minmax(260px,1fr)] gap-3 overflow-x-auto pb-2">
          {STAGES.map((s) => (
            <div
              key={s}
              className="bg-gray-100 rounded-lg p-2 min-h-[200px]"
              onDragOver={(e) => e.preventDefault()}
              onDrop={async (e) => {
                e.preventDefault();
                if (drag != null) {
                  const o = ops.find((x) => x.id === drag);
                  if (o) await changeStage(o, s);
                  setDrag(null);
                }
              }}
            >
              <div className="flex items-center justify-between mb-2 px-1">
                <div className={`badge ${STAGE_COLOR[s]} text-[0.7rem]`}>{STAGE_LABEL[s]}</div>
                <div className="text-xs font-bold text-gray-500">{byStage[s].length}</div>
              </div>
              <div className="space-y-2">
                {byStage[s].map((o) => (
                  <Link
                    key={o.id}
                    to={`/opportunities/${o.id}`}
                    draggable
                    onDragStart={() => setDrag(o.id)}
                    className="block bg-white rounded-md border border-gray-200 p-2 hover:border-redland-red hover:shadow-sm cursor-pointer"
                  >
                    <div className="text-xs text-gray-500 font-mono">{o.projectNumber}</div>
                    <div className="font-bold text-sm text-redland-charcoal leading-tight">
                      {o.projectName}
                    </div>
                    <div className="text-xs text-gray-700">{o.customerName}</div>
                    <div className="flex items-center justify-between mt-1.5">
                      <div className="text-sm font-bold text-redland-red">
                        {fmtMoney(o.estimatedValueCents)}
                      </div>
                      <div className="text-xs text-gray-500">{fmtDate(o.bidDueDate)}</div>
                    </div>
                    {o.goNoGoScore != null && (
                      <div
                        className={`mt-1 text-[0.7rem] font-bold inline-block px-1.5 py-0.5 rounded ${
                          o.goNoGoScore > 70
                            ? "bg-green-100 text-green-800"
                            : o.goNoGoScore >= 50
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        Score: {Math.round(o.goNoGoScore)}
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-redland-charcoal text-white">
              <tr>
                <th className="px-3 py-2 text-left">Project #</th>
                <th className="px-3 py-2 text-left">Project Name</th>
                <th className="px-3 py-2 text-left">Customer</th>
                <th className="px-3 py-2 text-left">Stage</th>
                <th className="px-3 py-2 text-right">Value</th>
                <th className="px-3 py-2 text-left">Bid Due</th>
                <th className="px-3 py-2 text-left">Region</th>
                <th className="px-3 py-2 text-left">Estimator</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => (
                <tr
                  key={o.id}
                  className="border-t hover:bg-redland-gray cursor-pointer"
                  onClick={() => nav(`/opportunities/${o.id}`)}
                >
                  <td className="px-3 py-2 font-mono text-xs">{o.projectNumber}</td>
                  <td className="px-3 py-2 font-semibold">{o.projectName}</td>
                  <td className="px-3 py-2">{o.customerName}</td>
                  <td className="px-3 py-2">
                    <select
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => changeStage(o, e.target.value as Stage)}
                      value={o.stage}
                      className={`px-2 py-1 rounded text-xs font-semibold border ${STAGE_COLOR[o.stage]}`}
                    >
                      {STAGES.map((s) => (
                        <option key={s} value={s}>
                          {STAGE_LABEL[s]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 text-right font-bold text-redland-red">
                    {fmtMoney(o.estimatedValueCents)}
                  </td>
                  <td className="px-3 py-2">{fmtDate(o.bidDueDate)}</td>
                  <td className="px-3 py-2">{o.region || "—"}</td>
                  <td className="px-3 py-2">{o.estimator?.fullName || "—"}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center text-gray-500 py-6">
                    No opportunities match.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="New Opportunity" size="lg">
        <OpportunityForm
          quickAdd
          onCancel={() => setShowAdd(false)}
          onSaved={(o) => {
            setOps((prev) => [o, ...prev]);
            setShowAdd(false);
          }}
        />
      </Modal>

      {stagePrompt && (
        <StageChangePrompt
          opportunity={stagePrompt.op}
          newStage={stagePrompt.stage}
          onCancel={() => setStagePrompt(null)}
          onSaved={(o) => {
            setOps((prev) => prev.map((p) => (p.id === o.id ? { ...p, ...o } : p)));
            setStagePrompt(null);
          }}
        />
      )}
    </div>
  );
}
