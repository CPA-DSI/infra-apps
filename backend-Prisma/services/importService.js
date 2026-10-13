// services/importService.js
// Import Excel de l'inventaire des matériels (POST /api/import) : création des
// marques, locaux et utilisateurs manquants, écriture groupée des matériels,
// puis ouverture des affectations et rattachement des écrans.
import prisma from '../prismaClient.js';
import bcrypt from 'bcryptjs';
import { ouvrirAffectationInitiale, rattacherEcranParCode } from './affectationService.js';
import {
    validateDate,
    convertBoolean,
    cleanString,
    truncate,
    findFieldValue,
    extractMarqueFromCaracteristiques,
    extractSiteFromItem,
} from './importParsing.js';

export class ImportError extends Error {
    constructor(message, status = 400) {
        super(message);
        this.name = 'ImportError';
        this.status = status;
    }
}

const BCRYPT_ROUNDS = 10;

// Mot de passe par défaut attribué à tous les utilisateurs créés par import (cf. usersRoutes.js
// qui applique la même convention pour la création manuelle). L'utilisateur doit le changer à la
// première connexion (users.must_change_password vaut true par défaut).
const DEFAULT_PASSWORD = 'User123456';

// Génère un id_n via la séquence PostgreSQL dédiée (users_id_n_auto_seq),
// ce qui garantit l'atomicité entre imports concurrents contrairement à un
// calcul applicatif MAX(id_n)+1.
const generateIdN = async () => {
    try {
        const [{ next_id }] = await prisma.$queryRaw`SELECT nextval('users_id_n_auto_seq') AS next_id`;
        const nextId = Number(next_id);
        return nextId;

    } catch (error) {
        console.error(`[ERREUR] Génération id_n:`, error.message);
        return Math.floor(Date.now() / 1000) % 100000;
    }
};

// Récupérer ou créer l'ID de la marque
// nom_marque porte une contrainte @unique en base (marque_nom_unique) : un
// upsert atomique évite les doublons entre imports concurrents, contrairement
// au pattern findFirst puis create utilisé précédemment.
const getOrCreateMarqueId = async (nomMarque) => {
    if (!nomMarque) return null;

    const nomMarqueNormalized = truncate(nomMarque.toUpperCase(), 100);

    try {
        const marque = await prisma.marques.upsert({
            where: { nom_marque: nomMarqueNormalized },
            update: { date_modification: new Date() },
            create: {
                nom_marque: nomMarqueNormalized,
                date_modification: new Date()
            }
        });

        return marque.id_marque;

    } catch (error) {
        console.error(`[ERREUR] Gestion marque ${nomMarqueNormalized}:`, error.message);
        return null;
    }
};

// Récupérer ou créer le local
// nom_local porte un index unique sur lower(trim(nom_local)) en base
// (migration add_unique_locaux_and_idn_sequence). Comme cet index est basé
// sur une expression, Prisma ne le connaît pas au niveau du schéma et ne peut
// pas faire d'upsert dessus : on retente une lecture en cas de violation
// (P2002), sur le même principe que getProduit dans services/importMouvements.js.
const getOrCreateLocalId = async (nomLocal) => {
    if (!nomLocal) return null;

    const nomLocalClean = truncate(nomLocal.toString().trim(), 200);

    const findExisting = () => prisma.locaux.findFirst({
        where: {
            nom_local: {
                equals: nomLocalClean,
                mode: 'insensitive'
            }
        }
    });

    try {
        let local = await findExisting();

        if (local) {
            return local.id_local;
        }

        try {
            local = await prisma.locaux.create({
                data: {
                    nom_local: nomLocalClean,
                    description: `Local importé automatiquement depuis l'inventaire`
                }
            });
            console.log(`[SUCCÈS] ✅ Local créé: "${local.nom_local}" (ID: ${local.id_local})`);
        } catch (error) {
            if (error.code === 'P2002') {
                // Un autre import concurrent vient de créer ce local
                // (contrainte unique locaux_nom_local_norm_key) : on récupère
                // la ligne qu'il vient de créer.
                local = await findExisting();
                console.log(`✅ Local créé entre-temps par un autre import: "${nomLocalClean}" (ID: ${local?.id_local})`);
            } else {
                throw error;
            }
        }

        return local ? local.id_local : null;

    } catch (error) {
        console.error(`[ERREUR] ❌ Gestion du local "${nomLocalClean}":`, error.message);
        return null;
    }
};

