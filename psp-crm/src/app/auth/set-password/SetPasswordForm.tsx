'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

/** New invitee sets their password, then continues to 2FA enrollment. */
export function SetPasswordForm() {
  const router = useRouter();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (pw.length < 8) return setError('Use at least 8 characters.');
    if (pw !== pw2) return setError('Passwords do not match.');

    setBusy(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setBusy(false);
      return setError('Your invite link expired. Ask your admin to resend the invitation.');
    }
    const { error: updErr } = await supabase.auth.updateUser({ password: pw });
    if (updErr) {
      setBusy(false);
      return setError(updErr.message);
    }
    router.replace('/auth/mfa');
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="mt-5 space-y-4">
      <label className="block">
        <span className="text-charcoal-2 mb-1 block text-xs font-medium">Create a password</span>
        <input
          type="password"
          autoComplete="new-password"
          className="input"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
        />
      </label>
      <label className="block">
        <span className="text-charcoal-2 mb-1 block text-xs font-medium">Confirm password</span>
        <input
          type="password"
          autoComplete="new-password"
          className="input"
          value={pw2}
          onChange={(e) => setPw2(e.target.value)}
        />
      </label>
      {error && <p className="text-sm text-[var(--color-atrisk)]">{error}</p>}
      <button type="submit" disabled={busy} className="btn-primary w-full" data-tap>
        {busy ? 'Saving…' : 'Set password & continue'}
      </button>
    </form>
  );
}
