import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { prisma, resetDatabase, createUser, createProduit, createLocal } from './helpers/db.js';
import { as } from './helpers/http.js';
import {
    StockError, appliquerVariationStock, ajusterStockVers, creerMouvement,
    annulerEffetMouvement, modifierEffetMouvement,
} from '../services/stockService.js';

const stockDe = async (idProduit) =>
    (await prisma.produits.findUnique({ where: { id_produit: idProduit } })).quantite_en_stock;

const historiqueDe = (idProduit) =>
    prisma.historiqueArrive.findMany({ where: { id_produit: idProduit }, orderBy: { id_arrivage: 'asc' } });

beforeEach(async () => {
    await resetDatabase();
});

afterAll(async () => {
    await prisma.$disconnect();
});

describe('stockService (unitaire, base de test)', () => {
    it('une entrée augmente le stock et écrit une ligne d\'historique', async () => {
        const produit = await createProduit({ quantite: 10 });

        const result = await prisma.$transaction((tx) =>
            appliquerVariationStock(tx, { idProduit: produit.id_produit, delta: 5, remarque: 'Arrivage' }));

        expect(result).toMatchObject({ ancienneQuantite: 10, nouvelleQuantite: 15 });
        expect(await stockDe(produit.id_produit)).toBe(15);
        const historique = await historiqueDe(produit.id_produit);
        expect(historique).toHaveLength(1);
        expect(historique[0]).toMatchObject({ quantite_arrivee: 5, ancienne_quantite_stock: 10, remarque: 'Arrivage' });
    });

    it('une sortie diminue le stock et historise une quantité négative', async () => {
        const produit = await createProduit({ quantite: 10 });

        await prisma.$transaction((tx) => appliquerVariationStock(tx, { idProduit: produit.id_produit, delta: -3 }));

        expect(await stockDe(produit.id_produit)).toBe(7);
        const historique = await historiqueDe(produit.id_produit);
        expect(historique).toHaveLength(1);
        expect(historique[0]).toMatchObject({ quantite_arrivee: -3, ancienne_quantite_stock: 10 });
    });

    it('une sortie qui viderait le stock exactement est acceptée', async () => {
        const produit = await createProduit({ quantite: 4 });
        await prisma.$transaction((tx) => appliquerVariationStock(tx, { idProduit: produit.id_produit, delta: -4 }));
        expect(await stockDe(produit.id_produit)).toBe(0);
    });

    it('refuse un stock négatif (StockError 400), sans modifier le stock ni l\'historique', async () => {
        const produit = await createProduit({ quantite: 2 });

        const promise = prisma.$transaction((tx) => appliquerVariationStock(tx, { idProduit: produit.id_produit, delta: -3 }));

        await expect(promise).rejects.toBeInstanceOf(StockError);
        await expect(promise).rejects.toMatchObject({ status: 400, message: expect.stringMatching(/Stock insuffisant/) });
        expect(await stockDe(produit.id_produit)).toBe(2);
        expect(await historiqueDe(produit.id_produit)).toHaveLength(0);
    });

    it('refuse une variation non entière', async () => {
        const produit = await createProduit({ quantite: 2 });
        await expect(
            prisma.$transaction((tx) => appliquerVariationStock(tx, { idProduit: produit.id_produit, delta: 1.5 }))
        ).rejects.toBeInstanceOf(StockError);
    });

    it('renvoie une StockError 404 pour un produit inexistant', async () => {
        await expect(
            prisma.$transaction((tx) => appliquerVariationStock(tx, { idProduit: 999999, delta: 1 }))
        ).rejects.toMatchObject({ name: 'StockError', status: 404 });
    });

    it('un stock NULL incrémenté part de 0', async () => {
        const produit = await prisma.produits.create({ data: { nom_produit: 'Sans stock', quantite_en_stock: null } });
        await prisma.$transaction((tx) => appliquerVariationStock(tx, { idProduit: produit.id_produit, delta: 4 }));
        expect(await stockDe(produit.id_produit)).toBe(4);
    });

    it('l\'historique est écrit dans la même transaction (annulé si la transaction échoue)', async () => {
        const produit = await createProduit({ quantite: 10 });

        await expect(prisma.$transaction(async (tx) => {
            await appliquerVariationStock(tx, { idProduit: produit.id_produit, delta: 5 });
            expect(await tx.historiqueArrive.count({ where: { id_produit: produit.id_produit } })).toBe(1);
            throw new Error('échec après la variation');
        })).rejects.toThrow('échec après la variation');

        expect(await stockDe(produit.id_produit)).toBe(10);
        expect(await historiqueDe(produit.id_produit)).toHaveLength(0);
    });

    it('creerMouvement (SORTIE) crée le mouvement, décrémente le stock et historise', async () => {
        const produit = await createProduit({ quantite: 10 });
        const date = new Date(Date.UTC(2026, 9, 1));

        const mouvement = await prisma.$transaction((tx) => creerMouvement(tx, {
            idProduit: produit.id_produit,
            typeMouvement: 'SORTIE',
            quantite: 4,
            dateMouvement: date,
            donnees: { nom_utilisateur: 'Testeur' },
        }));

        expect(mouvement).toMatchObject({ id_produit: produit.id_produit, type_mouvement: 'SORTIE', quantite: 4 });
        expect(await stockDe(produit.id_produit)).toBe(6);
        const [ligne] = await historiqueDe(produit.id_produit);
        expect(ligne.quantite_arrivee).toBe(-4);
        const produitApres = await prisma.produits.findUnique({ where: { id_produit: produit.id_produit } });
        expect(produitApres.last_date.toISOString().slice(0, 10)).toBe('2026-10-01');
    });

    it('creerMouvement refuse une sortie supérieure au stock sans créer de mouvement', async () => {
        const produit = await createProduit({ quantite: 1 });

        await expect(prisma.$transaction((tx) => creerMouvement(tx, {
            idProduit: produit.id_produit,
            typeMouvement: 'SORTIE',
            quantite: 2,
            dateMouvement: new Date(),
            donnees: { nom_utilisateur: 'Testeur' },
        }))).rejects.toBeInstanceOf(StockError);

        expect(await stockDe(produit.id_produit)).toBe(1);
        expect(await prisma.mouvement.count()).toBe(0);
        expect(await historiqueDe(produit.id_produit)).toHaveLength(0);
    });

    it('creerMouvement refuse un type ou une quantité invalide', async () => {
        const produit = await createProduit({ quantite: 5 });
        const base = { idProduit: produit.id_produit, dateMouvement: new Date(), donnees: { nom_utilisateur: 'T' } };

        await expect(prisma.$transaction((tx) => creerMouvement(tx, { ...base, typeMouvement: 'VOL', quantite: 1 })))
            .rejects.toBeInstanceOf(StockError);
        await expect(prisma.$transaction((tx) => creerMouvement(tx, { ...base, typeMouvement: 'ENTREE_QUANTITE', quantite: 0 })))
            .rejects.toBeInstanceOf(StockError);
        expect(await stockDe(produit.id_produit)).toBe(5);
    });

    it('ajusterStockVers historise la différence', async () => {
        const produit = await createProduit({ quantite: 10 });

        await prisma.$transaction((tx) => ajusterStockVers(tx, { idProduit: produit.id_produit, quantiteCible: 3 }));

        expect(await stockDe(produit.id_produit)).toBe(3);
        const [ligne] = await historiqueDe(produit.id_produit);
        expect(ligne).toMatchObject({ quantite_arrivee: -7, ancienne_quantite_stock: 10 });
        await expect(prisma.$transaction((tx) => ajusterStockVers(tx, { idProduit: produit.id_produit, quantiteCible: -1 })))
            .rejects.toBeInstanceOf(StockError);
    });

    it('annulerEffetMouvement refuse d\'annuler une entrée déjà consommée', async () => {
        const produit = await createProduit({ quantite: 2 });
        const mouvement = await prisma.mouvement.create({
            data: { id_produit: produit.id_produit, type_mouvement: 'ENTREE_QUANTITE', quantite: 5, nom_utilisateur: 'T' },
        });

        await expect(prisma.$transaction((tx) => annulerEffetMouvement(tx, mouvement)))
            .rejects.toThrow(/Impossible d'annuler ce mouvement/);
        expect(await stockDe(produit.id_produit)).toBe(2);
    });

    it('modifierEffetMouvement applique uniquement la variation nette', async () => {
        const produit = await createProduit({ quantite: 10 });
        const ancien = { id_mouvement: 1, id_produit: produit.id_produit, type_mouvement: 'SORTIE', quantite: 2, date_mouvement: new Date() };

        // SORTIE 2 -> SORTIE 5 : 3 unités de plus sortent
        await prisma.$transaction((tx) => modifierEffetMouvement(tx, ancien, {
            idProduit: produit.id_produit, typeMouvement: 'SORTIE', quantite: 5, dateMouvement: new Date(),
        }));

        expect(await stockDe(produit.id_produit)).toBe(7);
        const historique = await historiqueDe(produit.id_produit);
        expect(historique).toHaveLength(1);
        expect(historique[0].quantite_arrivee).toBe(-3);
    });
});

describe('Routes stock (HTTP)', () => {
    let admin;
    let simpleUser;
    let local;

    beforeEach(async () => {
        admin = await createUser({ idN: 1, role: 'IT_ADMIN' });
        simpleUser = await createUser({ idN: 2, role: 'USER' });
        local = await createLocal('Magasin');
    });

    it('POST /api/mouvements (SORTIE) par un IT_ADMIN décrémente le stock', async () => {
        const produit = await createProduit({ quantite: 10 });

        const res = await as(admin).post('/api/mouvements').send({
            type_mouvement: 'SORTIE',
            id_produit: produit.id_produit,
            id_local_source: local.id_local,
            quantite: 3,
            nom_utilisateur: 'Admin',
            date_mouvement: '2026-10-01',
        });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.mouvement).toMatchObject({ type_mouvement: 'SORTIE', quantite: 3 });
        expect(res.body.mouvement.produits.quantite_en_stock).toBe(7);
        expect(await stockDe(produit.id_produit)).toBe(7);
        expect(await historiqueDe(produit.id_produit)).toHaveLength(1);
    });

    it('POST /api/mouvements refuse une sortie supérieure au stock (400 { error })', async () => {
        const produit = await createProduit({ quantite: 2 });

        const res = await as(admin).post('/api/mouvements').send({
            type_mouvement: 'SORTIE',
            id_produit: produit.id_produit,
            id_local_source: local.id_local,
            quantite: 5,
            nom_utilisateur: 'Admin',
        });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/Stock insuffisant/);
        expect(await stockDe(produit.id_produit)).toBe(2);
        expect(await prisma.mouvement.count()).toBe(0);
    });

    it('POST /api/mouvements (ENTREE) crée le produit avec son stock initial historisé', async () => {
        const res = await as(admin).post('/api/mouvements').send({
            type_mouvement: 'ENTREE',
            nom_produit: 'Clavier USB',
            id_local_destination: local.id_local,
            quantite: 8,
            nom_utilisateur: 'Admin',
        });

        expect(res.status).toBe(201);
        const produit = await prisma.produits.findFirst({ where: { nom_produit: 'Clavier USB' } });
        expect(produit.quantite_en_stock).toBe(8);
        const historique = await historiqueDe(produit.id_produit);
        expect(historique).toHaveLength(1);
        expect(historique[0]).toMatchObject({ quantite_arrivee: 8, ancienne_quantite_stock: 0 });
    });

    it('DELETE /api/mouvements/:id annule l\'effet du mouvement sur le stock', async () => {
        const produit = await createProduit({ quantite: 10 });
        const creation = await as(admin).post('/api/mouvements').send({
            type_mouvement: 'SORTIE', id_produit: produit.id_produit, id_local_source: local.id_local, quantite: 4, nom_utilisateur: 'Admin',
        });
        expect(creation.status).toBe(201);

        const res = await as(admin).delete(`/api/mouvements/${creation.body.mouvement.id_mouvement}`);

        expect(res.status).toBe(200);
        expect(await stockDe(produit.id_produit)).toBe(10);
        expect(await prisma.mouvement.count()).toBe(0);
        expect(await historiqueDe(produit.id_produit)).toHaveLength(2);
    });

    it('PUT /api/produits/:id ajuste le stock via stockService (historisé)', async () => {
        const produit = await createProduit({ quantite: 10 });

        const res = await as(admin).put(`/api/produits/${produit.id_produit}`).send({ quantite_en_stock: 4 });

        expect(res.status).toBe(200);
        expect(res.body.quantite_en_stock).toBe(4);
        const [ligne] = await historiqueDe(produit.id_produit);
        expect(ligne).toMatchObject({ quantite_arrivee: -6, remarque: 'Ajustement manuel (fiche produit)' });
    });

    it('PUT /api/produits/:id refuse une quantité négative (400)', async () => {
        const produit = await createProduit({ quantite: 10 });
        const res = await as(admin).put(`/api/produits/${produit.id_produit}`).send({ quantite_en_stock: -1 });
        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error');
        expect(await stockDe(produit.id_produit)).toBe(10);
    });

    it('un USER reçoit 403 sur toutes les écritures de stock', async () => {
        const produit = await createProduit({ quantite: 10 });
        const mouvement = await prisma.mouvement.create({
            data: { id_produit: produit.id_produit, type_mouvement: 'SORTIE', quantite: 1, nom_utilisateur: 'T' },
        });
        const client = as(simpleUser);

        const reponses = await Promise.all([
            client.post('/api/mouvements').send({
                type_mouvement: 'SORTIE', id_produit: produit.id_produit, id_local_source: local.id_local, quantite: 1, nom_utilisateur: 'U',
            }),
            client.put(`/api/mouvements/${mouvement.id_mouvement}`).send({ quantite: 5 }),
            client.delete(`/api/mouvements/${mouvement.id_mouvement}`),
            client.post('/api/produits').send({ nom_produit: 'Pirate', quantite_en_stock: 100 }),
            client.put(`/api/produits/${produit.id_produit}`).send({ quantite_en_stock: 999 }),
            client.delete(`/api/produits/${produit.id_produit}`),
        ]);

        for (const res of reponses) {
            expect(res.status).toBe(403);
            expect(res.body).toHaveProperty('error');
        }
        expect(await stockDe(produit.id_produit)).toBe(10);
        expect(await prisma.mouvement.count()).toBe(1);
        expect(await prisma.produits.count()).toBe(1);
    });

    it('un USER ne peut pas lire les stocks (403)', async () => {
        const res = await as(simpleUser).get('/api/produits');
        expect(res.status).toBe(403);
    });
});
