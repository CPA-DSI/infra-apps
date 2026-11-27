-- L'état « Disponible » est retiré : il était posé par la bascule Inactif, par
-- défaut à l'import, ou à la main, sans dire où était le PC ni dans quel état.
-- PC sans bénéficiaire : en stock (mêmes valeurs que la mise en stock).
UPDATE "materiels"
SET "etat_pc" = 'Stock', "est_actif" = false
WHERE "etat_pc" = 'Disponible' AND "id_n" IS NULL AND "est_vide" = false;

-- PC affecté : l'état physique réel est perdu, on reprend la valeur
-- « remis en service » (Bon). À requalifier au besoin.
UPDATE "materiels"
SET "etat_pc" = 'Bon'
WHERE "etat_pc" = 'Disponible' AND "id_n" IS NOT NULL AND "est_vide" = false;

-- Fiche vide restée en « Disponible » : « Sans poste ».
UPDATE "materiels"
SET "etat_pc" = 'Sans poste'
WHERE "etat_pc" = 'Disponible' AND "est_vide" = true;
