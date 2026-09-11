// routes/historiqueRoutes.js
import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, ensureActiveUser } from '../middleware/authMiddleware.js';

const router = express.Router();
const prisma = new PrismaClient();

const asyncHandler = fn => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

// GET /api/historique_arrive - Récupérer tout l'historique
router.get('/', authenticateToken, ensureActiveUser, asyncHandler(async (req, res) => {
    try {
        const userRole = req.user?.role;

        if (userRole === 'USER') {
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
            nom_produit: item.produit?.nom_produit || 'Produit inconnu',
            quantite_en_stock: item.produit?.quantite_en_stock || 0
        }));
        
        res.status(200).json(formattedData);
    } catch (error) {
        console.error("Erreur Prisma:", error);
        res.status(500).json({ 
            message: "Erreur lors de la récupération de l'historique",
            error: error.message 
        });
    }
}));

// GET /api/historique_arrive/:id
router.get('/:id', authenticateToken, ensureActiveUser, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userRole = req.user?.role;

    if (userRole === 'USER') {
        return res.status(403).json({ error: 'Accès interdit : permission insuffisante.' });
    }

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
        return res.status(404).json({ message: 'Enregistrement non trouvé' });
    }
    
    res.status(200).json(arrivee);
}));

// POST /api/historique_arrive
router.post('/', authenticateToken, ensureActiveUser, asyncHandler(async (req, res) => {
    const userRole = req.user?.role;
    if (userRole === 'USER') {
        return res.status(403).json({ error: 'Accès interdit : permission insuffisante.' });
    }

    const { id_produit, quantite_arrivee, ancienne_quantite_stock, ancienne_date_stock } = req.body;
    
    if (!id_produit || !quantite_arrivee) {
        return res.status(400).json({ message: 'Veuillez fournir id_produit et quantite_arrivee' });
    }
    
    const nouvelleArrivee = await prisma.historiqueArrive.create({
        data: {
            id_produit,
            quantite_arrivee,
            ancienne_quantite_stock,
            ancienne_date_stock: ancienne_date_stock ? new Date(ancienne_date_stock) : undefined,
            date_arrivee: new Date()
        }
    });
    
    res.status(201).json(nouvelleArrivee);
}));

// PUT /api/historique_arrive/:id
router.put('/:id', authenticateToken, ensureActiveUser, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userRole = req.user?.role;

    if (userRole === 'USER') {
        return res.status(403).json({ error: 'Accès interdit : permission insuffisante.' });
    }

    const { quantite_arrivee, ancienne_quantite_stock, ancienne_date_stock } = req.body;
    
    const arriveeMiseAJour = await prisma.historiqueArrive.update({
        where: { id_arrivage: parseInt(id) },
        data: {
            quantite_arrivee,
            ancienne_quantite_stock,
            ancienne_date_stock: ancienne_date_stock ? new Date(ancienne_date_stock) : undefined
        }
    });
    
    res.status(200).json(arriveeMiseAJour);
}));

// DELETE /api/historique_arrive/:id
router.delete('/:id', authenticateToken, ensureActiveUser, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userRole = req.user?.role;

    if (userRole === 'USER') {
        return res.status(403).json({ error: 'Accès interdit : permission insuffisante.' });
    }

    await prisma.historiqueArrive.delete({ 
        where: { id_arrivage: parseInt(id) } 
    });
    res.status(200).json({ message: `Enregistrement ${id} supprimé avec succès` });
}));

export default router;