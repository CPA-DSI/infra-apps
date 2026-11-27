// services/interventionService.js
// Historique des interventions : création depuis une fermeture de ticket,
// clôture d'un ticket depuis une intervention (solution partagée),
// calcul des périodes Jour / Mois / Année et statistiques de la page.

export const INTERVENTION_TYPES = ['DEPANNAGE', 'INSTALLATION', 'PREVENTIF', 'DEMENAGEMENT', 'PRESTATAIRE', 'AUTRE'];
export const PERIODES = ['jour', 'mois', 'annee'];

// Sous-types par type (liste validée par la DSI, identique à SOUS_TYPE_CONFIG
// côté frontend). Les autres types n'ont pas de sous-type.
export const SOUS_TYPES = {
    DEPANNAGE: [
        'MATERIEL_POSTE', 'IMPRIMANTE_SCANNER', 'RESEAU_CONNEXION', 'SYSTEME',
        'BUREAUTIQUE', 'MESSAGERIE', 'COMPTE_ACCES', 'SERVEUR_PARTAGE',
    ],
    INSTALLATION: [
        'NOUVEAU_POSTE', 'LOGICIEL', 'MISE_A_JOUR', 'PERIPHERIQUE',
        'RESEAU', 'SERVEUR_INFRA', 'SECURITE', 'SALLE_REUNION',
    ],
};
// Clé des interventions de ces types sans sous-type (anciennes, clôtures de ticket)
export const SOUS_TYPE_NON_PRECISE = 'NON_PRECISE';

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

// Sous-type d'une intervention : facultatif (null), et seulement parmi ceux de
// son type ; ignoré (null) pour un type sans sous-types.
export const lireSousType = (type, valeur) => {
    const autorises = SOUS_TYPES[type];
    if (valeur === undefined || valeur === null || valeur === '') return null;
    if (!autorises) return null;
    if (!autorises.includes(valeur)) {
        throw new InterventionError(`Sous-type invalide pour ${type} (attendu : ${autorises.join(', ')}).`);
    }
    return valeur;
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

// Plage libre « du … au … » (page Historique des interventions) : dates
// 'AAAA-MM-JJ' incluses, bornes [debut, fin[ en heure locale du serveur.
export const PLAGE_MAX_JOURS = 3660;
const lireJour = (valeur, champ) => {
    const m = String(valeur || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) throw new InterventionError(`${champ} doit être au format AAAA-MM-JJ.`);
    const [annee, mois, jour] = [parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10)];
    const d = new Date(annee, mois, jour);
    if (d.getFullYear() !== annee || d.getMonth() !== mois || d.getDate() !== jour) {
        throw new InterventionError(`${champ} invalide.`);
    }
    return d;
};

// Nombre de jours calendaires de a à b (heures ignorées)
const joursEntre = (a, b) => Math.round(
    (new Date(b.getFullYear(), b.getMonth(), b.getDate()) - new Date(a.getFullYear(), a.getMonth(), a.getDate())) / 86400000,
);

export const bornesPlage = (debutTexte, finTexte) => {
    const debut = lireJour(debutTexte, 'debut');
    const dernierJour = lireJour(finTexte, 'fin');
    if (dernierJour < debut) throw new InterventionError('La date de fin doit suivre la date de début.');
    if (joursEntre(debut, dernierJour) >= PLAGE_MAX_JOURS) throw new InterventionError('Période trop longue (10 ans maximum).');
    return { debut, fin: new Date(dernierJour.getFullYear(), dernierJour.getMonth(), dernierJour.getDate() + 1) };
};

// Série du graphique : par heure (jour), par jour (mois) ou par mois (année).
// bloquees : interventions où l'utilisateur ne pouvait pas travailler.
const point = (index, date) => ({ index, ...(date && { date }), total: 0, duree: 0, bloquees: 0 });

const serieVide = (periode, debut) => {
    if (periode === 'annee') return Array.from({ length: 12 }, (_, i) => point(i));
    if (periode === 'mois') {
        const n = new Date(debut.getFullYear(), debut.getMonth() + 1, 0).getDate();
        return Array.from({ length: n }, (_, i) => point(i + 1));
    }
    return Array.from({ length: 24 }, (_, i) => point(i));
};

