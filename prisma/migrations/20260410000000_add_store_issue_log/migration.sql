-- Store Issue Log
-- Conversational memory layer for FR0ST. Technicians describe fixes to FR0ST
-- and the AI logs them here so future techs can recall past issues at a store.

CREATE TABLE IF NOT EXISTS "StoreIssueLog" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "reportedById" TEXT NOT NULL,
    "systemType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "resolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreIssueLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "StoreIssueLog_storeId_createdAt_idx"
    ON "StoreIssueLog"("storeId", "createdAt");

ALTER TABLE "StoreIssueLog"
    ADD CONSTRAINT "StoreIssueLog_storeId_fkey"
    FOREIGN KEY ("storeId") REFERENCES "Store"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StoreIssueLog"
    ADD CONSTRAINT "StoreIssueLog_reportedById_fkey"
    FOREIGN KEY ("reportedById") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
