-- Postes déjà en stock (sans bénéficiaire) : inactifs, état « Stock »
UPDATE "materiels"
SET "est_actif" = false, "etat_pc" = 'Stock'
WHERE "id_n" IS NULL AND "date_suppression" IS NULL AND "est_vide" = false;

-- Postes vides déjà créés : inactifs, état « Sans poste »
UPDATE "materiels"
SET "est_actif" = false, "etat_pc" = 'Sans poste'
WHERE "est_vide" = true AND "date_suppression" IS NULL;
