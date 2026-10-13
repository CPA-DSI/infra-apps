// Chargement de l'environnement de test et garde-fou contre la base de dev.
// Utilisé par tests/setup.js (avant chaque fichier de test) et par
// scripts/setup-test-db.js (création / migration de la base de test).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const ENV_TEST_PATH = path.join(backendDir, '.env.test');

// Nom de la base contenu dans une URL PostgreSQL (sans le "/" initial)
export const databaseNameFromUrl = (url) => {
    try {
        return decodeURIComponent(new URL(url).pathname.replace(/^\//, ''));
    } catch {
        return null;
    }
};

// Lève une erreur si l'URL ne pointe pas vers une base dont le nom finit par _test.
// Les tests vident les tables : ils ne doivent JAMAIS tourner sur la base de dev.
export const assertTestDatabaseUrl = (url = process.env.DATABASE_URL) => {
    const dbName = url ? databaseNameFromUrl(url) : null;
    if (!dbName || !dbName.endsWith('_test')) {
        throw new Error(
            `Tests interrompus : DATABASE_URL doit pointer vers une base dont le nom finit par "_test" `
            + `(base actuelle : ${dbName ? `"${dbName}"` : 'non définie'}). `
            + 'Lancez "npm run test:db:setup" pour créer .env.test et la base de test.'
        );
    }
    return dbName;
};

// Charge .env.test s'il existe. Ses valeurs priment sur l'environnement du shell
// (un DATABASE_URL de dev exporté dans le shell ne doit pas être utilisé).
// En CI, il n'y a pas de .env.test : les variables viennent du workflow.
export const loadTestEnv = () => {
    if (fs.existsSync(ENV_TEST_PATH)) {
        dotenv.config({ path: ENV_TEST_PATH, override: true, quiet: true });
    }
};
