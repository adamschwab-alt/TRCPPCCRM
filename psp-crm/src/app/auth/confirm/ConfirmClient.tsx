'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { EmailOtpType } from '@supabase/supabase-js';

/**
 * Handles the link from an invite / recovery email. Establishes the session from
 * whatever the email delivered — either tokens in the URL hash (implicit flow) or
 * a token_hash in the query (server OTP flow) — then sends the user on to set a
 * password. `/auth/*` is exempt from the auth guards, so this runs pre-session.
 */
export function ConfirmClient() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      const supabase = createClient();
      const nextRaw = params.get('next') || '/auth/set-password';
      const next = nextRaw.startsWith('/') ? nextRaw : '/auth/set-password';

      // 1) Implicit flow — access/refresh tokens arrive in the URL hash fragment.
      const hash = typeof window !== 'undefined' ? window.location.hash.replace(/^#/, '') : '';
      const hp = new URLSearchParams(hash);
      const access_token = hp.get('access_token');
      const refresh_token = hp.get('refresh_token');
      if (access_token && refresh_token) {
        const { error: e } = await supabase.auth.setSession({ access_token, refresh_token });
        if (e) return setError(e.message);
        return router.replace(next);
      }

      // 2) Server OTP flow — token_hash + type in the query string.
      const token_hash = params.get('token_hash');
      const type = params.get('type') as EmailOtpType | null;
      if (token_hash && type) {
        const { error: e } = await supabase.auth.verifyOtp({ token_hash, type });
        if (e) return setError(e.message);
        return router.replace(next);
      }

      setError(
        hp.get('error_description') ||
          params.get('error_description') ||
          'This invite link is invalid or has expired. Ask your admin to resend it.',
      );
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="text-center">
      {error ? (
        <>
          <p className="text-sm text-[var(--color-atrisk)]">{error}</p>
          <a href="/login" className="text-brand-700 mt-3 inline-block text-sm hover:underline">
            Go to sign in
          </a>
        </>
      ) : (
        <p className="text-muted text-sm">Verifying your invitation…</p>
      )}
    </div>
  );
}
