/*
  Warnings:

  - You are about to drop the column `id_produit` on the `documents` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "documents" DROP CONSTRAINT "documents_id_produit_fkey";

-- DropIndex
DROP INDEX "documents_id_produit_idx";

-- AlterTable
ALTER TABLE "documents" DROP COLUMN "id_produit";

-- CreateTable
CREATE TABLE "produits_documents" (
    "id" SERIAL NOT NULL,
    "id_produit" INTEGER NOT NULL,
    "id_document" INTEGER NOT NULL,

    CONSTRAINT "produits_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pieces_jointes" (
    "id" SERIAL NOT NULL,
    "id_document" INTEGER NOT NULL,
    "nom_fichier" VARCHAR(255) NOT NULL,
    "chemin_stockage" TEXT NOT NULL,
    "taille" INTEGER,
    "type_mime" VARCHAR(100),
    "date_upload" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pieces_jointes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "produits_documents_id_produit_id_document_key" ON "produits_documents"("id_produit", "id_document");

-- CreateIndex
CREATE UNIQUE INDEX "pieces_jointes_chemin_stockage_key" ON "pieces_jointes"("chemin_stockage");

-- CreateIndex
CREATE INDEX "pieces_jointes_id_document_idx" ON "pieces_jointes"("id_document");

-- AddForeignKey
ALTER TABLE "produits_documents" ADD CONSTRAINT "produits_documents_id_document_fkey" FOREIGN KEY ("id_document") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "produits_documents" ADD CONSTRAINT "produits_documents_id_produit_fkey" FOREIGN KEY ("id_produit") REFERENCES "produits"("id_produit") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pieces_jointes" ADD CONSTRAINT "pieces_jointes_id_document_fkey" FOREIGN KEY ("id_document") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
