-- ════════════════════════════════════════════════════════════════════════════
-- 0017 Patch: resolve 0016 account-name mismatches (Q1/Q3/Q5 diagnostics)
-- ════════════════════════════════════════════════════════════════════════════
-- Root cause: 14 workbook account names had no exact match in accounts.
-- Q5 (2026-07-18) confirmed the real DB modeling:
--   * 10 accounts are one-account-per-location; account name == its only
--     branch name, with a location suffix the workbook did not carry.
--   * Workbook 'Sunstate Equipment ' (trailing space) is the real
--     'Sunstate Equipment' account; its districts already exist.
--   * 'United Rentals of Canada, Inc.' branches live under other accounts;
--     the Canada districts already exist under 'United Rentals'.
-- All statements are idempotent (NOT EXISTS guards / no-op if names absent).
-- Exact strings below are byte-verified via quote_literal in Q5.
-- ════════════════════════════════════════════════════════════════════════════

-- ── Section 1: location-suffixed single-branch accounts ─────────────────────
-- Create the workbook's district on the suffixed account, link its branch.

INSERT INTO districts (account_id, name, region_text, created_at, updated_at)
SELECT a.id, 'Direct', 'Direct', now(), now()
FROM accounts a
WHERE a.name = 'Allen Trench Safety Corporation - Bellevue, MI'
AND NOT EXISTS (
  SELECT 1 FROM districts d
  WHERE d.account_id = a.id AND lower(d.name) = lower('Direct')
);
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE a.name = 'Allen Trench Safety Corporation - Bellevue, MI'
AND lower(d.name) = lower('Direct')
AND b.account_id = a.id
AND b.name = 'Allen Trench Safety Corporation - Bellevue, MI';

INSERT INTO districts (account_id, name, region_text, created_at, updated_at)
SELECT a.id, 'Direct', 'Direct', now(), now()
FROM accounts a
WHERE a.name = 'BOA Rentals LLC - Waterman, IL'
AND NOT EXISTS (
  SELECT 1 FROM districts d
  WHERE d.account_id = a.id AND lower(d.name) = lower('Direct')
);
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE a.name = 'BOA Rentals LLC - Waterman, IL'
AND lower(d.name) = lower('Direct')
AND b.account_id = a.id
AND b.name = 'BOA Rentals LLC - Waterman, IL';

INSERT INTO districts (account_id, name, region_text, created_at, updated_at)
SELECT a.id, 'Direct', 'Direct', now(), now()
FROM accounts a
WHERE a.name = 'Canhelco - Manassas, VA'
AND NOT EXISTS (
  SELECT 1 FROM districts d
  WHERE d.account_id = a.id AND lower(d.name) = lower('Direct')
);
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE a.name = 'Canhelco - Manassas, VA'
AND lower(d.name) = lower('Direct')
AND b.account_id = a.id
AND b.name = 'Canhelco - Manassas, VA';

INSERT INTO districts (account_id, name, region_text, created_at, updated_at)
SELECT a.id, 'Guardian Trench - West', 'Guardian Trench - West', now(), now()
FROM accounts a
WHERE a.name = 'Guardian Trench Safety - Phoenix AZ'
AND NOT EXISTS (
  SELECT 1 FROM districts d
  WHERE d.account_id = a.id AND lower(d.name) = lower('Guardian Trench - West')
);
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE a.name = 'Guardian Trench Safety - Phoenix AZ'
AND lower(d.name) = lower('Guardian Trench - West')
AND b.account_id = a.id
AND b.name = 'Guardian Trench Safety - Phoenix AZ';

INSERT INTO districts (account_id, name, region_text, created_at, updated_at)
SELECT a.id, 'Direct', 'Direct', now(), now()
FROM accounts a
WHERE a.name = 'Iron Lot - Burlington, NC'
AND NOT EXISTS (
  SELECT 1 FROM districts d
  WHERE d.account_id = a.id AND lower(d.name) = lower('Direct')
);
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE a.name = 'Iron Lot - Burlington, NC'
AND lower(d.name) = lower('Direct')
AND b.account_id = a.id
AND b.name = 'Iron Lot - Burlington, NC';

