import express from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { authenticateToken, ensureActiveUser, requirePermission } from '../middleware/authMiddleware.js';
import { PERMISSIONS } from '../constants/roles.js';

const prisma = new PrismaClient();
const router = express.Router();


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

        const result = usersAvecDetails.map(u => ({ ...u, ...mapEmailsToFlatFields(u.emails) }));
        res.json(result);

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Erreur serveur lors de la récupération des utilisateurs." });
    }
});

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
                message: "Ce utilisateur est déjà associé." 
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
                pass_mail: e.pass_mail,
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
                pass_mail: e.pass_mail,
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

        const flat = mapEmailsToFlatFields(newUser.emails);
        res.status(201).json({ ...newUser, ...flat });
    } catch (error) {
        console.error("Erreur backend lors de l'ajout d'utilisateur:", error);
        res.status(500).json({ message: "Erreur lors de la création : " + error.message });
    }
});

// PUT /api/users/:id
router.put('/:id', authenticateToken, ensureActiveUser, requirePermission(PERMISSIONS.USERS_WRITE), async (req, res) => {
    try {
        const { materiel, id_user, emails, email_1, pass_mail_1, password_1, is_verified_1, email_2, pass_mail_2, password_2, is_verified_2, ...userDataToUpdate } = req.body;

        const currentUser = await prisma.Users.findUnique({
            where: { id_user: parseInt(req.params.id) },
            include: { emails: true }
        });

        if (!currentUser) {
            return res.status(404).json({ message: "Utilisateur non trouvé." });
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
            hashedPassword: e.password ? await bcrypt.hash(e.password, 10) : null
        })));
        const defaultPasswordHash = await bcrypt.hash('123456', 10);

        const currentEmails = currentUser.emails || [];
        const desiredEmailValues = hashedEmails.map(e => e.email);
        const toDelete = currentEmails.filter(e => !desiredEmailValues.includes(e.email));

        if (toDelete.length) {
            await prisma.userEmail.deleteMany({
                where: { id_uEmail: { in: toDelete.map(e => e.id_uEmail) } }
            });
        }

        const updated = await prisma.Users.update({
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
                            }
                            return {
                                where: { email: e.email },
                                update: updateData,
                                create: {
                                    email: e.email,
                                    password: e.hashedPassword || defaultPasswordHash,
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

        const flat = mapEmailsToFlatFields(updated.emails);
        res.json({ ...updated, ...flat });
    } catch (error) {
        console.error("Prisma update error:", error.message);
        res.status(400).json({ message: error.message });
    }
});

// DELETE /api/users/:id
router.delete('/:id', authenticateToken, ensureActiveUser, requirePermission(PERMISSIONS.USERS_DELETE), async (req, res) => {
    try {
        if (!req.params.id) {
            return res.status(400).json({ message: "ID utilisateur manquant pour la suppression." });
        }

        const id_user = parseInt(req.params.id);
        if (isNaN(id_user)) {
            return res.status(400).json({ message: "ID utilisateur invalide." });
        }

        const user = await prisma.Users.findUnique({
            where: { id_user },
            select: { id_n: true }
        });

        if (!user) {
            return res.status(404).json({ message: "Utilisateur non trouvé." });
        }

        await prisma.ticket.updateMany({
            where: { idDemandeur: user.id_n },
            data: { idDemandeur: null }
        });

        await prisma.ticket.updateMany({
            where: { idAssigne: user.id_n },
            data: { idAssigne: null }
        });

        await prisma.ticketFermeture.deleteMany({
            where: { fermePar: user.id_n }
        });

        await prisma.historiqueCommentaire.deleteMany({
            where: { idAuteur: user.id_n }
        });

        await prisma.userEmail.deleteMany({
            where: { user_id: id_user }
        });

        await prisma.Users.delete({
            where: { id_user }
        });
        res.json({ message: "Utilisateur supprimé avec succès" });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});



export default router; 
