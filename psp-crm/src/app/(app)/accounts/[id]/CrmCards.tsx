'use client';

import { useActionState, useEffect, useRef, useState, useTransition } from 'react';
import { setRelationshipRating, saveContact, deleteContact, type FormState } from '../actions';
import { wiringFor, RATING_LABELS, type RelationshipRating } from '@/lib/wiring';
import type { ContactRow } from '@/types/database';

const TIER_LABELS: Record<number, string> = {
  1: 'Executive',
  2: 'Regional/District',
  3: 'Ops/Fleet',
  4: 'Purchasing/Finance',
  5: 'Branch',
};

/** Relationship rating selector + live wiring cadence readout. */
export function WiringCard({
  accountId,
  ttmRevenue,
  rating,
}: {
  accountId: string;
  ttmRevenue: number;
  rating: number;
}) {
  const [current, setCurrent] = useState(rating);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const w = wiringFor(ttmRevenue, current);

  function choose(r: RelationshipRating) {
    setError(null);
    const prev = current;
    setCurrent(r);
    startTransition(async () => {
      const res = await setRelationshipRating(accountId, r);
      if (res.error) {
        setCurrent(prev);
        setError(res.error);
      }
    });
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {( [1, 2, 3] as const ).map((r) => (
          <button
            key={r}
            type="button"
            disabled={pending}
            onClick={() => choose(r)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${
              current === r
                ? 'bg-brand text-white'
                : 'border-line bg-surface text-charcoal-2 hover:bg-canvas border'
            }`}
            data-tap
          >
            {r} · {RATING_LABELS[r]}
          </button>
        ))}
      </div>
      <p className="text-charcoal-2 mt-3 text-sm">
        Size <span className="font-bold">{w.size}</span> × relationship{' '}
        <span className="font-bold">{w.rating}</span> →{' '}
        {w.intervalDays == null ? (
          <span className="text-muted">no proactive cadence</span>
        ) : (
          <>
            <span className="font-bold">{w.callsPerYear} touches/yr</span>{' '}
            <span className="text-muted">(every ~{w.intervalDays} days)</span>
          </>
        )}
      </p>
      <p className="text-muted mt-1 text-xs">
        From the customer-wiring matrix: account size (TTM revenue) × relationship rating sets the
        target outreach frequency used by My Day.
      </p>
      {error && <p className="mt-2 text-xs text-[var(--color-atrisk)]">{error}</p>}
    </div>
  );
}

/** Contact list with inline add/edit. */
export function ContactsCard({
  accountId,
  contacts,
}: {
  accountId: string;
  contacts: ContactRow[];
}) {
  const [editing, setEditing] = useState<ContactRow | 'new' | null>(null);

  return (
    <div>
      {contacts.length === 0 && !editing && (
        <p className="text-muted text-sm">No contacts yet — add the people you call on.</p>
      )}
      <ul className="space-y-2">
        {contacts.map((c) => (
          <li
            key={c.id}
            className="bg-canvas flex flex-wrap items-center justify-between gap-2 rounded-md px-3 py-2"
          >
            <div>
              <span className="text-charcoal text-sm font-medium">{c.name}</span>
              {c.title && <span className="text-muted text-sm"> · {c.title}</span>}
              <div className="text-muted text-xs">
                Tier {c.tier} — {TIER_LABELS[c.tier] ?? '—'}
                {c.covered_by && <> · covered by {c.covered_by}</>}
              </div>
              <div className="text-muted text-xs">
                {[c.phone, c.email].filter(Boolean).join(' · ') || ''}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="text-brand-700 text-xs hover:underline"
                onClick={() => setEditing(c)}
                data-tap
              >
                Edit
              </button>
              <form action={deleteContact.bind(null, c.id, accountId)}>
                <button className="text-muted text-xs hover:underline" data-tap>
                  Remove
                </button>
              </form>
            </div>
          </li>
        ))}
      </ul>

      {editing ? (
        <ContactForm
          accountId={accountId}
          contact={editing === 'new' ? null : editing}
          onDone={() => setEditing(null)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing('new')}
          className="btn-secondary mt-3"
          data-tap
        >
          + Add contact
        </button>
      )}
    </div>
  );
}

function ContactForm({
  accountId,
  contact,
  onDone,
}: {
  accountId: string;
  contact: ContactRow | null;
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveContact, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.error === undefined && !pending && ref.current?.dataset.submitted === '1') onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, pending]);

  return (
    <form
      ref={ref}
      action={(fd) => {
        if (ref.current) ref.current.dataset.submitted = '1';
        return action(fd);
      }}
      className="border-line mt-3 space-y-3 rounded-md border p-3"
    >
      <input type="hidden" name="account_id" value={accountId} />
      {contact && <input type="hidden" name="id" value={contact.id} />}
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-charcoal-2 mb-1 block text-xs font-medium">Name</span>
          <input name="name" className="input" defaultValue={contact?.name ?? ''} />
        </label>
        <label className="block">
          <span className="text-charcoal-2 mb-1 block text-xs font-medium">Title</span>
          <input name="title" className="input" defaultValue={contact?.title ?? ''} />
        </label>
        <label className="block">
          <span className="text-charcoal-2 mb-1 block text-xs font-medium">Tier</span>
          <select name="tier" className="input" defaultValue={contact?.tier ?? 3}>
            {[1, 2, 3, 4, 5].map((t) => (
              <option key={t} value={t}>
                {t} — {TIER_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-charcoal-2 mb-1 block text-xs font-medium">
            Covered by (PSP side)
          </span>
          <input
            name="covered_by"
            className="input"
            placeholder="e.g. rep / manager / CFO"
            defaultValue={contact?.covered_by ?? ''}
          />
        </label>
        <label className="block">
          <span className="text-charcoal-2 mb-1 block text-xs font-medium">Phone</span>
          <input name="phone" className="input" defaultValue={contact?.phone ?? ''} />
        </label>
        <label className="block">
          <span className="text-charcoal-2 mb-1 block text-xs font-medium">Email</span>
          <input name="email" className="input" defaultValue={contact?.email ?? ''} />
        </label>
      </div>
      {state.error && <p className="text-sm text-[var(--color-atrisk)]">{state.error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="btn-primary" data-tap>
          {pending ? 'Saving…' : contact ? 'Save contact' : 'Add contact'}
        </button>
        <button type="button" onClick={onDone} className="btn-secondary" data-tap>
          Cancel
        </button>
      </div>
    </form>
  );
}
