// routes/authRoutes.js (vérifiez ce fichier)

import express from 'express';
const router = express.Router();

// Importation nommée car le contrôleur utilise "export const login"
import { login, logout, getMe, updatePasswords, forgotPassword, resetPassword, forceChangePassword } from '../controllers/authController.js'; 
import { authenticateToken, ensureActiveUser } from '../middleware/authMiddleware.js'; // <-- Importez votre middleware de sécurité

router.post('/login', login); 

router.get('/me', authenticateToken, ensureActiveUser, getMe);

router.post('/logout', logout);

// Routes pour la réinitialisation du mot de passe (pas besoin d'être connecté)
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// Nouvelle route : nécessite d'être connecté (token valide)
router.post('/update-passwords', authenticateToken, ensureActiveUser, updatePasswords);
router.post('/force-change-password', authenticateToken, ensureActiveUser, forceChangePassword);

export default router;
