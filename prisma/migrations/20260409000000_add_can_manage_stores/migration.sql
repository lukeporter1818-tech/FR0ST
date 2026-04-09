-- Add feature-specific permission for Store management.
-- Allows granting Store create/update/delete to selected users
-- without broadening general ADMIN access.
ALTER TABLE "User" ADD COLUMN "canManageStores" BOOLEAN NOT NULL DEFAULT false;
