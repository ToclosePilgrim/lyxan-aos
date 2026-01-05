/*
  Warnings:

  - The values [PLANNED,IN_PROGRESS,RECEIVED] on the enum `ScmComponentProvisionStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "ScmComponentProvisionStatus_new" AS ENUM ('NOT_PLANNED', 'PLANNED_SUPPLY', 'PLANNED_TRANSFER', 'PARTIALLY_PROVIDED', 'PROVIDED', 'NOT_PROVIDED');
ALTER TABLE "public"."production_order_items" ALTER COLUMN "provisionStatus" DROP DEFAULT;
ALTER TABLE "production_order_items" ALTER COLUMN "provisionStatus" TYPE "ScmComponentProvisionStatus_new" USING ("provisionStatus"::text::"ScmComponentProvisionStatus_new");
ALTER TYPE "ScmComponentProvisionStatus" RENAME TO "ScmComponentProvisionStatus_old";
ALTER TYPE "ScmComponentProvisionStatus_new" RENAME TO "ScmComponentProvisionStatus";
DROP TYPE "public"."ScmComponentProvisionStatus_old";
ALTER TABLE "production_order_items" ALTER COLUMN "provisionStatus" SET DEFAULT 'NOT_PLANNED';
COMMIT;
