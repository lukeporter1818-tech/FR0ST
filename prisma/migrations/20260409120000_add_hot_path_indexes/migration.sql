-- Add hot-path indexes for scale safety
--
-- Job [status, priority, createdAt]
--   Supports: jobs/page.tsx — filters by status/priority, sorts priority DESC, createdAt DESC
CREATE INDEX IF NOT EXISTS "Job_status_priority_createdAt_idx" ON "Job"("status", "priority", "createdAt");

-- Job [lat, lng]
--   Supports: map/page.tsx — WHERE lat IS NOT NULL AND lng IS NOT NULL AND status IN (...)
CREATE INDEX IF NOT EXISTS "Job_lat_lng_idx" ON "Job"("lat", "lng");

-- BoardEntry [date]
--   Supports: schedule/page, map/page, overview/page, board actions — all filter solely by date.
--   The existing @@unique([technicianId, date]) and @@unique([manualName, date]) have date as the
--   trailing column and do not serve date-only scans.
CREATE INDEX IF NOT EXISTS "BoardEntry_date_idx" ON "BoardEntry"("date");

-- ChatMessage [channel, createdAt]
--   Supports: api/chat — WHERE channel = ? [AND createdAt > ?] ORDER BY createdAt ASC
CREATE INDEX IF NOT EXISTS "ChatMessage_channel_createdAt_idx" ON "ChatMessage"("channel", "createdAt");
