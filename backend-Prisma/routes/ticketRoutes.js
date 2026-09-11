//ticketRoutes.js
import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, ensureActiveUser, requirePermission } from '../middleware/authMiddleware.js';
import { requireTicketOwnership } from '../middleware/ownershipMiddleware.js';
import { UserRole } from '../constants/roles.js';

const prisma = new PrismaClient();
const router = express.Router();

// GET /api/tickets : Récupère tous les tickets
router.get('/', authenticateToken, ensureActiveUser, async (req, res) => {
  try {
    const userRole = req.user?.role;
    const userId = req.user?.id_n;

    let where = {};
    if (userRole === 'USER') {
      where = {
        OR: [
          { idDemandeur: userId },
          { idAssigne: userId },
        ],
      };
    }

    const tickets = await prisma.ticket.findMany({
      where,
      include: {
        materiels: { include: { local: true } },
        demandeur: { include: { materiel: true } },
        assigneA: { include: { materiel: true } },
      },
      orderBy: {
        dateCreation: 'desc'
      }
    });

    const formattedTickets = tickets.map(ticket => ({
      ...ticket,
      nomDemandeurFormate: ticket.demandeur?.materiel?.utilisateur
        ? `N° ${ticket.demandeur.id_n} : ${ticket.demandeur.materiel.utilisateur} (${ticket.demandeur.materiel.equipe || 'N/A'})`
        : (ticket.nomDemandeur || null),
      equipeDemandeur: ticket.demandeur?.materiel?.equipe ?? null,
      nomAssigneFormate: ticket.assigneA?.materiel?.utilisateur
        ? `N° ${ticket.assigneA.id_n} : ${ticket.assigneA.materiel.utilisateur} (${ticket.assigneA.materiel.equipe || 'N/A'})`
        : (ticket.nomAssigne || null),
      equipeAssigne: ticket.assigneA?.materiel?.equipe ?? null,
    }));

    res.json(formattedTickets);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/tickets/:id : Récupère un ticket par son ID
router.get('/:id', authenticateToken, ensureActiveUser, requireTicketOwnership, async (req, res) => {
  const { id } = req.params;
  try {
    const ticket = await prisma.ticket.findUnique({
      where: { idTicket: parseInt(id) },
      include: {
        materiels: { include: { local: true } },
        demandeur: { include: { materiel: true } },
        assigneA: { include: { materiel: true } },
        commentaires: true,
      },
    });
    
    if (ticket) {
      // Formater le ticket avec les noms sauvegardés
      const formattedTicket = {
        ...ticket,
        nomDemandeurFormate: ticket.demandeur?.materiel?.utilisateur
          ? `N° ${ticket.demandeur.id_n} : ${ticket.demandeur.materiel.utilisateur} (${ticket.demandeur.materiel.equipe || 'N/A'})`
          : (ticket.nomDemandeur || null),
        equipeDemandeur: ticket.demandeur?.materiel?.equipe ?? null,
        nomAssigneFormate: ticket.assigneA?.materiel?.utilisateur
          ? `N° ${ticket.assigneA.id_n} : ${ticket.assigneA.materiel.utilisateur} (${ticket.assigneA.materiel.equipe || 'N/A'})`
          : (ticket.nomAssigne || null),
        equipeAssigne: ticket.assigneA?.materiel?.equipe ?? null,
      };
      res.json(formattedTicket);
    } else {
      res.status(404).json({ error: `Ticket avec ID ${id} non trouvé` });
    }
  } catch (error) {
    console.error("Erreur API:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/tickets : Crée un nouveau ticket
router.post('/', authenticateToken, ensureActiveUser, async (req, res) => {
  const {
    titre,
    description,
    idMateriels,
    idDemandeur,
    statut,
    priorite,
    idAssigne,
    nomDemandeur,   // Nouveau champ
    nomAssigne      // Nouveau champ
  } = req.body;

  try {
    // Seuls IT_ADMIN/DIRECTION peuvent créer un ticket au nom d'un autre utilisateur ;
    // un USER voit son idDemandeur forcé à son propre id_n.
    const userRole = req.user?.role;
    const canImpersonate = userRole === UserRole.IT_ADMIN || userRole === UserRole.DIRECTION;

    // 1. Validation et conversion sécurisée des IDs
    const materielId = parseInt(idMateriels);
    const demandeurId = canImpersonate ? parseInt(idDemandeur) : req.user?.id_n;
    const assigneId = idAssigne ? parseInt(idAssigne) : null;

    // 2. Vérification de sécurité pour éviter le NaN dans Prisma
    if (isNaN(materielId) || isNaN(demandeurId)) {
      return res.status(400).json({ 
        error: "idMateriels et idDemandeur doivent être des nombres valides." 
      });
    }

    console.log("Tentative de connexion avec Materiel ID:", materielId); 
    console.log("Tentative de connexion avec Demandeur ID:", demandeurId); 
    console.log("Tentative de connexion avec Assigne ID:", assigneId);
    console.log("Nom Demandeur sauvegardé:", nomDemandeur);
    console.log("Nom Assigné sauvegardé:", nomAssigne);

    // 3. Génération automatique du numéro de ticket : TICK-{ANNEE}-{SEQUENCE:6}
    const currentYear = new Date().getFullYear();
    const lastTicket = await prisma.ticket.findFirst({
      where: {
        numeroTicket: {
          startsWith: `TICK-${currentYear}-`
        }
      },
      orderBy: {
        idTicket: 'desc'
      }
    });

    let nextSequence = 1;
    if (lastTicket) {
      const parts = lastTicket.numeroTicket.split('-');
      if (parts.length === 3) {
        nextSequence = parseInt(parts[2], 10) + 1;
      }
    }
    const numeroTicket = `TICK-${currentYear}-${nextSequence.toString().padStart(6, '0')}`;

    const newTicket = await prisma.ticket.create({
      data: {
        numeroTicket,
        titre: titre,
        description: description,
        statut: statut || "NOUVEAU",
        priorite: priorite || "MOYENNE",
        // Sauvegarde des noms
        nomDemandeur: nomDemandeur || "",
        nomAssigne: nomAssigne || "",

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
      include: {
        demandeur: true,
        assigneA: true,
        materiels: { include: { local: true } },
      }
    });

    // Formater la réponse avec les noms
    const formattedTicket = {
      ...newTicket,
      nomDemandeurFormate: newTicket.demandeur?.materiel?.utilisateur
        ? `N° ${newTicket.demandeur.id_n} : ${newTicket.demandeur.materiel.utilisateur} (${newTicket.demandeur.materiel.equipe || 'N/A'})`
        : (newTicket.nomDemandeur || null),
      equipeDemandeur: newTicket.demandeur?.materiel?.equipe ?? null,
      nomAssigneFormate: newTicket.assigneA?.materiel?.utilisateur
        ? `N° ${newTicket.assigneA.id_n} : ${newTicket.assigneA.materiel.utilisateur} (${newTicket.assigneA.materiel.equipe || 'N/A'})`
        : (newTicket.nomAssigne || null),
      equipeAssigne: newTicket.assigneA?.materiel?.equipe ?? null,
    };

    res.status(201).json(formattedTicket);
  } catch (error) {
    console.error("Erreur Prisma détaillée:", error.message);
    res.status(500).json({ 
      error: "Erreur lors de la création du ticket",
      details: error.message 
    });
  }
});

// PUT /api/tickets/:id/assign : Assigne un ticket à un technicien DSI
router.put('/:id/assign', authenticateToken, ensureActiveUser, requireTicketOwnership, async (req, res) => {
  const { id } = req.params;
  const { idAssigne, nomAssigne } = req.body;

  try {
    const assigneId = idAssigne ? parseInt(idAssigne) : null;

    const updateData = {
      idAssigne: assigneId,
      nomAssigne: nomAssigne !== undefined ? nomAssigne : '',
    };

    const updatedTicket = await prisma.ticket.update({
      where: { idTicket: parseInt(id) },
      data: updateData,
      include: {
        demandeur: { include: { materiel: true } },
        assigneA: { include: { materiel: true } },
        materiels: { include: { local: true } },
      },
    });

    const formattedTicket = {
      ...updatedTicket,
      nomDemandeurFormate: updatedTicket.demandeur?.materiel?.utilisateur
        ? `N° ${updatedTicket.demandeur.id_n} : ${updatedTicket.demandeur.materiel.utilisateur} (${updatedTicket.demandeur.materiel.equipe || 'N/A'})`
        : (updatedTicket.nomDemandeur || null),
      equipeDemandeur: updatedTicket.demandeur?.materiel?.equipe ?? null,
      nomAssigneFormate: updatedTicket.assigneA?.materiel?.utilisateur
        ? `N° ${updatedTicket.assigneA.id_n} : ${updatedTicket.assigneA.materiel.utilisateur} (${updatedTicket.assigneA.materiel.equipe || 'N/A'})`
        : (updatedTicket.nomAssigne || null),
      equipeAssigne: updatedTicket.assigneA?.materiel?.equipe ?? null,
    };

    res.json(formattedTicket);
  } catch (error) {
    if (error.code === 'P2025') {
      res.status(404).json({ error: `Ticket avec ID ${id} non trouvé` });
    } else {
      console.error("Erreur Prisma:", error);
      res.status(500).json({ error: "Erreur interne du serveur lors de l'assignation." });
    }
  }
});

// PUT /api/tickets/:id/close : Ferme un ticket (crée un TicketFermeture + met à jour le statut)
router.put('/:id/close', authenticateToken, ensureActiveUser, requireTicketOwnership, async (req, res) => {
  const { id } = req.params;
  const { solution, motif, dureeResolution } = req.body;

  if (!solution || !solution.trim()) {
    return res.status(400).json({ error: "La solution est obligatoire pour fermer un ticket." });
  }

  try {
    const ticketId = parseInt(id);

    const existingTicket = await prisma.ticket.findUnique({
      where: { idTicket: ticketId }
    });

    if (!existingTicket) {
      return res.status(404).json({ error: `Ticket avec ID ${id} non trouvé` });
    }

    // Résoudre l'id_n de l'utilisateur courant (fermé par)
    const userId = req.user?.userId;
    const user = await prisma.users.findUnique({
      where: { id_user: userId }
    });
    if (!user) {
      return res.status(403).json({ error: "Utilisateur non autorisé à fermer ce ticket." });
    }

    // Créer l'enregistrement de fermeture (contrainte unique sur ticketId)
    await prisma.ticketFermeture.create({
      data: {
        ticketId: ticketId,
        solution: solution.trim(),
        motif: motif ? motif.trim() : null,
        dureeResolution: dureeResolution ? parseInt(dureeResolution, 10) : null,
        fermePar: user.id_n,
      }
    });

    const updatedTicket = await prisma.ticket.update({
      where: { idTicket: ticketId },
      data: {
        statut: 'RESOLU',
      },
      include: {
        demandeur: { include: { materiel: true } },
        assigneA: { include: { materiel: true } },
        materiels: { include: { local: true } },
        fermeture: true,
      },
    });

    const formattedTicket = {
      ...updatedTicket,
      nomDemandeurFormate: updatedTicket.demandeur?.materiel?.utilisateur
        ? `N° ${updatedTicket.demandeur.id_n} : ${updatedTicket.demandeur.materiel.utilisateur} (${updatedTicket.demandeur.materiel.equipe || 'N/A'})`
        : (updatedTicket.nomDemandeur || null),
      equipeDemandeur: updatedTicket.demandeur?.materiel?.equipe ?? null,
      nomAssigneFormate: updatedTicket.assigneA?.materiel?.utilisateur
        ? `N° ${updatedTicket.assigneA.id_n} : ${updatedTicket.assigneA.materiel.utilisateur} (${updatedTicket.assigneA.materiel.equipe || 'N/A'})`
        : (updatedTicket.nomAssigne || null),
      equipeAssigne: updatedTicket.assigneA?.materiel?.equipe ?? null,
    };

    res.json(formattedTicket);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: "Ce ticket est déjà fermé." });
    }
    if (error.code === 'P2025') {
      return res.status(404).json({ error: `Ticket avec ID ${id} non trouvé` });
    }
    console.error("Erreur lors de la fermeture du ticket:", error);
    res.status(500).json({ error: "Erreur interne du serveur lors de la fermeture." });
  }
});

// PUT /api/tickets/:id : Met à jour un ticket
router.put('/:id', authenticateToken, ensureActiveUser, requireTicketOwnership, async (req, res) => {
  const { id } = req.params;
  const { 
      titre, 
      description, 
      statut, 
      priorite, 
      idMateriels,
      idAssigne,
      solution,
      nomDemandeur,   // Nouveau champ
      nomAssigne      // Nouveau champ
  } = req.body;

  try {
    // Récupérer le ticket existant pour conserver les valeurs si non fournies
    const existingTicket = await prisma.ticket.findUnique({
      where: { idTicket: parseInt(id) }
    });

    if (!existingTicket) {
      return res.status(404).json({ error: `Ticket avec ID ${id} non trouvé` });
    }

    // Préparer les données de mise à jour
    const updateData = {
      titre: titre || existingTicket.titre,
      description: description || existingTicket.description,
      statut: statut || existingTicket.statut,
      priorite: priorite || existingTicket.priorite,
      idMateriels: idMateriels ? parseInt(idMateriels) : existingTicket.idMateriels,
      idAssigne: idAssigne !== undefined ? (idAssigne ? parseInt(idAssigne) : null) : existingTicket.idAssigne,
      solution: solution !== undefined ? solution : existingTicket.solution,
      // Mettre à jour les noms sauvegardés si fournis
      nomDemandeur: nomDemandeur !== undefined ? nomDemandeur : existingTicket.nomDemandeur,
      nomAssigne: nomAssigne !== undefined ? nomAssigne : existingTicket.nomAssigne,
    };

    const updatedTicket = await prisma.ticket.update({
      where: { idTicket: parseInt(id) },
      data: updateData,
      include: {
        demandeur: true,
        assigneA: true,
        materiels: { include: { local: true } },
      }
    });

    // Formater la réponse avec les noms
    const formattedTicket = {
      ...updatedTicket,
      nomDemandeurFormate: updatedTicket.demandeur?.materiel?.utilisateur
        ? `N° ${updatedTicket.demandeur.id_n} : ${updatedTicket.demandeur.materiel.utilisateur} (${updatedTicket.demandeur.materiel.equipe || 'N/A'})`
        : (updatedTicket.nomDemandeur || null),
      equipeDemandeur: updatedTicket.demandeur?.materiel?.equipe ?? null,
      nomAssigneFormate: updatedTicket.assigneA?.materiel?.utilisateur
        ? `N° ${updatedTicket.assigneA.id_n} : ${updatedTicket.assigneA.materiel.utilisateur} (${updatedTicket.assigneA.materiel.equipe || 'N/A'})`
        : (updatedTicket.nomAssigne || null),
      equipeAssigne: updatedTicket.assigneA?.materiel?.equipe ?? null,
    };

    res.json(formattedTicket);
  } catch (error) {
    if (error.code === 'P2025') {
      res.status(404).json({ error: `Ticket avec ID ${id} non trouvé` });
    } else {
      console.error("Erreur Prisma:", error);
      res.status(500).json({ error: "Erreur interne du serveur lors de la mise à jour." });
    }
  }
});

// DELETE /api/tickets/:id
router.delete('/:id', authenticateToken, ensureActiveUser, requireTicketOwnership, async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.ticket.delete({
      where: { 
        idTicket: parseInt(id)
      },
    });
    res.status(204).send(); 
  } catch (error) {
    if (error.code === 'P2025') {
      res.status(404).json({ error: `Le ticket #${id} est introuvable.` });
    } else {
      res.status(500).json({ error: "Erreur lors de la suppression sur le serveur." });
    }
  }
});

export default router;