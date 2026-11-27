import fs from 'fs';
import path from 'path';
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { prisma, resetDatabase, createUser, createTicket, createLocal } from './helpers/db.js';
import { as } from './helpers/http.js';

let admin;
let admin2;
let alice;

const intervention = (overrides = {}) => ({
    date_intervention: '2026-11-26T09:30:00',
    type: 'INSTALLATION',
    description: 'Installation du poste',
    duree_minutes: 45,
    ...overrides,
});

beforeEach(async () => {
    await resetDatabase();
    admin = await createUser({ idN: 1, role: 'IT_ADMIN', withMateriel: true });
    admin2 = await createUser({ idN: 2, role: 'DIRECTION', withMateriel: true });
    alice = await createUser({ idN: 10, role: 'USER', withMateriel: true });
});

afterAll(async () => {
    await prisma.$disconnect();
});

describe('Interventions créées depuis les tickets', () => {
    it('fermer un ticket crée une intervention DEPANNAGE au nom du technicien', async () => {
        const local = await createLocal('Bureau 3');
        await prisma.materiels.update({ where: { id_materiels: alice.materiel.id_materiels }, data: { id_local: local.id_local } });
        const ticket = await createTicket({ materielId: alice.materiel.id_materiels, demandeurIdN: 10, titre: 'Écran noir' });

        const res = await as(admin).put(`/api/tickets/${ticket.idTicket}/close`).send({ solution: 'Câble remplacé', dureeResolution: 30 });
        expect(res.status).toBe(200);

        const rows = await prisma.intervention.findMany();
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({
            source: 'TICKET',
            type: 'DEPANNAGE',
            duree_minutes: 30,
            id_technicien: 1,
            nom_technicien: '1 - Utilisateur 1',
            id_ticket: ticket.idTicket,
            id_materiels: alice.materiel.id_materiels,
            id_n_beneficiaire: 10,
            id_local: local.id_local,
            description: 'Écran noir\nSolution : Câble remplacé',
        });
    });

    it('rouvrir le ticket retire son intervention', async () => {
        const ticket = await createTicket({ materielId: alice.materiel.id_materiels, demandeurIdN: 10 });
        await as(admin).put(`/api/tickets/${ticket.idTicket}/close`).send({ solution: 'OK' });

        const res = await as(admin).put(`/api/tickets/${ticket.idTicket}`).send({ statut: 'EN_COURS' });
        expect(res.status).toBe(200);

        const it1 = await prisma.intervention.findFirst({ where: { id_ticket: ticket.idTicket } });
        expect(it1.date_suppression).not.toBeNull();
    });

    it('la reprise de la migration copie les tickets déjà fermés', async () => {
        const ticket = await createTicket({ materielId: alice.materiel.id_materiels, demandeurIdN: 10, statut: 'RESOLU', titre: 'VPN' });
        await prisma.ticketFermeture.create({
            data: { ticketId: ticket.idTicket, solution: 'Profil recréé', fermePar: 2, dureeResolution: 20, dateFermeture: new Date('2025-03-04T10:00:00Z') },
        });

        const sql = fs.readFileSync(path.join(import.meta.dirname, '../prisma/migrations/20261127120000_add_interventions/migration.sql'), 'utf8');
        const insert = sql.slice(sql.indexOf('INSERT INTO "interventions"'));
        await prisma.$executeRawUnsafe(insert);

        const [row] = await prisma.intervention.findMany();
        expect(row).toMatchObject({
            source: 'TICKET', type: 'DEPANNAGE', duree_minutes: 20, id_technicien: 2,
            nom_technicien: '2 - Utilisateur 2', id_ticket: ticket.idTicket, id_n_beneficiaire: 10,
            description: 'VPN\nSolution : Profil recréé',
        });
        expect(row.date_intervention.toISOString()).toBe('2025-03-04T10:00:00.000Z');
    });
});

