-- ════════════════════════════════════════════════════════════════════════════
-- 0005 Grants — privileges for the Supabase auth roles.
-- RLS (0002) decides WHICH ROWS; these GRANTs decide table/column access at all.
-- Runs after views (0003) so the view grants are included.
-- ════════════════════════════════════════════════════════════════════════════

grant usage on schema public to anon, authenticated;

-- Tables + views (GRANT ... ON ALL TABLES includes views). RLS still applies.
grant select, insert, update, delete on all tables in schema public to authenticated;

-- Keep future objects covered.
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
