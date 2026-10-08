// services/affectationService.js
//
// Règles d'affectation des PC et des écrans. Toutes les fonctions exportées
// prennent un client de transaction Prisma (tx) : l'appelant les enveloppe dans
// prisma.$transaction pour que fermeture de l'ancienne affectation, mise à jour
// du matériel et ouverture de la nouvelle soient atomiques.
//
// Invariants (garantis aussi en base, cf. migration add_affectations_ecrans) :
// - une seule affectation en cours (date_fin null) par PC et par écran ;
// - un poste porte au plus un écran (ecrans.id_materiels unique) ;
// - materiels.ecran / code_ecran / date_ecran sont une copie de l'écran actuel.

export const STATUTS_ECRAN = ['EN_STOCK', 'AFFECTE', 'EN_REPARATION', 'REFORME'];
const STATUTS_HORS_POSTE = ['EN_STOCK', 'EN_REPARATION', 'REFORME'];

const LIBELLES_STATUT = {
    EN_STOCK: 'Stock',
    EN_REPARATION: 'En réparation',
    REFORME: 'Réformé',
};

export const LIBELLE_STOCK = 'Stock';

// Valeurs de materiels.etat_pc posées par la mise en stock.
export const ETAT_STOCK = 'Stock';
export const ETAT_SANS_POSTE = 'Sans poste';
// État repris par un PC qui sort du stock (même valeur que le bouton Status).
export const ETAT_REMIS_EN_SERVICE = 'Bon';

export class AffectationError extends Error {
    constructor(message, status = 400, details = undefined) {
        super(message);
        this.status = status;
        this.details = details;
    }
}

const decrireBeneficiaire = (id_n, nom) => (id_n ? `${id_n} - ${nom}` : LIBELLE_STOCK);

const resoudreAuteur = async (tx, auteurIdN) => {
    if (!auteurIdN) return { affecte_par: null, nom_affecte_par: 'Système' };
    const fiche = await tx.materiels.findUnique({ where: { id_n: auteurIdN }, select: { utilisateur: true } });
    return {
        affecte_par: auteurIdN,
        nom_affecte_par: fiche?.utilisateur ? `${auteurIdN} - ${fiche.utilisateur}` : `N°${auteurIdN}`,
    };
};

const fermerAffectationEnCours = (tx, where, dateFin) =>
    tx.affectationMateriel.updateMany({
        where: { ...where, date_fin: null },
        data: { date_fin: dateFin },
    });

// Trace aussi l'opération dans historique_materiels pour qu'elle apparaisse
// dans l'onglet Historique existant.
const tracer = (tx, id_materiels, ancienne_valeur, nouvelle_valeur, auteur) =>
    tx.historiqueMateriel.create({
        data: { id_materiels, ancienne_valeur, nouvelle_valeur, nom_utilisateur: auteur.nom_affecte_par },
    });

const avecMotif = (texte, motif) => (motif ? `${texte} — Motif : ${motif}` : texte);

const syncColonnesEcran = async (tx, id_materiels) => {
    const ecran = await tx.ecran.findUnique({ where: { id_materiels } });
    await tx.materiels.update({
        where: { id_materiels },
        data: {
            ecran: ecran?.modele ?? null,
            code_ecran: ecran?.code_ecran ?? null,
            date_ecran: ecran?.date_ecran ?? null,
        },
    });
};

// Ferme l'affectation en cours de l'écran et en ouvre une nouvelle vers
// cibleId (ou hors poste si cibleId est null). Ne gère ni les conflits ni la
// copie dans materiels : c'est le rôle de affecterEcran.
const deplacerEcran = async (tx, ecran, cibleId, statut, ctx) => {
    await fermerAffectationEnCours(tx, { type_affectation: 'ECRAN', id_ecran: ecran.id_ecran }, ctx.now);

    const poste = cibleId
        ? await tx.materiels.findUnique({ where: { id_materiels: cibleId }, select: { id_n: true, utilisateur: true } })
        : null;

    await tx.ecran.update({
        where: { id_ecran: ecran.id_ecran },
        data: { id_materiels: cibleId, statut: cibleId ? 'AFFECTE' : statut },
    });

    await tx.affectationMateriel.create({
        data: {
            type_affectation: 'ECRAN',
            id_ecran: ecran.id_ecran,
            id_materiels: cibleId,
            id_n: poste?.id_n ?? null,
            nom_utilisateur: poste ? poste.utilisateur : LIBELLES_STATUT[statut],
            date_debut: ctx.now,
            motif: ctx.motif || null,
            etat_remise: ctx.etat_remise || null,
            commentaire: ctx.commentaire || null,
            ...ctx.auteur,
        },
    });
};

