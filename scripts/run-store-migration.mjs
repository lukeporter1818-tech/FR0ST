/**
 * One-shot script: apply the Store table migration to production.
 * Uses the pg client directly (lightweight) instead of the full Prisma CLI.
 * Run with: node scripts/run-store-migration.mjs
 *
 * DATABASE_URL must be the direct non-pooled Supabase connection (port 5432).
 */
import pg from '../node_modules/pg/lib/index.js';
const { Client } = pg;

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL is not set');
  process.exit(1);
}

// Confirm this is the direct connection (port 5432), not PgBouncer (port 6543)
if (DATABASE_URL.includes(':6543/')) {
  console.error('ERROR: DATABASE_URL points to PgBouncer (port 6543). Use the direct connection (port 5432) for migrations.');
  process.exit(1);
}

const migrationSQL = `
-- CreateTable
CREATE TABLE IF NOT EXISTS "Store" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT,
    "state" TEXT,
    "zip" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Store_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS "Store_code_key" ON "Store"("code");
`;

async function run() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  console.log('Connected to:', DATABASE_URL.replace(/:([^:@]+)@/, ':***@'));

  try {
    // Check if Store table already exists
    const { rows } = await client.query(
      `SELECT to_regclass('"Store"') AS tbl`
    );
    if (rows[0].tbl !== null) {
      console.log('"Store" table already exists — migration already applied.');
      return;
    }

    console.log('Applying migration 20260407000000_add_stores ...');
    await client.query(migrationSQL);

    // Record in _prisma_migrations so Prisma's migrate status stays consistent
    const migrationName = '20260407000000_add_stores';
    const checksum = 'manual-apply'; // placeholder; Prisma re-validates on next deploy
    await client.query(`
      INSERT INTO "_prisma_migrations"
        ("id", "checksum", "finished_at", "migration_name", "logs",
         "rolled_back_at", "started_at", "applied_steps_count")
      VALUES
        (gen_random_uuid(), $1, now(), $2, NULL, NULL, now(), 1)
      ON CONFLICT ("migration_name") DO NOTHING
    `, [checksum, migrationName]);

    console.log('✓ Migration applied successfully.');
    console.log('✓ Recorded in _prisma_migrations.');
  } finally {
    await client.end();
  }
}

run().catch(err => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
