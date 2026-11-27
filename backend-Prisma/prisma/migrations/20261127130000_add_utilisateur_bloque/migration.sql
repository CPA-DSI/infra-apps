-- Case « L'utilisateur n'a pas pu travailler » sur les interventions.
-- Les interventions existantes sont considérées comme non bloquantes.
ALTER TABLE "interventions" ADD COLUMN "utilisateur_bloque" BOOLEAN NOT NULL DEFAULT false;
