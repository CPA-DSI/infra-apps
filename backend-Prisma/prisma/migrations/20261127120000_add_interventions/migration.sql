-- Historique des interventions du service informatique.
-- source = 'TICKET'   : créée à la fermeture d'un ticket ;
-- source = 'MANUELLE' : saisie dans la page Historique des interventions.

-- CreateEnum
CREATE TYPE "InterventionType" AS ENUM ('DEPANNAGE', 'INSTALLATION', 'PREVENTIF', 'DEMENAGEMENT', 'PRESTATAIRE', 'AUTRE');

-- CreateTable
CREATE TABLE "interventions" (
    "id_intervention" SERIAL NOT NULL,
    "date_intervention" TIMESTAMP(6) NOT NULL,
    "duree_minutes" INTEGER,
    "type" "InterventionType" NOT NULL,
    "description" TEXT NOT NULL,
    "source" VARCHAR(10) NOT NULL DEFAULT 'MANUELLE',
    "id_technicien" INTEGER,
    "nom_technicien" VARCHAR(255),
    "id_materiels" INTEGER,
    "id_n_beneficiaire" INTEGER,
    "id_ticket" INTEGER,
    "id_local" INTEGER,
    "date_suppression" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "interventions_pkey" PRIMARY KEY ("id_intervention")
);

-- CreateIndex
CREATE INDEX "interventions_date_intervention_idx" ON "interventions"("date_intervention" DESC);

-- CreateIndex
CREATE INDEX "interventions_id_technicien_idx" ON "interventions"("id_technicien");

-- CreateIndex
CREATE INDEX "interventions_id_materiels_idx" ON "interventions"("id_materiels");

-- CreateIndex
CREATE INDEX "interventions_id_ticket_idx" ON "interventions"("id_ticket");

-- AddForeignKey
ALTER TABLE "interventions" ADD CONSTRAINT "interventions_id_technicien_fkey" FOREIGN KEY ("id_technicien") REFERENCES "users"("id_n") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interventions" ADD CONSTRAINT "interventions_id_n_beneficiaire_fkey" FOREIGN KEY ("id_n_beneficiaire") REFERENCES "users"("id_n") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interventions" ADD CONSTRAINT "interventions_id_materiels_fkey" FOREIGN KEY ("id_materiels") REFERENCES "materiels"("id_materiels") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interventions" ADD CONSTRAINT "interventions_id_ticket_fkey" FOREIGN KEY ("id_ticket") REFERENCES "tickets"("id_ticket") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interventions" ADD CONSTRAINT "interventions_id_local_fkey" FOREIGN KEY ("id_local") REFERENCES "locaux"("id_local") ON DELETE SET NULL ON UPDATE CASCADE;

-- Reprise des tickets déjà fermés : une intervention par fiche de fermeture,
-- au même format que celles créées par PUT /api/tickets/:id/close
-- (services/interventionService.js > interventionDepuisFermeture).
INSERT INTO "interventions" (
    "date_intervention", "duree_minutes", "type", "description", "source",
    "id_technicien", "nom_technicien", "id_materiels", "id_n_beneficiaire",
    "id_ticket", "id_local", "created_at", "updated_at"
)
SELECT
    tf."date_fermeture",
    tf."duree_resolution",
    'DEPANNAGE',
    t."titre" || E'\nSolution : ' || tf."solution",
    'TICKET',
    tf."ferme_par",
    CASE WHEN tech."utilisateur" IS NOT NULL THEN tf."ferme_par" || ' - ' || tech."utilisateur"
         ELSE 'N°' || tf."ferme_par" END,
    t."id_materiels",
    t."id_n_demandeur",
    t."id_ticket",
    mat."id_local",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "tickets_fermeture" tf
JOIN "tickets" t ON t."id_ticket" = tf."ticket_id"
LEFT JOIN "materiels" tech ON tech."id_n" = tf."ferme_par"
LEFT JOIN "materiels" mat ON mat."id_materiels" = t."id_materiels"
ORDER BY tf."date_fermeture";
