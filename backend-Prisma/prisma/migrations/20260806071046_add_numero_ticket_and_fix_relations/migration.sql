-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN_DSI', 'DIRECTION');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('NOUVEAU', 'EN_COURS', 'RESOLU', 'FERME');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('BASSE', 'MOYENNE', 'HAUTE', 'URGENTE');

-- CreateTable
CREATE TABLE "users" (
    "id_user" SERIAL NOT NULL,
    "id_n" INTEGER NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id_user")
);

-- CreateTable
CREATE TABLE "user_emails" (
    "id_uEmail" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "pass_mail" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "user_id" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "user_emails_pkey" PRIMARY KEY ("id_uEmail")
);

-- CreateTable
CREATE TABLE "materiels" (
    "id_materiels" SERIAL NOT NULL,
    "utilisateur" VARCHAR(255) NOT NULL,
    "id_n" INTEGER,
    "equipe" VARCHAR(200) NOT NULL,
    "date_pc" DATE,
    "date_ecran" DATE,
    "caracteristiques" TEXT NOT NULL,
    "code_pc" VARCHAR(200),
    "ecran" VARCHAR(200),
    "code_ecran" VARCHAR(200),
    "hdmi" BOOLEAN,
    "clavier" BOOLEAN,
    "lan" BOOLEAN,
    "usb" BOOLEAN,
    "etat_pc" VARCHAR(200),
    "salle" VARCHAR(200),
    "mdp_pc" VARCHAR(200),
    "mdp_admin" VARCHAR(200),
    "etat_batterie" VARCHAR(200),
    "commentaire" TEXT,
    "id_marque" INTEGER,
    "date_modification" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "id_local" INTEGER,

    CONSTRAINT "materiels_pkey" PRIMARY KEY ("id_materiels")
);

-- CreateTable
CREATE TABLE "marques" (
    "id_marque" SERIAL NOT NULL,
    "nom_marque" VARCHAR(100) NOT NULL,
    "url" TEXT,
    "date_modification" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marque_pkey" PRIMARY KEY ("id_marque")
);

-- CreateTable
CREATE TABLE "locaux" (
    "id_local" SERIAL NOT NULL,
    "nom_local" VARCHAR(200),
    "description" TEXT,

    CONSTRAINT "locaux_pkey" PRIMARY KEY ("id_local")
);

-- CreateTable
CREATE TABLE "tickets" (
    "id_ticket" SERIAL NOT NULL,
    "numero_ticket" VARCHAR(50) NOT NULL,
    "titre" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "statut" "TicketStatus" NOT NULL DEFAULT 'NOUVEAU',
    "priorite" "Priority" NOT NULL DEFAULT 'MOYENNE',
    "date_creation" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "date_maj" TIMESTAMP(6) NOT NULL,
    "id_materiels" INTEGER NOT NULL,
    "id_n_demandeur" INTEGER,
    "nom_demandeur" VARCHAR(255),
    "id_n_assigne" INTEGER,
    "nom_assigne" VARCHAR(255),

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id_ticket")
);

