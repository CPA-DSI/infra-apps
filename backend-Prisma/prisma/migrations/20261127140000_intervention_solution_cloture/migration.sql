-- Solution partagée entre ticket et intervention.
--  - solution       : solution apportée (auparavant collée dans la description
--                     sous la forme "titre\nSolution : …" pour les interventions issues d'un ticket) ;
--  - cloture_ticket : intervention qui a clôturé le ticket lié. Sa solution, sa
--                     durée et sa date sont recopiées dans tickets_fermeture.

-- AlterTable
ALTER TABLE "interventions" ADD COLUMN "solution" TEXT;
ALTER TABLE "interventions" ADD COLUMN "cloture_ticket" BOOLEAN NOT NULL DEFAULT false;

-- Reprise : sépare la solution de la description ("\nSolution : " = 12 caractères)
UPDATE "interventions"
SET "solution"    = substr("description", position(E'\nSolution : ' IN "description") + 12),
    "description" = substr("description", 1, position(E'\nSolution : ' IN "description") - 1)
WHERE "source" = 'TICKET'
  AND position(E'\nSolution : ' IN "description") > 0;

-- Reprise : l'intervention active la plus récente de chaque ticket encore fermé
-- devient son intervention de clôture.
UPDATE "interventions" i
SET "cloture_ticket" = true
FROM (
    SELECT DISTINCT ON (it."id_ticket") it."id_intervention"
    FROM "interventions" it
    JOIN "tickets_fermeture" tf ON tf."ticket_id" = it."id_ticket"
    WHERE it."source" = 'TICKET' AND it."date_suppression" IS NULL
    ORDER BY it."id_ticket", it."date_intervention" DESC, it."id_intervention" DESC
) derniere
WHERE i."id_intervention" = derniere."id_intervention";

-- Une seule intervention de clôture active par ticket
-- (index partiel, non représentable dans schema.prisma).
CREATE UNIQUE INDEX "interventions_cloture_ticket_unique"
    ON "interventions" ("id_ticket")
    WHERE "cloture_ticket" AND "date_suppression" IS NULL;
