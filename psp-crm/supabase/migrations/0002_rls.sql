-- ════════════════════════════════════════════════════════════════════════════
-- 0002 Row-Level Security (§5)
-- admin  : everything
-- manager: read ALL data, no user admin
-- rep    : read/write only OWNED records (owner_id / user_id / assignee_id)
-- Keyed on auth.uid() + profiles.role + ownership.
-- ════════════════════════════════════════════════════════════════════════════

-- Helper: current user's role. SECURITY DEFINER so reading `profiles` here does
-- NOT recurse into profiles' own RLS policies.
create or replace function app_role() returns user_role as $$
  select role from public.profiles where id = auth.uid();
$$ language sql stable security definer set search_path = public;

create or replace function is_admin() returns boolean as $$
  select app_role() = 'admin';
$$ language sql stable;

-- managers + admins see all data
create or replace function is_staff() returns boolean as $$
  select app_role() in ('admin', 'manager');
$$ language sql stable;

-- Branches owned (directly or via owned parent account) by current rep
create or replace function rep_owns_branch(b_id uuid, a_id uuid) returns boolean as $$
  select exists (select 1 from public.branches b
                 where b.id = b_id and b.owner_id = auth.uid())
      or exists (select 1 from public.accounts a
                 where a.id = a_id and a.owner_id = auth.uid());
$$ language sql stable security definer set search_path = public;

-- Enable RLS everywhere
alter table profiles           enable row level security;
alter table accounts           enable row level security;
alter table branches           enable row level security;
alter table sales_transactions enable row level security;
alter table opportunities      enable row level security;
alter table activities         enable row level security;
alter table tasks              enable row level security;
alter table targets            enable row level security;
alter table app_settings       enable row level security;
alter table stage_win_prob     enable row level security;
alter table audit_log          enable row level security;

-- ── profiles ────────────────────────────────────────────────────────────────
-- Names are needed to render owners; any authenticated user may read profiles.
create policy profiles_select on profiles
  for select to authenticated using (true);
create policy profiles_update_self on profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_admin_all on profiles
  for all to authenticated using (is_admin()) with check (is_admin());

-- ── accounts ────────────────────────────────────────────────────────────────
create policy accounts_select on accounts
  for select to authenticated using (is_staff() or owner_id = auth.uid());
create policy accounts_rep_write on accounts
  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy accounts_staff_write on accounts
  for all to authenticated using (is_staff()) with check (is_staff());

-- ── branches ────────────────────────────────────────────────────────────────
create policy branches_select on branches
  for select to authenticated using (is_staff() or owner_id = auth.uid());
create policy branches_rep_write on branches
  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy branches_staff_write on branches
  for all to authenticated using (is_staff()) with check (is_staff());

-- ── sales_transactions ──────────────────────────────────────────────────────
create policy sales_txn_select on sales_transactions
  for select to authenticated
  using (is_staff() or rep_owns_branch(branch_id, account_id));
create policy sales_txn_staff_write on sales_transactions
  for all to authenticated using (is_staff()) with check (is_staff());

-- ── opportunities ───────────────────────────────────────────────────────────
create policy opportunities_select on opportunities
  for select to authenticated using (is_staff() or owner_id = auth.uid());
create policy opportunities_rep_write on opportunities
  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy opportunities_staff_write on opportunities
  for all to authenticated using (is_staff()) with check (is_staff());

-- ── activities ──────────────────────────────────────────────────────────────
create policy activities_select on activities
  for select to authenticated using (is_staff() or user_id = auth.uid());
create policy activities_rep_write on activities
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy activities_staff_write on activities
  for all to authenticated using (is_staff()) with check (is_staff());

-- ── tasks ───────────────────────────────────────────────────────────────────
create policy tasks_select on tasks
  for select to authenticated
  using (is_staff() or assignee_id = auth.uid() or created_by = auth.uid());
create policy tasks_rep_write on tasks
  for all to authenticated
  using (assignee_id = auth.uid() or created_by = auth.uid())
  with check (assignee_id = auth.uid() or created_by = auth.uid());
create policy tasks_staff_write on tasks
  for all to authenticated using (is_staff()) with check (is_staff());

-- ── singletons / reference (read for all authenticated; write admin only) ────
create policy targets_select on targets for select to authenticated using (true);
create policy targets_admin on targets for all to authenticated using (is_admin()) with check (is_admin());

create policy app_settings_select on app_settings for select to authenticated using (true);
create policy app_settings_admin on app_settings for all to authenticated using (is_admin()) with check (is_admin());

create policy stage_win_prob_select on stage_win_prob for select to authenticated using (true);
create policy stage_win_prob_admin on stage_win_prob for all to authenticated using (is_admin()) with check (is_admin());

-- ── audit_log (admins read; inserts via service role / definer fns) ─────────
create policy audit_log_admin_select on audit_log for select to authenticated using (is_admin());
