import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { prisma, resetDatabase, createUser, createTicket } from './helpers/db.js';
import { as } from './helpers/http.js';

let admin;
let alice;
let bob;
let ticketAlice;
let ticketBob;

beforeEach(async () => {
    await resetDatabase();
    admin = await createUser({ idN: 1, role: 'IT_ADMIN', withMateriel: true });
    alice = await createUser({ idN: 10, role: 'USER', withMateriel: true });
    bob = await createUser({ idN: 20, role: 'USER', withMateriel: true });
    ticketAlice = await createTicket({ materielId: alice.materiel.id_materiels, demandeurIdN: 10, titre: 'Ticket Alice' });
    ticketBob = await createTicket({ materielId: bob.materiel.id_materiels, demandeurIdN: 20, titre: 'Ticket Bob' });
});

afterAll(async () => {
    await prisma.$disconnect();
});

describe('POST /api/tickets', () => {
    it('un USER crée un ticket sur son matériel ; demandeur, statut et assigné sont imposés', async () => {
        const res = await as(alice).post('/api/tickets').send({
            titre: 'Écran noir',
            description: 'Plus d\'affichage',
            idMateriels: alice.materiel.id_materiels,
            idDemandeur: 20,      // ignoré : forcé à l'utilisateur connecté
            statut: 'RESOLU',     // ignoré : un USER crée toujours NOUVEAU
            idAssigne: 1,         // ignoré : assignation réservée à la DSI
            priorite: 'HAUTE',
        });

        expect(res.status).toBe(201);
        expect(res.body).toMatchObject({
            titre: 'Écran noir',
            idDemandeur: 10,
            idAssigne: null,
            statut: 'NOUVEAU',
            priorite: 'HAUTE',
            idMateriels: alice.materiel.id_materiels,
        });
        expect(res.body.numeroTicket).toMatch(/^TICK-\d{4}-\d{6}$/);
    });

    it('attribue des numéros de ticket successifs', async () => {
        const body = { titre: 'T', description: 'D', idMateriels: alice.materiel.id_materiels };
        const r1 = await as(alice).post('/api/tickets').send(body);
        const r2 = await as(alice).post('/api/tickets').send(body);
        expect(r1.status).toBe(201);
        expect(r2.status).toBe(201);
        const n1 = Number(r1.body.numeroTicket.slice(-6));
        const n2 = Number(r2.body.numeroTicket.slice(-6));
        expect(n2).toBe(n1 + 1);
    });

    it('un USER ne peut pas créer de ticket sur le matériel d\'un autre (403)', async () => {
        const res = await as(alice).post('/api/tickets').send({
            titre: 'T', description: 'D', idMateriels: bob.materiel.id_materiels,
        });
        expect(res.status).toBe(403);
        expect(res.body).toHaveProperty('error');
    });

    it('refuse un matériel inexistant (400)', async () => {
        const res = await as(alice).post('/api/tickets').send({ titre: 'T', description: 'D', idMateriels: 999999 });
        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error');
    });

    it('un admin peut créer un ticket au nom d\'un utilisateur', async () => {
        const res = await as(admin).post('/api/tickets').send({
            titre: 'T', description: 'D', idMateriels: bob.materiel.id_materiels, idDemandeur: 20, idAssigne: 1, statut: 'EN_COURS',
        });
        expect(res.status).toBe(201);
        expect(res.body).toMatchObject({ idDemandeur: 20, idAssigne: 1, statut: 'EN_COURS' });
    });
});

