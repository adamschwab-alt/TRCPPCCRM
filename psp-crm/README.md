# Pacific Shoring — Coverage CRM (v0 spike)

A **coverage-first** sales CRM for **Pacific Shoring Products (PSP)**, a trench-shoring
manufacturer that sells through national equipment-rental houses. PSP is an
account-penetration / reorder business (~88% of revenue from existing accounts), so the
app leads with **coverage**: retention (GRR/NRR), contraction/expansion, reorder cadence,
and cross-sell white-space.

This is the **v0 spike** — the production foundation plus one feature (the Coverage
Dashboard). It is a deliberate subset of the full build, on the same locked stack, full
schema, real auth/MFA/RLS, and the real metric layer, so the full build is **purely
additive** (see [The pivot seam](#the-pivot-seam)).

> Separate app from the Redland CRM in this repo — different company, different stack.
> Everything for PSP lives under `psp-crm/`.

## Stack

- **Next.js 16** (App Router, TypeScript strict) + **Tailwind v4**
- **Supabase**: Postgres, Auth (email+password, **TOTP MFA**, invite-only), **RLS**, Storage
- **Vercel** hosting; secrets via env only
- Forms: react-hook-form + zod · Charts: Recharts · Tests: Vitest (+ PGlite for SQL)

## What's in v0

- Full Postgres schema — **every** table from the brief (incl. deferred ones), indexed.
- Real auth: invite-only, **TOTP MFA enrolled on first login** + challenged thereafter,
  three roles (`admin` / `manager` / `rep`), **Row-Level Security** with ownership.
- Importer (`FileImportAdapter`) + seed script; `AcumaticaODataAdapter` **stub** for phase 2.
- Coverage **metric layer** as `security_invoker` SQL views — role-scoping is automatic.
- **Coverage Dashboard** (role-scoped) + read-only **Accounts / Branch** browse.
- Light PSP branding + mobile-responsive layout.

Deferred (routes stubbed, schema already present): Worklists, Pipeline, Activities/Tasks,
Admin UI, Email alerts, PWA/offline, Acumatica live sync.

---

## Quick start

```bash
cd psp-crm
npm install
cp .env.example .env.local   # fill in Supabase values
```

### 1. Create a Supabase project

From the [Supabase dashboard](https://supabase.com/dashboard): create a project, then copy
into `.env.local`:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Settings → API)
- `SUPABASE_SERVICE_ROLE_KEY` (Settings → API — **server-only**)
- `DATABASE_URL` (Settings → Database → Connection string / URI)

Enable **MFA (TOTP)** under Authentication → Providers/MFA, and turn **off** open sign-ups
(Authentication → Settings) so the app stays invite-only.

### 2. Migrate

```bash
npm run db:migrate         # applies supabase/migrations/*.sql in order
# npm run db:reset         # drop & recreate public schema, then apply all (dev only)
```

(Alternatively use the Supabase CLI: `supabase db push` — same migrations folder.)

### 3. Seed the workbook

Drop `PSP_Account_Coverage_Tracker.xlsx` into `psp-crm/data/` (gitignored), then:

```bash
npm run db:seed -- ./data/PSP_Account_Coverage_Tracker.xlsx
```

The seed prints an import summary (accounts / branches / transactions, the derived
`as_of_date`, and any **unmapped source headers** to tune). Re-runs are idempotent
(dedupe on `invoice_nbr + so_nbr + line_nbr`).

### 4. Invite the first users

Invite-only — there is no in-app admin UI in v0. In the Supabase dashboard →
Authentication → Users → **Invite user**. Set the role in the user's metadata:

```json
{ "full_name": "Dana Rep", "role": "rep" } // role ∈ admin | manager | rep
```

A `profiles` row is created automatically on first sign-in (trigger `handle_new_user`).
First login forces TOTP enrollment.

### 5. Run

```bash
npm run dev    # http://localhost:3000
```

---

## Scripts

| Script               | What it does                                   |
| -------------------- | ---------------------------------------------- |
| `npm run dev`        | Dev server                                     |
| `npm run build`      | Production build                               |
| `npm run typecheck`  | `tsc --noEmit`                                 |
| `npm run lint`       | ESLint                                         |
| `npm run format`     | Prettier write                                 |
| `npm test`           | Vitest (metric SQL via PGlite + RLS + oracles) |
| `npm run db:migrate` | Apply migrations                               |
| `npm run db:seed`    | Import the workbook                            |
| `npm run db:reset`   | Recreate schema + re-apply migrations (dev)    |

---

## Coverage metrics (§4)

`as_of` = `app_settings.as_of_date`. **TTM** = `[as_of − 12mo + 1d, as_of]`;
**Prior-TTM** = the 12 months before. **Booked** excludes `status = 'Canceled'`.

- **Per branch** (`branch_metrics`): ttm/prior revenue, Δ, Δ%, GM%, aluminum/steel TTM,
  last order, days idle, status (`Active`/`New`/`Declining`/`Lapsed`), coverage RAG, white-space.
- **Per account** (`account_metrics`): branch rollups — **retention evaluated on account
  totals**, not summed from branch deltas.
- **Portfolio** (`portfolio_kpis`): current/prior book, YoY, GRR, NRR, contraction,
  expansion, new business. `GRR = (prior − lapsed − contraction)/prior`;
  `NRR = (prior − lapsed − contraction + expansion)/prior`.

Views use `security_invoker` so they respect the caller's RLS — a rep's KPIs reflect only
their book, with no role-specific query code.

### Proving correctness

- `tests/metrics.logic.test.ts` — runs the **real** migration SQL in PGlite against a tiny
  hand-computed fixture (GRR/NRR/white-space math).
- `tests/rls.isolation.test.ts` — proves a rep **cannot** read another rep's branch; a
  manager sees all.
- `tests/metrics.oracle.test.ts` — asserts the §4 workbook oracles (current_book ≈ $65.40M,
  GRR ≈ 78.4%, contraction ≈ $10M, Trench Shoring largest, 136 aluminum-only, 21 steel-only,
  …). Runs against a **live seeded** project; skips when env/seed are absent.

```bash
npm test                                   # logic + RLS (oracles skip without a DB)
# after migrate + seed against a project:
npm test -- tests/metrics.oracle.test.ts   # ties the oracles
```

---

## Importer — column mapping (§6)

`FileImportAdapter` reads the workbook's `Data` sheet (any sheet whose name contains
"data"). Headers are matched by **normalized alias** (lowercase, alphanumerics only), so
minor naming differences don't break the import. Source → schema:

| Schema field            | Accepted headers (examples)                                |
| ----------------------- | ---------------------------------------------------------- |
| `date`                  | Date, Invoice Date, Tran Date, Order Date                  |
| `net_sale`              | Net Sale(s), Amount, Ext Price, Revenue, Line Total        |
| `quantity` / `cost`     | Qty / Cost, Ext Cost, COGS                                 |
| `margin`                | Margin, Gross Margin, Gross Profit, GP                     |
| `status`                | Status, Order/SO/Doc Status → `Closed`/`Open`/`Canceled`   |
| `account_name` (parent) | Account, Parent, Parent Account, National Account, Company |
| `branch_name` (ship-to) | Branch, Ship-To, Location, Customer, Site                  |
| `inventory_id/desc`     | Item ID/SKU/Part No · Description / Item Description       |
| `item_class`            | Item Class, Class, Category                                |
| `product_line`          | Product Line / derived from item class + description       |
| `sales_person`          | Salesperson, Sales Rep, Account Manager                    |
| `state` / `city`        | State / City                                               |
| `invoice_nbr/so_nbr`    | Invoice No, SO No, Order No (dedupe key)                   |
| `line_nbr`              | Line No (dedupe key; synthesized if absent)                |

`product_line` resolves to `Aluminum` / `Steel` / `Other` (explicit column, else keyword
match on item class/description). The seed prints **unmapped headers** — tune
`HEADER_ALIASES` in `src/lib/adapters/file-import.ts` if a needed column was missed.

Swapping to live Acumatica sync (phase 2) means implementing `AcumaticaODataAdapter.load()`
to return the same `ImportDataset` — nothing downstream changes.

---

## Deploy (Vercel)

1. Import the repo in Vercel; set **Root Directory** to `psp-crm`.
2. Add env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`) in Project Settings.
3. Run migrations against the project (`npm run db:migrate` locally, or `supabase db push`).
4. Deploy. Seed the workbook (locally with prod env, or via a one-off).

Branding: safety-orange (`#F26A1B`) / charcoal theme tokens live in
`src/app/globals.css` and `src/components/Logo.tsx`. Drop the real logo at
`public/psp-logo.svg` (or Supabase Storage) to swap the wordmark.

---

## The pivot seam

v0 stops at the end of the build sequence. The load-bearing parts — stack, full schema,
RLS + ownership, MFA, metric layer, importer, branding, deploy — are production-grade, so
the full build is additive: Worklists → Activities/Tasks → Pipeline → Admin UI → Alerts →
PWA/offline → Acumatica live sync. The deferred tables (`opportunities`, `activities`,
`tasks`, `audit_log`, `stage_win_prob`) and `owner_id` columns already exist with FKs + RLS;
the deferred feature routes are stubbed under `src/app/(app)/`.
