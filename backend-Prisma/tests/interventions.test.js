import fs from 'fs';
import path from 'path';
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { prisma, resetDatabase, createUser, createTicket, createLocal } from './helpers/db.js';
import { as } from './helpers/http.js';
import { periodePrecedente, bornesPeriode } from '../services/interventionService.js';

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
            description: 'Écran noir',
            solution: 'Câble remplacé',
            cloture_ticket: true,
        });
    });

    it('la case « l\'utilisateur n\'a pas pu travailler » passe de la fermeture à l\'intervention', async () => {
        const t1 = await createTicket({ materielId: alice.materiel.id_materiels, demandeurIdN: 10 });
        const t2 = await createTicket({ materielId: alice.materiel.id_materiels, demandeurIdN: 10 });
        expect((await as(admin).put(`/api/tickets/${t1.idTicket}/close`).send({ solution: 'OK', utilisateurBloque: true })).status).toBe(200);
        expect((await as(admin).put(`/api/tickets/${t2.idTicket}/close`).send({ solution: 'OK' })).status).toBe(200);

        expect((await prisma.intervention.findFirst({ where: { id_ticket: t1.idTicket } })).utilisateur_bloque).toBe(true);
        expect((await prisma.intervention.findFirst({ where: { id_ticket: t2.idTicket } })).utilisateur_bloque).toBe(false);
    });

    it('fermeture refusée si utilisateurBloque n\'est pas un booléen (400)', async () => {
        const ticket = await createTicket({ materielId: alice.materiel.id_materiels, demandeurIdN: 10 });
        const res = await as(admin).put(`/api/tickets/${ticket.idTicket}/close`).send({ solution: 'OK', utilisateurBloque: 'oui' });
        expect(res.status).toBe(400);
        expect(await prisma.ticketFermeture.count()).toBe(0);
    });

    it('rouvrir le ticket garde son intervention, qui ne le clôture plus', async () => {
        const ticket = await createTicket({ materielId: alice.materiel.id_materiels, demandeurIdN: 10 });
        await as(admin).put(`/api/tickets/${ticket.idTicket}/close`).send({ solution: 'OK', dureeResolution: 30 });

        const res = await as(admin).put(`/api/tickets/${ticket.idTicket}`).send({ statut: 'EN_COURS' });
        expect(res.status).toBe(200);

        const it1 = await prisma.intervention.findFirst({ where: { id_ticket: ticket.idTicket } });
        expect(it1).toMatchObject({ date_suppression: null, cloture_ticket: false, duree_minutes: 30 });

        // Nouvelle fermeture : nouvelle intervention de clôture, l'ancienne reste
        expect((await as(admin).put(`/api/tickets/${ticket.idTicket}/close`).send({ solution: 'Définitif' })).status).toBe(200);
        const actives = await prisma.intervention.findMany({ where: { id_ticket: ticket.idTicket, date_suppression: null }, orderBy: { id_intervention: 'asc' } });
        expect(actives.map(i => [i.solution, i.cloture_ticket])).toEqual([['OK', false], ['Définitif', true]]);
    });

    it('la reprise de la migration copie les tickets déjà fermés', async () => {
        const ticket = await createTicket({ materielId: alice.materiel.id_materiels, demandeurIdN: 10, statut: 'RESOLU', titre: 'VPN' });
        await prisma.ticketFermeture.create({
            data: { ticketId: ticket.idTicket, solution: 'Profil recréé', fermePar: 2, dureeResolution: 20, dateFermeture: new Date('2025-03-04T10:00:00Z') },
        });

        const sql = fs.readFileSync(path.join(import.meta.dirname, '../prisma/migrations/20261127120000_add_interventions/migration.sql'), 'utf8');
        const insert = sql.slice(sql.indexOf('INSERT INTO "interventions"'));
        await prisma.$executeRawUnsafe(insert);
        // Reprise de la migration intervention_solution_cloture (solution séparée, clôture)
        const sql2 = fs.readFileSync(path.join(import.meta.dirname, '../prisma/migrations/20261127140000_intervention_solution_cloture/migration.sql'), 'utf8');
        const reprise = sql2.slice(sql2.indexOf('UPDATE "interventions"'), sql2.indexOf('CREATE UNIQUE INDEX'));
        for (const requete of reprise.split(/;\s*\n/).map(r => r.replace(/^--.*$/gm, '').trim()).filter(Boolean)) {
            await prisma.$executeRawUnsafe(requete);
        }

        const [row] = await prisma.intervention.findMany();
        expect(row).toMatchObject({
            source: 'TICKET', type: 'DEPANNAGE', duree_minutes: 20, id_technicien: 2,
            nom_technicien: '2 - Utilisateur 2', id_ticket: ticket.idTicket, id_n_beneficiaire: 10,
            description: 'VPN', solution: 'Profil recréé', cloture_ticket: true,
        });
        expect(row.date_intervention.toISOString()).toBe('2025-03-04T10:00:00.000Z');
    });
});

