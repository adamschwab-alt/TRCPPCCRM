-- ════════════════════════════════════════════════════════════════════════════
-- Data Migration: Districts & Branch-to-District Linkage
-- Generated from PSP_Customer_Wiring_MASTER workbook
-- Run AFTER migrations 0014 & 0015 are applied
-- ════════════════════════════════════════════════════════════════════════════

-- PHASE 1: Create district records
-- One district per (account, district_name) pair

INSERT INTO districts (account_id, name, region_text, created_at, updated_at)
SELECT
  a.id,
  'Direct',
  CASE
    WHEN 'Direct' = 'Direct' THEN 'Direct'
    WHEN 'Direct' LIKE 'United Rentals — %' THEN SUBSTRING('Direct', LENGTH('United Rentals — ') + 1)
    ELSE 'Direct'
  END,
  now(),
  now()
FROM accounts a
WHERE lower(a.name) = lower('4 Horn Trench & Shoring')
AND NOT EXISTS (
  SELECT 1 FROM districts d
  WHERE d.account_id = a.id AND lower(d.name) = lower('Direct')
);
INSERT INTO districts (account_id, name, region_text, created_at, updated_at)
SELECT
  a.id,
  'Direct',
  CASE
    WHEN 'Direct' = 'Direct' THEN 'Direct'
    WHEN 'Direct' LIKE 'United Rentals — %' THEN SUBSTRING('Direct', LENGTH('United Rentals — ') + 1)
    ELSE 'Direct'
  END,
  now(),
  now()
FROM accounts a
WHERE lower(a.name) = lower('Allen Trench Safety Corporation')
AND NOT EXISTS (
  SELECT 1 FROM districts d
  WHERE d.account_id = a.id AND lower(d.name) = lower('Direct')
);
INSERT INTO districts (account_id, name, region_text, created_at, updated_at)
SELECT
  a.id,
  'BADGER — Central',
  CASE
    WHEN 'BADGER — Central' = 'Direct' THEN 'Direct'
    WHEN 'BADGER — Central' LIKE 'United Rentals — %' THEN SUBSTRING('BADGER — Central', LENGTH('United Rentals — ') + 1)
    ELSE 'BADGER — Central'
  END,
  now(),
  now()
FROM accounts a
WHERE lower(a.name) = lower('BADGER')
AND NOT EXISTS (
  SELECT 1 FROM districts d
  WHERE d.account_id = a.id AND lower(d.name) = lower('BADGER — Central')
);
INSERT INTO districts (account_id, name, region_text, created_at, updated_at)
SELECT
  a.id,
  'BADGER — West',
  CASE
    WHEN 'BADGER — West' = 'Direct' THEN 'Direct'
    WHEN 'BADGER — West' LIKE 'United Rentals — %' THEN SUBSTRING('BADGER — West', LENGTH('United Rentals — ') + 1)
    ELSE 'BADGER — West'
  END,
  now(),
  now()
FROM accounts a
WHERE lower(a.name) = lower('BADGER')
AND NOT EXISTS (
  SELECT 1 FROM districts d
  WHERE d.account_id = a.id AND lower(d.name) = lower('BADGER — West')
);
INSERT INTO districts (account_id, name, region_text, created_at, updated_at)
SELECT
  a.id,
  'Direct',
  CASE
    WHEN 'Direct' = 'Direct' THEN 'Direct'
    WHEN 'Direct' LIKE 'United Rentals — %' THEN SUBSTRING('Direct', LENGTH('United Rentals — ') + 1)
    ELSE 'Direct'
  END,
  now(),
  now()
FROM accounts a
WHERE lower(a.name) = lower('BOA Rentals LLC')
AND NOT EXISTS (
  SELECT 1 FROM districts d
  WHERE d.account_id = a.id AND lower(d.name) = lower('Direct')
);
INSERT INTO districts (account_id, name, region_text, created_at, updated_at)
SELECT
  a.id,
  'Direct',
  CASE
    WHEN 'Direct' = 'Direct' THEN 'Direct'
    WHEN 'Direct' LIKE 'United Rentals — %' THEN SUBSTRING('Direct', LENGTH('United Rentals — ') + 1)
    ELSE 'Direct'
  END,
  now(),
  now()
FROM accounts a
WHERE lower(a.name) = lower('Baupower Group')
AND NOT EXISTS (
  SELECT 1 FROM districts d
  WHERE d.account_id = a.id AND lower(d.name) = lower('Direct')
);
INSERT INTO districts (account_id, name, region_text, created_at, updated_at)
SELECT
  a.id,
  'Direct',
  CASE
    WHEN 'Direct' = 'Direct' THEN 'Direct'
    WHEN 'Direct' LIKE 'United Rentals — %' THEN SUBSTRING('Direct', LENGTH('United Rentals — ') + 1)
    ELSE 'Direct'
  END,
  now(),
  now()
FROM accounts a
WHERE lower(a.name) = lower('Canhelco')
AND NOT EXISTS (
  SELECT 1 FROM districts d
  WHERE d.account_id = a.id AND lower(d.name) = lower('Direct')
);
INSERT INTO districts (account_id, name, region_text, created_at, updated_at)
SELECT
  a.id,
  'Direct',
  CASE
    WHEN 'Direct' = 'Direct' THEN 'Direct'
    WHEN 'Direct' LIKE 'United Rentals — %' THEN SUBSTRING('Direct', LENGTH('United Rentals — ') + 1)
    ELSE 'Direct'
  END,
  now(),
  now()
FROM accounts a
WHERE lower(a.name) = lower('Carter Machinery Co., Inc.')
AND NOT EXISTS (
  SELECT 1 FROM districts d
  WHERE d.account_id = a.id AND lower(d.name) = lower('Direct')
);
INSERT INTO districts (account_id, name, region_text, created_at, updated_at)
SELECT
  a.id,
  'DP Nicoli — Northwest',
  CASE
    WHEN 'DP Nicoli — Northwest' = 'Direct' THEN 'Direct'
    WHEN 'DP Nicoli — Northwest' LIKE 'United Rentals — %' THEN SUBSTRING('DP Nicoli — Northwest', LENGTH('United Rentals — ') + 1)
    ELSE 'DP Nicoli — Northwest'
  END,
  now(),
  now()
FROM accounts a
WHERE lower(a.name) = lower('DP Nicoli')
AND NOT EXISTS (
  SELECT 1 FROM districts d
  WHERE d.account_id = a.id AND lower(d.name) = lower('DP Nicoli — Northwest')
);
INSERT INTO districts (account_id, name, region_text, created_at, updated_at)
SELECT
  a.id,
  'Equipment Share - Central',
  CASE
    WHEN 'Equipment Share - Central' = 'Direct' THEN 'Direct'
    WHEN 'Equipment Share - Central' LIKE 'United Rentals — %' THEN SUBSTRING('Equipment Share - Central', LENGTH('United Rentals — ') + 1)
    ELSE 'Equipment Share - Central'
  END,
  now(),
  now()
FROM accounts a
WHERE lower(a.name) = lower('Equipment Share')
AND NOT EXISTS (
  SELECT 1 FROM districts d
  WHERE d.account_id = a.id AND lower(d.name) = lower('Equipment Share - Central')
);
INSERT INTO districts (account_id, name, region_text, created_at, updated_at)
SELECT
  a.id,
  'Guardian Trench - West',
  CASE
    WHEN 'Guardian Trench - West' = 'Direct' THEN 'Direct'
    WHEN 'Guardian Trench - West' LIKE 'United Rentals — %' THEN SUBSTRING('Guardian Trench - West', LENGTH('United Rentals — ') + 1)
    ELSE 'Guardian Trench - West'
  END,
  now(),
  now()
FROM accounts a
WHERE lower(a.name) = lower('Guardian Trench Safety')
AND NOT EXISTS (
  SELECT 1 FROM districts d
  WHERE d.account_id = a.id AND lower(d.name) = lower('Guardian Trench - West')
);
INSERT INTO districts (account_id, name, region_text, created_at, updated_at)
SELECT
  a.id,
  'Herc Rentals Inc. — Central',
  CASE
    WHEN 'Herc Rentals Inc. — Central' = 'Direct' THEN 'Direct'
    WHEN 'Herc Rentals Inc. — Central' LIKE 'United Rentals — %' THEN SUBSTRING('Herc Rentals Inc. — Central', LENGTH('United Rentals — ') + 1)
    ELSE 'Herc Rentals Inc. — Central'
  END,
  now(),
  now()
FROM accounts a
WHERE lower(a.name) = lower('Herc Rentals Inc.')
AND NOT EXISTS (
  SELECT 1 FROM districts d
  WHERE d.account_id = a.id AND lower(d.name) = lower('Herc Rentals Inc. — Central')
);
INSERT INTO districts (account_id, name, region_text, created_at, updated_at)
SELECT
  a.id,
  'Herc Rentals Inc. — East',
  CASE
    WHEN 'Herc Rentals Inc. — East' = 'Direct' THEN 'Direct'
    WHEN 'Herc Rentals Inc. — East' LIKE 'United Rentals — %' THEN SUBSTRING('Herc Rentals Inc. — East', LENGTH('United Rentals — ') + 1)
    ELSE 'Herc Rentals Inc. — East'
  END,
  now(),
  now()
FROM accounts a
WHERE lower(a.name) = lower('Herc Rentals Inc.')
AND NOT EXISTS (
  SELECT 1 FROM districts d
  WHERE d.account_id = a.id AND lower(d.name) = lower('Herc Rentals Inc. — East')
);
INSERT INTO districts (account_id, name, region_text, created_at, updated_at)
SELECT
  a.id,
  'Herc Rentals Inc. — West',
  CASE
    WHEN 'Herc Rentals Inc. — West' = 'Direct' THEN 'Direct'
    WHEN 'Herc Rentals Inc. — West' LIKE 'United Rentals — %' THEN SUBSTRING('Herc Rentals Inc. — West', LENGTH('United Rentals — ') + 1)
    ELSE 'Herc Rentals Inc. — West'
  END,
  now(),
  now()
FROM accounts a
WHERE lower(a.name) = lower('Herc Rentals Inc.')
AND NOT EXISTS (
  SELECT 1 FROM districts d
  WHERE d.account_id = a.id AND lower(d.name) = lower('Herc Rentals Inc. — West')
);
INSERT INTO districts (account_id, name, region_text, created_at, updated_at)
SELECT
  a.id,
  'Direct',
  CASE
    WHEN 'Direct' = 'Direct' THEN 'Direct'
    WHEN 'Direct' LIKE 'United Rentals — %' THEN SUBSTRING('Direct', LENGTH('United Rentals — ') + 1)
    ELSE 'Direct'
  END,
  now(),
  now()
FROM accounts a
WHERE lower(a.name) = lower('Iron Lot')
AND NOT EXISTS (
  SELECT 1 FROM districts d
  WHERE d.account_id = a.id AND lower(d.name) = lower('Direct')
);
INSERT INTO districts (account_id, name, region_text, created_at, updated_at)
SELECT
  a.id,
  'Direct',
  CASE
    WHEN 'Direct' = 'Direct' THEN 'Direct'
    WHEN 'Direct' LIKE 'United Rentals — %' THEN SUBSTRING('Direct', LENGTH('United Rentals — ') + 1)
    ELSE 'Direct'
  END,
  now(),
  now()
