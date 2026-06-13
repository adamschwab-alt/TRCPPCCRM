-- Minimal Supabase-compatible shims so the production migrations run unmodified
-- inside plain Postgres / PGlite during tests:
--   • auth.users table (FK target for profiles)
--   • auth.uid() reading the JWT 'sub' claim from a GUC
--   • the `authenticated` / `anon` roles referenced by RLS policies
create schema if not exists auth;

create table if not exists auth.users (
  id                 uuid primary key default gen_random_uuid(),
  email              text,
  raw_user_meta_data jsonb default '{}'::jsonb
);

create or replace function auth.uid() returns uuid as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$ language sql stable;

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon;
  end if;
end $$;
