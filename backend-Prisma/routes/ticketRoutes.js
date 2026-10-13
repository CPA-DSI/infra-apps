//ticketRoutes.js
import express from 'express';
import prisma from '../prismaClient.js';
import { authenticateToken, ensureActiveUser, requirePermission } from '../middleware/authMiddleware.js';
import { requireTicketOwnership, isTicketAdmin } from '../middleware/ownershipMiddleware.js';
import { PERMISSIONS } from '../constants/roles.js';
import { validateIdParam } from '../middleware/validateIdParam.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { formatTicket } from '../services/ticketService.js';

const router = express.Router();
router.param('id', validateIdParam);

router.use(authenticateToken, ensureActiveUser);

// Relations nécessaires à formatTicket (libellés demandeur / assigné)
const TICKET_INCLUDE = {
  materiels: { include: { local: true } },
  demandeur: { include: { materiel: true } },
  assigneA: { include: { materiel: true } },
};

const ticketIntrouvable = (res, id) => res.status(404).json({ error: `Ticket avec ID ${id} non trouvé` });

// GET /api/tickets : tous les tickets pour IT_ADMIN/DIRECTION, sinon ceux
// dont l'utilisateur est demandeur ou assigné.
router.get('/', requirePermission(PERMISSIONS.TICKETS_READ), asyncHandler(async (req, res) => {
  const userId = req.user?.id_n;

  const where = isTicketAdmin(req.user?.role)
    ? {}
    : { OR: [{ idDemandeur: userId }, { idAssigne: userId }] };

  const tickets = await prisma.ticket.findMany({
    where,
    include: TICKET_INCLUDE,
    orderBy: { dateCreation: 'desc' },
  });

  res.json(tickets.map(formatTicket));
}));

// GET /api/tickets/:id : Récupère un ticket par son ID
router.get('/:id', requirePermission(PERMISSIONS.TICKETS_READ), requireTicketOwnership, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const ticket = await prisma.ticket.findUnique({
    where: { idTicket: parseInt(id, 10) },
    include: { ...TICKET_INCLUDE, commentaires: true },
  });

  if (!ticket) return ticketIntrouvable(res, id);
  res.json(formatTicket(ticket));
}));

// Numéro de ticket suivant pour l'année en cours, incrémenté atomiquement en base
// (table ticket_counter) pour éviter les doublons lors de créations simultanées.
const nextNumeroTicket = async () => {
  const currentYear = new Date().getFullYear();
  const [{ dernier_numero }] = await prisma.$queryRaw`
    INSERT INTO "ticket_counter" ("annee", "dernier_numero")
    VALUES (${currentYear}, 1)
    ON CONFLICT ("annee") DO UPDATE SET "dernier_numero" = "ticket_counter"."dernier_numero" + 1
    RETURNING "dernier_numero"`;
  return `TICK-${currentYear}-${String(dernier_numero).padStart(6, '0')}`;
};

// Vérifie le matériel rattaché à un ticket : il doit exister et ne pas être
// supprimé (suppression logique, date_suppression). Les PC en stock et les
// fiches « Sans poste » (est_actif = false) restent acceptés : c'est le seul
// matériel d'un utilisateur sans PC. Pour un USER, le matériel doit être le sien.
// Retourne { status, error }, ou null si le matériel est valide.
const validateMaterielTicket = async (materielId, user) => {
  const materiel = await prisma.materiels.findFirst({
    where: { id_materiels: materielId, date_suppression: null },
    select: { id_materiels: true, id_n: true },
  });

  if (!materiel) {
    return { status: 400, error: "Le matériel sélectionné n'existe pas ou a été supprimé." };
  }
  if (!isTicketAdmin(user?.role) && materiel.id_n !== user?.id_n) {
    return { status: 403, error: "Vous ne pouvez créer un ticket que sur votre propre matériel." };
  }
  return null;
};

