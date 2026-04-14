-- Add equipment field to Store
ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "equipment" TEXT;
