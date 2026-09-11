// routes/historiqueMaterielRoutes.js
import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, ensureActiveUser } from '../middleware/authMiddleware.js';

const router = express.Router();
const prisma = new PrismaClient();

const asyncHandler = fn => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

// GET /api/historique_materiels - Récupérer tout l'historique des matériels
router.get('/', authenticateToken, ensureActiveUser, asyncHandler(async (req, res) => {
    try {
        const userRole = req.user?.role;
        const userId = req.user?.id_n;

        let where = {};
        if (userRole === 'USER') {
            where = { materiel: { id_n: userId } };
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
    } catch (error) {
        console.error("Erreur Prisma:", error);
        res.status(500).json({
            message: "Erreur lors de la récupération de l'historique des matériels",
            error: error.message
        });
    }
}));

// GET /api/historique_materiels/materiel/:id_materiels - Récupérer l'historique d'un matériel spécifique
router.get('/materiel/:id_materiels', authenticateToken, ensureActiveUser, asyncHandler(async (req, res) => {
    const { id_materiels } = req.params;
    const userRole = req.user?.role;
    const userId = req.user?.id_n;

    let where = { id_materiels: parseInt(id_materiels) };
    if (userRole === 'USER') {
        where.materiel = { id_n: userId };
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
router.get('/:id', authenticateToken, ensureActiveUser, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userRole = req.user?.role;
    const userId = req.user?.id_n;

    let where = { id_historique: parseInt(id) };
    if (userRole === 'USER') {
        where.materiel = { id_n: userId };
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
        return res.status(404).json({ message: 'Enregistrement non trouvé' });
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
router.post('/', authenticateToken, ensureActiveUser, asyncHandler(async (req, res) => {
    const userRole = req.user?.role;
    if (userRole === 'USER') {
        return res.status(403).json({ error: 'Accès interdit : permission insuffisante.' });
    }

    const { id_materiels, ancienne_valeur, nouvelle_valeur, nom_utilisateur } = req.body;

    if (!id_materiels) {
        return res.status(400).json({ message: 'Veuillez fournir id_materiels' });
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
