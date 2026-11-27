import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { prisma, resetDatabase, createUser, createProduit, createLocal } from './helpers/db.js';
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

describe('PUT /api/materiels_all/:id — etat_pc ne porte que l\'état physique', () => {
    it.each(['Stock', 'Sans poste', 'Disponible'])('refuse l\'ancien statut « %s » comme état', async (etat) => {
        const res = await as(admin).put(`/api/materiels_all/${alice.materiel.id_materiels}`)
            .send({ etat_pc: etat, salle: 'B12' });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/Mettre en stock/);
        const materiel = await prisma.materiels.findUnique({ where: { id_materiels: alice.materiel.id_materiels } });
        expect(materiel).toMatchObject({ id_n: 10, salle: null });
        expect(materiel.etat_pc).not.toBe(etat);
    });

    it('la mise en stock garde l\'état physique du PC ; la fiche « Sans poste » n\'en a pas', async () => {
        await prisma.materiels.update({ where: { id_materiels: alice.materiel.id_materiels }, data: { etat_pc: 'Mauvais' } });

        const res = await as(admin).post(`/api/materiels_all/${alice.materiel.id_materiels}/affecter`)
            .send({ id_n: null, motif: 'Départ' });

        expect(res.status).toBe(200);
        const pc = await prisma.materiels.findUnique({ where: { id_materiels: alice.materiel.id_materiels } });
        expect(pc).toMatchObject({ id_n: null, etat_pc: 'Mauvais', est_actif: false });
        const ficheVide = await prisma.materiels.findUnique({ where: { id_n: 10 } });
        expect(ficheVide).toMatchObject({ est_vide: true, etat_pc: null });
    });

    it('la réaffectation d\'un PC en stock garde son état physique', async () => {
        await prisma.materiels.update({ where: { id_materiels: alice.materiel.id_materiels }, data: { etat_pc: 'Moyen' } });
        await as(admin).post(`/api/materiels_all/${alice.materiel.id_materiels}/affecter`).send({ id_n: null });
        await createUser({ idN: 20 });

        const res = await as(admin).post(`/api/materiels_all/${alice.materiel.id_materiels}/affecter`)
            .send({ id_n: 20, utilisateur: 'Utilisateur 20' });

        expect(res.status).toBe(200);
        const pc = await prisma.materiels.findUnique({ where: { id_materiels: alice.materiel.id_materiels } });
        expect(pc).toMatchObject({ id_n: 20, etat_pc: 'Moyen', est_actif: true });
    });
});

describe('État « Disponible » retiré', () => {
    it('refuse « Disponible » en création', async () => {
        const post = await as(admin).post('/api/materiels_all/')
            .send({ etat_pc: 'Disponible', id_n: 99, utilisateur: 'Bob', equipe: 'Compta', caracteristiques: 'i5' });
        expect(post.status).toBe(400);
        expect(await prisma.users.findUnique({ where: { id_n: 99 } })).toBeNull();
    });
});

