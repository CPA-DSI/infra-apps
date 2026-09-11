import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const requireTicketOwnership = async (req, res, next) => {
  const userRole = req.user?.role;
  const userId = req.user?.id_n;

  if (!userId) {
    return res.status(401).json({ error: 'Utilisateur non authentifié.' });
  }

  if (userRole === 'IT_ADMIN' || userRole === 'DIRECTION') {
    return next();
  }

  const ticketId = parseInt(req.params.id, 10);
  if (isNaN(ticketId)) {
    return res.status(400).json({ error: 'ID ticket invalide.' });
  }

  const ticket = await prisma.ticket.findUnique({
    where: { idTicket: ticketId },
    select: { idDemandeur: true, idAssigne: true },
  });

  if (!ticket) {
    return res.status(404).json({ error: 'Ticket non trouve.' });
  }

  const isOwner = ticket.idDemandeur === userId || ticket.idAssigne === userId;
  if (!isOwner) {
    return res.status(403).json({ error: 'Acces interdit : ticket non autorise.' });
  }

  next();
};