FROM accounts a
WHERE lower(a.name) = lower('J & B Tool, Inc.')
AND NOT EXISTS (
  SELECT 1 FROM districts d
  WHERE d.account_id = a.id AND lower(d.name) = lower('Direct')
);
INSERT INTO districts (account_id, name, region_text, created_at, updated_at)
SELECT
  a.id,
  'Direct',
  CASE
    WHEN 'Direct' = 'Direct' THEN 'Direct'
    WHEN 'Direct' LIKE 'United Rentals — %' THEN SUBSTRING('Direct', LENGTH('United Rentals — ') + 1)
    ELSE 'Direct'
  END,
  now(),
  now()
FROM accounts a
WHERE lower(a.name) = lower('Legend Hire Pty Ltd')
AND NOT EXISTS (
  SELECT 1 FROM districts d
  WHERE d.account_id = a.id AND lower(d.name) = lower('Direct')
);
INSERT INTO districts (account_id, name, region_text, created_at, updated_at)
SELECT
  a.id,
  'Direct',
  CASE
    WHEN 'Direct' = 'Direct' THEN 'Direct'
    WHEN 'Direct' LIKE 'United Rentals — %' THEN SUBSTRING('Direct', LENGTH('United Rentals — ') + 1)
    ELSE 'Direct'
  END,
  now(),
  now()
FROM accounts a
WHERE lower(a.name) = lower('Lite Industries Pty Ltd')
AND NOT EXISTS (
  SELECT 1 FROM districts d
  WHERE d.account_id = a.id AND lower(d.name) = lower('Direct')
);
INSERT INTO districts (account_id, name, region_text, created_at, updated_at)
SELECT
  a.id,
  'Direct',
  CASE
    WHEN 'Direct' = 'Direct' THEN 'Direct'
    WHEN 'Direct' LIKE 'United Rentals — %' THEN SUBSTRING('Direct', LENGTH('United Rentals — ') + 1)
    ELSE 'Direct'
  END,
  now(),
  now()
FROM accounts a
WHERE lower(a.name) = lower('Max Renaud')
AND NOT EXISTS (
  SELECT 1 FROM districts d
  WHERE d.account_id = a.id AND lower(d.name) = lower('Direct')
);
INSERT INTO districts (account_id, name, region_text, created_at, updated_at)
SELECT
  a.id,
  'National Trench Safety — Central',
  CASE
    WHEN 'National Trench Safety — Central' = 'Direct' THEN 'Direct'
    WHEN 'National Trench Safety — Central' LIKE 'United Rentals — %' THEN SUBSTRING('National Trench Safety — Central', LENGTH('United Rentals — ') + 1)
    ELSE 'National Trench Safety — Central'
  END,
  now(),
  now()
FROM accounts a
WHERE lower(a.name) = lower('National Trench Safety')
AND NOT EXISTS (
  SELECT 1 FROM districts d
  WHERE d.account_id = a.id AND lower(d.name) = lower('National Trench Safety — Central')
);
INSERT INTO districts (account_id, name, region_text, created_at, updated_at)
SELECT
  a.id,
  'National Trench Safety — East',
  CASE
    WHEN 'National Trench Safety — East' = 'Direct' THEN 'Direct'
    WHEN 'National Trench Safety — East' LIKE 'United Rentals — %' THEN SUBSTRING('National Trench Safety — East', LENGTH('United Rentals — ') + 1)
    ELSE 'National Trench Safety — East'
  END,
  now(),
  now()
FROM accounts a
WHERE lower(a.name) = lower('National Trench Safety')
AND NOT EXISTS (
  SELECT 1 FROM districts d
  WHERE d.account_id = a.id AND lower(d.name) = lower('National Trench Safety — East')
);
INSERT INTO districts (account_id, name, region_text, created_at, updated_at)
SELECT
  a.id,
  'National Trench Safety — West',
  CASE
    WHEN 'National Trench Safety — West' = 'Direct' THEN 'Direct'
    WHEN 'National Trench Safety — West' LIKE 'United Rentals — %' THEN SUBSTRING('National Trench Safety — West', LENGTH('United Rentals — ') + 1)
    ELSE 'National Trench Safety — West'
  END,
  now(),
  now()
FROM accounts a
WHERE lower(a.name) = lower('National Trench Safety')
AND NOT EXISTS (
  SELECT 1 FROM districts d
  WHERE d.account_id = a.id AND lower(d.name) = lower('National Trench Safety — West')
);
INSERT INTO districts (account_id, name, region_text, created_at, updated_at)
SELECT
  a.id,
  'National Trench Safety — Europe',
  CASE
    WHEN 'National Trench Safety — Europe' = 'Direct' THEN 'Direct'
    WHEN 'National Trench Safety — Europe' LIKE 'United Rentals — %' THEN SUBSTRING('National Trench Safety — Europe', LENGTH('United Rentals — ') + 1)
    ELSE 'National Trench Safety — Europe'
  END,
  now(),
  now()
FROM accounts a
WHERE lower(a.name) = lower('National Trench Safety UK Limited')
AND NOT EXISTS (
  SELECT 1 FROM districts d
  WHERE d.account_id = a.id AND lower(d.name) = lower('National Trench Safety — Europe')
);
INSERT INTO districts (account_id, name, region_text, created_at, updated_at)
SELECT
  a.id,
  'Direct',
  CASE
    WHEN 'Direct' = 'Direct' THEN 'Direct'
    WHEN 'Direct' LIKE 'United Rentals — %' THEN SUBSTRING('Direct', LENGTH('United Rentals — ') + 1)
    ELSE 'Direct'
  END,
  now(),
  now()
FROM accounts a
WHERE lower(a.name) = lower('Pro Shoring Equipment')
AND NOT EXISTS (
  SELECT 1 FROM districts d
  WHERE d.account_id = a.id AND lower(d.name) = lower('Direct')
);
INSERT INTO districts (account_id, name, region_text, created_at, updated_at)
SELECT
  a.id,
  'Direct',
  CASE
    WHEN 'Direct' = 'Direct' THEN 'Direct'
    WHEN 'Direct' LIKE 'United Rentals — %' THEN SUBSTRING('Direct', LENGTH('United Rentals — ') + 1)
    ELSE 'Direct'
  END,
  now(),
  now()
FROM accounts a
WHERE lower(a.name) = lower('SOCAL SHIELD')
AND NOT EXISTS (
  SELECT 1 FROM districts d
  WHERE d.account_id = a.id AND lower(d.name) = lower('Direct')
);
INSERT INTO districts (account_id, name, region_text, created_at, updated_at)
SELECT
  a.id,
  'Direct',
  CASE
    WHEN 'Direct' = 'Direct' THEN 'Direct'
    WHEN 'Direct' LIKE 'United Rentals — %' THEN SUBSTRING('Direct', LENGTH('United Rentals — ') + 1)
    ELSE 'Direct'
  END,
  now(),
  now()
FROM accounts a
WHERE lower(a.name) = lower('ShorQuip Supply, Inc.')
AND NOT EXISTS (
  SELECT 1 FROM districts d
  WHERE d.account_id = a.id AND lower(d.name) = lower('Direct')
);
INSERT INTO districts (account_id, name, region_text, created_at, updated_at)
SELECT
  a.id,
  'Southeastern Trench Safety — Central',
  CASE
    WHEN 'Southeastern Trench Safety — Central' = 'Direct' THEN 'Direct'
    WHEN 'Southeastern Trench Safety — Central' LIKE 'United Rentals — %' THEN SUBSTRING('Southeastern Trench Safety — Central', LENGTH('United Rentals — ') + 1)
    ELSE 'Southeastern Trench Safety — Central'
  END,
  now(),
  now()
FROM accounts a
WHERE lower(a.name) = lower('Southeastern Trench Safety')
AND NOT EXISTS (
  SELECT 1 FROM districts d
  WHERE d.account_id = a.id AND lower(d.name) = lower('Southeastern Trench Safety — Central')
);
INSERT INTO districts (account_id, name, region_text, created_at, updated_at)
SELECT
  a.id,
  'Sunbelt Rentals — Gulf South',
  CASE
    WHEN 'Sunbelt Rentals — Gulf South' = 'Direct' THEN 'Direct'
    WHEN 'Sunbelt Rentals — Gulf South' LIKE 'United Rentals — %' THEN SUBSTRING('Sunbelt Rentals — Gulf South', LENGTH('United Rentals — ') + 1)
    ELSE 'Sunbelt Rentals — Gulf South'
  END,
  now(),
  now()
FROM accounts a
WHERE lower(a.name) = lower('Sunbelt Rentals')
AND NOT EXISTS (
  SELECT 1 FROM districts d
  WHERE d.account_id = a.id AND lower(d.name) = lower('Sunbelt Rentals — Gulf South')
);
INSERT INTO districts (account_id, name, region_text, created_at, updated_at)
SELECT
  a.id,
  'Sunbelt Rentals — Midwest',
  CASE
    WHEN 'Sunbelt Rentals — Midwest' = 'Direct' THEN 'Direct'
    WHEN 'Sunbelt Rentals — Midwest' LIKE 'United Rentals — %' THEN SUBSTRING('Sunbelt Rentals — Midwest', LENGTH('United Rentals — ') + 1)
    ELSE 'Sunbelt Rentals — Midwest'
  END,
  now(),
  now()
FROM accounts a
WHERE lower(a.name) = lower('Sunbelt Rentals')
AND NOT EXISTS (
  SELECT 1 FROM districts d
  WHERE d.account_id = a.id AND lower(d.name) = lower('Sunbelt Rentals — Midwest')
);
INSERT INTO districts (account_id, name, region_text, created_at, updated_at)
SELECT
  a.id,
  'Sunbelt Rentals — Northeast',
  CASE
    WHEN 'Sunbelt Rentals — Northeast' = 'Direct' THEN 'Direct'
    WHEN 'Sunbelt Rentals — Northeast' LIKE 'United Rentals — %' THEN SUBSTRING('Sunbelt Rentals — Northeast', LENGTH('United Rentals — ') + 1)
    ELSE 'Sunbelt Rentals — Northeast'
  END,
  now(),
  now()
FROM accounts a
WHERE lower(a.name) = lower('Sunbelt Rentals')
AND NOT EXISTS (
  SELECT 1 FROM districts d
  WHERE d.account_id = a.id AND lower(d.name) = lower('Sunbelt Rentals — Northeast')
);
INSERT INTO districts (account_id, name, region_text, created_at, updated_at)
SELECT
  a.id,
  'Sunbelt Rentals — Southeast',
  CASE
    WHEN 'Sunbelt Rentals — Southeast' = 'Direct' THEN 'Direct'
    WHEN 'Sunbelt Rentals — Southeast' LIKE 'United Rentals — %' THEN SUBSTRING('Sunbelt Rentals — Southeast', LENGTH('United Rentals — ') + 1)
    ELSE 'Sunbelt Rentals — Southeast'
  END,
  now(),
  now()
