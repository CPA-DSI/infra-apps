// backend-Prisma/services/stockService.js
//
// Point d'entrée UNIQUE pour toute écriture sur produits.quantite_en_stock.
// Chaque variation de stock :
//   - verrouille la ligne produit (SELECT ... FOR UPDATE) pour lire un stock
//     cohérent (ancienne quantité / date pour l'historique) ;
//   - applique la variation de façon atomique (une décrémentation ne passe que
//     si le stock est suffisant : updateMany avec quantite_en_stock >= q) ;
//   - écrit une ligne dans historique_arrive (quantité signée : + entrée,
//     - sortie / annulation).
// Toutes les fonctions prennent un client de transaction `tx` : l'appelant
// est responsable de l'ouverture du prisma.$transaction().

import { creerNouveauProduit } from './produitsService.js';

/**
 * Erreur métier liée au stock, avec le code HTTP à renvoyer.
 */
export class StockError extends Error {
    constructor(message, status = 400) {
        super(message);
        this.name = 'StockError';
        this.status = status;
    }
}

export const TYPES_MOUVEMENT = ['ENTREE', 'ENTREE_QUANTITE', 'SORTIE'];

/**
 * Sens d'un mouvement sur le stock : +1 (entrée), -1 (sortie), 0 (type inconnu).
 */
export function sensMouvement(typeMouvement) {
    if (typeMouvement === 'ENTREE' || typeMouvement === 'ENTREE_QUANTITE') return 1;
    if (typeMouvement === 'SORTIE') return -1;
    return 0;
}

function tronquerRemarque(remarque) {
    if (!remarque) return null;
    return String(remarque).substring(0, 255);
}

/**
 * Verrouille la ligne du produit jusqu'à la fin de la transaction et la renvoie.
 */
async function verrouillerProduit(tx, idProduit) {
    const rows = await tx.$queryRaw`
        SELECT id_produit, nom_produit, quantite_en_stock, seuil_alerte, last_date
        FROM produits WHERE id_produit = ${idProduit} FOR UPDATE`;
    if (!rows[0]) {
        throw new StockError(`Produit avec l'ID ${idProduit} introuvable.`, 404);
    }
    return rows[0];
}

/**
 * Verrouille la ligne du mouvement jusqu'à la fin de la transaction et la
 * renvoie (relue après le verrou). Deux modifications / suppressions
 * simultanées du même mouvement sont ainsi sérialisées : la seconde calcule son
 * delta à partir de l'état laissé par la première.
 * Ordre des verrous : mouvement puis produit (cf. verrouillerProduit).
 */
export async function verrouillerMouvement(tx, idMouvement, include = undefined) {
    const rows = await tx.$queryRaw`
        SELECT id_mouvement FROM mouvements WHERE id_mouvement = ${idMouvement} FOR UPDATE`;
    if (!rows[0]) {
        throw new StockError(`Mouvement avec l'id ${idMouvement} introuvable.`, 404);
    }
    return tx.mouvement.findUnique({ where: { id_mouvement: idMouvement }, include });
}

/**
 * Écrit une ligne d'historique de stock (historique_arrive).
 */
export async function enregistrerHistorique(tx, { idProduit, delta, dateHistorique = null, ancienneQuantite = null, ancienneDate = null, remarque = null }) {
    return tx.historiqueArrive.create({
        data: {
            id_produit: idProduit,
            quantite_arrivee: delta,
            date_arrivee: dateHistorique || new Date(),
            ancienne_quantite_stock: ancienneQuantite,
            ancienne_date_stock: ancienneDate || null,
            remarque: tronquerRemarque(remarque)
        }
    });
}

/**
 * Applique une variation signée au stock d'un produit et l'historise.
 *
 * @param {object} tx           client de transaction Prisma
 * @param {number} idProduit
 * @param {number} delta        variation signée (entier, 0 = aucune écriture)
 * @param {Date|null} dateStock nouvelle valeur de produits.last_date (null = inchangée)
 * @param {Date|null} dateHistorique date_arrivee de la ligne d'historique (défaut: maintenant)
 * @param {string|null} remarque
 * @returns {{ ancienneQuantite, nouvelleQuantite, nomProduit }}
 */
