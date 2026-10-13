import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { prisma, resetDatabase, createUser, createProduit } from './helpers/db.js';
import { as } from './helpers/http.js';

let admin;
let alice;

beforeEach(async () => {
    await resetDatabase();
    admin = await createUser({ idN: 1, role: 'IT_ADMIN', withMateriel: true });
    alice = await createUser({ idN: 10, role: 'USER', withMateriel: true });
});

afterAll(async () => {
    await prisma.$disconnect();
});

describe('PUT /api/materiels_all/:id — états posés par la mise en stock', () => {
    it.each(['Stock', 'Sans poste'])('refuse de passer l\'état à « %s » sans mise en stock', async (etat) => {
        const res = await as(admin).put(`/api/materiels_all/${alice.materiel.id_materiels}`)
            .send({ etat_pc: etat, salle: 'B12' });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/Mettre en stock/);
        const materiel = await prisma.materiels.findUnique({ where: { id_materiels: alice.materiel.id_materiels } });
        expect(materiel).toMatchObject({ id_n: 10, salle: null });
        expect(materiel.etat_pc).not.toBe(etat);
    });

    it('accepte un état « Sans poste » déjà en place (ancienne saisie) pour modifier les autres champs', async () => {
        await prisma.materiels.update({ where: { id_materiels: alice.materiel.id_materiels }, data: { etat_pc: 'Sans poste' } });

        const res = await as(admin).put(`/api/materiels_all/${alice.materiel.id_materiels}`)
            .send({ etat_pc: 'Sans poste', salle: 'B12' });

        expect(res.status).toBe(200);
        expect(res.body.materiel).toMatchObject({ etat_pc: 'Sans poste', salle: 'B12' });
    });

    it('la mise en stock passe par POST /:id/affecter : PC en « Stock », fiche « Sans poste » pour l\'utilisateur', async () => {
        const res = await as(admin).post(`/api/materiels_all/${alice.materiel.id_materiels}/affecter`)
            .send({ id_n: null, motif: 'Départ' });

        expect(res.status).toBe(200);
        const pc = await prisma.materiels.findUnique({ where: { id_materiels: alice.materiel.id_materiels } });
        expect(pc).toMatchObject({ id_n: null, etat_pc: 'Stock', est_actif: false });
        const ficheVide = await prisma.materiels.findUnique({ where: { id_n: 10 } });
        expect(ficheVide).toMatchObject({ est_vide: true, etat_pc: 'Sans poste' });
    });
});

describe('POST /api/materiels_all/ — ajout d\'un PC directement en stock', () => {
    it('ignore matricule, utilisateur et écran, et crée le PC inactif en « Stock »', async () => {
        const res = await as(admin).post('/api/materiels_all/')
            .send({
                etat_pc: 'Stock', id_n: 99, utilisateur: 'Bob', equipe: 'Compta',
                ecran: 'Dell', code_ecran: 'ECR-STOCK', est_actif: true, code_pc: 'PC-STOCK', caracteristiques: 'i5',
            });

        expect(res.status).toBe(201);
        expect(res.body.materiel).toMatchObject({
            id_n: null, utilisateur: 'Stock', equipe: 'Stock', etat_pc: 'Stock', est_actif: false, code_pc: 'PC-STOCK',
        });
        expect(await prisma.users.findUnique({ where: { id_n: 99 } })).toBeNull();
        expect(await prisma.ecran.findUnique({ where: { code_ecran: 'ECR-STOCK' } })).toBeNull();
        const affectation = await prisma.affectationMateriel.findFirst({ where: { id_materiels: res.body.materiel.id_materiels } });
        expect(affectation).toMatchObject({ id_n: null, nom_utilisateur: 'Stock' });
    });
});

