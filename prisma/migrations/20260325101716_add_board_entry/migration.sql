-- CreateEnum
CREATE TYPE "BoardStatus" AS ENUM ('ASSIGNED', 'EN_ROUTE', 'ON_SITE', 'WAITING', 'PARTS', 'DONE', 'OUT');

-- CreateTable
CREATE TABLE "BoardEntry" (
    "id" TEXT NOT NULL,
    "technicianId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "assignment" TEXT NOT NULL,
    "note" TEXT,
    "status" "BoardStatus",
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BoardEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BoardEntry_technicianId_date_key" ON "BoardEntry"("technicianId", "date");

-- AddForeignKey
ALTER TABLE "BoardEntry" ADD CONSTRAINT "BoardEntry_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "Technician"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
