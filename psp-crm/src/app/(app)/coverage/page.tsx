import { redirect } from 'next/navigation';

/** Coverage merged into Accounts as the "Branches" grain — old links and
 *  dashboard bookmarks land on the same view with filters intact. */
export default async function CoverageRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams({ view: 'branches' });
  for (const k of ['ws', 'rag', 'idle']) if (sp[k]) qs.set(k, sp[k]!);
  redirect(`/accounts?${qs.toString()}`);
}
