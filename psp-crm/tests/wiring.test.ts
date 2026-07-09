import { describe, it, expect } from 'vitest';
import { sizeForRevenue, callsPerYear, intervalDays, wiringFor } from '../src/lib/wiring';

describe('customer wiring cadence (workbook Customer Wiring tab)', () => {
  it('classifies size from TTM revenue at the 6M/2M/1M/200K thresholds', () => {
    expect(sizeForRevenue(7_250_000)).toBe('A');
    expect(sizeForRevenue(6_000_000)).toBe('A'); // boundary inclusive
    expect(sizeForRevenue(5_999_999)).toBe('B');
    expect(sizeForRevenue(2_000_000)).toBe('B');
    expect(sizeForRevenue(1_500_000)).toBe('C');
    expect(sizeForRevenue(1_000_000)).toBe('C');
    expect(sizeForRevenue(450_000)).toBe('D');
    expect(sizeForRevenue(200_000)).toBe('D');
    expect(sizeForRevenue(150_000)).toBe('E');
    expect(sizeForRevenue(0)).toBe('E');
  });

  it('maps size × relationship to calls/year per the wiring matrix', () => {
    expect(callsPerYear('A', 1)).toBe(12);
    expect(callsPerYear('A', 3)).toBe(6);
    expect(callsPerYear('B', 2)).toBe(8);
    expect(callsPerYear('C', 2)).toBe(4);
    expect(callsPerYear('D', 3)).toBe(1);
    expect(callsPerYear('E', 3)).toBe(0);
  });

  it('C-size at relationship 1 → 6 touches/yr → every 61 days (dashboard oracle)', () => {
    expect(callsPerYear('C', 1)).toBe(6);
    expect(intervalDays('C', 1)).toBe(61);
  });

  it('E×3 has no cadence (interval null), A×1 is monthly', () => {
    expect(intervalDays('E', 3)).toBeNull();
    expect(intervalDays('A', 1)).toBe(30);
  });

  it('wiringFor defaults unrated accounts to rating 2', () => {
    const w = wiringFor(3_000_000, null);
    expect(w.size).toBe('B');
    expect(w.rating).toBe(2);
    expect(w.callsPerYear).toBe(8);
    expect(w.intervalDays).toBe(46);
  });
});
