CREATE TABLE "PersonalLog" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "data" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PersonalLog_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PersonalLog_userId_type_key_key" ON "PersonalLog"("userId", "type", "key");
