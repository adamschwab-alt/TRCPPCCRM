import { describe, expect, it } from 'vitest';
import { fmtMinutes, summarizeUsage, type UsageEvent } from '@/lib/usage/summarize';

const NOW = Date.parse('2026-07-12T20:00:00Z');
const at = (msAgo: number) => new Date(NOW - msAgo).toISOString();
const MIN = 60_000;
const DAY = 86_400_000;

const ev = (userId: string, msAgo: number): UsageEvent => ({
  user_id: userId,
  occurred_at: at(msAgo),
});

describe('summarizeUsage', () => {
  it('counts distinct active minutes, not raw pings', () => {
    // 3 pings inside the same minute + 2 in later minutes = 3 minutes total.
    const events = [
      ev('u1', 10_000),
      ev('u1', 20_000),
      ev('u1', 30_000),
      ev('u1', 2 * MIN),
      ev('u1', 4 * MIN),
    ];
    const u = summarizeUsage(events, NOW).get('u1')!;
    expect(u.minutes30d).toBe(3);
    expect(u.minutes7d).toBe(3);
  });

  it('splits sessions on 30+ minute gaps and tracks active days', () => {
    const events = [
      // Session 1: two pings a minute apart, today.
      ev('u1', 5 * MIN),
      ev('u1', 6 * MIN),
      // Session 2: 2 hours earlier.
      ev('u1', 2 * 60 * MIN),
      // Session 3: 10 days ago (outside 7d, inside 30d).
      ev('u1', 10 * DAY),
    ];
    const u = summarizeUsage(events, NOW).get('u1')!;
    expect(u.sessions30d).toBe(3);
    expect(u.activeDays30d).toBe(2);
    expect(u.minutes30d).toBe(4);
    expect(u.minutes7d).toBe(3);
    expect(u.lastSeenAt).toBe(at(5 * MIN));
  });

  it('drops events older than 30 days and keeps users separate', () => {
    const events = [ev('u1', 31 * DAY), ev('u2', 1 * MIN)];
    const summary = summarizeUsage(events, NOW);
    expect(summary.has('u1')).toBe(false);
    expect(summary.get('u2')!.minutes30d).toBe(1);
  });
});

describe('fmtMinutes', () => {
  it('formats hours and minutes', () => {
    expect(fmtMinutes(0)).toBe('—');
    expect(fmtMinutes(45)).toBe('45m');
    expect(fmtMinutes(204)).toBe('3h 24m');
  });
});