describe('Lecture des tickets', () => {
    it('un USER ne liste que ses tickets (demandeur ou assigné)', async () => {
        const assigneAAlice = await createTicket({ materielId: bob.materiel.id_materiels, demandeurIdN: 20, assigneIdN: 10 });

        const res = await as(alice).get('/api/tickets');

        expect(res.status).toBe(200);
        const ids = res.body.map((t) => t.idTicket).sort();
        expect(ids).toEqual([ticketAlice.idTicket, assigneAAlice.idTicket].sort());
    });

    it('un admin liste tous les tickets', async () => {
        const res = await as(admin).get('/api/tickets');
        expect(res.status).toBe(200);
        expect(res.body.map((t) => t.idTicket).sort()).toEqual([ticketAlice.idTicket, ticketBob.idTicket].sort());
    });

    it('un USER lit son propre ticket', async () => {
        const res = await as(alice).get(`/api/tickets/${ticketAlice.idTicket}`);
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ idTicket: ticketAlice.idTicket, titre: 'Ticket Alice' });
    });

    it('un USER ne peut pas lire le ticket d\'un autre (403)', async () => {
        const res = await as(alice).get(`/api/tickets/${ticketBob.idTicket}`);
        expect(res.status).toBe(403);
        expect(res.body).toHaveProperty('error');
        expect(res.body).not.toHaveProperty('titre');
    });

    it('renvoie 404 pour un ticket inexistant, 400 pour un id non numérique', async () => {
        expect((await as(alice).get('/api/tickets/999999')).status).toBe(404);
        expect((await as(admin).get('/api/tickets/999999')).status).toBe(404);
        expect((await as(alice).get('/api/tickets/abc')).status).toBe(400);
    });

    it('un admin lit n\'importe quel ticket', async () => {
        const res = await as(admin).get(`/api/tickets/${ticketBob.idTicket}`);
        expect(res.status).toBe(200);
        expect(res.body.idTicket).toBe(ticketBob.idTicket);
    });
});

describe('Modification des tickets', () => {
    it('un USER modifie le titre de son ticket', async () => {
        const res = await as(alice).put(`/api/tickets/${ticketAlice.idTicket}`).send({ titre: 'Nouveau titre' });
        expect(res.status).toBe(200);
        expect(res.body.titre).toBe('Nouveau titre');
    });

    it('un USER ne peut pas modifier le ticket d\'un autre (403)', async () => {
        const res = await as(alice).put(`/api/tickets/${ticketBob.idTicket}`).send({ titre: 'Piraté' });
        expect(res.status).toBe(403);
        const enBase = await prisma.ticket.findUnique({ where: { idTicket: ticketBob.idTicket } });
        expect(enBase.titre).toBe('Ticket Bob');
    });

    it('un USER ne peut pas changer le statut ni l\'assignation de son ticket (403)', async () => {
        const res = await as(alice).put(`/api/tickets/${ticketAlice.idTicket}`).send({ statut: 'RESOLU', idAssigne: 10 });
        expect(res.status).toBe(403);
        const enBase = await prisma.ticket.findUnique({ where: { idTicket: ticketAlice.idTicket } });
        expect(enBase.statut).toBe('NOUVEAU');
    });

    it('un USER ne peut ni assigner ni supprimer un ticket (403)', async () => {
        const assign = await as(alice).put(`/api/tickets/${ticketAlice.idTicket}/assign`).send({ idAssigne: 10 });
        const suppression = await as(alice).delete(`/api/tickets/${ticketAlice.idTicket}`);
        expect(assign.status).toBe(403);
        expect(suppression.status).toBe(403);
        expect(await prisma.ticket.count()).toBe(2);
    });
});

describe('Fermeture des tickets', () => {
    it('un USER ne peut pas fermer son propre ticket (403, permission tickets:close)', async () => {
        const res = await as(alice).put(`/api/tickets/${ticketAlice.idTicket}/close`).send({ solution: 'Réglé' });
        expect(res.status).toBe(403);
        expect(res.body).toHaveProperty('error');
        expect(await prisma.ticketFermeture.count()).toBe(0);
        const enBase = await prisma.ticket.findUnique({ where: { idTicket: ticketAlice.idTicket } });
        expect(enBase.statut).toBe('NOUVEAU');
    });

    it('un admin ferme un ticket : statut RESOLU et fiche de fermeture', async () => {
        const res = await as(admin).put(`/api/tickets/${ticketAlice.idTicket}/close`).send({ solution: ' Câble changé ', dureeResolution: '30' });

        expect(res.status).toBe(200);
        expect(res.body.statut).toBe('RESOLU');
        expect(res.body.fermeture).toMatchObject({ solution: 'Câble changé', fermePar: 1, dureeResolution: 30 });
    });

    it('fermer deux fois renvoie 409 ; une solution vide renvoie 400 ; un ticket inexistant 404', async () => {
        const premiere = await as(admin).put(`/api/tickets/${ticketAlice.idTicket}/close`).send({ solution: 'OK' });
        expect(premiere.status).toBe(200);

        const seconde = await as(admin).put(`/api/tickets/${ticketAlice.idTicket}/close`).send({ solution: 'Encore' });
        expect(seconde.status).toBe(409);

        const sansSolution = await as(admin).put(`/api/tickets/${ticketBob.idTicket}/close`).send({ solution: '  ' });
        expect(sansSolution.status).toBe(400);

        const inexistant = await as(admin).put('/api/tickets/999999/close').send({ solution: 'OK' });
        expect(inexistant.status).toBe(404);
    });

    it('rouvrir un ticket supprime sa fiche de fermeture et permet de le refermer', async () => {
        await as(admin).put(`/api/tickets/${ticketAlice.idTicket}/close`).send({ solution: 'OK' });

        const reouverture = await as(admin).put(`/api/tickets/${ticketAlice.idTicket}`).send({ statut: 'EN_COURS' });
        expect(reouverture.status).toBe(200);
        expect(await prisma.ticketFermeture.count()).toBe(0);

        const refermeture = await as(admin).put(`/api/tickets/${ticketAlice.idTicket}/close`).send({ solution: 'OK 2' });
        expect(refermeture.status).toBe(200);
    });
});

