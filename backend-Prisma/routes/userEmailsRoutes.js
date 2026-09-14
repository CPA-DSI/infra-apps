import express from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { authenticateToken, ensureActiveUser, requirePermission } from '../middleware/authMiddleware.js';
import { PERMISSIONS } from '../constants/roles.js';

const prisma = new PrismaClient();
const router = express.Router();

const omitEmailPassword = (userEmail) => {
    if (!userEmail) return userEmail;
    const { password, ...rest } = userEmail;
    return rest;
};

router.get('/stats', authenticateToken, ensureActiveUser, requirePermission(PERMISSIONS.USERS_READ), async (req, res) => {
    try {
        const totalEmails = await prisma.userEmail.count();
        const primaryEmails = await prisma.userEmail.count({ where: { is_primary: true } });
        const secondaryEmails = await prisma.userEmail.count({ where: { is_primary: false } });
        const verifiedEmails = await prisma.userEmail.count({ where: { is_verified: true } });
        const nonVerifiedEmails = await prisma.userEmail.count({ where: { is_verified: false } });

        res.json({
            totalEmails,
            primaryEmails,
            secondaryEmails,
            verifiedEmails,
            nonVerifiedEmails,
            details: [
                { label: 'Mails Primaires', count: primaryEmails },
                { label: 'Mails Secondaires', count: secondaryEmails },
                { label: 'Mails Vérifiés', count: verifiedEmails },
                { label: 'Mails Non Vérifiés', count: nonVerifiedEmails },
            ],
        });
    } catch (error) {
        console.error('Erreur lors du comptage des emails utilisateur:', error);
        res.status(500).json({ error: error.message });
    }
});

router.post('/', authenticateToken, ensureActiveUser, requirePermission(PERMISSIONS.USERS_WRITE), async (req, res) => {
    try {
        const { user_id, email, password, pass_mail, is_primary, is_verified } = req.body;

        if (!user_id || !email || !email.trim()) {
            return res.status(400).json({ message: "L'ID utilisateur et l'email sont requis." });
        }

        const trimmedEmail = email.trim().toLowerCase();

        const existingUser = await prisma.Users.findUnique({
            where: { id_user: parseInt(user_id) },
            include: { emails: true }
        });

        if (!existingUser) {
            return res.status(404).json({ message: "Utilisateur non trouvé." });
        }

        const alreadyExists = existingUser.emails.find(e => e.email === trimmedEmail);
        if (alreadyExists) {
            return res.status(400).json({ message: "Cet email est déjà associé à cet utilisateur." });
        }

        const hashedPassword = password && password.trim() !== ''
            ? await bcrypt.hash(password.trim(), 10)
            : await bcrypt.hash('123456', 10);

        const newEmail = await prisma.userEmail.create({
            data: {
                email: trimmedEmail,
                password: hashedPassword,
                pass_mail: pass_mail || '',
                is_primary: is_primary ?? false,
                is_verified: is_verified ?? false,
                user_id: parseInt(user_id)
            },
            include: { user: { include: { materiel: true } } }
        });

        res.status(201).json(omitEmailPassword(newEmail));
    } catch (error) {
        console.error("Erreur lors de la création de l'email:", error);
        res.status(400).json({ message: error.message });
    }
});

router.put('/:id', authenticateToken, ensureActiveUser, requirePermission(PERMISSIONS.USERS_WRITE), async (req, res) => {
    try {
        const { email, password, pass_mail, is_primary, is_verified } = req.body;
        const id_uEmail = parseInt(req.params.id);

        if (isNaN(id_uEmail)) {
            return res.status(400).json({ message: "ID email invalide." });
        }

        const existingEmail = await prisma.userEmail.findUnique({
            where: { id_uEmail },
            include: { user: true }
        });

        if (!existingEmail) {
            return res.status(404).json({ message: "Email non trouvé." });
        }

        const updateData = {
            email,
            is_primary: is_primary ?? existingEmail.is_primary,
            is_verified: is_verified ?? existingEmail.is_verified,
        };

        if (pass_mail !== undefined) {
            updateData.pass_mail = pass_mail;
        }

        if (password && password.trim() !== '') {
            updateData.password = await bcrypt.hash(password.trim(), 10);
        }

        const updated = await prisma.userEmail.update({
            where: { id_uEmail },
            data: updateData,
            include: { user: { include: { materiel: true } } }
        });

        res.json(omitEmailPassword(updated));
    } catch (error) {
        console.error("Erreur lors de la mise à jour de l'email:", error);
        res.status(400).json({ message: error.message });
    }
});

router.get('/:id', authenticateToken, ensureActiveUser, requirePermission(PERMISSIONS.USERS_READ), async (req, res) => {
    try {
        const id_uEmail = parseInt(req.params.id);

        if (isNaN(id_uEmail)) {
            return res.status(400).json({ message: "ID email invalide." });
        }

        const email = await prisma.userEmail.findUnique({
            where: { id_uEmail },
            include: { user: { include: { materiel: true } } }
        });
        if (!email) {
            return res.status(404).json({ message: "Email non trouvé." });
        }
        res.json(omitEmailPassword(email));
    } catch (error) {
        console.error("Erreur lors de la récupération de l'email:", error);
        res.status(500).json({ message: error.message });
    }
});

export default router;
