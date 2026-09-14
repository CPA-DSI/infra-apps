// backend-Prisma/services/produitsService.js
import { generateSeuilAlerte } from '../constants/seuilsAlerte.js';

/**
 * Levée quand une création de produit se heurte à un produit déjà existant
 * du même nom (contrainte unique en base sur lower(trim(nom_produit))) :
 * soit détecté par une vérification préalable, soit par une création
 * concurrente entre-temps (erreur Prisma P2002).
 */
export class ProduitDejaExistantError extends Error {
    constructor(nomProduit, existingProductId) {
        super(`Le produit "${nomProduit}" existe déjà.`);
        this.name = 'ProduitDejaExistantError';
        this.nomProduit = nomProduit;
        this.existingProductId = existingProductId;
    }
}

async function trouverProduitParNom(client, nomTrim) {
    return client.produits.findFirst({
        where: { nom_produit: { equals: nomTrim, mode: 'insensitive' } }
    });
}

/**
 * Crée un nouveau produit avec un seuil d'alerte calculé de façon
 * déterministe. `client` peut être `prisma` ou un `tx` de transaction.
 *
 * Si un import ou un mouvement concurrent vient de créer le même produit
 * entre la vérification d'existence et cette création, l'erreur d'unicité
 * (P2002) est convertie en ProduitDejaExistantError plutôt que de remonter
 * une erreur Prisma brute à l'appelant.
 */
export async function creerNouveauProduit(client, { nomProduit, quantiteInitiale, dateMouvement = null }) {
    const nomTrim = nomProduit.trim();
    const seuilAlerte = generateSeuilAlerte(nomTrim, quantiteInitiale);

    try {
        return await client.produits.create({
            data: {
                nom_produit: nomTrim,
                quantite_en_stock: quantiteInitiale,
                last_date: dateMouvement,
                seuil_alerte: seuilAlerte
            }
        });
    } catch (error) {
        if (error.code === 'P2002') {
            const existant = await trouverProduitParNom(client, nomTrim);
            if (existant) {
                throw new ProduitDejaExistantError(nomTrim, existant.id_produit);
            }
        }
        throw error;
    }
}

export { trouverProduitParNom };