// mouvements.id_materiels référence materiels.id_n avec ON UPDATE CASCADE :
// retirer le matricule d'une fiche met ses mouvements à null. On les relève
// avant pour les rattacher ensuite à la fiche qui reprend le matricule.
const releverMouvements = async (tx, id_n) => {
    if (!id_n) return [];
    const mouvements = await tx.mouvement.findMany({ where: { id_materiels: id_n }, select: { id_mouvement: true } });
    return mouvements.map(m => m.id_mouvement);
};

const rattacherMouvements = async (tx, ids, id_n) => {
    if (ids.length === 0) return;
    await tx.mouvement.updateMany({ where: { id_mouvement: { in: ids } }, data: { id_materiels: id_n } });
};

// Retire le poste vide d'un utilisateur qui reçoit un PC et libère son
// matricule. Renvoie l'écran qu'il portait, que l'appelant doit replacer.
const supprimerPosteVide = async (tx, posteVide, now, auteur) => {
    await fermerAffectationEnCours(tx, { type_affectation: 'PC', id_materiels: posteVide.id_materiels }, now);
    await tx.materiels.update({
        where: { id_materiels: posteVide.id_materiels },
        data: { est_actif: false, date_suppression: now, id_n: null, ecran: null, code_ecran: null, date_ecran: null },
    });
    await tracer(tx, posteVide.id_materiels, 'Poste vide', 'Remplacé par un PC réaffecté', auteur);
    return posteVide.ecran_actuel;
};

/**
 * Réaffecte un PC (la fiche poste) à un autre bénéficiaire, ou le met en stock
 * si id_n est null. L'écran rattaché au poste suit le PC, sauf en cas de mise
 * en stock : l'écran part alors en stock et l'utilisateur garde une fiche vide
 * (est_vide), remplacée dès qu'un PC lui est réaffecté.
 */
