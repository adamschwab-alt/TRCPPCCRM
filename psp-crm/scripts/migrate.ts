/**
 * Minimal migration runner. Applies supabase/migrations/*.sql in order against
 * DATABASE_URL, tracking applied files in `_migrations`. Idempotent.
 *
 *   npm run db:migrate          apply pending migrations
 *   npm run db:reset            drop & recreate the public schema, then apply all
 *
 * (You can also use the Supabase CLI: `supabase db push`. Both read the same
 * migrations folder.)
 */
import { config } from 'dotenv';
config({ path: ['.env.local', '.env'] });
import { Client } from 'pg';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, '..', 'supabase', 'migrations');

async function main() {
  const reset = process.argv.includes('--reset');
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not set (see .env.example).');

  const client = new Client({ connectionString });
  await client.connect();
  try {
    if (reset) {
      console.warn('⚠️  --reset: dropping and recreating schema public');
      await client.query('drop schema if exists public cascade; create schema public;');
      await client.query('grant usage on schema public to anon, authenticated;');
    }

    await client.query(`
      create table if not exists _migrations (
        name text primary key,
        applied_at timestamptz not null default now()
      );
    `);
    const applied = new Set(
      (await client.query<{ name: string }>('select name from _migrations')).rows.map(
        (r) => r.name,
      ),
    );

    const files = readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();
    let count = 0;
    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = readFileSync(join(migrationsDir, file), 'utf8');
      process.stdout.write(`→ applying ${file} ... `);
      await client.query('begin');
      try {
        await client.query(sql);
        await client.query('insert into _migrations (name) values ($1)', [file]);
        await client.query('commit');
        console.log('ok');
        count++;
      } catch (e) {
        await client.query('rollback');
        throw e;
      }
    }
    console.log(
      count === 0 ? 'Up to date — no pending migrations.' : `Applied ${count} migration(s).`,
    );
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error('Migration failed:', e instanceof Error ? e.message : e);
  process.exit(1);
});
