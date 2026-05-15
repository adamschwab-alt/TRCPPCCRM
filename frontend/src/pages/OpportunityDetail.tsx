import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, fmtDate, fmtDateTime, fmtMoney } from "../api";
import { useAuth } from "../auth";
import { useSettings } from "../settings";
import { Opportunity, STAGES, STAGE_COLOR, STAGE_LABEL, Stage } from "../types";
import Modal from "../components/Modal";
import OpportunityForm from "../components/OpportunityForm";
import StageChangePrompt from "../components/StageChangePrompt";
import GoNoGoForm from "../components/GoNoGoForm";
import CustomerHistoryPanel from "../components/CustomerHistoryPanel";

export default function OpportunityDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { enabled, settings } = useSettings();
  const [op, setOp] = useState<Opportunity | null>(null);
  const [noteText, setNoteText] = useState("");
  const [posting, setPosting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [stagePrompt, setStagePrompt] = useState<Stage | null>(null);
  const [showGoNoGo, setShowGoNoGo] = useState(false);
  const [chainPrompt, setChainPrompt] = useState(false);
  const [chainDate, setChainDate] = useState("");
  const [chainNote, setChainNote] = useState("");
  const nav = useNavigate();
  const readOnly = user?.role === "READ_ONLY";

  async function load() {
    const data = await api<Opportunity>(`/api/opportunities/${id}`);
    setOp(data);
  }

  useEffect(() => {
    load().catch(() => nav("/pipeline"));
  }, [id]);

  async function changeStage(stage: Stage) {
    if (!op || stage === op.stage) return;
    if (stage === "WON" || stage === "LOST" || stage === "NO_BID") {
      setStagePrompt(stage);
      return;
    }
    const updated = await api<Opportunity>(`/api/opportunities/${op.id}`, {
      method: "PUT",
      body: JSON.stringify({ stage }),
    });
    await load();

    if (stage === "GO_NO_GO" && enabled("go_no_go")) {
      setShowGoNoGo(true);
    } else if (!["WON", "LOST", "NO_BID", "WITHDRAWN"].includes(stage) && !op.nextActionDate) {
      setChainPrompt(true);
    }
  }

  async function postNote() {
    if (!noteText.trim() || !op) return;
    setPosting(true);
    try {
      await api(`/api/opportunities/${op.id}/notes`, {
        method: "POST",
        body: JSON.stringify({ body: noteText.trim() }),
      });
      setNoteText("");
      await load();
      // Activity chaining: if there's no next action set, prompt to schedule one.
      // This is the Pipedrive pattern — every open deal should always have a next step.
      if (!op.nextActionDate && !["WON", "LOST", "NO_BID", "WITHDRAWN"].includes(op.stage)) {
        setChainPrompt(true);
      }
    } finally {
      setPosting(false);
    }
  }

  async function saveChainAction() {
    if (!chainDate || !op) {
      setChainPrompt(false);
      return;
    }
    await api(`/api/opportunities/${op.id}`, {
      method: "PUT",
      body: JSON.stringify({ nextActionDate: chainDate, nextActionNote: chainNote || null }),
    });
    setChainPrompt(false);
    setChainDate("");
    setChainNote("");
    await load();
  }

  async function archive() {
    if (!op) return;
    if (!confirm("Archive this opportunity?")) return;
    await api(`/api/opportunities/${op.id}`, { method: "DELETE" });
    nav("/pipeline");
  }

  if (!op) return <div className="text-gray-500">Loading…</div>;

  const aboveThreshold = (limit: number) =>
    Number(op.estimatedValueCents) / 100 > limit;
  const davidLimit = parseFloat(settings.go_no_go_threshold_david || "5000000");
  const chadLimit = parseFloat(settings.go_no_go_threshold_chad || "15000000");
  let approver = "David Merring can approve";
  if (aboveThreshold(chadLimit)) approver = "Chad + Pinky approval required";
  else if (aboveThreshold(davidLimit)) approver = "David recommends, Chad approves";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Link to="/pipeline" className="text-sm text-redland-red font-semibold">
            ← Back to Pipeline
          </Link>
          <h1 className="text-2xl font-extrabold text-redland-charcoal mt-1">
            {op.projectName}
          </h1>
          <div className="text-sm text-gray-600 font-mono">{op.projectNumber}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          {!readOnly && (
            <button onClick={() => setEditing(true)} className="btn-ghost">
              Edit
            </button>
          )}
          {(user?.role === "ADMIN" || user?.role === "LEADERSHIP") && (
            <button onClick={archive} className="btn-danger">
              Archive
            </button>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="card p-4 lg:col-span-2 space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500 font-semibold uppercase">Stage</span>
            {!readOnly ? (
              <select
                value={op.stage}
                onChange={(e) => changeStage(e.target.value as Stage)}
                className={`px-3 py-1.5 rounded text-sm font-bold border-2 ${STAGE_COLOR[op.stage]}`}
              >
                {STAGES.map((s) => (
                  <option key={s} value={s}>
                    {STAGE_LABEL[s]}
                  </option>
                ))}
              </select>
            ) : (
              <span className={`badge ${STAGE_COLOR[op.stage]}`}>{STAGE_LABEL[op.stage]}</span>
            )}
            {op.goNoGoScore != null && (
              <span
                className={`badge ${
                  op.goNoGoScore > 70
                    ? "bg-green-100 text-green-800"
                    : op.goNoGoScore >= 50
                    ? "bg-yellow-100 text-yellow-800"
                    : "bg-red-100 text-red-800"
                }`}
              >
                Score: {Math.round(op.goNoGoScore)}
              </span>
            )}
          </div>

          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <Field label="Customer" value={op.customerName} />
            <Field label="Customer Type" value={op.customerType.replace("_", " ")} />
            <Field label="Project Type" value={op.projectType || "—"} />
            <Field label="Region" value={op.region || "—"} />
            <Field label="Estimated Value" value={fmtMoney(op.estimatedValueCents)} />
            <Field label="Bid Margin" value={`${op.bidMarginPct}%`} />
            {op.expectedMarginPct != null && (
              <Field label="Expected Gross Margin" value={`${op.expectedMarginPct}%`} />
            )}
            <Field label="Bid Due Date" value={fmtDate(op.bidDueDate)} />
            <Field label="Est. Start Date" value={fmtDate(op.estimatedStartDate)} />
            <Field
              label="Duration"
              value={op.estimatedDurationMonths ? `${op.estimatedDurationMonths} months` : "—"}
            />
            <Field label="Estimator" value={op.estimator?.fullName || "—"} />
            <Field label="PM" value={op.pm?.fullName || "—"} />
            <Field label="Source" value={op.source || "—"} />
            <Field label="Bonding Required" value={op.bondingRequired ? "Yes" : "No"} />
            {op.bondingRequired && op.bondAmountCents != null && (
              <Field label="Bond Amount" value={fmtMoney(op.bondAmountCents)} />
            )}
            <Field label="Competitive" value={op.competitive ? "Yes" : "Negotiated"} />
            <Field label="Last Look" value={op.lastLook ? "Yes" : "No"} />
            {op.stage === "WON" && (
              <>
                <Field label="Actual Value" value={fmtMoney(op.actualValueCents ?? null)} />
                <Field label="Decided" value={fmtDate(op.decidedAt)} />
              </>
            )}
            {op.stage === "LOST" && (
              <>
                <Field label="Loss Reason" value={op.lossReason || "—"} />
                <Field label="Winning Bidder" value={op.winningBidder || "—"} />
                <Field label="Winning Bid" value={fmtMoney(op.winningBidCents ?? null)} />
              </>
            )}
            {op.stage === "NO_BID" && (
              <Field label="No-Bid Reason" value={op.noBidReason || "—"} />
            )}
          </div>

          {op.scopeOfWork.length > 0 && (
            <div>
              <div className="text-xs text-gray-500 font-semibold uppercase mb-1">Scope of Work</div>
              <div className="flex flex-wrap gap-1.5">
                {op.scopeOfWork.map((s) => (
                  <span key={s} className="badge bg-redland-charcoal text-white">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {enabled("go_no_go") && (
            <div className="border-t pt-3">
              <div className="flex items-center justify-between mb-2">
                <div className="font-bold text-redland-charcoal">Go / No-Go</div>
                {!readOnly && (
                  <button onClick={() => setShowGoNoGo(true)} className="btn-gold text-xs py-1.5">
                    {op.goNoGoDecisions?.length ? "Re-score" : "Score this opportunity"}
                  </button>
                )}
              </div>
              <div className="text-xs text-gray-600 mb-2">{approver}</div>
              {(op.goNoGoDecisions || []).map((d: any) => (
                <div key={d.id} className="border rounded p-2 mb-2 text-sm bg-gray-50">
                  <div className="flex items-center justify-between">
                    <span
                      className={`badge ${
                        d.decision === "GO"
                          ? "bg-green-100 text-green-800"
                          : d.decision === "NO_GO"
                          ? "bg-red-100 text-red-800"
                          : "bg-yellow-100 text-yellow-800"
                      }`}
                    >
                      {d.decision}
                    </span>
                    <span className="font-bold">{d.compositeScore.toFixed(1)}/100</span>
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    {d.approver?.fullName} · {fmtDateTime(d.createdAt)}
                  </div>
                  {d.conditions && <div className="text-xs mt-1 italic">{d.conditions}</div>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          {chainPrompt && (
            <div className="card p-4 bg-redland-gold/10 border-redland-gold/40 border">
              <div className="font-bold text-redland-charcoal mb-1">What's next?</div>
              <p className="text-xs text-gray-600 mb-2">Set a follow-up so this deal doesn't go stale.</p>
              <div className="grid grid-cols-3 gap-2">
                <input type="date" className="input" value={chainDate} onChange={(e) => setChainDate(e.target.value)} />
                <input className="input col-span-2" placeholder="e.g. call GC for status" value={chainNote} onChange={(e) => setChainNote(e.target.value)} />
              </div>
              <div className="flex justify-end gap-2 mt-2">
                <button onClick={() => { setChainPrompt(false); setChainDate(""); setChainNote(""); }} className="btn-ghost text-xs">Skip</button>
                <button onClick={saveChainAction} disabled={!chainDate} className="btn-primary text-xs disabled:opacity-50">Schedule</button>
              </div>
            </div>
          )}

          <div className="card p-4">
            <div className="font-bold text-redland-charcoal mb-2">Activity Log</div>
            {!readOnly && (
              <div className="space-y-2 mb-3">
                <textarea
                  className="input"
                  rows={2}
                  placeholder="Add a note…"
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                />
                <button
                  onClick={postNote}
                  disabled={posting || !noteText.trim()}
                  className="btn-primary w-full disabled:opacity-50"
                >
                  {posting ? "Posting…" : "Post note"}
                </button>
              </div>
            )}
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {(op.notes || []).map((n: any) => (
                <div key={n.id} className="border-l-2 border-redland-red pl-2">
                  <div className="text-sm">{n.body}</div>
                  <div className="text-xs text-gray-500">
                    {n.author?.fullName} · {fmtDateTime(n.createdAt)}
                  </div>
                </div>
              ))}
              {(op.notes || []).length === 0 && (
                <div className="text-sm text-gray-500">No activity yet.</div>
              )}
            </div>
          </div>

          <CustomerHistoryPanel opportunityId={op.id} currentValueCents={op.estimatedValueCents} />

          <div className="card p-4">
            <div className="font-bold text-redland-charcoal mb-2">Stage History</div>
            <div className="space-y-1 text-sm">
              {(op.stageHistory || []).map((h: any) => (
                <div key={h.id} className="flex justify-between gap-2">
                  <div>
                    {h.fromStage ? `${STAGE_LABEL[h.fromStage as Stage]} → ` : ""}
                    <span className="font-semibold">{STAGE_LABEL[h.toStage as Stage]}</span>
                  </div>
                  <div className="text-xs text-gray-500">{fmtDateTime(h.changedAt)}</div>
                </div>
              ))}
              {(op.stageHistory || []).length === 0 && (
                <div className="text-gray-500">No stage changes yet.</div>
              )}
            </div>
          </div>
        </div>
      </div>

      <Modal open={editing} onClose={() => setEditing(false)} title="Edit Opportunity" size="lg">
        <OpportunityForm
          initial={op}
          onCancel={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            load();
          }}
        />
      </Modal>

      {stagePrompt && (
        <StageChangePrompt
          opportunity={op}
          newStage={stagePrompt}
          onCancel={() => setStagePrompt(null)}
          onSaved={() => {
            setStagePrompt(null);
            load();
          }}
        />
      )}

      <Modal open={showGoNoGo} onClose={() => setShowGoNoGo(false)} title="Go / No-Go Scoring">
        <GoNoGoForm
          opportunityId={op.id}
          onCancel={() => setShowGoNoGo(false)}
          onSaved={() => {
            setShowGoNoGo(false);
            load();
          }}
        />
      </Modal>
    </div>
  );
}

function Field({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <div className="text-xs text-gray-500 font-semibold uppercase">{label}</div>
      <div className="font-semibold text-redland-charcoal">{value}</div>
    </div>
  );
}
