-- Empêche les doublons de locaux (insensibles à la casse et aux espaces
-- superflus) au niveau base de données, sur le même principe que
-- produits_nom_produit_norm_key. Voir backend-Prisma/routes/import.js
-- (getOrCreateLocalId) pour la logique applicative qui s'appuie sur cette
-- contrainte (catch P2002).
CREATE UNIQUE INDEX "locaux_nom_local_norm_key"
ON "locaux" (lower(trim("nom_local")));

-- Séquence dédiée à la génération d'un id_n (matricule) quand l'import ne
-- fournit pas de matricule Excel. Remplace le calcul applicatif
-- MAX(id_n)+1 (non atomique, sujet aux races entre imports concurrents)
-- par un compteur géré par la base de données. Voir
-- backend-Prisma/routes/import.js (generateIdN).
CREATE SEQUENCE IF NOT EXISTS "users_id_n_auto_seq" START 1000;

-- Aligne la séquence sur le plus grand id_n déjà utilisé, pour éviter de
-- régénérer inutilement des valeurs déjà prises par des matricules réels.
SELECT setval('users_id_n_auto_seq', GREATEST(1000, (SELECT COALESCE(MAX(id_n), 999) FROM "users")));
