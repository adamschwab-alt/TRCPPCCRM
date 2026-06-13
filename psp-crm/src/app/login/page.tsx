import { Suspense } from 'react';
import { Logo } from '@/components/Logo';
import { LoginForm } from './LoginForm';

export default function LoginPage() {
  return (
    <div className="flex min-h-full flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <div className="border-line bg-surface rounded-lg border p-6 shadow-sm">
          <h1 className="text-charcoal text-lg font-bold">Sign in</h1>
          <p className="text-muted mt-1 text-sm">Invite-only. TOTP MFA is required.</p>
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
        <p className="text-muted mt-4 text-center text-xs">
          Need access? Ask an admin to send an invite.
        </p>
      </div>
    </div>
  );
}
