// Drop-in localStorage-backed draft persistence for forms.
// Restores on mount, saves on change (debounced), clears on submit/cancel.

import { useEffect, useRef } from "react";

const KEY_PREFIX = "redland_draft:";

export function loadDraft<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(KEY_PREFIX + key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function saveDraft(key: string, data: unknown) {
  try {
    localStorage.setItem(KEY_PREFIX + key, JSON.stringify(data));
  } catch {
    // localStorage may be full / disabled — ignore
  }
}

export function clearDraft(key: string) {
  try {
    localStorage.removeItem(KEY_PREFIX + key);
  } catch {}
}

// Debounced autosave hook. Saves form state to localStorage so accidental
// browser-close doesn't lose hours of bid intake data (SmartBid anti-pattern).
export function useAutosave(key: string, value: unknown, intervalMs = 800) {
  const timer = useRef<number | null>(null);
  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => saveDraft(key, value), intervalMs);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [key, value, intervalMs]);
}
