import Link from 'next/link';
import { notFound } from 'next/navigation';
import { OpportunityForm } from '../OpportunityForm';
import { updateOpportunity, deleteOpportunity } from '../actions';
import { getOpportunity, getPipelineOptions, getStageWinProb } from '@/lib/pipeline/queries';

export const dynamic = 'force-dynamic';

export default async function EditOpportunityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [opp, { accounts, branches, contacts }, stageWinProb] = await Promise.all([
    getOpportunity(id),
    getPipelineOptions(),
    getStageWinProb(),
  ]);
  if (!opp) notFound();

  const update = updateOpportunity.bind(null, id);
  const remove = deleteOpportunity.bind(null, id);

  return (
    <div>
      <Link href="/pipeline" className="text-brand-700 text-sm hover:underline">
        ← Pipeline
      </Link>
      <h1 className="text-charcoal mt-2 text-xl font-bold tracking-tight">Edit opportunity</h1>
      <OpportunityForm
        action={update}
        accounts={accounts}
        branches={branches}
        contacts={contacts}
        stageWinProb={stageWinProb}
        opp={opp}
        submitLabel="Save changes"
      />
      <form action={remove} className="border-line mt-6 max-w-2xl border-t pt-4">
        <button
          type="submit"
          className="text-sm font-medium text-[var(--color-atrisk)] hover:underline"
          data-tap
        >
          Delete this opportunity
        </button>
      </form>
    </div>
  );
}
