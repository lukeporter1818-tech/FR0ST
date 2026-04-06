-- Add geocoded coordinate fields to Job
-- These are populated once on job create/update via Nominatim geocoding.
-- Never re-geocoded unless the address changes.
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "lat" DOUBLE PRECISION;
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "lng" DOUBLE PRECISION;
