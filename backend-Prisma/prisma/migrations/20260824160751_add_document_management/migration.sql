-- CreateEnum
CREATE TYPE "DocumentCategory" AS ENUM ('FACTURE', 'CONTRAT_MAINTENANCE', 'GARANTIE', 'MANUEL_TECHNIQUE', 'SCHEMA_RESEAU', 'LICENCE_LOGICIELLE', 'BON_LIVRAISON', 'RAPPORT_AUDIT', 'AUTRE');

-- DropForeignKey
ALTER TABLE "materiels" DROP CONSTRAINT "materiels_id_n_fkey";

-- CreateTable
CREATE TABLE "documents" (
    "id" SERIAL NOT NULL,
    "nom_fichier" VARCHAR(255) NOT NULL,
    "chemin_stockage" TEXT NOT NULL,
    "taille" INTEGER,
    "type_mime" VARCHAR(100),
    "categorie" "DocumentCategory" NOT NULL DEFAULT 'AUTRE',
    "description" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "est_public" BOOLEAN NOT NULL DEFAULT false,
    "id_materiels" INTEGER,
    "id_ticket" INTEGER,
    "id_produit" INTEGER,
    "id_marque" INTEGER,
    "upload_par" INTEGER NOT NULL,
    "date_upload" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "derniere_modif" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents_acces" (
    "id" SERIAL NOT NULL,
    "id_document" INTEGER NOT NULL,
    "id_utilisateur" INTEGER NOT NULL,
    "date_acces" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "action" VARCHAR(50) NOT NULL,

    CONSTRAINT "documents_acces_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "documents_chemin_stockage_key" ON "documents"("chemin_stockage");

-- CreateIndex
CREATE INDEX "documents_id_materiels_idx" ON "documents"("id_materiels");

-- CreateIndex
CREATE INDEX "documents_id_ticket_idx" ON "documents"("id_ticket");

-- CreateIndex
CREATE INDEX "documents_id_produit_idx" ON "documents"("id_produit");

-- CreateIndex
CREATE INDEX "documents_id_marque_idx" ON "documents"("id_marque");

-- CreateIndex
CREATE INDEX "documents_upload_par_idx" ON "documents"("upload_par");

-- CreateIndex
CREATE INDEX "documents_date_upload_idx" ON "documents"("date_upload" DESC);

-- CreateIndex
CREATE INDEX "documents_acces_id_document_idx" ON "documents_acces"("id_document");

-- CreateIndex
CREATE INDEX "documents_acces_id_utilisateur_idx" ON "documents_acces"("id_utilisateur");

-- CreateIndex
CREATE INDEX "documents_acces_date_acces_idx" ON "documents_acces"("date_acces" DESC);

-- AddForeignKey
ALTER TABLE "materiels" ADD CONSTRAINT "materiels_id_n_fkey" FOREIGN KEY ("id_n") REFERENCES "users"("id_n") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_id_materiels_fkey" FOREIGN KEY ("id_materiels") REFERENCES "materiels"("id_materiels") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_id_ticket_fkey" FOREIGN KEY ("id_ticket") REFERENCES "tickets"("id_ticket") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_id_produit_fkey" FOREIGN KEY ("id_produit") REFERENCES "produits"("id_produit") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_id_marque_fkey" FOREIGN KEY ("id_marque") REFERENCES "marques"("id_marque") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_upload_par_fkey" FOREIGN KEY ("upload_par") REFERENCES "users"("id_n") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents_acces" ADD CONSTRAINT "documents_acces_id_document_fkey" FOREIGN KEY ("id_document") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents_acces" ADD CONSTRAINT "documents_acces_id_utilisateur_fkey" FOREIGN KEY ("id_utilisateur") REFERENCES "users"("id_n") ON DELETE RESTRICT ON UPDATE CASCADE;
