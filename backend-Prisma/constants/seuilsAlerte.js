// backend-Prisma/constants/seuilsAlerte.js

/**
 * Normalise un nom de produit pour la comparaison : minuscules, sans accents,
 * espaces multiples réduits. "Câble  Réseau " et "cable reseau" sont égaux.
 */
export function normaliserNomProduit(nom) {
    return String(nom ?? '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Seuils d'alerte fixes pour les petits consommables (accessoires vendus à
 * l'unité, stock faible attendu). Pour ajouter un cas particulier, il suffit
 * d'ajouter une entrée ici plutôt que de coder une nouvelle branche dans
 * generateSeuilAlerte(). Les clés sont comparées après normalisation
 * (casse, accents et espaces ignorés).
 */
export const SEUILS_ALERTE_PAR_PRODUIT = {
    // Seuils plafonnés à 3 (décision du 2026-11-26), sauf les consommables
    // en vrac ci-dessous.
    'clavier usb externe': 3,
    'souris usb avec fil': 3,
    'tapis souris': 3,
    'multi usb': 3,
    'adaptateur hdmi-vga': 3,
    'adaptateur usb-lan': 3,
    'câble alimentation standard': 3,
    'câble alimentation trèfle': 3,
    'câble vga-vga': 3,
    // Consommables en vrac : seuil = une sortie habituelle (historique 2024-2025)
    'câble réseau': 300,      // sorties de 150 à 300
    'connecteur rj45': 100,   // sorties de 100 à 200
};

const SEUILS_NORMALISES = new Map(
    Object.entries(SEUILS_ALERTE_PAR_PRODUIT).map(([nom, seuil]) => [normaliserNomProduit(nom), seuil])
);

const SEUIL_MIN_DEFAUT = 3;
const SEUIL_MAX_DEFAUT = 3; // plafond : aucun seuil calculé ne dépasse 3
const RATIO_STOCK_INITIAL = 0.15;

/**
 * Calcule le seuil d'alerte d'un produit. Déterministe : un même nom et une
 * même quantité de référence donnent toujours le même seuil.
 */
export function generateSeuilAlerte(nomProduit, quantiteReference) {
    const seuilFixe = SEUILS_NORMALISES.get(normaliserNomProduit(nomProduit));
    if (seuilFixe !== undefined) {
        return seuilFixe;
    }

    const quantite = Number.isFinite(quantiteReference) ? quantiteReference : 0;
    return Math.min(SEUIL_MAX_DEFAUT, Math.max(SEUIL_MIN_DEFAUT, Math.round(quantite * RATIO_STOCK_INITIAL)));
}

/**
 * Règle unique "stock bas" : un seuil vide (null) signifie "pas d'alerte" ;
 * sinon le produit est en alerte dès que stock <= seuil (seuil 0 compris).
 */
export function estSousSeuil(quantiteEnStock, seuilAlerte) {
    if (seuilAlerte === null || seuilAlerte === undefined) return false;
    return (quantiteEnStock ?? 0) <= seuilAlerte;
}
