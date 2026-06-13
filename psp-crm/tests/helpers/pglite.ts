import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const migrationsDir = join(root, 'supabase', 'migrations');

/**
 * Boot an in-process Postgres (PGlite) with the auth shim + all production
 * migrations applied, exactly as they ship. Lets us prove the real metric SQL.
 */
export async function bootDb(): Promise<PGlite> {
  const db = new PGlite();
  const shim = readFileSync(join(root, 'tests', 'fixtures', 'auth_shim.sql'), 'utf8');
  await db.exec(shim);

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const f of files) {
    const sql = readFileSync(join(migrationsDir, f), 'utf8');
    await db.exec(sql);
  }
  return db;
}

/** Set the JWT sub claim + role so security_invoker views + RLS apply as that user. */
export async function actAs(db: PGlite, userId: string | null, role = 'authenticated') {
  await db.exec(`set role ${role};`);
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [userId ?? '']);
}

export async function actAsSuperuser(db: PGlite) {
  await db.exec('reset role;');
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, ['']);
}
