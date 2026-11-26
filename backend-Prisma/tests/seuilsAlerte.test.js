import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { prisma, resetDatabase, createUser } from './helpers/db.js';
import { as } from './helpers/http.js';
import { generateSeuilAlerte, estSousSeuil, normaliserNomProduit } from '../constants/seuilsAlerte.js';
import { creerNouveauProduit } from '../services/produitsService.js';

describe('generateSeuilAlerte (unitaire)', () => {
    it('applique le seuil fixe des petits consommables', () => {
        expect(generateSeuilAlerte('Clavier USB externe', 100)).toBe(3);
        expect(generateSeuilAlerte('Connecteur RJ45', 0)).toBe(100);
    });

    it('reconnaît les noms réels en base (orthographe corrigée)', () => {
        expect(generateSeuilAlerte('Adaptateur HDMI-VGA', 0)).toBe(3);
        expect(generateSeuilAlerte('Adaptateur USB-LAN', 0)).toBe(3);
        expect(generateSeuilAlerte('Câble alimentation standard', 0)).toBe(3);
    });

    it('ignore casse, accents et espaces superflus', () => {
        expect(generateSeuilAlerte('  CABLE   reseau ', 0)).toBe(300);
        expect(generateSeuilAlerte('cable alimentation trefle', 0)).toBe(3);
        expect(normaliserNomProduit(' Câble  Réseau ')).toBe('cable reseau');
    });

    it('ne dépasse jamais 3, quelle que soit la quantité', () => {
        expect(generateSeuilAlerte('Onduleur 850 VA', 0)).toBe(3);
        expect(generateSeuilAlerte('Onduleur 850 VA', 40)).toBe(3);
        expect(generateSeuilAlerte('Onduleur 850 VA', 1000)).toBe(3);
    });

    it('traite une quantité absente ou invalide comme 0', () => {
        expect(generateSeuilAlerte('PC HP', undefined)).toBe(3);
        expect(generateSeuilAlerte('PC HP', NaN)).toBe(3);
    });
});

describe('estSousSeuil (unitaire)', () => {
    it('seuil vide = jamais en alerte', () => {
        expect(estSousSeuil(0, null)).toBe(false);
        expect(estSousSeuil(0, undefined)).toBe(false);
    });

    it('seuil 0 = alerte quand le stock est à 0', () => {
        expect(estSousSeuil(0, 0)).toBe(true);
        expect(estSousSeuil(1, 0)).toBe(false);
    });

    it('alerte quand stock <= seuil, stock NULL traité comme 0', () => {
        expect(estSousSeuil(3, 3)).toBe(true);
        expect(estSousSeuil(4, 3)).toBe(false);
        expect(estSousSeuil(null, 2)).toBe(true);
    });
});

describe('Seuil à la création de produit (base de test)', () => {
    let admin;

    beforeEach(async () => {
        await resetDatabase();
        admin = await createUser({ idN: 1, role: 'IT_ADMIN' });
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });

    it('creerNouveauProduit calcule le seuil sur quantiteReferenceSeuil (cas import)', async () => {
        const produit = await prisma.$transaction((tx) =>
            creerNouveauProduit(tx, { nomProduit: 'Disque SSD', quantiteInitiale: 0, quantiteReferenceSeuil: 40 }));
        expect(produit.quantite_en_stock).toBe(0);
        expect(produit.seuil_alerte).toBe(3);
    });

    it('POST /api/produits sans seuil calcule un seuil par défaut', async () => {
        const res = await as(admin).post('/api/produits').send({ nom_produit: 'Câble réseau', quantite_en_stock: 10 });
        expect(res.status).toBe(201);
        expect(res.body.seuil_alerte).toBe(300);
    });

    it('POST /api/produits conserve un seuil de 0 saisi explicitement', async () => {
        const res = await as(admin).post('/api/produits').send({ nom_produit: 'Batterie PC', quantite_en_stock: 2, seuil_alerte: 0 });
        expect(res.status).toBe(201);
        expect(res.body.seuil_alerte).toBe(0);
    });

    it('PUT /api/produits/:id avec un seuil vide le remet à NULL', async () => {
        const cree = await as(admin).post('/api/produits').send({ nom_produit: 'PC HP', quantite_en_stock: 5 });
        const res = await as(admin).put(`/api/produits/${cree.body.id_produit}`).send({ seuil_alerte: '' });
        expect(res.status).toBe(200);
        expect(res.body.seuil_alerte).toBeNull();
    });
});
