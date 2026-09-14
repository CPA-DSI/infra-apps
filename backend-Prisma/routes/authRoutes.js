// routes/authRoutes.js (vérifiez ce fichier)

import express from 'express';
import rateLimit from 'express-rate-limit';
const router = express.Router();

// Importation nommée car le contrôleur utilise "export const login"
import { login, logout, getMe, updatePasswords, forgotPassword, resetPassword, forceChangePassword } from '../controllers/authController.js';
import { authenticateToken, ensureActiveUser } from '../middleware/authMiddleware.js'; // <-- Importez votre middleware de sécurité

// Limite les tentatives de connexion/réinitialisation pour freiner le brute-force
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Trop de tentatives. Veuillez réessayer dans quelques minutes.' },
});

router.post('/login', loginLimiter, login);

router.get('/me', authenticateToken, ensureActiveUser, getMe);

router.post('/logout', logout);

// Routes pour la réinitialisation du mot de passe (pas besoin d'être connecté)
router.post('/forgot-password', loginLimiter, forgotPassword);
router.post('/reset-password', loginLimiter, resetPassword);

// Nouvelle route : nécessite d'être connecté (token valide)
router.post('/update-passwords', authenticateToken, ensureActiveUser, updatePasswords);
router.post('/force-change-password', authenticateToken, ensureActiveUser, forceChangePassword);

export default router;
