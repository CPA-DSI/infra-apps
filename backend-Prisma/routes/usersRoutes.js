import express from 'express';
import prisma from '../prismaClient.js';
import bcrypt from 'bcryptjs';
import { authenticateToken, ensureActiveUser, requirePermission } from '../middleware/authMiddleware.js';
import { PERMISSIONS, UserRole } from '../constants/roles.js';
import { encryptPassMail, decryptPassMail, encryptSecret, decryptSecret } from '../services/passMailCrypto.js';
import { validateIdParam } from '../middleware/validateIdParam.js';
import { sendError } from '../middleware/errorHandler.js';

const router = express.Router();
router.param('id', validateIdParam);


// GET /api/users
router.get('/', authenticateToken, ensureActiveUser, requirePermission(PERMISSIONS.USERS_READ), async (req, res) => {
    try {
        const usersAvecDetails = await prisma.Users.findMany({
            include: {
                materiel: {
                    include: {
                        local: true,
                    },
                },
                emails: true,
            },
            orderBy: {
                id_n: 'asc'
            }
        });

        const result = usersAvecDetails.map(u => {
            const sanitizedEmails = sanitizeEmails(u.emails);
            return { ...u, emails: sanitizedEmails, ...mapEmailsToFlatFields(sanitizedEmails) };
        });
        res.json(result);

    } catch (error) {
        sendError(res, error, 'GET /api/users', 'Erreur serveur lors de la récupération des utilisateurs.');
    }
});

function sanitizeEmails(emails = []) {
    return emails.map(({ password, pass_mail, password_enc, ...email }) => ({
        ...email,
        pass_mail: decryptPassMail(pass_mail),
        password_enc: decryptSecret(password_enc)
    }));
}

function mapEmailsToFlatFields(emails = []) {
    const sorted = [...emails].sort((a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0) || a.id_uEmail - b.id_uEmail);
    return {
        email_1: sorted[0]?.email || null,
        pass_mail_1: sorted[0]?.pass_mail || null,
        email_2: sorted[1]?.email || null,
        pass_mail_2: sorted[1]?.pass_mail || null,
    };
}

// POST /api/users
router.post('/', authenticateToken, ensureActiveUser, requirePermission(PERMISSIONS.USERS_WRITE), async (req, res) => {
    try {
        const { id_n, email_1, pass_mail_1, password_1, email_2, pass_mail_2, password_2, emails } = req.body;

        const existingUser = await prisma.Users.findUnique({
            where: { id_n: parseInt(id_n) }
        });

        if (existingUser) {
            return res.status(400).json({ 
                error: "Ce utilisateur est déjà associé." 
            });
        }

        const salt = await bcrypt.genSalt(10);
        const autoPassword = "123456";
        const hashedPassword = await bcrypt.hash(autoPassword, salt);

        let emailsToCreate = [];

        if (Array.isArray(emails) && emails.length > 0) {
            const mapped = emails
                .filter(e => e.email && e.email.trim())
                .map((e, idx) => ({
                    email: e.email.trim().toLowerCase(),
                    pass_mail: e.pass_mail || '',
                    is_primary: idx === 0 ? true : (e.is_primary ?? false),
                    is_verified: e.is_verified ?? false,
                    rawPassword: e.password && e.password.trim() ? e.password.trim() : null
                }));

            if (mapped.length > 0 && !mapped.some(e => e.is_primary)) {
                mapped[0].is_primary = true;
            }

            emailsToCreate = await Promise.all(mapped.map(async (e) => ({
                email: e.email,
                password: e.rawPassword ? await bcrypt.hash(e.rawPassword, 10) : hashedPassword,
                password_enc: encryptSecret(e.rawPassword || autoPassword),
                pass_mail: encryptPassMail(e.pass_mail),
                is_primary: e.is_primary,
                is_verified: e.is_verified
            })));
        } else {
            const simple = [];
            if (email_1 && email_1.trim()) {
                simple.push({ email: email_1.trim().toLowerCase(), pass_mail: pass_mail_1, rawPassword: password_1, is_primary: true });
            }
            if (email_2 && email_2.trim()) {
                simple.push({ email: email_2.trim().toLowerCase(), pass_mail: pass_mail_2, rawPassword: password_2, is_primary: false });
            }

            emailsToCreate = await Promise.all(simple.map(async (e) => ({
                email: e.email,
                password: e.rawPassword ? await bcrypt.hash(e.rawPassword, 10) : hashedPassword,
                password_enc: encryptSecret(e.rawPassword || autoPassword),
                pass_mail: encryptPassMail(e.pass_mail),
                is_primary: e.is_primary,
                is_verified: false
            })));
        }

        const newUser = await prisma.Users.create({
            data: {
                id_n: parseInt(id_n),
                emails: {
                    create: emailsToCreate
                }
            },
            include: { emails: true }
        });

        const sanitizedEmails = sanitizeEmails(newUser.emails);
        const flat = mapEmailsToFlatFields(sanitizedEmails);
        res.status(201).json({ ...newUser, emails: sanitizedEmails, ...flat });
    } catch (error) {
        sendError(res, error, 'POST /api/users', "Erreur lors de la création de l'utilisateur.");
    }
});

