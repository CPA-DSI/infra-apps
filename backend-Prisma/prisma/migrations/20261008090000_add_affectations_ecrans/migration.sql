-- CreateTable
CREATE TABLE "ecrans" (
    "id_ecran" SERIAL NOT NULL,
    "code_ecran" VARCHAR(200) NOT NULL,
    "modele" VARCHAR(200),
    "date_ecran" DATE,
    "statut" VARCHAR(20) NOT NULL DEFAULT 'AFFECTE',
    "id_materiels" INTEGER,
    "commentaire" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "ecrans_pkey" PRIMARY KEY ("id_ecran")
);

-- CreateTable
CREATE TABLE "affectations_materiels" (
    "id_affectation" SERIAL NOT NULL,
    "type_affectation" VARCHAR(10) NOT NULL,
    "id_materiels" INTEGER,
    "id_ecran" INTEGER,
    "id_n" INTEGER,
    "nom_utilisateur" VARCHAR(255),
    "date_debut" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "date_fin" TIMESTAMP(6),
    "motif" VARCHAR(255),
    "etat_remise" VARCHAR(200),
    "commentaire" TEXT,
    "affecte_par" INTEGER,
    "nom_affecte_par" VARCHAR(255),

    CONSTRAINT "affectations_materiels_pkey" PRIMARY KEY ("id_affectation")
);

-- CreateIndex
CREATE UNIQUE INDEX "ecrans_code_ecran_key" ON "ecrans"("code_ecran");

-- CreateIndex
CREATE UNIQUE INDEX "ecrans_id_materiels_key" ON "ecrans"("id_materiels");

-- CreateIndex
CREATE INDEX "affectations_materiels_id_materiels_idx" ON "affectations_materiels"("id_materiels");

-- CreateIndex
CREATE INDEX "affectations_materiels_id_ecran_idx" ON "affectations_materiels"("id_ecran");

-- CreateIndex
CREATE INDEX "affectations_materiels_id_n_idx" ON "affectations_materiels"("id_n");

-- CreateIndex
CREATE INDEX "affectations_materiels_date_debut_idx" ON "affectations_materiels"("date_debut" DESC);

-- AddForeignKey
ALTER TABLE "ecrans" ADD CONSTRAINT "ecrans_id_materiels_fkey" FOREIGN KEY ("id_materiels") REFERENCES "materiels"("id_materiels") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affectations_materiels" ADD CONSTRAINT "affectations_materiels_id_materiels_fkey" FOREIGN KEY ("id_materiels") REFERENCES "materiels"("id_materiels") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affectations_materiels" ADD CONSTRAINT "affectations_materiels_id_ecran_fkey" FOREIGN KEY ("id_ecran") REFERENCES "ecrans"("id_ecran") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affectations_materiels" ADD CONSTRAINT "affectations_materiels_id_n_fkey" FOREIGN KEY ("id_n") REFERENCES "users"("id_n") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affectations_materiels" ADD CONSTRAINT "affectations_materiels_affecte_par_fkey" FOREIGN KEY ("affecte_par") REFERENCES "users"("id_n") ON DELETE SET NULL ON UPDATE CASCADE;

-- ──────────────────────────────────────────────
-- Contraintes non représentables dans schema.prisma
-- ──────────────────────────────────────────────

-- Une affectation PC porte sur un poste (jamais sur un écran) ; une
-- affectation ECRAN porte toujours sur un écran (le poste d'accueil est
-- facultatif : null = écran en stock / réparation / réformé).
ALTER TABLE "affectations_materiels" ADD CONSTRAINT "affectations_materiels_type_check" CHECK (
    ("type_affectation" = 'PC' AND "id_materiels" IS NOT NULL AND "id_ecran" IS NULL)
    OR ("type_affectation" = 'ECRAN' AND "id_ecran" IS NOT NULL)
);

ALTER TABLE "ecrans" ADD CONSTRAINT "ecrans_statut_check" CHECK (
    "statut" IN ('EN_STOCK', 'AFFECTE', 'EN_REPARATION', 'REFORME')
);

-- Une seule affectation en cours (date_fin IS NULL) par PC et par écran.
-- Voir services/affectationService.js, qui ferme l'affectation en cours
-- avant d'en ouvrir une nouvelle dans la même transaction.
CREATE UNIQUE INDEX "affectations_materiels_pc_en_cours_key"
ON "affectations_materiels" ("id_materiels")
WHERE "type_affectation" = 'PC' AND "date_fin" IS NULL;

CREATE UNIQUE INDEX "affectations_materiels_ecran_en_cours_key"
ON "affectations_materiels" ("id_ecran")
WHERE "type_affectation" = 'ECRAN' AND "date_fin" IS NULL;

-- ──────────────────────────────────────────────
-- Reprise des données existantes
-- ──────────────────────────────────────────────

-- Un écran par fiche dont le code écran est renseigné. Échoue volontairement
-- (violation de ecrans_code_ecran_key) si deux fiches partagent le même code :
-- à vérifier avant déploiement avec
--   SELECT trim(code_ecran), COUNT(*) FROM materiels
--   WHERE code_ecran IS NOT NULL AND trim(code_ecran) <> ''
--   GROUP BY trim(code_ecran) HAVING COUNT(*) > 1;
INSERT INTO "ecrans" ("code_ecran", "modele", "date_ecran", "statut", "id_materiels", "updated_at")
SELECT trim("code_ecran"), "ecran", "date_ecran", 'AFFECTE', "id_materiels", CURRENT_TIMESTAMP
FROM "materiels"
WHERE "code_ecran" IS NOT NULL AND trim("code_ecran") <> '';

-- Affectation PC en cours pour chaque fiche existante.
INSERT INTO "affectations_materiels" ("type_affectation", "id_materiels", "id_n", "nom_utilisateur", "date_debut", "motif")
SELECT 'PC', "id_materiels", "id_n", "utilisateur", COALESCE("date_pc"::timestamp, CURRENT_TIMESTAMP), 'Reprise initiale'
FROM "materiels";

-- Affectation écran en cours pour chaque écran repris.
INSERT INTO "affectations_materiels" ("type_affectation", "id_ecran", "id_materiels", "id_n", "nom_utilisateur", "date_debut", "motif")
SELECT 'ECRAN', e."id_ecran", e."id_materiels", m."id_n", m."utilisateur", COALESCE(e."date_ecran"::timestamp, CURRENT_TIMESTAMP), 'Reprise initiale'
FROM "ecrans" e
JOIN "materiels" m ON m."id_materiels" = e."id_materiels";
