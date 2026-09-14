// backend-Prisma/constants/seuilsAlerte.js

/**
 * Seuils d'alerte fixes pour les petits consommables (accessoires vendus à
 * l'unité, stock faible attendu). Pour ajouter un cas particulier, il suffit
 * d'ajouter une entrée ici plutôt que de coder une nouvelle branche dans
 * generateSeuilAlerte().
 */
export const SEUILS_ALERTE_PAR_PRODUIT = {
    'clavier usb externe': 4,
    'souris usb avec fil': 4,
    'tapis souris': 4,
    'multi usb': 4,
    'adapteur hdmi-vga': 7,
    'adapteur usb-lan': 7,
    'câble alimentation stantard': 7,
    'câble alimentation trèfle': 7,
    'câble réseau': 7,
    'câble vga-vga': 7,
    'connecteur rj45': 7,
};

const SEUIL_MIN_DEFAUT = 3;
const SEUIL_MAX_DEFAUT = 8;
const RATIO_STOCK_INITIAL = 0.15;

/**
 * Calcule le seuil d'alerte d'un produit. Déterministe (contrairement à
 * l'ancienne version basée sur Math.random()) : un même nom et une même
 * quantité initiale donnent toujours le même seuil, ce qui rend les imports
 * répétés et les créations manuelles prévisibles.
 */
export function generateSeuilAlerte(nomProduit, quantiteInitiale) {
    const nomLower = nomProduit.trim().toLowerCase();

    if (Object.prototype.hasOwnProperty.call(SEUILS_ALERTE_PAR_PRODUIT, nomLower)) {
        return SEUILS_ALERTE_PAR_PRODUIT[nomLower];
    }

    return Math.min(SEUIL_MAX_DEFAUT, Math.max(SEUIL_MIN_DEFAUT, Math.round(quantiteInitiale * RATIO_STOCK_INITIAL)));
}