INSERT INTO districts (account_id, name, region_text, created_at, updated_at)
SELECT a.id, 'Direct', 'Direct', now(), now()
FROM accounts a
WHERE a.name = 'J & B Tool, Inc. - Dallas, GA'
AND NOT EXISTS (
  SELECT 1 FROM districts d
  WHERE d.account_id = a.id AND lower(d.name) = lower('Direct')
);
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE a.name = 'J & B Tool, Inc. - Dallas, GA'
AND lower(d.name) = lower('Direct')
AND b.account_id = a.id
AND b.name = 'J & B Tool, Inc. - Dallas, GA';

INSERT INTO districts (account_id, name, region_text, created_at, updated_at)
SELECT a.id, 'Direct', 'Direct', now(), now()
FROM accounts a
WHERE a.name = 'Legend Hire Pty Ltd - Brisbane'
AND NOT EXISTS (
  SELECT 1 FROM districts d
  WHERE d.account_id = a.id AND lower(d.name) = lower('Direct')
);
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE a.name = 'Legend Hire Pty Ltd - Brisbane'
AND lower(d.name) = lower('Direct')
AND b.account_id = a.id
AND b.name = 'Legend Hire Pty Ltd - Brisbane';

INSERT INTO districts (account_id, name, region_text, created_at, updated_at)
SELECT a.id, 'Direct', 'Direct', now(), now()
FROM accounts a
WHERE a.name = 'ShorQuip Supply, Inc. - Conshohocken, PA'
AND NOT EXISTS (
  SELECT 1 FROM districts d
  WHERE d.account_id = a.id AND lower(d.name) = lower('Direct')
);
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE a.name = 'ShorQuip Supply, Inc. - Conshohocken, PA'
AND lower(d.name) = lower('Direct')
AND b.account_id = a.id
AND b.name = 'ShorQuip Supply, Inc. - Conshohocken, PA';

INSERT INTO districts (account_id, name, region_text, created_at, updated_at)
SELECT a.id, 'Direct', 'Direct', now(), now()
FROM accounts a
WHERE a.name = 'SOCAL SHIELD - EL CAJON, CA'
AND NOT EXISTS (
  SELECT 1 FROM districts d
  WHERE d.account_id = a.id AND lower(d.name) = lower('Direct')
);
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE a.name = 'SOCAL SHIELD - EL CAJON, CA'
AND lower(d.name) = lower('Direct')
AND b.account_id = a.id
AND b.name = 'SOCAL SHIELD - EL CAJON, CA';

INSERT INTO districts (account_id, name, region_text, created_at, updated_at)
SELECT a.id, 'Direct', 'Direct', now(), now()
FROM accounts a
WHERE a.name = 'Valley Shoring and Safety - Bakersfield, CA'
AND NOT EXISTS (
  SELECT 1 FROM districts d
  WHERE d.account_id = a.id AND lower(d.name) = lower('Direct')
);
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE a.name = 'Valley Shoring and Safety - Bakersfield, CA'
AND lower(d.name) = lower('Direct')
AND b.account_id = a.id
AND b.name = 'Valley Shoring and Safety - Bakersfield, CA';

-- ── Section 2: Sunstate Equipment whitespace variants ───────────────────────
-- Workbook branch names carry a double space; match whitespace-normalized.
-- Districts 'Sunstate Equipment — East/West' already exist (created by 0016).
-- No-ops harmlessly if a branch does not exist under 'Sunstate Equipment'.

UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE a.name = 'Sunstate Equipment'
AND lower(d.name) = lower('Sunstate Equipment — East')
AND b.account_id = a.id
AND lower(regexp_replace(b.name, '\s+', ' ', 'g')) =
    lower(regexp_replace('Sunstate Equipment  - Gainesville, GA', '\s+', ' ', 'g'));

UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE a.name = 'Sunstate Equipment'
AND lower(d.name) = lower('Sunstate Equipment — West')
AND b.account_id = a.id
AND lower(regexp_replace(b.name, '\s+', ' ', 'g')) =
    lower(regexp_replace('Sunstate Equipment  - Perris, CA', '\s+', ' ', 'g'));

UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE a.name = 'Sunstate Equipment'
AND lower(d.name) = lower('Sunstate Equipment — West')
AND b.account_id = a.id
AND lower(regexp_replace(b.name, '\s+', ' ', 'g')) =
    lower(regexp_replace('Sunstate Equipment  - Portland, OR', '\s+', ' ', 'g'));

-- ── Section 3: United Rentals of Canada branches ────────────────────────────
-- The workbook's 'United Rentals of Canada, Inc.' account does not exist;
-- these branches (if present) live under another account (e.g. 'United
-- Rentals'), where the two Canada districts were already created by 0016.
-- Joins the district through the branch's own account: only fires when the
-- branch exists AND its account has the target district. No-op otherwise.

UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
WHERE d.account_id = b.account_id
AND lower(d.name) = lower('United Rentals — Northeast Canada')
AND lower(b.name) = lower('United Rentals of Canada, Inc. - Bolton');

UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
WHERE d.account_id = b.account_id
AND lower(d.name) = lower('United Rentals — Western Canada')
AND lower(b.name) = lower('United Rentals of Canada, Inc. - Calgary, AB');

UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
WHERE d.account_id = b.account_id
AND lower(d.name) = lower('United Rentals — Western Canada')
AND lower(b.name) = lower('United Rentals of Canada, Inc. - NANAIMO, BC');

UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
WHERE d.account_id = b.account_id
AND lower(d.name) = lower('United Rentals — Northeast Canada')
AND lower(b.name) = lower('United Rentals of Canada, Inc. - Quebec');

UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
WHERE d.account_id = b.account_id
AND lower(d.name) = lower('United Rentals — Western Canada')
AND lower(b.name) = lower('United Rentals of Canada, Inc. - West St. Paul, MB');

UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
WHERE d.account_id = b.account_id
AND lower(d.name) = lower('United Rentals — Northeast Canada')
AND lower(b.name) = lower('United Rentals of Canada, Inc. Brantford');

-- ── Section 4: National Trench Safety UK (REVIEW BEFORE RUNNING) ────────────
-- The workbook models NTS UK as its own account; the DB has no such account.
-- If a branch named 'National Trench Safety UK Limited' exists under some
-- account (likely the US 'National Trench Safety'), this creates the
-- 'National Trench Safety — Europe' district under THAT account and links
-- the branch. If no such branch exists anywhere, both statements no-op and
-- creating the UK entity remains a manual business decision.
INSERT INTO districts (account_id, name, region_text, created_at, updated_at)
SELECT DISTINCT b.account_id, 'National Trench Safety — Europe', 'Europe', now(), now()
FROM branches b
WHERE lower(b.name) = lower('National Trench Safety UK Limited')
AND NOT EXISTS (
  SELECT 1 FROM districts d
  WHERE d.account_id = b.account_id
  AND lower(d.name) = lower('National Trench Safety — Europe')
);
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
WHERE d.account_id = b.account_id
AND lower(d.name) = lower('National Trench Safety — Europe')
AND lower(b.name) = lower('National Trench Safety UK Limited');

-- ── Post-run verification (read-only; run separately) ───────────────────────
-- SELECT COUNT(*) FROM districts;
--   expect 51 (41 + 10 from Section 1) or 52 if Section 4's branch existed.
-- SELECT COUNT(*) FROM branches WHERE district_id IS NOT NULL;
--   expect up to 291 (271 + 20); less only if some Q3 branches don't exist
--   as branch rows, which is possible for Sections 2-4.
-- SELECT a.name, b.name FROM branches b JOIN accounts a ON b.account_id = a.id
--   WHERE b.district_id IS NULL AND (
--     b.name ILIKE '%united rentals of canada%'
--     OR b.name ILIKE '%sunstate%' OR b.name ILIKE '%uk limited%');
--   expect zero rows for anything this patch targeted.
