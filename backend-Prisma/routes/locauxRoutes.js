// routes/locauxRoutes.js
import express from 'express';
import prisma from '../prismaClient.js';
import { authenticateToken, ensureActiveUser, requirePermission } from '../middleware/authMiddleware.js';
import { PERMISSIONS } from '../constants/roles.js';
import { validateIdParam } from '../middleware/validateIdParam.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = express.Router();
router.param('id', validateIdParam);

router.use(authenticateToken, ensureActiveUser);

const localIntrouvable = (res) => res.status(404).json({ error: 'Local non trouvé' });

// 1. GET all locaux (READ)
router.get('/', requirePermission(PERMISSIONS.STOCKS_READ), asyncHandler(async (req, res) => {
    res.json(await prisma.Locaux.findMany());
}));

// 2. GET a single local by ID (READ one)
router.get('/:id', requirePermission(PERMISSIONS.STOCKS_READ), asyncHandler(async (req, res) => {
    const local = await prisma.Locaux.findUnique({
        where: { id_local: parseInt(req.params.id, 10) },
    });
    if (!local) return localIntrouvable(res);
    res.json(local);
}));

// 3. POST Create New Local
router.post('/', requirePermission(PERMISSIONS.STOCKS_WRITE), asyncHandler(async (req, res) => {
    const { nom_local, description } = req.body;

    if (!nom_local) {
        return res.status(400).json({ error: 'Le champ nom_local est requis.' });
    }

    const newLocal = await prisma.Locaux.create({
        data: { nom_local, description },
    });
    res.status(201).json(newLocal);
}));

// 4. PUT Update Local by ID
router.put('/:id', requirePermission(PERMISSIONS.STOCKS_WRITE), asyncHandler(async (req, res) => {
    const { nom_local, description } = req.body;

    if (!nom_local) {
        return res.status(400).json({ error: 'Le champ nom_local est requis.' });
    }

    try {
        const updatedLocal = await prisma.Locaux.update({
            where: { id_local: parseInt(req.params.id, 10) },
            data: { nom_local, description },
        });
        res.status(200).json(updatedLocal);
    } catch (error) {
        if (error.code === 'P2025') return localIntrouvable(res);
        throw error;
    }
}));

// 5. DELETE a local (DELETE)
router.delete('/:id', requirePermission(PERMISSIONS.STOCKS_WRITE), asyncHandler(async (req, res) => {
    try {
        await prisma.Locaux.delete({
            where: { id_local: parseInt(req.params.id, 10) },
        });
        res.status(204).send();
    } catch (error) {
        if (error.code === 'P2025') return localIntrouvable(res);
        throw error;
    }
}));

export default router;
