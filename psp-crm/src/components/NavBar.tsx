'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Logo } from './Logo';
import { DataRefresh } from './DataRefresh';
import type { UserRole } from '@/types/database';
import type { DataCoverage } from '@/lib/sync/coverage';

type NavItem = { href: string; label: string; soon?: boolean };

const NAV: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/my-day', label: 'My Day' },
  { href: '/accounts', label: 'Accounts' },
  { href: '/coverage', label: 'Coverage' },
  { href: '/worklists', label: 'Worklists' },
  { href: '/pipeline', label: 'Pipeline' },
  { href: '/activities', label: 'Activities' },
];

export function NavBar({
  fullName,
  email,
  role,
  coverage,
}: {
  fullName: string | null;
  email: string;
  role: UserRole;
  coverage: DataCoverage;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const staff = role === 'admin' || role === 'manager';
  const items = [
    ...NAV,
    ...(staff ? [{ href: '/call-tracking', label: 'Call Tracking' }] : []),
    ...(role === 'admin' ? [{ href: '/admin', label: 'Admin' }] : []),
  ];

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  return (
    <header className="border-line bg-surface sticky top-0 z-20 border-b">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" aria-label="Home">
            <Logo />
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {items.map((it) => (
              <Link
                key={it.href}
                href={it.href}
                className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  isActive(it.href)
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-charcoal-2 hover:bg-canvas'
                }`}
              >
                {it.label}
                {it.soon && (
                  <span className="bg-canvas text-muted rounded px-1 text-[9px] font-semibold uppercase">
                    soon
                  </span>
                )}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <DataRefresh coverage={coverage} canRefresh={role === 'admin' || role === 'manager'} />
          <div className="hidden text-right sm:block">
            <div className="text-charcoal text-xs font-semibold">{fullName || email}</div>
            <div className="text-muted text-[10px] tracking-wide uppercase">{role}</div>
          </div>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="border-line text-charcoal-2 hover:bg-canvas rounded-md border px-3 py-1.5 text-sm font-medium"
            >
              Sign out
            </button>
          </form>
          <button
            type="button"
            aria-label="Menu"
            onClick={() => setOpen((v) => !v)}
            className="border-line rounded-md border px-3 py-1.5 text-sm md:hidden"
          >
            ☰
          </button>
        </div>
      </div>

      {open && (
        <nav className="border-line bg-surface border-t px-4 py-2 md:hidden">
          {items.map((it) => (
            <Link
              key={it.href}
              href={it.href}
              onClick={() => setOpen(false)}
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium ${
                isActive(it.href) ? 'bg-brand-50 text-brand-700' : 'text-charcoal-2'
              }`}
            >
              {it.label}
              {it.soon && (
                <span className="bg-canvas text-muted rounded px-1 text-[9px] font-semibold uppercase">
                  soon
                </span>
              )}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
