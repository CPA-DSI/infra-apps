// routes/configEmailRoutes.js
// Configuration des rapports e-mail (quotidien, hebdomadaire, mensuel), montée
// sous /api/config. Les trois types partagent les mêmes routes
// (GET, POST, DELETE, GET /status) ; seuls le modèle Prisma, les valeurs par
// défaut et les champs propres à chaque type diffèrent (voir EMAIL_CONFIGS).
import express from 'express';
import prisma from '../prismaClient.js';
import { authenticateToken, ensureActiveUser, requirePermission } from '../middleware/authMiddleware.js';
import { PERMISSIONS } from '../constants/roles.js';
import { reloadCronTasks, parseHeureEnvoi } from '../cron-worker.js';
import {
    generateExcelReport,
    getDebutPeriode,
    sendEmail,
    getCurrentDate,
    getCurrentMonth,
    toPublicEmailConfig,
    getNewEmailPass,
} from '../services/reportService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = express.Router();

router.use(authenticateToken, ensureActiveUser);

// État du robot : modifié uniquement s'il est fourni
const parseCronActif = (value) =>
    value !== undefined ? (value === true || value === 'true') : undefined;

const EMAIL_CONFIGS = {
    quotidien: {
        model: () => prisma.configEmailQuotidien,
        cronField: 'cron_actif',
        deletedMessage: 'Configuration quotidienne réinitialisée',
        defaults: () => ({
            id: 1,
            email_dest: '',
            email_exp: '',
            hasPassword: false,
            objet_mail: 'Rapport Quotidien des Stocks',
            message_mail: 'Bonjour, veuillez trouver ci-joint le rapport des stocks.',
            heure_envoi: '17:15',
            cron_actif: false,
        }),
        buildData: (data) => ({
            email_dest: data.email_dest || '',
            email_exp: data.email_exp || '',
            objet_mail: data.objet_mail || 'Rapport Quotidien des Stocks',
            message_mail: data.message_mail || 'Bonjour, veuillez trouver ci-joint le rapport des stocks.',
            heure_envoi: data.heure_envoi || '17:15',
        }),
        status: (config) => ({
            actif: config?.cron_actif || false,
            heure_envoi: config?.heure_envoi || '17:15',
        }),
    },
    hebdomadaire: {
        model: () => prisma.configEmailHebdomadaire,
        cronField: 'cron_actif_hebdo',
        deletedMessage: 'Configuration hebdomadaire réinitialisée',
        defaults: () => ({
            id: 1,
            email_dest: '',
            email_exp: '',
            hasPassword: false,
            type_envoi: 'hebdomadaire',
            jour_envoi: 1,
            heure_envoi: '17:15',
            cron_actif_hebdo: false,
            objet_mail_hebdo: 'Rapport Hebdomadaire des Stocks',
            message_mail_hebdo: 'Bonjour, veuillez trouver ci-joint le rapport hebdomadaire des stocks.',
            actif: true,
            filtre_equipe: null,
            include_materiels: true,
            include_produits: true,
        }),
        buildData: (data) => ({
            email_dest: data.email_dest || '',
            email_exp: data.email_exp || '',
            type_envoi: 'hebdomadaire',
            jour_envoi: data.jour_envoi !== undefined ? parseInt(data.jour_envoi, 10) : 1,
            heure_envoi: data.heure_envoi || '17:15',
            objet_mail_hebdo: data.objet_mail_hebdo || 'Rapport Hebdomadaire des Stocks',
            message_mail_hebdo: data.message_mail_hebdo || 'Bonjour, veuillez trouver ci-joint le rapport hebdomadaire des stocks.',
            actif: data.actif !== undefined ? data.actif : true,
            filtre_equipe: data.filtre_equipe || null,
            include_materiels: data.include_materiels !== undefined ? data.include_materiels : true,
            include_produits: data.include_produits !== undefined ? data.include_produits : true,
        }),
        status: (config) => ({
            actif: config?.cron_actif_hebdo || false,
            jour_envoi: config?.jour_envoi || 1,
            heure_envoi: config?.heure_envoi || '17:15',
        }),
    },
    mensuel: {
        model: () => prisma.configEmailMensuel,
        cronField: 'cron_actif',
        deletedMessage: 'Configuration mensuelle supprimée',
        defaults: () => {
            const month = getCurrentMonth();
            return toPublicEmailConfig({
                id: 1,
                email_dest: '',
                email_exp: '',
                email_pass: '',
                objet_mail: `Rapport Mensuel des Stocks - ${month}`,
                message_mail: `Bonjour, veuillez trouver ci-joint le rapport mensuel des stocks du ${month}.`,
                heure_envoi: '17:15',
                jour_envoi: 1,
                cron_actif: false,
                filtre_equipe: null,
                include_materiels: true,
                include_produits: true,
                created_at: new Date(),
                updated_at: new Date(),
            });
        },
        // Champs absents : laissés inchangés en mise à jour (Prisma ignore undefined)
        buildData: (data) => ({
            email_dest: data.email_dest,
            email_exp: data.email_exp,
            objet_mail: data.objet_mail,
            message_mail: data.message_mail,
            heure_envoi: data.heure_envoi,
            jour_envoi: parseInt(data.jour_envoi, 10) || 1,
            filtre_equipe: data.filtre_equipe || null,
            include_materiels: data.include_materiels !== undefined ? data.include_materiels : true,
            include_produits: data.include_produits !== undefined ? data.include_produits : true,
        }),
        status: (config) => ({
            running: config ? config.cron_actif : false,
            config: toPublicEmailConfig(config),
        }),
    },
};

