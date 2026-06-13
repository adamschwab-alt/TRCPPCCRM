import { Card } from './ui';

/** Deferred-feature placeholder. The route exists so the full-build pivot is a
 * drop-in (§1.1, §11) — no router restructuring needed. */
export function Placeholder({ title, milestone, blurb }: { title: string; milestone: string; blurb: string }) {
  return (
    <div>
      <h1 className="text-xl font-bold tracking-tight text-charcoal">{title}</h1>
      <Card className="mt-5 p-8">
        <span className="rounded bg-brand-50 px-2 py-0.5 text-xs font-bold uppercase text-brand-700">
          {milestone}
        </span>
        <p className="mt-3 max-w-lg text-sm text-charcoal-2">{blurb}</p>
        <p className="mt-2 text-xs text-muted">
          Deferred to the full build. The schema, RLS, ownership, and metric views this feature needs
          already exist, so it is purely additive.
        </p>
      </Card>
    </div>
  );
}