// Créer ou récupérer un utilisateur selon le nouveau schéma Prisma
async function findOrCreateUser(id_n, nomUtilisateur, equipe, localName, firstEmailState) {
    if (!id_n) {
        return null;
    }
    
    try {
        const id_n_int = typeof id_n === 'string' ? parseInt(id_n) : id_n;
        
        let user = await prisma.users.findUnique({
            where: { id_n: id_n_int }
        });
        
        if (user) {
            return { user, isNew: false };
        }
        
        const baseEmailRaw = nomUtilisateur 
            ? nomUtilisateur.toLowerCase().replace(/\s+/g, '.') 
            : `user${id_n_int}`;
        
        let baseEmail = baseEmailRaw
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9._-]/g, '.')
            .replace(/\.+/g, '.')
            .replace(/^\.|\.$/g, '');

        const isFirstEmail = firstEmailState && !firstEmailState.processed;

        const localUpper = localName ? localName.toString().trim().toUpperCase() : '';
        const isExpertSite = ['MATURA', 'MADAFIT', 'ANTSIRABE'].includes(localUpper);

        // Deux matricules différents peuvent normaliser vers le même nom (ex: homonymes) :
        // vérifier l'unicité (UserEmail.email @unique) et désambiguïser avec le matricule si besoin.
        const candidateEmail = isExpertSite ? `cpa_${baseEmail}@experts-cpa.com` : `${baseEmail}@rfc-production.com`;
        const emailExists = await prisma.userEmail.findUnique({ where: { email: candidateEmail } });
        if (emailExists) {
            baseEmail = `${baseEmail}.${id_n_int}`;
        }

        const rfcEmail = `${baseEmail}@rfc-production.com`;
        const expertEmail = `cpa_${baseEmail}@experts-cpa.com`;

        const primaryEmail = isExpertSite ? expertEmail : rfcEmail;
        const primaryVerified = isFirstEmail ? true : false;

        // Mot de passe de connexion (authentification) : identique pour tous les
        // utilisateurs créés (DEFAULT_PASSWORD), haché pour password et recopié en
        // clair dans password_enc pour affichage sur la fiche utilisateur. Pas
        // d'appel à encryptSecret ici : ne pas dépendre de PASS_MAIL_ENCRYPTION_KEY
        // à l'import (cf. ac023f7) ; decryptSecret sait déjà lire une valeur en
        // clair (branche "ancienne valeur non chiffrée"). L'utilisateur doit
        // changer ce mot de passe à sa première connexion (must_change_password).
        //
        // Mot de passe de la boîte mail (pass_mail) : propre à chaque utilisateur,
        // dérivé de son adresse (Rfc_/Cpa_ selon le domaine) plutôt qu'une valeur
        // partagée par tous.
        const primaryPlainPassword = DEFAULT_PASSWORD;
        const primaryPassMail = isExpertSite ? `Cpa_${baseEmail}1*` : `Rfc_${baseEmail}1*`;
        const emailsCreate = [
            {
                email: primaryEmail,
                password: await bcrypt.hash(primaryPlainPassword, BCRYPT_ROUNDS),
                pass_mail: primaryPassMail,
                password_enc: primaryPlainPassword,
                is_primary: true,
                is_verified: primaryVerified
            }
        ];
        
        try {
            user = await prisma.users.create({
                data: {
                    id_n: id_n_int,
                    role: 'USER',
                    is_active: false,
                    emails: {
                        create: emailsCreate
                    }
                }
            });
        } catch (error) {
            if (error.code === 'P2002') {
                // id_n déjà pris (matricule dupliqué dans le fichier, ou collision
                // avec un import concurrent qui a créé cet utilisateur entre-temps) :
                // on récupère l'utilisateur existant plutôt que d'échouer.
                const existingUser = await prisma.users.findUnique({ where: { id_n: id_n_int } });
                if (existingUser) {
                    return { user: existingUser, isNew: false };
                }
            }
            throw error;
        }

        if (firstEmailState) {
            firstEmailState.processed = true;
        }

        console.log(`[SUCCÈS] ✅ Utilisateur créé: ${nomUtilisateur} (ID: ${id_n_int}) - Site: ${localName || 'N/A'} - Email principal: ${primaryEmail}`);
        return {
            user,
            isNew: true,
            email: primaryEmail,
            password: primaryPlainPassword
        };

    } catch (error) {
        console.error(`[ERREUR] Création utilisateur ${id_n}:`, error.message);
        return null;
    }
};