for (const [type, cfg] of Object.entries(EMAIL_CONFIGS)) {
    // --- READ: GET /api/config/:type --- (objet par défaut si aucune configuration)
    router.get(`/${type}`, requirePermission(PERMISSIONS.CONFIG_READ), asyncHandler(async (req, res) => {
        const config = await cfg.model().findUnique({ where: { id: 1 } });
        // Ne jamais renvoyer le mot de passe SMTP
        res.json(config ? toPublicEmailConfig(config) : cfg.defaults());
    }));

    // --- CREATE/UPDATE: POST /api/config/:type ---
    router.post(`/${type}`, requirePermission(PERMISSIONS.CONFIG_WRITE), asyncHandler(async (req, res) => {
        const data = req.body || {};

        if (data.heure_envoi && !parseHeureEnvoi(data.heure_envoi)) {
            return res.status(400).json({ error: "Heure d'envoi invalide (format attendu HH:MM)" });
        }

        const configData = cfg.buildData(data);
        // Mot de passe vide/absent : on conserve celui déjà enregistré
        const emailPass = getNewEmailPass(data.email_pass);
        const cronActif = parseCronActif(data[cfg.cronField]);

        const config = await cfg.model().upsert({
            where: { id: 1 },
            update: { ...configData, email_pass: emailPass, [cfg.cronField]: cronActif },
            create: {
                id: 1,
                ...configData,
                email_pass: emailPass ?? '',
                [cfg.cronField]: cronActif ?? false,
            },
        });

        await reloadCronTasks(prisma);
        res.status(200).json(toPublicEmailConfig(config));
    }));

    // --- DELETE: DELETE /api/config/:type --- (réinitialisation)
    router.delete(`/${type}`, requirePermission(PERMISSIONS.CONFIG_WRITE), asyncHandler(async (req, res) => {
        await cfg.model().deleteMany({ where: { id: 1 } });
        await reloadCronTasks(prisma);
        res.status(200).json({ message: cfg.deletedMessage });
    }));

    // --- STATUS: GET /api/config/:type/status ---
    router.get(`/${type}/status`, requirePermission(PERMISSIONS.CONFIG_READ), asyncHandler(async (req, res) => {
        const config = await cfg.model().findUnique({ where: { id: 1 } });
        res.json(cfg.status(config));
    }));
}

// POST /api/config/mensuel/test - Envoie un e-mail de test mensuel
router.post('/mensuel/test', requirePermission(PERMISSIONS.CONFIG_WRITE), asyncHandler(async (req, res) => {
    const config = await prisma.configEmailMensuel.findUnique({ where: { id: 1 } });

    if (!config) {
        return res.status(404).json({ error: 'Aucune configuration mensuelle trouvée' });
    }

    // Vérifier que les champs requis sont présents
    if (!config.email_exp || !config.email_pass || !config.email_dest) {
        return res.status(400).json({ error: 'Configuration email incomplète' });
    }

    // Même contenu que l'envoi automatique mensuel
    const excelBuffer = await generateExcelReport(prisma, {
        depuis: getDebutPeriode('mensuel'),
        includeProduits: config.include_produits !== false,
    });
    const monthName = getCurrentMonth();

    try {
        await sendEmail(
            config,
            `[TEST] ${config.objet_mail || `Rapport Mensuel - ${monthName}`}`,
            config.message_mail || 'Bonjour, veuillez trouver ci-joint le rapport mensuel des stocks.',
            excelBuffer,
            `rapport_mensuel_test_${getCurrentDate()}.xlsx`
        );
    } catch (error) {
        console.error('Erreur envoi test mensuel:', error);
        return res.status(502).json({ error: "Échec de l'envoi de l'e-mail de test. Vérifiez la configuration SMTP." });
    }

    res.json({ message: 'Email de test mensuel envoyé avec succès' });
}));

export default router;
