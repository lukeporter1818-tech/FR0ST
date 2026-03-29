-- Add invite token fields and activation flag to User
-- isActivated defaults TRUE so all existing users remain fully accessible
ALTER TABLE "User" ADD COLUMN "inviteTokenHash"  TEXT;
ALTER TABLE "User" ADD COLUMN "inviteExpiresAt"  TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "isActivated"      BOOLEAN NOT NULL DEFAULT true;