-- CreateTable
CREATE TABLE "tickets_fermeture" (
    "id" SERIAL NOT NULL,
    "ticket_id" INTEGER NOT NULL,
    "solution" TEXT NOT NULL,
    "date_fermeture" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ferme_par" INTEGER NOT NULL,
    "motif" VARCHAR(255),
    "duree_resolution" INTEGER,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "tickets_fermeture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historique_commentaires" (
    "id_commentaire" SERIAL NOT NULL,
    "contenu" TEXT NOT NULL,
    "date_publi" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id_ticket" INTEGER NOT NULL,
    "id_n_auteur" INTEGER NOT NULL,

    CONSTRAINT "historique_commentaires_pkey" PRIMARY KEY ("id_commentaire")
);

-- CreateTable
CREATE TABLE "produits" (
    "id_produit" SERIAL NOT NULL,
    "nom_produit" VARCHAR(200),
    "quantite_en_stock" INTEGER,
    "seuil_alerte" INTEGER,
    "last_date" DATE,

    CONSTRAINT "produits_pkey" PRIMARY KEY ("id_produit")
);

-- CreateTable
CREATE TABLE "mouvements" (
    "id_mouvement" SERIAL NOT NULL,
    "id_produit" INTEGER NOT NULL,
    "date_mouvement" DATE NOT NULL DEFAULT CURRENT_DATE,
    "type_mouvement" VARCHAR(20) NOT NULL,
    "quantite" INTEGER NOT NULL,
    "id_local_source" INTEGER,
    "id_local_destination" INTEGER,
    "id_materiels" INTEGER,
    "motif" TEXT,
    "remarque" TEXT,
    "nom_utilisateur" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mouvements_pkey" PRIMARY KEY ("id_mouvement")
);

-- CreateTable
CREATE TABLE "historique_materiels" (
    "id_historique" SERIAL NOT NULL,
    "id_materiels" INTEGER NOT NULL,
    "ancienne_valeur" TEXT,
    "nouvelle_valeur" TEXT,
    "date_modification" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nom_utilisateur" VARCHAR(255),

    CONSTRAINT "historique_materiels_pkey" PRIMARY KEY ("id_historique")
);

-- CreateTable
CREATE TABLE "historique_arrive" (
    "id_arrivage" SERIAL NOT NULL,
    "id_produit" INTEGER NOT NULL,
    "quantite_arrivee" INTEGER NOT NULL,
    "date_arrivee" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ancienne_quantite_stock" INTEGER,
    "ancienne_date_stock" TIMESTAMP(6),
    "remarque" VARCHAR(255),

    CONSTRAINT "historique_arrive_pkey" PRIMARY KEY ("id_arrivage")
);

-- CreateTable
CREATE TABLE "config_email_quotidien" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "email_dest" TEXT NOT NULL,
    "email_exp" TEXT NOT NULL,
    "email_pass" TEXT NOT NULL,
    "objet_mail" TEXT NOT NULL DEFAULT 'Rapport Quotidien des Stocks',
    "message_mail" TEXT NOT NULL DEFAULT 'Bonjour, veuillez trouver ci-joint le rapport des stocks.',
    "heure_envoi" TEXT NOT NULL DEFAULT '17:15',
    "cron_actif" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "config_email_quotidien_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "config_email_hebdomadaire" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "email_dest" TEXT NOT NULL,
    "email_exp" TEXT NOT NULL,
    "email_pass" TEXT NOT NULL,
    "type_envoi" TEXT NOT NULL DEFAULT 'hebdomadaire',
    "jour_envoi" INTEGER NOT NULL DEFAULT 1,
    "heure_envoi" TEXT NOT NULL DEFAULT '17:15',
    "cron_actif_hebdo" BOOLEAN NOT NULL DEFAULT false,
    "objet_mail_hebdo" TEXT NOT NULL DEFAULT 'Rapport Hebdomadaire des Stocks',
    "message_mail_hebdo" TEXT NOT NULL DEFAULT 'Bonjour, veuillez trouver ci-joint le rapport hebdomadaire des stocks.',
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "filtre_equipe" TEXT,
    "include_materiels" BOOLEAN NOT NULL DEFAULT true,
    "include_produits" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "config_email_hebdomadaire_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "config_email_mensuel" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "email_dest" TEXT NOT NULL,
    "email_exp" TEXT NOT NULL,
    "email_pass" TEXT NOT NULL,
    "objet_mail" TEXT NOT NULL DEFAULT 'Rapport Mensuel des Stocks',
    "message_mail" TEXT NOT NULL DEFAULT 'Bonjour, veuillez trouver ci-joint le rapport mensuel des stocks.',
    "heure_envoi" TEXT NOT NULL DEFAULT '17:15',
    "jour_envoi" INTEGER NOT NULL DEFAULT 1,
    "cron_actif" BOOLEAN NOT NULL DEFAULT false,
    "filtre_equipe" TEXT,
    "include_materiels" BOOLEAN NOT NULL DEFAULT true,
    "include_produits" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "config_email_mensuel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "config_email" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "email_dest" TEXT NOT NULL,
    "email_exp" TEXT NOT NULL,
    "email_pass" TEXT NOT NULL,
    "objet_mail" TEXT NOT NULL DEFAULT 'Rapport Quotidien des Stocks',
    "message_mail" TEXT NOT NULL DEFAULT 'Bonjour, veuillez trouver ci-joint le rapport des stocks.',
    "heure_envoi" TEXT NOT NULL DEFAULT '17:15',
    "cron_actif" BOOLEAN NOT NULL DEFAULT false,
    "cron_actif_hebdo" BOOLEAN NOT NULL DEFAULT false,
    "type_envoi" TEXT NOT NULL DEFAULT 'quotidien',
    "jour_envoi" INTEGER NOT NULL DEFAULT 1,
    "objet_mail_hebdo" TEXT NOT NULL DEFAULT 'Rapport Hebdomadaire des Stocks',
    "message_mail_hebdo" TEXT NOT NULL DEFAULT 'Bonjour, veuillez trouver ci-joint le rapport hebdomadaire des stocks.',
    "uupdated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "config_email_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" SERIAL NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(6) NOT NULL,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usedAt" TIMESTAMP(6),

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_id_n_key" ON "users"("id_n");

-- CreateIndex
CREATE UNIQUE INDEX "user_emails_email_key" ON "user_emails"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_emails_user_id_email_key" ON "user_emails"("user_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "materiels_id_n_key" ON "materiels"("id_n");

-- CreateIndex
CREATE UNIQUE INDEX "marque_nom_unique" ON "marques"("nom_marque");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_numero_ticket_key" ON "tickets"("numero_ticket");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_fermeture_ticket_id_key" ON "tickets_fermeture"("ticket_id");

-- CreateIndex
CREATE INDEX "historique_materiels_id_materiels_idx" ON "historique_materiels"("id_materiels");

-- CreateIndex
CREATE INDEX "historique_materiels_date_modification_idx" ON "historique_materiels"("date_modification" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_key" ON "password_reset_tokens"("token");

-- AddForeignKey
ALTER TABLE "user_emails" ADD CONSTRAINT "user_emails_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id_user") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materiels" ADD CONSTRAINT "materiels_id_marque_fkey" FOREIGN KEY ("id_marque") REFERENCES "marques"("id_marque") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materiels" ADD CONSTRAINT "materiels_id_local_fkey" FOREIGN KEY ("id_local") REFERENCES "locaux"("id_local") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materiels" ADD CONSTRAINT "materiels_id_n_fkey" FOREIGN KEY ("id_n") REFERENCES "users"("id_n") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_id_materiels_fkey" FOREIGN KEY ("id_materiels") REFERENCES "materiels"("id_materiels") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_id_n_demandeur_fkey" FOREIGN KEY ("id_n_demandeur") REFERENCES "users"("id_n") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_id_n_assigne_fkey" FOREIGN KEY ("id_n_assigne") REFERENCES "users"("id_n") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets_fermeture" ADD CONSTRAINT "tickets_fermeture_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id_ticket") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets_fermeture" ADD CONSTRAINT "tickets_fermeture_ferme_par_fkey" FOREIGN KEY ("ferme_par") REFERENCES "users"("id_n") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historique_commentaires" ADD CONSTRAINT "historique_commentaires_id_ticket_fkey" FOREIGN KEY ("id_ticket") REFERENCES "tickets"("id_ticket") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historique_commentaires" ADD CONSTRAINT "historique_commentaires_id_n_auteur_fkey" FOREIGN KEY ("id_n_auteur") REFERENCES "users"("id_n") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mouvements" ADD CONSTRAINT "mouvements_id_produit_fkey" FOREIGN KEY ("id_produit") REFERENCES "produits"("id_produit") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mouvements" ADD CONSTRAINT "mouvements_id_materiels_fkey" FOREIGN KEY ("id_materiels") REFERENCES "materiels"("id_n") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mouvements" ADD CONSTRAINT "mouvements_id_local_source_fkey" FOREIGN KEY ("id_local_source") REFERENCES "locaux"("id_local") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mouvements" ADD CONSTRAINT "mouvements_id_local_destination_fkey" FOREIGN KEY ("id_local_destination") REFERENCES "locaux"("id_local") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historique_materiels" ADD CONSTRAINT "historique_materiels_id_materiels_fkey" FOREIGN KEY ("id_materiels") REFERENCES "materiels"("id_materiels") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historique_arrive" ADD CONSTRAINT "historique_arrive_id_produit_fkey" FOREIGN KEY ("id_produit") REFERENCES "produits"("id_produit") ON DELETE RESTRICT ON UPDATE CASCADE;