export async function appliquerVariationStock(tx, { idProduit, delta, dateStock = null, dateHistorique = null, remarque = null }) {
    if (!Number.isInteger(delta)) {
        throw new StockError(`Variation de stock invalide (${delta}).`);
    }

    const produit = await verrouillerProduit(tx, idProduit);
    const ancienneQuantite = produit.quantite_en_stock ?? 0;

    if (delta === 0) {
        return { ancienneQuantite, nouvelleQuantite: ancienneQuantite, nomProduit: produit.nom_produit };
    }

    const dataDate = dateStock ? { last_date: dateStock } : {};

    if (delta > 0) {
        await tx.produits.update({
            where: { id_produit: idProduit },
            // Un stock NULL (+ n) resterait NULL en SQL : on part de 0 dans ce cas
            // (la ligne est verrouillée, la valeur lue est donc à jour).
            data: produit.quantite_en_stock === null
                ? { quantite_en_stock: delta, ...dataDate }
                : { quantite_en_stock: { increment: delta }, ...dataDate }
        });
    } else {
        const q = -delta;
        // Décrémentation atomique : ne s'applique que si le stock est suffisant.
        const { count } = await tx.produits.updateMany({
            where: { id_produit: idProduit, quantite_en_stock: { gte: q } },
            data: { quantite_en_stock: { decrement: q }, ...dataDate }
        });
        if (count !== 1) {
            throw new StockError(
                `Stock insuffisant pour "${produit.nom_produit}". Disponible: ${ancienneQuantite}, Demandé: ${q}`
            );
        }
    }

    const nouvelleQuantite = ancienneQuantite + delta;

    await enregistrerHistorique(tx, {
        idProduit,
        delta,
        dateHistorique,
        ancienneQuantite,
        ancienneDate: produit.last_date,
        remarque
    });

    if (produit.seuil_alerte && nouvelleQuantite <= produit.seuil_alerte) {
        console.log(`⚠️ Stock bas pour "${produit.nom_produit}" : ${nouvelleQuantite} <= seuil ${produit.seuil_alerte}`);
    }

    return { ancienneQuantite, nouvelleQuantite, nomProduit: produit.nom_produit };
}

/**
 * Ramène le stock d'un produit à une valeur cible (ajustement manuel depuis la
 * fiche produit). La différence est historisée.
 */
export async function ajusterStockVers(tx, { idProduit, quantiteCible, dateHistorique = null, remarque = 'Ajustement manuel du stock' }) {
    if (!Number.isInteger(quantiteCible) || quantiteCible < 0) {
        throw new StockError('La quantité en stock doit être un entier positif ou nul.');
    }
    const produit = await verrouillerProduit(tx, idProduit);
    const delta = quantiteCible - (produit.quantite_en_stock ?? 0);
    if (delta === 0 && produit.quantite_en_stock !== null) {
        return { ancienneQuantite: quantiteCible, nouvelleQuantite: quantiteCible, nomProduit: produit.nom_produit };
    }
    if (produit.quantite_en_stock === null) {
        // Stock jamais initialisé : on fixe directement la valeur.
        await tx.produits.update({ where: { id_produit: idProduit }, data: { quantite_en_stock: quantiteCible } });
        await enregistrerHistorique(tx, { idProduit, delta: quantiteCible, dateHistorique, ancienneQuantite: null, ancienneDate: produit.last_date, remarque });
        return { ancienneQuantite: null, nouvelleQuantite: quantiteCible, nomProduit: produit.nom_produit };
    }
    return appliquerVariationStock(tx, { idProduit, delta, dateHistorique, remarque });
}

/**
 * Crée un produit avec un stock initial (mouvement de type ENTREE) et
 * historise ce stock initial (ancienne quantité = 0).
 */
export async function creerProduitAvecStock(tx, { nomProduit, quantite, date = null, remarque = null }) {
    const produit = await creerNouveauProduit(tx, {
        nomProduit,
        quantiteInitiale: quantite,
        dateMouvement: date
    });
    if (quantite > 0) {
        await enregistrerHistorique(tx, {
            idProduit: produit.id_produit,
            delta: quantite,
            dateHistorique: date,
            ancienneQuantite: 0,
            ancienneDate: null,
            remarque
        });
    }
    return produit;
}

