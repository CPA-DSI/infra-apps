import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, ensureActiveUser } from '../middleware/authMiddleware.js';

const prisma = new PrismaClient();
const router = express.Router();

router.get('/me/dashboard', authenticateToken, ensureActiveUser, async (req, res) => {
  try {
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

    if (userRole === 'USER') {
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
        prisma.Materiels.count({ where: { est_actif: true } }),
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
  } catch (error) {
    console.error('Erreur dashboard:', error);
    res.status(500).json({ error: 'Erreur lors du chargement du tableau de bord.' });
  }
});

export default router;