const indexSerie = (periode, date) => {
    if (periode === 'annee') return date.getMonth();
    if (periode === 'mois') return date.getDate() - 1;
    return date.getHours();
};

// Grille du graphique : ses points vides, l'index d'une date et le découpage
// (heure, jour ou mois) qu'elle représente.
const DECOUPAGE_PERIODE = { jour: 'heure', mois: 'jour', annee: 'mois' };
export const grillePeriode = (periode, debut) => ({
    decoupage: DECOUPAGE_PERIODE[periode],
    points: serieVide(periode, debut),
    index: d => indexSerie(periode, d),
});

const pad = n => String(n).padStart(2, '0');
const jourIso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// Plage libre : par heure sur un seul jour, par jour jusqu'à 92 jours
// (un trimestre), par mois au-delà. Chaque point porte la date où il commence.
export const grillePlage = (debut, fin) => {
    const nbJours = joursEntre(debut, fin);
    if (nbJours <= 1) return grillePeriode('jour', debut);
    if (nbJours <= 92) {
        return {
            decoupage: 'jour',
            points: Array.from({ length: nbJours }, (_, i) => point(i, jourIso(new Date(debut.getFullYear(), debut.getMonth(), debut.getDate() + i)))),
            index: d => joursEntre(debut, d),
        };
    }
    const dernier = new Date(fin.getTime() - 1);
    const nbMois = (dernier.getFullYear() - debut.getFullYear()) * 12 + dernier.getMonth() - debut.getMonth() + 1;
    return {
        decoupage: 'mois',
        points: Array.from({ length: nbMois }, (_, i) => point(i, jourIso(new Date(debut.getFullYear(), debut.getMonth() + i, 1)))),
        index: d => (d.getFullYear() - debut.getFullYear()) * 12 + d.getMonth() - debut.getMonth(),
    };
};

const ajouterAuPoint = (grille, it) => {
    const p = grille.points[grille.index(it.date_intervention)];
    if (!p) return;
    p.total += 1;
    p.duree += it.duree_minutes || 0;
    if (it.utilisateur_bloque) p.bloquees += 1;
};

// Série seule (courbe de la période précédente du tableau de bord).
export const serieInterventions = (interventions, periode, debut) => {
    const grille = grillePeriode(periode, debut);
    for (const it of interventions) ajouterAuPoint(grille, it);
    return grille.points;
};

// Interventions où l'utilisateur n'a pas pu travailler :
//  - interventions_bloquantes : nombre d'interventions cochées
//  - utilisateurs_bloques : personnes distinctes (id_n_beneficiaire) ; une intervention
//    bloquante sans bénéficiaire renseigné compte pour une personne à part
//  - temps_bloque : durée cumulée de ces interventions (minutes)
export const resumeBlocages = (interventions) => {
    const beneficiaires = new Set();
    let bloquantes = 0;
    let sansBeneficiaire = 0;
    let tempsBloque = 0;
    for (const it of interventions) {
        if (!it.utilisateur_bloque) continue;
        bloquantes += 1;
        tempsBloque += it.duree_minutes || 0;
        if (it.id_n_beneficiaire === null || it.id_n_beneficiaire === undefined) sansBeneficiaire += 1;
        else beneficiaires.add(it.id_n_beneficiaire);
    }
    return {
        interventions_bloquantes: bloquantes,
        utilisateurs_bloques: beneficiaires.size + sansBeneficiaire,
        temps_bloque: tempsBloque,
    };
};

// Travaux planifiés : ne signalent pas un matériel ou un utilisateur « à problème »
export const TYPES_PLANIFIES = ['INSTALLATION', 'PREVENTIF', 'DEMENAGEMENT'];
export const RECURRENCES_MAX = 5;

// Matériels / bénéficiaires revenant au moins deux fois (hors travaux planifiés),
// les plus fréquents d'abord.
const recurrences = (interventions, champ) => {
    const parCle = new Map();
    for (const it of interventions) {
        const id = it[champ];
        if (id === null || id === undefined || TYPES_PLANIFIES.includes(it.type)) continue;
        const r = parCle.get(id) || { id, total: 0, duree: 0, bloquees: 0 };
        r.total += 1;
        r.duree += it.duree_minutes || 0;
        if (it.utilisateur_bloque) r.bloquees += 1;
        parCle.set(id, r);
    }
    return [...parCle.values()]
        .filter(r => r.total >= 2)
        .sort((a, b) => b.total - a.total || b.duree - a.duree || a.id - b.id)
        .slice(0, RECURRENCES_MAX);
};

