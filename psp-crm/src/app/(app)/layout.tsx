import type { ReactNode } from 'react';
import { NavBar } from '@/components/NavBar';
import { requireSession } from '@/lib/auth';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const { profile, email } = await requireSession();
  return (
    <div className="flex min-h-full flex-col">
      <NavBar fullName={profile.full_name} email={email} role={profile.role} />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
