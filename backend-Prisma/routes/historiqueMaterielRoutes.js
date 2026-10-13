// routes/historiqueMaterielRoutes.js
import express from 'express';
import prisma from '../prismaClient.js';
import { authenticateToken, ensureActiveUser, requirePermission } from '../middleware/authMiddleware.js';
import { validateIdParam } from '../middleware/validateIdParam.js';
import { canViewAllMateriels, PERMISSIONS } from '../constants/roles.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = express.Router();
router.param('id', validateIdParam);

router.use(authenticateToken, ensureActiveUser, requirePermission(PERMISSIONS.MATERIELS_READ));

// GET /api/historique_materiels - Récupérer tout l'historique des matériels
router.get('/', asyncHandler(async (req, res) => {
    // Sans vue sur tout le parc : uniquement l'historique de ses propres matériels
    const where = canViewAllMateriels(req.user?.role) ? {} : { materiel: { id_n: req.user?.id_n } };

    const historique = await prisma.historiqueMateriel.findMany({
        where,
        include: {
            materiel: {
                select: {
                    id_materiels: true,
                    id_n: true,
                    utilisateur: true,
                    code_pc: true,
                    equipe: true,
                    etat_pc: true,
                    caracteristiques: true,
                    local: {
                        select: {
                            nom_local: true
                        }
                    }
                }
            },
        },
        orderBy: {
            date_modification: 'desc'
        }
    });

    const formattedData = historique.map(item => ({
        id_historique: item.id_historique,
        id_materiels: item.id_materiels,
        champ_modifie: item.champ_modifie,
        ancienne_valeur: item.ancienne_valeur,
        nouvelle_valeur: item.nouvelle_valeur,
        date_modification: item.date_modification,
        nom_utilisateur: item.nom_utilisateur || null,
        materiel: item.materiel,
        utilisateur: item.materiel?.utilisateur || null,
    }));

    res.status(200).json(formattedData);
}));

// GET /api/historique_materiels/materiel/:id_materiels - Récupérer l'historique d'un matériel spécifique
router.get('/materiel/:id_materiels', asyncHandler(async (req, res) => {
    const idMateriels = parseInt(req.params.id_materiels, 10);
    if (isNaN(idMateriels)) {
        return res.status(400).json({ error: 'Identifiant invalide.' });
    }

    const where = { id_materiels: idMateriels };
    if (!canViewAllMateriels(req.user?.role)) {
        where.materiel = { id_n: req.user?.id_n };
    }

    const historique = await prisma.historiqueMateriel.findMany({
        where,
        include: {
            materiel: {
                select: {
                    id_materiels: true,
                    id_n: true,
                    utilisateur: true,
                    code_pc: true,
                    equipe: true,
                    etat_pc: true,
                    caracteristiques: true,
                }
            }
        },
        orderBy: {
            date_modification: 'desc'
        }
    });

    const formattedData = historique.map(item => ({
        id_historique: item.id_historique,
        id_materiels: item.id_materiels,
        champ_modifie: item.champ_modifie,
        ancienne_valeur: item.ancienne_valeur,
        nouvelle_valeur: item.nouvelle_valeur,
        date_modification: item.date_modification,
        nom_utilisateur: item.nom_utilisateur || null,
        utilisateur: item.materiel?.utilisateur || null,
    }));

    res.status(200).json(formattedData);
}));

// GET /api/historique_materiels/:id - Récupérer un historique par ID
router.get('/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;

    const where = { id_historique: parseInt(id, 10) };
    if (!canViewAllMateriels(req.user?.role)) {
        where.materiel = { id_n: req.user?.id_n };
    }

    const historique = await prisma.historiqueMateriel.findFirst({
        where,
        include: {
            materiel: {
                select: {
                    id_materiels: true,
                    id_n: true,
                    utilisateur: true,
                    code_pc: true,
                    equipe: true,
                    etat_pc: true,
                    caracteristiques: true,
                }
            },
        }
    });

    if (!historique) {
        return res.status(404).json({ error: 'Enregistrement non trouvé' });
    }

    res.status(200).json({
        id_historique: historique.id_historique,
        id_materiels: historique.id_materiels,
        champ_modifie: historique.champ_modifie,
        ancienne_valeur: historique.ancienne_valeur,
        nouvelle_valeur: historique.nouvelle_valeur,
        date_modification: historique.date_modification,
        nom_utilisateur: historique.nom_utilisateur || null,
        utilisateur: historique.materiel?.utilisateur || null,
    });
}));

// POST /api/historique_materiels - Créer un nouvel historique
router.post('/', requirePermission(PERMISSIONS.MATERIELS_WRITE), asyncHandler(async (req, res) => {
    const { id_materiels, ancienne_valeur, nouvelle_valeur, nom_utilisateur } = req.body;

    if (!id_materiels) {
        return res.status(400).json({ error: 'Veuillez fournir id_materiels' });
    }

    const nouvelHistorique = await prisma.historiqueMateriel.create({
        data: {
            id_materiels,
            ancienne_valeur,
            nouvelle_valeur,
            nom_utilisateur,
        }
    });

    res.status(201).json(nouvelHistorique);
}));

export default router;