// POST /api/users/import - Import en masse depuis Excel (colonnes de l'export utilisateurs)
router.post('/import', authenticateToken, ensureActiveUser, requirePermission(PERMISSIONS.USERS_WRITE), async (req, res) => {
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "Aucune donnée à importer." });
    }

    const ROLE_LABELS = { 'Admin IT': 'IT_ADMIN', 'Direction': 'DIRECTION', 'Utilisateur': 'USER' };
    const normalizeRole = (value) => {
        if (!value) return 'USER';
        const v = String(value).trim();
        const upper = v.toUpperCase();
        if (['USER', 'IT_ADMIN', 'DIRECTION'].includes(upper)) return upper;
        return ROLE_LABELS[v] || 'USER';
    };
    const normalizeStatus = (value) => {
        if (typeof value === 'boolean') return value;
        const v = String(value ?? '').trim().toLowerCase();
        return !['désactivé', 'desactive', 'désactive', 'inactif', 'false', '0', 'non', 'no'].includes(v);
    };

    const defaultPasswordHash = await bcrypt.hash('123456', 10);
    const defaultPasswordEnc = encryptSecret('123456');

    const stats = { success: 0, failed: 0, warnings: 0 };
    const errors = [];

    // --- Détection des doublons avant toute écriture ---
    // Deux cas rejetés sans arbitrage (aucune ligne "gagnante" choisie, l'utilisateur
    // doit corriger son fichier) :
    //  1. Un même N° (id_n) apparaît sur plusieurs lignes du fichier.
    //  2. Un même email est réclamé par plusieurs N° différents, que ce soit entre
    //     deux lignes du fichier ou parce qu'il appartient déjà en base à un autre
    //     utilisateur. Sans ce contrôle, l'upsert imbriqué de Prisma (where: { email })
    //     réattribuerait silencieusement l'email à l'utilisateur traité en dernier.
    const idNCounts = new Map();
    const emailClaims = new Map(); // email (normalisé) -> Set des id_n qui le réclament

    for (const item of items) {
        const id_n = parseInt(item.id_n, 10);
        if (!Number.isFinite(id_n)) continue;
        idNCounts.set(id_n, (idNCounts.get(id_n) || 0) + 1);

        for (const raw of [item.email_1, item.email_2]) {
            if (!raw || !String(raw).trim()) continue;
            const email = String(raw).trim().toLowerCase();
            if (!emailClaims.has(email)) emailClaims.set(email, new Set());
            emailClaims.get(email).add(id_n);
        }
    }

    const allFileEmails = [...emailClaims.keys()];
    const existingOwners = allFileEmails.length > 0
        ? await prisma.userEmail.findMany({
            where: { email: { in: allFileEmails } },
            select: { email: true, user: { select: { id_n: true } } }
        })
        : [];
    for (const owner of existingOwners) {
        emailClaims.get(owner.email)?.add(owner.user.id_n);
    }

    const conflictedIdNs = new Map(); // id_n -> liste de raisons du rejet
    const addConflict = (id_n, reason) => {
        if (!conflictedIdNs.has(id_n)) conflictedIdNs.set(id_n, []);
        conflictedIdNs.get(id_n).push(reason);
    };
    for (const [id_n, count] of idNCounts) {
        if (count > 1) addConflict(id_n, `le N° ${id_n} apparaît ${count} fois dans le fichier`);
    }
    for (const [email, idNs] of emailClaims) {
        if (idNs.size > 1) {
            const list = [...idNs].join(', ');
            idNs.forEach(id_n => addConflict(id_n, `l'email "${email}" est partagé avec le(s) N° ${list}`));
        }
    }

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const rowLabel = `Ligne ${i + 2}`;
        try {
            const id_n = parseInt(item.id_n, 10);
            if (!Number.isFinite(id_n)) {
                stats.failed++;
                errors.push(`${rowLabel}: N° invalide.`);
                continue;
            }

            if (conflictedIdNs.has(id_n)) {
                stats.failed++;
                errors.push(`${rowLabel}: ${conflictedIdNs.get(id_n).join(' ; ')} (ligne ignorée).`);
                continue;
            }

            let role = normalizeRole(item.role);
            let is_active = normalizeStatus(item.is_active);

            // Une cellule vide (ou une colonne absente) signifie « ne rien changer » :
            // pass_mail vaut null quand il n'est pas fourni.
            const cell = (value) => (value === undefined || value === null ? '' : String(value).trim());
            const desiredEmails = [];
            if (cell(item.email_1)) {
                desiredEmails.push({
                    email: cell(item.email_1).toLowerCase(),
                    pass_mail: cell(item.pass_mail_1) || null,
                    is_primary: true
                });
            }
            if (cell(item.email_2)) {
                desiredEmails.push({
                    email: cell(item.email_2).toLowerCase(),
                    pass_mail: cell(item.pass_mail_2) || null,
                    is_primary: false
                });
            }

            const existingUser = await prisma.Users.findUnique({ where: { id_n }, include: { emails: true } });

            // Seul l'email secondaire est fourni : il devient principal si le compte
            // n'en garde aucun autre (sinon l'utilisateur n'aurait pas d'email principal).
            const secondaireSeul = desiredEmails.length === 1 && !desiredEmails[0].is_primary ? desiredEmails[0] : null;
            if (secondaireSeul && !(existingUser?.emails || []).some(e => e.is_primary && e.email !== secondaireSeul.email)) {
                secondaireSeul.is_primary = true;
            }

            if (existingUser) {
                // Un utilisateur ne peut pas modifier son propre rôle ni son propre statut
                // (pas d'auto-rétrogradation ni d'auto-désactivation via l'import).
                if (existingUser.id_user === req.user?.userId
                    && (role !== existingUser.role || is_active !== existingUser.is_active)) {
                    role = existingUser.role;
                    is_active = existingUser.is_active;
                    stats.warnings++;
                    errors.push(`${rowLabel}: votre propre rôle/statut ne peut pas être modifié (valeurs actuelles conservées).`);
                }

                // Un email existant n'est supprimé que s'il est remplacé par un autre
                // dans le même emplacement (principal / secondaire). Une ligne sans
                // email ne vide donc jamais le compte, qui garde au moins un email.
                const currentEmails = existingUser.emails || [];
                if (desiredEmails.length === 0 && currentEmails.length > 0) {
                    stats.warnings++;
                    errors.push(`${rowLabel}: aucun email fourni, emails existants conservés.`);
                }
                const desiredValues = desiredEmails.map(e => e.email);
                const slot1Fourni = Boolean(cell(item.email_1));
                const slot2Fourni = Boolean(cell(item.email_2));
                const toDelete = currentEmails.filter(e =>
                    !desiredValues.includes(e.email) && (e.is_primary ? slot1Fourni : slot2Fourni)
                );

                // Suppression des emails retirés + mise à jour dans une même transaction
                await prisma.$transaction(async (tx) => {
                    if (toDelete.length) {
                        await tx.userEmail.deleteMany({ where: { id_uEmail: { in: toDelete.map(e => e.id_uEmail) } } });
                    }

                    await tx.users.update({
                        where: { id_n },
                        data: {
                            role,
                            is_active,
                            ...(desiredEmails.length ? {
                                emails: {
                                    upsert: desiredEmails.map(e => ({
                                        where: { email: e.email },
                                        update: {
                                            ...(e.pass_mail ? { pass_mail: encryptPassMail(e.pass_mail) } : {}),
                                            is_primary: e.is_primary
                                        },
                                        create: {
                                            email: e.email,
                                            password: defaultPasswordHash,
                                            password_enc: defaultPasswordEnc,
                                            pass_mail: encryptPassMail(e.pass_mail || ''),
                                            is_primary: e.is_primary,
                                            is_verified: false
                                        }
                                    }))
                                }
                            } : {})
                        }
                    });
                });
            } else {
                await prisma.Users.create({
                    data: {
                        id_n,
                        role,
                        is_active,
                        emails: {
                            create: desiredEmails.map(e => ({
                                email: e.email,
                                password: defaultPasswordHash,
                                password_enc: defaultPasswordEnc,
                                pass_mail: encryptPassMail(e.pass_mail || ''),
                                is_primary: e.is_primary,
                                is_verified: false
                            }))
                        }
                    }
                });
            }

            stats.success++;
        } catch (error) {
            console.error(`Erreur import utilisateur (${rowLabel}):`, error.message);
            stats.failed++;
            errors.push(`${rowLabel}: ${error.message}`);
        }
    }

    res.json({ message: 'Import terminé.', stats, errors });
});

