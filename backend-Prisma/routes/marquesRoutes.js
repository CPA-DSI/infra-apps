// marquesRoutes.js (Version conforme à votre schéma Prisma)

import express from 'express';
import { authenticateToken, ensureActiveUser, requirePermission } from '../middleware/authMiddleware.js';
import { PERMISSIONS } from '../constants/roles.js';
import {
  getMarques,
  getMarquesSelect,
  getMarquesWithCount,
  getStatsEquipesEtats,
  getMaterielsByLocal,
  getMarqueById,
  createMarque,
  createMarqueWithMateriels,
  updateMarque,
  deleteMarque,
  deleteMarqueWithReplace,
  updateMaterielsMarque,
} from '../controllers/marquesController.js';

const router = express.Router();

router.use(authenticateToken, ensureActiveUser);

const canRead = requirePermission(PERMISSIONS.STOCKS_READ);
const canWrite = requirePermission(PERMISSIONS.STOCKS_WRITE);

// Les routes à chemin fixe (/select, /with-count...) doivent précéder /:id_marque
router.get('/', canRead, getMarques);
router.get('/select', canRead, getMarquesSelect);
router.get('/with-count', canRead, getMarquesWithCount);
router.get('/stats-equipes-etats', canRead, getStatsEquipesEtats);
router.get('/materiels-by-local', canRead, getMaterielsByLocal);
router.get('/:id_marque', canRead, getMarqueById);

router.post('/', canWrite, createMarque);
router.post('/with-materiels', canWrite, createMarqueWithMateriels);
router.put('/:id_marque', canWrite, updateMarque);
router.delete('/:id_marque', canWrite, deleteMarque);
router.delete('/:id_marque/replace/:default_marque_id', canWrite, deleteMarqueWithReplace);
router.put('/update-materiels/:id_marque', canWrite, updateMaterielsMarque);

export default router;
