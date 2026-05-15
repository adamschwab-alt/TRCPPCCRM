import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fmtMoney } from "../api";
import { Opportunity, STAGE_COLOR } from "../types";

interface Props {
  opportunities: Opportunity[];
}

export default function BidCalendar({ opportunities }: Props) {
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const byDate = useMemo(() => {
    const m: Record<string, Opportunity[]> = {};
    for (const o of opportunities) {
      if (!o.bidDueDate) continue;
      const d = new Date(o.bidDueDate);
      const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
      (m[key] = m[key] || []).push(o);
    }
    return m;
  }, [opportunities]);

  // Build a 6-week grid starting on the Sunday before/at the 1st
  const grid = useMemo(() => {
    const first = new Date(cursor);
    first.setDate(1);
    const startDow = first.getDay();
    const start = new Date(first);
    start.setDate(first.getDate() - startDow);
    const days: { date: Date; inMonth: boolean }[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      days.push({ date: d, inMonth: d.getMonth() === cursor.getMonth() });
    }
    return days;
  }, [cursor]);

  const monthLabel = cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  function prev() { setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1)); }
  function next() { setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)); }
  function today() {
    const d = new Date();
    setCursor(new Date(d.getFullYear(), d.getMonth(), 1));
  }

  const todayKey = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  })();

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between p-3 border-b">
        <div className="flex items-center gap-1">
          <button onClick={prev} className="btn-ghost text-xs px-2 py-1">‹</button>
          <button onClick={today} className="btn-ghost text-xs px-2 py-1">Today</button>
          <button onClick={next} className="btn-ghost text-xs px-2 py-1">›</button>
        </div>
        <div className="font-bold text-redland-charcoal">{monthLabel}</div>
        <div className="text-xs text-gray-500">{Object.keys(byDate).length} day(s) with bids</div>
      </div>
      <div className="grid grid-cols-7 text-xs font-bold text-gray-500 uppercase border-b">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="px-2 py-1.5 border-r last:border-r-0">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 grid-rows-6 min-h-[480px]">
        {grid.map(({ date, inMonth }, idx) => {
          const key = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
          const bids = byDate[key] || [];
          const isToday = key === todayKey;
          return (
            <div
              key={idx}
              className={`border-r border-b last:border-r-0 p-1.5 ${inMonth ? "bg-white" : "bg-gray-50"} ${isToday ? "ring-2 ring-redland-red ring-inset" : ""}`}
            >
              <div className={`text-xs font-bold mb-1 ${inMonth ? "text-redland-charcoal" : "text-gray-400"}`}>
                {date.getDate()}
              </div>
              <div className="space-y-0.5 max-h-24 overflow-y-auto">
                {bids.slice(0, 4).map((o) => (
                  <Link
                    key={o.id}
                    to={`/opportunities/${o.id}`}
                    className={`block text-[0.65rem] px-1 py-0.5 rounded font-semibold leading-tight hover:opacity-80 ${STAGE_COLOR[o.stage]}`}
                    title={`${o.projectName} · ${o.customerName} · ${fmtMoney(o.estimatedValueCents)}`}
                  >
                    <div className="truncate">{o.projectName}</div>
                  </Link>
                ))}
                {bids.length > 4 && (
                  <div className="text-[0.65rem] text-gray-500 font-semibold px-1">
                    +{bids.length - 4} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
