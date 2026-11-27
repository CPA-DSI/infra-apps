// services/interventionService.js
// Historique des interventions : création depuis une fermeture de ticket,
// clôture d'un ticket depuis une intervention (solution partagée),
// calcul des périodes Jour / Mois / Année et statistiques de la page.

export const INTERVENTION_TYPES = ['DEPANNAGE', 'INSTALLATION', 'PREVENTIF', 'DEMENAGEMENT', 'PRESTATAIRE', 'AUTRE'];
export const PERIODES = ['jour', 'mois', 'annee'];

export class InterventionError extends Error {
    constructor(message, status = 400) {
        super(message);
        this.status = status;
    }
}

// Case à cocher : absente = false ; seul un vrai booléen JSON est accepté.
export const lireBooleen = (valeur, champ) => {
    if (valeur === undefined || valeur === null) return false;
    if (typeof valeur !== 'boolean') throw new InterventionError(`${champ} doit valoir true ou false.`);
    return valeur;
};

// Libellé « 1234 - Nom » du technicien, au même format que nom_affecte_par
// (affectationService) : le nom vient de sa fiche matériel.
export const nomTechnicien = async (tx, idN) => {
    if (!idN) return 'Système';
    const fiche = await tx.materiels.findUnique({ where: { id_n: idN }, select: { utilisateur: true } });
    return fiche?.utilisateur ? `${idN} - ${fiche.utilisateur}` : `N°${idN}`;
};

// Statuts d'un ticket clôturé (la clôture passe le ticket en RESOLU).
export const STATUTS_FERMES = ['RESOLU', 'FERME'];

// Intervention de clôture créée à la fermeture d'un ticket depuis la page
// Tickets (PUT /api/tickets/:id/close).
export const creerInterventionDepuisFermeture = async (tx, { ticket, fermeture, utilisateurBloque = false }) => {
    const materiel = await tx.materiels.findUnique({
        where: { id_materiels: ticket.idMateriels },
        select: { id_local: true },
    });
    return tx.intervention.create({
        data: {
            date_intervention: fermeture.dateFermeture,
            duree_minutes: fermeture.dureeResolution,
            type: 'DEPANNAGE',
            description: ticket.titre,
            solution: fermeture.solution,
            cloture_ticket: true,
            utilisateur_bloque: utilisateurBloque,
            source: 'TICKET',
            id_technicien: fermeture.fermePar,
            nom_technicien: await nomTechnicien(tx, fermeture.fermePar),
            id_materiels: ticket.idMateriels,
            id_n_beneficiaire: ticket.idDemandeur,
            id_ticket: ticket.idTicket,
            id_local: materiel?.id_local ?? null,
        },
    });
};

// Clôture du ticket lié depuis une intervention (case « Clôturer le ticket ») :
// même résultat qu'une fermeture depuis la page Tickets (fiche de fermeture,
// statut RESOLU, commentaire), sans créer de seconde intervention.
// L'appelant enregistre l'intervention avec cloture_ticket = true.
export const fermerTicketDepuisIntervention = async (tx, { idTicket, solution, date, dureeMinutes, fermePar }) => {
    const ticket = await tx.ticket.findUnique({ where: { idTicket }, include: { fermeture: true } });
    if (!ticket) throw new InterventionError('Ticket introuvable.');
    if (STATUTS_FERMES.includes(ticket.statut) || ticket.fermeture) {
        throw new InterventionError('Ce ticket est déjà clôturé.', 409);
    }
    await tx.ticketFermeture.create({
        data: { ticketId: idTicket, solution, dateFermeture: date, dureeResolution: dureeMinutes, fermePar },
    });
    await tx.ticket.update({ where: { idTicket }, data: { statut: 'RESOLU' } });
    await tx.historiqueCommentaire.create({
        data: { contenu: `🔒 Ticket fermé\nSolution : ${solution}`, idTicket, idAuteur: fermePar },
    });
};

// Recopie solution, durée et date d'une intervention de clôture dans la fiche
// de fermeture de son ticket (sans effet si la fiche n'existe plus).
export const synchroniserFermeture = (tx, intervention) => {
    if (!intervention.cloture_ticket || !intervention.id_ticket) return null;
    return tx.ticketFermeture.updateMany({
        where: { ticketId: intervention.id_ticket },
        data: {
            solution: intervention.solution,
            dureeResolution: intervention.duree_minutes,
            dateFermeture: intervention.date_intervention,
        },
    });
};

