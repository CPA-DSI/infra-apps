// services/interventionService.js
// Historique des interventions : création depuis une fermeture de ticket,
// calcul des périodes Jour / Mois / Année et statistiques de la page.

export const INTERVENTION_TYPES = ['DEPANNAGE', 'INSTALLATION', 'PREVENTIF', 'DEMENAGEMENT', 'PRESTATAIRE', 'AUTRE'];
export const PERIODES = ['jour', 'mois', 'annee'];

export class InterventionError extends Error {
    constructor(message, status = 400) {
        super(message);
        this.status = status;
    }
}

// Libellé « 1234 - Nom » du technicien, au même format que nom_affecte_par
// (affectationService) : le nom vient de sa fiche matériel.
export const nomTechnicien = async (tx, idN) => {
    if (!idN) return 'Système';
    const fiche = await tx.materiels.findUnique({ where: { id_n: idN }, select: { utilisateur: true } });
    return fiche?.utilisateur ? `${idN} - ${fiche.utilisateur}` : `N°${idN}`;
};

// Intervention créée à la fermeture d'un ticket (même format que la reprise
// faite par la migration add_interventions).
export const creerInterventionDepuisFermeture = async (tx, { ticket, fermeture }) => {
    const materiel = await tx.materiels.findUnique({
        where: { id_materiels: ticket.idMateriels },
        select: { id_local: true },
    });
    return tx.intervention.create({
        data: {
            date_intervention: fermeture.dateFermeture,
            duree_minutes: fermeture.dureeResolution,
            type: 'DEPANNAGE',
            description: `${ticket.titre}\nSolution : ${fermeture.solution}`,
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

    for (const it of interventions) {
        const duree = it.duree_minutes || 0;
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
        par_type: parType,
        par_technicien: [...parTechnicien.values()].sort((a, b) => b.duree - a.duree || b.total - a.total),
        serie,
    };
};
