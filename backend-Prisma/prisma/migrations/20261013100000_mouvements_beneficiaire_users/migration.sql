-- mouvements.id_materiels contient le matricule du bénéficiaire. Il référençait
-- materiels.id_n (ON UPDATE CASCADE) : mettre un PC en stock ou supprimer une
-- fiche « Sans poste » remettait ce matricule à NULL et détachait les
-- mouvements de l'utilisateur. Il référence désormais users.id_n, qui ne
-- change pas avec les fiches matériels.

-- Garde-fou : un matricule sans utilisateur ferait échouer la contrainte.
UPDATE "mouvements" m
SET "id_materiels" = NULL
WHERE m."id_materiels" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "users" u WHERE u."id_n" = m."id_materiels");

ALTER TABLE "mouvements" DROP CONSTRAINT "mouvements_id_materiels_fkey";

ALTER TABLE "mouvements" ADD CONSTRAINT "mouvements_id_materiels_fkey" FOREIGN KEY ("id_materiels") REFERENCES "users"("id_n") ON DELETE SET NULL ON UPDATE CASCADE;
