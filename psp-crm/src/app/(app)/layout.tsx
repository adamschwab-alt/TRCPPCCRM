import type { ReactNode } from 'react';
import { NavBar } from '@/components/NavBar';
import { UsageTracker } from '@/components/UsageTracker';
import { requireSession } from '@/lib/auth';
import { getDataCoverage } from '@/lib/sync/coverage';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const [{ profile, email }, coverage] = await Promise.all([requireSession(), getDataCoverage()]);
  return (
    <div className="flex min-h-full flex-col">
      <UsageTracker />
      <NavBar
        fullName={profile.full_name}
        email={email}
        role={profile.role}
        coverage={coverage}
      />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