// PUT /api/users/:id
router.put('/:id', authenticateToken, ensureActiveUser, requirePermission(PERMISSIONS.USERS_WRITE), async (req, res) => {
    try {
        // Champs lus explicitement : aucune autre clé du body n'est transmise à Prisma
        // (id_user, materiel, must_change_password... sont ignorés).
        const { id_n, role, is_active, emails, email_1, pass_mail_1, password_1, is_verified_1, email_2, pass_mail_2, password_2, is_verified_2 } = req.body;

        const currentUser = await prisma.Users.findUnique({
            where: { id_user: parseInt(req.params.id) },
            include: { emails: true }
        });

        if (!currentUser) {
            return res.status(404).json({ error: "Utilisateur non trouvé." });
        }

        // Le N° (id_n) n'est pas modifiable : l'interface l'envoie en lecture seule.
        if (id_n !== undefined && id_n !== null && id_n !== '' && Number(id_n) !== currentUser.id_n) {
            return res.status(400).json({ error: "Le N° de l'utilisateur ne peut pas être modifié." });
        }

        // Liste blanche des champs du compte modifiables via cette route
        const userDataToUpdate = {};

        if (role !== undefined) {
            if (!Object.values(UserRole).includes(role)) {
                return res.status(400).json({ error: "Rôle invalide." });
            }
            userDataToUpdate.role = role;
        }

        if (is_active !== undefined) {
            if (typeof is_active !== 'boolean') {
                return res.status(400).json({ error: "Le champ is_active doit être un booléen." });
            }
            userDataToUpdate.is_active = is_active;
        }

        // Un utilisateur ne peut pas changer son propre rôle ni son propre statut
        // (évite l'auto-désactivation / l'auto-rétrogradation qui bloquerait le compte).
        const isSelf = currentUser.id_user === req.user?.userId;
        if (isSelf && (
            (userDataToUpdate.role !== undefined && userDataToUpdate.role !== currentUser.role) ||
            (userDataToUpdate.is_active !== undefined && userDataToUpdate.is_active !== currentUser.is_active)
        )) {
            return res.status(403).json({ error: "Vous ne pouvez pas modifier votre propre rôle ou statut." });
        }

        let desiredEmails = [];

        if (Array.isArray(emails) && emails.length > 0) {
            desiredEmails = emails
                .filter(e => e.email && e.email.trim())
                .map((e, idx) => ({
                    email: e.email.trim().toLowerCase(),
                    pass_mail: e.pass_mail || '',
                    password: e.password || '',
                    is_primary: idx === 0 ? true : (e.is_primary ?? false),
                    is_verified: e.is_verified ?? false
                }));

            if (desiredEmails.length > 0 && !desiredEmails.some(e => e.is_primary)) {
                desiredEmails[0].is_primary = true;
            }
        } else {
            desiredEmails = [];
            if (email_1 && email_1.trim()) {
                desiredEmails.push({ email: email_1.trim().toLowerCase(), pass_mail: pass_mail_1, password: password_1, is_primary: true, is_verified: is_verified_1 });
            }
            if (email_2 && email_2.trim()) {
                desiredEmails.push({ email: email_2.trim().toLowerCase(), pass_mail: pass_mail_2, password: password_2, is_primary: false, is_verified: is_verified_2 });
            }
        }

        const hashedEmails = await Promise.all(desiredEmails.map(async (e) => ({
            ...e,
            pass_mail: encryptPassMail(e.pass_mail),
            hashedPassword: e.password ? await bcrypt.hash(e.password, 10) : null,
            passwordEnc: e.password ? encryptSecret(e.password) : null
        })));
        const defaultPasswordHash = await bcrypt.hash('123456', 10);
        const defaultPasswordEnc = encryptSecret('123456');

        const currentEmails = currentUser.emails || [];
        const desiredEmailValues = hashedEmails.map(e => e.email);
        const toDelete = currentEmails.filter(e => !desiredEmailValues.includes(e.email));

        // Suppression des emails retirés + mise à jour du compte dans une même transaction
        const updated = await prisma.$transaction(async (tx) => {
            if (toDelete.length) {
                await tx.userEmail.deleteMany({
                    where: { id_uEmail: { in: toDelete.map(e => e.id_uEmail) } }
                });
            }

            return tx.users.update({
                where: { id_user: parseInt(req.params.id) },
                data: {
                    ...userDataToUpdate,
                    ...(hashedEmails.length ? {
                        emails: {
                            upsert: hashedEmails.map(e => {
                                const updateData = {
                                    pass_mail: e.pass_mail,
                                    is_primary: e.is_primary,
                                    is_verified: e.is_verified
                                };
                                if (e.hashedPassword) {
                                    updateData.password = e.hashedPassword;
                                    updateData.password_enc = e.passwordEnc;
                                }
                                return {
                                    where: { email: e.email },
                                    update: updateData,
                                    create: {
                                        email: e.email,
                                        password: e.hashedPassword || defaultPasswordHash,
                                        password_enc: e.passwordEnc || defaultPasswordEnc,
                                        pass_mail: e.pass_mail,
                                        is_primary: e.is_primary,
                                        is_verified: e.is_verified
                                    }
                                };
                            })
                        }
                    } : {})
                },
                include: { emails: true }
            });
        });

        const sanitizedEmails = sanitizeEmails(updated.emails);
        const flat = mapEmailsToFlatFields(sanitizedEmails);
        res.json({ ...updated, emails: sanitizedEmails, ...flat });
    } catch (error) {
        sendError(res, error, 'PUT /api/users/:id', "Erreur lors de la mise à jour de l'utilisateur.");
    }
});

