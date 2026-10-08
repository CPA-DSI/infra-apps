// routes/ecransRoutes.js
// Gestion des écrans et de leurs affectations (URL de base : /api/ecrans).
import express from 'express';
import prisma from '../prismaClient.js';
import { authenticateToken, ensureActiveUser, requireRole } from '../middleware/authMiddleware.js';
import { UserRole } from '../constants/roles.js';
import { STATUTS_ECRAN, affecterEcran, repondreErreurAffectation } from '../services/affectationService.js';

const router = express.Router();

const asyncHandler = fn => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

router.use(authenticateToken, ensureActiveUser, requireRole(UserRole.IT_ADMIN, UserRole.DIRECTION));

// GET /api/ecrans?statut=EN_STOCK
router.get('/', asyncHandler(async (req, res) => {
    const { statut } = req.query;
    if (statut && !STATUTS_ECRAN.includes(statut)) {
        return res.status(400).json({ error: `Statut invalide : ${statut}.` });
    }

    const ecrans = await prisma.ecran.findMany({
        where: statut ? { statut } : {},
        include: {
            materiel: { select: { id_materiels: true, id_n: true, utilisateur: true, equipe: true, code_pc: true } },
        },
        orderBy: { code_ecran: 'asc' },
    });
    res.json(ecrans);
}));

// POST /api/ecrans - Nouvel écran, créé en stock.
router.post('/', asyncHandler(async (req, res) => {
    const code_ecran = req.body.code_ecran?.trim();
    if (!code_ecran) {
        return res.status(400).json({ error: 'Le code écran est requis.' });
    }

    try {
        const ecran = await prisma.ecran.create({
            data: {
                code_ecran,
                modele: req.body.modele?.trim() || null,
                date_ecran: req.body.date_ecran ? new Date(req.body.date_ecran) : null,
                commentaire: req.body.commentaire || null,
                statut: 'EN_STOCK',
            },
        });
        res.status(201).json(ecran);
    } catch (error) {
        if (error.code === 'P2002') {
            return res.status(400).json({ error: `Le code écran ${code_ecran} existe déjà.` });
        }
        throw error;
    }
}));

// POST /api/ecrans/:id/affecter
// Body : { id_materiels (null = hors poste), statut? (si hors poste),
//          mode_conflit? ('refuser' | 'echanger' | 'stock'), motif?, etat_remise?, commentaire? }
router.post('/:id/affecter', asyncHandler(async (req, res) => {
    const id_ecran = parseInt(req.params.id, 10);
    if (isNaN(id_ecran)) {
        return res.status(400).json({ error: "L'identifiant fourni n'est pas valide." });
    }

    const { id_materiels, statut, mode_conflit, motif, etat_remise, commentaire } = req.body;
    const cibleId = id_materiels === null || id_materiels === undefined || id_materiels === '' ? null : parseInt(id_materiels, 10);
    if (Number.isNaN(cibleId)) {
        return res.status(400).json({ error: 'Poste cible invalide.' });
    }

    try {
        const ecran = await prisma.$transaction((tx) => affecterEcran(tx, {
            id_ecran, id_materiels: cibleId, statut, mode_conflit, motif, etat_remise, commentaire,
        }, req.user?.id_n));
        res.json({ message: 'Écran déplacé avec succès.', ecran });
    } catch (error) {
        repondreErreurAffectation(res, error);
    }
}));

// GET /api/ecrans/:id/affectations - Historique complet de l'écran.
router.get('/:id/affectations', asyncHandler(async (req, res) => {
    const id_ecran = parseInt(req.params.id, 10);
    if (isNaN(id_ecran)) {
        return res.status(400).json({ error: "L'identifiant fourni n'est pas valide." });
    }

    const affectations = await prisma.affectationMateriel.findMany({
        where: { id_ecran },
        include: { materiel: { select: { code_pc: true } } },
        orderBy: [{ date_debut: 'desc' }, { id_affectation: 'desc' }],
    });
    res.json(affectations);
}));

export default router;
