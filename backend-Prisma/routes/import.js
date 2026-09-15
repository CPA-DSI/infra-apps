// backend/routes/import.js
import express from 'express';
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { authenticateToken, ensureActiveUser, requirePermission, requireRole } from '../middleware/authMiddleware.js';
import { PERMISSIONS, UserRole } from '../constants/roles.js';
import { encryptPassMail } from '../services/passMailCrypto.js';

const prisma = new PrismaClient();
const router = express.Router();

router.use(authenticateToken, ensureActiveUser);

const BCRYPT_ROUNDS = 10;

// Génère un mot de passe fort et unique par utilisateur (à communiquer séparément, jamais dérivé du nom)
const generateStrongPassword = () => crypto.randomBytes(12).toString('base64url');

// Fonction pour convertir les dates Excel (nombre de jours depuis 1900-01-01)
const excelDateToJSDate = (excelDate) => {
    const excelEpoch = new Date(Date.UTC(1899, 11, 31));
    const msPerDay = 24 * 60 * 60 * 1000;
    const result = new Date(excelEpoch.getTime() + (excelDate * msPerDay));
    return result;
};

// Format date DD/MM/YYYY
const formatDateFR = (date) => {
    if (!date) return 'N/A';
    const d = new Date(date);
    if (isNaN(d.getTime())) return 'N/A';
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const yyyy = d.getUTCFullYear();
    return `${dd}/${mm}/${yyyy}`;
};

// Fonction pour valider et convertir une date
const validateDate = (dateValue) => {
    if (!dateValue && dateValue !== 0) {
        return null;
    }
    
    try {
        let date = null;
        
        // Si c'est un nombre (format Excel)
        if (typeof dateValue === 'number') {
            // Les dates Excel valides sont généralement entre 1 et 100000
            if (dateValue > 1 && dateValue < 100000) {
                date = excelDateToJSDate(dateValue);
                return date;
            }
            return null;
        }
        
        // Si c'est une chaîne
        if (typeof dateValue === 'string') {
            const cleanDateString = dateValue.trim();
            
            if (cleanDateString === '' || 
                cleanDateString.toLowerCase() === 'null' || 
                cleanDateString.toLowerCase() === 'undefined') {
                return null;
            }
            
            // 1. Date Excel pure (ex: "44651" ou "+44651" ou "-44651")
            const excelNumMatch = cleanDateString.match(/^[+-]?(\d{4,5})$/);
            if (excelNumMatch) {
                const excelNum = parseInt(excelNumMatch[1]);
                if (excelNum > 1 && excelNum < 100000) {
                    date = excelDateToJSDate(excelNum);
                    return date;
                }
                return null;
            }
            
            // 2. Date Excel avec décimales (ex: "44651.0")
            const decimalMatch = cleanDateString.match(/^[+-]?(\d{4,5})\.\d+$/);
            if (decimalMatch) {
                const excelNum = parseInt(decimalMatch[1]);
                if (excelNum > 1 && excelNum < 100000) {
                    date = excelDateToJSDate(excelNum);
                    return date;
                }
                return null;
            }
            
            // 3. Format ISO avec temps "2024-11-25 00:00:00"
            const dateTimeMatch = cleanDateString.match(/(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/);
            if (dateTimeMatch) {
                const year = parseInt(dateTimeMatch[1]);
                if (year >= 1990 && year <= 2100) {
                    date = new Date(Date.UTC(
                        year,
                        parseInt(dateTimeMatch[2]) - 1,
                        parseInt(dateTimeMatch[3])
                    ));
                    return date;
                }
            }
            
            // 4. Format ISO "YYYY-MM-DD"
            const isoMatch = cleanDateString.match(/(\d{4})-(\d{2})-(\d{2})/);
            if (isoMatch) {
                const year = parseInt(isoMatch[1]);
                if (year >= 1990 && year <= 2100) {
                    date = new Date(Date.UTC(
                        year,
                        parseInt(isoMatch[2]) - 1,
                        parseInt(isoMatch[3])
                    ));
                    return date;
                }
            }
            
            // 5. Format français "30/07/2026"
            const frenchMatch = cleanDateString.match(/(\d{2})\/(\d{2})\/(\d{4})/);
            if (frenchMatch) {
                const year = parseInt(frenchMatch[3]);
                if (year >= 1990 && year <= 2100) {
                    date = new Date(Date.UTC(
                        year,
                        parseInt(frenchMatch[2]) - 1,
                        parseInt(frenchMatch[1])
                    ));
                    return date;
                }
            }
            
            // 6. Format avec temps "2024-11-25T00:00:00"
            const isoTimeMatch = cleanDateString.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
            if (isoTimeMatch) {
                const year = parseInt(isoTimeMatch[1]);
                if (year >= 1990 && year <= 2100) {
                    date = new Date(Date.UTC(
                        year,
                        parseInt(isoTimeMatch[2]) - 1,
                        parseInt(isoTimeMatch[3])
                    ));
                    return date;
                }
            }
            
            // 7. Dernier essai avec new Date()
            date = new Date(cleanDateString);
            if (!isNaN(date.getTime())) {
                const year = date.getUTCFullYear();
                if (year >= 1990 && year <= 2100) {
                    return date;
                }
            }

            // Pas de repli sur un simple préfixe numérique (ex: code postal,
            // référence produit, matricule collé à du texte) : un serial Excel
            // légitime est déjà couvert par les cas 1 et 2 ci-dessus, qui exigent
            // que la chaîne entière soit le nombre. Deviner à partir d'un préfixe
            // produit trop de fausses dates silencieuses.
            return null;
        }
        
        if (dateValue instanceof Date) {
            return dateValue;
        }
        
        return null;
        
    } catch (error) {
        console.error(`[ERREUR] validateDate:`, error.message);
        return null;
    }
};

// Fonction pour convertir les booléens
const convertBoolean = (value) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
        const lowerValue = value.toLowerCase().trim();
        return lowerValue === 'true' || lowerValue === 'vrai' || lowerValue === '1' || lowerValue === 'oui' || lowerValue === 'o' || lowerValue === 'yes' || lowerValue === 'y';
    }
    if (typeof value === 'number') return value === 1;
    return false;
};

