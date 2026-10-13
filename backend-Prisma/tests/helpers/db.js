// Accès base pour les tests : remise à zéro des tables et création de fixtures
// directement via Prisma (même client que l'application).
import bcrypt from 'bcryptjs';
import prisma from '../../prismaClient.js';
import { assertTestDatabaseUrl } from './testEnv.js';

export { prisma };

// Vide toutes les tables applicatives de la base de test (séquences remises à 1).
// Double garde-fou : nom de base dans l'URL ET base réellement connectée.
export const resetDatabase = async () => {
    assertTestDatabaseUrl();
    const [{ current_database: dbName }] = await prisma.$queryRaw`SELECT current_database()`;
    if (!dbName.endsWith('_test')) {
        throw new Error(`Refus de vider la base "${dbName}" : ce n'est pas une base de test.`);
    }

    const tables = await prisma.$queryRaw`
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
    if (tables.length === 0) return;
    const list = tables.map(({ tablename }) => `"public"."${tablename}"`).join(', ');
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
};

export const DEFAULT_PASSWORD = 'MotDePasse123!';
let passwordHashCache = null;

/**
 * Crée un utilisateur avec un email principal (mot de passe haché bcrypt) et,
 * optionnellement, un matériel (poste) qui lui est rattaché.
 */
export const createUser = async ({
    idN,
    role = 'USER',
    email,
    password = DEFAULT_PASSWORD,
    isActive = true,
    mustChangePassword = false,
    withMateriel = false,
} = {}) => {
    const hash = password === DEFAULT_PASSWORD
        ? (passwordHashCache ??= await bcrypt.hash(DEFAULT_PASSWORD, 4))
        : await bcrypt.hash(password, 4);

    const user = await prisma.users.create({
        data: {
            id_n: idN,
            role,
            is_active: isActive,
            must_change_password: mustChangePassword,
            emails: {
                create: {
                    email: email || `user${idN}@test.local`,
                    password: hash,
                    is_primary: true,
                },
            },
        },
        include: { emails: true },
    });

    let materiel = null;
    if (withMateriel) {
        materiel = await createMateriel({ idN, utilisateur: `Utilisateur ${idN}` });
    }
    return { ...user, email: user.emails[0].email, password, materiel };
};

export const createMateriel = ({ idN = null, utilisateur = 'Poste test', equipe = 'Equipe test' } = {}) =>
    prisma.materiels.create({
        data: {
            utilisateur,
            id_n: idN,
            equipe,
            caracteristiques: 'PC de test',
        },
    });

export const createProduit = ({ nom = 'Souris', quantite = 10, seuil = null } = {}) =>
    prisma.produits.create({
        data: { nom_produit: nom, quantite_en_stock: quantite, seuil_alerte: seuil },
    });

export const createLocal = (nom = 'Magasin') =>
    prisma.locaux.create({ data: { nom_local: nom } });

let ticketSeq = 0;
export const createTicket = ({ materielId, demandeurIdN = null, assigneIdN = null, statut = 'NOUVEAU', titre = 'Ticket test' }) =>
    prisma.ticket.create({
        data: {
            numeroTicket: `TEST-${Date.now()}-${++ticketSeq}`,
            titre,
            description: 'Description de test',
            statut,
            idMateriels: materielId,
            idDemandeur: demandeurIdN,
            idAssigne: assigneIdN,
        },
    });
