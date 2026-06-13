import { Card } from './ui';

/** Deferred-feature placeholder. The route exists so the full-build pivot is a
 * drop-in (§1.1, §11) — no router restructuring needed. */
export function Placeholder({
  title,
  milestone,
  blurb,
}: {
  title: string;
  milestone: string;
  blurb: string;
}) {
  return (
    <div>
      <h1 className="text-charcoal text-xl font-bold tracking-tight">{title}</h1>
      <Card className="mt-5 p-8">
        <span className="bg-brand-50 text-brand-700 rounded px-2 py-0.5 text-xs font-bold uppercase">
          {milestone}
        </span>
        <p className="text-charcoal-2 mt-3 max-w-lg text-sm">{blurb}</p>
        <p className="text-muted mt-2 text-xs">
          Deferred to the full build. The schema, RLS, ownership, and metric views this feature
          needs already exist, so it is purely additive.
        </p>
      </Card>
    </div>
  );
}
