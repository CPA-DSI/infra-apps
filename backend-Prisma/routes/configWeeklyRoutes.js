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
// CONFIGURATION HEBDOMADAIRE - Endpoints API
// ============================================

// --- READ: GET /api/config/hebdomadaire ---
// Récupère la configuration hebdomadaire actuelle
router.get('/hebdomadaire', requirePermission(PERMISSIONS.CONFIG_READ), asyncHandler(async (req, res) => {
    const config = await prisma.configEmailHebdomadaire.findUnique({
        where: { id: 1 },
    });
    
    // Retourner un objet par défaut si aucune configuration n'existe
    if (!config) {
        const defaultConfig = {
            id: 1,
            email_dest: '',
            email_exp: '',
            email_pass: '',
            type_envoi: 'hebdomadaire',
            jour_envoi: 1,
            heure_envoi: '17:15',
            cron_actif_hebdo: false,
            objet_mail_hebdo: 'Rapport Hebdomadaire des Stocks',
            message_mail_hebdo: 'Bonjour, veuillez trouver ci-joint le rapport hebdomadaire des stocks.',
            actif: true,
            filtre_equipe: null,
            include_materiels: true,
            include_produits: true
        };
        res.json(defaultConfig);
        return;
    }
    
    res.json(config);
}));

// --- CREATE/UPDATE: POST /api/config/hebdomadaire ---
// Crée ou met à jour la configuration hebdomadaire
router.post('/hebdomadaire', requirePermission(PERMISSIONS.CONFIG_WRITE), asyncHandler(async (req, res) => {
    const data = req.body;
    
    // Supprimer l'ID du corps de la requête s'il est présent
    delete data.id;
    delete data.created_at;
    delete data.updated_at;
    
    // Données à sauvegarder (seuls les champs pertinents pour hebdomadaire)
    const configData = {
        email_dest: data.email_dest || '',
        email_exp: data.email_exp || '',
        email_pass: data.email_pass || '',
        type_envoi: 'hebdomadaire',
        jour_envoi: data.jour_envoi !== undefined ? parseInt(data.jour_envoi) : 1,
        heure_envoi: data.heure_envoi || '17:15',
        cron_actif_hebdo: data.cron_actif_hebdo || false,
        objet_mail_hebdo: data.objet_mail_hebdo || 'Rapport Hebdomadaire des Stocks',
        message_mail_hebdo: data.message_mail_hebdo || 'Bonjour, veuillez trouver ci-joint le rapport hebdomadaire des stocks.',
        actif: data.actif !== undefined ? data.actif : true,
        filtre_equipe: data.filtre_equipe || null,
        include_materiels: data.include_materiels !== undefined ? data.include_materiels : true,
        include_produits: data.include_produits !== undefined ? data.include_produits : true
    };
    
    const config = await prisma.configEmailHebdomadaire.upsert({
        where: { id: 1 },
        update: configData,
        create: {
            id: 1,
            ...configData
        },
    });
    
    res.status(200).json(config);
}));

// --- DELETE: DELETE /api/config/hebdomadaire ---
// Supprime la configuration hebdomadaire (réinitialisation)
router.delete('/hebdomadaire', requirePermission(PERMISSIONS.CONFIG_WRITE), asyncHandler(async (req, res) => {
    await prisma.configEmailHebdomadaire.delete({
        where: { id: 1 },
    }).catch(() => {
        // Ignorer l'erreur si l'entrée n'existe pas
    });
    
    res.status(200).json({ message: 'Configuration hebdomadaire réinitialisée' });
}));

// --- STATUS: GET /api/config/hebdomadaire/status ---
// Retourne le statut du cron hebdomadaire
router.get('/hebdomadaire/status', requirePermission(PERMISSIONS.CONFIG_READ), asyncHandler(async (req, res) => {
    const config = await prisma.configEmailHebdomadaire.findUnique({
        where: { id: 1 },
        select: {
            cron_actif_hebdo: true,
            jour_envoi: true,
            heure_envoi: true
        }
    });
    
    res.json({
        actif: config?.cron_actif_hebdo || false,
        jour_envoi: config?.jour_envoi || 1,
        heure_envoi: config?.heure_envoi || '17:15'
    });
}));

export default router;
