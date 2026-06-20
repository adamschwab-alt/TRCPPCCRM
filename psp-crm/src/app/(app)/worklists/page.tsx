import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import {
  getAtRiskBranches,
  getPastCadenceBranches,
  getWhitespaceBranches,
  getLapsedAccounts,
  getWorklistCounts,
  type WorklistKey,
} from '@/lib/worklists/queries';
import { CoverageTable, type CoverageRow } from '../coverage/CoverageTable';
import { AccountsTable, type AccountVM } from '../accounts/AccountsTable';

export const dynamic = 'force-dynamic';

const TABS: { key: WorklistKey; label: string; hint: string }[] = [
  {
    key: 'at-risk',
    label: 'At-risk',
    hint: 'Lapsed, declining, or idle past cadence — prioritize outreach.',
  },
  {
    key: 'cadence',
    label: 'Past cadence',
    hint: 'Branches with no order beyond the cadence window.',
  },
  {
    key: 'whitespace',
    label: 'Cross-sell',
    hint: 'Branches buying one product line but not the other.',
  },
  {
    key: 'lapsed',
    label: 'Lapsed',
    hint: 'Bought last year, nothing this year — win-back targets.',
  },
];

export default async function WorklistsPage({
  searchParams,
}: {
  searchParams: Promise<{ list?: string }>;
}) {
  const sp = await searchParams;
  const active = (TABS.find((t) => t.key === sp.list)?.key ?? 'at-risk') as WorklistKey;
  const counts = await getWorklistCounts();

  const supabase = await createClient();
  const { data: accounts } = await supabase.from('accounts').select('id,name');
  const aName = new Map((accounts ?? []).map((a) => [a.id, a.name]));

  const tab = TABS.find((t) => t.key === active)!;

  return (
    <div>
      <h1 className="text-charcoal text-xl font-bold tracking-tight">Worklists</h1>
      <p className="text-muted text-sm">
        Action lists generated from your coverage data — sortable &amp; filterable.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/worklists?list=${t.key}`}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${
              active === t.key
                ? 'bg-brand text-white'
                : 'border-line bg-surface text-charcoal-2 hover:bg-canvas border'
            }`}
            data-tap
          >
            {t.label}{' '}
            <span className={active === t.key ? 'opacity-80' : 'text-muted'}>{counts[t.key]}</span>
          </Link>
        ))}
      </div>

      <p className="text-muted mt-3 mb-3 text-xs">{tab.hint}</p>

      <div>
        {active === 'at-risk' && <AtRisk aName={aName} />}
        {active === 'cadence' && <Cadence aName={aName} />}
        {active === 'whitespace' && <Whitespace aName={aName} />}
        {active === 'lapsed' && <Lapsed />}
      </div>
    </div>
  );
}

type NameMap = Map<string, string>;
const toCoverage = (rows: { account_id: string }[], aName: NameMap) =>
  rows.map((b) => ({ ...b, account_name: aName.get(b.account_id) ?? null })) as CoverageRow[];

async function AtRisk({ aName }: { aName: NameMap }) {
  const rows = await getAtRiskBranches();
  return <CoverageTable rows={toCoverage(rows, aName)} />;
}

async function Cadence({ aName }: { aName: NameMap }) {
  const { rows } = await getPastCadenceBranches();
  return <CoverageTable rows={toCoverage(rows, aName)} initialSortKey="idle" initialDir="desc" />;
}

async function Whitespace({ aName }: { aName: NameMap }) {
  const rows = await getWhitespaceBranches();
  return <CoverageTable rows={toCoverage(rows, aName)} />;
}

async function Lapsed() {
  const rows = await getLapsedAccounts();
  const supabase = await createClient();
  const { data: profiles } = await supabase.from('profiles').select('id,full_name,email');
  const ownerName = new Map((profiles ?? []).map((p) => [p.id, p.full_name || p.email]));
  const vm: AccountVM[] = rows.map((a) => ({
    ...a,
    owner_name: a.owner_id ? (ownerName.get(a.owner_id) ?? null) : null,
  }));
  return <AccountsTable rows={vm} initialSortKey="prior" initialDir="desc" />;
}