// Fonction pour nettoyer les chaînes
const cleanString = (value) => {
    if (!value) return null;
    if (typeof value !== 'string') return String(value).trim();
    const trimmed = value.trim();
    return trimmed === '' || trimmed.toLowerCase() === 'null' || trimmed.toLowerCase() === 'undefined' ? null : trimmed;
};

// Tronquer une chaîne pour respecter les limites @db.VarChar(n) du schéma Prisma
const truncate = (value, maxLength) => {
    if (value === null || value === undefined) return value;
    const str = String(value);
    return str.length > maxLength ? str.slice(0, maxLength) : str;
};

// Cherche la première valeur non vide parmi une liste d'alias de colonnes
// (insensible à la casse) : mutualise le pattern répété pour chaque champ
// du fichier importé (Code PC, Salle, Commentaire, HDMI, ...).
const findFieldValue = (item, allKeys, aliases) => {
    for (const key of allKeys) {
        if (aliases.some(a => a.toLowerCase() === key.toLowerCase())) {
            const value = item[key];
            if (value !== undefined && value !== null && value !== '') {
                return value;
            }
        }
    }
    return null;
};


// Génère un id_n via la séquence PostgreSQL dédiée (users_id_n_auto_seq),
// ce qui garantit l'atomicité entre imports concurrents contrairement à un
// calcul applicatif MAX(id_n)+1.
const generateIdN = async () => {
    try {
        const [{ next_id }] = await prisma.$queryRaw`SELECT nextval('users_id_n_auto_seq') AS next_id`;
        const nextId = Number(next_id);
        console.log(`[DEBUG] 🆕 ID_N généré: ${nextId}`);
        return nextId;

    } catch (error) {
        console.error(`[ERREUR] Génération id_n:`, error.message);
        return Math.floor(Date.now() / 1000) % 100000;
    }
};

