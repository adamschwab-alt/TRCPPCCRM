'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type Mode = 'loading' | 'enroll' | 'challenge';

export function MfaFlow() {
  const router = useRouter();
  const params = useSearchParams();
  const redirect = params.get('redirect') || '/dashboard';

  const [mode, setMode] = useState<Mode>('loading');
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const setup = useCallback(async () => {
    const supabase = createClient();
    const { data: factors, error: listErr } = await supabase.auth.mfa.listFactors();
    if (listErr) {
      setError(listErr.message);
      return;
    }
    const verified = factors?.totp ?? [];
    if (verified.length > 0) {
      // Already enrolled → challenge this session.
      setFactorId(verified[0].id);
      setMode('challenge');
      return;
    }
    // Clean up any stale unverified factors, then enroll fresh.
    const stale = (factors?.all ?? []).filter((f) => f.status === 'unverified');
    for (const f of stale) await supabase.auth.mfa.unenroll({ factorId: f.id });

    const { data, error: enrollErr } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: `PSP ${Date.now()}`,
    });
    if (enrollErr) {
      setError(enrollErr.message);
      return;
    }
    setFactorId(data.id);
    setQr(data.totp.qr_code);
    setSecret(data.totp.secret);
    setMode('enroll');
  }, []);

  useEffect(() => {
    // setup() only mutates state after async awaits (listFactors/enroll), so this
    // is not a synchronous cascading render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setup();
  }, [setup]);

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId });
    if (chErr) {
      setError(chErr.message);
      setBusy(false);
      return;
    }
    const { error: vErr } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: ch.id,
      code: code.trim(),
    });
    if (vErr) {
      setError(vErr.message);
      setBusy(false);
      return;
    }
    router.replace(redirect);
    router.refresh();
  }

  if (mode === 'loading') {
    return <p className="text-muted text-sm">Loading…</p>;
  }

  return (
    <div>
      <h1 className="text-charcoal text-lg font-bold">
        {mode === 'enroll' ? 'Set up two-factor auth' : 'Two-factor verification'}
      </h1>
      <p className="text-muted mt-1 text-sm">
        {mode === 'enroll'
          ? 'Scan the QR code with an authenticator app (Google Authenticator, 1Password, Authy), then enter the 6-digit code.'
          : 'Enter the 6-digit code from your authenticator app.'}
      </p>

      {mode === 'enroll' && qr && (
        <div className="mt-4 flex flex-col items-center">
          {/* qr_code is an SVG data URI from Supabase */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="TOTP QR code" className="h-44 w-44" />
          {secret && (
            <p className="text-muted mt-2 text-center text-xs break-all">
              Or enter this key manually:
              <br />
              <code className="font-mono">{secret}</code>
            </p>
          )}
        </div>
      )}

      <form onSubmit={verify} className="mt-5 space-y-4">
        <input
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={6}
          placeholder="000000"
          className="input text-center text-lg tracking-[0.4em]"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
        />
        {error && <p className="text-sm text-[var(--color-atrisk)]">{error}</p>}
        <button
          type="submit"
          disabled={busy || code.length !== 6}
          className="btn-primary w-full"
          data-tap
        >
          {busy ? 'Verifying…' : 'Verify'}
        </button>
      </form>

      <form action="/auth/signout" method="post" className="mt-3">
        <button type="submit" className="text-muted w-full text-center text-xs hover:underline">
          Cancel and sign out
        </button>
      </form>
    </div>
  );
}
