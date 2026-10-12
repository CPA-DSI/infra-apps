import { UserRole } from '../constants/roles.js';

// IT_ADMIN et DIRECTION voient et gèrent tous les tickets.
export const isTicketAdmin = (role) => role === UserRole.IT_ADMIN || role === UserRole.DIRECTION;

// Vérifie qu'un utilisateur peut accéder à un ticket : admin, ou demandeur/assigné.
// Retourne 'ok', 'not_found' ou 'forbidden'. Partagé par les routes tickets et commentaires.
export const checkTicketAccess = async (prismaClient, user, ticketId) => {
  if (isTicketAdmin(user?.role)) {
    const exists = await prismaClient.ticket.findUnique({
      where: { idTicket: ticketId },
      select: { idTicket: true },
    });
    return exists ? 'ok' : 'not_found';
  }

  const ticket = await prismaClient.ticket.findUnique({
    where: { idTicket: ticketId },
    select: { idDemandeur: true, idAssigne: true },
  });

  if (!ticket) return 'not_found';

  const userId = user?.id_n;
  const isOwner = ticket.idDemandeur === userId || ticket.idAssigne === userId;
  return isOwner ? 'ok' : 'forbidden';
};

export const requireTicketOwnership = async (req, res, next) => {
  const userRole = req.user?.role;
  const userId = req.user?.id_n;

  if (!userId) {
    return res.status(401).json({ error: 'Utilisateur non authentifié.' });
  }

  if (isTicketAdmin(userRole)) {
    return next();
  }

  const ticketId = parseInt(req.params.id, 10);
  if (isNaN(ticketId)) {
    return res.status(400).json({ error: 'ID ticket invalide.' });
  }

  try {
    // Client Prisma partagé, injecté par server.js
    const access = await checkTicketAccess(req.prisma, req.user, ticketId);

    if (access === 'not_found') {
      return res.status(404).json({ error: 'Ticket non trouve.' });
    }
    if (access === 'forbidden') {
      return res.status(403).json({ error: 'Acces interdit : ticket non autorise.' });
    }
  } catch (error) {
    console.error('Erreur requireTicketOwnership:', error);
    return res.status(500).json({ error: 'Une erreur est survenue côté serveur.' });
  }

  next();
};