// Bornes [debut, fin[ d'une période, en heure locale du serveur (fuseau de
// l'entreprise, cf. services/dateOnly.js). date : 'AAAA-MM-JJ', 'AAAA-MM' ou 'AAAA'.
export const bornesPeriode = (periode, date) => {
    if (!PERIODES.includes(periode)) {
        throw new InterventionError('periode doit valoir jour, mois ou annee.');
    }
    const m = String(date || '').trim().match(/^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/);
    if (!m) throw new InterventionError('date doit être au format AAAA, AAAA-MM ou AAAA-MM-JJ.');
    const annee = parseInt(m[1], 10);
    const mois = m[2] ? parseInt(m[2], 10) - 1 : 0;
    const jour = m[3] ? parseInt(m[3], 10) : 1;
    const ref = new Date(annee, mois, jour);
    if (ref.getFullYear() !== annee || ref.getMonth() !== mois || ref.getDate() !== jour) {
        throw new InterventionError('date invalide.');
    }

    if (periode === 'annee') return { debut: new Date(annee, 0, 1), fin: new Date(annee + 1, 0, 1) };
    if (periode === 'mois') return { debut: new Date(annee, mois, 1), fin: new Date(annee, mois + 1, 1) };
    return { debut: new Date(annee, mois, jour), fin: new Date(annee, mois, jour + 1) };
};

// Même instant, une période plus tôt (veille, mois ou année précédente).
// Le jour est ramené au dernier jour du mois si besoin (31 mars -> 28/29 février).
const unePeriodePlusTot = (periode, date) => {
    const d = new Date(date);
    if (periode === 'jour') {
        d.setDate(d.getDate() - 1);
        return d;
    }
    const jour = d.getDate();
    d.setDate(1);
    if (periode === 'mois') d.setMonth(d.getMonth() - 1);
    else d.setFullYear(d.getFullYear() - 1);
    d.setDate(Math.min(jour, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
    return d;
};

// Période de comparaison (tableau de bord) : la période précédente entière, ou,
// si la période affichée est en cours, son début jusqu'au même instant (« à date ») :
// le 27 novembre à 10 h se compare au 1er–27 octobre 10 h, pas au mois d'octobre complet.
// aVenir : période affichée pas encore commencée (aucune comparaison pertinente).
export const periodePrecedente = (periode, { debut, fin }, maintenant = new Date()) => {
    const debutPrecedent = unePeriodePlusTot(periode, debut);
    const enCours = maintenant >= debut && maintenant < fin;
    return {
        debut: debutPrecedent,
        fin: enCours ? unePeriodePlusTot(periode, maintenant) : debut,
        aDate: enCours,
        aVenir: maintenant < debut,
    };
};

// Série du graphique : par heure (jour), par jour (mois) ou par mois (année).
const serieVide = (periode, debut) => {
    if (periode === 'annee') return Array.from({ length: 12 }, (_, i) => ({ index: i, total: 0, duree: 0 }));
    if (periode === 'mois') {
        const n = new Date(debut.getFullYear(), debut.getMonth() + 1, 0).getDate();
        return Array.from({ length: n }, (_, i) => ({ index: i + 1, total: 0, duree: 0 }));
    }
    return Array.from({ length: 24 }, (_, i) => ({ index: i, total: 0, duree: 0 }));
};

const indexSerie = (periode, date) => {
    if (periode === 'annee') return date.getMonth();
    if (periode === 'mois') return date.getDate() - 1;
    return date.getHours();
};

export const statistiques = (interventions, periode, debut) => {
    const serie = serieVide(periode, debut);
    const parType = Object.fromEntries(INTERVENTION_TYPES.map(t => [t, 0]));
    const parTechnicien = new Map();
    const materiels = new Set();
    let dureeTotale = 0;
    let bloquantes = 0;

    for (const it of interventions) {
        const duree = it.duree_minutes || 0;
        if (it.utilisateur_bloque) bloquantes += 1;
        const point = serie[indexSerie(periode, it.date_intervention)];
        if (point) { point.total += 1; point.duree += duree; }
        parType[it.type] += 1;
        dureeTotale += duree;
        if (it.id_materiels) materiels.add(it.id_materiels);
        const cle = it.id_technicien ?? 'aucun';
        const tech = parTechnicien.get(cle) || { id_technicien: it.id_technicien, nom: it.nom_technicien || 'Non renseigné', total: 0, duree: 0 };
        tech.total += 1;
        tech.duree += duree;
        parTechnicien.set(cle, tech);
    }

    return {
        total: interventions.length,
        duree_totale: dureeTotale,
        materiels_concernes: materiels.size,
        depuis_tickets: interventions.filter(it => it.source === 'TICKET').length,
        utilisateurs_bloques: bloquantes,
        par_type: parType,
        par_technicien: [...parTechnicien.values()].sort((a, b) => b.duree - a.duree || b.total - a.total),
        serie,
    };
};