describe('POST /api/materiels_all/ — ajout d\'un PC directement en stock', () => {
    it('ignore matricule, utilisateur et écran, et crée le PC inactif en stock avec son état physique', async () => {
        const res = await as(admin).post('/api/materiels_all/')
            .send({
                en_stock: true, etat_pc: 'Très Bon', id_n: 99, utilisateur: 'Bob', equipe: 'Compta',
                ecran: 'Dell', code_ecran: 'ECR-STOCK', est_actif: true, code_pc: 'PC-STOCK', caracteristiques: 'i5',
            });

        expect(res.status).toBe(201);
        expect(res.body.materiel).toMatchObject({
            id_n: null, utilisateur: 'Stock', equipe: 'Stock', etat_pc: 'Très Bon', est_actif: false, code_pc: 'PC-STOCK',
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
            date_suppression: null, id_n: null, est_actif: false, utilisateur: 'Stock',
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

describe('POST /api/materiels_all/:id/affecter — bénéficiaire qui a déjà un PC', () => {
    let bob;

    beforeEach(async () => {
        bob = await createUser({ idN: 20, withMateriel: true });
    });

    const pcAlice = () => alice.materiel.id_materiels;
    const pcBob = () => bob.materiel.id_materiels;
    const relirePC = (id) => prisma.materiels.findUnique({ where: { id_materiels: id } });
    const affecterABob = (body = {}) => as(admin).post(`/api/materiels_all/${pcAlice()}/affecter`)
        .send({ id_n: 20, utilisateur: 'Utilisateur 20', ...body });
    const affectationsEnCours = (where) => prisma.affectationMateriel.findMany({ where: { ...where, date_fin: null } });
    const creerEcran = (code, id_materiels) => prisma.ecran.create({ data: { code_ecran: code, id_materiels, statut: 'AFFECTE' } });

    it('refuse par défaut (409) et ne change rien', async () => {
        const res = await affecterABob();

        expect(res.status).toBe(409);
        expect(res.body).toMatchObject({ id_materiels: pcBob() });
        expect(res.body.error).toMatch(/stock ou de l'échanger/);
        expect(await relirePC(pcAlice())).toMatchObject({ id_n: 10 });
        expect(await relirePC(pcBob())).toMatchObject({ id_n: 20 });
    });

    it.each([
        [{ mode_conflit: 'ecraser' }, /Mode de conflit invalide/],
        [{ mode_conflit: 'stock', etat_ancien_pc: 'Stock' }, /État physique invalide/],
    ])('refuse un paramètre invalide (%o)', async (body, message) => {
        const res = await affecterABob(body);

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(message);
        expect(await relirePC(pcBob())).toMatchObject({ id_n: 20 });
    });

    describe("mode « stock » : l'ancien PC part en stock", () => {
        it("met l'ancien PC en stock avec son état de retour et trace le remplacement", async () => {
            const res = await affecterABob({ mode_conflit: 'stock', etat_ancien_pc: 'HS', motif: 'Panne' });

            expect(res.status).toBe(200);
            expect(await relirePC(pcAlice())).toMatchObject({ id_n: 20, utilisateur: 'Utilisateur 20', est_actif: true });
            expect(await relirePC(pcBob())).toMatchObject({
                id_n: null, utilisateur: 'Stock', equipe: 'Stock', est_actif: false, etat_pc: 'HS', est_vide: false,
            });

            // Alice perd son PC : fiche « Sans poste ». Bob n'en a pas : il a un PC.
            expect(await prisma.materiels.findUnique({ where: { id_n: 10 } })).toMatchObject({ est_vide: true });
            expect(await prisma.materiels.count({ where: { est_vide: true } })).toBe(1);

            const [affBob] = await affectationsEnCours({ type_affectation: 'PC', id_materiels: pcBob() });
            expect(affBob).toMatchObject({ id_n: null, nom_utilisateur: 'Stock', etat_remise: 'HS' });
            expect(affBob.motif).toMatch(/Remplacé par le PC .* — Panne/);
            const [affAlice] = await affectationsEnCours({ type_affectation: 'PC', id_materiels: pcAlice() });
            expect(affAlice).toMatchObject({ id_n: 20 });

            const trace = await prisma.historiqueMateriel.findFirst({
                where: { id_materiels: pcAlice() }, orderBy: { id_historique: 'desc' },
            });
            expect(trace.nouvelle_valeur).toMatch(/^Affecté à : 20 - Utilisateur 20 \(remplace le PC .*\) — Motif : Panne$/);
        });

        it("garde l'état physique de l'ancien PC si aucun état de retour n'est donné", async () => {
            await prisma.materiels.update({ where: { id_materiels: pcBob() }, data: { etat_pc: 'Moyen' } });

            const res = await affecterABob({ mode_conflit: 'stock' });

            expect(res.status).toBe(200);
            expect(await relirePC(pcBob())).toMatchObject({ id_n: null, etat_pc: 'Moyen' });
        });

        it("l'écran du bénéficiaire passe sur le nouveau PC s'il n'en a pas", async () => {
            const ecran = await creerEcran('ECR-BOB', pcBob());

            const res = await affecterABob({ mode_conflit: 'stock' });

            expect(res.status).toBe(200);
            expect(await prisma.ecran.findUnique({ where: { id_ecran: ecran.id_ecran } }))
                .toMatchObject({ id_materiels: pcAlice(), statut: 'AFFECTE' });
            expect(await relirePC(pcAlice())).toMatchObject({ code_ecran: 'ECR-BOB' });
            expect(await relirePC(pcBob())).toMatchObject({ code_ecran: null });
        });

        it("l'écran du bénéficiaire part en stock si le nouveau PC a déjà le sien", async () => {
            const ecranAlice = await creerEcran('ECR-ALICE', pcAlice());
            const ecranBob = await creerEcran('ECR-BOB', pcBob());

            const res = await affecterABob({ mode_conflit: 'stock' });

            expect(res.status).toBe(200);
            expect(await prisma.ecran.findUnique({ where: { id_ecran: ecranAlice.id_ecran } }))
                .toMatchObject({ id_materiels: pcAlice(), statut: 'AFFECTE' });
            expect(await prisma.ecran.findUnique({ where: { id_ecran: ecranBob.id_ecran } }))
                .toMatchObject({ id_materiels: null, statut: 'EN_STOCK' });
            expect(await affectationsEnCours({ type_affectation: 'ECRAN', id_ecran: ecranBob.id_ecran }))
                .toEqual([expect.objectContaining({ id_materiels: null })]);
        });

        it('fonctionne avec un PC sorti du stock (sans fiche « Sans poste »)', async () => {
            await as(admin).post(`/api/materiels_all/${pcAlice()}/affecter`).send({ id_n: null });
            const vides = await prisma.materiels.count({ where: { est_vide: true } });

            const res = await affecterABob({ mode_conflit: 'stock' });

            expect(res.status).toBe(200);
            expect(await relirePC(pcAlice())).toMatchObject({ id_n: 20, est_actif: true });
            expect(await relirePC(pcBob())).toMatchObject({ id_n: null, est_actif: false });
            expect(await prisma.materiels.count({ where: { est_vide: true } })).toBe(vides);
        });
    });

    describe('mode « echanger » : les deux titulaires échangent leurs PC', () => {
        it("échange les PC ; chacun garde son écran, son local et son équipe, sans fiche « Sans poste »", async () => {
            const [bureauAlice, bureauBob] = [await createLocal('Bureau A'), await createLocal('Bureau B')];
            await prisma.materiels.update({ where: { id_materiels: pcAlice() }, data: { id_local: bureauAlice.id_local, equipe: 'Compta' } });
            await prisma.materiels.update({ where: { id_materiels: pcBob() }, data: { id_local: bureauBob.id_local, equipe: 'Audit' } });
            const ecranAlice = await creerEcran('ECR-ALICE', pcAlice());
            const ecranBob = await creerEcran('ECR-BOB', pcBob());

            const res = await affecterABob({ mode_conflit: 'echanger', equipe: 'Audit', motif: 'Besoin de puissance' });

            expect(res.status).toBe(200);
            expect(res.body.message).toMatch(/échangés/);
            expect(await relirePC(pcAlice())).toMatchObject({
                id_n: 20, utilisateur: 'Utilisateur 20', equipe: 'Audit', id_local: bureauBob.id_local, code_ecran: 'ECR-BOB',
            });
            expect(await relirePC(pcBob())).toMatchObject({
                id_n: 10, utilisateur: 'Utilisateur 10', equipe: 'Compta', id_local: bureauAlice.id_local, code_ecran: 'ECR-ALICE',
            });
            expect(await prisma.materiels.count({ where: { est_vide: true } })).toBe(0);

            expect(await prisma.ecran.findUnique({ where: { id_ecran: ecranAlice.id_ecran } })).toMatchObject({ id_materiels: pcBob() });
            expect(await prisma.ecran.findUnique({ where: { id_ecran: ecranBob.id_ecran } })).toMatchObject({ id_materiels: pcAlice() });

            const affA = await affectationsEnCours({ type_affectation: 'PC', id_materiels: pcAlice() });
            const affB = await affectationsEnCours({ type_affectation: 'PC', id_materiels: pcBob() });
            expect(affA).toEqual([expect.objectContaining({ id_n: 20, motif: expect.stringMatching(/^Échange avec le PC .* — Besoin de puissance$/) })]);
            expect(affB).toEqual([expect.objectContaining({ id_n: 10, nom_utilisateur: 'Utilisateur 10' })]);
        });

        it("échange sans écran : rien ne bouge côté écrans", async () => {
            const res = await affecterABob({ mode_conflit: 'echanger' });

            expect(res.status).toBe(200);
            expect(await relirePC(pcAlice())).toMatchObject({ id_n: 20, code_ecran: null });
            expect(await relirePC(pcBob())).toMatchObject({ id_n: 10, code_ecran: null });
            expect(await prisma.affectationMateriel.count({ where: { type_affectation: 'ECRAN' } })).toBe(0);
        });

        it('refuse un échange depuis un PC en stock', async () => {
            await as(admin).post(`/api/materiels_all/${pcAlice()}/affecter`).send({ id_n: null });

            const res = await affecterABob({ mode_conflit: 'echanger' });

            expect(res.status).toBe(400);
            expect(res.body.error).toMatch(/personne avec qui échanger/);
            expect(await relirePC(pcBob())).toMatchObject({ id_n: 20 });
        });
    });
});

describe('POST /api/ecrans/:id/affecter — réaffectation d\'un écran', () => {
    let bob;

    beforeEach(async () => {
        bob = await createUser({ idN: 20, withMateriel: true });
    });

    const pcAlice = () => alice.materiel.id_materiels;
    const pcBob = () => bob.materiel.id_materiels;
    const creerEcran = (code, id_materiels) => prisma.ecran.create({ data: { code_ecran: code, id_materiels, statut: 'AFFECTE' } });
    const relireEcran = (ecran) => prisma.ecran.findUnique({ where: { id_ecran: ecran.id_ecran } });
    const relirePC = (id) => prisma.materiels.findUnique({ where: { id_materiels: id } });

    it.each(['EN_REPARATION', 'REFORME'])("mode « stock » : l'écran remplacé part avec le statut %s", async (statut) => {
        const ecranAlice = await creerEcran('ECR-ALICE', pcAlice());
        const ecranBob = await creerEcran('ECR-BOB', pcBob());

        const res = await as(admin).post(`/api/ecrans/${ecranAlice.id_ecran}/affecter`)
            .send({ id_materiels: pcBob(), mode_conflit: 'stock', statut_ancien_ecran: statut, motif: 'Panne' });

        expect(res.status).toBe(200);
        expect(await relireEcran(ecranAlice)).toMatchObject({ id_materiels: pcBob(), statut: 'AFFECTE' });
        expect(await relireEcran(ecranBob)).toMatchObject({ id_materiels: null, statut });
        expect(await relirePC(pcBob())).toMatchObject({ code_ecran: 'ECR-ALICE' });
        expect(await relirePC(pcAlice())).toMatchObject({ code_ecran: null });

        const [aff] = await prisma.affectationMateriel.findMany({
            where: { type_affectation: 'ECRAN', id_ecran: ecranBob.id_ecran, date_fin: null },
        });
        expect(aff.motif).toBe("Remplacé par l'écran ECR-ALICE — Panne");
    });

    it("mode « stock » sans statut : l'écran remplacé part en stock", async () => {
        const ecranAlice = await creerEcran('ECR-ALICE', pcAlice());
        const ecranBob = await creerEcran('ECR-BOB', pcBob());

        const res = await as(admin).post(`/api/ecrans/${ecranAlice.id_ecran}/affecter`)
            .send({ id_materiels: pcBob(), mode_conflit: 'stock' });

        expect(res.status).toBe(200);
        expect(await relireEcran(ecranBob)).toMatchObject({ id_materiels: null, statut: 'EN_STOCK' });
    });

    it("refuse un statut invalide pour l'écran remplacé", async () => {
        const ecranAlice = await creerEcran('ECR-ALICE', pcAlice());
        const ecranBob = await creerEcran('ECR-BOB', pcBob());

        const res = await as(admin).post(`/api/ecrans/${ecranAlice.id_ecran}/affecter`)
            .send({ id_materiels: pcBob(), mode_conflit: 'stock', statut_ancien_ecran: 'AFFECTE' });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/Statut invalide pour l'ancien écran/);
        expect(await relireEcran(ecranBob)).toMatchObject({ id_materiels: pcBob() });
    });

    it("installe sur un poste sans écran l'écran d'un collègue, qui se retrouve sans écran", async () => {
        const ecranBob = await creerEcran('ECR-BOB', pcBob());
        await prisma.materiels.update({ where: { id_materiels: pcBob() }, data: { code_ecran: 'ECR-BOB' } });

        const res = await as(admin).post(`/api/ecrans/${ecranBob.id_ecran}/affecter`)
            .send({ id_materiels: pcAlice() });

        expect(res.status).toBe(200);
        expect(await relireEcran(ecranBob)).toMatchObject({ id_materiels: pcAlice(), statut: 'AFFECTE' });
        expect(await relirePC(pcAlice())).toMatchObject({ code_ecran: 'ECR-BOB' });
        expect(await relirePC(pcBob())).toMatchObject({ code_ecran: null });

        const traceBob = await prisma.historiqueMateriel.findFirst({
            where: { id_materiels: pcBob() }, orderBy: { id_historique: 'desc' },
        });
        expect(traceBob.nouvelle_valeur).toBe('Écran : aucun');
    });
});
