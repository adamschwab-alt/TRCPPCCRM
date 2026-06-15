'use client';

import { useActionState, useEffect, useRef } from 'react';
import { logActivity, addTask, type FormState } from './actions';
import type { AccountOption } from '@/lib/activities/queries';

export function LogActivityForm({ accounts }: { accounts: AccountOption[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(logActivity, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state.ok]);

  return (
    <form ref={ref} action={action} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-charcoal-2 mb-1 block text-xs font-medium">Type</span>
          <select name="type" className="input" defaultValue="call">
            <option value="call">Call</option>
            <option value="visit">Visit</option>
            <option value="email">Email</option>
            <option value="note">Note</option>
          </select>
        </label>
        <label className="block">
          <span className="text-charcoal-2 mb-1 block text-xs font-medium">Account</span>
          <select name="account_id" className="input" defaultValue="">
            <option value="">— none —</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block">
        <span className="text-charcoal-2 mb-1 block text-xs font-medium">Note</span>
        <textarea name="body" rows={2} className="input" placeholder="What happened?" />
      </label>
      {state.error && <p className="text-sm text-[var(--color-atrisk)]">{state.error}</p>}
      {state.ok && <p className="text-sm text-[var(--color-ontrack)]">Logged ✓</p>}
      <button type="submit" disabled={pending} className="btn-primary" data-tap>
        {pending ? 'Saving…' : 'Log activity'}
      </button>
    </form>
  );
}

export function AddTaskForm({ accounts }: { accounts: AccountOption[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(addTask, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state.ok]);

  return (
    <form ref={ref} action={action} className="space-y-3">
      <label className="block">
        <span className="text-charcoal-2 mb-1 block text-xs font-medium">Task</span>
        <input name="title" className="input" placeholder="e.g. Call Trench Shoring re: reorder" />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-charcoal-2 mb-1 block text-xs font-medium">Due date</span>
          <input name="due_date" type="date" className="input" />
        </label>
        <label className="block">
          <span className="text-charcoal-2 mb-1 block text-xs font-medium">Account</span>
          <select name="account_id" className="input" defaultValue="">
            <option value="">— none —</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {state.error && <p className="text-sm text-[var(--color-atrisk)]">{state.error}</p>}
      {state.ok && <p className="text-sm text-[var(--color-ontrack)]">Added ✓</p>}
      <button type="submit" disabled={pending} className="btn-primary" data-tap>
        {pending ? 'Saving…' : 'Add task'}
      </button>
    </form>
  );
}
