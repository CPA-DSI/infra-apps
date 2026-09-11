-- DropForeignKey
ALTER TABLE "documents" DROP CONSTRAINT "documents_id_materiels_fkey";

-- DropForeignKey
ALTER TABLE "documents" DROP CONSTRAINT "documents_id_produit_fkey";

-- DropForeignKey
ALTER TABLE "documents" DROP CONSTRAINT "documents_id_ticket_fkey";

-- AlterTable
ALTER TABLE "materiels" ADD COLUMN     "date_suppression" TIMESTAMP(6),
ADD COLUMN     "est_actif" BOOLEAN NOT NULL DEFAULT true;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_id_materiels_fkey" FOREIGN KEY ("id_materiels") REFERENCES "materiels"("id_materiels") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_id_ticket_fkey" FOREIGN KEY ("id_ticket") REFERENCES "tickets"("id_ticket") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_id_produit_fkey" FOREIGN KEY ("id_produit") REFERENCES "produits"("id_produit") ON DELETE SET NULL ON UPDATE CASCADE;
