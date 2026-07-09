'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireRole } from '@/lib/auth';
import { performSync, performRebuild, deleteSalesByIds } from '@/lib/sync/run-sync';
import { runImport } from '@/lib/import/run-import';
import { logAudit } from '@/lib/audit';

export type FormState = { error?: string; ok?: boolean; message?: string };

/**
 * Pull new sales from the Acumatica OData feed and upsert them. Runs as the
 * admin's RLS session (staff may write transactions), so no service-role key
 * is needed for the manual button. Idempotent — re-running only adds new rows.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function syncNow(_prev: FormState, _formData: FormData): Promise<FormState> {
  await requireRole('admin');
  const supabase = await createClient();
  try {
    const result = await performSync(supabase);
    revalidatePath('/', 'layout');
    revalidatePath('/dashboard');
    revalidatePath('/admin');
    return { ok: true, message: result.message };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Sync failed' };
  }
}

/**
 * Fix duplicated sales data: re-pull the full Acumatica feed and REPLACE the
 * sales table with that single clean copy. Safe (pull-first-then-replace) and
 * admin-only. This is what a plain sync can't do — sync only adds rows.
 * NOTE: this touches Acumatica, so it only works once the live feed is reachable.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function rebuildData(_prev: FormState, _formData: FormData): Promise<FormState> {
  await requireRole('admin');
  const supabase = await createClient();
  try {
    const result = await performRebuild(supabase);
    revalidatePath('/', 'layout');
    revalidatePath('/dashboard');
    revalidatePath('/admin');
    return result.empty
      ? { error: result.message }
      : { ok: true, message: result.message };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Rebuild failed' };
  }
}

/**
 * Recovery path that does NOT touch Acumatica: restore the sales table from the
 * uploaded PSP workbook (.xlsx). Parses the file, clears the sales table, and
 * loads the workbook's rows. Use this if the sales data was emptied and the live
 * feed is unavailable. Accounts, owners, pipeline, and activities are untouched.
 */
export async function restoreFromWorkbook(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireRole('admin');
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { error: 'Choose the PSP workbook (.xlsx) file to upload first.' };
  }
  const supabase = await createClient();
  try {
    const { FileImportAdapter } = await import('@/lib/adapters/file-import');
    const buffer = Buffer.from(await file.arrayBuffer());
    const dataset = await new FileImportAdapter({ buffer }).load();
    if (dataset.transactions.length < 1000) {
      return {
        error: `That file only produced ${dataset.transactions.length} rows — is it the right workbook (the "Data" tab)? Nothing was changed.`,
      };
    }

    // Clear whatever is currently there (likely empty/partial), then load clean.
    for (;;) {
      const { data: ids, error } = await supabase
        .from('sales_transactions')
        .select('id')
        .limit(2000);
      if (error) throw new Error(error.message);
      if (!ids || ids.length === 0) break;
      await deleteSalesByIds(
        supabase,
        ids.map((r) => r.id),
      );
    }

    const summary = await runImport(supabase, dataset);
    await logAudit(supabase, 'restore', 'sales_transactions', null, {
      loaded: summary.transactions.inserted,
      as_of: summary.asOfDate,
    });
    revalidateData();
    return {
      ok: true,
      message: `Restored ${summary.transactions.inserted} sales rows from the workbook. Data current through ${summary.asOfDate}. Reload the dashboard.`,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Restore failed' };
  }
}

function revalidateData() {
  revalidatePath('/', 'layout');
  revalidatePath('/dashboard');
  revalidatePath('/admin');
}

// Keep ONE row per economic sale. The duplicate copies (original seed vs later
// load) share invoice #, SO #, date, amount and item description, but differ on
// line number / branch / margin — so we partition on the shared fields only and
// keep the newest row per group. Text fields are trimmed/lowered so trivial
// formatting differences don't hide a duplicate.
const DEDUPE_SQL = `
with d as (
  select id, row_number() over (
    partition by
      btrim(coalesce(invoice_nbr,'')),
      btrim(coalesce(so_nbr,'')),
      date,
      net_sale,
      lower(btrim(coalesce(inventory_description,'')))
    order by created_at desc, ctid desc
  ) as rn
  from sales_transactions
)
delete from sales_transactions s using d where s.id = d.id and d.rn > 1
`;

