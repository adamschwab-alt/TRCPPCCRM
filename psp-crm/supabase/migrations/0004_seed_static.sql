-- ════════════════════════════════════════════════════════════════════════════
-- 0004 Static seed — singletons & reference data (§3)
-- Idempotent. The importer (seed.ts) overwrites app_settings.as_of_date with the
-- latest complete month-end found in the workbook.
-- ════════════════════════════════════════════════════════════════════════════

insert into targets (id) values (true)
on conflict (id) do nothing;   -- defaults encode the brief's thresholds

-- Placeholder as_of; seed.ts replaces this with the workbook's latest month-end.
insert into app_settings (id, as_of_date) values (true, date_trunc('month', now())::date - 1)
on conflict (id) do nothing;

insert into stage_win_prob (stage, win_prob) values
  ('Qualified', 0.10),
  ('Quoted',    0.30),
  ('Verbal',    0.60),
  ('Won',       1.00),
  ('Lost',      0.00)
on conflict (stage) do update set win_prob = excluded.win_prob;
