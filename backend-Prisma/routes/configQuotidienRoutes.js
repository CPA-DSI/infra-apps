import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, ensureActiveUser, requirePermission } from '../middleware/authMiddleware.js';
import { PERMISSIONS } from '../constants/roles.js';

const router = express.Router();
const prisma = new PrismaClient();

// Middleware pour gérer les erreurs de manière centralisée
const asyncHandler = fn => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

router.use(authenticateToken, ensureActiveUser);

// ============================================
// CONFIGURATION QUOTIDIENNE - Endpoints API
// ============================================

// --- READ: GET /api/config/quotidien ---
// Récupère la configuration quotidienne actuelle
router.get('/quotidien', requirePermission(PERMISSIONS.CONFIG_READ), asyncHandler(async (req, res) => {
    const config = await prisma.configEmailQuotidien.findUnique({
        where: { id: 1 },
    });
    
    // Retourner un objet par défaut si aucune configuration n'existe
    if (!config) {
        const defaultConfig = {
            id: 1,
            email_dest: '',
            email_exp: '',
            email_pass: '',
            objet_mail: 'Rapport Quotidien des Stocks',
            message_mail: 'Bonjour, veuillez trouver ci-joint le rapport des stocks.',
            heure_envoi: '17:15',
            cron_actif: false
        };
        res.json(defaultConfig);
        return;
    }
    
    res.json(config);
}));

// --- CREATE/UPDATE: POST /api/config/quotidien ---
// Crée ou met à jour la configuration quotidienne
router.post('/quotidien', requirePermission(PERMISSIONS.CONFIG_WRITE), asyncHandler(async (req, res) => {
    const data = req.body;
    
    // Supprimer l'ID du corps de la requête s'il est présent
    delete data.id;
    delete data.created_at;
    delete data.updated_at;
    
    // Données à sauvegarder (seuls les champs pertinents pour quotidien)
    const configData = {
        email_dest: data.email_dest || '',
        email_exp: data.email_exp || '',
        email_pass: data.email_pass || '',
        objet_mail: data.objet_mail || 'Rapport Quotidien des Stocks',
        message_mail: data.message_mail || 'Bonjour, veuillez trouver ci-joint le rapport des stocks.',
        heure_envoi: data.heure_envoi || '17:15',
        cron_actif: data.cron_actif !== undefined ? data.cron_actif : false
    };
    
    const config = await prisma.configEmailQuotidien.upsert({
        where: { id: 1 },
        update: configData,
        create: {
            id: 1,
            ...configData
        },
    });
    
    res.status(200).json(config);
}));

// --- DELETE: DELETE /api/config/quotidien ---
// Supprime la configuration quotidienne (réinitialisation)
router.delete('/quotidien', requirePermission(PERMISSIONS.CONFIG_WRITE), asyncHandler(async (req, res) => {
    await prisma.configEmailQuotidien.delete({
        where: { id: 1 },
    }).catch(() => {
        // Ignorer l'erreur si l'entrée n'existe pas
    });
    
    res.status(200).json({ message: 'Configuration quotidienne réinitialisée' });
}));

// --- STATUS: GET /api/config/quotidien/status ---
// Retourne le statut du cron quotidien
router.get('/quotidien/status', requirePermission(PERMISSIONS.CONFIG_READ), asyncHandler(async (req, res) => {
    const config = await prisma.configEmailQuotidien.findUnique({
        where: { id: 1 },
        select: {
            cron_actif: true,
            heure_envoi: true
        }
    });
    
    res.json({
        actif: config?.cron_actif || false,
        heure_envoi: config?.heure_envoi || '17:15'
    });
}));

export default router;
