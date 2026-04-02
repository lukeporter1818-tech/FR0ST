-- Add PM (Preventive Maintenance) to the BoardStatus enum.
-- ALTER TYPE ... ADD VALUE is safe and non-destructive in PostgreSQL.
-- Existing rows are unaffected; no data migration required.
ALTER TYPE "BoardStatus" ADD VALUE IF NOT EXISTS 'PM';
