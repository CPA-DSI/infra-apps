// routes/locauxRoutes.js
import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, ensureActiveUser, requirePermission } from '../middleware/authMiddleware.js';
import { PERMISSIONS } from '../constants/roles.js';

const prisma = new PrismaClient();

const router = express.Router();

// Middleware spécifique pour s'assurer que req.prisma est disponible
router.use((req, res, next) => {
    if (!req.prisma) {
        return res.status(500).json({ error: "Prisma client non disponible dans la requête." });
    }
    next();
});

router.use(authenticateToken, ensureActiveUser);

// 1. GET all locaux (READ)
router.get('/', requirePermission(PERMISSIONS.STOCKS_READ), async (req, res) => {
  try {
    const locaux = await req.prisma.Locaux.findMany();
    res.json(locaux);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. GET a single local by ID (READ one)
router.get('/:id', requirePermission(PERMISSIONS.STOCKS_READ), async (req, res) => {
    const { id } = req.params;
    try {
        const local = await req.prisma.Locaux.findUnique({
            where: { id_local: parseInt(id) },
        });
        if (local) {
            res.json(local);
        } else {
            res.status(404).json({ message: 'Local non trouvé' });
        }
    } catch (error) { 
        res.status(500).json({ error: error.message });
    }
});

// POST Create New Local
router.post('/', requirePermission(PERMISSIONS.STOCKS_WRITE), async (req, res) => {
  const { nom_local, description } = req.body; 

  console.log("Received POST request body for Locaux:", req.body); 

  if (!nom_local) {
     return res.status(400).json({ error: 'Le champ nom_local est requis.' });
  }

  try {
    const newLocal = await prisma.Locaux.create({
      data: { nom_local, description },
    });
    res.status(201).json(newLocal); // <-- Utilisation correcte de .json() avec l'objet créé
  } catch (error) {
    console.error("Error creating new local:", error);
    res.status(400).json({ error: `Failed to create local: ${error.message}` });
  }
});

// 4. PUT update a local (UPDATE)
// PUT Update Local by ID (Nouvelle route dédiée à la modification)
router.put('/:id', requirePermission(PERMISSIONS.STOCKS_WRITE), async (req, res) => {
    const { id } = req.params;
    const { nom_local, description } = req.body;

    console.log(`Received PUT request body for Local ID ${id}:`, req.body);

    if (!nom_local) {
        return res.status(400).json({ error: 'Le champ nom_local est requis.' });
    }

    try {
        const updatedLocal = await prisma.Locaux.update({
            where: { id_local: parseInt(id) },
            data: { nom_local, description },
        });
        res.status(200).json(updatedLocal); // <-- Utilisation correcte de .json() avec l'objet mis à jour
    } catch (error) {
        console.error("Error updating local:", error);
        // Gère l'erreur si l'ID n'existe pas, par exemple
        res.status(404).json({ error: `Failed to update local: ${error.message}` });
    }
});
/*router.put('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const localMisAJour = await req.prisma.Locaux.update({
      where: { id_local: parseInt(id) },
      data: req.body,
    });
    res.json(localMisAJour);
  } catch (error) { 
      if (error.code === 'P2025') { res.status(404).json({ message: 'Local non trouvé' }); } 
      else { res.status(400).json({ error: error.message }); }
  }
});*/

// 5. DELETE a local (DELETE)
router.delete('/:id', requirePermission(PERMISSIONS.STOCKS_WRITE), async (req, res) => {
  const { id } = req.params;
  try {
    await req.prisma.Locaux.delete({
      where: { id_local: parseInt(id) },
    });
    res.status(204).send();
  } catch (error) { 
      if (error.code === 'P2025') { res.status(404).json({ message: 'Local non trouvé' }); } 
      else { res.status(500).json({ error: error.message }); }
  }
});

export default router;
