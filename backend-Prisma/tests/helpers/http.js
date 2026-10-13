// Helpers HTTP : client Supertest sur l'app Express, cookie de session et en-têtes CSRF.
import jwt from 'jsonwebtoken';
import request from 'supertest';
import app from '../../app.js';
import { CSRF_HEADER_NAME, CSRF_HEADER_VALUE } from '../../middleware/csrfMiddleware.js';

export { app };

export const TEST_ORIGIN = 'http://localhost:3000';

// Jeton de session tel que le génère controllers/authController.js (login),
// pour authentifier une requête sans passer par /api/auth/login (rate-limité).
export const signTokenFor = (user, { expiresIn = '10m', secret = process.env.JWT_SECRET, ...overrides } = {}) =>
    jwt.sign(
        {
            userId: user.id_user,
            id_n: user.id_n,
            email_1: user.email ?? null,
            email_2: null,
            role: user.role,
            must_change_password: false,
            ...overrides,
        },
        secret,
        { expiresIn },
    );

export const cookieFor = (user, options) => `token=${signTokenFor(user, options)}`;

// Client authentifié : chaque méthode renvoie une requête Supertest avec le
// cookie de session, et les en-têtes CSRF pour les méthodes mutantes.
export const as = (user, options) => {
    const cookie = cookieFor(user, options);
    const withCsrf = (req) => req.set('Cookie', cookie).set('Origin', TEST_ORIGIN).set(CSRF_HEADER_NAME, CSRF_HEADER_VALUE);
    return {
        get: (url) => request(app).get(url).set('Cookie', cookie),
        post: (url) => withCsrf(request(app).post(url)),
        put: (url) => withCsrf(request(app).put(url)),
        patch: (url) => withCsrf(request(app).patch(url)),
        delete: (url) => withCsrf(request(app).delete(url)),
    };
};

// Requête mutante anonyme avec en-têtes CSRF valides
export const anonymous = {
    get: (url) => request(app).get(url),
    post: (url) => request(app).post(url).set('Origin', TEST_ORIGIN).set(CSRF_HEADER_NAME, CSRF_HEADER_VALUE),
};

// Extrait la valeur du cookie "token" d'une réponse (undefined si absent)
export const getTokenCookie = (res) => {
    const cookies = res.headers['set-cookie'] || [];
    return cookies.find((c) => c.startsWith('token='));
};
