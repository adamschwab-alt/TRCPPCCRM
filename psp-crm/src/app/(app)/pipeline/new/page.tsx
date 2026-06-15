import Link from 'next/link';
import { OpportunityForm } from '../OpportunityForm';
import { createOpportunity } from '../actions';
import { getPipelineOptions, getStageWinProb } from '@/lib/pipeline/queries';

export const dynamic = 'force-dynamic';

export default async function NewOpportunityPage() {
  const [{ accounts, branches }, stageWinProb] = await Promise.all([
    getPipelineOptions(),
    getStageWinProb(),
  ]);
  return (
    <div>
      <Link href="/pipeline" className="text-brand-700 text-sm hover:underline">
        ← Pipeline
      </Link>
      <h1 className="text-charcoal mt-2 text-xl font-bold tracking-tight">New opportunity</h1>
      <OpportunityForm
        action={createOpportunity}
        accounts={accounts}
        branches={branches}
        stageWinProb={stageWinProb}
        submitLabel="Create opportunity"
      />
    </div>
  );
}
