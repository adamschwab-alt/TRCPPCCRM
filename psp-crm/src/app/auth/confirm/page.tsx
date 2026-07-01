import { Suspense } from 'react';
import { Logo } from '@/components/Logo';
import { ConfirmClient } from './ConfirmClient';

export default function ConfirmPage() {
  return (
    <div className="flex min-h-full flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <div className="border-line bg-surface rounded-lg border p-6 shadow-sm">
          <Suspense fallback={<p className="text-muted text-center text-sm">Loading…</p>}>
            <ConfirmClient />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
