-- etat_pc ne porte plus que l'état physique du PC (Très Bon ... HS). Le
-- statut se déduit de l'affectation : est_vide => « Sans poste »,
-- id_n NULL => « Stock », sinon « Affecté ».

-- Anciennes saisies « Sans poste » sur une fiche sans PC (ni code PC ni
-- caractéristiques) et avec un utilisateur : deviennent de vraies fiches vides.
UPDATE "materiels"
SET "est_vide" = true, "est_actif" = false
WHERE "etat_pc" = 'Sans poste' AND "est_vide" = false AND "id_n" IS NOT NULL
  AND COALESCE(TRIM("code_pc"), '') = ''
  AND COALESCE(TRIM("caracteristiques"), '') IN ('', 'Non spécifié');

-- Fiches vides : pas de PC, donc pas d'état physique.
UPDATE "materiels" SET "etat_pc" = NULL WHERE "est_vide" = true;

-- PC dont l'état était un statut : état physique inconnu (« Non défini »
-- dans l'interface), à requalifier.
UPDATE "materiels"
SET "etat_pc" = NULL
WHERE "etat_pc" IN ('Stock', 'Sans poste', 'Disponible');
