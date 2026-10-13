// backend/routes/import.js
import express from 'express';
import { authenticateToken, ensureActiveUser, requirePermission } from '../middleware/authMiddleware.js';
import { PERMISSIONS } from '../constants/roles.js';
import { importerMateriels, getLocaux } from '../controllers/importController.js';

const router = express.Router();

router.use(authenticateToken, ensureActiveUser);

// Endpoint d'import
router.post('/', requirePermission(PERMISSIONS.STOCKS_WRITE), importerMateriels);

// Endpoint pour lister tous les locaux
router.get('/locaux', requirePermission(PERMISSIONS.STOCKS_READ), getLocaux);

export default router;
