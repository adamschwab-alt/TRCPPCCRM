// Centralized customer name matching + normalization.
// Solves the "Suffolk / Suffolk Inc / Suffolk Construction" duplicate problem.

import { prisma } from "./db";

const COMMON_SUFFIXES = [
  "incorporated", "inc", "llc", "llp", "corp", "corporation", "co", "company",
  "companies", "construction", "contracting", "contractors", "constr",
  "builders", "building", "group", "holdings", "associates", "ltd", "limited",
  "international", "intl", "industries", "industrial", "homes", "development",
  "developers", "developments", "enterprises", "services",
];

const SUFFIX_RE = new RegExp("\\b(" + COMMON_SUFFIXES.join("|") + ")\\b", "gi");

export function normalizeName(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(SUFFIX_RE, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

// Combined similarity for "did you mean" suggestions. Mixes:
//   - token-overlap (handles "Suffolk" vs "Suffolk Construction Inc")
//   - bigram overlap (handles typos like "Sufolk" vs "Suffolk")
function bigrams(s: string): Set<string> {
  const set = new Set<string>();
  const x = s.toLowerCase().replace(/\s+/g, "");
  for (let i = 0; i < x.length - 1; i++) set.add(x.slice(i, i + 2));
  return set;
}
export function similarity(a: string, b: string): number {
  const norm = (s: string) => normalizeName(s).split(" ").filter(Boolean);
  const ta = new Set(norm(a));
  const tb = new Set(norm(b));
  let tokenScore = 0;
  if (ta.size > 0 && tb.size > 0) {
    let inter = 0;
    for (const t of ta) if (tb.has(t)) inter++;
    tokenScore = inter / Math.max(ta.size, tb.size);
  }
  // Dice coefficient on bigrams (character-level — catches typos)
  const ba = bigrams(normalizeName(a));
  const bb = bigrams(normalizeName(b));
  let bigramScore = 0;
  if (ba.size > 0 && bb.size > 0) {
    let inter = 0;
    for (const x of ba) if (bb.has(x)) inter++;
    bigramScore = (2 * inter) / (ba.size + bb.size);
  }
  // Take the max — token match dominates when applicable, bigram catches typos
  return Math.max(tokenScore, bigramScore);
}

export interface MatchResult {
  customer: { id: number; companyName: string; customerNumber: string | null } | null;
  matchedBy: "customerNumber" | "exactName" | "alias" | "normalized" | null;
  suggestions: { id: number; companyName: string; customerNumber: string | null; score: number }[];
}

// Single source of truth for customer-name → Customer ID resolution.
// Tried in order:
//   1. Customer Number (e.g. "CUS-0042") — exact, takes precedence
//   2. Exact case-insensitive companyName
//   3. Exact case-insensitive alias
//   4. Normalized (suffix-stripped) name match
//   5. No match — return top-3 fuzzy suggestions
export async function matchCustomer(
  rawName: string,
  customerNumber?: string | null
): Promise<MatchResult> {
  if (customerNumber) {
    const c = await prisma.customer.findUnique({
      where: { customerNumber },
      select: { id: true, companyName: true, customerNumber: true },
    });
    if (c) return { customer: c, matchedBy: "customerNumber", suggestions: [] };
  }
  const name = (rawName || "").trim();
  if (!name) return { customer: null, matchedBy: null, suggestions: [] };

  const exact = await prisma.customer.findFirst({
    where: { isArchived: false, companyName: { equals: name, mode: "insensitive" } },
    select: { id: true, companyName: true, customerNumber: true },
  });
  if (exact) return { customer: exact, matchedBy: "exactName", suggestions: [] };

  const aliasHit = await prisma.customerAlias.findFirst({
    where: { alias: { equals: name, mode: "insensitive" } },
    include: { customer: { select: { id: true, companyName: true, customerNumber: true, isArchived: true } } },
  });
  if (aliasHit?.customer && !aliasHit.customer.isArchived) {
    return {
      customer: { id: aliasHit.customer.id, companyName: aliasHit.customer.companyName, customerNumber: aliasHit.customer.customerNumber },
      matchedBy: "alias",
      suggestions: [],
    };
  }

  const norm = normalizeName(name);
  if (norm) {
    const aliasNormHit = await prisma.customerAlias.findFirst({
      where: { normalized: norm },
      include: { customer: { select: { id: true, companyName: true, customerNumber: true, isArchived: true } } },
    });
    if (aliasNormHit?.customer && !aliasNormHit.customer.isArchived) {
      return {
        customer: { id: aliasNormHit.customer.id, companyName: aliasNormHit.customer.companyName, customerNumber: aliasNormHit.customer.customerNumber },
        matchedBy: "normalized",
        suggestions: [],
      };
    }
    const all = await prisma.customer.findMany({
      where: { isArchived: false },
      select: { id: true, companyName: true, customerNumber: true },
    });
    for (const c of all) {
      if (normalizeName(c.companyName) === norm) {
        return { customer: c, matchedBy: "normalized", suggestions: [] };
      }
    }
    const scored = all
      .map((c) => ({ ...c, score: similarity(name, c.companyName) }))
      .filter((c) => c.score >= 0.4)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
    return { customer: null, matchedBy: null, suggestions: scored };
  }

  return { customer: null, matchedBy: null, suggestions: [] };
}

// Generates the next CUS-XXXX number. For our scale, findFirst→create
// is fine; the @unique constraint catches the rare race.
export async function nextCustomerNumber(): Promise<string> {
  const last = await prisma.customer.findFirst({
    where: { customerNumber: { startsWith: "CUS-" } },
    orderBy: { customerNumber: "desc" },
    select: { customerNumber: true },
  });
  let n = 1;
  if (last?.customerNumber) {
    const tail = parseInt(last.customerNumber.replace("CUS-", ""), 10);
    if (!isNaN(tail)) n = tail + 1;
  }
  return `CUS-${String(n).padStart(4, "0")}`;
}

export async function backfillCustomerNumbers(): Promise<number> {
  const missing = await prisma.customer.findMany({
    where: { customerNumber: null },
    orderBy: { id: "asc" },
    select: { id: true },
  });
  let n = 0;
  for (const c of missing) {
    const num = await nextCustomerNumber();
    await prisma.customer.update({ where: { id: c.id }, data: { customerNumber: num } });
    n++;
  }
  return n;
}