// Extraire la marque depuis le champ caracteristiques
const extractMarqueFromCaracteristiques = (caracteristiques) => {
    if (!caracteristiques) return null;
    
    let cleanCarac = caracteristiques.trim();
    let parts = cleanCarac.split(/[\s\/-]/);
    
    for (const part of parts) {
        if (part && part.length > 0) {
            const marqueValid = part.match(/^[A-Za-z]{2,}/);
            if (marqueValid) {
                return marqueValid[0].toUpperCase();
            }
        }
    }
    
    return null;
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
    console.log(`[DEBUG] 🔍 Recherche/création local: "${nomLocalClean}"`);

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
            console.log(`[DEBUG] ✅ Local trouvé: "${local.nom_local}" (ID: ${local.id_local})`);
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

// Fonction pour extraire le site de l'item
const extractSiteFromItem = (item) => {
    // 1. Chercher dans les clés spécifiques (exactes)
    const siteKeys = ['Site', 'site', 'SITE', 'id_local', 'Id_local', 'ID_LOCAL', 'local_id'];

    for (const key of siteKeys) {
        if (item[key] !== undefined && item[key] !== null && item[key] !== '') {
            return item[key];
        }
    }

    // 2. Chercher dans TOUTES les clés (insensible à la casse)
    for (const key of Object.keys(item)) {
        const keyLower = key.toLowerCase().trim();
        if (keyLower === 'site' || keyLower === 'local' || keyLower === 'id_local' || keyLower === 'local_id') {
            const value = item[key];
            if (value !== undefined && value !== null && value !== '') {
                return value;
            }
        }
    }

    // 3. Chercher dans les valeurs qui ressemblent à un site connu
    const knownSites = ['BNI', 'MATURA', 'MADAFIT', 'ANTSIRABE'];
    for (const key of Object.keys(item)) {
        const value = item[key];
        if (typeof value === 'string' && value.trim() !== '') {
            const trimmed = value.trim().toUpperCase();
            if (knownSites.some(site => site.toUpperCase() === trimmed)) {
                return trimmed;
            }
        }
    }

    // 4. Chercher la première valeur string qui n'est pas un email, une date ou un nombre
    for (const key of Object.keys(item)) {
        const value = item[key];
        if (typeof value === 'string' && value.trim() !== '') {
            const trimmed = value.trim();
            // Vérifier que ce n'est pas un email, une date, un nombre ou une longue chaîne
            if (!trimmed.includes('@') &&
                !/^\d{4}-\d{2}-\d{2}/.test(trimmed) &&
                !/^\d{2}\/\d{2}\/\d{4}/.test(trimmed) &&
                !/^\d+$/.test(trimmed) &&
                trimmed.length <= 30 &&
                !trimmed.includes('Go') &&
                !trimmed.includes('RAM')) {
                return trimmed;
            }
        }
    }

    return null;
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
            console.log(`[DEBUG] ✅ Utilisateur existant: ${nomUtilisateur} (ID: ${id_n_int})`);
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
        const isBni = localUpper === 'BNI';
        const isExpertSite = ['MATURA', 'MADAFIT', 'ANTSIRABE'].includes(localUpper);

        // Deux matricules diff\u00e9rents peuvent normaliser vers le m\u00eame nom (ex: homonymes) :
        // v\u00e9rifier l'unicit\u00e9 (UserEmail.email @unique) et d\u00e9sambigu\u00efser avec le matricule si besoin.
        const candidateEmail = isExpertSite ? `cpa_${baseEmail}@experts-cpa.com` : `${baseEmail}@rfc-production.com`;
        const emailExists = await prisma.userEmail.findUnique({ where: { email: candidateEmail } });
        if (emailExists) {
            baseEmail = `${baseEmail}.${id_n_int}`;
            console.log(`[DEBUG] \u26a0\ufe0f Email "${candidateEmail}" d\u00e9j\u00e0 utilis\u00e9, d\u00e9sambigu\u00efsation avec le matricule: "${baseEmail}"`);
        }

        const rfcEmail = `${baseEmail}@rfc-production.com`;
        const expertEmail = `cpa_${baseEmail}@experts-cpa.com`;

        let primaryEmail, secondaryEmail, primaryVerified, secondaryVerified;

        if (isBni) {
            primaryEmail = rfcEmail;
            secondaryEmail = null;
            primaryVerified = isFirstEmail ? true : false;
        } else if (isExpertSite) {
            primaryEmail = expertEmail;
            secondaryEmail = null;
            primaryVerified = isFirstEmail ? true : false;
        } else {
            primaryEmail = rfcEmail;
            secondaryEmail = null;
            primaryVerified = isFirstEmail ? true : false;
        }

        // Mot de passe unique et aléatoire par utilisateur : haché pour l'authentification,
        // conservé en clair uniquement dans pass_mail pour communication à l'utilisateur.
        const primaryPlainPassword = generateStrongPassword();
        const emailsCreate = [
            {
                email: primaryEmail,
                password: await bcrypt.hash(primaryPlainPassword, BCRYPT_ROUNDS),
                pass_mail: encryptPassMail(primaryPlainPassword),
                is_primary: true,
                is_verified: primaryVerified
            }
        ];

        if (secondaryEmail) {
            const secondaryPlainPassword = generateStrongPassword();
            emailsCreate.push({
                email: secondaryEmail,
                password: await bcrypt.hash(secondaryPlainPassword, BCRYPT_ROUNDS),
                pass_mail: encryptPassMail(secondaryPlainPassword),
                is_primary: false,
                is_verified: secondaryVerified
            });
        }
        
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
                    console.log(`[DEBUG] ✅ Utilisateur créé entre-temps par un autre import: ${nomUtilisateur} (ID: ${id_n_int})`);
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

// Endpoint d'import
router.post('/', requirePermission(PERMISSIONS.STOCKS_WRITE), async (req, res) => {
    try {
        const { items } = req.body;
        
        if (!items || !Array.isArray(items)) {
            return res.status(400).json({ error: 'Données invalides' });
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
        console.log(`[DEBUG] Caches pré-chargés: ${marqueCache.size} marques, ${localCache.size} locaux, ${userCache.size} utilisateurs`);

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

                // --- Matricule (id_n) : plusieurs orthographes de colonne possibles,
                // puis à défaut la première valeur numérique plausible de la ligne
                // (en excluant la plage 40000-50000, réservée à d'autres codes).
                let id_n = null;
                const matriculeKeys = ['N° Matricule', 'N°Matricule', 'Matricule', 'matricule', 'id_n', 'idN', 'Id_n', 'ID_N'];
                for (const key of allKeys) {
                    if (!matriculeKeys.some(k => k.toLowerCase() === key.toLowerCase())) continue;
                    const value = item[key];
                    if (value === undefined || value === null || value === '') continue;
                    if (typeof value === 'number') { id_n = value; break; }
                    if (typeof value === 'string') {
                        const parsed = parseInt(value.trim());
                        if (!isNaN(parsed) && parsed > 0) { id_n = parsed; break; }
                    }
                }
                if (!id_n) {
                    for (const key of allKeys) {
                        const value = item[key];
                        if (typeof value === 'number' && value > 0 && value < 999999 && (value < 40000 || value > 50000)) {
                            id_n = value;
                            break;
                        }
                    }
                }

                // --- Utilisateur / équipe ---
                const nomUtilisateur = cleanString(findFieldValue(item, allKeys, ['Utilisateur', 'utilisateur', 'USER', 'User'])) || 'Utilisateur inconnu';
                const equipe = cleanString(findFieldValue(item, allKeys, ['equipe', 'TEAM', 'Team'])) || 'Autres';

                if (!id_n) {
                    id_n = await generateIdN();
                }

                // --- Création/récupération de l'utilisateur ---
                if (id_n && !userCache.has(id_n)) {
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
                const code_pc = cleanString(findFieldValue(item, allKeys, ['Code PC', 'Code_PC', 'code_pc', 'CodePc']));
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

                // Est actif (par défaut true si la colonne est absente/vide)
                const estActifValue = findFieldValue(item, allKeys, ['est_actif', 'Est_actif', 'EstActif', 'actif', 'Actif']);
                const est_actif = estActifValue !== null ? convertBoolean(estActifValue) : true;

                // --- Préparation des données (troncature pour respecter les limites @db.VarChar(n)) ---
                const data = {
                    utilisateur: truncate(nomUtilisateur, 255),
                    equipe: truncate(equipe, 200),
                    caracteristiques,
                    id_n: id_n_valide,
                    date_pc: convertedDatePC,
                    date_ecran: convertedDateEcran,
                    code_pc: truncate(code_pc, 200),
                    ecran: truncate(ecran, 200),
                    code_ecran: truncate(code_ecran, 200),
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
                preparedRows.push({
                    index: i,
                    utilisateur: item['Utilisateur'] || item.utilisateur || 'unknown',
                    data
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
        for (const row of preparedRows) {
            if (row.data.id_n !== null && idNsExistants.has(row.data.id_n)) {
                rowsAMettreAJour.push(row);
            } else {
                rowsACreer.push(row);
            }
        }

        if (rowsACreer.length > 0) {
            try {
                const created = await prisma.materiels.createMany({
                    data: rowsACreer.map(r => r.data),
                    skipDuplicates: true
                });
                successCount += created.count;
                console.log(`[SUCCÈS] ✅ ${created.count} matériel(s) créé(s) en un lot`);
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
                await prisma.materiels.update({ where: { id_n: row.data.id_n }, data: row.data });
                successCount++;
            } catch (rowError) {
                errors.push({ index: row.index, utilisateur: row.utilisateur, error: rowError.message });
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

        return res.status(200).json({
            success: successCount > 0,
            stats: {
                success: successCount,
                failed: errors.length,
                warnings: 0
            },
            insertedCount: successCount,
            userCreatedCount: userCreatedCount,
            localCreatedCount: localCreatedCount,
            total: items.length,
            errors: errors,
            createdUsers: createdUsers,
            message
        });

    } catch (error) {
        console.error('Erreur import:', error);

        if (!res.headersSent) {
            return res.status(500).json({ message: error.message });
        }
    }
});

// Endpoint pour lister tous les locaux
router.get('/locaux', requirePermission(PERMISSIONS.STOCKS_READ), async (req, res) => {
    try {
        const locaux = await prisma.locaux.findMany({
            orderBy: { nom_local: 'asc' }
        });
        res.json(locaux);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Endpoints de diagnostic réservés au développement : inutiles en production
// et inutilement exposés même derrière un rôle IT_ADMIN (recherche de local
// arbitraire, dump de matériels, test de parsing de date).
if (process.env.NODE_ENV !== 'production') {
    // Endpoint de test pour les locaux
    router.get('/test-local/:nomLocal', requireRole(UserRole.IT_ADMIN), async (req, res) => {
        try {
            const { nomLocal } = req.params;
            const idLocal = await getOrCreateLocalId(nomLocal);
            const allLocaux = await prisma.locaux.findMany();

            res.json({
                nom_local_recherche: nomLocal,
                id_local_trouve: idLocal,
                tous_les_locaux: allLocaux.map(l => ({
                    id: l.id_local,
                    nom: l.nom_local
                }))
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // Endpoint pour debug - afficher les matériels avec leurs relations
    router.get('/materiels-with-relations', requireRole(UserRole.IT_ADMIN), async (req, res) => {
        try {
            const materiels = await prisma.materiels.findMany({
                take: 20,
                select: {
                    id_materiels: true,
                    utilisateur: true,
                    id_n: true,
                    equipe: true,
                    caracteristiques: true,
                    date_pc: true,
                    date_ecran: true,
                    id_marque: true,
                    id_local: true,
                    marque: { select: { nom_marque: true } },
                    local: { select: { nom_local: true } },
                    user: { select: { id_n: true, role: true, emails: { where: { is_primary: true }, select: { email: true } } } }
                },
                orderBy: { id_materiels: 'desc' }
            });
            res.json(materiels);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // Endpoint pour tester la conversion de date
    router.post('/test-date', requireRole(UserRole.IT_ADMIN), async (req, res) => {
        try {
            const { dateValue } = req.body;
            const converted = validateDate(dateValue);

            res.json({
                original: dateValue,
                converted: converted ? converted.toISOString() : null,
                isValid: converted !== null
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // Endpoint temporaire de test/diagnostic pour l'import : rejoue le mapping de
    // colonnes et les extractions (local, matricule, utilisateur, dates, marque)
    // sur un échantillon, en lecture seule (aucune création en base), pour valider
    // un fichier avant de lancer le véritable import.
    router.post('/test-import', requireRole(UserRole.IT_ADMIN), async (req, res) => {
        try {
            const { items } = req.body;

            if (!items || !Array.isArray(items)) {
                return res.status(400).json({ error: 'Données invalides' });
            }

            const sample = items.slice(0, 20);
            const preview = [];

            for (let i = 0; i < sample.length; i++) {
                const item = sample[i];
                try {
                    const allKeys = Object.keys(item);

                    const localName = extractSiteFromItem(item);
                    let localExiste = false;
                    if (localName) {
                        const local = await prisma.locaux.findFirst({
                            where: { nom_local: { equals: localName.toString().trim(), mode: 'insensitive' } },
                            select: { id_local: true }
                        });
                        localExiste = !!local;
                    }

                    let id_n = null;
                    const matriculeKeys = ['N° Matricule', 'N°Matricule', 'Matricule', 'matricule', 'id_n', 'idN', 'Id_n', 'ID_N'];
                    for (const key of allKeys) {
                        if (!matriculeKeys.some(k => k.toLowerCase() === key.toLowerCase())) continue;
                        const value = item[key];
                        if (value === undefined || value === null || value === '') continue;
                        if (typeof value === 'number') { id_n = value; break; }
                        if (typeof value === 'string') {
                            const parsed = parseInt(value.trim());
                            if (!isNaN(parsed) && parsed > 0) { id_n = parsed; break; }
                        }
                    }

                    let utilisateurExiste = false;
                    if (id_n) {
                        const user = await prisma.users.findUnique({
                            where: { id_n: typeof id_n === 'string' ? parseInt(id_n) : id_n },
                            select: { id_user: true }
                        });
                        utilisateurExiste = !!user;
                    }

                    const nomUtilisateur = cleanString(findFieldValue(item, allKeys, ['Utilisateur', 'utilisateur', 'USER', 'User'])) || 'Utilisateur inconnu';
                    const equipe = cleanString(findFieldValue(item, allKeys, ['equipe', 'TEAM', 'Team'])) || 'Autres';

                    const rawDatePC = findFieldValue(item, allKeys, ['Date PC', 'Date_PC', 'date_pc', 'DatePc', 'datePc', 'date']);
                    const rawDateEcran = findFieldValue(item, allKeys, ['Date Écran', 'Date_Ecran', 'date_ecran', 'DateEcran', 'dateEcran']);
                    const convertedDatePC = validateDate(rawDatePC);
                    const convertedDateEcran = validateDate(rawDateEcran);

                    const caracteristiques = cleanString(findFieldValue(item, allKeys, ['Caractéristiques', 'caracteristiques', 'Caracteristiques', 'SPECS', 'Specs']) || 'Non spécifié') || 'Non spécifié';
                    const marqueExtraite = caracteristiques !== 'Non spécifié' ? extractMarqueFromCaracteristiques(caracteristiques) : null;

                    let marqueExiste = false;
                    if (marqueExtraite) {
                        const marque = await prisma.marques.findUnique({
                            where: { nom_marque: truncate(marqueExtraite.toUpperCase(), 100) },
                            select: { id_marque: true }
                        });
                        marqueExiste = !!marque;
                    }

                    preview.push({
                        index: i,
                        colonnes_detectees: allKeys,
                        local: { nom: localName, existe_deja: localExiste },
                        matricule: id_n,
                        utilisateur: { nom: nomUtilisateur, equipe, existe_deja: utilisateurExiste },
                        date_pc: { brut: rawDatePC ?? null, converti: convertedDatePC ? formatDateFR(convertedDatePC) : null },
                        date_ecran: { brut: rawDateEcran ?? null, converti: convertedDateEcran ? formatDateFR(convertedDateEcran) : null },
                        marque: { extraite: marqueExtraite, existe_deja: marqueExiste }
                    });

                } catch (individualError) {
                    preview.push({ index: i, error: individualError.message });
                }
            }

            res.json({
                total_recu: items.length,
                echantillon_teste: sample.length,
                preview
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
}

export default router;