// Pure usage math — separated from the queries so it can be unit-tested.

export type UsageEvent = { user_id: string; occurred_at: string };

export type UserUsage = {
  userId: string;
  lastSeenAt: string | null;
  minutes7d: number;
  minutes30d: number;
  activeDays30d: number;
  sessions30d: number;
};

const DAY = 86_400_000;
/** A gap longer than this between pings starts a new session. */
const SESSION_GAP_MS = 30 * 60_000;

/**
 * Turn heartbeat events (~1/minute while a tab is visible) into per-user usage.
 * "Minutes" = distinct active minutes, so overlapping tabs and double pings
 * never inflate the number.
 */
export function summarizeUsage(events: UsageEvent[], nowMs: number): Map<string, UserUsage> {
  const cut7 = nowMs - 7 * DAY;
  const cut30 = nowMs - 30 * DAY;

  const byUser = new Map<string, number[]>(); // sorted-later ping timestamps (ms)
  for (const e of events) {
    const t = new Date(e.occurred_at).getTime();
    if (Number.isNaN(t) || t < cut30) continue;
    let arr = byUser.get(e.user_id);
    if (!arr) byUser.set(e.user_id, (arr = []));
    arr.push(t);
  }

  const out = new Map<string, UserUsage>();
  for (const [userId, times] of byUser) {
    times.sort((a, b) => a - b);
    const minutes7 = new Set<number>();
    const minutes30 = new Set<number>();
    const days30 = new Set<string>();
    let sessions = 0;
    let prev = -Infinity;
    for (const t of times) {
      const minute = Math.floor(t / 60_000);
      minutes30.add(minute);
      if (t >= cut7) minutes7.add(minute);
      days30.add(new Date(t).toISOString().slice(0, 10));
      if (t - prev > SESSION_GAP_MS) sessions++;
      prev = t;
    }
    out.set(userId, {
      userId,
      lastSeenAt: new Date(times[times.length - 1]).toISOString(),
      minutes7d: minutes7.size,
      minutes30d: minutes30.size,
      activeDays30d: days30.size,
      sessions30d: sessions,
    });
  }
  return out;
}

/** "3h 24m" / "45m" / "—" for the report table. */
export function fmtMinutes(mins: number): string {
  if (mins <= 0) return '—';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