export const affecterPC = async (tx, { id_materiels, id_n, utilisateur, equipe, id_local, motif, etat_remise, commentaire }, auteurIdN) => {
    const materiel = await tx.materiels.findUnique({
        where: { id_materiels },
        include: { ecran_actuel: true },
    });
    if (!materiel || materiel.date_suppression) {
        throw new AffectationError('Matériel introuvable.', 404);
    }
    if (materiel.est_vide) {
        throw new AffectationError('Ce poste est vide : il n\'y a pas de PC à réaffecter.');
    }

    const cibleIdN = id_n ?? null;
    if (cibleIdN === materiel.id_n) {
        throw new AffectationError(cibleIdN ? 'Ce PC est déjà affecté à cet utilisateur.' : 'Ce PC est déjà en stock.');
    }

    let posteVide = null;
    if (cibleIdN !== null) {
        const user = await tx.users.findUnique({
            where: { id_n: cibleIdN },
            select: { id_n: true, materiel: { include: { ecran_actuel: true } } },
        });
        if (!user) {
            throw new AffectationError(`Aucun utilisateur avec le matricule ${cibleIdN}.`, 404);
        }
        if (user.materiel?.est_vide) {
            posteVide = user.materiel;
        } else if (user.materiel) {
            throw new AffectationError(
                `L'utilisateur ${cibleIdN} a déjà le poste ${user.materiel.code_pc || `#${user.materiel.id_materiels}`}. Mettez-le d'abord en stock ou réaffectez-le.`,
                409,
                { id_materiels: user.materiel.id_materiels }
            );
        }
    }

    const nom = cibleIdN === null ? LIBELLE_STOCK : utilisateur?.trim();
    if (!nom) {
        throw new AffectationError('Le nom du bénéficiaire est requis.');
    }
    const equipeFinale = cibleIdN === null ? LIBELLE_STOCK : (equipe?.trim() || materiel.equipe);

    const now = new Date();
    const auteur = await resoudreAuteur(tx, auteurIdN);
    const miseEnStock = cibleIdN === null;

    // Mouvements de l'utilisateur qui garde une fiche : celui qui perd son PC
    // (mise en stock) ou celui dont le poste vide va être remplacé.
    const idNConserve = miseEnStock ? materiel.id_n : (posteVide ? cibleIdN : null);
    const mouvementsConserves = await releverMouvements(tx, idNConserve);

    // Le matricule est unique : le poste vide doit le libérer avant le PC.
    const ecranPosteVide = posteVide ? await supprimerPosteVide(tx, posteVide, now, auteur) : null;

    await fermerAffectationEnCours(tx, { type_affectation: 'PC', id_materiels }, now);

    // Un PC en stock est inactif, état « Stock » ; il redevient actif quand il
    // est réaffecté.
    const statutPC = miseEnStock
        ? { est_actif: false, etat_pc: ETAT_STOCK }
        : materiel.id_n === null
            ? { est_actif: true, ...(materiel.etat_pc === ETAT_STOCK ? { etat_pc: ETAT_REMIS_EN_SERVICE } : {}) }
            : {};

    const misAJour = await tx.materiels.update({
        where: { id_materiels },
        data: {
            id_n: cibleIdN,
            utilisateur: nom,
            equipe: equipeFinale,
            ...(id_local !== undefined ? { id_local } : {}),
            ...statutPC,
            date_modification: now,
        },
    });

    await tx.affectationMateriel.create({
        data: {
            type_affectation: 'PC',
            id_materiels,
            id_n: cibleIdN,
            nom_utilisateur: nom,
            date_debut: now,
            motif: motif || null,
            etat_remise: etat_remise || null,
            commentaire: commentaire || null,
            ...auteur,
        },
    });

    if (materiel.ecran_actuel) {
        if (miseEnStock) {
            await deplacerEcran(tx, materiel.ecran_actuel, null, 'EN_STOCK', { now, auteur, motif: 'PC mis en stock' });
            await syncColonnesEcran(tx, id_materiels);
        } else {
            await deplacerEcran(tx, materiel.ecran_actuel, id_materiels, 'AFFECTE', {
                now, auteur, motif: 'Suit le PC',
            });
        }
    }

    // L'écran du poste vide rejoint le PC s'il n'en a pas, sinon part en stock.
    if (ecranPosteVide) {
        const versPC = !materiel.ecran_actuel;
        await deplacerEcran(tx, ecranPosteVide, versPC ? id_materiels : null, versPC ? 'AFFECTE' : 'EN_STOCK', {
            now, auteur, motif: versPC ? 'Repris du poste vide' : 'Poste vide remplacé',
        });
        if (versPC) await syncColonnesEcran(tx, id_materiels);
    }

    await tracer(
        tx,
        id_materiels,
        `Affecté à : ${decrireBeneficiaire(materiel.id_n, materiel.utilisateur)}`,
        avecMotif(`Affecté à : ${decrireBeneficiaire(cibleIdN, nom)}`, motif),
        auteur
    );

    // L'utilisateur qui perd son PC garde une fiche, vide, pour rester visible
    // dans la liste et pouvoir recevoir un autre PC.
    if (miseEnStock && materiel.id_n) {
        const vide = await tx.materiels.create({
            data: {
                id_n: materiel.id_n,
                utilisateur: materiel.utilisateur,
                equipe: materiel.equipe,
                caracteristiques: '',
                id_local: materiel.id_local,
                est_vide: true,
                est_actif: false,
                etat_pc: ETAT_SANS_POSTE,
                date_modification: now,
            },
        });
        await tracer(
            tx,
            vide.id_materiels,
            null,
            avecMotif(`Poste vide : PC ${materiel.code_pc || `#${id_materiels}`} mis en stock`, motif),
            auteur
        );
    }

    await rattacherMouvements(tx, mouvementsConserves, idNConserve);

    return misAJour;
};

/**
 * Déplace un écran vers un poste (id_materiels) ou le sort du parc actif
 * (id_materiels null + statut EN_STOCK / EN_REPARATION / REFORME).
 *
 * Si le poste cible a déjà un écran, mode_conflit décide :
 * - 'refuser' (défaut) : erreur 409 ;
 * - 'echanger'         : l'écran du poste cible part sur l'ancien poste de l'écran déplacé ;
 * - 'stock'            : l'écran du poste cible part en stock.
 */
export const affecterEcran = async (tx, { id_ecran, id_materiels, statut, mode_conflit = 'refuser', motif, etat_remise, commentaire }, auteurIdN) => {
    const ecran = await tx.ecran.findUnique({ where: { id_ecran } });
    if (!ecran) {
        throw new AffectationError('Écran introuvable.', 404);
    }

    const cibleId = id_materiels ?? null;
    const statutFinal = cibleId ? 'AFFECTE' : (statut || 'EN_STOCK');
    if (!cibleId && !STATUTS_HORS_POSTE.includes(statutFinal)) {
        throw new AffectationError(`Statut invalide : ${statutFinal}.`);
    }
    if (cibleId === ecran.id_materiels && (cibleId !== null || statutFinal === ecran.statut)) {
        throw new AffectationError('L\'écran est déjà à cet emplacement.');
    }

    let ecranCible = null;
    if (cibleId) {
        const poste = await tx.materiels.findUnique({
            where: { id_materiels: cibleId },
            include: { ecran_actuel: true },
        });
        if (!poste || poste.date_suppression) {
            throw new AffectationError('Poste cible introuvable.', 404);
        }
        ecranCible = poste.ecran_actuel;
        if (ecranCible) {
            if (mode_conflit === 'refuser') {
                throw new AffectationError(
                    `Le poste cible a déjà l'écran ${ecranCible.code_ecran}.`,
                    409,
                    { conflit: { id_ecran: ecranCible.id_ecran, code_ecran: ecranCible.code_ecran } }
                );
            }
            if (!['echanger', 'stock'].includes(mode_conflit)) {
                throw new AffectationError(`Mode de conflit invalide : ${mode_conflit}.`);
            }
        }
    }

    const now = new Date();
    const auteur = await resoudreAuteur(tx, auteurIdN);
    const ctx = { now, auteur, motif, etat_remise, commentaire };
    const ancienPoste = ecran.id_materiels;

    // Libère d'abord le poste cible : ecrans.id_materiels est unique.
    if (ecranCible) {
        await tx.ecran.update({ where: { id_ecran: ecranCible.id_ecran }, data: { id_materiels: null } });
    }

    await deplacerEcran(tx, ecran, cibleId, statutFinal, ctx);

    if (ecranCible) {
        if (mode_conflit === 'echanger') {
            await deplacerEcran(tx, ecranCible, ancienPoste, ancienPoste ? 'AFFECTE' : 'EN_STOCK', {
                ...ctx, motif: `Échange avec l'écran ${ecran.code_ecran}`,
            });
        } else {
            await deplacerEcran(tx, ecranCible, null, 'EN_STOCK', {
                ...ctx, motif: `Remplacé par l'écran ${ecran.code_ecran}`,
            });
        }
    }

    if (ancienPoste) {
        await syncColonnesEcran(tx, ancienPoste);
        const remplacant = mode_conflit === 'echanger' && ecranCible ? ecranCible.code_ecran : null;
        await tracer(
            tx,
            ancienPoste,
            `Écran : ${ecran.code_ecran}`,
            avecMotif(remplacant ? `Écran : ${remplacant} (échange)` : 'Écran : aucun', motif),
            auteur
        );
    }
    if (cibleId) {
        await syncColonnesEcran(tx, cibleId);
        await tracer(
            tx,
            cibleId,
            `Écran : ${ecranCible?.code_ecran || 'aucun'}`,
            avecMotif(`Écran : ${ecran.code_ecran}`, motif),
            auteur
        );
    }

    return tx.ecran.findUnique({ where: { id_ecran } });
};

/**
 * Rattache au poste l'écran portant ce code (création ou reprise du stock).
 * Utilisé par la création de matériel et l'import Excel, qui ne connaissent
 * que le code. Un code vide ne touche pas à l'écran actuel du poste.
 */
export const rattacherEcranParCode = async (tx, id_materiels, { code_ecran, modele, date_ecran }, auteurIdN, motif) => {
    const code = typeof code_ecran === 'string' ? code_ecran.trim() : code_ecran ? String(code_ecran).trim() : '';
    if (!code) return null;

    let ecran = await tx.ecran.findUnique({ where: { code_ecran: code } });

    if (ecran && ecran.id_materiels === id_materiels) {
        const maj = {};
        if (modele !== undefined && modele !== null && modele !== ecran.modele) maj.modele = modele;
        if (date_ecran && (!ecran.date_ecran || new Date(date_ecran).getTime() !== ecran.date_ecran.getTime())) maj.date_ecran = date_ecran;
        if (Object.keys(maj).length > 0) {
            await tx.ecran.update({ where: { id_ecran: ecran.id_ecran }, data: maj });
            await syncColonnesEcran(tx, id_materiels);
        }
        return ecran;
    }

    if (ecran && ecran.id_materiels) {
        const poste = await tx.materiels.findUnique({ where: { id_materiels: ecran.id_materiels }, select: { id_n: true, utilisateur: true } });
        throw new AffectationError(
            `L'écran ${code} est déjà sur le poste de ${decrireBeneficiaire(poste?.id_n, poste?.utilisateur)}. Utilisez « Déplacer l'écran ».`,
            409
        );
    }

    if (!ecran) {
        ecran = await tx.ecran.create({
            data: { code_ecran: code, modele: modele || null, date_ecran: date_ecran || null, statut: 'EN_STOCK' },
        });
    }

    return affecterEcran(tx, { id_ecran: ecran.id_ecran, id_materiels, mode_conflit: 'stock', motif }, auteurIdN);
};

/**
 * Ouvre l'affectation PC initiale d'un poste qui vient d'être créé.
 */
export const ouvrirAffectationInitiale = async (tx, materiel, auteurIdN, motif = 'Création') => {
    const auteur = await resoudreAuteur(tx, auteurIdN);
    await tx.affectationMateriel.create({
        data: {
            type_affectation: 'PC',
            id_materiels: materiel.id_materiels,
            id_n: materiel.id_n ?? null,
            nom_utilisateur: materiel.utilisateur,
            date_debut: new Date(),
            motif,
            ...auteur,
        },
    });
};

/**
 * Suppression logique d'un poste : ferme son affectation, envoie son écran en
 * stock et libère le matricule (materiels.id_n est unique) pour que
 * l'utilisateur puisse recevoir un autre poste. L'historique est conservé.
 */
export const retirerPoste = async (tx, id_materiels, auteurIdN) => {
    const materiel = await tx.materiels.findUnique({
        where: { id_materiels },
        include: { ecran_actuel: true },
    });
    if (!materiel || materiel.date_suppression) {
        throw new AffectationError('Matériel introuvable.', 404);
    }

    const now = new Date();
    const auteur = await resoudreAuteur(tx, auteurIdN);

    if (materiel.ecran_actuel) {
        await deplacerEcran(tx, materiel.ecran_actuel, null, 'EN_STOCK', { now, auteur, motif: 'Poste supprimé' });
    }
    await fermerAffectationEnCours(tx, { type_affectation: 'PC', id_materiels }, now);

    await tx.materiels.update({
        where: { id_materiels },
        data: {
            est_actif: false,
            date_suppression: now,
            id_n: null,
            ecran: null,
            code_ecran: null,
            date_ecran: null,
        },
    });

    await tracer(
        tx,
        id_materiels,
        `Affecté à : ${decrireBeneficiaire(materiel.id_n, materiel.utilisateur)}`,
        'Poste supprimé',
        auteur
    );
};

/**
 * Réponse HTTP uniforme pour les erreurs du service.
 */
export const repondreErreurAffectation = (res, error) => {
    if (error instanceof AffectationError) {
        return res.status(error.status).json({ error: error.message, ...(error.details || {}) });
    }
    console.error('Erreur affectation:', error);
    return res.status(500).json({ error: `Erreur interne lors de l'affectation : ${error.message}` });
};