describe('Solution partagée entre ticket et intervention', () => {
    let ticket;
    beforeEach(async () => {
        ticket = await createTicket({ materielId: alice.materiel.id_materiels, demandeurIdN: 10, titre: 'Imprimante' });
    });

    const cloture = (overrides = {}) => intervention({
        type: 'DEPANNAGE', description: 'Passage au poste', solution: 'Pilote réinstallé', duree_minutes: 40,
        id_ticket: ticket.idTicket, cloturer_ticket: true, ...overrides,
    });

    it('clôturer depuis une intervention ferme le ticket en RESOLU sans seconde intervention', async () => {
        const res = await as(admin).post('/api/interventions').send(cloture());
        expect(res.status).toBe(201);
        expect(res.body).toMatchObject({ cloture_ticket: true, solution: 'Pilote réinstallé', source: 'MANUELLE' });

        const t = await prisma.ticket.findUnique({ where: { idTicket: ticket.idTicket }, include: { fermeture: true, commentaires: true } });
        expect(t.statut).toBe('RESOLU');
        expect(t.fermeture).toMatchObject({ solution: 'Pilote réinstallé', dureeResolution: 40, fermePar: 1 });
        expect(t.fermeture.dateFermeture.getTime()).toBe(new Date('2026-11-26T09:30:00').getTime());
        expect(t.commentaires.map(c => c.contenu)).toEqual(['🔒 Ticket fermé\nSolution : Pilote réinstallé']);
        expect(await prisma.intervention.count()).toBe(1);
    });

    it('refuse une clôture sans solution ou sans ticket (400), rien n\'est enregistré', async () => {
        expect((await as(admin).post('/api/interventions').send(cloture({ solution: '  ' }))).status).toBe(400);
        expect((await as(admin).post('/api/interventions').send(cloture({ id_ticket: null }))).status).toBe(400);
        expect(await prisma.intervention.count()).toBe(0);
        expect((await prisma.ticket.findUnique({ where: { idTicket: ticket.idTicket } })).statut).toBe('NOUVEAU');
    });

    it('refuse de clôturer un ticket déjà clôturé (409) et annule l\'intervention', async () => {
        await as(admin).put(`/api/tickets/${ticket.idTicket}/close`).send({ solution: 'Déjà fait' });
        const res = await as(admin).post('/api/interventions').send(cloture());
        expect(res.status).toBe(409);
        expect(await prisma.intervention.count()).toBe(1);
    });

    it('une intervention liée sans la case ne clôture pas le ticket', async () => {
        const res = await as(admin).post('/api/interventions').send(cloture({ cloturer_ticket: false }));
        expect(res.body).toMatchObject({ cloture_ticket: false, solution: 'Pilote réinstallé' });
        expect((await prisma.ticket.findUnique({ where: { idTicket: ticket.idTicket } })).statut).toBe('NOUVEAU');
    });

    it('clôturer en modifiant une intervention existante', async () => {
        const { body: creee } = await as(admin).post('/api/interventions').send(cloture({ cloturer_ticket: false }));
        const res = await as(admin).put(`/api/interventions/${creee.id_intervention}`).send(cloture());
        expect(res.status).toBe(200);
        expect(res.body.cloture_ticket).toBe(true);
        expect((await prisma.ticketFermeture.findUnique({ where: { ticketId: ticket.idTicket } })).solution).toBe('Pilote réinstallé');
    });

    it('modifier l\'intervention de clôture met à jour la fermeture du ticket', async () => {
        // Fermeture depuis la page Tickets, puis correction dans l'historique
        await as(admin).put(`/api/tickets/${ticket.idTicket}/close`).send({ solution: 'Pilote', dureeResolution: 10 });
        const it1 = await prisma.intervention.findFirst({ where: { id_ticket: ticket.idTicket } });

        const maj = await as(admin).put(`/api/interventions/${it1.id_intervention}`).send(intervention({
            type: 'DEPANNAGE', description: 'Imprimante', solution: 'Pilote 2.1 installé', duree_minutes: 25, id_ticket: ticket.idTicket,
        }));
        expect(maj.status).toBe(200);
        expect(maj.body.cloture_ticket).toBe(true);
        expect(await prisma.ticketFermeture.findUnique({ where: { ticketId: ticket.idTicket } }))
            .toMatchObject({ solution: 'Pilote 2.1 installé', dureeResolution: 25 });
    });

    it('l\'intervention de clôture garde son ticket et sa solution', async () => {
        const { body: creee } = await as(admin).post('/api/interventions').send(cloture());
        const autre = await createTicket({ materielId: alice.materiel.id_materiels, demandeurIdN: 10 });
        expect((await as(admin).put(`/api/interventions/${creee.id_intervention}`).send(cloture({ id_ticket: autre.idTicket }))).status).toBe(400);
        expect((await as(admin).put(`/api/interventions/${creee.id_intervention}`).send(cloture({ solution: '' }))).status).toBe(400);
    });

    it('suppression refusée tant que le ticket est clôturé, permise après réouverture', async () => {
        const { body: creee } = await as(admin).post('/api/interventions').send(cloture());
        expect((await as(admin).delete(`/api/interventions/${creee.id_intervention}`)).status).toBe(409);
        await as(admin).put(`/api/tickets/${ticket.idTicket}`).send({ statut: 'EN_COURS' });
        expect(await prisma.ticketFermeture.count()).toBe(0);
        expect((await as(admin).delete(`/api/interventions/${creee.id_intervention}`)).status).toBe(204);
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

    it('enregistre et modifie la case « l\'utilisateur n\'a pas pu travailler »', async () => {
        const sans = await as(admin).post('/api/interventions').send(intervention());
        expect(sans.body.utilisateur_bloque).toBe(false);

        const avec = await as(admin).post('/api/interventions').send(intervention({ utilisateur_bloque: true }));
        expect(avec.status).toBe(201);
        expect(avec.body.utilisateur_bloque).toBe(true);

        const maj = await as(admin).put(`/api/interventions/${avec.body.id_intervention}`).send(intervention({ utilisateur_bloque: false }));
        expect(maj.body.utilisateur_bloque).toBe(false);

        expect((await as(admin).post('/api/interventions').send(intervention({ utilisateur_bloque: 'oui' }))).status).toBe(400);
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

    it('compte et filtre les interventions où l\'utilisateur n\'a pas pu travailler', async () => {
        await as(admin).post('/api/interventions').send(intervention({ date_intervention: '2026-11-20T10:00:00', utilisateur_bloque: true }));
        const tout = await as(admin).get('/api/interventions?periode=mois&date=2026-11');
        expect(tout.body.stats).toMatchObject({ total: 4, utilisateurs_bloques: 1 });
        const bloquees = await as(admin).get('/api/interventions?periode=mois&date=2026-11&bloque=1');
        expect(bloquees.body.stats).toMatchObject({ total: 1, utilisateurs_bloques: 1 });
    });

    it('refuse une période ou une date invalide (400)', async () => {
        expect((await as(admin).get('/api/interventions?periode=semaine&date=2026-11')).status).toBe(400);
        expect((await as(admin).get('/api/interventions?periode=jour&date=2026-02-30')).status).toBe(400);
        expect((await as(admin).get('/api/interventions?periode=mois')).status).toBe(400);
    });
});

describe('Tableau de bord : période précédente', () => {
    const local = (...a) => new Date(...a);

    it('période passée : la période précédente entière', () => {
        const p = periodePrecedente('mois', bornesPeriode('mois', '2025-03'), local(2026, 10, 27));
        expect(p).toMatchObject({ debut: local(2025, 1, 1), fin: local(2025, 2, 1), aDate: false, aVenir: false });
    });

    it('période en cours : comparaison à date', () => {
        const maintenant = local(2026, 10, 27, 10, 30);
        expect(periodePrecedente('mois', bornesPeriode('mois', '2026-11'), maintenant))
            .toMatchObject({ debut: local(2026, 9, 1), fin: local(2026, 9, 27, 10, 30), aDate: true });
        expect(periodePrecedente('jour', bornesPeriode('jour', '2026-11-27'), maintenant))
            .toMatchObject({ debut: local(2026, 10, 26), fin: local(2026, 10, 26, 10, 30), aDate: true });
        expect(periodePrecedente('annee', bornesPeriode('annee', '2026'), maintenant))
            .toMatchObject({ debut: local(2025, 0, 1), fin: local(2025, 10, 27, 10, 30), aDate: true });
    });

    it('fin de mois et année bissextile ramenées au dernier jour', () => {
        expect(periodePrecedente('mois', bornesPeriode('mois', '2026-03'), local(2026, 2, 31, 9)).fin).toEqual(local(2026, 1, 28, 9));
        expect(periodePrecedente('annee', bornesPeriode('annee', '2028'), local(2028, 1, 29, 9)).fin).toEqual(local(2027, 1, 28, 9));
    });

    it('période à venir', () => {
        expect(periodePrecedente('mois', bornesPeriode('mois', '2026-12'), local(2026, 10, 27)).aVenir).toBe(true);
    });
});

describe('GET /api/interventions/stats', () => {
    beforeEach(async () => {
        await as(admin).post('/api/interventions').send(intervention({ date_intervention: '2025-10-05T09:00:00', duree_minutes: 30 }));
        await as(admin).post('/api/interventions').send(intervention({ date_intervention: '2025-10-20T14:00:00', duree_minutes: 30, utilisateur_bloque: true }));
        await as(admin).post('/api/interventions').send(intervention({ date_intervention: '2025-11-26T09:30:00', duree_minutes: 45, utilisateur_bloque: true }));
        await as(admin2).post('/api/interventions').send(intervention({ date_intervention: '2025-11-03T10:00:00', duree_minutes: 60 }));
        await as(admin).post('/api/interventions').send(intervention({ date_intervention: '2025-11-04T10:00:00', duree_minutes: 15 }));
    });

    it('renvoie les statistiques sans la liste, avec la période précédente', async () => {
        const res = await as(admin).get('/api/interventions/stats?periode=mois&date=2025-11');
        expect(res.status).toBe(200);
        expect(res.body.interventions).toBeUndefined();
        expect(res.body.stats).toMatchObject({ total: 3, duree_totale: 120, utilisateurs_bloques: 1 });
        expect(res.body.stats.serie).toHaveLength(30);
        expect(res.body.precedent).toMatchObject({ total: 2, duree_totale: 60, utilisateurs_bloques: 1, a_date: false, a_venir: false });
    });

    it('mêmes chiffres que la page Historique', async () => {
        const stats = await as(admin).get('/api/interventions/stats?periode=annee&date=2025');
        const historique = await as(admin).get('/api/interventions?periode=annee&date=2025');
        expect(stats.body.stats).toEqual(historique.body.stats);
    });

    it('ignore les interventions supprimées, refuse une période invalide, interdit aux USER', async () => {
        const { body } = await as(admin).post('/api/interventions').send(intervention({ date_intervention: '2025-11-10T10:00:00' }));
        await as(admin).delete(`/api/interventions/${body.id_intervention}`);
        expect((await as(admin).get('/api/interventions/stats?periode=mois&date=2025-11')).body.stats.total).toBe(3);
        expect((await as(admin).get('/api/interventions/stats?periode=semaine&date=2025-11')).status).toBe(400);
        expect((await as(alice).get('/api/interventions/stats?periode=mois&date=2025-11')).status).toBe(403);
    });
});
