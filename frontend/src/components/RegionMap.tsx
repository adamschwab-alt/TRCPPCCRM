import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { fmtMoney } from "../api";
import { Opportunity, STAGE_COLOR } from "../types";

// Spatial layout of TRC's regions — rough approximation of FL+southeast US,
// so a user gets a "map feel" without bringing in a real map library.
const REGION_LAYOUT: Record<string, { row: number; col: number }> = {
  "FL Panhandle":      { row: 0, col: 0 },
  "Jacksonville":      { row: 0, col: 2 },
  "Georgia":           { row: 0, col: 1 },
  "South Carolina":    { row: 0, col: 3 },
  "North Carolina":    { row: 0, col: 4 },
  "Tampa":             { row: 1, col: 1 },
  "Orlando":           { row: 1, col: 2 },
  "SW Florida":        { row: 2, col: 1 },
  "SE Florida":        { row: 2, col: 3 },
  "Texas":             { row: 1, col: 0 },
  "Other":             { row: 2, col: 4 },
};
const ROWS = 3;
const COLS = 5;

interface Props {
  opportunities: Opportunity[];
}

export default function RegionMap({ opportunities }: Props) {
  const groups = useMemo(() => {
    const m: Record<string, Opportunity[]> = {};
    for (const o of opportunities) {
      const k = o.region || "Other";
      (m[k] = m[k] || []).push(o);
    }
    return m;
  }, [opportunities]);

  const cells: { region: string; row: number; col: number; ops: Opportunity[] }[] = [];
  for (const [region, layout] of Object.entries(REGION_LAYOUT)) {
    cells.push({ region, ...layout, ops: groups[region] || [] });
  }

  return (
    <div className="card p-3">
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${ROWS}, minmax(160px, auto))` }}>
        {cells.map((c) => {
          const total = c.ops.reduce((a, o) => a + Number(o.estimatedValueCents), 0);
          const hot = c.ops.length;
          return (
            <div
              key={c.region}
              className={`border rounded p-2 ${hot > 0 ? "bg-redland-red/5 border-redland-red/30" : "bg-gray-50 border-gray-200"}`}
              style={{ gridRow: c.row + 1, gridColumn: c.col + 1 }}
            >
              <div className="font-bold text-sm text-redland-charcoal mb-1">{c.region}</div>
              <div className="text-xs text-gray-600 mb-2">
                {hot} bid{hot === 1 ? "" : "s"} · {fmtMoney(total)}
              </div>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {c.ops.slice(0, 6).map((o) => (
                  <Link
                    key={o.id}
                    to={`/opportunities/${o.id}`}
                    className={`block text-[0.65rem] px-1.5 py-0.5 rounded font-semibold hover:opacity-80 ${STAGE_COLOR[o.stage]}`}
                    title={`${o.projectName} · ${o.customerName} · ${fmtMoney(o.estimatedValueCents)}`}
                  >
                    <div className="truncate">{o.projectName}</div>
                  </Link>
                ))}
                {c.ops.length > 6 && (
                  <div className="text-[0.65rem] text-gray-500 px-1">+{c.ops.length - 6} more</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="text-[0.65rem] text-gray-500 mt-2">
        Spatial layout approximates TRC's primary markets across FL + Southeast. For a true geo map, opportunities would need lat/lng.
      </div>
    </div>
  );
}
