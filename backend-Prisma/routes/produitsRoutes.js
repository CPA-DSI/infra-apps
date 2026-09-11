// routes/produitsRoutes.js
import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, ensureActiveUser, requirePermission } from '../middleware/authMiddleware.js';
import { PERMISSIONS } from '../constants/roles.js';

const prisma = new PrismaClient();

const router = express.Router();

// Le middleware spécifique pour s'assurer que req.prisma est disponible (au cas où) est une bonne pratique.
router.use((req, res, next) => {
    if (!req.prisma) {
        return res.status(500).json({ error: "Prisma client non disponible dans la requête." });
    }
    next();
});

router.use(authenticateToken, ensureActiveUser);

// 1. GET all products (READ)
router.get('/', requirePermission(PERMISSIONS.STOCKS_READ), async (req, res) => {
  try {
    // Utilisez 'prisma' directement au lieu de 'req.prisma'
    const produits = await prisma.Produits.findMany({
      orderBy: {
        last_date: 'desc', 
      },
    }); 
    res.json(produits);
  } catch (error) {
    console.error(error); 
    res.status(500).json({ 
      error: "Une erreur interne est survenue.", 
      details: error.message 
    });
  }
});


// 2. GET a single product by ID (READ one)
router.get('/:id', requirePermission(PERMISSIONS.STOCKS_READ), async (req, res) => {
    const { id } = req.params;
    try {
        // Assurez-vous que le champ de l'ID dans votre schéma Prisma est bien 'id_produit'
        const produit = await req.prisma.Produits.findUnique({
            where: { id_produit: parseInt(id) },
        });
        if (produit) {
            res.json(produit);
        } else {
            res.status(404).json({ message: 'Produit non trouvé' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 3. POST create a new product (CREATE)
router.post('/', requirePermission(PERMISSIONS.STOCKS_WRITE), async (req, res) => {
  const { nom_produit, quantite_en_stock, seuil_alerte, last_date } = req.body;
  try {
    const nouveauProduit = await prisma.Produits.create({
      data: {
        nom_produit,
        // Convertit les inputs potentiellement vides ou strings en Int ou null si nécessaire
        quantite_en_stock: quantite_en_stock ? parseInt(quantite_en_stock) : null,
        seuil_alerte: seuil_alerte ? parseInt(seuil_alerte) : null,
        last_date: last_date ? new Date(last_date) : null,
      },
    });
    res.status(201).json(nouveauProduit);
  } catch (error) {
    console.error("Erreur POST /produits:", error.message);
    res.status(400).json({ 
        error: "Erreur lors de la création du produit.", 
        details: error.message 
    });
  }
});

// 4. PUT update a product (UPDATE)
router.put('/:id', requirePermission(PERMISSIONS.STOCKS_WRITE), async (req, res) => {
  const { id } = req.params;
  const { nom_produit, quantite_en_stock, seuil_alerte, last_date } = req.body;
  try {
    const produitMisAJour = await prisma.Produits.update({
      where: { id_produit: parseInt(id) },
      data: {
        nom_produit,
        quantite_en_stock: quantite_en_stock ? parseInt(quantite_en_stock) : null,
        seuil_alerte: seuil_alerte ? parseInt(seuil_alerte) : null,
        last_date: last_date ? new Date(last_date) : null,
      },
    });
    res.json(produitMisAJour);
  } catch (error) {
    console.error("Erreur PUT /produits/:id:", error.message);
    res.status(400).json({ 
        error: "Erreur lors de la mise à jour du produit.", 
        details: error.message 
    });
  }
});

// 5. DELETE a product (DELETE)
router.delete('/:id', requirePermission(PERMISSIONS.STOCKS_WRITE), async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.Produits.delete({
      where: { id_produit: parseInt(id) },
    });
    res.status(204).send(); // 204 No Content for successful deletion
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
