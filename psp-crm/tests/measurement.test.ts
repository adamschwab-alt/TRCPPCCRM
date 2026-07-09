import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { bootDb, actAs, actAsSuperuser } from './helpers/pglite';

/**
 * Phase-1 measurement layer proofs (migration 0008), run against the real SQL
 * in PGlite: append-only stage history via trigger, derived closed_at, and
 * auto-mapped forecast_category with explicit-override support.
 */
let db: PGlite;

const REP = '44444444-4444-4444-4444-444444444444';
const ACC = '00000000-0000-0000-0000-0000000000c1';
const OPP = '00000000-0000-0000-0000-0000000000d1';

beforeAll(async () => {
  db = await bootDb();
  await actAsSuperuser(db);
  await db.query(
    `insert into auth.users (id, email, raw_user_meta_data) values ($1,'rep@psp.test','{"role":"rep"}')`,
    [REP],
  );
  await db.query(`insert into accounts (id, name, owner_id) values ($1,'Wiring Test Co',$2)`, [
    ACC,
    REP,
  ]);
});

afterAll(async () => {
  await db?.close();
});

async function history(field?: string) {
  const rows = await db.query<{ field: string; old_value: string | null; new_value: string | null }>(
    `select field, old_value, new_value from opportunity_stage_history
     where opportunity_id = $1 ${field ? `and field = '${field}'` : ''} order by id`,
    [OPP],
  );
  return rows.rows;
}

describe('opportunity measurement triggers (0008)', () => {
  it('creation logs a history row and auto-maps forecast_category', async () => {
    await actAs(db, REP);
    await db.query(
      `insert into opportunities (id, account_id, owner_id, stage, amount) values ($1,$2,$3,'Qualified',10000)`,
      [OPP, ACC, REP],
    );
    const created = await history('created');
    expect(created).toHaveLength(1);
    expect(created[0].new_value).toBe('Qualified');

    const opp = await db.query<{ forecast_category: string; closed_at: string | null }>(
      `select forecast_category, closed_at from opportunities where id = $1`,
      [OPP],
    );
    expect(opp.rows[0].forecast_category).toBe('pipeline');
    expect(opp.rows[0].closed_at).toBeNull();
  });

  it('stage advance logs history and re-maps the category', async () => {
    await actAs(db, REP);
    await db.query(`update opportunities set stage = 'Quoted' where id = $1`, [OPP]);
    const stages = await history('stage');
    expect(stages).toHaveLength(1);
    expect(stages[0]).toMatchObject({ old_value: 'Qualified', new_value: 'Quoted' });
    const cat = await db.query<{ forecast_category: string }>(
      `select forecast_category from opportunities where id = $1`,
      [OPP],
    );
    expect(cat.rows[0].forecast_category).toBe('best_case');
  });

  it('an explicit category CHANGE in the same statement wins over the auto-map', async () => {
    await actAs(db, REP);
    // Rep advances to Verbal but deliberately downgrades the category to
    // pipeline (distinct from current best_case) — the override must stick
    // (auto-map alone would say commit).
    await db.query(
      `update opportunities set stage = 'Verbal', forecast_category = 'pipeline' where id = $1`,
      [OPP],
    );
    const cat = await db.query<{ forecast_category: string }>(
      `select forecast_category from opportunities where id = $1`,
      [OPP],
    );
    expect(cat.rows[0].forecast_category).toBe('pipeline');
    // and the override itself is in history
    const catHistory = await history('forecast_category');
    expect(catHistory.at(-1)).toMatchObject({ old_value: 'best_case', new_value: 'pipeline' });
  });

  it('amount changes are shadowed in history (sandbag detector)', async () => {
    await actAs(db, REP);
    await db.query(`update opportunities set amount = 25000 where id = $1`, [OPP]);
    const amounts = await history('amount');
    expect(amounts).toHaveLength(1);
    expect(amounts[0]).toMatchObject({ old_value: '10000.00', new_value: '25000.00' });
  });

  it('Won sets closed_at; reopening clears it (cycle-length integrity)', async () => {
    await actAs(db, REP);
    await db.query(`update opportunities set stage = 'Won' where id = $1`, [OPP]);
    let opp = await db.query<{ closed_at: string | null }>(
      `select closed_at from opportunities where id = $1`,
      [OPP],
    );
    expect(opp.rows[0].closed_at).not.toBeNull();

    await db.query(`update opportunities set stage = 'Quoted' where id = $1`, [OPP]);
    opp = await db.query<{ closed_at: string | null }>(
      `select closed_at from opportunities where id = $1`,
      [OPP],
    );
    expect(opp.rows[0].closed_at).toBeNull();

    const stages = await history('stage');
    expect(stages.map((s) => `${s.old_value}→${s.new_value}`)).toEqual([
      'Qualified→Quoted',
      'Quoted→Verbal',
      'Verbal→Won',
      'Won→Quoted',
    ]);
  });

  it('history is append-only for reps (no update/delete policies)', async () => {
    await actAs(db, REP);
    await db.query(`delete from opportunity_stage_history where opportunity_id = $1`, [OPP]);
    const rows = await history();
    expect(rows.length).toBeGreaterThan(0); // delete silently affected 0 rows under RLS
  });
});
