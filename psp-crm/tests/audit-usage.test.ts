import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { actAs, actAsSuperuser, bootDb } from './helpers/pglite';

/**
 * The /admin/activity report reads audit_log + usage_events. Prove the shipped
 * SQL end-to-end: a rep's log_audit() call lands, their usage heartbeat lands,
 * an admin can read both, and a non-admin reads NEITHER.
 */

const ADMIN = '00000000-0000-4000-8000-00000000000a';
const REP = '00000000-0000-4000-8000-00000000000b';

let db: PGlite;

beforeAll(async () => {
  db = await bootDb();
  await actAsSuperuser(db);
  // handle_new_user trigger mirrors auth.users → profiles, role from metadata.
  await db.query(
    `insert into auth.users (id, email, raw_user_meta_data) values
       ($1, 'admin@psp.test', '{"full_name":"Admin","role":"admin"}'::jsonb),
       ($2, 'rep@psp.test',   '{"full_name":"Rep","role":"rep"}'::jsonb)`,
    [ADMIN, REP],
  );
});

describe('audit + usage pipeline (as the app calls it)', () => {
  it('log_audit() as a rep writes a row with the rep as actor', async () => {
    await actAs(db, REP);
    await db.query(`select log_audit('touch', 'branch', 'branch-1', '{"type":"call"}'::jsonb)`);
    await actAs(db, ADMIN);
    const { rows } = await db.query<{ actor_id: string; action: string; diff: unknown }>(
      `select actor_id, action, diff from audit_log`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].actor_id).toBe(REP);
    expect(rows[0].action).toBe('touch');
  });

  it('usage_events: users insert their own; admin reads; rep reads none', async () => {
    await actAs(db, REP);
    await db.query(`insert into usage_events (user_id, path) values ($1, '/my-day')`, [REP]);

    // A user may NOT write someone else's heartbeat.
    await expect(
      db.query(`insert into usage_events (user_id, path) values ($1, '/my-day')`, [ADMIN]),
    ).rejects.toThrow(/row-level security/i);

    // Rep sees nothing back (admin-only read)…
    const asRep = await db.query(`select count(*)::int as n from usage_events`);
    expect((asRep.rows[0] as { n: number }).n).toBe(0);

    // …admin sees the ping, exactly as /admin/activity queries it.
    await actAs(db, ADMIN);
    const asAdmin = await db.query(
      `select user_id, path from usage_events where occurred_at >= now() - interval '30 days'
       order by occurred_at, id`,
    );
    expect(asAdmin.rows).toEqual([{ user_id: REP, path: '/my-day' }]);
  });

  it('audit_log is admin-read-only (rep sees zero rows, no error)', async () => {
    await actAs(db, REP);
    const { rows } = await db.query(`select count(*)::int as n from audit_log`);
    expect((rows[0] as { n: number }).n).toBe(0);
  });
});
