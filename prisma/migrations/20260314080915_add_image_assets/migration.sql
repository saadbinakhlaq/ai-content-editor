/*
  Warnings:

  - The values [PROCESSING] on the enum `GenerationStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('IMAGE');

-- AlterEnum
BEGIN;
CREATE TYPE "GenerationStatus_new" AS ENUM ('QUEUED', 'PROCESSING_TEXT', 'PROCESSING_IMAGES', 'COMPLETED', 'FAILED');
ALTER TABLE "public"."GenerationRun" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "GenerationRun" ALTER COLUMN "status" TYPE "GenerationStatus_new" USING ("status"::text::"GenerationStatus_new");
ALTER TYPE "GenerationStatus" RENAME TO "GenerationStatus_old";
ALTER TYPE "GenerationStatus_new" RENAME TO "GenerationStatus";
DROP TYPE "public"."GenerationStatus_old";
ALTER TABLE "GenerationRun" ALTER COLUMN "status" SET DEFAULT 'QUEUED';
COMMIT;

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "generationRunId" TEXT NOT NULL,
    "sceneId" TEXT,
    "type" "AssetType" NOT NULL,
    "storagePath" TEXT NOT NULL,
    "publicUrl" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'image/png',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Asset_generationRunId_type_idx" ON "Asset"("generationRunId", "type");

-- CreateIndex
CREATE INDEX "Asset_sceneId_idx" ON "Asset"("sceneId");

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_generationRunId_fkey" FOREIGN KEY ("generationRunId") REFERENCES "GenerationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "Scene"("id") ON DELETE CASCADE ON UPDATE CASCADE;
