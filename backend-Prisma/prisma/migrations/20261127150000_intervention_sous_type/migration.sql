-- Sous-type des interventions de type Dépannage / Installation (liste validée
-- par la DSI, contrôlée par l'API). Les interventions existantes restent sans
-- sous-type (« non précisé »).
ALTER TABLE "interventions" ADD COLUMN "sous_type" VARCHAR(40);