/**
 * Remove duplicate sales rows entirely inside the database — no Acumatica call,
 * so it can't hang on the feed. Uses the direct Postgres connection (one fast
 * statement) when DATABASE_URL is set; otherwise falls back to an API-based pass.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function dedupeData(_prev: FormState, _formData: FormData): Promise<FormState> {
  await requireRole('admin');
  try {
    const url = process.env.DATABASE_URL;
    if (url) {
      const { Client } = await import('pg');
      const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
      await client.connect();
      try {
        const before = await client.query('select count(*)::int as n from sales_transactions');
        const del = await client.query(DEDUPE_SQL);
        const after = await client.query('select count(*)::int as n from sales_transactions');
        revalidateData();
        return {
          ok: true,
          message: `Removed ${del.rowCount ?? 0} duplicate rows (${before.rows[0].n} → ${after.rows[0].n}). Reload the dashboard to see the corrected figures.`,
        };
      } finally {
        await client.end().catch(() => {});
      }
    }

    // Fallback: no direct connection configured — dedupe via the API.
    const removed = await dedupeViaApi();
    revalidateData();
    return {
      ok: true,
      message: `Removed ${removed} duplicate rows. Reload the dashboard to see the corrected figures.`,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Dedupe failed' };
  }
}

type DedupeRow = {
  id: string;
  invoice_nbr: string | null;
  so_nbr: string | null;
  date: string;
  net_sale: number;
  inventory_description: string | null;
};

async function dedupeViaApi(): Promise<number> {
  const supabase = await createClient();
  const rows: DedupeRow[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('sales_transactions')
      .select('id,invoice_nbr,so_nbr,date,net_sale,inventory_description')
      .order('created_at', { ascending: false }) // newest first → first seen is the keeper
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...(data as DedupeRow[]));
    if (data.length < pageSize) break;
  }

  const key = (r: DedupeRow) =>
    `${(r.invoice_nbr ?? '').trim()}|${(r.so_nbr ?? '').trim()}|${r.date}|${r.net_sale}|${(r.inventory_description ?? '').trim().toLowerCase()}`;

  const seen = new Set<string>();
  const dupeIds: string[] = [];
  for (const r of rows) {
    const k = key(r);
    if (seen.has(k)) dupeIds.push(r.id);
    else seen.add(k);
  }

  await deleteSalesByIds(supabase, dupeIds);
  return dupeIds.length;
}

/**
 * Bulk-load the Customer Wiring workbook: relationship ratings (parent tab),
 * rep assignments + contacts (branch tab), region roster contacts. Idempotent —
 * re-running skips existing contacts and only writes changes.
 */
export async function importWiring(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole('admin');
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { error: 'Choose the Customer Wiring workbook (.xlsx) first.' };
  }
  const supabase = await createClient();
  try {
    const { parseWiringWorkbook, runWiringImport } = await import('@/lib/import/wiring-import');
    const parsed = parseWiringWorkbook(Buffer.from(await file.arrayBuffer()));
    if (parsed.branchRows.length === 0 && parsed.parentRatings.length === 0) {
      return {
        error:
          'No wiring data found — is this the Customer Wiring workbook (with the "Customer Wiring - Branch" tab)?',
      };
    }
    const s = await runWiringImport(supabase, parsed);
    await logAudit(supabase, 'import', 'wiring_workbook', null, {
      ratings: s.ratingsUpdated,
      owners: s.branchOwnersSet,
      contacts: s.contactsCreated,
    });
    revalidatePath('/', 'layout');
    const parts = [
      `${s.ratingsUpdated} rating${s.ratingsUpdated === 1 ? '' : 's'} updated`,
      `${s.branchOwnersSet} branch owner${s.branchOwnersSet === 1 ? '' : 's'} set`,
      `${s.accountOwnersSet} account owner${s.accountOwnersSet === 1 ? '' : 's'} filled`,
      `${s.contactsCreated} contact${s.contactsCreated === 1 ? '' : 's'} added`,
      `${s.contactsSkipped} already present`,
    ];
    const warnings: string[] = [];
    if (s.unmatchedReps.length > 0)
      warnings.push(
        `No login found for: ${s.unmatchedReps.join(', ')} — create these users (exact full name), then re-run this import to assign their books.`,
      );
    if (s.unmatchedBranches.length > 0)
      warnings.push(`Unmatched branches: ${s.unmatchedBranches.slice(0, 5).join('; ')}…`);
    if (s.unmatchedAccounts.length > 0)
      warnings.push(`Unmatched accounts: ${s.unmatchedAccounts.slice(0, 5).join('; ')}`);
    return {
      ok: true,
      message: `Imported: ${parts.join(', ')}.${warnings.length ? ' ⚠ ' + warnings.join(' ') : ''}`,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Wiring import failed' };
  }
}

const eventSchema = z.object({
  kind: z.enum(['market', 'testimonial']),
  event_date: z.string().min(8, 'Pick a date'),
  title: z.string().min(3, 'Add the event / quote'),
  note: z.preprocess((v) => (v === '' ? null : v), z.string().nullable()),
});

/**
 * Case-study evidence log: market shocks (chart footnotes) and dated
 * testimonials — captured contemporaneously, which is what makes them credible.
 */
