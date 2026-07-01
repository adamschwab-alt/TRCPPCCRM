import { Logo } from '@/components/Logo';
import { SetPasswordForm } from './SetPasswordForm';

export default function SetPasswordPage() {
  return (
    <div className="flex min-h-full flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <div className="border-line bg-surface rounded-lg border p-6 shadow-sm">
          <h1 className="text-charcoal text-lg font-bold">Welcome to Pacific Shoring</h1>
          <p className="text-muted mt-1 text-sm">
            Set a password for your account, then you&rsquo;ll set up two-factor authentication.
          </p>
          <SetPasswordForm />
        </div>
      </div>
    </div>
  );
}
