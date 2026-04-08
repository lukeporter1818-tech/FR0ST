/**
 * ONE-SHOT migration endpoint — DELETE THIS FILE after the Store table is created.
 * POST /api/migrate-stores?secret=frost-migrate-stores-one-shot
 */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

const SECRET = 'frost-migrate-stores-one-shot'

export async function POST(req: Request) {
  const url = new URL(req.url)
  if (url.searchParams.get('secret') !== SECRET) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const results: string[] = []

  try {
    // Check if Store table already exists
    const existing = await prisma.$queryRawUnsafe<{ tbl: string | null }[]>(
      `SELECT to_regclass('"Store"') AS tbl`
    )
    if (existing[0]?.tbl !== null) {
      return NextResponse.json({ alreadyExists: true, message: 'Store table already exists — migration already applied.' })
    }

    // Create table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE "Store" (
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
      )
    `)
    results.push('Store table created')

    // Create unique index
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX "Store_code_key" ON "Store"("code")`
    )
    results.push('Store_code_key index created')

    // Record in _prisma_migrations (best-effort — table may not exist on db-push setups)
    try {
      await prisma.$executeRawUnsafe(`
        INSERT INTO "_prisma_migrations"
          ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
        SELECT gen_random_uuid()::text, 'api-applied', now(), '20260407000000_add_stores', NULL, NULL, now(), 1
        WHERE NOT EXISTS (
          SELECT 1 FROM "_prisma_migrations" WHERE "migration_name" = '20260407000000_add_stores'
        )
      `)
      results.push('Recorded in _prisma_migrations')
    } catch {
      results.push('_prisma_migrations record skipped (table may not exist)')
    }

    return NextResponse.json({ success: true, results })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err), results }, { status: 500 })
  }
}
