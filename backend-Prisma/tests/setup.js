// Exécuté avant chaque fichier de test (vitest.config.js > setupFiles), donc
// avant l'import de app.js / prismaClient.js par les tests.
import { loadTestEnv, assertTestDatabaseUrl } from './helpers/testEnv.js';

loadTestEnv();
assertTestDatabaseUrl();

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET (>= 32 caractères) doit être défini pour les tests (.env.test ou variables CI).');
}
if (!/^[0-9a-fA-F]{64}$/.test(process.env.PASS_MAIL_ENCRYPTION_KEY || '')) {
    throw new Error('PASS_MAIL_ENCRYPTION_KEY (64 caractères hexadécimaux) doit être défini pour les tests.');
}

// Origine autorisée par CORS / CSRF (voir app.js) : on la fixe pour que les
// requêtes mutantes des tests portent une origine acceptée.
process.env.CORS_ORIGIN = 'http://localhost:3000';
process.env.NODE_ENV = 'test';