FROM accounts a
WHERE lower(a.name) = lower('Sunbelt Rentals')
AND NOT EXISTS (
  SELECT 1 FROM districts d
  WHERE d.account_id = a.id AND lower(d.name) = lower('Sunbelt Rentals — Southeast')
);
INSERT INTO districts (account_id, name, region_text, created_at, updated_at)
SELECT
  a.id,
  'Sunbelt Rentals — West',
  CASE
    WHEN 'Sunbelt Rentals — West' = 'Direct' THEN 'Direct'
    WHEN 'Sunbelt Rentals — West' LIKE 'United Rentals — %' THEN SUBSTRING('Sunbelt Rentals — West', LENGTH('United Rentals — ') + 1)
    ELSE 'Sunbelt Rentals — West'
  END,
  now(),
  now()
FROM accounts a
WHERE lower(a.name) = lower('Sunbelt Rentals')
AND NOT EXISTS (
  SELECT 1 FROM districts d
  WHERE d.account_id = a.id AND lower(d.name) = lower('Sunbelt Rentals — West')
);
INSERT INTO districts (account_id, name, region_text, created_at, updated_at)
SELECT
  a.id,
  'Sunstate Equipment — East',
  CASE
    WHEN 'Sunstate Equipment — East' = 'Direct' THEN 'Direct'
    WHEN 'Sunstate Equipment — East' LIKE 'United Rentals — %' THEN SUBSTRING('Sunstate Equipment — East', LENGTH('United Rentals — ') + 1)
    ELSE 'Sunstate Equipment — East'
  END,
  now(),
  now()
FROM accounts a
WHERE lower(a.name) = lower('Sunstate Equipment')
AND NOT EXISTS (
  SELECT 1 FROM districts d
  WHERE d.account_id = a.id AND lower(d.name) = lower('Sunstate Equipment — East')
);
INSERT INTO districts (account_id, name, region_text, created_at, updated_at)
SELECT
  a.id,
  'Sunstate Equipment — West',
  CASE
    WHEN 'Sunstate Equipment — West' = 'Direct' THEN 'Direct'
    WHEN 'Sunstate Equipment — West' LIKE 'United Rentals — %' THEN SUBSTRING('Sunstate Equipment — West', LENGTH('United Rentals — ') + 1)
    ELSE 'Sunstate Equipment — West'
  END,
  now(),
  now()
FROM accounts a
WHERE lower(a.name) = lower('Sunstate Equipment')
AND NOT EXISTS (
  SELECT 1 FROM districts d
  WHERE d.account_id = a.id AND lower(d.name) = lower('Sunstate Equipment — West')
);
INSERT INTO districts (account_id, name, region_text, created_at, updated_at)
SELECT
  a.id,
  'Sunstate Equipment — East',
  CASE
    WHEN 'Sunstate Equipment — East' = 'Direct' THEN 'Direct'
    WHEN 'Sunstate Equipment — East' LIKE 'United Rentals — %' THEN SUBSTRING('Sunstate Equipment — East', LENGTH('United Rentals — ') + 1)
    ELSE 'Sunstate Equipment — East'
  END,
  now(),
  now()
FROM accounts a
WHERE lower(a.name) = lower('Sunstate Equipment ')
AND NOT EXISTS (
  SELECT 1 FROM districts d
  WHERE d.account_id = a.id AND lower(d.name) = lower('Sunstate Equipment — East')
);
INSERT INTO districts (account_id, name, region_text, created_at, updated_at)
SELECT
  a.id,
  'Sunstate Equipment — West',
  CASE
    WHEN 'Sunstate Equipment — West' = 'Direct' THEN 'Direct'
    WHEN 'Sunstate Equipment — West' LIKE 'United Rentals — %' THEN SUBSTRING('Sunstate Equipment — West', LENGTH('United Rentals — ') + 1)
    ELSE 'Sunstate Equipment — West'
  END,
  now(),
  now()
FROM accounts a
WHERE lower(a.name) = lower('Sunstate Equipment ')
AND NOT EXISTS (
  SELECT 1 FROM districts d
  WHERE d.account_id = a.id AND lower(d.name) = lower('Sunstate Equipment — West')
);
INSERT INTO districts (account_id, name, region_text, created_at, updated_at)
SELECT
  a.id,
  'TRENCH-ADE, Inc — Corporate',
  CASE
    WHEN 'TRENCH-ADE, Inc — Corporate' = 'Direct' THEN 'Direct'
    WHEN 'TRENCH-ADE, Inc — Corporate' LIKE 'United Rentals — %' THEN SUBSTRING('TRENCH-ADE, Inc — Corporate', LENGTH('United Rentals — ') + 1)
    ELSE 'TRENCH-ADE, Inc — Corporate'
  END,
  now(),
  now()
FROM accounts a
WHERE lower(a.name) = lower('TRENCH-ADE, Inc')
AND NOT EXISTS (
  SELECT 1 FROM districts d
  WHERE d.account_id = a.id AND lower(d.name) = lower('TRENCH-ADE, Inc — Corporate')
);
INSERT INTO districts (account_id, name, region_text, created_at, updated_at)
SELECT
  a.id,
  'Trench Shoring Company — West',
  CASE
    WHEN 'Trench Shoring Company — West' = 'Direct' THEN 'Direct'
    WHEN 'Trench Shoring Company — West' LIKE 'United Rentals — %' THEN SUBSTRING('Trench Shoring Company — West', LENGTH('United Rentals — ') + 1)
    ELSE 'Trench Shoring Company — West'
  END,
  now(),
  now()
FROM accounts a
WHERE lower(a.name) = lower('Trench Shoring Company')
AND NOT EXISTS (
  SELECT 1 FROM districts d
  WHERE d.account_id = a.id AND lower(d.name) = lower('Trench Shoring Company — West')
);
INSERT INTO districts (account_id, name, region_text, created_at, updated_at)
SELECT
  a.id,
  'US Shoring - Corporate',
  CASE
    WHEN 'US Shoring - Corporate' = 'Direct' THEN 'Direct'
    WHEN 'US Shoring - Corporate' LIKE 'United Rentals — %' THEN SUBSTRING('US Shoring - Corporate', LENGTH('United Rentals — ') + 1)
    ELSE 'US Shoring - Corporate'
  END,
  now(),
  now()
FROM accounts a
WHERE lower(a.name) = lower('U.S. Shoring & Equipment Co.')
AND NOT EXISTS (
  SELECT 1 FROM districts d
  WHERE d.account_id = a.id AND lower(d.name) = lower('US Shoring - Corporate')
);
INSERT INTO districts (account_id, name, region_text, created_at, updated_at)
SELECT
  a.id,
  'Direct',
  CASE
    WHEN 'Direct' = 'Direct' THEN 'Direct'
    WHEN 'Direct' LIKE 'United Rentals — %' THEN SUBSTRING('Direct', LENGTH('United Rentals — ') + 1)
    ELSE 'Direct'
  END,
  now(),
  now()
FROM accounts a
WHERE lower(a.name) = lower('Underground Products of Texas')
AND NOT EXISTS (
  SELECT 1 FROM districts d
  WHERE d.account_id = a.id AND lower(d.name) = lower('Direct')
);
INSERT INTO districts (account_id, name, region_text, created_at, updated_at)
SELECT
  a.id,
  'United Rentals — Gulf',
  CASE
    WHEN 'United Rentals — Gulf' = 'Direct' THEN 'Direct'
    WHEN 'United Rentals — Gulf' LIKE 'United Rentals — %' THEN SUBSTRING('United Rentals — Gulf', LENGTH('United Rentals — ') + 1)
    ELSE 'United Rentals — Gulf'
  END,
  now(),
  now()
FROM accounts a
WHERE lower(a.name) = lower('United Rentals')
AND NOT EXISTS (
  SELECT 1 FROM districts d
  WHERE d.account_id = a.id AND lower(d.name) = lower('United Rentals — Gulf')
);
INSERT INTO districts (account_id, name, region_text, created_at, updated_at)
SELECT
  a.id,
  'United Rentals — Mid Atlantic',
  CASE
    WHEN 'United Rentals — Mid Atlantic' = 'Direct' THEN 'Direct'
    WHEN 'United Rentals — Mid Atlantic' LIKE 'United Rentals — %' THEN SUBSTRING('United Rentals — Mid Atlantic', LENGTH('United Rentals — ') + 1)
    ELSE 'United Rentals — Mid Atlantic'
  END,
  now(),
  now()
FROM accounts a
WHERE lower(a.name) = lower('United Rentals')
AND NOT EXISTS (
  SELECT 1 FROM districts d
  WHERE d.account_id = a.id AND lower(d.name) = lower('United Rentals — Mid Atlantic')
);
INSERT INTO districts (account_id, name, region_text, created_at, updated_at)
SELECT
  a.id,
  'United Rentals — Mid Central',
  CASE
    WHEN 'United Rentals — Mid Central' = 'Direct' THEN 'Direct'
    WHEN 'United Rentals — Mid Central' LIKE 'United Rentals — %' THEN SUBSTRING('United Rentals — Mid Central', LENGTH('United Rentals — ') + 1)
    ELSE 'United Rentals — Mid Central'
  END,
  now(),
  now()
FROM accounts a
WHERE lower(a.name) = lower('United Rentals')
AND NOT EXISTS (
  SELECT 1 FROM districts d
  WHERE d.account_id = a.id AND lower(d.name) = lower('United Rentals — Mid Central')
);
INSERT INTO districts (account_id, name, region_text, created_at, updated_at)
SELECT
  a.id,
  'United Rentals — Midwest',
  CASE
    WHEN 'United Rentals — Midwest' = 'Direct' THEN 'Direct'
    WHEN 'United Rentals — Midwest' LIKE 'United Rentals — %' THEN SUBSTRING('United Rentals — Midwest', LENGTH('United Rentals — ') + 1)
    ELSE 'United Rentals — Midwest'
  END,
  now(),
  now()
FROM accounts a
WHERE lower(a.name) = lower('United Rentals')
AND NOT EXISTS (
  SELECT 1 FROM districts d
  WHERE d.account_id = a.id AND lower(d.name) = lower('United Rentals — Midwest')
);
INSERT INTO districts (account_id, name, region_text, created_at, updated_at)
SELECT
  a.id,
  'United Rentals — Mountain',
  CASE
    WHEN 'United Rentals — Mountain' = 'Direct' THEN 'Direct'
    WHEN 'United Rentals — Mountain' LIKE 'United Rentals — %' THEN SUBSTRING('United Rentals — Mountain', LENGTH('United Rentals — ') + 1)
    ELSE 'United Rentals — Mountain'
  END,
  now(),
  now()
FROM accounts a
WHERE lower(a.name) = lower('United Rentals')
AND NOT EXISTS (
  SELECT 1 FROM districts d
  WHERE d.account_id = a.id AND lower(d.name) = lower('United Rentals — Mountain')
);
INSERT INTO districts (account_id, name, region_text, created_at, updated_at)
SELECT
  a.id,
  'United Rentals — NorCal',
  CASE
    WHEN 'United Rentals — NorCal' = 'Direct' THEN 'Direct'
    WHEN 'United Rentals — NorCal' LIKE 'United Rentals — %' THEN SUBSTRING('United Rentals — NorCal', LENGTH('United Rentals — ') + 1)
    ELSE 'United Rentals — NorCal'
  END,
  now(),
  now()
