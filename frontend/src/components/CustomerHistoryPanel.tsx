import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, fmtDate, fmtMoney } from "../api";
import { STAGE_COLOR, STAGE_LABEL, Stage } from "../types";

interface Props {
  opportunityId: number;
  currentValueCents: string | number;
}

interface History {
  opportunities: any[];
  summary: {
    total: number;
    won: number;
    lost: number;
    winRate: number | null;
    weightedHitRate: number | null;
    wonRevenueCents: number;
    bidVolumeCents: number;
    lastDecidedAt: string | null;
  };
}

export default function CustomerHistoryPanel({ opportunityId }: Props) {
  const [data, setData] = useState<History | null>(null);

  useEffect(() => {
    api<History>(`/api/opportunities/${opportunityId}/customer-history`)
      .then(setData)
      .catch(() => setData({ opportunities: [], summary: { total: 0, won: 0, lost: 0, winRate: null, weightedHitRate: null, wonRevenueCents: 0, bidVolumeCents: 0, lastDecidedAt: null } }));
  }, [opportunityId]);

  if (!data) return null;
  const { summary, opportunities } = data;

  if (summary.total === 0) {
    return (
      <div className="card p-4">
        <div className="font-bold text-redland-charcoal mb-1">Customer history</div>
        <div className="text-sm text-gray-500">This is the first opportunity logged with this customer.</div>
      </div>
    );
  }

  return (
    <div className="card p-4">
      <div className="font-bold text-redland-charcoal mb-2">Customer history</div>
      <div className="grid grid-cols-3 gap-2 mb-3">
        <Stat label="Bids" value={`${summary.won}/${summary.won + summary.lost}`} sub="won/decided" />
        <Stat
          label="Hit $"
          value={summary.weightedHitRate != null ? `${Math.round(summary.weightedHitRate * 100)}%` : "—"}
          sub="$ won ÷ $ bid"
        />
        <Stat label="Won $" value={fmtMoney(summary.wonRevenueCents)} sub="lifetime" />
      </div>
      <div className="space-y-1 max-h-64 overflow-y-auto">
        {opportunities.slice(0, 10).map((o: any) => (
          <Link
            key={o.id}
            to={`/opportunities/${o.id}`}
            className="flex items-center justify-between text-xs hover:bg-gray-50 rounded p-1.5 border border-gray-100"
          >
            <div className="min-w-0 flex-1">
              <div className="font-semibold truncate text-redland-charcoal">{o.projectName}</div>
              <div className="text-[0.7rem] text-gray-500">{fmtDate(o.bidDueDate)} · {o.projectNumber}</div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className="font-bold text-redland-red">{fmtMoney(o.actualValueCents ?? o.estimatedValueCents)}</span>
              <span className={`badge ${STAGE_COLOR[o.stage as Stage]} text-[0.65rem]`}>{STAGE_LABEL[o.stage as Stage]}</span>
            </div>
          </Link>
        ))}
        {opportunities.length > 10 && (
          <div className="text-xs text-gray-500 text-center pt-1">+ {opportunities.length - 10} more</div>
        )}
      </div>
      {summary.lastDecidedAt && (
        <div className="text-xs text-gray-500 mt-2 pt-2 border-t">
          Last decided: {fmtDate(summary.lastDecidedAt)}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-gray-50 rounded p-2 text-center">
      <div className="text-[0.65rem] text-gray-500 uppercase font-semibold">{label}</div>
      <div className="font-extrabold text-redland-red leading-tight">{value}</div>
      {sub && <div className="text-[0.65rem] text-gray-500">{sub}</div>}
    </div>
  );
}