describe('DELETE /api/materiels_all/:id — fiches « Sans poste » et PC en stock uniquement', () => {
    const mettreEnStock = () => as(admin).post(`/api/materiels_all/${alice.materiel.id_materiels}/affecter`)
        .send({ id_n: null, motif: 'Départ' });

    it('refuse de supprimer un PC encore affecté', async () => {
        const res = await as(admin).delete(`/api/materiels_all/${alice.materiel.id_materiels}`);

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/Mettre en stock/);
        const pc = await prisma.materiels.findUnique({ where: { id_materiels: alice.materiel.id_materiels } });
        expect(pc).toMatchObject({ id_n: 10, date_suppression: null });
    });

    it('supprime une fiche « Sans poste », libère le matricule et renvoie son écran en stock', async () => {
        await mettreEnStock();
        const ficheVide = await prisma.materiels.findUnique({ where: { id_n: 10 } });
        const ecran = await prisma.ecran.create({ data: { code_ecran: 'ECR-1', id_materiels: ficheVide.id_materiels } });

        const res = await as(admin).delete(`/api/materiels_all/${ficheVide.id_materiels}`);

        expect(res.status).toBe(200);
        expect(res.body.message).toMatch(/Sans poste/);
        const supprimee = await prisma.materiels.findUnique({ where: { id_materiels: ficheVide.id_materiels } });
        expect(supprimee.id_n).toBeNull();
        expect(supprimee.date_suppression).not.toBeNull();
        expect(await prisma.ecran.findUnique({ where: { id_ecran: ecran.id_ecran } }))
            .toMatchObject({ id_materiels: null, statut: 'EN_STOCK' });
        const trace = await prisma.historiqueMateriel.findFirst({
            where: { id_materiels: ficheVide.id_materiels }, orderBy: { id_historique: 'desc' },
        });
        expect(trace).toMatchObject({ ancienne_valeur: 'Sans poste : 10 - Utilisateur 10', nouvelle_valeur: 'Fiche « Sans poste » supprimée' });
    });

    it('supprime une ancienne fiche dont l\'état est « Sans poste »', async () => {
        await prisma.materiels.update({ where: { id_materiels: alice.materiel.id_materiels }, data: { etat_pc: 'Sans poste' } });

        const res = await as(admin).delete(`/api/materiels_all/${alice.materiel.id_materiels}`);

        expect(res.status).toBe(200);
        expect(await prisma.materiels.findUnique({ where: { id_materiels: alice.materiel.id_materiels } }))
            .toMatchObject({ id_n: null });
    });

    it('sort un PC en stock de l\'inventaire, puis répond 404 à une seconde suppression', async () => {
        await mettreEnStock();

        const res = await as(admin).delete(`/api/materiels_all/${alice.materiel.id_materiels}`);

        expect(res.status).toBe(200);
        expect(res.body.message).toMatch(/inventaire/);
        const pc = await prisma.materiels.findUnique({ where: { id_materiels: alice.materiel.id_materiels } });
        expect(pc.date_suppression).not.toBeNull();
        const trace = await prisma.historiqueMateriel.findFirst({
            where: { id_materiels: alice.materiel.id_materiels }, orderBy: { id_historique: 'desc' },
        });
        expect(trace).toMatchObject({ ancienne_valeur: 'Affecté à : Stock', nouvelle_valeur: 'PC sorti de l\'inventaire' });

        const again = await as(admin).delete(`/api/materiels_all/${alice.materiel.id_materiels}`);
        expect(again.status).toBe(404);
    });
});

