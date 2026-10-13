import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { prisma, resetDatabase, createUser } from './helpers/db.js';
import { app, as, anonymous, cookieFor, getTokenCookie } from './helpers/http.js';
import { hasPermission, PERMISSIONS } from '../constants/roles.js';
import { requirePermission } from '../middleware/authMiddleware.js';

beforeEach(async () => {
    await resetDatabase();
});

afterAll(async () => {
    await prisma.$disconnect();
});

describe('POST /api/auth/login', () => {
    it('connecte un utilisateur valide et pose un cookie httpOnly "token"', async () => {
        const user = await createUser({ idN: 101, email: 'alice@test.local', withMateriel: true });

        const res = await anonymous.post('/api/auth/login').send({ email: 'Alice@Test.local ', password: user.password });

        expect(res.status).toBe(200);
        expect(res.body.user).toMatchObject({ id_user: user.id_user, email_1: 'alice@test.local', role: 'USER' });
        expect(res.body.user).not.toHaveProperty('password');
        const cookie = getTokenCookie(res);
        expect(cookie).toBeDefined();
        expect(cookie).toMatch(/HttpOnly/i);

        // Le cookie obtenu authentifie bien /api/auth/me
        const me = await request(app).get('/api/auth/me').set('Cookie', cookie.split(';')[0]);
        expect(me.status).toBe(200);
        expect(me.body).toMatchObject({ id_user: user.id_user, id_n: 101, role: 'USER' });
    });

    it('refuse un mauvais mot de passe avec 401 et { error }', async () => {
        await createUser({ idN: 102, email: 'bob@test.local' });

        const res = await anonymous.post('/api/auth/login').send({ email: 'bob@test.local', password: 'mauvais' });

        expect(res.status).toBe(401);
        expect(res.body).toEqual({ error: expect.any(String) });
        expect(getTokenCookie(res)).toBeUndefined();
    });

    it('répond la même erreur pour un email inconnu (pas d\'énumération)', async () => {
        const res = await anonymous.post('/api/auth/login').send({ email: 'inconnu@test.local', password: 'x' });
        expect(res.status).toBe(401);
        expect(res.body).toEqual({ error: 'Identifiants invalides.' });
    });

    it('refuse une requête sans email ni mot de passe avec 400', async () => {
        const res = await anonymous.post('/api/auth/login').send({});
        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error');
    });

    it('refuse la connexion d\'un compte désactivé avec 403', async () => {
        const user = await createUser({ idN: 103, isActive: false });

        const res = await anonymous.post('/api/auth/login').send({ email: user.email, password: user.password });

        expect(res.status).toBe(403);
        expect(res.body).toHaveProperty('error');
        expect(getTokenCookie(res)).toBeUndefined();
    });

    it('rejette une requête mutante sans en-têtes CSRF (403)', async () => {
        const user = await createUser({ idN: 104 });
        const res = await request(app).post('/api/auth/login').send({ email: user.email, password: user.password });
        expect(res.status).toBe(403);
        expect(res.body).toHaveProperty('error');
    });
});

describe('GET /api/auth/me', () => {
    it('renvoie 401 sans cookie', async () => {
        const res = await request(app).get('/api/auth/me');
        expect(res.status).toBe(401);
        expect(res.body).toHaveProperty('error');
    });

    it('renvoie 403 avec un jeton expiré', async () => {
        const user = await createUser({ idN: 201 });
        const res = await request(app).get('/api/auth/me').set('Cookie', cookieFor(user, { expiresIn: -60 }));
        expect(res.status).toBe(403);
        expect(res.body).toEqual({ error: 'Token expiré.' });
    });

    it('renvoie 403 avec un jeton signé par une autre clé', async () => {
        const user = await createUser({ idN: 202 });
        const res = await request(app)
            .get('/api/auth/me')
            .set('Cookie', cookieFor(user, { secret: 'une-autre-cle-secrete-de-plus-de-32-caracteres' }));
        expect(res.status).toBe(403);
        expect(res.body).toEqual({ error: 'Token invalide.' });
    });

    it('renvoie 403 avec un jeton mal formé', async () => {
        const res = await request(app).get('/api/auth/me').set('Cookie', 'token=pas-un-jwt');
        expect(res.status).toBe(403);
        expect(res.body).toHaveProperty('error');
    });

    it('renvoie 403 et efface le cookie pour un utilisateur désactivé après la connexion', async () => {
        const user = await createUser({ idN: 203 });
        const cookie = cookieFor(user);
        await prisma.users.update({ where: { id_user: user.id_user }, data: { is_active: false } });

        const res = await request(app).get('/api/auth/me').set('Cookie', cookie);

        expect(res.status).toBe(403);
        expect(res.body).toHaveProperty('error');
        expect(getTokenCookie(res)).toMatch(/^token=;/);
    });

    it('prolonge la session en réémettant le cookie (session glissante)', async () => {
        const user = await createUser({ idN: 204 });
        const res = await as(user).get('/api/auth/me');
        expect(res.status).toBe(200);
        expect(getTokenCookie(res)).toMatch(/^token=[^;]+;/);
    });
});

describe('POST /api/auth/logout', () => {
    it('efface le cookie de session', async () => {
        const user = await createUser({ idN: 301 });

        const res = await as(user).post('/api/auth/logout');

        expect(res.status).toBe(200);
        const cookie = getTokenCookie(res);
        expect(cookie).toMatch(/^token=;/);
        expect(cookie).toMatch(/Expires=Thu, 01 Jan 1970/);
    });
});

describe('Rôles et permissions', () => {
    it('un rôle inconnu n\'a aucune permission', () => {
        for (const permission of Object.values(PERMISSIONS)) {
            expect(hasPermission('SUPER_ADMIN', permission)).toBe(false);
            expect(hasPermission(undefined, permission)).toBe(false);
            expect(hasPermission('it_admin', permission)).toBe(false);
        }
    });

    it('requirePermission refuse (403) un rôle inconnu', () => {
        const middleware = requirePermission(PERMISSIONS.USERS_READ);
        let status;
        let body;
        let nextCalled = false;
        const res = { status(code) { status = code; return this; }, json(payload) { body = payload; return this; } };
        middleware({ user: { role: 'SUPER_ADMIN' } }, res, () => { nextCalled = true; });
        expect(nextCalled).toBe(false);
        expect(status).toBe(403);
        expect(body).toHaveProperty('error');
    });

    it('la base refuse d\'enregistrer un rôle hors de l\'enum UserRole', async () => {
        await expect(
            prisma.$executeRawUnsafe(`INSERT INTO users (id_n, role) VALUES (999, 'SUPER_ADMIN')`)
        ).rejects.toThrow();
    });

    it('le rôle fait foi en base : un jeton qui prétend IT_ADMIN pour un USER n\'ouvre pas les routes admin', async () => {
        const user = await createUser({ idN: 401, role: 'USER' });

        const asFakeAdmin = await as(user, { role: 'IT_ADMIN' }).get('/api/users');
        expect(asFakeAdmin.status).toBe(403);

        const asUnknownRole = await as(user, { role: 'SUPER_ADMIN' }).get('/api/users');
        expect(asUnknownRole.status).toBe(403);
    });

    it('un IT_ADMIN accède aux routes admin', async () => {
        const admin = await createUser({ idN: 402, role: 'IT_ADMIN' });
        const res = await as(admin).get('/api/users');
        expect(res.status).toBe(200);
    });
});