export async function addEvidence(_prev: FormState, formData: FormData): Promise<FormState> {
  const { userId } = await requireRole('admin');
  const parsed = eventSchema.safeParse({
    kind: formData.get('kind'),
    event_date: formData.get('event_date'),
    title: formData.get('title'),
    note: formData.get('note'),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const supabase = await createClient();
  const { error } = await supabase.from('exogenous_events').insert({
    ...parsed.data,
    created_by: userId,
  });
  if (error) {
    return {
      error: /relation .* does not exist|column .* does not exist/i.test(error.message)
        ? 'Run migration 0012 in Supabase first.'
        : error.message,
    };
  }
  revalidatePath('/admin');
  return { ok: true, message: parsed.data.kind === 'testimonial' ? 'Testimonial logged.' : 'Market event logged.' };
}

const num = (v: unknown) => z.coerce.number().parse(v);

const targetsSchema = z.object({
  grr_target: z.coerce.number().min(0).max(2),
  nrr_target: z.coerce.number().min(0).max(3),
  new_biz_target: z.coerce.number().min(0),
  xsell_target: z.coerce.number().int().min(0),
  pipeline_coverage_target: z.coerce.number().min(0),
  contraction_ceiling: z.coerce.number().min(0),
  retention_floor: z.coerce.number().min(0).max(1),
  cadence_days: z.coerce.number().int().min(1),
});

export async function updateTargets(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole('admin');
  // GRR/NRR/retention entered as percentages in the UI → store as ratios.
  const parsed = targetsSchema.safeParse({
    grr_target: num(formData.get('grr_target')) / 100,
    nrr_target: num(formData.get('nrr_target')) / 100,
    new_biz_target: formData.get('new_biz_target'),
    xsell_target: formData.get('xsell_target'),
    pipeline_coverage_target: formData.get('pipeline_coverage_target'),
    contraction_ceiling: formData.get('contraction_ceiling'),
    retention_floor: num(formData.get('retention_floor')) / 100,
    cadence_days: formData.get('cadence_days'),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const supabase = await createClient();
  const { error } = await supabase.from('targets').update(parsed.data).eq('id', true);
  if (error) return { error: error.message };
  await logAudit(supabase, 'update', 'targets', null, parsed.data);
  revalidatePath('/admin');
  revalidatePath('/dashboard');
  return { ok: true, message: 'Targets saved.' };
}

export async function updateUser(formData: FormData): Promise<void> {
  await requireRole('admin');
  const id = String(formData.get('id'));
  const role = z.enum(['admin', 'manager', 'rep']).parse(formData.get('role'));
  const is_active = formData.get('is_active') === 'on';
  const supabase = await createClient();
  await supabase.from('profiles').update({ role, is_active }).eq('id', id);
  await logAudit(supabase, 'update', 'user', id, { role, is_active });
  revalidatePath('/admin');
}

const inviteSchema = z.object({
  email: z.string().email(),
  full_name: z.string().optional().default(''),
  role: z.enum(['admin', 'manager', 'rep']),
});

export async function inviteUser(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole('admin');
  const parsed = inviteSchema.safeParse({
    email: formData.get('email'),
    full_name: formData.get('full_name') ?? '',
    role: formData.get('role'),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return {
      error:
        'Email invites need the service role key. Set SUPABASE_SERVICE_ROLE_KEY in Vercel, or add the user in Supabase → Authentication → Users.',
    };
  }

  // Absolute URL the invite link returns to (must be allow-listed in Supabase →
  // Authentication → URL Configuration → Redirect URLs).
  const origin =
    (await headers()).get('origin') ?? process.env.NEXT_PUBLIC_SITE_URL ?? '';
  const redirectTo = `${origin}/auth/confirm?next=/auth/set-password`;

  const { error } = await admin.auth.admin.inviteUserByEmail(parsed.data.email, {
    data: { full_name: parsed.data.full_name, role: parsed.data.role },
    redirectTo,
  });
  if (error) {
    const already = /already|registered|exists/i.test(error.message);
    return {
      error: already
        ? `${parsed.data.email} already has an account. Delete it in Supabase → Authentication → Users, then invite again — or have them use "forgot password".`
        : `Could not send the invite: ${error.message}. Check that email sending (SMTP) is configured in Supabase → Authentication.`,
    };
  }

  await logAudit(await createClient(), 'invite', 'user', null, {
    email: parsed.data.email,
    role: parsed.data.role,
  });

  revalidatePath('/admin');
  return {
    ok: true,
    message: `Invitation emailed to ${parsed.data.email}. They'll click the link, set a password, and enroll 2FA. If it doesn't arrive in a few minutes, check spam — or confirm SMTP is set up in Supabase.`,
  };
}
