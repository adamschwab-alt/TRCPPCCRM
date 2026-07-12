'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Presence tracker: pings /api/usage on every navigation and once per minute
 * while the tab is open AND visible. Each ping stamps one "active minute", so
 * an idle background tab adds nothing to a user's time-on-site.
 */
export function UsageTracker() {
  const pathname = usePathname();

  useEffect(() => {
    const ping = () => {
      if (document.visibilityState !== 'visible') return;
      fetch('/api/usage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: pathname }),
        keepalive: true,
      }).catch(() => undefined);
    };
    ping(); // navigation event
    const timer = setInterval(ping, 60_000);
    return () => clearInterval(timer);
  }, [pathname]);

  return null;
}