describe('Mouvements de stock : rattachés au matricule de l\'utilisateur, pas à sa fiche', () => {
    const creerMouvementPour = async (idN) => {
        const produit = await createProduit({ nom: 'Souris' });
        return prisma.mouvement.create({
            data: { id_produit: produit.id_produit, type_mouvement: 'SORTIE', quantite: 1, id_materiels: idN, nom_utilisateur: 'Test' },
        });
    };
    const relire = (mouvement) => prisma.mouvement.findUnique({ where: { id_mouvement: mouvement.id_mouvement } });

    it('restent à l\'utilisateur après la mise en stock de son PC puis la suppression de sa fiche « Sans poste »', async () => {
        const mouvement = await creerMouvementPour(10);

        await as(admin).post(`/api/materiels_all/${alice.materiel.id_materiels}/affecter`).send({ id_n: null });
        expect(await relire(mouvement)).toMatchObject({ id_materiels: 10 });

        const ficheVide = await prisma.materiels.findUnique({ where: { id_n: 10 } });
        const res = await as(admin).delete(`/api/materiels_all/${ficheVide.id_materiels}`);
        expect(res.status).toBe(200);
        expect(await relire(mouvement)).toMatchObject({ id_materiels: 10 });
    });

    it('restent à l\'utilisateur quand son PC est réaffecté à un autre', async () => {
        await createUser({ idN: 20 });
        const mouvement = await creerMouvementPour(10);

        const res = await as(admin).post(`/api/materiels_all/${alice.materiel.id_materiels}/affecter`)
            .send({ id_n: 20, utilisateur: 'Utilisateur 20' });

        expect(res.status).toBe(200);
        expect(await relire(mouvement)).toMatchObject({ id_materiels: 10 });
    });
});

describe('Corbeille : GET /corbeille et POST /:id/restaurer', () => {
    const mettreEnStock = () => as(admin).post(`/api/materiels_all/${alice.materiel.id_materiels}/affecter`)
        .send({ id_n: null });

    it('liste les fiches supprimées avec l\'auteur et le motif ; seuls les PC sont restaurables', async () => {
        await mettreEnStock();
        const ficheVide = await prisma.materiels.findUnique({ where: { id_n: 10 } });
        await as(admin).delete(`/api/materiels_all/${ficheVide.id_materiels}`);
        await as(admin).delete(`/api/materiels_all/${alice.materiel.id_materiels}`);

        const res = await as(admin).get('/api/materiels_all/corbeille');

        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(2);
        const pc = res.body.find(m => m.id_materiels === alice.materiel.id_materiels);
        const vide = res.body.find(m => m.id_materiels === ficheVide.id_materiels);
        expect(pc).toMatchObject({ restaurable: true, motif: 'PC sorti de l\'inventaire', supprime_par: '1 - Utilisateur 1' });
        expect(vide).toMatchObject({ restaurable: false, motif: 'Fiche « Sans poste » supprimée' });
    });

    it('est réservée aux rôles qui peuvent supprimer', async () => {
        const res = await as(alice).get('/api/materiels_all/corbeille');
        expect(res.status).toBe(403);
    });

    it('restaure un PC sorti de l\'inventaire en stock', async () => {
        await mettreEnStock();
        await as(admin).delete(`/api/materiels_all/${alice.materiel.id_materiels}`);

        const res = await as(admin).post(`/api/materiels_all/${alice.materiel.id_materiels}/restaurer`);

        expect(res.status).toBe(200);
        expect(res.body.materiel).toMatchObject({
            date_suppression: null, id_n: null, etat_pc: 'Stock', est_actif: false, utilisateur: 'Stock',
        });
        const affectation = await prisma.affectationMateriel.findFirst({
            where: { type_affectation: 'PC', id_materiels: alice.materiel.id_materiels, date_fin: null },
        });
        expect(affectation).toMatchObject({ id_n: null, motif: 'Restauré depuis la corbeille' });
        const liste = await as(admin).get('/api/materiels_all');
        expect(liste.body.map(m => m.id_materiels)).toContain(alice.materiel.id_materiels);
    });

    it('refuse de restaurer une fiche « Sans poste » ou un matériel non supprimé', async () => {
        await mettreEnStock();
        const ficheVide = await prisma.materiels.findUnique({ where: { id_n: 10 } });
        await as(admin).delete(`/api/materiels_all/${ficheVide.id_materiels}`);

        const vide = await as(admin).post(`/api/materiels_all/${ficheVide.id_materiels}/restaurer`);
        expect(vide.status).toBe(400);
        expect(vide.body.error).toMatch(/Réaffecter le PC/);

        const actif = await as(admin).post(`/api/materiels_all/${admin.materiel.id_materiels}/restaurer`);
        expect(actif.status).toBe(404);
    });
});
