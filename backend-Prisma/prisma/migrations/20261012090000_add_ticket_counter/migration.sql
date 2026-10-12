-- Compteur annuel des numéros de ticket (TICK-{ANNEE}-{SEQUENCE:6}).
-- Remplace le calcul applicatif "dernier numéro + 1" (non atomique : deux
-- créations simultanées obtenaient le même numéro et la seconde échouait sur
-- la contrainte unique). L'incrément se fait par un INSERT ... ON CONFLICT
-- DO UPDATE ... RETURNING, atomique côté base. Voir
-- backend-Prisma/routes/ticketRoutes.js (nextNumeroTicket).
CREATE TABLE "ticket_counter" (
    "annee" INTEGER NOT NULL,
    "dernier_numero" INTEGER NOT NULL,

    CONSTRAINT "ticket_counter_pkey" PRIMARY KEY ("annee")
);

-- Initialise le compteur avec le plus grand numéro déjà attribué par année.
INSERT INTO "ticket_counter" ("annee", "dernier_numero")
SELECT split_part("numero_ticket", '-', 2)::INTEGER,
       MAX(split_part("numero_ticket", '-', 3)::INTEGER)
FROM "tickets"
WHERE "numero_ticket" ~ '^TICK-[0-9]{4}-[0-9]+$'
GROUP BY 1;
