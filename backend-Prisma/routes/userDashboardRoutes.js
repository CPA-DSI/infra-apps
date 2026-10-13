import express from 'express';
import prisma from '../prismaClient.js';
import { authenticateToken, ensureActiveUser } from '../middleware/authMiddleware.js';
import { isTicketAdmin } from '../middleware/ownershipMiddleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = express.Router();

router.get('/me/dashboard', authenticateToken, ensureActiveUser, asyncHandler(async (req, res) => {
  const userRole = req.user?.role;
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(400).json({ error: 'Identifiant utilisateur manquant.' });
  }

  const currentUser = await prisma.users.findUnique({
    where: { id_user: userId },
    select: { id_n: true },
  });

  if (!currentUser) {
    return res.status(404).json({ error: 'Utilisateur introuvable.' });
  }

  const userMatricule = currentUser.id_n;

  // Vue globale réservée à IT_ADMIN/DIRECTION ; tout autre rôle (y compris
  // inconnu) n'obtient que son propre tableau de bord.
  if (!isTicketAdmin(userRole)) {
    const ticketsWhere = {
      OR: [
        { idDemandeur: userMatricule },
        { idAssigne: userMatricule },
      ],
    };

    const [ticketsRecents, monMateriel, statutsGroupBy] = await Promise.all([
      prisma.ticket.findMany({
        where: ticketsWhere,
        include: {
          materiels: { include: { local: true } },
          assigneA: { include: { materiel: true } },
        },
        orderBy: { dateCreation: 'desc' },
        take: 5,
      }),
      prisma.Materiels.findFirst({
        where: { id_n: userMatricule },
        include: { local: true, marque: true },
      }),
      prisma.ticket.groupBy({
        by: ['statut'],
        where: ticketsWhere,
        _count: { statut: true },
      }),
    ]);

    const parStatut = { NOUVEAU: 0, EN_COURS: 0, RESOLU: 0, FERME: 0 };
    let ticketsTotal = 0;
    statutsGroupBy.forEach(({ statut, _count }) => {
      if (Object.prototype.hasOwnProperty.call(parStatut, statut)) {
        parStatut[statut] = _count.statut;
      }
      ticketsTotal += _count.statut;
    });

    res.json({
      role: userRole,
      id_n: userMatricule,
      materiel: monMateriel,
      tickets: {
        total: ticketsTotal,
        ouverts: ticketsTotal - parStatut.FERME,
        fermes: parStatut.FERME,
        parStatut,
        recents: ticketsRecents,
      },
    });
  } else {
    const [totalTickets, totalMateriels, ticketsRecents] = await Promise.all([
      prisma.ticket.count(),
      prisma.Materiels.count({ where: { est_actif: true, date_suppression: null } }),
      prisma.ticket.findMany({
        take: 5,
        orderBy: { dateCreation: 'desc' },
        include: { materiels: { include: { local: true } } },
      }),
    ]);

    res.json({
      role: userRole,
      id_n: userMatricule,
      stats: {
        totalTickets,
        totalMateriels,
      },
      ticketsRecents,
    });
  }
}));

export default router;
