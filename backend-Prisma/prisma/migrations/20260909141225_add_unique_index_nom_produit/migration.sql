-- Empêche les doublons de produits (insensibles à la casse et aux espaces
-- superflus) au niveau base de données. Non représentable directement dans
-- schema.prisma (index sur expression) : géré ici en SQL brut.
-- Voir backend-Prisma/services/importMouvements.js (getProduit) pour la
-- logique applicative qui s'appuie sur cette contrainte (catch P2002).
CREATE UNIQUE INDEX "produits_nom_produit_norm_key"
ON "produits" (lower(trim("nom_produit")));
