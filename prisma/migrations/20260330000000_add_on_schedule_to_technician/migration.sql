-- Add onSchedule flag to Technician for persistent schedule roster management.
-- All existing active technicians default to true (on the roster).
ALTER TABLE "Technician" ADD COLUMN "onSchedule" BOOLEAN NOT NULL DEFAULT true;