// PATCH /api/users/:id/status
// Bascule uniquement is_active, sans toucher aux emails : ne dépend pas de PASS_MAIL_ENCRYPTION_KEY.
router.patch('/:id/status', authenticateToken, ensureActiveUser, requirePermission(PERMISSIONS.USERS_WRITE), async (req, res) => {
    try {
        const { is_active } = req.body;
        if (typeof is_active !== 'boolean') {
            return res.status(400).json({ error: "Le champ is_active (booléen) est requis." });
        }

        const id_user = parseInt(req.params.id);
        if (isNaN(id_user)) {
            return res.status(400).json({ error: "ID utilisateur invalide." });
        }

        // Un utilisateur ne peut pas (dés)activer son propre compte.
        if (id_user === req.user?.userId) {
            return res.status(403).json({ error: "Vous ne pouvez pas modifier votre propre statut." });
        }

        const updated = await prisma.Users.update({
            where: { id_user },
            data: { is_active },
            select: { id_user: true, id_n: true, is_active: true }
        });

        res.json(updated);
    } catch (error) {
        sendError(res, error, 'PATCH /api/users/:id/status', 'Erreur lors du changement de statut.');
    }
});

// DELETE /api/users/:id
router.delete('/:id', authenticateToken, ensureActiveUser, requirePermission(PERMISSIONS.USERS_DELETE), async (req, res) => {
    try {
        if (!req.params.id) {
            return res.status(400).json({ error: "ID utilisateur manquant pour la suppression." });
        }

        const id_user = parseInt(req.params.id);
        if (isNaN(id_user)) {
            return res.status(400).json({ error: "ID utilisateur invalide." });
        }

        const user = await prisma.Users.findUnique({
            where: { id_user },
            select: { id_n: true }
        });

        if (!user) {
            return res.status(404).json({ error: "Utilisateur non trouvé." });
        }

        // Détachement des tickets + suppressions liées dans une même transaction :
        // en cas d'échec, rien n'est supprimé à moitié.
        await prisma.$transaction(async (tx) => {
            await tx.ticket.updateMany({
                where: { idDemandeur: user.id_n },
                data: { idDemandeur: null }
            });

            await tx.ticket.updateMany({
                where: { idAssigne: user.id_n },
                data: { idAssigne: null }
            });

            await tx.ticketFermeture.deleteMany({
                where: { fermePar: user.id_n }
            });

            await tx.historiqueCommentaire.deleteMany({
                where: { idAuteur: user.id_n }
            });

            await tx.userEmail.deleteMany({
                where: { user_id: id_user }
            });

            await tx.users.delete({
                where: { id_user }
            });
        });
        res.json({ message: "Utilisateur supprimé avec succès" });
    } catch (error) {
        sendError(res, error, 'DELETE /api/users/:id', "Erreur lors de la suppression de l'utilisateur.");
    }
});



export default router; 
