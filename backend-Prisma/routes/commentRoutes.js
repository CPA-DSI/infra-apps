
import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, ensureActiveUser, requirePermission } from '../middleware/authMiddleware.js';
import { PERMISSIONS } from '../constants/roles.js';

const prisma = new PrismaClient();
const router = express.Router();

router.use(authenticateToken, ensureActiveUser);

// 1. Ajouter un commentaire (POST /api/commentaires)
router.post('/', requirePermission(PERMISSIONS.TICKETS_WRITE), async (req, res) => {
    const { contenu, idTicket, idAuteur } = req.body;

    if (!contenu || !idTicket || !idAuteur) {
        return res.status(400).json({ error: "Champs obligatoires manquants" });
    }

    try {
        const nouveauCommentaire = await prisma.historiqueCommentaire.create({
            data: {
                contenu: contenu,
                ticket: { connect: { idTicket: parseInt(idTicket) } },
                auteur: { connect: { id_n: parseInt(idAuteur) } }
            },
            include: {
                auteur: { include: { materiel: true } }
            }
        });
        res.status(201).json(nouveauCommentaire);
    } catch (error) {
        console.error("Erreur Prisma:", error);
        res.status(500).json({ error: "Erreur lors de la création du commentaire" });
    }
});

// 2. Récupérer les commentaires d'un ticket (GET /api/commentaires/ticket/:idTicket)
router.get('/ticket/:idTicket', requirePermission(PERMISSIONS.TICKETS_READ), async (req, res) => {
    const { idTicket } = req.params;

    try {
        const commentaires = await prisma.historiqueCommentaire.findMany({
            where: { idTicket: parseInt(idTicket) },
            include: {
                auteur: { include: { materiel: true } }
            },
            orderBy: { datePubli: 'desc' }
        });
        res.json(commentaires);
    } catch (error) {
        res.status(500).json({ error: "Erreur lors de la récupération des commentaires" });
    }
});

// 3. Supprimer un commentaire (DELETE /api/commentaires/:id)
router.delete('/:id', requirePermission(PERMISSIONS.TICKETS_WRITE), async (req, res) => {
    const { id } = req.params;

    try {
        await prisma.historiqueCommentaire.delete({
            where: { idCommentaire: parseInt(id) }
        });
        res.json({ message: "Commentaire supprimé avec succès" });
    } catch (error) {
        res.status(500).json({ error: "Erreur lors de la suppression" });
    }
});

// 4. Modifier un commentaire (PUT /api/commentaires/:id)
router.put('/:id', requirePermission(PERMISSIONS.TICKETS_WRITE), async (req, res) => {
    const { id } = req.params;
    const { contenu } = req.body;

    try {
        const commentaireModifie = await prisma.historiqueCommentaire.update({
            where: { idCommentaire: parseInt(id) },
            data: { contenu: contenu }
        });
        res.json(commentaireModifie);
    } catch (error) {
        res.status(500).json({ error: "Erreur lors de la modification" });
    }
});

export default router;