describe('Commentaires', () => {
    it('un USER commente son ticket ; l\'auteur est forcé à l\'utilisateur connecté', async () => {
        const res = await as(alice).post('/api/commentaires').send({ contenu: 'Toujours en panne', idTicket: ticketAlice.idTicket, idAuteur: 20 });

        expect(res.status).toBe(201);
        expect(res.body).toMatchObject({ contenu: 'Toujours en panne', idTicket: ticketAlice.idTicket, idAuteur: 10 });
    });

    it('un USER ne peut ni commenter ni lire les commentaires du ticket d\'un autre (403)', async () => {
        await prisma.historiqueCommentaire.create({ data: { contenu: 'Secret', idTicket: ticketBob.idTicket, idAuteur: 20 } });

        const post = await as(alice).post('/api/commentaires').send({ contenu: 'Intrusion', idTicket: ticketBob.idTicket });
        const get = await as(alice).get(`/api/commentaires/ticket/${ticketBob.idTicket}`);

        expect(post.status).toBe(403);
        expect(get.status).toBe(403);
        expect(get.body).not.toBeInstanceOf(Array);
        expect(await prisma.historiqueCommentaire.count()).toBe(1);
    });

    it('commenter un ticket inexistant renvoie 404', async () => {
        const res = await as(alice).post('/api/commentaires').send({ contenu: 'X', idTicket: 999999 });
        expect(res.status).toBe(404);
    });

    it('un admin lit les commentaires de tous les tickets', async () => {
        await prisma.historiqueCommentaire.create({ data: { contenu: 'Note de Bob', idTicket: ticketBob.idTicket, idAuteur: 20 } });

        const res = await as(admin).get(`/api/commentaires/ticket/${ticketBob.idTicket}`);

        expect(res.status).toBe(200);
        expect(res.body.map((c) => c.contenu)).toEqual(['Note de Bob']);
    });

    it('seul l\'auteur (ou un admin) peut modifier / supprimer un commentaire', async () => {
        const commentaire = await prisma.historiqueCommentaire.create({
            data: { contenu: 'Message d\'Alice', idTicket: ticketAlice.idTicket, idAuteur: 10 },
        });

        const modifParBob = await as(bob).put(`/api/commentaires/${commentaire.idCommentaire}`).send({ contenu: 'Modifié par Bob' });
        const suppressionParBob = await as(bob).delete(`/api/commentaires/${commentaire.idCommentaire}`);
        expect(modifParBob.status).toBe(403);
        expect(suppressionParBob.status).toBe(403);

        const modifParAlice = await as(alice).put(`/api/commentaires/${commentaire.idCommentaire}`).send({ contenu: 'Corrigé' });
        expect(modifParAlice.status).toBe(200);
        expect(modifParAlice.body.contenu).toBe('Corrigé');

        const suppressionParAdmin = await as(admin).delete(`/api/commentaires/${commentaire.idCommentaire}`);
        expect(suppressionParAdmin.status).toBe(200);
        expect(await prisma.historiqueCommentaire.count()).toBe(0);
    });
});
