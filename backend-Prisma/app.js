// app.js
// Application Express (middlewares + routes), sans démarrage du serveur :
// server.js l'écoute, les tests (Supertest) l'importent directement.
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import prisma from './prismaClient.js';
import { createCsrfGuard, CSRF_HEADER_NAME } from './middleware/csrfMiddleware.js';
import { errorHandler } from './middleware/errorHandler.js';

import authRoutes from './routes/authRoutes.js';
import cronRoutes from './routes/cronRoutes.js';
import materielRoutes from './routes/materielRoutes.js';
import materielAllRoutes from './routes/materielAllRoutes.js';
import marqueRoutes from './routes/marquesRoutes.js';
import locauxRoutes from './routes/locauxRoutes.js';
import produitsRoutes from './routes/produitsRoutes.js';
import historiqueRoutes from './routes/historiqueRoutes.js';
import mouvementsRouter from './routes/mouvementsRoute.js';
import usersRoutes from './routes/usersRoutes.js';
import userEmailsRoutes from './routes/userEmailsRoutes.js';
import ticketRoutes from './routes/ticketRoutes.js';
import commentRoutes from './routes/commentRoutes.js';
import historiqueMaterielRoutes from './routes/historiqueMaterielRoutes.js';
import emailSendRoutes from './routes/emailSendRoutes.js';
import configEmailRoutes from './routes/configEmailRoutes.js';
import importRouter from './routes/import.js';
import documentRoutes from './routes/documentRoutes.js';
import userDashboardRoutes from './routes/userDashboardRoutes.js';
import ecransRoutes from './routes/ecransRoutes.js';

const app = express();

const allowedOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim())
    : ['http://localhost:3000'];

app.use(cors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', CSRF_HEADER_NAME],
    credentials: true
}));

// Protection CSRF : toute requête mutante sur /api doit venir d'une origine
// autorisée et porter l'en-tête X-Requested-With (voir middleware/csrfMiddleware.js).
app.use('/api', createCsrfGuard(allowedOrigins));

app.use(cookieParser());

app.use(express.json({ limit: '1mb' }));

// Le dossier uploads est exclu de Git (contenu utilisateur) : on le recrée au démarrage
// pour éviter les 500 de Multer si le déploiement ne l'a pas conservé.
// Il n'est volontairement PAS servi en statique : les fichiers ne sont accessibles
// que via les routes authentifiées /api/documents/:id/fichier et /api/documents/pj/:pjId/fichier.
const uploadsDir = path.join(process.cwd(), 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

app.use((req, res, next) => {
    req.prisma = prisma;
    next();
});

app.use('/api/auth', authRoutes);
app.use('/api/cron', cronRoutes);
// /api/materiels : statistiques des tableaux de bord ; /api/materiels_all : CRUD et affectations
app.use('/api/materiels', materielRoutes);
app.use('/api/materiels_all', materielAllRoutes);
app.use('/api/marques', marqueRoutes);
app.use('/api/locaux', locauxRoutes);
app.use('/api/produits', produitsRoutes);
app.use('/api/mouvements', mouvementsRouter);
app.use('/api/historique_arrive', historiqueRoutes);
app.use('/api/historique_materiels', historiqueMaterielRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/users', userDashboardRoutes);
app.use('/api/user-emails', userEmailsRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/commentaires', commentRoutes);
app.use('/api/config', configEmailRoutes);
app.use('/api/email', emailSendRoutes);
app.use('/api/import', importRouter);
app.use('/api/documents', documentRoutes);
app.use('/api/ecrans', ecransRoutes);

app.get('/', (req, res) => {
    res.status(200).json({ service: 'API Gestion Matériel', status: 'Online' });
});

app.use('/api', (req, res) => {
    res.status(404).json({ error: 'Route introuvable.' });
});

// Dernier middleware : format d'erreur unique { error } pour tout ce qui remonte via next(err)
app.use(errorHandler);

export default app;
