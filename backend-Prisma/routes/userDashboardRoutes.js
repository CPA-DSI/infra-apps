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
      const [mesTickets, monMateriel] = await Promise.all([
        prisma.ticket.findMany({
          where: {
            OR: [
              { idDemandeur: userMatricule },
              { idAssigne: userMatricule },
            ],
          },
          include: {
            materiels: { include: { local: true } },
            assigneA: { include: { materiel: true } },
          },
          orderBy: { dateCreation: 'desc' },
          take: 10,
        }),
        prisma.Materiels.findFirst({
          where: { id_n: userMatricule },
          include: { local: true, marque: true },
        }),
      ]);

      const ticketsOuverts = mesTickets.filter(t => t.statut !== 'FERME').length;
      const ticketsFermes = mesTickets.filter(t => t.statut === 'FERME').length;

      res.json({
        role: userRole,
        id_n: userMatricule,
        materiel: monMateriel,
        tickets: {
          total: mesTickets.length,
          ouverts: ticketsOuverts,
          fermes: ticketsFermes,
          recents: mesTickets.slice(0, 5),
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
