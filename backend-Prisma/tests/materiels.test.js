import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { prisma, resetDatabase, createUser } from './helpers/db.js';
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
