'use client';

import { useState, useTransition } from 'react';
import { briefAccount, rateBrief } from './brief-actions';

/** "Brief me" — AI pre-call brief, generated on demand and rated 👍/👎. */
export function BriefCard({ accountId, configured }: { accountId: string; configured: boolean }) {
  const [pending, start] = useTransition();
  const [text, setText] = useState<string | null>(null);
  const [recId, setRecId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rated, setRated] = useState<'up' | 'down' | null>(null);

  function run() {
    setError(null);
    setRated(null);
    start(async () => {
      const res = await briefAccount(accountId);
      if (res.error) setError(res.error);
      else {
        setText(res.text ?? null);
        setRecId(res.recId ?? null);
      }
    });
  }

  function rate(up: boolean) {
    if (!recId) return;
    setRated(up ? 'up' : 'down');
    start(async () => {
      await rateBrief(recId, up);
    });
  }

  if (!configured) {
    return (
      <p className="text-muted text-xs">
        AI briefs are not set up yet — an admin adds <code>ANTHROPIC_API_KEY</code> in Vercel to
        enable them.
      </p>
    );
  }

  return (
    <div>
      {!text && (
        <button type="button" onClick={run} disabled={pending} className="btn-primary" data-tap>
          {pending ? 'Reading the account…' : '⚡ Brief me for this call'}
        </button>
      )}
      {error && <p className="mt-2 text-sm text-[var(--color-atrisk)]">{error}</p>}
      {text && (
        <div className="bg-canvas rounded-md p-3">
          <div className="text-charcoal-2 text-sm whitespace-pre-wrap">{text}</div>
          <div className="mt-3 flex items-center gap-3">
            {rated ? (
              <span className="text-muted text-xs">
                {rated === 'up' ? 'Thanks — glad it helped.' : 'Noted — we track brief quality.'}
              </span>
            ) : (
              <>
                <span className="text-muted text-xs">Useful?</span>
                <button type="button" onClick={() => rate(true)} className="text-sm" data-tap>
                  👍
                </button>
                <button type="button" onClick={() => rate(false)} className="text-sm" data-tap>
                  👎
                </button>
              </>
            )}
            <button
              type="button"
              onClick={run}
              disabled={pending}
              className="text-brand-700 ml-auto text-xs hover:underline"
              data-tap
            >
              {pending ? 'Regenerating…' : 'Regenerate'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
