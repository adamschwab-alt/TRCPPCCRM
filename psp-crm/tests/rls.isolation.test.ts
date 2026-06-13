import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { bootDb, actAs, actAsSuperuser } from './helpers/pglite';

/**
 * §5 proof: a rep can read ONLY their own book. The flagship assertion is that
 * rep1 cannot read rep2's branch (nor its account / transactions), while a
 * manager sees everything.
 */
let db: PGlite;

const REP1 = '11111111-1111-1111-1111-111111111111';
const REP2 = '22222222-2222-2222-2222-222222222222';
const MGR = '33333333-3333-3333-3333-333333333333';

beforeAll(async () => {
  db = await bootDb();
  await actAsSuperuser(db);
  // handle_new_user trigger mirrors auth.users → profiles, taking role from metadata.
  await db.query(
    `insert into auth.users (id, email, raw_user_meta_data) values
       ($1,'rep1@psp.test','{"role":"rep"}'),
       ($2,'rep2@psp.test','{"role":"rep"}'),
       ($3,'mgr@psp.test','{"role":"manager"}')`,
    [REP1, REP2, MGR],
  );
  // Each rep owns one account + branch + transaction.
  await db.query(
    `insert into accounts (id, name, owner_id) values
       ('00000000-0000-0000-0000-0000000000a1','Rep1 Account',$1),
       ('00000000-0000-0000-0000-0000000000a2','Rep2 Account',$2)`,
    [REP1, REP2],
  );
  await db.query(
    `insert into branches (id, account_id, name, owner_id) values
       ('00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000a1','Rep1 Branch',$1),
       ('00000000-0000-0000-0000-0000000000b2','00000000-0000-0000-0000-0000000000a2','Rep2 Branch',$2)`,
    [REP1, REP2],
  );
  await db.exec(`
    insert into sales_transactions (date, net_sale, margin, status, account_id, branch_id, product_line, invoice_nbr, line_nbr) values
      ('2025-06-01', 100, 30, 'Closed','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000b1','Steel','I1','1'),
      ('2025-06-01', 200, 60, 'Closed','00000000-0000-0000-0000-0000000000a2','00000000-0000-0000-0000-0000000000b2','Steel','I2','1');
  `);
});

afterAll(async () => {
  await db?.close();
});

describe('rep isolation', () => {
  it('rep1 sees only their own branch', async () => {
    await actAs(db, REP1);
    const rows = await db.query<{ name: string }>('select name from branches order by name');
    expect(rows.rows.map((r) => r.name)).toEqual(['Rep1 Branch']);
  });

  it('rep1 CANNOT read rep2 branch by id (flagship)', async () => {
    await actAs(db, REP1);
    const rows = await db.query(
      `select * from branches where id = '00000000-0000-0000-0000-0000000000b2'`,
    );
    expect(rows.rows).toHaveLength(0);
  });

  it('rep1 cannot read rep2 account or transactions', async () => {
    await actAs(db, REP1);
    const acc = await db.query('select * from accounts');
    expect(acc.rows).toHaveLength(1);
    const txn = await db.query('select * from sales_transactions');
    expect(txn.rows).toHaveLength(1);
  });

  it('rep1 portfolio_kpis reflect only their book ($100, not $300)', async () => {
    await actAs(db, REP1);
    const k = await db.query<{ current_book: string }>(
      'select current_book from portfolio_kpis',
    );
    expect(Number(k.rows[0].current_book)).toBe(100);
  });

  it('manager sees all branches', async () => {
    await actAs(db, MGR);
    const rows = await db.query('select id from branches');
    expect(rows.rows).toHaveLength(2);
  });
});
