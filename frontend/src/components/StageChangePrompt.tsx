import React, { useEffect, useState } from "react";
import { api } from "../api";
import { useSettings } from "../settings";
import Modal from "./Modal";
import { Opportunity, Stage } from "../types";

interface Props {
  opportunity: Opportunity;
  newStage: Stage;
  onSaved: (o: Opportunity) => void;
  onCancel: () => void;
}

export default function StageChangePrompt({ opportunity, newStage, onSaved, onCancel }: Props) {
  const { dropdowns } = useSettings();
  const [users, setUsers] = useState<any[]>([]);
  const [data, setData] = useState<any>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (newStage === "WON") {
      api("/api/users").then(setUsers).catch(() => {});
    }
  }, [newStage]);

  async function submit() {
    setBusy(true);
    setError("");
    try {
      const payload: any = { stage: newStage };
      if (newStage === "WON") {
        if (data.actualValue) payload.actualValue = parseFloat(data.actualValue);
        if (data.pmId) payload.pmId = Number(data.pmId);
        if (data.startDate) payload.estimatedStartDate = data.startDate;
      } else if (newStage === "LOST") {
        if (data.winningBidder) payload.winningBidder = data.winningBidder;
        if (data.winningBid) payload.winningBid = parseFloat(data.winningBid);
        payload.lossReason = data.lossReason || null;
      } else if (newStage === "NO_BID") {
        payload.noBidReason = data.noBidReason || null;
      }
      const res = await api<Opportunity>(`/api/opportunities/${opportunity.id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      onSaved(res);
    } catch (err: any) {
      setError(err.message || "Failed");
    } finally {
      setBusy(false);
    }
  }

  const titleMap: Record<string, string> = {
    WON: "Mark as Won",
    LOST: "Mark as Lost",
    NO_BID: "Mark as No Bid",
  };

  return (
    <Modal open={true} onClose={onCancel} title={titleMap[newStage] || `Move to ${newStage}`} size="sm">
      <div className="space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 text-sm rounded p-2">
            {error}
          </div>
        )}
        {newStage === "WON" && (
          <>
            <div>
              <label className="label">Actual Contract Value ($)</label>
              <input
                type="number"
                className="input"
                value={data.actualValue || ""}
                onChange={(e) => setData({ ...data, actualValue: e.target.value })}
                autoFocus
              />
            </div>
            <div>
              <label className="label">Assigned PM</label>
              <select
                className="input"
                value={data.pmId || ""}
                onChange={(e) => setData({ ...data, pmId: e.target.value })}
              >
                <option value="">— Select PM —</option>
                {users
                  .filter((u) => u.role === "PM" || u.role === "ADMIN")
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.fullName}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="label">Project Start Date</label>
              <input
                type="date"
                className="input"
                value={data.startDate || ""}
                onChange={(e) => setData({ ...data, startDate: e.target.value })}
              />
            </div>
          </>
        )}
        {newStage === "LOST" && (
          <>
            <div>
              <label className="label">Loss Reason</label>
              <select
                className="input"
                value={data.lossReason || ""}
                onChange={(e) => setData({ ...data, lossReason: e.target.value })}
                autoFocus
              >
                <option value="">— Select reason —</option>
                {(dropdowns.loss_reason || []).map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Winning Bidder (optional)</label>
              <input
                className="input"
                value={data.winningBidder || ""}
                onChange={(e) => setData({ ...data, winningBidder: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Winning Bid Amount ($, optional)</label>
              <input
                type="number"
                className="input"
                value={data.winningBid || ""}
                onChange={(e) => setData({ ...data, winningBid: e.target.value })}
              />
            </div>
          </>
        )}
        {newStage === "NO_BID" && (
          <div>
            <label className="label">No-Bid Reason</label>
            <select
              className="input"
              value={data.noBidReason || ""}
              onChange={(e) => setData({ ...data, noBidReason: e.target.value })}
              autoFocus
            >
              <option value="">— Select reason —</option>
              {(dropdowns.no_bid_reason || []).map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onCancel} className="btn-ghost" disabled={busy}>
            Cancel
          </button>
          <button onClick={submit} disabled={busy} className="btn-primary disabled:opacity-50">
            {busy ? "Saving…" : "Confirm"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
