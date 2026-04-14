-- Add isFloater column to BoardEntry
ALTER TABLE "BoardEntry" ADD COLUMN IF NOT EXISTS "isFloater" BOOLEAN NOT NULL DEFAULT false;