FROM accounts a
WHERE lower(a.name) = lower('United Rentals')
AND NOT EXISTS (
  SELECT 1 FROM districts d
  WHERE d.account_id = a.id AND lower(d.name) = lower('United Rentals — NorCal')
);
INSERT INTO districts (account_id, name, region_text, created_at, updated_at)
SELECT
  a.id,
  'United Rentals — Northeast',
  CASE
    WHEN 'United Rentals — Northeast' = 'Direct' THEN 'Direct'
    WHEN 'United Rentals — Northeast' LIKE 'United Rentals — %' THEN SUBSTRING('United Rentals — Northeast', LENGTH('United Rentals — ') + 1)
    ELSE 'United Rentals — Northeast'
  END,
  now(),
  now()
FROM accounts a
WHERE lower(a.name) = lower('United Rentals')
AND NOT EXISTS (
  SELECT 1 FROM districts d
  WHERE d.account_id = a.id AND lower(d.name) = lower('United Rentals — Northeast')
);
INSERT INTO districts (account_id, name, region_text, created_at, updated_at)
SELECT
  a.id,
  'United Rentals — Northeast Canada',
  CASE
    WHEN 'United Rentals — Northeast Canada' = 'Direct' THEN 'Direct'
    WHEN 'United Rentals — Northeast Canada' LIKE 'United Rentals — %' THEN SUBSTRING('United Rentals — Northeast Canada', LENGTH('United Rentals — ') + 1)
    ELSE 'United Rentals — Northeast Canada'
  END,
  now(),
  now()
FROM accounts a
WHERE lower(a.name) = lower('United Rentals')
AND NOT EXISTS (
  SELECT 1 FROM districts d
  WHERE d.account_id = a.id AND lower(d.name) = lower('United Rentals — Northeast Canada')
);
INSERT INTO districts (account_id, name, region_text, created_at, updated_at)
SELECT
  a.id,
  'United Rentals — Southeast',
  CASE
    WHEN 'United Rentals — Southeast' = 'Direct' THEN 'Direct'
    WHEN 'United Rentals — Southeast' LIKE 'United Rentals — %' THEN SUBSTRING('United Rentals — Southeast', LENGTH('United Rentals — ') + 1)
    ELSE 'United Rentals — Southeast'
  END,
  now(),
  now()
FROM accounts a
WHERE lower(a.name) = lower('United Rentals')
AND NOT EXISTS (
  SELECT 1 FROM districts d
  WHERE d.account_id = a.id AND lower(d.name) = lower('United Rentals — Southeast')
);
INSERT INTO districts (account_id, name, region_text, created_at, updated_at)
SELECT
  a.id,
  'United Rentals — Southwest',
  CASE
    WHEN 'United Rentals — Southwest' = 'Direct' THEN 'Direct'
    WHEN 'United Rentals — Southwest' LIKE 'United Rentals — %' THEN SUBSTRING('United Rentals — Southwest', LENGTH('United Rentals — ') + 1)
    ELSE 'United Rentals — Southwest'
  END,
  now(),
  now()
FROM accounts a
WHERE lower(a.name) = lower('United Rentals')
AND NOT EXISTS (
  SELECT 1 FROM districts d
  WHERE d.account_id = a.id AND lower(d.name) = lower('United Rentals — Southwest')
);
INSERT INTO districts (account_id, name, region_text, created_at, updated_at)
SELECT
  a.id,
  'United Rentals — Western Canada',
  CASE
    WHEN 'United Rentals — Western Canada' = 'Direct' THEN 'Direct'
    WHEN 'United Rentals — Western Canada' LIKE 'United Rentals — %' THEN SUBSTRING('United Rentals — Western Canada', LENGTH('United Rentals — ') + 1)
    ELSE 'United Rentals — Western Canada'
  END,
  now(),
  now()
FROM accounts a
WHERE lower(a.name) = lower('United Rentals')
AND NOT EXISTS (
  SELECT 1 FROM districts d
  WHERE d.account_id = a.id AND lower(d.name) = lower('United Rentals — Western Canada')
);
INSERT INTO districts (account_id, name, region_text, created_at, updated_at)
SELECT
  a.id,
  'United Rentals — Northeast Canada',
  CASE
    WHEN 'United Rentals — Northeast Canada' = 'Direct' THEN 'Direct'
    WHEN 'United Rentals — Northeast Canada' LIKE 'United Rentals — %' THEN SUBSTRING('United Rentals — Northeast Canada', LENGTH('United Rentals — ') + 1)
    ELSE 'United Rentals — Northeast Canada'
  END,
  now(),
  now()
FROM accounts a
WHERE lower(a.name) = lower('United Rentals of Canada, Inc.')
AND NOT EXISTS (
  SELECT 1 FROM districts d
  WHERE d.account_id = a.id AND lower(d.name) = lower('United Rentals — Northeast Canada')
);
INSERT INTO districts (account_id, name, region_text, created_at, updated_at)
SELECT
  a.id,
  'United Rentals — Western Canada',
  CASE
    WHEN 'United Rentals — Western Canada' = 'Direct' THEN 'Direct'
    WHEN 'United Rentals — Western Canada' LIKE 'United Rentals — %' THEN SUBSTRING('United Rentals — Western Canada', LENGTH('United Rentals — ') + 1)
    ELSE 'United Rentals — Western Canada'
  END,
  now(),
  now()
FROM accounts a
WHERE lower(a.name) = lower('United Rentals of Canada, Inc.')
AND NOT EXISTS (
  SELECT 1 FROM districts d
  WHERE d.account_id = a.id AND lower(d.name) = lower('United Rentals — Western Canada')
);
INSERT INTO districts (account_id, name, region_text, created_at, updated_at)
SELECT
  a.id,
  'United Rentals — Northeast Canada',
  CASE
    WHEN 'United Rentals — Northeast Canada' = 'Direct' THEN 'Direct'
    WHEN 'United Rentals — Northeast Canada' LIKE 'United Rentals — %' THEN SUBSTRING('United Rentals — Northeast Canada', LENGTH('United Rentals — ') + 1)
    ELSE 'United Rentals — Northeast Canada'
  END,
  now(),
  now()
FROM accounts a
WHERE lower(a.name) = lower('United Rentals of Canada, Inc. Brantford')
AND NOT EXISTS (
  SELECT 1 FROM districts d
  WHERE d.account_id = a.id AND lower(d.name) = lower('United Rentals — Northeast Canada')
);
INSERT INTO districts (account_id, name, region_text, created_at, updated_at)
SELECT
  a.id,
  'Direct',
  CASE
    WHEN 'Direct' = 'Direct' THEN 'Direct'
    WHEN 'Direct' LIKE 'United Rentals — %' THEN SUBSTRING('Direct', LENGTH('United Rentals — ') + 1)
    ELSE 'Direct'
  END,
  now(),
  now()
FROM accounts a
WHERE lower(a.name) = lower('Valley Shoring and Safety')
AND NOT EXISTS (
  SELECT 1 FROM districts d
  WHERE d.account_id = a.id AND lower(d.name) = lower('Direct')
);
INSERT INTO districts (account_id, name, region_text, created_at, updated_at)
SELECT
  a.id,
  'Direct',
  CASE
    WHEN 'Direct' = 'Direct' THEN 'Direct'
    WHEN 'Direct' LIKE 'United Rentals — %' THEN SUBSTRING('Direct', LENGTH('United Rentals — ') + 1)
    ELSE 'Direct'
  END,
  now(),
  now()
FROM accounts a
WHERE lower(a.name) = lower('Vandalia Rental')
AND NOT EXISTS (
  SELECT 1 FROM districts d
  WHERE d.account_id = a.id AND lower(d.name) = lower('Direct')
);
INSERT INTO districts (account_id, name, region_text, created_at, updated_at)
SELECT
  a.id,
  'Direct',
  CASE
    WHEN 'Direct' = 'Direct' THEN 'Direct'
    WHEN 'Direct' LIKE 'United Rentals — %' THEN SUBSTRING('Direct', LENGTH('United Rentals — ') + 1)
    ELSE 'Direct'
  END,
  now(),
  now()
FROM accounts a
WHERE lower(a.name) = lower('Zip U There, Inc.')
AND NOT EXISTS (
  SELECT 1 FROM districts d
  WHERE d.account_id = a.id AND lower(d.name) = lower('Direct')
);

-- PHASE 2: Link branches to their districts

UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('4 Horn Trench & Shoring - Pasadena, TX')
AND lower(a.name) = lower('4 Horn Trench & Shoring')
AND lower(d.name) = lower('Direct');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Allen Trench Safety Corporation - Bellevue, MI')
AND lower(a.name) = lower('Allen Trench Safety Corporation')
AND lower(d.name) = lower('Direct');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('BADGER - Austin, TX')
AND lower(a.name) = lower('BADGER')
AND lower(d.name) = lower('BADGER — Central');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('BADGER - Henderson, CO')
AND lower(a.name) = lower('BADGER')
AND lower(d.name) = lower('BADGER — West');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('BOA Rentals LLC - Waterman, IL')
AND lower(a.name) = lower('BOA Rentals LLC')
AND lower(d.name) = lower('Direct');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Baupower Group')
AND lower(a.name) = lower('Baupower Group')
AND lower(d.name) = lower('Direct');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Canhelco - Manassas, VA')
AND lower(a.name) = lower('Canhelco')
AND lower(d.name) = lower('Direct');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Carter Machinery Co., Inc. - District Heights, MD')
AND lower(a.name) = lower('Carter Machinery Co., Inc.')
AND lower(d.name) = lower('Direct');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Carter Machinery Co., Inc. - Salem, VA')
AND lower(a.name) = lower('Carter Machinery Co., Inc.')
AND lower(d.name) = lower('Direct');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('DP Nicoli - Bay Point, CA')
AND lower(a.name) = lower('DP Nicoli')
AND lower(d.name) = lower('DP Nicoli — Northwest');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('DP Nicoli - Caldwell, ID')
AND lower(a.name) = lower('DP Nicoli')
AND lower(d.name) = lower('DP Nicoli — Northwest');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('DP Nicoli - Lakewood, WA')
AND lower(a.name) = lower('DP Nicoli')
AND lower(d.name) = lower('DP Nicoli — Northwest');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('DP Nicoli - Salt Lake City, UT')
AND lower(a.name) = lower('DP Nicoli')
AND lower(d.name) = lower('DP Nicoli — Northwest');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('DP Nicoli - San Jose, CA')
AND lower(a.name) = lower('DP Nicoli')
AND lower(d.name) = lower('DP Nicoli — Northwest');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('DP Nicoli - Seattle, WA')
AND lower(a.name) = lower('DP Nicoli')
AND lower(d.name) = lower('DP Nicoli — Northwest');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('DP Nicoli - South San Francisco, CA')
AND lower(a.name) = lower('DP Nicoli')
AND lower(d.name) = lower('DP Nicoli — Northwest');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('DP Nicoli - Spokane, WA')
AND lower(a.name) = lower('DP Nicoli')
AND lower(d.name) = lower('DP Nicoli — Northwest');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('DP Nicoli - Wilsonville, OR')
AND lower(a.name) = lower('DP Nicoli')
AND lower(d.name) = lower('DP Nicoli — Northwest');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Equipment Share - La Porte, TX')
AND lower(a.name) = lower('Equipment Share')
AND lower(d.name) = lower('Equipment Share - Central');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Equipment Share - Sanford, FL')
AND lower(a.name) = lower('Equipment Share')
AND lower(d.name) = lower('Equipment Share - Central');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Guardian Trench Safety - Phoenix AZ')
AND lower(a.name) = lower('Guardian Trench Safety')
AND lower(d.name) = lower('Guardian Trench - West');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Herc Rentals Inc.')
AND lower(a.name) = lower('Herc Rentals Inc.')
AND lower(d.name) = lower('Herc Rentals Inc. — East');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Herc Rentals Inc. - Austin, TX')
AND lower(a.name) = lower('Herc Rentals Inc.')
AND lower(d.name) = lower('Herc Rentals Inc. — Central');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Herc Rentals Inc. - Bakersfield, CA')
AND lower(a.name) = lower('Herc Rentals Inc.')
AND lower(d.name) = lower('Herc Rentals Inc. — West');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Herc Rentals Inc. - Baytown, TX')
AND lower(a.name) = lower('Herc Rentals Inc.')
AND lower(d.name) = lower('Herc Rentals Inc. — Central');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Herc Rentals Inc. - Charlotte, NC')
AND lower(a.name) = lower('Herc Rentals Inc.')
AND lower(d.name) = lower('Herc Rentals Inc. — East');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Herc Rentals Inc. - Denison, TX')
AND lower(a.name) = lower('Herc Rentals Inc.')
AND lower(d.name) = lower('Herc Rentals Inc. — Central');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Herc Rentals Inc. - East Point, GA')
AND lower(a.name) = lower('Herc Rentals Inc.')
AND lower(d.name) = lower('Herc Rentals Inc. — East');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Herc Rentals Inc. - Foothill Ranch, CA')
AND lower(a.name) = lower('Herc Rentals Inc.')
AND lower(d.name) = lower('Herc Rentals Inc. — West');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Herc Rentals Inc. - Gilroy, CA')
AND lower(a.name) = lower('Herc Rentals Inc.')
AND lower(d.name) = lower('Herc Rentals Inc. — West');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Herc Rentals Inc. - Lebanon, TN')
AND lower(a.name) = lower('Herc Rentals Inc.')
AND lower(d.name) = lower('Herc Rentals Inc. — East');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Herc Rentals Inc. - Millersville, MD')
AND lower(a.name) = lower('Herc Rentals Inc.')
AND lower(d.name) = lower('Herc Rentals Inc. — East');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Herc Rentals Inc. - New York, NY')
AND lower(a.name) = lower('Herc Rentals Inc.')
AND lower(d.name) = lower('Herc Rentals Inc. — East');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Herc Rentals Inc. - Newcastle, DE')
AND lower(a.name) = lower('Herc Rentals Inc.')
AND lower(d.name) = lower('Herc Rentals Inc. — East');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Herc Rentals Inc. - Paso Robles, CA')
AND lower(a.name) = lower('Herc Rentals Inc.')
AND lower(d.name) = lower('Herc Rentals Inc. — West');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Herc Rentals Inc. - Phoenix, AZ')
AND lower(a.name) = lower('Herc Rentals Inc.')
AND lower(d.name) = lower('Herc Rentals Inc. — West');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Herc Rentals Inc. - Portland, OR')
AND lower(a.name) = lower('Herc Rentals Inc.')
AND lower(d.name) = lower('Herc Rentals Inc. — West');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Herc Rentals Inc. - Rancho Cordova, CA')
AND lower(a.name) = lower('Herc Rentals Inc.')
AND lower(d.name) = lower('Herc Rentals Inc. — West');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Herc Rentals Inc. - S. Hackensack, NJ')
AND lower(a.name) = lower('Herc Rentals Inc.')
AND lower(d.name) = lower('Herc Rentals Inc. — East');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Herc Rentals Inc. - Santa Rosa, CA')
AND lower(a.name) = lower('Herc Rentals Inc.')
AND lower(d.name) = lower('Herc Rentals Inc. — West');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Herc Rentals Inc. - Shrewsbury, MA')
AND lower(a.name) = lower('Herc Rentals Inc.')
AND lower(d.name) = lower('Herc Rentals Inc. — East');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Herc Rentals Inc. - Tacoma, WA')
AND lower(a.name) = lower('Herc Rentals Inc.')
AND lower(d.name) = lower('Herc Rentals Inc. — West');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Herc Rentals Inc. - Tampa, FL')
AND lower(a.name) = lower('Herc Rentals Inc.')
AND lower(d.name) = lower('Herc Rentals Inc. — East');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Herc Rentals Inc. - Union City, CA')
AND lower(a.name) = lower('Herc Rentals Inc.')
AND lower(d.name) = lower('Herc Rentals Inc. — West');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Iron Lot - Burlington, NC')
AND lower(a.name) = lower('Iron Lot')
AND lower(d.name) = lower('Direct');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('J & B Tool, Inc. - Dallas, GA')
AND lower(a.name) = lower('J & B Tool, Inc.')
AND lower(d.name) = lower('Direct');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Legend Hire Pty Ltd - Brisbane')
AND lower(a.name) = lower('Legend Hire Pty Ltd')
AND lower(d.name) = lower('Direct');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Lite Industries Pty Ltd')
AND lower(a.name) = lower('Lite Industries Pty Ltd')
AND lower(d.name) = lower('Direct');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Max Renaud')
AND lower(a.name) = lower('Max Renaud')
AND lower(d.name) = lower('Direct');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('National Trench Safety - Albuquerque, NM')
AND lower(a.name) = lower('National Trench Safety')
AND lower(d.name) = lower('National Trench Safety — West');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('National Trench Safety - Austin, TX')
AND lower(a.name) = lower('National Trench Safety')
AND lower(d.name) = lower('National Trench Safety — Central');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('National Trench Safety - Baltimore, MD')
AND lower(a.name) = lower('National Trench Safety')
AND lower(d.name) = lower('National Trench Safety — East');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('National Trench Safety - Berthoud, CO')
AND lower(a.name) = lower('National Trench Safety')
AND lower(d.name) = lower('National Trench Safety — West');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('National Trench Safety - Birmingham, AL')
AND lower(a.name) = lower('National Trench Safety')
AND lower(d.name) = lower('National Trench Safety — Central');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('National Trench Safety - Boise, ID')
AND lower(a.name) = lower('National Trench Safety')
AND lower(d.name) = lower('National Trench Safety — West');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('National Trench Safety - Burlington, NC')
AND lower(a.name) = lower('National Trench Safety')
AND lower(d.name) = lower('National Trench Safety — East');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('National Trench Safety - CO Springs, CO')
AND lower(a.name) = lower('National Trench Safety')
AND lower(d.name) = lower('National Trench Safety — West');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('National Trench Safety - Charlotte, NC')
AND lower(a.name) = lower('National Trench Safety')
AND lower(d.name) = lower('National Trench Safety — East');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('National Trench Safety - Cleveland, OH')
AND lower(a.name) = lower('National Trench Safety')
AND lower(d.name) = lower('National Trench Safety — Central');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('National Trench Safety - Conley, GA')
AND lower(a.name) = lower('National Trench Safety')
AND lower(d.name) = lower('National Trench Safety — East');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('National Trench Safety - Corpus Christi, TX')
AND lower(a.name) = lower('National Trench Safety')
AND lower(d.name) = lower('National Trench Safety — Central');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('National Trench Safety - Davie, FL')
AND lower(a.name) = lower('National Trench Safety')
AND lower(d.name) = lower('National Trench Safety — East');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('National Trench Safety - Denver, CO')
AND lower(a.name) = lower('National Trench Safety')
AND lower(d.name) = lower('National Trench Safety — West');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('National Trench Safety - Des Moines, IA')
AND lower(a.name) = lower('National Trench Safety')
AND lower(d.name) = lower('National Trench Safety — Central');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('National Trench Safety - Dracut, MA')
AND lower(a.name) = lower('National Trench Safety')
AND lower(d.name) = lower('National Trench Safety — East');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('National Trench Safety - Fontana, CA')
AND lower(a.name) = lower('National Trench Safety')
AND lower(d.name) = lower('National Trench Safety — West');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('National Trench Safety - Fort Worth, TX')
AND lower(a.name) = lower('National Trench Safety')
AND lower(d.name) = lower('National Trench Safety — Central');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('National Trench Safety - Fremont, CA')
AND lower(a.name) = lower('National Trench Safety')
AND lower(d.name) = lower('National Trench Safety — West');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('National Trench Safety - Fresno, CA')
AND lower(a.name) = lower('National Trench Safety')
AND lower(d.name) = lower('National Trench Safety — West');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('National Trench Safety - Gainesville, GA')
AND lower(a.name) = lower('National Trench Safety')
AND lower(d.name) = lower('National Trench Safety — East');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('National Trench Safety - Garner, NC')
AND lower(a.name) = lower('National Trench Safety')
AND lower(d.name) = lower('National Trench Safety — East');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('National Trench Safety - Gonzales, LA')
AND lower(a.name) = lower('National Trench Safety')
AND lower(d.name) = lower('National Trench Safety — Central');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('National Trench Safety - Grand JCT, CO')
AND lower(a.name) = lower('National Trench Safety')
AND lower(d.name) = lower('National Trench Safety — West');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('National Trench Safety - Irving, TX')
AND lower(a.name) = lower('National Trench Safety')
AND lower(d.name) = lower('National Trench Safety — Central');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('National Trench Safety - Jacksonville, FL')
AND lower(a.name) = lower('National Trench Safety')
AND lower(d.name) = lower('National Trench Safety — East');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('National Trench Safety - Kansas City, KS')
AND lower(a.name) = lower('National Trench Safety')
AND lower(d.name) = lower('National Trench Safety — Central');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('National Trench Safety - Las Vegas, NV')
AND lower(a.name) = lower('National Trench Safety')
AND lower(d.name) = lower('National Trench Safety — West');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('National Trench Safety - Manassas, VA')
AND lower(a.name) = lower('National Trench Safety')
AND lower(d.name) = lower('National Trench Safety — East');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('National Trench Safety - Manchester, PA')
AND lower(a.name) = lower('National Trench Safety')
AND lower(d.name) = lower('National Trench Safety — East');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('National Trench Safety - Mukilteo, WA')
AND lower(a.name) = lower('National Trench Safety')
AND lower(d.name) = lower('National Trench Safety — West');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('National Trench Safety - North Charleston, SC')
AND lower(a.name) = lower('National Trench Safety')
AND lower(d.name) = lower('National Trench Safety — East');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('National Trench Safety - North Houston, TX')
AND lower(a.name) = lower('National Trench Safety')
AND lower(d.name) = lower('National Trench Safety — Central');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('National Trench Safety - Orlando, FL')
AND lower(a.name) = lower('National Trench Safety')
AND lower(d.name) = lower('National Trench Safety — East');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('National Trench Safety - Parsippany, NJ')
AND lower(a.name) = lower('National Trench Safety')
AND lower(d.name) = lower('National Trench Safety — East');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('National Trench Safety - Phoenix, AZ')
AND lower(a.name) = lower('National Trench Safety')
AND lower(d.name) = lower('National Trench Safety — West');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('National Trench Safety - Pittsburg, CA')
AND lower(a.name) = lower('National Trench Safety')
AND lower(d.name) = lower('National Trench Safety — West');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('National Trench Safety - Pittsburg, PA')
AND lower(a.name) = lower('National Trench Safety')
AND lower(d.name) = lower('National Trench Safety — East');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('National Trench Safety - Provo, UT')
AND lower(a.name) = lower('National Trench Safety')
AND lower(d.name) = lower('National Trench Safety — West');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('National Trench Safety - Redbluff, CA')
AND lower(a.name) = lower('National Trench Safety')
AND lower(d.name) = lower('National Trench Safety — West');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('National Trench Safety - Reno, NV')
AND lower(a.name) = lower('National Trench Safety')
AND lower(d.name) = lower('National Trench Safety — West');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('National Trench Safety - Roselle, IL')
AND lower(a.name) = lower('National Trench Safety')
AND lower(d.name) = lower('National Trench Safety — Central');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('National Trench Safety - Sacramento, CA')
AND lower(a.name) = lower('National Trench Safety')
AND lower(d.name) = lower('National Trench Safety — West');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('National Trench Safety - Salt Lake, UT')
AND lower(a.name) = lower('National Trench Safety')
AND lower(d.name) = lower('National Trench Safety — West');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('National Trench Safety - San Antonio, TX')
AND lower(a.name) = lower('National Trench Safety')
AND lower(d.name) = lower('National Trench Safety — Central');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('National Trench Safety - San Diego, CA')
AND lower(a.name) = lower('National Trench Safety')
AND lower(d.name) = lower('National Trench Safety — West');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('National Trench Safety - San Leandro, CA')
AND lower(a.name) = lower('National Trench Safety')
AND lower(d.name) = lower('National Trench Safety — West');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('National Trench Safety - Santa Ana, CA')
AND lower(a.name) = lower('National Trench Safety')
AND lower(d.name) = lower('National Trench Safety — West');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('National Trench Safety - South Houston, TX')
AND lower(a.name) = lower('National Trench Safety')
AND lower(d.name) = lower('National Trench Safety — Central');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('National Trench Safety - St. Louis, MO')
AND lower(a.name) = lower('National Trench Safety')
AND lower(d.name) = lower('National Trench Safety — Central');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('National Trench Safety - Sulphur, LA')
AND lower(a.name) = lower('National Trench Safety')
AND lower(d.name) = lower('National Trench Safety — Central');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('National Trench Safety - Sylmar, CA')
AND lower(a.name) = lower('National Trench Safety')
AND lower(d.name) = lower('National Trench Safety — West');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('National Trench Safety - Tampa, FL')
AND lower(a.name) = lower('National Trench Safety')
AND lower(d.name) = lower('National Trench Safety — East');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('National Trench Safety - Toano, VA')
AND lower(a.name) = lower('National Trench Safety')
AND lower(d.name) = lower('National Trench Safety — East');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('National Trench Safety UK Limited')
AND lower(a.name) = lower('National Trench Safety UK Limited')
AND lower(d.name) = lower('National Trench Safety — Europe');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Pro Shoring Equipment')
AND lower(a.name) = lower('Pro Shoring Equipment')
AND lower(d.name) = lower('Direct');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('SOCAL SHIELD - EL CAJON, CA')
AND lower(a.name) = lower('SOCAL SHIELD')
AND lower(d.name) = lower('Direct');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('ShorQuip Supply, Inc. - Conshohocken, PA')
AND lower(a.name) = lower('ShorQuip Supply, Inc.')
AND lower(d.name) = lower('Direct');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Southeastern Trench Safety - Fortworth, TX')
AND lower(a.name) = lower('Southeastern Trench Safety')
AND lower(d.name) = lower('Southeastern Trench Safety — Central');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Southeastern Trench Safety - Kyle, TX')
AND lower(a.name) = lower('Southeastern Trench Safety')
AND lower(d.name) = lower('Southeastern Trench Safety — Central');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Southeastern Trench Safety - New Braunfels, TX')
AND lower(a.name) = lower('Southeastern Trench Safety')
AND lower(d.name) = lower('Southeastern Trench Safety — Central');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Sunbelt Rentals - Auburn, CA')
AND lower(a.name) = lower('Sunbelt Rentals')
AND lower(d.name) = lower('Sunbelt Rentals — West');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Sunbelt Rentals - Austin, TX')
AND lower(a.name) = lower('Sunbelt Rentals')
AND lower(d.name) = lower('Sunbelt Rentals — Gulf South');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Sunbelt Rentals - Belgrade, MT')
AND lower(a.name) = lower('Sunbelt Rentals')
AND lower(d.name) = lower('Sunbelt Rentals — Midwest');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Sunbelt Rentals - Bronx, NY')
AND lower(a.name) = lower('Sunbelt Rentals')
AND lower(d.name) = lower('Sunbelt Rentals — Northeast');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Sunbelt Rentals - Charlotte, NC')
AND lower(a.name) = lower('Sunbelt Rentals')
AND lower(d.name) = lower('Sunbelt Rentals — Southeast');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Sunbelt Rentals - Conyers, GA')
AND lower(a.name) = lower('Sunbelt Rentals')
AND lower(d.name) = lower('Sunbelt Rentals — Southeast');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Sunbelt Rentals - Corfu, NY')
AND lower(a.name) = lower('Sunbelt Rentals')
AND lower(d.name) = lower('Sunbelt Rentals — Northeast');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Sunbelt Rentals - Elgin, IL')
AND lower(a.name) = lower('Sunbelt Rentals')
AND lower(d.name) = lower('Sunbelt Rentals — Midwest');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Sunbelt Rentals - Elkridge, MD')
AND lower(a.name) = lower('Sunbelt Rentals')
AND lower(d.name) = lower('Sunbelt Rentals — Northeast');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Sunbelt Rentals - Fairfield, OH')
AND lower(a.name) = lower('Sunbelt Rentals')
AND lower(d.name) = lower('Sunbelt Rentals — Midwest');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Sunbelt Rentals - Hermitage, TN')
AND lower(a.name) = lower('Sunbelt Rentals')
AND lower(d.name) = lower('Sunbelt Rentals — Gulf South');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Sunbelt Rentals - Houston, TX')
AND lower(a.name) = lower('Sunbelt Rentals')
AND lower(d.name) = lower('Sunbelt Rentals — Gulf South');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Sunbelt Rentals - Indianapolis, IN')
AND lower(a.name) = lower('Sunbelt Rentals')
AND lower(d.name) = lower('Sunbelt Rentals — Midwest');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Sunbelt Rentals - Irving, TX')
AND lower(a.name) = lower('Sunbelt Rentals')
AND lower(d.name) = lower('Sunbelt Rentals — Gulf South');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Sunbelt Rentals - Jacksonville, FL')
AND lower(a.name) = lower('Sunbelt Rentals')
AND lower(d.name) = lower('Sunbelt Rentals — Southeast');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Sunbelt Rentals - Lafayette, CO')
AND lower(a.name) = lower('Sunbelt Rentals')
AND lower(d.name) = lower('Sunbelt Rentals — Midwest');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Sunbelt Rentals - Memphis, TN')
AND lower(a.name) = lower('Sunbelt Rentals')
AND lower(d.name) = lower('Sunbelt Rentals — Gulf South');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Sunbelt Rentals - Newcastle, CA')
AND lower(a.name) = lower('Sunbelt Rentals')
AND lower(d.name) = lower('Sunbelt Rentals — West');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Sunbelt Rentals - Orlando, FL')
AND lower(a.name) = lower('Sunbelt Rentals')
AND lower(d.name) = lower('Sunbelt Rentals — Southeast');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Sunbelt Rentals - Pacific, WA')
AND lower(a.name) = lower('Sunbelt Rentals')
AND lower(d.name) = lower('Sunbelt Rentals — West');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Sunbelt Rentals - Piscataway, NJ')
AND lower(a.name) = lower('Sunbelt Rentals')
AND lower(d.name) = lower('Sunbelt Rentals — Northeast');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Sunbelt Rentals - Pittsburgh, PA')
AND lower(a.name) = lower('Sunbelt Rentals')
AND lower(d.name) = lower('Sunbelt Rentals — Midwest');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Sunbelt Rentals - Pompano Beach, FL')
AND lower(a.name) = lower('Sunbelt Rentals')
AND lower(d.name) = lower('Sunbelt Rentals — Southeast');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Sunbelt Rentals - Portland, OR')
AND lower(a.name) = lower('Sunbelt Rentals')
AND lower(d.name) = lower('Sunbelt Rentals — West');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Sunbelt Rentals - Quinton, VA')
AND lower(a.name) = lower('Sunbelt Rentals')
AND lower(d.name) = lower('Sunbelt Rentals — Northeast');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Sunbelt Rentals - Riverside, CA')
AND lower(a.name) = lower('Sunbelt Rentals')
AND lower(d.name) = lower('Sunbelt Rentals — West');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Sunbelt Rentals - SLC, UT')
AND lower(a.name) = lower('Sunbelt Rentals')
AND lower(d.name) = lower('Sunbelt Rentals — Midwest');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Sunbelt Rentals - San Antonio, TX')
AND lower(a.name) = lower('Sunbelt Rentals')
AND lower(d.name) = lower('Sunbelt Rentals — Gulf South');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Sunbelt Rentals - San Jose, CA')
AND lower(a.name) = lower('Sunbelt Rentals')
AND lower(d.name) = lower('Sunbelt Rentals — West');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Sunbelt Rentals - San Marcos, CA')
AND lower(a.name) = lower('Sunbelt Rentals')
AND lower(d.name) = lower('Sunbelt Rentals — West');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Sunbelt Rentals - Slidell, LA')
AND lower(a.name) = lower('Sunbelt Rentals')
AND lower(d.name) = lower('Sunbelt Rentals — Gulf South');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Sunbelt Rentals - Spartanburg, SC')
AND lower(a.name) = lower('Sunbelt Rentals')
AND lower(d.name) = lower('Sunbelt Rentals — Southeast');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Sunbelt Rentals - Sterling, VA')
AND lower(a.name) = lower('Sunbelt Rentals')
AND lower(d.name) = lower('Sunbelt Rentals — Northeast');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Sunbelt Rentals - Tampa, FL')
AND lower(a.name) = lower('Sunbelt Rentals')
AND lower(d.name) = lower('Sunbelt Rentals — Southeast');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Sunbelt Rentals - Trainer, PA')
AND lower(a.name) = lower('Sunbelt Rentals')
AND lower(d.name) = lower('Sunbelt Rentals — Northeast');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Sunbelt Rentals - Tualatin, OR')
AND lower(a.name) = lower('Sunbelt Rentals')
AND lower(d.name) = lower('Sunbelt Rentals — West');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Sunbelt Rentals - Wake Forest, NC')
AND lower(a.name) = lower('Sunbelt Rentals')
AND lower(d.name) = lower('Sunbelt Rentals — Southeast');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Sunbelt Rentals - Woodinville, WA')
AND lower(a.name) = lower('Sunbelt Rentals')
AND lower(d.name) = lower('Sunbelt Rentals — West');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Sunstate Equipment  - Gainesville, GA')
AND lower(a.name) = lower('Sunstate Equipment ')
AND lower(d.name) = lower('Sunstate Equipment — East');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Sunstate Equipment  - Perris, CA')
AND lower(a.name) = lower('Sunstate Equipment ')
AND lower(d.name) = lower('Sunstate Equipment — West');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Sunstate Equipment  - Portland, OR')
AND lower(a.name) = lower('Sunstate Equipment ')
AND lower(d.name) = lower('Sunstate Equipment — West');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Sunstate Equipment - Auburn, WA')
AND lower(a.name) = lower('Sunstate Equipment')
AND lower(d.name) = lower('Sunstate Equipment — West');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Sunstate Equipment - Baldwin Park, CA')
AND lower(a.name) = lower('Sunstate Equipment')
AND lower(d.name) = lower('Sunstate Equipment — West');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Sunstate Equipment - Concord, NC')
AND lower(a.name) = lower('Sunstate Equipment')
AND lower(d.name) = lower('Sunstate Equipment — East');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Sunstate Equipment - Conley, GA')
AND lower(a.name) = lower('Sunstate Equipment')
AND lower(d.name) = lower('Sunstate Equipment — East');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Sunstate Equipment - Converse, TX')
AND lower(a.name) = lower('Sunstate Equipment')
AND lower(d.name) = lower('Sunstate Equipment — East');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Sunstate Equipment - El Cajon, CA')
AND lower(a.name) = lower('Sunstate Equipment')
AND lower(d.name) = lower('Sunstate Equipment — West');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Sunstate Equipment - El Paso, TX')
AND lower(a.name) = lower('Sunstate Equipment')
AND lower(d.name) = lower('Sunstate Equipment — East');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Sunstate Equipment - Garner, NC')
AND lower(a.name) = lower('Sunstate Equipment')
AND lower(d.name) = lower('Sunstate Equipment — East');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Sunstate Equipment - Grand Prairie, TX')
AND lower(a.name) = lower('Sunstate Equipment')
AND lower(d.name) = lower('Sunstate Equipment — East');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Sunstate Equipment - Houston, TX')
AND lower(a.name) = lower('Sunstate Equipment')
AND lower(d.name) = lower('Sunstate Equipment — East');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Sunstate Equipment - Jacksonville, FL')
AND lower(a.name) = lower('Sunstate Equipment')
AND lower(d.name) = lower('Sunstate Equipment — East');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Sunstate Equipment - Kent, WA')
AND lower(a.name) = lower('Sunstate Equipment')
AND lower(d.name) = lower('Sunstate Equipment — West');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Sunstate Equipment - Manor, TX')
AND lower(a.name) = lower('Sunstate Equipment')
AND lower(d.name) = lower('Sunstate Equipment — East');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Sunstate Equipment - Olympia, WA')
AND lower(a.name) = lower('Sunstate Equipment')
AND lower(d.name) = lower('Sunstate Equipment — West');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Sunstate Equipment - Pasco, WA')
AND lower(a.name) = lower('Sunstate Equipment')
AND lower(d.name) = lower('Sunstate Equipment — West');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Sunstate Equipment - Phoenix, AZ')
AND lower(a.name) = lower('Sunstate Equipment')
AND lower(d.name) = lower('Sunstate Equipment — West');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Sunstate Equipment - Phoenix, AZ-CORP')
AND lower(a.name) = lower('Sunstate Equipment')
AND lower(d.name) = lower('Sunstate Equipment — West');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Sunstate Equipment - Salem, OR')
AND lower(a.name) = lower('Sunstate Equipment')
AND lower(d.name) = lower('Sunstate Equipment — West');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Sunstate Equipment - San Bernardino, CA')
AND lower(a.name) = lower('Sunstate Equipment')
AND lower(d.name) = lower('Sunstate Equipment — West');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Sunstate Equipment - Tucson, AZ')
AND lower(a.name) = lower('Sunstate Equipment')
AND lower(d.name) = lower('Sunstate Equipment — West');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Sunstate Equipment - Woodinville, WA')
AND lower(a.name) = lower('Sunstate Equipment')
AND lower(d.name) = lower('Sunstate Equipment — West');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('TRENCH-ADE, Inc - Houston, TX')
AND lower(a.name) = lower('TRENCH-ADE, Inc')
AND lower(d.name) = lower('TRENCH-ADE, Inc — Corporate');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('TRENCH-ADE, Inc - Irving, TX')
AND lower(a.name) = lower('TRENCH-ADE, Inc')
AND lower(d.name) = lower('TRENCH-ADE, Inc — Corporate');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('TRENCH-ADE, Inc - Phoenix, AZ')
AND lower(a.name) = lower('TRENCH-ADE, Inc')
AND lower(d.name) = lower('TRENCH-ADE, Inc — Corporate');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Trench Shoring Company - Bakersfield, CA')
AND lower(a.name) = lower('Trench Shoring Company')
AND lower(d.name) = lower('Trench Shoring Company — West');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Trench Shoring Company - Compton, CA')
AND lower(a.name) = lower('Trench Shoring Company')
AND lower(d.name) = lower('Trench Shoring Company — West');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Trench Shoring Company - Corona, CA')
AND lower(a.name) = lower('Trench Shoring Company')
AND lower(d.name) = lower('Trench Shoring Company — West');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Trench Shoring Company - Fresno, CA')
AND lower(a.name) = lower('Trench Shoring Company')
AND lower(d.name) = lower('Trench Shoring Company — West');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Trench Shoring Company - Fullerton, CA')
AND lower(a.name) = lower('Trench Shoring Company')
AND lower(d.name) = lower('Trench Shoring Company — West');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Trench Shoring Company - Las Vegas, NV')
AND lower(a.name) = lower('Trench Shoring Company')
AND lower(d.name) = lower('Trench Shoring Company — West');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Trench Shoring Company - Moorpark, CA')
AND lower(a.name) = lower('Trench Shoring Company')
AND lower(d.name) = lower('Trench Shoring Company — West');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Trench Shoring Company - Sacramento, CA')
AND lower(a.name) = lower('Trench Shoring Company')
AND lower(d.name) = lower('Trench Shoring Company — West');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Trench Shoring Company - San Diego, CA')
AND lower(a.name) = lower('Trench Shoring Company')
AND lower(d.name) = lower('Trench Shoring Company — West');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Trench Shoring Company - San Leandro, CA')
AND lower(a.name) = lower('Trench Shoring Company')
AND lower(d.name) = lower('Trench Shoring Company — West');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('U.S. Shoring & Equipment Co. - TX')
AND lower(a.name) = lower('U.S. Shoring & Equipment Co.')
AND lower(d.name) = lower('US Shoring - Corporate');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Underground Products of Texas')
AND lower(a.name) = lower('Underground Products of Texas')
AND lower(d.name) = lower('Direct');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('United Rentals')
AND lower(a.name) = lower('United Rentals')
AND lower(d.name) = lower('United Rentals — Gulf');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('United Rentals - AB Canada')
AND lower(a.name) = lower('United Rentals')
AND lower(d.name) = lower('United Rentals — Western Canada');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('United Rentals - Albuquerque, NM')
AND lower(a.name) = lower('United Rentals')
AND lower(d.name) = lower('United Rentals — Mountain');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('United Rentals - Arlington, TX')
AND lower(a.name) = lower('United Rentals')
AND lower(d.name) = lower('United Rentals — Gulf');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('United Rentals - Ashland, VA')
AND lower(a.name) = lower('United Rentals')
AND lower(d.name) = lower('United Rentals — Mid Atlantic');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('United Rentals - Auburn, NH')
AND lower(a.name) = lower('United Rentals')
AND lower(d.name) = lower('United Rentals — Northeast');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('United Rentals - Austin, TX')
AND lower(a.name) = lower('United Rentals')
AND lower(d.name) = lower('United Rentals — Gulf');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('United Rentals - Bakersfield, CA')
AND lower(a.name) = lower('United Rentals')
AND lower(d.name) = lower('United Rentals — NorCal');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('United Rentals - Baldwin Park, CA')
AND lower(a.name) = lower('United Rentals')
AND lower(d.name) = lower('United Rentals — Southwest');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('United Rentals - Baltimore, MD')
AND lower(a.name) = lower('United Rentals')
AND lower(d.name) = lower('United Rentals — Mid Atlantic');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('United Rentals - Bohemia, NY')
AND lower(a.name) = lower('United Rentals')
AND lower(d.name) = lower('United Rentals — Northeast');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('United Rentals - Boise, ID')
AND lower(a.name) = lower('United Rentals')
AND lower(d.name) = lower('United Rentals — Mountain');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('United Rentals - Charlotte, NC')
AND lower(a.name) = lower('United Rentals')
AND lower(d.name) = lower('United Rentals — Mid Atlantic');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('United Rentals - Chesapeake, VA')
AND lower(a.name) = lower('United Rentals')
AND lower(d.name) = lower('United Rentals — Mid Atlantic');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('United Rentals - Chicago, IL')
AND lower(a.name) = lower('United Rentals')
AND lower(d.name) = lower('United Rentals — Midwest');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('United Rentals - Colorado Spring, CO')
AND lower(a.name) = lower('United Rentals')
AND lower(d.name) = lower('United Rentals — Mountain');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('United Rentals - Columbia, SC')
AND lower(a.name) = lower('United Rentals')
AND lower(d.name) = lower('United Rentals — Mid Atlantic');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('United Rentals - Columbus, OH')
AND lower(a.name) = lower('United Rentals')
AND lower(d.name) = lower('United Rentals — Mid Central');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('United Rentals - Concord, CA')
AND lower(a.name) = lower('United Rentals')
AND lower(d.name) = lower('United Rentals — NorCal');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('United Rentals - Denver, CO')
AND lower(a.name) = lower('United Rentals')
AND lower(d.name) = lower('United Rentals — Mountain');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('United Rentals - Detroit, MI')
AND lower(a.name) = lower('United Rentals')
AND lower(d.name) = lower('United Rentals — Mid Central');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('United Rentals - Dorval, QC Canada')
AND lower(a.name) = lower('United Rentals')
AND lower(d.name) = lower('United Rentals — Northeast Canada');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('United Rentals - Edmonton (Canada)')
AND lower(a.name) = lower('United Rentals')
AND lower(d.name) = lower('United Rentals — Western Canada');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('United Rentals - Elizabeth, NJ')
AND lower(a.name) = lower('United Rentals')
AND lower(d.name) = lower('United Rentals — Northeast');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('United Rentals - Fairburn, GA')
AND lower(a.name) = lower('United Rentals')
AND lower(d.name) = lower('United Rentals — Southeast');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('United Rentals - Fairfield, OH')
AND lower(a.name) = lower('United Rentals')
AND lower(d.name) = lower('United Rentals — Mid Central');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('United Rentals - Fresno, CA')
AND lower(a.name) = lower('United Rentals')
AND lower(d.name) = lower('United Rentals — NorCal');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('United Rentals - Garden City, GA')
AND lower(a.name) = lower('United Rentals')
AND lower(d.name) = lower('United Rentals — Mid Atlantic');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('United Rentals - Gonzales, LA')
AND lower(a.name) = lower('United Rentals')
AND lower(d.name) = lower('United Rentals — Gulf');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('United Rentals - Greensboro, NC')
AND lower(a.name) = lower('United Rentals')
AND lower(d.name) = lower('United Rentals — Mid Atlantic');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('United Rentals - Grimes, IA')
AND lower(a.name) = lower('United Rentals')
AND lower(d.name) = lower('United Rentals — Midwest');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('United Rentals - Hayward, CA')
AND lower(a.name) = lower('United Rentals')
AND lower(d.name) = lower('United Rentals — NorCal');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('United Rentals - Hayward, CA-HUB')
AND lower(a.name) = lower('United Rentals')
AND lower(d.name) = lower('United Rentals — NorCal');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('United Rentals - Houston, TX')
AND lower(a.name) = lower('United Rentals')
AND lower(d.name) = lower('United Rentals — Gulf');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('United Rentals - Hyattsville, MD')
AND lower(a.name) = lower('United Rentals')
AND lower(d.name) = lower('United Rentals — Mid Atlantic');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('United Rentals - Indianapolis, IN')
AND lower(a.name) = lower('United Rentals')
AND lower(d.name) = lower('United Rentals — Mid Central');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('United Rentals - Irvine, CA')
AND lower(a.name) = lower('United Rentals')
AND lower(d.name) = lower('United Rentals — Southwest');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('United Rentals - Jacksonville, FL')
AND lower(a.name) = lower('United Rentals')
AND lower(d.name) = lower('United Rentals — Southeast');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('United Rentals - Kansas City, MO')
AND lower(a.name) = lower('United Rentals')
AND lower(d.name) = lower('United Rentals — Midwest');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('United Rentals - Kennesaw, GA')
AND lower(a.name) = lower('United Rentals')
AND lower(d.name) = lower('United Rentals — Southeast');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('United Rentals - Knoxville, TN')
AND lower(a.name) = lower('United Rentals')
AND lower(d.name) = lower('United Rentals — Mid Central');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('United Rentals - Langley, BC Canada')
AND lower(a.name) = lower('United Rentals')
AND lower(d.name) = lower('United Rentals — Western Canada');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('United Rentals - Lansing, MI')
AND lower(a.name) = lower('United Rentals')
AND lower(d.name) = lower('United Rentals — Mid Central');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('United Rentals - Las Vegas, NV')
AND lower(a.name) = lower('United Rentals')
AND lower(d.name) = lower('United Rentals — Southwest');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('United Rentals - Lawrenceville, GA')
AND lower(a.name) = lower('United Rentals')
AND lower(d.name) = lower('United Rentals — Southeast');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('United Rentals - Longbeach, CA')
AND lower(a.name) = lower('United Rentals')
AND lower(d.name) = lower('United Rentals — Southwest');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('United Rentals - Louisville, KY')
AND lower(a.name) = lower('United Rentals')
AND lower(d.name) = lower('United Rentals — Mid Central');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('United Rentals - Lubbock, TX')
AND lower(a.name) = lower('United Rentals')
AND lower(d.name) = lower('United Rentals — Gulf');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('United Rentals - Manassas, VA')
AND lower(a.name) = lower('United Rentals')
AND lower(d.name) = lower('United Rentals — Mid Atlantic');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('United Rentals - Marmet, WV')
AND lower(a.name) = lower('United Rentals')
AND lower(d.name) = lower('United Rentals — Mid Central');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('United Rentals - Memphis, TN')
AND lower(a.name) = lower('United Rentals')
AND lower(d.name) = lower('United Rentals — Mid Central');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('United Rentals - Mesa, AZ')
AND lower(a.name) = lower('United Rentals')
AND lower(d.name) = lower('United Rentals — Southwest');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('United Rentals - Miami, FL')
AND lower(a.name) = lower('United Rentals')
AND lower(d.name) = lower('United Rentals — Southeast');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('United Rentals - Nashville, TN')
AND lower(a.name) = lower('United Rentals')
AND lower(d.name) = lower('United Rentals — Mid Central');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('United Rentals - North Charleston, SC')
AND lower(a.name) = lower('United Rentals')
AND lower(d.name) = lower('United Rentals — Mid Atlantic');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('United Rentals - Oklahoma City, OK')
AND lower(a.name) = lower('United Rentals')
AND lower(d.name) = lower('United Rentals — Midwest');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('United Rentals - Omaha, NE')
AND lower(a.name) = lower('United Rentals')
AND lower(d.name) = lower('United Rentals — Midwest');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('United Rentals - Orlando, FL')
AND lower(a.name) = lower('United Rentals')
AND lower(d.name) = lower('United Rentals — Southeast');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('United Rentals - Ottawa Ont (Canada)')
AND lower(a.name) = lower('United Rentals')
AND lower(d.name) = lower('United Rentals — Northeast Canada');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('United Rentals - Pennsauken, NJ')
AND lower(a.name) = lower('United Rentals')
AND lower(d.name) = lower('United Rentals — Northeast');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('United Rentals - Pensacola, FL')
AND lower(a.name) = lower('United Rentals')
AND lower(d.name) = lower('United Rentals — Southeast');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('United Rentals - Phoenix, AZ')
AND lower(a.name) = lower('United Rentals')
AND lower(d.name) = lower('United Rentals — Southwest');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('United Rentals - Pompano, FL')
AND lower(a.name) = lower('United Rentals')
AND lower(d.name) = lower('United Rentals — Southeast');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('United Rentals - Portland, OR')
AND lower(a.name) = lower('United Rentals')
AND lower(d.name) = lower('United Rentals — Mountain');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('United Rentals - Quakertown, PA')
AND lower(a.name) = lower('United Rentals')
AND lower(d.name) = lower('United Rentals — Northeast');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('United Rentals - Raleigh, NC')
AND lower(a.name) = lower('United Rentals')
AND lower(d.name) = lower('United Rentals — Mid Atlantic');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('United Rentals - Reno, NV')
AND lower(a.name) = lower('United Rentals')
AND lower(d.name) = lower('United Rentals — NorCal');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('United Rentals - Richfield, OH')
AND lower(a.name) = lower('United Rentals')
AND lower(d.name) = lower('United Rentals — Mid Central');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('United Rentals - Riverside, CA')
AND lower(a.name) = lower('United Rentals')
AND lower(d.name) = lower('United Rentals — Southwest');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('United Rentals - Rochester, NY')
AND lower(a.name) = lower('United Rentals')
AND lower(d.name) = lower('United Rentals — Northeast');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('United Rentals - SLC, UT')
AND lower(a.name) = lower('United Rentals')
AND lower(d.name) = lower('United Rentals — Mountain');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('United Rentals - Sacramento, CA')
AND lower(a.name) = lower('United Rentals')
AND lower(d.name) = lower('United Rentals — NorCal');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('United Rentals - San Antonio, TX')
AND lower(a.name) = lower('United Rentals')
AND lower(d.name) = lower('United Rentals — Gulf');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('United Rentals - San Francisco, CA')
AND lower(a.name) = lower('United Rentals')
AND lower(d.name) = lower('United Rentals — NorCal');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('United Rentals - San Jose, CA')
AND lower(a.name) = lower('United Rentals')
AND lower(d.name) = lower('United Rentals — NorCal');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('United Rentals - San Luis Obispo, CA')
AND lower(a.name) = lower('United Rentals')
AND lower(d.name) = lower('United Rentals — Southwest');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('United Rentals - Santa Rosa, CA')
AND lower(a.name) = lower('United Rentals')
AND lower(d.name) = lower('United Rentals — NorCal');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('United Rentals - Savage, MN')
AND lower(a.name) = lower('United Rentals')
AND lower(d.name) = lower('United Rentals — Midwest');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('United Rentals - Seattle, WA')
AND lower(a.name) = lower('United Rentals')
AND lower(d.name) = lower('United Rentals — Mountain');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('United Rentals - Shrewsbury, MA')
AND lower(a.name) = lower('United Rentals')
AND lower(d.name) = lower('United Rentals — Northeast');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('United Rentals - Simpsonville, SC')
AND lower(a.name) = lower('United Rentals')
AND lower(d.name) = lower('United Rentals — Mid Atlantic');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('United Rentals - Spokane, WA')
AND lower(a.name) = lower('United Rentals')
AND lower(d.name) = lower('United Rentals — Mountain');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('United Rentals - St. Louis, MO')
AND lower(a.name) = lower('United Rentals')
AND lower(d.name) = lower('United Rentals — Midwest');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('United Rentals - Streamwood, IL')
AND lower(a.name) = lower('United Rentals')
AND lower(d.name) = lower('United Rentals — Midwest');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('United Rentals - Tacoma, WA')
AND lower(a.name) = lower('United Rentals')
AND lower(d.name) = lower('United Rentals — Mountain');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('United Rentals - Tampa, FL')
AND lower(a.name) = lower('United Rentals')
AND lower(d.name) = lower('United Rentals — Southeast');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('United Rentals - Tucson, AZ')
AND lower(a.name) = lower('United Rentals')
AND lower(d.name) = lower('United Rentals — Southwest');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('United Rentals - Tulsa, OK')
AND lower(a.name) = lower('United Rentals')
AND lower(d.name) = lower('United Rentals — Midwest');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('United Rentals - Turlock, CA')
AND lower(a.name) = lower('United Rentals')
AND lower(d.name) = lower('United Rentals — NorCal');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('United Rentals - Ventura, CA')
AND lower(a.name) = lower('United Rentals')
AND lower(d.name) = lower('United Rentals — Southwest');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('United Rentals - Wallingford, CT')
AND lower(a.name) = lower('United Rentals')
AND lower(d.name) = lower('United Rentals — Northeast');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('United Rentals - Waukesha, WI')
AND lower(a.name) = lower('United Rentals')
AND lower(d.name) = lower('United Rentals — Midwest');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('United Rentals - West Mifflin, PA')
AND lower(a.name) = lower('United Rentals')
AND lower(d.name) = lower('United Rentals — Mid Central');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('United Rentals - Wilmington, NC')
AND lower(a.name) = lower('United Rentals')
AND lower(d.name) = lower('United Rentals — Mid Atlantic');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('United Rentals of Canada, Inc. - Bolton')
AND lower(a.name) = lower('United Rentals of Canada, Inc.')
AND lower(d.name) = lower('United Rentals — Northeast Canada');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('United Rentals of Canada, Inc. - Calgary, AB')
AND lower(a.name) = lower('United Rentals of Canada, Inc.')
AND lower(d.name) = lower('United Rentals — Western Canada');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('United Rentals of Canada, Inc. - NANAIMO, BC')
AND lower(a.name) = lower('United Rentals of Canada, Inc.')
AND lower(d.name) = lower('United Rentals — Western Canada');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('United Rentals of Canada, Inc. - Quebec')
AND lower(a.name) = lower('United Rentals of Canada, Inc.')
AND lower(d.name) = lower('United Rentals — Northeast Canada');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('United Rentals of Canada, Inc. - West St. Paul, MB')
AND lower(a.name) = lower('United Rentals of Canada, Inc.')
AND lower(d.name) = lower('United Rentals — Western Canada');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('United Rentals of Canada, Inc. Brantford')
AND lower(a.name) = lower('United Rentals of Canada, Inc. Brantford')
AND lower(d.name) = lower('United Rentals — Northeast Canada');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Valley Shoring and Safety - Bakersfield, CA')
AND lower(a.name) = lower('Valley Shoring and Safety')
AND lower(d.name) = lower('Direct');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Vandalia Rental - Vandalia, OH')
AND lower(a.name) = lower('Vandalia Rental')
AND lower(d.name) = lower('Direct');
UPDATE branches b
SET district_id = d.id, updated_at = now()
FROM districts d
JOIN accounts a ON d.account_id = a.id
WHERE lower(b.name) = lower('Zip U There, Inc.')
AND lower(a.name) = lower('Zip U There, Inc.')
AND lower(d.name) = lower('Direct');