import express from 'express';
import { PrismaClient } from '@prisma/client';
import nodemailer from 'nodemailer';
import { authenticateToken, ensureActiveUser, requirePermission } from '../middleware/authMiddleware.js';
import { PERMISSIONS } from '../constants/roles.js';
import { generateExcelReport, sendEmail } from '../services/reportService.js';

const router = express.Router();
const prisma = new PrismaClient();

const asyncHandler = fn => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

router.use(authenticateToken, ensureActiveUser, requirePermission(PERMISSIONS.CONFIG_WRITE));

router.post('/send-report', asyncHandler(async (req, res) => {
    const configQuotidien = await prisma.configEmailQuotidien.findUnique({ where: { id: 1 } });
    const configHebdo = await prisma.configEmailHebdomadaire.findUnique({ where: { id: 1 } });

    let config = null;
    if (configQuotidien && configQuotidien.email_exp) {
        config = configQuotidien;
    } else if (configHebdo && configHebdo.email_exp) {
        config = configHebdo;
    }

    if (!config || !config.email_exp) return res.status(400).json({ message: "Configuration email manquante." });

    const now = new Date();
    const fullDateTime = `${now.toLocaleDateString('fr-FR').replace(/\//g, '-')}_${now.getHours()}h${String(now.getMinutes()).padStart(2, '0')}`;

    const buffer = await generateExcelReport(prisma);
    await sendEmail(
        config,
        config.objet_mail || `Rapport Stock Complet - ${fullDateTime}`,
        config.message_mail || "Ci-joint l'export complet automatique.",
        buffer,
        `Rapport_Complet_${fullDateTime}.xlsx`,
        'Logistique'
    );

    res.status(200).json({ success: true, message: "Rapport avec auto-ajustement envoyé." });
}));

// --- Route de test pour email quotidien ---
router.post('/send-test-quotidien', asyncHandler(async (req, res) => {
    const config = await prisma.configEmailQuotidien.findUnique({ where: { id: 1 } });
    
    if (!config || !config.email_exp || !config.email_dest) {
        return res.status(400).json({ message: "Configuration email quotidienne manquante. Veuillez d'abord sauvegarder la configuration." });
    }

    const now = new Date();
    const fullDateTime = `${now.toLocaleDateString('fr-FR').replace(/\//g, '-')}_${now.getHours()}h${String(now.getMinutes()).padStart(2, '0')}`;

    const transporter = nodemailer.createTransport({
        host: "smtp.ionos.fr", port: 465, secure: true,
        auth: { user: config.email_exp, pass: config.email_pass }
    });

    await transporter.sendMail({
        from: `"Logistique Test" <${config.email_exp}>`,
        to: config.email_dest,
        subject: config.objet_mail ? `${config.objet_mail} - TEST` : `Rapport Quotidien - TEST ${fullDateTime}`,
        text: config.message_mail || "Ceci est un email de test pour vérifier la configuration."
    });

    res.status(200).json({ success: true, message: "Email de test quotidien envoyé avec succès !" });
}));

// --- Route de test pour email hebdomadaire ---
router.post('/send-test-hebdomadaire', asyncHandler(async (req, res) => {
    const config = await prisma.configEmailHebdomadaire.findUnique({ where: { id: 1 } });
    
    if (!config || !config.email_exp || !config.email_dest) {
        return res.status(400).json({ message: "Configuration email hebdomadaire manquante. Veuillez d'abord sauvegarder la configuration." });
    }

    const now = new Date();
    const fullDateTime = `${now.toLocaleDateString('fr-FR').replace(/\//g, '-')}_${now.getHours()}h${String(now.getMinutes()).padStart(2, '0')}`;

    const transporter = nodemailer.createTransport({
        host: "smtp.ionos.fr", port: 465, secure: true,
        auth: { user: config.email_exp, pass: config.email_pass }
    });

    await transporter.sendMail({
        from: `"Logistique Test" <${config.email_exp}>`,
        to: config.email_dest,
        subject: config.objet_mail_hebdo ? `${config.objet_mail_hebdo} - TEST` : `Rapport Hebdomadaire - TEST ${fullDateTime}`,
        text: config.message_mail_hebdo || "Ceci est un email de test pour vérifier la configuration."
    });

    res.status(200).json({ success: true, message: "Email de test hebdomadaire envoyé avec succès !" });
}));

// --- Route de test pour email mensuel ---
router.post('/send-test-mensuel', asyncHandler(async (req, res) => {
    // Récupérer la configuration mensuelle
    const config = await prisma.configEmailMensuel.findUnique({ where: { id: 1 } });
    
    if (!config || !config.email_exp || !config.email_dest) {
        return res.status(400).json({ 
            message: "Configuration email mensuelle manquante. Veuillez d'abord sauvegarder la configuration." 
        });
    }

    const now = new Date();
    const fullDateTime = `${now.toLocaleDateString('fr-FR').replace(/\//g, '-')}_${now.getHours()}h${String(now.getMinutes()).padStart(2, '0')}`;

    const transporter = nodemailer.createTransport({
        host: "smtp.ionos.fr", 
        port: 465, 
        secure: true,
        auth: { 
            user: config.email_exp, 
            pass: config.email_pass 
        }
    });

    try {
        await transporter.sendMail({
            from: `"Logistique Test" <${config.email_exp}>`,
            to: config.email_dest,
            subject: config.objet_mail_mensuel ? 
                `${config.objet_mail_mensuel} - TEST` : 
                `Rapport Mensuel - TEST ${fullDateTime}`,
            text: config.message_mail_mensuel || 
                "Ceci est un email de test pour vérifier la configuration mensuelle."
        });

        res.status(200).json({ 
            success: true, 
            message: "Email de test mensuel envoyé avec succès !" 
        });
    } catch (error) {
        console.error("Erreur d'envoi d'email:", error);
        res.status(500).json({ 
            success: false, 
            message: "Erreur lors de l'envoi de l'email de test: " + error.message 
        });
    }
}));

export default router;