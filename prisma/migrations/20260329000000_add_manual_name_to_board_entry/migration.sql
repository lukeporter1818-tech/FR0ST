-- Make technicianId optional (manual-name rows have no linked technician)
ALTER TABLE "BoardEntry" ALTER COLUMN "technicianId" DROP NOT NULL;

-- Add manualName for display-only rows not linked to a Technician account
ALTER TABLE "BoardEntry" ADD COLUMN "manualName" TEXT;

-- Drop old FK (was RESTRICT; re-add as SET NULL so deleting a tech nulls their board rows)
ALTER TABLE "BoardEntry" DROP CONSTRAINT "BoardEntry_technicianId_fkey";
ALTER TABLE "BoardEntry" ADD CONSTRAINT "BoardEntry_technicianId_fkey"
  FOREIGN KEY ("technicianId") REFERENCES "Technician"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Unique index: prevent duplicate manual names on the same date
-- NULL values are considered distinct in Postgres so linked rows (manualName=NULL) won't conflict
CREATE UNIQUE INDEX "BoardEntry_manualName_date_key" ON "BoardEntry"("manualName", "date");
