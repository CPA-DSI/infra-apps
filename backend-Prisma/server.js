import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import pkg from '@prisma/client';
const { PrismaClient } = pkg;
import { createCronTasks, syncCronStatus } from './cron-worker.js';
import path from 'path';
import { authenticateToken, ensureActiveUser, requirePermission } from './middleware/authMiddleware.js';
import { PERMISSIONS } from './constants/roles.js';

const prisma = new PrismaClient(); // 1. Créer l'instance

// 2. Créer les deux tâches cron (quotidienne et hebdomadaire)
const { dailyTask, weeklyTask } = createCronTasks(prisma);

// 3. Synchroniser le statut au démarrage
syncCronStatus(prisma, dailyTask, weeklyTask); 

const app = express();
const PORT = process.env.PORT || 4000;

// --- 2. MIDDLEWARES ---

const allowedOrigins = process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.split(',').map((origin) => origin.trim())
    : ['http://localhost:3000'];

app.use(cors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

app.use(cookieParser());

app.use(express.json({ limit: '1mb' }));

app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

app.use((req, res, next) => {
    req.prisma = prisma;
    next();
});

// --- 3. ROUTES DE CONTRÔLE DU ROBOT QUOTIDIEN ---

app.get('/api/cron/status', authenticateToken, ensureActiveUser, requirePermission(PERMISSIONS.CONFIG_READ), async (req, res) => {
    // Récupérer les config des deux tables
    const configQuotidien = await prisma.configEmailQuotidien.findUnique({ where: { id: 1 } });
    const configHebdo = await prisma.configEmailHebdomadaire.findUnique({ where: { id: 1 } });
    
    res.json({ 
        running: configQuotidien?.cron_actif || false,
        runningWeekly: configHebdo?.cron_actif_hebdo || false
    });
});

app.post('/api/cron/toggle', authenticateToken, ensureActiveUser, requirePermission(PERMISSIONS.CONFIG_WRITE), async (req, res) => {
    const { action, type } = req.body;
    const isActive = action === 'start';
    
    // type peut être 'quotidien' ou 'hebdomadaire'
    const cronType = type || 'quotidien';

    try {
        if (cronType === 'quotidien') {
            await prisma.configEmailQuotidien.upsert({
                where: { id: 1 },
                update: { cron_actif: isActive },
                create: { id: 1, cron_actif: isActive, email_dest: '', email_exp: '', email_pass: '', objet_mail: '', message_mail: '', heure_envoi: '17:15' }
            });

            if (isActive) dailyTask.start(); else dailyTask.stop();
            res.json({ running: isActive, type: 'quotidien' });
        } else {
            // Hebdomadaire - utiliser la nouvelle table
            await prisma.configEmailHebdomadaire.upsert({
                where: { id: 1 },
                update: { cron_actif_hebdo: isActive },
                create: { id: 1, cron_actif_hebdo: isActive, email_dest: '', email_exp: '', email_pass: '', type_envoi: 'hebdomadaire', jour_envoi: 1, heure_envoi: '17:15', objet_mail_hebdo: '', message_mail_hebdo: '' }
            });

            if (isActive) weeklyTask.start(); else weeklyTask.stop();
            res.json({ running: isActive, type: 'hebdomadaire' });
        }
    } catch (error) {
        res.status(500).json({ error: "Erreur lors du changement d'état du robot" });
    }
});

// --- 4. VOS AUTRES ROUTES ---

import authRoutes from './routes/authRoutes.js';
import materielRoutes from './routes/materielRoutes.js';
import materielAllRoutes from './routes/materielAllRoutes.js';
import marqueRoutes from './routes/marquesRoutes.js';
import locauxRoutes from './routes/locauxRoutes.js';
import produitsRoutes from './routes/produitsRoutes.js';
import materielsRoutes from './routes/materielsRoutes.js';
import historiqueRoutes from './routes/historiqueRoutes.js';
import mouvementsRouter  from './routes/mouvementsRoute.js';
import usersRoutes from './routes/usersRoutes.js'; 
import userEmailsRoutes from './routes/userEmailsRoutes.js';
import ticketRoutes from './routes/ticketRoutes.js';
import commentRoutes from './routes/commentRoutes.js';
import historiqueMaterielRoutes from './routes/historiqueMaterielRoutes.js';
import emailSendRoutes from './routes/emailSendRoutes.js';
import configQuotidienRoutes from './routes/configQuotidienRoutes.js';
import configWeeklyRoutes from './routes/configWeeklyRoutes.js';
import configMensuelRoutes from './routes/configMensuelRoutes.js';
import importRouter from './routes/import.js';
import documentRoutes from './routes/documentRoutes.js';
import userDashboardRoutes from './routes/userDashboardRoutes.js';

app.use('/api/auth', authRoutes); 
app.use('/api/materiels', materielRoutes);
app.use('/api/materiels_all', materielAllRoutes);
app.use('/api/marques', marqueRoutes);
app.use('/api/locaux', locauxRoutes);
app.use('/api/produits', produitsRoutes);
app.use('/api/materiels_s', materielsRoutes); 
app.use('/api/mouvements', mouvementsRouter);
app.use('/api/historique_arrive', historiqueRoutes); 
app.use('/api/historique', historiqueRoutes);
app.use('/api/historique_materiels', historiqueMaterielRoutes); 
app.use('/api/users', usersRoutes);
app.use('/api/users', userDashboardRoutes);
app.use('/api/user-emails', userEmailsRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/commentaires', commentRoutes);
app.use('/api/config', configQuotidienRoutes);
app.use('/api/config', configWeeklyRoutes);
app.use('/api/config', configMensuelRoutes); // ✅ Ajout du routeur mensuel
app.use('/api/email', emailSendRoutes);
app.use('/api/import', importRouter); // <-- IMPORTANT: le chemin doit correspondre
app.use('/api/documents', documentRoutes);

app.get('/', (req, res) => {
    res.status(200).json({ service: "API Gestion Matériel", status: "Online", robot: "Intégré (Quotidien & Hebdomadaire)" });
});

// Pour déboguer, ajoute ceci pour voir toutes les routes enregistrées (dev uniquement)
if (process.env.NODE_ENV !== 'production') {
  console.log('Routes enregistrées:');
  app._router.stack.forEach((r) => {
    if (r.route && r.route.path) {
      console.log(`${Object.keys(r.route.methods)} ${r.route.path}`);
    } else if (r.name === 'router' && r.handle.stack) {
      r.handle.stack.forEach((layer) => {
        if (layer.route && layer.route.path) {
          console.log(`${Object.keys(layer.route.methods)} /api/historique${layer.route.path}`);
        }
      });
    }
  });
}
// --- 5. LANCEMENT ---

app.listen(PORT, async () => {
    try {
        await prisma.$connect();
        // Synchroniser les statuts au démarrage
        await syncCronStatus(prisma, dailyTask, weeklyTask);
        console.log('✅ Base de données connectée.');
        console.log(`🚀 Serveur actif sur http://localhost:${PORT}`);
    } catch (error) {
        console.error('❌ Erreur de démarrage:', error);
        process.exit(1); 
    }
});
