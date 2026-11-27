// routes/interventionRoutes.js
// Historique des interventions (réservé IT_ADMIN / DIRECTION).
//   GET    /api/interventions?periode=jour|mois|annee&date=AAAA-MM-JJ[&types=&technicien=&source=&bloque=1&materiel=&beneficiaire=]
//   GET    /api/interventions/stats?periode=&date= : statistiques seules (tableau de
//          bord d'accueil) + totaux de la période précédente (« à date » si en cours)
//          et sa série complète (courbe cumulée comparée)
//   POST   /api/interventions        : le technicien est l'utilisateur connecté
//   PUT    /api/interventions/:id    : uniquement ses propres interventions
//   DELETE /api/interventions/:id    : idem, suppression logique (refusée pour
//                                      l'intervention qui a clôturé un ticket)
// Solution partagée avec le ticket : cloturer_ticket = true (POST / PUT) clôture
// le ticket lié (fiche de fermeture + statut RESOLU) avec la solution, la durée et
// la date de l'intervention ; ensuite, toute modification de ces champs est
// recopiée dans la fiche de fermeture.
import express from 'express';
import prisma from '../prismaClient.js';
import { authenticateToken, ensureActiveUser, requirePermission } from '../middleware/authMiddleware.js';
import { validateIdParam } from '../middleware/validateIdParam.js';
import { PERMISSIONS, hasPermission } from '../constants/roles.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
    INTERVENTION_TYPES, InterventionError, bornesPeriode, statistiques, nomTechnicien, lireBooleen,
    fermerTicketDepuisIntervention, synchroniserFermeture, periodePrecedente, serieInterventions,
    resumeBlocages, nommerRecurrences,
} from '../services/interventionService.js';

const router = express.Router();
router.param('id', validateIdParam);
router.use(authenticateToken, ensureActiveUser);

const DUREE_MAX_MINUTES = 7 * 24 * 60;
const DESCRIPTION_MAX = 5000;

const INCLUDE = {
    ticket: { select: { idTicket: true, numeroTicket: true, titre: true, statut: true } },
    materiel: { select: { id_materiels: true, code_pc: true, utilisateur: true, id_n: true, equipe: true } },
    local: { select: { id_local: true, nom_local: true } },
};

const formatIntervention = (it, idN) => ({
    ...it,
    modifiable: it.id_technicien !== null && it.id_technicien === idN,
});

const envoyerErreur = (res, err) => {
    if (err instanceof InterventionError) return res.status(err.status).json({ error: err.message });
    // Fiche de fermeture ou intervention de clôture déjà existante (accès concurrent)
    if (err.code === 'P2002') return res.status(409).json({ error: 'Ce ticket est déjà clôturé.' });
    throw err;
};

const entierOptionnel = (valeur, champ) => {
    if (valeur === undefined || valeur === null || valeur === '') return null;
    const n = Number(valeur);
    if (!Number.isInteger(n) || n < 0) throw new InterventionError(`${champ} doit être un entier positif.`);
    return n;
};

// Valide le corps d'une création / modification et vérifie les références.
const lireCorps = async (body) => {
    const date = new Date(body.date_intervention);
    if (!body.date_intervention || Number.isNaN(date.getTime())) {
        throw new InterventionError('La date de l\'intervention est obligatoire.');
    }
    if (!INTERVENTION_TYPES.includes(body.type)) {
        throw new InterventionError(`Type invalide (attendu : ${INTERVENTION_TYPES.join(', ')}).`);
    }
    const description = typeof body.description === 'string' ? body.description.trim() : '';
    if (!description) throw new InterventionError('La description est obligatoire.');
    if (description.length > DESCRIPTION_MAX) {
        throw new InterventionError(`La description ne doit pas dépasser ${DESCRIPTION_MAX} caractères.`);
    }
    const solution = typeof body.solution === 'string' ? body.solution.trim() : '';
    if (solution.length > DESCRIPTION_MAX) {
        throw new InterventionError(`La solution ne doit pas dépasser ${DESCRIPTION_MAX} caractères.`);
    }
    const duree = entierOptionnel(body.duree_minutes, 'duree_minutes');
    if (duree !== null && duree > DUREE_MAX_MINUTES) throw new InterventionError('Durée trop longue (7 jours maximum).');

    const data = {
        date_intervention: date,
        type: body.type,
        description,
        solution: solution || null,
        duree_minutes: duree,
        utilisateur_bloque: lireBooleen(body.utilisateur_bloque, 'utilisateur_bloque'),
        id_materiels: entierOptionnel(body.id_materiels, 'id_materiels'),
        id_ticket: entierOptionnel(body.id_ticket, 'id_ticket'),
        id_local: entierOptionnel(body.id_local, 'id_local'),
        id_n_beneficiaire: entierOptionnel(body.id_n_beneficiaire, 'id_n_beneficiaire'),
    };

    if (data.id_materiels !== null) {
        const materiel = await prisma.materiels.findFirst({
            where: { id_materiels: data.id_materiels, date_suppression: null },
            select: { id_n: true, id_local: true },
        });
        if (!materiel) throw new InterventionError('Matériel introuvable.');
        // Bénéficiaire et local du poste par défaut
        if (data.id_n_beneficiaire === null && materiel.id_n !== null && body.id_n_beneficiaire === undefined) {
            data.id_n_beneficiaire = materiel.id_n;
        }
        if (data.id_local === null && body.id_local === undefined) data.id_local = materiel.id_local;
    }
    if (data.id_ticket !== null && !(await prisma.ticket.findUnique({ where: { idTicket: data.id_ticket }, select: { idTicket: true } }))) {
        throw new InterventionError('Ticket introuvable.');
    }
    if (data.id_local !== null && !(await prisma.locaux.findUnique({ where: { id_local: data.id_local }, select: { id_local: true } }))) {
        throw new InterventionError('Local introuvable.');
    }
    if (data.id_n_beneficiaire !== null && !(await prisma.users.findUnique({ where: { id_n: data.id_n_beneficiaire }, select: { id_n: true } }))) {
        throw new InterventionError('Bénéficiaire introuvable.');
    }
    return data;
};