/**
 * Crée un mouvement de stock (ENTREE / ENTREE_QUANTITE / SORTIE sur un
 * produit existant) : applique la variation, l'historise et crée la ligne
 * mouvements. `donnees` contient les autres colonnes du mouvement.
 */
export async function creerMouvement(tx, { idProduit, typeMouvement, quantite, dateMouvement, remarqueHistorique = null, donnees = {}, include = undefined }) {
    const sens = sensMouvement(typeMouvement);
    if (sens === 0) {
        throw new StockError(`Type de mouvement invalide: ${typeMouvement}`);
    }
    if (!Number.isInteger(quantite) || quantite <= 0) {
        throw new StockError('La quantité doit être un nombre positif.');
    }

    await appliquerVariationStock(tx, {
        idProduit,
        delta: sens * quantite,
        dateStock: dateMouvement,
        dateHistorique: dateMouvement,
        remarque: remarqueHistorique
    });

    return tx.mouvement.create({
        data: {
            ...donnees,
            id_produit: idProduit,
            type_mouvement: typeMouvement,
            quantite,
            date_mouvement: dateMouvement
        },
        include
    });
}

/**
 * Annule l'effet d'un mouvement existant sur le stock (sans supprimer la
 * ligne mouvements). last_date du produit n'est pas modifiée.
 */
export async function annulerEffetMouvement(tx, mouvement, remarque = null) {
    const sens = sensMouvement(mouvement.type_mouvement);
    if (sens === 0) {
        console.log(`Type de mouvement inconnu: ${mouvement.type_mouvement} (aucun ajustement de stock)`);
        return;
    }
    try {
        await appliquerVariationStock(tx, {
            idProduit: mouvement.id_produit,
            delta: -sens * mouvement.quantite,
            dateHistorique: mouvement.date_mouvement,
            remarque: remarque || `Annulation du mouvement #${mouvement.id_mouvement}`
        });
    } catch (error) {
        if (error instanceof StockError && error.status === 400 && sens > 0) {
            throw new StockError(`Impossible d'annuler ce mouvement car cela rendrait le stock négatif. ${error.message}`);
        }
        throw error;
    }
}

/**
 * Met à jour l'effet sur le stock d'un mouvement modifié.
 * - même produit : une seule variation nette (nouvel effet - ancien effet) ;
 * - produit changé : annulation sur l'ancien produit puis application sur le nouveau.
 * last_date du (nouveau) produit est mise à la date du mouvement dès que son stock bouge.
 */
export async function modifierEffetMouvement(tx, ancien, { idProduit, typeMouvement, quantite, dateMouvement }) {
    const sensNouveau = sensMouvement(typeMouvement);
    if (sensNouveau === 0) {
        throw new StockError(`Type de mouvement invalide: ${typeMouvement}`);
    }
    if (!Number.isInteger(quantite) || quantite <= 0) {
        throw new StockError('La quantité doit être un nombre positif.');
    }
    const remarque = `Modification du mouvement #${ancien.id_mouvement}`;
    const effetAncien = sensMouvement(ancien.type_mouvement) * ancien.quantite;
    const effetNouveau = sensNouveau * quantite;

    if (ancien.id_produit === idProduit) {
        const delta = effetNouveau - effetAncien;
        if (delta !== 0) {
            await appliquerVariationStock(tx, { idProduit, delta, dateStock: dateMouvement, dateHistorique: dateMouvement, remarque });
        }
        return;
    }

    if (effetAncien !== 0) {
        await appliquerVariationStock(tx, {
            idProduit: ancien.id_produit,
            delta: -effetAncien,
            dateHistorique: ancien.date_mouvement,
            remarque
        });
    }
    await appliquerVariationStock(tx, { idProduit, delta: effetNouveau, dateStock: dateMouvement, dateHistorique: dateMouvement, remarque });
}

export default {
    StockError,
    TYPES_MOUVEMENT,
    sensMouvement,
    verrouillerMouvement,
    enregistrerHistorique,
    appliquerVariationStock,
    ajusterStockVers,
    creerProduitAvecStock,
    creerMouvement,
    annulerEffetMouvement,
    modifierEffetMouvement
};