// POST /api/tickets : Crée un nouveau ticket
router.post('/', requirePermission(PERMISSIONS.TICKETS_WRITE), asyncHandler(async (req, res) => {
  const {
    titre,
    description,
    idMateriels,
    idDemandeur,
    statut,
    priorite,
    idAssigne,
    nomDemandeur,
    nomAssigne
  } = req.body;

  // Seuls IT_ADMIN/DIRECTION peuvent créer un ticket au nom d'un autre utilisateur ;
  // un USER voit son idDemandeur forcé à son propre id_n.
  const canImpersonate = isTicketAdmin(req.user?.role);

  // 1. Validation et conversion sécurisée des IDs
  const materielId = parseInt(idMateriels, 10);
  const demandeurId = canImpersonate ? parseInt(idDemandeur, 10) : req.user?.id_n;
  // L'assignation est gérée par la DSI : un USER ne peut pas choisir l'assigné.
  const assigneId = canImpersonate && idAssigne ? parseInt(idAssigne, 10) : null;

  // 2. Vérification de sécurité pour éviter le NaN dans Prisma
  if (isNaN(materielId) || isNaN(demandeurId)) {
    return res.status(400).json({
      error: "idMateriels et idDemandeur doivent être des nombres valides."
    });
  }

  const materielInvalide = await validateMaterielTicket(materielId, req.user);
  if (materielInvalide) {
    return res.status(materielInvalide.status).json({ error: materielInvalide.error });
  }

  // 3. Génération automatique du numéro de ticket : TICK-{ANNEE}-{SEQUENCE:6}
  const numeroTicket = await nextNumeroTicket();

  const newTicket = await prisma.ticket.create({
    data: {
      numeroTicket,
      titre: titre,
      description: description,
      // Le statut est géré par la DSI : un USER crée toujours un ticket NOUVEAU
      statut: canImpersonate ? (statut || "NOUVEAU") : "NOUVEAU",
      priorite: priorite || "MOYENNE",
      // Sauvegarde des noms
      nomDemandeur: nomDemandeur || "",
      nomAssigne: canImpersonate ? (nomAssigne || "") : "",

      materiels: {
        connect: { id_materiels: materielId }
      },
      demandeur: {
        connect: { id_n: demandeurId }
      },
      // Connexion optionnelle à l'assigné
      ...(assigneId && {
        assigneA: {
          connect: { id_n: assigneId }
        }
      }),
    },
    include: TICKET_INCLUDE,
  });

  res.status(201).json(formatTicket(newTicket));
}));

// PUT /api/tickets/:id/assign : Assigne un ticket à un technicien DSI (réservé IT_ADMIN/DIRECTION)
router.put('/:id/assign', requirePermission(PERMISSIONS.TICKETS_CLOSE), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { idAssigne, nomAssigne } = req.body;

  const updateData = {
    idAssigne: idAssigne ? parseInt(idAssigne, 10) : null,
    nomAssigne: nomAssigne !== undefined ? nomAssigne : '',
  };

  try {
    const updatedTicket = await prisma.ticket.update({
      where: { idTicket: parseInt(id, 10) },
      data: updateData,
      include: TICKET_INCLUDE,
    });
    res.json(formatTicket(updatedTicket));
  } catch (error) {
    if (error.code === 'P2025') return ticketIntrouvable(res, id);
    throw error;
  }
}));

// PUT /api/tickets/:id/close : Ferme un ticket (crée un TicketFermeture + met à jour le statut)
// Réservé aux rôles ayant la permission tickets:close (IT_ADMIN/DIRECTION)
router.put('/:id/close', requirePermission(PERMISSIONS.TICKETS_CLOSE), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { solution, motif, dureeResolution } = req.body;

  if (!solution || !solution.trim()) {
    return res.status(400).json({ error: "La solution est obligatoire pour fermer un ticket." });
  }

  const ticketId = parseInt(id, 10);

  const existingTicket = await prisma.ticket.findUnique({
    where: { idTicket: ticketId }
  });

  if (!existingTicket) return ticketIntrouvable(res, id);

  // Résoudre l'id_n de l'utilisateur courant (fermé par)
  const user = await prisma.users.findUnique({
    where: { id_user: req.user?.userId }
  });
  if (!user) {
    return res.status(403).json({ error: "Utilisateur non autorisé à fermer ce ticket." });
  }

  const dureeMinutes = dureeResolution ? parseInt(dureeResolution, 10) : null;

  try {
    // Fermeture + changement de statut dans une même transaction : pas de
    // TicketFermeture orphelin si la mise à jour du ticket échoue.
    const updatedTicket = await prisma.$transaction(async (tx) => {
      // Créer l'enregistrement de fermeture (contrainte unique sur ticketId)
      await tx.ticketFermeture.create({
        data: {
          ticketId: ticketId,
          solution: solution.trim(),
          motif: motif ? motif.trim() : null,
          dureeResolution: Number.isNaN(dureeMinutes) ? null : dureeMinutes,
          fermePar: user.id_n,
        }
      });

      return tx.ticket.update({
        where: { idTicket: ticketId },
        data: { statut: 'RESOLU' },
        include: { ...TICKET_INCLUDE, fermeture: true },
      });
    });

    res.json(formatTicket(updatedTicket));
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: "Ce ticket est déjà fermé." });
    }
    if (error.code === 'P2025') return ticketIntrouvable(res, id);
    throw error;
  }
}));