// Libellés des récurrences (code PC, nom de l'utilisateur), lus en une requête :
// le nom d'une personne vient de sa fiche matériel, comme nomTechnicien.
export const nommerRecurrences = async (tx, stats) => {
    const { materiels, utilisateurs } = stats.recurrences;
    if (!materiels.length && !utilisateurs.length) return stats;
    const fiches = await tx.materiels.findMany({
        where: {
            OR: [
                { id_materiels: { in: materiels.map(m => m.id) } },
                { id_n: { in: utilisateurs.map(u => u.id) } },
            ],
        },
        select: { id_materiels: true, id_n: true, code_pc: true, utilisateur: true },
    });
    const parMateriel = new Map(fiches.map(f => [f.id_materiels, f]));
    const parPersonne = new Map(fiches.filter(f => f.id_n !== null).map(f => [f.id_n, f]));
    stats.recurrences = {
        materiels: materiels.map(m => {
            const f = parMateriel.get(m.id);
            return { ...m, libelle: f?.code_pc || `Matériel n°${m.id}`, detail: f?.utilisateur || null };
        }),
        utilisateurs: utilisateurs.map(u => {
            const f = parPersonne.get(u.id);
            // Nom seul : l'identifiant interne n'apporte rien (homonymes distingués par le poste en détail)
            return { ...u, libelle: f?.utilisateur || `Utilisateur n°${u.id}`, detail: f?.code_pc || null };
        }),
    };
    return stats;
};

// grille : découpage du graphique (par défaut celui de la période jour / mois / année)
export const statistiques = (interventions, periode, debut, grille = grillePeriode(periode, debut)) => {
    const parType = Object.fromEntries(INTERVENTION_TYPES.map(t => [t, 0]));
    // Types à sous-types : nombre par sous-type, NON_PRECISE pour ceux sans sous-type
    const parSousType = Object.fromEntries(Object.entries(SOUS_TYPES)
        .map(([t, liste]) => [t, Object.fromEntries([...liste, SOUS_TYPE_NON_PRECISE].map(s => [s, 0]))]));
    // Moyenne calculée sur les seules interventions dont la durée est renseignée
    const dureesType = Object.fromEntries(INTERVENTION_TYPES.map(t => [t, { duree: 0, n: 0 }]));
    // Lundi = 0 … dimanche = 6, puis heure 0-23
    const parJourHeure = Array.from({ length: 7 }, () => Array(24).fill(0));
    const parTechnicien = new Map();
    const materiels = new Set();
    let dureeTotale = 0;
    let avecDuree = 0;

    for (const it of interventions) {
        const duree = it.duree_minutes || 0;
        ajouterAuPoint(grille, it);
        const d = it.date_intervention;
        parJourHeure[(d.getDay() + 6) % 7][d.getHours()] += 1;
        if (it.duree_minutes !== null && it.duree_minutes !== undefined) {
            avecDuree += 1;
            dureesType[it.type].duree += it.duree_minutes;
            dureesType[it.type].n += 1;
        }
        parType[it.type] += 1;
        if (parSousType[it.type]) {
            const cleSousType = it.sous_type in parSousType[it.type] ? it.sous_type : SOUS_TYPE_NON_PRECISE;
            parSousType[it.type][cleSousType] += 1;
        }
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
        // Interventions dont la durée est renseignée : base de la durée moyenne
        avec_duree: avecDuree,
        materiels_concernes: materiels.size,
        depuis_tickets: interventions.filter(it => it.source === 'TICKET').length,
        ...resumeBlocages(interventions),
        par_type: parType,
        par_sous_type: parSousType,
        duree_moyenne_par_type: Object.fromEntries(Object.entries(dureesType)
            .map(([t, { duree, n }]) => [t, n ? Math.round(duree / n) : null])),
        par_jour_heure: parJourHeure,
        par_technicien: [...parTechnicien.values()].sort((a, b) => b.duree - a.duree || b.total - a.total),
        recurrences: {
            materiels: recurrences(interventions, 'id_materiels'),
            utilisateurs: recurrences(interventions, 'id_n_beneficiaire'),
        },
        serie: grille.points,
    };
};
