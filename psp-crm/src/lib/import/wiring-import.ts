// Customer Wiring workbook importer — bulk-loads relationship ratings, rep
// assignments, and customer contacts from the PSP_Customer_Wiring workbook.
// Not guarded with 'server-only' so tests can exercise the parser under Node.
import * as XLSX from 'xlsx';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

export type WiringContact = { name: string; email: string | null };

export type WiringBranchRow = {
  branchName: string;
  parentName: string | null;
  rating: number | null;
  assignedRep: string | null;
  contacts: WiringContact[];
};

export type WiringRegionContact = {
  accountPrefix: string; // region "United Rentals — West" → account "United Rentals"
  name: string;
  title: string | null;
  email: string | null;
};

export type ParsedWiring = {
  parentRatings: { account: string; rating: number }[];
  branchRows: WiringBranchRow[];
  regionContacts: WiringRegionContact[];
};

const s = (v: unknown): string | null => {
  if (v == null) return null;
  const t = String(v).trim();
  return t === '' ? null : t;
};
const ratingOf = (v: unknown): number | null => {
  const n = Number(v);
  return n === 1 || n === 2 || n === 3 ? n : null;
};

/** Locate the header row by its first-column label (robust to banner rows). */
function findHeader(rows: unknown[][], label: string): number {
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    if (s(rows[i]?.[0]) === label) return i;
  }
  return -1;
}

export function parseWiringWorkbook(buffer: Buffer | ArrayBuffer): ParsedWiring {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const grid = (name: string): unknown[][] =>
    wb.Sheets[name]
      ? (XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: null }) as unknown[][])
      : [];

  // ── Parent-level ratings ("Customer Wiring", header col A = "Customer (entity)")
  const parentRatings: ParsedWiring['parentRatings'] = [];
  {
    const rows = grid('Customer Wiring');
    const h = findHeader(rows, 'Customer (entity)');
    if (h >= 0) {
      for (let i = h + 1; i < rows.length; i++) {
        const account = s(rows[i]?.[0]);
        const rating = ratingOf(rows[i]?.[6]); // "Relationship (1-3)"
        if (account && rating) parentRatings.push({ account, rating });
      }
    }
  }

  // ── Branch rows ("Customer Wiring - Branch"): rep + up to 3 contacts ────────
  const branchRows: WiringBranchRow[] = [];
  {
    const rows = grid('Customer Wiring - Branch');
    const h = findHeader(rows, 'Customer (branch)');
    if (h >= 0) {
      for (let i = h + 1; i < rows.length; i++) {
        const r = rows[i] ?? [];
        const branchName = s(r[0]);
        if (!branchName) continue;
        const contacts: WiringContact[] = [];
        for (const [ci, ei] of [
          [25, 26],
          [27, 28],
          [29, 30],
        ] as const) {
          const name = s(r[ci]);
          if (name) contacts.push({ name, email: s(r[ei]) });
        }
        branchRows.push({
          branchName,
          parentName: s(r[1]),
          rating: ratingOf(r[9]),
          assignedRep: s(r[24]),
          contacts,
        });
      }
    }
  }

  // ── Region roster contacts ("Region Map", roster columns F–I) ───────────────
  const regionContacts: WiringRegionContact[] = [];
  {
    const rows = grid('Region Map');
    const h = findHeader(rows, 'Branch (key — matches wiring tab)');
    if (h >= 0) {
      for (let i = h + 1; i < rows.length; i++) {
        const r = rows[i] ?? [];
        const region = s(r[5]);
        const name = s(r[6]);
        if (!region || !name) continue;
        regionContacts.push({
          accountPrefix: region.split('—')[0].trim(),
          name,
          title: s(r[7]),
          email: s(r[8]),
        });
      }
    }
  }

  return { parentRatings, branchRows, regionContacts };
}

export type WiringImportSummary = {
  ratingsUpdated: number;
  branchOwnersSet: number;
  accountOwnersSet: number;
  contactsCreated: number;
  contactsSkipped: number;
  unmatchedAccounts: string[];
  unmatchedBranches: string[];
  unmatchedReps: string[];
};

export type WiringImportOptions = {
  contacts: boolean;
  ratings: boolean;
  owners: boolean;
};

/**
 * Apply a parsed wiring workbook — scope controlled per run (contacts only,
 * ratings, rep assignments, or any combination). Idempotent: re-running
 * updates ratings in place, only sets owners that changed, and skips contacts
 * that already exist (matched by account + name), so the workbook can be
 * maintained and re-uploaded as the living template. Owner assignment requires
 * a login whose full name matches the workbook's "Assigned Rep" — unmatched
 * reps are reported so you can create the logins and re-run.
 */
