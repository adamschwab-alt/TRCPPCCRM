-- ════════════════════════════════════════════════════════════════════════════
-- 0006 Audit logging
-- A SECURITY DEFINER helper so any authenticated user can append an audit entry
-- (the audit_log table itself stays admin-read-only via RLS). Server actions
-- call this after every create/update/delete.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function log_audit(
  p_action text,
  p_entity text,
  p_entity_id text,
  p_diff jsonb default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into audit_log (actor_id, action, entity, entity_id, diff)
  values (auth.uid(), p_action, p_entity, p_entity_id, p_diff);
end;
$$;

grant execute on function log_audit(text, text, text, jsonb) to authenticated;
