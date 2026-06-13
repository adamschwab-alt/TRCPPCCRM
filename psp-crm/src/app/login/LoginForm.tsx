'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});
type FormValues = z.infer<typeof schema>;

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    setServerError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword(values);
    if (error) {
      setServerError(error.message);
      return;
    }
    // Proxy routes to /auth/mfa (enroll first login, challenge after) until aal2.
    const redirect = params.get('redirect') || '/dashboard';
    router.replace('/auth/mfa?redirect=' + encodeURIComponent(redirect));
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mt-5 space-y-4">
      <Field label="Email" error={errors.email?.message}>
        <input type="email" autoComplete="email" className="input" {...register('email')} />
      </Field>
      <Field label="Password" error={errors.password?.message}>
        <input
          type="password"
          autoComplete="current-password"
          className="input"
          {...register('password')}
        />
      </Field>
      {serverError && <p className="text-sm text-[var(--color-atrisk)]">{serverError}</p>}
      <button type="submit" disabled={isSubmitting} className="btn-primary w-full" data-tap>
        {isSubmitting ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-charcoal-2 mb-1 block text-xs font-medium">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-[var(--color-atrisk)]">{error}</span>}
    </label>
  );
}
