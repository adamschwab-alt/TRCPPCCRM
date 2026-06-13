'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Logo } from './Logo';
import type { UserRole } from '@/types/database';

type NavItem = { href: string; label: string; soon?: boolean };

const NAV: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/accounts', label: 'Accounts' },
  { href: '/worklists', label: 'Worklists', soon: true },
  { href: '/pipeline', label: 'Pipeline', soon: true },
  { href: '/activities', label: 'Activities', soon: true },
];

export function NavBar({
  fullName,
  email,
  role,
}: {
  fullName: string | null;
  email: string;
  role: UserRole;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const items = role === 'admin' ? [...NAV, { href: '/admin', label: 'Admin', soon: true }] : NAV;

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-surface">
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
                  <span className="rounded bg-canvas px-1 text-[9px] font-semibold uppercase text-muted">
                    soon
                  </span>
                )}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <div className="text-xs font-semibold text-charcoal">{fullName || email}</div>
            <div className="text-[10px] uppercase tracking-wide text-muted">{role}</div>
          </div>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="rounded-md border border-line px-3 py-1.5 text-sm font-medium text-charcoal-2 hover:bg-canvas"
            >
              Sign out
            </button>
          </form>
          <button
            type="button"
            aria-label="Menu"
            onClick={() => setOpen((v) => !v)}
            className="rounded-md border border-line px-3 py-1.5 text-sm md:hidden"
          >
            ☰
          </button>
        </div>
      </div>

      {open && (
        <nav className="border-t border-line bg-surface px-4 py-2 md:hidden">
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
                <span className="rounded bg-canvas px-1 text-[9px] font-semibold uppercase text-muted">
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
