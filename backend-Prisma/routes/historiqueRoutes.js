// routes/historiqueRoutes.js
import express from 'express';
import prisma from '../prismaClient.js';
import { authenticateToken, ensureActiveUser, requirePermission } from '../middleware/authMiddleware.js';
import { validateIdParam } from '../middleware/validateIdParam.js';
import { hasPermission, PERMISSIONS } from '../constants/roles.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = express.Router();
router.param('id', validateIdParam);

// GET /api/historique_arrive - Récupérer tout l'historique
router.get('/', authenticateToken, ensureActiveUser, asyncHandler(async (req, res) => {
    // Sans droit de lecture des stocks : liste vide (le tableau de bord l'affiche tel quel)
    if (!hasPermission(req.user?.role, PERMISSIONS.STOCKS_READ)) {
        return res.status(200).json([]);
    }

    const historique = await prisma.historiqueArrive.findMany({
        include: {
            produit: {  // 'produit' est le nom du champ de relation (singulier)
                select: {
                    nom_produit: true,
                    quantite_en_stock: true
                }
            }
        },
        orderBy: {
            date_arrivee: 'desc'
        }
    });
    
    // Transformer les données pour le frontend
    const formattedData = historique.map(item => ({
        id_arrivage: item.id_arrivage,
        id_produit: item.id_produit,
        quantite_arrivee: item.quantite_arrivee,
        date_arrivee: item.date_arrivee,
        ancienne_quantite_stock: item.ancienne_quantite_stock,
        ancienne_date_stock: item.ancienne_date_stock,
        remarque: item.remarque,
        nom_produit: item.produit?.nom_produit || 'Produit inconnu',
        quantite_en_stock: item.produit?.quantite_en_stock || 0
    }));
    
    res.status(200).json(formattedData);
}));

// GET /api/historique_arrive/:id
router.get('/:id', authenticateToken, ensureActiveUser, requirePermission(PERMISSIONS.STOCKS_READ), asyncHandler(async (req, res) => {
    const { id } = req.params;

    const arrivee = await prisma.historiqueArrive.findUnique({
        where: { id_arrivage: parseInt(id) },
        include: {
            produit: {
                select: {
                    nom_produit: true,
                    quantite_en_stock: true
                }
            }
        }
    });
    
    if (!arrivee) {
        return res.status(404).json({ error: 'Enregistrement non trouvé' });
    }
    
    res.status(200).json(arrivee);
}));

// Pas de POST / PUT / DELETE : l'historique des stocks est écrit uniquement
// par services/stockService.js, dans la même transaction que la variation de
// stock correspondante (mouvements, import, ajustement de fiche produit).
// Une écriture directe permettrait de désynchroniser historique et stock.

export default router;