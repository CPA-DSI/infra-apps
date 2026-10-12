
import express from 'express';
import prisma from '../prismaClient.js';
import { authenticateToken, ensureActiveUser, requirePermission } from '../middleware/authMiddleware.js';
import { PERMISSIONS } from '../constants/roles.js';
import { validateIdParam } from '../middleware/validateIdParam.js';
import { checkTicketAccess, isTicketAdmin } from '../middleware/ownershipMiddleware.js';

const router = express.Router();
router.param('id', validateIdParam);

router.use(authenticateToken, ensureActiveUser);

// Renvoie une réponse d'erreur si l'utilisateur n'a pas accès au ticket
// (USER : uniquement ses tickets, demandeur ou assigné). Retourne true si la réponse est envoyée.
const denyIfNoTicketAccess = async (req, res, ticketId) => {
    const access = await checkTicketAccess(prisma, req.user, ticketId);
    if (access === 'not_found') {
        res.status(404).json({ error: "Ticket non trouvé" });
        return true;
    }
    if (access === 'forbidden') {
        res.status(403).json({ error: "Accès interdit : ticket non autorisé" });
        return true;
    }
    return false;
};

// Seul l'auteur du commentaire, ou IT_ADMIN/DIRECTION, peut le modifier ou le supprimer.
// Retourne true si une réponse d'erreur a été envoyée.
const denyIfNotCommentAuthor = async (req, res, commentId) => {
    const commentaire = await prisma.historiqueCommentaire.findUnique({
        where: { idCommentaire: commentId },
        select: { idAuteur: true }
    });
    if (!commentaire) {
        res.status(404).json({ error: "Commentaire non trouvé" });
        return true;
    }
    if (!isTicketAdmin(req.user?.role) && commentaire.idAuteur !== req.user?.id_n) {
        res.status(403).json({ error: "Accès interdit : vous n'êtes pas l'auteur de ce commentaire" });
        return true;
    }
    return false;
};

// 1. Ajouter un commentaire (POST /api/commentaires)
// L'auteur est toujours l'utilisateur connecté (req.user.id_n) : un éventuel idAuteur du body est ignoré.
router.post('/', requirePermission(PERMISSIONS.TICKETS_WRITE), async (req, res) => {
    const { contenu, idTicket } = req.body;
    const idAuteur = req.user?.id_n;
    const ticketId = parseInt(idTicket, 10);

    if (!contenu || !String(contenu).trim() || isNaN(ticketId) || !idAuteur) {
        return res.status(400).json({ error: "Champs obligatoires manquants" });
    }

    try {
        if (await denyIfNoTicketAccess(req, res, ticketId)) return;

        const nouveauCommentaire = await prisma.historiqueCommentaire.create({
            data: {
                contenu: contenu,
                ticket: { connect: { idTicket: ticketId } },
                auteur: { connect: { id_n: idAuteur } }
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
    const ticketId = parseInt(req.params.idTicket, 10);
    if (isNaN(ticketId)) {
        return res.status(400).json({ error: "ID ticket invalide" });
    }

    try {
        if (await denyIfNoTicketAccess(req, res, ticketId)) return;

        const commentaires = await prisma.historiqueCommentaire.findMany({
            where: { idTicket: ticketId },
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
    const commentId = parseInt(req.params.id, 10);

    try {
        if (await denyIfNotCommentAuthor(req, res, commentId)) return;

        await prisma.historiqueCommentaire.delete({
            where: { idCommentaire: commentId }
        });
        res.json({ message: "Commentaire supprimé avec succès" });
    } catch (error) {
        res.status(500).json({ error: "Erreur lors de la suppression" });
    }
});

// 4. Modifier un commentaire (PUT /api/commentaires/:id)
router.put('/:id', requirePermission(PERMISSIONS.TICKETS_WRITE), async (req, res) => {
    const commentId = parseInt(req.params.id, 10);
    const { contenu } = req.body;

    if (!contenu || !String(contenu).trim()) {
        return res.status(400).json({ error: "Le contenu est obligatoire" });
    }

    try {
        if (await denyIfNotCommentAuthor(req, res, commentId)) return;

        const commentaireModifie = await prisma.historiqueCommentaire.update({
            where: { idCommentaire: commentId },
            data: { contenu: contenu }
        });
        res.json(commentaireModifie);
    } catch (error) {
        res.status(500).json({ error: "Erreur lors de la modification" });
    }
});

export default router;