// PUT /api/tickets/:id : Met à jour un ticket
router.put('/:id', requirePermission(PERMISSIONS.TICKETS_WRITE), requireTicketOwnership, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
      titre,
      description,
      statut,
      priorite,
      idMateriels,
      idAssigne,
      nomDemandeur,
      nomAssigne
  } = req.body;

  const isAdmin = isTicketAdmin(req.user?.role);

  // Un USER ne peut modifier que le titre, la description et la priorité de son
  // ticket : statut, assignation, matériel et demandeur sont gérés par la DSI.
  // La solution passe par PUT /:id/close (TicketFermeture).
  if (!isAdmin) {
    const champsInterdits = ['statut', 'idAssigne', 'nomAssigne', 'idMateriels', 'idDemandeur', 'nomDemandeur']
      .filter(champ => req.body[champ] !== undefined);
    if (champsInterdits.length > 0) {
      return res.status(403).json({
        error: `Accès interdit : modification non autorisée des champs ${champsInterdits.join(', ')}.`
      });
    }
  }

  // Récupérer le ticket existant pour conserver les valeurs si non fournies
  const existingTicket = await prisma.ticket.findUnique({
    where: { idTicket: parseInt(id, 10) }
  });

  if (!existingTicket) return ticketIntrouvable(res, id);

  // Préparer les données de mise à jour
  const updateData = {
    titre: titre || existingTicket.titre,
    description: description || existingTicket.description,
    priorite: priorite || existingTicket.priorite,
  };

  if (isAdmin) {
    const materielId = idMateriels ? parseInt(idMateriels, 10) : existingTicket.idMateriels;
    if (isNaN(materielId)) {
      return res.status(400).json({ error: "idMateriels doit être un nombre valide." });
    }
    if (materielId !== existingTicket.idMateriels) {
      const materielInvalide = await validateMaterielTicket(materielId, req.user);
      if (materielInvalide) {
        return res.status(materielInvalide.status).json({ error: materielInvalide.error });
      }
    }

    Object.assign(updateData, {
      statut: statut || existingTicket.statut,
      idMateriels: materielId,
      idAssigne: idAssigne !== undefined ? (idAssigne ? parseInt(idAssigne, 10) : null) : existingTicket.idAssigne,
      // Mettre à jour les noms sauvegardés si fournis
      nomDemandeur: nomDemandeur !== undefined ? nomDemandeur : existingTicket.nomDemandeur,
      nomAssigne: nomAssigne !== undefined ? nomAssigne : existingTicket.nomAssigne,
    });
  }

  // Rouvrir un ticket (RESOLU/FERME -> NOUVEAU/EN_COURS) supprime sa fiche de
  // fermeture : sinon la contrainte unique sur ticketId fait échouer (409)
  // toute fermeture ultérieure.
  const STATUTS_FERMES = ['RESOLU', 'FERME'];
  const rouverture = STATUTS_FERMES.includes(existingTicket.statut)
    && updateData.statut && !STATUTS_FERMES.includes(updateData.statut);

  try {
    const updatedTicket = await prisma.$transaction(async (tx) => {
      if (rouverture) {
        await tx.ticketFermeture.deleteMany({ where: { ticketId: existingTicket.idTicket } });
      }
      return tx.ticket.update({
        where: { idTicket: parseInt(id, 10) },
        data: updateData,
        include: TICKET_INCLUDE,
      });
    });

    res.json(formatTicket(updatedTicket));
  } catch (error) {
    if (error.code === 'P2025') return ticketIntrouvable(res, id);
    throw error;
  }
}));

// DELETE /api/tickets/:id (réservé IT_ADMIN/DIRECTION)
router.delete('/:id', requirePermission(PERMISSIONS.TICKETS_CLOSE), asyncHandler(async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.ticket.delete({
      where: { idTicket: parseInt(id, 10) },
    });
    res.status(204).send();
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: `Le ticket #${id} est introuvable.` });
    }
    throw error;
  }
}));

export default router;
