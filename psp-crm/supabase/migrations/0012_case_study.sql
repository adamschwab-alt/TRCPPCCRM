-- ════════════════════════════════════════════════════════════════════════════
-- 0012 Case-study evidence (blueprint Phase 5)
-- exogenous_events doubles as the contemporaneous evidence log: market shocks
-- (footnotes for charts) AND dated testimonials (quotes captured when said,
-- not reconstructed later). A `kind` discriminator keeps them queryable apart.
-- ════════════════════════════════════════════════════════════════════════════

alter table exogenous_events
  add column if not exists kind text not null default 'market'
  check (kind in ('market', 'testimonial'));
