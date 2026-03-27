-- AlterTable: add Frost learning fields to AIInteraction
ALTER TABLE "AIInteraction" ADD COLUMN "feedback" TEXT;
ALTER TABLE "AIInteraction" ADD COLUMN "actualFix" TEXT;
ALTER TABLE "AIInteraction" ADD COLUMN "issueSummary" TEXT;
ALTER TABLE "AIInteraction" ADD COLUMN "systemType" TEXT;
ALTER TABLE "AIInteraction" ADD COLUMN "approved" BOOLEAN NOT NULL DEFAULT false;
