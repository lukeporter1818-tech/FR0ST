-- Add emergency priority flag to board entries
ALTER TABLE "BoardEntry" ADD COLUMN "isEmergency" BOOLEAN NOT NULL DEFAULT false;
