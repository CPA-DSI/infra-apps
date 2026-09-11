/*
  Warnings:

  - You are about to drop the column `id_materiels` on the `documents` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "documents" DROP CONSTRAINT "documents_id_materiels_fkey";

-- DropIndex
DROP INDEX "documents_id_materiels_idx";

-- AlterTable
ALTER TABLE "documents" DROP COLUMN "id_materiels";

-- CreateTable
CREATE TABLE "materiels_documents" (
    "id" SERIAL NOT NULL,
    "id_materiels" INTEGER NOT NULL,
    "id_document" INTEGER NOT NULL,

    CONSTRAINT "materiels_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "materiels_documents_id_materiels_id_document_key" ON "materiels_documents"("id_materiels", "id_document");

-- AddForeignKey
ALTER TABLE "materiels_documents" ADD CONSTRAINT "materiels_documents_id_materiels_fkey" FOREIGN KEY ("id_materiels") REFERENCES "materiels"("id_materiels") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materiels_documents" ADD CONSTRAINT "materiels_documents_id_document_fkey" FOREIGN KEY ("id_document") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