// Intervention non supprimée, modifiable par l'utilisateur connecté uniquement.
const chargerIntervention = async (id, user) => {
    const it = await prisma.intervention.findFirst({ where: { id_intervention: id, date_suppression: null } });
    if (!it) throw new InterventionError('Intervention introuvable.', 404);
    if (!user?.id_n || it.id_technicien !== user.id_n) {
        throw new InterventionError('Vous ne pouvez modifier que vos propres interventions.', 403);
    }
    return it;
};

router.get('/', requirePermission(PERMISSIONS.INTERVENTIONS_READ), asyncHandler(async (req, res) => {
    try {
        const periode = req.query.periode || 'mois';
        const { debut, fin } = bornesPeriode(periode, req.query.date);

        const where = { date_suppression: null, date_intervention: { gte: debut, lt: fin } };
        if (req.query.types) {
            const types = String(req.query.types).split(',').filter(t => INTERVENTION_TYPES.includes(t));
            where.type = { in: types };
        }
        if (req.query.technicien) {
            where.id_technicien = req.query.technicien === 'moi' ? req.user.id_n : entierOptionnel(req.query.technicien, 'technicien');
        }
        if (req.query.source === 'TICKET' || req.query.source === 'MANUELLE') where.source = req.query.source;
        if (req.query.bloque === '1') where.utilisateur_bloque = true;
        // Liens « Récurrences » du tableau de bord
        if (req.query.materiel) where.id_materiels = entierOptionnel(req.query.materiel, 'materiel');
        if (req.query.beneficiaire) where.id_n_beneficiaire = entierOptionnel(req.query.beneficiaire, 'beneficiaire');

        const interventions = await prisma.intervention.findMany({
            where,
            include: INCLUDE,
            orderBy: { date_intervention: 'desc' },
        });

        res.json({
            periode,
            debut,
            fin,
            stats: await nommerRecurrences(prisma, statistiques(interventions, periode, debut)),
            interventions: interventions.map(it => formatIntervention(it, req.user.id_n)),
        });
    } catch (err) {
        envoyerErreur(res, err);
    }
}));

// Colonnes utiles au calcul des statistiques (pas de description ni de relations)
const SELECT_STATS = {
    date_intervention: true, duree_minutes: true, type: true, source: true,
    utilisateur_bloque: true, id_technicien: true, nom_technicien: true, id_materiels: true,
    id_n_beneficiaire: true,
};