export async function runWiringImport(
  supabase: SupabaseClient<Database>,
  parsed: ParsedWiring,
  opts: WiringImportOptions = { contacts: true, ratings: true, owners: true },
): Promise<WiringImportSummary> {
  const [{ data: accounts }, { data: branches }, { data: profiles }, { data: existingContacts }] =
    await Promise.all([
      supabase.from('accounts').select('id,name,owner_id,relationship_rating'),
      supabase.from('branches').select('id,account_id,name,owner_id'),
      supabase.from('profiles').select('id,full_name,is_active'),
      supabase.from('contacts').select('id,account_id,name'),
    ]);

  const accountByName = new Map(
    (accounts ?? []).map((a) => [a.name.trim().toLowerCase(), a]),
  );
  const branchByName = new Map(
    (branches ?? []).map((b) => [b.name.trim().toLowerCase(), b]),
  );
  const repByName = new Map(
    (profiles ?? [])
      .filter((p) => p.is_active && p.full_name)
      .map((p) => [p.full_name!.trim().toLowerCase(), p.id]),
  );
  const contactKeys = new Set(
    (existingContacts ?? []).map((c) => `${c.account_id}␟${c.name.trim().toLowerCase()}`),
  );

  const summary: WiringImportSummary = {
    ratingsUpdated: 0,
    branchOwnersSet: 0,
    accountOwnersSet: 0,
    contactsCreated: 0,
    contactsSkipped: 0,
    unmatchedAccounts: [],
    unmatchedBranches: [],
    unmatchedReps: [],
  };
  const missAccount = new Set<string>();
  const missBranch = new Set<string>();
  const missRep = new Set<string>();

  // ── Ratings (account grain, from the parent tab) ────────────────────────────
  for (const { account, rating } of opts.ratings ? parsed.parentRatings : []) {
    const a = accountByName.get(account.trim().toLowerCase());
    if (!a) {
      missAccount.add(account);
      continue;
    }
    if ((a.relationship_rating ?? 2) !== rating) {
      const { error } = await supabase
        .from('accounts')
        .update({ relationship_rating: rating })
        .eq('id', a.id);
      if (!error) summary.ratingsUpdated++;
    }
  }

  // ── Branch rows: owners + contacts ──────────────────────────────────────────
  const toInsert: {
    account_id: string;
    branch_id: string | null;
    name: string;
    email: string | null;
    title: string | null;
    tier: number;
    covered_by: string | null;
  }[] = [];
  const repAccounts = new Map<string, Set<string>>(); // repId → account ids (for account-owner fill)

  for (const row of parsed.branchRows) {
    const branch = branchByName.get(row.branchName.trim().toLowerCase());
    const account = row.parentName
      ? accountByName.get(row.parentName.trim().toLowerCase())
      : branch
        ? (accounts ?? []).find((a) => a.id === branch.account_id)
        : undefined;
    if (!branch && !account) {
      missBranch.add(row.branchName);
      continue;
    }
    const accountId = account?.id ?? branch!.account_id;

    // Owner assignment (needs a matching login)
    if (opts.owners && row.assignedRep) {
      const repId = repByName.get(row.assignedRep.trim().toLowerCase());
      if (!repId) missRep.add(row.assignedRep);
      else {
        if (branch && branch.owner_id !== repId) {
          const { error } = await supabase
            .from('branches')
            .update({ owner_id: repId })
            .eq('id', branch.id);
          if (!error) summary.branchOwnersSet++;
        }
        if (!repAccounts.has(repId)) repAccounts.set(repId, new Set());
        repAccounts.get(repId)!.add(accountId);
      }
    }

    // Contacts (tier 5 = branch grain)
    for (const c of opts.contacts ? row.contacts : []) {
      const key = `${accountId}␟${c.name.trim().toLowerCase()}`;
      if (contactKeys.has(key)) {
        summary.contactsSkipped++;
        continue;
      }
      contactKeys.add(key);
      toInsert.push({
        account_id: accountId,
        branch_id: branch?.id ?? null,
        name: c.name,
        email: c.email,
        title: null,
        tier: 5,
        covered_by: row.assignedRep,
      });
    }
  }

  // ── Region roster contacts (tier 2 = regional/district) ────────────────────
  for (const rc of opts.contacts ? parsed.regionContacts : []) {
    const a = accountByName.get(rc.accountPrefix.trim().toLowerCase());
    if (!a) {
      missAccount.add(rc.accountPrefix);
      continue;
    }
    const key = `${a.id}␟${rc.name.trim().toLowerCase()}`;
    if (contactKeys.has(key)) {
      summary.contactsSkipped++;
      continue;
    }
    contactKeys.add(key);
    toInsert.push({
      account_id: a.id,
      branch_id: null,
      name: rc.name,
      email: rc.email,
      title: rc.title,
      tier: 2,
      covered_by: null,
    });
  }

  for (let i = 0; i < toInsert.length; i += 200) {
    const batch = toInsert.slice(i, i + 200);
    const { error } = await supabase.from('contacts').insert(batch);
    if (!error) summary.contactsCreated += batch.length;
  }

  // ── Fill empty account owners where a single rep covers the whole account ──
  const accountRepVotes = new Map<string, Set<string>>();
  for (const [repId, accIds] of repAccounts) {
    for (const accId of accIds) {
      if (!accountRepVotes.has(accId)) accountRepVotes.set(accId, new Set());
      accountRepVotes.get(accId)!.add(repId);
    }
  }
  for (const [accId, reps] of accountRepVotes) {
    if (reps.size !== 1) continue;
    const a = (accounts ?? []).find((x) => x.id === accId);
    if (a && !a.owner_id) {
      const { error } = await supabase
        .from('accounts')
        .update({ owner_id: [...reps][0] })
        .eq('id', accId);
      if (!error) summary.accountOwnersSet++;
    }
  }

  summary.unmatchedAccounts = [...missAccount].slice(0, 20);
  summary.unmatchedBranches = [...missBranch].slice(0, 20);
  summary.unmatchedReps = [...missRep];
  return summary;
}
