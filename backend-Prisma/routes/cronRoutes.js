// routes/cronRoutes.js
// Contrôle des robots d'envoi (quotidien, hebdomadaire, mensuel).
import express from 'express';
import prisma from '../prismaClient.js';
import { reloadCronTasks, getCronTasksState } from '../cron-worker.js';
import { authenticateToken, ensureActiveUser, requirePermission } from '../middleware/authMiddleware.js';
import { PERMISSIONS } from '../constants/roles.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = express.Router();

router.use(authenticateToken, ensureActiveUser);

router.get('/status', requirePermission(PERMISSIONS.CONFIG_READ), asyncHandler(async (req, res) => {
    const [configQuotidien, configHebdo, configMensuel] = await Promise.all([
        prisma.configEmailQuotidien.findUnique({ where: { id: 1 } }),
        prisma.configEmailHebdomadaire.findUnique({ where: { id: 1 } }),
        prisma.configEmailMensuel.findUnique({ where: { id: 1 } }),
    ]);

    res.json({
        running: configQuotidien?.cron_actif || false,
        runningWeekly: configHebdo?.cron_actif_hebdo || false,
        runningMonthly: configMensuel?.cron_actif || false,
        tasks: getCronTasksState(),
    });
}));

// type : 'quotidien' (défaut), 'hebdomadaire' ou 'mensuel'
const TOGGLE_UPSERTS = {
    quotidien: (isActive) => prisma.configEmailQuotidien.upsert({
        where: { id: 1 },
        update: { cron_actif: isActive },
        create: { id: 1, cron_actif: isActive, email_dest: '', email_exp: '', email_pass: '', objet_mail: '', message_mail: '', heure_envoi: '17:15' },
    }),
    hebdomadaire: (isActive) => prisma.configEmailHebdomadaire.upsert({
        where: { id: 1 },
        update: { cron_actif_hebdo: isActive },
        create: { id: 1, cron_actif_hebdo: isActive, email_dest: '', email_exp: '', email_pass: '', type_envoi: 'hebdomadaire', jour_envoi: 1, heure_envoi: '17:15', objet_mail_hebdo: '', message_mail_hebdo: '' },
    }),
    mensuel: (isActive) => prisma.configEmailMensuel.upsert({
        where: { id: 1 },
        update: { cron_actif: isActive },
        create: { id: 1, cron_actif: isActive, email_dest: '', email_exp: '', email_pass: '', objet_mail: '', message_mail: '', jour_envoi: 1, heure_envoi: '17:15' },
    }),
};

router.post('/toggle', requirePermission(PERMISSIONS.CONFIG_WRITE), asyncHandler(async (req, res) => {
    const { action, type } = req.body;
    const isActive = action === 'start';
    const cronType = type || 'quotidien';

    const upsert = TOGGLE_UPSERTS[cronType];
    if (!upsert) {
        return res.status(400).json({ error: 'Type de robot inconnu' });
    }

    await upsert(isActive);
    await reloadCronTasks(prisma);
    res.json({ running: isActive, type: cronType });
}));

export default router;