router.get('/stats', requirePermission(PERMISSIONS.INTERVENTIONS_READ), asyncHandler(async (req, res) => {
    try {
        const periode = req.query.periode || 'mois';
        const bornes = bornesPeriode(periode, req.query.date);
        const prec = periodePrecedente(periode, bornes);

        // Période précédente lue en entier (courbe cumulée complète) ;
        // les totaux, eux, s'arrêtent à prec.fin (« à date » si la période est en cours).
        const [courantes, precedentesEntieres] = await Promise.all([
            prisma.intervention.findMany({
                where: { date_suppression: null, date_intervention: { gte: bornes.debut, lt: bornes.fin } },
                select: SELECT_STATS,
            }),
            prisma.intervention.findMany({
                where: { date_suppression: null, date_intervention: { gte: prec.debut, lt: bornes.debut } },
                select: { date_intervention: true, duree_minutes: true, utilisateur_bloque: true, id_n_beneficiaire: true },
            }),
        ]);
        const precedentes = precedentesEntieres.filter(it => it.date_intervention < prec.fin);

        res.json({
            periode,
            debut: bornes.debut,
            fin: bornes.fin,
            stats: await nommerRecurrences(prisma, statistiques(courantes, periode, bornes.debut)),
            precedent: {
                debut: prec.debut,
                fin: prec.fin,
                a_date: prec.aDate,
                a_venir: prec.aVenir,
                total: precedentes.length,
                duree_totale: precedentes.reduce((s, it) => s + (it.duree_minutes || 0), 0),
                ...resumeBlocages(precedentes),
                serie: serieInterventions(precedentesEntieres, periode, prec.debut),
            },
        });
    } catch (err) {
        envoyerErreur(res, err);
    }
}));

// Création (existante = null) ou modification, avec clôture éventuelle du
// ticket lié et recopie dans sa fiche de fermeture, dans une même transaction.
const enregistrer = async (req, existante = null) => {
    const body = req.body || {};
    const data = await lireCorps(body);
    const cloturer = lireBooleen(body.cloturer_ticket, 'cloturer_ticket');
    const dejaCloture = Boolean(existante?.cloture_ticket && existante.id_ticket !== null);

    if (dejaCloture) {
        if (data.id_ticket !== existante.id_ticket) {
            throw new InterventionError('Cette intervention a clôturé son ticket : le ticket lié ne peut pas être changé.');
        }
        if (!data.solution) {
            throw new InterventionError('La solution est obligatoire : elle est partagée avec le ticket clôturé.');
        }
    }
    const nouvelleCloture = cloturer && !dejaCloture;
    if (nouvelleCloture) {
        if (!hasPermission(req.user?.role, PERMISSIONS.TICKETS_CLOSE)) {
            throw new InterventionError("Vous n'avez pas le droit de clôturer un ticket.", 403);
        }
        if (data.id_ticket === null) throw new InterventionError('Choisissez le ticket à clôturer.');
        if (!data.solution) throw new InterventionError('La solution est obligatoire pour clôturer le ticket.');
        data.cloture_ticket = true;
    }

    return prisma.$transaction(async (tx) => {
        if (nouvelleCloture) {
            await fermerTicketDepuisIntervention(tx, {
                idTicket: data.id_ticket,
                solution: data.solution,
                date: data.date_intervention,
                dureeMinutes: data.duree_minutes,
                fermePar: req.user.id_n,
            });
        }
        const it = existante
            ? await tx.intervention.update({ where: { id_intervention: existante.id_intervention }, data, include: INCLUDE })
            : await tx.intervention.create({
                data: {
                    ...data,
                    source: 'MANUELLE',
                    id_technicien: req.user.id_n,
                    nom_technicien: await nomTechnicien(tx, req.user.id_n),
                },
                include: INCLUDE,
            });
        if (dejaCloture) await synchroniserFermeture(tx, it);
        return it;
    });
};

router.post('/', requirePermission(PERMISSIONS.INTERVENTIONS_WRITE), asyncHandler(async (req, res) => {
    try {
        if (!req.user?.id_n) throw new InterventionError('Utilisateur non identifié.', 403);
        const creee = await enregistrer(req);
        res.status(201).json(formatIntervention(creee, req.user.id_n));
    } catch (err) {
        envoyerErreur(res, err);
    }
}));

router.put('/:id', requirePermission(PERMISSIONS.INTERVENTIONS_WRITE), asyncHandler(async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const existante = await chargerIntervention(id, req.user);
        const modifiee = await enregistrer(req, existante);
        res.json(formatIntervention(modifiee, req.user.id_n));
    } catch (err) {
        envoyerErreur(res, err);
    }
}));

router.delete('/:id', requirePermission(PERMISSIONS.INTERVENTIONS_WRITE), asyncHandler(async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const it = await chargerIntervention(id, req.user);
        if (it.cloture_ticket && it.id_ticket !== null) {
            throw new InterventionError('Cette intervention a clôturé son ticket : rouvrez le ticket avant de la supprimer.', 409);
        }
        await prisma.intervention.update({ where: { id_intervention: id }, data: { date_suppression: new Date() } });
        res.status(204).send();
    } catch (err) {
        envoyerErreur(res, err);
    }
}));

export default router;