describe('Saisie manuelle', () => {
    it('le technicien est l\'utilisateur connecté ; bénéficiaire et local viennent du poste', async () => {
        const local = await createLocal('Salle 1');
        await prisma.materiels.update({ where: { id_materiels: alice.materiel.id_materiels }, data: { id_local: local.id_local } });

        const res = await as(admin).post('/api/interventions').send(intervention({
            id_materiels: alice.materiel.id_materiels,
            id_technicien: 2, // ignoré
            source: 'TICKET', // ignoré
        }));

        expect(res.status).toBe(201);
        expect(res.body).toMatchObject({
            source: 'MANUELLE', id_technicien: 1, nom_technicien: '1 - Utilisateur 1',
            id_n_beneficiaire: 10, id_local: local.id_local, modifiable: true,
        });
    });

    it('refuse un type, une description ou un matériel invalide (400)', async () => {
        expect((await as(admin).post('/api/interventions').send(intervention({ type: 'AUTRE_CHOSE' }))).status).toBe(400);
        expect((await as(admin).post('/api/interventions').send(intervention({ description: '  ' }))).status).toBe(400);
        expect((await as(admin).post('/api/interventions').send(intervention({ id_materiels: 99999 }))).status).toBe(400);
        expect((await as(admin).post('/api/interventions').send(intervention({ date_intervention: 'hier' }))).status).toBe(400);
    });

    it('un technicien ne modifie ni ne supprime que ses propres interventions', async () => {
        const { body: creee } = await as(admin).post('/api/interventions').send(intervention());

        expect((await as(admin2).put(`/api/interventions/${creee.id_intervention}`).send(intervention({ description: 'Piraté' }))).status).toBe(403);
        expect((await as(admin2).delete(`/api/interventions/${creee.id_intervention}`)).status).toBe(403);

        const maj = await as(admin).put(`/api/interventions/${creee.id_intervention}`).send(intervention({ description: 'Corrigé', type: 'PREVENTIF' }));
        expect(maj.status).toBe(200);
        expect(maj.body).toMatchObject({ description: 'Corrigé', type: 'PREVENTIF', id_technicien: 1 });

        expect((await as(admin).delete(`/api/interventions/${creee.id_intervention}`)).status).toBe(204);
        expect((await as(admin).put(`/api/interventions/${creee.id_intervention}`).send(intervention())).status).toBe(404);
    });

    it('un USER n\'a pas accès aux interventions (403)', async () => {
        expect((await as(alice).get('/api/interventions?periode=mois&date=2026-11')).status).toBe(403);
        expect((await as(alice).post('/api/interventions').send(intervention())).status).toBe(403);
    });
});

describe('GET /api/interventions : filtre Jour / Mois / Année', () => {
    beforeEach(async () => {
        await as(admin).post('/api/interventions').send(intervention({ date_intervention: '2026-11-26T09:30:00', duree_minutes: 45 }));
        await as(admin).post('/api/interventions').send(intervention({ date_intervention: '2026-11-26T14:00:00', duree_minutes: 15, type: 'DEPANNAGE' }));
        await as(admin2).post('/api/interventions').send(intervention({ date_intervention: '2026-11-03T10:00:00', duree_minutes: 60 }));
        await as(admin).post('/api/interventions').send(intervention({ date_intervention: '2026-02-10T10:00:00', duree_minutes: null }));
        await as(admin).post('/api/interventions').send(intervention({ date_intervention: '2025-12-31T23:30:00' }));
    });

    it('jour : séries par heure', async () => {
        const res = await as(admin).get('/api/interventions?periode=jour&date=2026-11-26');
        expect(res.status).toBe(200);
        expect(res.body.interventions).toHaveLength(2);
        expect(res.body.stats).toMatchObject({ total: 2, duree_totale: 60 });
        expect(res.body.stats.serie).toHaveLength(24);
        expect(res.body.stats.serie[9].total).toBe(1);
        expect(res.body.stats.serie[14].total).toBe(1);
    });

    it('mois : séries par jour, temps par technicien', async () => {
        const res = await as(admin).get('/api/interventions?periode=mois&date=2026-11');
        expect(res.body.stats.total).toBe(3);
        expect(res.body.stats.serie).toHaveLength(30);
        expect(res.body.stats.serie[25].total).toBe(2);
        expect(res.body.stats.par_technicien.map(t => [t.id_technicien, t.duree])).toEqual([[1, 60], [2, 60]]);
        // modifiable seulement pour les siennes
        expect(res.body.interventions.filter(i => i.modifiable)).toHaveLength(2);
    });

    it('année : séries par mois, bornes exclusives', async () => {
        const res = await as(admin).get('/api/interventions?periode=annee&date=2026');
        expect(res.body.stats.total).toBe(4);
        expect(res.body.stats.serie).toHaveLength(12);
        expect(res.body.stats.serie[1].total).toBe(1);
        expect(res.body.stats.serie[10].total).toBe(3);
    });

    it('filtres type, technicien et source', async () => {
        const parType = await as(admin).get('/api/interventions?periode=annee&date=2026&types=DEPANNAGE');
        expect(parType.body.stats.total).toBe(1);
        const miennes = await as(admin2).get('/api/interventions?periode=annee&date=2026&technicien=moi');
        expect(miennes.body.stats.total).toBe(1);
        const tickets = await as(admin).get('/api/interventions?periode=annee&date=2026&source=TICKET');
        expect(tickets.body.stats.total).toBe(0);
    });

    it('refuse une période ou une date invalide (400)', async () => {
        expect((await as(admin).get('/api/interventions?periode=semaine&date=2026-11')).status).toBe(400);
        expect((await as(admin).get('/api/interventions?periode=jour&date=2026-02-30')).status).toBe(400);
        expect((await as(admin).get('/api/interventions?periode=mois')).status).toBe(400);
    });
});