// Liste de tous les locaux (GET /api/import/locaux)
export const listLocaux = () => prisma.locaux.findMany({
    orderBy: { nom_local: 'asc' }
});

/**
 * Importe les lignes d'un fichier d'inventaire.
 * @param {unknown} items Lignes du fichier (objets colonne → valeur).
 * @param {number|undefined} idNAuteur Matricule de l'utilisateur connecté (traçabilité des affectations).
 * @returns {Promise<object>} Payload renvoyé tel quel au frontend.
 */
export async function importMateriels(items, idNAuteur) {
    if (!items || !Array.isArray(items)) {
        throw new ImportError('Données invalides');
    }

    console.log(`Début de l'import de ${items.length} items`);
    if (items.length > 0) {
        // Uniquement les noms de colonnes (pas leur contenu, qui peut contenir
        // des données personnelles) : utile pour diagnostiquer un mapping de
        // colonnes qui échouerait.
        console.log('Colonnes détectées sur le premier item:', Object.keys(items[0]));
    }

    let successCount = 0;
    let userCreatedCount = 0;
    let localCreatedCount = 0;
    const errors = [];
    const firstEmailState = { processed: false };
    const marqueCache = new Map();
    const localCache = new Map();
    const userCache = new Map();
    const createdUsers = [];
    const preparedRows = [];
    // Lignes écartées avant écriture (doublons, matricule invalide, fiche
    // non identifiable) : renvoyées au frontend avec leur motif.
    // ligne = numéro de ligne Excel (en-tête en ligne 1).
    const skipped = [];
    const ignorer = (index, utilisateur, raison) => {
        console.warn(`[IGNORÉ] Item ${index}: ${raison}`);
        skipped.push({ index, ligne: index + 2, utilisateur, raison });
    };
    const idNsVus = new Map();
    const clesSansMatriculeVues = new Map();
    const postesRapprochesVus = new Map();
    let updatedCount = 0;

    // Amorçage des caches en 3 requêtes (au lieu d'une requête par nouvelle
    // valeur rencontrée pendant la boucle) : la grande majorité des lignes
    // d'un import référencent des marques/locaux/utilisateurs déjà connus.
    const [existingMarques, existingLocaux, existingUsers] = await Promise.all([
        prisma.marques.findMany({ select: { id_marque: true, nom_marque: true } }),
        prisma.locaux.findMany({ select: { id_local: true, nom_local: true } }),
        prisma.users.findMany({ select: { id_n: true, id_user: true } })
    ]);
    for (const m of existingMarques) marqueCache.set(m.nom_marque, m.id_marque);
    for (const l of existingLocaux) {
        if (l.nom_local) localCache.set(l.nom_local.trim().toUpperCase(), l.id_local);
    }
    for (const u of existingUsers) userCache.set(u.id_n, u.id_user);

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        try {
            const allKeys = Object.keys(item);

            // --- Local (site) ---
            let idLocal = null;
            const localName = extractSiteFromItem(item);
            if (localName) {
                const cacheKey = localName.toString().trim().toUpperCase();
                if (localCache.has(cacheKey)) {
                    idLocal = localCache.get(cacheKey);
                } else {
                    idLocal = await getOrCreateLocalId(localName);
                    if (idLocal) {
                        localCache.set(cacheKey, idLocal);
                        localCreatedCount++;
                    }
                }
            }

            // --- Matricule (id_n) : uniquement depuis une colonne matricule.
            // Plus de repli sur « la première valeur numérique de la ligne »
            // (id_local, année... pouvaient être pris pour un matricule et
            // écraser la fiche d'un autre utilisateur).
            let id_n = null;
            let matriculeBrut = null;
            const matriculeKeys = ['N° Matricule', 'N°Matricule', 'Matricule', 'matricule', 'id_n', 'idN', 'Id_n', 'ID_N'];
            for (const key of allKeys) {
                if (!matriculeKeys.some(k => k.toLowerCase() === key.toLowerCase())) continue;
                const value = item[key];
                if (value === undefined || value === null || value === '') continue;
                matriculeBrut = value;
                if (typeof value === 'number') { id_n = value; break; }
                if (typeof value === 'string') {
                    const parsed = parseInt(value.trim());
                    if (!isNaN(parsed) && parsed > 0) { id_n = parsed; break; }
                }
            }
            const ligneUtilisateur = item['Utilisateur'] || item.utilisateur || 'unknown';
            if (matriculeBrut !== null && !(Number.isInteger(id_n) && id_n > 0)) {
                ignorer(i, ligneUtilisateur, `Matricule invalide : « ${matriculeBrut} ».`);
                continue;
            }

            // --- Utilisateur / équipe ---
            const nomUtilisateur = cleanString(findFieldValue(item, allKeys, ['Utilisateur', 'utilisateur', 'USER', 'User'])) || 'Utilisateur inconnu';
            const equipe = cleanString(findFieldValue(item, allKeys, ['equipe', 'TEAM', 'Team'])) || 'Autres';
            const code_pc = cleanString(findFieldValue(item, allKeys, ['Code PC', 'Code_PC', 'code_pc', 'CodePc']));

            // --- Doublons et rapprochement ---
            // Avec matricule : un même matricule ne doit apparaître qu'une fois
            // dans le fichier (createMany/skipDuplicates ignorait les suivants
            // en silence). Sans matricule : on cherche la fiche existante par
            // code PC, sinon par nom + équipe, pour la mettre à jour au lieu de
            // créer un nouvel utilisateur à chaque ré-import.
            let posteRapproche = null;
            if (id_n) {
                if (idNsVus.has(id_n)) {
                    ignorer(i, ligneUtilisateur, `Matricule ${id_n} en double dans le fichier (déjà présent ligne ${idNsVus.get(id_n) + 2}).`);
                    continue;
                }
                idNsVus.set(id_n, i);
            } else {
                const nomConnu = nomUtilisateur !== 'Utilisateur inconnu';
                if (!code_pc && !nomConnu) {
                    ignorer(i, ligneUtilisateur, 'Ni matricule, ni code PC, ni nom d\'utilisateur : impossible d\'identifier la fiche.');
                    continue;
                }
                const cleFichier = code_pc
                    ? `pc:${code_pc.toLowerCase()}`
                    : `nom:${nomUtilisateur.toLowerCase()}|${equipe.toLowerCase()}`;
                if (clesSansMatriculeVues.has(cleFichier)) {
                    ignorer(i, ligneUtilisateur, `${code_pc ? `Code PC ${code_pc}` : `${nomUtilisateur} (${equipe})`} en double dans le fichier (déjà présent ligne ${clesSansMatriculeVues.get(cleFichier) + 2}).`);
                    continue;
                }
                clesSansMatriculeVues.set(cleFichier, i);

                const candidats = await prisma.materiels.findMany({
                    where: code_pc
                        ? { code_pc: { equals: code_pc, mode: 'insensitive' }, date_suppression: null }
                        : {
                            utilisateur: { equals: nomUtilisateur, mode: 'insensitive' },
                            equipe: { equals: equipe, mode: 'insensitive' },
                            date_suppression: null,
                        },
                    select: { id_materiels: true, id_n: true, utilisateur: true },
                    take: 2,
                });
                if (candidats.length > 1) {
                    ignorer(i, ligneUtilisateur, `Plusieurs fiches correspondent (${code_pc ? `code PC ${code_pc}` : `${nomUtilisateur} / ${equipe}`}) : renseignez le matricule.`);
                    continue;
                }
                if (candidats.length === 1) {
                    posteRapproche = candidats[0];
                    if (postesRapprochesVus.has(posteRapproche.id_materiels)) {
                        ignorer(i, ligneUtilisateur, `Fiche déjà mise à jour par la ligne ${postesRapprochesVus.get(posteRapproche.id_materiels) + 2} du fichier.`);
                        continue;
                    }
                    postesRapprochesVus.set(posteRapproche.id_materiels, i);
                    // La fiche existante garde son bénéficiaire (affectation).
                    id_n = posteRapproche.id_n;
                } else {
                    // Nouvelle fiche : matricule tiré de la séquence.
                    id_n = await generateIdN();
                }
            }

            // --- Création/récupération de l'utilisateur ---
            if (id_n && !posteRapproche && !userCache.has(id_n)) {
                const result = await findOrCreateUser(id_n, nomUtilisateur, equipe, localName, firstEmailState);
                if (result) {
                    userCache.set(id_n, result.user.id_user);
                    userCreatedCount++;
                    if (result.isNew) {
                        createdUsers.push({
                            id_n,
                            nomUtilisateur,
                            email: result.email,
                            password: result.password
                        });
                    }
                }
            }

            // Materiels.id_n est une FK vers Users.id_n : ne le renseigner que si
            // l'utilisateur correspondant existe réellement, pour éviter une violation de FK.
            const id_n_valide = (id_n && userCache.has(id_n)) ? id_n : null;

            // --- Dates ---
            const rawDatePC = findFieldValue(item, allKeys, ['Date PC', 'Date_PC', 'date_pc', 'DatePc', 'datePc', 'date']);
            const rawDateEcran = findFieldValue(item, allKeys, ['Date Écran', 'Date_Ecran', 'date_ecran', 'DateEcran', 'dateEcran']);
            const convertedDatePC = validateDate(rawDatePC);
            const convertedDateEcran = validateDate(rawDateEcran);

            // --- Caractéristiques / marque ---
            const caracteristiques = cleanString(findFieldValue(item, allKeys, ['Caractéristiques', 'caracteristiques', 'Caracteristiques', 'SPECS', 'Specs']) || 'Non spécifié') || 'Non spécifié';

            let idMarque = null;
            if (caracteristiques !== 'Non spécifié') {
                const marqueExtraite = extractMarqueFromCaracteristiques(caracteristiques);
                if (marqueExtraite) {
                    if (marqueCache.has(marqueExtraite)) {
                        idMarque = marqueCache.get(marqueExtraite);
                    } else {
                        idMarque = await getOrCreateMarqueId(marqueExtraite);
                        if (idMarque) marqueCache.set(marqueExtraite, idMarque);
                    }
                }
            }

            // --- Autres champs ---
            const ecran = cleanString(findFieldValue(item, allKeys, ['Marque Écran', 'Marque_Ecran', 'marque_ecran', 'Ecran']));
            const code_ecran = cleanString(findFieldValue(item, allKeys, ['Code Écran', 'Code_Ecran', 'code_ecran', 'CodeEcran']));
            const hdmi = convertBoolean(findFieldValue(item, allKeys, ['HDMI', 'hdmi']));
            const clavier = convertBoolean(findFieldValue(item, allKeys, ['Clavier', 'clavier', 'Keyboard']));
            const lan = convertBoolean(findFieldValue(item, allKeys, ['LAN', 'lan', 'Ethernet']));
            const usb = convertBoolean(findFieldValue(item, allKeys, ['USB', 'usb']));
            const etat_pc = cleanString(findFieldValue(item, allKeys, ['État PC', 'Etat PC', 'etat_pc', 'EtatPc', 'Statut'])) || 'Disponible';
            const salle = cleanString(findFieldValue(item, allKeys, ['salle', 'Salle', 'SALL', 'Room']));
            const mdp_pc = cleanString(findFieldValue(item, allKeys, ['Password_Local', 'Password Local', 'password_local', 'mdp_pc', 'MdpLocal']));
            const mdp_admin = cleanString(findFieldValue(item, allKeys, ['Password_Admin', 'Password Admin', 'password_admin', 'mdp_admin', 'MdpAdmin']));
            const etat_batterie = cleanString(findFieldValue(item, allKeys, ['Etat de la batterie', 'État de la batterie', 'etat_batterie', 'EtatBatterie', 'Battery', 'Etat de la battérie']));
            const commentaire = cleanString(findFieldValue(item, allKeys, ['Commentaire', 'commentaire', 'Comment', 'Remarque']));

            // Est actif : colonne absente/vide => undefined. Prisma ignore alors
            // le champ : défaut true à la création, valeur inchangée en mise à
            // jour (un PC désactivé n'est pas réactivé par un réimport).
            const estActifValue = findFieldValue(item, allKeys, ['est_actif', 'Est_actif', 'EstActif', 'actif', 'Actif']);
            const est_actif = estActifValue !== null ? convertBoolean(estActifValue) : undefined;

            // --- Préparation des données (troncature pour respecter les limites @db.VarChar(n)) ---
            const data = {
                utilisateur: truncate(nomUtilisateur, 255),
                equipe: truncate(equipe, 200),
                caracteristiques,
                id_n: id_n_valide,
                date_pc: convertedDatePC,
                code_pc: truncate(code_pc, 200),
                hdmi,
                clavier,
                lan,
                usb,
                etat_pc: truncate(etat_pc, 200),
                salle: truncate(salle, 200),
                mdp_pc: truncate(mdp_pc, 200),
                mdp_admin: truncate(mdp_admin, 200),
                etat_batterie: truncate(etat_batterie, 200),
                commentaire,
                id_marque: idMarque,
                id_local: idLocal,
                est_actif
            };

            // L'écriture en base (create/update) est différée après la boucle
            // pour pouvoir grouper les créations en un seul aller-retour (cf. plus bas).
            // L'écran n'est pas écrit dans la fiche : il est rattaché via la
            // table ecrans après l'écriture des matériels (cf. plus bas).
            preparedRows.push({
                index: i,
                utilisateur: ligneUtilisateur,
                posteRapproche,
                data,
                ecran: {
                    code_ecran: truncate(code_ecran, 200),
                    modele: truncate(ecran, 200),
                    date_ecran: convertedDateEcran
                }
            });

        } catch (individualError) {
            console.error(`[ERREUR] Item ${i} (${item['Utilisateur'] || item.utilisateur || 'unknown'}):`, individualError.message);
            errors.push({
                index: i,
                utilisateur: item['Utilisateur'] || item.utilisateur || 'unknown',
                error: individualError.message
            });
        }
    }

    // --- ÉCRITURE GROUPÉE DES MATÉRIELS ---
    // Sépare en une seule requête les lignes qui correspondent à un matériel
    // déjà existant (à mettre à jour) de celles à créer, puis crée toutes les
    // nouvelles lignes en un seul aller-retour au lieu d'un upsert par ligne.
    const idNsAVerifier = preparedRows
        .filter(r => !r.posteRapproche)
        .map(r => r.data.id_n)
        .filter(id => id !== null && id !== undefined);

    const materielsExistants = idNsAVerifier.length > 0
        ? await prisma.materiels.findMany({
            where: { id_n: { in: idNsAVerifier } },
            select: { id_n: true }
        })
        : [];
    const idNsExistants = new Set(materielsExistants.map(m => m.id_n));

    const rowsACreer = [];
    const rowsAMettreAJour = [];
    const rowsRapprochees = [];
    for (const row of preparedRows) {
        if (row.posteRapproche) {
            rowsRapprochees.push(row);
        } else if (row.data.id_n !== null && idNsExistants.has(row.data.id_n)) {
            rowsAMettreAJour.push(row);
        } else {
            rowsACreer.push(row);
        }
    }

    if (rowsACreer.length > 0) {
        try {
            // Les doublons de matricule sont écartés (et signalés) plus haut ;
            // skipDuplicates ne sert plus que de filet face à un import
            // concurrent : les lignes alors ignorées sont aussi signalées.
            const created = await prisma.materiels.createMany({
                data: rowsACreer.map(r => r.data),
                skipDuplicates: true
            });
            successCount += created.count;
            console.log(`[SUCCÈS] ✅ ${created.count} matériel(s) créé(s) en un lot`);
            if (created.count < rowsACreer.length) {
                const nbIgnorees = rowsACreer.length - created.count;
                console.warn(`[IGNORÉ] ${nbIgnorees} ligne(s) non créée(s) : matricule créé entre-temps.`);
                skipped.push({
                    index: null,
                    ligne: null,
                    utilisateur: null,
                    raison: `${nbIgnorees} ligne(s) non créée(s) : matricule déjà utilisé par un import simultané. Relancez l'import pour les mettre à jour.`
                });
            }
        } catch (batchError) {
            // Une ligne du lot est invalide : on retente une par une pour isoler
            // la ligne fautive plutôt que de perdre tout le lot.
            console.error(`[ERREUR] Création groupée des matériels échouée, reprise ligne par ligne:`, batchError.message);
            for (const row of rowsACreer) {
                try {
                    await prisma.materiels.create({ data: row.data });
                    successCount++;
                } catch (rowError) {
                    errors.push({ index: row.index, utilisateur: row.utilisateur, error: rowError.message });
                }
            }
        }
    }

    for (const row of rowsAMettreAJour) {
        try {
            // La ligne importée décrit un PC : un poste vide redevient un poste normal.
            await prisma.materiels.update({ where: { id_n: row.data.id_n }, data: { ...row.data, est_vide: false } });
            successCount++;
            updatedCount++;
        } catch (rowError) {
            errors.push({ index: row.index, utilisateur: row.utilisateur, error: rowError.message });
        }
    }

    // Lignes sans matricule rapprochées d'une fiche existante (code PC ou
    // nom + équipe) : mise à jour par id_materiels. Le bénéficiaire
    // (id_n, utilisateur) ne change que par l'affectation ; un PC en stock
    // garde aussi son équipe et son statut.
    for (const row of rowsRapprochees) {
        try {
            const maj = { ...row.data };
            delete maj.id_n;
            delete maj.utilisateur;
            if (row.posteRapproche.id_n === null) {
                delete maj.equipe;
                delete maj.est_actif;
            }
            await prisma.materiels.update({
                where: { id_materiels: row.posteRapproche.id_materiels, date_suppression: null },
                data: { ...maj, est_vide: false }
            });
            successCount++;
            updatedCount++;
        } catch (rowError) {
            errors.push({ index: row.index, utilisateur: row.utilisateur, error: rowError.message });
        }
    }

    // --- AFFECTATIONS & ÉCRANS ---
    // Une transaction par ligne : un conflit d'écran (code déjà sur un autre
    // poste) n'est qu'un avertissement et n'annule pas l'import de la fiche.
    const warnings = [];
    const idNsImportes = preparedRows.filter(r => !r.posteRapproche).map(r => r.data.id_n).filter(id => id !== null && id !== undefined);
    const idsRapproches = preparedRows.filter(r => r.posteRapproche).map(r => r.posteRapproche.id_materiels);
    const postesImportes = idNsImportes.length > 0 || idsRapproches.length > 0
        ? await prisma.materiels.findMany({
            where: {
                OR: [{ id_n: { in: idNsImportes } }, { id_materiels: { in: idsRapproches } }],
                date_suppression: null
            },
            select: { id_materiels: true, id_n: true, utilisateur: true }
        })
        : [];
    const posteParIdN = new Map(postesImportes.filter(m => m.id_n !== null).map(m => [m.id_n, m]));
    const posteParId = new Map(postesImportes.map(m => [m.id_materiels, m]));

    for (const row of preparedRows) {
        const poste = row.posteRapproche
            ? posteParId.get(row.posteRapproche.id_materiels)
            : (row.data.id_n !== null ? posteParIdN.get(row.data.id_n) : null);
        if (!poste) {
            if (row.ecran.code_ecran) {
                warnings.push({ index: row.index, utilisateur: row.utilisateur, error: `Écran ${row.ecran.code_ecran} non rattaché : poste sans matricule.` });
            }
            continue;
        }
        try {
            await prisma.$transaction(async (tx) => {
                const affectationExistante = await tx.affectationMateriel.findFirst({
                    where: { type_affectation: 'PC', id_materiels: poste.id_materiels },
                    select: { id_affectation: true }
                });
                if (!affectationExistante) {
                    await ouvrirAffectationInitiale(tx, poste, idNAuteur, 'Import Excel');
                }
                await rattacherEcranParCode(tx, poste.id_materiels, row.ecran, idNAuteur, 'Import Excel');
            });
        } catch (ecranError) {
            warnings.push({ index: row.index, utilisateur: row.utilisateur, error: ecranError.message });
        }
    }

    let message;
    if (successCount === 0) {
        message = `Aucun élément importé sur ${items.length} (${errors.length} échec(s))`;
    } else if (errors.length > 0) {
        message = `${successCount}/${items.length} éléments importés avec succès, ${errors.length} échec(s) (${userCreatedCount} utilisateurs, ${localCreatedCount} locaux)`;
    } else {
        message = `${successCount}/${items.length} éléments importés avec succès (${userCreatedCount} utilisateurs, ${localCreatedCount} locaux)`;
    }
    if (skipped.length > 0) {
        message += `, ${skipped.length} ligne(s) ignorée(s)`;
    }

    return {
        success: successCount > 0,
        stats: {
            success: successCount,
            created: successCount - updatedCount,
            updated: updatedCount,
            failed: errors.length,
            warnings: warnings.length,
            skipped: skipped.length
        },
        insertedCount: successCount,
        userCreatedCount: userCreatedCount,
        localCreatedCount: localCreatedCount,
        total: items.length,
        errors: errors,
        warnings: warnings,
        skipped: skipped,
        createdUsers: createdUsers,
        message
    };
}
