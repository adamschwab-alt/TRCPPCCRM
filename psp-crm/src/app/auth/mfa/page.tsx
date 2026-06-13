import { Suspense } from 'react';
import { Logo } from '@/components/Logo';
import { MfaFlow } from './MfaFlow';

export default function MfaPage() {
  return (
    <div className="flex min-h-full flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <div className="rounded-lg border border-line bg-surface p-6 shadow-sm">
          <Suspense>
            <MfaFlow />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
